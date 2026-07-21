---
phase: 03-graph-memory-recommendation-engine
plan: 11
subsystem: app-runtime
tags: [content-pool, global-graph, hydration-barrier, recommendations, android]

requires:
  - phase: 03-09
    provides: exact nine-artifact immutable graph pool integrity contract
  - phase: 03-10
    provides: graph-complete production pool selection and ten-file app projection
provides:
  - fail-closed pool-plus-global-graph hydration barrier before participant routes mount
  - deterministic offline fresh-freeze-to-first-batch regression for control and experimental conditions
  - production Android debug APK containing the reviewed graph pool runtime projection
affects: [phase-04, app-boot, recommendation-runtime, Android, GRAPH-01, RANK-01, RANK-05]

tech-stack:
  added: []
  patterns:
    - coupled durable import and in-memory index hydration behind one retryable boot boundary
    - cross-boundary tests use fresh synthetic operator-approved runs and query persistence through dbQuery

key-files:
  created:
    - app/src/services/content-pool-boot.service.ts
    - app/tests/services/content-pool-boot.service.test.mjs
    - app/tests/fixtures/fresh-graph-pool-run.mjs
    - app/tests/phase3/fresh-graph-pool-cutover.test.mjs
  modified:
    - app/src/App.tsx

key-decisions:
  - "Map global graph load failure to POOL_STORED_CORRUPT so the existing content recovery surface remains the only participant-visible boot failure path."
  - "Keep graph loading explicit in the app boot barrier; ranking queries retain their strict requireLoaded contract and never lazily hydrate."
  - "Exercise both conditions from a freshly frozen twelve-post local run while making every live network and AI dependency impossible in the regression."

patterns-established:
  - "Participant routes consume a ready result only from ContentPoolBootService, which means both the durable pool and global graph indexes are ready."
  - "Fresh-pool regressions cross freeze, package, import, index, rank, reason, and persisted batch boundaries in one executable test."

requirements-completed: [GRAPH-01, RANK-01, RANK-02, RANK-03, RANK-05, RANK-06]

coverage:
  - id: D1
    description: "App boot exposes participant routes only after content-pool hydration and successful global graph index loading, with retryable fail-closed recovery."
    requirement: GRAPH-01
    verification:
      - kind: unit
        ref: "app/tests/services/content-pool-boot.service.test.mjs#content pool boot barrier"
        status: pass
      - kind: integration
        ref: "app/tests/services/global-graph.repository.test.mjs#global graph repository"
        status: pass
      - kind: other
        ref: "app: npx tsc -b --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fresh local freeze packages, imports, loads, and persists eight ready first recommendations for both study conditions with policy-correct reasons and real trace IDs."
    requirement: RANK-05
    verification:
      - kind: integration
        ref: "app/tests/phase3/fresh-graph-pool-cutover.test.mjs#fresh graph pool freezes, packages, boots, and persists both first recommendation batches offline"
        status: pass
      - kind: integration
        ref: "app: npm test (611 tests, zero failures/skips)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reviewed pilot graph pool passes production packaging and builds into a graph-complete Android debug APK."
    requirement: GRAPH-01
    verification:
      - kind: other
        ref: "app: npm run lint (zero errors) && npm run build"
        status: pass
      - kind: integration
        ref: "app: node scripts/package-content-pool.mjs --check && npx cap sync android"
        status: pass
      - kind: other
        ref: "app/android: gradlew.bat assembleDebug"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-19
status: complete
---

# Phase 3 Plan 11: Fresh Graph Pool Runtime Cutover Summary

**One retryable app boot barrier now couples immutable pool import to global graph hydration, backed by an offline two-condition freeze-to-recommendation regression and a production Android APK.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-19T10:08:30Z
- **Completed:** 2026-07-19T10:17:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Prevented Home and every participant route from mounting until both the content pool and global graph indexes are ready; graph load failures remain on the existing retry surface.
- Added a deterministic offline integration test that freshly freezes and packages 12 approved same-topic posts, imports through fake IndexedDB, and persists exactly eight ready recommendations for each condition with no stranded building batch.
- Passed all app, package, Capacitor, and Android build gates against `pilot-graph-20260718`, producing a graph-complete debug APK ready for the original API 36 UAT rerun.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define the content-pool boot barrier** - `d4ce356` (test)
2. **Task 1 GREEN: Gate participant routes on graph hydration** - `446643a` (fix)
3. **Task 2 RED: Define the fresh-pool cutover regression** - `668ed05` (test)
4. **Task 2 GREEN: Add the deterministic approved-run fixture** - `6b8130a` (test)
5. **Task 3: Run production and Android gates** - `b6b0471` (chore)

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `app/src/services/content-pool-boot.service.ts` - combines pool hydration and awaited global graph loading into one fail-closed result.
- `app/src/App.tsx` - routes the existing durable hydration barrier through the combined boot service before participant startup.
- `app/tests/services/content-pool-boot.service.test.mjs` - proves pool-to-graph ordering, error mapping, and full retry behavior.
- `app/tests/fixtures/fresh-graph-pool-run.mjs` - builds twelve deterministic operator-approved local review records without secrets or external data.
- `app/tests/phase3/fresh-graph-pool-cutover.test.mjs` - executes freeze, package, checksum, import, graph load, both rankers, reasons, trace IDs, and batch persistence.

## Decisions Made

- Used `POOL_STORED_CORRUPT` for a graph-index hydration failure because those indexes are part of the persisted ready pool's runtime projection and the error is recoverable by repeating the full barrier.
- Preserved `GlobalGraphRepository.requireLoaded()` unchanged and kept all loading at app boot, preventing ranking from masking lifecycle errors through lazy access.
- Kept control integration structurally isolated with throwing personal-state dependencies and zero reason-responder calls; experimental cold-start uses only deterministic local responders and empty personal history.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Lint retained seven pre-existing warnings and reported zero errors, matching the established warning policy.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The checked-in production path now builds a graph-complete APK and is ready for `/gsd-verify-work 3` to rerun the original Android API 36 control/experimental reason-surface acceptance.
- No automated runtime, package, persistence, or Android build blocker remains.

## Self-Check: PASSED

- All four created files and the modified App wiring exist.
- Task commits `d4ce356`, `446643a`, `668ed05`, `6b8130a`, and `b6b0471` exist.
- Targeted tests, the 611-test app suite, TypeScript, lint, production build, package check, Capacitor sync, graph-file audit, and Android debug assembly passed.
- The regression confirms both positive batches are ready and both negative graph cases persist zero recommendation or batch rows.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-19*
