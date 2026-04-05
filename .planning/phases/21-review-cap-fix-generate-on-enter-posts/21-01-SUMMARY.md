---
phase: 21-review-cap-fix-generate-on-enter-posts
plan: 01
subsystem: review
tags: [flashcards, review, settings, progress]
dependency_graph:
  requires: []
  provides: [uncapped-review-queue, daily-goal-progress, reviewed-today-counter]
  affects: [ReviewScreen, SettingsScreen, useReview]
tech_stack:
  added: []
  patterns: [localStorage-date-keyed-counter]
key_files:
  created: []
  modified:
    - app/src/services/review.service.ts
    - app/src/services/settings.service.ts
    - app/src/screens/SettingsScreen.tsx
    - app/src/screens/ReviewScreen.tsx
decisions:
  - "Daily reviewed counter uses date-keyed localStorage entry (echolearn_reviewed_today) that auto-resets daily"
  - "getReviewedTodayCount exported as synchronous function on reviewService for lazy useState initializer"
  - "dailyGoal derived from settingsService.getSync() via useMemo for single read at mount"
metrics:
  duration: 109s
  completed: "2026-04-05T21:28:39Z"
---

# Phase 21 Plan 01: Remove Review Cap and Add Daily Goal Progress Summary

Removed the hard cap from flashcard review queue so all due cards appear, repurposed the setting as a daily goal with a cross-session progress bar using localStorage-persisted reviewed-today counter.

## What Was Done

### Task 1: Remove review cap, raise default, add daily reviewed counter
- **Commit:** 957732f2
- Removed `.slice(0, 10)` from `getTodayReviewItems()` so all due flashcards are returned
- Added `echolearn_reviewed_today` localStorage counter with date-keyed auto-reset
- Added `getReviewedTodayCount()` and `incrementReviewedToday()` helper functions
- Exported `getReviewedTodayCount` on `reviewService` object
- Called `incrementReviewedToday()` inside `submitReview()` after schedule update
- Changed default `dailyLimit` from 20 to 50 in `settings.service.ts`

### Task 2: Rename setting label and add daily goal progress in ReviewScreen
- **Commit:** d02ea9bc
- Changed SettingsScreen label from "Daily Limit" to "Daily Goal"
- Changed description from "Max cards per day" to "Target cards per day"
- Changed parseInt fallback from `|| 20` to `|| 50`
- Added `reviewService` and `settingsService` imports to ReviewScreen
- Added `reviewedToday` state initialized from localStorage counter
- Added `dailyGoal` useMemo from settings with 50 default
- Rendered daily goal progress bar ("X/Y reviewed today") above session progress bar
- Incremented `reviewedToday` in handleRate for live UI feedback

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Satisfied

- REVIEW-01: All due flashcards appear in review queue (no hard cap)
- REVIEW-02: Review count badges show true due count (getTodayReviewCount calls uncapped getTodayReviewItems)
- REVIEW-03: ReviewScreen shows daily goal progress (reviewedToday/dailyGoal)
- REVIEW-04: Settings label reads "Daily Goal" not "Daily Limit"
- REVIEW-05: Default daily goal is 50

## Known Stubs

None - all data sources are wired to real localStorage persistence.

## Verification Results

- TypeScript: clean build (no errors)
- No `.slice(0, limit)` in review.service.ts
- `dailyLimit: 50` confirmed in settings.service.ts
- "Daily Goal" label confirmed in SettingsScreen.tsx
- `reviewedToday` state and display confirmed in ReviewScreen.tsx
- Two ProgressBar instances in ReviewScreen (daily goal + session)
