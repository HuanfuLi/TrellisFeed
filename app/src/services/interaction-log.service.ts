import { dbExecute, dbQuery } from './db.service.ts';
import { studyContextService } from './study-context.service.ts';
import { enqueue as enqueueUpload } from './upload-queue.service.ts';
import type {
  InteractionEventType,
  QuestionAnswerRecord,
  UserInteractionEvent,
} from '../types/index.ts';

type EventField = 'postId' | 'questionId' | 'recommendationId' | 'durationMs';
type InteractionEventFields = Partial<Pick<UserInteractionEvent, EventField>>;

type QuestionSubmitInput = Pick<
  QuestionAnswerRecord,
  'postId' | 'questionId' | 'questionText' | 'questionSource'
>;

type AnswerViewedInput = Pick<QuestionAnswerRecord, 'questionId' | 'answerText'> & {
  answerText: string;
};

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

const QUESTION_SUBMIT_FIELDS = new Set([
  'postId',
  'questionId',
  'questionText',
  'questionSource',
]);
const ANSWER_VIEWED_FIELDS = new Set(['questionId', 'answerText']);

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
  async function storeAndEnqueue(
    record: UserInteractionEvent | QuestionAnswerRecord,
    kind: 'event' | 'qa',
  ): Promise<void> {
    await persistRecord(record, kind);
    await dependencies.enqueue(record);
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
    await storeAndEnqueue(event, 'event');
    return event;
  }

  async function recordQuestionSubmit(input: QuestionSubmitInput): Promise<QuestionAnswerRecord> {
    assertObject(input, 'Question submit');
    assertAllowedKeys(input, QUESTION_SUBMIT_FIELDS, 'Question submit');
    assertNonEmptyString(input.postId, 'postId');
    assertNonEmptyString(input.questionId, 'questionId');
    assertNonEmptyString(input.questionText, 'questionText');
    if (input.questionSource !== 'typed' && input.questionSource !== 'suggested_question') {
      throw new Error('questionSource is not allowed');
    }
    if (await findQuestionAnswer(input.questionId)) {
      throw new Error('A submitted question record already exists for questionId');
    }

    const identity = studyContextService.getRequired();
    const submittedAt = dependencies.now();
    assertTimestamp(submittedAt);
    const questionAnswer: QuestionAnswerRecord = {
      id: dependencies.createId(),
      revision: 1,
      userId: identity.userId,
      condition: identity.condition,
      topicId: identity.topicId,
      postId: input.postId,
      questionId: input.questionId,
      questionText: input.questionText,
      questionSource: input.questionSource,
      submittedAt,
    };
    await storeAndEnqueue(questionAnswer, 'qa');
    await record(
      input.questionSource === 'typed' ? 'question_submit' : 'question_suggestion_click',
      { postId: input.postId, questionId: input.questionId },
    );
    return questionAnswer;
  }

  async function recordAnswerViewed(input: AnswerViewedInput): Promise<QuestionAnswerRecord> {
    assertObject(input, 'Answer viewed');
    assertAllowedKeys(input, ANSWER_VIEWED_FIELDS, 'Answer viewed');
    assertNonEmptyString(input.questionId, 'questionId');
    assertNonEmptyString(input.answerText, 'answerText');

    const submitted = await findQuestionAnswer(input.questionId);
    if (!submitted) throw new Error('Submitted question record was not found');
    const identity = studyContextService.getRequired();
    if (submitted.userId !== identity.userId || submitted.condition !== identity.condition ||
        submitted.topicId !== identity.topicId) {
      throw new Error('Submitted question identity does not match the bound study context');
    }

    const answerViewedAt = dependencies.now();
    assertTimestamp(answerViewedAt);
    const answered: QuestionAnswerRecord = {
      ...submitted,
      revision: 2,
      answerText: input.answerText,
      answerViewedAt,
    };
    await storeAndEnqueue(answered, 'qa');
    await record('ai_answer_view', {
      postId: submitted.postId,
      questionId: submitted.questionId,
    });
    return answered;
  }

  return { record, recordQuestionSubmit, recordAnswerViewed };
}

export const interactionLog = createInteractionLog({
  enqueue: enqueueUpload,
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
});
