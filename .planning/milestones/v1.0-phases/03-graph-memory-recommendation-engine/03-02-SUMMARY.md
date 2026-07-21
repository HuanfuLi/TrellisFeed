---
phase: 03-graph-memory-recommendation-engine
plan: 02
subsystem: database
tags: [indexeddb, frozen-pool, typed-graph, graph-memory, dbquery]

requires:
  - phase: 03-graph-memory-recommendation-engine
    provides: deterministic sources, global edges, and ranking feature artifacts from Plan 03-01
provides:
  - Required runtime bundle contract and version-qualified persistence for all three frozen graph artifacts
  - IndexedDB v6 storage substrate for global graph, personal graph-memory, extraction, and recommendations
  - Read-only durable global graph repository with type, endpoint, neighbor, contrast, and ranking indexes
affects: [03-03-personal-graph-memory, 03-04-rankers, 03-05-question-extraction, 03-06-recommendations]

tech-stack:
  added: []
  patterns:
    - Required frozen graph artifacts share the existing checksum and ready-marker import barrier
    - Global graph indexes rebuild only from ready-version dbQuery rows

key-files:
  created:
    - app/src/domain/graph.types.ts
    - app/src/services/global-graph.repository.ts
    - app/tests/services/global-graph.repository.test.mjs
    - app/tests/services/content-pool.repository.test.mjs
  modified:
    - app/src/types/index.ts
    - app/src/services/db.service.ts
    - app/src/data/content-pool-bundle.ts
    - app/src/services/content-pool.repository.ts
    - app/tests/services/content-pool.import.test.mjs

key-decisions:
  - "The three frozen graph artifacts are mandatory runtime bundle members; the legacy pilot projection fails through POOL_INVALID until an operator re-freezes it."
  - "Ranking features persist one version-qualified row per post, while the artifact-level embedding fingerprint remains in the ready-version metadata payload."
  - "Global graph queries remain unavailable until a successful ready-version load and expose cloned read-only results."

patterns-established:
  - "Graph artifact import uses the same importing-to-ready barrier and canonical storage-hash revalidation as the original pool collections."
  - "Repository query indexes are deterministic, bounded, and reconstructed through dbQuery rather than import-time mirrors."

requirements-completed: [GRAPH-01]

coverage:
  - id: D1
    description: Field-exact Phase 3 graph types and the unified GRAPH_UPDATED payload contract are available to downstream plans.
    requirement: GRAPH-01
    verification:
      - kind: other
        ref: app#npx tsc -b --noEmit
        status: pass
    human_judgment: false
  - id: D2
    description: IndexedDB v6 and both database backends persist required hash-verified graph artifacts and reject dangling runtime endpoints.
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: app/tests/services/content-pool.repository.test.mjs
        status: pass
    human_judgment: false
  - id: D3
    description: A fresh global graph repository loads durable ready-version rows and answers all planned bounded graph and ranking queries.
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: app/tests/services/global-graph.repository.test.mjs
        status: pass
      - kind: other
        ref: app#npm test (527 tests)
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 02: Runtime Graph Import and Durable Query Substrate Summary

**IndexedDB v6 imports the required frozen graph artifacts behind the ready barrier and serves deterministic type-indexed queries from durable rows**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-18T06:05:38Z
- **Completed:** 2026-07-18T06:22:16Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added field-exact global graph, ranking, personal edge, contribution, extraction-job, and recommendation-batch types while extending the single `GRAPH_UPDATED` payload.
- Upgraded the database to v6 with all nine Phase 3 stores and imported `sources.json`, `global_edges.json`, and `ranking_features.json` under checksum, version, referential, and ready-marker validation.
- Added a read-only global graph repository that rebuilds type/source/target and ranking indexes from ready-version `dbQuery` rows and refuses premature queries.

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase 3 domain types + GRAPH_UPDATED payload extension** - `dbe45de` (feat)
2. **Task 2: db.service v6 tables + bundle reader + pool import of graph artifacts** - `9a89d4f` (feat)
3. **Task 3: global-graph.repository with type-indexed queries + dbQuery durability tests** - `c5780b9` (feat)

**Plan metadata:** skipped (`commit_docs` disabled)

## Files Created/Modified

- `app/src/domain/graph.types.ts` - Shared field-exact Phase 3 graph and recommendation-ledger contracts.
- `app/src/types/index.ts` - Extends the existing unified graph mutation payload with interaction and extraction kinds.
- `app/src/services/db.service.ts` - Adds all v6 stores and backend-parity clear operations.
- `app/src/data/content-pool-bundle.ts` - Requires, parses, shape-validates, and hashes the three graph artifacts.
- `app/src/services/content-pool.repository.ts` - Stages graph rows, preserves embedding metadata, and validates edge IDs, endpoint kinds, and topic ownership before ready.
- `app/src/services/global-graph.repository.ts` - Loads durable ready rows and exposes bounded read-only graph/ranking queries.
- `app/tests/services/content-pool.import.test.mjs` - Covers v6 stores, both backend implementations, stale-package failure, durable graph rows, and dangling-edge rejection.
- `app/tests/services/content-pool.repository.test.mjs` - Canonical plan verification entry point for the executable content-pool repository suite.
- `app/tests/services/global-graph.repository.test.mjs` - Exercises every repository query after a fresh durable load through `dbQuery`.

## Decisions Made

- Stored one `content_pool_ranking_features` row per post so downstream lookups stay keyed by `postId`; stored the single embedding fingerprint in the version metadata used to reconstruct the artifact.
- Sorted edge indexes by stable edge ID and returned cloned records so downstream rankers cannot mutate repository state.
- Kept the old packaged pilot projection untouched and allowed its missing graph files to enter the existing `POOL_INVALID` runtime snapshot path exactly as directed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Cleared every new Phase 3 table in Clear All Data**
- **Found during:** Task 2 (database schema implementation)
- **Issue:** Creating new user graph-memory and recommendation stores without adding them to `clearAllTables` would leave participant-derived state after the product's Clear All Data action.
- **Fix:** Added all three graph artifact stores and six user-data stores to the existing seam-based clear sequence.
- **Files modified:** `app/src/services/db.service.ts`
- **Verification:** The executable backend-parity suite inserts and clears every new table through `dbExecute`/`dbQuery`.
- **Committed in:** `9a89d4f`

**2. [Rule 3 - Blocking] Added the missing verification entry point and aligned stale package expectations**
- **Found during:** Task 2 pre-verification
- **Issue:** The required command named `tests/services/content-pool.repository.test.mjs`, but that file did not exist; the older import suite also expected the graph-less packaged pilot to load successfully.
- **Fix:** Added the named executable entry point, extended the existing fixture-only import suite with graph artifacts, and asserted the untouched old package fails with `POOL_INVALID` without network access.
- **Files modified:** `app/tests/services/content-pool.repository.test.mjs`, `app/tests/services/content-pool.import.test.mjs`
- **Verification:** The exact Task 2 command ran 16 passing tests, followed by a green TypeScript build.
- **Committed in:** `9a89d4f`

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 blocking test-path correction)
**Impact on plan:** Both changes enforce existing data-erasure and verification contracts; no product feature or compatibility path was added.

## Issues Encountered

- The frozen `pilot-v1-20260717` packaged projection predates Plan 03-01 artifacts. It remains untouched and intentionally fails runtime import until an operator performs a future authorized freeze.

## TDD Execution

- Task 3 first failed red with `ERR_MODULE_NOT_FOUND` for the not-yet-created repository, then passed its focused suite after implementation. The assignment's explicit one-commit-per-task rule kept the red/green work in the single Task 3 commit.

## Known Stubs

None. Empty maps/arrays and null fingerprints found by the scan are intentional initialization, reset, or verified no-embedding states rather than participant-visible placeholders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-03 can write personal graph contributions and concept state into the v6 stores and emit the extended unified event.
- Plans 03-04 through 03-06 can consume deterministic global graph neighbors, opposing claims, ranking features, and embedding metadata through the read-only repository.
- A future operator freeze remains required before the real packaged pilot can import under the new mandatory graph contract.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*

## Self-Check: PASSED

- All nine created or modified implementation/test files exist.
- Task commits `dbe45de`, `9a89d4f`, and `c5780b9` exist in repository history.
- Required targeted suites, the 527-test app suite, and TypeScript verification passed.
