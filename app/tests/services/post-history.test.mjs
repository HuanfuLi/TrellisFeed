import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

// Stub settingsService before importing post-history (it reads settings.feed)
// We need to mock the module that post-history imports.
// Since post-history imports settingsService from settings.service.ts,
// we pre-seed localStorage with settings that have feed config.
const SETTINGS_KEY = 'questiontrace_settings';

function setRetentionDays(days) {
  const settings = {
    feed: { postRetentionDays: days, dailyGenerationCapMultiplier: 5, bonusPostCap: 2 },
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Helper: create a minimal DailyPost stub
function makePost(id, overrides = {}) {
  return {
    id,
    date: new Date().toISOString().slice(0, 10),
    title: `Post ${id}`,
    teaser: { hook: '', preview: '' },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'example-first',
    contextLabel: '',
    sourceType: 'recent',
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
    ...overrides,
  };
}

const { postHistoryService } = await import('../../src/services/post-history.service.ts');

describe('postHistoryService', () => {
  beforeEach(() => {
    localStorage.clear();
    // Phase 55-07: post history is an in-memory mirror (IndexedDB-backed); the
    // localStorage clear no longer resets it. Use the service's own clear().
    postHistoryService.clear();
    // Default: 7-day retention (settings stay in localStorage — set after clear)
    setRetentionDays(7);
  });

  it('addPost stores a post, getPosts returns it', () => {
    const post = makePost('h1');
    postHistoryService.addPost(post);
    const posts = postHistoryService.getPosts();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, 'h1');
  });

  it('addPost with duplicate id does not create duplicates', () => {
    const post = makePost('dup');
    postHistoryService.addPost(post);
    postHistoryService.addPost(post);
    const posts = postHistoryService.getPosts();
    assert.equal(posts.length, 1);
  });

  it('purgeExpired removes posts older than 7 days', () => {
    const now = Date.now();
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    postHistoryService.addPost(makePost('old', { generatedAt: eightDaysAgo }));
    postHistoryService.addPost(makePost('recent', { generatedAt: twoDaysAgo }));
    assert.equal(postHistoryService.getPosts().length, 2);

    postHistoryService.purgeExpired();
    const remaining = postHistoryService.getPosts();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 'recent');
  });

  it('purgeExpired with keepAll (null retention) removes nothing', () => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    postHistoryService.addPost(makePost('ancient', { generatedAt: thirtyDaysAgo }));
    postHistoryService.addPost(makePost('fresh', { generatedAt: now }));

    // Set retention to null (keep all)
    setRetentionDays(null);

    postHistoryService.purgeExpired();
    assert.equal(postHistoryService.getPosts().length, 2);
  });

  it('getPostsByDay groups posts by date string, sorted desc within each day', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    postHistoryService.addPost(makePost('t1', { date: today, generatedAt: 100 }));
    postHistoryService.addPost(makePost('t2', { date: today, generatedAt: 200 }));
    postHistoryService.addPost(makePost('y1', { date: yesterday, generatedAt: 50 }));

    const grouped = postHistoryService.getPostsByDay();
    assert.ok(grouped instanceof Map);
    assert.equal(grouped.get(today)?.length, 2);
    assert.equal(grouped.get(yesterday)?.length, 1);
  });

  it('getPosts returns posts sorted by generatedAt desc', () => {
    postHistoryService.addPost(makePost('a', { generatedAt: 100 }));
    postHistoryService.addPost(makePost('b', { generatedAt: 300 }));
    postHistoryService.addPost(makePost('c', { generatedAt: 200 }));

    const posts = postHistoryService.getPosts();
    assert.equal(posts[0].id, 'b');
    assert.equal(posts[1].id, 'c');
    assert.equal(posts[2].id, 'a');
  });
});
