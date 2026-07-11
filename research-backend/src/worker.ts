import { MAX_REQUEST_BYTES, ValidationError, parseIngest } from './validation.ts';
import { renderStatusPage, requireAdminAuth } from './admin.ts';
import { buildExportZip } from './export.ts';

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

function bearerToken(request) {
  const value = request.headers.get('authorization');
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(value ?? '');
  return match?.[1] ?? null;
}

function enrollmentCredential(request) {
  const value = request.headers.get('authorization');
  const match = /^Bearer ([^\s]+)$/.exec(value ?? '');
  return match?.[1] ?? null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function constantTimeCredentialMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length < 16) return false;
  const [left, right] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function createInstallToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
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
  const credential = enrollmentCredential(request);
  if (!await constantTimeCredentialMatches(credential, env.RESEARCH_ENROLLMENT_CREDENTIAL)) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  const { body } = await readBoundedJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.userId !== 'string') {
    throw new ValidationError('Resolve body must contain only userId.');
  }

  const account = await resolveAccount(body.userId, env.DB);
  if (!account) return json({ error: 'Account unavailable.' }, 404);
  const installToken = createInstallToken();
  const tokenHash = await sha256Hex(installToken);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE research_installations SET revoked_at = ?, rotated_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    ).bind(now, now, body.userId),
    env.DB.prepare(
      'INSERT INTO research_installations (token_hash, user_id, created_at) VALUES (?, ?, ?)',
    ).bind(tokenHash, body.userId, now),
  ]);
  return json({ ...account, installToken });
}

async function requireInstallAuth(request, db) {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const result = await db.prepare(
    `SELECT i.user_id, a.condition, a.topic_id
       FROM research_installations i
       JOIN study_accounts a ON a.user_id = i.user_id
      WHERE i.token_hash = ? AND i.revoked_at IS NULL`,
  ).bind(tokenHash).all();
  const row = result?.results?.[0];
  if (!row || !isNumericAccountId(row.user_id) ||
      (row.condition !== 'control' && row.condition !== 'experimental') ||
      typeof row.topic_id !== 'string' || row.topic_id.length === 0) return null;
  return { userId: row.user_id, condition: row.condition, topicId: row.topic_id };
}

function bindEventInsert(db, event, account, receivedAt) {
  return db.prepare(
    `INSERT OR IGNORE INTO behavioral_events
      (id, user_id, condition, topic_id, timestamp, event_type, post_id, question_id,
       recommendation_id, duration_ms, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    event.id,
    account.userId,
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
    account.userId,
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
  const account = await requireInstallAuth(request, env.DB);
  if (!account) return json({ error: 'Unauthorized.' }, 401);
  const { body, byteLength } = await readBoundedJson(request);
  const records = parseIngest(body, byteLength);

  const receivedAt = new Date().toISOString();
  const eventStatements = [];
  const questionAnswerStatements = [];

  for (const record of records) {
    if (record.kind === 'event') {
      const existing = await env.DB.prepare('SELECT user_id FROM behavioral_events WHERE id = ?')
        .bind(record.id).all();
      if (existing?.results?.[0]?.user_id && existing.results[0].user_id !== account.userId) {
        return json({ error: 'Record conflict.' }, 409);
      }
      eventStatements.push(bindEventInsert(env.DB, record, account, receivedAt));
    } else {
      const existing = await env.DB.prepare(
        'SELECT user_id, question_id, revision FROM question_answer_records WHERE id = ? OR question_id = ?',
      ).bind(record.id, record.questionId).all();
      const row = existing?.results?.[0];
      if (row && (row.user_id !== account.userId || row.question_id !== record.questionId)) {
        return json({ error: 'Record conflict.' }, 409);
      }
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

function adminMethodNotAllowed() {
  return json({ error: 'Method not allowed.' }, 405, { allow: 'GET' });
}

const PUBLIC_PATHS = new Set(['/v1/install/resolve', '/v1/ingest']);

function allowedOrigins(env) {
  if (typeof env.RESEARCH_ALLOWED_ORIGINS !== 'string') return new Set();
  return new Set(env.RESEARCH_ALLOWED_ORIGINS.split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean));
}

function corsOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (origin === null) return { origin: null, allowed: true };
  return { origin, allowed: allowedOrigins(env).has(origin) };
}

function withCors(response, origin) {
  if (!origin) return response;
  const next = new Response(response.body, response);
  next.headers.set('access-control-allow-origin', origin);
  next.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  next.headers.set('access-control-allow-headers', 'Content-Type, Authorization');
  next.headers.set('vary', 'Origin');
  return next;
}

function preflight(origin) {
  return withCors(new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }), origin);
}

async function selectAdminRows(db, sql) {
  const result = await db.prepare(sql).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function handleAdminStatus(env) {
  const [events, questionAnswers, lastReceived] = await Promise.all([
    selectAdminRows(env.DB, 'SELECT COUNT(*) AS total FROM behavioral_events'),
    selectAdminRows(env.DB, 'SELECT COUNT(*) AS total FROM question_answer_records'),
    selectAdminRows(
      env.DB,
      `SELECT MAX(received_at) AS last_received_at FROM (
        SELECT received_at FROM behavioral_events
        UNION ALL
        SELECT received_at FROM question_answer_records
      )`,
    ),
  ]);

  return new Response(renderStatusPage({
    behavioralEventCount: events[0]?.total,
    questionAnswerRecordCount: questionAnswers[0]?.total,
    lastReceivedAt: lastReceived[0]?.last_received_at,
  }), {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

async function handleAdminExport(env) {
  const [events, questionAnswers] = await Promise.all([
    selectAdminRows(
      env.DB,
      `SELECT id, user_id, condition, topic_id, timestamp, event_type, post_id, question_id,
        recommendation_id, duration_ms, received_at
       FROM behavioral_events
       ORDER BY received_at ASC, id ASC`,
    ),
    selectAdminRows(
      env.DB,
      `SELECT id, revision, user_id, condition, topic_id, post_id, question_id, question_text,
        question_source, submitted_at, answer_text, answer_viewed_at, received_at
       FROM question_answer_records
       ORDER BY received_at ASC, id ASC`,
    ),
  ]);
  const archive = buildExportZip(events, questionAnswers);
  return new Response(archive, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="questiontrace-research-export.zip"',
      'content-type': 'application/zip',
    },
  });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isPublic = PUBLIC_PATHS.has(url.pathname);
    const cors = isPublic ? corsOrigin(request, env) : { origin: null, allowed: true };

    if (isPublic && !cors.allowed) return json({ error: 'Origin not allowed.' }, 403);
    if (isPublic && request.method === 'OPTIONS') {
      return cors.origin ? preflight(cors.origin) : json({ error: 'Origin required.' }, 403);
    }

    try {
      if (url.pathname === '/admin' || url.pathname === '/admin/export.zip') {
        if (request.method !== 'GET') return adminMethodNotAllowed();
        const unauthorized = requireAdminAuth(request, env);
        if (unauthorized) return unauthorized;
        return url.pathname === '/admin' ? await handleAdminStatus(env) : await handleAdminExport(env);
      }

      if (url.pathname === '/v1/install/resolve') {
        const response = request.method !== 'POST' ? methodNotAllowed() : await handleInstallResolve(request, env);
        return withCors(response, cors.origin);
      }

      if (url.pathname === '/v1/ingest') {
        const response = request.method !== 'POST' ? methodNotAllowed() : await handleIngest(request, env);
        return withCors(response, cors.origin);
      }

      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      if (error instanceof ValidationError) {
        return withCors(json({ error: error.message }, error.status), isPublic ? cors.origin : null);
      }

      return withCors(json({ error: 'Collection service error.' }, 500), isPublic ? cors.origin : null);
    }
  },
};

export default worker;
