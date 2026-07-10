---
phase: 27
slug: add-i18n-l10n-support
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
validated: 2026-04-16
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `27-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) with esbuild/tsx loader hook (existing pattern — see `app/tests/canonical-knowledge.test.mjs`) |
| **Config file** | None (zero-config) |
| **Quick run command** | `cd app && node --test tests/locales/**/*.test.mjs tests/providers/llm-locale-injection.test.mjs tests/lib/locale-detect.test.mjs` |
| **Full suite command** | `cd app && npm test && npm run lint && tsc -b --noEmit` |
| **Estimated runtime** | ~5 seconds (quick) / ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command above (~5s)
- **After every plan wave:** Run full suite command (~30s) — includes lint + typecheck
- **Before `/gsd:verify-work`:** Full suite must be green AND D-24 UAT matrix (every first-level screen × 4 locales with archived screenshots) must pass
- **Max feedback latency:** ~5 seconds for unit tests, manual UAT for visual verification

---

## Per-Task Verification Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------------|----------|-----------|-------------------|-------------|--------|
| D-03 | All 4 bundles have identical key sets (structural parity) | unit | `node --test tests/locales/bundle-parity.test.mjs` | ❌ W0 | ⬜ pending |
| D-06 | Type-safe `t()` — typo fails tsc | static | `cd app && tsc -b --noEmit` (typo in any `t()` call fails) | existing | ⬜ pending |
| D-11 | `formatDate` uses current locale (month abbr differs en vs ja) | unit | `node --test tests/lib/date.locale.test.mjs` | ❌ W0 | ⬜ pending |
| D-11 | `getGreeting` returns translated string | unit | same file | ❌ W0 | ⬜ pending |
| D-12 | `applyLocaleDirective` prepends system message when none exists | unit | `node --test tests/providers/llm-locale-injection.test.mjs` | ❌ W0 | ⬜ pending |
| D-12 | `applyLocaleDirective` appends to existing system message | unit | same file | ❌ W0 | ⬜ pending |
| D-12 | `applyLocaleDirective` is idempotent (no double-inject) | unit | same file | ❌ W0 | ⬜ pending |
| D-12 | Locale name is "Simplified Chinese" (not "Chinese") | unit | same file | ❌ W0 | ⬜ pending |
| D-13 | `synthesize` voice switches with locale | unit | `node --test tests/providers/tts-locale.test.mjs` (mock fetch) | ❌ W0 | ⬜ pending |
| D-14 | YouTube URL contains `hl=`, `regionCode=`, `relevanceLanguage=` | unit | `node --test tests/services/youtube-locale.test.mjs` | ❌ W0 | ⬜ pending |
| D-15 | `webSearch` body does NOT contain locale | unit | `node --test tests/services/web-search-no-locale.test.mjs` | ❌ W0 | ⬜ pending |
| D-17 | `normalizeLocale('zh-Hans-CN')` → `'zh'` | unit | `node --test tests/lib/locale-detect.test.mjs` | ❌ W0 | ⬜ pending |
| D-17 | `normalizeLocale('ko-KR')` → `'en'` (fallback) | unit | same file | ❌ W0 | ⬜ pending |
| D-20 | `settingsService.set('preferences', { locale })` round-trips | unit | `node --test tests/services/settings-locale.test.mjs` | ❌ W0 | ⬜ pending |
| D-20 | Legacy `language: 'en'` → `locale: 'en'` migration on load | unit | same file | ❌ W0 | ⬜ pending |
| D-21 | Missing key logs warning in dev, renders EN fallback | unit | `node --test tests/locales/missing-key.test.mjs` | ❌ W0 | ⬜ pending |
| D-22 | Locale switch mid-stream triggers abort + discards partial | integration | `node --test tests/state/useQuestions-locale-abort.test.mjs` | ❌ W0 | ⬜ pending |
| D-23 | `data-locale` attribute set on `<html>` on init and on change | unit (jsdom-light) | `node --test tests/locales/data-locale-attr.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/locales/bundle-parity.test.mjs` — flatten all 4 JSONs to key-paths, assert set equality
- [ ] `app/tests/locales/missing-key.test.mjs` — configure i18n test instance, assert `missingKeyHandler` fires, render returns EN fallback
- [ ] `app/tests/locales/data-locale-attr.test.mjs` — jsdom-light: init i18n, assert `document.documentElement.dataset.locale === 'en'`; changeLanguage → assert update
- [ ] `app/tests/lib/date.locale.test.mjs` — `formatDate(ts)` differs between `en` and `ja` outputs
- [ ] `app/tests/lib/locale-detect.test.mjs` — `normalizeLocale` matrix: en-US, zh-CN, zh-Hans-CN, zh-TW, es-419, ja-JP, ko-KR, fr-FR, '', null
- [ ] `app/tests/providers/llm-locale-injection.test.mjs` — unit-test `applyLocaleDirective` in all 3 configurations (no system, existing system, already-has-directive)
- [ ] `app/tests/providers/tts-locale.test.mjs` — mock `fetch`, switch `i18n.language`, assert request body voice matches mapping table
- [ ] `app/tests/services/youtube-locale.test.mjs` — mock `fetch`, assert URL contains `hl=zh-CN&regionCode=CN&relevanceLanguage=zh` when locale=zh
- [ ] `app/tests/services/web-search-no-locale.test.mjs` — mock `fetch`, assert body does NOT contain any ZH/ES/JA indicator
- [ ] `app/tests/services/settings-locale.test.mjs` — set then get preferences.locale; test legacy `language` migration path
- [ ] `app/tests/state/useQuestions-locale-abort.test.mjs` — stub chatStream as a controllable async iterator; fire LOCALE_CHANGED mid-stream; assert accumulated text does not grow + question NOT saved
- [ ] `npm install i18next react-i18next @capacitor/device` + `npx cap sync` (Wave 0 task)
- [ ] Ensure tests import `.ts` files from `src/locales/` (existing esbuild tsx loader already handles this — confirmed from `canonical-knowledge.test.mjs`)

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Every screen renders without raw key paths in each of 4 locales | D-01 / D-03 | Visual inspection only — no way to assert absence of "home.title" string pattern across rendered UI without heavy screenshot diffing | Walk through every first-level screen (Home, Planner, Ask, Graph, Settings) + sub-screens (Review, Podcast, PostDetail, QuestionDetail, AnchorDetail, ClusterDetail, Onboarding) in each of en/zh/es/ja. Archive screenshots. Confirm no untranslated text visible. |
| No text overflow / layout break in Spanish (≈+20% longer) | D-24 | Requires human judgement on overflow tolerance | Same walkthrough, ES locale. Flag any truncation, ellipsis, or button-wrap issues. |
| No awkward line breaks in Japanese | D-24 | JA line-break rules vary by browser/font; requires native-speaker-approximate review | Same walkthrough, JA locale. Flag any mid-word breaks in compound terms or awkward hiragana/kanji splits. |
| CSS `--font-sans` resolves to the locale-appropriate stack | D-23 | Browser dev-tools computed-style inspection; can't be automated without Puppeteer | Open dev tools → `<body>` → Computed → font-family should include PingFang SC for zh, Hiragino Sans for ja, default for en/es. |
| TTS voice sounds native for each locale | D-13 | Requires ear test — voice mapping is verified in unit tests, but actual audio quality is subjective | Generate a podcast in each locale; listen-test for obvious mispronunciation. Flag OpenAI TTS on JA/ZH as known low-quality (per research). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (12 new test files + 2 install steps)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for quick cycle
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands and tests pass

**Approval:** pending
