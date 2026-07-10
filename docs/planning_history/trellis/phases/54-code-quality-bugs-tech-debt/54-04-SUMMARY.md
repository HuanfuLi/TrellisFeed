---
phase: 54-code-quality-bugs-tech-debt
plan: 04
subsystem: testing
tags: [dead-code, eslint, no-console, tech-debt, scheduler, trajectory-analyzer]

# Dependency graph
requires:
  - phase: 54-code-quality-bugs-tech-debt (Plan 03)
    provides: scored tech-debt inventory (54-TECH-DEBT-INVENTORY.md) driving the FIX worklist
provides:
  - Deleted top-tier confirmed-dead code (usePlanner, ConnectionPostScreen, recordFeedView)
  - Lint-clean scheduler logging (console.log -> console.warn, 9 sites)
  - Removed stale eslint-disable in PodcastScreen
  - Inventory updated with RESOLVED dispositions + recorded operator decision (a-delete-warn)
affects: [55-recommendation-tuning, 56-polish-asset-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead-symbol deletion gated on word-boundary re-grep + storage-key reader re-check before removal"
    - "no-console rule: convert diagnostics to console.warn (console.info is NOT allowlisted)"

key-files:
  created:
    - .planning/phases/54-code-quality-bugs-tech-debt/deferred-items.md
  modified:
    - app/src/services/scheduler.service.ts
    - app/src/services/scheduler.native.ts
    - app/src/screens/PodcastScreen.tsx
    - app/src/services/trajectoryAnalyzer.service.ts
    - .planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md
  deleted:
    - app/src/state/usePlanner.ts
    - app/src/screens/ConnectionPostScreen.tsx

key-decisions:
  - "Operator selected a-delete-warn: delete recordFeedView export; convert scheduler console.log -> console.warn"
  - "Retained FEED_VIEWS_KEY/SIGNAL_CACHE_KEY/loadFeedViews — loadFeedViews is still read by the LIVE aggregateSignals, so the storage keys have other readers"

patterns-established:
  - "Before deleting a dead export that touches storage keys, re-grep each key/helper to confirm no other reader; delete only the truly-dead export"

requirements-completed: [TECHDEBT-13]

# Metrics
duration: ~25min
completed: 2026-05-21
---

# Phase 54 Plan 04: Top-Tier Tech-Debt Resolution Summary

**Deleted three confirmed-dead symbols (usePlanner, ConnectionPostScreen, recordFeedView), converted all 9 scheduler console.log calls to console.warn, and removed a stale PodcastScreen eslint-disable — dropping lint warnings from 28 to 18 with 0 errors and tsc green.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-21T00:33Z (approx)
- **Completed:** 2026-05-21T00:57Z
- **Tasks:** 1 auto task (checkpoint:decision pre-resolved by operator)
- **Files modified:** 6 (2 deleted, 4 edited) + 1 inventory + 1 new deferred-items doc

## Accomplishments
- Deleted `usePlanner` hook (`app/src/state/usePlanner.ts`) — deprecated Phase 26 D-22, 0 call sites confirmed by word-boundary re-grep; LIVE `usePlannerAutoGen` untouched.
- Deleted `ConnectionPostScreen` (`app/src/screens/ConnectionPostScreen.tsx`) — unrouted, 0 references, no unique exported type/util.
- Deleted dead `recordFeedView` export from `trajectoryAnalyzer.service.ts` per operator decision `a-delete-warn`; retained `FEED_VIEWS_KEY`, `SIGNAL_CACHE_KEY`, and `loadFeedViews()` because `loadFeedViews()` is still consumed by the LIVE `aggregateSignals`.
- Converted all 9 scheduler `console.log` calls (7 in `scheduler.service.ts`, 2 in `scheduler.native.ts`) to `console.warn` (allowlisted; `console.info` is not).
- Removed stale `@typescript-eslint/no-unused-vars` eslint-disable at `PodcastScreen.tsx:102` (underscore-prefix already exempt); left the unrelated `react-hooks/exhaustive-deps` disable intact.
- Updated `54-TECH-DEBT-INVENTORY.md`: B1/B2/B3/C1/C2/C3/C6 marked RESOLVED with commit-level notes; operator decision `a-delete-warn` recorded in the Tier Summary, Top Tier worklist, and Verification Log.

## Task Commits

1. **Task 1 (code): Delete dead code + clear scheduler/eslint warnings** — `159bf74f` (chore)
2. **Inventory + deferred-items doc update** — `5507031d` (docs)

## Files Created/Modified
- `app/src/state/usePlanner.ts` — DELETED (dead deprecated hook)
- `app/src/screens/ConnectionPostScreen.tsx` — DELETED (unrouted dead screen)
- `app/src/services/scheduler.service.ts` — 7 console.log → console.warn
- `app/src/services/scheduler.native.ts` — 2 console.log → console.warn
- `app/src/screens/PodcastScreen.tsx` — removed stale eslint-disable line
- `app/src/services/trajectoryAnalyzer.service.ts` — removed dead recordFeedView export (kept live keys/helper)
- `.planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md` — RESOLVED dispositions + operator decision
- `.planning/phases/54-code-quality-bugs-tech-debt/deferred-items.md` — NEW: logs out-of-scope pre-existing date-boundary test failures

## Decisions Made
- **Operator checkpoint `a-delete-warn`** (pre-resolved): (A) delete `recordFeedView`; (B) scheduler `console.log` → `console.warn`. Applied as instructed; checkpoint not paused on.
- **Retained storage keys / helper:** re-grep showed `loadFeedViews()` is read by the live `aggregateSignals`, so `FEED_VIEWS_KEY` and `SIGNAL_CACHE_KEY` still have readers — only the truly-dead `recordFeedView` export was removed. This is the plan's "re-grep each key before removing" instruction applied literally.

## Deviations from Plan

None - plan executed exactly as written. (The checkpoint:decision was pre-resolved by the operator as `a-delete-warn`; the retain-keys behavior is the explicit conditional path the plan specified for when keys have other readers.)

## Issues Encountered

**Pre-existing date/timezone-boundary test failures (out of scope).** The full suite reports 5 failing tests in `tests/services/review-overdue.test.mjs`, `tests/services/trellis-replant.test.mjs`, and a trellis-state test. All are `actual: '2026-05-19' vs expected: '2026-05-20'` style date-arithmetic mismatches caused by the executor wall-clock (`2026-05-20 20:55 EDT` == `2026-05-21 UTC`) crossing the UTC/local-midnight boundary against `today()`/`dyingSchedule()`. None of these test files import any file changed by this plan (scheduler, trajectoryAnalyzer, usePlanner, ConnectionPostScreen, PodcastScreen) — dead-code deletion and console.log→warn cannot affect SM-2 date math. Logged to `deferred-items.md` with a suggested fix (pin/freeze the test clock). The cleanup-relevant gates are green: `tsc -b --noEmit` passes, lint dropped 28→18 warnings with 0 errors.

## Verification Results
- `tsc -b --noEmit`: PASS (0 errors — no dangling import after deletions)
- `npm run lint`: 18 warnings (down from 28 baseline), 0 errors. The 9 scheduler console.log warnings + the PodcastScreen unused-vars warning cleared. The one remaining `trajectoryAnalyzer.service.ts` console.debug warning (in the live `computeWeakAreas`) is pre-existing and out of scope.
- `grep "\busePlanner\b" src tests`: no matches; `grep "ConnectionPostScreen" src tests`: no matches.
- `grep -c "console.log"` scheduler files: 0 / 0.
- `grep "eslint-disable-next-line @typescript-eslint/no-unused-vars" PodcastScreen.tsx`: no match.
- `git diff --name-only`: does NOT list `usePlannerAutoGen.ts` or `PlannerScreen.tsx` (both unchanged).
- `npm test`: 5 pre-existing date-boundary failures (documented above, out of scope); all tests touching changed files pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Top tier of the TECHDEBT-13 inventory is resolved; below-tier items remain formally re-accepted in the inventory.
- Phase 55 (TUNE-02 recommendation/feed work) may re-add the trajectory-analytics seam (`recordFeedView`) if it wires a call site; the storage keys and `loadFeedViews()` reader remain in place.
- Recommend pinning the test clock for the date-sensitive review/trellis tests (deferred-items.md) so CI is stable across the midnight boundary.

## Self-Check: PASSED
- `app/src/state/usePlanner.ts` — confirmed GONE (deleted)
- `app/src/screens/ConnectionPostScreen.tsx` — confirmed GONE (deleted)
- `.planning/phases/54-code-quality-bugs-tech-debt/deferred-items.md` — confirmed FOUND (created)
- Commit `159bf74f` — confirmed FOUND
- Commit `5507031d` — confirmed FOUND

---
*Phase: 54-code-quality-bugs-tech-debt*
*Completed: 2026-05-21*
