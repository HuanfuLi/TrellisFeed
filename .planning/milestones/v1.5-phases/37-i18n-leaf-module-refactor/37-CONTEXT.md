# Phase 37: i18n Leaf-Module Refactor — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract i18n usage (`i18n.t(...)`, `i18next.language`) from service-layer and lib-layer files into a single leaf module `src/lib/i18n-leaf.ts` so consumers can be imported under `node --test` without triggering the `ERR_IMPORT_ATTRIBUTE_MISSING` chain on `src/locales/*.json`. Closes the 10 v1.4-carried test failures (across `tests/concept-feed.test.mjs`, `tests/services/trellis-state.test.mjs`, `tests/layout/trellis-layout.test.mjs` — all transitively rooted in `flashcard.service.ts → ../locales/index.ts`). Behavior is unchanged: same translations, same locale switching, same `applyLocaleDirective` LLM injection. This is a pure refactor.

</domain>

<decisions>
## Implementation Decisions

### Leaf Module API Surface

- **D-01:** `src/lib/i18n-leaf.ts` exposes a minimal-but-complete API: `t(key, opts?)` and `getCurrentLocale()`. Nothing else.
  - Do NOT re-export `LOCALE_NAMES` (callers that need it import `SupportedLocale` directly from `../types`).
  - Do NOT re-export `applyLocaleDirective` (lives in `providers/llm/locale-directive.ts` — different layer).
  - Do NOT re-export i18next's `on('languageChanged', ...)` event API (UI screens still subscribe via `react-i18next`'s hooks; service-layer doesn't need it).

- **D-02:** Leaf has internal mutable state for the bound `t` function and locale getter. Default state is identity (`t(key) => key`, `getCurrentLocale() => 'en'`). Production binds via `bindI18nLeaf(tFn, localeGetter)` called once from `main.tsx` after `import './locales/index.ts'`. Tests get the identity default for free.

  ```ts
  // src/lib/i18n-leaf.ts (sketch — planner finalizes signatures)
  type TFn = (key: string, opts?: Record<string, unknown>) => string;
  type LocaleGetter = () => string;
  let _t: TFn = (k) => k;
  let _getLocale: LocaleGetter = () => 'en';
  export function bindI18nLeaf(tFn: TFn, getLocale: LocaleGetter): void { _t = tFn; _getLocale = getLocale; }
  export function t(key: string, opts?: Record<string, unknown>): string { return _t(key, opts); }
  export function getCurrentLocale(): string { return _getLocale(); }
  ```

### Migration & Commit Cadence

- **D-03:** Atomic-per-file commits. Each migrated file is its own commit; `npm test` runs after each commit (per research SUMMARY's "Run npm test after each file" directive — Pitfall 7 source-reading test regex collisions are real).

- **D-04:** Plans grouped by tier:
  - **Plan 37-01** — Create `i18n-leaf.ts` shim + wire `main.tsx` (1 commit, ships infrastructure with no service changes; verifiable that production behavior unchanged because services still import the old paths).
  - **Plan 37-02** — Migrate Tier 1 + 2 (5 service files that import `../locales/index.ts`). 5 atomic commits in one plan. After this plan: 10 carried failures CLOSED.
  - **Plan 37-03** — Migrate Tier 3 (4 already-leaf modules that import `i18next` directly). 4 atomic commits in one plan. After this plan: all i18n access goes through the shim; v1.5 future services can rely on consistent shim API.

### Test Stub Strategy

- **D-05:** Default identity behavior for tests. `t(key) => key` and `getCurrentLocale() => 'en'`. Tests assert call shape (e.g., `assert(toast.calls[0].args[0] === 'common.toast.storageFullFlashcards')`), not translated text. This makes new v1.5 service tests trivial — they import the leaf module without any setup.

- **D-06:** Tests that need real translations (rare) do their own `bindI18nLeaf` setup in `before()` with stubbed `t`/`locale` functions. **Never** import `'../locales/index.ts'` from a test file under `node --test` — that re-introduces the JSON-import chain.

### Files In Scope

- **D-07:** Migrate ALL 9 files identified by the broader audit, not just the 6 the research SUMMARY specified. Operator chose the wider scope ("把可能的也迁移了") so v1.5 new services (engagement, source-diversity) can rely on a consistent shim across the entire i18n surface.

  **Tier 1 + 2 — services importing `../locales/index.ts` (5 files; required to close 10 failures):**
  - `app/src/services/flashcard.service.ts` — root of failing-test chain (`tests/concept-feed.test.mjs`, `trellis-state.test.mjs`, `trellis-layout.test.mjs` all transitively land here). Migrating just this file is sufficient to close all 10 failures, but the others travel with it for consistency.
  - `app/src/services/podcast.service.ts`
  - `app/src/services/question.service.ts`
  - `app/src/services/scheduler.service.ts`
  - `app/src/services/session.service.ts`

  **Tier 3 — already-leaf modules importing `i18next` directly (4 files; not currently failing but migrate for consistency):**
  - `app/src/services/youtube-locale-url.ts` — uses `i18next.language` only.
  - `app/src/lib/date.ts` — uses BOTH `i18next.language` AND `i18next.t(...)` (formatDate, getGreeting). Heavy consumer footprint.
  - `app/src/providers/llm/locale-directive.ts` — D-07 (Phase 27) load-bearing: must remain "the ONLY code path that reads i18n locale for LLM injection." After migration, leaf's `getCurrentLocale()` is the indirection — semantics unchanged. Add a Phase 37 note to the existing D-07 comment so future agents know the leaf is the indirection.
  - `app/src/providers/tts/index.ts` — uses `i18next.language` for voice mapping.

  **Plus 1 production-wire file:**
  - `app/src/main.tsx` — adds `bindI18nLeaf(i18n.t.bind(i18n), () => i18n.language)` after `import './locales/index.ts'`.

- **D-08:** Files explicitly NOT migrated (out of scope for Phase 37):
  - All React components / screens (`ErrorBoundary`, `AskScreen`, `GraphScreen`, `OnboardingScreen`, `PostDetailScreen`, `SettingsScreen`) — they run in browser/jsdom, never under `node --test`. They keep their existing `react-i18next` `useTranslation` hooks.
  - `state/useQuestions.ts` — React-only, same reason.
  - `services/settings.service.ts` — only imports `SupportedLocale` type, doesn't use i18n at runtime.

### Claude's Discretion

- Exact file naming (`i18n-leaf.ts` confirmed per research SUMMARY; matches existing leaf-module precedent without `-leaf` suffix in name like `feed-spread.ts` / `refill-mutex.ts`, but `i18n` alone would shadow other conventions — `i18n-leaf` is the named identifier).
- Internal implementation of `bindI18nLeaf` (closure vs. module-private vars vs. globalThis stash — planner picks).
- Whether to add a single source-reading invariant test asserting "no service file under `app/src/services/` imports from `../locales` or `i18next` directly after Phase 37" — recommended but planner can confirm scope.
- Whether to add a comment block at the top of `i18n-leaf.ts` documenting the rationale (production binds, tests get identity, why JSON imports are kept out).
- Whether `main.tsx`'s `bindI18nLeaf` call goes before or after the `void i18n.use(initReactI18next).init({...})` chain — must be after the import is fully evaluated, so likely after.

### Folded Todos

(None — both surfaced todos belong to other phases per cross_reference_todos.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` lines 1073-1082 — Phase 37 entry with goal + success criteria
- `.planning/REQUIREMENTS.md` — TECHDEBT-01 (the requirement this phase fulfills)

### Research Outputs
- `.planning/research/SUMMARY.md` — masonry reconciliation + wave-based build order; Phase 37 framed as Wave 0 prerequisite
- `.planning/research/ARCHITECTURE.md` — leaf-module pattern application to i18n; integration points
- `.planning/research/PITFALLS.md` — Pitfall 7: source-reading test regex collisions during refactor (run `npm test` after EACH file)
- `.planning/research/STACK.md` — i18next 26.0.5 baseline; held back to in-major minor bumps in Phase 44

### Prior Phase Decisions (Load-Bearing)
- `.planning/milestones/v1.3-phases/27-add-i18n-l10n-support/27-CONTEXT.md` D-07 (no runtime LLM translation) and D-12 (`applyLocaleDirective` as the centralized LLM locale injection) — Phase 37 must preserve both
- `.planning/milestones/v1.4-phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/` — leaf-module precedent (`feed-spread.ts`, `refill-mutex.ts`)

### Project Conventions
- `CLAUDE.md` "Test framework" line — `node --test` + esbuild tsx loader; "Phase 27 locale tests avoid the JSON-import-attribute failure chain by importing `i18next` directly; follow the same pattern for any new pure-logic helpers" — Phase 37 generalizes this pattern as a shared leaf module
- `CLAUDE.md` "Best practices learned in Phase 32.1" lesson #2 — tests must guard the LIVE code path, not aspirational/dead code
- `CLAUDE.md` "i18n Workflow" — full bundle-translation discipline; Phase 37 does NOT change bundle authoring
- `CLAUDE.md` "Concept Feed Generation Pipeline" comment block at `concept-feed.service.ts:24` — documents existing leaf-module workaround that Phase 37 supersedes

### Code Cited
- `app/src/locales/index.ts` — current i18next init + JSON imports (the chain root)
- `app/src/services/flashcard.service.ts:5` + `:81` — example of the import + use pattern that Phase 37 unwinds
- `app/src/services/youtube-locale-url.ts:10,35` — example of Tier 3 (already-leaf, uses `i18next` directly)
- `app/src/providers/llm/locale-directive.ts:5-16` — D-07 load-bearing comment; Phase 37 preserves semantics

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Existing leaf-module precedents:** `app/src/services/feed-spread.ts` (Phase 36 GAP-4), `app/src/services/refill-mutex.ts` (Phase 36-12). Both demonstrate the pattern Phase 37 generalizes — pure modules with zero JSON imports that services can use without breaking `node --test`. The naming convention is descriptive (no `-leaf` suffix); `i18n-leaf.ts` keeps the prefix for explicit "this is the leaf" semantic.

- **`SupportedLocale` type at `app/src/types/index.ts`:** Already used by Tier 3 modules. Phase 37's leaf can re-export `SupportedLocale` for convenience but it's optional (callers can also import from types).

- **`settings.service.ts`'s `SUPPORTED_LOCALE_CODES` const:** Phase 37 doesn't touch this; it's a separate concern (locale validation, not translation).

### Established Patterns

- **Toast string pattern:** Every Tier 1 + 2 service uses `toast(i18n.t('common.toast.X'), 'error'|'info')`. Phase 37 changes the import line and the `i18n.t` call site to `import { t } from '../lib/i18n-leaf.ts'` + `toast(t('common.toast.X'), ...)`. Mechanical replacement.

- **`i18next.language` read pattern:** Tier 3 modules (`youtube-locale-url`, `lib/date`, providers) read `i18next.language` to map to locale-specific values. Phase 37 changes this to `getCurrentLocale()` from the leaf. Same semantics.

- **D-07 LLM locale injection:** `applyLocaleDirective` at `providers/llm/locale-directive.ts:36` reads `i18next.language` to decide which "Respond in {name}" prefix to attach. Migrating to `getCurrentLocale()` preserves D-07 — leaf is just an indirection layer.

### Integration Points

- **`main.tsx` boot order:** Currently `import './locales/index.ts'` triggers i18next.init synchronously. Phase 37 adds a `bindI18nLeaf(...)` call after this import — must run before any service imports execute their toast paths. Easiest approach: put it directly under the locales import in main.tsx.

- **Test loaders:** `tests/services/_actions-mock-loader.mjs` (heavy mock loader for trellis-actions) needs to leave `i18n-leaf.ts` alone — leaf's identity default is exactly what those tests want anyway.

- **Source-reading invariant tests at risk:**
  - `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (Phase 35) — reads source for byte-stability invariants; doesn't grep `i18n` patterns directly, should be unaffected.
  - `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` (Phase 36-14) — anchor-pair extraction; doesn't grep i18n.
  - `app/tests/components/InfoFlow.short-tap-emit.test.mjs` (Phase 36-08) — different scope.
  - **Verification:** Pitfall 7 says run `npm test` after EACH file commit so any unforeseen regex collision surfaces immediately on the file that broke it (atomic-per-file commits = trivial bisection).

</code_context>

<specifics>
## Specific Ideas

- Operator's specific request: extend the migration scope beyond the 6 files research called out, to also include the 4 already-leaf modules that import `i18next` directly. Quote: "把可能的也迁移了" (migrate the possible ones too).
- Operator delegated decisions D-01 through D-06 to Claude's judgment ("我其实不太清楚1-3，遵循你的建议即可").

</specifics>

<deferred>
## Deferred Ideas

- **React component / screen i18n surface** — `useTranslation` from `react-i18next` is the React-side surface. It does NOT have the JSON-import problem (Vite handles JSON imports natively at build time). Migrating components to the leaf shim would homogenize style but adds zero test-blocker value. Deferred to v1.6 if needed.
- **Locale-change event subscription via leaf** — Currently services don't subscribe to language change events; only React components do (via `react-i18next`). If a future service needs to react to locale changes (e.g., flush a translated cache), the leaf could expose `subscribeLocaleChanged`. Not needed in v1.5; defer.
- **Migrating `useQuestions.ts`** — Has `import i18next from 'i18next'` somewhere; not in the failing-test chain. React-state hook. Deferred.
- **Phase 37-04 (verification plan)** — Could add a single test that asserts `grep -rln "from ['\"]\.\./locales\|from ['\"]i18next['\"]" app/src/services/` returns zero results (or only the leaf module). Recommended but planner decides whether it's worth its own plan vs. folded into 37-03's last commit.

### Reviewed Todos (not folded)

- `2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md` — belongs to Phase 42 (MASONRY-01 already covers it).
- `2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` — unrelated to Phase 37 (likely belongs to a different phase or future bug-fix; not v1.5 in-scope yet).

</deferred>

---

*Phase: 37-i18n-leaf-module-refactor*
*Context gathered: 2026-05-08*
