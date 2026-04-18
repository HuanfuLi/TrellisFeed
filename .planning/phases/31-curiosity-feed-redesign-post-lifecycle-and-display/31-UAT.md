---
status: complete
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
source: [31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md, 31-05-SUMMARY.md, 31-06-SUMMARY.md, 31-07-SUMMARY.md]
started: 2026-04-18T12:00:00Z
updated: 2026-04-18T12:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. VineProgress shows all SM-2 due concepts
expected: HomeScreen shows a horizontal vine SVG with potted plant on left. The number of concept flowers matches ALL your anchor concepts (same count as podcast), not filtered by post style. Tap the vine to expand checklist — all concept names listed.
result: pass

### 2. Feed shows diverse post styles
expected: Feed displays posts in varied styles — text-art, video (16:9 landscape), YouTube shorts (9:16), news cards, suggestion cards. Not all the same style.
result: issue
reported: "I see repeated youtube videos in video posts"
severity: major

### 3. Suggestion card with tappable topics
expected: At least one suggestion card appears in feed with Sparkles icon, "Suggested topics" header, and 3 tappable topic buttons. Tapping a topic navigates to Ask screen with the topic pre-filled and auto-sent.
result: issue
reported: "1. Major: The recommended topics are ALL just repeating existing QAs/concept anchors rather than 5 new areas designed in documentation. 2. 3 topics are too few. Use 4 instead"
severity: major

### 4. Landscape video plays inline
expected: A landscape video post plays inline in the feed (16:9 iframe). Tapping play does NOT navigate to a detail page or generate an essay.
result: issue
reported: "Yes it plays inline, but touch seems conflicting and not accurately responding. User cannot stop video, and when user touch video it feels page is slightly scrolled down"
severity: major

### 5. Video stops on swipe-away
expected: While a video is playing inline, swipe to another tab (e.g., Planner). Video stops. Swipe back — video is stopped (not auto-resumed).
result: issue
reported: "Completely failed. I can even play 2 identical videos at the same time."
severity: blocker

### 6. VineProgress tap-to-expand checklist
expected: Tap the vine → checklist expands showing uncovered concept names. Tap a concept name → feed scrolls to that concept's post. Tap outside or tap vine again → checklist collapses.
result: pass
note: "Minor: When compact header expands, rest of screen is still interactable. User click on other places in order to collapse it, but may accidentally enter a post detail page."

### 7. VineProgress completion celebration
expected: After exploring all concepts (opening and reading posts for each), vine turns gold (#E8A838) with bloom animation and fruit icons. "+1 credit earned!" toast appears.
result: issue
reported: "Cannot test because I cannot finish all concepts. The system fails to go through list of concept again in a loop manner, and stops generating new posts after a few swipe-for-more actions."
severity: blocker

### 8. Compact vine header on scroll
expected: Scroll down past the inline vine card. A compact vine header slides in at the top of the screen (same vine, smaller). Scroll back up — compact header disappears, inline card visible again.
result: pass

### 9. ScrollToTopFAB
expected: Scroll down 400px+ in feed. A circular up-arrow button appears at bottom-right. Tap it — feed smooth-scrolls to top. Button disappears when at top.
result: pass

### 10. Post History screen
expected: Navigate to Settings > Data > "Post History" link. Screen shows past viewed posts grouped by day (Today, Yesterday, dates). Posts have thumbnails or fallback icons. Tapping a post navigates to its detail.
result: pass

### 11. Feed settings controls
expected: Settings > Data > Developer section shows: Post Retention (7 days / Keep all), Daily Generation Cap (default 5), Bonus Post Cap (default 8), Send Feedback link, Reset Today button.
result: issue
reported: "The position of dropdown menu is very weird. Others pass"
severity: cosmetic

### 12. Warm start on new day
expected: After Reset Today in Settings, reopen Home. Feed shows posts immediately (from queue or yesterday's posts) — no blank screen while generating. New posts generate in background.
result: blocked
blocked_by: prior-phase
reason: "Cannot test because of broken queue feature."

### 13. Pull-for-more serves from queue
expected: At bottom of feed, pull up to load more. 4 new posts appear. Pull again — 4 more. Posts cycle through concepts, not repeating the same concept consecutively.
result: issue
reported: "Only first few pulls work. A few pulls later, the queue sometimes only pop 1 post, and sometimes does not pop anything, only displaying 'No more posts for today', with no LLM calls in backend."
severity: blocker

### 14. Starter posts for new users
expected: On a fresh install (or after Clear All Data with no questions asked), feed shows 3 tutorial starter posts: "Welcome to EchoLearn", "How your knowledge grows", "Explore your daily feed".
result: issue
reported: "1. In a fresh install, the system shows 'Nothing new today', with broken lower padding and is very interrupting. 2. Introduction posts are too short and brief. Should be more informative"
severity: major

## Summary

total: 14
passed: 5
issues: 8
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Feed displays posts in varied styles without repeating identical videos"
  status: failed
  reason: "User reported: I see repeated youtube videos in video posts"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Suggestion topics are fresh/unexplored topics related to existing mindmap nodes (D-24), not repeating existing QAs"
  status: failed
  reason: "User reported: The recommended topics are ALL just repeating existing QAs/concept anchors rather than 5 new areas. Also 3 topics too few, use 4"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Inline video touch interaction works cleanly — user can stop video, no scroll interference"
  status: failed
  reason: "User reported: touch seems conflicting, cannot stop video, page slightly scrolls down on touch"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Video stops on swipe-away and only one video plays at a time (D-29)"
  status: failed
  reason: "User reported: Completely failed. Can play 2 identical videos at the same time."
  severity: blocker
  test: 5
  artifacts: []
  missing: []

- truth: "Compact header checklist should block feed interaction to prevent accidental taps"
  status: failed
  reason: "User reported: When compact header expands, rest of screen still interactable, may accidentally enter post detail"
  severity: minor
  test: 6
  artifacts: []
  missing: []

- truth: "Queue cycles through all concepts in a loop, generating new posts until all concepts explored"
  status: failed
  reason: "User reported: System fails to loop through concepts, stops generating after a few swipe-for-more actions"
  severity: blocker
  test: 7
  artifacts: []
  missing: []

- truth: "Post retention dropdown anchors correctly to its settings row"
  status: failed
  reason: "User reported: The position of dropdown menu is very weird"
  severity: cosmetic
  test: 11
  artifacts: []
  missing: []

- truth: "Queue serves 4 posts per pull consistently, cycling through concepts (D-10)"
  status: failed
  reason: "User reported: Only first few pulls work. Later pops 1 or 0 posts, shows 'No more posts' with no LLM calls"
  severity: blocker
  test: 13
  artifacts: []
  missing: []

- truth: "Fresh install shows starter tutorial posts without 'Nothing new today' empty state (D-43)"
  status: failed
  reason: "User reported: Shows 'Nothing new today' above starter posts with broken padding. Starter content too brief."
  severity: major
  test: 14
  artifacts: []
  missing: []
