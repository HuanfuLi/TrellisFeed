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
    // Phase 55-07: queue is in-memory + IndexedDB. resetAll() fully wipes it.
    localStorage.clear();
    postQueueService.resetAll();
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

  it('loadQueue with date mismatch rehydrates posts + cycleNumber, resets totals, snapshots yesterday', () => {
    // Phase 36-11: on a date mismatch, normalizeState rehydrates _state.posts
    // (and derivedList + cyclePosition) from yesterday's posts AFTER snapshotting
    // to the durable yesterday mirror. Counters reset to 0; cycleNumber inherits.
    // Phase 55-07: drive the rollover via simulateDateRollback (in-memory) rather
    // than overwriting a localStorage payload.
    postQueueService.enqueue([makePost('x'), makePost('y')]);
    postQueueService.incrementCycle();
    assert.equal(postQueueService.size(), 2);
    assert.equal(postQueueService.getCycleNumber(), 1);

    postQueueService.simulateDateRollback('1999-01-01');
    postQueueService.loadQueue();
    // Rehydrated: posts + cycleNumber preserved
    assert.equal(postQueueService.size(), 2, 'posts rehydrated from yesterday');
    assert.equal(postQueueService.getCycleNumber(), 1, 'cycleNumber inherited');
    // Durable yesterday snapshot written
    const yest = postQueueService.getYesterdayQueue();
    assert.equal(yest.length, 2);
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
  // Phase 55-07 contract: getYesterdayQueue() reads the in-memory _yesterday
  // mirror (durable IndexedDB row), populated by normalizeState's date-mismatch
  // branch (driven here via simulateDateRollback). Comprehensive lifecycle
  // coverage lives in tests/services/post-queue-yesterday-snapshot.test.mjs.

  it('getYesterdayQueue returns [] when no snapshot exists', () => {
    // beforeEach resetAll'd; no rollover has happened yet.
    const yesterday = postQueueService.getYesterdayQueue();
    assert.deepEqual(yesterday, []);
  });

  it('getYesterdayQueue returns [] when only today\'s queue exists (no rollover)', () => {
    postQueueService.enqueue([makePost('today-1'), makePost('today-2')]);
    const yesterday = postQueueService.getYesterdayQueue();
    assert.deepEqual(yesterday, [], 'same-day state should not be treated as yesterday');
  });

  it('getYesterdayQueue returns snapshotted posts after a date rollover (Phase 36 GAP-D Fix A)', () => {
    postQueueService.enqueue([makePost('y1'), makePost('y2'), makePost('y3')]);
    postQueueService.simulateDateRollback('1999-01-01');
    postQueueService.loadQueue(); // snapshots y1/y2/y3 to the yesterday mirror

    const yesterday = postQueueService.getYesterdayQueue();
    assert.equal(yesterday.length, 3, 'should return all 3 yesterday posts from the snapshot');
    assert.equal(yesterday[0].id, 'y1');
    assert.equal(yesterday[1].id, 'y2');
    assert.equal(yesterday[2].id, 'y3');
  });

  it('getYesterdayQueue returns [] when the rolled-back queue had no posts', () => {
    // Only a derivedList (no posts) → no snapshot fires.
    postQueueService.appendToDerivedList(['anchor-x']);
    postQueueService.simulateDateRollback('1999-01-01');
    postQueueService.loadQueue();
    assert.deepEqual(postQueueService.getYesterdayQueue(), []);
  });
});
