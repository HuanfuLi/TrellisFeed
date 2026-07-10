---
phase: 10-planner-auto-suggestions-engine
plan: "03"
subsystem: planner-ui
tags: [uat-gap-closure, suggested-moves, planner-screen]
dependency_graph:
  requires: ["10-02"]
  provides: ["unified-suggested-moves-section"]
  affects: ["app/src/screens/PlannerScreen.tsx"]
tech_stack:
  added: []
  patterns: ["always-render section header", "IIFE → component-level const refactor"]
key_files:
  modified:
    - app/src/screens/PlannerScreen.tsx
decisions:
  - "Hoist totalSuggestions to component scope (not IIFE) for use in CTA outside section"
  - "handleSkipAll wraps skipAll() + toast('Suggestions cleared') so UAT test can verify toast"
  - "Refresh button always visible — section never guarded by autoMoves.length > 0"
  - "Skip all button shown only when autoMoves.length > 0 (can only skip auto-generated moves)"
metrics:
  duration_seconds: 210
  completed_date: "2026-03-27"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 1
---

# Phase 10 Plan 03: UAT Gap Closure — Unified Suggested Moves Section Summary

**One-liner:** Merged dual "Suggested Moves" sections into one unified always-rendered section with always-accessible Refresh and toast-wired Skip All controls.

## What Was Built

Fixed 2 failing UAT tests (Test 6: Skip All; Test 7: Refresh) by eliminating the structural root cause: two separate "Suggested Moves" sections in PlannerScreen.tsx.

**Root cause:** PlannerScreen had:
1. Auto-Suggested section (conditional on `autoMoves.length > 0`) — had Refresh + Skip All but only showed when moves existed
2. Manual Suggested section (`<SectionHeader title="Suggested Moves" .../>`) — always shown but no controls

**Fix:** One unified section that always renders, shows both `autoMoves` (MoveCards) and `suggestedChunks` (ChunkCards), with Refresh always visible and Skip All wired to `handleSkipAll()` (calls `skipAll()` + toast).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Remove duplicate manual Suggested Moves SectionHeader + render block | 20c89a6c |
| 2 | Build unified section with always-visible Refresh, combined lists, handleSkipAll | 8a71b246 |
| 3 | Update empty-planner CTA to use totalSuggestions (component-level const) | 41d60886 |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one small structural improvement:

**Deviation: IIFE refactored to component-level const**
- **Found during:** Task 3
- **Issue:** Task 2 used an IIFE (`{(() => { const totalSuggestions = ...; return <>...</> })()}`) to scope `totalSuggestions`, but Task 3 needed `totalSuggestions` in the CTA card outside the IIFE's scope
- **Fix:** Hoisted `const totalSuggestions = autoMoves.length + suggestedChunks.length` to component level (line 329), removed IIFE, replaced with clean JSX
- **Files modified:** app/src/screens/PlannerScreen.tsx
- **Commit:** 41d60886

## Must-Have Verification

| Must-have | Status | Evidence |
|-----------|--------|---------|
| Only ONE "Suggested Moves" heading | VERIFIED | `grep -c 'Suggested Moves</h2>'` returns 1 |
| Refresh button always visible (outside autoMoves guard) | VERIFIED | Button at line 510, only `autoMoves.length > 0` guard is for Skip All (line 560) |
| Skip All calls `toast('Suggestions cleared')` | VERIFIED | `handleSkipAll` at line 398 calls `skipAll()` then `toast('Suggestions cleared')` |
| TypeScript compiles: `tsc --noEmit` exits 0 | VERIFIED | Confirmed by swapping file into main repo with node_modules |

## Known Stubs

None.

## Self-Check: PASSED

- `app/src/screens/PlannerScreen.tsx` exists and was modified (3 commits)
- Commit 20c89a6c exists: `fix(10-03): remove duplicate manual Suggested Moves section`
- Commit 8a71b246 exists: `feat(10-03): unified Suggested Moves section with always-visible controls`
- Commit 41d60886 exists: `feat(10-03): update empty-planner CTA to use unified totalSuggestions`
