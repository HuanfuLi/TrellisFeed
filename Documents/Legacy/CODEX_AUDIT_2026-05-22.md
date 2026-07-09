# Codex Audit — May 22, 2026

Status: complete
Branch: `codex/work-2026-05-22`
Completed: 2026-05-22

## Objective

Audit the codebase for bugs/errors, validate candidates against project docs/specs, fix legitimate issues, document each round, then repeat until no new CRITICAL/HIGH/MEDIUM issues are found.

## Round 1

### Audit Inputs

- `npm run lint`
- `npm run build`
- `npm run test:actions`
- `node --test --test-reporter=dot ...` using the `test:main` file selection
- Focused UAT/verification docs:
  - `.planning/phases/55.1-device-test-bug-fixes/55.1-VERIFICATION.md`
  - `.planning/phases/55.1-device-test-bug-fixes/55.1-HUMAN-UAT.md`
  - `.planning/phases/54-code-quality-bugs-tech-debt/54-RESEARCH.md`
  - `.planning/phases/54-code-quality-bugs-tech-debt/54-VERIFICATION.md`
  - `.planning/debug/resolved/cold-start-warm-start-fragile.md`
  - `.planning/debug/resolved/duplicate-post-keys-after-force-new-day.md`

### Findings And Fixes

| ID | Severity | Finding | Validation | Fix |
|---|---|---|---|---|
| R1-F1 | MEDIUM | `npm run lint` failed on `app/src/services/text-art-fragment.ts` because the CJK regex used literal irregular whitespace/range characters. | Phase 55.1 docs require a CJK-aware text-art fragment predicate, so the predicate was legitimate; only the literal regex spelling violated lint. | Replaced the literal range with equivalent ASCII `\u...` escapes, preserving CJK behavior. |
| R1-F2 | HIGH | Force-New-Day could no-op in U.S. evening hours because `SettingsDataScreen` computed yesterday with UTC `toISOString().slice(0, 10)` while `postQueueService` compares local `YYYY-MM-DD`. The same mismatch made `post-queue-remove-by-id.test.mjs` fail. | Phase 36/43 docs require Force-New-Day to roll the queue date back so warm-start and yesterday snapshot paths run. Service code uses local date formatting. | Changed Force-New-Day to `addDays(today(), -1)` and updated tests to guard local-calendar semantics. |

### Verification

- Focused queue/settings regression suite: 58 pass, 0 fail.
- Text-art focused suite: 15 pass, 0 fail.
- `npm run test:actions`: 149 pass, 0 fail.
- `test:main` equivalent with compact reporter: exit 0.
- `npx tsc -b --noEmit`: exit 0.
- `npm run lint`: exit 0, 31 warnings, 0 errors.
- `npm run build`: exit 0.

### Non-Fixed / Classified Out

- Existing lint warnings are still present but are warning-level only. Phase 54 docs classify several as low/accepted diagnostic or hook-dependency debt, and the current lint gate is 0 errors.
- Phase 55.1 GAP-B remains pending device re-test in `55.1-HUMAN-UAT.md`; the automated code audit did not produce a new actionable code defect beyond existing pending manual verification.

## Round 2

### Audit Inputs

- `git diff --check`
- `npm run lint`
- `npx tsc -b --noEmit`
- `npm run build`
- Source scan for the UTC rollback pattern in Force-New-Day / post queue files
- Source scan for TODO/FIXME/stub/placeholder/NOT_IMPLEMENTED patterns in `app/src`
- Verification/UAT scan for open/pending CRITICAL/HIGH/MEDIUM-style items
- Focused graph-command implementation tests for the only suspicious `NOT_IMPLEMENTED` scan result

### Findings

No new CRITICAL/HIGH/MEDIUM actionable code issues found.

### Validation Notes

- The Force-New-Day UTC rollback pattern is gone from `SettingsDataScreen` and its queue regression test.
- The graph-command `NOT_IMPLEMENTED` scan result is stale comment/type-union residue, not a live unimplemented command. `graph-command-service.undo.test.mjs` asserts there is no remaining `code: 'NOT_IMPLEMENTED'` method-body branch, and the focused graph-command suite passed 67/67.
- Existing lint warnings remain warning-level only. They do not fail the configured lint gate and were classified as accepted/low or diagnostic debt in Phase 54 docs.
- Phase 55.1 GAP-A is documented as skipped/won't-fix due to Android WebView platform limits. GAP-B is already re-fixed structurally and remains pending device re-test; no additional code defect was found by the automated audit.

### Verification

- `git diff --check`: exit 0.
- `npm run lint`: exit 0, 31 warnings, 0 errors.
- `npx tsc -b --noEmit`: exit 0.
- `npm run build`: exit 0.
- Force-New-Day UTC rollback scan: no matches.
- Focused graph-command suite: 67 pass, 0 fail.

## Current Conclusion

After two audit rounds, all validated CRITICAL/HIGH/MEDIUM actionable code issues found by the audit were fixed and verified. No new CRITICAL/HIGH/MEDIUM actionable code issues were found in Round 2.
