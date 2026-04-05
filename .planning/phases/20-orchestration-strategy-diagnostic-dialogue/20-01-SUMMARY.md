---
phase: 20-orchestration-strategy-diagnostic-dialogue
plan: "01"
subsystem: orchestration
tags: [strategy, signals, learning-mode, pure-function]
dependency_graph:
  requires: [TrajectorySignal, CheckInSignals from types/index.ts]
  provides: [OrchestrationStrategy, StrategyHints, LearningMode, defaultStrategy]
  affects: [downstream services consuming strategy hints]
tech_stack:
  added: []
  patterns: [pure-function strategy, threshold-based mode selection]
key_files:
  created:
    - app/src/services/orchestration-strategy.service.ts
    - app/tests/services/orchestration-strategy.test.mjs
  modified: []
decisions:
  - "Types kept in service file (not types/index.ts) since interface is small and self-contained"
  - "Priority order: retrieval > discovery > reinforcement > balanced (first match wins)"
metrics:
  duration: 76s
  completed: "2026-04-05T06:19:00Z"
  tasks_completed: 1
  tasks_total: 1
  test_count: 8
  test_pass: 8
---

# Phase 20 Plan 01: OrchestrationStrategy Interface & Default Implementation Summary

Pure-function strategy layer translating TrajectorySignal into StrategyHints with 4 learning modes (retrieval/discovery/reinforcement/balanced) via threshold-based selection.

## Completed Tasks

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | OrchestrationStrategy interface, types, and default implementation (TDD) | 0d9f1180 (RED), 3bf00de7 (GREEN) | orchestration-strategy.service.ts, orchestration-strategy.test.mjs |

## Implementation Details

### Task 1: OrchestrationStrategy Interface + defaultStrategy

**TDD RED:** 8 test cases written covering all 4 mode transitions, priorityConceptIds population, and curiosityTopics with/without CheckInSignals.

**TDD GREEN:** Implemented `defaultStrategy.computeHints()` with threshold logic:
- `weakAreas.length > 3 || reviewPerformance < 40` -> retrieval (bias 0.7, discovery 0.3)
- `conceptCoverage > 70 && feedEngagement > 10` -> discovery (bias 0.3, discovery 0.6)
- `timeSinceLastReview > 3 days` -> reinforcement (bias 0.5, discovery 0.3)
- Otherwise -> balanced (bias 0.5, discovery 0.5)

Exported types: `LearningMode`, `StrategyHints`, `OrchestrationStrategy`, `defaultStrategy`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification

- All 8 orchestration-strategy tests passing
- All 17 existing suggestionScorer tests still passing (no regression)
- All acceptance criteria grep checks confirmed

## Self-Check: PASSED
