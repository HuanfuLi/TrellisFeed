___
status: pending
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
parent: 36-UAT.md
started: 2026-05-06
___

## Retest Tests

### Test 1 (GAP-A retest — cold-start warm-start preserved)

**Setup**: Have the app open with a populated post queue from a prior session (yesterday's posts
in localStorage key `echolearn_post_queue` with `date` field set to yesterday's date — to simulate
this in dev tools, manually edit the date field to one day in the past).

**Reproduction steps**:
1. Close the app fully (kill the tab/process).
2. Edit the `echolearn_post_queue` localStorage entry to set `date` to yesterday's date.
3. Re-open the app on the home screen (`/home`).
4. Observe the feed within the first 2 seconds of load.

**Expected after GAP-A fix**:
- Yesterday's leftover posts (up to 8) appear immediately on screen — the warm-start populates from
  `postQueueService.getYesterdayQueue()` via the useState initializer at HomeScreen.tsx:38-47.
- The feed does NOT flicker to empty + back, even when `getDailyPosts()` resolves with [] from the
  cold-start path 200ms later.
- The "Couldn't generate posts / Check your API keys in Settings" error UI does NOT appear.
- After ~8 seconds, the delayed `refreshFeed()` (HomeScreen.tsx:127-129) replaces the warm-start
  posts with today's freshly-generated batch from the now-populated queue.

**Failure mode (GAP-A active, pre-fix)**:
- Feed briefly shows yesterday's posts, then flickers to empty + AlertCircle + "Check your API keys"
  message ~200ms after mount.
- Stays empty until the user manually navigates away and back, OR the 8-second delayed refresh
  fires.

**Pass criteria**: Steps 1-4 produce only the expected behavior; no flicker; no error UI.

### Test 3 (GAP-C retest — video completion signal)

**Setup**: Have ≥1 video post in the home feed (sourceType==='video', not 'short'). Open one
of the questions whose anchor is the video's source — verify it's NOT yet in
`localStorage.echolearn_daily_read.exploredAnchors`.

**Reproduction steps for Detector D (full-length video)**:
1. Tap a video post card from the home feed → PostDetailScreen opens.
2. Press play on the YouTube iframe.
3. Watch ≥80% of the video OR let it finish to ENDED.
4. Open browser devtools console (or Capacitor LiveReload remote console on device).
5. Observe.

**Expected after GAP-C fix**:
- DevTools Application → Local Storage → `echolearn_daily_read` → `exploredAnchors` array now
  contains the video's resolved anchor ID.
- Returning to home feed: VineProgress chip increments by 1.
- Subsequent refill cycles do NOT generate new posts for this anchor (lazy-skip in walkDerivedList).
- No console errors about cross-origin postMessage.

**Reproduction steps for short tap-to-play emit**:
1. Find a short post in the home feed (presentationStyle==='short' / sourceType==='short').
2. Tap the play button (thumbnail tap).
3. Open browser devtools console.

**Expected after GAP-C fix**:
- Tap-to-play swaps thumbnail for the YouTube iframe AND fires `CONCEPT_EXPLORED` immediately.
- DevTools Application → Local Storage → `echolearn_daily_read` → `exploredAnchors` contains the
  short's resolved anchor ID after the tap.
- VineProgress chip increments by 1 on next home-feed render.
- Subsequent refill cycles do NOT generate new posts for this anchor.

**Failure mode (GAP-C active, pre-fix)**:
- Watching the video to completion → `exploredAnchors` is unchanged. VineProgress does not
  increment. Walker continues to re-suggest the same anchor on swipe-for-more.
- Tapping a short to play → no signal at all. Same blind-spot symptoms.

### Test 2 (GAP-B retest — text-art ≥ floor(N×0.55) at N=16, OPTIONAL — primary verification is automated)

**Setup**: Single non-important anchor in localStorage (one Q&A → one anchor → derivedList.length=4
after first refill).

**Reproduction steps**:
1. Open home feed; trigger refillQueue (swipe-for-more once → triggers refill).
2. Continue swiping until 16+ posts have been served from the queue across one or two refill
   cycles.
3. Count the number of posts where presentationStyle === 'text-art' (visible as text-only cards
   with a colored background and Georgia / Courier / Palatino / etc. font).

**Expected after GAP-B fix**:
- text-art count >= 8 out of any 16 served (floor(16 × 0.55)). Pre-fix observed: ~4.
- News + video + short combined are ≤ ~6 (≈ 3 × 0.10 × 16 = ~5; ±1 stratification slack).

**Primary verification**: `cd app && node --test tests/services/refill-queue-integration.test.mjs`
asserts this in code (Test 7); manual check is for operator confidence, not gating.

**Failure mode (GAP-B active, pre-fix)**: text-art count = 4 across 16 posts (50%). News/video/
short combined dominate at ~67% of posts (~10 out of 16).
