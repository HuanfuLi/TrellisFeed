---
phase: 37-i18n-leaf-module-refactor
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/i18n-leaf.ts
  - app/tests/lib/i18n-leaf.test.mjs
  - app/src/main.tsx
autonomous: true
requirements: [TECHDEBT-01]

must_haves:
  truths:
    - "Leaf shim file `app/src/lib/i18n-leaf.ts` exists and exports `t`, `getCurrentLocale`, `bindI18nLeaf`."
    - "Smoke test `app/tests/lib/i18n-leaf.test.mjs` passes under `node --test` (4 assertions covering identity defaults, rebinding, opts pass-through)."
    - "Production wire in `app/src/main.tsx` calls `bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)` AFTER the locales import has evaluated, BEFORE `migrateLegacyKeys()` and `applyTheme(...)`."
    - "App still boots; `tsc -b --noEmit` exits 0; existing 10 carried failures remain red (no service files migrated yet)."
  artifacts:
    - path: "app/src/lib/i18n-leaf.ts"
      provides: "i18n indirection shim with closure-captured module-private state; identity defaults; bindI18nLeaf re-binder"
      exports: ["t", "getCurrentLocale", "bindI18nLeaf"]
      min_lines: 30
    - path: "app/tests/lib/i18n-leaf.test.mjs"
      provides: "Smoke test for shim — 4 assertions"
      contains: "bindI18nLeaf"
      min_lines: 40
    - path: "app/src/main.tsx"
      provides: "Production wire — binds leaf to live i18next AFTER locales import"
      contains: "bindI18nLeaf(i18n.t.bind(i18n)"
  key_links:
    - from: "app/src/main.tsx"
      to: "app/src/lib/i18n-leaf.ts"
      via: "import { bindI18nLeaf } from './lib/i18n-leaf'"
      pattern: "bindI18nLeaf\\(i18n\\.t\\.bind\\(i18n\\)"
    - from: "app/src/main.tsx"
      to: "app/src/locales/index.ts"
      via: "import i18n from './locales' (default export — change from side-effect-only import)"
      pattern: "import i18n from './locales'"
---

<objective>
Create the leaf-module shim `src/lib/i18n-leaf.ts` (the indirection that breaks the `ERR_IMPORT_ATTRIBUTE_MISSING` chain) and wire it once at production boot from `main.tsx`. No service files are migrated in this plan — that is Plan 37-02. After this plan, infrastructure is in place; the 10 carried test failures remain red until Plan 37-02 closes them.

Purpose: TECHDEBT-01 — break the `src/locales/index.ts → en.json` static-JSON-import chain that prevents Tier 1+2 service files from being importable under Node 25 `node --test`.

Output: 1 new shim source file + 1 new smoke test file + 1 main.tsx wire change. ~3 atomic commits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@.planning/phases/37-i18n-leaf-module-refactor/37-CONTEXT.md
@.planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md
@.planning/phases/37-i18n-leaf-module-refactor/37-VALIDATION.md

@CLAUDE.md

@app/src/locales/index.ts
@app/src/main.tsx
@app/src/services/refill-mutex.ts
@app/src/services/feed-spread.ts
@app/tests/services/refill-mutex.test.mjs

<interfaces>
<!-- Existing leaf-module precedents Phase 37 mirrors byte-for-byte. -->

From `app/src/services/refill-mutex.ts` (Phase 36-12 — leaf-module precedent):
```typescript
export type PromiseMutex = {
  run<T>(fn: () => Promise<T>): Promise<T>;
};
export function createPromiseMutex(): PromiseMutex { /* ... */ }
```
Imported as `from './refill-mutex'` (no extension) at `concept-feed.service.ts:29`.

From `app/src/services/feed-spread.ts` (Phase 36 GAP-4):
```typescript
export function spreadByConcept<T extends DailyPost>(posts: T[]): T[];
export function spreadByStyle<T extends DailyPost>(posts: T[]): T[];
```
Imported as `from './feed-spread'` (no extension) at `concept-feed.service.ts:27`.

From `app/src/locales/index.ts` (chain-root, untouched in Phase 37 — verified at line 55):
```typescript
export default i18n; // already a default export — main.tsx swap is purely syntactic
```

i18next v26 method semantics (research-verified — Pitfall 3):
- `i18n.t(key, opts?)` is an instance method; passing as bare reference (`i18n.t`) loses `this`, throws `TypeError: Cannot read properties of undefined (reading 'options')`. ALWAYS use `i18n.t.bind(i18n)`.
- `i18n.language` is a getter property (NOT a method); the closure `() => i18n.language` reads live at every call — no `.bind` needed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create i18n-leaf shim + smoke test (atomic commit 1)</name>
  <files>app/src/lib/i18n-leaf.ts, app/tests/lib/i18n-leaf.test.mjs</files>
  <read_first>
    - app/src/services/refill-mutex.ts (leaf-module precedent — closure pattern)
    - app/tests/services/refill-mutex.test.mjs (test precedent)
    - app/src/locales/index.ts (chain root that the shim is breaking — confirms `i18n.t` and `i18n.language` semantics; line 55 confirms default export already exists)
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Code Examples (Shim Implementation + Smoke Test — exact source verbatim)
    - app/tests/lib/date.locale.test.mjs (existing test in tests/lib — confirms directory exists)
  </read_first>
  <behavior>
    - Test 1: default `t(key)` returns the key unchanged (identity).
    - Test 2: default `getCurrentLocale()` returns `'en'`.
    - Test 3: after `bindI18nLeaf(stubT, stubGetter)`, `t('hello')` returns `'T:hello'` and `getCurrentLocale()` returns `'zh'`. Reset to identity at end of test.
    - Test 4: `t(key, opts)` passes the `opts` argument through to the bound function (call-shape check via captured `opts` ref).
  </behavior>
  <action>
    Create `app/src/lib/i18n-leaf.ts` with EXACTLY this content (copy verbatim — no interpretation):

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

    Create `app/tests/lib/i18n-leaf.test.mjs` with EXACTLY this content:

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

    Then commit atomically:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "feat(37-01): add i18n-leaf shim + smoke test" --files app/src/lib/i18n-leaf.ts app/tests/lib/i18n-leaf.test.mjs
    ```

    After commit, run smoke test:
    ```bash
    cd /Users/Code/EchoLearn/app && node --test tests/lib/i18n-leaf.test.mjs
    ```
    Expect 4 tests pass.

    Then run full suite to confirm no regression:
    ```bash
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20
    ```
    Expect SAME failure count as pre-commit baseline (10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures still red — Plan 37-02 closes them; this plan only adds infrastructure).
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/lib/i18n-leaf.test.mjs 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - File `app/src/lib/i18n-leaf.ts` exists.
    - `grep -c "export function bindI18nLeaf" app/src/lib/i18n-leaf.ts` returns `1`.
    - `grep -c "export function t" app/src/lib/i18n-leaf.ts` returns `1`.
    - `grep -c "export function getCurrentLocale" app/src/lib/i18n-leaf.ts` returns `1`.
    - `grep -E "from ['\"](\.\./|\.\./\.\./)?locales" app/src/lib/i18n-leaf.ts` returns NOTHING (shim has zero locale imports — verified by negative match).
    - `grep -E "from ['\"]i18next['\"]" app/src/lib/i18n-leaf.ts` returns NOTHING (shim has zero i18next import — defeats purpose if present).
    - File `app/tests/lib/i18n-leaf.test.mjs` exists.
    - `node --test tests/lib/i18n-leaf.test.mjs` from `app/` reports `pass 4` and `fail 0`.
  </acceptance_criteria>
  <done>Shim source + smoke test committed atomically; 4 smoke tests green; full test suite shows same failure count as before this commit (no regression, no premature progress — Plan 37-02 closes the 10 carried failures).</done>
</task>

<task type="auto">
  <name>Task 2: Wire leaf shim into main.tsx production boot (atomic commit 2)</name>
  <files>app/src/main.tsx</files>
  <read_first>
    - app/src/main.tsx (current state — confirm line 4 is `import './locales';` side-effect-only)
    - app/src/locales/index.ts (line 55 confirms `export default i18n` already exists; main.tsx can switch to default-import without modifying locales/index.ts)
    - app/src/lib/i18n-leaf.ts (just created in Task 1 — confirm `bindI18nLeaf` signature)
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § main.tsx Wire (Plan 37-01) — exact diff specification
  </read_first>
  <action>
    Edit `app/src/main.tsx` with TWO mechanical changes:

    **Change 1:** Replace the side-effect-only import on line 4:
    - BEFORE: `import './locales';`
    - AFTER:  `import i18n from './locales';`

    **Change 2:** Insert two NEW lines immediately after the existing import block (after line 9 `import { migrateLegacyKeys } from './services/legacy-migration.service';` — before any `migrateLegacyKeys()` or `applyTheme(...)` invocation):

    ```tsx
    import { bindI18nLeaf } from './lib/i18n-leaf';

    // Phase 37 (TECHDEBT-01): Wire the leaf shim to the live i18next instance.
    // Identity defaults stay in place for tests that don't import this file.
    bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language);
    ```

    Critical placement constraints (per RESEARCH.md Pattern 2):
    - The bind call MUST appear AFTER `import i18n from './locales'` (so `i18n.t` is bound to a fully-initialized instance — i18next's `.init({...})` runs synchronously on import side-effect, sets `i18n.language` on the same tick).
    - The bind call MUST appear BEFORE `migrateLegacyKeys()` and `applyTheme(...)` invocations (so any service those call paths transitively hit reads the bound `t`, not identity).
    - Use `i18n.t.bind(i18n)` — NOT bare `i18n.t` (Pitfall 3 — detached method loses `this`, throws `TypeError`).
    - Use `() => i18n.language` — NOT `i18n.language` directly (must be a getter closure so `changeLanguage` events are visible at call time).

    Then commit atomically:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "feat(37-01): wire i18n-leaf in main.tsx production boot" --files app/src/main.tsx
    ```

    After commit, verify:
    ```bash
    cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit; echo "tsc exit $?"
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20
    ```
    Expect: tsc exit 0; npm test fail count unchanged from baseline (still 10 — service files not yet migrated).
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit && grep -c "bindI18nLeaf(i18n.t.bind(i18n)" app/src/main.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "import i18n from './locales'" app/src/main.tsx` returns exactly one match (replaced the side-effect-only import).
    - `grep -E "import\s+['\"]\\./locales['\"];?\\s*$" app/src/main.tsx` returns NOTHING (old side-effect import is gone).
    - `grep -n "import { bindI18nLeaf } from './lib/i18n-leaf'" app/src/main.tsx` returns exactly one match.
    - `grep -n "bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)" app/src/main.tsx` returns exactly one match.
    - The line number of the `bindI18nLeaf(...)` invocation is GREATER THAN the line number of `import i18n from './locales'`.
    - The line number of the `bindI18nLeaf(...)` invocation is LESS THAN the line number of `migrateLegacyKeys(` (verify via `grep -n "migrateLegacyKeys(" app/src/main.tsx` — the call site, not the import).
    - `cd app && npx tsc -b --noEmit; echo "exit $?"` prints `exit 0`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+"` shows the SAME failure count as the pre-Plan-37 baseline (typically 10 — Plan 37-01 does not migrate any service file, so the 10 carried failures remain red).
  </acceptance_criteria>
  <done>main.tsx swaps to default-import + adds bindI18nLeaf invocation in correct position; tsc green; full test suite shows no regression; carried failures still red (Plan 37-02 will close them).</done>
</task>

</tasks>

<verification>
After all tasks in this plan complete:

1. `cd /Users/Code/EchoLearn/app && node --test tests/lib/i18n-leaf.test.mjs` — expect 4 pass, 0 fail.
2. `cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit; echo "exit $?"` — expect `exit 0`.
3. `cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20` — expect SAME failure count as pre-Plan-37 baseline (10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures persist; Plan 37-02 closes them).
4. `grep -c "bindI18nLeaf" app/src/main.tsx` returns `2` (1 import + 1 invocation).
5. `grep -E "import\s+['\"]\\./locales['\"];?\\s*$" app/src/main.tsx` returns NOTHING (side-effect-only import is replaced).

Plan boundary check (from VALIDATION.md):
- Plan 37-01 close: `node --test tests/lib/i18n-leaf.test.mjs` (green) + `npm test` (10 carried failures still red — service files not yet migrated).
</verification>

<success_criteria>
- [ ] `app/src/lib/i18n-leaf.ts` created with `t`, `getCurrentLocale`, `bindI18nLeaf` exports.
- [ ] Shim has zero imports from `'../locales'` or `'i18next'` (negative grep verified).
- [ ] `app/tests/lib/i18n-leaf.test.mjs` passes 4/4 assertions.
- [ ] `app/src/main.tsx` swaps to `import i18n from './locales'` (default import).
- [ ] `app/src/main.tsx` adds `bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)` after locales import, before `migrateLegacyKeys()`.
- [ ] `tsc -b --noEmit` exits 0.
- [ ] No new test regressions (carried failures remain at baseline count — they close in Plan 37-02).
- [ ] 2 atomic commits landed (shim+test together; main.tsx wire).
</success_criteria>

<plan_notes>
**Pitfall 7 mitigation:** Run `cd app && npm test 2>&1 | tail -20` after EACH commit. If a non-target test fails after a commit, STOP — that's a regex/import collision (Pitfall 2), not expected progress. Plan 37-01 does NOT change any service file imports, so the failure count must remain stable at the pre-Plan-37 baseline (typically 10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures). Any unexpected regression after the main.tsx wire commit means an upstream service-file path was inadvertently triggered by the import-shape change — investigate before continuing.

**Why the shim+test ship in the same commit (not separate):** The smoke test directly imports `'../../src/lib/i18n-leaf.ts'`. Shipping the test alone (without the source) would fail the test suite; shipping the source alone (without a test) leaves Plan 37-01's hold-out unverifiable until end-of-plan. Atomic-pair is the right granularity per D-03.

**Why the main.tsx change is its own commit:** Different file, different risk profile. The wire is the only place where production behavior could deviate from pre-Phase-37. Bisection-friendly.
</plan_notes>

<output>
After completion, create `.planning/phases/37-i18n-leaf-module-refactor/37-01-SUMMARY.md` documenting:
- Shim API surface (D-01 confirmed: t/getCurrentLocale/bindI18nLeaf only)
- main.tsx wire diff (line numbers before/after)
- Smoke test result (4/4 green)
- Pre-existing 10 carried failures STILL red (handed off to Plan 37-02)
- tsc -b --noEmit exit code (must be 0)
</output>
