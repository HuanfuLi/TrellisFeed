---
phase: 42-masonry-feed-layout
plan: 03
subsystem: ui
tags: [react, framer-motion, css-keyframes, animation, masonry, info-flow, d-06]

# Dependency graph
requires:
  - phase: 42-masonry-feed-layout
    provides: "Plan 42-01 — MasonryFeed.tsx skeleton with framer-motion entrance animations on leaf tiles; export keywords on MemoizedConceptCard / ConnectionCard / MilestoneCard"
provides:
  - "Single animation system for feed entrance (framer-motion at MasonryFeed wrapper level)"
  - "Zero CSS @keyframes card-slide-in references anywhere in app/src/"
  - "Cleared the path for Plan 42-05 source-reading invariant test (no-card-slide-in.test.mjs)"
affects: [42-05, 43-engagement-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-06: one animation system per layer — framer-motion at the masonry wrapper, never paired with parallel CSS keyframes that would dueling-animate"
    - "Underscore-prefix-rename for newly-unused destructured props that must remain in the prop interface (prop kept for React.memo equality + JSX call site; local binding marked unused per existing _feedIndex convention)"

key-files:
  created: []
  modified:
    - "app/src/index.css — @keyframes card-slide-in block + preceding comment removed (lines 503-507)"
    - "app/src/components/InfoFlow.tsx — 3 inline-style animation properties removed (was lines 197 / 329 / 858); ConceptCard's destructured isActive renamed to _isActive to silence TS6133 (the prop interface, React.memo comparator at line 563, and JSX call site at line 862 are unchanged)"

key-decisions:
  - "Auto-fix Rule 1 in Task 2: rename ConceptCard's destructured 'isActive' → '_isActive' to silence TS6133. The plan asserted 'isActive is consumed elsewhere in the card body (e.g., for image loading state)' — verified empirically that statement is incorrect: in ConceptCard specifically, 'isActive' was destructured at line 73 but only consumed by the now-deleted animation expression at line 197. The PROP itself (ConceptCardProps.isActive at line 69, React.memo equality comparator at line 563, JSX call site at line 862) is preserved verbatim — only the unused local binding is renamed using the project's existing underscore-prefix unused-arg convention (matches sibling _feedIndex on the same line)."
  - "Pre-existing tsc errors in MasonryFeed.tsx (12 errors, all home.celebration.* i18n keys not yet declared in en.json + i18n.d.ts) are SIBLING-WAVE work owned by Plan 42-04 (vine-bloom-card-and-i18n) and explicitly out of scope per CLAUDE.md scope-boundary rule. Confirmed via grep: zero tsc errors in InfoFlow.tsx after Task 2."
  - "Cross-tree negative grep is the load-bearing acceptance check — `grep -rc 'card-slide-in' app/src/` returns 0 across the entire src tree (was 4 — 1 in index.css + 3 in InfoFlow.tsx). Plan 42-05 will lock this with the source-reading invariant test."
  - "Both commits used --no-verify per parallel-execution protocol (orchestrator validates pre-commit hooks once after all Wave 2 agents complete)."
  - "Strict file-staging discipline: explicit `git add app/src/index.css` (Task 1) and `git add app/src/components/InfoFlow.tsx` (Task 2) — never `git add -A` or `.` — to avoid capturing sibling-agent staged writes (lesson from Plan 38-02 commit 01d870e5)."

patterns-established:
  - "Underscore-prefix unused-binding rename: when a prop's sole consumer is deleted but the prop must remain in the interface (for memo equality, JSX call-site type-check, future use), rename only the destructured local — `isActive: _isActive` — instead of removing the prop or weakening the interface."

requirements-completed: [MASONRY-01]

# Metrics
duration: 2.7min
completed: 2026-05-10
---

# Phase 42 Plan 03: card-slide-in Removal Summary

**Deleted the legacy `@keyframes card-slide-in` CSS animation + all 3 InfoFlow.tsx callsites — leaves framer-motion as the sole feed-entrance animation system per D-06 (one animation system, not two).**

## Performance

- **Duration:** 2.7 min
- **Started:** 2026-05-10T01:24:09Z
- **Completed:** 2026-05-10T01:26:49Z
- **Tasks:** 2
- **Files modified:** 2 (`app/src/index.css`, `app/src/components/InfoFlow.tsx`)

## Accomplishments

- Removed the 4-line `@keyframes card-slide-in` block (plus its `/* Card entering the viewport */` comment) from `app/src/index.css` — keyframes count dropped 24 → 23; all other keyframes preserved verbatim.
- Removed 3 inline-style `animation:` properties from `app/src/components/InfoFlow.tsx` (one each in MemoizedConceptCard render, ConceptCard video/text-art branch, InlineInfoFlow tile wrapper).
- Cross-tree negative grep `grep -rc "card-slide-in" app/src/` returns 0 — D-06 satisfied (one animation system, not two; framer-motion at the MasonryFeed wrapper now handles ALL feed-entrance animation).
- Cleared the path for Plan 42-05's source-reading invariant test (`no-card-slide-in.test.mjs`) which will lock this invariant against future drift.

## Task Commits

Each task was committed atomically (parallel-execution protocol: --no-verify):

1. **Task 1: Delete @keyframes card-slide-in from app/src/index.css** — `6bf7f761` (refactor)
2. **Task 2: Delete 3 card-slide-in animation callsites from app/src/components/InfoFlow.tsx** — `2fb5df8c` (refactor; also folded the Rule 1 _isActive rename auto-fix)

**Plan metadata commit:** to follow (close-out commit captures SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

- `app/src/index.css` — Deleted lines 503-507 (`/* Card entering the viewport */` comment + `@keyframes card-slide-in { from {...} to {...} }`). Net: 6 deletions, 0 insertions.
- `app/src/components/InfoFlow.tsx` — Deleted 3 inline `animation:` properties; renamed ConceptCard's destructured `isActive` → `_isActive`. Net: 4 deletions, 1 insertion.

## Decisions Made

- **Underscore-rename (Rule 1 auto-fix) over prop removal.** TS6133 fired on ConceptCard's destructured `isActive` once its sole consumer (the deleted animation expression) was gone. Two options: (a) remove the prop entirely from `ConceptCardProps`, or (b) rename only the local destructure. Chose (b) because the prop is still passed by InfoFlow at line 862 (`isActive={shouldAnimate}`), is read by React.memo's equality comparator at line 563 (`prev.isActive === next.isActive`), and removing it would touch sibling-Wave files (`InlineInfoFlow` JSX) outside this plan's scope. Underscore prefix matches the project's existing unused-arg convention (sibling `_feedIndex` on the same line 73).
- **Pre-existing MasonryFeed.tsx tsc errors are out-of-scope.** Twelve TS2345 errors in `MasonryFeed.tsx` reference `home.celebration.*` i18n keys not yet present in `en.json` / `i18n.d.ts`. These belong to Plan 42-04 (vine-bloom-card-and-i18n, in flight by sibling agent). Per CLAUDE.md scope-boundary rule ("Only auto-fix issues DIRECTLY caused by the current task's changes"), they were NOT touched. Verified via `npx tsc -b --noEmit | grep InfoFlow` returning empty — Task 2 introduced zero new tsc errors.
- **--no-verify on both commits** per the parallel-execution protocol declared by the orchestrator. Sibling Wave 2 agents (42-02 HomeScreen swap, 42-04 vine-bloom-card-and-i18n) are running concurrently; orchestrator validates pre-commit hooks once after all agents complete.
- **Strict file-staging discipline** (lesson from Plan 38-02 close decision on parallelism artifact): explicit `git add app/src/index.css` and `git add app/src/components/InfoFlow.tsx` only — never `git add -A` or `.`. The working tree contains numerous sibling-agent in-progress writes (MasonryFeed.tsx, HomeScreen.tsx, .DS_Store, Android resource files); none were captured by either of my commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ConceptCard's destructured `isActive` becomes unused after Task 2 deletion → TS6133 error**

- **Found during:** Task 2 (delete 3 card-slide-in animation callsites)
- **Issue:** The plan's instruction text claimed `isActive` is "consumed elsewhere in the card body (e.g., for image loading state), so DO NOT remove the prop itself or other references to it." Empirical verification: in ConceptCard specifically (`function ConceptCard({ post, feedIndex: _feedIndex = 0, isActive, onOpen, ...} ` at line 73), the destructured local was ONLY consumed by the deleted animation expression at line 197. After Task 2's deletion, `tsc -b --noEmit` flagged `src/components/InfoFlow.tsx(73,57): error TS6133: 'isActive' is declared but its value is never read.`
- **Fix:** Renamed the destructured local from `isActive` to `_isActive` (project convention for unused-but-required destructure bindings — matches sibling `_feedIndex` on the same line). The PROP is preserved on `ConceptCardProps.isActive` (line 69), the React.memo equality comparator at line 563 still reads `prev.isActive === next.isActive`, and the JSX call site at line 862 still passes `isActive={shouldAnimate}`. Only the local binding name changed; runtime behavior is byte-identical.
- **Files modified:** `app/src/components/InfoFlow.tsx` (1 line: line 73 destructure)
- **Verification:** `cd app && npx tsc -b --noEmit 2>&1 | grep InfoFlow` returns empty (zero tsc errors in InfoFlow.tsx). The remaining 12 tsc errors are all in `MasonryFeed.tsx` and reference `home.celebration.*` i18n keys (sibling-Wave Plan 42-04 territory, out of scope).
- **Committed in:** `2fb5df8c` (folded into Task 2 commit per atomic-commit discipline).

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1: deletion of sole consumer left the destructured local unused, violating noUnusedLocals tsconfig setting).

**Impact on plan:** Auto-fix was necessary for tsc green and is structurally trivial (single-character underscore prefix on a local binding name; zero runtime impact). The plan's optimistic claim about `isActive` being consumed elsewhere in ConceptCard was incorrect — but the inverse claim (the prop must be preserved on the interface and at call sites) IS still load-bearing and was honored. No scope creep.

## Issues Encountered

- **Pre-existing tsc errors in sibling-Wave files.** When verifying Task 2, `npx tsc -b --noEmit` reported 12 errors in `app/src/components/MasonryFeed.tsx` and `app/src/screens/HomeScreen.tsx`. Investigation confirmed these are work-in-progress writes from Wave 2 sibling agents (Plan 42-02 HomeScreen swap, Plan 42-04 i18n + vine-bloom-card additions). Per CLAUDE.md scope-boundary rule, NOT touched. Will resolve when sibling agents commit. Stash-based baseline check (`git stash && tsc -b --noEmit && git stash pop`) showed the errors are entirely owned by sibling work-tree files, not by my deletions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **D-06 fully satisfied.** Cross-tree negative grep returns 0 occurrences. Plan 42-05's source-reading invariant test (`tests/lib/no-card-slide-in.test.mjs`) is unblocked and will lock this against future drift.
- **No blockers for downstream Wave 2 plans.** Plan 42-04 and 42-02 modify disjoint regions (`MasonryFeed.tsx` + i18n bundles + `HomeScreen.tsx` respectively) and were not touched by this plan; no merge conflict risk.
- **Wave 3 (Plan 42-05) ready** to add the source-reading invariant test once all of Wave 2 lands.

## Self-Check: PASSED

- [x] `app/src/index.css` modified — `grep -c "card-slide-in" app/src/index.css` returns 0; keyframes count dropped 24→23.
- [x] `app/src/components/InfoFlow.tsx` modified — `grep -c "card-slide-in" app/src/components/InfoFlow.tsx` returns 0.
- [x] Cross-tree negative grep — `grep -rc "card-slide-in" app/src/` returns 0 (verified `grep -rn` exits 1 with no output).
- [x] Commit `6bf7f761` exists — `git log --oneline | grep 6bf7f761` confirms.
- [x] Commit `2fb5df8c` exists — `git log --oneline | grep 2fb5df8c` confirms.
- [x] tsc clean for InfoFlow.tsx — `npx tsc -b --noEmit | grep InfoFlow` returns empty.
- [x] No tests reference `card-slide-in` (pre-verified via `grep -rn "card-slide-in" app/tests/` returning empty).

---
*Phase: 42-masonry-feed-layout*
*Plan: 03 (card-slide-in-removal)*
*Completed: 2026-05-10*
