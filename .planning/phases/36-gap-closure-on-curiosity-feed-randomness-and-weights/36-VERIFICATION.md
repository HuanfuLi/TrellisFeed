---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
round: 4
verified: 2026-05-07T12:00:00Z
status: passed
score: 16/16
updated: 2026-05-07T12:00:00Z
re_verification:
  previous_status: gaps_found (round-3 sub-issues a + b regressed in round-4 UAT)
  gaps_closed:
    - "Sub-issue (a): vine progress chip not clearing after Force New Day"
    - "Sub-issue (b) runtime: feed not auto-populating from yesterday's UNSERVED queue after Force New Day"
    - "Sub-issue (b) storage: echolearn_daily_posts.date mutation removed by Plan 36-13 broke loadCache rejection on the dev-button path"
  gaps_remaining: []
  regressions: []
---

# Phase 36 Round-4 Verification Report

**Phase Goal:** Close round-4 UAT gaps — sub-issue (a) vine progress chip not clearing after Force New Day; sub-issue (b) feed not auto-populating from yesterday's UNSERVED queue after Force New Day.

**Verified:** 2026-05-07T12:00:00Z
**Status:** passed (16/16)
**Re-verification:** Yes — second round-trip on round-3 sub-issues (a) + (b) that regressed in round-4 UAT.

## Summary

All 16 round-4 must-haves verified. The dual-plan (36-14 runtime + 36-15 storage) approach closes both sub-issues end-to-end with the correct file-ownership split:

- **Plan 36-15 (storage):** `handleForceNewDay` re-mutates `echolearn_daily_posts.date` alongside `echolearn_post_queue.date` — restoring the symmetry Plan 36-13 incorrectly removed. Comment block embeds the wall-clock-asymmetry rationale and a "DO NOT FLIP BACK" marker. Test 6 inverted from `assert.doesNotMatch` (Plan 36-13) to `assert.match` (this round).
- **Plan 36-14 (runtime):** HomeScreen.tsx now has TWO `[location.pathname]` effects — Edit A widens the line-172 effect with a tier-2 fallback to `postQueueService.getYesterdayQueue()` when `getCachedDailyPosts()` returns `[]`; Edit B adds a sibling effect placed after `creditAwardedRef = useRef(...)` that resyncs `setExploredAnchors` and `creditAwardedRef.current` from `dailyReadService` on every /home navigation.

All 13 plan-specific tests GREEN (3 + 4 + 6). TypeScript exits 0. CLAUDE.md doc-sync added. Plan 36-11 (loadCache rejection, rehydrate path) and Plan 36-12 (refill mutex, REFILL_THRESHOLD=16) contracts unchanged.

The round-4 UAT can flip from `status: diagnosed` to `status: resolved` after device retest confirms the runtime behavior matches the structural guarantees verified here.

## Observable Truths

| #   | Truth                                                                   | Status     | Evidence                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | After Force New Day, HomeScreen `[location.pathname]` effect re-syncs `exploredAnchors` AND `creditAwardedRef.current` from `dailyReadService` (sub-issue a) | ✓ verified | `app/src/screens/HomeScreen.tsx:512-517` — `setExploredAnchors(dailyReadService.getExploredAnchors())` AND `creditAwardedRef.current = dailyReadService.isCreditAwarded()` inside the `[location.pathname]` effect placed after the `creditAwardedRef = useRef(...)` declaration on line 500. |
| 2   | After Force New Day, the existing `[location.pathname]` effect on `/home` falls back to `postQueueService.getYesterdayQueue()` when `getCachedDailyPosts()` returns `[]` (sub-issue b runtime) | ✓ verified | `app/src/screens/HomeScreen.tsx:181-201` — primary branch `cached = conceptFeedService.getCachedDailyPosts()` (line 183), fallback `postQueueService.loadQueue(); const yesterdayQueue = postQueueService.getYesterdayQueue()` (lines 191-192), `setDailyPosts(yesterdayQueue.slice(0, 8))` (line 194). |
| 3   | `handleForceNewDay` mutates BOTH `echolearn_post_queue.date` AND `echolearn_daily_posts.date` to yesterday (sub-issue b storage) | ✓ verified | `app/src/screens/settings/SettingsDataScreen.tsx:92` (queue) + lines 117-126 (daily-posts). Wrapped in inner try/catch for malformed-JSON resilience. |
| 4   | `dailyReadService.reset()` from Plan 36-13 preserved in `handleForceNewDay` | ✓ verified | `app/src/screens/settings/SettingsDataScreen.tsx:133` — call survives Plan 36-15's edits. |
| 5   | Tier-1 (`getCachedDailyPosts`) primary branch preserved in widened nav effect — Plan 36-11 contract not regressed | ✓ verified | `app/src/screens/HomeScreen.tsx:183-186` — primary branch returns early when `cached.length > 0`. Test asserts: "preserves the primary branch" GREEN. |
| 6   | CONCEPT_EXPLORED subscription remains as in-session updater for `exploredAnchors` | ✓ verified | `app/src/screens/HomeScreen.tsx:520-525` — separate effect `eventBus.subscribe('CONCEPT_EXPLORED', ...)` preserved. Test 3 of `HomeScreen.exploredAnchors-resync.test.mjs` asserts this. |
| 7   | Test 1 in `HomeScreen.exploredAnchors-resync.test.mjs` uses anchor-pair extraction (between `creditAwardedRef = useRef(` and `eventBus.subscribe('CONCEPT_EXPLORED'`) | ✓ verified | `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs:37-38` — `startMarker = 'creditAwardedRef = useRef('`, `endMarker = "eventBus.subscribe('CONCEPT_EXPLORED'"`, slicing applied via `getVineResyncSlice()` before regex match. |
| 8   | Test 6 in `SettingsDataScreen.force-new-day.test.mjs` is POSITIVE — asserts `localStorage.setItem('echolearn_daily_posts'...)` IS in handler body (anchor-pair extraction) | ✓ verified | `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs:71-110` — `assert.match(handlerBody, /localStorage\.setItem\(['"]echolearn_daily_posts['"]/, ...)`. Anchor pair: `const handleForceNewDay` → `const refreshTokenUsage`. Embedded comment "DO NOT FLIP THIS BACK to assert.doesNotMatch". `grep -c "assert.doesNotMatch"` returns 1 — that one occurrence is in a comment, not an assertion. |
| 9   | Plan 36-11 contracts unchanged — `loadCache()` rejection on date mismatch, `load()` rehydration with `spreadByConcept`/`spreadByStyle` re-interleave | ✓ verified | `app/src/services/concept-feed.service.ts:185` — `if (parsed.date !== today()) return null`; `app/src/services/post-queue.service.ts:75-107` — date-mismatch branch snapshots to `STORAGE_KEY_YESTERDAY`, rehydrates `_state.posts`, runs `spreadByConcept(rehydrated)` then `spreadByStyle(rehydrated)`. |
| 10  | Plan 36-12 contracts unchanged — Promise mutex on refillQueue via `refill-mutex.ts` leaf module, `REFILL_THRESHOLD=16` | ✓ verified | `app/src/services/refill-mutex.ts:47` — `createPromiseMutex` exported; `app/src/services/concept-feed.service.ts:29` (import), `:1183` (`const _refillMutex = createPromiseMutex()`), `:1199` (`return _refillMutex.run(async () => {`); `app/src/services/post-queue.service.ts:32` — `const REFILL_THRESHOLD = 16`. |
| 11  | All 7 new tests in 36-14's two test files GREEN | ✓ verified | `node --test`: `HomeScreen.exploredAnchors-resync.test.mjs` 3/3 GREEN; `HomeScreen.warm-start-refallback.test.mjs` 4/4 GREEN. Total 7/7. |
| 12  | All 6 tests in 36-15's modified test file GREEN (Test 6 inverted, others preserved) | ✓ verified | `node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs` — 6/6 GREEN: gates DEV, declares handler, calls loadQueue, navigates /home, resets daily-read, mutates daily-posts (the inverted Test 6). |
| 13  | TypeScript clean (`npx tsc -b --noEmit` exit 0) | ✓ verified | `npx tsc -b --noEmit` returned exit 0. No type errors across the modified files (HomeScreen.tsx, SettingsDataScreen.tsx). |
| 14  | CLAUDE.md gets new bullet documenting always-mounted-screen state-resync principle | ✓ verified | `CLAUDE.md:77` — new bullet: "**Always-mounted screens must explicitly re-read service state on /home navigation (Phase 36-14):**" — placed under "Concept Feed Generation Pipeline → Numeric defaults" as planned. References both `HomeScreen.exploredAnchors-resync.test.mjs` and `HomeScreen.warm-start-refallback.test.mjs` and the wall-clock-asymmetry pattern. `grep -c "always-mounted" CLAUDE.md` = 2 (≥1 required); `grep -c "Always-mounted screens must explicitly re-read"` = 1. |
| 15  | Dual `[location.pathname]` effect pattern (Edit A warm-start re-fallback + Edit B vine resync) preserved | ✓ verified | `app/src/screens/HomeScreen.tsx:201` (Edit A close `}, [location.pathname]);`) AND `:517` (Edit B close `}, [location.pathname]);`). Two separate effects with the same dep-array, structurally placed at the source positions Plan 36-14 specified. |
| 16  | `handleForceNewDay` toast still fires + still navigates to `/home` (Plan 36-10 contract preserved) | ✓ verified | `app/src/screens/settings/SettingsDataScreen.tsx:134-135` — `toast('Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.', 'success'); navigate('/home');`. The toast text was updated to reflect the restored two-cache mutation but the contract (toast on success + navigate) is intact. |

**Score: 16/16 truths verified.**

## Required Artifacts

| Artifact                                                     | Expected                                                                                              | Status     | Details                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/src/screens/HomeScreen.tsx`                             | Edit A widens line 172 effect; Edit B adds sibling effect after creditAwardedRef declaration          | ✓ verified | Both edits present at the prescribed source positions (Edit A: 171-201; Edit B: 502-517). Comments embed the round-4 sub-issue cross-references. |
| `app/src/screens/settings/SettingsDataScreen.tsx`            | `handleForceNewDay` body re-mutates daily-posts cache                                                  | ✓ verified | Lines 117-126 — daily-posts mutation. Embedded comment block (lines 94-116) explains the wall-clock asymmetry and the Plan 36-13 reversion correction. |
| `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` (NEW) | Source-reading regression test via anchor-pair extraction                                              | ✓ verified | 3 tests GREEN. `creditAwardedRef = useRef(` → `eventBus.subscribe('CONCEPT_EXPLORED'` slice. |
| `app/tests/screens/HomeScreen.warm-start-refallback.test.mjs` (NEW) | Source-reading regression test for re-fallback effect                                                  | ✓ verified | 4 tests GREEN. Uses comment-marker anchor-pair: `// Re-sync feed from cache when navigating back to /home` → first `}, [location.pathname]);`. |
| `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` | Test 6 inverted from negative to positive                                                              | ✓ verified | 6 tests GREEN. Test 6 asserts `localStorage.setItem('echolearn_daily_posts', ...)` IS present. Embedded "DO NOT FLIP THIS BACK" marker. |
| `CLAUDE.md`                                                  | New bullet under "Concept Feed Generation Pipeline → Numeric defaults"                                 | ✓ verified | Line 77, "Always-mounted screens must explicitly re-read service state on /home navigation (Phase 36-14)". |
| `.planning/phases/36-.../36-14-SUMMARY.md`                   | Plan summary documenting design choice + complementary nature with Plan 36-15                          | ✓ verified | File present. |
| `.planning/phases/36-.../36-15-SUMMARY.md`                   | Plan summary documenting framing correction (symmetric not redundant) + Test 6 inversion              | ✓ verified | File present. |

## Key Link Verification

| From                                                | To                                                | Via                  | Status     | Details                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------- | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `HomeScreen.tsx` (Edit B effect)                    | `dailyReadService.getExploredAnchors()`           | function call        | ✓ wired    | Line 514 inside `if (location.pathname === '/home')` block.                                                  |
| `HomeScreen.tsx` (Edit B effect)                    | `dailyReadService.isCreditAwarded()`              | assignment           | ✓ wired    | Line 515: `creditAwardedRef.current = dailyReadService.isCreditAwarded()`.                                  |
| `HomeScreen.tsx` (Edit A effect)                    | `postQueueService.getYesterdayQueue()`            | function call        | ✓ wired    | Line 192. Result assigned to `setDailyPosts(yesterdayQueue.slice(0, 8))` on line 194.                       |
| `HomeScreen.tsx` (Edit A effect)                    | `postQueueService.loadQueue()`                    | function call        | ✓ wired    | Line 191 — defensive re-load before reading yesterday queue.                                                |
| `SettingsDataScreen.handleForceNewDay`              | `localStorage.setItem('echolearn_daily_posts', …)` | localStorage write   | ✓ wired    | Line 122 inside the inner try-block. Date set to yesterday on line 121.                                      |
| `SettingsDataScreen.handleForceNewDay`              | `dailyReadService.reset()`                        | function call        | ✓ wired    | Line 133 — preserved from Plan 36-13.                                                                        |
| `SettingsDataScreen.handleForceNewDay`              | `navigate('/home')`                               | function call        | ✓ wired    | Line 135 — preserved from Plan 36-10.                                                                        |
| `concept-feed.service.ts._refillMutex`              | `refill-mutex.ts.createPromiseMutex`              | import               | ✓ wired    | Line 29 import; Line 1183 instantiation; Line 1199 use inside `refillQueue`. Plan 36-12 unchanged.           |
| `post-queue.service.ts.load()` date-mismatch branch | `spreadByConcept` + `spreadByStyle`               | function calls       | ✓ wired    | Lines 106-107 inside the rehydrate branch (Plan 36-11 Task 2). Unchanged.                                   |

All key links verified.

## Behavioral Spot-Checks

| Behavior                                                    | Command                                                                       | Result                                                  | Status |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| Round-4 plan-specific tests pass                            | `node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs tests/screens/HomeScreen.warm-start-refallback.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs` | tests 13, pass 13, fail 0                               | ✓ PASS |
| TypeScript clean across the project                         | `npx tsc -b --noEmit`                                                         | exit 0                                                  | ✓ PASS |
| CLAUDE.md doc-sync grep                                     | `grep -c "always-mounted" CLAUDE.md`                                          | 2 (≥1 required)                                         | ✓ PASS |
| Daily-posts mutation present in SettingsDataScreen          | `grep -c "echolearn_daily_posts" app/src/screens/settings/SettingsDataScreen.tsx` | 2 (≥1 required)                                         | ✓ PASS |
| dailyReadService.reset preserved                            | `grep -c "dailyReadService.reset()" app/src/screens/settings/SettingsDataScreen.tsx` | 2                                                       | ✓ PASS |
| getYesterdayQueue used in HomeScreen                        | `grep -c "getYesterdayQueue" app/src/screens/HomeScreen.tsx`                  | 3                                                       | ✓ PASS |

All spot-checks pass. Device-side runtime confirmation (Force New Day → vine chip clears, feed populates from yesterday's UNSERVED queue) is the operator's UAT step — flagged below as the optional human verification item to flip the round-4 UAT to `resolved`.

## Anti-Patterns Scan

No blocker anti-patterns found in the modified files.

| File                                                  | Pattern                                                                                                | Severity | Notes                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/src/screens/HomeScreen.tsx`                      | None — both new effects have substantive bodies, write to React state via setters, and use real service calls. | OK       | Comment blocks reference Plan numbers and round-4 sub-issues for traceability.                                                                                                                                                                                       |
| `app/src/screens/settings/SettingsDataScreen.tsx`     | None — handler does real localStorage mutations, calls real services, navigates.                       | OK       | The inner try/catch around `JSON.parse(dailyRaw)` is intentional defensive coding (handles malformed cache without breaking the rest of the handler).                                                                                                                |
| Test files                                            | One `assert.doesNotMatch` reference — but only in a comment ("DO NOT FLIP THIS BACK"), not an assertion. | OK       | Confirmed via `grep -n "doesNotMatch"`: line 95 is inside a comment block. The actual assertion uses `assert.match`.                                                                                                                                                  |

## Plan 36-11/36-12 Regression Preservation

All Plan 36-11 / 36-12 contracts preserved (confirmed via grep):

| Contract                                                              | File:Line                                          | Status     |
| --------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| `STORAGE_KEY_YESTERDAY` constant                                      | `post-queue.service.ts:20`                         | ✓ unchanged |
| `parsed.date !== today()` rejection in loadCache                      | `concept-feed.service.ts:185`                      | ✓ unchanged |
| `parsed.date !== today()` rehydration trigger                         | `post-queue.service.ts:75`                         | ✓ unchanged |
| `spreadByConcept` + `spreadByStyle` re-interleave on rehydrate        | `post-queue.service.ts:106-107`                    | ✓ unchanged |
| `REFILL_THRESHOLD = 16`                                               | `post-queue.service.ts:32`                         | ✓ unchanged |
| `MAX_QUEUE_SIZE = 32`                                                 | `post-queue.service.ts:33`                         | ✓ unchanged |
| `_refillMutex = createPromiseMutex()` + `_refillMutex.run(...)` body  | `concept-feed.service.ts:1183, 1199`               | ✓ unchanged |
| `refill-mutex.ts` leaf module exported `createPromiseMutex`           | `refill-mutex.ts:47`                               | ✓ unchanged |
| `MAX_QUEUE_SIZE` documented in CLAUDE.md                              | `CLAUDE.md` (existing bullet)                      | ✓ unchanged |
| `USER_ACK_BEFORE_GRAPH_CONTEXT` constant in useQuestions.ts (Phase 35)| `useQuestions.ts`                                  | ✓ unchanged |

## Optional Human Verification (UAT round-4 closure)

Round-4 UAT can flip from `status: diagnosed` to `status: resolved` after the operator confirms on device:

### 1. Force New Day → vine chip clears

**Test:** Open the app in dev mode with an existing populated post queue and some explored anchors (vine chip showing N/M with N>0). Navigate to Settings → Data → Developer → "Force new day (dev)" → tap "Roll back date".
**Expected:** App routes to /home. Vine progress chip on /home immediately shows 0/M (matches natural midnight rollover behavior).
**Why human:** Visual UI verification of React state propagation after the navigation effect fires. Structural guarantee verified by `HomeScreen.exploredAnchors-resync.test.mjs` 3/3 GREEN.

### 2. Force New Day → feed auto-populates from yesterday's UNSERVED queue

**Test:** Same setup as Test 1, but ensure the post queue has UNSERVED entries (i.e., user did not exhaust the queue yesterday).
**Expected:** /home INITIAL render shows yesterday's UNSERVED queue posts immediately (no manual swipe needed, no empty flicker, no "Check your API keys" UI). After ~8 seconds: feed refreshes with NEW LLM-generated posts as the cap-gated refill cycle runs.
**Why human:** Visual + timing verification of the runtime warm-start path. Structural guarantee verified by `HomeScreen.warm-start-refallback.test.mjs` 4/4 GREEN and the storage mutation by `SettingsDataScreen.force-new-day.test.mjs` Test 6.

These are not blocking gaps — they are confirmation checkpoints that the structurally-verified resync behavior produces the expected visual result on device.

---

_Verified: 2026-05-07T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Round-4 status: passed → UAT may flip from diagnosed to resolved after operator device retest_
