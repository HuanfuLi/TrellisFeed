import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import worker from '../src/worker.ts';

const configUrl = new URL('../wrangler.jsonc', import.meta.url);
const configSource = await readFile(configUrl, 'utf8');
const config = JSON.parse(configSource);

const approvedOrigins = [
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:5173',
  'https://localhost',
];
const publicPaths = ['/v1/install/resolve', '/v1/ingest'];

function configuredOrigins() {
  assert.equal(typeof config.vars?.RESEARCH_ALLOWED_ORIGINS, 'string');
  return config.vars.RESEARCH_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
}

function noDatabaseWork() {
  return {
    prepare() {
      throw new Error('CORS preflight must complete before database work');
    },
  };
}

async function preflight(path, origin, env) {
  return worker.fetch(new Request(`https://collector.invalid${path}`, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  }), env);
}

test('canonical Wrangler config preserves the Worker and D1 deployment target', () => {
  assert.equal(config.name, 'question-trace-research-collector');
  assert.equal(config.main, 'src/worker.ts');
  assert.equal(config.compatibility_date, '2026-07-11');
  assert.deepEqual(config.d1_databases, [{
    binding: 'DB',
    database_name: 'question_trace',
    database_id: '4423c511-8a39-411c-983f-f24306084218',
  }]);
});

test('tracked vars contain only the exact approved non-secret origin allowlist', () => {
  assert.deepEqual(Object.keys(config.vars ?? {}), ['RESEARCH_ALLOWED_ORIGINS']);

  const origins = configuredOrigins();
  assert.equal(origins.every(Boolean), true);
  assert.equal(new Set(origins).size, origins.length, 'origin list must not contain duplicates');
  assert.deepEqual(new Set(origins), new Set(approvedOrigins));
  assert.equal(origins.some((origin) => origin.includes('*')), false, 'wildcards are forbidden');

  assert.doesNotMatch(
    configSource,
    /RESEARCH_ADMIN_PASSWORD|RESEARCH_ENROLLMENT_CREDENTIAL|install[_-]?token|credential/i,
  );
});

test('every configured origin grants exact preflights on both public endpoints', async () => {
  const origins = configuredOrigins();
  const env = {
    RESEARCH_ALLOWED_ORIGINS: config.vars.RESEARCH_ALLOWED_ORIGINS,
    DB: noDatabaseWork(),
  };

  for (const origin of origins) {
    for (const path of publicPaths) {
      const response = await preflight(path, origin, env);
      assert.equal(response.status, 204, `${origin} ${path}`);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('vary'), 'Origin');
      assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
      assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type, Authorization');
    }
  }
});

test('near-match origins and a missing binding remain fail-closed', async () => {
  const configuredEnv = {
    RESEARCH_ALLOWED_ORIGINS: config.vars.RESEARCH_ALLOWED_ORIGINS,
    DB: noDatabaseWork(),
  };
  const missingBindingEnv = { DB: noDatabaseWork() };

  for (const path of publicPaths) {
    const nearMatch = await preflight(path, 'https://localhost.invalid', configuredEnv);
    assert.equal(nearMatch.status, 403, path);
    assert.equal(nearMatch.headers.has('access-control-allow-origin'), false);

    const missingBinding = await preflight(path, 'https://localhost', missingBindingEnv);
    assert.equal(missingBinding.status, 403, path);
    assert.equal(missingBinding.headers.has('access-control-allow-origin'), false);
  }
});
