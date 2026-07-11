import { MAX_REQUEST_BYTES, ValidationError, parseIngest } from './validation.ts';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function hasJsonContentType(request) {
  const contentType = request.headers.get('content-type');
  return typeof contentType === 'string' && /^application\/json(?:\s*;|\s*$)/i.test(contentType);
}

async function readBoundedJson(request) {
  if (!hasJsonContentType(request)) {
    throw new ValidationError('Content-Type must be application/json.');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_REQUEST_BYTES) {
    throw new ValidationError('Request body exceeds the 256 KiB limit.', 413);
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_REQUEST_BYTES) {
    throw new ValidationError('Request body exceeds the 256 KiB limit.', 413);
  }

  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)), byteLength: bytes.byteLength };
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}

function isNumericAccountId(userId) {
  return typeof userId === 'string' && /^\d{1,64}$/.test(userId);
}

/** Return only the authoritative assignment held by D1, never client fields. */
export async function resolveAccount(userId, db) {
  if (!isNumericAccountId(userId)) return null;

  const result = await db
    .prepare('SELECT condition, topic_id FROM study_accounts WHERE user_id = ?')
    .bind(userId)
    .all();
  const row = result?.results?.[0];

  if (!row || (row.condition !== 'control' && row.condition !== 'experimental') ||
      typeof row.topic_id !== 'string' || row.topic_id.length === 0) {
    return null;
  }

  return { condition: row.condition, topicId: row.topic_id };
}

async function handleInstallResolve(request, env) {
  const { body } = await readBoundedJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.userId !== 'string') {
    throw new ValidationError('Resolve body must contain only userId.');
  }

  const account = await resolveAccount(body.userId, env.DB);
  if (!account) return json({ error: 'Unknown account.' }, 404);
  return json(account);
}

function bindEventInsert(db, event, account, receivedAt) {
  return db.prepare(
    `INSERT OR IGNORE INTO behavioral_events
      (id, user_id, condition, topic_id, timestamp, event_type, post_id, question_id,
       recommendation_id, duration_ms, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    event.id,
    event.userId,
    account.condition,
    account.topicId,
    event.timestamp,
    event.eventType,
    event.postId ?? null,
    event.questionId ?? null,
    event.recommendationId ?? null,
    event.durationMs ?? null,
    receivedAt,
  );
}

function bindQuestionAnswerUpsert(db, record, account, receivedAt) {
  return db.prepare(
    `INSERT INTO question_answer_records
      (id, revision, user_id, condition, topic_id, post_id, question_id, question_text,
       question_source, submitted_at, answer_text, answer_viewed_at, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       revision = excluded.revision,
       user_id = excluded.user_id,
       condition = excluded.condition,
       topic_id = excluded.topic_id,
       post_id = excluded.post_id,
       question_id = excluded.question_id,
       question_text = excluded.question_text,
       question_source = excluded.question_source,
       submitted_at = excluded.submitted_at,
       answer_text = excluded.answer_text,
       answer_viewed_at = excluded.answer_viewed_at,
       received_at = excluded.received_at
     WHERE excluded.revision > question_answer_records.revision`,
  ).bind(
    record.id,
    record.revision,
    record.userId,
    account.condition,
    account.topicId,
    record.postId,
    record.questionId,
    record.questionText,
    record.questionSource,
    record.submittedAt,
    record.answerText ?? null,
    record.answerViewedAt ?? null,
    receivedAt,
  );
}

async function handleIngest(request, env) {
  const { body, byteLength } = await readBoundedJson(request);
  const records = parseIngest(body, byteLength);

  const assignments = new Map();
  for (const userId of new Set(records.map((record) => record.userId))) {
    const account = await resolveAccount(userId, env.DB);
    if (!account) return json({ error: 'Unknown account.' }, 404);
    assignments.set(userId, account);
  }

  const receivedAt = new Date().toISOString();
  const eventStatements = [];
  const questionAnswerStatements = [];

  for (const record of records) {
    const account = assignments.get(record.userId);
    if (record.kind === 'event') {
      eventStatements.push(bindEventInsert(env.DB, record, account, receivedAt));
    } else {
      questionAnswerStatements.push(bindQuestionAnswerUpsert(env.DB, record, account, receivedAt));
    }
  }

  const statements = [...eventStatements, ...questionAnswerStatements];
  if (statements.length > 0) await env.DB.batch(statements);

  return json({ acknowledgedIds: [...new Set(records.map((record) => record.id))] });
}

function methodNotAllowed() {
  return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/v1/install/resolve') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleInstallResolve(request, env);
      }

      if (url.pathname === '/v1/ingest') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleIngest(request, env);
      }

      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof ValidationError) {
        return json({ error: error.message }, error.status);
      }

      return json({ error: 'Collection service error.' }, 500);
    }
  },
};

export default worker;
