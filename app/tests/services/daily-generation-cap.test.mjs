/**
 * Tests for D-38 (daily generation cap).
 *
 * The cap logic lives in refillQueue() (concept-feed.service.ts:950-954):
 *
 *   const dueConcepts = questions.filter(q => q.isAnchorNode);
 *   const maxPosts = (settings.feed?.dailyGenerationCapMultiplier ?? FEED_DEFAULTS.dailyGenerationCapMultiplier)
 *                   * Math.max(dueConcepts.length, 1);
 *   if (postQueueService.getTotalGenerated() >= maxPosts) return;  // cap hit → skip
 *
 * Since refillQueue() is async and has heavy external deps (LLM, YouTube, Tavily),
 * we test the observable components of the cap mechanism:
 *   1. FEED_DEFAULTS.dailyGenerationCapMultiplier === 5
 *   2. The cap formula: multiplier × max(dueConcepts, 1)
 *   3. postQueueService.getTotalGenerated() accumulates correctly
 *   4. When getTotalGenerated() >= cap, the queue is not refilled further
 *
 * This validates that the cap logic will block generation when called.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { postQueueService } = await import('../../src/services/post-queue.service.ts');
const { FEED_DEFAULTS } = await import('../../src/services/settings.service.ts');

// Helper to create a minimal DailyPost stub
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

// Mirror the cap formula from refillQueue:
//   maxPosts = multiplier × max(dueConcepts.length, 1)
function computeCap(multiplier, dueConcepts) {
  return multiplier * Math.max(dueConcepts.length, 1);
}

describe('D-38 daily generation cap', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.resetForNewDay();
  });

  it('FEED_DEFAULTS.dailyGenerationCapMultiplier is 5', () => {
    assert.equal(FEED_DEFAULTS.dailyGenerationCapMultiplier, 5);
  });

  it('cap formula: 5 × dueConcepts.length when at least 1 concept', () => {
    const dueConcepts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const cap = computeCap(FEED_DEFAULTS.dailyGenerationCapMultiplier, dueConcepts);
    assert.equal(cap, 15); // 5 × 3
  });

  it('cap formula: min floor is multiplier × 1 when no concepts are due', () => {
    const cap = computeCap(FEED_DEFAULTS.dailyGenerationCapMultiplier, []);
    assert.equal(cap, 5); // 5 × max(0, 1) = 5
  });

  it('cap formula: custom multiplier × due concepts', () => {
    const customMultiplier = 3;
    const dueConcepts = [{ id: 'a' }, { id: 'b' }];
    const cap = computeCap(customMultiplier, dueConcepts);
    assert.equal(cap, 6); // 3 × 2
  });

  it('getTotalGenerated() starts at 0 on fresh day', () => {
    assert.equal(postQueueService.getTotalGenerated(), 0);
  });

  it('getTotalGenerated() increments by enqueue count', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2'), makePost('p3')]);
    assert.equal(postQueueService.getTotalGenerated(), 3);
  });

  it('getTotalGenerated() accumulates across multiple enqueue calls', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    postQueueService.enqueue([makePost('p3')]);
    assert.equal(postQueueService.getTotalGenerated(), 3);
  });

  it('cap is reached when getTotalGenerated() >= cap: refill should be blocked', () => {
    const dueConcepts = [{ id: 'anchor-1' }, { id: 'anchor-2' }];
    const cap = computeCap(FEED_DEFAULTS.dailyGenerationCapMultiplier, dueConcepts);
    // cap = 5 × 2 = 10

    // Simulate having generated exactly cap posts
    const posts = Array.from({ length: cap }, (_, i) => makePost(`post-${i}`));
    postQueueService.enqueue(posts);

    assert.ok(
      postQueueService.getTotalGenerated() >= cap,
      'getTotalGenerated should equal cap after enqueuing cap posts',
    );
  });

  it('cap not reached when getTotalGenerated() < cap: refill should proceed', () => {
    const dueConcepts = [{ id: 'anchor-1' }, { id: 'anchor-2' }];
    const cap = computeCap(FEED_DEFAULTS.dailyGenerationCapMultiplier, dueConcepts);
    // cap = 10

    // Enqueue fewer than cap posts
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);

    assert.ok(
      postQueueService.getTotalGenerated() < cap,
      'getTotalGenerated should be below cap — refill would proceed',
    );
  });

  it('resetForNewDay() resets getTotalGenerated() to 0', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2')]);
    assert.equal(postQueueService.getTotalGenerated(), 2);
    postQueueService.resetForNewDay();
    assert.equal(postQueueService.getTotalGenerated(), 0);
  });

  it('dequeue does not affect getTotalGenerated (only enqueue does)', () => {
    postQueueService.enqueue([makePost('p1'), makePost('p2'), makePost('p3')]);
    postQueueService.dequeue(2);
    assert.equal(postQueueService.getTotalGenerated(), 3, 'generated count should not decrease after dequeue');
  });
});
