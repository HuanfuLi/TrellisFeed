---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 05
subsystem: ui
tags: [react, svg, vine, progress, animation]

requires:
  - phase: 31-03
    provides: daily-read service, concept exploration tracking, ConceptProgressCard
provides:
  - VineProgress component with inline SVG vine, expand/collapse checklist
  - data-concept-id attributes on InfoFlow post cards for scroll-to-concept
  - Replaced ConceptProgressCard and CompactProgressBar with VineProgress
affects: [31-06, 31-07]

tech-stack:
  added: []
  patterns: [organic SVG progress visualization, dual-mode component (inline/compact)]

key-files:
  created: [app/src/components/VineProgress.tsx]
  modified: [app/src/screens/HomeScreen.tsx, app/src/components/InfoFlow.tsx]

key-decisions:
  - "Derived concept names from questionsById map (title or content slice) since dailyReadService only tracks anchor IDs"
  - "Kept data-concept-progress-card wrapper div on inline VineProgress for backward-compatible scroll detection"

patterns-established:
  - "VineProgress dual-mode pattern: mode='inline' (48px) vs mode='compact' (36px) from same component"
  - "data-concept-id on InfoFlow cards enables scroll-to-concept via document.querySelector"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-09, D-47]

duration: 4min
completed: 2026-04-18
---

# Phase 31 Plan 05: VineProgress Summary

**Horizontal vine SVG with potted plant, flowers at concept milestones, expand/collapse checklist, and gold completion state replacing ConceptProgressCard**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-18T01:47:31Z
- **Completed:** 2026-04-18T01:51:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created VineProgress component with inline SVG vine illustration (potted plant, leaves, flowers, fruit)
- Two rendering modes (inline card 48px, compact header 36px) from a single component
- Tap-to-expand concept checklist with strikethrough for explored concepts and scroll-to-concept on tap
- Gold completion state (#E8A838) with bloom animation and fruit icons
- Replaced ConceptProgressCard and CompactProgressBar entirely in HomeScreen
- Added data-concept-id attributes to InfoFlow post cards

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VineProgress component** - `6fccecec` (feat)
2. **Task 2: Wire VineProgress into HomeScreen + add data-concept-id to InfoFlow** - `28d594e8` (feat)

## Files Created/Modified
- `app/src/components/VineProgress.tsx` - New vine SVG progress component with dual modes, checklist, accessibility
- `app/src/screens/HomeScreen.tsx` - Replaced ConceptProgressCard/CompactProgressBar with VineProgress, added conceptList derivation and handleConceptTap
- `app/src/components/InfoFlow.tsx` - Added data-concept-id attribute to post card wrappers

## Decisions Made
- Derived concept names from questionsById map using title or content slice, since dailyReadService only stores anchor IDs without names
- Kept data-concept-progress-card wrapper on inline VineProgress for backward-compatible scroll detection in the sticky header logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data is wired from existing dailyReadService and questionsById.

## Next Phase Readiness
- VineProgress is ready for integration with history screen (D-37 onHistoryTap wired to navigate('/history'))
- data-concept-id attributes enable scroll-to-concept from any component that queries the DOM

---
*Phase: 31-curiosity-feed-redesign-post-lifecycle-and-display*
*Completed: 2026-04-18*

## Self-Check: PASSED
