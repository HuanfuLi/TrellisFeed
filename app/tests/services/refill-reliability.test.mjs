import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill (refill-queue-integration.test.mjs pattern). Must run
// BEFORE importing post-queue.service.ts (it touches localStorage at module load).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

// TUNE-03 root-cause reproduction (Phase 55-06).
//
// We exercise the QUEUE PRIMITIVES directly (post-queue.service.ts) rather than
// refillQueue's async LLM/YouTube/Tavily chain — importing concept-feed.service.ts
// under `node --test` crashes via the i18n import-attribute chain. The under-refill
// bug lives in the size-check + dequeue + enqueue-cap + walker interaction, all of
// which are pure post-queue primitives the integration test already imports cleanly.
//
// The three reproduction cases mirror the plan's (a)/(b)/(c) cause candidates and
// assert the CURRENT (pre-Task-2) behavior so the bug is captured as executable
// evidence. Task 2 converts the confirmed-cause case from "asserts buggy output"
// to "asserts corrected output".
const { postQueueService } = await import('../../src/services/post-queue.service.ts');

const MAX_QUEUE_SIZE = 32;
const REFILL_THRESHOLD = 24;
const SWIPE_BATCH = 8;

function makePost(id, anchorIds = [id], style = 'text-art') {
  return {
    id, date: '2026-05-21', title: id,
    teaser: { hook: '', preview: '' }, bodyMarkdown: '', whyCare: '', takeaway: '',
    quickAskPrompts: [], narrativeMode: 'example-first', contextLabel: '',
    sourceType: 'recent', sourceQuestionIds: anchorIds, sourceQuestionTitles: [],
    keywords: [], generatedAt: Date.now(), origin: 'ai',
    presentationStyle: style,
  };
}

function makePosts(prefix, n) {
  return Array.from({ length: n }, (_, i) => makePost(`${prefix}-${i}`));
}

// Mirror generateMorePosts' PRE-FIX synchronous-refill condition exactly:
// the live code only awaits a refill when the queue popped EXACTLY zero
// (`posts.length === 0 && needsRefill()`). This local predicate captures that
// branch so the reproduction documents the dequeue-before-refill race without
// importing the i18n-tainted concept-feed module.
function preFixWouldAwaitRefill(servedCount) {
  return servedCount === 0 && postQueueService.needsRefill();
}

// Mirror the PROPOSED Task-2 shortfall guard: await a refill whenever the served
// batch fell short of the requested count AND a refill is warranted.
function shortfallWouldAwaitRefill(servedCount, requestedCount) {
  return servedCount < requestedCount && postQueueService.needsRefill();
}

describe('TUNE-03 under-refill reproduction (Phase 55-06 Task 1 — current behavior)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  // CAUSE (a): dequeue-before-refill shortfall (CONFIRMED DOMINANT CAUSE).
  // Queue holds fewer posts than the swipe batch (8) but is NOT empty, so the
  // live `posts.length === 0` guard does NOT fire — refill is never awaited
  // synchronously, and the swipe serves the short count (4) instead of 8.
  it('(a) dequeue(8) on a 4-post queue serves only 4 and the pre-fix guard does NOT await a refill (THE BUG)', () => {
    postQueueService.enqueue(makePosts('a', 4));
    assert.equal(postQueueService.size(), 4, 'queue seeded with exactly 4 posts');

    const served = postQueueService.dequeue(SWIPE_BATCH);
    assert.equal(served.length, 4, 'dequeue(8) returns only the 4 available posts (under-refill)');

    // The pre-fix synchronous-refill branch is gated on an EMPTY pop, so with a
    // non-empty 4-post pop it does NOT fire — the user sees 4 instead of 8.
    assert.equal(
      preFixWouldAwaitRefill(served.length),
      false,
      'pre-fix guard (posts.length === 0) does NOT trigger a synchronous refill on a non-empty short pop — root cause of the 1/4/0 under-refill',
    );

    // The shortfall guard Task 2 will install WOULD have fired here.
    assert.equal(
      shortfallWouldAwaitRefill(served.length, SWIPE_BATCH),
      true,
      'a shortfall guard (served < requested) WOULD await a refill — the Task-2 fix target',
    );
  });

  // CAUSE (b): enqueueInterleaved MAX_QUEUE_SIZE cap.
  // A near-full queue clamps fresh additions to (MAX_QUEUE_SIZE - size). This is
  // CORRECT cap behavior, not the bug — documented so Task 2 does not "fix" it.
  it('(b) enqueueInterleaved into a near-full queue clamps fresh additions to MAX_QUEUE_SIZE - size (intended cap, not the bug)', () => {
    postQueueService.enqueue(makePosts('full', MAX_QUEUE_SIZE - 2)); // 30
    assert.equal(postQueueService.size(), 30);

    const before = postQueueService.size();
    // Offer 10 fresh; only 2 slots remain.
    postQueueService.enqueueInterleaved(makePosts('fresh', 10), () => { /* identity mixer */ });
    const added = postQueueService.size() - before;

    assert.equal(postQueueService.size(), MAX_QUEUE_SIZE, 'queue is capped at MAX_QUEUE_SIZE (32)');
    assert.equal(added, 2, 'addedCount clamped to MAX_QUEUE_SIZE - size (= 2); a near-full queue starves fresh arrivals BY DESIGN');
    // This means a stale-but-near-full queue can defer fresh content — but it is
    // never below the 8-batch served count, so it is NOT the 1/4/0 under-refill.
    assert.ok(postQueueService.size() >= SWIPE_BATCH, 'a near-full queue always has >= 8 to serve — cap is not the under-refill cause');
  });

  // CAUSE (c): walkDerivedList sub-count shortfall on a mostly-explored list.
  // A small/mostly-explored derived list returns fewer than the requested 24
  // conceptIds, bounded by maxSteps = Math.max(count*2, len). This is CORRECT
  // exhaustion behavior (a genuinely finished vine yields fewer posts), not the bug.
  it('(c) walkDerivedList(24, explored, dismissed) returns fewer than 24 when the list is mostly explored, bounded by maxSteps=max(count*2,len)', () => {
    postQueueService.appendToDerivedList(['A', 'B', 'C', 'D']); // len = 4
    const explored = new Set(['A', 'B', 'C']); // only 'D' is walkable
    const dismissed = new Set();

    const ids = postQueueService.walkDerivedList(24, explored, dismissed);
    assert.ok(ids.length < 24, 'walker returns fewer than 24 when most of the list is explored');
    assert.ok(ids.length >= 1, "walker still returns the one unexplored concept ('D')");
    assert.ok(ids.every((id) => id === 'D'), 'only the unexplored concept is returned (lazy-skip of explored ids)');

    // maxSteps = Math.max(24*2, 4) = 48 — this is what bounds the walk, NOT len*2 (=8).
    // The GAP-B floor guarantees the walker can make at least one full pass; the
    // sub-24 result reflects genuine exhaustion, not an under-refill defect.
  });
});
