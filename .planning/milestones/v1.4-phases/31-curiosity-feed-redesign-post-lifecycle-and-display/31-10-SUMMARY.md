---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 10
subsystem: ui
tags: [llm, suggestion-cards, feed, vine-progress, empty-state]

requires:
  - phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
    provides: concept feed service, suggestion card component, vine progress component
provides:
  - LLM-generated novel suggestion topics (4 per card)
  - Correct empty state guard for fresh installs
  - Backdrop overlay for compact checklist expansion
affects: [concept-feed, home-screen, vine-progress]

tech-stack:
  added: []
  patterns:
    - "LLM-generated suggestion topics with fallback to cross-anchor questions"
    - "Backdrop overlay pattern for compact popover components"

key-files:
  created: []
  modified:
    - app/src/services/concept-feed.service.ts
    - app/src/components/SuggestionCard.tsx
    - app/src/screens/HomeScreen.tsx
    - app/src/components/VineProgress.tsx

key-decisions:
  - "Suggestion topics use chatCompletion with temperature 0.8 for creative variety"
  - "Fallback uses different-anchor questions (not siblings) for diversity"
  - "Backdrop uses 15% opacity black for subtlety"

patterns-established:
  - "LLM topic generation with JSON-only system prompt and array parsing"

requirements-completed: [D-24, D-43, D-03]

duration: 1min
completed: 2026-04-18
---

# Phase 31 Plan 10: UI/Content Bug Fixes Summary

**LLM-generated novel suggestion topics replacing existing QA titles, fresh install empty state fix, and compact checklist backdrop**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-18T09:31:35Z
- **Completed:** 2026-04-18T09:32:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Suggestion cards now show 4 LLM-generated novel topics instead of reusing existing QA sibling titles
- Fresh install no longer shows "Nothing new today" empty state when no questions exist yet
- Compact checklist expansion now shows a semi-transparent backdrop preventing accidental feed interaction

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate novel suggestion topics via LLM** - `f1e8fd03` (feat)
2. **Task 2: Fix fresh install empty state and compact checklist backdrop** - `9a9baf78` (fix)

## Files Created/Modified
- `app/src/services/concept-feed.service.ts` - LLM call for novel topic generation with fallback
- `app/src/components/SuggestionCard.tsx` - Display 4 topics instead of 3
- `app/src/screens/HomeScreen.tsx` - Guard empty state with questions.length > 0, reduce minHeight
- `app/src/components/VineProgress.tsx` - Add backdrop overlay when compact checklist expanded

## Decisions Made
- Used chatCompletion with temperature 0.8 for creative topic variety
- Fallback on LLM failure uses different-anchor questions (not siblings) for better diversity
- Backdrop opacity set to 15% for subtle but functional interaction blocking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected chatCompletion call signature**
- **Found during:** Task 1
- **Issue:** Plan showed chatCompletion returning ServiceResult but it returns raw string
- **Fix:** Used correct signature (messages, config, options) returning Promise<string>
- **Files modified:** app/src/services/concept-feed.service.ts
- **Verification:** tsc --noEmit passes

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction for API compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three bug fixes complete and verified
- Suggestion topics now properly use LLM for novel content

---
*Phase: 31-curiosity-feed-redesign-post-lifecycle-and-display*
*Completed: 2026-04-18*
