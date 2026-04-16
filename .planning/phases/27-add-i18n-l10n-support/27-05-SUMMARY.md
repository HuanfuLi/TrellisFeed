---
phase: 27-add-i18n-l10n-support
plan: 05
subsystem: i18n
tags: [react-i18next, useTranslation, screens, interpolation, cross-locale-labels]

# Dependency graph
requires:
  - phase: 27-add-i18n-l10n-support
    provides: "Plan 01 — i18n.init, SupportedLocale, type-safe t() module augmentation, bundle-parity test. Plan 03 — OnboardingScreen language step (cross-locale labels preserved here). Plan 06 — common.* + component namespaces (do not duplicate)."
provides:
  - "All 13 files in app/src/screens/ driven by t() via useTranslation() hook"
  - "Screen-level EN copy canonicalized in en.json across 11 screen namespaces (home/planner/ask/review/graph/podcast/posts/settings/onboarding/questionDetail/plus reused ask/graph sub-namespaces for detail screens)"
  - "464 new keys added to en.json (138 → 602 flattened paths)"
  - "zh/es/ja bundles parity-mirrored with EN-duplicate values for all new keys — Plan 07 Sonnet subagent translates"
  - "OnboardingScreen's Plan-03 cross-locale language step labels preserved verbatim (per D-18/D-19)"
affects:
  - 27-04 (mid-stream abort — screens now render the localeChangedDiscarded string via ask.* namespace; already present from Plan 01)
  - 27-07 (Sonnet subagent translates 464 new keys in zh/es/ja bundles; UAT walkthrough covers all 13 screens)

# Tech tracking
tech-stack:
  added: []  # No new deps — uses Plan 01's react-i18next
  patterns:
    - "Hook-based translation in React components — `const { t } = useTranslation();` at function top"
    - "Imperative i18n.t() in module-scope data (PostDetailScreen skeleton content, GraphScreen buildMindElixirData root label, AskScreen toast-in-useCallback-without-t-dep)"
    - "useCallback deps include t where toast/labels are read (planner/graph/home/podcast handlers)"
    - "Pluralization via two explicit keys (countOne/countOther) chosen conditionally — avoids wiring up full i18next pluralRules until Plan 07"
    - "Interpolation with {{name}} placeholders — 32 new interpolation sites across home.bento.*, review.session.*, graph.selected.*, podcast.player.*, ask.rateLimit*, settings.cacheStats.*, etc."
    - "Cross-locale branded labels (per D-18/D-19) preserved verbatim inside JSX — 'Language / 语言 / Idioma / 言語', 'Continue · 继续 · Continuar · 続ける', and the 4 per-option autonyms"

key-files:
  created: []
  modified:
    - app/src/locales/en.json (Task 1: +464 screen-level keys across 11 namespaces)
    - app/src/locales/zh.json (Task 1: parity-mirrored EN values)
    - app/src/locales/es.json (Task 1: parity-mirrored EN values)
    - app/src/locales/ja.json (Task 1: parity-mirrored EN values)
    - app/src/screens/HomeScreen.tsx (Task 1: bento bento cards + no-more-posts toast; `t` → `todayDate` local rename to avoid collision)
    - app/src/screens/PlannerScreen.tsx (Task 1: suggested moves rows, prune toasts, show-all/less buttons)
    - app/src/screens/AskScreen.tsx (Task 1: session drawer, history, welcome, suggested prompts, rate-limit banners; SUGGESTED_PROMPT_KEYS module constant holds key paths)
    - app/src/screens/ReviewScreen.tsx (Task 1: library card, mini map, done state, shape-map signals; LibraryCard + ReviewMiniMap both use useTranslation)
    - app/src/screens/GraphScreen.tsx (Task 1: reorganize modal, selected-node badges, empty state; buildMindElixirData root uses i18n.t at call time)
    - app/src/screens/PodcastScreen.tsx (Task 1: player, script overlay, insert banner, knowledge-today, generate card)
    - app/src/screens/SettingsScreen.tsx (Task 1: 14 sections — LLM, Embedding, TTS, ZeroTier, ImageGen, YouTube, WebSearch, Podcast, Review, Planner, Appearance, Privacy, Developer, Usage — and all confirmation dialogs)
    - app/src/screens/OnboardingScreen.tsx (Task 1: welcome step, consent step, LLM step; language step Plan-03 cross-locale labels preserved)
    - app/src/screens/PostDetailScreen.tsx (Task 2: loading, not-found, skeleton posts for connection/discover, error retry, takeaway, Q&A)
    - app/src/screens/QuestionDetailScreen.tsx (Task 2: meta counts, schedule card, related questions)
    - app/src/screens/AnchorDetailScreen.tsx (Task 2: breadcrumb fallbacks, stats, action buttons, summary/QA headings)
    - app/src/screens/ClusterDetailScreen.tsx (Task 2: breadcrumbs, stats, actions, summaries, anchor subtitle via graph.anchor.qaCount)
    - app/src/screens/ConnectionPostScreen.tsx (Task 2: header, error state, Q&A section)

key-decisions:
  - "Module-scope MILESTONE_POOL in HomeScreen (5 static milestone/trivia content cards) left hardcoded — D-10 targets UI chrome, these are content blurbs styled as trivia cards. Translating them would add 30+ keys of creative copy that Plan 07's Sonnet translation may not handle as gracefully as genuine UI strings; deferred to a future content-localization phase if needed."
  - "Provider model placeholders (e.g. 'gemini-3.1-flash-image-preview', 'claude-sonnet-4-6', 'gpt-4o') left hardcoded — these are proper-noun technical identifiers, not user-facing translatable content."
  - "LLM system prompts in generateSessionTitle (AskScreen module-scope) left hardcoded in EN — D-07 forbids runtime translation of LLM prompts and EN system prompts give the LLM better instruction comprehension. NOT extracted."
  - "SettingsScreen test result strings keep '✓'/'✗' prefix — downstream color logic (`.startsWith('✓')`) depends on it. Only the trailing 'Failed' / 'Empty vector' / 'No API keys configured' portions are translated."
  - "Strong-tag bold rendering in Image Generation cache stats simplified — translated as plain text (`N images cached` instead of `<strong>N</strong> images cached`). The visual emphasis loss is acceptable for a dev-facing stats block."
  - "HomeScreen local variable `const t = today()` renamed to `todayDate` to avoid collision with `t` from useTranslation()."
  - "AskScreen module-scope SUGGESTED_PROMPTS converted to SUGGESTED_PROMPT_KEYS array of key paths — the component renders them via t() at mount."
  - "GraphScreen buildMindElixirData (module-scope) uses i18n.t('graph.rootLabel') directly since the function is called during effect setup and doesn't have hook access."
  - "PostDetailScreen skeleton posts for connection/discover originally had English literals ('Generating connection...', 'Concept Discovery', 'Concept A/B') — these are user-visible placeholder labels, so translated via i18n.t() at skeleton-build time (which is outside React-hook context because the useEffect runs before first render)."
  - "Pluralization handled with explicit countOne/countOther keys rather than i18next plural suffix system — cleaner EN-only for now, Plan 07 Sonnet can translate both variants and downstream code stays identical."
  - "Cross-locale branded labels in OnboardingScreen.tsx intact per plan's explicit MUST-NOT-EXTRACT rule: 'Language / 语言 / Idioma / 言語' header, 'Continue · 继续 · Continuar · 続ける' button, and the 4 per-option script-native labels ('English', '简体中文', 'Español', '日本語'). Also preserved: 'Choose your language · 选择语言 · Elige tu idioma · 言語を選択' subheader (same pattern)."
  - "Accessibility aria-labels translated alongside titles when they're distinct user-perceivable strings; aria-labels that duplicate existing titles use the same key (e.g. t('ask.cancelAria'), t('ask.flagTitle'))."

patterns-established:
  - "Screen-level namespace hierarchy: each first-level screen owns `<screenName>.*` and organizes sub-features into sub-namespaces (e.g., ask.suggestedPrompts.*, podcast.generateCard.*, review.library.*, review.miniMap.*, review.session.*, settings.sections.*, settings.fields.*, settings.descriptions.*, settings.placeholders.*, settings.providerLabels.*, settings.voices.*, settings.themes.*, settings.toast.*, settings.confirm.*, settings.cacheStats.*, settings.usageTable.*, settings.about.*, settings.test.*, settings.planner.*, settings.buttons.*, settings.zerotier.*)"
  - "Detail screens nest under parent screen namespaces: posts.detail.*, posts.qa.*, posts.connection.*, posts.image.*, graph.anchor.*, graph.cluster.*, questionDetail.* (promoted to top-level since it isn't graph-hierarchy)"
  - "Cross-locale-branded labels convention: placed in JSX with explicit `/* preserved verbatim per D-18/D-19 */` comment, NEVER in en.json (would create locale ambiguity)"

requirements-completed: [D-10]

# Metrics
duration: ~30min
completed: 2026-04-16
---

# Phase 27 Plan 05: Screen-level UI Extraction Summary

**13 screens in app/src/screens/ extracted to useTranslation() + t() via 464 new keys spanning 11 screen namespaces; zh/es/ja bundles parity-mirrored with EN-duplicate values for Plan 07's Sonnet translation pass; OnboardingScreen's Plan-03 cross-locale language step labels preserved verbatim.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-16T12:13:46Z
- **Completed:** 2026-04-16T12:43:36Z
- **Tasks:** 2/2
- **Files modified:** 17 (13 screens + 4 locale bundles)

## Accomplishments

- All 13 `.tsx` files in `app/src/screens/` import and call `useTranslation()`
- `en.json` canonical bundle grew from 138 → 602 flattened keys (+464 in this plan)
- `zh.json`, `es.json`, `ja.json` mirrored EN values as parity stubs — bundle-parity test green
- SettingsScreen (55KB, densest file) fully extracted across 14 sections, 40+ fields, 20+ toasts, 4 confirmation dialogs
- OnboardingScreen extracted for welcome/consent/llm steps; Plan-03 language step intact (D-18/D-19 compliance)
- Pluralization handled via explicit countOne/countOther keys (9 interpolation sites)
- 32 new interpolation placeholders (e.g., `home.bento.podcastReady` → `Ready · {{minutes}} min`)
- No new tsc errors introduced; pre-existing 8 errors documented in deferred-items.md remain
- `npx vite build` green; bundle-parity + missing-key + data-locale-attr + settings-locale + locale-detect tests all pass (15/15)

## Per-Screen Key Count Breakdown (approximate)

| Screen | Keys added | Namespace(s) |
| --- | ---: | --- |
| HomeScreen | 10 | home.bento.*, home.toast.* |
| PlannerScreen | 16 | planner.*, planner.toast.* |
| AskScreen | 36 | ask.suggestedPrompts.*, ask.title/welcome/rateLimit/etc. |
| ReviewScreen | 31 | review.library.*, review.miniMap.*, review.session.*, review.done.* |
| GraphScreen | 17 | graph.*, graph.reorganizeModal.*, graph.selected.*, graph.toast.* |
| PodcastScreen | 33 | podcast.*, podcast.player.*, podcast.generateCard.*, podcast.knowledgeToday.*, podcast.insertBanner.*, podcast.toast.* |
| SettingsScreen | 203 | settings.* (14 sub-namespaces — sections/fields/descriptions/placeholders/providerLabels/voices/themes/buttons/toast/confirm/test/etc.) |
| OnboardingScreen | 27 | onboarding.welcome.*, onboarding.languageStep.*, onboarding.consent.*, onboarding.llm.* |
| PostDetailScreen | 24 | posts.detail.*, posts.qa.*, posts.image.* |
| QuestionDetailScreen | 12 | questionDetail.* |
| AnchorDetailScreen | 12 | graph.anchor.* |
| ClusterDetailScreen | 12 | graph.cluster.* |
| ConnectionPostScreen | 11 | posts.connection.* |
| **Total** | **~444** | **11 top-level screen namespaces** |

(Remaining ~20 keys are internal reorganization/sub-namespace wrappers — plan+verify count each flattened leaf.)

## Strings Deliberately Left Hardcoded

1. **Cross-locale branded labels (OnboardingScreen, per D-18/D-19):**
   - `"Language / 语言 / Idioma / 言語"` (h2 header on language step)
   - `"Choose your language · 选择语言 · Elige tu idioma · 言語を選択"` (subheader)
   - `"Continue · 继续 · Continuar · 続ける"` (confirm button)
   - `"English"`, `"简体中文"`, `"Español"`, `"日本語"` (4 per-option script-native autonyms)
   - **Rationale:** User stuck in an unreadable locale must still find the switcher (CONTEXT Pitfall 5 mitigation).

2. **LLM system prompts (AskScreen `generateSessionTitle`):**
   - The system prompt `"Generate a short (3-6 word) conversation title..."` and user prompt template stay in EN.
   - **Rationale:** D-07 forbids runtime translation of LLM prompts; EN system prompts give the LLM better instruction comprehension and produce titles in the same language as the conversation anyway.
   - These strings ARE in en.json under `ask.titleSystemPrompt` / `ask.titleUserPrompt` as a future option, but the code currently uses the hardcoded literal (kept for LLM-quality stability).

3. **Module-scope MILESTONE_POOL (HomeScreen):**
   - 5 static milestone/trivia content cards (emoji + headline + body) shown in the Home feed.
   - **Rationale:** These are content blurbs styled as trivia cards (creative copy about learning + knowledge), not UI chrome. D-10 targets UI chrome. Defer to a future content-localization phase if/when needed.

4. **Provider model identifiers (SettingsScreen placeholders):**
   - `"gemini-3.1-flash-image-preview"`, `"claude-sonnet-4-6"`, `"gpt-4o"`, `"local-model"`, etc.
   - **Rationale:** Proper-noun technical identifiers, not translatable UI content.

5. **URLs and technical placeholders:**
   - `"sk-..."`, `"AIza..."`, `"nb-..."`, `"tvly-..."`, `"http://localhost:..."` base URLs
   - **Rationale:** Technical identifiers / API key format hints that are universal across locales.

6. **Developer-facing console logs:**
   - All `console.warn`, `console.error` strings in effects
   - **Rationale:** Developer-facing, never user-visible.

## Interpolation Patterns Used (for Plan 07 Sonnet preservation)

Plan 07's Sonnet prompt MUST preserve these `{{variable}}` placeholders verbatim. Full list:

- **Counts:** `{{count}}` (14 sites — review.library.cardCountOne/Other, review.done.finishedOne/Other, review.session.progress, planner.trellis.harvestAria, planner.trellis.pruned, planner.showAllSuggestions, ask.messageCountOne/Other, podcast.knowledgeToday.countOne/Other, questionDetail.reviewsCount, graph.selected.anchorMoreSuffix, graph.selected.connectionsCount, graph.anchor.qaCount, graph.anchor.flashcardCount, graph.cluster.conceptCount/qaCount/flashcardCount)
- **Dates/times:** `{{date}}` (settings.usageTable.resets), `{{resetDate}}` (ask.rateLimitApproaching/Reached)
- **Progress/percentages:** `{{progress}}` (home.bento.podcastGenerating, podcast.generateCard.progressText/progressSuffix), `{{ms}}` (settings.test.resultOkMs), `{{minutes}}` (home.bento.podcastReady)
- **Revealed/total pairs:** `{{revealed}}` + `{{total}}` (review.miniMap.revealedCount), `{{reviewed}}` + `{{total}}` (review.session.progress)
- **Names/titles:** `{{name}}` (common.greeting pattern), `{{title}}` (review.session.moveBreadcrumb, questionDetail.moveBreadcrumb, posts.detail.moveBreadcrumb), `{{concept}}` (graph.anchor.learnAsPostTitle, graph.cluster.learnAsPostTitle, posts.detail.discoverHookPreview)
- **Error/message passthrough:** `{{message}}` (common.toast.transcriptionFailed), `{{error}}` (settings.test.resultFail, settings.test.nanoBananaFail, settings.test.geminiFail), `{{score}}` (settings.descriptions.similarityThreshold)
- **Limits/caps:** `{{limit}}` (ask.rateLimitApproaching, settings.usageTable.usedThisMonth), `{{mb}}` (settings.cacheStats.limit), `{{size}}` (settings.cacheStats.used)
- **Server/connection:** `{{server}}` (settings.descriptions.zerotierBlurb)
- **Anchor/QA structural counts:** `{{anchorCount}}` + `{{qaCount}}` (graph.toast.reorganized, graph.selected.clusterBadge), `{{clusterCount}}` + `{{anchorCount}}` (graph.toast.reorganized)
- **Channel name:** `{{channel}}` (infoFlow.byChannel — from Plan 06, unchanged)
- **Current/total pairs:** `{{current}}` + `{{total}}` (postCarousel.multiImageAlt, postCarousel.counterAria — from Plan 06, unchanged)
- **Label/category:** `{{label}}` (detailMenu.confirmPrompt — from Plan 06, unchanged)
- **Summary (long text):** `{{summary}}` (settings.planner.checkIn)
- **Userdata input:** `{{userMessage}}` + `{{aiReply}}` (ask.titleUserPrompt — unused in current code but reserved)

**Plan 07 Sonnet guidance:** Every translation MUST preserve the exact `{{varname}}` placeholder syntax, including the double curly braces. The variable names themselves stay in English even when the surrounding sentence is in Chinese/Spanish/Japanese.

## Decisions Made

See frontmatter `key-decisions`. Principal call-outs:

- **Pluralization without i18next plural rules:** Used explicit `countOne` / `countOther` key pairs selected via `count === 1 ? ... : ...` ternary at the call site. Cleaner for Plan 07 (translators translate two full strings instead of plural fragments) and keeps downstream code idiomatic JS. Can migrate to i18next's built-in plural rules later if needed.
- **Variable renames to avoid `t` collision:** HomeScreen's `const t = today();` renamed to `todayDate`. ReviewScreen's `const avgRating = reviewed > 0 ? ... : '—'` extraction factored a `finishedMessage` local for readability.
- **Skeleton post content via i18n.t() (PostDetailScreen):** The useEffect that builds a skeleton `DailyPost` object runs outside the component render cycle. Using `i18n.t()` directly (imperative bound reference) reads the current language synchronously — no hook needed, no stale-closure risk.
- **SettingsScreen scope expansion accepted:** The plan budgeted ~50 keys per screen as a soft cap. SettingsScreen yielded ~200+ keys because it IS the settings screen — there's no sub-namespacing workaround that makes it smaller while still covering every row. Left the keys flat under `settings.*` with deep sub-namespaces (`settings.toast.*`, `settings.confirm.*`, etc.) for grep-friendliness.
- **Strong-tag bold simplification:** Cache stats rendering originally used `<strong>` tags inline with text (`<span><strong>N</strong> images cached</span>`). Translating that robustly would require react-i18next `<Trans>` component wiring. Simplified to plain text — dev-facing diagnostic, visual emphasis loss acceptable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Variable name collision in HomeScreen (`const t = today()`)**
- **Found during:** Task 1 HomeScreen extraction
- **Issue:** HomeScreen had a local `const t = today();` that collides with `const { t } = useTranslation();`.
- **Fix:** Renamed local to `todayDate`, updated single reference `getPodcastForDate(todayDate)`.
- **Files modified:** app/src/screens/HomeScreen.tsx
- **Commit:** 34cdab1e

**2. [Rule 3 — Blocking] PodcastScreen h1 displayed "Podcasts" but `podcast.title` was "Podcast"**
- **Found during:** PodcastScreen JSX replacement
- **Issue:** The h1 title in main view showed "Podcasts" (plural) while `podcast.title` was set to "Podcast" (singular).
- **Fix:** Updated `podcast.title` in en.json from "Podcast" → "Podcasts" to match the actual EN source; AskScreen/HomeScreen/BottomNavigation use `common.nav.podcast` instead (unaffected).
- **Files modified:** app/src/locales/en.json (and mirrored to zh/es/ja)
- **Commit:** 34cdab1e

**3. [Rule 3 — Blocking] MILESTONE_POOL content blurbs left hardcoded (deferred to content phase)**
- **Found during:** HomeScreen extraction scope audit
- **Issue:** `MILESTONE_POOL` is a module-level array of 5 trivia cards with English `headline` and `body` fields rendered in the Home feed.
- **Fix:** Documented in "Strings Deliberately Left Hardcoded" section — these are content blurbs, not UI chrome. A future content-localization phase can extend if needed.
- **Rationale:** D-10 scope is UI chrome. Content localization (including user-facing trivia and milestone messages) is not a Phase 27 goal and would add 30+ creative-copy keys that Plan 07 Sonnet's technical-UI-translation approach may not handle optimally.

**Total deviations:** 3 auto-fixed (2 blocking + 1 documented-deferred). Zero Rule 4 (architectural) decisions needed.

## Authentication Gates

None — no external service touched.

## Issues Encountered

- **Pre-existing tsc errors persist:** 8 pre-existing errors in GraphScreen/canonical-knowledge/review/trellis-state remain (see `deferred-items.md`). `npm run build` = `tsc -b && vite build` thus fails, but `npx vite build` (CSS + JSX compile) is green. Every test file I touched passes.
- **Parallel execution (Plan 05 was wave 3, solo):** No coordination conflicts — Plan 03 (Onboarding language step) and Plan 06 (components + service toasts) completed before this plan started. Wave 3 ran solo per solo_wave block in the orchestrator prompt.
- **SettingsScreen model placeholder strings (`gpt-4o`, `claude-sonnet-4-6`, etc.) intentionally left hardcoded:** These are proper-noun technical model identifiers and the fallback value for a TextInput's `value` prop when users haven't typed anything. Not translatable.

## Known Stubs

- **app/src/locales/{zh,es,ja}.json** — All 464 new keys added by this plan duplicate the EN string as parity stubs (same mechanism as Plan 01, Plan 06). Plan 07's Sonnet subagent replaces values with real ZH/ES/JA translations. Bundle-parity test green today; translation content lands in Plan 07. Not a stub-blocking issue for this plan's goals (D-10 is structural extraction; translation content is D-02/D-03/Plan 07 scope).
- **HomeScreen MILESTONE_POOL** — Intentionally NOT extracted; flagged as "deferred to future content-localization phase" in Deviations section. Not a stub; documented decision.

## User Setup Required

None — no external service configuration required for this plan. All translations land via dev-time Sonnet subagent in Plan 07 (no API keys, no runtime calls, no user action).

## Next Phase Readiness

- **Plan 07 (Sonnet subagent translation) unblocked:** 602 total flattened keys in en.json now. Sonnet subagent ingests en.json, generates structurally-identical zh.json/es.json/ja.json with real translations. Plan 07 prompt MUST preserve:
  - All `{{variable}}` interpolation placeholders (see complete list in Interpolation Patterns section)
  - Emojis (`🎙`, `🔗`, `🎉`, `📚`) as-is
  - Brand names "EchoLearn", "OpenAI", "Claude", "Gemini", "YouTube", "Tavily", "API", "TTS", "LLM", "SM-2", "GPT-SoVITS", "LM Studio", "Ollama", "Nano Banana" — NEVER translated
- **Plan 07 UAT walkthrough ready:** Every one of the 13 screen files is t()-driven. UAT can:
  1. Switch locale via Plan 04's Settings switcher (TBD — Plan 04 is Wave 3 too and may run concurrently or after).
  2. Visit each screen in turn.
  3. Verify no English strings leak through (modulo brand names and OnboardingScreen's intentional cross-locale labels).
- **Cross-locale branded labels grep-findable:** For Plan 07 UAT screenshot harness:
  ```bash
  grep -n "Language / 语言 / Idioma / 言語" app/src/screens/OnboardingScreen.tsx
  grep -n "Continue · 继续 · Continuar · 続ける" app/src/screens/OnboardingScreen.tsx
  grep -n "简体中文" app/src/screens/OnboardingScreen.tsx
  ```
  All three return at least one match (verified in Self-Check).

## Self-Check: PASSED

Verified:
- [x] `app/src/screens/HomeScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/PlannerScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/AskScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/ReviewScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/GraphScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/PodcastScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/SettingsScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/OnboardingScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/PostDetailScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/QuestionDetailScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/AnchorDetailScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/ClusterDetailScreen.tsx` contains `useTranslation` — FOUND
- [x] `app/src/screens/ConnectionPostScreen.tsx` contains `useTranslation` — FOUND
- [x] OnboardingScreen retains `"Language / 语言 / Idioma / 言語"` literal — FOUND
- [x] OnboardingScreen retains `"简体中文"` literal — FOUND
- [x] OnboardingScreen retains `"Continue · 继续 · Continuar · 続ける"` literal — FOUND
- [x] en.json parity with zh/es/ja — 602 keys, all 4 bundles identical — PASSED (bundle-parity.test.mjs)
- [x] Commit 34cdab1e (Task 1 — 8 screens + bundles) in `git log` — FOUND
- [x] Commit adc760b6 (Task 2 — 5 detail screens) in `git log` — FOUND
- [x] `npx tsc -b --noEmit` on touched screen files — zero NEW errors (pre-existing 8 persist, logged in deferred-items.md)
- [x] `npx vite build` — green

---
*Phase: 27-add-i18n-l10n-support*
*Completed: 2026-04-16*
