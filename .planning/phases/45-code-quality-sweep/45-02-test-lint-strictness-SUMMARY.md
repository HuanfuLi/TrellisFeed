---
phase: 45-code-quality-sweep
plan: 02
subsystem: testing
tags: [typescript, eslint, node-test, source-reading, concept-feed, lint]

requires:
  - phase: 45-code-quality-sweep
    provides: "Plan 45-01 audit artifacts identifying stale lint suppressions, stale tests, and concept-feed Node import failure"
provides:
  - "Unused-disable lint gate now exits 0 with only the known 24 warnings"
  - "Phase 42 canonical queue threshold and walker count of 24 reflected in source-reading tests"
  - "Image generation key-gate and trellis vine-color source-reading tests aligned with current contracts"
  - "concept-feed.service.ts direct same-directory local imports use .ts suffixes for Node test compatibility"
  - "Remaining concept-feed.test.mjs missing-export contract documented as a Task 3 follow-up"
affects:
  - phase-45-code-quality-sweep
  - concept-feed tests
  - source-reading strictness tests

tech-stack:
  added: []
  patterns:
    - "Use ESLint's --report-unused-disable-directives gate to close stale suppressions without changing runtime behavior"
    - "Keep source-reading tests exact when canonical constants change; update values rather than weakening assertions"
    - "Use .ts suffixes on same-directory service imports when a source file is imported directly by node:test"

key-files:
  created:
    - ".planning/phases/45-code-quality-sweep/45-02-test-lint-strictness-SUMMARY.md"
  modified:
    - "app/src/components/SwipeTabContainer.tsx"
    - "app/src/screens/HomeScreen.tsx"
    - "app/src/state/useTrellisData.ts"
    - "app/tests/services/concept-feed-source-diversity-wiring.test.mjs"
    - "app/tests/services/post-queue.test.mjs"
    - "app/tests/services/image-gen-key-gate.test.mjs"
    - "app/tests/services/trellis-layout.test.mjs"
    - "app/src/services/concept-feed.service.ts"
    - ".planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md"

key-decisions:
  - "Removed only the three stale lint suppressions identified by the unused-disable gate; no effect bodies or runtime logic changed."
  - "Treated CLAUDE.md's REFILL_THRESHOLD=24 and walkDerivedList(24, ...) as source of truth for stale Phase 42/43 tests."
  - "Did not reintroduce the removed buildFallbackPosts helper; documented the remaining concept-feed.test.mjs missing-export contract as a follow-up after import resolution."

patterns-established:
  - "Exact source-reading assertions stay valuable when they pin current contracts, but their scan windows must be wide enough for current file size."
  - "When Node direct import reaches a new stale test contract after fixing extensionless imports, document the narrowed blocker instead of masking it."

requirements-completed: [TECHDEBT-07, TECHDEBT-09]

duration: 5 min
completed: 2026-05-13
---

# Phase 45 Plan 02: Test Lint Strictness Summary

**Stale strictness blockers closed for lint and source-reading tests, with concept-feed Node import resolution narrowed to a documented missing-export follow-up.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-13T05:55:27Z
- **Completed:** 2026-05-13T06:00:32Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Removed three stale lint suppressions and verified `npm run lint -- --report-unused-disable-directives` exits 0.
- Updated stale tests to current canonical contracts: `walkDerivedList(24, exploredIds, dismissedIds)`, refill threshold `24`, exact image-gen enabled/key gate, and `VINE_COLOR_VARS`.
- Added `.ts` suffixes to direct same-directory local imports in `concept-feed.service.ts`, closing the original Node ESM extensionless import blocker.
- Recorded the remaining `concept-feed.test.mjs` missing `buildFallbackPosts` export as a follow-up because that helper was intentionally removed by commit `72f4795c`.

## Task Commits

1. **Task 1: Remove stale no-console lint disables only** - `ad4a3b22` (fix)
2. **Task 2: Update stale source-reading tests to current canonical values** - `1e783b48` (test)
3. **Task 3: Fix direct concept-feed extensionless local imports for node:test** - `d385cd76` (fix)

**Plan metadata:** pending final docs commit.

## Files Created/Modified

- `app/src/components/SwipeTabContainer.tsx` - Removed stale `no-console` disable before allowed `console.warn`.
- `app/src/screens/HomeScreen.tsx` - Removed unused exhaustive-deps disable from the mount-only gesture listener effect.
- `app/src/state/useTrellisData.ts` - Removed stale `no-console` disable before allowed `console.warn`.
- `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` - Updated walker counterweight to canonical count `24`.
- `app/tests/services/post-queue.test.mjs` - Updated `needsRefill` threshold test to canonical `24`.
- `app/tests/services/image-gen-key-gate.test.mjs` - Replaced loose key-gate regex with exact enabled/key checks and widened the source-reading window.
- `app/tests/services/trellis-layout.test.mjs` - Asserted `getVineColor` output against exported `VINE_COLOR_VARS`.
- `app/src/services/concept-feed.service.ts` - Added `.ts` suffixes to direct same-directory imports.
- `.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` - Added Task 1/2/3 closure evidence and Task 3 follow-up row.

## Decisions Made

- `console.warn` suppression comments were removed because `app/eslint.config.js` explicitly allows `warn` and `error`.
- The queue threshold source of truth is CLAUDE.md and `post-queue.service.ts`: `REFILL_THRESHOLD = 24`.
- The concept-feed direct import fix should not bring back removed fallback-post runtime behavior just to satisfy a stale test import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widened image-gen source-reading window**
- **Found during:** Task 2 (source-reading test updates)
- **Issue:** The test used a 6000-character slice after `refillQueue`; the exact `hasImageGenKey: imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent)` source existed but fell outside that slice in the current file.
- **Fix:** Widened the window to 10000 characters while keeping the exact-string assertion.
- **Files modified:** `app/tests/services/image-gen-key-gate.test.mjs`
- **Verification:** Targeted Task 2 suite passed 34/34.
- **Committed in:** `1e783b48`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug).
**Impact on plan:** The assertion stayed strict; only the scan window changed to match current file size.

## Issues Encountered

- `node --test tests/concept-feed.test.mjs` now reaches `concept-feed.service.ts` module instantiation, proving the extensionless local import blocker is closed. It then fails because `app/tests/concept-feed.test.mjs` imports `buildFallbackPosts`, which `concept-feed.service.ts` no longer exports after commit `72f4795c` ("Removed fallback posts"). This is documented in `45-TSC-AUDIT.md` as `Plan 45-02 Task 3 follow-up`.

## Authentication Gates

None.

## Known Stubs

None. Stub-pattern scan found only normal initializers, type literals, and test defaults in touched files.

## Verification Results

- `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs tests/services/post-queue.test.mjs tests/services/image-gen-key-gate.test.mjs tests/services/trellis-layout.test.mjs` - exits 0, 34/34 pass.
- `cd app && npx tsc -b --noEmit --pretty false` - exits 0.
- `cd app && npm run lint -- --report-unused-disable-directives` - exits 0 with 24 known warnings and 0 errors.
- `cd app && node --test tests/concept-feed.test.mjs` - exits 1 on documented follow-up: missing `buildFallbackPosts` export after extensionless import blocker was closed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 45-03 can proceed with dead-code/operator-note cleanup. The immediate stale lint and stale Phase 42/43 source-reading test blockers are closed; the remaining concept-feed test failure is narrowed to a stale removed-helper contract.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/45-code-quality-sweep/45-02-test-lint-strictness-SUMMARY.md`.
- Task commit `ad4a3b22` is present in git history.
- Task commit `1e783b48` is present in git history.
- Task commit `d385cd76` is present in git history.
- No generated files from this plan are left untracked; pre-existing unrelated untracked files remain untouched.

---
*Phase: 45-code-quality-sweep*
*Plan: 02-test-lint-strictness*
*Completed: 2026-05-13*
