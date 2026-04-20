---
status: testing
phase: 33-phase-29-regression-and-phase-31-code-hygiene
source:
  - 33-03-SUMMARY.md
  - 33-05-SUMMARY.md
  - 33-06-SUMMARY.md
  - 33-07-SUMMARY.md
started: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:00:00Z
---

## Current Test

number: 7
name: New-branch cluster and anchor names are meaningful (Bug 8/9)
expected: |
  When asking a question that creates a NEW branch + cluster + anchor, the cluster name is
  meaningful (not "{branchName} fundamentals") and the anchor name is a clean concept noun
  phrase (not a raw question paraphrase like "What is spaced repetition?").
awaiting: user response

## Tests

### 1. Trellis columns display after LeafState rename
expected: On PlannerScreen, the trellis panel still shows "Dying | Fruit | Dead" columns. Leaves that were previously yellow/fallen appear correctly under Dying and Dead. No console errors about undefined leaf states.
result: pass

### 2. Swipe-for-more delivers fresh posts (Bug A)
expected: On HomeScreen, swiping for more delivers 4 fresh posts per swipe (not 1 stale post then "No more posts"). Cycle-stamped IDs prevent dedup loss across refill cycles.
result: issue
reported: "Still failed to show more posts. The vine progress is not finished, but when I swipe for more, it shows 'No more post to generate today'. Probably be the counting mechanism bug."
severity: major

### 3. Video and short cards play real videos (Bug C)
expected: Video posts and shorts render real, playable YouTube thumbnails. No posts show channel/playlist placeholders with missing thumbnails or failed plays.
result: issue
reported: "When I click on one video post to start playback, 2 videos started playing at the same time. Implementation gap: I designed the video post to stop playing if user scroll away, both vertically scrolling in feed and horizontally scrolling (including clicking bottom nav bar) to navigate to other pages. However it seems only horizontal scrolling is subscribed."
severity: major

### 4. No empty cards with massive padding (Bug D)
expected: Every post in the feed renders visible content (image, video thumbnail, news article, or text-art). No blank cards. Any fallback-to-text-art surfaces are logged (dev-mode console.warn) but user still sees content.
result: issue
reported: "When I configured Gemini API key for image gen in settings, swipe-for-more does not pop 4 prepared posts directly — it keeps the user waiting with 'Loading more posts'. Even after waiting, no image posts appear (all text-art/news/video, quota has reset). Removing the Gemini key restores instant-pop behavior. News/video/text-art posts have no blank cards — only image gen is broken."
severity: major

### 5. Different videos across swipe cycles (Bug 6)
expected: Over multiple swipe-for-more cycles for the same concept, video posts show DIFFERENT videos — not the same 3 videos repeating. Query modifier rotates per cycle and the pool widened from 3 to 15 candidates.
result: pass

### 6. VineProgress spans full container width (Bug 7)
expected: The vine progress bar on HomeScreen spans the full container width. Flowers are distributed evenly along the vine (not clustered on the left). The bar resizes cleanly when the container width changes.
result: pass

### 7. New-branch cluster and anchor names are meaningful (Bug 8/9)
expected: When asking a question that creates a NEW branch + cluster + anchor, the cluster name is meaningful (not "{branchName} fundamentals") and the anchor name is a clean concept noun phrase (not a raw question paraphrase like "What is spaced repetition?").
result: issue
reported: "Now new questions ALWAYS create a new branch with new cluster and new concept anchor, even though the end concept anchors are almost identical. This may be either design flaw or implementation gap." Device screenshot (2026-04-20) showed 6 branches for 6 Q&As with a 1:1 ratio AND twin "Spaced Repetition" anchors under two different branches (Cognitive Science / Learning Theory AND Educational Technology / Memory Enhancement).
severity: major

### 8. Session-post concept badges match session anchors (Bug 10)
expected: Posts generated from an Ask chat session have concept badges that match the session's anchors. Round-robin fallback fills in provenance when the LLM omits it, so badges are consistent with daily-path posts.
result: [pending]

### 9. Cross-session video dedup (Bug 14)
expected: After viewing a video and closing/reopening the app (or starting a new session), previously-seen videos do NOT reappear in video posts — within the per-day cutoff window. seenVideoIds backfills from echolearn_post_history localStorage on first access.
result: [pending]

### 10. SuggestionCard visual consistency
expected: Suggestion cards in the feed have gradient background + 1.5px border + shadow-2 elevation. Visually consistent with concept-post cards (no flat-looking cards among gradient ones).
result: [pending]

### 11. Perf memoization preserves behavior
expected: Home feed still renders 8 cards. Swipe-for-more pops 4 posts and the queue refills toward 8. Settings → Features → Image generation toggle still gates image generation for NEW card mounts. No new "empty card with massive padding" symptoms.
result: [pending]

### 12. PlannerScreen touch targets + spacing tokens
expected: On PlannerScreen, the refresh button has a comfortable 44x44 tap target (no longer tight 28x28). Icon is still legible. EmptySectionHint and show-all/show-less buttons have slightly tighter padding (12px/8px vertical) that aligns to the token grid without visible layout breaks.
result: [pending]

### 13. ChatInput touch targets + shadow
expected: On AskScreen, the ChatInput's mic and globe buttons have comfortable 44x44 tap targets (no longer tight 34x34). Icons (size=17) sit comfortably inside. The ChatInput container shadow matches the app's unified elevation-2 tier — consistent with other cards.
result: [pending]

### 14. AskScreen bottom-nav clearance preserved
expected: After the ChatInput height grew ~10px (mic+globe bump), the bottom navigation bar still has clearance above the ChatInput on AskScreen — no overlap. Tapping nav tabs and the ChatInput both work without the other intercepting taps.
result: [pending]

## Summary

total: 14
passed: 3
issues: 2
partial: 1
pending: 7
skipped: 0
blocked: 0

## Gaps

- truth: "Swipe-for-more delivers 4 fresh posts per swipe even when VineProgress shows concepts still unexplored"
  status: fixed
  reason: "User reported: Still failed to show more posts. The vine progress is not finished, but when I swipe for more, it shows 'No more post to generate today'. Probably be the counting mechanism bug."
  severity: major
  test: 2
  root_cause: |
    concept-feed.service.ts:1000 gated refillQueue unconditionally on `totalGenerated >= maxPosts`.
    The cap counted ALL posts pushed onto the queue today (feed supply) while VineProgress counts
    distinct exploredAnchors (user progress). The two counters drifted apart whenever the user
    swiped through posts without opening them, so the cap fired while buildConceptBatch still had
    unexplored anchors. The bypass path (buildConceptBatch returning []) could never execute.
  artifacts:
    - path: "app/src/services/concept-feed.service.ts"
      issue: "Unconditional cap at line 1000 fired before vine finished"
    - path: "app/src/services/post-queue.service.ts"
      issue: "totalGenerated counter (line 69) tracks supply, not user progress — mismatch with VineProgress exploredAnchors"
  missing:
    - "Gate the cap on allExplored so it only applies during bonus-post mode"
    - "Preserve max(anchors.length, 3) floor (D-38 + Phase 32.1-02 fix) for when gate does fire"
    - "Document the OSS/user-keys rationale inline and in CLAUDE.md"
  fix_commit: "003b8e32"
  fix_approach: |
    Option B from root-cause report: bypass the cap until allExplored. Once the vine is finished,
    the bonus-post regime takes over (bonusCap in generateMorePosts) and the daily cap becomes a
    meaningful safety rail. Before that, generation is bounded solely by buildConceptBatch
    returning [] when all anchors are explored (the CLAUDE.md 3-list pipeline spec).
    EchoLearn is local-first OSS with user-provided keys, so unbounded pre-finished generation
    is not a cost concern for this version.
  secondary_issues_flagged:
    - "concept-feed.service.ts:1250 bonusCap comparison `totalServed >= totalGenerated + bonusCap` appears inverted (totalServed can never exceed totalGenerated). Effectively dead code — not fixed in this change per scope discipline."
  debug_session: ""

- truth: "Clicking a video post plays only the destination iframe (not feed + detail simultaneously); video stops when scrolled out of viewport"
  status: fixed
  reason: "User reported: When I click on one video post to start playback, 2 videos started playing at the same time. Implementation gap: I designed the video post to stop playing if user scroll away, both vertically scrolling in feed and horizontally scrolling (including clicking bottom nav bar) to navigate to other pages. However it seems only horizontal scrolling is subscribed."
  severity: major
  test: 3
  root_cause: |
    Bug 1 (two iframes): InlineInfoFlow.useEffect at InfoFlow.tsx:993 subscribes only to
    document.hidden and swipeProgress. Opening PostDetailScreen via navigate('/posts/:id')
    mounts the detail screen as an Outlet overlay at zIndex 50 above the always-mounted
    swipe strip — HomeScreen stays mounted beneath, its videoPlaying state preserved, its
    iframe still playing. PostDetailScreen renders its own YouTubeEmbed iframe on top.
    Two iframes, two audio streams.

    Bug 2 (scroll-away): Same useEffect never subscribed to scroll or intersection events,
    so scrolling past a playing card kept the iframe in the DOM and audible.
  artifacts:
    - path: "app/src/components/InfoFlow.tsx"
      issue: "InlineInfoFlow missing useLocation + IntersectionObserver subscriptions for stop-video"
    - path: "app/src/screens/PostDetailScreen.tsx"
      issue: "Correctly renders its own YouTubeEmbed at line 591 — not the source of the bug but the victim's second iframe"
  missing:
    - "useLocation subscription in InlineInfoFlow to stop video on intra-app pathname change away from /home"
    - "IntersectionObserver subscription scoped to the currently-playing card via data-feed-id, with fullscreen guard"
  fix_commit: "4061bdf3, 3e4798b3, 66d126a5, c5debbb7, e388efe8"
  fix_approach: |
    First attempt (partial — subscriptions only) committed 2026-04-19:
    1. 4061bdf3 — useLocation hook for intra-app navigation
    2. 3e4798b3 — IntersectionObserver for scroll-away

    Root-cause finding (2026-04-20): the fix-attempt above addressed scroll/nav
    gaps but not the actual "two simultaneous videos" cause, which turned out
    to be post.id collision. Two layers shipped under user directive to use
    a truly collision-free scheme:

    3. 66d126a5 — refactor(concept-feed): replace deterministic IDs with
       UUID-suffixed scheme. makePostId(date, kind, conceptId) suffixes
       crypto.randomUUID() for cryptographic-level uniqueness. Replaces 4
       call sites (text/video/short/news). Deletes obsolete cycleStamp
       + indexOffset plumbing (dead under new scheme).
    4. c5debbb7 — fix(post-queue): dedup incoming batch at enqueue. The prior
       filter only rejected duplicates against existing queue items, not
       within the incoming array. Defense-in-depth invariant now structural.
    5. e388efe8 — test(post-queue): 5-test regression suite locking the
       uniqueness invariant in place.

    The user's instinct was correct: batch-local disambiguation isn't
    enough because text-post IDs had their own cross-batch failure mode
    (indexOffset resetting with cache trim) and cycleStamp is only as
    monotonic as localStorage-backed state. UUID-suffixed IDs eliminate
    all state-dependent failure modes at once.
  secondary_issues_flagged:
    - "ImmersiveInfoFlow at InfoFlow.tsx:800-804 uses the same videoPlaying pattern but has NO visibilitychange or swipeProgress subscriptions. If immersive mode ever adds videos, neither horizontal NOR vertical stop would work. Defer to v1.5 — currently no video paths render through ImmersiveInfoFlow."
    - "Mode B 'No more posts' loop (generation silently fails, queue stays empty, toast fires while vine unfinished) — NOT caused by cap bypass but separate from the original Mode A fix. Current mitigation: api-availability circuit breaker (0ff4c5bd) stops burning API calls once quota is out; subsequent refills gracefully fall back to text-art. Loop still exists if LLM itself fails but is less expensive. Deferred."
  debug_session: ""

- truth: "Video/news posts generate on device without exhausting YouTube/Tavily daily quota"
  status: fixed
  reason: "User reported (after UUID fix): No video or news posts — only text-art. Logs show YouTube 403 quotaExceeded. Root cause: cap-bypass (003b8e32) enabled unbounded refill cycles; each cycle issued 2× YouTube calls per assignment (pre-validation + actual fetch, same query) — 200 units per video/short assignment burned the 10k-unit daily quota in ~10 cycles."
  severity: major
  test: 3
  root_cause: |
    1. Double-call pattern: pre-validation (maxResults=1, 100 units) + actual
       fetch (maxResults=15, 100 units) used the same query but didn't share
       results. 2× the quota burn per assignment.
    2. No runtime circuit breaker: once YouTube started returning 403
       quotaExceeded, subsequent refills kept re-calling the same dead API,
       compounding the burn.
    3. Cap bypass (003b8e32) removed the implicit ~2-cycle protection; the
       cap wasn't the cause but previously limited total damage.
  artifacts:
    - path: "app/src/services/concept-feed.service.ts"
      issue: "refillQueue pre-validation issued redundant YouTube/Tavily searches"
    - path: "app/src/services/youtube.service.ts"
      issue: "YouTubeSearchResult type was not exported — blocked cache typing in consumer"
  missing:
    - "Per-refill cache to eliminate duplicate YouTube/Tavily calls"
    - "Runtime availability tracker to stop calling APIs once quota is exhausted"
    - "Regression tests for the circuit breaker lifecycle"
  fix_commit: "05b5ca6e, 0ff4c5bd, 6d16c2b7"
  fix_approach: |
    Three atomic commits, no revert of cap bypass:

    1. 05b5ca6e — perf(concept-feed): cache pre-validation result to eliminate
       double YouTube/Tavily calls. Introduced PreFetchCache interface.
       Pre-validation now fetches at full pool size and stores; generation
       loops read from cache. Halves API calls per cycle (200 → 100 units
       per video/short assignment).

    2. 0ff4c5bd — feat(api-availability): circuit breaker module.
       markYoutubeQuotaExhausted / markTavilyQuotaExhausted flip session-
       scoped flags that persist in localStorage, reset on date rollover.
       refillQueue's availability check now honors both key-presence AND
       runtime-available. Pre-validation error handlers detect
       API_QUOTA_EXCEEDED / 403 and flip the flag. Existing assignStyles
       auto-redirects to text-art when a flag is off — zero new API calls
       for the rest of the day.

    3. 6d16c2b7 — test(api-availability): 7-test suite for the flag
       lifecycle (initial state, flip, independence, persistence, date
       rollover, idempotence). Plus a post-essay test window bump
       (2000→2500 chars) triggered by Layer 1's cache indirection moving
       the `snippet:` assertion past the prior scan window. Not a
       behavior regression — verified snippet still populated correctly.

    Combined effect:
    - Before burn: 50% fewer YouTube calls per cycle (doubles effective
      daily quota at 10k units).
    - After burn starts: first 403 flips circuit breaker; subsequent
      cycles skip YouTube entirely; user sees text-art fallback.
    - Cap bypass (003b8e32) retained — OSS + user keys + user exploration
      is the design-correct terminator.
  secondary_issues_flagged:
    - "Re-investigation of 'No more posts' confirms: 003b8e32 genuinely fixed Mode A (premature cap firing). Mode B (all generation paths fail → empty enqueue → loop) still exists but is now mitigated by the circuit breaker (no more unbounded retries on dead APIs). Full Mode B fix would require surfacing a distinct toast when generation fails vs. when derived list is empty. Deferred."
  debug_session: ""

- truth: "Image-style posts render when a Gemini OR NanoBanana image key is configured; swipe-for-more pops 4 posts instantly"
  status: fixed
  reason: "User reported (test 4): configuring Gemini image key made swipe-for-more stall on 'Loading more posts' (no instant 4 pop) AND produced zero image posts (all text-art/news/video). Removing the key restored instant-pop. News/video/text-art have no blank cards."
  severity: major
  test: 4
  root_cause: |
    Bug X1 — nanoBanana-only gate: concept-feed.service.ts:1101 and :1567
    computed hasImageGenKey solely from nanoBananaApiKey, ignoring
    geminiApiKey. The image-gen bootstrap registers the Gemini provider
    when only geminiApiKey is set, so image generation IS possible —
    but assignStyles saw hasImageGenKey: false and redistributed all
    10% image weight to text-art. Result: zero image posts assigned
    despite a functional key.

    Bug X2 — unfiltered pre-gen: HomeScreen.handleLoad's swipe handler
    awaited Promise.allSettled over imageGenerationService.generateImage
    for ALL 4 new posts regardless of presentationStyle. With a real
    Gemini/NanoBanana key, each provider call takes seconds; only the
    image-style post (if any) would use the result. The wait-then-
    discard was the 'Loading more posts' stall. Without any key, the
    provider short-circuits fast — explaining why removing the key
    restored instant pop.
  artifacts:
    - path: "app/src/services/concept-feed.service.ts"
      issue: "hasImageGenKey checked only nanoBananaApiKey (refillQueue + sessionAssignments paths)"
    - path: "app/src/screens/HomeScreen.tsx"
      issue: "handleLoad pre-generated images for every post, not just image-style ones"
  missing:
    - "hasImageGenKey must OR nanoBananaApiKey and geminiApiKey — mirroring the bootstrap that treats either as sufficient"
    - "HomeScreen pre-gen must filter newPosts by presentationStyle === 'image' before awaiting generateImage"
  fix_commit: "1e7193be"
  fix_approach: |
    Two fixes + 3 regression tests in one commit:
    1. concept-feed.service.ts at both availability sites (lines ~1101,
       ~1567): hasImageGenKey = nanoBananaKeyPresent || geminiImageKeyPresent.
    2. HomeScreen.tsx handleLoad: filter newPosts by presentationStyle ===
       'image', guard the provider import + Promise.allSettled on
       imagePosts.length > 0. Non-image posts never trigger provider calls.
    3. Tests: image-gen-key-gate.test.mjs (2 source-reading asserts for
       both availability sites), HomeScreen.image-pregen-filter.test.mjs
       (1 source-reading assert for filter + guard + loop iterable).
  secondary_issues_flagged:
    - "Pre-existing CapacitorSQLite init bug surfaced in device console ('getConnection is not implemented on android' + 'this.db.run is not a function'). Root cause: db.service.ts called CapacitorSQLite.getConnection which is not a plugin method — correct API is the SQLiteConnection wrapper (isConnection/retrieveConnection/createConnection). Fixed in the same UAT session as a Phase 33 add-on (commit 30319098) since Android data persistence was broken for question/planner/graph services."
  debug_session: ""

- truth: "AskScreen ChatInput layout stable: Send button always visible; opening keyboard does not deform the screen"
  status: partial
  reason: "User reported (two device-only bugs during test 4): (1) Send button drifted off-screen in the ChatInput island, only a sliver visible; (2) tapping ChatInput opened the system keyboard and the entire Ask screen zoomed/deformed, did not recover on keyboard close, only recovered after navigating to another tab and back."
  severity: major
  test: 4
  root_cause: |
    Bug 1 — Send button drift: ChatInput.tsx:154-165's text input has
    flex: 1 but was missing minWidth: 0. flex-basis:auto then refuses to
    shrink below intrinsic content width on Android WebView, and the
    flexShrink:0 Send button overflows off-screen. Recurring regression:
    d45c228c (position:fixed → flex-column) left the latent gap;
    47d81049 (mic/globe 34→44px, +20px) tipped it over.

    Bug 2 — Keyboard zoom-deform: SwipeTabContainer.tsx resync() fired
    on every visualViewport.resize (including keyboard open/close) and
    re-snapped stripX unconditionally. Android WebView fires resize
    events repeatedly during keyboard animations and window.innerWidth
    can transiently report pixel-ratio-adjusted values. stripX ended up
    translated to a wrong X — the active Ask slot mis-aligned
    horizontally, perceived as a 'zoom/deform'. Close did not recover
    because the post-close resize fired into the same race. Tab
    navigation recovered because navigateToTab unconditionally re-snaps
    stripX. Viewport meta (user-scalable=no, maximum-scale=1.0) rules
    out real browser zoom.
  artifacts:
    - path: "app/src/components/ChatInput.tsx"
      issue: "Input missing minWidth: 0 → flex-overflow on Android WebView"
    - path: "app/src/components/SwipeTabContainer.tsx"
      issue: "resync() re-snapped stripX on every visualViewport.resize (including height-only keyboard events) + no recovery path on focus-out"
  missing:
    - "minWidth: 0 on ChatInput input with load-bearing comment + source-reading test"
    - "resync width-change guard so keyboard events are no-ops"
    - "focus-out forced re-snap (deferred one frame) as defense-in-depth"
    - "CLAUDE.md sections documenting both invariants (three-location rule)"
  fix_commit: "cf1426ee, 438ec80b, 6bb1137d, 9f996789, 15d6f09b, 4492456a"
  fix_approach: |
    Six atomic commits across three root causes:

    Send-button drift (FIXED on device):
    1. cf1426ee — ChatInput minWidth:0 + source-reading test. Structural
       fix — no future button-size or gap change can re-break it.

    Keyboard horizontal-drift (FIXED on device):
    2. 438ec80b — SwipeTabContainer: resync gated on width change,
       onFocusOut rAF-deferred re-snap. (Initial hypothesis was the
       stripX race; partially contributed but NOT the whole story.)
    3. 9f996789 — REAL fix: html,body { overflow-x: hidden } + root div
       overflowX:'hidden' + onFocusOut scrollLeft reset. Root cause was
       document.scrollLeft shifting via Android WebView scrollIntoView
       on off-center slot input focus. Three layers of defense.

    Nested-scroll elastic bounce (PARTIAL — half works):
    4. 15d6f09b — extended html,body clip to both axes. Body
       min-height:100vh doesn't shrink with keyboard, making body a
       second scroll container; `overflow: hidden` clips both. Stopped
       the whole-screen-moves-with-scroll symptom.
    5. 4492456a — AskScreen messages container: overscrollBehavior:
       'contain' + WebkitOverflowScrolling:'touch' to match the
       app-wide convention (App.tsx:155-156, HomeScreen, InfoFlow).
       Elastic bounce at scroll boundaries was absorbing reversing
       swipes on direction change.

    Doc:
    6. 6bb1137d — CLAUDE.md sections for ChatInput + SwipeTab invariants.

    Status after 6 commits: send-button drift fixed, keyboard horizontal
    drift fixed, nested-scroll elastic bounce partially improved.
    User (2026-04-20) reported "would barely work" on last re-test and
    elected to defer further debugging; flagged as partial.
  remaining_gap: |
    AskScreen scroll on keyboard-open still feels mildly wrong on Android
    device despite overscroll-contain. Possible remaining causes (not yet
    investigated):
      - Framer-motion onPan listener on SwipeTabContainer motion.div may
        be intercepting the first ~10px of each vertical pan for axis
        resolution, before relinquishing to native scroll.
      - iOS/Android WebView pointer-capture quirks between framer-motion
        and native scroll at direction-change boundaries.
      - AskScreen messages container may need position:relative or
        transform:translateZ(0) to isolate scroll context more strictly.
    User decision: ship the partial fix, revisit only if the symptom
    recurs or worsens on device QA.
  secondary_issues_flagged:
    - "@capacitor/keyboard plugin is NOT installed. Current fix works with default adjustResize behavior. If future work needs finer keyboard control, install the plugin but DO NOT use resize:'none' — users rely on the default so the input scrolls above the keyboard."
    - "Initial stripX-race hypothesis (438ec80b) was half-right. The width-change gate + focus-out re-snap are still structurally correct defensive code, but the real keyboard-drift bug was document.scrollLeft shifting (fixed at 9f996789). Keeping 438ec80b landed — it covers a legitimate race that could still occur in other scenarios (device rotation, browser-UI resize)."
  debug_session: "deferred — flagged as partial per user decision 2026-04-20"

- truth: "New questions reuse existing branches/clusters/anchors when concepts match, instead of always minting new ones"
  status: fixed
  reason: "User reported (test 7): 'Now new questions ALWAYS create a new branch with new cluster and new concept anchor, even though the end concept anchors are almost identical.' Device screenshot: 6 branches for 6 Q&As (1:1 ratio) AND twin 'Spaced Repetition' anchors under two different branches — clearest possible evidence of duplicate concept creation."
  severity: major
  test: 7
  root_cause: |
    Three compounding issues, with #1 being structural (not fixable by prompts alone):

    1. STRUCTURAL FLAW — by-layer tree descent design (intentional token-saving
       pivot for large mindmaps): the LLM must commit to a BRANCH at step 1
       based on branch names only, BEFORE it can see which anchors exist.
       Cross-cutting concepts like 'Spaced Repetition' plausibly fit multiple
       branches (Cognitive Science / Educational Technology / Learning
       Techniques), and once the LLM picks a branch it's locked into that
       subtree and CANNOT reach a matching anchor living elsewhere. This
       produced the twin-anchor pattern the user screenshotted. Real
       knowledge is a DAG, not a tree — prompt engineering cannot bridge
       that mismatch.

    2. Anchor lookup asymmetric normalization (canonical-knowledge.service.ts
       ~line 729): result.anchorName was normalized at line 657, but the
       stored q.title on the right side of the comparison was compared raw.
       Pre-b2061554 anchors with un-normalized titles never matched even
       when the concept was identical.

    3. No case-insensitive coercion of LLM-NEW branch/cluster names: weaker
       models (Gemini Flash, Haiku) sometimes return
       {"index":"NEW","name":"psychology"} when the user already has
       'Psychology'. The pipeline treated it as genuinely new — new branch,
       new cluster (because anchor lookup is scoped to cluster+branch), new
       anchor. Cascade to total duplication.
  artifacts:
    - path: "app/src/services/canonical-knowledge.service.ts"
      issue: "By-layer tree descent cannot dedup cross-cutting concepts. Anchor lookup normalized only one side. No case-coercion of LLM-NEW names."
    - path: "app/src/providers/embedding/index.ts"
      issue: "Existing cosine() + embedText() infrastructure was unused for anchor dedup"
  missing:
    - "Structural: embedding-based anchor pre-check BEFORE tree descent. Cosine similarity between question's embedding and every existing anchor's embedding; above threshold (0.82), reuse + adopt branch/cluster. Zero LLM tokens on match path. Preserves token-saving tree descent for truly novel concepts."
    - "Opportunistic anchor embedding backfill (cap 8/classification) — anchors created before this feature have no embeddingVector; backfill inline as classifications flow in."
    - "Normalize anchor lookup on BOTH sides."
    - "Case-insensitive + trim coercion of LLM-NEW branch/cluster at steps 1 + 2."
    - "Prompt polish (fallback path): system prompt lists 9 broad-discipline examples + names the actual sub-field regressors; buildStepPrompt bakes in level-specific hierarchy hints + reuse-bias language at every step."
  fix_commit: "73aeb159, 1ac251a1"
  fix_approach: |
    Two commits, Tier A (structural) + Tier B (prompt polish):

    73aeb159 — feat(classification): embedding pre-check + dedup guards +
    stronger prompts. Adds preCheckAnchorMatch with
    ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD=0.82, opportunistic
    ANCHOR_BACKFILL_PER_CLASSIFICATION=8 anchor-embedding backfill per call.
    Wires pre-check at the top of classifyAndAnchorIncremental — if hit,
    reuse existing anchor's labels and skip the 3-step descent. Normalizes
    anchor lookup on both sides. Coerces LLM-NEW branch/cluster NAMES that
    case-insensitively match existing. Strengthens PIPELINE_SYSTEM_PROMPT
    with broad-discipline examples + sub-field warnings; buildStepPrompt
    with level-specific hints + reuse bias at every level.

    1ac251a1 — test(classification): 8-test regression suite pinning all
    structural invariants via source-reading asserts (cheaper than
    stubbing the full LLM+embedding pipeline, covers the code shape that
    makes duplication impossible).

    Scale: cosine on 256-dim vectors × N_anchors. Negligible even at 10k
    anchors (<10ms). Preserves the by-layer descent design for novel
    concepts where creation IS correct.
  secondary_issues_flagged:
    - "The user's existing graph has 6 branches that should probably collapse to 1-2 (most concepts are learning/memory/cognition). The Reorganize button (LLM-based, not embedding-based) already exists for retroactive consolidation — user would need to tap it. Deferred: option to wire Reorganize to the same pre-check for embedding-based retroactive merging."
    - "Threshold 0.82 is a conservative guess without empirical tuning. If too strict (misses real duplicates), lower to 0.78. If too loose (false-positive merges), raise to 0.85. Revisit after device QA shows pass/fail distribution."
    - "Branch prompt doesn't yet show the CONTENTS of each existing branch (just names). The LLM sees 'Cognitive Science' but not that it contains 'Learning Theory → Spaced Repetition'. Giving one-line content summaries would further improve the fallback-path reuse decisions, but would add tokens. Deferred — evaluate after pre-check effectiveness is measured on-device."
  debug_session: ""
