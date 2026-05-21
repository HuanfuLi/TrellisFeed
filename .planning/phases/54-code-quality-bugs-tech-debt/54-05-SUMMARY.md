---
phase: 54
plan: "05"
subsystem: review-scheduling
tags: [tech-debt, testing, determinism, date-helpers, clock-injection]
requires: []
provides:
  - "lib/date.ts injectable clock: nowMs() / __setNowForTesting()"
  - "deterministic date-derived test suite (any wall-clock)"
affects:
  - app/src/lib/date.ts
  - app/src/services/review.service.ts
  - app/src/services/trellis-state.service.ts
tech-stack:
  added: []
  patterns:
    - "module-level injectable clock provider with TEST-ONLY setter; production default = Date.now()"
key-files:
  created:
    - .planning/phases/54-code-quality-bugs-tech-debt/54-05-SUMMARY.md
  modified:
    - app/src/lib/date.ts
    - app/src/services/review.service.ts
    - app/src/services/trellis-state.service.ts
    - app/tests/services/review-overdue.test.mjs
    - app/tests/services/trellis-state.test.mjs
    - app/tests/services/trellis-replant.test.mjs
decisions:
  - "Single source of 'now' for the date helpers is lib/date.ts nowMs(); services source 'now' through it rather than calling Date.now()/new Date() directly."
  - "Tests pin the clock to local noon (2026-05-20 12:00) — midnight-safe — and build expected dates with the SAME local helpers (addDays(today(), n)) so test and production read the identical pinned instant."
metrics:
  duration: ~15m
  completed: 2026-05-20
  tasks: 1
  files-changed: 6
---

# Phase 54 Plan 05: Injectable Clock for Deterministic Date Tests Summary

Introduced a single injectable clock into `lib/date.ts` and routed the
review-scheduling and trellis-state "now" sources through it, so seven
previously wall-clock-flaky tests now pass deterministically at any local/UTC
date skew.

## What was done

### Root cause
Seven tests failed ONLY when local time and UTC date differed (the EDT window
after UTC midnight). The tests built expected dates with
`new Date().toISOString().split('T')[0]` (UTC date), while production sources
"now" from `Date.now()`/`new Date()` and parses `YYYY-MM-DD` as LOCAL midnight
(`parseDateLocal`, `today`, `addDays`). When local=2026-05-20 but UTC=2026-05-21
they are off by one. Proven pre-existing on the untouched base commit.

### Source changes
- **`app/src/lib/date.ts`** — added the injectable clock (single source of "now"):
  - `let _nowMsProvider = () => Date.now();`
  - `export function nowMs(): number` accessor
  - `export function __setNowForTesting(ms: number | null): void` (null restores `Date.now()`)
  - `today()` now reads `new Date(nowMs())`; `getGreeting()` reads `new Date(nowMs()).getHours()`.
  - `parseDateLocal` / `addDays` / `formatDate` left as-is (they take explicit inputs).
- **`app/src/services/review.service.ts`** — imported `nowMs as clockNowMs`
  (alias avoids the clash with the param named `nowMs`). Both `daysOverdue` and
  `calcNextInterval` default their `nowMs` param to `clockNowMs()`. Bodies unchanged.
- **`app/src/services/trellis-state.service.ts`** — imported `today, nowMs`:
  - `computeDaysOverdue`: `new Date()` → `new Date(nowMs())`
  - blossom `daysSince`: `Date.now()` → `nowMs()`
  - the two blossom-date stamps: `new Date().toISOString().split('T')[0]` → `today()`
  - `computeLeafState` signature/logic otherwise unchanged.
- `trellis-actions.service.ts` already used `today()`+`addDays()` — no source change needed.

### Test changes (pin clock + build expected dates via local helpers)
- All three files import `{ today, addDays, __setNowForTesting }` from `lib/date.ts`
  and add `before(() => __setNowForTesting(new Date(2026, 4, 20, 12, 0, 0).getTime()))`
  / `after(() => __setNowForTesting(null))`.
- `review-overdue.test.mjs`: `isoOffset(n)` body → `return addDays(today(), n);`
  (the now-unused `ISO_MS_PER_DAY` const was part of the replaced block and removed).
- `trellis-state.test.mjs`: `daysAgo(n)` → `return addDays(today(), -n);`
  (preserves "daysAgo(-5) = 5 days in the future").
- `trellis-replant.test.mjs`: two inline yesterday computations →
  `const expectedYesterday = addDays(today(), -1);` (renamed the local `today`
  Date var away so it no longer shadows the imported `today()` function).

### Pin-instant rationale
2026-05-20 12:00 LOCAL → `today()`="2026-05-20"; `daysOverdue(addDays(today(),-3))`
gives due=local-midnight 05-17, now=noon 05-20 → `floor(3.5)=3`, exactly matching
`assert.equal(daysOverdue(isoOffset(-3)), 3)`.

## Verification

- `./node_modules/.bin/tsc -b --noEmit` → exit 0.
- Full suite (`npm test`, both chained runners): `test:main` 1486 pass / 0 fail;
  `test:actions` 149 pass / 0 fail; npm exit 0.
- The 7 named tests confirmed PASS:
  - review-overdue: "daysOverdue returns positive integer...", "Gap C: rating 3 on moderately-overdue...", "Gap C: penalty floors at 1 day..."
  - trellis-state: "worst-child-wins: one 14-day child...", "UAT Bug 1: anchor with 14-day overdue child + reviewCount=0 → dead"
  - trellis-replant: "replant bumps anchor reviewSchedule to dyingSchedule...", "replant bumps each QA child to dyingSchedule"
- `npm run lint` → 0 errors, 18 warnings (= existing baseline; no new warnings).
  `__setNowForTesting` is intentionally exported and consumed by the three tests.

## Deviations from Plan

None — implemented exactly as specified.

## Environment note

The worktree lacked `app/node_modules`; symlinked it from the main checkout
(`/Users/Code/EchoLearn/app/node_modules`) after confirming `package-lock.json`
is byte-identical to main. This is an env fix (gitignored), not a dependency
install. Tests run via Node 26's built-in TypeScript stripping under
`node --test` (no `tsx`/esbuild loader needed for these `.ts` imports);
actions tests use the existing `_actions-mock-loader.mjs`.

## Self-Check: PASSED
- app/src/lib/date.ts — FOUND
- app/src/services/review.service.ts — FOUND
- app/src/services/trellis-state.service.ts — FOUND
- 3 test files — FOUND (all modified)
- commit 4134b70e — to be verified after this SUMMARY commit
