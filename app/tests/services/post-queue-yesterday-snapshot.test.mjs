// Phase 36 GAP-D Fix A (2026-05-07) — durable yesterday snapshot lifecycle.
//
// Validates that getYesterdayQueue() reads from STORAGE_KEY_YESTERDAY (the
// snapshot key written by load() on date mismatch) and is therefore durable
// across multiple cold-start mounts of a new day. Pre-fix, the function read
// from the SAME key as the live queue, so the very first save() of today's
// queue (in enqueue/markServed/etc.) destroyed yesterday's snapshot.
//
// See .planning/debug/cold-start-warm-start-fragile.md for the diagnosis and
// CLAUDE.md "Numeric defaults" for the durable-snapshot rationale.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node — must run BEFORE the dynamic import below
// because post-queue.service.ts has a module-level `let _state = load()` that
// reads localStorage on import.
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

// Phase 55-07: the queue + yesterday snapshot are in-memory mirrors persisted to
// IndexedDB (not localStorage). Tests drive the date-rollover through the public
// API — enqueue today's posts, then simulateDateRollback(yesterday) to roll the
// in-memory queue date back, then loadQueue() to run normalizeState (which fires
// the yesterday-snapshot + rehydration). Assertions read getYesterdayQueue() /
// getQueue() instead of localStorage keys.

// Helper: today's date string in the same YYYY-MM-DD format the service uses.
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: a date offset from today by `deltaDays`. Negative = past.
function dateOffset(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: minimal DailyPost stub matching the type contract.
function makePost(id, overrides = {}) {
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
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
    ...overrides,
  };
}

const { postQueueService } = await import('../../src/services/post-queue.service.ts');

// Seed a "yesterday's queue" via the public API: enqueue posts (date=today in
// _state), then roll the in-memory queue date back to `dateStr`, then loadQueue()
// to fire normalizeState — which snapshots the rolled-back payload to the durable
// yesterday mirror and rehydrates today's queue.
function seedAndRollover(posts, dateStr, { derivedList = [] } = {}) {
  postQueueService.enqueue(posts);
  if (derivedList.length) postQueueService.appendToDerivedList(derivedList);
  postQueueService.simulateDateRollback(dateStr);
  postQueueService.loadQueue();
}

describe('postQueueService — durable yesterday snapshot (Phase 36 GAP-D Fix A)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.resetAll(); // full wipe (queue + yesterday) for isolation
  });

  // Test 1 — snapshot is created on date-mismatch rollover
  it('rollover snapshots the prior payload to the durable yesterday mirror', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover([makePost('y1'), makePost('y2')], yesterday);
    // The yesterday snapshot must now hold the 2 posts (durable mirror).
    const snap = postQueueService.getYesterdayQueue();
    assert.equal(snap.length, 2, 'yesterday snapshot should preserve all 2 posts');
    assert.equal(snap[0].id, 'y1');
    assert.equal(snap[1].id, 'y2');
  });

  // Test 2 — getYesterdayQueue() returns the snapshot, distinct from live queue
  it('getYesterdayQueue() returns posts from the snapshot, not the live queue', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover([makePost('y1'), makePost('y2')], yesterday);
    const out = postQueueService.getYesterdayQueue();
    assert.equal(out.length, 2, 'getYesterdayQueue should return both yesterday posts');
    assert.equal(out[0].id, 'y1');
    assert.equal(out[1].id, 'y2');
  });

  // Test 3 — snapshot survives a subsequent save() of today's queue
  it('snapshot survives a subsequent save() of today queue', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover([makePost('y1'), makePost('y2')], yesterday);
    // Force a save() of today's queue by enqueuing a today-post.
    postQueueService.enqueue([makePost('today-1')]);
    const out = postQueueService.getYesterdayQueue();
    assert.equal(out.length, 2, 'snapshot must STILL return yesterday posts after a save() of today queue');
    assert.equal(out[0].id, 'y1');
    assert.equal(out[1].id, 'y2');
  });

  // Test 4 — empty-posts payloads do NOT create a snapshot
  it('no snapshot when prior payload had empty posts array', () => {
    const yesterday = dateOffset(-1);
    // Roll back an empty queue (only a derivedList so simulateDateRollback returns true).
    postQueueService.appendToDerivedList(['anchor-x']);
    postQueueService.simulateDateRollback(yesterday);
    postQueueService.loadQueue();
    assert.deepEqual(postQueueService.getYesterdayQueue(), [], 'getYesterdayQueue should return [] when prior posts were empty');
  });

  // Test 5 — only the most-recent yesterday is kept (multi-step rollover)
  it('snapshot is overwritten on subsequent date rollover (W-1)', () => {
    const dayMinus2 = dateOffset(-2);
    const dayMinus1 = dateOffset(-1);

    // First rollover: snapshot holds day -2 payload.
    seedAndRollover([makePost('day-2-a'), makePost('day-2-b')], dayMinus2);
    let snap = postQueueService.getYesterdayQueue();
    assert.equal(snap.length, 2, 'first rollover should snapshot day -2 (2 posts)');

    // Simulate day -1 activity then roll over again.
    postQueueService.resetForNewDay();
    seedAndRollover([makePost('day-1-only-post')], dayMinus1, { derivedList: ['anchor-x'] });
    snap = postQueueService.getYesterdayQueue();
    assert.equal(snap.length, 1, 'second rollover should snapshot day -1, NOT preserve day -2');
    assert.equal(snap[0].id, 'day-1-only-post');
    assert.ok(
      !snap.some(p => p.id === 'day-2-a'),
      'day -2 post should not survive into the day -1 snapshot',
    );
  });

  // Test 6 — first-install behavior (per checker W-2)
  it('getYesterdayQueue() returns [] gracefully when no snapshot exists', () => {
    postQueueService.resetForNewDay();
    const out = postQueueService.getYesterdayQueue();
    assert.deepEqual(out, [], 'must return empty array when no yesterday snapshot exists');
    assert.ok(Array.isArray(out), 'return type must be an array');
  });

  // Test 7 — resetForNewDay() preserves the snapshot (per checker I-2)
  it('resetForNewDay() does NOT clear the yesterday snapshot', () => {
    const yesterday = dateOffset(-1);
    seedAndRollover([makePost('y1'), makePost('y2')], yesterday);
    const before = postQueueService.getYesterdayQueue();
    assert.equal(before.length, 2, 'snapshot precondition: must exist before reset');

    // The user-facing "Reset today" button (SettingsDataScreen.tsx) invokes this.
    postQueueService.resetForNewDay();

    const after = postQueueService.getYesterdayQueue();
    assert.deepEqual(after, before, 'snapshot must be unchanged after resetForNewDay');
    assert.equal(after.length, 2);
    assert.equal(after[0].id, 'y1');
    assert.equal(after[1].id, 'y2');
  });
});
