import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createServer } from 'vite';

const source = readFileSync(new URL('../../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');

function recommendation(id, postId) {
  return {
    id,
    userId: 'user-1',
    condition: 'control',
    topicId: 'topic-1',
    postId,
    strategy: 'quality_baseline',
    score: 0.8,
    reasonText: 'Popular explanation',
    generatedAt: '2026-07-18T00:00:00.000Z',
  };
}

function post(id) {
  return {
    id,
    topicId: 'topic-1',
    sourceUrl: `https://example.test/${id}`,
    sourcePlatform: 'article',
    sourceName: 'Example',
    originalTitle: id,
    displayTitle: id,
    hook: id,
    shortSummary: `${id} summary`,
    language: 'en',
    collectedAt: '2026-07-18T00:00:00.000Z',
    qualityScore: 1,
    interestingnessScore: 1,
    educationalValueScore: 1,
    difficulty: 1,
    conceptIds: [],
    claimIds: [],
    suggestedQuestionIds: [],
    status: 'frozen',
  };
}

async function loadHelpers() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    return await server.ssrLoadModule('/src/screens/HomeScreen.tsx');
  } finally {
    await server.close();
  }
}

test('Home resolves persisted recommendation items without manifest-order getFeed()', async () => {
  const { loadRecommendationFeed } = await loadHelpers();
  const calls = [];
  const first = recommendation('rec-1', 'post-1');
  const result = await loadRecommendationFeed({
    sessionId: null,
    append: false,
    recommendationService: {
      async beginSession(sessionId) {
        calls.push(['beginSession', sessionId]);
        return { success: true, data: { sessionId: 'session-1', status: 'ready' } };
      },
      async nextBatch() { throw new Error('not expected'); },
      async currentSessionItems(sessionId) {
        calls.push(['currentSessionItems', sessionId]);
        return { success: true, data: [first] };
      },
    },
    frozenFeedService: {
      getPostById: (postId) => post(postId),
      getConcepts: () => [{ label: 'Testing' }],
    },
  });

  assert.equal(result.sessionId, 'session-1');
  assert.deepEqual(result.items.map((item) => item.recommendation.id), ['rec-1']);
  assert.equal(result.items[0].post.id, 'post-1');
  assert.deepEqual(result.items[0].conceptLabels, ['Testing']);
  assert.deepEqual(calls, [
    ['beginSession', undefined],
    ['currentSessionItems', 'session-1'],
  ]);
  assert.doesNotMatch(source, /frozenFeedService\.getFeed\(\)/);
  assert.match(source, /recommendationService/);
});

test('per-recommendation impressions carry both IDs and dedupe within a session', async () => {
  const { recordRecommendationImpressions } = await loadHelpers();
  const items = [
    { recommendation: recommendation('rec-1', 'post-1') },
    { recommendation: recommendation('rec-2', 'post-2') },
  ];
  const seen = new Set();
  const events = [];
  const record = async (eventType, fields) => { events.push([eventType, fields]); };

  await recordRecommendationImpressions(items, seen, record);
  await recordRecommendationImpressions(items, seen, record);

  assert.deepEqual(events, [
    ['feed_impression', { postId: 'post-1', recommendationId: 'rec-1' }],
    ['feed_impression', { postId: 'post-2', recommendationId: 'rec-2' }],
  ]);
});

test('bottom pull appends the next persisted batch in order without graph-update reshuffling', async () => {
  const { loadRecommendationFeed } = await loadHelpers();
  const rec1 = recommendation('rec-1', 'post-1');
  const rec2 = recommendation('rec-2', 'post-2');
  const calls = [];
  const result = await loadRecommendationFeed({
    sessionId: 'session-1',
    append: true,
    recommendationService: {
      async beginSession() { throw new Error('not expected'); },
      async nextBatch(sessionId) {
        calls.push(['nextBatch', sessionId]);
        return { success: true, data: { sessionId, status: 'ready' } };
      },
      async currentSessionItems(sessionId) {
        calls.push(['currentSessionItems', sessionId]);
        return { success: true, data: [rec1, rec2] };
      },
    },
    frozenFeedService: {
      getPostById: (postId) => post(postId),
      getConcepts: () => [],
    },
  });

  assert.deepEqual(result.items.map((item) => item.recommendation.id), ['rec-1', 'rec-2']);
  assert.deepEqual(calls, [
    ['nextBatch', 'session-1'],
    ['currentSessionItems', 'session-1'],
  ]);
  assert.doesNotMatch(source, /subscribe\(['"]GRAPH_UPDATED/);
});

test('an empty ready recommendation batch is a ready empty feed, not an error', async () => {
  const { loadRecommendationFeed } = await loadHelpers();
  const result = await loadRecommendationFeed({
    sessionId: null,
    append: false,
    recommendationService: {
      async beginSession() {
        return { success: true, data: { sessionId: 'session-empty', status: 'ready' } };
      },
      async nextBatch() { throw new Error('not expected'); },
      async currentSessionItems() { return { success: true, data: [] }; },
    },
    frozenFeedService: {
      getPostById: () => null,
      getConcepts: () => [],
    },
  });

  assert.equal(result.sessionId, 'session-empty');
  assert.deepEqual(result.items, []);
});

test('WKWebView direction slop still precedes preventDefault', () => {
  const slop = source.indexOf('if (dy < DIRECTION_SLOP)');
  const claim = source.indexOf('claimed = true', slop);
  const prevent = source.indexOf('event.preventDefault()', claim);
  assert.ok(slop >= 0 && claim > slop && prevent > claim);
});
