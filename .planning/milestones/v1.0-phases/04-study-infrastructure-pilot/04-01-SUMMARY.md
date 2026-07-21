---
phase: 04-study-infrastructure-pilot
plan: 01
subsystem: api
tags: [wire-contract, validation, d1, recommendations, node-test]

requires:
  - phase: 03-graph-memory-recommendation-engine
    provides: persisted recommendation records and the exact eight-value RecommendationStrategy union
provides:
  - additive recommendation metadata in the shared research-ingest-v1 contract
  - constrained D1 recommendations table and session-order analysis index
  - strict backend recommendation parsing with identity and ambiguity rejection
affects: [04-02, 04-03, study-export, research-ingest]

tech-stack:
  added: []
  patterns:
    - additive shared-contract evolution without a version bump
    - positive wire-field allowlists with server-owned identity exclusion
    - TDD RED-to-GREEN validation contract commits

key-files:
  created:
    - research-backend/migrations/0004_recommendations.sql
    - research-backend/test/migration-schema.test.mjs
  modified:
    - shared/research-wire-contract.v1.json
    - research-backend/src/validation.ts
    - research-backend/test/validation.test.mjs

key-decisions:
  - "Keep research-ingest-v1 unchanged and extend it only with recommendation metadata consumed by both runtimes."
  - "Keep user, condition, and topic identity server-owned by excluding those fields from the recommendation wire allowlist."
  - "Store generation and receipt timestamps only; derive recommendation serving time later from feed-impression events."

patterns-established:
  - "Recommendation schema constants come from the shared contract, with SQL parity enforced by executable tests."
  - "Kind-bearing records dispatch before inferred event/Q&A shapes and reject mixed discriminators explicitly."

requirements-completed: [STUDY-03]

coverage:
  - id: D1
    description: "The shared v1 contract declares recommendation kind, eight strategies, and bounded metadata without changing existing contract fields."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "research-backend/test/migration-schema.test.mjs#recommendation strategies stay identical across migration and shared contract"
        status: pass
      - kind: other
        ref: "node contract version and eight-strategy assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "D1 migration 0004 defines the exact recommendations table, constraints, timestamp boundary, and non-unique session-order index."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "research-backend/test/migration-schema.test.mjs#recommendations migration defines the exact analysis schema and ordering index"
        status: pass
    human_judgment: false
  - id: D3
    description: "Backend parseIngest accepts only bounded recommendation records and rejects extras, identity, invalid values, and ambiguous shapes."
    requirement: STUDY-03
    verification:
      - kind: unit
        ref: "research-backend/test/validation.test.mjs#recommendation validation cases"
        status: pass
      - kind: integration
        ref: "research-backend: npm test (40 tests)"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 1: Recommendation Export Contract Summary

**An additive recommendation wire contract, constrained D1 schema, and strict kind-first backend validator now form the tested foundation for recommendation ingest and export.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-19T03:15:26Z
- **Completed:** 2026-07-19T03:26:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended `research-ingest-v1` additively with the exact recommendation kind, eight strategies, and contract-owned limits while preserving all existing keys and forbidden identity fields.
- Added migration `0004_recommendations.sql` with all 18 specified columns, condition/strategy/positive-order constraints, and the non-unique session-order analysis index.
- Added kind-first recommendation parsing with exact field allowlisting, finite numeric checks, bounded contributors/component scores, server-identity exclusion, and explicit ambiguous-shape rejection.

## Task Commits

Each task was committed atomically; the TDD task has separate RED and GREEN commits:

1. **Task 1: Add recommendation metadata and D1 migration** - `2c9e410` (feat)
2. **Task 2 RED: Specify recommendation validation behavior** - `36a7985` (test)
3. **Task 2 GREEN: Implement strict recommendation validation** - `d89c0b4` (feat)

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `shared/research-wire-contract.v1.json` - adds recommendation kind, strategy, and limit metadata without changing the v1 version or existing contract keys.
- `research-backend/migrations/0004_recommendations.sql` - creates the constrained recommendation storage and analysis index.
- `research-backend/src/validation.ts` - recognizes and validates the new recommendation record shape before event/Q&A dispatch.
- `research-backend/test/validation.test.mjs` - covers valid boundaries, allowlist/identity rejection, numeric/text/collection limits, component scores, and ambiguity.
- `research-backend/test/migration-schema.test.mjs` - verifies the exact SQL schema, timestamp boundary, index order, and strategy parity with the shared contract.

## Decisions Made

- Preserved the shared contract version and every pre-existing key byte-for-byte apart from the required trailing delimiter for the new additive block.
- Reused the existing ID/post/timestamp limits and added recommendation-specific bounded helpers without loosening event or Q/A validation.
- Kept `served_at` out of D1 so Plan 04-02 can derive first serving time from canonical feed-impression events.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 04-02 can implement authenticated Worker ingest, D1 binding, admin counts, and recommendation/participant CSV export against the frozen contract and migration.
- Plan 04-03 can consume the same recommendation metadata for the client projection and durable upload path.

## Self-Check: PASSED

- Summary and all five planned files exist.
- Task commits `2c9e410`, `36a7985`, and `d89c0b4` exist in RED-before-GREEN order.
- Both targeted suites and the 40-test full backend suite pass from committed HEAD.
- The plan commit range contains only the five frontmatter paths; no package or planning-state file was committed.

---
*Phase: 04-study-infrastructure-pilot*
*Completed: 2026-07-19*
