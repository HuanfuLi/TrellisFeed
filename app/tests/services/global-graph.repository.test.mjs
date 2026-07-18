import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';

globalThis.localStorage = {
  _store: new Map(),
  getItem(key) { return this._store.get(key) ?? null; },
  setItem(key, value) { this._store.set(key, String(value)); },
  removeItem(key) { this._store.delete(key); },
  clear() { this._store.clear(); },
};
globalThis.indexedDB = fakeIndexedDB;

const dbModule = await import('../../src/services/db.service.ts');
const contentPoolModule = await import('../../src/services/content-pool.repository.ts');
const graphModule = await import('../../src/services/global-graph.repository.ts');

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function graphFixtureReader() {
  const bundle = {
    manifest: {
      contentPoolVersion: 'graph-v1',
      generatedAt: '2026-07-18T00:00:00.000Z',
      preprocessingModelVersions: ['fixture-v1'],
      rawCandidateCount: 2,
      approvedCount: 2,
      rejectedCount: 0,
      reviewProcedureSummary: 'Fixture reviewed for graph repository tests.',
      counts: { topics: 1, posts: 2, concepts: 3, claims: 2, suggestedQuestions: 2, sourceAssets: 2 },
      artifactHashes: {},
      feedOrderPostIds: ['post-a', 'post-b'],
    },
    topics: [{ id: 'topic-1', name: 'Graph memory', shortDescription: 'Graph test topic.', hooks: ['Trace relations.'], coreConceptIds: ['concept-a'], testRubricId: 'rubric-1', contentPoolVersion: 'graph-v1' }],
    posts: [
      { id: 'post-a', topicId: 'topic-1', sourceUrl: 'https://example.com/a', sourcePlatform: 'article', sourceName: 'Source A', originalTitle: 'A', displayTitle: 'Post A', hook: 'A hook.', shortSummary: 'Summary A.', language: 'en', collectedAt: '2026-07-01T00:00:00.000Z', qualityScore: 0.9, interestingnessScore: 0.8, educationalValueScore: 0.95, difficulty: 0.4, viewpoint: 'supportive', conceptIds: ['concept-a'], claimIds: ['claim-pro'], suggestedQuestionIds: ['question-a'], status: 'frozen' },
      { id: 'post-b', topicId: 'topic-1', sourceUrl: 'https://example.com/b', sourcePlatform: 'blog', sourceName: 'Source B', originalTitle: 'B', displayTitle: 'Post B', hook: 'B hook.', shortSummary: 'Summary B.', language: 'en', collectedAt: '2026-07-01T00:00:00.000Z', qualityScore: 0.8, interestingnessScore: 0.9, educationalValueScore: 0.85, difficulty: 0.6, viewpoint: 'critical', conceptIds: ['concept-a', 'concept-b'], claimIds: ['claim-con'], suggestedQuestionIds: ['question-b'], status: 'frozen' },
    ],
    concepts: [
      { id: 'concept-a', topicId: 'topic-1', label: 'A', description: 'Concept A.', aliases: [] },
      { id: 'concept-b', topicId: 'topic-1', label: 'B', description: 'Concept B.', aliases: [] },
      { id: 'concept-c', topicId: 'topic-1', label: 'C', description: 'Concept C.', aliases: [] },
    ],
    claims: [
      { id: 'claim-pro', topicId: 'topic-1', text: 'Claim pro.', stance: 'pro', conceptIds: ['concept-a'] },
      { id: 'claim-con', topicId: 'topic-1', text: 'Claim con.', stance: 'con', conceptIds: ['concept-a'] },
    ],
    suggestedQuestions: [
      { id: 'question-a', postId: 'post-a', topicId: 'topic-1', text: 'Why A?', type: 'clarification', targetConceptIds: ['concept-a'], targetClaimIds: ['claim-pro'], generic: false },
      { id: 'question-b', postId: 'post-b', topicId: 'topic-1', text: 'Why B?', type: 'counterpoint', targetConceptIds: ['concept-b'], targetClaimIds: ['claim-con'], generic: false },
    ],
    sourceAssets: [
      { postId: 'post-a', kind: 'article', sourceUrl: 'https://example.com/a', body: 'Frozen A.', sha256: sha256('Frozen A.') },
      { postId: 'post-b', kind: 'article', sourceUrl: 'https://example.com/b', body: 'Frozen B.', sha256: sha256('Frozen B.') },
    ],
    sources: [
      { id: 'source-a', name: 'Source A', platform: 'article', url: 'https://example.com/a' },
      { id: 'source-b', name: 'Source B', platform: 'blog', url: 'https://example.com/b' },
    ],
    globalEdges: [
      { id: 'explains:post-a:concept-a', topicId: 'topic-1', type: 'explains', sourceId: 'post-a', targetId: 'concept-a' },
      { id: 'about:claim-pro:concept-a', topicId: 'topic-1', type: 'about', sourceId: 'claim-pro', targetId: 'concept-a' },
      { id: 'contrasts_with:claim-pro:claim-con', topicId: 'topic-1', type: 'contrasts_with', sourceId: 'claim-pro', targetId: 'claim-con' },
      { id: 'contrasts_with:claim-con:claim-pro', topicId: 'topic-1', type: 'contrasts_with', sourceId: 'claim-con', targetId: 'claim-pro' },
      { id: 'related_to:concept-a:concept-b', topicId: 'topic-1', type: 'related_to', sourceId: 'concept-a', targetId: 'concept-b' },
      { id: 'prerequisite_of:concept-c:concept-a', topicId: 'topic-1', type: 'prerequisite_of', sourceId: 'concept-c', targetId: 'concept-a' },
    ],
    rankingFeatures: {
      embeddingFingerprint: { provider: 'fixture', model: 'fixture-embedding', dimensions: 2 },
      posts: [
        { postId: 'post-a', topicId: 'topic-1', primaryConceptId: 'concept-a', sourceId: 'source-a', format: 'article', qualityScore: 0.9, educationalValueScore: 0.95, interestingnessScore: 0.8, difficulty: 0.4, viewpoint: 'supportive', summaryVector: [0.1, 0.2] },
        { postId: 'post-b', topicId: 'topic-1', primaryConceptId: 'concept-a', sourceId: 'source-b', format: 'article', qualityScore: 0.8, educationalValueScore: 0.85, interestingnessScore: 0.9, difficulty: 0.6, viewpoint: 'critical', summaryVector: [0.3, 0.4] },
      ],
    },
  };

  const artifacts = {
    'topics.json': JSON.stringify(bundle.topics),
    'posts.json': JSON.stringify(bundle.posts),
    'concepts.json': JSON.stringify(bundle.concepts),
    'claims.json': JSON.stringify(bundle.claims),
    'suggested_questions.json': JSON.stringify(bundle.suggestedQuestions),
    'source_assets.json': JSON.stringify(bundle.sourceAssets),
    'sources.json': JSON.stringify(bundle.sources),
    'global_edges.json': JSON.stringify(bundle.globalEdges),
    'ranking_features.json': JSON.stringify(bundle.rankingFeatures),
  };
  for (const [filename, text] of Object.entries(artifacts)) bundle.manifest.artifactHashes[filename] = sha256(text);
  const files = { 'manifest.json': JSON.stringify(bundle.manifest), ...artifacts };
  return { expectedVersion: 'graph-v1', async readText(filename) { return files[filename]; } };
}

describe('global graph repository', () => {
  beforeEach(async () => {
    await dbModule.clearAllTables();
  });

  it('loads fresh indexes from durable ready-version rows and answers bounded queries', async () => {
    const contentRepository = new contentPoolModule.ContentPoolRepository({ reader: graphFixtureReader() });
    assert.equal((await contentRepository.hydrate()).status, 'ready');

    const durableEdges = await dbModule.dbQuery('SELECT * FROM content_pool_global_edges WHERE version = ?', ['graph-v1']);
    const durableFeatures = await dbModule.dbQuery('SELECT * FROM content_pool_ranking_features WHERE version = ?', ['graph-v1']);
    assert.equal(durableEdges.length, 6);
    assert.equal(durableFeatures.length, 2);

    const repository = new graphModule.GlobalGraphRepository();
    assert.deepEqual(await repository.load(), { success: true });

    assert.deepEqual(
      repository.edgesByType('contrasts_with').map((edge) => edge.id),
      ['contrasts_with:claim-con:claim-pro', 'contrasts_with:claim-pro:claim-con'],
    );
    assert.deepEqual(repository.edgesFrom('claim-pro').map((edge) => edge.type), ['about', 'contrasts_with']);
    assert.deepEqual(repository.edgesTo('concept-a').map((edge) => edge.type), ['about', 'explains', 'prerequisite_of']);
    assert.deepEqual(repository.oneHopConcepts('concept-a'), ['concept-b', 'concept-c']);
    assert.deepEqual(repository.opposingClaims('claim-pro'), ['claim-con']);
    assert.equal(repository.rankingFeatures('post-a')?.primaryConceptId, 'concept-a');
    assert.deepEqual(repository.embeddingFingerprint(), { provider: 'fixture', model: 'fixture-embedding', dimensions: 2 });
  });

  it('returns an explicit load error and keeps queries unavailable without a ready pool', async () => {
    const repository = new graphModule.GlobalGraphRepository();
    const result = await repository.load();
    assert.equal(result.success, false);
    assert.equal(result.error?.code, 'DATABASE_ERROR');
    assert.throws(() => repository.edgesByType('explains'), /not loaded/i);
  });
});
