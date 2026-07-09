// Phase 43 Plan 43-15 — postQueueService.removeByIds behavioral test.
//
// Validates the new helper that removes specific post ids from _state.posts.
// Used by HomeScreen warm-start tier-2 fallback to keep dailyPosts and the
// dequeueable queue mutually exclusive after Force-New-Day. See
// .planning/debug/duplicate-post-keys-after-force-new-day.md.
//
// Pattern: localStorage polyfill + dynamic import (mirrors
// post-queue-rehydrate.test.mjs).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const STORAGE_KEY = 'trellis_post_queue';
const STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday';

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

function makePost(id) {
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
  };
}

const { postQueueService } = await import('../../src/services/post-queue.service.ts');

describe('postQueueService.removeByIds — Phase 43 gap-closure 43-15', () => {
  beforeEach(() => {
    // Phase 55-07: queue is in-memory + IndexedDB. resetAll() fully wipes it
    // (queue + yesterday) for isolation; seed via the public enqueue() API.
    localStorage.clear();
    postQueueService.resetAll();
  });

  it('Test 1: removeByIds([]) is a no-op — returns 0, no save', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    const removed = postQueueService.removeByIds([]);
    assert.equal(removed, 0, 'empty input returns 0');
    assert.equal(postQueueService.size(), 2, 'queue unchanged');
  });

  it('Test 2: removeByIds with no matches returns 0 and does not mutate', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    const removed = postQueueService.removeByIds(['nonexistent-x', 'nonexistent-y']);
    assert.equal(removed, 0);
    assert.equal(postQueueService.size(), 2);
    const queue = postQueueService.getQueue();
    assert.deepEqual(queue.map(p => p.id), ['p1', 'p2']);
  });

  it('Test 3: removeByIds([p1,p3]) removes both and returns 2', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2'), makePost('p3'), makePost('p4')]);
    const removed = postQueueService.removeByIds(['p1', 'p3']);
    assert.equal(removed, 2);
    assert.equal(postQueueService.size(), 2);
    assert.deepEqual(postQueueService.getQueue().map(p => p.id), ['p2', 'p4']);
  });

  it('Test 4: removeByIds is idempotent — second call returns 0', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2'), makePost('p3')]);
    const r1 = postQueueService.removeByIds(['p1', 'p2']);
    const r2 = postQueueService.removeByIds(['p1', 'p2']);
    assert.equal(r1, 2);
    assert.equal(r2, 0);
    assert.equal(postQueueService.size(), 1);
  });

  it('Test 5: removeByIds persists the mutated queue (readable via getQueue)', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2'), makePost('p3')]);
    postQueueService.removeByIds(['p2']);
    assert.deepEqual(postQueueService.getQueue().map(p => p.id), ['p1', 'p3']);
  });

  it('Test 6: removeByIds does NOT touch the yesterday snapshot', () => {
    // Seed a yesterday snapshot via the rollover path.
    postQueueService.enqueue([makePost('y1'), makePost('y2'), makePost('y3')]);
    const yesterday = dateOffset(-1);
    postQueueService.simulateDateRollback(yesterday);
    postQueueService.loadQueue(); // snapshots y1/y2/y3, rehydrates them into today
    // Add distinct today-posts then remove one.
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    postQueueService.removeByIds(['p1']);

    const snap = postQueueService.getYesterdayQueue();
    assert.deepEqual(
      snap.map(p => p.id),
      ['y1', 'y2', 'y3'],
      'yesterday snapshot must be unchanged after removeByIds (Plan 36-09 contract preserved)',
    );
  });

  it('Test 7: removeByIds does NOT decrement totalServed (separate metric for dequeue path)', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2'), makePost('s1'), makePost('s2'), makePost('s3')]);
    postQueueService.dequeue(3); // totalServed = 3
    postQueueService.removeByIds(['p1']);
    assert.equal(postQueueService.getTotalServed(), 3, 'totalServed must NOT decrement on removeByIds (only dequeue path mutates it)');
  });

  it('Test 8: removeByIds does NOT mutate derivedList or cyclePosition', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    postQueueService.appendToDerivedList(['anchor-a', 'anchor-b', 'anchor-c']);
    postQueueService.walkDerivedList(2, new Set(), new Set()); // cyclePosition = 2
    postQueueService.removeByIds(['p1']);
    assert.deepEqual(postQueueService.getDerivedList(), ['anchor-a', 'anchor-b', 'anchor-c']);
    assert.equal(postQueueService.getCyclePosition(), 2);
  });

  it('Test 9: NEGATIVE INVARIANT — walker code at line 389 is unchanged (Phase 39 D-07)', () => {
    const src = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
    assert.match(
      src,
      /!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)/,
      'walker dismiss-skip predicate must be unchanged',
    );
    assert.match(
      src,
      /maxSteps\s*=\s*Math\.max\(count\s*\*\s*2,\s*len\)/,
      'walker termination guard must be unchanged (Phase 36 GAP-B)',
    );
  });

  it('Test 10: NEGATIVE INVARIANT — date-mismatch rehydration is unchanged (Phase 36-11)', () => {
    const src = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
    // Phase 55-07: the yesterday snapshot moved off localStorage to the durable
    // IndexedDB row (SQLITE_ROW_ID_YESTERDAY) + in-memory _yesterday mirror. The
    // rehydration re-interleave (spreadByConcept/spreadByStyle) is unchanged.
    assert.match(
      src,
      /SQLITE_ROW_ID_YESTERDAY/,
      'Plan 36-09 durable yesterday snapshot must be preserved (now an IndexedDB row)',
    );
    assert.match(
      src,
      /spreadByConcept\(rehydrated\)/,
      'Phase 36-11 re-interleave (spreadByConcept) must be preserved',
    );
    assert.match(
      src,
      /spreadByStyle\(rehydrated\)/,
      'Phase 36-11 re-interleave (spreadByStyle) must be preserved',
    );
  });
});
