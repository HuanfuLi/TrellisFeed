import { dbExecute, dbQuery } from './db.service.ts';
import { studyContextService } from './study-context.service.ts';
import { enqueue as enqueueUpload } from './upload-queue.service.ts';
import type {
  InteractionEventType,
  QuestionAnswerRecord,
  UserInteractionEvent,
} from '../types/index.ts';
import type { AIAnswer, UserQuestion } from '../domain/content.types.ts';
import { hasAffirmativeResearchConsent } from './research-consent.service.ts';

type EventField = 'postId' | 'questionId' | 'recommendationId' | 'durationMs';
type InteractionEventFields = Partial<Pick<UserInteractionEvent, EventField>>;

interface CanonicalProjectionInput { question: UserQuestion; answer: AIAnswer }
interface AnswerViewedInput { postId: string; questionId: string }

interface ResearchRecordRow extends Record<string, string | number | null> {
  id: string;
  kind: string;
  revision: number;
  data: string;
}

interface InteractionLogDependencies {
  enqueue(record: UserInteractionEvent | QuestionAnswerRecord): Promise<void>;
  now(): string;
  createId(): string;
  loadGraphMemory?: () => Promise<{
    applyEvent(event: UserInteractionEvent): Promise<{ success: boolean; error?: { message: string } }>;
  }>;
  reportGraphMemoryError?: (error: unknown) => void;
}

const EVENT_FIELDS: Record<InteractionEventType, readonly EventField[]> = {
  app_open: [],
  feed_impression: [],
  post_open: ['postId'],
  post_close: ['postId', 'durationMs'],
  source_click: ['postId'],
  video_play: ['postId'],
  video_progress: ['postId', 'durationMs'],
  question_suggestion_click: ['postId', 'questionId'],
  question_submit: ['postId', 'questionId'],
  ai_answer_view: ['postId', 'questionId'],
  save_post: ['postId'],
  not_interested: ['postId'],
  recommendation_reason_view: ['postId', 'recommendationId'],
  notification_received: ['postId', 'recommendationId'],
  notification_open: ['postId', 'recommendationId'],
  session_end: ['durationMs'],
};

const QUESTION_SUBMIT_FIELDS = new Set(['question', 'answer']);
const ANSWER_VIEWED_FIELDS = new Set(['postId', 'questionId']);

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains a disallowed field: ${key}`);
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertEventFields(fields: unknown, allowed: readonly EventField[]): asserts fields is InteractionEventFields {
  assertObject(fields, 'Event fields');
  assertAllowedKeys(fields, new Set(allowed), 'Event fields');

  for (const field of ['postId', 'questionId', 'recommendationId'] as const) {
    if (Object.hasOwn(fields, field)) assertNonEmptyString(fields[field], field);
  }
  if (Object.hasOwn(fields, 'durationMs') &&
      (!Number.isSafeInteger(fields.durationMs) || (fields.durationMs as number) < 0)) {
    throw new Error('durationMs must be a non-negative safe integer');
  }
}

function assertTimestamp(value: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error('Logger clock returned an invalid timestamp');
}

async function persistRecord(
  record: UserInteractionEvent | QuestionAnswerRecord,
  kind: 'event' | 'qa',
): Promise<void> {
  const revision = 'revision' in record ? record.revision : 1;
  await dbExecute(
    'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
    [record.id, kind, revision, JSON.stringify(record)],
  );
}

function parseQuestionAnswerRow(row: ResearchRecordRow): QuestionAnswerRecord | null {
  if (row.kind !== 'qa') return null;
  try {
    const value = JSON.parse(row.data) as Partial<QuestionAnswerRecord>;
    if (typeof value.id !== 'string' || typeof value.questionId !== 'string' ||
        !Number.isSafeInteger(value.revision)) return null;
    return value as QuestionAnswerRecord;
  } catch {
    return null;
  }
}

async function findQuestionAnswer(questionId: string): Promise<QuestionAnswerRecord | null> {
  const rows = await dbQuery<ResearchRecordRow>('SELECT * FROM research_records');
  const matches = rows
    .map(parseQuestionAnswerRow)
    .filter((record): record is QuestionAnswerRecord => record?.questionId === questionId)
    .sort((left, right) => right.revision - left.revision);
  return matches[0] ?? null;
}

export function createInteractionLog(dependencies: InteractionLogDependencies) {
  const loadGraphMemory = dependencies.loadGraphMemory ?? (async () => {
    const module = await import('./graph-memory.service.ts');
    return module.graphMemoryService;
  });
  const reportGraphMemoryError = dependencies.reportGraphMemoryError ?? ((error: unknown) => {
    console.warn('[QuestionTrace] Graph-memory update failed; boot repair will retry.', error);
  });

  function updateGraphMemory(event: UserInteractionEvent): void {
    void loadGraphMemory()
      .then((service) => service.applyEvent(event))
      .then((result) => {
        if (!result.success) reportGraphMemoryError(new Error(result.error?.message ?? 'Unknown graph-memory error'));
      })
      .catch(reportGraphMemoryError);
  }

  async function storeAndEnqueue(
    record: UserInteractionEvent | QuestionAnswerRecord,
    kind: 'event' | 'qa',
  ): Promise<boolean> {
    if (!hasAffirmativeResearchConsent()) return false;
    await persistRecord(record, kind);
    await dependencies.enqueue(record);
    return true;
  }

  async function record(
    eventType: InteractionEventType,
    fields: InteractionEventFields = {},
  ): Promise<UserInteractionEvent> {
    if (!Object.hasOwn(EVENT_FIELDS, eventType)) {
      throw new Error(`Interaction event type is not allowed: ${String(eventType)}`);
    }
    assertEventFields(fields, EVENT_FIELDS[eventType]);

    const identity = studyContextService.getRequired();
    const timestamp = dependencies.now();
    assertTimestamp(timestamp);
    const event: UserInteractionEvent = {
      id: dependencies.createId(),
      userId: identity.userId,
      condition: identity.condition,
      topicId: identity.topicId,
      timestamp,
      eventType,
      ...fields,
    };
    const persisted = await storeAndEnqueue(event, 'event');
    if (persisted) updateGraphMemory(event);
    return event;
  }

  async function recordOnce(
    id: string,
    eventType: 'question_submit' | 'ai_answer_view',
    fields: Pick<UserInteractionEvent, 'postId' | 'questionId'>,
  ): Promise<UserInteractionEvent> {
    const existing = await dbQuery<ResearchRecordRow>('SELECT * FROM research_records WHERE id = ?', [id]);
    if (existing[0]?.kind === 'event') return JSON.parse(existing[0].data) as UserInteractionEvent;
    const identity = studyContextService.getRequired();
    const event: UserInteractionEvent = {
      id, userId: identity.userId, condition: identity.condition, topicId: identity.topicId,
      timestamp: dependencies.now(), eventType, ...fields,
    };
    assertTimestamp(event.timestamp);
    const persisted = await storeAndEnqueue(event, 'event');
    if (persisted) updateGraphMemory(event);
    return event;
  }

  async function recordQuestionSubmit(input: CanonicalProjectionInput): Promise<QuestionAnswerRecord> {
    assertObject(input, 'Question submit');
    assertAllowedKeys(input, QUESTION_SUBMIT_FIELDS, 'Question submit');
    assertObject(input.question, 'Canonical question');
    assertObject(input.answer, 'Canonical answer');
    const { question, answer } = input;
    const identity = studyContextService.getRequired();
    if (question.userId !== identity.userId || question.condition !== identity.condition || question.topicId !== identity.topicId) {
      throw new Error('Canonical question identity does not match the bound study context');
    }
    if (question.aiAnswerId !== answer.id || answer.userQuestionId !== question.id || answer.postId !== question.postId) {
      throw new Error('Canonical question/answer linkage is invalid');
    }
    const [questionRows, answerRows] = await Promise.all([
      dbQuery('SELECT * FROM user_questions WHERE id = ?', [question.id]),
      dbQuery('SELECT * FROM ai_answers WHERE id = ?', [answer.id]),
    ]);
    if (questionRows.length !== 1 || answerRows.length !== 1) {
      throw new Error('Canonical question and answer must be persisted before projection');
    }
    const current = await findQuestionAnswer(question.id);
    const projected: QuestionAnswerRecord = {
      id: `qa:${question.id}`,
      revision: current ? current.revision + 1 : 1,
      userId: identity.userId,
      condition: identity.condition,
      topicId: identity.topicId,
      postId: question.postId,
      questionId: question.id,
      answerId: answer.id,
      questionText: question.text,
      questionSource: question.source,
      ...(question.suggestedQuestionId ? { suggestedQuestionId: question.suggestedQuestionId } : {}),
      questionCreatedAt: question.createdAt,
      answerText: answer.answerText,
      answerCreatedAt: answer.createdAt,
      modelName: answer.modelName,
      citedPostIds: [...answer.citedPostIds],
      ...(answer.citedSourceUrls ? { citedSourceUrls: [...answer.citedSourceUrls] } : {}),
      conceptIds: [...answer.conceptIds],
      ...(answer.claimIds ? { claimIds: [...answer.claimIds] } : {}),
    };
    if (current) {
      const { revision: _currentRevision, ...currentValue } = current;
      const { revision: _nextRevision, ...nextValue } = projected;
      if (JSON.stringify(currentValue) === JSON.stringify(nextValue)) {
        await recordOnce(`event:question_submit:${question.id}`, 'question_submit', { postId: question.postId, questionId: question.id });
        return current;
      }
    }
    await storeAndEnqueue(projected, 'qa');
    await recordOnce(`event:question_submit:${question.id}`, 'question_submit', { postId: question.postId, questionId: question.id });
    return projected;
  }

  async function recordAnswerViewed(input: AnswerViewedInput): Promise<UserInteractionEvent> {
    assertObject(input, 'Answer viewed');
    assertAllowedKeys(input, ANSWER_VIEWED_FIELDS, 'Answer viewed');
    assertNonEmptyString(input.postId, 'postId');
    assertNonEmptyString(input.questionId, 'questionId');
    return recordOnce(`event:ai_answer_view:${input.questionId}`, 'ai_answer_view', input);
  }

  return { record, recordQuestionSubmit, recordAnswerViewed };
}

export const interactionLog = createInteractionLog({
  enqueue: enqueueUpload,
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
});
