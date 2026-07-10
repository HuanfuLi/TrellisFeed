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

## Plan 45-02 Task 1 Closure

| Location | Closure evidence | Status |
|---|---|---|
| `app/src/components/SwipeTabContainer.tsx` | Plan 45-02 Task 1 closure — removed stale `no-console` disable before allowed `console.warn('[SwipeTabContainer] stripX drift', ...)`. | closed |
| `app/src/screens/HomeScreen.tsx` | Plan 45-02 Task 1 closure — removed unused `react-hooks/exhaustive-deps` disable from the mount-only gesture listener effect; effect body unchanged. | closed |
| `app/src/state/useTrellisData.ts` | Plan 45-02 Task 1 closure — removed stale `no-console` disable before allowed `console.warn('[useTrellisData] recompute failed', err)`. | closed |

## Plan 45-02 Task 2 Closure

- `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` — Plan 45-02 Task 2 closure: source-reading counterweight now asserts canonical `walkDerivedList(24, exploredIds, dismissedIds)`.
- `app/tests/services/post-queue.test.mjs` — Plan 45-02 Task 2 closure: `needsRefill` threshold expectation now uses canonical `24`.
- `app/tests/services/image-gen-key-gate.test.mjs` — Plan 45-02 Task 2 closure: source-reading checks now pin `const imageGenEnabled = settings.imageGeneration?.enabled !== false;` and `imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent)`.
- `app/tests/services/trellis-layout.test.mjs` — Plan 45-02 Task 2 closure: `getVineColor` expectation now imports and asserts against `VINE_COLOR_VARS`.

## Plan 45-02 Task 3 Closure

| Location | Closure evidence | Status |
|---|---|---|
| `app/src/services/concept-feed.service.ts` | Plan 45-02 Task 3 closure — direct same-directory local imports now use `.ts` suffixes for Node `node --test` compatibility, including `./youtube.service.ts`, `./web-search.service.ts`, `./post-queue.service.ts`, and `./feed-spread.ts`. | closed |

| Follow-up | Evidence | Status |
|---|---|---|
| `app/src/services/concept-feed.service.ts` / `app/tests/concept-feed.test.mjs` | Plan 45-02 Task 3 follow-up — after the extensionless import blocker was closed, `node --test tests/concept-feed.test.mjs` reaches module instantiation and fails because `concept-feed.service.ts` does not export `buildFallbackPosts`; the helper was intentionally removed by commit `72f4795c` ("Removed fallback posts"). | deferred |

## Plan 45-03 Task 2 suppression disposition

Final suppression dispositions are now tracked in
`45-TODO-TRIAGE.md`. The key outcomes:

- `main.tsx` i18n leaf cast is finalized as `justified-permanent-guard`
  because it is an i18next t overload bridge.
- `providers/llm/index.ts` SSE parse/extract `any` usage is finalized as
  `justified-permanent-guard` because it is a provider JSON payload boundary.
- `TrellisLeaf.tsx` `shakeControls` loose typing is finalized as
  `justified-permanent-guard` because the framer-motion control shape accepts
  variant objects and test spies share only the `start` contract.
- `settings.service.ts` dynamic merge `any` remains a narrowable local typing
  issue, but its Final Disposition is `deferred-v1.6` until merge-behavior
  tests can cover a typed helper.

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
