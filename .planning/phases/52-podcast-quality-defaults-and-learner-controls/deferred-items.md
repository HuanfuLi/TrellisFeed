# Phase 52 — Deferred / Out-of-Scope Items

## Pre-existing, date-sensitive test failures (discovered during 52-04 execution)

Discovered while running `npm test` for plan 52-04. These 7 failures are
**out of scope** for 52-04 (which touched only podcast files) and are
**pre-existing**: only `app/src/screens/PodcastScreen.tsx`,
`app/src/services/podcast-view-model.ts`, `app/src/services/podcast.service.ts`,
and `app/tests/services/podcast-view-model.test.mjs` changed since the worktree
base. None of the failing test files import podcast code.

They are SM-2 / trellis date-relative assertions that drift with the wall-clock
date (today = 2026-05-19). STATE.md's "1406/1406 green" baseline predates this
date drift and suite growth (now 1425 + 149).

Failing tests (NOT fixed — outside 52-04 scope):

- `tests/services/review-overdue.test.mjs`
  - daysOverdue returns positive integer for past nextReviewDate
  - Gap C: rating 3 on moderately-overdue card → days reduced by floor(overdueDays/2)
  - Gap C: penalty floors at 1 day (never schedules into the past)
- `tests/services/trellis-state.test.mjs`
  - worst-child-wins: one 14-day child beats healthy sibling
  - UAT Bug 1: anchor with 14-day overdue child + reviewCount=0 → dead
- `tests/services/trellis-replant.test.mjs`
  - replant bumps anchor reviewSchedule to dyingSchedule (nextReviewDate yesterday, reviewCount >= 1)
  - replant bumps each QA child to dyingSchedule

Recommended owner: a date-handling / fixed-clock test hardening pass (likely a
future plan). These tests should pin the clock rather than use `today()`.
