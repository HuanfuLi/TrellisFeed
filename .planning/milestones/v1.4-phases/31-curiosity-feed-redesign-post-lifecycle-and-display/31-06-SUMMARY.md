---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 06
subsystem: ui
tags: [react, video, scroll-fab, warm-start, loading-state, feed]

requires:
  - phase: 31-03
    provides: post-queue service with getYesterdayQueue, refillQueue pipeline
  - phase: 31-05
    provides: data-concept-id on feed cards, InlineInfoFlow updates

provides:
  - Inline landscape video playback (16:9) in feed cards
  - Video stop on swipe-away from Home tab
  - ScrollToTopFAB component for scroll-to-top after 400px
  - Warm start showing yesterday's queue on new day
  - Botanical loading state with pulse animation during generation
  - Error state with retry and feedback mailto link

affects: [HomeScreen, InfoFlow, feed-display]

tech-stack:
  added: []
  patterns: [swipeProgress MotionValue subscription for cross-tab video stop, warm-start fallback chain]

key-files:
  created:
    - app/src/components/ScrollToTopFAB.tsx
  modified:
    - app/src/components/InfoFlow.tsx
    - app/src/screens/HomeScreen.tsx

key-decisions:
  - "D-28: Landscape videos play inline via YouTube iframe embed, no essay generation triggered on play"
  - "D-29: Videos stop via swipeProgress MotionValue subscription (tab != 0) and document.visibilitychange"
  - "D-40: ScrollToTopFAB at 44x44px, bottom 96px, right 16px, 400px threshold, 200ms fade"
  - "D-30/D-31/D-32: Warm start chain: today cache -> yesterday queue (8 max) -> history (4 max)"
  - "D-41: Feedback mailto link in both loading and error states"

patterns-established:
  - "Video stop on swipe: subscribe to swipeProgress MotionValue from SwipeTabContext to detect tab changes"
  - "Warm start fallback: cache -> yesterday queue -> history, background generation continues"

requirements-completed: [D-28, D-29, D-30, D-31, D-32, D-40, D-41, D-35, D-36]

duration: 6min
completed: 2026-04-17
---

# Phase 31 Plan 06: Feed Display Features Summary

**Inline landscape video with 16:9 playback, warm-start fallback chain, botanical loading state, and scroll-to-top FAB**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-17T05:52:29Z
- **Completed:** 2026-04-17T05:58:30Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

### Task 1: Inline landscape video + video stop on swipe + ScrollToTopFAB
- **Commit:** `d8a23e46`
- Converted video posts from static thumbnail to inline 16:9 iframe playback (D-28)
- Added `videoPlaying` state management shared via props from InlineInfoFlow/ImmersiveInfoFlow to ConceptCard
- Video stop on swipe-away: subscribes to `swipeProgress` MotionValue from SwipeTabContext; when tab index != 0, clears `videoPlaying` state (D-29)
- Also stops on `document.visibilitychange` (browser tab switch)
- Created `ScrollToTopFAB` component: 44x44px circular button, appears after 400px scroll, smooth scroll-to-top (D-40)

### Task 2: Warm start + botanical loading state + feedback mailto
- **Commit:** `8b344916`
- Warm start fallback chain: today's cache -> yesterday's queue (max 8) -> post history (max 4) (D-30/D-31/D-32)
- Botanical loading state: SVG potted seedling with pulse animation during feed generation
- Error state: AlertCircle icon, retry button, and feedback mailto link
- Feedback mailto link in both loading and error states (D-41)
- ScrollToTopFAB wired to HomeScreen's `containerRef`
- Post history `purgeExpired()` called on mount

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all features are fully wired to real data sources.

## Self-Check: PASSED
