---
phase: 55-algorithm-mechanism-tuning
plan: 07
subsystem: database
tags: [indexeddb, storage-migration, in-memory-mirror, hydration, dual-write-fix, quota, db-service]

# Dependency graph
requires:
  - phase: 55-05
    provides: "IndexedDBBackend + extended schema + clearAllTables cutover (the backend this plan keeps unchanged)"
provides:
  - "IndexedDB is the SOLE persistence for the 9 heavy stores; the in-memory mirror is the SOLE synchronous read+write path, hydrated from IndexedDB at boot"
  - "Removal of the 55-05 dual-write bug (heavy-store services no longer write/read localStorage for their heavy keys) — actual ~5MB quota relief"
  - "Awaited boot hydration (App.tsx gates first render on a `hydrated` state) — no empty-feed flash, no premature refill against an empty queue"
  - "Day-rollover / new-day rehydration / yesterday-snapshot re-homed off localStorage (normalizeState during hydrate + durable IndexedDB yesterday row + in-memory mirror)"
  - "One-time clearLegacyHeavyLocalStorageKeys() boot sweep AFTER hydration (D-11 cutover quota reclamation)"
affects: [56-ui-polish-and-cleanup, future-storage-evolution]

# Tech tracking
tech-stack:
  patterns:
    - "In-memory module-level mirror as the SOLE synchronous read+write source; IndexedDB-only async persistence (write-through on mutation, hydrate-on-boot)"
    - "Awaited Promise.all hydration gate before first render (replaces 55-05 void fire-and-forget)"
    - "Load-bearing day-rollover logic moved from module-init localStorage read into normalizeState() run during hydrate"

key-files:
  created: []
  modified:
    - "app/src/services/question.service.ts — in-memory _store mirror; loadStore/saveStore read/write it; localStorage removed; hydrate fills mirror from IndexedDB"
    - "app/src/services/post-queue.service.ts — _state mirror starts empty; normalizeState() owns day-rollover; durable yesterday IndexedDB row + _yesterday mirror; resetAll()"
    - "app/src/services/concept-feed.service.ts — daily-posts cache is the in-memory _cache mirror; loadCache/saveCache read/write it; localStorage removed; clearCache clears IDB row"
    - "app/src/services/post-history.service.ts — in-memory _store mirror; clear() wipes mirror + IDB"
    - "app/src/services/session.service.ts — in-memory _store mirror for sessions array; ACTIVE_ID_KEY pointer stays in localStorage"
    - "app/src/services/flashcard.service.ts — in-memory _store mirror; seed-purge writeback now _store = cards; clear() added"
    - "app/src/services/collection.service.ts — in-memory _state mirror"
    - "app/src/services/engagement.service.ts — in-memory _state mirror"
    - "app/src/services/podcast.service.ts — in-memory _store mirror (metadata only; audio-blob IDB store untouched)"
    - "app/src/services/db.service.ts — clearLegacyHeavyLocalStorageKeys() + LEGACY_HEAVY_KEYS extracted; clearAllTables reuses it"
    - "app/src/App.tsx — hydrateAllFromSQLite() now async (await Promise.all) + post-hydrate cutover sweep; render gated on `hydrated` with a minimal loading placeholder"
    - "app/src/screens/settings/SettingsDataScreen.tsx — Force-New-Day uses simulateDateRollback() + clearCache() instead of localStorage mutation"

key-decisions:
  - "db.service.ts (IndexedDBBackend) is correct and was NOT changed — only the heavy-store SERVICES were inverted"
  - "loadStore/saveStore (and equivalents) keep their signatures so the rest of each service is untouched; only their bodies swap localStorage for the in-memory mirror"
  - "question/collection/engagement loadStore returns a deep/structural copy so callers' read-modify-write cannot corrupt the mirror until saveStore (preserves the prior JSON.parse semantic)"
  - "yesterday snapshot re-homed to a SECOND IndexedDB row (queue_yesterday) + an in-memory _yesterday mirror; getYesterdayQueue() reads the mirror"
  - "post-queue.resetAll() (full wipe incl. yesterday) added for Clear-All-Data + test isolation; resetForNewDay() still PRESERVES yesterday (Reset-today contract)"
  - "trellis_video_cache / trellis_news_posts read-only fallbacks in concept-feed.getPostById left as-is (owned by youtube.service / post-essay; cleared on cutover) — same scope boundary 55-05 documented"

patterns-established:
  - "Heavy store = module-level mirror + IndexedDB write-through + hydrate-from-IndexedDB behind a mirror-has-data delete-guard + resync event"
  - "Day-rollover normalization runs during hydrate against IndexedDB-loaded data, not at module init against localStorage"

requirements-completed: []

# Metrics
duration: ~2h
completed: 2026-05-21
---

# Phase 55 Plan 07: IndexedDB-SOLE heavy-store persistence (dual-write gap closure) Summary

**Closes the 55-05 dual-write gap: every heavy-store service now persists ONLY to IndexedDB with the in-memory mirror as the SOLE synchronous read+write path (hydrated from IndexedDB at boot), delivering the actual localStorage quota relief 55-05 claimed but did not implement.**

## What was wrong (the gap)

55-05 shipped SQLite/IndexedDB write-through but kept localStorage as the in-memory mirror's source of truth: every `save()` wrote to BOTH localStorage AND IndexedDB, and `hydrate` filled the mirror from localStorage. So localStorage stayed the primary store, the heavy keys (`trellis_questions`, `trellis_post_queue`, `trellis_daily_posts`, `trellis_sessions`, `trellis_post_history`, …) were still present AND freshly written, and the ~5MB quota wall was untouched.

## The fix

For each of the 9 heavy stores (question, post-queue, post-history, session, flashcard, concept-feed daily-posts cache, collection, engagement, podcast metadata):

1. Removed every `localStorage.setItem`/`getItem` for the heavy key. The module-level in-memory mirror (`_store` / `_state` / `_cache`) is now the SOLE synchronous read+write source. Persistence is IndexedDB only (the existing `dbExecute` write-through and `dbQuery` hydrate).
2. The mirror starts EMPTY at module init and is populated by the existing `hydrateXFromSQLite()` reading IndexedDB. The `if (mirror has data) return` delete-guard is preserved (correctly allows first-hydrate population; still prevents a late async hydrate from clobbering user-created data + deleted-row resurrection).
3. **Day-rollover preserved (post-queue + concept-feed):** the load-bearing logic (CLAUDE.md "Concept Feed Generation Pipeline", "New-day rehydration", numeric defaults 32/24/8, walker `maxSteps`) was moved from the module-init localStorage read into `normalizeState()` which runs during/after hydrate against the IndexedDB-loaded payload. Numeric defaults + walker math untouched.
4. **Yesterday snapshot re-homed off localStorage:** to a durable second IndexedDB row (`queue_yesterday`) + an in-memory `_yesterday` mirror. `getYesterdayQueue()` reads the mirror; the warm-start path survives multiple cold-start mounts of a new day.
5. **App.tsx boot gate:** `hydrateAllFromSQLite()` is now `async` and awaits `Promise.all` of all hydrates BEFORE first render, gated on a `hydrated` state showing a minimal neutral loading spinner. This is required because IndexedDB reads are async and the mirrors are now the SOLE sync read path — without the gate, post-boot reads return empty (empty-feed flash, premature refill against an empty queue).
6. **One-time cutover:** `clearLegacyHeavyLocalStorageKeys()` runs once on boot AFTER hydration resolves (never before) to delete the now-stale heavy localStorage keys — pure quota reclamation, since the services no longer read them.

Kept in localStorage (tiny boot-critical prefs, NOT migrated): `trellis_settings`, `trellis_dev_mode`, `trellis_ask_rate_limit`, `trellis_fruit_credits`, `trellis_blossom_dates`, `trellis_token_usage`, `trellis_daily_read`, `trellis_trajectory_signals`, `trellis_active_session` (the active-session-id pointer), `theme`, sim-* keys.

## Task Commits

1. **Service migration + db helper + App boot gate** — `9d9f0f20` (fix)
2. **Force-New-Day dev affordance update** — `7ffa5b8a` (fix)
3. **Heavy-store test updates for the new persistence model** — `35798058` (test)

## Verification (automated)

- `cd app && ./node_modules/.bin/tsc -b --noEmit` — clean.
- `cd app && npm run test:main` — **1515 / 1515 pass, 0 fail.**
- `cd app && npm run test:actions` — **149 / 149 pass, 0 fail.**
  (Both `;`-chained segments aggregated separately to defeat the masked exit code.)
- Grep proof — the only heavy-store-service `localStorage.setItem` remaining is the allowed active-session-id pointer:
  ```
  src/services/session.service.ts:104:  localStorage.setItem(ACTIVE_ID_KEY, id);
  ```
  No `setItem`/`getItem` for any heavy STORAGE_KEY remains. (Two read-only `getItem` fallbacks for `trellis_video_cache` / `trellis_news_posts` remain in concept-feed `getPostById` — out of scope, owned by youtube.service / post-essay, cleared on cutover; same boundary 55-05 documented.)

Node has no IndexedDB, so the suite exercises the `LocalStorageBackend` fallback (expected). The runtime IndexedDB behaviour is the operator's manual browser check below.

## Operator browser re-test checklist

Cannot be browser-tested from Node. Please re-test in Chrome with the running dev server:

1. **Hard-reload** the app (Cmd-Shift-R). In DevTools Console, confirm:
   `[Trellis] DB backend active: IndexedDBBackend`
2. **DevTools → Application → Local Storage** — confirm these keys are GONE (swept on first post-hydrate boot):
   `trellis_questions`, `trellis_post_queue`, `trellis_post_queue_yesterday`, `trellis_daily_posts`, `trellis_post_history`, `trellis_sessions`, `trellis_flashcards`, `trellis_collections_v1`, `trellis_engagement_v1`, `trellis_podcasts`, `trellis_news_posts`, `trellis_video_cache`, `trellis_db_tables`.
   Confirm these tiny prefs are STILL present: `trellis_settings`, `trellis_active_session`, `trellis_dev_mode`, `trellis_fruit_credits`, `trellis_daily_read`, etc.
3. **DevTools → Application → IndexedDB → `trellis`** — confirm the object stores (`questions`, `post_queue`, `posts`, `post_history`, `sessions`, `flashcards`, `collections`, `engagement`, `podcasts`) hold the rows.
4. **Survival across reload:** the feed, chat sessions, flashcards, saved/liked posts, and collections all survive a hard reload (no empty-feed flash — a brief neutral spinner is expected while hydration resolves, then content appears).
5. **No empty-feed flash / no premature refill:** the feed should NOT briefly show an empty/"no posts" state then repopulate; it should render populated on first paint after the spinner.
6. **Quota relief (the whole point):** exercise a large mind-map / heavy feed session and confirm NO `QuotaExceededError` toast and that Local Storage usage stays small (only the tiny prefs).
7. **Force-New-Day (dev):** Settings → Data → Force New Day → confirm yesterday's unserved queue auto-populates today's feed and the vine progress chip resets.
8. **Clear All Data:** Settings → Data → Clear All Data → confirm the app reloads to an empty state and IndexedDB `trellis` stores are cleared.

## Deviations from Plan

### Auto-fixed during execution (Rule 1 / Rule 3)

**1. [Rule 1 - Bug] Yesterday-snapshot shared-reference aliasing.**
- **Found during:** post-queue test rewrite.
- **Issue:** `normalizeState` set `_yesterday.posts = parsed.posts`, and the rehydration reuses `parsed.posts` as the live `_state.posts` (mutated in place by `spreadByConcept`/`spreadByStyle`/`enqueue`) — corrupting the yesterday snapshot. The old code avoided this because it serialized yesterday to a JSON localStorage copy.
- **Fix:** snapshot a COPY (`posts: [...parsed.posts]`). Restores the prior isolation.

**2. [Rule 3 - Blocking] Added `postQueueService.resetAll()` + `flashcardService.clear()`.**
- Needed for full Clear-All-Data wipes (the in-memory `_yesterday` mirror and flashcard mirror have no localStorage backing to clear) AND for test isolation. `resetForNewDay()` deliberately PRESERVES yesterday (Reset-today contract), so a separate full-wipe was required.

### Scope boundary (carried from 55-05, not changed)

`trellis_video_cache` / `trellis_news_posts` per-store write-through stays with their owning services (`youtube.service.ts` / `post-essay.service.ts`), out of this plan's files. Both keys are cleared on the cutover sweep; the read-only fallbacks in `concept-feed.getPostById` return null post-cutover and fall through to `postHistoryService`.

**Total deviations:** 2 auto-fixed; 1 documented scope boundary (inherited).

## STATE.md / ROADMAP.md

NOT modified — left to the orchestrator per the execution brief.

## Self-Check: PASSED

- 55-07-SUMMARY.md + all 11 modified source files exist at stated paths — VERIFIED
- Task commits `9d9f0f20`, `7ffa5b8a`, `35798058` present in `git log` — VERIFIED
- tsc clean; test:main 1515/1515; test:actions 149/149; 0 fail in both segments — VERIFIED
- Only heavy-store-service `localStorage.setItem` remaining is the allowed `ACTIVE_ID_KEY` — VERIFIED
- No STATE.md / ROADMAP.md modifications — VERIFIED

---
*Phase: 55-algorithm-mechanism-tuning*
*Completed: 2026-05-21*
