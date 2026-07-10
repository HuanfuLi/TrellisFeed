# Phase 27: Add i18n/L10n support - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 27-add-i18n-l10n-support
**Areas discussed:** Target locales & launch set, i18n library choice, Scope of translation, Locale switching UX

---

## Target Locales & Launch Set

### Q1: Which locales should Phase 27 ship with?

| Option | Description | Selected |
|--------|-------------|----------|
| EN + ZH-Hans | English + Simplified Chinese. Smallest translation debt, no RTL. | |
| EN + ZH-Hans + ZH-Hant | Adds Traditional Chinese for TW/HK. | |
| EN + ZH + ES + JA | Four-locale launch (adds Spanish + Japanese). 4× translation work. | ✓ |
| EN + ZH + AR (with RTL) | Adds Arabic and opens RTL work — substantial scope expansion. | |

**User's choice:** EN + ZH + ES + JA
**Notes:** No RTL. Launch set locked.

---

### Q2 (reformulated): What should Phase 27 actually ship in the repo?

**Original Q2 was rejected** — user clarified: runtime LLM translation is forbidden; use a dev-time Sonnet subagent to generate hardcoded bundles; track bundle files in CLAUDE.md so future UI edits remember to sync locales. This became a durable feedback rule.

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 locales fully translated | EN canonical hand-written; Sonnet subagent translates full EN bundle into ZH/ES/JA as part of the phase. | ✓ |
| EN + ZH only; ES/JA empty stubs | Ship EN + ZH translated; ES.json/JA.json empty scaffolds with EN fallback. | |
| Plumbing only — all bundles empty except EN | Fastest MVP; non-EN users see English. | |

**User's choice:** All 4 locales fully translated
**Notes:** Dev-time-only translation rule enshrined as durable feedback (`feedback_i18n_translation.md`).

---

## i18n Library Choice

### Q1: Which i18n library for Phase 27?

| Option | Description | Selected |
|--------|-------------|----------|
| react-i18next | Most popular, ~14KB gz, Suspense-aware, easy LLM/docs familiarity. | ✓ |
| FormatJS / react-intl | ICU standard, heavier (~30KB with polyfills), verbose. | |
| @lingui/react | Compile-time extraction, ~4KB, less LLM-familiar. | |
| Minimal custom dictionary + Intl | Hand-rolled t(key, params), zero deps, most upfront work. | |

**User's choice:** react-i18next
**Notes:** —

---

### Q2: How should translation bundles be organized on disk?

| Option | Description | Selected |
|--------|-------------|----------|
| One JSON per locale, flat | `src/locales/{en,zh,es,ja}.json`, nested by feature namespace. | ✓ |
| Namespaced: folder per locale, file per feature | Lazy-loadable but more files. | |
| Single bundle with all locales | `messages.ts` exports all locales; harder to diff. | |

**User's choice:** One JSON per locale, flat
**Notes:** —

---

### Q3: Type-safety for translation keys?

| Option | Description | Selected |
|--------|-------------|----------|
| Generated types from en.json | Build-time union type; `t()` typed. | ✓ |
| No type-safety — string keys only | Fastest, unsafe. | |
| Runtime-only validation | Dev warning only, no build-time typing. | |

**User's choice:** Generated types from en.json
**Notes:** —

---

## Scope of Translation

### Q1 (multi-select): Which content categories does Phase 27 translate?

| Option | Description | Selected |
|--------|-------------|----------|
| UI chrome (screens, buttons, labels) | Hardcoded EN strings in screens/ and components/. | ✓ |
| Date/number/time formatting | Replace hardcoded `'en-US'` in lib/date.ts. | ✓ |
| LLM system prompts — respond in user locale | "Respond in {locale}" injected centrally. | ✓ |
| User-generated content (existing Q&As, posts) | Retroactive translation — conflicts with dev-time-only rule. | |

**User's choice:** UI chrome + Date/number/time + LLM system prompts
**Notes:** User-generated content explicitly out of scope.

---

### Q2: Where is the LLM locale instruction injected?

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized in providers/llm.ts | One system-prompt prefix; all call sites inherit. | ✓ |
| Per call-site via explicit option | More boilerplate, opt-in per feature. | |
| Only conversational features | Ask + concept-feed only; flashcard/podcast/news stay EN. | |

**User's choice:** Centralized in providers/llm.ts
**Notes:** —

---

### Q3: What happens to old user content on locale switch?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is, display in original language | UI switches; stored content doesn't. | ✓ |
| Show a "Translate" button on old content | Per-item opt-in LLM call. | |
| Hide all pre-switch content | Aggressive, bad UX. | |

**User's choice:** Leave as-is
**Notes:** —

---

### Q4: Podcast TTS voice by locale?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — locale-appropriate voice per locale | tts.ts reads locale, maps to voice ID. | ✓ |
| No — TTS stays with current default voice | EN voice reading CJK text. | |

**User's choice:** Yes — locale-appropriate voice
**Notes:** —

---

### Q5: Mindmap node labels treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave stored labels as-is | Consistent with old-content rule. | ✓ |
| Translate labels on the fly via cached lookup | Runtime LLM call — violates dev-time-only rule. | |

**User's choice:** Leave stored labels as-is
**Notes:** —

---

### Q6: Tavily web search — pass locale?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pass locale to Tavily | Locale-native citation sources. | |
| No — keep results global/English | Broader coverage for learning content. | ✓ |

**User's choice:** No — keep global
**Notes:** EN has broader coverage; citation-UI-language mismatch accepted.

---

### Q7: YouTube feed — filter by locale?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pass hl/regionCode matching locale | Locale-native videos. | ✓ |
| No — leave videos in EN | Deferred. | |

**User's choice:** Yes — pass hl/regionCode
**Notes:** —

---

## Locale Switching UX

### Q1: How does the app determine initial locale on first launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect + onboarding prompt | Read navigator.language / Capacitor Device; Onboarding confirms. | ✓ |
| Auto-detect silently, no prompt | User discovers setting later. | |
| Always default to EN, manual switch in Settings | Lowest discovery. | |

**User's choice:** Auto-detect + onboarding prompt
**Notes:** —

---

### Q2: Where does the locale switcher live, and what happens on switch mid-session?

| Option | Description | Selected |
|--------|-------------|----------|
| Top of Settings, instant switch | First SettingRow; `i18n.changeLanguage()` + persist. | ✓ |
| In a Preferences section, instant switch | Less prominent. | |
| Top of Settings, requires restart | Bad mobile UX. | |

**User's choice:** Top of Settings, instant switch
**Notes:** —

---

### Q3: Fallback when a translation key is missing from the current locale?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to EN silently | `fallbackLng: 'en'` + dev console warn. | ✓ |
| Show the raw key | Ugly but impossible to miss. | |
| Throw in dev, fall back in prod | Strictest discipline. | |

**User's choice:** Fall back to EN silently
**Notes:** —

---

### Q4 (reformulated): Locale persistence?

**Original Q4 paired persistence + readiness-to-exit.** User answered persistence (UserPreferences) + asked for clarification on "OS-level language dropdown reflects it" + answered mid-stream switch = discard.

| Option | Description | Selected |
|--------|-------------|----------|
| `UserPreferences.locale` via mockSettingsService | Joins existing prefs blob. | ✓ |
| Separate `echolearn_locale` localStorage key | Breaks convention. | |

**User's choice:** UserPreferences.locale
**Notes:** "OS-level language dropdown reflects it" was clarified as moot (Capacitor apps can read OS language but cannot write to it; already covered by D-17 auto-detect).

---

### Q5 (inline with Q4): Mid-stream LLM switch?

| Option | Description | Selected |
|--------|-------------|----------|
| Discard in-flight request | Clean state; new request fires in new locale. | ✓ |
| Let in-flight finish in old locale | Confusing mixed state. | |

**User's choice:** Discard in-flight
**Notes:** —

---

### Q6: Locale-specific font stack?

| Option | Description | Selected |
|--------|-------------|----------|
| System font stack per locale | `--font-sans` swaps by locale; no webfont downloads. | ✓ |
| Single universal font stack with CJK fallbacks | One global stack; browsers may pick wrong Latin width. | |
| Defer font work | Ugly-but-functional for now. | |

**User's choice:** System font stack per locale
**Notes:** ZH adds PingFang SC / Hiragino Sans GB / Microsoft YaHei; JA adds Hiragino Sans / Yu Gothic.

---

### Q7: Visual QA strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual visual pass per locale on all screens | Tedious but reliable. | ✓ |
| Manual pass on EN + JA only (worst-case wrap) | Cheaper UAT. | |
| Automated pseudo-locale in dev | Dev-only catch-all. | |

**User's choice:** Manual visual pass on all screens per locale
**Notes:** —

---

## Claude's Discretion

- Exact TTS voice IDs per provider per locale — research/planning task.
- i18next language detector choice (plugin vs custom detector) — planner decides.
- Key-extraction strategy for existing hardcoded strings (manual vs codemod) — planner decides based on scope.
- Exact shape of the Sonnet-subagent translation invocation (script vs documented Task-tool prompt) — executor decides.

## Deferred Ideas

- RTL support (Arabic, Hebrew) — separate phase.
- Retroactive translation of old user content.
- Pseudo-locale for dev overflow detection.
- Extra locales beyond EN/ZH/ES/JA.
- Webfont downloads per locale.
- Automated screenshot diff per locale.
