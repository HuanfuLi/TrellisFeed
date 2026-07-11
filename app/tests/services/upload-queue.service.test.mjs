import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  get length() { return store.size; },
  key(index) { return Array.from(store.keys())[index] ?? null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); },
};

const { dbExecute, dbQuery } = await import('../../src/services/db.service.ts');
const { eventBus } = await import('../../src/lib/event-bus.ts');
const {
  enqueue,
  flushPendingUploads,
  getPendingCount,
  registerRetryTriggers,
} = await import('../../src/services/upload-queue.service.ts');
const {
  getLastSuccessfulUploadAt,
} = await import('../../src/services/research-metadata.service.ts');

const apiBaseUrl = 'https://collector.invalid';

function event(id, overrides = {}) {
  return {
    id,
    userId: '1001',
    condition: 'control',
    topicId: 'topic-1',
    timestamp: '2026-07-11T12:00:00.000Z',
    eventType: 'post_open',
    postId: `post-${id}`,
    ...overrides,
  };
}

async function resetQueue() {
  await dbExecute('DELETE FROM research_upload_queue');
  await dbExecute('DELETE FROM research_metadata WHERE id = ?', ['upload']);
}

async function queueRows() {
  return dbQuery('SELECT * FROM research_upload_queue');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('enqueue persists an envelope before attempting upload and retains it on rejection', async () => {
  await resetQueue();
  let rowsAtFetch = [];
  const fetch = async () => {
    rowsAtFetch = await queueRows();
    throw new TypeError('offline');
  };

  await enqueue(event('persist-first'), { apiBaseUrl, fetch });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(rowsAtFetch.length, 1);
  assert.equal(JSON.parse(rowsAtFetch[0].data).record.id, 'persist-first');
  assert.equal((await queueRows()).length, 1);
});

test('concurrent flush calls are single-flighted and issue one POST', async () => {
  await resetQueue();
  await enqueue(event('single-flight'), { triggerFlush: false });
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fetch = async () => {
    calls += 1;
    await gate;
    return jsonResponse({ acknowledgedIds: ['single-flight'] });
  };

  const first = flushPendingUploads({ apiBaseUrl, fetch });
  const second = flushPendingUploads({ apiBaseUrl, fetch });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('one flush sends the oldest bounded batch of at most 100 records and 256 KiB', async () => {
  await resetQueue();
  for (let index = 0; index < 250; index += 1) {
    await enqueue(event(`batch-${String(index).padStart(3, '0')}`), { triggerFlush: false });
  }

  let sentBody = '';
  const fetch = async (_url, init) => {
    sentBody = init.body;
    const parsed = JSON.parse(sentBody);
    return jsonResponse({ acknowledgedIds: parsed.records.map((record) => record.id) });
  };
  await flushPendingUploads({ apiBaseUrl, fetch });

  const records = JSON.parse(sentBody).records;
  assert.equal(records.length, 100);
  assert.ok(new TextEncoder().encode(sentBody).byteLength <= 256 * 1024);
  assert.deepEqual(records.map((record) => record.id),
    Array.from({ length: 100 }, (_, index) => `batch-${String(index).padStart(3, '0')}`));
  assert.equal((await queueRows()).length, 150);
});

test('a partial ACK deletes only acknowledged ids', async () => {
  await resetQueue();
  for (const id of ['partial-a', 'partial-b', 'partial-c']) {
    await enqueue(event(id), { triggerFlush: false });
  }
  const fetch = async () => jsonResponse({ acknowledgedIds: ['partial-a', 'partial-c', 'not-in-batch'] });

  await flushPendingUploads({ apiBaseUrl, fetch });

  assert.deepEqual((await queueRows()).map((row) => row.id), ['partial-b']);
});

test('an ACK for an older revision cannot delete a newer queued replacement', async () => {
  await resetQueue();
  const original = {
    id: 'qa-race', revision: 1, userId: '1001', condition: 'control', topicId: 'topic-1',
    postId: 'post-1', questionId: 'question-1', questionText: 'Why?',
    questionSource: 'typed', submittedAt: '2026-07-11T12:00:00.000Z',
  };
  await enqueue(original, { triggerFlush: false });

  const fetch = async () => {
    await enqueue({ ...original, revision: 2, answerText: 'Because.' }, { triggerFlush: false });
    return jsonResponse({ acknowledgedIds: ['qa-race'] });
  };
  await flushPendingUploads({ apiBaseUrl, fetch });

  const rows = await queueRows();
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].data).record.revision, 2);
});

test('network reject, abort, and HTTP 500 retain every envelope', async (t) => {
  for (const [name, fetch] of [
    ['network reject', async () => { throw new TypeError('offline'); }],
    ['abort', async () => { throw new DOMException('aborted', 'AbortError'); }],
    ['HTTP 500', async () => jsonResponse({ error: 'failed' }, 500)],
  ]) {
    await t.test(name, async () => {
      await resetQueue();
      await enqueue(event(`retain-${name}`), { triggerFlush: false });
      await flushPendingUploads({ apiBaseUrl, fetch });
      assert.equal((await queueRows()).length, 1);
    });
  }
});

test('a lost response retains and re-sends the same id without data loss', async () => {
  await resetQueue();
  await enqueue(event('lost-response'), { triggerFlush: false });
  const sent = [];
  const fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body).records[0].id);
    if (sent.length === 1) throw new TypeError('response dropped after commit');
    return jsonResponse({ acknowledgedIds: ['lost-response'] });
  };

  await flushPendingUploads({ apiBaseUrl, fetch });
  assert.equal((await queueRows()).length, 1);
  await flushPendingUploads({ apiBaseUrl, fetch });

  assert.deepEqual(sent, ['lost-response', 'lost-response']);
  assert.equal((await queueRows()).length, 0);
});

test('successful ACK durably updates upload health and broadcasts the new status', async () => {
  await resetQueue();
  await enqueue(event('health-a'), { triggerFlush: false });
  await enqueue(event('health-b'), { triggerFlush: false });
  const statuses = [];
  const unsubscribe = eventBus.subscribe('UPLOAD_STATUS_CHANGED', (event) => statuses.push(event.payload));

  await flushPendingUploads({
    apiBaseUrl,
    fetch: async () => jsonResponse({ acknowledgedIds: ['health-a'] }),
  });
  unsubscribe();

  const rows = await dbQuery('SELECT * FROM research_metadata WHERE id = ?', ['upload']);
  assert.equal(rows.length, 1);
  const metadata = JSON.parse(rows[0].data);
  assert.equal(metadata.pending, 1);
  assert.ok(!Number.isNaN(Date.parse(metadata.lastSuccessfulUploadAt)));
  assert.equal(getPendingCount(), 1);
  assert.equal(getLastSuccessfulUploadAt(), metadata.lastSuccessfulUploadAt);
  assert.deepEqual(statuses.at(-1), { pending: 1, lastSuccessAt: metadata.lastSuccessfulUploadAt });
});

test('online and active app-state triggers retry without treating online state as delivery', async () => {
  await resetQueue();
  await enqueue(event('triggered'), { triggerFlush: false });
  const listeners = new Map();
  const windowTarget = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  let appStateListener;
  let flushes = 0;
  const unregister = registerRetryTriggers({
    windowTarget,
    addAppStateListener(listener) {
      appStateListener = listener;
      return Promise.resolve({ remove() {} });
    },
    flush: async () => { flushes += 1; },
  });

  listeners.get('online')();
  appStateListener({ isActive: false });
  appStateListener({ isActive: true });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(flushes, 2);
  assert.equal((await queueRows()).length, 1);
  unregister();
  assert.equal(listeners.has('online'), false);
});
