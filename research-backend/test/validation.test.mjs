import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_REQUEST_BYTES, ValidationError, parseIngest } from '../src/validation.ts';
import worker, { resolveAccount } from '../src/worker.ts';

const validEvent = () => ({
  id: 'event-1',
  timestamp: '2026-07-11T12:00:00.000Z',
  eventType: 'post_open',
  postId: 'post-1',
});

test('wire records reject every client-owned identity field', () => {
  for (const field of ['userId', 'condition', 'topicId']) {
    assert.throws(
      () => parseIngest({ records: [{ ...validEvent(), [field]: 'client-owned' }] }),
      new RegExp(`disallowed field: ${field}`),
    );
  }
});

test('parseIngest rejects a batch with more than 100 records before DB work', () => {
  const records = Array.from({ length: 101 }, (_, index) => ({
    ...validEvent(),
    id: `event-${index}`,
  }));

  assert.throws(
    () => parseIngest({ records }),
    (error) => error instanceof ValidationError && error.status === 413,
  );
});

test('parseIngest rejects a body larger than 256 KiB', () => {
  assert.throws(
    () => parseIngest({ records: [validEvent()] }, MAX_REQUEST_BYTES + 1),
    (error) => error instanceof ValidationError && error.status === 413,
  );
});

test('parseIngest rejects prohibited source and arbitrary payload fields', () => {
  for (const prohibitedField of ['sourceUrl', 'feedPosition', 'route', 'device']) {
    assert.throws(
      () => parseIngest({ records: [{ ...validEvent(), [prohibitedField]: 'forbidden' }] }),
      new RegExp(`disallowed field: ${prohibitedField}`),
    );
  }
  assert.throws(
    () => parseIngest({ records: [{ ...validEvent(), payload: { route: '/posts/post-1' } }] }),
    /disallowed field: payload/,
  );
});

test('parseIngest rejects unknown interaction event types', () => {
  assert.throws(
    () => parseIngest({ records: [{ ...validEvent(), eventType: 'keystroke_capture' }] }),
    /eventType is not allowed/,
  );
});

test('parseIngest accepts a valid allowlisted event', () => {
  const [record] = parseIngest({ records: [validEvent()] });
  assert.equal(record.kind, 'event');
  assert.equal(record.id, 'event-1');
});

function accountDb(accounts) {
  return {
    prepare(sql) {
      assert.match(sql, /WHERE user_id = \?/);
      return {
        bind(userId) {
          return {
            async all() {
              const account = accounts.get(userId);
              return {
                results: account
                  ? [{ condition: account.condition, topic_id: account.topicId }]
                  : [],
              };
            },
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  };
}

test('resolveAccount returns the server account mapping and null for unknown accounts', async () => {
  const db = accountDb(new Map([['1001', { condition: 'control', topicId: 'topic-a' }]]));

  assert.deepEqual(await resolveAccount('1001', db), { condition: 'control', topicId: 'topic-a' });
  assert.equal(await resolveAccount('9999', db), null);
});

test('install resolve rejects a missing enrollment credential before account lookup', async () => {
  const db = accountDb(new Map([['1001', { condition: 'experimental', topicId: 'topic-b' }]]));
  const response = await worker.fetch(new Request('https://collector.invalid/v1/install/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '1001' }),
  }), { DB: db, RESEARCH_ENROLLMENT_CREDENTIAL: 'test-enrollment-credential' });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorized.' });
});

test('install resolve rejects a wrong credential with the same generic response', async () => {
  const db = accountDb(new Map());
  const response = await worker.fetch(new Request('https://collector.invalid/v1/install/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-test-credential-0000' },
    body: JSON.stringify({ userId: '1001' }),
  }), { DB: db, RESEARCH_ENROLLMENT_CREDENTIAL: 'correct-test-credential-000000' });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorized.' });
});

test('authenticated enrollment rotates the prior install and stores only a token hash', async () => {
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              assert.match(sql, /FROM study_accounts/);
              return { results: [{ condition: 'control', topic_id: 'topic-test' }] };
            },
            async run() { writes.push({ sql, values }); return { success: true }; },
          };
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
  const credential = 'correct-test-credential-000000';
  const response = await worker.fetch(new Request('https://collector.invalid/v1/install/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
    body: JSON.stringify({ userId: '1001' }),
  }), { DB: db, RESEARCH_ENROLLMENT_CREDENTIAL: credential });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.condition, 'control');
  assert.equal(body.topicId, 'topic-test');
  assert.match(body.installToken, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(writes.length, 2);
  assert.match(writes[0].sql, /revoked_at/);
  assert.match(writes[1].values[0], /^[a-f0-9]{64}$/);
  assert.equal(writes[1].values.includes(body.installToken), false);
});

test('authenticated enrollment accepts an opaque standard-Base64 build credential', async () => {
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              assert.match(sql, /FROM study_accounts/);
              return { results: [{ condition: 'control', topic_id: 'topic-test' }] };
            },
            async run() { writes.push({ sql, values }); return { success: true }; },
          };
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
  const credential = 'opaque+base64/credential==';
  const response = await worker.fetch(new Request('https://collector.invalid/v1/install/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
    body: JSON.stringify({ userId: '1001' }),
  }), { DB: db, RESEARCH_ENROLLMENT_CREDENTIAL: credential });

  assert.equal(response.status, 200);
  assert.equal(writes.length, 2);
});
