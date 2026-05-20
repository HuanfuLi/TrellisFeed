# Deferred Items — Phase 52

Out-of-scope discoveries logged during plan execution (not fixed; tracked for later).

## 52-06 — date-dependent trellis test fixtures (pre-existing, out of scope)

Discovered during plan 52-06 full-suite verification (`npm test`, system date 2026-05-19).

7 failures, all asserting wall-clock relative dates (`actual 2026-05-18` vs `expected 2026-05-19`):

- `tests/services/trellis-state.service.test.mjs`
  - daysOverdue returns positive integer for past nextReviewDate
  - Gap C: rating 3 on moderately-overdue card → days reduced by floor(overdueDays/2)
  - Gap C: penalty floors at 1 day (never schedules into the past)
  - worst-child-wins: one 14-day child beats healthy sibling
  - UAT Bug 1: anchor with 14-day overdue child + reviewCount=0 → dead
- `tests/services/trellis-replant.test.mjs`
  - replant bumps anchor reviewSchedule to dyingSchedule (nextReviewDate yesterday)
  - replant bumps each QA child to dyingSchedule

Root cause: fixtures hardcode dates relative to an authoring date; the SM-2/dyingSchedule
math computes against `today()` (real clock), so the expected/actual diverge by the number of
days since the fixtures were written. Entirely unrelated to plan 52-06 — these files touch
trellis/SM-2/date logic; 52-06 only touched `types/index.ts` (additive `apiKeys`),
`SettingsAIScreen.tsx`, and a new settings test. Not fixed (scope boundary).
