---
status: complete
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-14-SUMMARY.md, 36-15-SUMMARY.md]
round: 5
started: 2026-05-07T23:00:00Z
updated: 2026-05-07T23:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete — Tests 1 + 2 pass, Test 3 skipped (structurally covered)]

## Tests

### 1. Dev "Force new day" button — sub-issues (a) + (b) device retest after round-4 fixes
expected: |
  Open the app in dev mode with an existing populated post queue + some
  explored anchors (vine chip showing N>0). Navigate to Settings → Data →
  Developer → "Force new day (dev)" → tap "Roll back date". App routes to
  /home. The two round-4 issues should now be CLOSED:

  (a) VINE PROGRESS CHIP CLEARED — the chip on /home should reset to 0/N.
      (Plan 36-14 Edit B: sibling [location.pathname] effect re-reads
      dailyReadService.getExploredAnchors() and resets creditAwardedRef.)

  (b) FEED AUTO-POPULATES FROM UNSERVED QUEUE — INITIAL render shows
      yesterday's UNSERVED queue posts immediately (no manual swipe needed,
      no empty flicker, no "Check your API keys" UI). After ~8 seconds:
      feed refreshes with NEW LLM-generated posts.
      (Plan 36-15: handleForceNewDay restored echolearn_daily_posts.date
      mutation so loadCache rejects symmetrically. Plan 36-14 Edit A:
      widened nav effect with tier-1 getCachedDailyPosts → tier-2
      getYesterdayQueue warm-start fallback.)

  Also reconfirm the 3 previously-closed sub-issues remain closed:

  (c) STYLE MIX BALANCED on cold-start (round 3 — Plan 36-11 spreadByConcept
      + spreadByStyle re-interleave on rehydrate).

  (d) DOUBLE FORCE-NEW-DAY consistent (round 3 — Plan 36-11 loadCache
      date-rejection + Plan 36-15 daily-posts mutation).

  (e) QUEUE AUTO-TOPS-UP on first swipe (round 3 — Plan 36-12 Promise mutex
      awaits in-flight refill).
result: pass

### 2. Durable snapshot — second cold-start on the same new day
expected: |
  After Test 1 completes, tap "Force new day" AGAIN. Same observable behavior:
  warm-start renders immediately on /home from the durable snapshot
  (STORAGE_KEY_YESTERDAY), fresh batch replaces ~8s later. No served-posts
  regression, no empty flicker.
result: pass

### 3. Production tree-shake — Force-new-day button absent in prod build
expected: |
  Run `npm run build` from app/. grep dist/ for "Force new day" — no matches
  (Vite's import.meta.env.DEV pass should eliminate the gated SettingRow).
result: skipped
reason: "Structurally covered by app/tests/screens/SettingsDataScreen.force-new-day.test.mjs gates assertion. Defer prod-build verification to next round."

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]
