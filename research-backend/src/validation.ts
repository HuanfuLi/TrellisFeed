export const MAX_INGEST_RECORDS = 100;
export const MAX_REQUEST_BYTES = 256 * 1024;

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
  'userId',
  'condition',
  'topicId',
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
  'userId',
  'topicId',
  'postId',
  'questionId',
  'questionText',
  'questionSource',
  'submittedAt',
  'answerText',
  'answerViewedAt',
]);

const OPTIONAL_EVENT_STRING_FIELDS = [
  'condition',
  'topicId',
  'postId',
  'questionId',
  'recommendationId',
];

const OPTIONAL_QUESTION_ANSWER_STRING_FIELDS = [
  'topicId',
  'answerText',
  'answerViewedAt',
];

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

function assertString(record, field, recordType, { optional = false, maxLength = 65536 } = {}) {
  const value = record[field];
  if (optional && value === undefined) return;

  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new ValidationError(`${recordType}.${field} must be a non-empty string.`);
  }
}

function assertTimestamp(record, field, recordType, { optional = false } = {}) {
  if (optional && record[field] === undefined) return;
  assertString(record, field, recordType, { optional, maxLength: 64 });
  if (Number.isNaN(Date.parse(record[field]))) {
    throw new ValidationError(`${recordType}.${field} must be an ISO-parseable timestamp.`);
  }
}

function parseEvent(record) {
  const recordType = 'Event record';
  assertAllowedFields(record, EVENT_FIELDS, recordType);
  assertString(record, 'id', recordType, { maxLength: 128 });
  assertString(record, 'userId', recordType, { maxLength: 64 });
  assertTimestamp(record, 'timestamp', recordType);

  if (typeof record.eventType !== 'string' || !EVENT_TYPES.has(record.eventType)) {
    throw new ValidationError('Event record.eventType is not allowed.');
  }

  for (const field of OPTIONAL_EVENT_STRING_FIELDS) {
    assertString(record, field, recordType, { optional: true, maxLength: 65536 });
  }

  if (record.durationMs !== undefined &&
      (!Number.isSafeInteger(record.durationMs) || record.durationMs < 0)) {
    throw new ValidationError('Event record.durationMs must be a non-negative safe integer.');
  }

  return { ...record, kind: 'event' };
}

function parseQuestionAnswer(record) {
  const recordType = 'Question/answer record';
  assertAllowedFields(record, QUESTION_ANSWER_FIELDS, recordType);
  assertString(record, 'id', recordType, { maxLength: 128 });
  assertString(record, 'userId', recordType, { maxLength: 64 });
  assertString(record, 'postId', recordType, { maxLength: 256 });
  assertString(record, 'questionId', recordType, { maxLength: 256 });
  assertString(record, 'questionText', recordType, { maxLength: 65536 });
  assertTimestamp(record, 'submittedAt', recordType);

  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new ValidationError('Question/answer record.revision must be a positive safe integer.');
  }

  if (record.questionSource !== 'typed' && record.questionSource !== 'suggested_question') {
    throw new ValidationError('Question/answer record.questionSource is not allowed.');
  }

  for (const field of OPTIONAL_QUESTION_ANSWER_STRING_FIELDS) {
    if (field === 'answerViewedAt') {
      assertTimestamp(record, field, recordType, { optional: true });
    } else {
      assertString(record, field, recordType, { optional: true, maxLength: 65536 });
    }
  }

  return { ...record, kind: 'question_answer' };
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

    if (Object.hasOwn(record, 'eventType') && Object.hasOwn(record, 'revision')) {
      throw new ValidationError('A record cannot be both an event and a question/answer record.');
    }

    if (Object.hasOwn(record, 'eventType')) return parseEvent(record);
    if (Object.hasOwn(record, 'revision')) return parseQuestionAnswer(record);
    throw new ValidationError('Each record must be an event or a question/answer record.');
  });
}
