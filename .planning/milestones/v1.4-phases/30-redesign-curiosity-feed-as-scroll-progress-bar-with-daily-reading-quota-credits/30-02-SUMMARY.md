---
phase: 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
plan: 02
subsystem: ui
tags: [react, progress-card, intersection-observer, event-bus, reading-detection, confetti, trellis-credits]
dependency_graph:
  requires:
    - phase: 30-01
      provides: dailyReadService, getAnchorIdForPost, getConceptQuota, CONCEPT_EXPLORED event, home.feed i18n keys
  provides:
    - ConceptProgressCard component with expanded/compact sticky states
    - Three reading detectors in PostDetailScreen (scroll 70%, dwell 30s, follow-up question)
    - HomeScreen progress tracking with celebration (gold bar + confetti + toast + credit)
    - Removed CURIOSITY FEED gradient island from InlineInfoFlow
  affects: [HomeScreen, PostDetailScreen, InfoFlow, trellis-credits]
tech_stack:
  added: []
  patterns: [IntersectionObserver-sentinel-for-sticky-collapse, idempotent-event-emission, dwell-timer-with-cleanup]
key_files:
  created:
    - app/src/components/ConceptProgressCard.tsx
  modified:
    - app/src/screens/HomeScreen.tsx
    - app/src/screens/PostDetailScreen.tsx
    - app/src/components/InfoFlow.tsx
key_decisions:
  - "Used IntersectionObserver sentinel with rootMargin -HEADER_HEIGHT for sticky compact/expanded toggle — avoids fixed header overlap"
  - "Three independent reading detectors (scroll sentinel, dwell timer, follow-up question) — first to fire wins via idempotent emitExplored helper"
  - "Gradient island only removed from InlineInfoFlow (HomeScreen variant) — full-page InfoFlow still has it since it may be used elsewhere"
patterns_established:
  - "IntersectionObserver sentinel pattern for sticky card state transitions with anti-flicker initial position check"
  - "Idempotent event emission with hasEmittedRef guard + dailyReadService.isExplored double-check"
requirements-completed: [D-04, D-07, D-08, D-09, D-10, D-11, D-13, D-14, D-15, D-16, D-17, D-18, D-20]
duration: 3m 22s
completed: 2026-04-17
---

# Phase 30 Plan 02: Concept Progress Card UI + Reading Detectors Summary

**ConceptProgressCard with sticky expanded/compact states, three PostDetailScreen reading detectors (scroll 70%, dwell 30s, follow-up Q), HomeScreen celebration (gold bar + confetti + credit), and CURIOSITY FEED island removal from InlineInfoFlow.**

## Performance

- **Duration:** 3m 22s
- **Started:** 2026-04-17T14:00:19Z
- **Completed:** 2026-04-17T14:03:41Z
- **Tasks:** 2 of 2 auto tasks complete (Task 3 is checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments
- ConceptProgressCard renders expanded (icon + title + label + 8px bar) and compact (icon + counter + 6px bar) states via IntersectionObserver + CSS sticky at HEADER_HEIGHT
- PostDetailScreen emits CONCEPT_EXPLORED idempotently for three triggers: scroll sentinel at 70% essay depth, 30s dwell timer, and follow-up question submission
- HomeScreen subscribes to CONCEPT_EXPLORED, derives progress from dailyReadService, triggers celebration (gold #E8A838 bar + confetti + toast + 1 trellis credit) on completion
- Empty state with Sparkles icon when feed has posts but no concept posts (D-17)
- Removed gradient CURIOSITY FEED island from InlineInfoFlow component

## Task Commits

1. **Task 1: Create ConceptProgressCard + wire HomeScreen** - `923dd2c2` (feat)
2. **Task 2: Add reading detectors to PostDetailScreen + remove island** - `dd2d85b0` (feat)

## Files Created/Modified
- `app/src/components/ConceptProgressCard.tsx` - Sticky progress card with expanded/compact states via IntersectionObserver
- `app/src/screens/HomeScreen.tsx` - Progress state management, CONCEPT_EXPLORED subscriber, celebration logic, empty state
- `app/src/screens/PostDetailScreen.tsx` - Three reading detectors (scroll 70%, dwell 30s, follow-up question)
- `app/src/components/InfoFlow.tsx` - Removed gradient CURIOSITY FEED island from InlineInfoFlow

## Decisions Made
- Used IntersectionObserver sentinel with rootMargin -HEADER_HEIGHT for sticky compact/expanded toggle to account for fixed header
- Three independent detectors share a single idempotent emitExplored helper with hasEmittedRef guard
- Gradient island only removed from InlineInfoFlow (HomeScreen); full-page InfoFlow variant retains it since it is used in other contexts
- Anti-flicker: synchronous getBoundingClientRect check on mount to set initial compact state before observer fires

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components and detectors are fully implemented.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (checkpoint:human-verify) pending visual verification
- All automated acceptance criteria pass
- Vite build and all tests (daily-read, bundle-parity) pass

---
*Phase: 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits*
*Completed: 2026-04-17*
