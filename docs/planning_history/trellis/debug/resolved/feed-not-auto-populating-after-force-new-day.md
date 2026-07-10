---
status: resolved
trigger: "After Force New Day, /home does not auto-populate from yesterday's UNSERVED queue (Plan 36-11 regression)"
created: 2026-05-07T00:00:00Z
updated: 2026-05-20T00:00:00Z
---

## Current Focus

hypothesis: handleForceNewDay only mutates `echolearn_post_queue.date` to yesterday; it does NOT clear `echolearn_daily_posts`. The daily-posts cache STILL has today's real date, so `loadCache()`'s Plan 36-11 date-rejection does NOT fire. Both `getDailyPosts()` (cache-hit branch) and `getCachedDailyPosts()` return today's already-served posts. The rehydrated yesterday-queue (in `_state.posts`) is NEVER read because `getDailyPosts` returns BEFORE reaching `dequeue()`.
test: Read all four files (DONE) — confirmed:
  1. handleForceNewDay only writes to `echolearn_post_queue` (lines 79-95 SettingsDataScreen.tsx). NOT `echolearn_daily_posts`.
  2. loadCache() rejects only when `parsed.date !== today()` (line 185 concept-feed.service.ts). After dev-button, daily-posts cache STILL has today's real date → returns truthy.
  3. getDailyPosts() at line 1430 hits "Cache hit" branch → returns cached today-posts. dequeue() at line 1459 NEVER runs.
  4. HomeScreen `useEffect [location.pathname]` (line 172-176) calls `getCachedDailyPosts()` → returns today's served-posts cache.
expecting: ROOT CAUSE = handleForceNewDay needs to clear `echolearn_daily_posts` (or set it to yesterday too) so loadCache() rejects symmetrically with the queue.
next_action: Confirm by reading 36-11 plan + summary, then write final diagnosis

## Symptoms

expected: After Force New Day, /home INSTANTLY shows posts from yesterday's UNSERVED queue (no manual swipe needed)
actual: Feed appears empty on cold-start. Same empty state observed in round 3 reappears.
errors: None reported.
reproduction:
  1. Populated echolearn_post_queue + echolearn_daily_posts cache for today
  2. Settings → Data → Developer → Force New Day → Roll back date
  3. App routes to /home
  4. Feed shows empty (or stale that drains)
started: 2026-05-07 round-4 UAT, after Plan 36-11/12/13 landed
context: Plan 36-11 added load() rehydration of _state.posts + derivedList + cyclePosition + STORAGE_KEY_YESTERDAY snapshot, AND made loadCache() reject when parsed.date !== today(). All 9 unit tests GREEN.

## Eliminated

(none yet)

## Evidence

(building)

## Resolution

root_cause: |
  handleForceNewDay only rolled back the post-queue cache date
  (`trellis_post_queue.date` → yesterday); it did NOT roll back the served-posts
  cache (`trellis_daily_posts`). Because the dev button cannot advance the wall
  clock, `today()` returns real-today both before and after the handler runs. So
  the daily-posts cache still had `date === today()`, loadCache()'s Plan 36-11
  date-rejection (`parsed.date !== today()`) never fired, getDailyPosts() hit its
  cache-hit branch and returned today's already-served posts, and the rehydrated
  yesterday-queue in `_state.posts` was never dequeued. Net effect: an empty (or
  stale-then-draining) feed on the simulated new day. The two date-stamped cache
  keys must be mutated symmetrically; mutating only the queue key broke the
  loadCache() rejection path.

fix: |
  Already shipped in production code. Two complementary fixes:
    1. SettingsDataScreen.tsx:118-127 (storage symmetry) — handleForceNewDay now
       also mutates `trellis_daily_posts.date` to yesterday, so loadCache()'s
       date-rejection fires symmetrically with the queue rehydration:
         const dailyRaw = localStorage.getItem('trellis_daily_posts');
         if (dailyRaw) {
           const dailyParsed = JSON.parse(dailyRaw);
           dailyParsed.date = yesterday;
           localStorage.setItem('trellis_daily_posts', JSON.stringify(dailyParsed));
         }
    2. HomeScreen warm-start re-fallback (Phase 36-14) — HomeScreen falls back to
       postQueueService.getYesterdayQueue() when getCachedDailyPosts() returns [],
       so the rehydrated yesterday queue renders even on the cold-start path.
  No source change was made in Phase 54 — both fixes were already present and were
  re-verified via the existing regression test.

verification: |
  app/tests/screens/SettingsDataScreen.force-new-day.test.mjs — 6 assertions, all
  passing (re-run 2026-05-20), including the key one:
    - "handler mutates trellis_daily_posts.date so loadCache rejection fires
       symmetrically with queue rehydration"
  Re-run command:
    cd app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
  → tests 6 / pass 6 / fail 0.

files_changed:
  - app/src/screens/settings/SettingsDataScreen.tsx (the storage-symmetry fix; not re-touched in Phase 54)
  - app/src/screens/HomeScreen.tsx (warm-start re-fallback; not re-touched in Phase 54)
  - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs (guarding regression test)
