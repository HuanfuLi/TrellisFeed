/**
 * carousel.ts
 * Type definitions for the PostCarousel component and useInfiniteScroll hook.
 * Phase 8: Post Detail & Infinite Scroll
 */

import type { DailyPost, GeneratedImage } from './index';

// Re-export for convenience (avoids double-import in consumers)
export type { DailyPost, GeneratedImage };

// ─── Carousel Types ───────────────────────────────────────────────────────────

/** State managed by the carousel (index + which images are loaded) */
export interface CarouselState {
  currentIndex: number;
  loadedIndexes: Set<number>;
}

/** Props accepted by the PostCarousel component */
export interface PostCarouselProps {
  images: GeneratedImage[];
  isLoading?: boolean;
  onIndexChange?: (index: number) => void;
}

// ─── Infinite Scroll Types ────────────────────────────────────────────────────

/** State managed by the infinite scroll service / hook */
export interface InfiniteScrollState {
  posts: DailyPost[];
  seenPostIds: Set<string>;
  isLoading: boolean;
  canLoadMore: boolean;
}

/** Options accepted by the useInfiniteScroll hook */
export interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void>;
  /** Pixels from absolute bottom that triggers loading (default: 0 = absolute bottom) */
  threshold?: number;
  /** Milliseconds to debounce consecutive scroll events (default: 300) */
  debounceMs?: number;
}

/** Value returned by the useInfiniteScroll hook */
export interface UseInfiniteScrollReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  setCanLoadMore: (can: boolean) => void;
}

// ─── PullUpHint Types ─────────────────────────────────────────────────────────

/** Props for the PullUpHint affordance component */
export interface PullUpHintProps {
  isLoading?: boolean;
  isAtBottom?: boolean;
}
