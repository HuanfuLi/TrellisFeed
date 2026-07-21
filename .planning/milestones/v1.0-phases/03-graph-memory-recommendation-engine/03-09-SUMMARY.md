---
phase: 03-graph-memory-recommendation-engine
plan: 09
subsystem: content-pipeline
tags: [frozen-pool, graph, integrity, sha256, immutable-content]

requires:
  - phase: 03-01
    provides: typed global graph compiler and graph runtime artifacts
  - phase: 03-08
    provides: recommendation-only participant feed substrate
provides:
  - one exact nine-file runtime artifact inventory shared by freeze writing and verification
  - fail-closed schema and checksum enforcement for all three graph artifacts
  - immutable pilot-graph-20260718 pool containing 77 operator-approved posts
affects: [03-10, 03-11, phase-04, app-packaging, GRAPH-01]

tech-stack:
  added: []
  patterns:
    - separate exact runtime hash inventory from the broader immutable audit-file inventory
    - byte-preserving Git attributes for checksum-bound frozen artifacts

key-files:
  created:
    - tools/content_pipeline/src/freeze/runtime-artifacts.ts
    - data/content_pool_graph_20260718/manifest.json
    - .gitattributes
  modified:
    - tools/content_pipeline/src/freeze/build.ts
    - tools/content_pipeline/src/freeze/verify.ts
    - tools/content_pipeline/schemas/frozen-pool.schema.json
    - tools/content_pipeline/test/freeze-graph-artifacts.test.mjs
    - tools/content_pipeline/test/schema.test.mjs
    - app/tests/fixtures/content-pool/minimal-valid-pool.json

key-decisions:
  - "Keep artifactHashes as the exact nine-file participant runtime contract while fixedFilenames and bundleFileHashes continue covering every immutable source and audit artifact."
  - "Freeze the approved review run only into pilot-graph-20260718 at a new destination; never patch or replace data/content_pool_v1."
  - "Disable Git text conversion only for the new checksum-bound pool so Windows checkouts preserve the exact hashed bytes."

patterns-established:
  - "Runtime consumers, freeze writing, and verification must agree on one explicit nine-artifact integrity boundary."
  - "Versioned frozen-pool directories are append-only outputs whose destination-exists guard is part of correctness."

requirements-completed: [GRAPH-01]

coverage:
  - id: D1
    description: "Fresh freezes hash exactly the six content artifacts and three graph artifacts, and verification detects independent graph runtime tampering."
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: "tools/content_pipeline/test/freeze-graph-artifacts.test.mjs#freeze graph artifacts replace untyped helpers and enter the immutable hash contract"
        status: pass
      - kind: integration
        ref: "tools/content_pipeline/test/freeze-graph-artifacts.test.mjs#freeze graph verification rejects a graph runtime checksum mismatch even when its bundle hash is current"
        status: pass
      - kind: other
        ref: "tools/content_pipeline: npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "The frozen-pool schema rejects missing and additional runtime hash keys."
    requirement: GRAPH-01
    verification:
      - kind: unit
        ref: "tools/content_pipeline/test/schema.test.mjs#frozen pool manifest requires exactly the nine runtime artifact hash keys"
        status: pass
    human_judgment: false
  - id: D3
    description: "A separately versioned immutable 77-post graph pool passes the full offline verifier and contains no retired edge helpers."
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: "tools/content_pipeline: npm run cli -- freeze --output ../../data/content_pool_graph_20260718 --verify-only"
        status: pass
      - kind: integration
        ref: "tools/content_pipeline: npm test (84 tests) && npm run build"
        status: pass
      - kind: other
        ref: "manifest audit: pilot-graph-20260718, approvedCount 77, exact nine runtime hashes, graph files in both hash inventories"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-19
status: complete
---

# Phase 3 Plan 9: Immutable Graph Pool Integrity Cutover Summary

**The offline freezer now enforces one exact nine-artifact runtime contract and produces a byte-stable, separately versioned 77-post graph pool.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-19T09:29:06Z
- **Completed:** 2026-07-19T09:34:22Z
- **Tasks:** 2
- **Files modified:** 96

## Accomplishments

- Unified freeze writing and verification around a single nine-file runtime inventory, including `sources.json`, `global_edges.json`, and `ranking_features.json`.
- Added executable exact-key, per-file checksum, graph-tamper, and schema rejection coverage while keeping the strict app importer unchanged.
- Promoted the existing operator-approved run into immutable `pilot-graph-20260718` with 77 posts, both runtime and bundle hashes for every graph artifact, and no retired untyped helper files.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define the nine-artifact freeze contract** - `7984e23` (test)
2. **Task 1 GREEN: Unify frozen runtime artifact integrity** - `b08630a` (fix)
3. **Task 2: Produce a separately versioned immutable graph pool** - `6d56a1c` (feat)

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `tools/content_pipeline/src/freeze/runtime-artifacts.ts` - canonical readonly nine-file participant runtime inventory.
- `tools/content_pipeline/src/freeze/build.ts` - hashes every runtime artifact from the shared inventory.
- `tools/content_pipeline/src/freeze/verify.ts` - reads and verifies every runtime artifact before structural validation.
- `tools/content_pipeline/schemas/frozen-pool.schema.json` - requires exactly nine named runtime hashes and rejects extras.
- `tools/content_pipeline/test/freeze-graph-artifacts.test.mjs` - proves exact hashes and graph-file tamper rejection.
- `tools/content_pipeline/test/schema.test.mjs` - proves missing and additional runtime hash keys fail schema validation.
- `app/tests/fixtures/content-pool/minimal-valid-pool.json` - represents the canonical nine-hash manifest shape.
- `data/content_pool_graph_20260718/` - immutable 77-post Phase 3 graph pool and audit/source artifacts.
- `.gitattributes` - prevents line-ending conversion from invalidating checksums in the new pool.

## Decisions Made

- Preserved the distinction between the nine participant runtime artifacts and the broader immutable bundle inventory containing source files and review audit logs.
- Reused the approved `pilot-v1-20260716` run without rewriting it, and promoted only to the new `pilot-graph-20260718` destination/version.
- Kept `data/content_pool_v1` byte-for-byte untouched and retained the destination-exists fail-closed promotion guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved checksum-bound bytes across Windows Git checkouts**
- **Found during:** Task 2 immutable pool commit
- **Issue:** The repository has `core.autocrlf=true` and no prior attributes rule, so a later checkout could rewrite line endings and make valid manifest hashes fail.
- **Fix:** Added a narrow `-text` rule for `data/content_pool_graph_20260718/**`.
- **Files modified:** `.gitattributes`
- **Verification:** `git check-attr text` reports `unset` for pool artifacts and verify-only passes after the rule is active.
- **Committed in:** `6d56a1c`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** The added rule closes a platform-specific integrity hole without changing artifact contents, runtime behavior, or legacy pool files.

## Issues Encountered

- The graph compiler emitted advisory `unresolved-concept-label` warnings inherited from reviewed relation labels. It emitted no invalid endpoints; the offline verifier, all 84 pipeline tests, and TypeScript build passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-10 can select and package `pilot-graph-20260718` with a manifest already compatible with the app's strict nine-artifact importer.
- The legacy pool remains untouched, and no blocker remains in the offline freeze boundary.

## Self-Check: PASSED

- Summary file exists.
- Task commits `7984e23`, `b08630a`, and `6d56a1c` exist.
- Shared inventory, immutable graph pool, and manifest exist on disk.
- Targeted tests, full 84-test pipeline suite, TypeScript build, verify-only, manifest audit, and legacy-pool diff checks pass.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-19*
