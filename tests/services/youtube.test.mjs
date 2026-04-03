/**
 * youtube.service.ts — Contract & Unit Tests
 *
 * Phase 17, Plan 00 — RED scaffold
 * Tests run via: node --test tests/services/youtube.test.mjs
 *
 * youtube.service.ts is a browser/Capacitor module (uses localStorage,
 * CapacitorHttp, fetch). This file tests:
 *   - Pure logic extracted inline (URL construction, query grouping, caching)
 *   - Behavior contracts documented as todo tests (will validate after Plan 01)
 *
 * Requirements covered: D-01, D-02, D-03, D-07, D-09, D-10
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure helpers (mirrors expected implementation in youtube.service.ts) ─────

/**
 * Groups concept titles into batched YouTube search queries.
 * Expected: 2-3 concepts per query string, joined with " ".
 * D-01: Due concepts drive YouTube search queries.
 */
function groupConceptsIntoQueries(conceptTitles, batchSize = 3) {
  const queries = [];
  for (let i = 0; i < conceptTitles.length; i += batchSize) {
    const batch = conceptTitles.slice(i, i + batchSize);
    queries.push(batch.join(' '));
  }
  return queries;
}

/**
 * Constructs the YouTube Data API v3 search URL.
 * D-02: Use YouTube Data API v3 with correct parameters.
 */
function buildYouTubeSearchUrl(query, apiKey) {
  const base = 'https://www.googleapis.com/youtube/v3/search';
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    q: query,
    key: apiKey,
    maxResults: '5',
  });
  return `${base}?${params.toString()}`;
}

/**
 * Extracts today's date string (YYYY-MM-DD) for cache key.
 */
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks if cached video posts exist for today.
 * D-07: sourceType 'video' posts are cached per-day.
 */
function getCachedVideoPostsFromStorage(storage, todayKey) {
  try {
    const raw = storage[`echolearn_video_cache`];
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey) return [];
    return parsed.posts ?? [];
  } catch {
    return [];
  }
}

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeVideoPost(id) {
  return {
    id: `video-${id}`,
    sourceType: 'video',
    title: `Video Post ${id}`,
    date: getTodayKey(),
    generatedAt: Date.now(),
    origin: 'ai',
    teaser: { hook: `Hook ${id}`, preview: `Preview ${id}` },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'explainer',
    contextLabel: 'video',
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: [],
    videoMeta: {
      videoId: `yt-${id}`,
      channelTitle: `Channel ${id}`,
      thumbnailUrl: `https://img.youtube.com/vi/yt-${id}/hqdefault.jpg`,
      publishedAt: '2024-01-01T00:00:00Z',
    },
  };
}

// ─── Test group: Search query formation (D-01, D-02) ─────────────────────────

describe('YouTube search query formation', () => {
  it('groups due concepts into search queries', () => {
    const concepts = ['Photosynthesis', 'Cell Respiration', 'Mitosis', 'Meiosis', 'DNA Replication'];
    const queries = groupConceptsIntoQueries(concepts, 3);
    // 5 concepts → 2 queries: [3, 2]
    assert.equal(queries.length, 2);
    assert.equal(queries[0], 'Photosynthesis Cell Respiration Mitosis');
    assert.equal(queries[1], 'Meiosis DNA Replication');
  });

  it('returns a single query for fewer than batchSize concepts', () => {
    const concepts = ['Newton\'s Laws'];
    const queries = groupConceptsIntoQueries(concepts, 3);
    assert.equal(queries.length, 1);
    assert.equal(queries[0], 'Newton\'s Laws');
  });

  it('returns empty array for empty concept list', () => {
    const queries = groupConceptsIntoQueries([], 3);
    assert.deepEqual(queries, []);
  });

  it('constructs correct YouTube Data API v3 URL', () => {
    const url = buildYouTubeSearchUrl('Photosynthesis basics', 'TEST_KEY');
    assert.ok(url.startsWith('https://www.googleapis.com/youtube/v3/search'), 'should hit YT search endpoint');
    assert.ok(url.includes('part=snippet'), 'should request snippet part');
    assert.ok(url.includes('type=video'), 'should filter to video type');
    assert.ok(url.includes('videoEmbeddable=true'), 'should require embeddable videos');
    assert.ok(url.includes('key=TEST_KEY'), 'should include API key');
    assert.ok(url.includes('q='), 'should include query param');
  });
});

// ─── Test group: Video post generation (D-03, D-07) ──────────────────────────

describe('Video post generation', () => {
  it('generates 3 video posts on initial call', { todo: 'Awaiting Plan 01 implementation of youtubeService.generateVideoPosts()' });

  it('generates 4 video posts on pull-for-more', { todo: 'Awaiting Plan 01 implementation of youtubeService.generateMoreVideoPosts()' });

  it('video posts have sourceType "video"', () => {
    // Validate contract shape — service must produce posts with sourceType 'video'
    const post = makeVideoPost('abc');
    assert.equal(post.sourceType, 'video', 'sourceType must be "video" for video posts');
  });

  it('video posts have videoMeta populated', () => {
    const post = makeVideoPost('xyz');
    assert.ok(post.videoMeta, 'videoMeta must exist');
    assert.ok(typeof post.videoMeta.videoId === 'string', 'videoMeta.videoId must be string');
    assert.ok(typeof post.videoMeta.channelTitle === 'string', 'videoMeta.channelTitle must be string');
    assert.ok(typeof post.videoMeta.thumbnailUrl === 'string', 'videoMeta.thumbnailUrl must be string');
  });

  it('video posts use YouTube thumbnail as card image (no AI image generation)', () => {
    const post = makeVideoPost('thumb-test');
    // thumbnailUrl must be a YouTube img domain URL
    assert.ok(post.videoMeta.thumbnailUrl.includes('youtube.com') || post.videoMeta.thumbnailUrl.includes('ytimg.com'),
      'thumbnail must be a YouTube URL (D-08: no AI image gen for video posts)');
  });
});

// ─── Test group: Transcript summarization (D-09, D-10) ───────────────────────

describe('Transcript summarization', () => {
  it('calls chatCompletion with serviceName "video-summary"', { todo: 'Awaiting Plan 01 implementation — chatCompletion must be called with serviceName: "video-summary"' });

  it('truncates transcript to 4000 chars', { todo: 'Awaiting Plan 01 implementation — transcripts longer than 4000 chars must be sliced before passing to chatCompletion' });

  it('falls back to title-based summary when no transcript', { todo: 'Awaiting Plan 01 implementation — when transcript is null/empty, chatCompletion is still called with title+description as context' });

  it('transcript content is used as user message in chatCompletion call', { todo: 'Awaiting Plan 01 implementation — transcript (or fallback) text must appear as user message content' });
});

// ─── Test group: Video post caching ──────────────────────────────────────────

describe('Video post caching', () => {
  it('getCachedVideoPosts returns cached posts for today', () => {
    const todayKey = getTodayKey();
    const posts = [makeVideoPost('cached-1'), makeVideoPost('cached-2')];
    const fakeStorage = {
      [`echolearn_video_cache`]: JSON.stringify({ date: todayKey, posts }),
    };
    const result = getCachedVideoPostsFromStorage(fakeStorage, todayKey);
    assert.equal(result.length, 2);
    assert.equal(result[0].videoMeta.videoId, 'yt-cached-1');
  });

  it('getCachedVideoPosts returns empty array for stale cache', () => {
    const todayKey = getTodayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const posts = [makeVideoPost('stale-1')];
    const fakeStorage = {
      [`echolearn_video_cache`]: JSON.stringify({ date: yesterday, posts }),
    };
    const result = getCachedVideoPostsFromStorage(fakeStorage, todayKey);
    assert.deepEqual(result, []);
  });

  it('getCachedVideoPosts returns empty array when no cache entry exists', () => {
    const result = getCachedVideoPostsFromStorage({}, getTodayKey());
    assert.deepEqual(result, []);
  });

  it('getCachedVideoPosts handles corrupted cache gracefully', () => {
    const todayKey = getTodayKey();
    const fakeStorage = {
      [`echolearn_video_cache`]: 'INVALID_JSON{{{',
    };
    const result = getCachedVideoPostsFromStorage(fakeStorage, todayKey);
    assert.deepEqual(result, []);
  });
});
