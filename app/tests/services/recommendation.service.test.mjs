import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

globalThis.localStorage = {
  _store: new Map(),
  getItem(key) { return this._store.get(key) ?? null; },
  setItem(key, value) { this._store.set(key, String(value)); },
  removeItem(key) { this._store.delete(key); },
  clear() { this._store.clear(); },
};

const { dbExecute, dbQuery } = await import('../../src/services/db.service.ts');

const recommendationAllowlist = [
  'id',
  'userId',
  'condition',
  'topicId',
  'postId',
  'generatedAt',
  'strategy',
  'score',
  'reasonText',
  'contributingQuestionIds',
  'contributingConceptIds',
  'contributingPostIds',
  'componentScores',
].sort();

const recommendation = (id, postId, overrides = {}) => ({
  id,
  userId: 'user-1',
  condition: 'experimental',
  topicId: 'topic-1',
  postId,
  generatedAt: '2026-07-18T12:00:00.000Z',
  strategy: 'deepen',
  score: 0.73,
  reasonText: 'This extends your question about reliable agents.',
  contributingQuestionIds: ['question-1'],
  contributingConceptIds: ['concept-1'],
  contributingPostIds: ['post-prior'],
  componentScores: { questionRelevance: 0.8, contentQuality: 0.7 },
  ...overrides,
});

const batch = (id, seq, recommendationIds, counters = {}) => ({
  id,
  userId: 'user-1',
  sessionId: 'session-1',
  seq,
  recommendationIds,
  status: 'ready',
  diversityCounters: {
    sourceCounts: counters.sourceCounts ?? { 'source-1': seq },
    recentPrimaryConceptIds: counters.recentPrimaryConceptIds ?? [`concept-${seq}`],
  },
  createdAt: `2026-07-18T12:0${seq}:00.000Z`,
});

beforeEach(async () => {
  await dbExecute('DELETE FROM recommendations');
  await dbExecute('DELETE FROM recommendation_batches');
});

describe('recommendation repository', () => {
  it('repository persists field-exact recommendations and a separate batch ledger durably', async () => {
    const { RecommendationRepository } = await import('../../src/services/recommendation.repository.ts');
    const rows = [
      recommendation('recommendation-1', 'post-1'),
      recommendation('recommendation-2', 'post-2', {
        strategy: 'contrast',
        score: 0.61,
        reasonText: 'This offers a counterpoint to the post you explored.',
      }),
    ];
    const ledger = batch('batch-1', 1, rows.map((row) => row.id));

    const saved = await new RecommendationRepository().saveBatch(ledger, rows);
    assert.equal(saved.success, true);

    const durableRecommendationRows = await dbQuery('SELECT * FROM recommendations');
    const durableBatchRows = await dbQuery('SELECT * FROM recommendation_batches');
    assert.equal(durableRecommendationRows.length, 2);
    assert.equal(durableBatchRows.length, 1);

    for (const row of durableRecommendationRows) {
      const payload = JSON.parse(row.data);
      assert.deepEqual(Object.keys(payload).sort(), recommendationAllowlist);
      assert.ok(!Object.hasOwn(payload, 'sessionId'));
      assert.ok(!Object.hasOwn(payload, 'seq'));
      assert.ok(!Object.hasOwn(payload, 'status'));
      assert.ok(!Object.hasOwn(payload, 'diversityCounters'));
    }

    const freshRepository = new RecommendationRepository();
    const readBatch = await freshRepository.readBatch(ledger.id);
    assert.deepEqual(readBatch, { success: true, data: ledger });
    for (const expected of rows) {
      const readRecommendation = await freshRepository.readRecommendation(expected.id);
      assert.deepEqual(readRecommendation, { success: true, data: expected });
    }
  });

  it('repository reads session batches by seq with diversity counters intact', async () => {
    const { RecommendationRepository } = await import('../../src/services/recommendation.repository.ts');
    const repository = new RecommendationRepository();
    const second = batch('batch-2', 2, ['recommendation-2'], {
      sourceCounts: { 'source-1': 1, 'source-2': 2 },
      recentPrimaryConceptIds: ['concept-1', 'concept-2'],
    });
    const first = batch('batch-1', 1, ['recommendation-1']);

    assert.equal((await repository.saveBatch(second, [recommendation('recommendation-2', 'post-2')])).success, true);
    assert.equal((await repository.saveBatch(first, [recommendation('recommendation-1', 'post-1')])).success, true);

    const reloaded = await new RecommendationRepository().readSessionBatches('user-1', 'session-1');
    assert.equal(reloaded.success, true);
    assert.deepEqual(reloaded.data, [first, second]);
  });
});
