# Phase 52 — Deferred / Out-of-Scope Items

## Pre-existing, date-sensitive test failures (discovered during 52-04 + 52-06)

Both gap-closure executors independently surfaced the **same 7 failures** while
running `npm test`. They are **pre-existing** and **out of scope**: 52-04 touched
only podcast files (`PodcastScreen.tsx`, `podcast-view-model.ts`,
`podcast.service.ts`, and the view-model test); 52-06 touched only
`types/index.ts` (additive `apiKeys`), `SettingsAIScreen.tsx`, and a new settings
test. None of the failing test files import podcast or settings code.

Root cause: SM-2 / trellis fixtures hardcode dates relative to their authoring
date, while the `dyingSchedule` / `daysOverdue` math computes against `today()`
(real clock). Expected vs. actual diverge by the number of days elapsed since the
fixtures were written (e.g. `actual 2026-05-18` vs `expected 2026-05-19`).
STATE.md's "1406/1406 green" baseline predates this date drift and suite growth
(now ~1425 + 149).

Failing tests (NOT fixed — outside Phase 52 gap scope):

- `tests/services/review-overdue.test.mjs`
  - daysOverdue returns positive integer for past nextReviewDate
  - Gap C: rating 3 on moderately-overdue card → days reduced by floor(overdueDays/2)
  - Gap C: penalty floors at 1 day (never schedules into the past)
- `tests/services/trellis-state.service.test.mjs` (a.k.a. `trellis-state.test.mjs`)
  - worst-child-wins: one 14-day child beats healthy sibling
  - UAT Bug 1: anchor with 14-day overdue child + reviewCount=0 → dead
- `tests/services/trellis-replant.test.mjs`
  - replant bumps anchor reviewSchedule to dyingSchedule (nextReviewDate yesterday, reviewCount >= 1)
  - replant bumps each QA child to dyingSchedule

Recommended owner: a fixed-clock / date-handling test-hardening pass (a future
plan). These tests should pin the clock rather than use `today()`.
