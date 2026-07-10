---
phase: 55-algorithm-mechanism-tuning
plan: 05
subsystem: database
tags: [sqlite-wasm, opfs, opfs-sahpool, storage-migration, float32-blob, in-memory-mirror, hydration, db-service]

# Dependency graph
requires:
  - phase: 55-01
    provides: "OPFS GO verdict + @sqlite.org/sqlite-wasm ^3.53.0-build1 installed + storage-migration.test.mjs scaffold"
provides:
  - "WASMSQLiteBackend (opfs-sahpool) as the primary browser DBBackend, with LocalStorageBackend retained as the OPFS try/catch fallback"
  - "Whole heavy-store layer migrated to SQLite-primary (D-09): questions, sessions, daily-posts cache, post-queue, post-history, flashcards, collections, engagement, podcast metadata"
  - "Float32 base64 BLOB embedding codec (vectorToBase64/base64ToVector) on the questions.embedding column (D-13)"
  - "Boot orchestration hydrateAllFromSQLite() that rehydrates every migrated in-memory mirror and emits resync events (D-12)"
  - "D-11 clean cutover: clearAllTables clears all new tables + removes all 13 legacy heavy-store localStorage keys"
affects: [56-ui-polish-and-cleanup, future-storage-evolution]

# Tech tracking
tech-stack:
  added:
    - "@sqlite.org/sqlite-wasm opfs-sahpool VFS as the active browser backend (installed in 55-01)"
  patterns:
    - "SQLite-primary + synchronous in-memory localStorage mirror (D-12): reads stay sync, writes are async write-through"
    - "Per-service hydrateXFromSQLite() behind a mirror-has-data delete-guard, emitting a resync event"
    - "Transaction-wrapped (BEGIN/INSERT*/COMMIT) full-table snapshot for collection stores; single-row blob upsert for single-state stores"

key-files:
  created: []
  modified:
    - "app/vite.config.ts — optimizeDeps.exclude @sqlite.org/sqlite-wasm"
    - "app/src/services/db.service.ts — WASMSQLiteBackend + SHARED_DDL + getDB fallback + clearAllTables cutover"
    - "app/src/services/question.service.ts — SQLite-primary inversion + Float32 BLOB codec + awaited delete"
    - "app/src/services/post-queue.service.ts — single-row write-through + hydrateQueueFromSQLite"
    - "app/src/services/post-history.service.ts — table write-through + hydratePostHistoryFromSQLite"
    - "app/src/services/concept-feed.service.ts — daily-posts cache write-through + hydrateDailyPostsFromSQLite"
    - "app/src/services/session.service.ts — table write-through + hydrateSessionsFromSQLite"
    - "app/src/services/flashcard.service.ts — table write-through + hydrateFlashcardsFromSQLite"
    - "app/src/services/collection.service.ts — single-row write-through + hydrateCollectionsFromSQLite"
    - "app/src/services/engagement.service.ts — single-row write-through + hydrateEngagementFromSQLite"
    - "app/src/services/podcast.service.ts — metadata-only write-through + hydratePodcastsFromSQLite"
    - "app/src/App.tsx — hydrateAllFromSQLite() boot orchestration"

key-decisions:
  - "WASMSQLiteBackend is the ACTIVE browser backend (55-01 GO verdict); LocalStorageBackend kept only as the getDB() OPFS try/catch fallback"
  - "COOP/COEP server.headers OMITTED — opfs-sahpool needs none on Chromium; documented in vite.config.ts"
  - "Single-state stores (post-queue, daily-posts cache, collections, engagement) map to a single SQLite row; collection stores (questions, sessions, flashcards, podcasts, post-history) map to (id,data) per-row tables"
  - "post-queue hydrate round-trips through load() to reuse its date-mismatch + defensive-default branches rather than duplicating the 3-list pipeline normalization"
  - "post-history hydrate reuses GRAPH_UPDATED (no new event type) per CLAUDE.md one-signal-per-semantic-event"
  - "trellis_video_cache / trellis_news_posts are owned by youtube.service.ts / cross-cutting read paths (out of files_modified); cleared on cutover but their per-store write-through is left as localStorage API caches (boundary noted below)"

patterns-established:
  - "hydrateXFromSQLite(): guard on mirror-has-data → SELECT → repopulate mirror → emit resync event"
  - "Float32 base64 BLOB persisted in a dedicated column, stripped from JSON data to avoid double-store"

requirements-completed: [TUNE-01]

# Metrics
duration: ~40min
completed: 2026-05-21
---

# Phase 55 Plan 05: Whole-store SQLite-primary migration Summary

**WASMSQLiteBackend (opfs-sahpool) is now the primary browser backend behind the existing DBBackend seam, with the whole heavy-store layer inverted to SQLite-primary + a synchronous in-memory mirror, Float32 base64 BLOB embedding vectors, a clean D-11 cutover clearing all 13 legacy keys, and a boot hydrate-all orchestration.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-05-21T06:55Z (approx)
- **Completed:** 2026-05-21T07:33Z
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments
- Added `WASMSQLiteBackend` (opfs-sahpool, `@sqlite.org/sqlite-wasm`) as the active browser backend with a graceful `LocalStorageBackend` fallback if OPFS init throws — the app never crashes on backend-init failure (T-55-05b).
- Inverted `question.service` to SQLite-primary: embedding vectors persist as a Float32 base64 BLOB in a dedicated `questions.embedding` column (≤1e-6 round-trip), stripped from the JSON `data` payload — eliminating the ~18 KB double-store that drove the localStorage quota wall.
- Migrated all remaining heavy stores (post-queue, post-history, daily-posts cache, sessions, flashcards, collections, engagement, podcast metadata) to SQLite write-through behind a preserved synchronous in-memory mirror (D-12 LOCKED INVARIANT — no read API became async).
- `clearAllTables` now performs the D-11 clean cutover: clears all new tables AND removes all 13 legacy heavy-store localStorage keys (tiny boot-critical prefs untouched).
- `App.tsx` boot `hydrateAllFromSQLite()` void-fires every migrated service's hydrate; each hydrate is delete-guarded and emits its resync event (no-refresh assumption preserved).

## Task Commits

1. **Task 1: WASMSQLiteBackend + extended schema + cutover + Vite config** — `2843d148` (feat)
2. **Task 2: question.service SQLite-primary + Float32 BLOB + awaited delete** — `74865228` (feat)
3. **Task 3a: feed-pipeline heavy stores (concept-feed, post-queue, post-history)** — `e0b552f2` (feat)
4. **Task 3b: remaining stores (sessions/flashcards/collections/engagement/podcast) + boot orchestration** — `0e86864a` (feat)

_Note: Task 2 carried a `tdd="true"` flag; the RED scaffold (storage-migration.test.mjs) existed from 55-01 — turned green by the Task 2 implementation._

## Files Created/Modified
- `app/vite.config.ts` — `optimizeDeps.exclude: ['@sqlite.org/sqlite-wasm']` (Pitfall 2); COOP/COEP omitted (opfs-sahpool needs none on Chromium).
- `app/src/services/db.service.ts` — `WASMSQLiteBackend implements DBBackend`; `SHARED_DDL` (10 new tables + `questions.embedding BLOB`) run by both backends; `getDB()` browser → WASM with LocalStorage fallback; `clearAllTables` 13-key cutover.
- `app/src/services/question.service.ts` — `vectorToBase64`/`base64ToVector`; `persistToSQLite` embedding-BLOB column; `hydrateFromSQLite` reassembles vector + emits GRAPH_UPDATED + preserves delete-guard; `deleteFromSQLite` async + awaited.
- `app/src/services/post-queue.service.ts` — single-row write-through in `save()`; `hydrateQueueFromSQLite` round-trips through `load()`.
- `app/src/services/post-history.service.ts` — transaction full-table write-through; `hydratePostHistoryFromSQLite`.
- `app/src/services/concept-feed.service.ts` — daily-posts cache single-row write-through in `saveCache`; `hydrateDailyPostsFromSQLite`.
- `app/src/services/session.service.ts` — transaction write-through; `hydrateSessionsFromSQLite`.
- `app/src/services/flashcard.service.ts` — transaction write-through; `hydrateFlashcardsFromSQLite`.
- `app/src/services/collection.service.ts` — single-row write-through; `hydrateCollectionsFromSQLite`.
- `app/src/services/engagement.service.ts` — single-row write-through; `hydrateEngagementFromSQLite`.
- `app/src/services/podcast.service.ts` — metadata-only write-through (IndexedDB audio untouched); `hydratePodcastsFromSQLite`.
- `app/src/App.tsx` — `hydrateAllFromSQLite()` boot orchestration (10 hydrate calls, void-fired).

## Active browser backend / headers / quota verification

- **Active browser backend:** `WASMSQLiteBackend` (opfs-sahpool) per the 55-01 OPFS **GO** verdict. `LocalStorageBackend` remains only as the `getDB()` try/catch fallback.
- **COOP/COEP headers:** NOT added. opfs-sahpool uses synchronous OPFS SyncAccessHandles without SharedArrayBuffer, so no Cross-Origin-Opener/Embedder-Policy is required on Chromium (rationale recorded inline in `vite.config.ts`).
- **Manual-Only on-device quota verification:** NOT YET PERFORMED. Per 55-VALIDATION the large-mindmap "no quota error" exercise is operator-run in the browser. Pending. The automated suite + tsc confirm the migration compiles and the codec/guard/event invariants hold; the runtime OPFS quota relief is the operator's manual check.

## Decisions Made
- Reused `GRAPH_UPDATED` for post-history hydration resync (no new event type) — CLAUDE.md one-signal-per-semantic-event.
- Single-state blobs (queue, daily-posts cache, collections, engagement) → one SQLite row each; collection stores → per-row `(id, data)` tables. This matches each service's existing load/save shape with minimal surface change.
- post-queue hydrate writes the SQLite payload back to the localStorage mirror and re-runs `load()`, reusing the date-mismatch rehydration + defensive-default branches instead of duplicating the load-bearing 3-list pipeline normalization.

## Deviations from Plan

### Scope boundary clarification (not an auto-fix)

**`trellis_video_cache` / `trellis_news_posts` per-store write-through deferred to their owning services.**
- **Found during:** Task 3a (reading the feed pipeline).
- **Detail:** The plan's Task 3a prose lists `trellis_news_posts` + `trellis_video_cache` under concept-feed, but these keys are written by `youtube.service.ts` (video cache) and a cross-cutting `post-essay.service.ts` patch path — neither is in this plan's `files_modified`. Both keys ARE cleared on the D-11 cutover (Task 1 `clearAllTables` enumerates them, satisfying the 13-key requirement). Their underlying API-response caches remain localStorage-backed for now.
- **Why not auto-fixed:** Migrating them would require editing out-of-scope files (`youtube.service.ts`, `post-essay.service.ts`) — SCOPE BOUNDARY. They are API caches, not the growing-text quota driver (`trellis_questions` was). The primary quota wall (question embedding double-store) is fully resolved.
- **Impact:** None on the plan's goal. Noted for Phase 56 cleanup if a SQLite write-through is wanted for these caches.

---

**Total deviations:** 0 auto-fixed; 1 documented scope boundary.
**Impact on plan:** All `must_haves` truths satisfied. No scope creep; the deferred caches are out-of-scope by file ownership and are correctly cleared on cutover.

## Issues Encountered
- **tsc `sqlite3InitModule({...})` arity:** the package's default-export type declares 0 args; dropped the `print/printErr` options object (silencing is optional). Resolved.
- **tsc `Buffer` not in browser types:** the codec's node-test fallback referenced `Buffer`; rerouted through `globalThis.Buffer` so the browser module needs no `@types/node`. Resolved.
- **storage-migration GRAPH_UPDATED window:** the test asserts the emit lands within 1200 chars of `hydrateFromSQLite`; initial verbose in-body comments pushed it to 1206. Trimmed comments (kept the invariant test as-is — did not weaken it). Resolved; 4/4 green.
- **node_modules absent in fresh worktree:** symlinked `app/node_modules` → main repo after confirming `package-lock.json` byte-identical (Rule 3 environment fix, not committed). `@sqlite.org/sqlite-wasm` present from 55-01.

## User Setup Required
None — no external service configuration required. (Operator should run the Manual-Only large-mindmap quota check per 55-VALIDATION before the phase gate.)

## Next Phase Readiness
- Browser path is SQLite-primary; the localStorage quota wall is eliminated for the heavy `trellis_questions` store and migrated companions.
- Pending: operator Manual-Only on-device/in-browser large-mindmap quota verification (55-VALIDATION).
- Phase 56 may optionally fold `trellis_video_cache` / `trellis_news_posts` write-through into their owning services.

## Self-Check: PASSED

- SUMMARY.md + db.service.ts + question.service.ts + App.tsx exist at stated paths — VERIFIED
- Task commits `2843d148`, `74865228`, `e0b552f2`, `0e86864a` present — VERIFIED
- `WASMSQLiteBackend` primary + LocalStorageBackend fallback; all 8 new hydrate exports + 10 App.tsx hydrate calls — VERIFIED
- storage-migration.test.mjs green (4/4); full suite green (test:main 1506/1506, test:actions 149/149); tsc clean — VERIFIED
- No STATE.md / ROADMAP.md modifications — VERIFIED (orchestrator owns those writes)

---
*Phase: 55-algorithm-mechanism-tuning*
*Completed: 2026-05-21*
