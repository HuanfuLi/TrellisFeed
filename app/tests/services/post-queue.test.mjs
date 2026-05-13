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

const STORAGE_KEY = 'trellis_post_queue';

// Fresh import per describe block is not needed since we clear localStorage
// and call loadQueue() before each test.
const { postQueueService } = await import('../../src/services/post-queue.service.ts');

describe('postQueueService', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  it('enqueue 3 posts, dequeue 2 returns first 2, queue has 1 remaining', () => {
    const posts = [makePost('a'), makePost('b'), makePost('c')];
    postQueueService.enqueue(posts);
    const dequeued = postQueueService.dequeue(2);
    assert.equal(dequeued.length, 2);
    assert.equal(dequeued[0].id, 'a');
    assert.equal(dequeued[1].id, 'b');
    assert.equal(postQueueService.size(), 1);
  });

  it('enqueue 10 posts, dequeue 4 returns first 4, queue size is 6', () => {
    const posts = Array.from({ length: 10 }, (_, i) => makePost(`p${i}`));
    postQueueService.enqueue(posts);
    const dequeued = postQueueService.dequeue(4);
    assert.equal(dequeued.length, 4);
    assert.equal(dequeued[0].id, 'p0');
    assert.equal(dequeued[3].id, 'p3');
    assert.equal(postQueueService.size(), 6);
  });

  it('needsRefill returns true when size < 24, false when >= 24 (Phase 42 masonry threshold)', () => {
    assert.equal(postQueueService.needsRefill(), true);
    const posts = Array.from({ length: 24 }, (_, i) => makePost(`r${i}`));
    postQueueService.enqueue(posts);
    assert.equal(postQueueService.needsRefill(), false);
  });

  it('loadQueue with date mismatch rehydrates posts + cycleNumber, resets totals, snapshots to STORAGE_KEY_YESTERDAY', () => {
    // Phase 36-11: load() now rehydrates _state.posts (and derivedList +
    // cyclePosition) from yesterday's parsed.posts on date mismatch, AFTER
    // snapshotting to STORAGE_KEY_YESTERDAY. Counters (totalGenerated +
    // totalServed) reset to 0; cycleNumber inherits.
    postQueueService.enqueue([makePost('x'), makePost('y')]);
    postQueueService.incrementCycle();
    assert.equal(postQueueService.size(), 2);
    assert.equal(postQueueService.getCycleNumber(), 1);

    // Overwrite localStorage with a stale date
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    raw.date = '1999-01-01';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    postQueueService.loadQueue();
    // Rehydrated: posts + cycleNumber preserved
    assert.equal(postQueueService.size(), 2, 'posts rehydrated from yesterday');
    assert.equal(postQueueService.getCycleNumber(), 1, 'cycleNumber inherited');
    // Snapshot written
    const yest = JSON.parse(localStorage.getItem('trellis_post_queue_yesterday'));
    assert.equal(yest.date, '1999-01-01');
    assert.equal(yest.posts.length, 2);
  });

  it('loadQueue with same date preserves queue contents', () => {
    postQueueService.enqueue([makePost('y'), makePost('z')]);
    postQueueService.incrementCycle();

    postQueueService.loadQueue();
    assert.equal(postQueueService.size(), 2);
    assert.equal(postQueueService.getCycleNumber(), 1);
  });

  it('incrementCycle increments cycleNumber by 1', () => {
    assert.equal(postQueueService.getCycleNumber(), 0);
    postQueueService.incrementCycle();
    assert.equal(postQueueService.getCycleNumber(), 1);
    postQueueService.incrementCycle();
    assert.equal(postQueueService.getCycleNumber(), 2);
  });

  it('resetForNewDay clears queue, resets cycle to 0, updates date', () => {
    postQueueService.enqueue([makePost('a'), makePost('b')]);
    postQueueService.incrementCycle();
    postQueueService.incrementCycle();

    postQueueService.resetForNewDay();
    assert.equal(postQueueService.size(), 0);
    assert.equal(postQueueService.getCycleNumber(), 0);
    assert.equal(postQueueService.getQueue().length, 0);
  });

  it('getQueue returns shallow copy (mutations do not affect internal state)', () => {
    postQueueService.enqueue([makePost('m1'), makePost('m2')]);
    const copy = postQueueService.getQueue();
    copy.push(makePost('intruder'));
    assert.equal(postQueueService.size(), 2);
  });

  // ─── D-30: getYesterdayQueue() — warm-start recovery of unviewed posts ────
  // Contract (post-queue.service.ts:124):
  //   1. Reads localStorage directly (bypasses in-memory _state).
  //   2. Returns [] when no saved state exists.
  //   3. Returns [] when saved state's date === today().
  //   4. Returns parsed.posts || [] when saved state's date !== today().
  //   5. Returns [] on malformed JSON (catch block).

  it('getYesterdayQueue returns [] when localStorage is empty', () => {
    // beforeEach cleared localStorage; nothing saved yet.
    const yesterday = postQueueService.getYesterdayQueue();
    assert.deepEqual(yesterday, []);
  });

  it('getYesterdayQueue returns [] when stored date matches today', () => {
    // Enqueue triggers save() with today's date.
    postQueueService.enqueue([makePost('today-1'), makePost('today-2')]);
    const yesterday = postQueueService.getYesterdayQueue();
    assert.deepEqual(yesterday, [], 'same-day state should not be treated as yesterday');
  });

  it('getYesterdayQueue returns stored posts when snapshot key holds them (Phase 36 GAP-D Fix A)', () => {
    // Phase 36 GAP-D Fix A (2026-05-07): getYesterdayQueue now reads from
    // STORAGE_KEY_YESTERDAY (the durable snapshot), NOT the live STORAGE_KEY.
    // Write directly to the snapshot key to simulate a prior cold-start of the
    // new day having taken its snapshot. Comprehensive snapshot-lifecycle
    // coverage lives in tests/services/post-queue-yesterday-snapshot.test.mjs;
    // this test only exercises the read-from-snapshot-key contract.
    const STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday';
    const snapshotPayload = {
      date: '1999-01-01',
      posts: [makePost('y1'), makePost('y2'), makePost('y3')],
    };
    localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify(snapshotPayload));

    const yesterday = postQueueService.getYesterdayQueue();
    assert.equal(yesterday.length, 3, 'should return all 3 yesterday posts from the snapshot key');
    assert.equal(yesterday[0].id, 'y1');
    assert.equal(yesterday[1].id, 'y2');
    assert.equal(yesterday[2].id, 'y3');
  });

  it('getYesterdayQueue returns [] when snapshot has no posts field', () => {
    // Defensive: Array.isArray(parsed.posts) handles missing posts key.
    const STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday';
    const snapshotPayload = { date: '1999-01-01' };
    localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify(snapshotPayload));

    const yesterday = postQueueService.getYesterdayQueue();
    assert.deepEqual(yesterday, []);
  });

  it('getYesterdayQueue returns [] gracefully on malformed JSON', () => {
    const STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday';
    localStorage.setItem(STORAGE_KEY_YESTERDAY, '{not-valid-json}');
    const yesterday = postQueueService.getYesterdayQueue();
    assert.deepEqual(yesterday, [], 'malformed JSON should be caught and return empty array');
  });
});
