---
phase: 37-i18n-leaf-module-refactor
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - app/src/services/flashcard.service.ts
  - app/src/services/podcast.service.ts
  - app/src/services/question.service.ts
  - app/src/services/scheduler.service.ts
  - app/src/services/session.service.ts
autonomous: true
requirements: [TECHDEBT-01]

must_haves:
  truths:
    - "All 5 Tier 1+2 service files import from `../lib/i18n-leaf` (no extension), not `'../locales'` or `'../locales/index.ts'`."
    - "All 8 `i18n.t(...)` call sites across the 5 files are rewritten to `t(...)` (using the named import, not the namespace pattern)."
    - "10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures across `tests/concept-feed.test.mjs`, `tests/services/trellis-state.test.mjs`, `tests/services/trellis-layout.test.mjs`, `tests/e2e/trellis-review-update.test.mjs` turn from red to green."
    - "After plan close: `npm test` reports `fail 0`; `tsc -b --noEmit` exits 0."
    - "No new test regressions introduced (Pitfall 7 — source-reading regex collisions caught after each atomic commit)."
  artifacts:
    - path: "app/src/services/flashcard.service.ts"
      provides: "Migrated to leaf shim — chain root broken; 1 call site rewritten"
      contains: "from '../lib/i18n-leaf'"
    - path: "app/src/services/podcast.service.ts"
      provides: "Migrated to leaf shim — 1 call site rewritten"
      contains: "from '../lib/i18n-leaf'"
    - path: "app/src/services/question.service.ts"
      provides: "Migrated to leaf shim — 1 call site rewritten"
      contains: "from '../lib/i18n-leaf'"
    - path: "app/src/services/scheduler.service.ts"
      provides: "Migrated to leaf shim — 2 call sites rewritten"
      contains: "from '../lib/i18n-leaf'"
    - path: "app/src/services/session.service.ts"
      provides: "Migrated to leaf shim — 3 call sites rewritten"
      contains: "from '../lib/i18n-leaf'"
  key_links:
    - from: "app/src/services/flashcard.service.ts"
      to: "app/src/lib/i18n-leaf.ts"
      via: "import { t } from '../lib/i18n-leaf'"
      pattern: "from\\s+['\"]\\.\\./lib/i18n-leaf['\"]"
    - from: "tests/concept-feed.test.mjs (and 4 other carried-failing test files)"
      to: "flashcard.service.ts → ../lib/i18n-leaf (no longer ../locales)"
      via: "transitive ESM resolution chain unwound — JSON imports no longer in tree"
      pattern: "fail 0"
---

<objective>
Migrate the 5 Tier 1+2 service files (flashcard, podcast, question, scheduler, session) from `'../locales'` to `'../lib/i18n-leaf'`. Each file is committed atomically per D-03. After this plan, the 10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` test failures (rooted in `flashcard.service.ts → ../locales/index.ts → en.json`) turn green. Behavior is byte-stable — production reads the same i18next instance via the leaf bind set up in Plan 37-01.

Purpose: TECHDEBT-01 Goal 1 — close the 10 carried test failures.

Output: 5 modified service files + 5 atomic commits. After plan close: `npm test` reports `fail 0`.

Note: Carried failures actually close on commit 1 (`flashcard.service.ts` is the chain root — verified at RESEARCH.md § Hold-Out Tests). Commits 2-5 must KEEP the count at 0 (any regression is a Pitfall 2 collision — investigate before continuing).
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

@CLAUDE.md

@app/src/lib/i18n-leaf.ts

<interfaces>
<!-- The leaf shim API surface that all 5 Tier 1+2 files now consume. -->

From `app/src/lib/i18n-leaf.ts` (created in Plan 37-01):
```typescript
export function bindI18nLeaf(
  tFn: (key: string, opts?: Record<string, unknown>) => string,
  getLocale: () => string,
): void;
export function t(key: string, opts?: Record<string, unknown>): string;
export function getCurrentLocale(): string;
```

Tier 1+2 files use ONLY `t` (named import). `getCurrentLocale` is consumed by Tier 3 files in Plan 37-03.

**Key migration shape:**
- BEFORE: `import i18n from '../locales';` (or `'../locales/index.ts'`) + `i18n.t('common.toast.X')`
- AFTER:  `import { t } from '../lib/i18n-leaf';` + `t('common.toast.X')`

Identifier `i18n` (namespace) is removed. The named export `t` becomes the call site.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate flashcard.service.ts (atomic commit 1 — closes 10 carried failures)</name>
  <files>app/src/services/flashcard.service.ts</files>
  <read_first>
    - app/src/services/flashcard.service.ts (current state — confirm line 5 import + line 81 call site exactly match the migration mapping)
    - app/src/lib/i18n-leaf.ts (Plan 37-01 output — confirm `t` is exported)
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 1+2 Migration Mapping (Plan 37-02) — table row for `flashcard.service.ts`
  </read_first>
  <action>
    Edit `app/src/services/flashcard.service.ts` with TWO mechanical changes:

    **Change 1 (import line, around line 5):**
    - BEFORE: `import i18n from '../locales/index.ts';`
    - AFTER:  `import { t } from '../lib/i18n-leaf';`

    **Change 2 (call site, around line 81):**
    - BEFORE: `i18n.t('common.toast.storageFullFlashcards')`
    - AFTER:  `t('common.toast.storageFullFlashcards')`

    Note: Line numbers are RESEARCH.md's reference points captured 2026-05-08. If a small drift (±2 lines) is observed, follow the patterns NOT the line numbers — the only `i18n.t(` call site in the file. Verify by `grep -n "i18n.t(" app/src/services/flashcard.service.ts` BEFORE editing — must show exactly one match. After editing, the same grep must show ZERO matches.

    Then commit atomically:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-02): migrate flashcard.service.ts to i18n-leaf shim" --files app/src/services/flashcard.service.ts
    ```

    After commit, run full test suite — this commit closes the 10-failure chain at the root:
    ```bash
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -30
    ```
    Expect: `fail 0` (10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures NOW CLOSED — chain root broken).

    **STOP and INVESTIGATE if** any non-carried-failure test goes red after this commit. That signals a Pitfall 2 regex collision in a source-reading test — do NOT proceed to Task 2 until resolved.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../lib/i18n-leaf'" app/src/services/flashcard.service.ts` returns `1` (exactly one import).
    - `grep -E "from\s+['\"]\\.\\./locales" app/src/services/flashcard.service.ts` returns NOTHING (old import removed).
    - `grep -c "i18n.t(" app/src/services/flashcard.service.ts` returns `0` (namespace pattern fully eliminated).
    - `grep -c "t('common.toast.storageFullFlashcards')" app/src/services/flashcard.service.ts` returns `1` (exact call-site rewrite verified).
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0` — the 10 carried failures are CLOSED.
    - `cd app && npx tsc -b --noEmit; echo "exit $?"` prints `exit 0`.
  </acceptance_criteria>
  <done>flashcard.service.ts migrated; 10 carried failures CLOSED; full suite green; tsc green; atomic commit landed.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate podcast.service.ts (atomic commit 2)</name>
  <files>app/src/services/podcast.service.ts</files>
  <read_first>
    - app/src/services/podcast.service.ts (current state — confirm line 4 import uses `'../locales'` directory shorthand, not `'../locales/index.ts'`; line 128 call site)
    - app/src/lib/i18n-leaf.ts (confirm `t` export)
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 1+2 Migration Mapping table — `podcast.service.ts` row
  </read_first>
  <action>
    Edit `app/src/services/podcast.service.ts` with TWO mechanical changes:

    **Change 1 (import line, around line 4):**
    - BEFORE: `import i18n from '../locales';`
    - AFTER:  `import { t } from '../lib/i18n-leaf';`

    Note: This file uses the directory-shorthand pattern `'../locales'` (no `/index.ts`). Pitfall 5 — different from flashcard's pattern — but the migration target is the same: `'../lib/i18n-leaf'` (no extension).

    **Change 2 (call site, around line 128):**
    - BEFORE: `i18n.t('common.toast.storageFullPodcast')`
    - AFTER:  `t('common.toast.storageFullPodcast')`

    Verify by `grep -n "i18n.t(" app/src/services/podcast.service.ts` BEFORE editing — must show exactly one match. After editing, ZERO matches.

    Commit atomically:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-02): migrate podcast.service.ts to i18n-leaf shim" --files app/src/services/podcast.service.ts
    ```

    After commit:
    ```bash
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20
    ```
    Expect: `fail 0` (no regression — chain already broken at Task 1).

    **STOP and INVESTIGATE** if any test goes red. Pitfall 2 candidate.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../lib/i18n-leaf'" app/src/services/podcast.service.ts` returns `1`.
    - `grep -E "from\s+['\"]\\.\\./locales" app/src/services/podcast.service.ts` returns NOTHING.
    - `grep -c "i18n.t(" app/src/services/podcast.service.ts` returns `0`.
    - `grep -c "t('common.toast.storageFullPodcast')" app/src/services/podcast.service.ts` returns `1`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>podcast.service.ts migrated; suite still green; atomic commit landed.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate question.service.ts (atomic commit 3)</name>
  <files>app/src/services/question.service.ts</files>
  <read_first>
    - app/src/services/question.service.ts (current state — confirm line 5 uses `'../locales/index.ts'` (explicit extension, same pattern as flashcard); line 114 call site)
    - app/src/lib/i18n-leaf.ts
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 1+2 Migration Mapping — `question.service.ts` row
  </read_first>
  <action>
    Edit `app/src/services/question.service.ts` with TWO mechanical changes:

    **Change 1 (import line, around line 5):**
    - BEFORE: `import i18n from '../locales/index.ts';`
    - AFTER:  `import { t } from '../lib/i18n-leaf';`

    **Change 2 (call site, around line 114):**
    - BEFORE: `i18n.t('common.toast.storageFullQuestion')`
    - AFTER:  `t('common.toast.storageFullQuestion')`

    Verify by grep before/after — exactly one `i18n.t(` call site, zero after.

    Commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-02): migrate question.service.ts to i18n-leaf shim" --files app/src/services/question.service.ts
    ```

    Verify after:
    ```bash
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20
    ```
    Expect `fail 0`.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../lib/i18n-leaf'" app/src/services/question.service.ts` returns `1`.
    - `grep -E "from\s+['\"]\\.\\./locales" app/src/services/question.service.ts` returns NOTHING.
    - `grep -c "i18n.t(" app/src/services/question.service.ts` returns `0`.
    - `grep -c "t('common.toast.storageFullQuestion')" app/src/services/question.service.ts` returns `1`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>question.service.ts migrated; suite green; atomic commit landed.</done>
</task>

<task type="auto">
  <name>Task 4: Migrate scheduler.service.ts (atomic commit 4 — 2 call sites)</name>
  <files>app/src/services/scheduler.service.ts</files>
  <read_first>
    - app/src/services/scheduler.service.ts (current state — confirm line 26 uses `'../locales'` directory shorthand; lines 84 and 130 are the TWO call sites)
    - app/src/lib/i18n-leaf.ts
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 1+2 Migration Mapping — `scheduler.service.ts` row (note: 2 call sites, not 1)
  </read_first>
  <action>
    Edit `app/src/services/scheduler.service.ts` with THREE mechanical changes (1 import + 2 call sites):

    **Change 1 (import line, around line 26):**
    - BEFORE: `import i18n from '../locales';`
    - AFTER:  `import { t } from '../lib/i18n-leaf';`

    **Change 2 (call site, around line 84):**
    - BEFORE: `i18n.t('common.toast.generatingDailyPodcast')`
    - AFTER:  `t('common.toast.generatingDailyPodcast')`

    **Change 3 (call site, around line 130):**
    - BEFORE: `i18n.t('common.toast.reviewReminder')`
    - AFTER:  `t('common.toast.reviewReminder')`

    Pre-edit verification: `grep -n "i18n.t(" app/src/services/scheduler.service.ts` must return EXACTLY 2 matches. Post-edit: ZERO matches.

    Commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-02): migrate scheduler.service.ts to i18n-leaf shim" --files app/src/services/scheduler.service.ts
    ```

    Verify:
    ```bash
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20
    ```
    Expect `fail 0`.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../lib/i18n-leaf'" app/src/services/scheduler.service.ts` returns `1`.
    - `grep -E "from\s+['\"]\\.\\./locales" app/src/services/scheduler.service.ts` returns NOTHING.
    - `grep -c "i18n.t(" app/src/services/scheduler.service.ts` returns `0`.
    - `grep -c "t('common.toast.generatingDailyPodcast')" app/src/services/scheduler.service.ts` returns `1`.
    - `grep -c "t('common.toast.reviewReminder')" app/src/services/scheduler.service.ts` returns `1`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
  </acceptance_criteria>
  <done>scheduler.service.ts migrated (2 call sites); suite green; atomic commit landed.</done>
</task>

<task type="auto">
  <name>Task 5: Migrate session.service.ts (atomic commit 5 — 3 call sites)</name>
  <files>app/src/services/session.service.ts</files>
  <read_first>
    - app/src/services/session.service.ts (current state — confirm line 4 uses `'../locales'` directory shorthand; lines 21, 32, 73 are the THREE call sites)
    - app/src/lib/i18n-leaf.ts
    - .planning/phases/37-i18n-leaf-module-refactor/37-RESEARCH.md § Tier 1+2 Migration Mapping — `session.service.ts` row (note: 3 call sites)
  </read_first>
  <action>
    Edit `app/src/services/session.service.ts` with FOUR mechanical changes (1 import + 3 call sites):

    **Change 1 (import line, around line 4):**
    - BEFORE: `import i18n from '../locales';`
    - AFTER:  `import { t } from '../lib/i18n-leaf';`

    **Changes 2-4 (3 call sites at lines ~21, ~32, ~73):**
    Replace each `i18n.t('common.toast.X')` with `t('common.toast.X')` — same key string, just drop the `i18n.` namespace prefix.

    Pre-edit verification: `grep -n "i18n.t(" app/src/services/session.service.ts` must return EXACTLY 3 matches. Post-edit: ZERO matches.

    Verify all 3 call sites still call `t(...)` post-edit:
    ```bash
    grep -c "t('common.toast" app/src/services/session.service.ts
    ```
    Must return at least `3` (could be higher if file already had `t(` calls; current state has zero per RESEARCH.md inspection).

    Commit:
    ```bash
    cd /Users/Code/EchoLearn && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "refactor(37-02): migrate session.service.ts to i18n-leaf shim" --files app/src/services/session.service.ts
    ```

    Verify:
    ```bash
    cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20
    cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit; echo "tsc exit $?"
    ```
    Expect `fail 0` and `tsc exit 0`.
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1 && cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit && echo "tsc-ok"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../lib/i18n-leaf'" app/src/services/session.service.ts` returns `1`.
    - `grep -E "from\s+['\"]\\.\\./locales" app/src/services/session.service.ts` returns NOTHING.
    - `grep -c "i18n.t(" app/src/services/session.service.ts` returns `0`.
    - `grep -c "t('common.toast" app/src/services/session.service.ts` returns at least `3`.
    - `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` shows `fail 0`.
    - `cd app && npx tsc -b --noEmit; echo "exit $?"` prints `exit 0`.
  </acceptance_criteria>
  <done>session.service.ts migrated (3 call sites); full suite green; tsc green; atomic commit landed; Plan 37-02 closed with all 10 carried failures CLOSED.</done>
</task>

</tasks>

<verification>
After all tasks in this plan complete:

1. `cd app && npm test 2>&1 | grep -E "fail [0-9]+" | head -1` — expect `fail 0` (10 carried failures CLOSED).
2. `cd app && npx tsc -b --noEmit; echo "exit $?"` — expect `exit 0`.
3. Per-file invariant: each of the 5 service files has `from '../lib/i18n-leaf'` import AND zero `i18n.t(` namespace calls AND zero `from '../locales'` imports:
   ```bash
   for f in flashcard podcast question scheduler session; do
     echo "=== $f.service.ts ==="
     grep -c "from '../lib/i18n-leaf'" app/src/services/$f.service.ts
     grep -c "i18n.t(" app/src/services/$f.service.ts
     grep -E "from\s+['\"]\.\./locales" app/src/services/$f.service.ts
   done
   ```
   Expect: each section shows `1` (leaf import), `0` (no `i18n.t(`), nothing (no `../locales` import).
4. 10 carried failures CLOSED — verify by spot-checking individual test files:
   - `cd app && node --test tests/concept-feed.test.mjs 2>&1 | tail -5` — expect green.
   - `cd app && node --test tests/services/trellis-state.test.mjs 2>&1 | tail -5` — expect green.

Plan boundary check (from VALIDATION.md):
- Plan 37-02 close: `npm test` (`fail 0` — chain broken) + `tsc -b --noEmit` (exit 0).
</verification>

<success_criteria>
- [ ] All 5 Tier 1+2 service files import `{ t }` from `'../lib/i18n-leaf'`.
- [ ] Zero `i18n.t(` namespace calls remain across the 5 files.
- [ ] Zero `'../locales'` imports remain across the 5 files.
- [ ] 10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures CLOSED (`npm test` reports `fail 0`).
- [ ] `tsc -b --noEmit` exits 0.
- [ ] 5 atomic commits landed (alphabetical order: flashcard, podcast, question, scheduler, session).
- [ ] No new test regressions from any source-reading test (Pitfall 2).
</success_criteria>

<plan_notes>
**Pitfall 7 mitigation (load-bearing):** Run `cd app && npm test 2>&1 | tail -20` AFTER EACH commit. Expected progression:
- Pre-Task-1 baseline: `fail 10` (10 carried `ERR_IMPORT_ATTRIBUTE_MISSING` failures).
- After Task 1 (`flashcard.service.ts`): `fail 0` — chain root broken; all 10 carried failures CLOSED simultaneously per RESEARCH.md § Hold-Out Tests.
- After Tasks 2-5: `fail 0` — count must remain at 0. Any non-target test going red signals Pitfall 2 (source-reading regex collision). STOP and investigate before continuing — do NOT batch-commit through it.

**Pitfall 5 (mixed import paths) is real:** Tier 1+2 has TWO old patterns:
- `'../locales/index.ts'` (explicit extension): `flashcard.service.ts:5`, `question.service.ts:5`
- `'../locales'` (directory shorthand): `podcast.service.ts:4`, `scheduler.service.ts:26`, `session.service.ts:4`

A single mechanical find/replace across all 5 files would catch only one pattern. Each task's action lists the EXACT current import line per file so the executor doesn't need a regex sweep.

**Why alphabetical order:** Predictability; no inter-file dependencies among these 5; keeps commit log scannable. Commit 1 (`flashcard.service.ts`) closes all 10 failures because it is the chain root — the other 4 commits are consistency commits that must keep `fail 0` stable.

**Atomic-per-file is locked by D-03:** Do NOT batch-commit "to save CI runs." A bundled commit that goes red on file 4 of 5 forces manual bisection. Atomic commits give bisection for free.

**Identifier removed:** `i18n` (the namespace import binding) is fully removed from all 5 files. After this plan, `grep -rn "import i18n" app/src/services/` should return ZERO matches across the migrated files (Tier 3 in Plan 37-03 still has `import i18next` in 4 places — different identifier, different plan).
</plan_notes>

<output>
After completion, create `.planning/phases/37-i18n-leaf-module-refactor/37-02-SUMMARY.md` documenting:
- 5 atomic commits landed (alphabetical order: flashcard, podcast, question, scheduler, session) with their git hashes
- 10 carried failures closure confirmation (`npm test` `fail 0` after Task 1; sustained through Tasks 2-5)
- tsc -b --noEmit exit 0
- Per-file call-site count rewritten (flashcard:1, podcast:1, question:1, scheduler:2, session:3 = 8 total)
- Any unexpected test reds and how resolved (Pitfall 2 watch)
</output>
