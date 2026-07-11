import { MAX_REQUEST_BYTES, ValidationError } from './validation.ts';

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
    return JSON.parse(new TextDecoder().decode(bytes));
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
  const body = await readBoundedJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.userId !== 'string') {
    throw new ValidationError('Resolve body must contain only userId.');
  }

  const account = await resolveAccount(body.userId, env.DB);
  if (!account) return json({ error: 'Unknown account.' }, 404);
  return json(account);
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
