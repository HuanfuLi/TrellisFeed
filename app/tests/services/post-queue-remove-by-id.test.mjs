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
    localStorage.clear();
    postQueueService.loadQueue();
  });

  it('Test 1: removeByIds([]) is a no-op — returns 0, no save', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
    const removed = postQueueService.removeByIds([]);
    assert.equal(removed, 0, 'empty input returns 0');
    assert.equal(postQueueService.size(), 2, 'queue unchanged');
  });

  it('Test 2: removeByIds with no matches returns 0 and does not mutate', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
    const removed = postQueueService.removeByIds(['nonexistent-x', 'nonexistent-y']);
    assert.equal(removed, 0);
    assert.equal(postQueueService.size(), 2);
    const queue = postQueueService.getQueue();
    assert.deepEqual(queue.map(p => p.id), ['p1', 'p2']);
  });

  it('Test 3: removeByIds([p1,p3]) removes both and returns 2', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2'), makePost('p3'), makePost('p4')], cycleNumber: 0, totalGenerated: 4, totalServed: 0, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
    const removed = postQueueService.removeByIds(['p1', 'p3']);
    assert.equal(removed, 2);
    assert.equal(postQueueService.size(), 2);
    assert.deepEqual(postQueueService.getQueue().map(p => p.id), ['p2', 'p4']);
  });

  it('Test 4: removeByIds is idempotent — second call returns 0', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2'), makePost('p3')], cycleNumber: 0, totalGenerated: 3, totalServed: 0, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
    const r1 = postQueueService.removeByIds(['p1', 'p2']);
    const r2 = postQueueService.removeByIds(['p1', 'p2']);
    assert.equal(r1, 2);
    assert.equal(r2, 0);
    assert.equal(postQueueService.size(), 1);
  });

  it('Test 5: removeByIds persists to localStorage[STORAGE_KEY]', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2'), makePost('p3')], cycleNumber: 0, totalGenerated: 3, totalServed: 0, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
    postQueueService.removeByIds(['p2']);
    const raw = localStorage.getItem(STORAGE_KEY);
    assert.ok(raw, 'localStorage[STORAGE_KEY] still populated');
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed.posts.map(p => p.id), ['p1', 'p3']);
  });

  it('Test 6: removeByIds does NOT touch STORAGE_KEY_YESTERDAY snapshot', () => {
    // Seed a yesterday snapshot independently
    localStorage.setItem(STORAGE_KEY_YESTERDAY, JSON.stringify({
      date: 'yesterday',
      posts: [makePost('y1'), makePost('y2'), makePost('y3')],
    }));
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();

    postQueueService.removeByIds(['p1']);

    const snapRaw = localStorage.getItem(STORAGE_KEY_YESTERDAY);
    const snap = JSON.parse(snapRaw);
    assert.deepEqual(
      snap.posts.map(p => p.id),
      ['y1', 'y2', 'y3'],
      'STORAGE_KEY_YESTERDAY snapshot must be unchanged after removeByIds (Plan 36-09 contract preserved)',
    );
  });

  it('Test 7: removeByIds does NOT decrement totalServed (separate metric for dequeue path)', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 5, totalServed: 3, derivedList: [], cyclePosition: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
    postQueueService.removeByIds(['p1']);
    assert.equal(postQueueService.getTotalServed(), 3, 'totalServed must NOT decrement on removeByIds (only dequeue path mutates it)');
  });

  it('Test 8: removeByIds does NOT mutate derivedList or cyclePosition', () => {
    const seed = { date: todayStr(), posts: [makePost('p1'), makePost('p2')], cycleNumber: 0, totalGenerated: 2, totalServed: 0, derivedList: ['anchor-a', 'anchor-b', 'anchor-c'], cyclePosition: 2 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    postQueueService.loadQueue();
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

  it('Test 10: NEGATIVE INVARIANT — load() date-mismatch rehydration is unchanged (Phase 36-11)', () => {
    const src = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
    // The rehydration block: snapshot to STORAGE_KEY_YESTERDAY, then rehydrate _state.posts
    assert.match(
      src,
      /localStorage\.setItem\(STORAGE_KEY_YESTERDAY/,
      'Plan 36-09 snapshot write must be preserved',
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
