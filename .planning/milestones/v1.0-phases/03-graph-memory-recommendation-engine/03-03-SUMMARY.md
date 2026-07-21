---
phase: 03-graph-memory-recommendation-engine
plan: 03
subsystem: database
tags: [indexeddb, graph-memory, contribution-ledger, event-log, replay]

requires:
  - phase: 03-graph-memory-recommendation-engine
    provides: typed graph contracts, IndexedDB v6 personal graph stores, globalGraphRepository, and unified GRAPH_UPDATED interaction payload from Plan 03-02
provides:
  - Idempotent per-event contribution ledger with exact section 10.6 interest deltas and field-exact UserConceptState folds
  - Durable personal graph edges, serializable snapshots, deterministic replay, and boot repair from research_records
  - Error-isolated lazy interaction-log hook that preserves canonical logging reliability
affects: [03-05-question-extraction, 03-06-experimental-ranking, research-export, graph-memory-verification]

tech-stack:
  added: []
  patterns:
    - Stable eventId-conceptId-rule contribution keys with INSERT OR REPLACE and full-ledger state folds
    - Serialized graph mutations with canonical event-log replay and missing-contribution boot repair
    - Fire-and-forget derived-state hooks remain isolated from canonical persistence promises

key-files:
  created:
    - app/src/services/graph-memory.service.ts
    - app/tests/services/graph-memory.service.test.mjs
  modified:
    - app/src/services/interaction-log.service.ts

key-decisions:
  - "UserConceptState is never updated arithmetically in place; every row is rebuilt from durable contributions and clamped after the complete fold."
  - "Graph-memory mutations are serialized in-process while stable contribution keys and replay provide retry/crash convergence across process lifetimes."
  - "Canonical interaction logging invokes graph memory only after persistence and enqueue succeed, through a lazy fire-and-forget hook whose failures are reported and repaired later."

patterns-established:
  - "Derived personal state is reconstructable: research_records remains canonical, graph_contributions is idempotent, and user_concept_states is a folded projection."
  - "All graph-memory durability assertions execute through dbQuery rather than service mirrors."

requirements-completed: [GRAPH-02]

coverage:
  - id: D1
    description: Exact section 10.6 contributions produce durable, clamped, idempotent, replayable UserConceptState rows and named personal edges.
    requirement: GRAPH-02
    verification:
      - kind: integration
        ref: app/tests/services/graph-memory.service.test.mjs#ledger-idempotency-replay-and-edge probes
        status: pass
    human_judgment: false
  - id: D2
    description: Canonical interaction logging remains reliable when graph memory fails and boot repair restores missing contributions from research_records.
    requirement: GRAPH-02
    verification:
      - kind: integration
        ref: app/tests/services/graph-memory.service.test.mjs#throwing-hook-and-repairOnBoot probes
        status: pass
      - kind: other
        ref: app#npm test (536 tests)
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 03: Personal Graph-Memory Contribution Ledger Summary

**A stable contribution ledger now folds canonical interaction events into durable personal concept state and edges, with deterministic replay, boot repair, and error-isolated logging integration**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-18T06:28:14Z
- **Completed:** 2026-07-18T06:40:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added exact section 10.6 interest rules, discretionary uncertainty/familiarity rules, stable contribution IDs, full-ledger state folds, clamping, and serialized mutation ordering.
- Persisted section 10.4 personal edges and exposed user/all-user serializable snapshots plus canonical-log replay.
- Connected successful interaction logging to graph memory through a lazy fire-and-forget hook and added missing-contribution boot repair without coupling logging success to derived state.

## Task Commits

Each task was committed atomically:

1. **Task 1: graph-memory contribution ledger, weight rules, and personal edges** - `f468f51` (feat)
2. **Task 2: interaction-log hook and boot repair wiring** - `9aa4683` (feat)

**Plan metadata:** skipped (`commit_docs` disabled)

## Files Created/Modified

- `app/src/services/graph-memory.service.ts` - Contribution ledger, state folds, personal edges, snapshots, replay, serialized mutations, and boot repair.
- `app/src/services/interaction-log.service.ts` - Lazy error-isolated post-persist graph-memory hook with injectable test seams.
- `app/tests/services/graph-memory.service.test.mjs` - Executable dbQuery durability, idempotency, clamping, repeated-skip, replay, edge, snapshot, hook-isolation, and repair probes.

## Decisions Made

- Counted both feed impressions and post opens as concept exposures so the required post-open durability probe and repeat-exposure familiarity rule share one auditable count.
- Resolved event concepts from an explicit internal concept list when present, otherwise from the frozen post's primary ranking concept and `mentions` edges in `globalGraphRepository`.
- Serialized mutation operations in the service to prevent concurrent folds from overwriting a newer durable projection with a stale one.
- Suppressed personal-edge rewrites during boot contribution repair; repair restores only missing ledger entries and folds, while full replay remains the complete derived-state reconstruction path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Execution

- Task 1 reached red with `ERR_MODULE_NOT_FOUND` for the not-yet-created graph-memory service, then passed seven focused tests after implementation.
- Task 2 reached red on the absent logging hook and `repairOnBoot`, then passed the 17-test focused command after implementation.
- The assignment's explicit one-commit-per-task rule kept each task's red/green work in its single atomic task commit.

## Known Stubs

None. Empty objects, arrays, and nullable locals found by the scan are internal accumulators, optional-argument defaults, or edge-selection state; none flow to participant UI or replace a data source.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-05 can call `applyQuestionExtraction` and wire `repairOnBoot` during application startup without changing this plan's persistence contract.
- Experimental ranking plans can consume `readSnapshot(userId)` while the control path remains structurally separate from this service.
- Snapshot and replay outputs are ready for Phase 4 research export and algorithm-verification probes.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*

## Self-Check: PASSED

- All three implementation/test files and this summary exist on disk.
- Task commits `f468f51` and `9aa4683` exist in repository history.
- The focused 17-test command, full 536-test app suite, targeted ESLint, and TypeScript build all passed.
