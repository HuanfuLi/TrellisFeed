---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 01
subsystem: data-layer
tags: [types, services, localStorage, FIFO, post-queue, post-history]
dependency_graph:
  requires: []
  provides: [postQueueService, postHistoryService, SuggestionMeta, feed-settings]
  affects: [concept-feed.service, HomeScreen, settings.service]
tech_stack:
  added: []
  patterns: [localStorage-FIFO-buffer, daily-auto-reset, rolling-window-purge]
key_files:
  created:
    - app/src/services/post-queue.service.ts
    - app/src/services/post-history.service.ts
    - app/tests/services/post-queue.test.mjs
    - app/tests/services/post-history.test.mjs
  modified:
    - app/src/types/index.ts
decisions:
  - "'suggestion' added to PresentationStyle and sourceType unions"
  - "SuggestionMeta interface with topics: string[] field"
  - "feed settings block on AppSettings with postRetentionDays (null=keepAll), dailyGenerationCapMultiplier, bonusPostCap"
  - "Post queue uses echolearn_post_queue localStorage key with daily auto-reset"
  - "Post history uses echolearn_post_history localStorage key with configurable retention purge"
metrics:
  duration: "3m 4s"
  completed: "2026-04-18"
  tasks: 2
  files: 5
---

# Phase 31 Plan 01: Data Layer Foundation Summary

Established the data layer for Phase 31: extended domain types for suggestion posts, created the post queue FIFO buffer service, and created the post history rolling-window service with 14 passing tests.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend types + post-queue service | `4520abc5` | types/index.ts, post-queue.service.ts, post-queue.test.mjs |
| 2 | Post history service | `0426137c` | post-history.service.ts, post-history.test.mjs |

## What Was Built

### Type Extensions (app/src/types/index.ts)
- `PresentationStyle` union extended with `'suggestion'`
- `PostSnapshot.sourceType` union extended with `'suggestion'`
- `SuggestionMeta` interface added (`topics: string[]`)
- `DailyPost.suggestionMeta?: SuggestionMeta` optional field added
- `AppSettings.feed` block added: `postRetentionDays`, `dailyGenerationCapMultiplier`, `bonusPostCap`

### Post Queue Service (app/src/services/post-queue.service.ts)
- 8-post FIFO buffer backed by localStorage (`echolearn_post_queue`)
- Daily auto-reset on date mismatch (same pattern as daily-read.service.ts)
- `enqueue`, `dequeue`, `size`, `needsRefill`, `getQueue` (shallow copy)
- `cycleNumber` tracking with `incrementCycle` and `getCycleNumber`
- `resetForNewDay`, `loadQueue`, `getYesterdayQueue` for warm-start support

### Post History Service (app/src/services/post-history.service.ts)
- Rolling post history backed by localStorage (`echolearn_post_history`)
- `addPost` with id-based deduplication
- `getPosts` returns posts sorted by `generatedAt` descending
- `getPostsByDay` returns `Map<string, DailyPost[]>` grouped by date
- `purgeExpired` respects `settings.feed.postRetentionDays` (null = keep all)

## Test Results

- **post-queue.test.mjs:** 8/8 pass (enqueue/dequeue FIFO, needsRefill threshold, date-mismatch reset, same-date preserve, cycle increment, resetForNewDay, shallow-copy safety)
- **post-history.test.mjs:** 6/6 pass (add/get, dedup, 7-day purge, keepAll null, day grouping, generatedAt sort)
- **tsc --noEmit:** Clean (no type errors)

## Deviations from Plan

None - plan executed exactly as written. The `AppSettings.feed` block and settings.service.ts defaults were already present (added by a parallel agent working on the same wave).

## Known Stubs

None. Both services are fully functional with complete localStorage persistence.

## Self-Check: PASSED

All 4 created files found. Both commit hashes verified.
