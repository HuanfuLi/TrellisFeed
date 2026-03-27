/**
 * PostCarousel.tsx
 * Swipeable image carousel for PostDetailScreen.
 * Phase 8: Post Detail & Infinite Scroll
 *
 * - Framer Motion drag gestures (no custom touch listeners)
 * - Lazy loads adjacent images on swipe
 * - Counter badge at bottom-right for multi-image carousels
 * - Single image: static display, no carousel UI
 * - Zero images: returns null
 * - Skeleton loading state when isLoading=true
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GeneratedImage } from '../types';
import { Skeleton } from './ui/Skeleton';

interface PostCarouselProps {
  images: GeneratedImage[];
  isLoading?: boolean;
  onIndexChange?: (index: number) => void;
}

/** Minimum horizontal drag distance (px) required to trigger a swipe */
const SWIPE_THRESHOLD = 50;

/** Carousel image transition duration in seconds */
const TRANSITION_DURATION = 0.3;

export function PostCarousel({ images, isLoading = false, onIndexChange }: PostCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set([0]));
  const [direction, setDirection] = useState<'left' | 'right'>('left');

  // Reset carousel to first image when images array changes (locked decision)
  useEffect(() => {
    setCurrentIndex(0);
    setLoadedIndexes(new Set([0]));
  }, [images.length]);

  // Pre-load adjacent images when current index changes
  useEffect(() => {
    setLoadedIndexes((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      if (currentIndex + 1 < images.length) next.add(currentIndex + 1);
      if (currentIndex - 1 >= 0) next.add(currentIndex - 1);
      return next;
    });
    onIndexChange?.(currentIndex);
  }, [currentIndex, images.length, onIndexChange]);

  // Show skeleton when loading
  if (isLoading) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <Skeleton height="350px" borderRadius="var(--radius-xl)" />
      </div>
    );
  }

  // Zero images: render nothing
  if (images.length === 0) {
    return null;
  }

  // Single image: static display without carousel UI
  if (images.length === 1) {
    const img = images[0];
    const src = img.imageBase64 ?? img.imageUrl;
    return (
      <div
        style={{
          width: '100%',
          height: '350px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--surface-variant)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        {src ? (
          <img
            src={src}
            alt="Post illustration"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              userSelect: 'none',
              display: 'block',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
      </div>
    );
  }

  // Multi-image carousel
  const currentImage = images[currentIndex];
  const src = currentImage?.imageBase64 ?? currentImage?.imageUrl;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    const offsetX = info.offset.x;
    if (Math.abs(offsetX) < SWIPE_THRESHOLD) return;

    if (offsetX < 0 && currentIndex < images.length - 1) {
      // Swiped left → next image
      setDirection('left');
      setCurrentIndex(currentIndex + 1);
    } else if (offsetX > 0 && currentIndex > 0) {
      // Swiped right → previous image
      setDirection('right');
      setCurrentIndex(currentIndex - 1);
    }
  };

  const variants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'left' ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: 'left' | 'right') => ({
      x: dir === 'left' ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '350px',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface-variant)',
        overflow: 'hidden',
        marginBottom: '16px',
        touchAction: 'pan-y', // Allow vertical scroll while enabling horizontal swipe
      }}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: TRANSITION_DURATION, ease: 'easeInOut' }}
          drag="x"
          dragElastic={0.2}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          style={{
            position: 'absolute',
            inset: 0,
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          {loadedIndexes.has(currentIndex) && src ? (
            <img
              src={src}
              alt={`Post image ${currentIndex + 1} of ${images.length}`}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                userSelect: 'none',
                pointerEvents: 'none',
                display: 'block',
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            // Placeholder while image loads lazily
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'var(--surface-variant)',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Counter badge — only shown for multi-image carousels */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: '100px',
          pointerEvents: 'none',
          zIndex: 10,
          letterSpacing: '0.05em',
        }}
        aria-label={`Image ${currentIndex + 1} of ${images.length}`}
      >
        {currentIndex + 1}/{images.length}
      </div>
    </div>
  );
}
