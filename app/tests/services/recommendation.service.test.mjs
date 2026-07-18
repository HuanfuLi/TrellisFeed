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

const makePost = (index, overrides = {}) => ({
  id: `post-${index}`,
  topicId: 'topic-1',
  sourceUrl: `https://example.test/posts/${index}`,
  sourcePlatform: index % 2 === 0 ? 'youtube' : 'article',
  sourceName: `Source ${index}`,
  originalTitle: `Original ${index}`,
  displayTitle: `Post ${index}`,
  hook: `Hook ${index}`,
  shortSummary: `Summary ${index}`,
  language: 'en',
  collectedAt: '2026-07-01T00:00:00.000Z',
  qualityScore: 0.9,
  interestingnessScore: 0.8,
  educationalValueScore: 0.85,
  difficulty: 0.5,
  conceptIds: [`concept-${(index % 3) + 1}`],
  claimIds: [],
  suggestedQuestionIds: [],
  status: 'frozen',
  ...overrides,
});

const makeFeature = (post, index) => ({
  postId: post.id,
  topicId: post.topicId,
  primaryConceptId: post.conceptIds[0],
  sourceId: `source-${index}`,
  format: post.sourcePlatform === 'youtube' ? 'video' : 'article',
  qualityScore: post.qualityScore,
  educationalValueScore: post.educationalValueScore,
  interestingnessScore: post.interestingnessScore,
  difficulty: post.difficulty,
});

function makeServiceHarness({
  condition = 'control',
  posts = Array.from({ length: 12 }, (_, index) => makePost(index + 1)),
  dismissedPostIds = new Set(),
  personalLoader,
  questions = [],
  snapshot = { userConceptStates: [], personalEdges: [], contributions: [] },
} = {}) {
  const features = new Map(posts.map((post, index) => [post.id, makeFeature(post, index + 1)]));
  const concepts = new Map(posts.flatMap((post) => post.conceptIds.map((id) => [id, {
    id,
    topicId: 'topic-1',
    label: `Concept ${id.slice(-1)}`,
    description: '',
    aliases: [],
  }])));
  let generatedId = 0;
  let snapshotReads = 0;
  let questionReads = 0;
  const loadPersonalDependencies = personalLoader ?? (() => ({
    async readSnapshot() {
      snapshotReads += 1;
      return { success: true, data: snapshot };
    },
    async readQuestions() {
      questionReads += 1;
      return questions;
    },
    getViewedPostIds() { return []; },
  }));

  const dependencies = {
    studyContext: {
      getRequired: () => ({
        userId: 'user-1',
        condition,
        topicId: 'topic-1',
        boundAt: '2026-07-01T00:00:00.000Z',
      }),
    },
    feed: {
      getFeed: () => posts.filter((post) => !dismissedPostIds.has(post.id)),
      getPostById: (postId) => posts.find((post) => post.id === postId) ?? null,
      getConcepts: (postId) => (posts.find((post) => post.id === postId)?.conceptIds ?? [])
        .map((id) => concepts.get(id)),
    },
    getTopic: () => ({
      id: 'topic-1',
      name: 'Topic',
      shortDescription: '',
      hooks: [],
      coreConceptIds: ['concept-1', 'concept-2'],
      testRubricId: 'rubric-1',
      contentPoolVersion: 'fixture-v1',
    }),
    globalGraph: {
      rankingFeatures: (postId) => features.get(postId) ?? null,
      edgesByType: () => [],
      embeddingFingerprint: () => null,
    },
    loadPersonalDependencies,
    now: () => Date.parse('2026-07-18T12:00:00.000Z'),
    createId: (kind) => `${kind}-${++generatedId}`,
  };

  return {
    dependencies,
    posts,
    dismissedPostIds,
    reads: () => ({ snapshotReads, questionReads }),
  };
}

async function batchRecommendations(batchResult) {
  assert.equal(batchResult.success, true, batchResult.error?.message);
  const rows = await Promise.all(batchResult.data.recommendationIds.map(async (id) => {
    const stored = await dbQuery('SELECT * FROM recommendations WHERE id = ?', [id]);
    assert.equal(stored.length, 1);
    return JSON.parse(stored[0].data);
  }));
  return rows;
}

describe('recommendation service control isolation and batch lifecycle', () => {
  it('control batches are byte-equal across question histories and never load personal stores', async () => {
    const { RecommendationService } = await import('../../src/services/recommendation.service.ts');
    const harness = makeServiceHarness({
      personalLoader: () => { throw new Error('CONTROL TOUCHED PERSONAL DATA'); },
    });
    const service = new RecommendationService(harness.dependencies);

    await dbExecute(
      'INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
      ['question-a', 'user-1', 'post-1', '2026-07-10T00:00:00.000Z', JSON.stringify({ text: 'history A' })],
    );
    const first = await batchRecommendations(await service.beginSession('control-session-a'));

    await dbExecute('DELETE FROM user_questions');
    await dbExecute(
      'INSERT OR REPLACE INTO user_questions (id, user_id, post_id, created_at, data) VALUES (?, ?, ?, ?, ?)',
      ['question-b', 'user-1', 'post-2', '2026-07-11T00:00:00.000Z', JSON.stringify({ text: 'different history B' })],
    );
    const second = await batchRecommendations(await service.beginSession('control-session-b'));

    const project = (items) => items.map(({ postId, score, strategy, reasonText }) => ({
      postId, score, strategy, reasonText,
    }));
    assert.deepEqual(project(first), project(second));
    assert.ok((await dbQuery('SELECT * FROM recommendations')).length > 0);
  });

  it('experimental cold-start uses the same batch path and only experimental strategies', async () => {
    const { RecommendationService, RECOMMENDATION_BATCH_SIZE } = await import('../../src/services/recommendation.service.ts');
    const harness = makeServiceHarness({ condition: 'experimental' });
    const service = new RecommendationService(harness.dependencies);

    const result = await service.beginSession('experimental-cold-start');
    const items = await batchRecommendations(result);

    assert.ok(items.length > 0);
    assert.ok(items.length <= RECOMMENDATION_BATCH_SIZE);
    assert.ok(items.every((item) => ['deepen', 'contrast', 'bridge', 'continue', 'echo'].includes(item.strategy)));
    assert.deepEqual(harness.reads(), { snapshotReads: 1, questionReads: 1 });
  });

  it('beginSession recovers a building batch without duplicating seq 1', async () => {
    const { RecommendationRepository } = await import('../../src/services/recommendation.repository.ts');
    const { RecommendationService } = await import('../../src/services/recommendation.service.ts');
    const interrupted = {
      ...batch('interrupted-batch', 1, []),
      sessionId: 'recover-session',
      status: 'building',
    };
    assert.equal((await new RecommendationRepository().saveBatch(interrupted, [])).success, true);

    const service = new RecommendationService(makeServiceHarness().dependencies);
    const recovered = await service.beginSession('recover-session');
    assert.equal(recovered.success, true);
    assert.equal(recovered.data.id, 'interrupted-batch');
    assert.equal(recovered.data.status, 'ready');

    const ledgers = await new RecommendationRepository().readSessionBatches('user-1', 'recover-session');
    assert.equal(ledgers.success, true);
    assert.equal(ledgers.data.length, 1);
    assert.equal(ledgers.data[0].seq, 1);
  });

  it('nextBatch increments seq and carries diversity counters forward', async () => {
    const { RecommendationService, RECOMMENDATION_BATCH_SIZE } = await import('../../src/services/recommendation.service.ts');
    const service = new RecommendationService(makeServiceHarness().dependencies);
    const first = await service.beginSession('next-session');
    const second = await service.nextBatch('next-session');

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(first.data.seq, 1);
    assert.equal(second.data.seq, 2);
    assert.equal(first.data.recommendationIds.length, RECOMMENDATION_BATCH_SIZE);
    assert.ok(second.data.recommendationIds.length > 0);
    for (const [sourceId, count] of Object.entries(first.data.diversityCounters.sourceCounts)) {
      assert.ok(second.data.diversityCounters.sourceCounts[sourceId] >= count);
    }
  });

  it('dismissed posts stay excluded and an empty pool persists an empty ready batch', async () => {
    const { RecommendationService } = await import('../../src/services/recommendation.service.ts');
    const dismissed = new Set(['post-1']);
    const populated = new RecommendationService(makeServiceHarness({ dismissedPostIds: dismissed }).dependencies);
    const populatedItems = await batchRecommendations(await populated.beginSession('dismissed-session'));
    assert.ok(populatedItems.every((item) => item.postId !== 'post-1'));

    const empty = new RecommendationService(makeServiceHarness({ posts: [] }).dependencies);
    const emptyResult = await empty.beginSession('empty-session');
    assert.equal(emptyResult.success, true);
    assert.equal(emptyResult.data.status, 'ready');
    assert.deepEqual(emptyResult.data.recommendationIds, []);
  });
});
