---
phase: 54-code-quality-bugs-tech-debt
reviewed: 2026-05-21T01:19:58Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - app/src/lib/date.ts
  - app/src/screens/ConnectionPostScreen.tsx
  - app/src/screens/PlannerScreen.tsx
  - app/src/screens/PodcastScreen.tsx
  - app/src/services/review.service.ts
  - app/src/services/scheduler.native.ts
  - app/src/services/scheduler.service.ts
  - app/src/services/trajectoryAnalyzer.service.ts
  - app/src/services/trellis-state.service.ts
  - app/src/state/usePlanner.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 54: Code Review Report

**Reviewed:** 2026-05-21T01:19:58Z
**Depth:** deep
**Files Reviewed:** 10 source files (+7 test files cross-checked)
**Status:** clean (2 advisory Info items)

## Summary

Phase 54 (Code Quality, Bugs & Tech Debt) is a clean, low-risk maintenance pass. I verified every load-bearing concern raised in the brief and found no Critical or Warning defects. Specifically: (1) the injectable clock in `lib/date.ts` defaults to `() => Date.now()` and is never set anywhere in `src/` — production behavior is byte-for-byte unchanged when the test hook is unset; (2) the three deletions (`usePlanner.ts`, `ConnectionPostScreen.tsx`, `recordFeedView`) leave zero dangling references (grep + `tsc -b --noEmit` both clean), and the live `usePlannerAutoGen.ts` is correctly preserved; (3) the `PlannerScreen` credit resync faithfully implements the canonical `[location.pathname]` always-mounted-screen pattern documented in CLAUDE.md, reads from the same `getTotal()`/localStorage source that `add()` writes, and introduces no parallel event (one-signal-per-event preserved) — no race with the foreground harvest path; (4) the `console.log`→`console.warn` conversions and the `eslint-disable` removal in `PodcastScreen.tsx` are safe (the `_qa`/`_ct` rest-destructure is covered by `varsIgnorePattern: '^_'` + `ignoreRestSiblings`). All 7 touched/new tests pass with the correct harness, `tsc -b --noEmit` exits 0, and lint shows only one pre-existing warning. No CLAUDE.md invariant is regressed. The two Info items below are minor and non-blocking.

## Info

### IN-01: `trellis-state.service.ts` blossom-date write switched from UTC to local date — benign and arguably an improvement, but a silent behavior change worth recording

**File:** `app/src/services/trellis-state.service.ts:232,261`
**Issue:** The phase replaced `new Date().toISOString().split('T')[0]` (a **UTC** YYYY-MM-DD) with `today()` (a **local** YYYY-MM-DD) at the two blossom-date persistence sites. This is not flagged as part of the stated phase intent (the intent describes routing "now" through the injectable clock, not changing the date basis). For users in negative UTC offsets near midnight, the stored blossom date can now differ by one calendar day from the prior implementation.
**Why it's not a bug:** The read side already constructs the comparison date locally — `computeLeafState` parses `blossomSinceDate` via `new Date(by, bm-1, bd)` (local) at line 76 and compares against `nowMs()` (local). So the write was previously UTC while the read was local — a latent inconsistency. Switching the write to `today()` makes the round-trip basis consistent (local on both sides), which is the correct direction. The fruit-promotion threshold (`daysSince >= 7`) is unaffected at the day granularity in the overwhelming majority of cases.
**Fix:** No code change required. Recommend a one-line note in the phase summary that the blossom-date basis moved UTC→local so it isn't mistaken for a regression later. If strict cross-midnight reproducibility ever matters, add a pinned-clock test asserting `today()` and the read-side parse agree on the same epoch.

### IN-02: Adjacent `console.debug` left unconverted in a file the phase edited

**File:** `app/src/services/trajectoryAnalyzer.service.ts:113`
**Issue:** The phase converted 9 scheduler `console.log` calls to `console.warn` to satisfy the `no-console` lint rule (warn/error only), and edited `trajectoryAnalyzer.service.ts` to delete `recordFeedView`. But a `console.debug(...)` at line 113 in that same file still trips the lint rule — `npx eslint` reports exactly one warning here. It is pre-existing (outside the diff hunks) and lint exits 0 (warning, not error), so it does not block, but the phase had the file open and the same class of cleanup in scope.
**Fix:** Convert to an allowed method or drop it:
```ts
// app/src/services/trajectoryAnalyzer.service.ts:113
console.warn(`[Planner] Weak areas: ${pct}% (${weakAreaIds.length}/${questions.length})`);
```
Or remove the debug line entirely if the metric is no longer useful.

---

## Verification log (for the record)

- `git diff --name-only` scope confirmed: 10 src files + 7 test files.
- Dangling-reference grep for `recordFeedView`, `ConnectionPostScreen`, and `usePlanner` (excluding the preserved `usePlannerAutoGen`): no matches in `src/` or `tests/`.
- Deleted files confirmed absent on disk: `src/state/usePlanner.ts`, `src/screens/ConnectionPostScreen.tsx`.
- Injectable clock: `__setNowForTesting` / `nowMs` referenced only in `lib/date.ts` (definition + internal use) and in 3 test files; **no production caller sets the clock**. Default provider is `() => Date.now()`.
- Test clock discipline: all 3 pinning test files use `before(() => __setNowForTesting(fixedMs))` / `after(() => __setNowForTesting(null))` — no leaked pinned clock.
- `PlannerScreen` resync matches the canonical HomeScreen pattern: `useEffect(..., [location.pathname])`, gated on `=== '/planner'`, reads `trellisCreditsService.getTotal()`. The harvest path (`add()` persists to localStorage synchronously before `onCreditsChange`) shares the same source, so the resync cannot read a stale-vs-optimistic mismatch; harvest only fires while Planner is foreground, the resync only fires on navigation — no race.
- `PodcastScreen` eslint-disable removal is safe: `_qa`/`_ct` match `varsIgnorePattern: '^_'` and are rest-sibling destructures (`ignoreRestSiblings: true`).
- `tsc -b --noEmit` → exit 0.
- `npx eslint` on the 8 touched source files → 0 errors, 1 pre-existing warning (IN-02).
- Tests: `review-overdue`, `trellis-state`, `PlannerScreen.credits-resync`, `HomeScreen.empty-questions-no-error`, `concept-feed-bonus-cap`, `walker-empty-derived-list` → 39 pass / 0 fail; `trellis-replant` via `_actions-mock-loader.mjs` → 6 pass / 0 fail.

_Reviewed: 2026-05-21T01:19:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
