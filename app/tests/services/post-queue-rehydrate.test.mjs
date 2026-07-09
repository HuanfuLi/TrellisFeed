// Phase 36-11 — load() rehydrates _state.posts from yesterday's snapshot
// payload AND re-interleaves via spreadByConcept + spreadByStyle.
//
// Validates the round-3 sub-issue (b#1) + (c) closures:
//   (b#1) Yesterday's UNSERVED queue auto-populates today's _state.posts on
//         date-mismatch load — no manual swipe needed, no LLM-pipeline wait.
//   (c)   The rehydrated cold-start window is style-balanced (yesterday's
//         leftover skews toward minority styles since text-art is plurality
//         and gets popped first; without re-interleave the cold-start would
//         render as video → news → video → news).
//
// Plan 36-09's STORAGE_KEY_YESTERDAY snapshot contract is preserved
// (verified by Test 3): the snapshot is still written BEFORE rehydration so
// getYesterdayQueue() continues to function as a separate read path.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill — must run BEFORE the dynamic import below.
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

// Phase 55-07: queue + yesterday snapshot are in-memory + IndexedDB (not
// localStorage). Tests build yesterday's state via the public API then roll the
// in-memory date back to trigger normalizeState's rehydration + snapshot.

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateOffset(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// makePost factory — `style` is the presentationStyle the spread tests need;
// `concept` is sourceQuestionIds[0] for spreadByConcept's key extractor.
function makePost(id, { style, concept } = {}) {
  return {
    id,
    date: todayStr(),
    title: `Post ${id}`,
    teaser: { hook: '', preview: '' },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'example-first',
    contextLabel: '',
    sourceType: 'recent',
    sourceQuestionIds: concept ? [concept] : [],
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
    ...(style ? { presentationStyle: style } : {}),
  };
}

const { postQueueService } = await import('../../src/services/post-queue.service.ts');

// Build yesterday's queue state via the public API, then roll the in-memory
// queue date back to `dateStr` and run loadQueue() to trigger normalizeState's
// date-mismatch rehydration + yesterday snapshot.
function seedAndRollover(posts, dateStr, { derivedList = [], cyclePosition = 0, cycleNumber = 0 } = {}) {
  postQueueService.enqueue(posts);
  if (derivedList.length) postQueueService.appendToDerivedList(derivedList);
  // Advance cyclePosition by walking that many steps over the derived list.
  for (let i = 0; i < cyclePosition; i++) postQueueService.walkDerivedList(1, new Set(), new Set());
  for (let i = 0; i < cycleNumber; i++) postQueueService.incrementCycle();
  postQueueService.simulateDateRollback(dateStr);
  postQueueService.loadQueue();
}

describe('postQueueService — Phase 36-11 rehydration on date mismatch', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.resetAll();
  });

  // Test 1 — rehydrates _state.posts (and derivedList + cyclePosition)
  it('rehydrates _state.posts, derivedList, and cyclePosition from yesterday', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover(
      [makePost('y1'), makePost('y2'), makePost('y3'), makePost('y4'), makePost('y5')],
      yesterday,
      // 5-anchor derived list + walk 3 → cyclePosition lands on 3 (no wrap).
      { derivedList: ['anchor-a', 'anchor-b', 'anchor-c', 'anchor-d', 'anchor-e'], cyclePosition: 3, cycleNumber: 2 },
    );

    assert.equal(postQueueService.size(), 5, 'all 5 yesterday posts should rehydrate');
    assert.equal(postQueueService.getDerivedList().length, 5, 'derivedList should rehydrate');
    assert.equal(postQueueService.getCyclePosition(), 3, 'cyclePosition should rehydrate');
  });

  // Test 2 — counters reset to 0 even when prior state had non-zero values
  it('counters (totalGenerated, totalServed) reset to 0 on rehydrate', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover([makePost('y1'), makePost('y2')], yesterday, { cycleNumber: 1 });

    assert.equal(postQueueService.getTotalGenerated(), 0, 'totalGenerated must reset to 0');
    assert.equal(postQueueService.getTotalServed(), 0, 'totalServed must reset to 0');
    assert.equal(postQueueService.getCycleNumber(), 1, 'cycleNumber inherits for continuity');
  });

  // Test 3 — durable yesterday snapshot is still written (Plan 36-09 contract preserved)
  it('yesterday snapshot is still written (Plan 36-09 contract preserved)', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover(
      [makePost('y1'), makePost('y2'), makePost('y3'), makePost('y4'), makePost('y5')],
      yesterday,
    );

    const snap = postQueueService.getYesterdayQueue();
    assert.equal(snap.length, 5, 'snapshot preserves all 5 yesterday posts');
  });

  // Test 4 — empty posts → no rehydrate, no snapshot
  it('empty prior posts → no rehydrate, no snapshot', () => {
    const yesterday = dateOffset(-1);
    // Roll back with only a derivedList (no posts) so simulateDateRollback fires.
    postQueueService.appendToDerivedList(['anchor-x']);
    postQueueService.simulateDateRollback(yesterday);
    postQueueService.loadQueue();

    assert.equal(postQueueService.size(), 0, 'empty prior posts → empty rehydrated queue');
    assert.deepEqual(postQueueService.getYesterdayQueue(), [], 'no snapshot for empty payloads (skip-empty guard)');
  });

  // Test 5 — re-interleave applied: rehydrated posts are style-mixed
  it('rehydrated posts have spreadByStyle ordering — no adjacent same-style for balanced histograms', () => {
    // Input has runs of same style: [video×4, news×4]. With spreadByStyle the
    // histogram is preserved (4 video + 4 news) and the contract's
    // "no adjacent same style when each count ≤ N/2" property holds.
    const yesterday = dateOffset(-1);
    const posts = [
      makePost('v1', { style: 'video', concept: 'anchor-a' }),
      makePost('v2', { style: 'video', concept: 'anchor-b' }),
      makePost('v3', { style: 'video', concept: 'anchor-c' }),
      makePost('v4', { style: 'video', concept: 'anchor-d' }),
      makePost('n1', { style: 'news', concept: 'anchor-e' }),
      makePost('n2', { style: 'news', concept: 'anchor-f' }),
      makePost('n3', { style: 'news', concept: 'anchor-g' }),
      makePost('n4', { style: 'news', concept: 'anchor-h' }),
    ];
    seedAndRollover(posts, yesterday);

    const queue = postQueueService.getQueue();
    // (a) all 8 posts rehydrate (no drops from the spread mixers)
    assert.equal(queue.length, 8, 'all 8 posts rehydrate (no mixer drops)');
    // (b) histogram preserved
    const videoCount = queue.filter((p) => p.presentationStyle === 'video').length;
    const newsCount = queue.filter((p) => p.presentationStyle === 'news').length;
    assert.equal(videoCount, 4, 'video count preserved');
    assert.equal(newsCount, 4, 'news count preserved');
    // (c) no two adjacent posts share the same style — spreadByStyle's
    // contract for N posts where each style count ≤ N/2.
    for (let i = 1; i < queue.length; i++) {
      assert.notEqual(
        queue[i].presentationStyle,
        queue[i - 1].presentationStyle,
        `posts at index ${i - 1} and ${i} both have style ${queue[i].presentationStyle} — spread failed`,
      );
    }
  });
});
