---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 05
subsystem: content-persistence
tags: [indexeddb, fake-indexeddb, frozen-content, integrity, react-boot]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 01
    provides: exact content-domain records, strict frozen-pool contract, and injected fixtures
provides:
  - Fail-closed injected packaged-pool reader and strict whole-bundle integrity validation
  - Versioned staged IndexedDB repository with importing-to-ready exposure barrier
  - Participant boot gate with localized diagnostic and retry behavior
affects: [02-frozen-feed, 02-feed-ui, 02-packaged-pool-binding, 03-graph-memory]
tech-stack:
  added: []
  patterns: [version-qualified heavy stores, importing-ready visibility barrier, injected packaged reader, boot hydration gate]
key-files:
  created: [app/src/data/content-pool-bundle.ts, app/src/services/content-pool.repository.ts]
  modified: [app/src/services/db.service.ts, app/src/App.tsx, app/tests/services/content-pool.import.test.mjs]
key-decisions:
  - "The runtime reader accepts only seven fixed logical filenames; its production default is POOL_NOT_PACKAGED until Plan 09 binds the frozen artifact."
  - "Cross-store atomic visibility is provided by version-qualified rows and an importing-to-ready metadata barrier, never fake SQL transaction verbs."
  - "Ready versions are immutable and stored corruption fails closed rather than silently repairing or merging content."
patterns-established:
  - "Pool exposure: validate packaged bytes before writes, verify staged durable rows, then and only then mark the version ready."
  - "Diagnostics: expose allowlisted error codes only; never surface raw storage or packaged-reader errors."
requirements-completed: [CONT-01, CONT-03]
coverage:
  - id: D1
    description: Parity-safe versioned content-pool stores and reset coverage
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "app/tests/services/content-pool.import.test.mjs#content pool schema and backend parity"
        status: pass
    human_judgment: false
  - id: D2
    description: Strict packaged-only validation and idempotent staged repository import
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "app/tests/services/content-pool.import.test.mjs#bundled content pool import"
        status: pass
      - kind: integration
        ref: "app/tests/services/content-pool.schema.test.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: Participant boot waits for a ready pool or renders an explicit fail-closed retry state
    requirement: CONT-03
    verification:
      - kind: other
        ref: "npm --prefix app run build"
        status: pass
      - kind: integration
        ref: "app/tests/services/content-pool.import.test.mjs#retries a failed hydration on the same repository without a reload"
        status: pass
      - kind: integration
        ref: "app/tests/layout/root-horizontal-clip.test.mjs"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 05: Frozen Content-Pool Runtime Boundary Summary

**A fixed-name packaged loader, checksum-verified versioned repository, and awaited boot gate now keep partial, corrupt, mismatched, or remotely acquired content out of participant views.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-11T20:45:24Z
- **Completed:** 2026-07-11T20:58:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added seven parity-safe content-pool stores, an IndexedDB version upgrade, and complete research-reset coverage exercised through both real and fallback DB seams.
- Added fixed-name injected bundle loading, strict record/reference/count/version/hash/asset validation, version-qualified staged import, immutable ready versions, and synchronous canonical getters.
- Gated participant routing on pool hydration and added a bounded localized fatal/retry state without changing the two-slot navigation, header, gesture, or root-overflow structures.

## Task Commits

Each task was committed atomically, with RED/GREEN pairs for the two TDD tasks:

1. **Task 1: Add parity-safe heavy stores and executable fake IndexedDB coverage** - `0754906` (test), `38ff8b1` (feat)
2. **Task 2: Implement whole-bundle validation and staged idempotent import** - `a490b72` (test), `43a87d8` (feat)
3. **Task 3: Gate participant boot on frozen-pool hydration** - `94a2ac1` (feat)

## Files Created/Modified

- `app/src/data/content-pool-bundle.ts` - Fixed logical filenames, injected reader, strict validation, SHA-256 checks, and fail-closed default.
- `app/src/services/content-pool.repository.ts` - Versioned staged import, durable verification, ready-only mirrors, retry, and canonical getters.
- `app/src/services/db.service.ts` - Seven content-pool stores, IndexedDB v3 upgrade, and clear-all registration.
- `app/src/App.tsx` - Awaited pool hydration plus bounded localized diagnostic/retry rendering.
- `app/tests/services/content-pool.import.test.mjs` - Executable fake IndexedDB, fallback parity, tamper/interruption/quota/retry, and no-network coverage.

## Decisions Made

- Kept the Plan 05 production reader deliberately unbound and deterministic (`POOL_NOT_PACKAGED`); Plan 09 remains the sole production artifact binding point.
- Used canonical storage hashes for re-query verification while preserving packaged artifact hashes in ready metadata, so durable validation is independent of JSON whitespace.
- Preserved source article/transcript material as inert strings and exposed it only after the containing version reaches `ready`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first build found an incorrect existing locale key path for the retry label; the key was corrected to the already-localized `home.history.errorRetry` before Task 3 was committed.
- Lint passes with the repository's 26 pre-existing warnings and zero errors.

## User Setup Required

None - no external service configuration required.

## Test Results

- `node --test tests/services/content-pool.import.test.mjs --test-name-pattern="schema|backend|clear"` — passed.
- `node --test tests/services/content-pool.import.test.mjs` — 15/15 passed.
- `node --test tests/services/content-pool.schema.test.mjs tests/services/content-pool.import.test.mjs` — 17/17 passed.
- Navigation/root regression set (`content-pool.import`, `root-horizontal-clip`, `SwipeTabContainer.resize-guard`) — 20/20 passed.
- `npm run lint` — passed with 0 errors and 26 pre-existing warnings.
- `npm run build` — passed.

## Next Phase Readiness

- Plans 06–08 can consume the ready-only repository boundary without reading raw stores or acquiring content remotely.
- Plan 09 must bind D-08's real frozen artifact to `PackagedPoolReader`; until then the intentional production state is the explicit `POOL_NOT_PACKAGED` diagnostic.

## Self-Check: PASSED

- Confirmed all three created/required artifacts exist on disk.
- Confirmed five `02-05` task commits are present.
- Re-ran every task verification, acceptance criterion, plan-level schema/import gate, lint, build, and navigation/root regression checks.

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*
