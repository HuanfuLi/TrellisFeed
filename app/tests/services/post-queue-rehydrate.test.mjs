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

const STORAGE_KEY = 'echolearn_post_queue';
const STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday';

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

describe('postQueueService — Phase 36-11 rehydration on date mismatch', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  // Test 1 — load() rehydrates _state.posts (and derivedList + cyclePosition)
  it('load() rehydrates _state.posts, derivedList, and cyclePosition from yesterday', () => {
    const yesterday = dateOffset(-1);
    const stalePayload = {
      date: yesterday,
      posts: [
        makePost('y1'),
        makePost('y2'),
        makePost('y3'),
        makePost('y4'),
        makePost('y5'),
      ],
      cycleNumber: 2,
      totalGenerated: 50,
      totalServed: 30,
      derivedList: ['anchor-a', 'anchor-b', 'anchor-c'],
      cyclePosition: 3,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    postQueueService.loadQueue();

    assert.equal(postQueueService.size(), 5, 'all 5 yesterday posts should rehydrate');
    assert.equal(postQueueService.getDerivedList().length, 3, 'derivedList should rehydrate');
    assert.equal(postQueueService.getCyclePosition(), 3, 'cyclePosition should rehydrate');
  });

  // Test 2 — counters reset to 0 even when parsed payload had non-zero values
  it('counters (totalGenerated, totalServed) reset to 0 on rehydrate', () => {
    const yesterday = dateOffset(-1);
    const stalePayload = {
      date: yesterday,
      posts: [makePost('y1'), makePost('y2')],
      cycleNumber: 1,
      totalGenerated: 100,
      totalServed: 80,
      derivedList: [],
      cyclePosition: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    postQueueService.loadQueue();

    assert.equal(postQueueService.getTotalGenerated(), 0, 'totalGenerated must reset to 0');
    assert.equal(postQueueService.getTotalServed(), 0, 'totalServed must reset to 0');
    assert.equal(postQueueService.getCycleNumber(), 1, 'cycleNumber inherits for continuity');
  });

  // Test 3 — STORAGE_KEY_YESTERDAY is still written (Plan 36-09 contract preserved)
  it('STORAGE_KEY_YESTERDAY snapshot is still written (Plan 36-09 contract preserved)', () => {
    const yesterday = dateOffset(-1);
    const stalePayload = {
      date: yesterday,
      posts: [
        makePost('y1'),
        makePost('y2'),
        makePost('y3'),
        makePost('y4'),
        makePost('y5'),
      ],
      cycleNumber: 0,
      totalGenerated: 0,
      totalServed: 0,
      derivedList: [],
      cyclePosition: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    postQueueService.loadQueue();

    const snapRaw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    assert.ok(snapRaw, 'STORAGE_KEY_YESTERDAY must still be populated after rehydrate');
    const snap = JSON.parse(snapRaw);
    assert.equal(snap.date, yesterday, 'snapshot date matches the prior payload date');
    assert.equal(snap.posts.length, 5, 'snapshot preserves all 5 yesterday posts');
  });

  // Test 4 — empty parsed.posts → no rehydrate, no snapshot
  it('empty parsed.posts → no rehydrate, no snapshot', () => {
    const yesterday = dateOffset(-1);
    const stalePayload = {
      date: yesterday,
      posts: [],
      cycleNumber: 0,
      totalGenerated: 0,
      totalServed: 0,
      derivedList: [],
      cyclePosition: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    postQueueService.loadQueue();

    assert.equal(postQueueService.size(), 0, 'empty parsed.posts → empty rehydrated queue');
    const snapRaw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    assert.equal(snapRaw, null, 'no snapshot for empty payloads (skip-empty guard)');
  });

  // Test 5 — re-interleave applied: rehydrated posts are style-mixed
  it('rehydrated posts have spreadByStyle ordering — no adjacent same-style for balanced histograms', () => {
    // Input has runs of same style: [video×4, news×4]. Without re-interleave
    // the rehydrated queue would render in this order; with spreadByStyle the
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
    const stalePayload = {
      date: yesterday,
      posts,
      cycleNumber: 0,
      totalGenerated: 0,
      totalServed: 0,
      derivedList: [],
      cyclePosition: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    postQueueService.loadQueue();

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
