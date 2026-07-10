/**
 * Tests for post-queue.service enqueue dedup invariant.
 *
 * Phase 33 gap fix (2026-04-20): guards against post ID collisions producing
 * two React cards bound to the same post id. The enqueue contract: queue must never contain
 * duplicate post.id entries, and incoming batch dups must also be rejected.
 *
 * Paired with the UUID-based makePostId (concept-feed.service.ts) — both
 * layers close out a class of bugs where a deterministic ID generator could
 * drift out of uniqueness via state-dependent inputs.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill (same as daily-generation-cap.test.mjs)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { postQueueService } = await import('../../src/services/post-queue.service.ts');

function makePost(id) {
  return {
    id,
    date: '2026-04-20',
    title: `post ${id}`,
    teaser: { hook: '', preview: '' },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'mechanism-breakdown',
    contextLabel: 'Test',
    sourceType: 'recent',
    sourceQuestionIds: ['q1'],
    sourceQuestionTitles: ['Q1'],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
    presentationStyle: 'image',
  };
}

describe('postQueueService.enqueue dedup invariant', () => {
  beforeEach(() => {
    postQueueService.resetForNewDay();
  });

  it('rejects duplicate post IDs across batches', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    postQueueService.enqueue([makePost('p2'), makePost('p3')]);

    const queue = postQueueService.getQueue();
    assert.equal(queue.length, 3, 'queue should hold 3 unique posts');
    assert.equal(new Set(queue.map(p => p.id)).size, 3);
    assert.deepEqual(queue.map(p => p.id), ['p1', 'p2', 'p3']);
  });

  it('rejects duplicate post IDs within a single batch', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p1'), makePost('p2')]);

    const queue = postQueueService.getQueue();
    assert.equal(queue.length, 2, 'intra-batch duplicate must be dropped');
    assert.equal(new Set(queue.map(p => p.id)).size, 2);
  });

  it('totalGenerated counter reflects actual additions, not duplicates', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p1'), makePost('p2')]);
    assert.equal(
      postQueueService.getTotalGenerated(),
      2,
      'totalGenerated counts deduped additions',
    );
  });

  it('rejects every duplicate when the whole incoming batch collides', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);

    const queue = postQueueService.getQueue();
    assert.equal(queue.length, 2);
    assert.equal(postQueueService.getTotalGenerated(), 2);
  });

  it('preserves FIFO order of unique entries', () => {
    postQueueService.enqueue([makePost('a')]);
    postQueueService.enqueue([makePost('b'), makePost('a'), makePost('c')]);

    const queue = postQueueService.getQueue();
    assert.deepEqual(queue.map(p => p.id), ['a', 'b', 'c']);
  });
});
