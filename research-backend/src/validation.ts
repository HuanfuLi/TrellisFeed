import contract from '../../shared/research-wire-contract.v1.json' with { type: 'json' };

export const MAX_INGEST_RECORDS = contract.limits.maxRecords;
export const MAX_REQUEST_BYTES = contract.limits.maxRequestBytes;

export const EVENT_TYPES = new Set([
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
  'id',
  'timestamp',
  'eventType',
  'postId',
  'questionId',
  'recommendationId',
  'durationMs',
]);

const QUESTION_ANSWER_FIELDS = new Set([
  'id',
  'revision',
  'postId',
  'questionId',
  'answerId',
  'questionText',
  'questionSource',
  'suggestedQuestionId',
  'questionCreatedAt',
  'answerText',
  'answerCreatedAt',
  'modelName',
  'citedPostIds',
  'citedSourceUrls',
  'conceptIds',
  'claimIds',
  'extractedConceptIds',
  'extractedClaimIds',
  'questionType',
  'unresolved',
]);

const RECOMMENDATION_FIELDS = new Set([
  'kind',
  'id',
  'batchId',
  'sessionId',
  'batchSeq',
  'batchPosition',
  'postId',
  'generatedAt',
  'strategy',
  'score',
  'reasonText',
  'contributingQuestionIds',
  'contributingConceptIds',
  'contributingPostIds',
  'componentScores',
]);

export const RECOMMENDATION_STRATEGIES = new Set(contract.recommendation.strategies);

export class ValidationError extends Error {
  status;

  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byteLength(value) {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      throw new ValidationError('Request body must be JSON serializable.');
    }
    return new TextEncoder().encode(serialized).byteLength;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('Request body must be JSON serializable.');
  }
}

function assertAllowedFields(record, allowedFields, recordType) {
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throw new ValidationError(`${recordType} contains a disallowed field: ${key}.`);
    }
  }
}

function assertString(record, field, recordType, { optional = false, maxLength = contract.limits.text } = {}) {
  const value = record[field];
  if (optional && value === undefined) return;

  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new ValidationError(`${recordType}.${field} must be a non-empty string.`);
  }
}

function assertTimestamp(record, field, recordType, { optional = false } = {}) {
  if (optional && record[field] === undefined) return;
  assertString(record, field, recordType, { optional, maxLength: contract.limits.timestamp });
  if (Number.isNaN(Date.parse(record[field]))) {
    throw new ValidationError(`${recordType}.${field} must be an ISO-parseable timestamp.`);
  }
}

function assertStringArray(record, field, recordType, { optional = false } = {}) {
  const value = record[field];
  if (optional && value === undefined) return;
  if (!Array.isArray(value) || value.length > 256 || value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > contract.limits.text)) {
    throw new ValidationError(`${recordType}.${field} must be a bounded string array.`);
  }
}

function assertRecommendationStringArray(record, field, recordType) {
  const value = record[field];
  if (value === undefined) return;

  if (!Array.isArray(value) ||
      value.length > contract.recommendation.limits.contributorArrayItems ||
      value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > contract.limits.postId)) {
    throw new ValidationError(`${recordType}.${field} must be a bounded string array.`);
  }
}

function assertComponentScores(record, recordType) {
  const value = record.componentScores;
  if (value === undefined) return;

  if (!isRecord(value)) {
    throw new ValidationError(`${recordType}.componentScores must be a bounded finite-number object.`);
  }

  const entries = Object.entries(value);
  if (entries.length > contract.recommendation.limits.componentScoreKeys ||
      entries.some(([key, score]) =>
        key.length === 0 ||
        key.length > contract.recommendation.limits.componentScoreKeyLength ||
        typeof score !== 'number' ||
        !Number.isFinite(score))) {
    throw new ValidationError(`${recordType}.componentScores must be a bounded finite-number object.`);
  }
}

function parseEvent(record) {
  const recordType = 'Event record';
  assertAllowedFields(record, EVENT_FIELDS, recordType);
  assertString(record, 'id', recordType, { maxLength: contract.limits.id });
  assertTimestamp(record, 'timestamp', recordType);

  if (typeof record.eventType !== 'string' || !EVENT_TYPES.has(record.eventType)) {
    throw new ValidationError('Event record.eventType is not allowed.');
  }

  assertString(record, 'postId', recordType, { optional: true, maxLength: contract.limits.postId });
  assertString(record, 'questionId', recordType, { optional: true, maxLength: contract.limits.questionId });
  assertString(record, 'recommendationId', recordType, { optional: true, maxLength: contract.limits.id });

  if (record.durationMs !== undefined &&
      (!Number.isSafeInteger(record.durationMs) || record.durationMs < 0)) {
    throw new ValidationError('Event record.durationMs must be a non-negative safe integer.');
  }

  return { ...record, kind: 'event' };
}

function parseQuestionAnswer(record) {
  const recordType = 'Question/answer record';
  assertAllowedFields(record, QUESTION_ANSWER_FIELDS, recordType);
  assertString(record, 'id', recordType, { maxLength: contract.limits.id });
  assertString(record, 'postId', recordType, { maxLength: contract.limits.postId });
  assertString(record, 'questionId', recordType, { maxLength: contract.limits.questionId });
  assertString(record, 'answerId', recordType, { maxLength: contract.limits.id });
  assertString(record, 'questionText', recordType, { maxLength: contract.limits.text });
  assertString(record, 'answerText', recordType, { maxLength: contract.limits.text });
  assertString(record, 'modelName', recordType, { maxLength: contract.limits.id });
  assertString(record, 'suggestedQuestionId', recordType, { optional: true, maxLength: contract.limits.questionId });
  assertTimestamp(record, 'questionCreatedAt', recordType);
  assertTimestamp(record, 'answerCreatedAt', recordType);
  assertStringArray(record, 'citedPostIds', recordType);
  assertStringArray(record, 'citedSourceUrls', recordType, { optional: true });
  assertStringArray(record, 'conceptIds', recordType);
  assertStringArray(record, 'claimIds', recordType, { optional: true });
  assertStringArray(record, 'extractedConceptIds', recordType, { optional: true });
  assertStringArray(record, 'extractedClaimIds', recordType, { optional: true });
  assertString(record, 'questionType', recordType, { optional: true, maxLength: contract.limits.id });
  if (record.unresolved !== undefined && typeof record.unresolved !== 'boolean') {
    throw new ValidationError('Question/answer record.unresolved must be a boolean.');
  }

  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new ValidationError('Question/answer record.revision must be a positive safe integer.');
  }

  if (record.questionSource !== 'typed' && record.questionSource !== 'suggested_question') {
    throw new ValidationError('Question/answer record.questionSource is not allowed.');
  }

  return { ...record, kind: 'question_answer' };
}

function parseRecommendation(record) {
  const recordType = 'Recommendation record';
  assertAllowedFields(record, RECOMMENDATION_FIELDS, recordType);
  assertString(record, 'id', recordType, { maxLength: contract.limits.id });
  assertString(record, 'batchId', recordType, { maxLength: contract.limits.id });
  assertString(record, 'sessionId', recordType, { maxLength: contract.limits.id });

  if (!Number.isSafeInteger(record.batchSeq) || record.batchSeq <= 0) {
    throw new ValidationError('Recommendation record.batchSeq must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(record.batchPosition) || record.batchPosition <= 0) {
    throw new ValidationError('Recommendation record.batchPosition must be a positive safe integer.');
  }

  assertString(record, 'postId', recordType, { maxLength: contract.limits.postId });
  assertTimestamp(record, 'generatedAt', recordType);

  if (typeof record.strategy !== 'string' || !RECOMMENDATION_STRATEGIES.has(record.strategy)) {
    throw new ValidationError('Recommendation record.strategy is not allowed.');
  }
  if (typeof record.score !== 'number' || !Number.isFinite(record.score)) {
    throw new ValidationError('Recommendation record.score must be a finite number.');
  }

  assertString(record, 'reasonText', recordType, {
    maxLength: contract.recommendation.limits.reasonText,
  });
  assertRecommendationStringArray(record, 'contributingQuestionIds', recordType);
  assertRecommendationStringArray(record, 'contributingConceptIds', recordType);
  assertRecommendationStringArray(record, 'contributingPostIds', recordType);
  assertComponentScores(record, recordType);

  if (record.kind !== contract.recommendation.kind) {
    throw new ValidationError('Recommendation record.kind is not allowed.');
  }

  return { ...record };
}

/**
 * Validate the only permitted public ingest envelope. The optional byteLength
 * argument lets the Worker enforce the exact request size before JSON parsing;
 * pure callers receive the same limit based on a UTF-8 serialization.
 */
export function parseIngest(body, suppliedByteLength) {
  const bodyBytes = suppliedByteLength ?? byteLength(body);
  if (!Number.isSafeInteger(bodyBytes) || bodyBytes < 0 || bodyBytes > MAX_REQUEST_BYTES) {
    throw new ValidationError('Request body exceeds the 256 KiB limit.', 413);
  }

  if (!isRecord(body) || Object.keys(body).length !== 1 || !Array.isArray(body.records)) {
    throw new ValidationError('Ingest body must contain only a records array.');
  }

  if (body.records.length > MAX_INGEST_RECORDS) {
    throw new ValidationError('Ingest body contains more than 100 records.', 413);
  }

  return body.records.map((record) => {
    if (!isRecord(record)) {
      throw new ValidationError('Each ingest record must be an object.');
    }

    if (Object.hasOwn(record, 'kind')) {
      if (Object.hasOwn(record, 'eventType') || Object.hasOwn(record, 'revision')) {
        throw new ValidationError('A kind-bearing record cannot have an ambiguous event or question/answer shape.');
      }
      if (record.kind !== contract.recommendation.kind) {
        throw new ValidationError('Ingest record.kind is not allowed.');
      }
      return parseRecommendation(record);
    }

    if (Object.hasOwn(record, 'eventType') && Object.hasOwn(record, 'revision')) {
      throw new ValidationError('A record cannot be both an event and a question/answer record.');
    }

    if (Object.hasOwn(record, 'eventType')) return parseEvent(record);
    if (Object.hasOwn(record, 'revision')) return parseQuestionAnswer(record);
    throw new ValidationError('Each record must be an event or a question/answer record.');
  });
}
