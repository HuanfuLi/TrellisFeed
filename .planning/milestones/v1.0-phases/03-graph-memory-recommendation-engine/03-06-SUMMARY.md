---
phase: 03-graph-memory-recommendation-engine
plan: 06
subsystem: recommendation-engine
tags: [indexeddb, ranking, control-isolation, graph-memory, llm-reasons, diversity]

requires:
  - phase: 03-02
    provides: durable graph-memory snapshots and replayable personal state
  - phase: 03-03
    provides: loaded frozen global graph and ranking feature views
  - phase: 03-04
    provides: pure control, experimental, and diversity rankers
  - phase: 03-05
    provides: durable question extraction with frozen concept and claim IDs
provides:
  - Field-exact Recommendation persistence separated from session batch ledgers
  - A single condition-branched recommendation service with control isolation
  - Persisted experimental reasons with structural trace IDs and fixed control labels
affects: [03-07, 03-08, phase-4-study-ui, research-export]

tech-stack:
  added: []
  patterns:
    - branch-before-read control isolation with lazy personal dependencies
    - building-to-ready durable recommendation batch snapshots
    - batched JSON-mode reason generation with structural evidence preceding prose

key-files:
  created:
    - app/src/services/recommendation.repository.ts
    - app/src/services/recommendation.service.ts
    - app/tests/services/recommendation.service.test.mjs
  modified: []

key-decisions:
  - "Recommendation payloads contain only RSD 9.9 fields; session sequence, readiness, and diversity counters live only in recommendation_batches."
  - "Personal graph and question readers are lazy and resolve only inside experimental materialization; control uses frozen pool data and persisted session state."
  - "Experimental trace IDs are attached before prose generation, and invalid prose retries once before a deterministic strategy fallback."

patterns-established:
  - "Stable serving snapshot: persist a building ledger first and expose only the final ready ledger plus complete Recommendation rows."
  - "Control isolation: condition branching occurs before loading any personal dependency or reason LLM configuration."

requirements-completed: [RANK-01, RANK-03, RANK-04, RANK-05, RANK-06]

coverage:
  - id: D1
    description: Field-exact Recommendation rows and ordered batch ledgers round-trip through dbQuery.
    requirement: RANK-03
    verification:
      - kind: integration
        ref: "app/tests/services/recommendation.service.test.mjs#recommendation repository"
        status: pass
    human_judgment: false
  - id: D2
    description: The single serving seam branches before personal reads and produces stable control and experimental batches with session-wide diversity counters.
    requirement: RANK-01
    verification:
      - kind: integration
        ref: "app/tests/services/recommendation.service.test.mjs#recommendation service control isolation and batch lifecycle"
        status: pass
    human_judgment: false
  - id: D3
    description: Experimental reasons are batched, validated, persisted once, and carry resolvable structured trace IDs while control uses fixed labels with zero LLM calls.
    requirement: RANK-05
    verification:
      - kind: integration
        ref: "app/tests/services/recommendation.service.test.mjs#recommendation reason generation and structural traces"
        status: pass
      - kind: integration
        ref: "npm test (576 tests, 0 failures)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 06: Recommendation Serving Seam Summary

**Condition-isolated batch materialization with durable recommendation snapshots, session-wide diversity, fixed control rationales, and traced experimental LLM reasons**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-18T07:51:39Z
- **Completed:** 2026-07-18T08:09:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Persisted RSD 9.9 Recommendation records separately from ordered batch ledgers and proved durability through `dbQuery` after repository re-instantiation.
- Added one recommendation service that branches on study condition before any personal read, recovers interrupted batches, filters dismissed/served posts, and carries diversity counters across batches.
- Added one-call batched experimental reason generation with bracketed question traces, structured evidence IDs, Unicode-aware validation, retry/fallback handling, and zero LLM calls for control or ready-batch rereads.

## Task Commits

Each task was committed atomically:

1. **Task 1: recommendation.repository — field-exact rows + batch ledger** - `b898821` (feat)
2. **Task 2: recommendation.service — condition branch + batch lifecycle** - `367f939` (feat)
3. **Task 3: Reason generation — experimental LLM + fixed control labels** - `1246303` (feat)

**Plan metadata:** skipped (`commit_docs` disabled)

## Files Created/Modified

- `app/src/services/recommendation.repository.ts` - Persists and reads exact Recommendation payloads and separate session ledgers.
- `app/src/services/recommendation.service.ts` - Owns condition routing, ranker wiring, batch lifecycle, diversity state, trace attachment, and reason generation.
- `app/tests/services/recommendation.service.test.mjs` - Executes repository durability, control isolation, lifecycle, reason validation, and structural trace tests.

## Decisions Made

- Batch ledgers are the only home for session ID, sequence, status, ordered recommendation IDs, and diversity counters; Recommendation JSON remains field-exact.
- Personal dependencies are represented by a lazy loader and are dereferenced only inside experimental materialization, keeping the control execution path structurally isolated.
- Reason output is keyed by selected post ID, validated independently, retried only for missing or invalid items, and replaced with a deterministic strategy sentence after the retry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced a lint-rejected control-character regex with explicit code-point validation**
- **Found during:** Task 3 (Reason generation)
- **Issue:** ESLint's `no-control-regex` rejected the intentional C0/C1 validation expression.
- **Fix:** Added an explicit Unicode code-point predicate that enforces the same C0/C1 rejection without a control-character regex.
- **Files modified:** `app/src/services/recommendation.service.ts`
- **Verification:** Focused recommendation tests, TypeScript, and targeted ESLint all pass.
- **Committed in:** `1246303`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Validation behavior is unchanged; no scope expansion.

## Issues Encountered

None beyond the auto-fixed lint incompatibility above.

## User Setup Required

None - no new external service configuration required.

## Next Phase Readiness

- Plan 03-07 can wire persisted Recommendation items and reason-view logging into the feed UI without regenerating reasons.
- Plan 03-08 can remove the transitional feed machinery against a stable, tested recommendation seam.
- No blockers remain for downstream Phase 3 work.

## Self-Check: PASSED

- All three implementation files and this summary exist.
- Task commits `b898821`, `367f939`, and `1246303` resolve in git history.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*
