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
  async loadNextBatch(questions: Question[], limit = 10): Promise<DailyPost[]> {
    try {
      const batch = await conceptFeedService.generateMorePosts(questions, limit);

      // Filter out posts already shown
      const deduplicated = batch.filter((post) => !seenPostIds.has(post.id));

      // Track new post IDs to prevent future duplicates
      deduplicated.forEach((post) => seenPostIds.add(post.id));

      // Increment pagination offset
      offset += limit;

      return deduplicated;
    } catch (err) {
      console.error('[infiniteScrollService] Batch load failed:', err);
      throw err; // Caller handles retry
    }
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
