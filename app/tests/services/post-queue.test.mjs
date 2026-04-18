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

const STORAGE_KEY = 'echolearn_post_queue';

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

  it('needsRefill returns true when size < 8, false when >= 8', () => {
    assert.equal(postQueueService.needsRefill(), true);
    const posts = Array.from({ length: 8 }, (_, i) => makePost(`r${i}`));
    postQueueService.enqueue(posts);
    assert.equal(postQueueService.needsRefill(), false);
  });

  it('loadQueue with date mismatch resets to empty queue, cycle 0', () => {
    postQueueService.enqueue([makePost('x')]);
    postQueueService.incrementCycle();
    assert.equal(postQueueService.size(), 1);
    assert.equal(postQueueService.getCycleNumber(), 1);

    // Overwrite localStorage with a stale date
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    raw.date = '1999-01-01';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    postQueueService.loadQueue();
    assert.equal(postQueueService.size(), 0);
    assert.equal(postQueueService.getCycleNumber(), 0);
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
});
