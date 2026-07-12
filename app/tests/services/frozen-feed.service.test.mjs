import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { FrozenFeedService, FrozenFeedError } = await import('../../src/services/frozen-feed.service.ts');

function records() {
  const posts = [
    {
      id: 'post-a', topicId: 'topic-1', sourceUrl: 'https://example.com/a',
      sourcePlatform: 'article', sourceName: 'Example', originalTitle: 'A',
      displayTitle: 'Post A', hook: 'Hook A', shortSummary: 'Summary A', language: 'en',
      collectedAt: '2026-07-01T00:00:00.000Z', qualityScore: 1,
      interestingnessScore: 1, educationalValueScore: 1, difficulty: 0.2,
      conceptIds: ['concept-1'], claimIds: ['claim-1'], suggestedQuestionIds: ['sq-a'], status: 'frozen',
    },
    {
      id: 'post-b', topicId: 'topic-1', sourceUrl: 'https://www.youtube.com/watch?v=example',
      sourcePlatform: 'youtube', sourceName: 'Example', originalTitle: 'B',
      displayTitle: 'Post B', hook: 'Hook B', shortSummary: 'Summary B', language: 'en',
      collectedAt: '2026-07-01T00:00:00.000Z', qualityScore: 1,
      interestingnessScore: 1, educationalValueScore: 1, difficulty: 0.2,
      conceptIds: ['concept-1'], claimIds: ['claim-1'], suggestedQuestionIds: ['sq-b'], status: 'frozen',
    },
  ];
  const concept = { id: 'concept-1', topicId: 'topic-1', label: 'Concept', description: 'Description', aliases: [] };
  const claim = { id: 'claim-1', topicId: 'topic-1', text: 'Claim', conceptIds: ['concept-1'] };
  const suggestions = {
    'post-a': [{ id: 'sq-a', postId: 'post-a', topicId: 'topic-1', text: 'Why?', type: 'evidence', targetConceptIds: ['concept-1'], targetClaimIds: ['claim-1'], generic: false }],
    'post-b': [{ id: 'sq-b', postId: 'post-b', topicId: 'topic-1', text: 'Where else?', type: 'connection', targetConceptIds: ['concept-1'], generic: true }],
  };
  const assets = {
    'post-a': { postId: 'post-a', kind: 'article', sourceUrl: 'https://example.com/a', body: 'Stored article', sha256: 'a'.repeat(64) },
    'post-b': { postId: 'post-b', kind: 'video', sourceUrl: 'https://www.youtube.com/watch?v=example', videoId: 'example', digest: 'Reviewed digest', sha256: 'b'.repeat(64) },
  };
  return { posts, concept, claim, suggestions, assets };
}

function repository(overrides = {}) {
  const data = records();
  const calls = [];
  const repo = {
    getSnapshot() { calls.push(['getSnapshot']); return { status: 'ready', version: 'v1' }; },
    getManifest() { calls.push(['getManifest']); return { contentPoolVersion: 'v1', feedOrderPostIds: ['post-b', 'post-a'] }; },
    getPost(id) { calls.push(['getPost', id]); return data.posts.find((post) => post.id === id) ?? null; },
    getConcepts(id) { calls.push(['getConcepts', id]); return this.getPost(id) ? [data.concept] : []; },
    getClaims(id) { calls.push(['getClaims', id]); return this.getPost(id) ? [data.claim] : []; },
    getSuggestedQuestions(id) { calls.push(['getSuggestedQuestions', id]); return data.suggestions[id] ?? []; },
    getOriginalContent(id) { calls.push(['getOriginalContent', id]); return data.assets[id] ?? null; },
    ...overrides,
  };
  return { repo, calls, data };
}

describe('FrozenFeedService', () => {
  it('uses manifest order and only removes dismissed post IDs', () => {
    const { repo } = repository();
    const dismissed = new Set(['post-b']);
    const service = new FrozenFeedService(repo, () => dismissed);

    assert.deepEqual(service.getFeed().map((post) => post.id), ['post-a']);
    dismissed.clear();
    assert.deepEqual(service.getFeed().map((post) => post.id), ['post-b', 'post-a']);
  });

  it('is condition- and question-history-blind with byte-equivalent values and calls', () => {
    let condition = 'control';
    let questionHistory = [];
    const first = repository();
    const service = new FrozenFeedService(first.repo, () => new Set());
    const control = {
      condition,
      feed: service.getFeed(),
      post: service.getPostById('post-a'),
      suggestions: service.getSuggestedQuestions('post-a'),
      asset: service.getOriginalContent('post-a'),
    };
    const controlCalls = structuredClone(first.calls);

    condition = 'experimental';
    questionHistory = [{ id: 'question-1', postId: 'post-b' }];
    first.calls.length = 0;
    const experimental = {
      condition,
      feed: service.getFeed(),
      post: service.getPostById('post-a'),
      suggestions: service.getSuggestedQuestions('post-a'),
      asset: service.getOriginalContent('post-a'),
    };

    assert.equal(questionHistory.length, 1);
    assert.equal(JSON.stringify({ ...control, condition: undefined }), JSON.stringify({ ...experimental, condition: undefined }));
    assert.deepEqual(first.calls, controlCalls);
  });

  it('returns detached immutable values and stored original content only', () => {
    const { repo, data } = repository();
    const service = new FrozenFeedService(repo, () => new Set());
    const post = service.getPostById('post-a');
    const asset = service.getOriginalContent('post-a');

    assert.equal(Object.isFrozen(post), true);
    assert.equal(Object.isFrozen(post.conceptIds), true);
    assert.equal(Object.isFrozen(asset), true);
    assert.throws(() => { post.displayTitle = 'mutated'; }, TypeError);
    assert.equal(data.posts[0].displayTitle, 'Post A');
    assert.equal(asset.body, 'Stored article');
  });

  it('fails closed when manifest order contains a missing post without network access', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('network forbidden'); };
    const { repo } = repository({
      getManifest() { return { contentPoolVersion: 'v1', feedOrderPostIds: ['post-missing'] }; },
    });
    try {
      const service = new FrozenFeedService(repo, () => new Set());
      assert.throws(() => service.getFeed(), FrozenFeedError);
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
