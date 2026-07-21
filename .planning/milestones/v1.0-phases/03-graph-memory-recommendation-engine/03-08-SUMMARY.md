---
phase: 03-graph-memory-recommendation-engine
plan: 08
subsystem: database
tags: [indexeddb, migration, recommendation, dead-code, testing]

requires:
  - phase: 03-07
    provides: persisted recommendation batches served by Home
  - phase: 02-09
    provides: frozen-content cutover and bulk generated-feed shell removal
provides:
  - zero source/test residue for the retired concept-feed, post-queue, style-assignment, feed-spread, and refill-mutex shell
  - IndexedDB v7 migration deleting only posts, post queue, and sessions stores
  - executable v6-to-v7 retention coverage for every surviving object store and LocalStorage fallback parity
affects: [phase-04, persistence, recommendation-feed, RANK-06]

tech-stack:
  added: []
  patterns:
    - one-way IndexedDB store retirement with survivor-row verification through dbQuery
    - live-path contract tests instead of source-string guards for retired modules

key-files:
  created: []
  modified:
    - app/src/services/db.service.ts
    - app/tests/services/storage-namespace.test.mjs
    - app/tests/phase2/frozen-cutover.test.mjs
    - app/tests/screens/HomeScreen.frozen-feed.test.mjs
    - app/tests/screens/PostDetailScreen.frozen-content.test.mjs

key-decisions:
  - "Keep the three retired fallback table names in a one-way migration list while preventing their raw module residue from appearing as a live schema surface."
  - "Seed and query every surviving v6 object store, not only one representative store, before accepting the v7 migration."

patterns-established:
  - "Destructive schema upgrades require execution-time reader/writer greps plus dbQuery survivor retention tests."
  - "Retired-shell tests preserve positive live-path contracts and remove absence-by-string assertions."

requirements-completed: [RANK-06]

coverage:
  - id: D1
    description: "Retired transitional feed modules and symbols have zero residue in app source and tests."
    requirement: RANK-06
    verification:
      - kind: other
        ref: "rg concept-feed|post-queue|style-assignment|feed-spread|refill-mutex|walkDerivedList app/src app/tests"
        status: pass
      - kind: integration
        ref: "app: npx tsc -b --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live recommendation, frozen-content, navigation, and storage contracts no longer pin the retired shell."
    requirement: RANK-06
    verification:
      - kind: integration
        ref: "app: npm test (586 tests, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "IndexedDB v7 and fallback cleanup delete only retired stores while preserving every survivor row."
    requirement: RANK-06
    verification:
      - kind: integration
        ref: "app/tests/services/storage-namespace.test.mjs#IndexedDB v6 to v7 upgrade removes only retired stores and retains every survivor row"
        status: pass
      - kind: integration
        ref: "app: npm test && npm run lint && npm run build"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 8: Guarded Transitional Feed Removal Summary

**IndexedDB v7 retires only the generated-feed stores while executable migration tests preserve every recommendation, graph-memory, research, Q&A, engagement, history, and frozen-pool row.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-18T08:37:51Z
- **Completed:** 2026-07-18T08:50:44Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Completed execution-time guarded caller/export sweeps and removed the final source/test comments and string guards naming the retired shell.
- Retargeted frozen-feed, Home, PostDetail, navigation, and filter-cache tests to positive live-path contracts; the full suite reports zero skips.
- Bumped IndexedDB from v6 to v7, removed only the three retired stores, added equivalent LocalStorage fallback cleanup, and proved every surviving store retains its seeded row through `dbQuery`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guarded source removal — five modules + dead callers** - `1999d7b` (refactor)
2. **Task 2: Test sweep — remove pinning tests, rewrite the load-bearing ones** - `368e0b5` (test)
3. **Task 3: IDB store cleanup + full gates + residue proof** - `f4b36e0` (refactor)

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `app/src/App.tsx` - describes the persisted recommendation-batch hydration gate without transitional refill terminology.
- `app/src/state/keyboard-hysteresis.ts` - keeps the React-free helper rationale independent of a retired module.
- `app/src/services/db.service.ts` - defines the v7 upgrade and fallback cleanup for exactly three retired stores.
- `app/tests/services/storage-namespace.test.mjs` - proves fallback parity and all-store v6-to-v7 survivor retention through `dbQuery`.
- `app/tests/phase2/frozen-cutover.test.mjs` - retains the runtime acquisition boundary without asserting retired filenames/symbols.
- `app/tests/screens/HomeScreen.frozen-feed.test.mjs` - positively verifies the recommendation/frozen-post serving seam.
- `app/tests/screens/PostDetailScreen.frozen-content.test.mjs` - positively verifies frozen record/original resolution while preserving detector coverage.
- `app/tests/components/BottomNavigation.slide.test.mjs` - removes a stale retired-helper comment while preserving keyboard guards.
- `app/tests/services/filter-cache.test.mjs` - removes a stale retired-test scaffold reference.
- `app/tests/hooks/useLongPress.test.mjs` - removes a stale deleted-component test reference.

## Decisions Made

- Used the last tracked pre-cutover versions of the already-removed modules to recover every exported symbol, then grepped each symbol against current HEAD before accepting the prior deletion.
- Tested all 26 survivor stores during the v6-to-v7 upgrade rather than treating one history row as representative of the whole schema.
- Kept the LocalStorage fallback schema-parity rule by removing the same retired namespaces during fallback initialization.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Isolated the quarantine test from the seeded upgrade fixture**
- **Found during:** Task 3 targeted migration verification
- **Issue:** The all-store v6 fixture intentionally seeded the quarantine survivor, so the following test observed two rows instead of its assumed one.
- **Fix:** Cleared the live quarantine store through `dbExecute` before inserting that test's fixture.
- **Files modified:** `app/tests/services/storage-namespace.test.mjs`
- **Verification:** Targeted storage suite passed 5/5; final suite passed 586 tests with zero skips.
- **Committed in:** `f4b36e0`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Test isolation only; the migration scope and production behavior were unchanged.

## Issues Encountered

- Phase 2 commit `31f67b6` had already deleted the five modules, their dead production callers, and most inventoried tests. The guarded sweep recovered the prior export surfaces from Git and re-ran all caller/residue checks against current HEAD rather than replaying deletions.
- Lint completed with zero errors and seven pre-existing warnings outside this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3's final plan is complete; Phase 4 can rely on recommendation batches as the only participant-facing feed seam.
- No retired transitional module/test residue remains in `app/src` or `app/tests`.

## Self-Check: PASSED

- Summary file exists.
- Task commits `1999d7b`, `368e0b5`, and `f4b36e0` exist.
- Key migration and contract-test files exist.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*
