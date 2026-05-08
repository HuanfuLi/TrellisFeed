---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 15
subsystem: ui
tags: [settings, dev-tooling, force-new-day, daily-posts-cache, regression-test, round-4-gap-closure]

# Dependency graph
requires:
  - phase: 36-11-rehydrate-and-reject-stale-cache
    provides: loadCache parsed.date !== today() rejection — the runtime hook this plan re-arms via the storage mutation it restores
  - phase: 36-13-force-new-day-cleanup
    provides: handleForceNewDay handler with dailyReadService.reset() (preserved); negative Test 6 (inverted in this plan)
provides:
  - handleForceNewDay handler with restored echolearn_daily_posts.date mutation alongside echolearn_post_queue.date — symmetric two-cache invalidation so loadCache rejection fires on dev-button path even though today() does not advance
  - Inverted Test 6 (negative → positive) with anchor-pair extraction + "do not flip back" rationale block, guarding against a re-revert
affects: [36-VERIFICATION, 36-UAT-RETEST, settings sub-screens, dev workflow, round-4 sub-issue (b) storage half]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wall-clock-asymmetry pattern (extended): Plan 36-13 established it for dailyReadService.reset(); Plan 36-15 generalizes it — when a dev affordance simulates midnight rollover, it must mutate EVERY date-stamped storage key that natural midnight would have tripped, including ALL date-stamped cache keys, because today() can't advance under a dev button. echolearn_post_queue and echolearn_daily_posts are SYMMETRIC date-rejection caches, not redundant."
    - "Inversion-with-rationale-block: Test 6 was a negative assertion (assert.doesNotMatch); inverting to positive (assert.match) without an embedded rationale + 'DO NOT FLIP THIS BACK' marker invites a future agent to silently re-revert when reading the test in isolation. The new Test 6 carries the full historical reasoning inline so the next reader has everything they need at the call site."

key-files:
  created: []
  modified:
    - app/src/screens/settings/SettingsDataScreen.tsx
    - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs

key-decisions:
  - "Restored the echolearn_daily_posts.date mutation in handleForceNewDay (paired with the existing echolearn_post_queue.date mutation). The two writes are symmetric: both keys are date-stamped, both rejection paths use the same parsed.date !== today() shape, both must be tripped when the dev button simulates a midnight rollover. Plan 36-13's framing of this mutation as 'redundant dual-cache hack' was incorrect — round-4 UAT proved it broke sub-issue (b)."
  - "Wrapped the daily-posts JSON parse + write in its own inner try/catch so malformed cache content doesn't trip the outer handler. loadCache() will reject malformed parsed payload anyway, so a parse failure here is informational, not blocking."
  - "Toast text updated from 'Queue date rolled back; vine progress reset. Navigating to /home.' to 'Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.' — accurately reflects the two-cache mutation."
  - "Test 6 inverted IN PLACE (no test count delta — total stays at 6). The new positive assertion uses the same anchor-pair extraction (`handleForceNewDay → refreshTokenUsage`) Plan 36-13 introduced, but checks for `localStorage.setItem('echolearn_daily_posts', ...)` instead of asserting the key string is absent."
  - "Plan 36-13's other improvements preserved verbatim: dailyReadService.reset() call (closes round-3 sub-issue a), Test 5 (positive vine-reset assertion), the dailyReadService import, the inline import.meta.env.DEV gate, the i18n exemption comment block."
  - "Plan scoped to STORAGE half only. The runtime consequence (HomeScreen falling back to yesterday's UNSERVED queue when getCachedDailyPosts() returns []) is owned by Plan 36-14's warm-start re-fallback effect on /home navigation — Plan 36-15 owns SettingsDataScreen.tsx, Plan 36-14 owns HomeScreen.tsx. Zero file overlap, parallel-safe execution."

patterns-established:
  - "Round-4 lesson: when reverting a defensive write because 'a downstream check makes it redundant,' verify the downstream check covers EVERY trigger path, not just the natural one. Plan 36-13 verified loadCache rejection fires on real midnight (where today() advances) but not on the dev-button path (where today() can't advance). The dev button's blast radius is a separate trigger surface that needs its own coverage."
  - "When inverting a regression test, embed the full historical context in the test body (why the previous assertion was wrong, what UAT regression triggered the inversion, where to read more, and a 'do not flip back' marker). A test header is not enough — the next agent reads the test body in isolation when triaging a failure."

requirements-completed: [GAP-D-round4-b-storage]

# Metrics
duration: 2.4min
completed: 2026-05-07
---

# Phase 36 Plan 15: Restore Daily-Posts Cache Invalidation in handleForceNewDay Summary

**Restored the echolearn_daily_posts.date mutation in handleForceNewDay (paired with the existing echolearn_post_queue.date mutation) so loadCache()'s parsed.date !== today() rejection (Plan 36-11) fires symmetrically on the dev-button path — closes round-4 sub-issue (b) storage half. The runtime half (HomeScreen warm-start re-fallback) is owned by Plan 36-14.**

## Performance

- **Duration:** ~2.4 min
- **Started:** 2026-05-07T22:32:26Z
- **Completed:** 2026-05-07T22:34:51Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Closed round-4 sub-issue (b) STORAGE half: `handleForceNewDay` now mutates `echolearn_daily_posts.date` alongside `echolearn_post_queue.date`, restoring the symmetry that Plan 36-13 incorrectly removed. Plan 36-11's `loadCache()` rejection now fires on the dev-button path (it could not before, because `today()` does not advance under the dev button — the wall-clock-asymmetry pattern).
- Inverted Plan 36-13's negative Test 6 (`assert.doesNotMatch`) to a positive assertion (`assert.match`) using the same anchor-pair extraction (`handleForceNewDay → refreshTokenUsage`) for body isolation. Embedded a "DO NOT FLIP THIS BACK" marker block in the test body with the full historical reasoning, so a future agent reading the test in isolation has everything they need.
- Preserved every other Plan 36-13 improvement: `dailyReadService.reset()` call (closes round-3 sub-issue a), Test 5 (positive vine-reset assertion), the i18n exemption comment block, the `import.meta.env.DEV` gate.
- Scoped strictly to storage. HomeScreen.tsx untouched (Plan 36-14's territory); CLAUDE.md untouched (Plan 36-14 owns the new bullet).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-execution coordination with Plan 36-14 in the same wave):

1. **Task 1: Restore daily-posts cache mutation in handler** — `d2ac3fcd` (fix) — handleForceNewDay re-mutates echolearn_daily_posts.date for loadCache symmetry. +35 / -5 lines.
2. **Task 2: Invert Test 6 to positive assertion** — `25f4b4d6` (test) — Test 6 now asserts `localStorage.setItem('echolearn_daily_posts', ...)` IS present in the handler body, with embedded rationale + DO NOT FLIP THIS BACK marker. +34 / -14 lines.

**Plan metadata commit:** _pending — see Final Commit section below_

## Files Created/Modified

- `app/src/screens/settings/SettingsDataScreen.tsx` (handler body only):
  - **ADDED:** Inner block reading `localStorage.getItem('echolearn_daily_posts')`, parsing JSON, mutating `.date = yesterday`, writing back. Wrapped in try/catch so malformed cache doesn't trip the outer handler.
  - **UPDATED:** Comment block on the original queue mutation now refers ONLY to round-3 sub-issue (b cause #1) — purpose narrowed to "trigger Plan 36-11 rehydration" since the daily-posts mutation has its own block.
  - **ADDED:** New comment block on the daily-posts mutation explaining round-4 sub-issue (b) — wall-clock asymmetry, why this mutation is symmetric (not redundant), cross-reference to Plan 36-14's runtime consequence, link to debug document.
  - **UPDATED:** Toast text from `"Queue date rolled back; vine progress reset. Navigating to /home."` to `"Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home."` — reflects the two-cache mutation.
  - **PRESERVED:** `postQueueService.loadQueue()`, `dailyReadService.reset()`, `navigate('/home')`, the outer try/catch, the `import.meta.env.DEV` gate on the SettingRow, the i18n exemption comment block, all other handlers.
- `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` (Test 6 only):
  - **DELETED:** old Test 6 `'handler does NOT mutate echolearn_daily_posts (Plan 36-11 makes that mutation redundant)'` with its `assert.doesNotMatch` body.
  - **ADDED:** new Test 6 `'handler mutates echolearn_daily_posts.date so loadCache rejection fires symmetrically with queue rehydration'` with `assert.match(handlerBody, /localStorage\.setItem\(['"]echolearn_daily_posts['"]/, ...)`. Includes the full rationale block (5 paragraphs covering: wall-clock asymmetry, what would happen if untouched, the symmetric framing, the runtime owner cross-ref, and the explicit DO NOT FLIP THIS BACK marker).
  - **PRESERVED:** Tests 1-5 byte-unchanged, all imports byte-unchanged, anchor-pair extraction pattern preserved (start of handler → start of next handler).

## Decisions Made

- **Option A chosen over Option B.** The plan briefly considered an alternative where `loadCache()` itself could be made to reject in some other condition (e.g., a "dev button pressed" flag). Rejected because it would couple two storage layers in a non-obvious way, distort the natural midnight rollover semantics, and require its own state machine. Option A — restore the dev-button mutation that Plan 36-13 incorrectly removed — is structurally simpler, matches the `dailyReadService.reset()` pattern Plan 36-13 already established (mutate explicitly to mimic what midnight would have triggered), and keeps `loadCache()` semantics pure.
- **Framing correction.** The "redundant dual-cache hack" framing in Plan 36-13's `key-decisions` was incorrect. The two cache keys (`echolearn_post_queue` and `echolearn_daily_posts`) are SYMMETRIC, not redundant: both are date-stamped, both have identical rejection logic (`parsed.date !== today()`), and both rejection paths trigger DIFFERENT downstream behavior — the queue's `load()` rehydrates `_state.posts` from `parsed.posts` (Plan 36-11 Task 2); the daily-posts cache's `loadCache()` returns null so `getDailyPosts()` falls into its non-cache-hit branch. Both are needed; neither subsumes the other. The dev button must mutate both because it cannot advance the wall clock that natural midnight rollover would have used to trip both rejection paths.
- **Storage-only scope.** This plan does not touch HomeScreen.tsx. The runtime consequence (feed auto-populating from yesterday's UNSERVED queue when `getCachedDailyPosts()` returns `[]`) is owned by Plan 36-14's warm-start re-fallback effect on /home navigation. The two plans are complementary: Plan 36-15 creates the trigger condition (`loadCache()` returns null on the dev-button path), Plan 36-14 reacts to the trigger (HomeScreen falls back to `postQueueService.getYesterdayQueue()`). File ownership is disjoint by design — Plan 36-14 owns HomeScreen.tsx + 2 new test files + CLAUDE.md; Plan 36-15 owns SettingsDataScreen.tsx + the existing force-new-day test. Zero overlap, parallel-safe.
- **Test count delta: +0.** Test 6 inverted in place. Total stays at 6 (`import.meta.env.DEV` gate, handler declared, `loadQueue` called, `navigate('/home')` called, `dailyReadService.reset()` called, `localStorage.setItem('echolearn_daily_posts', ...)` called).

## Deviations from Plan

None — plan executed exactly as written. Zero auto-fixes (no Rule-1/2/3 triggers); zero architectural decisions (no Rule-4); zero auth gates. The plan was unusually precise — it specified exact comment block content, exact toast text, exact regex patterns, exact "DO NOT FLIP THIS BACK" marker placement.

## Self-Check Cross-Reference: Sub-Issues a/c/d/e Not Regressed

- **(a) — vine progress chip not clearing on Force New Day:** Closed by Plan 36-13's `dailyReadService.reset()` call AND (in round 4) Plan 36-14's HomeScreen vine resync. This plan PRESERVES `dailyReadService.reset()` byte-for-byte. Test 5 (`'handler resets daily-read state ...'`) untouched.
- **(c) — yesterday's leftover renders style-biased after rehydrate:** Closed by Plan 36-11 Task 2's `spreadByConcept` + `spreadByStyle` re-interleave on rehydrate. This plan does NOT touch the rehydrate path in `post-queue.service.ts`. No risk.
- **(d) — yesterday's served posts re-render as today's feed on second Force-New-Day:** Closed by Plan 36-11 Task 1's `loadCache()` parsed.date !== today() rejection on REAL midnight. This plan does NOT weaken the rejection — it ADDS PARITY for the dev-button path by mutating `echolearn_daily_posts.date` so the same rejection fires. Strictly additive.
- **(e) — empty swipe after Force-New-Day or rapid swiping due to boolean-mutex no-op:** Closed by Plan 36-12's promise-based mutex in `_refillMutex`. This plan does NOT touch refill, mutex, or REFILL_THRESHOLD. No risk.

## Verification

```bash
cd /Users/Code/EchoLearn/.claude/worktrees/agent-ab295736f8f46875c/app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Output: `tests 6 / pass 6 / fail 0` — Tests 1-5 from Plan 36-13 preserved; new Test 6 (positive `localStorage.setItem('echolearn_daily_posts', ...)` assertion) GREEN against the Task 1 source change.

```bash
cd app && npx tsc -b --noEmit
```
Exit 0 — TypeScript clean. No new imports added (handler reuses `localStorage` global; `dailyReadService` and `postQueueService` already imported).

```bash
cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs tests/services/post-queue-rehydrate.test.mjs tests/services/concept-feed-cache-date.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Output: `tests 91 / pass 91 / fail 0` — Phase 36 quick suite (13 files; Plan 36-14's two new test files don't yet exist in this worktree, so we run the isolation-mode 13-file variant the plan documented). Plans 36-11/12/13 contracts all preserved.

Phase preservation greps (all 5 pass):
- `STORAGE_KEY_YESTERDAY` in post-queue.service.ts: ✓
- `USER_ACK_BEFORE_GRAPH_CONTEXT` in useQuestions.ts: ✓
- `MAX_QUEUE_SIZE` in CLAUDE.md: ✓
- `dailyReadService.reset()` in SettingsDataScreen.tsx: ✓
- `parsed.date !== today()` in concept-feed.service.ts: ✓

## Forward-Looking Note: Plan 36-13 SUMMARY Erratum

Plan 36-13's `key-decisions` (line 33 of `36-13-SUMMARY.md`) framed the dual-cache mutation as "redundant" because Plan 36-11 Task 1's `loadCache` date-rejection was assumed to handle staleness symmetrically. **That framing was wrong on the dev-button path**, as round-4 UAT proved. Plan 36-13's reasoning held only for the natural-midnight path (where `today()` advances). The dev button cannot advance `today()`, so the rejection check trivially passes and the cache hit returns yesterday's served posts.

The framing should be read as superseded by Plan 36-15. The two cache keys are SYMMETRIC, not redundant — see this plan's `key-decisions` section above. Plan 36-13's other improvements (the `dailyReadService.reset()` call, Test 5, the toast cleanup) remain correct and are preserved verbatim by this plan.

## Self-Check: PASSED

- [x] `app/src/screens/settings/SettingsDataScreen.tsx` exists and contains `localStorage.setItem('echolearn_daily_posts'` inside the `handleForceNewDay` body
- [x] Handler still calls `postQueueService.loadQueue()`, `dailyReadService.reset()`, and `navigate('/home')` (Plan 36-11 + 36-13 preserved)
- [x] Toast text reads `"Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home."`
- [x] `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` Test 6 asserts the daily-posts mutation IS present (positive assertion via `assert.match`)
- [x] All 6 tests in the force-new-day file are GREEN
- [x] Commit `d2ac3fcd` exists in git log (Task 1)
- [x] Commit `25f4b4d6` exists in git log (Task 2)
- [x] `npx tsc -b --noEmit` exits 0
- [x] All five phase-preservation greps pass
- [x] HomeScreen.tsx is NOT modified by this plan (file ownership: Plan 36-14 owns it)
- [x] CLAUDE.md is NOT modified by this plan (file ownership: Plan 36-14 owns the new bullet)
