// Phase 50 Plan 50-05 — post-history.purgeExpired collection-aware retention.
//
// Covers RETRIEVE-02 / CONTEXT D-09 retention semantics. A post added to a
// collection MUST survive purgeExpired() even if its generatedAt is older
// than the retentionDays cutoff. Achieved indirectly: purgeExpired() reads
// engagementService.getPinnedIds(), which 50-05 extended to union
// collectionService.getAllMemberPostIds(). The purge-side call site is
// UNCHANGED — the behavior shift is entirely internal to engagementService.
//
// Turned GREEN by plan 50-05 (this file replaces the Wave 0 RED scaffold).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill — matches post-history.test.mjs (lines 5-11).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const SETTINGS_KEY = 'trellis_settings';

function setRetentionDays(days) {
  const settings = {
    feed: { postRetentionDays: days, dailyGenerationCapMultiplier: 5, bonusPostCap: 2 },
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Minimal DailyPost stub — copies post-history.test.mjs makePost (lines 27-46).
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
const { collectionService } = await import('../../src/services/collection.service.ts');
const { engagementService } = await import('../../src/services/engagement.service.ts');

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

describe('postHistoryService.purgeExpired — collection pinning (D-09)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Phase 55-07: post-history / collections / engagement are in-memory mirrors
    // (IndexedDB-backed) — reset them explicitly (localStorage clear no longer does).
    postHistoryService.clear();
    collectionService.reset();
    engagementService.reset();
    setRetentionDays(7);
  });

  // Positive control — Test 1
  it('a post added to a collection survives purgeExpired() when older than retentionDays', () => {
    const oldDate = Date.now() - EIGHT_DAYS_MS; // 8 days ago, beyond 7-day cutoff
    postHistoryService.addPost(makePost('p1', { generatedAt: oldDate }));

    const created = collectionService.createCollection('For thesis');
    assert.equal(created.success, true);
    collectionService.addPost(created.data.id, 'p1');

    postHistoryService.purgeExpired();

    const remaining = postHistoryService.getPosts();
    assert.equal(remaining.length, 1, 'collection-pinned old post must survive purge');
    assert.equal(remaining[0].id, 'p1');
  });

  // Negative control — Test 2 (regression guard against "pin everything")
  it('a post NOT in any collection AND NOT saved/liked is purged when older than retentionDays', () => {
    const oldDate = Date.now() - EIGHT_DAYS_MS;
    postHistoryService.addPost(makePost('p2', { generatedAt: oldDate }));

    // No save, no like, no collection.
    postHistoryService.purgeExpired();

    const remaining = postHistoryService.getPosts();
    assert.equal(remaining.length, 0, 'unpinned old post must be purged');
  });

  // Test 3 — backward-compat (saved/liked union still pins when no collections exist)
  it('zero-collection backward-compat: saved post survives purge even when no collections exist', () => {
    const oldDate = Date.now() - EIGHT_DAYS_MS;
    postHistoryService.addPost(makePost('p3', { generatedAt: oldDate }));
    postHistoryService.addPost(makePost('p4', { generatedAt: oldDate }));

    engagementService.savePost('p3'); // pin via legacy save bucket only
    // No collections created.

    postHistoryService.purgeExpired();

    const remaining = postHistoryService.getPosts();
    const ids = remaining.map(p => p.id).sort();
    assert.deepEqual(ids, ['p3'], 'saved post must survive; unpinned must be purged (legacy union still works)');
  });

  it('liked post still survives purge (legacy union preserved)', () => {
    const oldDate = Date.now() - EIGHT_DAYS_MS;
    postHistoryService.addPost(makePost('p5', { generatedAt: oldDate }));
    engagementService.likePost('p5');

    postHistoryService.purgeExpired();

    const remaining = postHistoryService.getPosts();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 'p5');
  });

  it('a post in a collection AND saved (overlap) survives purge with no double-count drama', () => {
    const oldDate = Date.now() - EIGHT_DAYS_MS;
    postHistoryService.addPost(makePost('p6', { generatedAt: oldDate }));

    const created = collectionService.createCollection('Overlap');
    collectionService.addPost(created.data.id, 'p6');
    engagementService.savePost('p6');

    postHistoryService.purgeExpired();

    const remaining = postHistoryService.getPosts();
    assert.equal(remaining.length, 1, 'overlap-pinned post must survive');
    assert.equal(remaining[0].id, 'p6');
  });

  it('purgeExpired call site in post-history.service.ts is UNCHANGED — single getPinnedIds() call', async () => {
    // Source-reading guard: the call site at engagementService.getPinnedIds()
    // in post-history.service.ts must remain a single CODE call (not per-post).
    // The pin-set extension is entirely internal to engagementService. We strip
    // comment lines before counting so the explanatory JSDoc above the call
    // does not double-count.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve('src/services/post-history.service.ts'),
      'utf8',
    );
    const codeOnly = src
      .split('\n')
      .filter(line => !line.trimStart().startsWith('//'))
      .join('\n');
    const matches = codeOnly.match(/engagementService\.getPinnedIds\(\)/g) ?? [];
    assert.equal(
      matches.length,
      1,
      `post-history.service.ts must call engagementService.getPinnedIds() exactly once in code; found ${matches.length} call(s) — purge-side must remain unchanged after 50-05`,
    );
  });

  it('one-way import direction: collection.service.ts does NOT import engagementService (circular dep guard)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve('src/services/collection.service.ts'),
      'utf8',
    );
    // Match ONLY import statements (skip comments mentioning engagementService).
    const importMatches = src.match(/^import[\s\S]*?from\s+['"][^'"]*engagement\.service[^'"]*['"]/gm) ?? [];
    assert.equal(
      importMatches.length,
      0,
      'collection.service.ts must NOT import engagement.service.ts — would create circular dep',
    );
  });
});
