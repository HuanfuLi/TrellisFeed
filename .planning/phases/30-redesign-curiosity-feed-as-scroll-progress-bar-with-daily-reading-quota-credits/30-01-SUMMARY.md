---
phase: 30-redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
plan: 01
subsystem: daily-read-service
tags: [data-layer, service, events, i18n, localStorage]
dependency_graph:
  requires: []
  provides: [dailyReadService, getAnchorIdForPost, getConceptQuota, CONCEPT_EXPLORED-event, home.feed-i18n-keys]
  affects: [HomeScreen, event-bus, trellis-credits]
tech_stack:
  added: []
  patterns: [localStorage-daily-reset, anchor-id-derivation, source-type-filtering]
key_files:
  created:
    - app/src/services/daily-read.service.ts
    - app/tests/services/daily-read.service.test.mjs
    - app/tests/concept-quota.test.mjs
  modified:
    - app/src/types/index.ts
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
decisions:
  - Inlined today() in daily-read.service.ts to avoid i18next dependency chain from lib/date.ts, keeping the module testable under plain Node without bundler resolution
metrics:
  duration: 4m 25s
  completed: 2026-04-17T13:57:07Z
  tasks_completed: 2
  tasks_total: 2
  test_count: 15
  test_pass: 15
---

# Phase 30 Plan 01: Daily Read Service Data Layer Summary

localStorage-backed daily exploration tracker with anchor ID derivation, CONCEPT_EXPLORED event type, and 7 home.feed i18n keys across 4 locales.

## Task Results

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | dailyReadService + CONCEPT_EXPLORED + getAnchorIdForPost (TDD) | 3d7dc761 | daily-read.service.ts, types/index.ts, 2 test files |
| 2 | home.feed.* i18n keys (4 locales) | a0c09a91 | en.json, zh.json, es.json, ja.json |

## What Was Built

### dailyReadService (daily-read.service.ts)
- `markExplored(anchorId)` / `isExplored(anchorId)` / `getExploredAnchors()` -- track explored concept anchors
- `isCreditAwarded()` / `markCreditAwarded()` -- prevent double-awarding credits on same day
- `reset()` -- clear state (testing utility)
- Automatic daily reset: state persisted under `echolearn_daily_read` localStorage key with date comparison
- Idempotent markExplored (no duplicates)

### Anchor ID Derivation
- `getAnchorIdForPost(post, questionsById)` -- resolves DailyPost to concept anchor via sourceQuestionIds -> question.parentId chain; falls back to sourceQuestionIds[0] as surrogate
- `getConceptQuota(posts, questionsById)` -- computes deduplicated Set of anchor IDs from feed, excluding non-concept sourceTypes (starter, connection, video, short, news)

### CONCEPT_EXPLORED Event
- Added `{ type: 'CONCEPT_EXPLORED'; payload: { anchorId: string } }` variant to AppEvent union in types/index.ts

### i18n Keys (home.feed.*)
- 7 keys: title, progress, progressCompact, complete, creditToast, emptyTitle, emptyBody
- All 4 locales (EN/ZH/ES/JA) updated with matching key sets
- Interpolation placeholders {{explored}} and {{total}} preserved in all translations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inlined today() to avoid i18next dependency chain**
- **Found during:** Task 1
- **Issue:** Importing `today()` from `lib/date.ts` chains into `i18next` which is unavailable in Node test context (worktree lacks node_modules symlink)
- **Fix:** Inlined the simple YYYY-MM-DD date function directly in daily-read.service.ts
- **Files modified:** app/src/services/daily-read.service.ts
- **Commit:** 3d7dc761

## Known Stubs

None -- all service methods are fully implemented and tested.

## Self-Check: PASSED

- [x] app/src/services/daily-read.service.ts EXISTS
- [x] app/tests/services/daily-read.service.test.mjs EXISTS
- [x] app/tests/concept-quota.test.mjs EXISTS
- [x] Commit 3d7dc761 EXISTS
- [x] Commit a0c09a91 EXISTS
- [x] All 15 tests pass
