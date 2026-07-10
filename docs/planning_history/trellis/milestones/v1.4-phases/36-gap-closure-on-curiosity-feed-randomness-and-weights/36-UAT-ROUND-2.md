---
status: complete
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-06-SUMMARY.md, 36-07-SUMMARY.md, 36-08-SUMMARY.md, 36-UAT-RETEST.md]
round: 2
started: 2026-05-06T18:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold-start warm-start preserved (GAP-A retest)
expected: |
  Re-opening the app on a new day with a populated yesterday queue: warm-start
  posts appear immediately, no empty-flicker, no "Check your API keys" error
  UI. After ~8s the delayed refresh replaces them with today's freshly-generated
  batch.
result: issue
reported: "It's in the new day but the app is not showing cold start? Also, should add a dev feature in Settings page to force a new day so that we can debug this without actually waiting for a new day."
severity: major

### 2. Video completion signal — full-length (GAP-C retest, Detector D)
expected: |
  Tap a video post in the home feed → PostDetailScreen opens with YouTube
  iframe. Press play, watch ≥80% of the video OR let it run to ENDED. After
  completion: DevTools → Application → Local Storage → `echolearn_daily_read`
  → `exploredAnchors` contains the video's anchor ID. Returning to home feed:
  VineProgress chip increments by 1. Subsequent refill cycles do NOT generate
  new posts for this anchor (lazy-skip). No console errors about cross-origin
  postMessage.
result: pass
note: "User observed counting fires on play start (in both short and full-length video posts). User stated preference: 'just count if user enter it' — simpler count-on-enter semantics suffice; the 80% threshold is over-engineered for the desired UX. Detector D's ENDED/heartbeat path may be simplified in a follow-up if drift surfaces (e.g., people opening but not playing). Not changing now: existing Detector D + Detector B (30s dwell) collectively achieve the desired 'counts when user engages' outcome that the user is happy with."

### 3. Short tap-to-play emit (GAP-C retest, InfoFlow)
expected: |
  Find a short post in the home feed (presentationStyle === 'short'). Tap the
  thumbnail to play. The thumbnail swaps for the YouTube iframe AND fires
  CONCEPT_EXPLORED immediately. DevTools → Application → Local Storage →
  `echolearn_daily_read` → `exploredAnchors` contains the short's anchor ID
  after the tap. VineProgress chip increments by 1 on next home-feed render.
  Subsequent refill cycles do NOT generate new posts for this anchor.
result: pass
note: "Confirmed pass via Test 2 response — user observed 'progress bar already counts upon video start playing in both short and normal video post'. Tap-to-play emit on shorts works as designed."

### 4. Style-mix balance — text-art ≥ 8 of 16 (GAP-B retest, OPTIONAL)
expected: |
  Single non-important anchor in localStorage (one Q&A → one anchor →
  derivedList.length=4). Open home feed, swipe-for-more until 16+ posts
  served across 1-2 refill cycles. Count text-art posts (text-only cards
  with colored background and Georgia / Courier / Palatino / serif font).
  text-art count ≥ 8 of any 16 served (floor(16 × 0.55)). News + video +
  short combined are ≤ ~6 (≈ 3 × 0.10 × 16 + slack).

  Primary verification is automated (Test 7 in refill-queue-integration.test.mjs);
  this manual recount is for operator confidence — pass via "skip" if you
  trust the automated test.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "On a new day, the cold-start path serves yesterday's leftover posts immediately via getYesterdayQueue(), with no empty-flicker and no 'Check your API keys' error UI."
  status: resolved
  reason: "User reported: 'It's in the new day but the app is not showing cold start? Also, should add a dev feature in Settings page to force a new day so that we can debug this without actually waiting for a new day.'"
  severity: major
  test: 1
  root_cause: "post-queue.service.ts:221-231 getYesterdayQueue() reads from the SAME localStorage key (echolearn_post_queue) that the live queue uses. The function returns parsed.posts only when parsed.date !== today(). On cold-start of a new day this works ONCE — module-init's load() sees the date mismatch and returns freshState() in-memory without calling save(), so localStorage still holds yesterday's payload when HomeScreen's useState initializer runs. But the very first save() of the new day (triggered by enqueue/markServed/appendToDerivedList/etc., usually within the first refillQueue cycle the useEffect kicks off) writes {date: today, ...} to localStorage and PERMANENTLY destroys yesterday's snapshot. From that moment forward, getYesterdayQueue() returns [] because parsed.date === today() matches. If the user closes and re-opens the app a second time on the same new day, the warm-start path renders empty. The 'recovery' the user observed during Test 2 was actually the 8-second delayed refreshFeed() (HomeScreen.tsx:159-161) populating today's queue from the now-completed refillQueue — not warm-start working, just today's content arriving on the natural async timer. Plan 36-06's HomeScreen.warm-start-guard.test.mjs (4/4 GREEN) verified the React-side guards correctly but assumed getYesterdayQueue() would reliably return yesterday's posts — which is single-shot, not durable."
  phase_36_regression: false
  artifacts:
    - path: app/src/services/post-queue.service.ts
      lines: 221-231
      issue: "getYesterdayQueue() reads from the same key as the live queue, so the first save() of the new day overwrites yesterday's snapshot"
    - path: app/src/services/post-queue.service.ts
      lines: 50-76
      issue: "load()'s date-mismatch branch returns freshState() but does NOT snapshot yesterday's payload to a separate key first"
    - path: app/src/screens/HomeScreen.tsx
      lines: 38-47
      issue: "useState initializer correctly calls getYesterdayQueue() but its result is non-deterministic across multiple mounts of the same new day (single-shot semantics from upstream)"
  missing:
    - "Fix A (durable yesterday snapshot): in post-queue.service.ts load(), when date-mismatch detected and parsed.posts.length > 0, copy {date, posts} to a NEW localStorage key (echolearn_post_queue_yesterday) BEFORE returning freshState(). Update getYesterdayQueue() to read from that key. Idempotent across multiple cold-start mounts."
    - "Fix B (dev affordance): add a 'Force new day' button to Settings > Data screen (or dev-only section) that mutates localStorage.echolearn_post_queue.date to yesterday's date, calls postQueueService.loadQueue() to reload in-memory state, and optionally navigates to /home. Gated behind import.meta.env.DEV so it doesn't ship in production. Enables deterministic GAP-A verification without waiting for midnight."
    - "Source-reading regression test: assert post-queue.service.ts load() writes to STORAGE_KEY_YESTERDAY when date mismatch + non-empty posts; assert getYesterdayQueue() reads from STORAGE_KEY_YESTERDAY and is independent of subsequent save() calls."
  debug_session: .planning/debug/cold-start-warm-start-fragile.md
