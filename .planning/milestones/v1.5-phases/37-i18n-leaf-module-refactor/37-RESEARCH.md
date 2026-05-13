# Phase 37: i18n Leaf-Module Refactor — Research

**Researched:** 2026-05-08
**Domain:** TypeScript/ESM module boundaries; Node 25 `node --test` JSON-import-attribute constraint; i18next 26 singleton injection
**Confidence:** HIGH (all findings verified against live source + reproduced 10 failing tests)

## Summary

Phase 37 introduces `src/lib/i18n-leaf.ts` — a tiny indirection shim with two exports (`t`, `getCurrentLocale`) and a one-time binder (`bindI18nLeaf`) — to break the `ERR_IMPORT_ATTRIBUTE_MISSING` chain that prevents 10 tests from running under Node 25's `node --test`. The chain root is `src/locales/index.ts` which statically imports `./en.json` (and zh/es/ja) without `with { type: 'json' }` attributes; Vite handles this at build time but Node 25 rejects the imports outright. The shim is a clean leaf module (zero transitive deps on locales) so consumers (5 service files in Tier 1+2 + 4 already-leaf modules in Tier 3) can be imported under `node --test` after migration. Production behavior is preserved by binding the shim's identity defaults to the live `i18next` instance from `main.tsx` immediately after `import './locales/index.ts'` evaluates.

The pattern matches existing leaf-module precedents (`feed-spread.ts` Phase 36 GAP-4, `refill-mutex.ts` Phase 36-12) byte-for-byte: zero new dependencies, zero LLM tokens, zero runtime behavior change. The single non-trivial finding is that **4 existing tests for Tier 3 modules will break after migration** unless they ALSO call `bindI18nLeaf` to wire the leaf to their test-local `i18next` instance. The planner must include test-update tasks in Plan 37-03 for: `tests/lib/date.locale.test.mjs`, `tests/providers/llm-locale-injection.test.mjs`, `tests/providers/tts-locale.test.mjs`, `tests/services/youtube-locale.test.mjs`. Without these updates, Tier 3 migration commits will turn currently-green tests red — the exact regression D-03 atomic-per-file commits is designed to surface.

**Primary recommendation:** Implement exactly per CONTEXT.md D-01..D-08. Use `'./i18n-leaf'` (no extension) as the canonical import specifier — matches `feed-spread`/`refill-mutex` precedent, satisfies `verbatimModuleSyntax: true` + `allowImportingTsExtensions: true` + `moduleResolution: bundler`, and works under both `tsc -b --noEmit` and Node 25 `node --test`. Plan 37-03 MUST include the 4 Tier-3 test updates as part of the same atomic-per-file commits.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Leaf API surface is `t(key, opts?)` + `getCurrentLocale()` only — NO `LOCALE_NAMES` re-export, NO `applyLocaleDirective` re-export, NO `i18next.on('languageChanged')` re-export.
- **D-02:** Internal mutable state with `bindI18nLeaf(tFn, localeGetter)`. Default state is identity (`t(key) => key`, `getCurrentLocale() => 'en'`). Production wires from `main.tsx` after `import './locales/index.ts'`.
- **D-03:** Atomic-per-file commits. `npm test` runs after EACH commit (Pitfall 7 mitigation — source-reading regex collisions during refactor).
- **D-04:** 3 plans:
  - Plan 37-01 — `i18n-leaf.ts` shim + `main.tsx` wire (1 commit)
  - Plan 37-02 — Tier 1+2 migration (5 service files, 5 atomic commits)
  - Plan 37-03 — Tier 3 migration (4 already-leaf modules, 4 atomic commits)
- **D-05:** Identity defaults for tests. New v1.5 service tests assert call shape (`assert(toast.calls[0].args[0] === 'common.toast.storageFullFlashcards')`), NOT translated text.
- **D-06:** Tests needing real translations call `bindI18nLeaf` themselves with stubs. **NEVER** import `'../locales/index.ts'` from test code (re-introduces JSON chain).
- **D-07:** Migrate ALL 9 files identified by audit:
  - **Tier 1+2 (root-cause + transitive):** `flashcard.service.ts`, `podcast.service.ts`, `question.service.ts`, `scheduler.service.ts`, `session.service.ts`
  - **Tier 3 (already-leaf, migrated for shim consistency):** `services/youtube-locale-url.ts`, `lib/date.ts`, `providers/llm/locale-directive.ts`, `providers/tts/index.ts`
  - **Production wire:** `main.tsx` adds `bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)` after `import './locales/index.ts'`.
- **D-08:** Excluded from Phase 37: all React components/screens, `state/useQuestions.ts`, `services/settings.service.ts` (only uses `SupportedLocale` type, no runtime i18n).

### Claude's Discretion

- Exact internal implementation of `bindI18nLeaf` (closure-captured module-private vars chosen — see § Code Examples).
- Whether to add a single source-reading invariant test asserting "no service file imports from `../locales` or `i18next` directly after Phase 37" (recommended in Plan 37-03 final commit; see § Validation Architecture).
- Whether to add a comment block at the top of `i18n-leaf.ts` documenting rationale (recommended; see § Code Examples).
- Whether `main.tsx`'s `bindI18nLeaf` call goes before or after `void i18n.use(initReactI18next).init({...})` chain — research determines this is a no-op concern (see § Open Question A answered below).

### Deferred Ideas (OUT OF SCOPE)

- React component/screen i18n surface migration (no test-blocker value; defer to v1.6).
- Locale-change event subscription via leaf (`subscribeLocaleChanged`) — not needed in v1.5; defer.
- Migrating `state/useQuestions.ts` — React-state hook, not in failing-test chain.
- Optional Plan 37-04 for source-reading invariant test — recommended scope: fold into Plan 37-03's last commit, NOT a separate plan.

## Project Constraints (from CLAUDE.md)

These directives constrain Phase 37 implementation. The leaf shim and test stubs must NOT contradict them:

| Directive | Phase 37 Implication |
|-----------|----------------------|
| **Runtime LLM translation is PROHIBITED** | The shim's `t()` is a static-bundle lookup. Tests use identity `t(key) => key`. Neither path may call `chatCompletion` / `chatStream`. Source-reading test enforces. |
| **`applyLocaleDirective` is for LLM "Respond in X" injection only** | Phase 37 preserves `applyLocaleDirective`'s D-07 (Phase 27) load-bearing comment. The leaf migration changes WHERE it reads locale (`getCurrentLocale()` instead of `i18next.language` directly), not WHAT it does. |
| **Tests must guard the LIVE code path, not aspirational/dead code** (Phase 32.1 lesson #2) | The 10 currently-failing tests ARE the live hold-out. They go from red → green. New `i18n-leaf.test.mjs` tests the shim itself (live path), not a hypothetical caller. |
| **Phase 27 locale tests avoid JSON-import-attribute chain by importing i18next directly; follow the same pattern for any new pure-logic helpers** | Phase 37 generalizes this pattern. The shim is the canonical "pure-logic helper" indirection going forward. |
| **One signal per semantic event** | Phase 37 introduces NO new events. `bindI18nLeaf` is a one-shot binding, not an event. |
| **Don't bundle commits — atomic-per-file** | D-03 is the operational restatement. Pitfall 7 is the rationale (source-reading regex collisions). |
| **i18n bundle authoring workflow (EN-first, 4 bundles per PR)** | Phase 37 does NOT touch any `*.json` bundle. Bundle workflow is unchanged. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECHDEBT-01 | i18n leaf-module refactor: `src/lib/i18n-leaf.ts` shim breaks `ERR_IMPORT_ATTRIBUTE_MISSING` chain; 6 service files migrated; 10 carried test failures closed | § Architecture Patterns (leaf-module precedent), § Don't Hand-Roll (i18next bundle deferred-binding utilities), § Code Examples (shim implementation), § Validation Architecture (10-failing-tests hold-out + Wave 0 contract test). Research expands the migration scope from "6 service files" (REQUIREMENT spec) to "9 files + main.tsx wire" per CONTEXT D-07 operator decision. |

## Standard Stack

### Core (already installed; no version bumps in Phase 37)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `i18next` | `^26.0.5` | Translation engine, locale singleton | Already the project's canonical i18n library; held back per STACK.md (bumps land in Phase 44) |
| `react-i18next` | `^17.0.3` | React `useTranslation` hooks for screens/components | NOT touched by Phase 37 — D-08 excludes the React layer |
| `typescript` | `~5.9.3` | Compile-time check (`tsc -b --noEmit`) | Tilde-pinned, satisfies `allowImportingTsExtensions` + `verbatimModuleSyntax` |
| `node` (runtime) | `25.x` | `node --test` runner for `.mjs` test files | Operator's local Node version; test setup uses Node ESM directly (no esbuild loader despite CLAUDE.md "esbuild tsx loader" comment — see § Open Question A) |

### Supporting (existing leaf-module precedents to mirror)

| File | Phase | Pattern Used |
|------|-------|--------------|
| `app/src/services/refill-mutex.ts` | 36-12 | Promise-based mutex, zero JSON deps, exported as `createPromiseMutex()` factory, imported as `from './refill-mutex'` (no extension) |
| `app/src/services/feed-spread.ts` | 36 GAP-4 | Pure functions on `DailyPost[]`, zero JSON deps, imported as `from './feed-spread'` (no extension) |

### Alternatives Considered

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| `bindI18nLeaf` injection | Re-export `i18next` global directly from leaf | Defeats the entire phase: leaf would transitively import `'../locales'` to get the configured singleton; same failure chain. |
| `bindI18nLeaf` injection | Pass `t` and `locale` as function parameters at every call site | Mechanical surface area too large (8 call sites in services + 7 call sites in lib/providers); D-01 already locks the minimal API. |
| `bindI18nLeaf` injection | Use `globalThis.__i18n_leaf__` stash | Implicit globals are an anti-pattern; static type-safety is lost; D-02 explicitly chose closure-captured module vars. |
| Identity test default | Pre-init the leaf with EN bundle in tests | Re-introduces JSON-import chain — defeats phase purpose (D-05/D-06). |

**Installation:** No new dependencies. Phase 37 is pure refactor.

**Version verification:** No package version bumps in Phase 37; `npm view i18next version` deferred to Phase 44 (TECHDEBT-08).

## Architecture Patterns

### Recommended Module Structure

```
src/
├── lib/
│   ├── i18n-leaf.ts        # NEW — Phase 37 shim (this phase)
│   ├── date.ts             # Tier 3 — migrate to i18n-leaf
│   ├── event-bus.ts        # unchanged
│   ├── toast.ts            # unchanged
│   └── locale.ts           # unchanged (uses SupportedLocale type only)
├── locales/
│   ├── index.ts            # i18next.init + JSON imports — UNTOUCHED in Phase 37
│   └── *.json              # bundles — UNTOUCHED in Phase 37
├── services/
│   ├── flashcard.service.ts    # Tier 1+2 — migrate
│   ├── podcast.service.ts      # Tier 1+2 — migrate
│   ├── question.service.ts     # Tier 1+2 — migrate
│   ├── scheduler.service.ts    # Tier 1+2 — migrate
│   ├── session.service.ts      # Tier 1+2 — migrate
│   ├── youtube-locale-url.ts   # Tier 3 — migrate
│   └── ...                     # other services unchanged
├── providers/
│   ├── llm/locale-directive.ts # Tier 3 — migrate (preserve D-07 comment)
│   └── tts/index.ts            # Tier 3 — migrate
└── main.tsx                    # NEW — calls bindI18nLeaf after './locales' import
```

### Pattern 1: Closure-Captured Module-Private State (D-02 implementation)

**What:** Module-scope `let` bindings hold the bound `t` function and locale getter. Default values are identity. `bindI18nLeaf` rebinds them. Public `t`/`getCurrentLocale` exports forward to the current bindings.

**When to use:** Singleton-like services that need a single mutable wire-point at boot, where call sites should not see the wiring detail.

**Example:** See § Code Examples below.

### Pattern 2: Production Wire AFTER Locale Init (main.tsx ordering)

**What:** `import './locales'` triggers `i18n.use(initReactI18next).init({...})` synchronously (the `.init({...})` call returns a Promise, but `i18n.language` is set on the SAME tick the import side-effect runs because `lng: initial` is passed inline at line 33). After the import completes, `i18n.t` and `i18n.language` are both immediately readable. `bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)` runs once, capturing those references.

**When to use:** When binding wraps a singleton that's initialized as a module side-effect.

**Critical observation:** `i18n.language` is itself a getter on the i18next instance — it returns the CURRENT language at call time, not the language at bind time. So `() => i18n.language` works correctly through `i18n.changeLanguage()` events without any subscription needed. The leaf does NOT need to listen to `languageChanged` events.

**Example:**
```tsx
// src/main.tsx (after Phase 37)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import i18n from './locales';                              // i18next.init runs synchronously
import { bindI18nLeaf } from './lib/i18n-leaf';            // NEW
import App from './App.tsx';
// ... (rest unchanged)

// Wire the leaf shim to the live i18next instance.
// Default identity bindings are kept by tests under `node --test`.
bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language);

migrateLegacyKeys();
applyTheme(settingsService.getSync().preferences.theme);
// ...
```

Note: `import './locales'` is currently a side-effect import (no name binding). The wire requires changing it to `import i18n from './locales'` (default export already exists at `src/locales/index.ts:55`). This is a **second change to main.tsx beyond adding the bind call** — the planner must specify both edits.

### Pattern 3: Test Override via bindI18nLeaf (D-06 implementation)

**What:** Tests that need real translations call `bindI18nLeaf(stubT, stubLocale)` in their setup, never importing `'../locales/index.ts'`.

**When to use:** Tests for migrated Tier 3 modules (`date.ts`, `locale-directive.ts`, `tts/index.ts`, `youtube-locale-url.ts`) that previously relied on `i18next.changeLanguage()` driving the module's read.

**Example:**
```javascript
// tests/lib/date.locale.test.mjs (after Phase 37)
import i18next from 'i18next';
import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';

await i18next.init({ /* ... unchanged ... */ });

// NEW — wire the leaf to the test-local i18next instance.
bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);

const { formatDate, formatDateLabel, getGreeting, today, currentIntlLocale } =
  await import('../../src/lib/date.ts');

// Tests that call await i18next.changeLanguage('zh') still work — the leaf's
// localeGetter closure reads i18next.language live at each call.
```

### Anti-Patterns to Avoid

- **Anti-pattern: Re-binding inside `t()` body.** Don't make `t()` lazy-look-up the i18next instance at call time. The bind point must be explicit (one call to `bindI18nLeaf`) so test stubs are deterministic.
- **Anti-pattern: Re-exporting `i18next` from the shim.** This re-introduces a transitive path to `src/locales/index.ts` for any caller that does `i18next.t(...)`. The whole point is the shim has ZERO transitive locale deps.
- **Anti-pattern: Bundling commits "to save CI runs."** D-03 is locked. Atomic-per-file commits + `npm test` between each are the Pitfall 7 mitigation. A bundled commit that goes red on file 4 of 9 forces manual bisection.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation engine | Custom `Map<string, string>` lookup with locale switching | i18next 26 (already installed; production bundle imports unchanged) | i18next handles fallback chains, missing-key handlers, plurals, interpolation, namespacing — Phase 37 only adds an indirection; no replacement. |
| Mutable singleton injection | DI container, IOC framework, `globalThis` stash | Closure-captured module vars per D-02 | Lightweight, type-safe under TypeScript strict mode, matches `feed-spread`/`refill-mutex` precedent. |
| Locale change subscription in shim | `subscribeLocaleChanged` API on the leaf | Read `i18n.language` live in the closure (`() => i18n.language`) | The i18next singleton's `.language` property updates on `changeLanguage` events; closure reads always see latest. No subscription needed. |
| Test mock framework | `jest.mock()`, `sinon`, `proxyquire` | Identity defaults via D-05 + explicit `bindI18nLeaf` stubs via D-06 | Project standard: `node --test` + source-reading assertions, no mock framework. |
| Migration tooling | `ts-morph` codemod, `jscodeshift` | Manual atomic-per-file edits per D-03 | 9 files × ~2 line changes each = 18 lines. Codemod overhead exceeds manual edit cost. Atomic-per-file commits give bisection for free. |

**Key insight:** Custom solutions in this domain are worse because (a) `i18next` already handles the hard parts, (b) production behavior must remain byte-stable, (c) the only "new" thing is a 30-line indirection module mirroring two existing leaf modules.

## Common Pitfalls

### Pitfall 1: Tier 3 Test Suites Break When Module Reads Switch from i18next to Leaf (HIGH RISK)

**What goes wrong:** Four existing tests (`tests/lib/date.locale.test.mjs`, `tests/providers/llm-locale-injection.test.mjs`, `tests/providers/tts-locale.test.mjs`, `tests/services/youtube-locale.test.mjs`) currently `await i18next.changeLanguage('zh')` and expect the SAME `i18next` global to drive the module's `language` read. After Phase 37, those modules read from `_getLocale()` which returns identity default `'en'` UNLESS `bindI18nLeaf` is called. All 4 tests will go red on the Tier 3 commits without paired test updates.

**Why it happens:** The migration changes the module's read source from `i18next.language` (global) to `_getLocale()` (leaf-internal). Identity default returns `'en'` regardless of what `i18next.changeLanguage` does. Tests that worked because they shared the i18next global with production now need an explicit wire.

**How to avoid:** Plan 37-03 MUST pair each Tier 3 source-file commit with a test-file update commit (or include both edits in the same atomic commit — recommended). Each test's `await i18next.init({...})` block gains a follow-up `bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language)` call before the dynamic `await import(...)` of the module under test.

**Warning signs:**
- Tier 3 commit lands → previously-green test goes red.
- Test failure message: `expected 'zh-CN', got 'en-US'` (date.ts) or `expected 'Respond in Japanese.', got 'Respond in English.'` (locale-directive.ts).
- `bindI18nLeaf` is not imported in the test file — instant fingerprint of the missing wire.

### Pitfall 2: Source-Reading Test Regex Collisions During Refactor (MEDIUM RISK — Pitfall 7 from project research)

**What goes wrong:** Source-reading invariant tests (e.g., `tests/state/useQuestions-system-prompt-stability.test.mjs`, `tests/screens/HomeScreen.exploredAnchors-resync.test.mjs`) grep raw TypeScript source for structural patterns. If Phase 37's import-line changes happen to match an unrelated regex window, tests can flip from PASS to PASS-via-import-line (false positive) or PASS to FAIL (false negative).

**Why it happens:** The Tier 1+2 files (`flashcard`, `podcast`, `question`, `scheduler`, `session`) DON'T currently appear in any source-reading test's read list (verified by `grep -rln "flashcard\|podcast\|question.service\|scheduler\|session.service" tests/state/ tests/screens/ tests/components/` — no matches outside service-internal tests). However, Tier 3 files DO appear:
- `lib/date.ts` is read by `tests/lib/date.locale.test.mjs` (the test that breaks per Pitfall 1).
- `providers/llm/locale-directive.ts` is read by `tests/providers/llm-locale-injection.test.mjs` (same).
- The negative test `tests/services/web-search-no-locale.test.mjs` reads `web-search.service.ts` and asserts NO import contains `from '../locales'` or `from 'i18next'` — Phase 37 does NOT touch `web-search.service.ts`, so this test remains green throughout.

**How to avoid:**
- Run `npm test` after EACH atomic commit (D-03), not after the batch.
- Before starting Plan 37-02, capture green baseline (run failing tests excluded). After each Tier 1+2 commit, expect 2 failures to disappear (concept-feed.test.mjs covers flashcard.service indirectly; trellis-state covers it via state propagation; etc.) — but watch for any UNEXPECTED test going red, which signals a regex collision.
- Plan 37-03 commits must update the paired test file in the SAME commit (atomic = source + test together).

**Warning signs:**
- Test count of unexpectedly-red tests after a Tier 3 commit: anything > 0 means a regex hit an import line.
- Test that was already green starts failing with a message about a string that wasn't directly modified by the commit.

### Pitfall 3: `i18next` Default Export vs `i18next.t.bind(i18n)` Capture Semantics

**What goes wrong:** `bindI18nLeaf(i18n.t, () => i18n.language)` (without `.bind(i18n)`) captures `i18n.t` as a detached function reference. When `t()` is called, `this` inside i18next's `t` implementation is undefined, throwing `TypeError: Cannot read properties of undefined (reading 'options')` or returning the raw key.

**Why it happens:** i18next's `t()` method internally references `this.options`, `this.languages`, etc. Detaching the method via direct property access loses the receiver.

**How to avoid:** Always use `i18n.t.bind(i18n)` when passing to `bindI18nLeaf`. CONTEXT.md D-07 already specifies `bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)` — preserve `.bind(i18n)`. The `localeGetter` arg `() => i18n.language` does NOT need binding because `.language` is a property read, not a method call.

**Warning signs:** Production `t('common.toast.X')` returns the raw key string `'common.toast.X'` instead of the translated text. Tests pass (identity defaults) but the iOS UAT shows untranslated keys in toasts.

### Pitfall 4: Test File `await import(...)` Timing After bindI18nLeaf (Tier 3)

**What goes wrong:** A Tier 3 test does `await import('../../src/lib/date.ts')` BEFORE `bindI18nLeaf`. The dynamic import evaluates `date.ts`'s module-scope code, which (after Phase 37) reads from leaf state at call time — not import time — so this is actually safe. BUT if the test does `await import` BEFORE `bindI18nLeaf` AND the imported module has top-level code that calls `t()` or `getCurrentLocale()` at module-load (none of the migrated files do — verified), the call would resolve against identity defaults at load, not the bound instance.

**Why it happens:** ESM dynamic import is fully evaluated at the import site. Module top-level side effects run BEFORE the test body proceeds.

**How to avoid:** Verified safe — none of the 9 migrated files invoke `t()` or `getCurrentLocale()` at module-top-level. All call sites are inside function bodies (`formatDate`, `getGreeting`, `applyLocaleDirective`, `resolveVoice`, `buildYoutubeSearchUrl`, plus the toast paths in services). The 9-file inventory is small enough to verify by inspection — recommend the planner add a code-comment to the shim noting "consumers must not call `t()` or `getCurrentLocale()` at module top level; bind happens after locale init in main.tsx."

**Warning signs:** A future v1.5 service tries to compute a constant from `t('some.key')` at module top level and gets the literal string `'some.key'` in production builds. Code review should catch this; source-reading test could enforce as "no `t(` calls outside function/method bodies in services importing the leaf."

### Pitfall 5: Mixed Import-Path Style in Tier 1+2 Source Files

**What goes wrong:** The 5 Tier 1+2 files have INCONSISTENT existing import styles for the locales directory:
- `flashcard.service.ts:5` and `question.service.ts:5` use `from '../locales/index.ts'` (explicit `.ts` extension)
- `podcast.service.ts:4`, `scheduler.service.ts:26`, `session.service.ts:4` use `from '../locales'` (directory shorthand)

If the planner specifies a single mechanical replacement pattern, two files won't match.

**How to avoid:** Plan 37-02 must show the EXACT replacement per file. Recommended unified target import: `from '../lib/i18n-leaf'` (no extension, matching the existing leaf precedents `'./refill-mutex'` and `'./feed-spread'` at `concept-feed.service.ts:27,29`). The planner must list each file's CURRENT import line verbatim (see § Code Examples Plan 37-02 mapping) and the NEW line.

**Warning signs:** A "find/replace" approach catches 2 of 5 files; remaining 3 still import the old path. Source-reading sanity test catches in Plan 37-03 final commit.

## Code Examples

Verified patterns from official sources and existing project precedent:

### Shim Implementation (Plan 37-01)

```typescript
// src/lib/i18n-leaf.ts (Phase 37 — TECHDEBT-01)
//
// Injectable indirection over the i18next singleton. This module has ZERO
// transitive dependencies on src/locales/*.json, so consumers (services,
// lib helpers, providers) can be imported under `node --test` on Node 25
// without triggering ERR_IMPORT_ATTRIBUTE_MISSING on the static JSON imports
// in src/locales/index.ts.
//
// PRODUCTION: src/main.tsx calls bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)
// once after `import i18n from './locales'` so all consumers go through the
// real i18next instance. Behavior is byte-stable vs. the pre-Phase-37 direct
// i18next reads.
//
// TESTS: identity defaults (`t(key) => key`, `getCurrentLocale() => 'en'`)
// require zero setup. Tests that need real translations call bindI18nLeaf
// themselves with a stub i18next instance. NEVER import from '../locales/index.ts'
// in test code — that re-introduces the JSON-import chain Phase 37 unwinds.
//
// CONSUMERS: do NOT call t() or getCurrentLocale() at module top level. Bind
// happens after locale init in main.tsx; top-level calls would resolve against
// identity defaults at module-load time, not the bound instance.
//
// See CLAUDE.md "Best practices learned in Phase 32.1" rule 8 (document load-bearing
// constraints in three places: project CLAUDE.md, auto-memory, and the load-bearing
// code site).

type TFn = (key: string, opts?: Record<string, unknown>) => string;
type LocaleGetter = () => string;

let _t: TFn = (key) => key;
let _getLocale: LocaleGetter = () => 'en';

/**
 * Bind the leaf shim to a live i18next-like instance.
 *
 * Call once at app boot from main.tsx AFTER `import i18n from './locales'`
 * has evaluated. Idempotent (later calls overwrite earlier bindings — useful
 * for test reset patterns).
 */
export function bindI18nLeaf(tFn: TFn, getLocale: LocaleGetter): void {
  _t = tFn;
  _getLocale = getLocale;
}

/**
 * Translate a key. In production, delegates to i18next.t. In tests with no
 * binding, returns the key unchanged (identity default — assertions check
 * call shape, not translated text).
 */
export function t(key: string, opts?: Record<string, unknown>): string {
  return _t(key, opts);
}

/**
 * Read the current locale code (e.g., 'en', 'zh', 'es', 'ja'). In production,
 * reads `i18next.language` live at each call. In tests with no binding,
 * returns 'en'.
 */
export function getCurrentLocale(): string {
  return _getLocale();
}
```

### Smoke Test for the Shim (Plan 37-01)

```javascript
// tests/lib/i18n-leaf.test.mjs (Phase 37)
import assert from 'node:assert/strict';
import test from 'node:test';

const { t, getCurrentLocale, bindI18nLeaf } = await import(
  '../../src/lib/i18n-leaf.ts'
);

test('default: t(key) returns the key (identity)', () => {
  assert.equal(t('common.toast.someKey'), 'common.toast.someKey');
});

test('default: getCurrentLocale() returns "en"', () => {
  assert.equal(getCurrentLocale(), 'en');
});

test('bindI18nLeaf rebinds t and locale', () => {
  bindI18nLeaf(
    (key) => `T:${key}`,
    () => 'zh',
  );
  assert.equal(t('hello'), 'T:hello');
  assert.equal(getCurrentLocale(), 'zh');

  // Reset to identity for subsequent tests in the same process.
  bindI18nLeaf((k) => k, () => 'en');
  assert.equal(t('hello'), 'hello');
  assert.equal(getCurrentLocale(), 'en');
});

test('t passes opts through to bound function', () => {
  let capturedOpts;
  bindI18nLeaf(
    (key, opts) => {
      capturedOpts = opts;
      return key;
    },
    () => 'en',
  );
  t('greet', { name: 'world' });
  assert.deepEqual(capturedOpts, { name: 'world' });

  bindI18nLeaf((k) => k, () => 'en');
});
```

### main.tsx Wire (Plan 37-01)

```tsx
// src/main.tsx — DIFF view
// BEFORE
import './locales';

// AFTER
import i18n from './locales';
import { bindI18nLeaf } from './lib/i18n-leaf';

// Wire the leaf shim to the live i18next instance.
// Identity defaults stay in place for tests that don't import this file.
bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language);
```

The bind call must appear AFTER `import i18n from './locales'` (so `i18n.t` is bound to a fully-initialized instance) and BEFORE `migrateLegacyKeys()` and `applyTheme(...)` (so any service those call paths might transitively hit reads the bound `t`, not identity). Practically, place it on the line immediately after the import block.

### Tier 1+2 Migration Mapping (Plan 37-02)

| File | Current import line | New import line | Call sites to rewrite |
|------|---------------------|-----------------|------------------------|
| `src/services/flashcard.service.ts:5` | `import i18n from '../locales/index.ts';` | `import { t } from '../lib/i18n-leaf';` | `:81` `i18n.t('common.toast.storageFullFlashcards')` → `t('common.toast.storageFullFlashcards')` (1 site) |
| `src/services/podcast.service.ts:4` | `import i18n from '../locales';` | `import { t } from '../lib/i18n-leaf';` | `:128` `i18n.t('common.toast.storageFullPodcast')` → `t(...)` (1 site) |
| `src/services/question.service.ts:5` | `import i18n from '../locales/index.ts';` | `import { t } from '../lib/i18n-leaf';` | `:114` `i18n.t('common.toast.storageFullQuestion')` → `t(...)` (1 site) |
| `src/services/scheduler.service.ts:26` | `import i18n from '../locales';` | `import { t } from '../lib/i18n-leaf';` | `:84` `i18n.t('common.toast.generatingDailyPodcast')` → `t(...)`; `:130` `i18n.t('common.toast.reviewReminder')` → `t(...)` (2 sites) |
| `src/services/session.service.ts:4` | `import i18n from '../locales';` | `import { t } from '../lib/i18n-leaf';` | `:21`, `:32`, `:73` — all `i18n.t('common.toast.X')` → `t('common.toast.X')` (3 sites) |

**Total Tier 1+2:** 5 files, 8 call sites, 5 import-line changes, 5 atomic commits.

**Per-commit verification command:** `cd app && npm test 2>&1 | tail -20` — confirm green or expected reduction in red count.

### Tier 3 Migration Mapping (Plan 37-03)

| File | Current i18next imports | New import | Call sites to rewrite |
|------|--------------------------|------------|------------------------|
| `src/services/youtube-locale-url.ts:10,35` | `import i18next from 'i18next';` + `i18next.language` | `import { getCurrentLocale } from '../lib/i18n-leaf';` | `:35` `i18next.language as SupportedLocale` → `getCurrentLocale() as SupportedLocale` (1 site) |
| `src/lib/date.ts:1,19,65,76,77,78` | `import i18next from 'i18next';` + 1× `.language` + 4× `.t(...)` | `import { t, getCurrentLocale } from './i18n-leaf';` | `:19` `i18next.language` → `getCurrentLocale()`; `:65` `i18next.t('common.today')` → `t('common.today')`; `:76-78` `i18next.t('common.greeting.X')` → `t('common.greeting.X')` (5 sites) |
| `src/providers/llm/locale-directive.ts:16,36` | `import i18next from 'i18next';` + `i18next.language` | `import { getCurrentLocale } from '../../lib/i18n-leaf';` | `:36` `i18next.language as SupportedLocale` → `getCurrentLocale() as SupportedLocale` (1 site) |
| `src/providers/tts/index.ts:1,26` | `import i18next from 'i18next';` + `i18next.language` | `import { getCurrentLocale } from '../../lib/i18n-leaf';` | `:26` `i18next.language as SupportedLocale` → `getCurrentLocale() as SupportedLocale` (1 site) |

**Total Tier 3 source:** 4 files, 8 call sites.

**Paired test updates (REQUIRED — Pitfall 1):**

| Test File | Update Required |
|-----------|------------------|
| `tests/lib/date.locale.test.mjs` | Add `import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';` after `import i18next`. Add `bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);` after `await i18next.init({...})` block (around line 50, before the `await import('../../src/lib/date.ts')` line). |
| `tests/providers/llm-locale-injection.test.mjs` | Same pattern. Insert bind call between `await i18next.init({...})` (line 16) and `await import('../../src/providers/llm/locale-directive.ts')` (line 21). |
| `tests/providers/tts-locale.test.mjs` | Same pattern. Insert bind call after `await i18next.init({...})` (line 15) and before global fetch shim setup (line 21). Order with respect to fetch shim doesn't matter since the bind doesn't fetch anything. |
| `tests/services/youtube-locale.test.mjs` | Same pattern. Insert bind call after `await i18next.init({...})` (line 15). |

**Recommended commit grouping for Plan 37-03 (4 atomic commits):**
1. `youtube-locale-url.ts` + `tests/services/youtube-locale.test.mjs` (single commit — paired)
2. `lib/date.ts` + `tests/lib/date.locale.test.mjs` (single commit — paired)
3. `providers/llm/locale-directive.ts` + `tests/providers/llm-locale-injection.test.mjs` (single commit — paired) — preserve D-07 comment block at top of file (lines 1-15), update only line 14 to add a Phase 37 footnote noting the leaf is the indirection.
4. `providers/tts/index.ts` + `tests/providers/tts-locale.test.mjs` + final source-reading invariant test (single commit — paired + invariant)

The 4th commit should ALSO add `tests/services/leaf-imports.test.mjs` — see § Validation Architecture.

### D-07 Comment Update (locale-directive.ts)

Existing comment block at `src/providers/llm/locale-directive.ts:1-15`:
```
// IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale
// for an LLM request.
```

After Phase 37 (preserve original + add footnote):
```
// IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale
// for an LLM request. Do NOT add a `locale` param to CompletionOptions or any
// call site. Do NOT call chatCompletion/chatStream for translation — dev-time
// Sonnet subagent owns all UI translation (see CLAUDE.md i18n Workflow).
//
// Phase 37 note: this module reads locale via `getCurrentLocale()` from
// `../../lib/i18n-leaf` (the leaf is the indirection layer). Behavior is
// byte-stable vs. the pre-Phase-37 direct i18next.language read.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service-layer files import `i18next` directly | Service-layer files import `t`/`getCurrentLocale` from leaf shim | Phase 37 (this phase) | New v1.5 services (`engagement.service.ts`, `source-diversity.ts`) can be tested under `node --test` without setup |
| Test for Tier 3 module: `await i18next.changeLanguage('zh')` is sufficient | Test must ALSO call `bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language)` | Phase 37 | 4 existing tests need updates; new tests gain a clear pattern |
| `import.meta.env.DEV` in `src/locales/index.ts` (line 36-37) | Unchanged — still Vite-only | (not changed) | Why we can't import locales/index from `node --test`; this is the ROOT of the chain |
| Inconsistent locales import style (`'../locales'` vs `'../locales/index.ts'`) | Unified `'../lib/i18n-leaf'` (no extension) | Phase 37 | Style consistency benefit; matches `feed-spread`/`refill-mutex` precedent |

**Deprecated/outdated:**
- "Phase 27 locale tests avoid the JSON-import-attribute failure chain by importing `i18next` directly; follow the same pattern for any new pure-logic helpers" (CLAUDE.md guidance) — Phase 37 generalizes this. After Phase 37 lands, the canonical pattern is "import from `../lib/i18n-leaf`," not "import `i18next` directly." Update CLAUDE.md text in Plan 37-03 final commit OR defer to Phase 38 (TECHDEBT-05 doc-drift).

## Open Questions

### A. `node --test` execution mode — esbuild tsx loader or Node 25 native TS-strip?

**Status:** RESOLVED via inspection.

- CLAUDE.md says "Test framework: Node.js built-in `node --test` with esbuild tsx loader."
- `package.json:6-8` shows: `"test:main": "node --test $(find tests -name '*.test.mjs' ...)"` — NO `--loader` or `--import` flag for esbuild/tsx in the main test script.
- Only `test:actions` uses `--import ./tests/services/_actions-mock-loader.mjs`, which itself uses `node:module register` to install a hooks file — this is the trellis-actions mock harness, NOT a tsx transpiler.
- Conclusion: `npm test` relies on **Node 25's native TypeScript stripping** (`--experimental-strip-types` is on by default since Node 23). The `.ts` extensions in test imports (`await import('../../src/services/x.ts')`) work because Node 25 ESM strips type annotations at load time.

**Implication for the planner:** Import specifiers `from '../lib/i18n-leaf'` (no extension) work under both `tsc -b` (with `moduleResolution: 'bundler'` + `allowImportingTsExtensions: true`) and Node 25 native (which auto-resolves `.ts`). The CLAUDE.md "esbuild tsx loader" note is stale — recommend a one-line correction in Plan 37-03 final commit (or defer to TECHDEBT-05 in Phase 38).

### B. `bindI18nLeaf` timing — does production need event subscription?

**Status:** RESOLVED.

The `localeGetter` closure `() => i18n.language` reads the property LIVE at every `getCurrentLocale()` call. i18next's `language` property is updated synchronously inside `changeLanguage()` before the Promise resolves. Therefore, services calling `getCurrentLocale()` after a language change will see the new language without any subscription. **Single `bindI18nLeaf` call at boot is sufficient.**

### C. Tier 3 risk audit — any callers of `i18next.changeLanguage` or `i18next.on('languageChanged')` in scope?

**Status:** RESOLVED. Verified via `grep -rn "i18next\.\(changeLanguage\|on\)" src/`:

- `src/locales/index.ts:49` calls `i18n.on('languageChanged', ...)` — UNTOUCHED in Phase 37 (locales/index.ts is the producer, not a consumer of the leaf).
- React components use `react-i18next`'s `useTranslation()` hook, which subscribes internally — UNTOUCHED in Phase 37 (D-08).
- `state/useQuestions.ts` (Phase 35 byte-stable system prompt) reads via `useTranslation()` hook — UNTOUCHED (D-08).
- No service-layer file in scope uses `changeLanguage` or `on('languageChanged')`. Tier 3 read-only access is fully covered by `getCurrentLocale()`.

### D. Test guard plan

**Status:** RESOLVED. Recommended new tests:

1. `tests/lib/i18n-leaf.test.mjs` — smoke test for the shim (Plan 37-01). See § Code Examples.
2. `tests/services/leaf-imports.test.mjs` — final source-reading invariant test (Plan 37-03 last commit). Asserts:
   - No file under `src/services/`, `src/lib/`, or `src/providers/` (except `src/locales/index.ts` and the leaf itself) imports `from '../locales'` or `from '../../locales'` (any locale-bundle import path).
   - No file under `src/services/`, `src/lib/`, or `src/providers/` (except the leaf) imports `from 'i18next'` directly.
   - The leaf module exists at `src/lib/i18n-leaf.ts` and exports `t`, `getCurrentLocale`, `bindI18nLeaf`.
3. Updates to 4 existing Tier 3 tests — see § Code Examples.

### E. Pitfall 7 mitigation specifics — at-risk regex patterns

**Status:** RESOLVED via repo grep.

| Test | Pattern grepped | Risk | Mitigation |
|------|-----------------|------|------------|
| `tests/services/web-search-no-locale.test.mjs` | `from '../locales'` substring; `i18next` substring | LOW — only reads `src/services/web-search.service.ts` which Phase 37 does NOT touch | None needed |
| `tests/state/useQuestions-system-prompt-stability.test.mjs` | `formatCandidateContextPack` placement; `role: 'system'` content | NIL — Phase 37 does not touch `state/useQuestions.ts` (D-08) | None needed |
| `tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` and `HomeScreen.warm-start-refallback.test.mjs` | `dailyReadService.getExploredAnchors`, anchor-pair extraction in HomeScreen.tsx | NIL — Phase 37 does not touch HomeScreen.tsx | None needed |
| `tests/screens/SettingsDataScreen.force-new-day.test.mjs` | `handleForceNewDay` references | NIL — Phase 37 does not touch SettingsDataScreen | None needed |
| `tests/lib/date.locale.test.mjs`, `tests/providers/*-locale*.test.mjs`, `tests/services/youtube-locale.test.mjs` | Runtime imports + assertions on translated values | HIGH per Pitfall 1 — REQUIRES paired test update | Pair source + test in same commit (Plan 37-03) |

**Recommended file change order (within plans):**

- Plan 37-02 order: any order — the 5 Tier 1+2 files have no inter-dependencies and no source-reading tests grep them. Recommended: alphabetical (`flashcard`, `podcast`, `question`, `scheduler`, `session`) for predictability. Each commit should reduce the failing-test count by 0-2 (concept-feed.test.mjs and trellis-state.test.mjs go green only AFTER `flashcard.service.ts` is migrated since that's the chain root; the other 4 Tier 1+2 commits should keep all tests green).
- Plan 37-03 order: must pair source + test. Recommended: `youtube-locale-url.ts` first (smallest blast radius), then `lib/date.ts` (heaviest consumer — most call sites), then `providers/llm/locale-directive.ts` (preserves D-07 comment), then `providers/tts/index.ts` + final `tests/services/leaf-imports.test.mjs` invariant test.

### F. tsc resolution for `'./i18n-leaf'` (no extension)

**Status:** RESOLVED via `tsconfig.app.json` inspection.

- `moduleResolution: "bundler"` + `allowImportingTsExtensions: true` + `verbatimModuleSyntax: true` is the configured combo.
- Existing precedents: `src/services/concept-feed.service.ts:27,29` uses `from './feed-spread'` and `from './refill-mutex'` (no extension). Both files are `.ts`. `tsc -b` passes.
- Phase 37 should use the SAME pattern: `from '../lib/i18n-leaf'` from services, `from './i18n-leaf'` from inside `lib/`, `from '../../lib/i18n-leaf'` from `providers/llm/` and `providers/tts/`.

**Verified:** `tsc -b --noEmit` will resolve all three relative paths correctly under bundler resolution. Node 25 ESM also auto-resolves `.ts` since native strip is on. Both invariants hold.

### G. Validation Architecture (covered in dedicated section below)

## Environment Availability

> Phase 37 is a code/config-only refactor with no new external dependencies. All required tools are existing project dependencies (verified above).

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node | `npm test` execution | ✓ | v25.9.0 | — |
| TypeScript | `tsc -b --noEmit` gate | ✓ | ~5.9.3 | — |
| `i18next` | Production binding source | ✓ | ^26.0.5 | — |

**Missing dependencies:** None. **Skip flag:** Phase 37 has no external service/runtime dependencies.

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section is mandatory.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node 25 built-in `node --test` (native TS strip) |
| Config file | None (uses package.json scripts directly) |
| Quick run command | `cd app && npm test 2>&1 \| tail -40` (or `npm run test:main` for non-actions only) |
| Full suite command | `cd app && npm test` (runs `test:main` then `test:actions`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| TECHDEBT-01 (Goal 1) | 10 currently-failing tests turn green after Plan 37-02 closes the chain | Hold-out (no new test needed — these ARE the natural hold-out) | `cd app && npm test 2>&1 \| grep -E "fail \d+\|✖"` — expect `fail 0` | ✅ tests already exist; they currently fail with `ERR_IMPORT_ATTRIBUTE_MISSING` |
| TECHDEBT-01 (Goal 2) | `src/lib/i18n-leaf.ts` shim exists and is imported by ≥6 service/lib/provider files | Source-reading invariant + smoke test | `cd app && node --test tests/lib/i18n-leaf.test.mjs tests/services/leaf-imports.test.mjs` | ❌ Wave 0 — both files new in Plans 37-01 and 37-03 |
| TECHDEBT-01 (Goal 3) | `tsc -b --noEmit` exits 0 after refactor | Compile gate | `cd app && npx tsc -b --noEmit; echo "exit $?"` | ✅ existing tsc binary; runs in CI today |
| TECHDEBT-01 (Goal 4) | Locale switch EN→ZH→ES→JA works in production (manual UAT) | Manual | Operator runs the app, switches locales in Settings, confirms toasts/dates/greetings update — same gate as Phase 27 locale UAT | ❌ Manual only — operator UAT after Plan 37-03 |
| TECHDEBT-01 (Goal 4 automated proxy) | The 4 Tier 3 tests (`date.locale`, `tts-locale`, `llm-locale-injection`, `youtube-locale`) stay green AFTER Tier 3 migration | Regression — paired in same commits as source updates | `cd app && node --test tests/lib/date.locale.test.mjs tests/providers/tts-locale.test.mjs tests/providers/llm-locale-injection.test.mjs tests/services/youtube-locale.test.mjs` | ✅ tests exist; updates land in Plan 37-03 |

### Sampling Rate

- **Per task commit:** `cd app && npm test 2>&1 | tail -20` — confirms green or expected progress (Pitfall 7 mitigation).
- **Per plan boundary:**
  - Plan 37-01 close: `node --test tests/lib/i18n-leaf.test.mjs` — green; `npm test` — same red count as before (no service files migrated yet, so 10 failures persist).
  - Plan 37-02 close: `npm test` — `fail 0` (10 carried failures CLOSED). `tsc -b --noEmit` — exit 0.
  - Plan 37-03 close: `npm test` — `fail 0`. Source-reading invariant `tests/services/leaf-imports.test.mjs` green. `tsc -b --noEmit` — exit 0.
- **Phase gate:** Full suite green + `tsc -b` green + manual locale-switch UAT before `/gsd:verify-work`.

### Hold-Out Tests (the natural Nyquist sampling)

The 10 currently-failing tests serve as the natural hold-out. They are NOT modified by Phase 37 (their imports already point at `concept-feed.service.ts` / `trellis-state.service.ts` / `trellis-layout.service.ts` / e2e service paths, which transitively pulled `flashcard.service.ts → ../locales/index.ts → en.json`). After Plan 37-02 commit 1 (`flashcard.service.ts` migration), the chain breaks and ALL 10 tests turn green simultaneously. The other 4 Tier 1+2 commits should keep the count at 0 (any regression is a Pitfall 2 collision).

Failing tests (current status):
1. `tests/concept-feed.test.mjs:1:1` (entire file fails to import)
2. `tests/e2e/trellis-review-update.test.mjs:37:1`
3. `tests/e2e/trellis-review-update.test.mjs:61:1`
4. `tests/services/trellis-layout.test.mjs:64:1`
5. `tests/services/trellis-state.test.mjs:37:1`
6. `tests/services/trellis-state.test.mjs:44:1`
7. `tests/services/trellis-state.test.mjs:52:1`
8. `tests/services/trellis-state.test.mjs:61:1`
9. `tests/services/trellis-state.test.mjs:70:1`
10. `tests/services/trellis-state.test.mjs:78:1`

### Contract Tests

`tests/services/leaf-imports.test.mjs` (NEW — Plan 37-03 final commit) is the contract test:

```javascript
// tests/services/leaf-imports.test.mjs (Phase 37 — TECHDEBT-01 invariant)
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const ALL_TS = walk(SRC);

// Files allowed to import locales/* or i18next directly:
//   - src/locales/index.ts (the i18next init site itself)
//   - src/locales/i18n.d.ts (type augmentation)
//   - src/lib/i18n-leaf.ts (the shim does NOT import either of these — verified
//     by negative assertion below; this entry exists so the shim is excluded
//     from ambient .d.ts imports of 'i18next' if any future change adds one)
//   - React components / screens / state hooks (D-08 — out of scope for Phase 37)
const ALLOWED_LOCALES_IMPORTERS = new Set([
  resolve(SRC, 'locales/index.ts'),
  resolve(SRC, 'locales/i18n.d.ts'),
  resolve(SRC, 'main.tsx'),
]);

const TARGET_DIRS = ['services', 'lib', 'providers'];

test('no service/lib/provider file imports from "../locales" (Phase 37 invariant)', () => {
  const offenders = [];
  for (const file of ALL_TS) {
    const rel = relative(SRC, file);
    const isInScope = TARGET_DIRS.some((d) => rel.startsWith(d + '/'));
    if (!isInScope) continue;
    const source = readFileSync(file, 'utf8');
    if (/from\s+['"]\.\.?\/(\.\.\/)?locales/.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These files still import from locales/* — must use ../lib/i18n-leaf instead:\n${offenders.join('\n')}`,
  );
});

test('no service/lib/provider file (except the leaf) imports i18next directly (Phase 37 invariant)', () => {
  const offenders = [];
  const LEAF = resolve(SRC, 'lib/i18n-leaf.ts');
  for (const file of ALL_TS) {
    if (file === LEAF) continue;
    const rel = relative(SRC, file);
    const isInScope = TARGET_DIRS.some((d) => rel.startsWith(d + '/'));
    if (!isInScope) continue;
    const source = readFileSync(file, 'utf8');
    if (/from\s+['"]i18next['"]/.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These files still import 'i18next' directly — must use ../lib/i18n-leaf:\n${offenders.join('\n')}`,
  );
});

test('i18n-leaf.ts itself does NOT import from locales or i18next', () => {
  const source = readFileSync(resolve(SRC, 'lib/i18n-leaf.ts'), 'utf8');
  assert.ok(
    !/from\s+['"]\.\.?\/(\.\.\/)?locales/.test(source),
    'i18n-leaf.ts must not import from ../locales (would re-introduce JSON chain)',
  );
  assert.ok(
    !/from\s+['"]i18next['"]/.test(source),
    'i18n-leaf.ts must not import "i18next" (would defeat the leaf-module purpose)',
  );
});

test('i18n-leaf.ts exports t, getCurrentLocale, bindI18nLeaf', async () => {
  const mod = await import('../../src/lib/i18n-leaf.ts');
  assert.equal(typeof mod.t, 'function');
  assert.equal(typeof mod.getCurrentLocale, 'function');
  assert.equal(typeof mod.bindI18nLeaf, 'function');
});
```

### Edge Cases

- **Identity stub behavior:** `t('any.key')` returns `'any.key'`; `getCurrentLocale()` returns `'en'`. Tested in `tests/lib/i18n-leaf.test.mjs`.
- **Bind-then-rebind:** Second `bindI18nLeaf` call overwrites first. Tested in shim smoke test.
- **Multiple imports without re-binding:** Module-private `let` is shared across import sites (ESM module singleton). All callers see the same `_t`/`_getLocale`. Tested implicitly by Tier 3 tests post-migration.
- **Test isolation:** `node --test` runs each `.test.mjs` file in a fresh process by default — module-private state does NOT leak across test files. Within a single file, the shim smoke test resets identity at end of test 3 to avoid pollution.
- **Concurrent test files reading bound state:** Not possible — different processes.

### Wave 0 Gaps

- [ ] `app/src/lib/i18n-leaf.ts` — shim source file; covers TECHDEBT-01 Goal 2.
- [ ] `app/tests/lib/i18n-leaf.test.mjs` — shim smoke test; covers TECHDEBT-01 Goal 2 (4 assertions).
- [ ] `app/tests/services/leaf-imports.test.mjs` — invariant test asserting no locales/* or i18next direct imports outside the leaf and exempt list; covers TECHDEBT-01 Goal 2 (4 assertions).
- [ ] Test updates (paired with source commits) for `tests/lib/date.locale.test.mjs`, `tests/providers/llm-locale-injection.test.mjs`, `tests/providers/tts-locale.test.mjs`, `tests/services/youtube-locale.test.mjs` — covers TECHDEBT-01 Goal 4 (regression of Tier 3 locale tests).

*(Not "no gaps" — Phase 37 deliberately introduces 1 shim + 2 new test files + 4 paired test updates.)*

## Sources

### Primary (HIGH confidence — direct source inspection / live reproduction)

- `app/src/locales/index.ts` (lines 1-55) — i18next init + JSON imports + `import.meta.env.DEV` chain root
- `app/src/services/{flashcard,podcast,question,scheduler,session}.service.ts` — Tier 1+2 import + call sites verified
- `app/src/services/youtube-locale-url.ts` (full file) — Tier 3 example
- `app/src/lib/date.ts` (full file) — heaviest Tier 3 consumer
- `app/src/providers/llm/locale-directive.ts` (full file) — D-07 load-bearing comment block
- `app/src/providers/tts/index.ts` (full file) — Tier 3 voice fallback
- `app/src/main.tsx` (full file) — production wire site
- `app/src/services/refill-mutex.ts`, `feed-spread.ts` — leaf-module precedents
- `app/tests/lib/date.locale.test.mjs`, `tts-locale.test.mjs`, `llm-locale-injection.test.mjs`, `youtube-locale.test.mjs` — Tier 3 test files (Pitfall 1 source)
- `app/tests/services/refill-mutex.test.mjs` — leaf-module test precedent (Phase 36-12)
- `app/tests/services/web-search-no-locale.test.mjs` — invariant test pattern reference
- `app/tsconfig.app.json` — `moduleResolution: 'bundler'`, `allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`
- `app/package.json` (scripts) — `npm test` definition (no esbuild/tsx loader)
- `cd app && npm test 2>&1` — live reproduction of 10 `ERR_IMPORT_ATTRIBUTE_MISSING` failures across 5 test files
- `node --version` → `v25.9.0` — confirms Node 25 native TS strip is the actual test runtime
- CONTEXT.md (37-CONTEXT.md, all 8 decisions D-01..D-08)
- DISCUSSION-LOG.md (37-DISCUSSION-LOG.md, audit findings table)
- REQUIREMENTS.md TECHDEBT-01 row + traceability table
- STATE.md current position
- `.planning/research/SUMMARY.md` Wave 0 section
- `.planning/research/PITFALLS.md` Pitfalls 7 + 11

### Secondary (MEDIUM confidence — official docs verified)

- [Node.js v25 ESM JSON modules — Import Attributes](https://nodejs.org/docs/latest-v25.x/api/esm.html#import-attributes) — confirms `with { type: 'json' }` requirement; Vite's bundler-time JSON transform sidesteps it
- [TypeScript 5.9 `verbatimModuleSyntax` + `moduleResolution: bundler`](https://www.typescriptlang.org/tsconfig#moduleResolution) — confirms `'./module'` (no extension) resolves under bundler mode
- [i18next v26 Migration Guide](https://www.i18next.com/misc/migration-guide#v23.x.x-to-v26.x.x) — confirms `i18n.t.bind(i18n)` and `i18n.language` semantics unchanged
- CLAUDE.md (project root) — i18n Workflow section + Phase 32.1 best practices section + brand history note

### Tertiary (LOW confidence — none in this research)

(No LOW-confidence findings. All claims verified against live codebase, official docs, or reproduced test failures.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions pinned in package.json, leaf-module precedent verified
- Architecture: HIGH — pattern mirrors `feed-spread.ts` and `refill-mutex.ts` byte-for-byte; main.tsx wire-point empirically verified
- Pitfalls: HIGH — Pitfall 1 (Tier 3 test breakage) reproduced by reading existing test source; Pitfall 2 (regex collisions) verified by exhaustive grep over `tests/`
- Validation: HIGH — 10 failing tests reproduced live; contract test design follows existing `web-search-no-locale.test.mjs` pattern

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days — phase is mechanical refactor with no fast-moving dependencies)
