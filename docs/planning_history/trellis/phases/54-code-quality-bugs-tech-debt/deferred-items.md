# Phase 54 — Deferred / Out-of-Scope Items

Items discovered during execution that are NOT caused by the current plan's changes
and are therefore out of scope (per executor SCOPE BOUNDARY rule).

## Pre-existing test failures — date/timezone boundary (discovered in Plan 54-04)

**Date discovered:** 2026-05-20 (executor wall-clock 20:55 EDT == 2026-05-21 UTC)

Five tests fail at the UTC/local-midnight boundary. They assert against `today()` /
`dyingSchedule()` date arithmetic that drifts when the local clock and UTC fall on
different calendar days. Observed `actual: '2026-05-19'` vs `expected: '2026-05-20'`
mismatches.

Failing tests:
- `tests/services/review-overdue.test.mjs` — "daysOverdue returns positive integer for past nextReviewDate"
- `tests/services/review-overdue.test.mjs` — "Gap C: rating 3 on moderately-overdue card → days reduced by floor(overdueDays/2)"
- `tests/services/review-overdue.test.mjs` — "Gap C: penalty floors at 1 day (never schedules into the past)"
- `tests/services/trellis-state*.test.mjs` — "worst-child-wins: one 14-day child beats healthy sibling" / "UAT Bug 1: anchor with 14-day overdue child + reviewCount=0 → dead"
- `tests/services/trellis-replant.test.mjs` — "replant bumps anchor reviewSchedule to dyingSchedule" / "replant bumps each QA child to dyingSchedule"

**Why out of scope for Plan 54-04:** None of these test files import any file changed
by this plan (scheduler.service.ts, scheduler.native.ts, trajectoryAnalyzer.service.ts,
usePlanner.ts, ConnectionPostScreen.tsx, PodcastScreen.tsx). The failures are an
environmental clock-boundary artifact, not a regression introduced here. Deletion of
dead code + console.log→console.warn cannot affect SM-2 date math.

**Suggested fix (future):** Pin the test clock (inject a fixed `today()` / freeze
`Date.now()`) in the date-sensitive review/trellis tests so they are stable across the
UTC/local-midnight boundary. Out of scope for a dead-code/lint cleanup phase.
