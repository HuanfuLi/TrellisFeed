// Post queue service — 8-post FIFO buffer with localStorage persistence (Phase 31, D-10/D-11).
// Stores a daily queue of DailyPost items, auto-resets on new day (date mismatch).

import type { DailyPost } from '../types/index.ts';

const STORAGE_KEY = 'echolearn_post_queue';
const REFILL_THRESHOLD = 8;

interface QueueState {
  date: string;
  posts: DailyPost[];
  cycleNumber: number;
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
  return { date: today(), posts: [], cycleNumber: 0 };
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
  } catch {
    // localStorage quota exceeded — silently drop
  }
}

let _state: QueueState = load();

export const postQueueService = {
  /** Get a shallow copy of the current queue. */
  getQueue(): DailyPost[] {
    return [..._state.posts];
  },

  /** Append posts to the end of the queue. */
  enqueue(posts: DailyPost[]): void {
    _state.posts.push(...posts);
    save(_state);
  },

  /** Remove and return the first `count` posts from the queue (FIFO). */
  dequeue(count: number): DailyPost[] {
    const items = _state.posts.splice(0, count);
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
