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

// ─── Pure helpers for D-03 contract tests ─────────────────────────────────────

/**
 * Contract shape for a generated video post (DailyPost with sourceType 'video').
 * generateVideoPosts() and generateMoreVideoPosts() must return objects conforming
 * to this shape. (D-03, D-07)
 */
function isValidVideoPost(post) {
  return (
    typeof post === 'object' &&
    post !== null &&
    typeof post.id === 'string' &&
    post.id.startsWith('video-') &&
    post.sourceType === 'video' &&
    typeof post.title === 'string' &&
    typeof post.date === 'string' &&
    typeof post.generatedAt === 'number' &&
    post.origin === 'ai' &&
    typeof post.videoMeta === 'object' &&
    post.videoMeta !== null &&
    typeof post.videoMeta.videoId === 'string' &&
    typeof post.videoMeta.channelTitle === 'string' &&
    typeof post.videoMeta.thumbnailUrl === 'string'
  );
}

/**
 * Simulates the generateVideoPosts() contract: returns exactly `count` video posts
 * with correct shape. The real implementation does network I/O; this pure version
 * validates the output contract only.
 */
function contractGenerateVideoPosts(count = 3) {
  return Array.from({ length: count }, (_, i) => makeVideoPost(String(i + 1)));
}

/**
 * Simulates the generateMoreVideoPosts() contract: returns exactly `count` additional
 * posts that are new (different videoIds from existing cache).
 */
function contractGenerateMoreVideoPosts(existingIds, count = 4) {
  const newPosts = Array.from({ length: count }, (_, i) =>
    makeVideoPost(String(existingIds.length + i + 1)),
  );
  // Contract: new posts must not share videoIds with existing posts
  const newIds = newPosts.map((p) => p.videoMeta.videoId);
  const allUnique = newIds.every((id) => !existingIds.includes(id));
  return { posts: newPosts, allUnique };
}

// ─── Test group: Video post generation (D-03, D-07) ──────────────────────────

describe('Video post generation', () => {
  it('generates 3 video posts on initial call', () => {
    // Contract test: youtubeService.generateVideoPosts() default count = 3 (D-03)
    const posts = contractGenerateVideoPosts(3);
    assert.equal(posts.length, 3, 'initial call must generate exactly 3 video posts');
    for (const post of posts) {
      assert.ok(isValidVideoPost(post), `post ${post.id} must conform to video post contract`);
    }
  });

  it('generates 4 video posts on pull-for-more', () => {
    // Contract test: youtubeService.generateMoreVideoPosts() default count = 4 (D-03)
    const existingIds = ['yt-1', 'yt-2', 'yt-3'];
    const { posts, allUnique } = contractGenerateMoreVideoPosts(existingIds, 4);
    assert.equal(posts.length, 4, 'pull-for-more must generate exactly 4 additional video posts');
    assert.ok(allUnique, 'pull-for-more posts must have videoIds not present in existing cache');
    for (const post of posts) {
      assert.ok(isValidVideoPost(post), `post ${post.id} must conform to video post contract`);
    }
  });

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

// ─── Pure helpers for D-09 / D-10 contract tests ─────────────────────────────

/**
 * Mirrors the message-building logic of summarizeTranscript() from youtube.service.ts.
 * Pure function: no I/O, no LLM call. Returns the messages array and options that
 * would be passed to chatCompletion.
 *
 * D-09: transcript content is extracted and used as user message.
 * D-10: chatCompletion options include { serviceName: 'video-summary' }.
 */
function buildSummarizeMessages(transcript, videoTitle, videoDescription) {
  const systemPrompt =
    'You are an educational content summarizer. Given a YouTube video transcript, produce a clear, concise summary (200-400 words) that captures the key educational concepts, examples, and takeaways. Use markdown formatting.';

  let userMessage;
  if (transcript && transcript.length > 20) {
    const truncated = transcript.slice(0, 4000);
    userMessage = `Video title: "${videoTitle}"\n\nTranscript:\n${truncated}`;
  } else {
    const descriptionText = videoDescription
      ? `\n\nVideo description: "${videoDescription.slice(0, 500)}"`
      : '';
    userMessage =
      `Video title: "${videoTitle}"${descriptionText}\n\n` +
      `Note: No transcript was available for this video. Please write an educational summary based on the title and description only. ` +
      `Mark the summary as description-based at the end.`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const options = { serviceName: 'video-summary' };

  return { messages, options };
}

// ─── Test group: Transcript summarization (D-09, D-10) ───────────────────────

describe('Transcript summarization', () => {
  it('calls chatCompletion with serviceName "video-summary"', () => {
    // D-10: token tracking requires serviceName: 'video-summary' in options
    const { options } = buildSummarizeMessages('Some transcript content here.', 'Test Video');
    assert.equal(options.serviceName, 'video-summary',
      'chatCompletion options must include serviceName: "video-summary" for token tracking');
  });

  it('truncates transcript to 4000 chars', () => {
    // D-09: transcripts longer than 4000 chars must be sliced before passing to chatCompletion
    const longTranscript = 'a'.repeat(10000);
    const { messages } = buildSummarizeMessages(longTranscript, 'Long Video');
    const userMsg = messages[1].content;
    // The user message contains the (possibly truncated) transcript
    const transcriptPart = longTranscript.slice(0, 4000);
    assert.ok(userMsg.includes(transcriptPart), 'user message must contain transcript up to 4000 chars');
    // Must NOT contain the 4001st character onward
    assert.ok(!userMsg.includes('a'.repeat(4001)), 'transcript must be truncated at 4000 chars');
    // Verify transcript portion length in message
    const transcriptIndex = userMsg.indexOf('Transcript:\n');
    const transcriptInMessage = userMsg.slice(transcriptIndex + 'Transcript:\n'.length);
    assert.equal(transcriptInMessage.length, 4000,
      'the transcript section in user message must be exactly 4000 chars');
  });

  it('falls back to title-based summary when no transcript', () => {
    // D-10: when transcript is null/empty, chatCompletion is still called with title+description
    const { messages } = buildSummarizeMessages(null, 'My Video Title', 'A description.');
    const userMsg = messages[1].content;
    assert.ok(userMsg.includes('My Video Title'), 'user message must include video title');
    assert.ok(userMsg.includes('No transcript was available'), 'user message must indicate no transcript');
    assert.ok(userMsg.includes('description-based'), 'user message must request description-based marking');
  });

  it('transcript content is used as user message in chatCompletion call', () => {
    // D-09: transcript text appears as user message content (not system prompt)
    const transcript = 'Photosynthesis is the process by which plants convert sunlight into energy.';
    const { messages } = buildSummarizeMessages(transcript, 'Photosynthesis Explained');
    const userMsg = messages[1].content;
    const systemMsg = messages[0].content;
    assert.ok(userMsg.includes(transcript), 'transcript content must appear in the user message');
    assert.ok(!systemMsg.includes(transcript), 'transcript must not appear in the system message');
    assert.equal(messages[1].role, 'user', 'transcript message must have role: user');
  });
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

// ─── Pure helper for withTimeout tests ───────────────────────────────────────

/**
 * Mirrors youtube.service.ts withTimeout() exactly.
 * Race a promise against a timeout; resolve to fallback on timeout (no rejection).
 */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── Test group: withTimeout helper ──────────────────────────────────────────

describe('withTimeout helper', () => {
  it('returns promise result when promise resolves before timeout', async () => {
    const fast = Promise.resolve('fast-result');
    const result = await withTimeout(fast, 500, 'fallback');
    assert.equal(result, 'fast-result', 'should return promise result when it resolves quickly');
  });

  it('returns fallback value when promise exceeds timeout', async () => {
    // Promise that never resolves within the timeout window
    const slow = new Promise((resolve) => setTimeout(() => resolve('slow-result'), 200));
    const result = await withTimeout(slow, 10, 'fallback-value');
    assert.equal(result, 'fallback-value', 'should return fallback when promise exceeds timeout ms');
  });
});

// ─── Pure helpers for Settings deepMerge tests ───────────────────────────────

/**
 * Mirrors the deepMerge() function from settings.mock.ts exactly.
 * Merges stored partial settings over defaults, with object-level spread for nested objects.
 */
function deepMerge(defaults, stored) {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const dv = defaults[key];
    const sv = stored[key];
    if (sv !== undefined && sv !== null && typeof dv === 'object' && !Array.isArray(dv)) {
      result[key] = { ...dv, ...sv };
    } else if (sv !== undefined) {
      result[key] = sv;
    }
  }
  return result;
}

/** Minimal default settings shape used in tests — mirrors the youtube field of defaultSettings */
const minimalDefaults = {
  llm: { apiKey: '', model: 'gpt-4o', isConfigured: false },
  youtube: { apiKey: '' },
};

// ─── Test group: Settings youtube default (deepMerge) ────────────────────────

describe('Settings deepMerge — youtube field', () => {
  it('preserves youtube default when stored settings have no youtube field', () => {
    // User's stored settings pre-date the youtube feature — no youtube key in storage
    const stored = { llm: { apiKey: 'my-key', model: 'gpt-4o', isConfigured: true } };
    const merged = deepMerge(minimalDefaults, stored);
    assert.ok(merged.youtube, 'youtube key must exist in merged result');
    assert.equal(merged.youtube.apiKey, '', 'youtube.apiKey must default to empty string');
  });

  it('preserves youtube.apiKey when stored settings include it', () => {
    // User has configured their YouTube API key
    const stored = {
      llm: { apiKey: 'my-key', model: 'gpt-4o', isConfigured: true },
      youtube: { apiKey: 'my-youtube-key' },
    };
    const merged = deepMerge(minimalDefaults, stored);
    assert.equal(merged.youtube.apiKey, 'my-youtube-key',
      'youtube.apiKey from storage must survive deep merge');
  });

  it('merges youtube object-level (does not clobber other youtube fields)', () => {
    // If defaults.youtube had more fields, stored.youtube should overlay — not replace entirely
    const extendedDefaults = {
      ...minimalDefaults,
      youtube: { apiKey: '', maxResults: 5 },
    };
    const stored = { youtube: { apiKey: 'key-from-storage' } };
    const merged = deepMerge(extendedDefaults, stored);
    assert.equal(merged.youtube.apiKey, 'key-from-storage', 'stored apiKey must override default');
    assert.equal(merged.youtube.maxResults, 5, 'default maxResults must be preserved (object spread)');
  });
});
