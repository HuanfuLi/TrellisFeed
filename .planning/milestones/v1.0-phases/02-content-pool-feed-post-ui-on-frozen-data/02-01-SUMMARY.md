---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 01
subsystem: content-validation
tags: [typescript, json-schema, ajv, node-test, frozen-content]
requires:
  - phase: 01-rebrand-research-shell-hardening
    provides: privacy-narrowed research records and participant-app test baseline
provides:
  - Exact RSD content-domain TypeScript records and strict draft-2020-12 schemas
  - Fail-closed frozen-pool bundle and referential-integrity validation
  - Cross-platform Node test discovery and executable Wave 0 contract scaffolds
affects: [02-content-pipeline, 02-content-import, 02-frozen-feed, 03-graph-memory]
tech-stack:
  added: [ajv@8.17.1, ajv-formats@3.0.1, fake-indexeddb@6.2.5]
  patterns: [strict schema boundary, pure bundle validator, injected contract scaffold]
key-files:
  created: [app/src/domain/content.types.ts, tools/content_pipeline/src/schema/validate.ts, tools/content_pipeline/schemas/frozen-pool.schema.json, app/tests/fixtures/content-pool/minimal-valid-pool.json]
  modified: [app/package.json, app/package-lock.json]
key-decisions:
  - "Canonical RSD records contain only RSD fields; source bodies, transcripts, hashes, and manifest metadata remain transport-boundary records."
  - "Frozen artifacts accept fixed manifest filenames only and require exactly one owned source asset and one feed-order entry per post."
patterns-established:
  - "Schema parity: pipeline and app execute the same strict validator against the shared fixture corpus."
  - "Wave 0: downstream tests begin green against explicit injected seams, then are replaced in place with production imports."
requirements-completed: [CONT-01]
coverage:
  - id: D1
    description: Exact RSD domain records and strict record schemas
    requirement: CONT-01
    verification:
      - kind: unit
        ref: "tools/content_pipeline/test/schema.test.mjs#record schemas"
        status: pass
      - kind: other
        ref: "npm --prefix app run build"
        status: pass
    human_judgment: false
  - id: D2
    description: Aggregate frozen-pool validation and cross-record integrity checks
    requirement: CONT-01
    verification:
      - kind: integration
        ref: "tools/content_pipeline/test/schema.test.mjs#frozen bundle"
        status: pass
      - kind: integration
        ref: "app/tests/services/content-pool.schema.test.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: Cross-platform test discovery and executable Wave 0 scaffolds
    requirement: CONT-01
    verification:
      - kind: unit
        ref: "npm --prefix tools/content_pipeline test"
        status: pass
      - kind: unit
        ref: "npm --prefix app test -- --test-name-pattern=content pool schema|storage"
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 01: Domain and Frozen-Pool Contract Summary

**Exact RSD records, strict Ajv validation, shared adversarial fixtures, and a Windows-safe Wave 0 test baseline now define the frozen-content boundary.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-11T20:10:58Z
- **Completed:** 2026-07-11T20:19:14Z
- **Tasks:** 3
- **Files modified:** 39

## Accomplishments

- Added all nine CONT-01 domain entities field-for-field with strict schemas, exact enums, score ranges, formats, and forbidden extras.
- Added a strict aggregate validator covering ownership, references, feed order, frozen status, counts, hash hooks, and source-asset boundaries.
- Replaced shell-dependent app test discovery and installed pinned validation dependencies plus every Phase 2 Wave 0 scaffold.

## Task Commits

Each task was committed atomically:

1. **Task 1: Repair cross-platform test baseline and install fixtures** - `5b0f053` (chore)
2. **Task 2: Define exact RSD domain types and strict record schemas** - `9a3054d` (feat)
3. **Task 3: Add aggregate bundle and reference validation tests** - `ecb50c4` (feat)

## Files Created/Modified

- `app/src/domain/content.types.ts` - Canonical records plus separate asset/manifest transport types.
- `tools/content_pipeline/schemas/frozen-pool.schema.json` - Strict aggregate schema referencing the strict record-schema family.
- `tools/content_pipeline/src/schema/validate.ts` - Pure Ajv and referential-integrity validator.
- `app/tests/fixtures/content-pool/minimal-valid-pool.json` - Shared article/video gold fixture with inert markup.
- `tools/content_pipeline/test/schema.test.mjs` - Record, bundle, threat, and dependency-boundary tests.
- `app/tests/services/content-pool.schema.test.mjs` - App-side execution of the shared validator.
- `app/scripts/run-node-tests.mjs` - Deterministic recursive cross-platform test discovery.

## Decisions Made

- Kept source bodies, transcripts, checksums, and manifest metadata outside canonical RSD entities to prevent domain drift.
- Required fixed artifact hash keys and rejected artifact-provided paths, so JSON cannot select filesystem destinations.
- Used one shared pure validator and fixture corpus for pipeline/app parity without importing the operator package from participant runtime source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a checked-in Node discovery script**
- **Found during:** Task 1
- **Issue:** Node 22 does not recursively discover the repository suite from `node --test tests`, while the existing POSIX `find` command fails on Windows.
- **Fix:** Added `app/scripts/run-node-tests.mjs`, which recursively sorts test paths and forwards Node test flags.
- **Verification:** The task's PowerShell-compatible pattern command passed.
- **Committed in:** `5b0f053`

**2. [Rule 3 - Blocking] Added pipeline TypeScript compiler support**
- **Found during:** Task 3
- **Issue:** The pure validator uses `node:module`; standalone pipeline type-checking needed pinned Node declarations and CJS interop.
- **Fix:** Added exact `@types/node@24.10.1` and enabled `esModuleInterop`.
- **Verification:** `npm --prefix tools/content_pipeline run build` passed.
- **Committed in:** `ecb50c4`

---

**Total deviations:** 2 auto-fixed blocking issues.
**Impact on plan:** Both changes are limited to the required cross-platform harness and validator build; no participant behavior or scope was added.

## Issues Encountered

- The repaired full app baseline exposes six pre-existing Phase 1 failures, exactly as the plan anticipated. They are unrelated to test discovery and were neither skipped nor weakened.
- Dependency review found `fake-indexeddb@6.2.5` (Apache-2.0), `ajv@8.17.1` (MIT), and `ajv-formats@3.0.1` (MIT); lockfiles contain integrity hashes and no install scripts. Existing package audits still report unrelated vulnerabilities for later dependency maintenance.

## User Setup Required

None - no external service configuration required.

## Test Results

- `npm --prefix tools/content_pipeline test` — 27/27 passed.
- `npm --prefix tools/content_pipeline run build` — passed.
- `node --test app/tests/services/content-pool.schema.test.mjs` — 2/2 passed.
- `npm --prefix app run lint` — passed with pre-existing warnings only.
- `npm --prefix app run build` — passed.

## Next Phase Readiness

- Plans 02-02 through 02-09 can replace their injected scaffolds with production seams while retaining the shared strict contract.
- No plan blocker remains; the six pre-existing Phase 1 baseline failures remain visible outside this plan's verification gate.

## Self-Check: PASSED

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*
