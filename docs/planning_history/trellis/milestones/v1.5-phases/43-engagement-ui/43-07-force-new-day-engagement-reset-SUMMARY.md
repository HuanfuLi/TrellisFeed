---
phase: 43-engagement-ui
plan: 07
subsystem: settings
tags: [engagement, force-new-day, dev-affordance, reset, sc-6]

# Dependency graph
requires:
  - phase: 39-engagement-service-walker-extension
    provides: engagementService.reset() — full-granularity wipe of saves + likes + dismisses (D-08)
  - phase: 43-engagement-ui/43-01
    provides: Wave-0 test scaffold + DS-01 ROADMAP/REQUIREMENTS doc state
provides:
  - SettingsDataScreen.handleForceNewDay extended to also call engagementService.reset() alongside dailyReadService.reset()
  - Source-reading invariant test locking ordering (dailyReadService.reset → engagementService.reset → success toast)
  - Closes Phase 43 SC-6 (ENGAGE-02 reset path) — Force-New-Day dev affordance now mimics every wall-clock side effect engagement state would lose at midnight
affects: [43-08 (phase close-out — final remaining plan)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-affordance-mimics-wall-clock-event reset pattern (extended from Phase 36-13/14/15 daily-read + post-queue + daily-posts-cache to engagement state)"
    - "Source-reading invariant test with function-anchor extraction (const handleForceNewDay → `  };` body terminator) — same anchor-pair pattern as Phase 36-14/15 lessons"

key-files:
  created:
    - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs (filled from Wave-0 scaffold; 4 source-reading invariants)
  modified:
    - app/src/screens/settings/SettingsDataScreen.tsx (2 narrow edits: import + reset call inside handleForceNewDay)

key-decisions:
  - "Granularity stays as-spec'd per Phase 39 D-08 — reset() wipes saves + likes + dismisses in one call; no resetDismissedOnly() opportunistic addition"
  - "Toast copy left unchanged ('vine progress reset') — minimal-diff principle; copy refinement is operator-UAT-gated rather than executor-pre-emptive"
  - "engagementService.reset() ordered AFTER dailyReadService.reset() so the toast renders after ALL resets complete — preserves the synchronous-side-effects-then-feedback shape of the existing handler"

patterns-established:
  - "Source-reading test anchored on `const handleForceNewDay` declaration + `  };` body terminator — function-scope slice prevents matches in unrelated handlers (e.g., the `dailyReadService.reset()` callsite in the 'Reset Today' button handler at line 306)"

requirements-completed: [ENGAGE-02]

# Metrics
duration: ~2 min
completed: 2026-05-11
---

# Phase 43 Plan 07: Force-New-Day Engagement Reset Summary

**SettingsDataScreen.handleForceNewDay extended to call engagementService.reset() alongside dailyReadService.reset() so the Force-New-Day dev affordance produces a fully cold-start cohort per Phase 39 D-08.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-11T04:17:21Z
- **Completed:** 2026-05-11T04:19:02Z
- **Tasks:** 2
- **Files modified:** 2 (1 source + 1 test)

## Accomplishments

- **handleForceNewDay extension** — added `engagementService.reset()` call inside the try block at line 138, positioned AFTER `dailyReadService.reset()` (line 134) and BEFORE the success toast (line 139). Two narrow edits to `SettingsDataScreen.tsx`: import line (line 17) + 4-line block inside handler (lines 135-138 including 3-line explanatory comment).
- **Source-reading invariant test** — replaced the Wave-0 skip stub with 4 real source-reading assertions: (1) `engagementService` import grep, (2) reset() call lives inside handleForceNewDay (function-anchor extraction), (3) ordering — reset → reset → toast (indexOf comparison), (4) exactly-one call (no duplicate accumulation).
- **SC-6 closed** — ENGAGE-02 reset path now structurally complete. Phase 43's final non-close-out plan landed; only 43-08 (phase close-out) remains.

## Task Commits

Each task was committed atomically:

1. **Task 1: handleForceNewDay extension** — `9cf26914` (feat)
2. **Task 2: Test scaffold fill-in** — `a65019cd` (test)

## Files Created/Modified

- `app/src/screens/settings/SettingsDataScreen.tsx` — import line 17 (new); engagementService.reset() call at line 138 inside handleForceNewDay (new); explanatory 3-line comment at lines 135-137 referencing Phase 43 SC-6 + Phase 39 D-08 granularity.
- `app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — replaced 27-line Wave-0 skip stub with 67-line filled test file. 4 tests, 4/4 green, exit 0.

## Decisions Made

- **Source-reading test scope anchored on `const handleForceNewDay` + `  };`** — function-body slice prevents false-positive matches on the `dailyReadService.reset()` callsite at line 306 (the "Reset Today" button handler). Phase 36-14/15 anchor-pair pattern preserved.
- **Toast copy retained verbatim** — plan explicitly marked copy refinement as optional and UAT-gated. Kept minimal-diff; if operator pushes back during UAT that "vine progress reset" feels misleading once saves/likes are also wiped, copy can be extended in a follow-up plan without touching the reset wiring.
- **No additional handler audited** — `handleClearAllData` at line 51 already wipes engagement state structurally (it clears all `trellis_*` localStorage keys including `trellis_engagement_v1`); the "Reset Today" button at line 297-309 intentionally only resets `dailyReadService` + `postQueueService` (today-scoped reset, NOT a full cold-start). engagementService.reset() in handleForceNewDay is the ONLY new call site this plan introduces.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed on first attempt; no Rule 1-4 deviations triggered.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Dev-only affordance gated by `import.meta.env.DEV`; never reaches production users.

## Next Phase Readiness

- Phase 43 ready for close-out via Plan 43-08.
- All 6 success criteria (SC-1 LP-* + SC-2 SV-* + SC-3 DD-* + SC-5 ANCHOR_DISMISSED re-sync + SC-6 engagementService.reset() + SC-7 TS-01 tile simplification) now structurally complete across plans 43-01..43-07.
- DS-01 doc-state edits already landed in 43-01 Wave 0; no doc-state cleanup carries into 43-08.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/43-engagement-ui/43-07-force-new-day-engagement-reset-SUMMARY.md`
- Test file exists at `app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs`
- Commit `9cf26914` (Task 1 feat) exists in git log
- Commit `a65019cd` (Task 2 test) exists in git log

---
*Phase: 43-engagement-ui*
*Plan: 07-force-new-day-engagement-reset*
*Completed: 2026-05-11*
