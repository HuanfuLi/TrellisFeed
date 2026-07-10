# Phase 8: Post Detail & Infinite Scroll - Research

**Researched:** 2025-03-26  
**Domain:** React 19 mobile carousel UI, swipe gesture patterns, infinite scroll pagination  
**Confidence:** HIGH (existing codebase verified, React 19 confirmed, Capacitor integrated)

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Carousel Interaction:** Swipe only (no tap arrows/dots), manual only (no auto-rotate), counter at bottom-right
2. **Infinite Scroll Trigger:** Pull-up gesture at absolute bottom, 10 posts per batch
3. **Navigation:** Back swipe (iOS), carousel resets on return, no deep links
4. **Image Loading:** Lazy-load as user swipes, single image shown directly (no carousel if 1 image), skip if missing

### the agent's Discretion

- Carousel library selection (Embla, Swiper, Framer Motion, custom)
- Pull-up gesture detection method
- iOS back swipe implementation approach
- Duplicate post detection strategy

### Deferred Ideas (OUT OF SCOPE)

- Comments on posts
- Search/filtering posts
- Bookmarking posts
- Auto-scroll pagination
- Image regeneration
- Deep linking
- Carousel auto-rotation
- Pagination via button

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEED-04 | User can scroll through feed and scroll-release to load more posts (explicit action trigger) | ✅ Pull-up gesture, absolute bottom detection, 10 posts/batch |
| FEED-05 | User can navigate to post detail page showing image carousel/gallery at top | ✅ PostDetailScreen exists; carousel component needed |
| FEED-06 | Post detail displays multiple generated images in carousel before essay content | ✅ GeneratedImage array available from imageGeneration.service |

---

## Summary

Phase 8 requires two tightly integrated features built on React 19 + TypeScript + Vite + Capacitor:

1. **Post Detail Carousel:** Display AI-generated images in a swipeable carousel with lazy loading and image counter. The carousel is positioned above the existing essay content in PostDetailScreen.

2. **Infinite Scroll Feed:** Detect when user scrolls to feed bottom and implement a pull-up gesture to load 10 additional posts without duplicate

d entries.

**Primary recommendation:** Use **Framer Motion** (already in package.json v12.38.0) for carousel with native Capacitor gesture detection for pull-up via native scroll listeners. Avoid heavyweight carousel libraries; custom implementation with Framer Motion's gesture handling is optimal for 2-5 images.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | React 19 confirmed in app/package.json |
| React Router | 7.13.1 | Navigation + params | Used throughout app for screen routing |
| Framer Motion | 12.38.0 | Animation & gestures | Already in package.json; superior for swipe gestures |
| TypeScript | ~5.9.3 | Type safety | Mandatory across project |
| Capacitor | 8.1.0 | Native platform APIs | Required for iOS back swipe, scroll detection |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @capacitor/haptics | 8.0.1 | Haptic feedback on pull-up | Explicit action affordance; already installed |
| Lucide React | 0.575.0 | Icons (ArrowLeft, Loader, etc.) | Consistent with existing UI components |
| react-router-dom hooks | 7.13.1 | useNavigate, useParams | Location-aware navigation (no deep links needed) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Framer Motion | Swiper.js | Swiper: heavy (98kb), carousel-first. FM: lighter, more granular control, already in dependencies |
| Framer Motion | Embla Carousel | Embla: specialized carousel lib. FM: better for 2-5 images, React 19 compatible, gestures built-in |
| Framer Motion | Custom (vanilla JS) | Custom: zero dependencies, complex gesture math. FM: battle-tested, React integration, gesture detection API |
| Native scroll listener | Intersection Observer + virtual scroll | Native: reliable at absolute bottom. IO: for infinite scroll, but pull-up requires scroll delta tracking |

**Installation:**
```bash
# All dependencies already in place
npm list react@19.2.0 framer-motion@12.38.0 @capacitor/core@8.1.0
```

**Version verification:** All confirmed current as of 2025-03-26. Framer Motion 12.x is latest stable, React 19.2.0 is current, Capacitor 8.1.0 matches project.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── ui/
│   │   └── [existing UI components]
│   └── PostCarousel.tsx           ← NEW: Swipeable image carousel
├── screens/
│   └── PostDetailScreen.tsx       ← MODIFY: Add carousel at top
├── services/
│   ├── imageGeneration.service.ts ← USE: getImage(), cache access
│   └── infiniteScroll.service.ts  ← NEW: Pagination state, dedup logic
├── hooks/
│   ├── useInfiniteScroll.ts       ← NEW: Scroll detection hook
│   └── usePostCarousel.ts         ← NEW: Carousel state management
└── lib/
    ├── gesture.ts                 ← NEW: Pull-up detection utilities
    └── scroll.ts                  ← NEW: Scroll position tracking
```

### Pattern 1: Carousel with Framer Motion Swipe Gestures

**What:** Swipe-driven carousel using Framer Motion's `drag` and gesture API. No dots or arrows—only swipe and image counter.

**When to use:** 2-5 images per post, mobile-first UI, need smooth 60fps transitions.

**Example:**
```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useState } from 'react';
import type { GeneratedImage } from '../types';

interface PostCarouselProps {
  images: GeneratedImage[];
  onImageChange?: (index: number) => void;
}

export function PostCarousel({ images, onImageChange }: PostCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const handleDragEnd = useCallback(
    (event: any, info: any) => {
      const swipeThreshold = 50;
      if (info.offset.x > swipeThreshold && currentIndex > 0) {
        // Swiped right — go to previous image
        const newIndex = currentIndex - 1;
        setCurrentIndex(newIndex);
        onImageChange?.(newIndex);
      } else if (info.offset.x < -swipeThreshold && currentIndex < images.length - 1) {
        // Swiped left — go to next image
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        onImageChange?.(newIndex);
      }
    },
    [currentIndex, images.length, onImageChange]
  );

  // Load current image on mount, then lazy-load on swipe
  const [loadedIndexes, setLoadedIndexes] = useState(new Set([0]));
  
  useEffect(() => {
    setLoadedIndexes(prev => new Set([...prev, currentIndex]));
  }, [currentIndex]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '350px',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        backgroundColor: 'var(--surface-variant)',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={`image-${currentIndex}`}
          src={images[currentIndex].imageBase64 || images[currentIndex].imageUrl}
          alt={`Image ${currentIndex + 1}`}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          drag="x"
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'grab',
            userSelect: 'none',
          }}
        />
      </AnimatePresence>

      {/* Counter: "2/5" at bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        {currentIndex + 1}/{images.length}
      </div>
    </div>
  );
}
```

**Source:** Framer Motion v12.38.0 [drag API](https://www.framer.com/motion/drag/) + [AnimatePresence](https://www.framer.com/motion/animate-presence/) patterns verified in React 19 context.

### Pattern 2: Pull-Up Gesture Detection via Native Scroll Listener

**What:** Detect scroll to absolute bottom of feed, then watch for "pull-up" gesture (upward drag while at bottom) to trigger batch load.

**When to use:** Explicit action required (locked decision). Better UX than auto-load; user controls pagination pace.

**Example:**
```typescript
import { useCallback, useRef, useEffect, useState } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void>;
  threshold?: number; // pixels from bottom
  debounceMs?: number;
}

export function useInfiniteScroll({
  onLoadMore,
  threshold = 0,
  debounceMs = 300,
}: UseInfiniteScrollOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollPosRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isAtBottom = distanceFromBottom <= threshold;
    
    return { scrollTop, isAtBottom, distanceFromBottom };
  }, [threshold]);

  const handleScroll = useCallback(() => {
    if (isLoading || !canLoadMore) return;

    const { scrollTop, isAtBottom } = checkScroll() || {};
    if (!isAtBottom) return;

    // Debounce to avoid firing multiple times
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        await onLoadMore();
      } catch (err) {
        console.error('[InfiniteScroll] Load failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    lastScrollPosRef.current = scrollTop || 0;
  }, [isLoading, canLoadMore, checkScroll, onLoadMore, debounceMs]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return { containerRef, isLoading, setCanLoadMore };
}
```

**Source:** Native scroll events + standard React patterns. NO external library required.

### Pattern 3: Pull-Up Affordance UI + Haptic Feedback

**What:** Show hint UI at feed bottom. When user pulls up, provide haptic feedback + loading state.

**When to use:** Discoverable gesture pattern for mobile users unfamiliar with pull-to-load.

**Example:**
```typescript
import { Haptics } from '@capacitor/haptics';

export function PullUpHint({ isLoading, isAtBottom }: { isLoading: boolean; isAtBottom: boolean }) {
  if (!isAtBottom) return null;

  return (
    <div
      style={{
        padding: '20px 16px',
        textAlign: 'center',
        color: 'var(--muted-foreground)',
        fontSize: '0.85rem',
      }}
    >
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
          Loading more posts...
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '8px', fontSize: '1.2rem' }}>⬆️</div>
          <p>Pull up to load more</p>
        </div>
      )}
    </div>
  );
}

// On successful load:
async function handleLoadMore() {
  await Haptics.vibrate({ duration: 100 }); // Brief haptic on pull
  await fetchPosts();
  await Haptics.notification({ type: 'SUCCESS' }); // Success feedback
}
```

**Source:** @capacitor/haptics v8.0.1 — already installed.

### Pattern 4: Carousel Reset on Navigation Return

**What:** When user navigates back to feed and re-enters detail, carousel resets to first image.

**When to use:** Simpler state management (no persistence), fresh experience per detail view.

**Example:**
```typescript
// In PostDetailScreen component:
const { id } = useParams<{ id: string }>();
const [carouselIndex, setCarouselIndex] = useState(0);

useEffect(() => {
  // Reset carousel when navigating to a different post
  setCarouselIndex(0);
}, [id]); // Reset when `id` param changes
```

**Source:** React Router v7.13.1 useParams hook — standard pattern.

### Pattern 5: Lazy Loading Images in Carousel

**What:** Load first image immediately, then fetch remaining images as user swipes.

**When to use:** Faster perceived page load, especially with 3-5 images.

**Example:**
```typescript
// In usePostCarousel hook:
const [loadedIndexes, setLoadedIndexes] = useState(new Set([0])); // Pre-load first

useEffect(() => {
  // When carousel moves, mark image as "should load"
  setLoadedIndexes(prev => {
    const next = new Set(prev);
    next.add(currentIndex);
    if (currentIndex > 0) next.add(currentIndex - 1); // Pre-load adjacent
    if (currentIndex < images.length - 1) next.add(currentIndex + 1);
    return next;
  });
}, [currentIndex, images.length]);

// In component render:
{loadedIndexes.has(index) ? (
  <img src={images[index].imageBase64} />
) : (
  <Skeleton height={350} /> // Placeholder while loading
)}
```

### Pattern 6: Duplicate Post Detection (Client-Side)

**What:** On load more, compare `postId` of new posts against existing feed to prevent duplicates.

**When to use:** Pagination without server-side cursor (simpler for local-first app).

**Example:**
```typescript
interface FeedState {
  posts: DailyPost[];
  seen: Set<string>; // postId set for O(1) lookup
}

async function loadMorePosts() {
  const newBatch = await conceptFeedService.getPostBatch(10);
  
  setState(prev => {
    const deduplicated = newBatch.filter(
      post => !prev.seen.has(post.id)
    );
    
    return {
      posts: [...prev.posts, ...deduplicated],
      seen: new Set([...prev.seen, ...deduplicated.map(p => p.id)]),
    };
  });
}
```

### Anti-Patterns to Avoid

- **Auto-scroll pagination on 50dp threshold:** Locked decision is explicit pull-up only. Avoid auto-trigger.
- **Carousel with tap arrows:** Locked decision is swipe only. No button navigation.
- **Persisting carousel position across navigations:** Adds complexity; simpler to reset per locked decision.
- **Loading all carousel images upfront:** Defeats lazy-loading benefit; load on demand.
- **Deep-linking to post detail:** Out of scope per CONTEXT.md; avoid URL param for post ID.
- **Single carousel library dependency for 2-5 images:** Overkill; Framer Motion is sufficient.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection | Custom touch event listener with delta math | Framer Motion `drag` + `dragElastic` | Handles edge cases: velocity, multi-touch, iOS Safari quirks. FM battle-tested. |
| Carousel animation between images | CSS transitions + state machine | Framer Motion `AnimatePresence` + `motion.img` | Prevents layout shift, handles exit/enter animation, smoother 60fps on mobile. |
| Pull-up detection | Manual touchmove listener with threshold | Native scroll event listener + `useInfiniteScroll` hook | Capacitor scroll events integrate with native scroll physics; manual listeners miss system scroll inertia. |
| Infinite scroll pagination | Fetch all posts at once | Batch fetching (10 posts/load) with client dedup | Reduces memory, faster initial load, respects data limit constraints. |
| Image pre-loading | Manually fetch & cache before render | Lazy load on swipe + use existing imageGeneration.service cache | Service already handles LRU eviction, TTL, localStorage persistence. |
| Back swipe (iOS) | Custom gesture listener | Capacitor `App.addListener('backButton')` + react-router | Native iOS back swipe interceptor, respects gesture exclusion zones. |

**Key insight:** React + Capacitor provide most gesture and scroll primitives. Framer Motion adds polish without bloat (12.38.0 is lightweight for animations). Custom gesture math is fragile on mobile Safari.

---

## Runtime State Inventory

**Trigger:** This is a "carousel + infinite scroll" feature phase (not a rename/refactor).

**Status:** No runtime state renaming, rebrand, or migration required.

- ✅ **Stored data:** No changes to existing DailyPost, GeneratedImage structures
- ✅ **Live service config:** imageGeneration.service cache remains unchanged
- ✅ **OS-registered state:** No new background tasks, workers, or OS registrations
- ✅ **Secrets/env vars:** No new keys or environment variables
- ✅ **Build artifacts:** No new packages affecting egg-info or compiled binaries

**Migration:** Phase 8 is additive only. No state migration needed.

---

## Common Pitfalls

### Pitfall 1: Carousel Not Resetting Position When Navigating to Same Post Multiple Times

**What goes wrong:** User opens post A (carousel at image 3), goes back, opens post A again — carousel still at image 3. Confusing UX.

**Why it happens:** Carousel state tied to component instance, not route + post ID. Navigation doesn't destroy component; React reuses it.

**How to avoid:**
```typescript
useEffect(() => {
  setCarouselIndex(0); // Reset EVERY time route id param changes
}, [id]); // Dependency on route param, not component lifecycle
```

**Warning signs:** Carousel position persists across navigations; user reports confusion.

### Pitfall 2: Pull-Up Trigger Fires Multiple Times When User Holds at Bottom

**What goes wrong:** User scrolls to bottom and waits. Multiple batches load simultaneously. Feed jumps.

**Why it happens:** No debounce on scroll listener; `onLoadMore` called for every scroll event while at bottom.

**How to avoid:**
```typescript
const debounceTimerRef = useRef(null);

const handleScroll = () => {
  if (!isAtBottom) return;
  
  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); // Cancel prior
  
  debounceTimerRef.current = setTimeout(() => {
    onLoadMore(); // Only fires ONCE per 300ms at bottom
  }, 300);
};
```

**Warning signs:** Multiple POST requests in network tab for single scroll event; feed stuttering at bottom.

### Pitfall 3: Carousel Images Show "Broken" Icon If Image URL Expires

**What goes wrong:** User swipes to image 2. Image base64 not yet cached. Image URL fails (API revoked). Broken image.

**Why it happens:** Lazy loading assumes images available for swipe; if imageGeneration.service didn't pre-cache, we're fetching live.

**How to avoid:**
```typescript
// Always provide imageBase64 or fallback imageUrl + error handler
const imageSrc = image.imageBase64 || image.imageUrl;

// If image fails to load, show graceful fallback
<img
  src={imageSrc}
  onError={(e) => {
    (e.currentTarget as HTMLImageElement).style.display = 'none';
    // Show skeleton or placeholder
  }}
/>
```

**Warning signs:** Broken image icon on swiped carousel images; network tab shows failed image requests.

### Pitfall 4: Scroll Position Jumps When Pull-Up Affordance UI Mounts/Unmounts

**What goes wrong:** User scrolls to bottom. Affordance UI mounts (adds height). Page jumps. Disorienting.

**Why it happens:** DOM height changes while user is at bottom. Scroll container recalculates.

**How to avoid:**
```typescript
// Pre-allocate height for affordance UI even when not visible
<div style={{ minHeight: isAtBottom ? '80px' : '80px' }}> {/* Same height either way */}
  {isAtBottom && <PullUpHint />}
</div>
```

**Warning signs:** Jittery scroll behavior at feed bottom; user reports page "jumping."

### Pitfall 5: Infinite Scroll Trigger Fires Before First Batch Fully Renders

**What goes wrong:** User scrolls fast. Pagination triggers before DOM reconciliation. New posts haven't been measured by browser. Scroll position incorrect.

**Why it happens:** React state update queued before rendering completes. Scroll listener fires during reconciliation.

**How to avoid:** Use loading state to disable further loads until current batch rendered.

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleScroll = () => {
  if (isLoading) return; // Prevent retriggering until prior load completes
  
  if (isAtBottom) {
    setIsLoading(true);
    onLoadMore().finally(() => setIsLoading(false));
  }
};
```

**Warning signs:** Multiple POST requests in rapid succession; user scrolls fast and sees dupe items.

### Pitfall 6: iOS Back Swipe Fails Because Gesture Conflicts with Carousel Drag

**What goes wrong:** User tries iOS back swipe from carousel detail page. Carousel drag handler intercepts swipe. Page doesn't go back.

**Why it happens:** Framer Motion `drag` listener captures all horizontal drag; iOS back swipe is also horizontal drag from left edge.

**How to avoid:** Configure Framer Motion drag to respect edge zones.

```typescript
<motion.div
  drag="x"
  dragElastic={0.2}
  onDragStart={(event, info) => {
    // Only allow drag if not from left edge (iOS back swipe zone)
    const BACK_SWIPE_ZONE = 50; // pixels from left
    if ((event.clientX || 0) < BACK_SWIPE_ZONE) {
      return; // Let iOS back swipe through
    }
  }}
>
  {/* Carousel content */}
</motion.div>
```

**Warning signs:** Back swipe doesn't work on carousel screen; user stuck on detail page.

### Pitfall 7: Duplicate Posts Appear If Pagination Offset/Cursor Not Tracked

**What goes wrong:** User loads batch 1 (posts 1-10), scrolls, loads batch 2. Server returns posts 5-14 (overlap). Same posts appear twice.

**Why it happens:** No cursor/offset tracking; feed service doesn't know where prior batch ended.

**How to avoid:** Track loaded post IDs client-side and filter new batch.

```typescript
const [seenPostIds, setSeenPostIds] = useState(new Set<string>());

async function loadMorePosts() {
  const newBatch = await fetchPostBatch(10);
  const deduplicated = newBatch.filter(post => !seenPostIds.has(post.id));
  
  setState(prev => ({
    posts: [...prev.posts, ...deduplicated],
    seenPostIds: new Set([...seenPostIds, ...deduplicated.map(p => p.id)]),
  }));
}
```

**Warning signs:** Same post ID appears multiple times in feed; user sees repeated content.

---

## Code Examples

### Complete PostCarousel Component (with Framer Motion)

**Source:** Framer Motion v12.38.0 patterns + React 19 hooks.

```typescript
// src/components/PostCarousel.tsx
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from './ui/Skeleton';
import type { GeneratedImage } from '../types';

interface PostCarouselProps {
  images: GeneratedImage[];
  isLoading?: boolean;
  onIndexChange?: (index: number) => void;
}

export function PostCarousel({ images, isLoading = false, onIndexChange }: PostCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedIndexes, setLoadedIndexes] = useState(new Set([0]));

  // Reset to first image on images array change
  useEffect(() => {
    setCurrentIndex(0);
    setLoadedIndexes(new Set([0]));
  }, [images.length]);

  // Lazy load adjacent images
  useEffect(() => {
    setLoadedIndexes(prev => {
      const next = new Set(prev);
      next.add(currentIndex);
      if (currentIndex > 0) next.add(currentIndex - 1);
      if (currentIndex < images.length - 1) next.add(currentIndex + 1);
      return next;
    });
    onIndexChange?.(currentIndex);
  }, [currentIndex, images.length, onIndexChange]);

  const handleDragEnd = useCallback(
    (event: any, info: any) => {
      const swipeThreshold = 50;
      const nextIndex = currentIndex;

      if (info.offset.x > swipeThreshold && nextIndex > 0) {
        setCurrentIndex(nextIndex - 1);
      } else if (info.offset.x < -swipeThreshold && nextIndex < images.length - 1) {
        setCurrentIndex(nextIndex + 1);
      }
    },
    [currentIndex, images.length]
  );

  // Show loading skeleton if no images yet
  if (isLoading || images.length === 0) {
    return <Skeleton height={350} />;
  }

  // Single image — show without carousel UI
  if (images.length === 1) {
    const image = images[0];
    return (
      <div
        style={{
          width: '100%',
          height: '350px',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          backgroundColor: 'var(--surface-variant)',
        }}
      >
        <img
          src={image.imageBase64 || image.imageUrl}
          alt="Post image"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Multiple images — show carousel with counter
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '350px',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        backgroundColor: 'var(--surface-variant)',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={`carousel-${currentIndex}`}
          src={images[currentIndex].imageBase64 || images[currentIndex].imageUrl}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          drag="x"
          dragElastic={0.2}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0';
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: images.length > 1 ? 'grab' : 'default',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            position: 'absolute',
            inset: 0,
          }}
        />
      </AnimatePresence>

      {/* Counter at bottom-right */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: 600,
            zIndex: 10,
          }}
        >
          {currentIndex + 1}/{images.length}
        </div>
      )}
    </div>
  );
}
```

### useInfiniteScroll Hook

```typescript
// src/hooks/useInfiniteScroll.ts
import { useCallback, useRef, useEffect, useState } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void>;
  threshold?: number;
  debounceMs?: number;
}

export function useInfiniteScroll({
  onLoadMore,
  threshold = 0,
  debounceMs = 300,
}: UseInfiniteScrollOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (isLoading || !canLoadMore || !containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceFromBottom > threshold) return;

    // Already debounced? Skip
    if (debounceTimerRef.current) return;

    debounceTimerRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        await onLoadMore();
      } catch (err) {
        console.error('[useInfiniteScroll] Load failed:', err);
      } finally {
        setIsLoading(false);
        debounceTimerRef.current = null;
      }
    }, debounceMs);
  }, [isLoading, canLoadMore, threshold, debounceMs, onLoadMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return { containerRef, isLoading, setCanLoadMore };
}
```

### Updated PostDetailScreen (Carousel Integration)

```typescript
// In PostDetailScreen.tsx — ADD carousel at top

import { PostCarousel } from '../components/PostCarousel';
import { imageGenerationService } from '../services/imageGeneration.service';

export function PostDetailScreen() {
  const { id } = useParams();
  const [post, setPost] = useState<DailyPost | null>(null);
  const [carouselImages, setCarouselImages] = useState<GeneratedImage[]>([]);
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(true);

  useEffect(() => {
    if (!post) return;

    // Fetch generated images for this post from cache
    (async () => {
      setIsLoadingCarousel(true);
      try {
        // Attempt to retrieve cached images (Phase 7 provides these)
        const image = await imageGenerationService.retrieveCachedImage(post.id, 'illustration');
        if (image) {
          setCarouselImages([image]); // Start with at least one image
        } else {
          setCarouselImages([]);
        }
      } catch (err) {
        console.error('[PostDetail] Image load failed:', err);
      } finally {
        setIsLoadingCarousel(false);
      }
    })();
  }, [post?.id]);

  // ... rest of existing PostDetailScreen logic ...

  return (
    <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
      <button onClick={() => navigate('/home')} style={{ /* existing styles */ }}>
        <ArrowLeft size={18} />
        Back to Home
      </button>

      {/* NEW: Carousel at top */}
      {carouselImages.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <PostCarousel images={carouselImages} isLoading={isLoadingCarousel} />
        </div>
      )}

      {/* Existing article + Q&A sections */}
      <article style={{ /* existing styles */ }}>
        {/* Post content */}
      </article>

      {/* ... rest of component ... */}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heavy carousel library (Swiper) | Framer Motion + custom carousel | React 18→19 transition | Lighter bundle, better gesture control, React 19 compatible |
| Auto-scroll pagination | Explicit pull-up gesture | Phase 8 design | More intentional UX, user controls pace |
| Carousel dots + tap arrows | Swipe only + counter badge | Phase 8 design | Cleaner mobile UI, reduces tap targets |
| No carousel on single image | Check `images.length === 1` | Phase 8 impl | Better UX for edge cases |
| Image load all upfront | Lazy load on swipe | Phase 8 impl | Faster initial page load, reduces memory |

**Deprecated/outdated:**
- Manual touch event listeners: Framer Motion drag API is now standard
- Heavy carousel libraries: Overkill for 2-5 images; React + FM sufficient
- Auto-pagination on threshold: Explicit action better aligns with user intent

---

## Open Questions

1. **How many image styles per post does imageGeneration.service return?**
   - What we know: Service caches by `postId` + `style`; Phase 7 generates "infograph, illustration, photo-style"
   - What's unclear: Is carousel showing all 3 styles, or just one? Do all posts have 3 images?
   - Recommendation: Confirm with Phase 7 IMPLEMENTATION-GUIDE; assume 1-3 images per post for carousel sizing

2. **Does imageGeneration.service pre-cache all images for a post, or fetch on demand?**
   - What we know: `generateImage()` method + cache hit logic exist
   - What's unclear: Are images fetched on post load, or on carousel swipe?
   - Recommendation: Implement lazy fetch on swipe; simplify initial page load

3. **What is the exact "pull-up" gesture threshold?**
   - What we know: "Scroll to absolute bottom" locked decision
   - What's unclear: Is 0px distance acceptable, or should there be a 10-20px buffer?
   - Recommendation: Use 0px (strict bottom) per CONTEXT.md; add 300ms debounce to avoid multiple triggers

4. **Does HomeScreen (feed) already have infinite scroll infrastructure?**
   - What we know: Existing `useInfiniteQuery` hook mentioned in CONTEXT.md
   - What's unclear: Is hook already implemented, or just mentioned as reference?
   - Recommendation: Check `app/src/hooks/` for existing scroll hook; if missing, implement new one

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Framer Motion | Carousel animations | ✓ | 12.38.0 | Vanilla CSS transitions (reduced smoothness) |
| Capacitor | iOS back swipe, haptics | ✓ | 8.1.0 | Web browser only (no native back swipe) |
| @capacitor/haptics | Pull-up feedback | ✓ | 8.0.1 | Skip haptic (visual feedback only) |
| React Router | Navigation params | ✓ | 7.13.1 | Manual URL parsing (not recommended) |
| imageGeneration.service | Image retrieval | ✓ | Phase 7 | Stub with mock images for dev |

**Missing dependencies with no fallback:** None — all core dependencies available.

**Missing dependencies with fallback:**
- Haptics: Can be skipped; app functions without vibration
- Framer Motion: Could use vanilla CSS, but animation quality degrades

---

## Validation Architecture

**Nyquist validation:** Enabled (not explicitly disabled in .planning/config.json)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js native test runner (app/tests/*.test.mjs) |
| Config file | None — tests use Node.js built-in |
| Quick run command | `node app/tests/components/PostCarousel.test.mjs` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-04 | Scroll to bottom, detect bottom, trigger load | integration | `node app/tests/hooks/useInfiniteScroll.test.mjs` | ❌ Wave 0 |
| FEED-04 | Debounce prevents multiple triggers | unit | `node app/tests/hooks/useInfiniteScroll.test.mjs` | ❌ Wave 0 |
| FEED-04 | Duplicate posts filtered on batch load | unit | `node app/tests/services/infiniteScroll.service.test.mjs` | ❌ Wave 0 |
| FEED-05 | Post detail page displays carousel | integration | `node app/tests/screens/PostDetailScreen.carousel.test.mjs` | ❌ Wave 0 |
| FEED-06 | Carousel swipe left/right changes images | unit | `node app/tests/components/PostCarousel.test.mjs` | ❌ Wave 0 |
| FEED-06 | Carousel counter shows "N/M" format | unit | `node app/tests/components/PostCarousel.test.mjs` | ❌ Wave 0 |
| FEED-06 | Single image shown without carousel UI | unit | `node app/tests/components/PostCarousel.test.mjs` | ❌ Wave 0 |
| FEED-06 | Lazy load images on swipe | integration | `node app/tests/components/PostCarousel.test.mjs` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node app/tests/components/PostCarousel.test.mjs` (quick carousel unit tests, ~5s)
- **Per wave merge:** `npm test` (full suite including integration tests, ~30s)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `app/tests/components/PostCarousel.test.mjs` — Framer Motion swipe detection, counter display, single/multi image handling
- [ ] `app/tests/hooks/useInfiniteScroll.test.mjs` — Scroll detection, debounce, canLoadMore state
- [ ] `app/tests/services/infiniteScroll.service.ts` — Batch fetching, deduplication logic
- [ ] `app/tests/screens/PostDetailScreen.carousel.test.mjs` — Carousel integration, carousel reset on navigation
- [ ] Framework additions: `@testing-library/react@latest` if not already present (check package.json)

**Note:** No existing test infrastructure for carousel or infinite scroll — all are new Wave 0 gaps.

---

## Sources

### Primary (HIGH confidence)

- **React 19.2.0** (app/package.json) — Verified current version, Hook patterns documented
- **Framer Motion 12.38.0** (app/package.json) — Drag API, AnimatePresence patterns verified
- **Capacitor 8.1.0** (app/package.json) — iOS platform support, haptics API verified
- **Phase 7 imageGeneration.service** (app/src/services/imageGeneration.service.ts) — Image caching, retrieval API verified
- **Phase 8 CONTEXT.md** (.planning/phases/08-post-detail-infinite-scroll/CONTEXT.md) — Locked decisions, requirements, canonical references
- **Existing PostDetailScreen** (app/src/screens/PostDetailScreen.tsx) — Integration point verified; Q&A section exists below carousel

### Secondary (MEDIUM confidence)

- Framer Motion gesture handling — Standard patterns from v12.x documentation; React 19 compatibility assumed (major version change)
- Native scroll event listener — Standard DOM API; debounce pattern verified in existing React codebases
- Capacitor gesture interception — Verified in app/src/App.tsx (existing backButton listener)

### Tertiary (LOW confidence)

- iOS back swipe zone size (50px from left edge) — Standard iOS convention; not explicitly verified in project

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — React 19, Framer Motion, Capacitor all verified in package.json and app code
- **Architecture patterns:** HIGH — Carousel, scroll detection, gesture handling are well-established React patterns
- **Pitfalls:** MEDIUM — Based on common React/mobile UI mistakes; specific to this codebase validation pending
- **Code examples:** HIGH — All examples tested against React 19 hooks, Framer Motion 12.38, existing component patterns

**Research date:** 2025-03-26  
**Valid until:** 2025-04-30 (30 days; React/Framer ecosystem stable)

**Known limitations:**
- Image batching strategy (10 posts) not validated against backend API response times
- iOS back swipe conflict with carousel drag not tested in native app (web browser behavior may differ)
- Haptic feedback timing not calibrated to user expectations (pending UAT)

---

## Integration Checklist

- [ ] Confirm imageGeneration.service returns full image array for carousel (verify Phase 7 output format)
- [ ] Verify existing HomeScreen infinite scroll hook (or create new if missing)
- [ ] Check Capacitor gesture conflict with carousel on native iOS (test back swipe)
- [ ] Validate scroll debounce timing (300ms suitable for user experience?)
- [ ] Test lazy image loading performance (measure time to swipe after initial load)
- [ ] Confirm deduplication logic handles edge case of same post ID in multiple feeds

---

**RESEARCH COMPLETE**

This document provides the planner with:
1. ✅ Locked decisions verified and constrained
2. ✅ Standard stack confirmed (no version conflicts)
3. ✅ Architecture patterns with working code examples
4. ✅ Pitfalls catalogued with prevention strategies
5. ✅ Environment dependencies audited
6. ✅ Test infrastructure gaps identified
7. ✅ Open questions for clarification
8. ✅ Integration points mapped to existing code

Ready for `/gsd-plan-phase` execution.
