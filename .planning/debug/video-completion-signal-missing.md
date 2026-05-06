---
status: diagnosed
trigger: "UAT Phase 36 — video posts do not fire CONCEPT_EXPLORED; vine progress never increments for video-only interactions"
created: 2026-05-06T00:00:00Z
updated: 2026-05-06T00:00:00Z
---

## Current Focus

hypothesis: Both Detector A and Detector B structurally fail for video posts, and the video detail path (YouTubeEmbed plain iframe) has zero JavaScript hooks into the YouTube IFrame Player API — making it impossible for the app to observe playback events at all without adding an enablejsapi=1 parameter.
test: Code-reading trace of the full video post open path (feed tap → PostDetailScreen → YouTubeEmbed → detectors)
expecting: Confirmed — neither detector can fire for a video post whose only content above the sentinel is a static iframe; Detector B is technically possible but only after 30s dwell on the DETAIL screen.
next_action: ROOT CAUSE CONFIRMED — diagnosis returned

## Symptoms

expected: Watching a video post fires CONCEPT_EXPLORED (same as scroll-70% or 30s-dwell for text/image posts). Vine progress increments and lazy-skip walker skips that concept on subsequent refills.
actual: CONCEPT_EXPLORED never fires for video posts. Vine progress does not increment. Lazy-skip never engages for video-only interactions.
errors: No runtime errors — silent absence of signal.
reproduction: Open any video post (presentationStyle === 'video' or 'short') in PostDetailScreen, watch video, return to feed — vine progress unchanged.
started: Phase 17/18 (video presentationStyle added without paired completion detector). Surfaced in Phase 36 UAT Test 3.

## Eliminated

- hypothesis: Video posts open in an external tab, bypassing PostDetailScreen entirely
  evidence: Feed cards with presentationStyle==='video' have interactive=true and call onOpen(post.id, post) which navigates to /posts/:id — PostDetailScreen renders. The inline-feed iframe (InfoFlow.tsx:337) plays in-feed without navigating. PostDetailScreen uses YouTubeEmbed (a plain iframe). Neither path exits the app. Hypothesis 3 eliminated.
  timestamp: 2026-05-06T00:00:00Z

- hypothesis: Detector B (30s dwell) eventually fires and resolves the problem
  evidence: Detector B IS wired and starts when resolvedAnchorId is set (PostDetailScreen.tsx:139-149). A user who opens a video post and stays on the detail screen for 30s WOULD get CONCEPT_EXPLORED via Detector B. However: (a) short-form videos (<30s) can be watched completely before the timer fires — user leaves, timer is cleared on unmount; (b) the user may watch the video inline in the feed without ever navigating to PostDetailScreen at all — Detector B never runs in that case. So Detector B is a partial/unreliable signal, not a full solution.
  timestamp: 2026-05-06T00:00:00Z

## Evidence

- timestamp: 2026-05-06T00:00:00Z
  checked: PostDetailScreen.tsx:589-601 — video post rendering branch
  found: |
    When post.sourceType === 'video' && post.videoMeta?.videoId, the detail screen renders:
      <div style={{ marginBottom: 16 }}>
        <YouTubeEmbed videoId={post.videoMeta.videoId} />
        {/* optional channel credit */}
      </div>
    The YouTubeEmbed component is rendered ABOVE the article section. The scroll sentinel
    (scrollSentinelRef, line 781) is placed INSIDE the <article> element, between the essay
    body div and the takeaway section.
  implication: The sentinel is below the iframe, not above it — for Detector A to fire, the user must scroll past the sentinel, which requires the article content below the video to be long enough to push the sentinel below the viewport.

- timestamp: 2026-05-06T00:00:00Z
  checked: PostDetailScreen.tsx:730-797 — article content for video posts
  found: |
    For video posts (post.sourceType === 'video'):
    - post.whyCare is skipped (line 730: sourceType !== 'video' guards it)
    - An "AI Summary" h3 label is shown (lines 733-742)
    - The essay body streams in (lines 744-779) — the essay DOES exist for video posts
    - The takeaway is skipped (line 782: sourceType !== 'video' guards it)
    - The sentinel is at line 781 between essay body and takeaway
    
    So the article section for a video post is: h3 label + streamed essay body.
    The essay body has minHeight: 200px. Total article content is probably enough to push
    the sentinel off-screen for most screen sizes — BUT only if the essay has streamed.
    The sentinel fires when IT intersects the viewport, not when the user reaches 70% of
    the CONTENT — for a video post, "70% scroll" behavior is unpredictable because the
    video iframe itself takes substantial viewport height.
  implication: Detector A (scroll sentinel) is architecturally fragile for video posts. It may fire or not fire depending on video height + essay length + screen size. It cannot serve as a reliable "watched the video" signal.

- timestamp: 2026-05-06T00:00:00Z
  checked: YouTubeEmbed.tsx (full file)
  found: |
    The iframe src is:
      https://www.youtube.com/embed/{videoId}?playsinline=1&rel=0
    
    Notably ABSENT: enablejsapi=1
    
    Without enablejsapi=1, the YouTube IFrame Player API postMessage protocol is not
    activated. The browser cannot receive onStateChange events (PLAYING, ENDED, etc.)
    from the iframe via window.addEventListener('message', ...) or the YT.Player API.
    The iframe is an opaque content wall — the parent page cannot observe playback state.
  implication: There is currently NO technical path to detect video completion in YouTubeEmbed. Even if a Detector C was added to PostDetailScreen, it would receive no events from the existing iframe because enablejsapi=1 is missing.

- timestamp: 2026-05-06T00:00:00Z
  checked: InfoFlow.tsx:331-414 (video card inline play) and InfoFlow.tsx:418-524 (short card inline play)
  found: |
    Both video and short cards in the FEED (InfoFlow.tsx) play inline via iframes:
      src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?autoplay=1&playsinline=1&rel=0`}
    
    Again, NO enablejsapi=1. Additionally, there is NO call to emitExplored or eventBus.emit
    anywhere in InfoFlow.tsx. The setVideoPlaying(post.id) call merely swaps the thumbnail
    for an iframe — no explored signal is fired at that tap point either.
    
    Short posts (isShortPost=true) have interactive=false (line 295), meaning onOpen is
    NEVER called for short posts — the user CANNOT navigate to PostDetailScreen for a
    short post. Short posts are FEED-ONLY. This means Detector B (dwell timer) never
    runs for short posts at all, because they never open a detail screen.
  implication: Short posts (presentationStyle === 'short') have ZERO paths to CONCEPT_EXPLORED. They play inline in the feed and cannot navigate to PostDetailScreen. There is no dwell timer, no scroll sentinel, no tap-to-explore. Complete blind spot.

- timestamp: 2026-05-06T00:00:00Z
  checked: PostDetailScreen.tsx:406-411 — Detector C (existing, mis-labeled)
  found: |
    The handleAsk function at line 409 calls emitExplored(resolvedAnchorId) when the user
    submits a Q&A question. The comment says "Detector C: Follow-up question marks concept
    as explored (D-06)". So there IS a "Detector C" already — but it's for Q&A engagement,
    not for video completion. Video posts CAN benefit from this if the user asks a follow-up
    question, but watching a video without asking a question fires nothing.
  implication: The existing "Detector C" label in the code is for Q&A, not video. A new video-specific detector would need to be Detector D/E in any fix. The existing 3 detectors are: A (scroll 70%), B (30s dwell), C (Q&A follow-up).

## Resolution

root_cause: |
  Two compounding failures:

  1. SHORT POSTS: Complete blind spot. isShortPost=true sets interactive=false in InfoFlow.tsx
     (line 295), which means the card never calls onOpen() and never navigates to
     PostDetailScreen. The dwell timer, scroll sentinel, and Q&A detector never run.
     Short posts play inline in the feed. Without enablejsapi=1 in the iframe src, there
     is no JavaScript hook to detect playback events. CONCEPT_EXPLORED can NEVER fire
     for short posts under the current architecture.

  2. VIDEO POSTS (full-length): Partial coverage by Detector B (30s dwell) IF the user
     opens the detail screen AND stays for 30+ seconds. But:
     a. The Detector B timer starts on resolvedAnchorId being set — that depends on
        getAnchorIdForPost succeeding (which requires sourceQuestionIds to be populated
        and the questions to have parentId). If a video post has no sourceQuestionIds,
        resolvedAnchorId is null and no detector runs at all.
     b. For short videos (YouTube Shorts served as 'video' type), the user may watch the
        full video and leave in <30s — Detector B clears on unmount without firing.
     c. YouTubeEmbed.tsx renders WITHOUT enablejsapi=1, so the IFrame API is inactive —
        there is no way to observe the 'ended' event or track currentTime/duration from
        the parent page.
     d. The scroll sentinel (Detector A) is unreliable for video posts because it measures
        scroll-into-view of a sentinel below the video iframe, not actual video consumption.

fix: (empty — find_root_cause_only mode)
verification: (empty — find_root_cause_only mode)
files_changed: []
