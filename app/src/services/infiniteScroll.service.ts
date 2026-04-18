/**
 * infiniteScroll.service.ts
 * Manages paginated post batch fetching and client-side deduplication.
 * Phase 31: Adapted to use postQueueService (FIFO queue with 4-post serve, D-45).
 *
 * Wraps conceptFeedService.generateMorePosts() with:
 * - Deduplication via seenPostIds Set
 * - Batch size control (default 4, D-45)
 * - State reset between sessions
 */

import type { DailyPost, Question } from '../types';
import { conceptFeedService } from './concept-feed.service';
import { postQueueService } from './post-queue.service';

// ─── Internal State ───────────────────────────────────────────────────────────

let seenPostIds: Set<string> = new Set();
let offset = 0;

// ─── Service ──────────────────────────────────────────────────────────────────

export const infiniteScrollService = {
  /**
   * Initialize (or reset) the service state.
   * Call this on HomeScreen mount to start fresh with empty dedup state.
   * Loads queue from localStorage to detect day-change resets.
   */
  initialize(): void {
    seenPostIds = new Set();
    offset = 0;
    postQueueService.loadQueue();
  },

  /**
   * Load the next batch of posts.
   *
   * Phase 31: Serves from postQueueService via conceptFeedService.generateMorePosts().
   * Deduplicates and triggers background refill when queue runs low.
   *
   * @param questions - Current user questions (required for queue refill)
   * @param limit - Number of posts to request (default 4, D-45)
   * @returns Deduplicated array of new posts (may be < limit if duplicates filtered)
   */
  async loadNextBatch(questions: Question[], limit = 4): Promise<DailyPost[]> {
    try {
      // Serve from postQueueService via conceptFeedService
      const batch = await conceptFeedService.generateMorePosts(questions, limit);
      const deduplicated = batch.filter((post) => !seenPostIds.has(post.id));
      deduplicated.forEach((post) => {
        if (seenPostIds.size < 500) seenPostIds.add(post.id);
      });

      offset += deduplicated.length;
      return deduplicated;
    } catch (err) {
      console.error('[infiniteScrollService] Batch load failed:', err);
      throw err; // Caller handles retry
    }
  },

  /**
   * Push pre-generated posts into the persistent queue.
   * These will be served first on the next loadNextBatch call.
   */
  enqueuePosts(posts: DailyPost[]): void {
    postQueueService.enqueue(posts);
  },

  /**
   * Get the current persistent queue size.
   */
  getPendingCount(): number {
    return postQueueService.size();
  },

  /**
   * Reset service state (call when feed is refreshed or user navigates away).
   */
  reset(): void {
    seenPostIds = new Set();
    offset = 0;
  },

  /**
   * Get a copy of the current seen post IDs set.
   * Returns a copy to prevent external mutation.
   */
  getSeenPostIds(): Set<string> {
    return new Set(seenPostIds);
  },

  /**
   * Get the current pagination offset (used for debugging/testing).
   */
  getOffset(): number {
    return offset;
  },
};
