---
phase: 01-rebrand-research-shell-hardening
plan: 02
subsystem: database
tags: [indexeddb, localstorage, persistence, namespace, testing]

requires: []
provides:
  - "QuestionTrace-owned IndexedDB and local/session storage namespace"
  - "Durable research_records, research_upload_queue, and research_metadata stores"
  - "Behavioral persistence regression coverage through dbExecute/dbQuery"
affects: [01-03, 01-06, 01-07, 01-09, research-logging, upload-queue]

tech-stack:
  added: []
  patterns:
    - "Define durable stores in SHARED_DDL so TABLE_NAMES upgrades IndexedDB and the Node fallback shares the schema."
    - "Assert persistence through dbExecute/dbQuery, never through an in-memory mirror."

key-files:
  created:
    - app/tests/services/storage-namespace.test.mjs
  modified:
    - app/src/services/db.service.ts
    - app/src/main.tsx
    - app/src/services/settings.service.ts
    - app/src/services/imageGeneration.service.ts
    - app/src/lib/cold-start-profiler.ts

key-decisions:
  - "Old trellis/echolearn data is intentionally orphaned; no boot-time read-forward migration remains."
  - "The legacy heavy-key delete sweep remains a deletion-only quota-reclamation path."

patterns-established:
  - "All active application-owned storage names use questiontrace_ (or questiontrace for the primary IndexedDB database)."
  - "Research records, upload envelopes, and metadata use first-column primary keys compatible with both persistence backends."

requirements-completed: [SHELL-02]

coverage:
  - id: D1
    description: "All three durable research stores round-trip through the database seam."
    requirement: SHELL-02
    verification:
      - kind: unit
        ref: "app/tests/services/storage-namespace.test.mjs#research persistence stores round-trip through the dbQuery seam"
        status: pass
    human_judgment: false
  - id: D2
    description: "The primary database and retained storage owners use the QuestionTrace namespace."
    requirement: SHELL-02
    verification:
      - kind: unit
        ref: "app/tests/services/storage-namespace.test.mjs#active persistence owners remain in the questiontrace namespace"
        status: pass
    human_judgment: false
  - id: D3
    description: "No boot-time legacy key migration remains."
    requirement: SHELL-02
    verification:
      - kind: other
        ref: "main.tsx import/call and legacy-migration service/test absence checks"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 02: Storage Namespace and Research Stores Summary

**QuestionTrace now owns a fresh storage namespace with durable local research stores and no legacy read-forward migration.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-11T03:22:00Z
- **Completed:** 2026-07-11T03:37:07Z
- **Tasks:** 3 completed
- **Files modified:** 14

## Accomplishments

- Renamed the primary IndexedDB database and LocalStorageBackend prefix to `questiontrace`, bumped its schema version, and added `research_records`, `research_upload_queue`, and `research_metadata` to the shared DDL.
- Removed the EchoLearn-to-Trellis boot migration and its test; legacy heavy-key deletion remains deletion-only.
- Moved every retained active per-service storage key and image cache namespace to `questiontrace_*`.
- Added behavioral persistence coverage that round-trips all research stores through `dbExecute`/`dbQuery` and guards the active namespace owners.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the DB namespace, add research stores, and delete the legacy migration** - `a0c0e2b` (feat)
2. **Task 2: Rename all retained per-service storage-key owners to the questiontrace namespace** - `932b249` (feat)
3. **Task 3: Author the storage-namespace behavioral test (through dbQuery)** - `c9fd541` (test)

## Files Created/Modified

- `app/src/services/db.service.ts` - QuestionTrace DB namespace, research DDL rows, clear-all coverage, and diagnostic tags.
- `app/src/main.tsx` - No longer imports or runs legacy read-forward migration.
- `app/src/services/legacy-migration.service.ts` - Deleted incompatible migration implementation.
- `app/tests/services/legacy-migration.test.mjs` - Deleted obsolete migration test.
- `app/src/services/settings.service.ts`, `daily-read.service.ts`, `session.service.ts`, `concept-feed.service.ts`, `filter-corpus.service.ts`, `imageGeneration.service.ts`, `app/src/lib/cold-start-profiler.ts` - Active storage values now use the QuestionTrace namespace.
- `app/tests/services/settings-locale.test.mjs`, `app/tests/services/daily-read.service.test.mjs` - Test fixtures now seed active QuestionTrace keys.
- `app/tests/services/storage-namespace.test.mjs` - Research-store round-trip and namespace regression coverage.

## Decisions Made

- Kept `LEGACY_HEAVY_KEYS` and `clearLegacyHeavyLocalStorageKeys()` unchanged because they only delete orphaned legacy data; no reader repoints to old state.
- Kept new research rows within `SHARED_DDL`, preserving automatic IndexedDB object-store derivation and the LocalStorageBackend SQL subset.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing service tests seeded the retired keys**
- **Found during:** Task 2 (Rename all retained per-service storage-key owners to the questiontrace namespace)
- **Issue:** locale and daily-read tests wrote `trellis_settings` / `trellis_daily_read`, so they failed after the deliberate no-migration rename.
- **Fix:** updated only the test fixture keys to the active `questiontrace_*` values.
- **Files modified:** `app/tests/services/settings-locale.test.mjs`, `app/tests/services/daily-read.service.test.mjs`
- **Verification:** focused settings-locale and daily-read tests pass.
- **Committed in:** `932b249` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 test-fixture bug).
**Impact on plan:** Necessary to preserve behavior tests while enforcing the locked no-migration rule; no production scope expansion.

## TDD Gate Compliance

Task 3 was marked `tdd="true"`, but Tasks 1 and 2 deliberately implement the schema and key rename before the task creates its regression test. The new test therefore passed immediately; a true RED commit was impossible without undoing completed plan work. `c9fd541` records the test gate, while `a0c0e2b` and `932b249` contain the preceding implementation.

## Issues Encountered

- `npm test` is not runnable from this PowerShell environment because its script uses Unix `$(find ...)` substitution. An equivalent PowerShell-expanded `node --test` discovery run included the new test but reported six unrelated existing failures in BottomSheet, ChatInput, BottomSheet consumer, and post-history source-contract tests. These paths were outside this plan and were not modified.
- `npm run lint` passed with 26 pre-existing warnings and no errors. `npm run build` passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Logging and upload-queue plans can use `research_records`, `research_upload_queue`, and `research_metadata` through the existing DB seam.
- Phase-level browser/device UAT should confirm a fresh install creates the `questiontrace` IndexedDB database and all three object stores; the Node fallback cannot exercise browser IndexedDB upgrades.

## Self-Check: PASSED

- Confirmed `IDB_NAME='questiontrace'`, `IDB_VERSION=2`, `PREFIX='questiontrace_db_'`, all three research DDL rows, and clear-all coverage.
- Confirmed `main.tsx` has no migration import/call and the migration implementation/test are absent.
- Focused storage, locale, and daily-read tests pass; lint and production build pass.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
