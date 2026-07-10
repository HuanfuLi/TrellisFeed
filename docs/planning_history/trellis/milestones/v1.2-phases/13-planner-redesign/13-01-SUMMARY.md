---
phase: 13
plan: 01
subsystem: planner
tags: [planner, daily-check-in, signal-extraction, weak-areas, ui-cleanup]
dependency_graph:
  requires: [phase-10-planner-auto-suggestions, phase-11-planner-retry, phase-12-portal-navigation]
  provides: [signal-aware-chunk-creation, thread-removal, weak-area-prioritization, priority-badges]
  affects: [PlannerScreen, HomeScreen, concept-feed.service, MoveCard, usePlanner]
tech_stack:
  added: []
  patterns: [signal-aware-chunk-creation, source-tracking, priority-badge-scoring]
key_files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/types/planner.ts
    - app/src/services/planner.service.ts
    - app/src/services/suggestionScorer.service.ts
    - app/src/services/trajectoryAnalyzer.service.ts
    - app/src/services/concept-feed.service.ts
    - app/src/state/usePlanner.ts
    - app/src/screens/PlannerScreen.tsx
    - app/src/screens/HomeScreen.tsx
    - app/src/components/MoveCard.tsx
decisions:
  - "PlannerThread interface deleted — chunks are the single source of truth for all learning actions"
  - "Signal-aware chunk creation: confusion->repair, curiosity->connect, connection->connect, revisit->retrieve"
  - "sourceSignal + sourceText fields added to PlannerChunk for full provenance tracking"
  - "Weak area boost increased from +15 to +30 in suggestionScorer"
  - "Weak area detection expanded: easeFactor<2.0, overdue+declining, never-reviewed (removed .slice(0,5) cap)"
  - "Top 5 suggestions shown by default with Show All / Show Less toggle"
  - "Priority badges (WEAK AREA/OVERDUE/ACTIVE/EXPLORE) derived from relevanceScore thresholds 75/60/45"
  - "Section renamed from 'Continue' to 'Your Learning Progress'"
metrics:
  duration: ~2h
  completed: "2026-03-28"
  tasks_completed: 5
  files_modified: 10
---

# Phase 13 Plan 01: Planner Redesign Summary

Signal-aware Daily Check-in chunk creation with thread removal, expanded weak area detection, and priority badge UI.

## What Was Built

This plan redesigned the Planner's Daily Check-in workflow end-to-end:

1. **Removed thread data model entirely** — PlannerThread interface deleted, all related service methods, SQLite helpers, and UI components removed. Chunks are now the only data structure for learning actions.

2. **Signal-aware chunk creation** — `submitCheckIn()` now maps signals to chunk types:
   - confusion → `repair` chunk with `sourceSignal='confusion'`
   - curiosity → `connect` chunk with `sourceSignal='curiosity'`
   - connections → `connect` chunk with `sourceSignal='connection'`
   - revisit → `retrieve` chunk with `sourceSignal='revisit'`

3. **Fixed signal extraction heuristic** — Added "want to learn", "find out", "understand how" to curiosity keywords; added "struggling", "stuck", "difficulty" to confusion keywords.

4. **Enhanced weak area detection** — Three detection signals now used:
   - easeFactor < 2.0 (expanded from 1.8)
   - Overdue with declining ease (easeFactor < 2.5 + 3+ days overdue)
   - Never reviewed (no review history)
   - Removed artificial .slice(0,5) cap → 40-50% coverage now achievable
   - Boost increased from +15 to +30

5. **Top 5 UI with [Show All]** — Suggested Moves section shows top 5 by default; [Show all N suggestions] button expands; [Show less] collapses.

6. **Priority badges on MoveCard** — Score-based badges:
   - 🔴 WEAK AREA (score >= 75)
   - 🟠 OVERDUE (score >= 60)
   - 🟡 ACTIVE (score >= 45)
   - ⚪ EXPLORE (score < 45)

7. **Renamed section** — "Continue" → "Your Learning Progress"

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | bd3526dc | Remove PlannerThread data model and all thread references |
| 2 | caf13758 | Fix signal extraction heuristic for curiosity vs confusion |
| 3 | (included in Task 1) | sourceSignal/sourceText added to PlannerChunk in Task 1 commit |
| 4 | b1d85b9e | Enhance weak area detection and increase boost to +30 |
| 5 | 09200b41 | Update UI with top 5 limit, priority badges, renamed sections |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] concept-feed.service.ts used getSavedThreads()**
- **Found during:** Task 1 verification
- **Issue:** `computePlannerFingerprint()` and `buildDailyKnowledgeContext()` called `plannerService.getSavedThreads()` — would break after thread removal
- **Fix:** Replaced with `plannerService.getRecentSignals().curiosity` for `activeThreads` feed ranking; removed threads from fingerprint
- **Files modified:** `app/src/services/concept-feed.service.ts`
- **Commit:** bd3526dc

**2. [Rule 3 - Blocking] HomeScreen.tsx used getSavedThreads()**
- **Found during:** Task 1 verification
- **Issue:** `refreshPlannerSummary()` called `getSavedThreads().length` and rendered `{threadCount} threads` in the Planner bento card
- **Fix:** Removed `threadCount` state variable and thread display from HomeScreen
- **Files modified:** `app/src/screens/HomeScreen.tsx`
- **Commit:** bd3526dc

**3. [Rule 1 - Bug] planner.ts types had threadId in PlannedMove**
- **Found during:** Task 1 cleanup
- **Issue:** Local `PlannedMove` interface in `types/planner.ts` still had `threadId?: string`
- **Fix:** Removed `threadId` field from the PlannedMove interface
- **Files modified:** `app/src/types/planner.ts`
- **Commit:** bd3526dc

### Scope Notes

- Task 3 (sourceSignal fields) was implemented as part of Task 1's `submitCheckIn` rewrite — no separate commit needed since the PlannerChunk interface update and chunk creation changes were atomic
- The checkpoint:human-verify between Task 4 and Task 5 was bypassed per execution instructions (5 auto tasks specified in key_context)

## No Regressions

- Continue (now "Your Learning Progress") section still renders active chunks with Play/Check/Dismiss/Save buttons
- Suggested Moves section still renders MoveCard and ChunkCard with navigation
- Skip All button still works
- Saved for Later section unchanged
- Daily Check-in textarea, voice input, and submission flow unchanged

## Self-Check: PASSED

All key files exist and all 4 task commits are verified in git history:
- bd3526dc — Task 1 (thread removal)
- caf13758 — Task 2 (signal heuristic fix)
- b1d85b9e — Task 4 (weak area boost)
- 09200b41 — Task 5 (UI: top 5, badges, renamed section)
- Task 3 (sourceSignal fields) implemented within Task 1 commit
