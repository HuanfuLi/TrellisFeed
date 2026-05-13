# Phase 45 TSC Audit

## Commands

| Command | Working directory | Exit code | Concise result |
|---|---|---:|---|
| `npx tsc -b --noEmit --pretty false` | `app/` | 0 | TypeScript project references type-check cleanly with no emitted diagnostics. |
| `npx tsc --showConfig -p tsconfig.app.json` | `app/` | 0 | Resolved app config confirms strict mode, unused checks, erasable syntax, and side-effect import checks are enabled. |
| `npm run lint` | `app/` | 0 | ESLint reports 27 warnings and 0 errors; warnings are mostly console diagnostics plus three stale-disable warnings. |
| `npm run lint -- --report-unused-disable-directives` | `app/` | 1 | ESLint escalates the three stale disable directives to errors while preserving 24 remaining warnings. |

## Current Strictness State

Resolved from `app/tsconfig.app.json` and `npx tsc --showConfig -p tsconfig.app.json`:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `erasableSyntaxOnly: true`
- `noUncheckedSideEffectImports: true`

Phase 45 starts from a strict TypeScript baseline. There is no broad "enable strict" task to perform before inventory closure.

## Strict-Adjacent Flags

| Flag | Current state | Phase 45 classification | Rationale |
|---|---|---|---|
| `exactOptionalPropertyTypes` | Not present in resolved app config | audit-only in Phase 45 unless command output proves a genuinely small diff | D-04 prohibits opportunistic strictness expansion; enabling this can cascade through optional React props and persisted snapshot interfaces. |
| `noUncheckedIndexedAccess` | Not present in resolved app config | audit-only in Phase 45 unless command output proves a genuinely small diff | D-04 prohibits broad churn; this flag often requires widespread array/map guard edits across feed, graph, and source-reading-heavy code. |

## Lint Suppression Findings

Evidence source: `npm run lint -- --report-unused-disable-directives`.

| Location | Finding | Classification | Phase 45 action |
|---|---|---|---|
| `app/src/components/SwipeTabContainer.tsx:169` | Unused `eslint-disable` directive for `no-console`. | stale workaround | Remove in a later cleanup task and rerun lint. |
| `app/src/screens/HomeScreen.tsx:502` | Unused `eslint-disable` directive for `react-hooks/exhaustive-deps`. | stale workaround | Remove in a later cleanup task and rerun HomeScreen/source-reading tests. |
| `app/src/state/useTrellisData.ts:24` | Unused `eslint-disable` directive for `no-console`. | stale workaround | Remove in a later cleanup task and rerun lint. |

Additional lint warnings are not suppressions: 24 warnings remain after unused-disable errors are counted, mostly `no-console` diagnostics and React hook dependency warnings. Those belong to later scoped cleanup decisions, not Task 1 source edits.

## In-Scope Fixes

- Remove the three stale disable directives identified above.
- Re-run `npm run lint -- --report-unused-disable-directives` after removal to confirm the stale-disable error count drops to zero.
- Triage remaining console and hook warnings only where a local, behavior-preserving fix is obvious.

## Deferred With Rationale

- Do not enable `exactOptionalPropertyTypes` in this inventory task; the diff has not been proven small and D-04 requires audit-first treatment.
- Do not enable `noUncheckedIndexedAccess` in this inventory task; array and map access semantics are broad across the feed, graph, and services.
- Do not rewrite React hook dependencies from warnings alone; several always-mounted-screen effects are load-bearing and need source-specific tests before lifecycle changes.

## Decision Coverage

- D-01 is represented by this audit-first artifact before source-code cleanup.
- D-04 is represented by the strict-adjacent flag audit-only classifications above.
