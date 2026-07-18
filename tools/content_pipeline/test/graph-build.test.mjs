import assert from 'node:assert/strict';
import test from 'node:test';

import { GLOBAL_EDGE_TYPES, compileGlobalGraph } from '../src/graph/build.ts';

const fixture = {
  posts: [
    {
      id: 'post-a', topicId: 'topic-a', sourceUrl: 'https://example.com/a', sourcePlatform: 'article', sourceName: 'Example',
      shortSummary: 'Agents need reliability checks.', qualityScore: 0.9, educationalValueScore: 0.8,
      interestingnessScore: 0.7, difficulty: 0.4, viewpoint: 'supportive', conceptIds: ['concept-agents', 'concept-reliability'],
      claimIds: ['claim-pro'], suggestedQuestionIds: ['question-one', 'question-two'],
    },
    {
      id: 'post-b', topicId: 'topic-a', sourceUrl: 'https://example.com/b', sourcePlatform: 'youtube', sourceName: 'Video Source',
      shortSummary: 'Agents can create reliability risks.', qualityScore: 0.8, educationalValueScore: 0.7,
      interestingnessScore: 0.9, difficulty: 0.6, viewpoint: 'critical', conceptIds: ['concept-agents'],
      claimIds: ['claim-con'], suggestedQuestionIds: [],
    },
  ],
  concepts: [
    { id: 'concept-agents', topicId: 'topic-a', label: 'AI Agents', aliases: ['agents'] },
    { id: 'concept-reliability', topicId: 'topic-a', label: 'Reliability', aliases: ['robustness'] },
    { id: 'concept-automation', topicId: 'topic-a', label: 'Automation', aliases: [] },
  ],
  conceptRelations: [
    {
      conceptId: 'concept-agents',
      relatedConceptLabels: ['robustness'],
      prerequisiteConceptLabels: ['Automation', 'Missing reviewed concept'],
    },
  ],
  claims: [
    { id: 'claim-pro', topicId: 'topic-a', stance: 'pro', conceptIds: ['concept-agents'] },
    { id: 'claim-con', topicId: 'topic-a', stance: 'con', conceptIds: ['concept-agents'] },
  ],
  suggestedQuestions: [
    { id: 'question-one', postId: 'post-a', topicId: 'topic-a', targetConceptIds: ['concept-reliability'], targetClaimIds: ['claim-pro'] },
    { id: 'question-two', postId: 'post-a', topicId: 'topic-a', targetConceptIds: ['concept-reliability'], targetClaimIds: [] },
  ],
};

test('graph compiler emits typed deterministic edges and ranking metadata', async () => {
  const first = await compileGlobalGraph(structuredClone(fixture));
  const second = await compileGlobalGraph(structuredClone(fixture));

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(GLOBAL_EDGE_TYPES, [
    'explains', 'mentions', 'supports', 'challenges', 'about',
    'contrasts_with', 'related_to', 'prerequisite_of', 'targets',
  ]);

  const types = new Set(first.globalEdges.map((edge) => edge.type));
  assert.deepEqual(types, new Set(GLOBAL_EDGE_TYPES));
  assert.ok(first.globalEdges.some((edge) => edge.type === 'explains' && edge.sourceId === 'post-a' && edge.targetId === 'concept-reliability'));
  assert.ok(first.globalEdges.some((edge) => edge.type === 'related_to' && edge.sourceId === 'concept-agents' && edge.targetId === 'concept-reliability'));
  assert.ok(first.globalEdges.some((edge) => edge.type === 'prerequisite_of' && edge.sourceId === 'concept-automation' && edge.targetId === 'concept-agents'));
  assert.ok(first.globalEdges.some((edge) => edge.type === 'challenges' && edge.sourceId === 'post-a' && edge.targetId === 'claim-con'));

  const contrastPairs = first.globalEdges.filter((edge) => edge.type === 'contrasts_with').map((edge) => `${edge.sourceId}->${edge.targetId}`);
  assert.deepEqual(contrastPairs, ['claim-con->claim-pro', 'claim-pro->claim-con']);

  const knownIds = new Set([
    ...fixture.posts.map(({ id }) => id), ...fixture.concepts.map(({ id }) => id),
    ...fixture.claims.map(({ id }) => id), ...fixture.suggestedQuestions.map(({ id }) => id),
  ]);
  assert.ok(first.globalEdges.every((edge) => knownIds.has(edge.sourceId) && knownIds.has(edge.targetId)));
  assert.deepEqual(first.warnings.map((warning) => warning.label), ['Missing reviewed concept']);

  assert.equal(first.rankingFeatures.embeddingFingerprint, null);
  assert.equal(first.rankingFeatures.posts.length, fixture.posts.length);
  const postA = first.rankingFeatures.posts.find(({ postId }) => postId === 'post-a');
  const postB = first.rankingFeatures.posts.find(({ postId }) => postId === 'post-b');
  assert.equal(postA.primaryConceptId, 'concept-reliability');
  assert.equal(postA.format, 'article');
  assert.equal(postB.format, 'video');
  assert.equal('summaryVector' in postA, false);
  assert.equal(first.sources.length, 2);
  assert.equal(postA.sourceId, first.sources.find(({ url }) => url === 'https://example.com/a').id);
});

test('graph compiler populates all vectors coherently when embedding is configured', async () => {
  const result = await compileGlobalGraph(structuredClone(fixture), {
    provider: 'fixture', model: 'fixture-embedding', dimensions: 2,
    embed: async (text) => [text.length, 1],
  });

  assert.deepEqual(result.rankingFeatures.embeddingFingerprint, {
    provider: 'fixture', model: 'fixture-embedding', dimensions: 2,
  });
  assert.ok(result.rankingFeatures.posts.every((post) => post.summaryVector?.length === 2));
});
