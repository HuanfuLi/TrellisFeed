---
status: resolved
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-00-SUMMARY.md, 36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md, 36-06-SUMMARY.md, 36-07-SUMMARY.md, 36-08-SUMMARY.md]
started: 2026-05-06T08:30:00Z
updated: 2026-05-06T17:45:00Z
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
  status: resolved
  reason: "User reported: 'In the first start of a new day, the feed is empty and shows logs like \"error generating post, please check your settings.\" In design, the cold start of a new day should use persisted queue before last time user exit app, but it actually failed to comply to design.'"
  severity: blocker
  test: 1
  root_cause: "HomeScreen.tsx warm-start vs. error-gate conflict. The useState initializer at lines 38-47 correctly wires getYesterdayQueue() and seeds dailyPosts with up to 8 of yesterday's posts. The useEffect at lines 95-112 then calls getDailyPosts(questions), which BY DESIGN returns [] on a new day (today's queue/cache empty; refillQueue runs in background). The .then handler unconditionally calls setDailyPosts(posts=[]) — wiping the warm-start state — and immediately fires setGenerationError(true) at lines 102-104 because posts.length===0 && questions.length>0. The error-gate was added in commit 6cda914e (2026-04-18) for a different scenario (LLM/API key broken) and did not account for the normal cold-start [] return. Pre-existing drift from 2026-04-18; NOT a Phase 36 regression."
  debug_session: .planning/debug/cold-start-empty-feed.md
  phase_36_regression: false
  artifacts:
    - path: app/src/screens/HomeScreen.tsx
      lines: 98-104
      issue: useEffect's .then handler unconditionally setDailyPosts([]) + setGenerationError(true), wiping warm-start state and firing the misleading toast
    - path: app/src/services/concept-feed.service.ts
      lines: 1446-1462
      issue: getDailyPosts() returns [] on cold start by design, expecting caller to NOT overwrite warm-start state; that contract was broken by HomeScreen's unconditional setter
    - path: app/src/services/post-queue.service.ts
      lines: 194-204
      issue: getYesterdayQueue() IS wired (HomeScreen's useState initializer); not dead code as initially suspected
  missing:
    - Guard the useEffect setter at HomeScreen.tsx:100. Functional updater `setDailyPosts(prev => posts.length > 0 ? posts : prev)` preserves warm-start; or track a `hasWarmStartPosts` ref that suppresses both setDailyPosts and setGenerationError when current state already has yesterday's posts displayed.
    - Suppression rule for setGenerationError(true): only fire when getDailyPosts returns [] AND no warm-start fallback is present (yesterday queue + history both empty). The toast/log "error generating post, please check your settings" is appropriate for misconfigured settings, NOT for cold-start-while-refill-in-flight.

- truth: "Across the served window of ~16 posts, style counts approximate the stratified target: text-art ≈ 9 (round(16×0.55)), news/video/short ≈ 2 each (round(16×0.10) ±1), image ≈ 2 (round(16×0.10) ±1), suggestion ≈ 1 (round(16×0.05))."
  status: resolved
  reason: "User reported observed sequence 'video, news, short, news, short, news, video, news, text-art, short, text-art, suggestion, text-art, image, text-art, news' — counts text-art=4, news=5, short=3, video=2, image=1, suggestion=1. text-art is ~half expected; news/video/short combined are ~67% of posts vs. expected ~30%."
  severity: major
  test: 1
  root_cause: "post-queue.service.ts:301 walkDerivedList termination guard `maxSteps = len * 2` silently caps the returned batch at 2× derivedList.length entries, regardless of the `count` argument. With a single non-important anchor (derivedList.length=4 from BASE_ENTRIES_PER_CONCEPT), maxSteps=8, so walkDerivedList(16, ...) returns only 8. assignStyles then operates on N=8 instead of N=16. At N=8 the largest-remainder math pins text-art at its floor (4/8 = 50%) because text-art's remainder (0.40) loses to all four 10%-weight minority remainders (0.80) — text-art never wins a bonus slot. The N=16 walk request was deliberately sized to clear this threshold (at N=16 text-art's remainder 0.80 BEATS minority 0.60 → text-art = 9/16 = 56%). The cap defeats the design. NOT an issue in the largest-remainder math itself (Phase 36-01 is mathematically correct; 10/10 unit tests confirm). The defect is in Phase 36-03's walker termination guard."
  debug_session: .planning/debug/style-mix-imbalance.md
  phase_36_regression: true
  artifacts:
    - path: app/src/services/post-queue.service.ts
      lines: 301
      issue: "`const maxSteps = len * 2` caps walker output at len×2 regardless of requested count; truncates 16-request to 8-return when len=4"
    - path: app/src/services/concept-feed.service.ts
      lines: 1218
      issue: "walkDerivedList(16, exploredIds) caller assumes it can get 16 entries — assumption silently violated by the guard"
    - path: app/tests/services/refill-queue-integration.test.mjs
      lines: 79-95
      issue: "integration test only exercises walkDerivedList(2, ...) on a 4-entry list — count << maxSteps, so the truncation is untested"
  missing:
    - Decouple walkDerivedList's termination guard from derivedList.length. Replace `const maxSteps = len * 2` with either (a) `const maxSteps = Math.max(count * 2, len)` so the walker can scan up to twice the request size while still bounding against fully-explored lists, OR (b) the original RESEARCH pseudocode pattern using `fullLoops < 2` to allow up to 2 complete passes through the list regardless of count.
    - A new walker test asserting that `walkDerivedList(16, new Set())` on a 4-entry list returns 16 entries (4 wraps × 4 entries) — this is the assertion that would have caught the cap bug pre-merge.
    - An integration test that asserts text-art ≥ floor(N×0.55) for N=16 across a single refill cycle, not just per-batch.

- truth: "Watching a video post for a concept fires CONCEPT_EXPLORED — same as scroll-70% or 30s-dwell does for text/image posts. Vine progress increments and the walker lazy-skips that concept on subsequent refills."
  status: resolved
  reason: "User reported during Test 3: 'There is no signal of completion for video posts. When user watch a video, the progress did not count.' Lazy-skip itself works correctly for non-video post types (Test 3 main expectation passes); the gap is upstream — CONCEPT_EXPLORED never fires for video posts because the existing detectors at PostDetailScreen.tsx assume scroll content or 30s passive dwell, neither of which is a clean signal for video media."
  severity: major
  test: 3
  root_cause: "Two compounding architectural failures, neither caused by Phase 36. (1) Short posts (sourceType==='short') have ZERO signal paths: InfoFlow.tsx:295 sets `interactive = !isShortPost`, so onOpen() is never called and PostDetailScreen never mounts. Detectors A, B, C all live in PostDetailScreen — they cannot fire for shorts. The feed iframe at InfoFlow.tsx:439 is also opaque. (2) Full-length video posts have only Detector B (30s dwell) — but YouTubeEmbed.tsx:21 renders the iframe WITHOUT `enablejsapi=1`, so YouTube's IFrame Player API postMessage channel never opens. Even if a Detector D were added today, the player is an opaque wall. Detector A (scroll-70%) is structurally unreliable for video posts because the takeaway section is hidden (PostDetailScreen.tsx:782 sourceType !== 'video'), so the sentinel position depends on essay length + video height + viewport. Detector B fires only IF user stays 30s+, doesn't fire for users who watch a 20s short and leave. The Q&A 'Detector C' at line 409 only fires if user submits a follow-up question. NOT a Phase 36 regression — this is pre-existing drift since video presentation style was added (Phase 17/18 era)."
  debug_session: .planning/debug/video-completion-signal-missing.md
  phase_36_regression: false
  artifacts:
    - path: app/src/components/YouTubeEmbed.tsx
      lines: 21
      issue: "iframe src lacks `enablejsapi=1` query param — IFrame Player API channel is closed; postMessage events from YouTube never reach the parent page"
    - path: app/src/components/InfoFlow.tsx
      lines: 295
      issue: "`interactive = !isShortPost` blocks navigation to PostDetailScreen for short posts; ZERO signal paths exist for shorts"
    - path: app/src/components/InfoFlow.tsx
      lines: 439
      issue: "feed iframe also lacks `enablejsapi=1`; even inline detection is impossible"
    - path: app/src/screens/PostDetailScreen.tsx
      lines: 124-149
      issue: "Detector A (scroll-70%) and Detector B (30s dwell) are not reliable for video posts; B has the 30s race condition for short content; A measures scroll position not playback"
    - path: app/src/screens/PostDetailScreen.tsx
      lines: 589-601
      issue: "video render branch uses YouTubeEmbed (opaque iframe), not native video element with onEnded events"
  missing:
    - For 'video' posts (full-length): add `enablejsapi=1` to YouTubeEmbed.tsx iframe src, AND add a window 'message' event listener in PostDetailScreen that parses YouTube IFrame API postMessage payloads. Listen for `{event:'onStateChange', info:0}` (ENDED) and `{event:'infoDelivery', info:{currentTime, duration}}` (heartbeat) — fire emitExplored on ENDED OR when currentTime/duration ≥ 0.8. Trust origin `https://www.youtube.com` only.
    - For 'short' posts (feed-only, no detail screen navigation): the cleanest minimal fix is firing emitExplored when InfoFlow's setVideoPlaying(post.id) tap-to-play handler is invoked, resolving the anchor ID from post.sourceQuestionIds. Tap-to-play is a strong implicit signal for 5-15s clips.
    - Extend daily-read.test.mjs (or add a new postdetailscreen-detectors test) to assert: a video post that reaches an ENDED postMessage triggers markExplored; a short post that triggers setVideoPlaying triggers markExplored.
