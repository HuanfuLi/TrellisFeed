---
phase: 08-post-detail-infinite-scroll
plan: 01
subsystem: ui
tags: [framer-motion, carousel, infinite-scroll, react-hooks, image-generation, pagination]

# Dependency graph
requires:
  - phase: 07-post-feed-redesign-image-integration
    provides: imageGeneration.service.ts, GeneratedImage types, FeedPostImage component, image providers (NanoBanana/Gemini)

provides:
  - PostCarousel component (swipeable Framer Motion carousel with lazy loading and counter)
  - useInfiniteScroll hook (scroll detection, debounce, concurrent-load guard)
  - usePostCarousel hook (carousel state management, extracted for reuse)
  - infiniteScrollService (batch fetching with client-side deduplication)
  - PullUpHint affordance component (pull-up gesture indicator)
  - PostDetailScreen with carousel above essay content
  - HomeScreen with scroll-to-bottom infinite pagination

affects:
  - PostDetailScreen (carousel integrated)
  - HomeScreen (pagination redesigned from button to scroll-trigger)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Framer Motion AnimatePresence + drag=x for swipe gestures (no custom touch listeners)
    - questionsRef pattern for stable async callbacks in hooks (avoids scroll listener reset)
    - Promise.allSettled for resilient parallel cache fetches
    - Singleton service with initialize()/reset() lifecycle (infiniteScrollService)

key-files:
  created:
    - app/src/components/PostCarousel.tsx
    - app/src/components/PullUpHint.tsx
    - app/src/hooks/useInfiniteScroll.ts
    - app/src/hooks/usePostCarousel.ts
    - app/src/services/infiniteScroll.service.ts
    - app/src/types/carousel.ts
    - app/tests/components/PostCarousel.test.mjs
    - app/tests/hooks/useInfiniteScroll.test.mjs
    - app/tests/services/infiniteScroll.service.test.mjs
    - app/tests/screens/PostDetailScreen.carousel.test.mjs
    - app/tests/e2e/phase8.manual-uat.md
  modified:
    - app/src/screens/HomeScreen.tsx
    - app/src/screens/PostDetailScreen.tsx
    - app/src/types/index.ts (added Phase 7 IMAGE GENERATION DOMAIN types)
    - app/src/services/mock/settings.mock.ts (added imageGeneration config)

key-decisions:
  - "PostCarousel uses Framer Motion drag=x with 50px threshold (no custom touch listeners)"
  - "Single image displays statically without carousel UI or counter"
  - "Zero images: PostCarousel returns null, essay displays alone (graceful degradation)"
  - "Carousel lazy-loads adjacent images (current±1) to prevent pre-loading all images"
  - "infiniteScrollService wraps conceptFeedService.generateMorePosts() (no new batch API needed)"
  - "HomeScreen wrapped in 100dvh scroll container for containerRef attachment"
  - "questionsRef pattern used for stable onLoadMore callback (prevents scroll listener reset)"
  - "Phase 7 services/types copied into worktree (were missing from worktree; main repo had them)"

patterns-established:
  - "CarouselReset: useEffect on images.length resets currentIndex to 0 (locked decision)"
  - "StableCallbackRef: useRef for values in stable useCallback (avoids stale closure reset)"
  - "PassiveScroll: All scroll listeners use { passive: true } for performance"
  - "GracefulImageDegradation: error handler sets display:none silently (no error UI in carousel)"

requirements-completed: [FEED-04, FEED-05, FEED-06]

# Metrics
duration: 35min
completed: 2026-03-27
---

# Phase 8 Plan 01: Post Detail & Infinite Scroll Summary

**Swipeable Framer Motion image carousel in PostDetailScreen and scroll-to-bottom pagination with deduplication in HomeScreen, built with 21 new passing tests.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-27T02:34:10Z
- **Completed:** 2026-03-27T03:10:00Z
- **Tasks:** 8 completed
- **Files modified:** 13 (8 created, 5 modified)

## Accomplishments

1. **Test infrastructure (Task 0):** Created 4 test files (21 tests total across components, hooks, services, screens). Copied Phase 7 dependencies (imageGeneration.service, providers, FeedPostImage, types) missing from worktree.

2. **PostCarousel component (Task 1):** Framer Motion swipe gestures (50px threshold), AnimatePresence slide transitions (300ms), counter badge "N/M" at bottom-right, lazy-load adjacent images, skeleton loading state, graceful single/zero image handling. 8 tests pass.

3. **useInfiniteScroll hook (Task 2):** Passive scroll listener on containerRef, absolute bottom detection, 300ms debounce, concurrent-load guard via isLoadingRef, cleanup on unmount. 5 tests pass.

4. **infiniteScrollService (Task 3):** Singleton wrapping conceptFeedService.generateMorePosts(), client-side deduplication via seenPostIds Set, initialize()/reset() lifecycle. 4 tests pass.

5. **usePostCarousel hook (Task 4):** Extracted carousel state logic (currentIndex, loadedIndexes) into reusable hook with reset on imagesLength change.

6. **PullUpHint component (Task 5):** 80px min-height affordance, ArrowUp hint when at bottom, Loader2 spinner while loading.

7. **HomeScreen integration (Task 6):** Replaced "Load More" button with containerRef scroll container (100dvh), useInfiniteScroll hook, PullUpHint, questionsRef for stable callback, infiniteScrollService lifecycle.

8. **PostDetailScreen integration (Task 7):** PostCarousel mounted above article, fetches all image styles via Promise.allSettled, carousel resets on navigation, graceful degradation when no images cached.

9. **UAT checklist (Task 8):** Comprehensive manual test plan for iOS/Android covering all Phase 8 behaviors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 7 services missing from worktree**
- **Found during:** Task 0
- **Issue:** Worktree was created before Phase 7 merged. Services missing: imageGeneration.service.ts, imageGeneration.bootstrap.ts, postFormatting.service.ts, FeedPostImage.tsx, providers (gemini, nanoBanana, imageProvider.interface)
- **Fix:** Copied all Phase 7 files from main repo (`/Users/Code/EchoLearn/app/`) into worktree. Also updated settings.mock.ts and types/index.ts with Phase 7 additions.
- **Files modified:** 10 files copied
- **Commit:** 9a1de6bf

**2. [Rule 1 - Bug] retrieveCachedImages method doesn't exist**
- **Found during:** Task 7
- **Issue:** Plan referenced `imageGenerationService.retrieveCachedImages(postId)` but the service only has `retrieveCachedImage(postId, style)` (single style)
- **Fix:** Used Promise.allSettled to fetch all 3 styles in parallel in PostDetailScreen, filtering null results
- **Files modified:** PostDetailScreen.tsx
- **Commit:** 0e5fbf19

**3. [Rule 1 - Bug] InlineInfoFlow onLoadMore/isLoadingMore props removed**
- **Found during:** Task 6
- **Issue:** HomeScreen previously passed `onLoadMore` and `isLoadingMore` to InlineInfoFlow (button-based). After switching to scroll-triggered loading, these props were no longer used.
- **Fix:** Removed those props from InlineInfoFlow usage in HomeScreen. The InlineInfoFlow component still has the props in its interface (backward compatible).
- **Files modified:** HomeScreen.tsx
- **Commit:** 6f1e0e2a

## Known Stubs

None — all features are wired to real services. No placeholder data or TODO stubs exist in the delivered code.

## Self-Check: PASSED

All files verified present:
- app/src/components/PostCarousel.tsx — FOUND
- app/src/components/PullUpHint.tsx — FOUND
- app/src/hooks/useInfiniteScroll.ts — FOUND
- app/src/hooks/usePostCarousel.ts — FOUND
- app/src/services/infiniteScroll.service.ts — FOUND
- app/src/types/carousel.ts — FOUND
- app/tests/components/PostCarousel.test.mjs — FOUND
- app/tests/hooks/useInfiniteScroll.test.mjs — FOUND
- app/tests/services/infiniteScroll.service.test.mjs — FOUND
- app/tests/screens/PostDetailScreen.carousel.test.mjs — FOUND
- app/tests/e2e/phase8.manual-uat.md — FOUND

All commits verified present:
- 9a1de6bf: chore(08-01): add Phase 7 dependencies and Phase 8 test infrastructure
- ae5c1ef9: feat(08-01): implement PostCarousel component with Framer Motion swipe gestures
- 5fe6ac23: feat(08-01): implement useInfiniteScroll hook with debounce and load guard
- fdd67a7f: feat(08-01): implement infiniteScrollService with batch fetching and deduplication
- 901d201c: feat(08-01): implement usePostCarousel hook for carousel state management
- cf32f5b7: feat(08-01): implement PullUpHint affordance component for feed pagination
- 6f1e0e2a: feat(08-01): integrate infinite scroll into HomeScreen feed
- 0e5fbf19: feat(08-01): integrate PostCarousel into PostDetailScreen above essay content
- de8e9984: chore(08-01): add Phase 8 manual UAT checklist for device testing

Test results: 21 tests, 0 failing, 0 skipped
