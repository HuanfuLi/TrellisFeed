# Phase 37: i18n Leaf-Module Refactor — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `37-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 37-i18n-leaf-module-refactor
**Areas discussed:** Leaf module API surface, Migration & commit cadence, Test stub strategy, Files-in-scope boundary

---

## Areas Presented

The orchestrator analyzed the phase, scouted the codebase, and presented 4 gray areas for the operator to choose from:

| Area | Description |
|------|-------------|
| Leaf module API surface | Just `t(key, opts)`, or also expose `currentLocale()` + `LOCALE_NAMES` + `applyLocaleDirective`? 5 services use `t()` only; `youtube-locale-url` uses `i18next.language`. Surface size affects how complete future v1.5 services can lean on the shim. |
| Migration & commit cadence | Atomic-per-file commits with `npm test` between each (safer bisection, more commits) vs. one bundled commit covering all 6 service migrations (faster, harder to bisect). Research recommends per-file but doesn't lock it. |
| Test stub strategy | When tests load the leaf module, what does it return? Pre-init with EN bundle (real translations in tests, but loads JSON); pass-through identity (`t(key) => key`, simplest, assertions become key text); or test-configurable (caller sets it up). This shapes every new service test in v1.5. |
| Files-in-scope boundary | Lock to the 6 services research identified, or audit + migrate any other service that *might* transitively pull i18n? Tighter scope vs. future-proofing for v1.5 new services. |

**Operator choice (free-text via "Other"):** "Please discuss with me in Chinese."

The orchestrator switched the conversation to Simplified Chinese (operator's stated preference) but kept written artifacts in English (project convention).

---

## Operator Direction

**Operator response:** "我其实不太清楚1-3，遵循你的建议即可。对于问题4，把可能的也迁移了"

Translation: "I'm not sure on 1-3 — go with your recommendation. On question 4 — migrate the possible ones too."

**Implications:**
- Areas 1, 2, 3 → Claude's discretion. Decisions captured in CONTEXT.md D-01 through D-06.
- Area 4 → broader scope. Triggered a complete codebase audit (Bash grep across `app/src/`) finding 9 in-scope files instead of the 6 the research SUMMARY specified.

---

## Audit Findings (executed during discussion)

| Tier | File | Import pattern | Test-blocker today? |
|------|------|----------------|---------------------|
| 1+2 | `services/flashcard.service.ts` | `import i18n from '../locales/index.ts'` + `i18n.t(...)` | YES — root of failing chain |
| 1+2 | `services/podcast.service.ts` | same | not directly tested but transitive |
| 1+2 | `services/question.service.ts` | same | not directly tested but transitive |
| 1+2 | `services/scheduler.service.ts` | same | not directly tested but transitive |
| 1+2 | `services/session.service.ts` | same | not directly tested but transitive |
| 3 | `services/youtube-locale-url.ts` | `import i18next from 'i18next'` + `i18next.language` | NO — already test-friendly |
| 3 | `lib/date.ts` | `import i18next` + both `.language` + `.t(...)` | NO |
| 3 | `providers/llm/locale-directive.ts` | `import i18next` + `.language` (D-07 load-bearing) | NO |
| 3 | `providers/tts/index.ts` | `import i18next` + `.language` | NO |

**Out of Phase 37 scope:** All React components / screens (`ErrorBoundary`, `AskScreen`, `GraphScreen`, `OnboardingScreen`, `PostDetailScreen`, `SettingsScreen`, `state/useQuestions.ts`) — they run in browser/jsdom, never under `node --test`. `services/settings.service.ts` only uses `SupportedLocale` type, no i18n at runtime.

**Test-failure verification:** `npm test` reproduces exactly 10 `ERR_IMPORT_ATTRIBUTE_MISSING` failures across `tests/concept-feed.test.mjs`, `tests/services/trellis-state.test.mjs`, `tests/layout/trellis-layout.test.mjs`. All 10 root in `flashcard.service.ts → ../locales/index.ts`. Migrating just `flashcard.service.ts` would close all 10; the other 8 files travel with it for shim consistency and v1.5 future-proofing.

---

## Claude's Discretion (areas 1-3, operator-delegated)

### 1. Leaf module API surface

| Option | Pros | Cons |
|--------|------|------|
| `t(key, opts)` only | Smallest possible surface; trivially stubbable | Doesn't cover Tier 3 (`i18next.language`) |
| `t` + `getCurrentLocale` (chosen ✓) | Covers all real call sites; still small | None significant |
| Full re-export (`t`, locale, `LOCALE_NAMES`, `applyLocaleDirective`, ...) | Maximum convenience | Bloated; LOCALE_NAMES already a const callers can import; `applyLocaleDirective` lives in `providers/llm/`, wrong layer |

**Decision:** `t(key, opts?)` + `getCurrentLocale()`. Captured as **D-01**.

### 2. Migration & commit cadence

| Option | Pros | Cons |
|--------|------|------|
| Atomic-per-file commits, `npm test` between each (chosen ✓) | Bisect-friendly; matches research SUMMARY recommendation; aligns with Pitfall 7 mitigation (source-reading regex collisions) | More commits to review |
| One bundled commit per plan | Fewer commits | Hard to bisect if a regression surfaces; violates research directive |

**Decision:** Atomic-per-file commits within plans. **D-03**.

### 3. Test stub strategy

| Option | Pros | Cons |
|--------|------|------|
| Pre-init with EN bundle | Tests get real translations | Re-introduces JSON-import chain — defeats the entire phase purpose |
| Identity default + opt-in bind (chosen ✓) | Zero setup for new v1.5 service tests; assertions on call shape | Assertions need the key text instead of translated text |
| Test-configurable per-test | Maximum flexibility | Boilerplate in every test file |

**Decision:** Identity default. Tests that need translations call `bindI18nLeaf` themselves with stubs (never imports `'../locales/index.ts'` from test code). **D-05**, **D-06**.

---

## Operator Decision (area 4)

**Question:** Lock scope to 6 files (research SUMMARY) or expand to all possible files?

**Operator answer:** "把可能的也迁移了" (migrate the possible ones too).

**Resolution:** Migrate all 9 in-scope files identified by the audit (Tier 1+2 + Tier 3) plus 1 production-wire file (`main.tsx`). Captured as **D-07** with detailed file list. **D-08** lists explicit exclusions (React components, settings.service, etc.).

---

## Deferred Ideas

- React component / screen i18n surface migration — defer to v1.6 if needed (no test-blocker value)
- Locale-change event subscription via leaf — defer until a service needs it (v1.6+)
- Migrating `useQuestions.ts` — React-state hook, not in failing-test chain
- Optional Plan 37-04 verification source-reading test asserting `grep` cleanliness — recommended but planner decides scope

## Reviewed Todos (Not Folded)

- `2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md` — already covered by Phase 42 (MASONRY-01)
- `2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` — unrelated; not v1.5 scope

---

*Discussion concluded 2026-05-08. CONTEXT.md ready for `/gsd:plan-phase 37`.*
