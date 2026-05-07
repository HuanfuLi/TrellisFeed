---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 14
subsystem: ui
tags: [home-screen, navigation-resync, vine-progress, daily-read-service, post-queue, warm-start, regression-test, always-mounted-state]

# Dependency graph
requires:
  - phase: 36-09-durable-yesterday-snapshot
    provides: STORAGE_KEY_YESTERDAY snapshot key written by post-queue load() — read by getYesterdayQueue() in the new tier-2 fallback
  - phase: 36-11-rehydrate-and-reject-stale-cache
    provides: load() rehydration of yesterday's UNSERVED queue + loadCache date-rejection — the rehydrated state.posts is what tier-2 fallback now surfaces at navigation time; loadCache rejection is the trigger that makes tier-2 actually fire after Plan 36-15
  - phase: 36-13-force-new-day-cleanup
    provides: handleForceNewDay calls dailyReadService.reset() — the service-level reset whose React-state propagation Plan 36-14 wires up via the sibling effect
provides:
  - Widened [location.pathname] effect in HomeScreen.tsx mirroring the line-38 useState initializer's tier-1/tier-2 fallback at navigation time (closes round-4 sub-issue (b) runtime)
  - Sibling [location.pathname] effect in HomeScreen.tsx that re-syncs setExploredAnchors + creditAwardedRef from dailyReadService on every /home navigation (closes round-4 sub-issue (a))
  - Two source-reading regression tests via anchor-pair extraction pattern that pin the resync sites (3 + 4 = 7 GREEN)
  - CLAUDE.md +1 bullet under Concept Feed Generation Pipeline → Numeric defaults documenting the always-mounted-state-resync principle
affects: [36-VERIFICATION, 36-UAT-RETEST round 4, future agents touching always-mounted SwipeTabContainer slots]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always-mounted screen state-resync: useState/useRef initializers on screens inside SwipeTabContainer fire ONCE at app boot. Any screen reading from a service whose state can change while another screen is in the foreground MUST add a [location.pathname] effect that re-reads the service when its pathname matches the route."
    - "Runtime mirror of mount-time fallback chain: when a useState initializer has a multi-tier fallback chain (e.g., line-38: cache → yesterday-queue → history), the navigation-time effect should mirror the same tiers (minus tier-3 'show SOMETHING on first paint' which doesn't apply at navigation)."
    - "Anchor-pair extraction for source-reading tests: slice the source between two unique markers (e.g., creditAwardedRef declaration → CONCEPT_EXPLORED subscription) before regex-matching. Prevents false-positives where a regex matches across multiple effects or unrelated handler bodies."

key-files:
  created:
    - app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs
    - app/tests/screens/HomeScreen.warm-start-refallback.test.mjs
  modified:
    - app/src/screens/HomeScreen.tsx
    - CLAUDE.md

key-decisions:
  - "Option A (consolidate runtime fix into Plan 36-14) chosen over Options B/C because the runtime mirror lives in HomeScreen.tsx, which Plan 36-15's original draft also overlapped on. Consolidating eliminates wave-1 file overlap and groups both /home-navigation fixes (vine state AND warm-start re-fallback) under a single coherent truth."
  - "Sub-issue (a) fix: option (b) — piggyback on location.pathname effect via a NEW sibling effect placed AFTER creditAwardedRef declaration. Option (a) (new DAILY_READ_RESET event) would couple service to event-bus and require every future caller of reset() to remember to fire the event. Option (b) makes the resync triggered by the user-observable event the chip cares about (navigation to /home). One-file change, lower blast radius."
  - "Sub-issue (b) runtime fix: widen the existing line-172 effect to mirror tier-1 (cache) + tier-2 (yesterday-queue) of the line-38 useState initializer's fallback chain. Tier-3 (postHistoryService.getPosts().slice(0, 4)) intentionally NOT mirrored — tier-3 is a mount-time 'show SOMETHING on first paint' last-ditch fallback; at navigation time the user has already been in the app and a momentary empty state is acceptable."
  - "TWO effects rather than one widened block at line 172: forward-references to setExploredAnchors (line 442) and creditAwardedRef (line 475) from line 172 would surprise top-to-bottom readers. Splitting the vine resync into a sibling effect adjacent to the useState/useRef declarations keeps the file readable. Two effects with the same dep-array fire in the same React commit phase — no observable behavior difference."
  - "postQueueService.loadQueue() called BEFORE getYesterdayQueue() in tier-2 fallback: defensive guard against fast Settings → /home navigation where the SettingsDataScreen handler may not have finished reload-from-localStorage yet. Cheap operation; documented in code + test."
  - "Source-reading tests via anchor-pair extraction: slice the source between unique markers before regex-matching. For Test 1 (vine resync): slice between 'creditAwardedRef = useRef(' and 'eventBus.subscribe(\\'CONCEPT_EXPLORED\\''. For Test 3 (warm-start re-fallback): slice between the comment marker introduced in Edit A and the first '}, [location.pathname]);' closing brace. Both anchor markers verified unique in HomeScreen.tsx (1 occurrence each)."

patterns-established:
  - "Always-mounted screens must explicitly re-read service state on navigation: SwipeTabContainer's 5 first-level slots are always-mounted, so React state initializers fire once at app boot. A service-level reset (dailyReadService.reset()) clears localStorage but the React state retains stale values. Pattern: useEffect with [location.pathname] dep that re-reads on pathname match."
  - "Runtime mirror of initializer fallback chain: when a useState(() => ...) initializer has a multi-tier fallback chain, the navigation effect should mirror tiers 1 and 2. Tier-3 fallbacks tied to 'first paint' (e.g., postHistoryService.getPosts) intentionally don't mirror to navigation time."
  - "Defensive service reload before reading: when one screen mutates localStorage and another always-mounted screen reads it on navigation, call svc.loadQueue() (or equivalent) BEFORE the read so the in-memory _state is freshly synced. Cheap operation; eliminates fast-navigation race window."
  - "Anchor-pair extraction for source-reading tests prevents false-positives across multi-effect spans. Slice source between two unique markers (must be exactly one occurrence each) and regex-match within the slice. Pattern proven in HomeScreen.warm-start-guard.test.mjs (Plan 36-06), SettingsDataScreen.force-new-day.test.mjs Test 6 (Plan 36-13), and now Plan 36-14."

requirements-completed: [GAP-D-round4-a, GAP-D-round4-b-runtime]

# Metrics
duration: 4min
completed: 2026-05-07
---

# Phase 36 Plan 14: Re-sync vine state + warm-start re-fallback on /home navigation Summary

**Two complementary [location.pathname] effects in HomeScreen.tsx — one widens the existing effect with a tier-2 yesterday-queue fallback, one sibling effect re-reads dailyReadService on every /home navigation — closing round-4 sub-issue (a) AND the runtime half of sub-issue (b).**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-07T22:31:41Z
- **Completed:** 2026-05-07T22:35:27Z
- **Tasks:** 4
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- HomeScreen.tsx Edit A: widened line-172 [location.pathname] effect from a single-tier `setDailyPosts(getCachedDailyPosts())` to a tier-1 → tier-2 fallback chain (cache → postQueueService.getYesterdayQueue()) that mirrors the line-38 useState initializer at navigation time. Without this, after Plan 36-15's SettingsDataScreen mutation invalidates the daily-posts cache, the feed would render empty even though the rehydrated `_state.posts` (Plan 36-11) is sitting in localStorage waiting to be served.
- HomeScreen.tsx Edit B: added a NEW sibling [location.pathname] effect placed adjacent to the `creditAwardedRef = useRef(...)` declaration that re-reads `dailyReadService.getExploredAnchors()` and resets `creditAwardedRef.current = dailyReadService.isCreditAwarded()` whenever `location.pathname === '/home'`. Without this, `dailyReadService.reset()` (called from SettingsDataScreen's Force-New-Day handler — Plan 36-13) clears persistence but the React state retains yesterday's exploredAnchors, so the vine progress chip never clears and the celebration gate stays closed.
- Two new source-reading regression test files via anchor-pair extraction (7 GREEN tests):
  - `HomeScreen.exploredAnchors-resync.test.mjs` (3 tests): slice between `creditAwardedRef = useRef(` and `eventBus.subscribe('CONCEPT_EXPLORED'` markers; verifies the new sibling effect contains setExploredAnchors + creditAwardedRef.current resets.
  - `HomeScreen.warm-start-refallback.test.mjs` (4 tests): slice between the Edit-A comment marker and the first `}, [location.pathname]);` closing brace; verifies primary branch preservation (Plan 36-11 contract regression guard) + tier-2 fallback presence + setDailyPosts wiring + defensive loadQueue() ordering.
- CLAUDE.md +1 load-bearing bullet under Concept Feed Generation Pipeline → Numeric defaults documenting the always-mounted-screen state-resync principle for future agents.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-execution coordination with Plan 36-15):

1. **Task 1: HomeScreen.tsx Edit A + Edit B** — `2248389c` (fix: re-sync vine state + warm-start re-fallback on /home navigation)
2. **Task 2: HomeScreen.exploredAnchors-resync.test.mjs (NEW)** — `a67ec554` (test: pin vine resync via anchor-pair extraction)
3. **Task 3: HomeScreen.warm-start-refallback.test.mjs (NEW)** — `4efbc424` (test: pin warm-start re-fallback on /home navigation)
4. **Task 4: CLAUDE.md +1 bullet** — `cee06093` (docs: document always-mounted-screen state-resync principle)

## Files Created/Modified

- `app/src/screens/HomeScreen.tsx` — widened line-172 [location.pathname] effect (Edit A: 6 lines → 30 lines) + added sibling effect after creditAwardedRef declaration (Edit B: 17 new lines including 12-line comment block). Net: +45/-3.
- `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` — NEW; 79 lines; 3 GREEN tests via anchor-pair extraction between creditAwardedRef and CONCEPT_EXPLORED markers.
- `app/tests/screens/HomeScreen.warm-start-refallback.test.mjs` — NEW; 97 lines; 4 GREEN tests via anchor-pair extraction between Edit-A comment marker and `}, [location.pathname]);` closing brace.
- `CLAUDE.md` — +1 bullet (1 line) under Concept Feed Generation Pipeline → Numeric defaults, after the Phase 36-11 New-day rehydration bullet.

## Decisions Made

- **Option A (consolidate runtime fix into Plan 36-14) over Options B/C:** the runtime mirror lives in HomeScreen.tsx, which Plan 36-15's original draft also overlapped on. Consolidating eliminates wave-1 file overlap and groups both /home-navigation fixes under a single coherent truth: "navigation to /home re-syncs ALL always-mounted state from underlying services/storage." Plan 36-15 still owns the SettingsDataScreen storage mutation; without that mutation, this plan's re-fallback never triggers (cache stays warm). Without this plan, Plan 36-15's mutation just produces an empty feed. Complementary, not redundant.
- **Sub-issue (a) design — option (b) piggyback over option (a) new event:** option (a) (DAILY_READ_RESET event) would couple `dailyReadService.reset()` to event-bus and require every future caller to remember to fire the event. Option (b) makes the resync triggered by the user-observable event the chip cares about (navigation to /home). One-file change, lower blast radius.
- **Sub-issue (b) runtime design — widen line-172 effect to mirror tiers 1+2 of line-38 useState initializer:** the same tier-1 / tier-2 fallback chain that handles cold-start at mount also handles "user navigates to /home after Force-New-Day cache invalidation" at runtime. Tier-3 (postHistoryService.getPosts().slice(0, 4)) intentionally NOT mirrored — tier-3 is a "show SOMETHING on first paint" last-ditch; at navigation time the user has already been in the app and a momentary empty state is acceptable.
- **TWO effects rather than one widened block at line 172:** the existing line-172 effect lives BEFORE the setExploredAnchors (line 442) and creditAwardedRef (line 475) declarations. Forward-references from line 172 to those identifiers would surprise top-to-bottom readers. Splitting the vine resync into a sibling effect adjacent to the useState/useRef declarations keeps the file readable. Two effects with the same dep-array `[location.pathname]` fire in the same React commit phase — no observable behavior difference vs one fused effect.
- **Defensive `postQueueService.loadQueue()` BEFORE `getYesterdayQueue()` in tier-2 fallback:** guards against fast Settings → /home navigation where the SettingsDataScreen handler may not have finished its own loadQueue call yet (unlikely but cheap to guard). Documented in code comment + test 4.

## Deviations from Plan

None — plan executed exactly as written. All four tasks landed verbatim per the plan's instructions; no auto-fixes were needed; TypeScript exit 0 on first try; all 7 new tests GREEN on first run; full Phase 36 quick suite (15 files, 98 tests) GREEN on first run; all four phase-preservation greps pass.

## Self-check that this plan does NOT regress sub-issues (c), (d), (e) closed by Plans 36-11/12

- **Sub-issue (c) — style mix on rehydrated cold-start:** closed by Plan 36-11's `spreadByConcept` then `spreadByStyle` re-interleave inside `post-queue.service.ts:load()`. Plan 36-14 does not touch `post-queue.service.ts`. The rehydration path is unchanged; this plan only ADDS a runtime READ at navigation time.
- **Sub-issue (d) — yesterday's served posts re-rendering as today's feed:** closed by Plan 36-11's `loadCache()` `parsed.date !== today()` rejection inside `concept-feed.service.ts`. Plan 36-14 does not touch `concept-feed.service.ts`. The line-172 effect's primary branch `setDailyPosts(conceptFeedService.getCachedDailyPosts())` is preserved EXPLICITLY by Test 3.1 — any regression that drops it fails the test.
- **Sub-issue (e) — silent no-op refill mutex:** closed by Plan 36-12's `createPromiseMutex` in `refill-mutex.ts` + `_refillMutex.run(...)` in `refillQueue`. Plan 36-14 does not touch the refill path or any mutex code.

All three sub-issues remain closed by their original plans; Plan 36-14's edits are surgical to HomeScreen.tsx + 2 NEW test files + CLAUDE.md only.

## Test count delta

- +7 source-reading tests across 2 NEW files:
  - `HomeScreen.exploredAnchors-resync.test.mjs`: 3 tests
  - `HomeScreen.warm-start-refallback.test.mjs`: 4 tests
- 0 deletions, 0 inversions, 0 modifications to existing test files
- Full Phase 36 quick suite: 15 files, 98 tests, all GREEN

## CLAUDE.md doc-sync content

Added under Concept Feed Generation Pipeline → Numeric defaults, after the Phase 36-11 New-day rehydration bullet:

> **Always-mounted screens must explicitly re-read service state on /home navigation (Phase 36-14):** HomeScreen, PlannerScreen, AskScreen, GraphScreen, and SettingsScreen are all always-mounted slots in `SwipeTabContainer` (see "Header positioning" section). `useState(() => svc.get())` initializers fire ONCE at app boot — they never re-run on `navigate('/home')` (or to any other top-level swipe route). Any screen that reads from a service whose state can change while another screen is in the foreground (e.g., `dailyReadService` reset by Force-New-Day in SettingsDataScreen, or any future cross-screen state mutation) MUST add a `useEffect` that re-reads the service when its `location.pathname` matches the screen's route. HomeScreen.tsx has the canonical pattern: one effect re-syncs `dailyPosts` from `conceptFeedService.getCachedDailyPosts()` with a fallback to `postQueueService.getYesterdayQueue()` when the cache is empty (Plan 36-11 + 36-14 — mirroring the line-38 useState initializer's tier-1/tier-2 chain at runtime), another sibling effect re-syncs `exploredAnchors` + `creditAwardedRef` from `dailyReadService` (Plan 36-14). Tests at `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` and `app/tests/screens/HomeScreen.warm-start-refallback.test.mjs` enforce both resyncs structurally via anchor-pair extraction. Related principle: when a dev affordance simulates a wall-clock event the service code can't observe (e.g., `today()` cannot advance under Force-New-Day), the dev handler must explicitly call every service `reset()` AND mutate every date-stamped storage key that the natural event would have triggered, AND any always-mounted screen reading the service must re-sync on navigation. Single source of asymmetry → three layers of defense (handler mutates storage; rejection-on-mismatch fires on next read; navigation effect re-pulls from service).

## Issues Encountered

None — plan was clear about the two source-position constraints (existing line-172 effect lives before setExploredAnchors/creditAwardedRef declarations; the vine resync sibling effect must be placed after creditAwardedRef). Both edits applied verbatim.

## Complementary nature of Plans 36-14 and 36-15

- **Plan 36-15** (parallel sibling): mutates `echolearn_daily_posts` storage key in SettingsDataScreen's `handleForceNewDay` so `loadCache()` (Plan 36-11) rejects the stale cache → `getCachedDailyPosts()` returns `[]` on the next /home navigation. This is the **trigger** that makes Plan 36-14's tier-2 fallback fire.
- **Plan 36-14** (this plan): adds the tier-2 fallback to `postQueueService.getYesterdayQueue()` so when the cache is `[]` (post-mutation), the feed actually populates from the rehydrated `_state.posts` (Plan 36-11 Task 2). This is the **consequence** that closes the user-visible loop.
- Without 36-15, Plan 36-14's fallback never fires (cache stays warm with yesterday's served posts).
- Without 36-14, Plan 36-15's mutation just produces an empty feed.

The two plans landed in the same wave (parallel) with disjoint file ownership: Plan 36-14 owned `app/src/screens/HomeScreen.tsx` + 2 NEW test files + `CLAUDE.md`; Plan 36-15 owned `app/src/screens/settings/SettingsDataScreen.tsx` + the existing `SettingsDataScreen.force-new-day.test.mjs` test (inversion in place). Zero file overlap.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 36 round-4 sub-issues (a) AND (b runtime) closed by this plan; sub-issue (b cause #1 — storage mutation) closed by sibling Plan 36-15.
- Branch `gsd/phase-33-hygiene-and-polish` ready for `/gsd:verify 36` final pass after Plan 36-15 completes (parallel sibling).
- After verifier passes: Phase 36 round-4 ready for UAT retest on device. Operator should test the full Force-New-Day flow: vine chip clears (sub-issue a), feed auto-populates from yesterday's UNSERVED queue (sub-issue b), and the celebration gate fires when the user finishes the simulated new day's vine (sub-issue a follow-on).

## Self-Check: PASSED

- All 5 referenced files exist on disk (HomeScreen.tsx, 2 NEW test files, CLAUDE.md, SUMMARY.md).
- All 4 task commits exist in git log (2248389c, a67ec554, 4efbc424, cee06093).
- All 7 new tests GREEN under `node --test`.
- Full Phase 36 quick suite: 15 files, 98 tests, all GREEN.
- `npx tsc -b --noEmit` exit 0.
- All four phase-preservation greps pass: STORAGE_KEY_YESTERDAY=4, USER_ACK_BEFORE_GRAPH_CONTEXT=3, MAX_QUEUE_SIZE=1, dailyReadService.reset()=2 (all ≥1).

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Completed: 2026-05-07*
