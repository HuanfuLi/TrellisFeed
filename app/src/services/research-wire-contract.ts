import contractJson from '../../../shared/research-wire-contract.v1.json' with { type: 'json' };
import type { QuestionAnswerRecord, UserInteractionEvent } from '../types/index.ts';

const EXPECTED_CONTRACT_VERSION = 'research-ingest-v1';

if (contractJson.version !== EXPECTED_CONTRACT_VERSION) {
  throw new Error(`Unsupported research wire contract: ${String(contractJson.version)}`);
}

export const RESEARCH_WIRE_CONTRACT_VERSION = contractJson.version;
export const RESEARCH_WIRE_LIMITS = Object.freeze({ ...contractJson.limits });
export const RESEARCH_INGEST_ROUTE = contractJson.routes.ingest;
export const RESEARCH_AUTHORIZATION_HEADER = contractJson.authorizationHeader;

type LocalRecord = UserInteractionEvent | QuestionAnswerRecord;
export type ResearchWireRecord = Omit<LocalRecord, 'userId' | 'condition' | 'topicId'>;

const EVENT_TYPES = new Set([
  'app_open',
  'feed_impression',
  'post_open',
  'post_close',
  'source_click',
  'video_play',
  'video_progress',
  'question_suggestion_click',
  'question_submit',
  'ai_answer_view',
  'save_post',
  'not_interested',
  'recommendation_reason_view',
  'notification_received',
  'notification_open',
  'session_end',
]);

const EVENT_FIELDS = new Set([
  'id', 'timestamp', 'eventType', 'postId', 'questionId', 'recommendationId', 'durationMs',
]);
const QA_FIELDS = new Set([
  'id', 'revision', 'postId', 'questionId', 'answerId', 'questionText', 'questionSource',
  'suggestedQuestionId', 'questionCreatedAt', 'answerText', 'answerCreatedAt', 'modelName',
  'citedPostIds', 'citedSourceUrls', 'conceptIds', 'claimIds',
]);

export class ResearchWireValidationError extends Error {
  readonly reason: 'invalid_record' | 'oversized_record';

  constructor(reason: 'invalid_record' | 'oversized_record') {
    super(reason);
    this.name = 'ResearchWireValidationError';
    this.reason = reason;
  }
}

export function researchWireByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function assertString(
  value: unknown,
  maxLength: number,
  optional = false,
): asserts value is string | undefined {
  if (optional && value === undefined) return;
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new ResearchWireValidationError('invalid_record');
  }
}

function assertTimestamp(value: unknown, optional = false): void {
  assertString(value, RESEARCH_WIRE_LIMITS.timestamp, optional);
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw new ResearchWireValidationError('invalid_record');
  }
}

function assertStringArray(value: unknown, optional = false): void {
  if (optional && value === undefined) return;
  if (!Array.isArray(value) || value.length > 256 || value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > RESEARCH_WIRE_LIMITS.text)) {
    throw new ResearchWireValidationError('invalid_record');
  }
}

function assertOnlyFields(record: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new ResearchWireValidationError('invalid_record');
  }
}

/** Strip local/server-owned identity and validate the exact committed v1 wire shape. */
export function toResearchWireRecord(record: LocalRecord): ResearchWireRecord {
  const { userId: _userId, condition: _condition, topicId: _topicId, ...wire } = record;
  const candidate = wire as Record<string, unknown>;

  assertString(candidate.id, RESEARCH_WIRE_LIMITS.id);
  if (Object.hasOwn(candidate, 'eventType')) {
    assertOnlyFields(candidate, EVENT_FIELDS);
    if (typeof candidate.eventType !== 'string' || !EVENT_TYPES.has(candidate.eventType)) {
      throw new ResearchWireValidationError('invalid_record');
    }
    assertTimestamp(candidate.timestamp);
    assertString(candidate.postId, RESEARCH_WIRE_LIMITS.postId, true);
    assertString(candidate.questionId, RESEARCH_WIRE_LIMITS.questionId, true);
    assertString(candidate.recommendationId, RESEARCH_WIRE_LIMITS.id, true);
    if (candidate.durationMs !== undefined &&
        (!Number.isSafeInteger(candidate.durationMs) || (candidate.durationMs as number) < 0)) {
      throw new ResearchWireValidationError('invalid_record');
    }
  } else {
    assertOnlyFields(candidate, QA_FIELDS);
    if (!Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) {
      throw new ResearchWireValidationError('invalid_record');
    }
    assertString(candidate.postId, RESEARCH_WIRE_LIMITS.postId);
    assertString(candidate.questionId, RESEARCH_WIRE_LIMITS.questionId);
    assertString(candidate.answerId, RESEARCH_WIRE_LIMITS.id);
    assertString(candidate.questionText, RESEARCH_WIRE_LIMITS.text);
    assertString(candidate.answerText, RESEARCH_WIRE_LIMITS.text);
    assertString(candidate.modelName, RESEARCH_WIRE_LIMITS.id);
    assertString(candidate.suggestedQuestionId, RESEARCH_WIRE_LIMITS.questionId, true);
    assertTimestamp(candidate.questionCreatedAt);
    assertTimestamp(candidate.answerCreatedAt);
    assertStringArray(candidate.citedPostIds);
    assertStringArray(candidate.citedSourceUrls, true);
    assertStringArray(candidate.conceptIds);
    assertStringArray(candidate.claimIds, true);
    if (candidate.questionSource !== 'typed' && candidate.questionSource !== 'suggested_question') {
      throw new ResearchWireValidationError('invalid_record');
    }
  }

  const singletonBody = JSON.stringify({ records: [candidate] });
  if (researchWireByteLength(singletonBody) > RESEARCH_WIRE_LIMITS.maxRequestBytes) {
    throw new ResearchWireValidationError('oversized_record');
  }
  return wire as ResearchWireRecord;
}
