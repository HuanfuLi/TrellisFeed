---
status: complete
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-00-SUMMARY.md, 36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md]
started: 2026-05-06T08:30:00Z
updated: 2026-05-06T09:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Feed variety across swipes (GAP-3 + GAP-4)
expected: |
  Open the app, scroll/swipe-for-more through ~20 posts. Across those 20:
  image / text-art / (news, video, short, suggestion if APIs configured)
  should each appear ≥1×. Same concept should not appear >1× in any 4
  consecutive posts when ≥2 anchors are due.
result: issue
reported: |
  1. On the first start of a new day, the feed is empty and shows logs like
     "error generating post, please check your settings." Per design, the cold
     start of a new day should use the persisted queue from before the user
     exited the app last time, but it actually failed to comply with design.
  2. The first few posts observed were: video, news, short video, news, short
     video, news, video, news, text-art, short video, text-art, recommendation,
     text-art, image, text-art, news. News and videos are too many and not
     well interleaved.
severity: blocker
issues:
  - Issue A (blocker): Cold start on new day → empty feed + "error generating
    post, please check your settings". Design intent (per user): cold start of
    a new day should serve from the persisted queue snapshot from yesterday
    BEFORE today's localStorage daily-reset overwrites it. Live behavior:
    post-queue.service.ts:load() returns freshState() on date mismatch and
    nothing in the codebase calls getYesterdayQueue() (which exists at lines
    194-204 but is unwired). Result: user-visible empty feed for the duration
    of the first refillQueue(), and the "error generating post" log surfaces
    a transient pre-fetch failure (likely YouTube/Tavily quota or network
    timeout during validation) that should not gate the visible feed.
  - Issue B (major): Style mix observed across 16 posts — counts: video=2,
    news=5, short=3, text-art=4, suggestion=1, image=1. Stratified expectation
    for N=16 with weights {image:0.10, text-art:0.55, suggestion:0.05,
    news:0.10, video:0.10, short:0.10}: text-art ≈ 9, news/video/short ≈ 2
    each, image ≈ 2, suggestion ≈ 1. Observed text-art is ~half the expected
    count; news/video/short combined are ~67% of posts when weights say
    they should be ~30%. Phase 36-01 stratified allocation should hold ±1
    per batch, but the cross-batch composition shows compounding drift —
    likely because each refill batch is small (4 posts per anchor with
    BASE_ENTRIES_PER_CONCEPT=4) and small-N stratification rounds down for
    minority styles before computing largest-remainder. Hypothesis to verify:
    refill batch size is too small for stratification to manifest at the
    served-window scale.

### 2. Cyclic walker — concept rotation across refills (GAP-1 + GAP-2)
expected: |
  Ask 3 different concept questions in Ask (e.g. "spaced repetition",
  "transformer architecture", "kanji radicals") to seed 3+ anchors. Wait
  for classification to complete, then go to home feed. Swipe-for-more
  past at least 2 refills (~16 posts). The walker should rotate through
  ALL three concepts — you should NOT see one concept dominate every refill.
  Each refill should mix concepts; cyclePosition should advance and wrap.
result: pass

### 3. Lazy-skip on concept read (GAP-2 lazy-skip + Phase 33 preservation)
expected: |
  With ≥2 anchors due, tap into a post for ONE concept (read it ≥30s OR
  scroll 70% to fire CONCEPT_EXPLORED). Return to feed and swipe-for-more.
  The feed should stop generating new posts for that concept (the walker
  lazy-skips entries whose conceptId is in the explored set). Posts for
  the OTHER concepts continue normally. Vine progress chip on home should
  reflect 1/N concepts read.
result: pass
notes: |
  Lazy-skip itself works as designed. User flagged an ADJACENT issue
  (recorded under Gaps as a separate entry, scoped to test 3): video posts
  do not have a completion-signal detector, so watching a video for a given
  concept never fires CONCEPT_EXPLORED — the lazy-skip would never engage
  if the user's only interaction with that concept was via video. The
  existing detectors at PostDetailScreen.tsx are scroll-70% (IntersectionObserver)
  and 30s-dwell, both of which assume scroll-content posts. Video posts
  have no scroll content and may be shorter than 30s.

### 4. localStorage migration safety (Plan 36-03 shim)
expected: |
  Open browser devtools → Application → Local Storage. Locate the
  echolearn_post_queue key. After first refill cycle of the day, the
  parsed JSON should now include the new fields: derivedList (a string[]
  of concept anchor ids) AND cyclePosition (a number, starting at 0).
  Existing users (who had echolearn_post_queue from before Phase 36)
  should NOT see any console errors about undefined derivedList or
  cyclePosition; the migration shim defaults missing fields cleanly.
  No "Cannot read properties of undefined" red errors in console at
  app load.
result: pass

### 5. No regression in image pre-gen + downgrade (Phase 31 invariant)
expected: |
  With image-generation API key configured (Gemini OR nanoBanana, +
  imageGeneration.enabled=true in settings), trigger a feed refill
  (swipe-for-more). Devtools console should show one
  "[refillQueue] pre-generating N image(s) before enqueue" line per cycle.
  When the queue serves an image-style post, the image should be ALREADY
  present (no late-loading-then-fallback-to-text-art flicker in InfoFlow).
  If image gen fails, the post's presentationStyle is downgraded to
  text-art BEFORE enqueue (you should see a "[refillQueue] downgraded
  K/N image post(s) to text-art after pre-gen failure" log) — so the
  user never sees a broken image card.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Cold start of a new day serves the user from the persisted queue snapshot taken before the previous app exit, NOT an empty feed. Pre-fetch validation transient errors must not gate the visible feed."
  status: failed
  reason: "User reported: 'In the first start of a new day, the feed is empty and shows logs like \"error generating post, please check your settings.\" In design, the cold start of a new day should use persisted queue before last time user exit app, but it actually failed to comply to design.'"
  severity: blocker
  test: 1
  artifacts:
    - app/src/services/post-queue.service.ts:36-49   # load() resets to freshState on date mismatch
    - app/src/services/post-queue.service.ts:194-204 # getYesterdayQueue() exists but is unwired
    - app/src/services/concept-feed.service.ts:1234-1442 # refillQueue triggers pre-fetch validation that surfaces errors
  missing:
    - Cold-start warm-up step that reads getYesterdayQueue() and seeds today's queue with up to N (e.g., 8 or REFILL_THRESHOLD) yesterday-leftover posts BEFORE the first refillQueue runs.
    - Toast/error suppression rule for "error generating post, please check your settings" — the message is appropriate for a settings-misconfigured user but inappropriate for a transient pre-fetch failure where the system has fallback paths (text-art redistribution, runtime availability circuit breakers).

- truth: "Across the served window of ~16 posts, style counts approximate the stratified target: text-art ≈ 9 (round(16×0.55)), news/video/short ≈ 2 each (round(16×0.10) ±1), image ≈ 2 (round(16×0.10) ±1), suggestion ≈ 1 (round(16×0.05))."
  status: failed
  reason: "User reported observed sequence 'video, news, short, news, short, news, video, news, text-art, short, text-art, suggestion, text-art, image, text-art, news' — counts text-art=4, news=5, short=3, video=2, image=1, suggestion=1. text-art is ~half expected; news/video/short combined are ~67% of posts vs. expected ~30%."
  severity: major
  test: 1
  artifacts:
    - app/src/services/style-assignment.ts:64-103   # largest-remainder allocator (closes GAP-3)
    - app/src/services/concept-feed.service.ts:792  # BASE_ENTRIES_PER_CONCEPT = 4 (refill batch size driver)
    - app/src/services/concept-feed.service.ts:1300 # assignStyles call site in refillQueue
  missing:
    - Investigation of effective refill batch size — if user has 1-2 anchors, each refill is 4-8 entries and per-batch stratification rounds down minority styles before largest-remainder. Across 4 small batches the variance compounds AGAINST the dominant style (text-art 55% rounds DOWN to 2 in N=4 batches, so 4 batches × 2 = 8 instead of expected 9 — close but the underlying bug may be that text-art is rounding down to 1 or 0 in some batches when all 6 styles compete for 4 slots).
    - A "minimum batch size" floor in refillQueue so stratification operates on N≥8 (or similar) per refill cycle.
    - Verification that API-availability redistribution at style-assignment.ts:48-62 is firing correctly when the user reports having all 6 providers configured (the observed mix has both video AND short AND news AND image AND suggestion — none is zeroed out — yet text-art is severely under-weighted). Possibly a bug in the largest-remainder math that doesn't honor the dominant-weight bias correctly.

- truth: "Watching a video post for a concept fires CONCEPT_EXPLORED — same as scroll-70% or 30s-dwell does for text/image posts. Vine progress increments and the walker lazy-skips that concept on subsequent refills."
  status: failed
  reason: "User reported during Test 3: 'There is no signal of completion for video posts. When user watch a video, the progress did not count.' Lazy-skip itself works correctly for non-video post types (Test 3 main expectation passes); the gap is upstream — CONCEPT_EXPLORED never fires for video posts because the existing detectors at PostDetailScreen.tsx assume scroll content (Detector A: scroll-70% IntersectionObserver) or 30s passive dwell (Detector B), neither of which is a clean signal for video media."
  severity: major
  test: 3
  artifacts:
    - app/src/screens/PostDetailScreen.tsx:115-122 # emitExplored helper (idempotent)
    - app/src/screens/PostDetailScreen.tsx:124-137 # Detector A — scroll 70% sentinel via IntersectionObserver
    - app/src/screens/PostDetailScreen.tsx:139+    # Detector B — 30s dwell timer (passive)
  missing:
    - Detector C — video-completion signal. When the embedded video player reports playback ≥80% of duration OR the 'ended' event fires, call emitExplored(resolvedAnchorId). For YouTube-embedded videos this requires either the YouTube IFrame API postMessage hook (preferred) or a heuristic based on visibility + elapsed-vs-duration tracking.
    - Optional refinement for short/Reels-style videos (which are typically <60s and may be watched fully in less time than the 30s dwell threshold): Detector D — 'tap to play' + 'ended' should also count, since a short video viewed end-to-end is a stronger signal than 70% scroll on a text post.
