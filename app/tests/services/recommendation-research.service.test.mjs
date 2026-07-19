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
const { recommendationRepository } = await import('../../src/services/recommendation.repository.ts');
const {
  projectRecommendationResearchRecords,
} = await import('../../src/services/recommendation-research.service.ts');
const { toResearchWireRecord } = await import('../../src/services/research-wire-contract.ts');
const {
  RESEARCH_CONSENT_VERSION,
} = await import('../../src/services/research-consent.service.ts');

function setConsent(given) {
  localStorage.setItem('questiontrace_settings', JSON.stringify({
    preferences: {
      theme: 'system',
      locale: 'en',
      language: 'en',
      onboardingCompleted: true,
      aiConsentGiven: true,
      researchConsentGiven: given,
      researchConsentVersion: RESEARCH_CONSENT_VERSION,
    },
  }));
}

function recommendation(id, overrides = {}) {
  return {
    id,
    userId: '2401',
    condition: 'experimental',
    topicId: 'topic-1',
    postId: `post-${id}`,
    generatedAt: '2026-07-19T01:00:00.000Z',
    strategy: 'deepen',
    score: 0.5,
    reasonText: `Reason for ${id}`,
    contributingQuestionIds: ['question-1'],
    contributingConceptIds: ['concept-1'],
    contributingPostIds: ['post-prior'],
    componentScores: { semantic: 0.75 },
    ...overrides,
  };
}

function batch(id, recommendationIds, overrides = {}) {
  return {
    id,
    userId: '2401',
    sessionId: `session-${id}`,
    seq: 1,
    recommendationIds,
    status: 'ready',
    diversityCounters: {
      sourceCounts: { sourceA: 1 },
      recentPrimaryConceptIds: ['concept-internal'],
    },
    createdAt: '2026-07-19T01:00:00.000Z',
    ...overrides,
  };
}

async function resetResearchStores() {
  await dbExecute('DELETE FROM recommendation_batches');
  await dbExecute('DELETE FROM recommendations');
  await dbExecute('DELETE FROM research_records');
  await dbExecute('DELETE FROM research_upload_queue');
  await dbExecute('DELETE FROM research_upload_quarantine');
}

async function recommendationRecordRows() {
  return (await dbQuery('SELECT * FROM research_records'))
    .filter((row) => row.kind === 'recommendation');
}

test('projects ready batches in ledger order and excludes internal batch state', async () => {
  await resetResearchStores();
  setConsent(true);
  const low = recommendation('recommendation-low', { score: 0.1 });
  const high = recommendation('recommendation-high', { score: 0.9 });
  const ready = batch('batch-ordered', [low.id, high.id], { seq: 3 });
  assert.equal((await recommendationRepository.saveBatch(ready, [high, low])).success, true);

  assert.equal(await projectRecommendationResearchRecords(), 2);

  const rows = await recommendationRecordRows();
  assert.equal(rows.length, 2);
  const records = new Map(rows.map((row) => [row.id, JSON.parse(row.data)]));
  assert.equal(rows.every((row) => row.revision === 1), true);
  assert.deepEqual(
    [records.get(low.id).batchPosition, records.get(high.id).batchPosition],
    [1, 2],
  );
  assert.equal(records.get(low.id).batchId, ready.id);
  assert.equal(records.get(low.id).sessionId, ready.sessionId);
  assert.equal(records.get(low.id).batchSeq, 3);
  for (const record of records.values()) {
    assert.equal(record.kind, 'recommendation');
    assert.equal(Object.hasOwn(record, 'status'), false);
    assert.equal(Object.hasOwn(record, 'diversityCounters'), false);
  }
  const queued = await dbQuery('SELECT * FROM research_upload_queue');
  assert.equal(queued.length, 2);
  assert.equal(queued.every((row) => JSON.parse(row.data).record.kind === 'recommendation'), true);
});

test('boot projection closes the post-save crash window and is idempotent', async () => {
  await resetResearchStores();
  setConsent(true);
  const recommendations = [
    recommendation('recommendation-crash-a'),
    recommendation('recommendation-crash-b'),
  ];
  const ready = batch('batch-crash', recommendations.map((item) => item.id));
  assert.equal((await recommendationRepository.saveBatch(ready, recommendations)).success, true);
  assert.equal((await recommendationRecordRows()).length, 0);

  assert.equal(await projectRecommendationResearchRecords(), 2);
  assert.equal((await recommendationRecordRows()).length, 2);
  assert.equal(await projectRecommendationResearchRecords(), 0);
  assert.equal((await recommendationRecordRows()).length, 2);
  assert.equal((await dbQuery('SELECT * FROM research_upload_queue')).length, 2);
});

test('building batches are ignored and missing recommendation rows converge later', async () => {
  await resetResearchStores();
  setConsent(true);
  const buildingRecommendation = recommendation('recommendation-building');
  assert.equal((await recommendationRepository.saveBatch(
    batch('batch-building', [buildingRecommendation.id], { status: 'building' }),
    [buildingRecommendation],
  )).success, true);

  const present = recommendation('recommendation-present');
  const missing = recommendation('recommendation-missing');
  assert.equal((await recommendationRepository.saveBatch(
    batch('batch-partial', [present.id, missing.id], { seq: 2 }),
    [present, missing],
  )).success, true);
  await dbExecute('DELETE FROM recommendations WHERE id = ?', [missing.id]);

  assert.equal(await projectRecommendationResearchRecords(), 1);
  assert.deepEqual((await recommendationRecordRows()).map((row) => row.id), [present.id]);

  await dbExecute(
    'INSERT OR REPLACE INTO recommendations (id, user_id, data) VALUES (?, ?, ?)',
    [missing.id, missing.userId, JSON.stringify(missing)],
  );
  assert.equal(await projectRecommendationResearchRecords(), 1);
  assert.deepEqual(
    (await recommendationRecordRows()).map((row) => row.id).sort(),
    [missing.id, present.id].sort(),
  );
});

test('projection writes nothing without current affirmative research consent', async () => {
  await resetResearchStores();
  setConsent(false);
  const item = recommendation('recommendation-no-consent');
  assert.equal((await recommendationRepository.saveBatch(
    batch('batch-no-consent', [item.id]),
    [item],
  )).success, true);

  assert.equal(await projectRecommendationResearchRecords(), 0);
  assert.equal((await recommendationRecordRows()).length, 0);
  assert.equal((await dbQuery('SELECT * FROM research_upload_queue')).length, 0);
});

test('control projection carries no personal contributor IDs and produces a valid wire record', async () => {
  await resetResearchStores();
  setConsent(true);
  const control = recommendation('recommendation-control', {
    condition: 'control',
    strategy: 'topic_baseline',
    reasonText: 'Relevant to the current topic.',
    contributingQuestionIds: undefined,
    contributingConceptIds: undefined,
    contributingPostIds: undefined,
    componentScores: undefined,
  });
  assert.equal((await recommendationRepository.saveBatch(
    batch('batch-control', [control.id]),
    [control],
  )).success, true);

  assert.equal(await projectRecommendationResearchRecords(), 1);
  const rows = await recommendationRecordRows();
  assert.equal(rows.length, 1);
  const projected = JSON.parse(rows[0].data);
  for (const field of [
    'contributingQuestionIds',
    'contributingConceptIds',
    'contributingPostIds',
  ]) {
    assert.equal(Object.hasOwn(projected, field), false);
  }
  const wire = toResearchWireRecord(projected);
  assert.equal(wire.kind, 'recommendation');
  for (const field of ['userId', 'condition', 'topicId']) {
    assert.equal(Object.hasOwn(wire, field), false);
  }
});
