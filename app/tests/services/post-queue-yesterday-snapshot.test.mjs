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

const STORAGE_KEY = 'echolearn_post_queue';
const STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday';

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

describe('postQueueService — durable yesterday snapshot (Phase 36 GAP-D Fix A)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  // Test 1 — snapshot is created on date-mismatch load
  it('load() copies prior payload to STORAGE_KEY_YESTERDAY on date mismatch', () => {
    // Pre-seed the live key with a stale-dated payload (yesterday).
    const yesterday = dateOffset(-1);
    const stalePayload = {
      date: yesterday,
      posts: [makePost('y1'), makePost('y2')],
      cycleNumber: 1,
      totalGenerated: 2,
      totalServed: 0,
      derivedList: [],
      cyclePosition: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    // Trigger load() (simulates app launch on the new day).
    postQueueService.loadQueue();
    // Snapshot must now be present at STORAGE_KEY_YESTERDAY.
    const raw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    assert.ok(raw, 'STORAGE_KEY_YESTERDAY should be populated after date-mismatch load');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.date, yesterday, 'snapshot date should equal the prior payload date');
    assert.equal(parsed.posts.length, 2, 'snapshot should preserve all 2 posts');
    assert.equal(parsed.posts[0].id, 'y1');
    assert.equal(parsed.posts[1].id, 'y2');
  });

  // Test 2 — getYesterdayQueue() reads from the snapshot key
  it('getYesterdayQueue() returns posts from the snapshot, not the live key', () => {
    const yesterday = dateOffset(-1);
    const stalePayload = {
      date: yesterday,
      posts: [makePost('y1'), makePost('y2')],
      cycleNumber: 0, totalGenerated: 0, totalServed: 0,
      derivedList: [], cyclePosition: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalePayload));
    postQueueService.loadQueue(); // triggers snapshot

    const out = postQueueService.getYesterdayQueue();
    assert.equal(out.length, 2, 'getYesterdayQueue should return both yesterday posts');
    assert.equal(out[0].id, 'y1');
    assert.equal(out[1].id, 'y2');
  });

  // Test 3 — snapshot survives a subsequent save() of today's queue
  it('snapshot survives a subsequent save() (different key)', () => {
    const yesterday = dateOffset(-1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: yesterday,
      posts: [makePost('y1'), makePost('y2')],
      cycleNumber: 0, totalGenerated: 0, totalServed: 0,
      derivedList: [], cyclePosition: 0,
    }));
    postQueueService.loadQueue();

    // Now force a save() of today's queue by enqueuing a today-post.
    postQueueService.enqueue([makePost('today-1')]);

    // The live key has been overwritten with today's date — but the snapshot is intact.
    const live = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.equal(live.date, todayStr(), 'live key should now have today date');

    const out = postQueueService.getYesterdayQueue();
    assert.equal(out.length, 2, 'snapshot must STILL return yesterday posts after a save() of today queue');
    assert.equal(out[0].id, 'y1');
    assert.equal(out[1].id, 'y2');
  });

  // Test 4 — empty-posts payloads do NOT create a snapshot
  it('no snapshot when prior payload had empty posts array', () => {
    const yesterday = dateOffset(-1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: yesterday,
      posts: [],
      cycleNumber: 0, totalGenerated: 0, totalServed: 0,
      derivedList: [], cyclePosition: 0,
    }));
    postQueueService.loadQueue();

    const raw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    assert.equal(raw, null, 'STORAGE_KEY_YESTERDAY must not be created when prior posts array was empty');
    assert.deepEqual(postQueueService.getYesterdayQueue(), [], 'getYesterdayQueue should return [] gracefully');
  });

  // Test 5 — only the most-recent yesterday is kept (multi-step rollover)
  // Per checker W-1: explicitly enqueue a today=date(d+1) post BETWEEN the two
  // rollovers so the second rollover snapshots the day-2 payload, not re-snapshot
  // the original day-1 payload.
  it('snapshot is overwritten on subsequent date rollover (W-1)', () => {
    // Step 1: pre-seed day -2's payload, trigger first rollover (today = day -1
    // would NOT match day -2 so snapshot fires). To stage this cleanly we'll
    // simulate three days' worth of progression without mocking Date:
    //   - Pre-seed live key with date = (today - 2).
    //   - Call loadQueue → snapshot key gets (today - 2) payload.
    //   - Enqueue a post (forces save with date = today, NOT yesterday — so we
    //     need to pre-seed the live key AGAIN with date = (today - 1) to
    //     simulate "the next day's pass").
    const dayMinus2 = dateOffset(-2);
    const dayMinus1 = dateOffset(-1);

    // Seed first rollover scenario.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: dayMinus2,
      posts: [makePost('day-2-a'), makePost('day-2-b')],
      cycleNumber: 0, totalGenerated: 0, totalServed: 0,
      derivedList: [], cyclePosition: 0,
    }));
    postQueueService.loadQueue();
    // Snapshot now holds day -2 payload.
    let snap = JSON.parse(localStorage.getItem(STORAGE_KEY_YESTERDAY));
    assert.equal(snap.date, dayMinus2, 'first rollover should snapshot day -2');
    assert.equal(snap.posts.length, 2);

    // Step 2: simulate a day's activity by writing a day -1 payload to the live
    // key. (In real life this happens via enqueue()/markServed()/etc. as the
    // user uses the app on day -1; here we write directly because the test
    // can't time-travel.)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: dayMinus1,
      posts: [makePost('day-1-only-post')],
      cycleNumber: 1, totalGenerated: 1, totalServed: 0,
      derivedList: ['anchor-x'], cyclePosition: 0,
    }));

    // Step 3: second rollover (today != day -1, so snapshot fires again).
    postQueueService.loadQueue();
    snap = JSON.parse(localStorage.getItem(STORAGE_KEY_YESTERDAY));
    assert.equal(snap.date, dayMinus1, 'second rollover should snapshot day -1, NOT preserve day -2');
    assert.equal(snap.posts.length, 1, 'snapshot now holds day -1 single post');
    assert.equal(snap.posts[0].id, 'day-1-only-post');
    // No multi-day history — day-2-a / day-2-b are gone.
    assert.ok(
      !snap.posts.some(p => p.id === 'day-2-a'),
      'day -2 post should not survive into the day -1 snapshot',
    );
  });

  // Test 6 — first-install behavior (per checker W-2)
  it('getYesterdayQueue() returns [] gracefully when no snapshot exists', () => {
    // Fresh localStorage — no live key, no snapshot key.
    localStorage.clear();
    postQueueService.loadQueue();
    const out = postQueueService.getYesterdayQueue();
    // Must be exactly [] (not undefined, not null, no throw).
    assert.deepEqual(out, [], 'must return empty array when STORAGE_KEY_YESTERDAY is absent');
    assert.ok(Array.isArray(out), 'return type must be an array');
  });

  // Test 7 — resetForNewDay() preserves the snapshot (per checker I-2)
  it('resetForNewDay() does NOT clear STORAGE_KEY_YESTERDAY', () => {
    // Set up snapshot via Test 1 path.
    const yesterday = dateOffset(-1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: yesterday,
      posts: [makePost('y1'), makePost('y2')],
      cycleNumber: 0, totalGenerated: 0, totalServed: 0,
      derivedList: [], cyclePosition: 0,
    }));
    postQueueService.loadQueue();
    const before = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    assert.ok(before, 'snapshot precondition: must exist before reset');

    // The user-facing "Reset today" button (SettingsDataScreen.tsx) invokes this.
    postQueueService.resetForNewDay();

    const after = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    assert.equal(after, before, 'snapshot must be byte-identical after resetForNewDay');
    // And getYesterdayQueue still returns the 2 posts.
    const out = postQueueService.getYesterdayQueue();
    assert.equal(out.length, 2, 'getYesterdayQueue should still return the 2 yesterday posts after reset');
    assert.equal(out[0].id, 'y1');
    assert.equal(out[1].id, 'y2');
  });
});
