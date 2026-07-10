# Phase 48 — Deferred Items (out-of-scope discoveries)

Per executor scope-boundary rule: only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing failures in unrelated files are logged here and **not** addressed inside this phase.

## Pre-existing test failures (predate Plan 48-01)

Verified by `git stash`-ing all Plan 48-01 changes and re-running each suite — failures persist with the same actual/expected values, confirming they are NOT caused by Plan 48-01.

| Test file | Failing test | Symptom | Likely root cause |
|-----------|--------------|---------|-------------------|
| `tests/concept-feed.test.mjs` | top-level import | `SyntaxError: ... does not provide an export named 'buildFallbackPosts'` | Test references a function that no longer exists on `concept-feed.service.ts`. Either the export was removed in a later refactor without updating the test, or the test predates a rename. |
| `tests/services/trellis-state.test.mjs:52` | leaf state computation | `actual: 'falling', expected: 'dead'` | The test's hardcoded `today()` expectation has drifted; state thresholds (`falling` at 7d overdue, `dead` at 14d) need a clock that matches the test's seed data. |
| `tests/services/trellis-replant.test.mjs:66, :89` | replant schedule bumps | `actual: '2026-05-16', expected: '2026-05-17'` | Hardcoded date strings in test fixtures — replant bumps to `yesterday()` (i.e. `today() - 1`); current run-day moves the target date relative to the seed. |

### Disposition

- **Not fixed in Phase 48** — none of these touch graph-command service, journal, or reorg prompt code paths.
- **Recommendation:** address in a follow-up housekeeping plan that updates test fixtures to use `today()`-relative dates rather than hardcoded strings. Concept-feed test needs an import update against the current `concept-feed.service.ts` exports.
- **Total pre-existing failures:** 4 tests across 3 files; full suite remains 981/985 pass (the 4 failures listed above).
- **Plan 48-01 own tests:** 29 / 29 pass (21 in `graph-edit-journal.test.mjs`, 8 in `reorg-prompt-journal-injection.test.mjs`).
