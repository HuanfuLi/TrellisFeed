---
phase: 03-graph-memory-recommendation-engine
plan: 10
subsystem: app-packaging
tags: [frozen-pool, graph, build-assets, capacitor, sha256]

requires:
  - phase: 03-09
    provides: immutable pilot-graph-20260718 pool with exact nine-artifact runtime hashes
provides:
  - tracked operator selection of the production immutable content pool
  - deterministic ten-file runtime projection with fail-closed source and output validation
  - graph-complete generated, public, production, and Android web assets
affects: [03-11, phase-04, app-builds, Android, GRAPH-01]

tech-stack:
  added: []
  patterns:
    - tracked immutable-pool selection separated from executable packaging logic
    - explicit temporary-root package function shared by production and tests
    - exact-byte Git treatment for checksum-bound runtime projections

key-files:
  created:
    - app/content-pool.package.json
    - app/scripts/content-pool-package-contract.mjs
    - app/src/generated/content-pool-v1/sources.json
    - app/src/generated/content-pool-v1/global_edges.json
    - app/src/generated/content-pool-v1/ranking_features.json
    - app/public/content-pool-v1/sources.json
    - app/public/content-pool-v1/global_edges.json
    - app/public/content-pool-v1/ranking_features.json
  modified:
    - app/scripts/package-content-pool.mjs
    - app/tests/phase2/frozen-cutover.test.mjs
    - app/src/generated/content-pool-v1/index.ts
    - app/src/generated/content-pool-v1/manifest.json
    - app/public/content-pool-v1/manifest.json
    - .gitattributes

key-decisions:
  - "Keep the production source selection in one tracked config whose canonical target must be an existing directory inside repository data/."
  - "Derive the packaged version from the selected manifest while enforcing one exact manifest-plus-nine-artifact projection and the full immutable source inventory."
  - "Disable Git text conversion for generated and public projections so byte checks remain stable on Windows checkouts."

patterns-established:
  - "Packaging configuration selects an immutable input; executable code validates rather than pins a content version."
  - "Build outputs are allowlist projections and --check compares exact inventories and bytes."

requirements-completed: [GRAPH-01]

coverage:
  - id: D1
    description: "The tracked production selection resolves only to the reviewed immutable graph pool inside repository data/."
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: "app/tests/phase2/frozen-cutover.test.mjs#deterministic package contract fails closed on path escape, incomplete sources, and stale graph output"
        status: pass
      - kind: other
        ref: "node app/scripts/package-content-pool.mjs --check"
        status: pass
    human_judgment: false
  - id: D2
    description: "The packager validates and projects exactly manifest.json plus all nine hashed runtime artifacts without a hard-coded manifest version."
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: "app/tests/phase2/frozen-cutover.test.mjs#deterministic package command projects the selected immutable graph pool"
        status: pass
      - kind: integration
        ref: "app/tests/phase2/frozen-cutover.test.mjs#deterministic package contract fails closed on path escape, incomplete sources, and stale graph output"
        status: pass
    human_judgment: false
  - id: D3
    description: "Public, dist, and Android assets contain the exact graph-complete runtime projection with source-byte SHA-256 parity and no operator-only material."
    requirement: GRAPH-01
    verification:
      - kind: integration
        ref: "app/tests/phase2/frozen-cutover.test.mjs#production and native web assets contain only the verified runtime projection"
        status: pass
      - kind: other
        ref: "app: npm run build && npx cap sync android"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-07-19
status: complete
---

# Phase 3 Plan 10: Graph-complete App Package Cutover Summary

**The standard app build now selects the reviewed graph pool through tracked configuration and ships an exact, checksum-verified ten-file runtime projection to web and Android assets.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-19T09:47:56Z
- **Completed:** 2026-07-19T09:54:43Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Replaced the legacy pool/version/file pin with a tracked `poolRoot` selection that canonicalizes inside repository `data/` and rejects absolute, escaping, missing, or symlinked inputs.
- Added a reusable packager that verifies the complete immutable inventory, all nine runtime hashes, graph JSON shapes, exact output inventories, and stale bytes before build.
- Cut generated, public, dist, and Android assets to `pilot-graph-20260718`, including `sources.json`, `global_edges.json`, and `ranking_features.json`, with exact source hash parity.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define the graph-complete package cutover contract** - `c4d6810` (test)
2. **Task 1 GREEN: Package the operator-selected graph pool** - `0b28015` (feat)
3. **Task 2: Cut participant assets to the graph pool** - `f1a63ff` (feat)
4. **Deviation: Preserve projected asset bytes across Windows checkouts** - `178c308` (fix)

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `app/content-pool.package.json` - reviewable repository-relative production pool selection.
- `app/scripts/content-pool-package-contract.mjs` - shared ten-file contract, immutable-source verifier, deterministic generator, and stale-output checker.
- `app/scripts/package-content-pool.mjs` - thin production wrapper that reads the tracked selection and invokes the shared contract.
- `app/tests/phase2/frozen-cutover.test.mjs` - invariant-driven selection, failure-mode, build, hash-parity, and disclosure tests.
- `app/src/generated/content-pool-v1/` - compiled in-process reader and ten selected runtime files.
- `app/public/content-pool-v1/` - ten-file participant web projection.
- `.gitattributes` - exact-byte treatment for checksum-bound generated/public projections.

## Decisions Made

- Kept content selection declarative and reviewable while leaving manifest version acceptance to integrity and shape validation.
- Required the selected source directory to match `manifest.json + fixedFilenames` exactly, while allowing only the ten runtime files to enter participant assets.
- Reused one exported runtime file list for packager and tests so graph artifact additions cannot drift silently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved projected bytes across Windows Git checkouts**
- **Found during:** Task 2 (production and native asset cutover)
- **Issue:** Plan 03-09 disabled Git text conversion for the immutable source pool, but generated and public JSON/index files remained subject to `core.autocrlf`; a fresh Windows checkout could therefore fail exact-byte `--check` and source hash parity.
- **Fix:** Added narrow `-text` rules for both generated and public content-pool projection roots.
- **Files modified:** `.gitattributes`
- **Verification:** `git check-attr text` reports `unset` for source, generated, and public pool files; package `--check` and the full frozen-cutover suite pass.
- **Committed in:** `178c308`

---

**Total deviations:** 1 auto-fixed (Rule 2 missing critical functionality)
**Impact on plan:** The fix preserves the plan's exact-byte integrity guarantee across supported Windows checkouts without expanding runtime scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-11 can boot against a graph-complete packaged pool and test the first recommendation batch without a packaging compatibility gap.
- No packaging or native asset blocker remains.

## Self-Check: PASSED

- Summary file exists.
- Task commits `c4d6810`, `0b28015`, `f1a63ff`, and `178c308` exist.
- Tracked selection, shared packager, generated graph files, and public graph files exist.
- Package check, production build, Android sync, exact inventory/hash audit, and all five frozen-cutover tests pass.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-19*
