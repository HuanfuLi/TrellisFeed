---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 13
subsystem: ui
tags: [settings, dev-tooling, force-new-day, daily-read-service, regression-test]

# Dependency graph
requires:
  - phase: 36-10-dev-force-new-day
    provides: handleForceNewDay handler + dev-only SettingRow gate (commit 6a90224a's dual-cache hack reverted by this plan)
  - phase: 36-11-rehydrate-and-reject-stale-cache
    provides: loadCache date-rejection in concept-feed.service.ts (makes the dual-cache mutation redundant — runs in parallel with this plan)
provides:
  - Cleaned-up handleForceNewDay handler that calls dailyReadService.reset() so vine progress chip clears on Force New Day
  - Negative regression test asserting echolearn_daily_posts is never mutated directly by the dev button
affects: [36-VERIFICATION, 36-UAT-RETEST, settings sub-screens, dev workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-button parity with natural midnight reset: when a dev affordance simulates a wall-clock event the service code can't observe (today() can't advance), the button must explicitly call the service's reset() to mimic what the natural event would have triggered."
    - "Negative regression assertion via anchor-pair extraction: rather than matching on closing-brace indent (which silently regresses on formatter changes), extract the handler body via [start of handler → start of next handler] and assert.doesNotMatch on a key string. More robust against drift."

key-files:
  created: []
  modified:
    - app/src/screens/settings/SettingsDataScreen.tsx
    - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs

key-decisions:
  - "Handler now calls dailyReadService.reset() to clear vine progress (echolearn_daily_read) — closes round-3 sub-issue (a). The natural midnight reset path (daily-read.service.ts:36) self-resets via parsed.date !== today(), but the dev button cannot advance today(), so it must mimic the reset explicitly."
  - "Removed the dual-cache mutation of echolearn_daily_posts.date that landed in commit 6a90224a. Plan 36-11 Task 1's loadCache date-rejection now handles staleness symmetrically; explicit invalidation is redundant. Reverting reduces the dev button's blast radius from 'two hand-edits + a service reload' to 'one hand-edit + two service resets'."
  - "Test 6 is a defensive negative-assertion (assert.doesNotMatch on /echolearn_daily_posts/ inside the handler body) so the dual-cache hack cannot be silently re-introduced by a future patch. Anchor-pair extraction (handleForceNewDay → refreshTokenUsage) keeps the assertion robust to formatter-driven indent changes."
  - "Toast text updated from 'Queue + daily cache dates set to yesterday. Navigating to /home.' to 'Queue date rolled back; vine progress reset. Navigating to /home.' — reflects the cleaner contract."

patterns-established:
  - "When a dev-only button simulates a wall-clock event (Force New Day), it must call EVERY service reset that the wall-clock event would naturally trigger. Service self-reset paths gated on today() comparisons cannot fire when the button doesn't (and shouldn't) advance the clock."
  - "When a regression-guard test deletes a now-redundant prior assertion, pair it with a negative assertion to prevent silent re-introduction. Test 5 (positive: dailyReadService.reset called) + Test 6 (negative: echolearn_daily_posts not referenced) are complementary."

requirements-completed: [GAP-D-round3-a, GAP-D-round3-cleanup]

# Metrics
duration: 5min
completed: 2026-05-07
---

# Phase 36 Plan 13: Force-New-Day Button Cleanup Summary

**handleForceNewDay now resets dailyReadService (closes round-3 sub-issue a — vine progress chip wasn't clearing) and drops the dual-cache hack from commit 6a90224a, made redundant by Plan 36-11's symmetric loadCache date-rejection.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-07T09:46:00Z (approx, post `git reset --hard 67ba0d44`)
- **Completed:** 2026-05-07T09:50:00Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Closed round-3 sub-issue (a): the vine progress chip now clears on Force New Day, matching natural midnight rollover behavior.
- Reverted commit 6a90224a's defensive dual-cache mutation. Plan 36-11's loadCache date-rejection makes that mutation redundant — staleness handled symmetrically across the post-queue and daily-posts caches without explicit invalidation.
- Negative regression test (Test 6) added so the dual-cache hack cannot be silently re-introduced.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update the handler** — `27ea5d31` (fix) — handleForceNewDay calls dailyReadService.reset() + drops dual-cache hack
2. **Task 2: Update the regression test (+ Rule-1 comment fix)** — `de5b197e` (test) — assert dailyReadService.reset call + reject re-introduction of dual-cache hack; bundled the Rule-1 deviation fix (rephrasing the literal `echolearn_daily_posts` substring out of the handler comment so Test 6's negative assertion passes)

**Plan metadata commit:** _pending — see Final Commit section below_

## Files Created/Modified

- `app/src/screens/settings/SettingsDataScreen.tsx` — handleForceNewDay handler body rewritten:
  - REMOVED: `localStorage.getItem('echolearn_daily_posts')` block + .date mutation (commit 6a90224a's dual-cache hack)
  - ADDED: `dailyReadService.reset()` call after `postQueueService.loadQueue()`
  - UPDATED: toast text to reflect the cleaner contract
  - UPDATED (Rule-1 deviation): comment phrasing changed from "(echolearn_daily_posts) is NOT touched" to "the rendered daily-posts cache key is NOT touched here" so Test 6's negative regex doesn't false-positive on the explanatory comment
- `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` — test file updated:
  - DELETED: old Test 5 ("handler also rolls back the daily-posts cache date so getDailyPosts cache-misses") — the assertion it guarded is being reverted
  - ADDED: new Test 5 ("handler resets daily-read state so vine progress chip clears on Force New Day") — positive assertion `dailyReadService.reset()` called inside handler region
  - ADDED: Test 6 ("handler does NOT mutate echolearn_daily_posts ...") — negative regression assertion via anchor-pair extraction + `assert.doesNotMatch`. Final test count: 6 (4 prior + new Test 5 + new Test 6).

## Decisions Made

- Handler now resets `dailyReadService` (vine progress) — required to mimic what natural midnight rollover triggers via `daily-read.service.ts:36`.
- Reverted the dual-cache mutation of `echolearn_daily_posts.date`. Plan 36-11's `loadCache` date-rejection handles staleness symmetrically; explicit invalidation is redundant.
- Anchor-pair extraction in Test 6 (handleForceNewDay → refreshTokenUsage) chosen over closing-brace-indent matching for robustness against formatter changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test 6 negative regex tripped on explanatory comment**
- **Found during:** Task 2 (test execution after Step 2c added)
- **Issue:** The Plan 36-13 spec for `handleForceNewDay` included an explanatory comment ending in "(echolearn_daily_posts) is NOT touched —" that uses the literal substring `echolearn_daily_posts`. Test 6's negative regression assertion `/echolearn_daily_posts/` runs against the entire handler body via anchor-pair extraction — the comment trip the regex despite there being no actual mutation in the handler. Initial test run: 5 pass / 1 fail.
- **Fix:** Rephrased the comment from "The daily-posts cache (echolearn_daily_posts) is NOT touched —" to "The rendered daily-posts cache key is NOT touched here —" plus a follow-up sentence noting that the negative regression test in this plan asserts that exact localStorage key string is absent from this handler body. Behavior unchanged; comment-text adjustment only.
- **Files modified:** `app/src/screens/settings/SettingsDataScreen.tsx` (handler comment block, lines 89-92)
- **Verification:** `node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs` → `tests 6 / pass 6 / fail 0`
- **Committed in:** `de5b197e` (folded into the Task 2 atomic commit so source change + test update + Rule-1 fix land together)

**2. [Documentation note] Plan total-test-count is mathematically inconsistent with its instructions**
- **Found during:** Task 2 verification
- **Issue:** Plan 36-13 §<action> Step 2c ends with the line "Total test count: 4 prior (test 5 deleted) + new Test 5 (vine reset) + new Test 6 (negative) = **5 final tests**." The math is wrong: 4 + 1 + 1 = 6, not 5. The plan's frontmatter `truths` field also says "Total test count remains 5 — same as after 6a90224a's addition." But the actual instruction body (delete one, add two) yields 6.
- **Fix:** Followed the body instructions verbatim (Step 2a delete + Step 2b add + Step 2c add) and ended at 6 GREEN tests. The body of a plan is the definitive instruction; the summary count line is documented here as an erratum so the verifier doesn't flag it as a missed task.
- **Files modified:** none (this is a meta-note about the plan, not a code change)
- **Verification:** `node --test` reports `tests 6 / pass 6 / fail 0`. All 6 tests are listed at line 24-103 of the test file, in order: import.meta.env.DEV gate / handleForceNewDay declared / postQueueService.loadQueue() in handler / navigate('/home') in handler / dailyReadService.reset called / echolearn_daily_posts NOT in handler body.

## Verification

```bash
cd app && node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs
```
Output: `tests 6 / pass 6 / fail 0` — exactly the 4 prior invariants preserved + new Test 5 (vine reset) + new Test 6 (negative).

```bash
cd app && npx tsc -b --noEmit
```
Exit 0 — TypeScript clean. Handler still uses the existing import (`dailyReadService` already imported at SettingsDataScreen.tsx:15, used by the existing "Reset today" button at line 270). No new imports added.

## Self-Check: PASSED

- [x] `app/src/screens/settings/SettingsDataScreen.tsx` exists and contains `dailyReadService.reset()` inside `handleForceNewDay` body
- [x] `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` exists and contains both new Test 5 (vine reset) and new Test 6 (negative)
- [x] Old Test 5 ("handler also rolls back the daily-posts cache date") is removed
- [x] Commit `27ea5d31` exists in git log (Task 1)
- [x] Commit `de5b197e` exists in git log (Task 2 + Rule-1 fix)
- [x] `node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs` reports 6/6 GREEN
- [x] `npx tsc -b --noEmit` exits 0
