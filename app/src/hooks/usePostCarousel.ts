/**
 * usePostCarousel.ts
 * Carousel state management hook (index tracking + lazy-load set).
 * Phase 8: Post Detail & Infinite Scroll
 *
 * Abstracts PostCarousel state logic into a reusable hook:
 * - currentIndex / setCurrentIndex
 * - loadedIndexes (Set tracking which images are pre-loaded)
 * - Resets to 0 when imagesLength changes
 * - Pre-loads adjacent images (current ± 1) on index change
 */

import { useState, useEffect } from 'react';

export interface UsePostCarouselReturn {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  loadedIndexes: Set<number>;
}

/**
 * Manages carousel state for a fixed-size images array.
 *
 * @param imagesLength - Total number of images in the carousel
 * @returns current index, setter, and set of loaded image indexes
 *
 * Usage:
 * ```tsx
 * const { currentIndex, setCurrentIndex, loadedIndexes } = usePostCarousel(images.length);
 * ```
 */
export function usePostCarousel(imagesLength: number): UsePostCarouselReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set([0]));

  // Reset to first image when the images array changes (e.g. navigation to different post)
  useEffect(() => {
    setCurrentIndex(0);
    setLoadedIndexes(new Set([0]));
  }, [imagesLength]);

  // Pre-load adjacent images whenever currentIndex changes
  useEffect(() => {
    setLoadedIndexes((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      if (currentIndex + 1 < imagesLength) next.add(currentIndex + 1);
      if (currentIndex - 1 >= 0) next.add(currentIndex - 1);
      return next;
    });
  }, [currentIndex, imagesLength]);

  return {
    currentIndex,
    setCurrentIndex,
    loadedIndexes,
  };
}
