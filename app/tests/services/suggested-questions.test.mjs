import assert from 'node:assert/strict';
import { it } from 'node:test';

const { FrozenFeedService, FrozenFeedError } = await import('../../src/services/frozen-feed.service.ts');

function makeRepository(suggestion) {
  const post = {
    id: 'post-1', topicId: 'topic-1', conceptIds: ['concept-1'], claimIds: ['claim-1'],
    suggestedQuestionIds: ['sq-1'],
  };
  return {
    getSnapshot: () => ({ status: 'ready', version: 'v1' }),
    getManifest: () => ({ contentPoolVersion: 'v1', feedOrderPostIds: ['post-1'] }),
    getPost: (id) => id === post.id ? post : null,
    getConcepts: () => [{ id: 'concept-1' }],
    getClaims: () => [{ id: 'claim-1' }],
    getSuggestedQuestions: () => [suggestion],
    getOriginalContent: () => null,
  };
}

it('preserves exact frozen suggestion provenance and target metadata', () => {
  const suggestion = {
    id: 'sq-1', postId: 'post-1', topicId: 'topic-1', text: 'What evidence supports this?',
    type: 'evidence', targetConceptIds: ['concept-1'], targetClaimIds: ['claim-1'], generic: false,
  };
  const service = new FrozenFeedService(makeRepository(suggestion), () => new Set());

  assert.deepEqual(service.getSuggestedQuestions('post-1'), [suggestion]);
});

for (const [label, patch] of [
  ['wrong post', { postId: 'post-other' }],
  ['wrong topic', { topicId: 'topic-other' }],
  ['dangling concept target', { targetConceptIds: ['concept-other'] }],
  ['dangling claim target', { targetClaimIds: ['claim-other'] }],
]) {
  it(`fails closed for a ${label}`, () => {
    const suggestion = {
      id: 'sq-1', postId: 'post-1', topicId: 'topic-1', text: 'Question', type: 'clarification',
      targetConceptIds: ['concept-1'], targetClaimIds: ['claim-1'], generic: true, ...patch,
    };
    const service = new FrozenFeedService(makeRepository(suggestion), () => new Set());
    assert.throws(() => service.getSuggestedQuestions('post-1'), FrozenFeedError);
  });
}
