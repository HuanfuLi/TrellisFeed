---
phase: 03-graph-memory-recommendation-engine
plan: 01
subsystem: content-pipeline
tags: [typed-graph, json-schema, ajv, frozen-pool, ranking-features]

requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    provides: checksum-verified immutable pool build and verification contract
provides:
  - Deterministic compiler for all nine RSD 10.4 global edge types
  - Frozen sources, global edge, and per-post ranking feature artifacts
  - Fail-closed graph endpoint, topic, source, and embedding verification
affects: [03-02-app-graph-import, 03-04-rankers, future-content-pool-freezes]

tech-stack:
  added: []
  patterns:
    - Offline typed graph compilation before immutable pool promotion
    - Artifact-level embedding fingerprint with all-or-none post vectors

key-files:
  created:
    - tools/content_pipeline/schemas/global-edge.schema.json
    - tools/content_pipeline/schemas/source.schema.json
    - tools/content_pipeline/schemas/ranking-features.schema.json
    - tools/content_pipeline/src/graph/build.ts
    - tools/content_pipeline/test/graph-build.test.mjs
    - tools/content_pipeline/test/freeze-graph-artifacts.test.mjs
  modified:
    - tools/content_pipeline/src/freeze/build.ts
    - tools/content_pipeline/src/freeze/verify.ts

key-decisions:
  - "Source nodes are referenced only through ranking feature sourceId metadata; no unapproved post-to-source edge type was introduced."
  - "Prerequisite labels compile from the prerequisite concept to the dependent concept, matching prerequisite_of semantics."

patterns-established:
  - "Graph labels resolve only within the reviewed topic label/alias table; unresolved or ambiguous labels produce warnings and never fabricated IDs."
  - "Freeze verification validates schemas before checking endpoint kinds, referential integrity, topic ownership, and fingerprint/vector coherence."

requirements-completed: [GRAPH-01]

coverage:
  - id: D1
    description: Deterministic compiler emits exact typed global edges, symmetric claim contrasts, sources, and per-post ranking features.
    requirement: GRAPH-01
    verification:
      - kind: unit
        ref: tools/content_pipeline/test/graph-build.test.mjs
        status: pass
    human_judgment: false
  - id: D2
    description: Fixture freezes include sources.json, global_edges.json, and ranking_features.json under fixed filename and SHA-256 bundle hashes.
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: tools/content_pipeline/test/freeze-graph-artifacts.test.mjs#immutable hash contract
        status: pass
    human_judgment: false
  - id: D3
    description: Frozen graph verification rejects dangling, illegal-kind, cross-topic, and partially embedded artifacts.
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: tools/content_pipeline/test/freeze-graph-artifacts.test.mjs#tamper rejection
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 01: Typed Frozen Global Graph Summary

**Deterministic RSD 10.4 graph compilation with hashed frozen artifacts, derived ranking features, and fail-closed endpoint verification**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-18T05:41:01Z
- **Completed:** 2026-07-18T05:56:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Compiled all nine exact global edge types with deterministic IDs, label resolution, primary-concept scoring, symmetric pro/con contrasts, and coherent optional embeddings.
- Replaced untyped post/concept and post/claim helper artifacts with `sources.json`, `global_edges.json`, and `ranking_features.json` in future fixture freezes.
- Added strict schema, endpoint-kind, referential, cross-topic, source ownership, manifest hash, and embedding fingerprint verification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Global-graph schemas + deterministic compiler** - `929b972` (feat)
2. **Task 2: Freeze/verify integration — typed artifacts in the immutable bundle** - `64311dd` (feat)

**Plan metadata:** skipped (`commit_docs` disabled)

## Files Created/Modified

- `tools/content_pipeline/schemas/global-edge.schema.json` - Exact enum and record contract for RSD 10.4 edges.
- `tools/content_pipeline/schemas/source.schema.json` - Frozen public source metadata contract.
- `tools/content_pipeline/schemas/ranking-features.schema.json` - Artifact-level fingerprint and per-post ranking feature contract.
- `tools/content_pipeline/src/graph/build.ts` - Deterministic offline graph compiler and ranking feature builder.
- `tools/content_pipeline/src/freeze/build.ts` - Writes typed graph artifacts into fixture staging before manifest hashing and promotion.
- `tools/content_pipeline/src/freeze/verify.ts` - Validates graph artifacts and rejects invalid endpoints or incoherent embeddings.
- `tools/content_pipeline/test/graph-build.test.mjs` - Compiler determinism and derivation coverage.
- `tools/content_pipeline/test/freeze-graph-artifacts.test.mjs` - Immutable artifact and tamper-rejection coverage.

## Decisions Made

- Kept Source outside the nine-type edge table and linked posts to sources only through `PostRankingFeatures.sourceId`.
- Interpreted `prerequisiteConceptLabels` semantically as edges from prerequisite concept to dependent concept.
- Kept fingerprint/vector coherence in the explicit verifier because it compares each vector length to the artifact's dynamic `dimensions` value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected stale pipeline test paths**
- **Found during:** Task 1 pre-flight
- **Issue:** The plan named `tools/content_pipeline/tests/*.test.ts`, but the package executes only `test/*.test.mjs`.
- **Fix:** Added both planned tests under the existing executable `test/*.test.mjs` suite.
- **Files modified:** `tools/content_pipeline/test/graph-build.test.mjs`, `tools/content_pipeline/test/freeze-graph-artifacts.test.mjs`
- **Verification:** Both tests ran in the required `npm test` commands.
- **Committed in:** `929b972`, `64311dd`

**2. [Rule 1 - Bug] Removed an Ajv-incompatible redundant schema conditional**
- **Found during:** Task 2 full-suite verification
- **Issue:** Ajv strict mode rejected a cross-subschema `required` conditional in the new ranking schema before tests could load.
- **Fix:** Retained structural vector validation in JSON Schema and enforced the dynamic fingerprint/vector all-or-none rule in `verifyFrozenPool`, where dimensions can be compared directly.
- **Files modified:** `tools/content_pipeline/schemas/ranking-features.schema.json`
- **Verification:** All 82 pipeline tests and `tsc --noEmit` passed.
- **Committed in:** `64311dd`

---

**Total deviations:** 2 auto-fixed (1 blocking path correction, 1 schema bug)
**Impact on plan:** Both fixes were required for the planned tests and verifier to execute; no product scope or runtime surface was added.

## Issues Encountered

- Ajv strict schema compilation required three bounded correction iterations before the full suite passed.
- The plan's stale assumption that the pool was not frozen was overridden by the orchestrator; the existing frozen pool was not read-modified, regenerated, patched, or deleted.

## Known Stubs

None. A null `embeddingFingerprint` is an intentional, fully verified no-embedding mode rather than a placeholder.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-02 can import the ready-made typed graph contract into the app without in-app graph or embedding computation.
- Existing `data/content_pool_v1/` remains unchanged; typed artifacts appear only in a future explicitly authorized freeze.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*

## Self-Check: PASSED

- All eight created or modified implementation files exist.
- Task commits `929b972` and `64311dd` exist in repository history.
- Required pipeline tests and TypeScript build passed.
