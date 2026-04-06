/**
 * infiniteScroll.service.ts
 * Manages paginated post batch fetching and client-side deduplication.
 * Phase 8: Post Detail & Infinite Scroll
 *
 * Wraps conceptFeedService.generateMorePosts() with:
 * - Deduplication via seenPostIds Set
 * - Batch size control (default 10)
 * - State reset between sessions
 */

import type { DailyPost, Question } from '../types';
import { conceptFeedService } from './concept-feed.service';

// ─── Internal State ───────────────────────────────────────────────────────────

let seenPostIds: Set<string> = new Set();
let offset = 0;
let pendingQueue: DailyPost[] = [];

// ─── Service ──────────────────────────────────────────────────────────────────

export const infiniteScrollService = {
  /**
   * Initialize (or reset) the service state.
   * Call this on HomeScreen mount to start fresh with empty dedup state.
   */
  initialize(): void {
    seenPostIds = new Set();
    offset = 0;
  },

  /**
   * Load the next batch of posts.
   *
   * Calls conceptFeedService.generateMorePosts() to generate fresh content,
   * then filters out any posts whose IDs have already been seen.
   *
   * @param questions - Current user questions (required for LLM generation)
   * @param limit - Number of posts to request (default 10)
   * @returns Deduplicated array of new posts (may be < limit if duplicates filtered)
   */
  async loadNextBatch(questions: Question[], limit = 6): Promise<DailyPost[]> {
    try {
      // Drain pending queue first (session-generated posts waiting to be shown)
      console.log('[infinite] loadNextBatch: pendingQueue size:', pendingQueue.length, 'seenIds:', seenPostIds.size);
      const fromQueue: DailyPost[] = [];
      while (pendingQueue.length > 0 && fromQueue.length < limit) {
        const post = pendingQueue.shift()!;
        const seen = seenPostIds.has(post.id);
        console.log('[infinite] queue post:', post.id.slice(0, 30), seen ? 'SKIP (seen)' : 'TAKE');
        if (!seen) {
          fromQueue.push(post);
          if (seenPostIds.size < 500) seenPostIds.add(post.id);
        }
      }
      console.log('[infinite] fromQueue:', fromQueue.length, 'of', limit);
      if (fromQueue.length >= limit) {
        offset += fromQueue.length;
        return fromQueue;
      }

      // Generate fresh posts to fill remaining slots
      const remaining = limit - fromQueue.length;
      console.log('[infinite] generating', remaining, 'fresh posts via LLM');
      const batch = await conceptFeedService.generateMorePosts(questions, remaining);
      const deduplicated = batch.filter((post) => !seenPostIds.has(post.id));
      deduplicated.forEach((post) => {
        if (seenPostIds.size < 500) seenPostIds.add(post.id);
      });

      offset += fromQueue.length + deduplicated.length;
      const result = [...fromQueue, ...deduplicated];

      // Background-refill: if queue is empty after serving, pre-generate 6 for next swipe
      if (pendingQueue.length === 0) {
        void conceptFeedService.generateMorePosts(questions, 6).then((posts) => {
          if (posts.length > 0) {
            pendingQueue.push(...posts);
          }
        }).catch(() => { /* silent — next swipe will generate fresh */ });
      }

      return result;
    } catch (err) {
      console.error('[infiniteScrollService] Batch load failed:', err);
      throw err; // Caller handles retry
    }
  },

  /**
   * Push pre-generated posts into the pending queue.
   * These will be served first on the next loadNextBatch call.
   */
  enqueuePosts(posts: DailyPost[]): void {
    pendingQueue.push(...posts);
  },

  /**
   * Get the current pending queue size.
   */
  getPendingCount(): number {
    return pendingQueue.length;
  },

  /**
   * Reset service state (call when feed is refreshed or user navigates away).
   */
  reset(): void {
    seenPostIds = new Set();
    offset = 0;
    pendingQueue = [];
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
