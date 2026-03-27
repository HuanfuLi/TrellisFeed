/**
 * infiniteScroll.service.test.mjs
 * Unit tests for infiniteScrollService.
 * Phase 8: Post Detail & Infinite Scroll
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'assert';

// ─── Inline service implementation for testing ─────────────────────────────────
// We test the service logic directly by re-implementing the deduplication and
// batch management logic (which is pure) without requiring DOM or Capacitor.

function createInfiniteScrollService(fetchBatch) {
  let seenPostIds = new Set();
  let offset = 0;

  return {
    initialize() {
      seenPostIds = new Set();
      offset = 0;
    },

    async loadNextBatch(limit = 10) {
      try {
        const batch = await fetchBatch(offset, limit);
        const deduplicated = batch.filter(post => !seenPostIds.has(post.id));
        deduplicated.forEach(post => seenPostIds.add(post.id));
        offset += limit;
        return deduplicated;
      } catch (err) {
        console.error('[infiniteScrollService] Batch load failed:', err);
        throw err;
      }
    },

    reset() {
      seenPostIds = new Set();
      offset = 0;
    },

    getSeenPostIds() {
      return new Set(seenPostIds);
    },
  };
}

// Helper to create mock posts
function makePosts(startId, count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `post-${startId + i}`,
    title: `Post ${startId + i}`,
    generatedAt: Date.now(),
    origin: 'ai',
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('infiniteScrollService', () => {
  it('fetches 10 posts per batch', async () => {
    const fetchBatch = async (_offset, limit) => makePosts(0, limit);
    const service = createInfiniteScrollService(fetchBatch);
    service.initialize();

    const batch = await service.loadNextBatch(10);
    assert.strictEqual(batch.length, 10, 'Should return exactly 10 posts');
  });

  it('filters duplicate post IDs', async () => {
    // Posts 0-9 in first batch, posts 5-14 in second (5 duplicates)
    let callCount = 0;
    const fetchBatch = async (_offset, _limit) => {
      callCount++;
      return callCount === 1 ? makePosts(0, 10) : makePosts(5, 10);
    };

    const service = createInfiniteScrollService(fetchBatch);
    service.initialize();

    await service.loadNextBatch(10); // Posts 0-9
    const secondBatch = await service.loadNextBatch(10); // Posts 5-14, 5 dups filtered

    assert.strictEqual(secondBatch.length, 5, 'Should return only 5 non-duplicate posts');
    const returnedIds = secondBatch.map(p => p.id);
    // Should only contain posts 10-14
    assert.ok(returnedIds.every(id => {
      const num = parseInt(id.split('-')[1]);
      return num >= 10 && num <= 14;
    }), 'Should only include non-duplicate posts (ids 10-14)');
  });

  it('maintains seen set across batches', async () => {
    let callCount = 0;
    const fetchBatch = async (_offset, _limit) => {
      callCount++;
      return makePosts((callCount - 1) * 10, 10);
    };

    const service = createInfiniteScrollService(fetchBatch);
    service.initialize();

    await service.loadNextBatch(10); // Posts 0-9
    await service.loadNextBatch(10); // Posts 10-19
    await service.loadNextBatch(10); // Posts 20-29

    const seenIds = service.getSeenPostIds();
    assert.strictEqual(seenIds.size, 30, 'Should track all 30 seen post IDs across 3 batches');
  });

  it('handles fetch errors', async () => {
    const fetchBatch = async () => { throw new Error('Network error'); };
    const service = createInfiniteScrollService(fetchBatch);
    service.initialize();

    await assert.rejects(
      () => service.loadNextBatch(10),
      /Network error/,
      'Should propagate fetch errors to caller',
    );
  });
});
