import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/worker.ts';

const allowedOrigin = 'https://approved-development.invalid';
const env = {
  RESEARCH_ALLOWED_ORIGINS: `${allowedOrigin},capacitor://localhost`,
  RESEARCH_ENROLLMENT_CREDENTIAL: 'test-enrollment-credential-000000',
  DB: { prepare() { throw new Error('CORS/auth gate must run before database work'); } },
};

test('allowed public preflight grants the exact origin and required contract only', async () => {
  const response = await worker.fetch(new Request('https://collector.invalid/v1/ingest', {
    method: 'OPTIONS',
    headers: {
      origin: allowedOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type, Authorization');
});

test('disallowed public origin receives no CORS grant or endpoint work', async () => {
  const response = await worker.fetch(new Request('https://collector.invalid/v1/ingest', {
    method: 'POST',
    headers: { origin: 'https://disallowed.invalid', 'content-type': 'application/json' },
    body: JSON.stringify({ records: [] }),
  }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.has('access-control-allow-origin'), false);
});

test('an allowed origin still needs endpoint authentication and receives CORS on errors', async () => {
  const response = await worker.fetch(new Request('https://collector.invalid/v1/ingest', {
    method: 'POST',
    headers: { origin: allowedOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ records: [] }),
  }), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
});

test('admin routes never gain cross-origin access', async () => {
  const response = await worker.fetch(new Request('https://collector.invalid/admin', {
    headers: { origin: allowedOrigin },
  }), { ...env, RESEARCH_ADMIN_PASSWORD: 'test-admin-password' });
  assert.equal(response.status, 401);
  assert.equal(response.headers.has('access-control-allow-origin'), false);
});
