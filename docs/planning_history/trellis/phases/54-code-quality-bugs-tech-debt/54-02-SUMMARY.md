---
phase: 54-code-quality-bugs-tech-debt
plan: 02
subsystem: testing
tags: [bug-audit, regression-tests, concept-feed, always-mounted-resync, trellis-credits, node-test]

# Dependency graph
requires:
  - phase: 54-code-quality-bugs-tech-debt
    provides: 54-RESEARCH.md bug-audit surfaces (5 risk clusters) + 54-PATTERNS.md test analogs
provides:
  - Whole-codebase bug audit doc (54-BUG-AUDIT.md) with FIX/LOG/NOT-A-BUG dispositions per cluster
  - Behavior-observing regression guards for concept-feed bonus-cap, walker len=0/maxSteps, HomeScreen empty-feed gate
  - Fix for PlannerScreen stale credit balance on navigation + its regression test
affects: [55-algorithm-tuning, 56-ui-polish, 57-rewards-data-model, 58-rewards-shop-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-helper inline-algorithm mirror for testing service edges blocked by transitive i18n/Capacitor deps"
    - "Bounded source-reading region-slice for screen-level invariants where a runtime render is impractical"
    - "Canonical [location.pathname] resync effect for always-mounted SwipeTabContainer slots reading mutable service state"

key-files:
  created:
    - .planning/phases/54-code-quality-bugs-tech-debt/54-BUG-AUDIT.md
    - app/tests/services/concept-feed-bonus-cap.test.mjs
    - app/tests/services/walker-empty-derived-list.test.mjs
    - app/tests/screens/HomeScreen.empty-questions-no-error.test.mjs
    - app/tests/screens/PlannerScreen.credits-resync.test.mjs
  modified:
    - app/src/screens/PlannerScreen.tsx

key-decisions:
  - "OQ#3 resolved as FIX: PlannerScreen credit balance is stale on navigation (HomeScreen daily-read award is the off-screen mutator); fixed with the canonical [location.pathname] resync, no new event"
  - "scheduler console.log lint, dead cancelNativeNotifications, cosine thresholds (Phase 55), and UI/nav (Phase 56) recorded as LOG — out of QUALITY-01 bug-fix scope"
  - "Concept-feed edges (bonusCap=0, anchors=0, walker len=0/maxSteps) confirmed NOT-A-BUG; tests are pinning guards, not fix-drivers"

patterns-established:
  - "Pattern 1: regression tests observe corrected RUNTIME behavior (pure-helper mirrors of the live algorithm), not source-string greps, for service edges"
  - "Pattern 2: always-mounted screens reading mutable service state get a [location.pathname] resync effect (extend, never duplicate; one signal per semantic event)"

requirements-completed: [QUALITY-01]

# Metrics
duration: ~35min
completed: 2026-05-20
---

# Phase 54 Plan 02: Code Quality Bug Audit Summary

**Whole-codebase bug audit across the 5 RESEARCH.md risk clusters with three behavior-observing concept-feed regression guards, plus a fix for the PlannerScreen stale-credit-balance navigation bug.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 1 (PlannerScreen.tsx)
- **Files created:** 5 (1 audit doc + 4 tests)

## Accomplishments
- Authored `54-BUG-AUDIT.md` covering Clusters 1–6 + a broader sweep, each with an explicit FIX/LOG/NOT-A-BUG disposition and reasoning.
- Resolved RESEARCH.md open question #3: the harvest-credit display on PlannerScreen could show a stale balance after a daily-read credit was earned on HomeScreen while Planner was off-screen → confirmed bug, FIXED.
- Added three behavior-observing regression guards (bonus-cap gate, empty/maxSteps walker, HomeScreen empty-feed error gate) that pin RESEARCH-confirmed-correct concept-feed edges against future regression.
- Fixed PlannerScreen with the canonical `[location.pathname]` resync effect (no new event) and added a regression test observing the corrected behavior.
- Full suite green (1635 tests, 0 fail), `tsc -b --noEmit` clean, dual-vector security guard (`filter-classifier.unit.test.mjs`) still 25/25.

## Task Commits

1. **Task 1: Whole-codebase bug audit + findings doc** - `03d42d5a` (docs)
2. **Task 2 (TDD pinning guards): three concept-feed/HomeScreen edge tests** - `d031278e` (test)
3. **Task 2 (TDD fix): PlannerScreen credit resync + regression test** - `eb5d9230` (fix)

_Note: Task 2 is a TDD task; the three pinning guards (which mirror already-correct live code) landed first, then the RED→GREEN fix for the one confirmed bug landed as a separate commit._

## Files Created/Modified
- `.planning/phases/54-code-quality-bugs-tech-debt/54-BUG-AUDIT.md` - Audit findings, 5 clusters + broader sweep, FIX/LOG/NOT-A-BUG per item, FIX→test traceability table.
- `app/tests/services/concept-feed-bonus-cap.test.mjs` - Pure-helper mirror of the allExplored/bonusCap gate (anchors=0, bonusCap=0, partial-explored cases).
- `app/tests/services/walker-empty-derived-list.test.mjs` - Pure-helper mirror of walkDerivedList (len=0 → [], maxSteps=Math.max(count*2,len) GAP-B guard).
- `app/tests/screens/HomeScreen.empty-questions-no-error.test.mjs` - Bounded source-slice asserting the generationError gate requires `questions.length > 0`.
- `app/tests/screens/PlannerScreen.credits-resync.test.mjs` - Asserts the `[location.pathname]==='/planner'` credit resync effect and the no-new-event constraint.
- `app/src/screens/PlannerScreen.tsx` - Added `useLocation` + a `[location.pathname]` resync effect re-reading `trellisCreditsService.getTotal()` on `/planner` navigation.

## Decisions Made
- **OQ#3 → FIX, not LOG.** Evidence: HomeScreen's vine-completion handler calls `trellisCreditsService.add(1)` while Planner is off-screen; PlannerScreen's `credits` came only from a boot-once `useState` initializer with no resync. This is the exact CLAUDE.md always-mounted-screen-resync bug class, so it was fixed in-plan.
- **Followed the "extend, never duplicate" rule with judgment.** PlannerScreen had *zero* prior `[location.pathname]` resync effect, so adding the single canonical effect is the minimal correct fix (not a duplicate; no new event introduced — `add()` stays the sole credit mutator).
- **Phase-boundary discipline.** Cosine thresholds (Phase 55) and UI/nav/spacing (Phase 56) findings were LOGged, not touched. Security invariants (dual-vector, normalizeAnchorName) verified intact.

## Deviations from Plan

None — plan executed as written. The plan explicitly anticipated that Task 1's audit might surface a FIX-disposition bug (the trellisCreditsService stale-balance resync) and Task 2 implemented exactly that minimal fix, plus the three pinning guards. No deviation rules were triggered.

## Issues Encountered
- **Worktree had no `node_modules`.** The full suite and `tsc` initially failed with `ERR_MODULE_NOT_FOUND` (`@capacitor/core`, etc.) because the parallel-executor worktree lacks an install. Resolved by symlinking `node_modules` from the main checkout (`/Users/Code/EchoLearn/app/node_modules`); the symlink is gitignored and not committed. After the symlink, `npm test` exits 0 (1635 tests pass) and `tsc -b --noEmit` exits 0.
- **HomeScreen test slice initially matched the wrong `getDailyPosts(...).then` call site** (there are three). Re-anchored the region-slice on the unique "Error-gate suppression (Phase 36 GAP-A)" comment and the block-form `}).catch((err) => {`, isolating the guarded main-effect gate. Tests pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- QUALITY-01 complete: audit recorded, the one confirmed bug fixed with a regression test, the three highest-risk concept-feed edges pinned, full suite + tsc green.
- LOG items handed off: scheduler `console.log` lint cleanup, dead `cancelNativeNotifications`, cosine thresholds → Phase 55, UI/nav → Phase 56.
- The `[location.pathname]` credit-resync pattern is now in place on PlannerScreen — relevant groundwork for the Phase 57/58 rewards shop, which will read/display credit balances.

## Self-Check: PASSED

All created files exist and all task commits are present:
- `54-BUG-AUDIT.md`, `54-02-SUMMARY.md`
- `concept-feed-bonus-cap.test.mjs`, `walker-empty-derived-list.test.mjs`, `HomeScreen.empty-questions-no-error.test.mjs`, `PlannerScreen.credits-resync.test.mjs`
- `PlannerScreen.tsx` (modified)
- Commits: `03d42d5a` (audit), `d031278e` (pinning guards), `eb5d9230` (fix), `9aec2cdb` (summary)
- Verification: `npm test` exit 0 (1635 tests, 0 fail), `tsc -b --noEmit` exit 0, dual-vector guard 25/25.

---
*Phase: 54-code-quality-bugs-tech-debt*
*Completed: 2026-05-20*
