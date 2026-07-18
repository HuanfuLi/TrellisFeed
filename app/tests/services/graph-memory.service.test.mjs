import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

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
const { studyContextService } = await import('../../src/services/study-context.service.ts');
const { createInteractionLog } = await import('../../src/services/interaction-log.service.ts');
const {
  GRAPH_MEMORY_RULES,
  graphMemoryService,
} = await import('../../src/services/graph-memory.service.ts');

await studyContextService.hydrate();
await studyContextService.bindOnce({
  userId: '1001',
  condition: 'experimental',
  topicId: 'topic-1',
  boundAt: '2026-07-18T00:00:00.000Z',
}, 'graph-memory-test-install-token-000000000001');

function event(id, eventType, conceptIds = ['concept-1'], fields = {}) {
  return {
    id,
    userId: 'user-1',
    condition: 'experimental',
    topicId: 'topic-1',
    timestamp: `2026-07-18T12:00:${String(Number(id.replace(/\D/g, '')) || 0).padStart(2, '0')}.000Z`,
    eventType,
    payload: { conceptIds },
    postId: 'post-1',
    ...fields,
  };
}

function parsedRows(rows) {
  return rows
    .map((row) => JSON.parse(row.data))
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId));
}

async function states(userId = 'user-1') {
  return parsedRows(await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', [userId]));
}

async function contributions(userId = 'user-1') {
  return (await dbQuery('SELECT * FROM graph_contributions WHERE user_id = ?', [userId]))
    .map((row) => JSON.parse(row.data))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function edges(userId = 'user-1') {
  return (await dbQuery('SELECT * FROM personal_graph_edges WHERE user_id = ?', [userId]))
    .map((row) => JSON.parse(row.data))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function clearDerived() {
  await dbExecute('DELETE FROM user_concept_states');
  await dbExecute('DELETE FROM graph_contributions');
  await dbExecute('DELETE FROM personal_graph_edges');
}

beforeEach(async () => {
  await clearDerived();
  await dbExecute('DELETE FROM research_records');
});

test('post_open writes durable per-concept contributions and field-exact states', async () => {
  const updated = [];
  const unsubscribe = eventBus.subscribe('GRAPH_UPDATED', (message) => updated.push(message));
  try {
    const result = await graphMemoryService.applyEvent(event('event-1', 'post_open', ['concept-1', 'concept-2']));
    assert.equal(result.success, true);
  } finally {
    unsubscribe();
  }

  assert.deepEqual((await contributions()).map((row) => row.id), [
    'event-1:concept-1:post_open',
    'event-1:concept-2:post_open',
  ]);
  assert.deepEqual(await states(), [
    {
      userId: 'user-1', conceptId: 'concept-1', exposureCount: 1, questionCount: 0,
      savedPostCount: 0, skippedPostCount: 0, lastActivatedAt: '2026-07-18T12:00:01.000Z',
      interestWeight: 0.1, uncertaintyWeight: 0, familiarityEstimate: 0,
    },
    {
      userId: 'user-1', conceptId: 'concept-2', exposureCount: 1, questionCount: 0,
      savedPostCount: 0, skippedPostCount: 0, lastActivatedAt: '2026-07-18T12:00:01.000Z',
      interestWeight: 0.1, uncertaintyWeight: 0, familiarityEstimate: 0,
    },
  ]);
  assert.deepEqual(updated.at(-1), {
    type: 'GRAPH_UPDATED',
    payload: { kind: 'interaction', affectedIds: ['concept-1', 'concept-2'] },
  });
});

test('applying the identical event twice leaves byte-identical durable state', async () => {
  const duplicate = event('event-2', 'post_open');
  await graphMemoryService.applyEvent(duplicate);
  const first = await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', ['user-1']);
  await graphMemoryService.applyEvent(duplicate);
  const second = await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', ['user-1']);

  assert.deepEqual(second, first);
  assert.equal((await contributions()).length, 1);
  assert.deepEqual((await edges()).map((edge) => edge.type), ['viewed']);
});

test('interest deltas clamp to the inclusive zero-to-one range', async () => {
  for (let index = 1; index <= 5; index += 1) {
    await graphMemoryService.applyEvent(event(`positive-${index}`, 'question_submit'));
  }
  assert.equal((await states())[0].interestWeight, 1);

  for (let index = 1; index <= 10; index += 1) {
    await graphMemoryService.applyEvent(event(`negative-${index}`, 'not_interested'));
  }
  assert.equal((await states())[0].interestWeight, 0);
});

test('a repeated not_interested adds repeated-skip only for the second distinct event', async () => {
  await graphMemoryService.applyEvent(event('skip-1', 'not_interested'));
  assert.deepEqual((await contributions()).map((row) => row.rule), ['not_interested']);

  await graphMemoryService.applyEvent(event('skip-2', 'not_interested'));
  assert.deepEqual((await contributions()).map((row) => row.rule), [
    'not_interested',
    'not_interested',
    'repeated_skip',
  ]);
  const [state] = await states();
  assert.equal(state.skippedPostCount, 2);
  assert.equal(state.interestWeight, 0);
});

test('replayFromLog rebuilds byte-identical state from durable research events', async () => {
  const logged = [
    event('replay-1', 'feed_impression'),
    event('replay-2', 'post_open'),
    event('replay-3', 'save_post'),
    event('replay-4', 'not_interested'),
    event('replay-5', 'not_interested'),
  ];
  for (const item of logged) {
    await dbExecute(
      'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
      [item.id, 'event', 1, JSON.stringify(item)],
    );
    await graphMemoryService.applyEvent(item);
  }
  const expected = await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', ['user-1']);

  await clearDerived();
  const result = await graphMemoryService.replayFromLog('user-1');

  assert.equal(result.success, true);
  assert.deepEqual(
    await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', ['user-1']),
    expected,
  );
});

test('interaction events persist the named personal graph edges', async () => {
  await graphMemoryService.applyEvent(event('edge-1', 'post_open'));
  await graphMemoryService.applyEvent(event('edge-2', 'post_open'));
  await graphMemoryService.applyEvent(event('edge-3', 'save_post'));
  await graphMemoryService.applyEvent(event('edge-4', 'not_interested'));

  assert.deepEqual(new Set((await edges()).map((edge) => edge.type)), new Set([
    'viewed', 'revisited', 'saved', 'skipped',
  ]));
});

test('question extraction writes contributions, asks_about edges, and serializable snapshots', async () => {
  const question = {
    id: 'question-1', userId: 'user-1', condition: 'experimental', topicId: 'topic-1', postId: 'post-1',
    text: 'What evidence supports this?', source: 'typed', createdAt: '2026-07-18T12:01:00.000Z',
    extractedConceptIds: [], questionType: 'evidence',
  };
  const result = await graphMemoryService.applyQuestionExtraction(
    question,
    ['concept-1'],
    ['claim-1'],
  );
  assert.equal(result.success, true);
  assert.equal((await states())[0].questionCount, 1);
  assert.equal((await states())[0].interestWeight, GRAPH_MEMORY_RULES.question_submit.interest);
  assert.deepEqual(new Set((await edges()).map((edge) => edge.targetId)), new Set(['concept-1', 'claim-1']));

  const snapshot = await graphMemoryService.snapshot();
  assert.equal(snapshot.success, true);
  assert.doesNotThrow(() => JSON.stringify(snapshot.data));
  assert.equal(snapshot.data.userConceptStates.length, 1);
  assert.equal(snapshot.data.contributions.length, 1);
  assert.equal(snapshot.data.personalEdges.length, 2);
});

test('interaction logging resolves when the fire-and-forget graph hook throws', async () => {
  localStorage.setItem('questiontrace_settings', JSON.stringify({
    preferences: { onboardingCompleted: true, aiConsentGiven: true },
  }));
  let hookCalled;
  const called = new Promise((resolve) => { hookCalled = resolve; });
  const reported = [];
  const logger = createInteractionLog({
    enqueue: async () => {},
    now: () => '2026-07-18T12:02:00.000Z',
    createId: () => 'hook-event-1',
    loadGraphMemory: async () => ({
      applyEvent: async () => {
        hookCalled();
        throw new Error('injected graph failure');
      },
    }),
    reportGraphMemoryError: (error) => reported.push(error),
  });

  const logged = await logger.record('post_open', { postId: 'post-hook' });
  assert.equal(logged.id, 'hook-event-1');
  assert.equal(
    await Promise.race([called.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 50))]),
    true,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(reported.length, 1);
  assert.equal((await dbQuery('SELECT * FROM research_records WHERE id = ?', ['hook-event-1'])).length, 1);
});

test('repairOnBoot restores a missing contribution and converges to replay output', async () => {
  const logged = [
    event('repair-1', 'post_open'),
    event('repair-2', 'save_post'),
    event('repair-3', 'not_interested'),
  ];
  for (const item of logged) {
    await dbExecute(
      'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
      [item.id, 'event', 1, JSON.stringify(item)],
    );
  }
  await graphMemoryService.replayFromLog('user-1');
  const expected = await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', ['user-1']);

  await dbExecute('DELETE FROM graph_contributions WHERE id = ?', ['repair-2:concept-1:save_post']);
  await dbExecute('DELETE FROM user_concept_states WHERE user_id = ?', ['user-1']);
  const repaired = await graphMemoryService.repairOnBoot();

  assert.equal(repaired.success, true);
  assert.equal(repaired.data, 1);
  assert.deepEqual(
    await dbQuery('SELECT * FROM user_concept_states WHERE user_id = ?', ['user-1']),
    expected,
  );
});
