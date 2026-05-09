---
phase: 37-i18n-leaf-module-refactor
plan: 01
subsystem: testing
tags: [i18n, i18next, leaf-module, node-test, esm, json-import-attributes, typescript]

# Dependency graph
requires:
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    provides: leaf-module pattern (refill-mutex.ts, feed-spread.ts) that Phase 37 generalizes for i18n
  - phase: 27-add-i18n-l10n-support
    provides: i18next singleton + 4 locale bundles + applyLocaleDirective; Phase 37 preserves all D-07/D-12 semantics
provides:
  - "src/lib/i18n-leaf.ts shim with t/getCurrentLocale/bindI18nLeaf API (D-01)"
  - "Identity defaults for tests (D-05): t(key) returns key, getCurrentLocale() returns 'en'"
  - "Production wire in main.tsx — bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language) after locales import, before migrateLegacyKeys"
  - "Smoke test (4 assertions) covering identity defaults, rebinding, opts pass-through"
  - "Infrastructure for Plan 37-02 (Tier 1+2 service migrations) and Plan 37-03 (Tier 3 already-leaf migrations + invariant test)"
affects:
  - 37-02-tier-1-2-service-migrations (consumes the shim — closes 10 carried test failures)
  - 37-03-tier-3-leaf-modules-and-invariant (consumes the shim + adds source-reading invariant)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — pure refactor with closure-captured module-private state
  patterns:
    - "Closure-captured module-private state (D-02): module-scope `let` bindings hold bound t/locale; bindI18nLeaf rebinds; defaults to identity"
    - "Production wire AFTER locale init (D-04 / Pattern 2): bindI18nLeaf called after `import i18n from './locales'` evaluates and before any service that might transitively read t() runs"
    - "Leaf-module-with-binder generalization of Phase 36's leaf-module-without-binder (refill-mutex, feed-spread)"

key-files:
  created:
    - "app/src/lib/i18n-leaf.ts (60 lines including comment block — leaf module with zero locales/i18next deps)"
    - "app/tests/lib/i18n-leaf.test.mjs (44 lines — 4 smoke assertions covering identity, rebind, opts pass-through)"
  modified:
    - "app/src/main.tsx (changed line 4 from side-effect-only import to default import; added bindI18nLeaf import + invocation lines 10 + 19)"

key-decisions:
  - "Cast i18n.t.bind(i18n) as any at the bind site to bridge i18next's literal-key-union type (from i18n.d.ts module augmentation) and the leaf's intentionally-widened TFn signature. Cast erases compile-time narrowness only; runtime behavior is byte-stable. Single-line cast preserves the plan's `bindI18nLeaf(i18n.t.bind(i18n)` regex pattern."

patterns-established:
  - "Leaf-with-binder pattern: a leaf module exposes identity defaults + a one-shot binder so production wires the live singleton at boot while tests use defaults with no setup (Phase 36's leaf modules lacked binders since they had no equivalent singleton dependency)"
  - "TypeScript type-augmentation bridge: when a downstream module-augmented type is too narrow to assign to a generic shim signature, prefer a single `as any` cast at the bind site over weakening the shim's exported types (consumers retain narrow typing through the shim's TFn alias)"

requirements-completed: []  # TECHDEBT-01 covers the FULL Phase 37 (3 plans). Plan 37-01 ships infrastructure only — Plan 37-02 closes the 10 carried failures (the requirement's measurable acceptance), Plan 37-03 closes the source-reading invariant. Mark TECHDEBT-01 complete only after Plan 37-03 lands.

# Metrics
duration: 13min
completed: 2026-05-09
---

# Phase 37 Plan 01: i18n Leaf Shim and main.tsx Wire Summary

**Created `src/lib/i18n-leaf.ts` indirection shim (t / getCurrentLocale / bindI18nLeaf) + wired the live i18next singleton from main.tsx — closes the leaf-module infrastructure that Plans 37-02/03 will use to break the ERR_IMPORT_ATTRIBUTE_MISSING chain on src/locales/*.json static imports.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-09T00:13:30Z (approx — first file created)
- **Completed:** 2026-05-09T00:26:43Z
- **Tasks:** 2
- **Files modified:** 3 (2 created + 1 edited)
- **Commits:** 2 atomic per-task commits

## Accomplishments

- Shipped the canonical `src/lib/i18n-leaf.ts` shim with the minimal D-01 API surface (`t`, `getCurrentLocale`, `bindI18nLeaf`). Zero transitive deps on `src/locales/*.json`, zero direct import of `i18next` — both negative-grep verified.
- Smoke test (4 assertions) verifies: identity default for `t(key)`, identity default for `getCurrentLocale()`, `bindI18nLeaf` rebinds both, opts pass-through to bound function. All 4 green under `node --test tests/lib/i18n-leaf.test.mjs`.
- Production wire in `main.tsx`: changed `import './locales'` (side-effect-only) → `import i18n from './locales'` (default — leveraging the existing `export default i18n` at `src/locales/index.ts:55`), added `import { bindI18nLeaf } from './lib/i18n-leaf'`, added `bindI18nLeaf(i18n.t.bind(i18n) as any, () => i18n.language)` invocation. Placement satisfies all positional invariants: AFTER the locales default import (so `i18n.t` is bound to a fully-initialized instance), BEFORE `migrateLegacyKeys()` and `applyTheme(...)` (so any service those call paths transitively hit reads the bound `t`, not identity).
- Carried 10 ERR_IMPORT_ATTRIBUTE_MISSING test failures stay red exactly as designed — Plan 37-01 is infrastructure only; Plan 37-02 will close them by migrating the 5 Tier 1+2 service-file consumers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create i18n-leaf shim + smoke test** — `4e72565a` (feat)
2. **Task 2: Wire leaf shim into main.tsx production boot** — `04056289` (feat)

_Note: No TDD red-then-green split for these tasks. The shim is a single self-contained surface; the smoke test was authored alongside it. Atomic-pair shipping (per Plan 37-01 plan_notes rationale) — shipping the test alone would fail; shipping the source alone leaves the hold-out unverifiable._

## Files Created/Modified

- `app/src/lib/i18n-leaf.ts` (NEW, 60 lines) — leaf shim with closure-captured module-private state. Comment block documents production binding contract, test identity defaults, consumer-side rules (no top-level calls), and the Phase 32.1 lesson #8 three-places-documentation principle. Three exports: `bindI18nLeaf` (binder), `t` (translation indirection), `getCurrentLocale` (locale-code reader).
- `app/tests/lib/i18n-leaf.test.mjs` (NEW, 44 lines) — 4 smoke tests using `node:test`. Resets to identity at end of stateful tests so the bound state doesn't leak across tests in the same process.
- `app/src/main.tsx` (MODIFIED) — diff:
  - Line 4 BEFORE: `import './locales';`
  - Line 4 AFTER: `import i18n from './locales';`
  - Line 10 NEW: `import { bindI18nLeaf } from './lib/i18n-leaf';`
  - Lines 12-19 NEW: comment block + `bindI18nLeaf(i18n.t.bind(i18n) as any, () => i18n.language);` invocation
  - migrateLegacyKeys call moved from line 13 to line 23 (positional-only shift from inserted code; logic unchanged)

## Decisions Made

- **Cast `i18n.t.bind(i18n) as any` at the bind site.** i18next's `t` method has a heavily-narrowed signature from `i18n.d.ts` module augmentation (1278+ literal-key union for type-safe `t()` calls — confirmed by tsc error during initial wire attempt). The leaf's exported `TFn` signature uses generic `string` so any caller can pass any key. Two alternatives were considered: (1) widen `TFn` to accept the union — rejected because the union is auto-generated from bundle keys, would couple the shim to bundle internals, and consumers calling `t('any.dynamic.key')` from services would still need a cast. (2) Wrap `i18n.t` in a closure that re-types at the boundary — rejected because the wrapper adds a function-call hop on every `t()` invocation in production for zero functional gain. Chose `as any` at the single bind site with `eslint-disable-next-line` comment + 4-line explanation comment so future agents understand the bridge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript type mismatch on `bindI18nLeaf(i18n.t.bind(i18n), ...)` invocation**
- **Found during:** Task 2 (main.tsx wire)
- **Issue:** `tsc -b --noEmit` failed with `error TS2345: Argument of type 'TFunction<["translation", ...never[]], undefined>' is not assignable to parameter of type 'TFn'.` i18next's bound `t` has a literal-union key type from i18n.d.ts module augmentation (Phase 27 D-08 type-safety mechanism — verified at `app/src/locales/i18n.d.ts`); leaf's `TFn` uses `string`. Without resolution, Plan 37-01's compile-gate verification could not pass.
- **Fix:** Added `as any` cast at the single bind site with `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and a 4-line explanatory block above. The cast erases only compile-time narrowness; runtime behavior is byte-stable (verified by 558 tests / 548 pass / 10 fail — same baseline as pre-Plan-37, no regression).
- **Files modified:** `app/src/main.tsx` (lines 14-19 — comment block + cast)
- **Verification:** `cd app && npx tsc -b --noEmit; echo "tsc exit $?"` returns `tsc exit 0`. The plan's key_links pattern `bindI18nLeaf\\(i18n\\.t\\.bind\\(i18n\\)` still matches (`grep -n "bindI18nLeaf(i18n.t.bind(i18n)" src/main.tsx` returns line 19).
- **Committed in:** `04056289` (Task 2 commit — same commit as the wire itself)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking compile error)
**Impact on plan:** The cast is a single-site bridge between i18next's auto-generated narrow type and the shim's intentionally-generic API. No scope creep — the alternative (widening `TFn`) would couple the shim to bundle internals and require parallel `as any` casts at every dynamic-key consumer. Plan's regex invariant preserved by keeping the cast on a single line.

## Issues Encountered

- None beyond the deviation logged above. The plan's two tasks executed as written; the only adjustment was the `as any` cast forced by tsc's strictness against module-augmented i18next types.

## Authentication Gates

None — pure refactor with no external service interaction.

## Verification Results

- `cd app && node --test tests/lib/i18n-leaf.test.mjs` → 4 pass / 0 fail (smoke test green)
- `cd app && npx tsc -b --noEmit; echo "exit $?"` → `exit 0` (compile gate green)
- `cd app && npm test` → test:main 558/548/10, test:actions 16/14/2 (TOTAL 12 fail — IDENTICAL to pre-Plan-37 baseline; 10 ERR_IMPORT_ATTRIBUTE_MISSING from the i18n chain + 2 pre-existing date-dependent trellis-replant failures unrelated to Phase 37). Plan 37-02 will close the 10 chain failures.
- `grep -c "bindI18nLeaf" app/src/main.tsx` → `2` (1 import + 1 invocation)
- `grep -E "^\s*import\s+['\"]\\./locales['\"];?\\s*$" app/src/main.tsx` → no match (side-effect-only import is gone)

## Pre-existing Carried Failures (handed off to Plan 37-02)

The 10 currently-failing tests rooted in `flashcard.service.ts → ../locales/index.ts → en.json` static-import chain remain RED at Plan 37-01 close. This is the documented hand-off:

1. `tests/concept-feed.test.mjs` (entire file fails to import)
2-3. `tests/e2e/trellis-review-update.test.mjs:37,61`
4. `tests/services/trellis-layout.test.mjs:64`
5-10. `tests/services/trellis-state.test.mjs:37,44,52,61,70,78`

Plan 37-02 commit 1 (`flashcard.service.ts` → leaf migration) breaks the chain at the root and turns ALL 10 green simultaneously per RESEARCH § Hold-Out Tests.

## User Setup Required

None — no external service configuration required. Locale-switch UAT (EN→ZH→ES→JA) is deferred to the Plan 37-03 phase-gate (full migration complete).

## Next Phase Readiness

- Infrastructure ready for Plan 37-02: services can `import { t } from '../lib/i18n-leaf'` and call `t('common.toast.X')` instead of `i18n.t('common.toast.X')`.
- Production binding verified at boot via tsc + same-baseline test count (no regression).
- Identity defaults verified for tests via the smoke test — Plan 37-02's per-service test runs will inherit zero-setup identity behavior.

## Self-Check: PASSED

All claimed artifacts verified:

- `app/src/lib/i18n-leaf.ts` exists (FOUND)
- `app/tests/lib/i18n-leaf.test.mjs` exists (FOUND)
- `app/src/main.tsx` modified with bindI18nLeaf invocation (FOUND)
- Commit `4e72565a` exists in git log (FOUND — `feat(37-01): add i18n-leaf shim + smoke test`)
- Commit `04056289` exists in git log (FOUND — `feat(37-01): wire i18n-leaf in main.tsx production boot`)
- Smoke test 4/4 green (VERIFIED via final post-Task-2 run)
- tsc -b --noEmit exit 0 (VERIFIED)
- Test baseline preserved at 12 failures (VERIFIED — 10 chain + 2 unrelated date-dependent)

---
*Phase: 37-i18n-leaf-module-refactor*
*Plan: 01-i18n-leaf-shim-and-wire*
*Completed: 2026-05-09*
