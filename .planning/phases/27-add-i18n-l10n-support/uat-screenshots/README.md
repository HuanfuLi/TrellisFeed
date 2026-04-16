# Phase 27 — D-24 UAT Screenshot Archive

**Status:** approved by operator on 2026-04-16 (walkthrough executed; no blockers reported).

This directory captures the visual QA pass for the i18n/L10n ship — every first-level screen + key sub-screens in each of the 4 supported locales.

## Coverage matrix

| Screen | en | zh | es | ja | Notes |
|---|---|---|---|---|---|
| Onboarding — Language step | ☐ | ☐ | ☐ | ☐ | Shown on first launch; shows Language / 语言 / Idioma / 言語 header + 4 autonym options |
| Onboarding — Welcome | ☐ | ☐ | ☐ | ☐ | EchoLearn intro, 3 feature cards |
| Onboarding — Consent | ☐ | ☐ | ☐ | ☐ | Privacy & Data, local-first, API-key disclosure |
| Onboarding — LLM | ☐ | ☐ | ☐ | ☐ | Provider + API key form |
| Home | ☐ | ☐ | ☐ | ☐ | Bento cards (flashcard/planner/podcast), feed |
| Planner | ☐ | ☐ | ☐ | ☐ | Trellis + Suggested Moves + Pruned section |
| Ask | ☐ | ☐ | ☐ | ☐ | Welcome message + suggested prompts + input placeholder |
| Ask — Chat | ☐ | ☐ | ☐ | ☐ | Active conversation; verify LLM responds in selected locale |
| Graph | ☐ | ☐ | ☐ | ☐ | Mindmap (empty or populated); Reorganize button |
| Settings | ☐ | ☐ | ☐ | ☐ | Language row at top (Language / 语言 / Idioma / 言語) |
| Review | ☐ | ☐ | ☐ | ☐ | Library card + mini-map + session flow |
| Podcast | ☐ | ☐ | ☐ | ☐ | Player + generate card + knowledge today |
| Post detail | ☐ | ☐ | ☐ | ☐ | Essay + Q&A section |
| Question detail | ☐ | ☐ | ☐ | ☐ | Q/A body + review schedule |
| Anchor detail | ☐ | ☐ | ☐ | ☐ | Concept Anchor header + Flashcards + Summary |
| Cluster detail | ☐ | ☐ | ☐ | ☐ | Knowledge Cluster header + child anchors |

## How to run the walkthrough

1. Start the app locally:
   ```bash
   cd /Users/Code/EchoLearn/app && npm run dev
   ```
2. In the browser (Chrome / Safari devtools emulator or physical device):
   - Clear localStorage via the JS console: `localStorage.removeItem('echolearn_settings')`
   - Reload
3. The Onboarding Language step should appear. For each locale (en/zh/es/ja):
   a. Select that locale, complete onboarding.
   b. Visit every screen in the matrix above.
   c. Screenshot each (platform shortcut or devtools screenshot).
   d. File under `{locale}/{screen-slug}.png` — e.g. `zh/01-onboarding-language.png`.

## What to look for

- **Raw key paths** in UI (`home.title` rendered literally) → missing key, file a fix.
- **Text overflow** (truncation, button wrap) — ES runs ~20% longer; ZH/JA rarely overflow.
- **Awkward line breaks** — JA mid-kanji breaks, ZH line-end punctuation hanging.
- **Proper nouns translated** — "EchoLearn" showing as "回声学习", "Claude" as "克劳德", etc. → patch the bundle.
- **Cross-locale labels** — `Language / 语言 / Idioma / 言語` must be identical across all 4 locales.
- **Font stack** — zh should render with PingFang SC-like glyphs, ja with Hiragino Sans-like. Verify via browser devtools → Computed → font-family.
- **Dates** — `Intl.DateTimeFormat` should produce `May 15, 2026` in en vs `2026年5月15日` in ja.
- **LLM responses** — ask "What is photosynthesis?" in each locale; verify the answer language matches the active locale (driven by `applyLocaleDirective` in `providers/llm/locale-directive.ts`).
- **Mid-stream abort** — start a long LLM response, switch locale in Settings; expect a "discarded — ask again" toast (D-22).

## Sign-off

When all 24+ screenshots are archived and no blocking issues remain, reply `approved` to the executing agent's checkpoint prompt. Any blockers should be listed as bullet points — they'll be folded into a follow-up `--gaps` plan.

## Known notes (already logged)

- Spanish runs ~20% longer; button-wrap tolerance is OK if wrap happens on a separator, not mid-word.
- Japanese month labels use `年` / `月` / `日` suffixes — this is correct, not a bug.
- `Language / 语言 / Idioma / 言語` in both OnboardingScreen and SettingsScreen is intentionally cross-locale branded; do NOT flag as untranslated.
- LLM system prompts (`ask.titleSystemPrompt`, `ask.titleUserPrompt`, `settings.test.testPrompt`) remain in English across all 4 bundles — intentional per D-07 for LLM instruction quality.
