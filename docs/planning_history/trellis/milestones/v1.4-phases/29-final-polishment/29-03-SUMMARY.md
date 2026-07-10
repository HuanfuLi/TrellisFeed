---
phase: 29-final-polishment
plan: "03"
subsystem: types, services, build
tags: [typescript, tsc, node25, imports, extensions]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: locale infrastructure, event bus types, i18next setup
provides:
  - GRAPH_UPDATED in AppEvent union (closes TS2345/TS2322)
  - COVERAGE_ERROR in ErrorCode union (closes TS2322)
  - Clean tsc compilation for 4 target files
  - Node 25 compatible imports for 5 test files
affects: [29-04-PLAN, v1.4-backlog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit .ts extensions on intra-src imports for Node 25 TS-stripping compatibility"

key-files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/screens/GraphScreen.tsx
    - app/src/services/canonical-knowledge.service.ts (no edit -- type-checks via union additions)
    - app/src/services/review.service.ts
    - app/src/services/trellis-state.service.ts
    - app/src/providers/llm/index.ts
    - app/src/services/concept-feed.service.ts
    - app/src/services/youtube.service.ts
    - app/src/services/news.service.ts
    - app/src/services/web-search.service.ts
    - app/src/services/trajectoryAnalyzer.service.ts
    - app/src/services/flashcard.service.ts
    - app/src/locales/index.ts
    - app/tests/canonical-knowledge.test.mjs

key-decisions:
  - "GRAPH_UPDATED added as payload-less variant to AppEvent (confirmed from canonical-knowledge.service.ts:710 emit shape)"
  - "Mock Question in trellis-state.service.ts fixed by adding missing required fields (answer, summary, date, timestamp) rather than using as unknown as Question"
  - "ALL_LEAF_STATES deleted (unused, no external consumers confirmed via grep)"
  - "Stale test dates in canonical-knowledge.test.mjs fixed: q-1 moved to 2020-01-01 (always due), q-2 moved to 2099-12-31 (never due) to prevent future date-sensitivity breakage"
  - "4 remaining tsc errors (AskScreen, PlannerScreen, SettingsFeaturesScreen, SettingsScreen) are pre-existing and outside D-04 scope boundary -- deferred to v1.4"

patterns-established:
  - "Extension addition scope: only files in failing-test import chain, not codebase-wide (D-05)"
  - "No Node loader or tsconfig moduleResolution changes (D-19 hard veto)"

requirements-completed: [PRE-EXISTING-TSC, PRE-EXISTING-NODE25]

# Metrics
duration: 12min
completed: 2026-04-17
---

# Phase 29 Plan 03: TSC Error Closure + Node 25 Extension Fix Summary

**Closed 8 tsc errors across 4 target files and fixed 5 previously-failing Node 25 tests via explicit .ts import extensions in 8 service files**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-17T03:17:23Z
- **Completed:** 2026-04-17T03:30:00Z
- **Tasks:** 4 (3 implementation + 1 verification)
- **Files modified:** 14 (13 source + 1 test)

## Accomplishments

- Added GRAPH_UPDATED to AppEvent union and COVERAGE_ERROR to ErrorCode union, closing 3 type errors in canonical-knowledge.service.ts and GraphScreen.tsx
- Fixed 5 additional tsc errors: unused ArrowLeft import (GraphScreen), dead q?.anchorId reference (review.service), unused FlashCard import + ALL_LEAF_STATES const + incomplete mock Question cast (trellis-state.service)
- Added .ts extensions to 24 import specifiers across 8 files in the failing-test import chain, enabling 5 previously-unloadable Node 25 tests to pass
- Reduced total tsc -b errors from 12 to 4 (remaining 4 are pre-existing in unrelated files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GRAPH_UPDATED and COVERAGE_ERROR to type unions** - `d085da2f` (feat)
2. **Task 2: Fix tsc errors in 4 target files** - `a6fa862a` (fix)
3. **Task 3: Add .ts extensions to 8 files for Node 25** - `8055f030` (fix)
4. **Task 4: Regression gate** - no commit (verification-only)

## Files Created/Modified

- `app/src/types/index.ts` - Added GRAPH_UPDATED to AppEvent, COVERAGE_ERROR to ErrorCode
- `app/src/screens/GraphScreen.tsx` - Removed unused ArrowLeft import
- `app/src/services/review.service.ts` - Replaced dead q?.anchorId with q?.parentId
- `app/src/services/trellis-state.service.ts` - Removed unused FlashCard import, deleted ALL_LEAF_STATES, added missing Question fields to mock
- `app/src/providers/llm/index.ts` - Added .ts extensions to token-usage.service and locale-directive imports
- `app/src/locales/index.ts` - Added .ts extensions to locale and settings.service imports
- `app/src/services/flashcard.service.ts` - Added .ts extensions to 7 imports (date, event-bus, toast, locales/index, settings, llm/index, question)
- `app/src/services/trajectoryAnalyzer.service.ts` - Added .ts extensions to question.service and flashcard.service imports
- `app/src/services/news.service.ts` - Added .ts extensions to 5 imports
- `app/src/services/web-search.service.ts` - Added .ts extension to settings.service import
- `app/src/services/youtube.service.ts` - Added .ts extensions to 6 imports
- `app/src/services/concept-feed.service.ts` - Added .ts extensions to 6 imports
- `app/tests/canonical-knowledge.test.mjs` - Fixed stale date-sensitive test data

## Decisions Made

- GRAPH_UPDATED is payload-less (confirmed from canonical-knowledge.service.ts:710 emit shape `{ type: 'GRAPH_UPDATED' }`)
- Mock Question fix preferred adding real field values over `as unknown as Question` cast (matches project convention)
- ALL_LEAF_STATES deleted entirely (no consumers found via grep)
- Test date fix used extreme dates (2020/2099) to prevent future date-sensitivity breakage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale date-sensitive test data in canonical-knowledge.test.mjs**
- **Found during:** Task 3 (Node 25 extension fix verification)
- **Issue:** Test `getDueProjectedFlashcards` used hardcoded dates (2026-03-22, 2026-03-24) that were both in the past as of 2026-04-16, causing unexpected `dueCards.length === 2` instead of expected 1
- **Fix:** Changed q-1 nextReviewDate to `2020-01-01` (always due) and q-2 to `2099-12-31` (never due)
- **Files modified:** app/tests/canonical-knowledge.test.mjs
- **Verification:** Test passes consistently regardless of current date
- **Committed in:** 8055f030 (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Essential fix -- test was previously hidden behind ERR_MODULE_NOT_FOUND and became visible only after extension fix. No scope creep.

## Deferred Issues

The following tsc errors are pre-existing and outside D-04 scope boundary (not in the 4 target files):

1. `src/screens/AskScreen.tsx(652,26): error TS2345` - Type argument mismatch with i18next t() overload
2. `src/screens/PlannerScreen.tsx(1,10): error TS6133` - Unused useEffect import
3. `src/screens/settings/SettingsFeaturesScreen.tsx(26,23): error TS6133` - Unused setReviewLimit
4. `src/screens/SettingsScreen.tsx(4,39): error TS6133` - Unused Palette import

These should be addressed in v1.4 backlog.

## Issues Encountered

- Worktree missing node_modules symlink: resolved by symlinking from main repo's app/node_modules
- `npm run build` fails on `tsc -b` step due to 4 pre-existing errors in unrelated files -- `npx vite build` alone succeeds (2.88s). This is a pre-existing condition, not a regression.
- 5 target tests require `--import ./tests/services/_capacitor-mock-loader.mjs` flag to mock `@capacitor/core` -- plain `node --test` cannot resolve the package. This is a pre-existing test infrastructure limitation.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- 4 target files compile clean via tsc
- 5 previously-failing Node 25 tests now pass (with capacitor mock loader)
- Vite build green (2.88s)
- D-19 preserved: no Node loader or tsconfig moduleResolution changes
- 4 pre-existing tsc errors in unrelated files deferred to v1.4

---
*Phase: 29-final-polishment*
*Completed: 2026-04-17*

## Self-Check: PASSED

All 12 modified files exist. All 3 task commits verified (d085da2f, a6fa862a, 8055f030).
