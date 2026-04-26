// Post queue service — 8-post FIFO buffer with localStorage persistence (Phase 31, D-10/D-11).
// Stores a daily queue of DailyPost items, auto-resets on new day (date mismatch).

import type { DailyPost } from '../types/index.ts';

const STORAGE_KEY = 'echolearn_post_queue';
// 2026-04-21 bump: refill threshold 8 → 12. refillQueue now pre-generates
// images before enqueue (moved from pop-time to enqueue-time), so each
// refill cycle takes longer. Triggering refill earlier (at 12 remaining
// instead of 8) gives more runway so the user doesn't hit an empty queue
// mid-swipe while image generation is still in flight.
const REFILL_THRESHOLD = 12;
const MAX_QUEUE_SIZE = 32;

interface QueueState {
  date: string;
  posts: DailyPost[];
  cycleNumber: number;
  totalGenerated: number;
  totalServed: number;
}

// Inline today() to avoid i18next dependency chain from lib/date.ts.
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function freshState(): QueueState {
  return { date: today(), posts: [], cycleNumber: 0, totalGenerated: 0, totalServed: 0 };
}

function load(): QueueState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as QueueState;
    if (parsed.date !== today()) {
      // Date mismatch — return empty for today (warm-start handled by caller)
      return freshState();
    }
    return parsed;
  } catch {
    return freshState();
  }
}

function save(state: QueueState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[postQueueService] localStorage save failed:', err);
  }
}

let _state: QueueState = load();

export const postQueueService = {
  /** Get a shallow copy of the current queue. */
  getQueue(): DailyPost[] {
    return [..._state.posts];
  },

  /**
   * Append posts to the end of the queue. Deduplicates by id across both
   * existing queue items AND within the incoming batch. Caps at MAX_QUEUE_SIZE.
   *
   * Phase 33 gap fix (2026-04-20): the prior dedup filtered the incoming batch
   * against `existingIds` only, so duplicates WITHIN `posts` both passed through
   * and landed side-by-side in the queue. With UUID-suffixed IDs (makePostId)
   * this shouldn't occur, but the defense-in-depth invariant makes the queue's
   * uniqueness structural — any future ID-generator bug drops silently here
   * (with a dev-mode warn) instead of manifesting as linked-playback or other
   * shared-state React bugs downstream.
   */
  enqueue(posts: DailyPost[]): void {
    const seen = new Set(_state.posts.map(p => p.id));
    const fresh: DailyPost[] = [];
    const duplicates: string[] = [];
    for (const p of posts) {
      if (seen.has(p.id)) {
        duplicates.push(p.id);
        continue;
      }
      seen.add(p.id);
      fresh.push(p);
    }
    if (duplicates.length > 0 && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[postQueueService] Rejected duplicate post IDs at enqueue:', duplicates);
    }
    const capacity = MAX_QUEUE_SIZE - _state.posts.length;
    const added = fresh.slice(0, Math.max(0, capacity));
    _state.posts.push(...added);
    _state.totalGenerated += added.length;
    save(_state);
  },

  /**
   * Enqueue + interleave in one step: combines the unserved queue tail with
   * the new batch, runs a caller-supplied mixer over the combined list, then
   * replaces the queue's posts with the mixed result.
   *
   * Why it exists (2026-04-21): plain `enqueue` concatenates — so the user's
   * next pop of `count` posts slices a window out of `[batch1, batch2, ...]`
   * that may land entirely inside one batch's single-style tail, producing
   * the observed "many text-art in a row, then many video in a row" feed.
   * Interleaving at enqueue time mixes the freshly-generated batch WITH
   * whatever's still pending from prior cycles, so cross-batch clustering
   * can't happen.
   *
   * The mixer is passed in (rather than importing spreadByStyle here) to
   * avoid a post-queue ↔ concept-feed circular import. The mixer mutates
   * its input array in place; this method treats it as producing the final
   * post order.
   *
   * Dedup against existing queue is preserved (same rules as `enqueue`).
   * `totalGenerated` counts only the fresh additions, not the re-mixed tail.
   */
  enqueueInterleaved(posts: DailyPost[], mixer: (combined: DailyPost[]) => void): void {
    const seen = new Set(_state.posts.map(p => p.id));
    const fresh: DailyPost[] = [];
    const duplicates: string[] = [];
    for (const p of posts) {
      if (seen.has(p.id)) { duplicates.push(p.id); continue; }
      seen.add(p.id);
      fresh.push(p);
    }
    if (duplicates.length > 0 && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[postQueueService] Rejected duplicate post IDs at enqueueInterleaved:', duplicates);
    }
    const combined = [..._state.posts, ...fresh];
    const capped = combined.slice(0, MAX_QUEUE_SIZE);
    mixer(capped);
    const addedCount = Math.min(fresh.length, MAX_QUEUE_SIZE - _state.posts.length);
    _state.posts = capped;
    _state.totalGenerated += Math.max(0, addedCount);
    save(_state);
  },

  /** Remove and return the first `count` posts from the queue (FIFO). */
  dequeue(count: number): DailyPost[] {
    const items = _state.posts.splice(0, count);
    _state.totalServed += items.length;
    save(_state);
    return items;
  },

  /** Current queue length. */
  size(): number {
    return _state.posts.length;
  },

  /** True when queue has fewer than REFILL_THRESHOLD posts. */
  needsRefill(): boolean {
    return _state.posts.length < REFILL_THRESHOLD;
  },

  /** Current generation cycle number for today. */
  getCycleNumber(): number {
    return _state.cycleNumber;
  },

  /** Total posts generated today (actual count, not estimated). */
  getTotalGenerated(): number {
    return _state.totalGenerated;
  },

  /** Total posts served (dequeued) today. */
  getTotalServed(): number {
    return _state.totalServed;
  },

  /** Increment the cycle counter (after a generation batch completes). */
  incrementCycle(): void {
    _state.cycleNumber++;
    save(_state);
  },

  /** Reset the queue for a new day — clears posts, resets cycle to 0. */
  resetForNewDay(): void {
    _state = freshState();
    save(_state);
  },

  /** Reload queue state from localStorage (detects date mismatch). */
  loadQueue(): void {
    _state = load();
  },

  /** Peek at yesterday's leftover queue (before today's reset overwrites). */
  getYesterdayQueue(): DailyPost[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as QueueState;
      if (parsed.date === today()) return []; // not yesterday
      return parsed.posts || [];
    } catch {
      return [];
    }
  },
};
