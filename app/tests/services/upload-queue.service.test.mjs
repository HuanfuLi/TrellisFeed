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
const uploadQueueService = await import('../../src/services/upload-queue.service.ts');
const {
  enqueue,
  flushPendingUploads,
  getPendingCount,
  registerRetryTriggers,
} = uploadQueueService;
const { studyContextService } = await import('../../src/services/study-context.service.ts');
const {
  getLastSuccessfulUploadAt,
} = await import('../../src/services/research-metadata.service.ts');
const {
  RESEARCH_WIRE_CONTRACT_VERSION,
  RESEARCH_WIRE_LIMITS,
} = await import('../../src/services/research-wire-contract.ts');
const {
  MAX_INGEST_RECORDS,
  MAX_REQUEST_BYTES,
} = await import('../../../research-backend/src/validation.ts');

const apiBaseUrl = 'https://collector.invalid';
const installToken = 'test-install-token-00000000000000001001';

await studyContextService.hydrate();
if (!studyContextService.isBound()) {
  await studyContextService.bindOnce({
    userId: '1001',
    condition: 'control',
    topicId: 'topic-1',
    boundAt: '2026-07-11T00:00:00.000Z',
  }, installToken);
}

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
  await dbExecute('DELETE FROM research_upload_quarantine');
  await dbExecute('DELETE FROM research_metadata WHERE id = ?', ['upload']);
}

async function queueRows() {
  return dbQuery('SELECT * FROM research_upload_queue');
}

async function metadataRows() {
  return dbQuery('SELECT * FROM research_metadata');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('client and Worker consume the same committed v1 wire limits', () => {
  assert.equal(RESEARCH_WIRE_CONTRACT_VERSION, 'research-ingest-v1');
  assert.equal(RESEARCH_WIRE_LIMITS.maxRecords, MAX_INGEST_RECORDS);
  assert.equal(RESEARCH_WIRE_LIMITS.maxRequestBytes, MAX_REQUEST_BYTES);
});

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

test('one flush drains every bounded batch in a 250-record backlog', async () => {
  await resetQueue();
  for (let index = 0; index < 250; index += 1) {
    await enqueue(event(`batch-${String(index).padStart(3, '0')}`), { triggerFlush: false });
  }

  const sentBodies = [];
  const fetch = async (_url, init) => {
    sentBodies.push(init.body);
    const parsed = JSON.parse(init.body);
    return jsonResponse({ acknowledgedIds: parsed.records.map((record) => record.id) });
  };
  await flushPendingUploads({ apiBaseUrl, fetch });

  assert.equal(sentBodies.length, 3);
  assert.deepEqual(sentBodies.map((body) => JSON.parse(body).records.length), [100, 100, 50]);
  assert.ok(sentBodies.every((body) => new TextEncoder().encode(body).byteLength <= 256 * 1024));
  assert.equal((await queueRows()).length, 0);
});

test('partial ACK responses continue making progress until every row is delivered', async () => {
  await resetQueue();
  for (const id of ['partial-a', 'partial-b', 'partial-c']) {
    await enqueue(event(id), { triggerFlush: false });
  }
  const requests = [];
  const fetch = async (_url, init) => {
    const ids = JSON.parse(init.body).records.map((record) => record.id);
    requests.push(ids);
    return jsonResponse({ acknowledgedIds: [ids[0], 'not-in-batch'] });
  };

  await flushPendingUploads({ apiBaseUrl, fetch });

  assert.deepEqual(requests, [
    ['partial-a', 'partial-b', 'partial-c'],
    ['partial-b', 'partial-c'],
    ['partial-c'],
  ]);
  assert.equal((await queueRows()).length, 0);
});

test('an ACK for an older revision cannot delete rev 2 and the shared drain uploads rev 2', async () => {
  await resetQueue();
  const original = {
    id: 'qa-race', revision: 1, userId: '1001', condition: 'control', topicId: 'topic-1',
    postId: 'post-1', questionId: 'question-1', answerId: 'answer-1', questionText: 'Why?',
    questionSource: 'typed', questionCreatedAt: '2026-07-11T12:00:00.000Z', answerText: 'Because.',
    answerCreatedAt: '2026-07-11T12:00:01.000Z', modelName: 'fake-main', citedPostIds: ['post-1'], conceptIds: [],
  };
  await enqueue(original, { triggerFlush: false });

  const revisions = [];
  const fetch = async (_url, init) => {
    const record = JSON.parse(init.body).records[0];
    revisions.push(record.revision);
    if (record.revision === 1) {
      await enqueue({ ...original, revision: 2, answerText: 'Because.' }, { triggerFlush: false });
    }
    return jsonResponse({ acknowledgedIds: ['qa-race'] });
  };
  await flushPendingUploads({ apiBaseUrl, fetch });

  assert.deepEqual(revisions, [1, 2]);
  assert.equal((await queueRows()).length, 0);
});

test('enqueue during an in-flight request is included before the shared flush resolves', async () => {
  await resetQueue();
  await enqueue(event('in-flight-a'), { triggerFlush: false });
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const sent = [];
  const fetch = async (_url, init) => {
    const ids = JSON.parse(init.body).records.map((record) => record.id);
    sent.push(ids);
    if (sent.length === 1) await firstGate;
    return jsonResponse({ acknowledgedIds: ids });
  };

  const flush = flushPendingUploads({ apiBaseUrl, fetch });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await enqueue(event('in-flight-b'), { triggerFlush: false });
  releaseFirst();
  await flush;

  assert.deepEqual(sent, [['in-flight-a'], ['in-flight-b']]);
  assert.equal((await queueRows()).length, 0);
});

test('a successful response with zero recognized ACK stops without a busy loop', async () => {
  await resetQueue();
  await enqueue(event('zero-ack'), { triggerFlush: false });
  let calls = 0;
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async () => {
      calls += 1;
      return jsonResponse({ acknowledgedIds: ['not-in-batch'] });
    },
  });
  assert.equal(calls, 1);
  assert.equal((await queueRows()).length, 1);
});

test('a transient failure on batch 2 keeps only the remaining rows and stops', async () => {
  await resetQueue();
  for (let index = 0; index < 150; index += 1) {
    await enqueue(event(`transient-${String(index).padStart(3, '0')}`), { triggerFlush: false });
  }
  let calls = 0;
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async (_url, init) => {
      calls += 1;
      const ids = JSON.parse(init.body).records.map((record) => record.id);
      if (calls === 2) return jsonResponse({ error: 'retry later' }, 503);
      return jsonResponse({ acknowledgedIds: ids });
    },
  });
  assert.equal(calls, 2);
  assert.equal((await queueRows()).length, 50);
});

test('question/answer upload keeps local condition but follows the server-owned wire contract', async () => {
  await resetQueue();
  const record = {
    id: 'qa-wire', revision: 1, userId: '1001', condition: 'experimental', topicId: 'topic-1',
    postId: 'post-1', questionId: 'question-1', answerId: 'answer-1', questionText: 'Why?',
    questionSource: 'typed', questionCreatedAt: '2026-07-11T12:00:00.000Z', answerText: 'Because.',
    answerCreatedAt: '2026-07-11T12:00:01.000Z', modelName: 'fake-main', citedPostIds: ['post-1'], conceptIds: [],
  };
  await enqueue(record, { triggerFlush: false });
  assert.equal(JSON.parse((await queueRows())[0].data).record.condition, 'experimental');

  let uploaded;
  let authorization;
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async (_url, init) => {
      uploaded = JSON.parse(init.body).records[0];
      authorization = init.headers.Authorization;
      return jsonResponse({ acknowledgedIds: ['qa-wire'] });
    },
  });

  for (const field of ['userId', 'condition', 'topicId']) {
    assert.equal(Object.hasOwn(uploaded, field), false);
  }
  assert.equal(authorization, `Bearer ${installToken}`);
});

test('malformed and individually oversized queue heads are quarantined while later rows upload', async () => {
  await resetQueue();
  await dbExecute(
    'INSERT OR REPLACE INTO research_upload_queue (id, data) VALUES (?, ?)',
    ['malformed', '{not-json'],
  );
  await enqueue(event('oversized', { postId: 'x'.repeat(300) }), { triggerFlush: false });
  await enqueue(event('valid-after-poison'), { triggerFlush: false });

  const sent = [];
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async (_url, init) => {
      const ids = JSON.parse(init.body).records.map((record) => record.id);
      sent.push(...ids);
      return jsonResponse({ acknowledgedIds: ids });
    },
  });

  assert.deepEqual(sent, ['valid-after-poison']);
  assert.equal((await queueRows()).length, 0);
  const quarantine = await dbQuery('SELECT * FROM research_upload_quarantine');
  assert.equal(quarantine.length, 2);
  assert.deepEqual(quarantine.map((row) => row.id).sort(), ['malformed', 'oversized']);
  assert.equal(uploadQueueService.getQuarantineCount(), 2);
  assert.equal(getPendingCount(), 2);
  assert.equal(JSON.stringify(quarantine).includes(installToken), false);
});

test('permanent batch failures split to quarantine only the bad singleton', async () => {
  await resetQueue();
  for (const id of ['valid-before', 'server-poison', 'valid-after']) {
    await enqueue(event(id), { triggerFlush: false });
  }

  const accepted = [];
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async (_url, init) => {
      const records = JSON.parse(init.body).records;
      if (records.some((record) => record.id === 'server-poison')) {
        return jsonResponse({ error: 'invalid' }, 422);
      }
      accepted.push(...records.map((record) => record.id));
      return jsonResponse({ acknowledgedIds: records.map((record) => record.id) });
    },
  });

  assert.deepEqual(accepted.sort(), ['valid-after', 'valid-before']);
  assert.equal((await queueRows()).length, 0);
  const quarantine = await dbQuery('SELECT * FROM research_upload_quarantine');
  assert.deepEqual(quarantine.map((row) => row.id), ['server-poison']);
});

test('authentication failures retain active rows and never quarantine them', async () => {
  for (const status of [401, 403]) {
    await resetQueue();
    await enqueue(event(`auth-${status}`), { triggerFlush: false });
    await flushPendingUploads({
      apiBaseUrl,
      fetch: async () => jsonResponse({ error: 'unauthorized' }, status),
    });
    assert.equal((await queueRows()).length, 1);
    assert.equal((await dbQuery('SELECT * FROM research_upload_quarantine')).length, 0);
  }
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

test('ACK receipt failure retains the active envelope for safe duplicate retry', async () => {
  await resetQueue();
  await enqueue(event('receipt-write-fails'), { triggerFlush: false });
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async () => jsonResponse({ acknowledgedIds: ['receipt-write-fails'] }),
    persistence: {
      writeDeliveryReceipt: async () => { throw new Error('injected receipt failure'); },
    },
  });
  assert.equal((await queueRows()).length, 1);
  assert.equal((await metadataRows()).some((row) => row.id === 'delivery:receipt-write-fails'), false);
});

test('queue deletion failure leaves a durable receipt and reconciliation safely removes the duplicate', async () => {
  await resetQueue();
  const durable = event('delete-fails');
  await dbExecute(
    'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
    [durable.id, 'event', 1, JSON.stringify(durable)],
  );
  await enqueue(durable, { triggerFlush: false });
  await flushPendingUploads({
    apiBaseUrl,
    fetch: async () => jsonResponse({ acknowledgedIds: ['delete-fails'] }),
    persistence: {
      deleteQueueEnvelope: async () => { throw new Error('injected delete failure'); },
    },
  });
  assert.equal((await queueRows()).length, 1);
  assert.equal((await metadataRows()).some((row) => row.id === 'delivery:delete-fails'), true);

  await uploadQueueService.reconcileResearchOutbox();
  assert.equal((await queueRows()).length, 0);
});

test('reconciliation is idempotent, revision-aware, and does not resurrect quarantined rows', async () => {
  await resetQueue();
  await dbExecute('DELETE FROM research_records');
  const absent = event('missing-outbox');
  const quarantined = event('already-quarantined');
  const delivered = event('already-delivered');
  for (const record of [absent, quarantined, delivered]) {
    await dbExecute(
      'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
      [record.id, 'event', 1, JSON.stringify(record)],
    );
  }
  await dbExecute(
    'INSERT OR REPLACE INTO research_upload_quarantine (id, data) VALUES (?, ?)',
    [quarantined.id, JSON.stringify({
      id: quarantined.id,
      reason: 'server_rejected',
      envelope: { id: quarantined.id, queuedAt: '2026-07-11T00:00:00.000Z', record: quarantined },
    })],
  );
  await dbExecute(
    'INSERT OR REPLACE INTO research_metadata (id, data) VALUES (?, ?)',
    ['delivery:already-delivered', JSON.stringify({ revision: 1, deliveredAt: '2026-07-11T12:00:00.000Z' })],
  );

  await uploadQueueService.reconcileResearchOutbox();
  await uploadQueueService.reconcileResearchOutbox();
  assert.deepEqual((await queueRows()).map((row) => row.id), ['missing-outbox']);
});

test('a rev 1 receipt never suppresses a durable Q/A rev 2 during reconciliation', async () => {
  await resetQueue();
  await dbExecute('DELETE FROM research_records');
  const revision2 = {
    id: 'qa-ledger', revision: 2, userId: '1001', condition: 'control', topicId: 'topic-1',
    postId: 'post-1', questionId: 'question-ledger', answerId: 'answer-ledger', questionText: 'Why?',
    questionSource: 'typed', questionCreatedAt: '2026-07-11T12:00:00.000Z', answerText: 'Because.',
    answerCreatedAt: '2026-07-11T12:01:00.000Z', modelName: 'fake-main', citedPostIds: ['post-1'], conceptIds: [],
  };
  await dbExecute(
    'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
    [revision2.id, 'qa', 2, JSON.stringify(revision2)],
  );
  await dbExecute(
    'INSERT OR REPLACE INTO research_metadata (id, data) VALUES (?, ?)',
    ['delivery:qa-ledger', JSON.stringify({ revision: 1, deliveredAt: '2026-07-11T12:00:30.000Z' })],
  );

  await uploadQueueService.reconcileResearchOutbox();
  const queued = await queueRows();
  assert.equal(queued.length, 1);
  assert.equal(JSON.parse(queued[0].data).record.revision, 2);
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

test('online, active app-state, and interval triggers retry without treating signals as delivery', async () => {
  await resetQueue();
  await enqueue(event('triggered'), { triggerFlush: false });
  const listeners = new Map();
  const windowTarget = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  let appStateListener;
  let intervalListener;
  let intervalDelay;
  let clearedInterval;
  let flushes = 0;
  const unregister = registerRetryTriggers({
    windowTarget,
    addAppStateListener(listener) {
      appStateListener = listener;
      return Promise.resolve({ remove() {} });
    },
    flush: async () => { flushes += 1; },
    setInterval(listener, delay) {
      intervalListener = listener;
      intervalDelay = delay;
      return 47;
    },
    clearInterval(handle) { clearedInterval = handle; },
  });

  listeners.get('online')();
  appStateListener({ isActive: false });
  appStateListener({ isActive: true });
  intervalListener();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(intervalDelay, 15_000);
  assert.equal(flushes, 3);
  assert.equal((await queueRows()).length, 1);
  unregister();
  assert.equal(listeners.has('online'), false);
  assert.equal(clearedInterval, 47);
});
