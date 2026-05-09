---
phase: 37-i18n-leaf-module-refactor
plan: 03
type: execute
wave: 3
depends_on: [02]
files_modified:
  - app/src/services/youtube-locale-url.ts
  - app/tests/services/youtube-locale.test.mjs
  - app/src/lib/date.ts
  - app/tests/lib/date.locale.test.mjs
  - app/src/providers/llm/locale-directive.ts
  - app/tests/providers/llm-locale-injection.test.mjs
  - app/src/providers/tts/index.ts
  - app/tests/providers/tts-locale.test.mjs
  - app/tests/services/leaf-imports.test.mjs
autonomous: true
requirements: [TECHDEBT-01]

must_haves:
  truths:
    - "All 4 Tier 3 source files import from `i18n-leaf` (no longer `i18next` directly)."
    - "All 4 paired Tier 3 test files call `bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language)` after their `await i18next.init({...})` block — and BEFORE the dynamic `await import(...)` of the module under test (Pitfall 1 mitigation)."
    - "D-07 comment block at top of `providers/llm/locale-directive.ts` (lines 1-15) is preserved verbatim AND extended with a Phase 37 footnote noting the leaf is the indirection layer."
    - "Source-reading invariant test `tests/services/leaf-imports.test.mjs` exists with 4 assertions and is green."
    - "After plan close: `npm test` reports `fail 0` (10 carried failures stay closed; 4 Tier 3 tests stay green via paired binds; new invariant green); `tsc -b --noEmit` exits 0."
  artifacts:
    - path: "app/src/services/youtube-locale-url.ts"
      provides: "Tier 3 — migrated to leaf shim's getCurrentLocale()"
      contains: "from '../lib/i18n-leaf'"
    - path: "app/src/lib/date.ts"
      provides: "Tier 3 — heaviest consumer; 5 call sites migrated (1 .language + 4 .t)"
      contains: "from './i18n-leaf'"
    - path: "app/src/providers/llm/locale-directive.ts"
      provides: "Tier 3 — D-07 comment block preserved + Phase 37 footnote added; 1 call site migrated"
      contains: "Phase 37 note"
    - path: "app/src/providers/tts/index.ts"
      provides: "Tier 3 — migrated to leaf shim's getCurrentLocale()"
      contains: "from '../../lib/i18n-leaf'"
    - path: "app/tests/services/leaf-imports.test.mjs"
      provides: "Source-reading invariant — no service/lib/provider file (except leaf) imports from '../locales' or 'i18next' directly"
      contains: "leaf-imports"
      min_lines: 60
  key_links:
    - from: "app/src/services/youtube-locale-url.ts"
      to: "app/src/lib/i18n-leaf.ts"
      via: "import { getCurrentLocale } from '../lib/i18n-leaf'"
      pattern: "from\\s+['\"]\\.\\./lib/i18n-leaf['\"]"
    - from: "app/src/providers/llm/locale-directive.ts"
      to: "app/src/lib/i18n-leaf.ts"
      via: "import { getCurrentLocale } from '../../lib/i18n-leaf'"
      pattern: "from\\s+['\"]\\.\\./\\.\\./lib/i18n-leaf['\"]"
    - from: "app/tests/lib/date.locale.test.mjs (and 3 other paired tests)"
      to: "app/src/lib/i18n-leaf.ts (via bindI18nLeaf wire to test-local i18next)"
      via: "bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language)"
      pattern: "bindI18nLeaf"
---

<objective>
Migrate the 4 Tier 3 already-leaf modules (already test-friendly under `node --test`, but importing `i18next` directly) to consume the `i18n-leaf` shim. Each migration is paired with its existing test file update in the SAME atomic commit (Pitfall 1 — without paired test update, the source migration breaks 4 currently-green tests). After all 4 migrations, add a final atomic commit with a source-reading invariant test (`tests/services/leaf-imports.test.mjs`) that guards against future drift — no service/lib/provider file (except the leaf itself + main.tsx + locales/) may import from `'../locales'` or `'i18next'` directly.

Purpose: TECHDEBT-01 Goal 4 (Tier 3 regression-free) + Goal 2 (invariant test enforces shim-only-going-forward).

Output: 4 source migrations + 4 paired test updates + 1 new invariant test = 5 atomic commits.

D-07 preservation: `providers/llm/locale-directive.ts` carries a load-bearing comment block (Phase 27 D-07: "ONLY code path that reads i18n locale for an LLM request"). The migration must preserve this verbatim and add a one-line Phase 37 footnote noting the leaf is now the indirection layer.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

@.planning/phases/37-i18n-leaf-module-refactor/37-CONTEXT.md
@.planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md
@.planning/phases/37-i18n-leaf-module-refactor/37-VALIDATION.md
@.planning/phases/37-i18n-leaf-module-refactor/37-01-SUMMARY.md
@.planning/phases/37-i18n-leaf-module-refactor/37-02-SUMMARY.md

@CLAUDE.md

@app/src/lib/i18n-leaf.ts

@app/tests/services/web-search-no-locale.test.mjs

<interfaces>
<!-- Leaf shim API surface (created in Plan 37-01). -->
From `app/src/lib/i18n-leaf.ts`:
```typescript
export function bindI18nLeaf(
  tFn: (key: string, opts?: Record<string, unknown>) => string,
  getLocale: () => string,
): void;
export function t(key: string, opts?: Record<string, unknown>): string;
export function getCurrentLocale(): string;
```

<!-- Tier 3 files use BOTH `t` and/or `getCurrentLocale` (date.ts uses both; the others use only getCurrentLocale). -->

<!-- D-07 load-bearing comment block at app/src/providers/llm/locale-directive.ts:1-15 (must be preserved verbatim during migration). -->
Excerpt to preserve verbatim (executor reads file pre-edit to get current text — this is the structural shape):
```
// IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale
// for an LLM request.
// ... (rest of comment block — read pre-edit, do not modify)
```

The Phase 37 footnote (NEW lines added after the existing block):
```
//
// Phase 37 note: this module reads locale via `getCurrentLocale()` from
// `../../lib/i18n-leaf` (the leaf is the indirection layer). Behavior is
// byte-stable vs. the pre-Phase-37 direct i18next.language read.
```

<!-- Pattern for Tier 3 paired test update (Pitfall 1) — applied identically to 4 test files. -->
Insert AFTER the existing `await i18next.init({...})` block AND BEFORE the existing `await import('../../src/...')` of the module under test:
```javascript
import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';
// ... (existing imports + i18next.init({...}) block)
bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);
// then the existing await import(...) of the module under test
```

<!-- Existing precedent for source-reading invariant test pattern. -->
From `app/tests/services/web-search-no-locale.test.mjs` (Phase 27 D-15 — pattern to follow): asserts no LLM-side translation calls in `web-search.service.ts` source. Tier 3's new `leaf-imports.test.mjs` follows the same shape: walk `app/src/`, grep regex over each file, assert no offenders.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate youtube-locale-url.ts + paired test (atomic commit 1 — smallest blast radius first)</name>
  <files>app/src/services/youtube-locale-url.ts, app/tests/services/youtube-locale.test.mjs</files>
  <read_first>
    - app/src/services/youtube-locale-url.ts (current state — confirm line 10 has `import i18next from 'i18next';` and line 35 reads `i18next.language as SupportedLocale`)
    - app/tests/services/youtube-locale.test.mjs (current state — confirm `await i18next.init({...})` block around line 15 and the dynamic `await import('../../src/services/youtube-locale-url.ts')` after it)
    - app/src/lib/i18n-leaf.ts (confirm `getCurrentLocale` is exported)
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 3 Migration Mapping (Plan 37-03) — `youtube-locale-url.ts` row + paired test instruction
  </read_first>
  <action>
    **Source file edit — `app/src/services/youtube-locale-url.ts`:**

    **Change 1 (import line, around line 10):**
    - BEFORE: `import i18next from 'i18next';`
    - AFTER:  `import { getCurrentLocale } from '../lib/i18n-leaf';`

    **Change 2 (call site, around line 35):**
    - BEFORE: `i18next.language as SupportedLocale`
    - AFTER:  `getCurrentLocale() as SupportedLocale`

    **Paired test edit — `app/tests/services/youtube-locale.test.mjs`:**

    **Change A (add import alongside existing `import i18next` line):**
    Add this line near the top imports:
    ```javascript
    import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';
    ```

    **Change B (insert wire AFTER `await i18next.init({...})` block — around line 15 — AND BEFORE the dynamic `await import('../../src/services/youtube-locale-url.ts')` call):**
    Add this line:
    ```javascript
    bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);
    ```

    Note: The bind call MUST appear AFTER `await i18next.init({...})` resolves AND BEFORE the dynamic import of the module under test. Pitfall 1 — without this, the migrated source reads identity defaults `'en'` regardless of `i18next.changeLanguage` calls in subsequent tests.

    Atomic commit (source + paired test together):
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-03): migrate youtube-locale-url.ts to i18n-leaf shim + pair test" --files app/src/services/youtube-locale-url.ts app/tests/services/youtube-locale.test.mjs
    ```

    Verify after:
    ```bash
    cd /Users/Code/EchoLearn/app && node --test tests/services/youtube-locale.test.mjs 2>&1 | tail -10
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1
    ```
    Expect: `youtube-locale.test.mjs` green; full suite `fail 0`.

    **STOP and INVESTIGATE** if `youtube-locale.test.mjs` goes red — most likely the bind call landed AFTER the dynamic import (Pitfall 4 timing) or the bind was omitted (Pitfall 1).
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services/youtube-locale.test.mjs 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../lib/i18n-leaf'" app/src/services/youtube-locale-url.ts` returns `1`.
    - `grep -E "from\s+['\"]i18next['\"]" app/src/services/youtube-locale-url.ts` returns NOTHING (i18next direct import removed).
    - `grep -c "i18next.language" app/src/services/youtube-locale-url.ts` returns `0`.
    - `grep -c "getCurrentLocale()" app/src/services/youtube-locale-url.ts` returns `1`.
    - `grep -c "bindI18nLeaf" app/tests/services/youtube-locale.test.mjs` returns at least `2` (1 import + 1 invocation).
    - `cd app && node --test tests/services/youtube-locale.test.mjs 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>youtube-locale-url.ts + youtube-locale.test.mjs migrated atomically; paired test green; full suite green.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate lib/date.ts + paired test (atomic commit 2 — heaviest consumer, 5 call sites)</name>
  <files>app/src/lib/date.ts, app/tests/lib/date.locale.test.mjs</files>
  <read_first>
    - app/src/lib/date.ts (current state — confirm line 1 `import i18next`, line 19 `i18next.language`, line 65 `i18next.t('common.today')`, lines 76-78 `i18next.t('common.greeting.X')`)
    - app/tests/lib/date.locale.test.mjs (current state — confirm `await i18next.init({...})` around line 50 and dynamic `await import('../../src/lib/date.ts')` follows)
    - app/src/lib/i18n-leaf.ts
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 3 Migration Mapping — `lib/date.ts` row + paired test instruction
  </read_first>
  <action>
    **Source file edit — `app/src/lib/date.ts`:**

    **Change 1 (import line, around line 1):**
    - BEFORE: `import i18next from 'i18next';`
    - AFTER:  `import { t, getCurrentLocale } from './i18n-leaf';`

    Note: Sibling-relative path `./i18n-leaf` since both files live in `src/lib/`.

    **Change 2 (around line 19 — single `.language` read):**
    - BEFORE: `i18next.language` (in whatever expression context — e.g., `currentIntlLocale = i18next.language`)
    - AFTER:  `getCurrentLocale()` (preserve the surrounding expression intact — only swap the read)

    **Changes 3-6 (4 `.t(...)` calls at lines ~65, ~76, ~77, ~78):**
    - BEFORE: `i18next.t('common.today')` and `i18next.t('common.greeting.X')` (3 greeting variants)
    - AFTER:  `t('common.today')` and `t('common.greeting.X')` (drop the `i18next.` namespace prefix)

    Pre-edit verification: `grep -nE "i18next\.(t|language)" app/src/lib/date.ts` must return EXACTLY 5 matches. Post-edit: ZERO matches.

    **Paired test edit — `app/tests/lib/date.locale.test.mjs`:**

    **Change A (add import alongside existing `import i18next`):**
    ```javascript
    import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';
    ```

    **Change B (insert wire AFTER `await i18next.init({...})` block AND BEFORE `await import('../../src/lib/date.ts')`):**
    ```javascript
    bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);
    ```

    Atomic commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-03): migrate lib/date.ts to i18n-leaf shim + pair test" --files app/src/lib/date.ts app/tests/lib/date.locale.test.mjs
    ```

    Verify:
    ```bash
    cd /Users/Code/EchoLearn/app && node --test tests/lib/date.locale.test.mjs 2>&1 | tail -10
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1
    ```

    **STOP if `date.locale.test.mjs` goes red.** Failure message `expected 'zh-CN', got 'en-US'` is the Pitfall 1 fingerprint — the bind call is missing or in the wrong position.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/lib/date.locale.test.mjs 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from './i18n-leaf'" app/src/lib/date.ts` returns `1`.
    - `grep -E "from\s+['\"]i18next['\"]" app/src/lib/date.ts` returns NOTHING.
    - `grep -cE "i18next\.(t|language)" app/src/lib/date.ts` returns `0`.
    - `grep -c "getCurrentLocale()" app/src/lib/date.ts` returns at least `1`.
    - `grep -c "t('common." app/src/lib/date.ts` returns at least `4` (today + 3 greeting variants).
    - `grep -c "bindI18nLeaf" app/tests/lib/date.locale.test.mjs` returns at least `2`.
    - `cd app && node --test tests/lib/date.locale.test.mjs 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>lib/date.ts (5 call sites) + date.locale.test.mjs migrated atomically; paired test green; full suite green.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate providers/llm/locale-directive.ts + paired test (atomic commit 3 — D-07 comment preservation)</name>
  <files>app/src/providers/llm/locale-directive.ts, app/tests/providers/llm-locale-injection.test.mjs</files>
  <read_first>
    - app/src/providers/llm/locale-directive.ts (current state — READ FULL FILE; confirm the load-bearing D-07 comment block at lines 1-15 EXACTLY so it can be preserved verbatim. Confirm line 16 `import i18next from 'i18next';` and line 36 `i18next.language as SupportedLocale`.)
    - app/tests/providers/llm-locale-injection.test.mjs (current state — confirm `await i18next.init({...})` around line 16 and dynamic `await import('../../src/providers/llm/locale-directive.ts')` around line 21)
    - app/src/lib/i18n-leaf.ts
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 3 Migration Mapping — `providers/llm/locale-directive.ts` row AND § D-07 Comment Update for the exact footnote text
    - .planning/milestones/v1.3-phases/27-add-i18n-l10n-support/27-CONTEXT.md (Phase 27 D-07 — original load-bearing context for the comment block being preserved)
  </read_first>
  <action>
    **Source file edit — `app/src/providers/llm/locale-directive.ts`:**

    **Change 1 (preserve EXISTING D-07 comment block at lines 1-15 verbatim, then ADD Phase 37 footnote at lines 16-19 — before the import):**

    Read the existing comment block. The current text (per RESEARCH.md inspection — verify by reading the file pre-edit) is approximately:
    ```
    // IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale
    // for an LLM request. Do NOT add a `locale` param to CompletionOptions or any
    // call site. Do NOT call chatCompletion/chatStream for translation — dev-time
    // Sonnet subagent owns all UI translation (see CLAUDE.md i18n Workflow).
    ```

    Append the following footnote (NEW LINES added immediately after the existing comment block, BEFORE the `import` statement):
    ```
    //
    // Phase 37 note: this module reads locale via `getCurrentLocale()` from
    // `../../lib/i18n-leaf` (the leaf is the indirection layer). Behavior is
    // byte-stable vs. the pre-Phase-37 direct i18next.language read.
    ```

    Critical: Do NOT delete or rephrase any line of the existing comment block. The footnote is APPEND-ONLY.

    **Change 2 (import line, around line 16 — was `import i18next from 'i18next';`):**
    - BEFORE: `import i18next from 'i18next';`
    - AFTER:  `import { getCurrentLocale } from '../../lib/i18n-leaf';`

    Note: Two-level relative path `../../lib/i18n-leaf` since `locale-directive.ts` lives in `src/providers/llm/`.

    **Change 3 (call site, around line 36):**
    - BEFORE: `i18next.language as SupportedLocale`
    - AFTER:  `getCurrentLocale() as SupportedLocale`

    Pre-edit verification: `grep -c "i18next" app/src/providers/llm/locale-directive.ts` must return at least 2 (the import + the read). Post-edit: ZERO matches for `i18next` in the file.

    **Paired test edit — `app/tests/providers/llm-locale-injection.test.mjs`:**

    **Change A (add import):**
    ```javascript
    import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';
    ```

    **Change B (insert wire AFTER `await i18next.init({...})` around line 16 AND BEFORE `await import('../../src/providers/llm/locale-directive.ts')` around line 21):**
    ```javascript
    bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);
    ```

    Atomic commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-03): migrate locale-directive.ts to i18n-leaf shim + pair test, preserve D-07 comment + add Phase 37 footnote" --files app/src/providers/llm/locale-directive.ts app/tests/providers/llm-locale-injection.test.mjs
    ```

    Verify:
    ```bash
    cd /Users/Code/EchoLearn/app && node --test tests/providers/llm-locale-injection.test.mjs 2>&1 | tail -10
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1
    ```

    **STOP if `llm-locale-injection.test.mjs` goes red.** Failure message `expected 'Respond in Japanese.', got 'Respond in English.'` is the Pitfall 1 fingerprint.

    **Also STOP if** the D-07 comment block was modified — it is load-bearing per Phase 27. Run:
    ```bash
    grep -A 4 "IMPORTANT (D-07)" app/src/providers/llm/locale-directive.ts | head -10
    ```
    Confirm the exact text of the existing block survived intact (only NEW lines added after).
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/providers/llm-locale-injection.test.mjs 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../../lib/i18n-leaf'" app/src/providers/llm/locale-directive.ts` returns `1`.
    - `grep -E "from\s+['\"]i18next['\"]" app/src/providers/llm/locale-directive.ts` returns NOTHING.
    - `grep -c "i18next" app/src/providers/llm/locale-directive.ts` returns `0` (full removal — no comment-block reference to i18next either, since the original comment block uses `i18n` not `i18next`).
    - `grep -c "getCurrentLocale()" app/src/providers/llm/locale-directive.ts` returns `1`.
    - `grep -c "IMPORTANT (D-07)" app/src/providers/llm/locale-directive.ts` returns `1` (existing comment preserved).
    - `grep -c "Phase 37 note" app/src/providers/llm/locale-directive.ts` returns `1` (footnote added).
    - `grep -c "byte-stable vs. the pre-Phase-37" app/src/providers/llm/locale-directive.ts` returns `1` (verifies footnote text is the canonical RESEARCH.md text, not paraphrased).
    - `grep -c "bindI18nLeaf" app/tests/providers/llm-locale-injection.test.mjs` returns at least `2`.
    - `cd app && node --test tests/providers/llm-locale-injection.test.mjs 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>locale-directive.ts migrated with D-07 comment preserved + Phase 37 footnote added; llm-locale-injection.test.mjs paired updated; both green; full suite green; atomic commit landed.</done>
</task>

<task type="auto">
  <name>Task 4: Migrate providers/tts/index.ts + paired test (atomic commit 4)</name>
  <files>app/src/providers/tts/index.ts, app/tests/providers/tts-locale.test.mjs</files>
  <read_first>
    - app/src/providers/tts/index.ts (current state — confirm line 1 `import i18next` and line 26 `i18next.language as SupportedLocale`)
    - app/tests/providers/tts-locale.test.mjs (current state — confirm `await i18next.init({...})` around line 15 and global fetch shim setup around line 21)
    - app/src/lib/i18n-leaf.ts
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 3 Migration Mapping — `providers/tts/index.ts` row + paired test instruction
  </read_first>
  <action>
    **Source file edit — `app/src/providers/tts/index.ts`:**

    **Change 1 (import line, around line 1):**
    - BEFORE: `import i18next from 'i18next';`
    - AFTER:  `import { getCurrentLocale } from '../../lib/i18n-leaf';`

    **Change 2 (call site, around line 26):**
    - BEFORE: `i18next.language as SupportedLocale`
    - AFTER:  `getCurrentLocale() as SupportedLocale`

    Pre-edit: `grep -c "i18next" app/src/providers/tts/index.ts` must return at least 2. Post-edit: 0.

    **Paired test edit — `app/tests/providers/tts-locale.test.mjs`:**

    **Change A:**
    ```javascript
    import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';
    ```

    **Change B (insert AFTER `await i18next.init({...})` around line 15; ordering vs. the global fetch shim around line 21 doesn't matter since the bind doesn't fetch — but it MUST come before any `await import('../../src/providers/tts/index.ts')`):**
    ```javascript
    bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);
    ```

    Atomic commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-03): migrate tts/index.ts to i18n-leaf shim + pair test" --files app/src/providers/tts/index.ts app/tests/providers/tts-locale.test.mjs
    ```

    Verify:
    ```bash
    cd /Users/Code/EchoLearn/app && node --test tests/providers/tts-locale.test.mjs 2>&1 | tail -10
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1
    ```
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/providers/tts-locale.test.mjs 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../../lib/i18n-leaf'" app/src/providers/tts/index.ts` returns `1`.
    - `grep -E "from\s+['\"]i18next['\"]" app/src/providers/tts/index.ts` returns NOTHING.
    - `grep -c "i18next" app/src/providers/tts/index.ts` returns `0`.
    - `grep -c "getCurrentLocale()" app/src/providers/tts/index.ts` returns `1`.
    - `grep -c "bindI18nLeaf" app/tests/providers/tts-locale.test.mjs` returns at least `2`.
    - `cd app && node --test tests/providers/tts-locale.test.mjs 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>tts/index.ts + tts-locale.test.mjs migrated atomically; paired test green; full suite green.</done>
</task>

<task type="auto">
  <name>Task 5: Add source-reading invariant test leaf-imports.test.mjs (atomic commit 5 — closes Phase 37)</name>
  <files>app/tests/services/leaf-imports.test.mjs</files>
  <read_first>
    - app/tests/services/web-search-no-locale.test.mjs (precedent for source-reading invariant test pattern)
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Validation Architecture > Contract Tests — exact source for `tests/services/leaf-imports.test.mjs`
    - app/src/lib/i18n-leaf.ts (asserted by the test — confirm exports)
  </read_first>
  <action>
    Create `app/tests/services/leaf-imports.test.mjs` with EXACTLY this content (copy verbatim from RESEARCH.md § Validation Architecture > Contract Tests):

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

    Note: The `ALLOWED_LOCALES_IMPORTERS` set is currently unused by the test body (the negative regex over `TARGET_DIRS` already excludes `src/locales/` and `src/main.tsx` because they are not under `services/`, `lib/`, or `providers/`). Keep it in the source as documentation of the explicit allowlist — future regressions that move the leaf elsewhere can adjust this set without re-deriving the rationale.

    Atomic commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test(37-03): add leaf-imports invariant test (Phase 37 close-out)" --files app/tests/services/leaf-imports.test.mjs
    ```

    Final verification (Phase 37 close-out gate):
    ```bash
    cd /Users/Code/EchoLearn/app && node --test tests/services/leaf-imports.test.mjs 2>&1 | tail -10
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1
    cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit; echo "tsc exit $?"
    ```

    Expect: invariant test 4/4 green; `npm test` `fail 0`; `tsc exit 0`.

    **STOP if** the invariant test reports any offenders. The output lists exact file paths — fix those files (likely a Tier 1+2 or Tier 3 file that didn't get its import updated correctly in Plans 37-02/37-03) and re-commit before continuing.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services/leaf-imports.test.mjs 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/services/leaf-imports.test.mjs` exists.
    - `grep -c "no service/lib/provider file imports from" app/tests/services/leaf-imports.test.mjs` returns `1`.
    - `grep -c "no service/lib/provider file (except the leaf) imports i18next" app/tests/services/leaf-imports.test.mjs` returns `1`.
    - `grep -c "i18n-leaf.ts itself does NOT import" app/tests/services/leaf-imports.test.mjs` returns `1`.
    - `grep -c "i18n-leaf.ts exports t, getCurrentLocale, bindI18nLeaf" app/tests/services/leaf-imports.test.mjs` returns `1`.
    - `cd app && node --test tests/services/leaf-imports.test.mjs 2>&1 | grep -E "(pass|fail) [0-9]+"` shows `pass 4` and `fail 0`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
    - `cd app && npx tsc -b --noEmit; echo "exit $?"` prints `exit 0`.
  </acceptance_criteria>
  <done>leaf-imports.test.mjs created with 4 invariant assertions, all green; full suite green; tsc green; Phase 37 close-out complete.</done>
</task>

</tasks>

<verification>
After all tasks in this plan complete (Phase 37 close-out gate):

1. **Full suite green:**
   ```bash
   cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1
   ```
   Expect `fail 0`.

2. **TypeScript compile green:**
   ```bash
   cd app && npx tsc -b --noEmit; echo "exit $?"
   ```
   Expect `exit 0`.

3. **Invariant test green:**
   ```bash
   cd app && node --test tests/services/leaf-imports.test.mjs 2>&1 | tail -10
   ```
   Expect 4/4 pass.

4. **Per-file invariant for all 9 source files:**
   ```bash
   for f in services/flashcard.service.ts services/podcast.service.ts services/question.service.ts services/scheduler.service.ts services/session.service.ts services/youtube-locale-url.ts lib/date.ts providers/llm/locale-directive.ts providers/tts/index.ts; do
     echo "=== $f ==="
     grep -c "i18n-leaf" app/src/$f
     grep -E "from\s+['\"](\.\./|\.\./\.\./)?locales|from\s+['\"]i18next['\"]" app/src/$f
   done
   ```
   Expect: each file shows `1` (leaf import present) and nothing (no offending imports).

5. **D-07 comment preservation:**
   ```bash
   grep -c "IMPORTANT (D-07)" app/src/providers/llm/locale-directive.ts
   grep -c "Phase 37 note" app/src/providers/llm/locale-directive.ts
   ```
   Expect both return `1`.

6. **Tier 3 paired tests stay green:**
   ```bash
   for t in tests/lib/date.locale.test.mjs tests/providers/llm-locale-injection.test.mjs tests/providers/tts-locale.test.mjs tests/services/youtube-locale.test.mjs; do
     cd app && node --test $t 2>&1 | grep -E "fail [0-9]+" | head -1
   done
   ```
   Expect each shows `fail 0`.

7. **Manual UAT (deferred to operator before `/gsd:verify-work`):** Boot the app; switch locales EN→ZH→ES→JA in Settings; verify toasts/dates/voices update without console errors. (TECHDEBT-01 Goal 4 — manual gate per VALIDATION.md.)

Plan boundary check (from VALIDATION.md):
- Plan 37-03 close: `npm test` (`fail 0`) + `node --test tests/services/leaf-imports.test.mjs` (4/4 green) + `tsc -b --noEmit` (exit 0).
</verification>

<success_criteria>
- [ ] All 4 Tier 3 source files migrated to leaf shim (`youtube-locale-url`, `date`, `locale-directive`, `tts/index`).
- [ ] All 4 paired Tier 3 tests updated with `bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language)` AFTER `await i18next.init({...})` and BEFORE `await import(...)` (Pitfall 1 mitigation).
- [ ] D-07 comment block at top of `locale-directive.ts` preserved verbatim with Phase 37 footnote appended.
- [ ] `tests/services/leaf-imports.test.mjs` created with 4 source-reading invariant assertions, all green.
- [ ] `npm test` reports `fail 0` (10 carried failures stay closed; 4 Tier 3 tests stay green; new invariant green).
- [ ] `tsc -b --noEmit` exits 0.
- [ ] 5 atomic commits landed (4 paired source+test + 1 invariant test).
- [ ] No new test regressions from any source-reading test (Pitfall 2).
</success_criteria>

<plan_notes>
**Pitfall 7 mitigation (load-bearing):** Run `cd app && npm test 2>&1 | tail -20` AFTER EACH commit. Expected progression in this plan:
- Pre-Task-1 baseline (after Plan 37-02): `fail 0`.
- After EACH Tier 3 paired commit (Tasks 1-4): `fail 0`. The Tier 3 paired tests stay green BECAUSE the test update lands in the SAME commit as the source migration — that's the entire point of pairing per Pitfall 1. If a paired test goes red, the bind call is missing or in the wrong position; STOP and fix before next task.
- After Task 5 (invariant test): `fail 0` AND new test green. If invariant test reports offenders, Plan 37-02 or earlier Tier 3 commit left an unmigrated import — fix the offending file and re-commit.

**Pitfall 1 (Tier 3 test breakage) is the dominant risk in this plan:** Every Tier 3 source migration changes the module's read source from `i18next.language` (test-shared global) to `getCurrentLocale()` (leaf-internal, identity default `'en'` until bound). Without the paired `bindI18nLeaf` wire, the module reads `'en'` regardless of `i18next.changeLanguage` — failure messages like `expected 'zh-CN', got 'en-US'` (date.ts) or `expected 'Respond in Japanese.', got 'Respond in English.'` (locale-directive.ts) are the fingerprint.

**Pitfall 4 (timing) is real but verified safe:** None of the 9 migrated files invoke `t()` or `getCurrentLocale()` at module top level. All call sites are inside function bodies. The bind in test files MUST land BEFORE the dynamic `await import(...)` of the module under test — but since the modules don't read at top-level, the bind-then-import order works. If a future Tier 3 module changes this, the test pattern needs revisiting.

**D-07 comment preservation discipline:** The `IMPORTANT (D-07)` comment block at `providers/llm/locale-directive.ts` lines 1-15 is load-bearing per Phase 27 and CLAUDE.md i18n Workflow. The Phase 37 footnote is APPEND-ONLY — do NOT delete or rephrase the existing block. The acceptance criteria grep for both the original block ("IMPORTANT (D-07)") and the footnote ("Phase 37 note", "byte-stable vs. the pre-Phase-37") so a paraphrase failure surfaces immediately.

**Order rationale (RESEARCH.md § Pitfall E recommendation):**
1. youtube-locale-url.ts first — smallest blast radius, simplest migration.
2. lib/date.ts second — heaviest consumer (5 call sites), highest test exposure.
3. locale-directive.ts third — D-07 comment preservation requires careful read-before-edit.
4. tts/index.ts fourth — straightforward, paired with the invariant test commit pattern fully established.
5. Invariant test last — guards against any drift introduced in commits 1-4 (or Plan 37-02 leftovers).

**Phase 37 close-out:** After Task 5, the phase is complete. Operator may proceed to manual UAT (locale-switch in Settings) before `/gsd:verify-work`.
</plan_notes>

<output>
After completion, create `.planning/phases/37-i18n-leaf-module-refactor/37-03-SUMMARY.md` documenting:
- 5 atomic commits landed (4 paired Tier 3 source+test + 1 invariant test) with their git hashes
- D-07 comment preservation confirmation (existing block intact, Phase 37 footnote appended)
- Invariant test result (4/4 green)
- Per-file `i18next` removal confirmation across all 4 Tier 3 source files
- Full suite `fail 0` + tsc exit 0
- Manual UAT handoff: operator runs locale-switch in Settings before `/gsd:verify-work` (TECHDEBT-01 Goal 4 manual gate per VALIDATION.md)
- Phase 37 close-out: 9 source files migrated (5 Tier 1+2 + 4 Tier 3) + 1 main.tsx wire + 2 new test files (smoke + invariant) + 4 paired test updates = 16 file changes across 11 atomic commits over 3 plans (2+5+5).
</output>
