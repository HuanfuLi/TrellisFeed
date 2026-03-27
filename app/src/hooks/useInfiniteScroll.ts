/**
 * useInfiniteScroll.ts
 * React hook for detecting scroll-to-bottom and triggering paginated data loading.
 * Phase 8: Post Detail & Infinite Scroll
 *
 * - Attaches a passive scroll listener to the container element
 * - Detects absolute bottom (scrollHeight - (scrollTop + clientHeight) <= threshold)
 * - Debounces scroll events (default 300ms) to prevent multiple triggers
 * - Guards against concurrent loads via isLoading state
 * - Cleans up listeners on unmount
 */

import { useRef, useState, useEffect, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void>;
  /** Pixels from absolute bottom that triggers loading (default: 0 = absolute bottom) */
  threshold?: number;
  /** Milliseconds to debounce consecutive scroll events (default: 300) */
  debounceMs?: number;
}

/**
 * Hook that monitors a container element for scroll-to-bottom events
 * and fires `onLoadMore` with debounce + concurrent-load protection.
 *
 * Usage:
 * ```tsx
 * const { containerRef, isLoading, setCanLoadMore } = useInfiniteScroll({ onLoadMore });
 * <div ref={containerRef} style={{ overflowY: 'auto', height: '100vh' }}>
 *   {posts.map(...)}
 * </div>
 * ```
 */
export function useInfiniteScroll({
  onLoadMore,
  threshold = 0,
  debounceMs = 300,
}: UseInfiniteScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);

  // Use refs for values needed in the scroll callback to avoid stale closures
  const isLoadingRef = useRef(false);
  const canLoadMoreRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    canLoadMoreRef.current = canLoadMore;
  }, [canLoadMore]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check if we're at the bottom
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const atBottom = distanceFromBottom <= threshold;

    if (!atBottom) return;
    if (isLoadingRef.current) return; // Already loading — skip
    if (!canLoadMoreRef.current) return; // No more posts to load

    // Clear any pending debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule the load after the debounce period
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;

      // Double-check loading state after debounce (may have changed)
      if (isLoadingRef.current || !canLoadMoreRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);

      onLoadMore()
        .catch((err: unknown) => {
          console.error('[useInfiniteScroll] onLoadMore failed:', err);
          // Allow retry on next scroll
        })
        .finally(() => {
          isLoadingRef.current = false;
          setIsLoading(false);
        });
    }, debounceMs);
  }, [onLoadMore, threshold, debounceMs]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      // Clean up any pending debounce timer on unmount
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [handleScroll]);

  return {
    containerRef,
    isLoading,
    setCanLoadMore: (can: boolean) => {
      canLoadMoreRef.current = can;
      setCanLoadMore(can);
    },
  };
}
