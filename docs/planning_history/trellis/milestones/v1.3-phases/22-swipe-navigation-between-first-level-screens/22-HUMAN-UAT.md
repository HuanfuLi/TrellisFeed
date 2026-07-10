---
status: complete
phase: 22-swipe-navigation-between-first-level-screens
source: [22-VERIFICATION.md]
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Swipe between all 5 screens with proportional bottom nav tracking
expected: Bottom nav icon/label colors animate smoothly as finger drags, not just on commit
result: pass

### 2. Rubber-band resistance at edges
expected: Drag feels heavier/sticky at Home right-swipe and Settings left-swipe, springs back on release
result: pass

### 3. Small swipe (< 20% screen width) snaps back
expected: Short drag returns to original tab; no navigation commit
result: pass

### 4. Tab tap triggers slide animation
expected: Tapping Home from Settings slides visually (spring ~250ms), not instant jump
result: pass

### 5. Non-adjacent tab tap slides directly without intermediates
expected: Direct spring from current position to target, no intermediate screens flash
result: issue
reported: "No. Intermediate screens are still visible and cause flash. Another UI issue: in Ask screen, in the user input textbox island, the send button is misplaced when deployed on phone, but seems fine in web."
severity: major

### 6. PostCarousel image swipe does not trigger tab navigation
expected: Swiping the image carousel changes images, not tabs
result: skipped
reason: "Cannot be tested since no image carousel is actually used."

### 7. MindElixir graph pan does not trigger tab navigation
expected: Panning inside the graph container moves the mindmap, not the tab strip
result: pass

### 8. Keyboard-open suppresses tab swipe
expected: With virtual keyboard visible on Ask screen, horizontal swipe is ignored
result: pass

### 9. GraphScreen MindElixir renders correctly when first revealed
expected: Mind map is visible and centered, not 0-width or collapsed
result: pass

### 10. Sub-screens render in overlay with swipe disabled
expected: Navigating to /posts/:id shows full-screen overlay, swiping does nothing
result: pass

### 11. Scroll position preserved across tab switches
expected: After scrolling Home feed down and switching to Ask and back, Home scroll position is preserved
result: pass

## Summary

total: 11
passed: 8
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Direct spring from current position to target, no intermediate screens flash (and Ask screen send button placement)"
  status: failed
  reason: "User reported: No. Intermediate screens are still visible and cause flash. Another UI issue: in Ask screen, in the user input textbox island, the send button is misplaced when deployed on phone, but seems fine in web."
  severity: major
  test: 5
  artifacts: []
  missing: []
- truth: "Bottom navigation should stay below keyboard; Ask textbox island should be positioned correctly"
  status: failed
  reason: |
    User reported during test 8: UI Issue: When virtual keyboard is present, the bottom navigation bar was lifted up above keyboard, blocking view. The bottom nav bar should stay below keyboard and only the textbox island should be above the keyboard (with proper padding), reference old code.
  severity: major
  test: 8
  artifacts: []
  missing: []
- truth: "Post screen header should be sticky with a 'Post' title"
  status: failed
  reason: "User reported during test 10: UI Issue: When in post, the top heading bar with back buttom and hamburger button should stick to the top of screen... it is currently moving with the page when user scroll... Also, may add a 'Post' text at the middle"
  severity: major
  test: 10
  artifacts: []
  missing: []
