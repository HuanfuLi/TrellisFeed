---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 08
subsystem: feed
tags: [queue, youtube, dedup, concept-feed, infinite-scroll]

requires:
  - phase: 31-02
    provides: post-queue.service.ts and refillQueue pipeline
provides:
  - Fixed buildConceptBatch that cycles through concepts indefinitely
  - generateMorePosts that awaits refill when queue is empty
  - YouTube videoId deduplication within generation batches

affects: [concept-feed, post-queue, infinite-scroll]

tech-stack:
  added: []
  patterns: [seenVideoIds Set for batch-level YouTube dedup]

key-files:
  created: []
  modified:
    - app/src/services/concept-feed.service.ts

key-decisions:
  - "Removed exploredIds filter from buildConceptBatch: explored state is read-tracking for VineProgress, not a generation gate; daily generation cap (D-38) in refillQueue already limits output"
  - "Await refillQueue synchronously when queue is empty instead of fire-and-forget to prevent premature 'no more posts'"
  - "Fetch 3 YouTube results instead of 1 to find non-duplicate alternatives within a batch"

patterns-established:
  - "seenVideoIds Set pattern: track used videoIds across video+shorts loops in generatePostBatch"

requirements-completed: [D-10, D-12, D-13, D-29, D-38]

duration: 3min
completed: 2026-04-18
---

# Phase 31 Plan 08: Queue/Generation Bug Fixes Summary

**Fixed three critical queue pipeline bugs: concept cycling stops, empty-queue returns, and YouTube video duplicates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-18T09:30:59Z
- **Completed:** 2026-04-18T09:34:25Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

### Task 1: Fix buildConceptBatch to cycle + generateMorePosts to await refill
- Removed `exploredIds` filter from `buildConceptBatch` -- explored state is a VineProgress read-tracking concern, not a generation concern. The daily generation cap (D-38) in `refillQueue` already limits total output.
- Changed filter to use `pendingIds` only (concepts already in queue), allowing the queue to cycle through all concepts repeatedly once pending posts are consumed.
- In `generateMorePosts`, changed empty-queue handling from fire-and-forget `refillQueue` to `await refillQueue` + retry dequeue, ensuring users never see "no more posts" while refill is in progress.
- **Commit:** 0ed7205c

### Task 2: Deduplicate YouTube videoIds within generatePostBatch
- Added `seenVideoIds` Set at the top of `generatePostBatch` to track used YouTube videoIds across both video and shorts loops.
- Changed `searchVideos` calls from requesting 1 result to 3 results, picking the first non-duplicate.
- If all results are duplicates, the assignment is skipped gracefully (no post generated rather than a duplicate).
- Fixed pre-existing bug: removed invalid `title` property from shorts `videoMeta` (not in `VideoMetadata` type).
- **Commit:** 3daed7ae

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid `title` property from shorts videoMeta**
- **Found during:** Task 2
- **Issue:** The shorts loop included `title: short.title` in `videoMeta`, but `VideoMetadata` type does not have a `title` property (TS2353 error).
- **Fix:** Removed the `title` property from the shorts `videoMeta` object literal.
- **Files modified:** app/src/services/concept-feed.service.ts
- **Commit:** 3daed7ae

## Verification

- `npx tsc --noEmit` passes clean
- Build errors in concept-feed.service.ts are all pre-existing (unused variables, type overlap) and unrelated to this plan's changes

## Known Stubs

None -- all changes are functional fixes, no new UI or data stubs introduced.

## Self-Check: PASSED
