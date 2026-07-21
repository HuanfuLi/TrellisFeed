---
phase: 03-graph-memory-recommendation-engine
plan: 04
subsystem: recommendation
tags: [ranking, graph-memory, control-isolation, cosine, diversity, tdd]

requires:
  - phase: 03-02
    provides: frozen global graph edges, ranking features, and embedding fingerprint metadata
  - phase: 03-03
    provides: durable UserConceptState rows and personal graph-memory traces
provides:
  - structurally isolated pure control scorer implementing the exact section 11.7 formula
  - pure experimental scorer with seven normalized evidence-bearing components and five orchestration strategies
  - deterministic candidate generation, fingerprint-gated cosine scoring, and section 12.3 algorithm probes 1-4
  - cross-batch diversity selection with hard caps and a reserved contrast or bridge slot
affects: [03-05, 03-06, recommendation-service, feed-orchestration, algorithm-verification]

tech-stack:
  added: []
  patterns: [pure ranking functions, immutable injected configuration, evidence-bearing component scores, deterministic postId tie-breaks]

key-files:
  created:
    - app/src/services/recommendation-config.ts
    - app/src/services/ranking/control-ranker.ts
    - app/src/services/ranking/experimental-ranker.ts
    - app/src/services/ranking/diversity-reranker.ts
    - app/tests/services/ranking-components.test.mjs
    - app/tests/services/diversity-reranker.test.mjs
  modified: []

key-decisions:
  - "Control ranking accepts exactly frozen post/features, topic, seen/dismissed IDs, and session-served metadata; personal traces and graph traversal are absent from its type."
  - "Semantic legs execute only when frozen and runtime embedding fingerprints match exactly; unavailable vector weights are deterministically renormalized."
  - "Diversity returns only ledger-persistable source and recent-concept counters; sufficient-history question count remains transient input context."

patterns-established:
  - "Ranking functions perform no I/O and use explicit postId ascending tie-breaks after score descending."
  - "Every experimental component returns a clamped value plus contributor IDs for later Recommendation trace attachment."

requirements-completed: [RANK-01, RANK-02, RANK-03, RANK-04, RANK-06]

coverage:
  - id: D1
    description: "Exact section 11.7 control scoring over a structurally non-personal input"
    requirement: RANK-01
    verification:
      - kind: unit
        ref: "tests/services/ranking-components.test.mjs#control ranker"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seven-component experimental scoring, candidate generation, and deterministic strategy selection"
    requirement: RANK-02
    verification:
      - kind: unit
        ref: "tests/services/ranking-components.test.mjs#experimental ranker"
        status: pass
    human_judgment: false
  - id: D3
    description: "Section 12.3 question relevance, contrast, redundancy, and echo boundary probes"
    requirement: RANK-06
    verification:
      - kind: unit
        ref: "node --test tests/services/ranking-components.test.mjs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cross-batch diversity caps with deterministic contrast or bridge reservation"
    requirement: RANK-04
    verification:
      - kind: unit
        ref: "tests/services/diversity-reranker.test.mjs#diversity reranker"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 04: Pure Ranking Core Summary

**Pure control and graph-memory rankers with fingerprint-safe evidence scoring, deterministic orchestration strategies, and cross-batch diversity caps.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-18T07:03:12Z
- **Completed:** 2026-07-18T07:19:26Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Implemented the exact section 11.7 control formula behind an exact-key input type and source-level personal-trace isolation gate.
- Implemented all seven section 11.4 experimental components, section 11.2 candidate sources, section 11.5 strategy selection, contributor evidence, cold-start behavior, and fingerprint-gated vector degradation.
- Implemented deterministic section 11.6 diversity selection across batch boundaries, including source/concept hard caps and a reserved contrast or bridge item after sufficient history.

## Task Commits

Each task was committed atomically:

1. **Task 1: RecommendationConfig + control ranker** - `d0fb316` (feat)
2. **Task 2: Experimental ranker** - `40e2814` (feat)
3. **Task 3: Diversity reranker** - `9c581e0` (feat)

**Plan metadata:** skipped (`commit_docs` disabled; planning files remain uncommitted)

## Files Created/Modified

- `app/src/services/recommendation-config.ts` - Deep-frozen section 11 defaults, subweights, thresholds, caps, and tie order.
- `app/src/services/ranking/control-ranker.ts` - Pure control scoring with an exact narrow input contract.
- `app/src/services/ranking/experimental-ranker.ts` - Candidate generation, seven component scorers, strategy selection, and contributor evidence.
- `app/src/services/ranking/diversity-reranker.ts` - Greedy cross-batch diversity selection and progression-slot reservation.
- `app/tests/services/ranking-components.test.mjs` - Control isolation and section 12.3 probes 1-4 plus ordering and fingerprint tests.
- `app/tests/services/diversity-reranker.test.mjs` - Source/run caps, reservation, short-batch, format-softness, and determinism tests.

## Decisions Made

- Control candidates carry only frozen static metadata and allowed session state; the scorer has no personal trace or graph API surface.
- Cosine similarity is treated as unavailable unless both fingerprints and vector dimensions match; remaining subweights renormalize instead of emitting invalid scores.
- Strategy availability is structural: Continue/Echo require direct question evidence, Echo uses an inclusive age boundary, and Deepen remains available at cold start.
- Sufficient-history question count is transient diversity input; only the canonical source/recent-concept counters are returned for the batch ledger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept diversity output compatible with the canonical batch-ledger counter shape**
- **Found during:** Task 3 final contract review
- **Issue:** Carrying the transient question-history count into `nextCounters` would add a field outside `RecommendationBatch.diversityCounters`.
- **Fix:** Renamed the input-only value to `historyQuestionCount` and excluded it from the returned persistence counters.
- **Files modified:** `app/src/services/ranking/diversity-reranker.ts`, `app/tests/services/diversity-reranker.test.mjs`
- **Verification:** Focused diversity suite, full 552-test app suite, and TypeScript build all passed.
- **Committed in:** `9c581e0` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The correction preserves the planned API while making its persisted output match the pre-existing ledger schema; no scope expansion.

## Issues Encountered

- Node's direct TypeScript execution requires explicit `.ts` extensions for local imports; the new modules follow the repository's established convention.
- Task-local RED runs failed on the expected missing-module boundary before implementation. Per the assignment's one-commit-per-task requirement, each task's tests and implementation were committed together.

## Verification

- `node --test tests/services/ranking-components.test.mjs --test-name-pattern="control"` - pass (3 tests)
- `node --test tests/services/ranking-components.test.mjs` - pass (10 tests)
- `node --test tests/services/diversity-reranker.test.mjs` - pass (6 tests)
- `node --test tests/services/ranking-components.test.mjs tests/services/diversity-reranker.test.mjs` - pass (16 tests)
- `npx tsc -b --noEmit` - pass
- `npm test` - pass (552 tests)
- Control personal-construct source gate - 0 hits
- Experimental cosine import gate - exactly 1 import
- Diversity persistence import gate - 0 hits

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-06 can assemble ranker inputs and persist recommendations without adding I/O to scoring.
- The packaged real pool remains intentionally unmodified and still awaits operator re-freeze.

## Self-Check: PASSED

- All six plan artifacts exist.
- Task commits `d0fb316`, `40e2814`, and `9c581e0` resolve in git history.
- Summary status is `complete` and all plan requirements are represented in coverage metadata.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*
