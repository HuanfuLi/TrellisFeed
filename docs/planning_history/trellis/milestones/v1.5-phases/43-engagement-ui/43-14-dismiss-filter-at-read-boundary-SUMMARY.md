---
phase: 43-engagement-ui
plan: 14
plan_id: 43-14
slug: dismiss-filter-at-read-boundary
status: complete
gap_closure: true
closed_gap: "UAT Test 4 — Dismiss not propagating to same-anchor tiles (major)"
subsystem: feed/concept-feed
tags: [gap-closure, dismiss, engagement, concept-feed, read-boundary]
requires: [engagement-service-getDismissedAnchorIds, post-queue-walker]
provides: [applyDismissedFilter-helper, dismiss-filter-at-read-boundary]
affects: [getCachedDailyPosts, getDailyPosts-cache-hit, getDailyPosts-fingerprint-mismatch]
tech-added: []
patterns: [filter-at-read-boundary, defense-in-depth-dismiss]
key-files-created:
  - app/tests/services/concept-feed-dismiss-filter.test.mjs
  - app/tests/screens/HomeScreen.dismiss-resync.test.mjs
key-files-modified:
  - app/src/services/concept-feed.service.ts
decisions:
  - "Filter at READ BOUNDARY (single helper, 3 call sites) rather than per-consumer post-filter — makes the four HomeScreen write paths dismiss-aware by construction"
  - "Drain branch UNCHANGED — dequeued posts come from walker-filtered derivedList per Phase 39 D-07"
  - "loadCache() Phase 36-11 stale-cache rejection UNCHANGED — dismiss filter applies AFTER the date check"
  - "Effect A (live ANCHOR_DISMISSED filter for AnimatePresence fade-out) preserved"
  - "Effect B ([location.pathname] re-read) kept as defense-in-depth even though now strictly redundant"
metrics:
  duration_minutes: 25
  tasks: 4
  files_changed: 1
  files_added: 2
  test_assertions_added: 12
completed: 2026-05-12
commits:
  - 4cbecdd9
  - d67607c6
  - d47cb733
---

# Phase 43 Plan 14: Dismiss Filter at Read Boundary Summary

**One-liner:** Centralized the dismiss-anchor filter at `conceptFeedService.getCachedDailyPosts()` + `getDailyPosts()` cache-hit/fingerprint-mismatch branches via a single `applyDismissedFilter` helper, closing UAT Test 4 ("same-anchor sibling tiles reappearing on refresh / 8s timer / PLANNER_UPDATED / navigation").

## Root cause (confirmed)

`concept-feed.service.ts`'s `getCachedDailyPosts()` (line 1593 pre-fix) and `getDailyPosts()` cache-hit branch (line 1487 pre-fix) returned cached posts WITHOUT filtering by `engagementService.getDismissedAnchorIds()`. HomeScreen's four independent write paths all called `setDailyPosts(...)` from these unfiltered service reads:

1. `useState` warm-start initializer (HomeScreen.tsx:41-50)
2. Main effect's `getDailyPosts(questions).then(setDailyPosts)` (HomeScreen.tsx:128-147)
3. `refreshFeed()` invoked by `PLANNER_UPDATED` + 8s delayed timer (HomeScreen.tsx:126-184)
4. `[location.pathname]` warm-start re-fallback effect's `getCachedDailyPosts()` call (HomeScreen.tsx:204-224)

Each of these overwrote Effect A's live `ANCHOR_DISMISSED` setDailyPosts filter and Effect B's `[location.pathname]` re-read. So on refresh, 8s timer, PLANNER_UPDATED, or cross-screen nav, the dismissed anchor's sibling tiles reappeared.

Walker dismiss-skip at `post-queue.service.ts:389` handled FUTURE refill cycles correctly per Phase 39 D-07 — the bug was on the READ side for already-cached / in-memory posts.

## Fix

Centralized the dismiss filter at the READ BOUNDARY in `concept-feed.service.ts`:

- New private helper `applyDismissedFilter(posts: DailyPost[]): DailyPost[]` (inserted immediately after `saveCache`):
  - Builds `new Set(engagementService.getDismissedAnchorIds())`
  - Short-circuits to `posts` when the set is empty (avoids per-post predicate call when nothing is dismissed)
  - Filter predicate: `post.sourceQuestionIds[0]` not in dismissed set; orphan posts (empty `sourceQuestionIds`) pass through (non-dismissable)
- Called from `getCachedDailyPosts()` between the `sourceType !== 'connection'` filter and `filterDecayedStarters` so the decay heuristic's "3+ organic posts" threshold reflects the user-visible count.
- Called from `getDailyPosts()` cache-hit branch (same composition order).
- Called from `getDailyPosts()` fingerprint-mismatch same-day branch (symmetric).
- Drain branch UNCHANGED — `queuedPosts` come from `postQueueService.dequeue` whose source was already walker-filtered.

## Invariants preserved

- `post-queue.service.ts:389` walker dismiss-skip — UNCHANGED (Phase 39 D-07).
  - Test 7 in concept-feed-dismiss-filter.test.mjs and Test 4 in HomeScreen.dismiss-resync.test.mjs both guard with negative-invariant regex assertions.
- `loadCache()` Phase 36-11 stale-cache rejection — UNCHANGED. Dismiss filter applies AFTER `loadCache()` returns a non-null cached payload (i.e., after the date check). On date-mismatch, `loadCache()` returns null and the cache-read branches do not run.
- HomeScreen Effect A live `ANCHOR_DISMISSED` filter — UNCHANGED. Drives `AnimatePresence` fade-out animation.
- HomeScreen Effect B `[location.pathname]` engagement re-read — UNCHANGED. Strictly redundant now (the read boundary also filters), but kept as defense-in-depth.
- `filterDecayedStarters` + `sourceType !== 'connection'` filters in cache-read paths — preserved and compose correctly (dismiss runs between them).

## Tests added

- `app/tests/services/concept-feed-dismiss-filter.test.mjs` — 7 tests:
  - Test 1: empty-dismissed baseline (helper short-circuits)
  - Test 2: single-anchor dismiss (Set.has + !dismissed.has predicate shape)
  - Test 3: multi-anchor dismiss (Set construction from engagementService output)
  - Test 4: orphan posts non-dismissable (legacy starter edge case)
  - Test 5: getDailyPosts cache-hit + fingerprint-mismatch branches both wire the helper in correct order
  - Test 6: drain branch unchanged (walker owns the forward-looking filter)
  - Test 7: NEGATIVE INVARIANT — walker dismiss-skip + walker signature + refillQueue Set construction unchanged
- `app/tests/screens/HomeScreen.dismiss-resync.test.mjs` — 5 tests:
  - Test 1: Effect A live `ANCHOR_DISMISSED` filter still present (LP-05 fast-path)
  - Test 2: HomeScreen warm-start, main effect, and `[location.pathname]` re-fallback do NOT inline `getDismissedAnchorIds()`
  - Test 3: Effect B at `[location.pathname]` still references `getDismissedAnchorIds()` (defense-in-depth)
  - Test 4: NEGATIVE — concept-feed walker invocation + walker predicate unchanged
  - Test 5: COUNTERWEIGHT — `applyDismissedFilter` declared and called from `getCachedDailyPosts` + cache-hit branch

**Test count:** 12 new assertions across 2 new files. All source-reading (per CLAUDE.md "Phase 27 locale tests" guidance — concept-feed.service.ts dynamic-import under `node --test` crashes via the i18next chain).

## Verification

- `cd app && npx tsc -b --noEmit` exits 0
- `cd app && npm run build` exits 0
- Both new test files exit 0 (12/12 pass)
- Related test files (engagement.service, engagement-anti-wire, engagement.service.reset-dismissed-only, post-queue-rehydrate, derived-list, refill-queue-integration, refill-mutex, HomeScreen.engagement-resync) — 69/69 pass (no regression)
- Full `npm run test:main` reports 839/844 pass — 5 failures are PRE-EXISTING (reproduced against pre-43-14 baseline `238b59ea`) and out of scope per `scope_boundary` rule. Already logged in `deferred-items.md` (43-10 entry); added a 43-14 note re-confirming the reproduction.

## Deviations from Plan

None — plan executed exactly as written. Task 2's plan acknowledged the dynamic-import fallback to source-reading; that fallback was taken (as expected) because concept-feed.service.ts imports the i18n locales chain (locales/index.ts → en.json → ERR_IMPORT_ATTRIBUTE_MISSING).

## Files changed

- `app/src/services/concept-feed.service.ts` — 1 helper added (~25 lines incl. comment header), 3 call sites wired
- `app/tests/services/concept-feed-dismiss-filter.test.mjs` — NEW (7 tests, 160 lines)
- `app/tests/screens/HomeScreen.dismiss-resync.test.mjs` — NEW (5 tests, 170 lines)
- `.planning/phases/43-engagement-ui/deferred-items.md` — appended 43-14 note re-confirming pre-existing failures

## Commits

- `4cbecdd9` fix(43-14): centralize dismiss filter at concept-feed read boundary (getCachedDailyPosts + getDailyPosts cache-hit + fingerprint-mismatch)
- `d67607c6` test(43-14): concept-feed dismiss-filter at read boundary (cache-hit + getCachedDailyPosts + walker non-regression)
- `d47cb733` test(43-14): HomeScreen + concept-feed dismiss-filter centralization invariants

## Known Stubs

None — fully wired implementation.

## Self-Check: PASSED

- All 4 files present (1 modified, 3 added)
- All 3 commit hashes present in `git log --all`
- Both new test files exit 0 (12/12 pass)
- `tsc -b --noEmit` exits 0
- `npm run build` exits 0
- 69/69 related test files pass (engagement, post-queue, derived-list, refill-queue-integration, refill-mutex, HomeScreen.engagement-resync)
