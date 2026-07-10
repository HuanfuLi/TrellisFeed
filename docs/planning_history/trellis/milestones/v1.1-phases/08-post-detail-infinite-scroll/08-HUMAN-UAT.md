---
status: partial
phase: 08-post-detail-infinite-scroll
source: [08-VERIFICATION.md]
started: 2026-03-27T04:00:00Z
updated: 2026-03-27T04:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Swipe carousel left and right on device
expected: Images slide with 300ms ease-in-out transition, 50px threshold triggers swipe
result: [pending]

### 2. Scroll HomeScreen feed to absolute bottom
expected: PullUpHint shows ArrowUp + 'Pull up to load more'; after releasing, 10 new posts load without duplicates
result: [pending]

### 3. Navigate to a post with 3 cached images, then navigate to a post with 0 cached images
expected: First post shows carousel with N/M counter; second post shows essay alone (no carousel, no error)
result: [pending]

### 4. Open same post twice via back-navigation
expected: Carousel resets to image 1 on re-entry (counter reads '1/N')
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
