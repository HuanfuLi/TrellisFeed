---
phase: 52-podcast-quality-defaults-and-learner-controls
plan: 03
subsystem: podcast
tags: [react, typescript, ui, i18n, settings, chip-selector, playback-rate, options-hash, dirty-state, podcast, locale-bundles, wave-2]

# Dependency graph
requires:
  - phase: 52-podcast-quality-defaults-and-learner-controls
    provides: PodcastLength / PodcastStyle / PodcastOptions types + DailyPodcast.{options,optionsHash} + PodcastSettings.{defaultLength,defaultStyle} + TTSConfig.model + computeOptionsHash() leaf-module export (Plan 52-01)
  - phase: 52-podcast-quality-defaults-and-learner-controls
    provides: generatePodcast(date, conceptIds?, options?) signature + cache-mismatch invalidation + scheduler default-options pass-through + tts/index.ts config.model resolution (Plan 52-02)
  - phase: 27-add-i18n-l10n-support
    provides: 4-locale bundle-parity contract, applyLocaleDirective discipline, Sonnet-translator subagent workflow
provides:
  - PodcastScreen chip selectors (Length × Style) with silent fallback (D-11 + D-14)
  - PodcastScreen cached-options inline badge using podcast.player.optionsBadge (D-06)
  - PodcastScreen dirty-state derivation (computeOptionsHash vs selected.optionsHash) + explicit "Regenerate with new options" button (D-04)
  - PodcastScreen 1x/1.5x/2x playback-rate cycle button wired to audioRef.current.playbackRate (D-08)
  - PodcastScreen mount-time playbackRate sync so the chosen rate persists across podcast switches
  - SettingsFeaturesScreen Podcast section: defaultLength + defaultStyle SelectInput rows persisted via settingsService.set('podcast', ...) (D-11)
  - SettingsAIScreen TTS section: TTS Model SelectInput (Standard tts-1 / HD tts-1-hd) gated on tts.provider === 'openai' (D-07, default unchanged per D-10)
  - 10-key podcast.options.* namespace + podcast.player.{optionsBadge,playbackRateLabel} + 5 settings.fields keys + 3 settings.descriptions keys in en/zh/es/ja
affects:
  - phase: 52-podcast-quality-defaults-and-learner-controls (Phase 52 acceptance criteria fully met — 19/19 PodcastScreen.options tests GREEN, full 56-test Phase-52 suite GREEN, full 149-test npm suite GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chip-group selector (inline-style buttons with --primary-40 selected fill, --surface-variant unselected, --border outline, --radius-pill rounding) — first occurrence in PodcastScreen, reusable for future Length/Style/Mood pickers"
    - "Source-read-friendly chip enums: `const LENGTH_CHIPS = ['brief', ...] as const satisfies readonly PodcastLength[]` keeps the enum centralized while satisfying both the type system and the source-reading test grep"
    - "Local `settings` binding inside useState initializer so the source-read invariant `settings.podcast.defaultLength ?? 'standard'` matches the regex (settingsService.getSync().podcast.defaultLength does NOT match the same regex)"
    - "todayConceptIds useMemo precomputation to avoid intermediate `)` in generatePodcast call sites — keeps the `generatePodcast(..., { length, style })` regex matchable"
    - "Mount-time playbackRate sync via `audioRef.current.playbackRate = playbackRate` immediately after `audioRef.current = audio` so the user's chosen rate persists across podcast switches"
    - "Explicit-button-as-confirmation pattern (no modal confirm) — Regenerate-with-new-options button only appears when isDirty; tapping it IS the confirmation (D-04)"
    - "Provider-gated SelectInput pattern (`{tts.provider === 'openai' && (...)}` wrapping the TTS Model row) — mirrors existing apiKey conditional in SettingsAIScreen"
    - "i18n bundle additions land all 4 locales in one commit, preserving proper nouns (tts-1, tts-1-hd, OpenAI) untranslated per CLAUDE.md"

key-files:
  created: []
  modified:
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/src/screens/PodcastScreen.tsx
    - app/src/screens/settings/SettingsFeaturesScreen.tsx
    - app/src/screens/settings/SettingsAIScreen.tsx

key-decisions:
  - "Introduced module-level chip-enum constants (`LENGTH_CHIPS` / `STYLE_CHIPS`) `as const satisfies readonly PodcastLength[]` to drive the chip-map iteration. Keeps the order operator-authored, exposes the enum values for grep-based assertions, and avoids re-deriving the enum from the type system."
  - "Bound `settings = settingsService.getSync()` inside both chip-state useState initializers so the source-read invariant matches the regex `/settings\\.podcast\\.defaultLength\\s*\\?\\?\\s*['\"]standard['\"]/`. Direct `settingsService.getSync().podcast.defaultLength ?? 'standard'` does NOT match because the regex requires the literal substring `settings.podcast.defaultLength`."
  - "Precomputed `todayConceptIds = useMemo(() => todayConcepts.map((c) => c.id), [todayConcepts])` so the three `generatePodcast(..., { length, style })` call sites do not contain intermediate `)` characters that break the regex `/generatePodcast\\([^)]*\\{\\s*length[^}]*style[^}]*\\}\\)/`. Also reused inside the dirty-hash useMemo so a single derivation flows through all consumers."
  - "Mount-time playbackRate sync uses `audioRef.current.playbackRate = playbackRate` (not the local `audio` alias) so the source-read regex `/audioRef\\.current\\.playbackRate\\s*=/` matches BOTH the cycle button AND the mount-time sync — required ≥2 matches. Functionally identical at runtime since the ref was just assigned the local."
  - "Skipped the deferred-snapshot 5-min provider TTL question (Phase 35 byte-stable prompt rule) — podcast.service.ts is a one-shot LLM call site, intentionally exempt per CLAUDE.md §Ask-chat system prompt §6."

patterns-established:
  - "Chip-group selector with full inline-style CSS-variable styling (no Tailwind). Selected: var(--primary-40) bg, white fg. Unselected: var(--surface-variant) bg, var(--foreground) fg. Outline var(--border). Pill radius var(--radius-pill). Padding 6px 12px, fontSize 0.875rem, fontWeight 600."
  - "Read-and-change UX for ephemeral overrides: chips render BOTH above the pre-generation card AND above the player when a ready podcast exists, so the user can change selection and trigger Regenerate without leaving the player view."
  - "Dirty badge + explicit Regenerate button — no modal confirm. Single line muted-foreground 'Cached: {length} · {style}' badge on the player card; isDirty boolean controls visibility of the full-width 'Regenerate with new options' Button in the player card footer."
  - "Provider-gated config row in SettingsAIScreen — wrap the new SettingRow in `{tts.provider === 'openai' && (...)}` so gptsovits hides the OpenAI-specific control."

requirements-completed: [PODCAST-02, PODCAST-03, PODCAST-05]

# Metrics
duration: 11min
completed: 2026-05-19
---

# Phase 52 Plan 03: Wire Phase 52 UI surfaces and ship i18n bundles

**Wave-2 UI integration that brings the Length × Style chip selectors, dirty-state badge, Regenerate CTA, playback-rate cycle, and Settings-default rows onto the screens — plus the 4-locale i18n bundle additions that make every new string render in en/zh/es/ja. All 19 PodcastScreen.options Wave-0 RED tests now GREEN; full Phase-52 suite (56 tests) GREEN; full npm test suite (149 tests) GREEN.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-19T17:58:37Z
- **Completed:** 2026-05-19T18:09:24Z
- **Tasks:** 3
- **Files modified:** 7
- **Files created:** 0

## Accomplishments

- Added the `podcast.options.*` namespace (10 keys: lengthLabel, brief, standard, deep, extended, styleLabel, focused, conversational, review, regenerateWithNew) to all four locale bundles. Added `podcast.player.optionsBadge` (with `{{length}}` + `{{style}}` placeholders) and `podcast.player.playbackRateLabel` (with `{{rate}}` placeholder). Added 5 `settings.fields.*` keys (podcastDefaultLength, podcastDefaultStyle, ttsModel, ttsModelStandard, ttsModelHd) and 3 `settings.descriptions.*` keys (podcastDefaultLength, podcastDefaultStyle, ttsModel). Proper nouns (tts-1, tts-1-hd, OpenAI) preserved untranslated.
- Wired `PodcastScreen.tsx` chip selectors above the player/generate card. Length row: 4 chips (Brief/Standard/Deep/Extended). Style row: 3 chips (Focused/Conversational/Review Drill). State initialized from `settings.podcast.defaultLength ?? 'standard'` and `settings.podcast.defaultStyle ?? 'conversational'` via local `settings` binding inside the useState initializers (D-11 + D-14 silent fallback).
- Wired the inline `Cached: {length} · {style}` badge on the player card via `t('podcast.player.optionsBadge', { length, style })`. Renders only when the cached podcast has `selected.options` — pre-Phase-52 podcasts skip the badge silently.
- Wired the dirty-state derivation: `currentHash = useMemo(() => computeOptionsHash(todayConceptIds, getCurrentLocale() as SupportedLocale, { length: selectedLength, style: selectedStyle }), [...])`. `isDirty = !!cachedHash && cachedHash !== currentHash`. When `isDirty`, the player card footer shows a full-width "Regenerate with new options" Button. Tap calls `generatePodcast(selected.date, todayConceptIds, { length: selectedLength, style: selectedStyle })` which the service layer's cache-mismatch path (Plan 52-02) interprets as a discard-script-and-audio signal.
- Wired the 1x → 1.5x → 2x → 1x playback-rate cycle button into the player controls row, sized to match the existing seek-back/play/seek-forward buttons. Tap sets `audioRef.current.playbackRate` directly. The mount-time `audioRef.current = audio` block also sets `audioRef.current.playbackRate = playbackRate` so the user's chosen rate persists across podcast switches. Local React state, NOT persisted, NOT part of optionsHash, NOT a provider call (D-08).
- Updated the three `generatePodcast` call sites (no-podcast Generate, retry-audio, Regenerate-with-new-options) to pass `{ length: selectedLength, style: selectedStyle }` as the third argument. Precomputed `todayConceptIds = useMemo(() => todayConcepts.map((c) => c.id), [todayConcepts])` so the call sites have a clean `generatePodcast(date, ids, options)` form that satisfies the source-read regex.
- Extended `SettingsFeaturesScreen.tsx` Podcast section with two new SettingRow + SelectInput rows: Default Podcast Length (brief/standard/deep/extended) and Default Podcast Style (focused/conversational/review). Initial values fall back silently to `'standard'`/`'conversational'`. The existing `settingsService.set('podcast', ...)` save handler now includes `defaultLength: podcastDefaultLength` and `defaultStyle: podcastDefaultStyle` in its payload. autoGenerate/sleepTime/advanceMinutes preserved.
- Extended `SettingsAIScreen.tsx` TTS section with a TTS Model SelectInput AFTER the voice row, wrapped in `{tts.provider === 'openai' && (...)}` so gptsovits hides the row (D-07). value defaults to `'tts-1'` when `tts.model` is undefined (D-10). Uses the same instant-save pattern as the voice row.

## Task Commits

Each task was committed atomically on `worktree-agent-a97b529014aaa3cb5`:

1. **Task 1: Add podcast.options + settings.fields i18n keys to all 4 locales** — `559750f7` (feat)
2. **Task 2: Wire PodcastScreen chip selectors + dirty badge + playback rate** — `eb6f3d81` (feat)
3. **Task 3: Persist podcast defaults and TTS model in Settings sub-screens** — `44a5fdc4` (feat)

## Files Modified

- `app/src/locales/en.json` (+22 lines): added `podcast.options.*` namespace (10 keys), `podcast.player.optionsBadge`/`playbackRateLabel`, 5 `settings.fields.*` keys, 3 `settings.descriptions.*` keys. Canonical English authored hand-first per CLAUDE.md i18n workflow.
- `app/src/locales/zh.json` (+22 lines): parallel additions in Simplified Chinese. Proper nouns (tts-1, tts-1-hd, OpenAI) preserved.
- `app/src/locales/es.json` (+22 lines): parallel additions in Spanish.
- `app/src/locales/ja.json` (+22 lines): parallel additions in Japanese; chip labels kept brief (3–4 chars) to fit narrow UI per the operator's `feedback_i18n_translation` guidance.
- `app/src/screens/PodcastScreen.tsx` (+161 / -3): imports `settingsService`, `computeOptionsHash`, `getCurrentLocale`, type imports for PodcastLength/PodcastStyle/SupportedLocale. New module-level `LENGTH_CHIPS`/`STYLE_CHIPS` enum constants. Three new useState hooks (selectedLength, selectedStyle, playbackRate). useMemo derivations for todayConceptIds + currentHash + isDirty. Chip-group selector JSX rendered above the player/generate cards. Inline optionsBadge in the player header. Playback-rate cycle button added to the play/seek control row. Mount-time playbackRate sync added immediately after `audioRef.current = audio`. Regenerate-with-new-options Button in the player-card footer (visible when isDirty). Three `generatePodcast` call sites updated to pass `{ length, style }`.
- `app/src/screens/settings/SettingsFeaturesScreen.tsx` (+30 / -1): added `SelectInput` to the SettingsShared import; type import for PodcastLength/PodcastStyle; two new useState hooks; two new SettingRow + SelectInput rows in the Podcast Card before the save Button; save handler payload extended with defaultLength + defaultStyle.
- `app/src/screens/settings/SettingsAIScreen.tsx` (+18 / -0): added the TTS Model SettingRow after the voice row, gated on `tts.provider === 'openai'` (D-07). value falls back to 'tts-1' (D-10).

## Public Surface (Plan 52-03 Output)

### PodcastScreen.tsx — new UI elements

1. **Chip-group selectors** (always rendered when no podcast OR pending/failed OR ready) — 4 Length chips + 3 Style chips in a single Card above the player.
2. **Inline cached-options badge** on the player title block (renders only when `selected.options` defined).
3. **Playback-rate cycle button** (1x → 1.5x → 2x → 1x) next to the seek-forward button.
4. **"Regenerate with new options" Button** in the player-card footer (renders only when `isDirty`).

### SettingsFeaturesScreen.tsx — Podcast section additions

- **Default Podcast Length** SelectInput row: 4 options
- **Default Podcast Style** SelectInput row: 3 options
- Save payload extended with `defaultLength` + `defaultStyle`

### SettingsAIScreen.tsx — TTS section addition

- **TTS Model** SelectInput row (OpenAI-only): Standard (tts-1) / HD (tts-1-hd)

### i18n bundles — key additions (all 4 locales)

- `podcast.options.{lengthLabel, brief, standard, deep, extended, styleLabel, focused, conversational, review, regenerateWithNew}` (10 keys)
- `podcast.player.optionsBadge` ("Cached: {{length}} · {{style}}") — both `{{length}}` and `{{style}}` placeholders preserved
- `podcast.player.playbackRateLabel` ("Speed {{rate}}x") — `{{rate}}` placeholder preserved
- `settings.fields.{podcastDefaultLength, podcastDefaultStyle, ttsModel, ttsModelStandard, ttsModelHd}` (5 keys)
- `settings.descriptions.{podcastDefaultLength, podcastDefaultStyle, ttsModel}` (3 keys)

Total: 19 new keys × 4 locales = 76 new translations. Proper nouns (tts-1, tts-1-hd, OpenAI) preserved in every locale per CLAUDE.md.

## Test Status (matches plan's `<verification>` contract)

| File | Total | Pass | Fail | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `tests/services/podcast-prompt.test.mjs` | 21 | 21 | 0 | GREEN | No regression |
| `tests/services/podcast-options.test.mjs` | 9 | 9 | 0 | GREEN | No regression |
| `tests/screens/PodcastScreen.options.test.mjs` | 19 | 19 | 0 | GREEN (was 0/19) | Wave 2 target hit — all PodcastScreen source-reads + locale-parity assertions pass |
| `tests/locales/bundle-parity.test.mjs` | 2 | 2 | 0 | GREEN | Key set parity preserved after 19-key × 4-locale additions |
| `tests/locales/missing-key.test.mjs` | 1 | 1 | 0 | GREEN | Fallback chain unaffected |
| `tests/providers/tts-bracketing-exempt.test.mjs` | 4 | 4 | 0 | GREEN | No regression — TTS provider untouched in this plan |
| **Full npm test suite** | **149** | **149** | **0** | **GREEN** | No regressions across the entire codebase |

`cd app && npx tsc -b --noEmit` exits 0.

## Decisions Made

- **Module-level chip-enum constants.** `const LENGTH_CHIPS = ['brief', 'standard', 'deep', 'extended'] as const satisfies readonly PodcastLength[];` (analog for STYLE_CHIPS). Lifted out of the component body so the enum order is operator-authored once and the chip mapping iterates the constant. Also satisfies the source-read grep `'brief'|'standard'|'deep'|'extended'` without forcing literal duplication inside JSX.
- **Local `settings` binding inside useState initializers.** First implementation used `() => settingsService.getSync().podcast.defaultLength ?? 'standard'` and failed the regex `/settings\.podcast\.defaultLength\s*\?\?\s*['"]standard['"]/` because the regex requires the literal substring `settings.podcast.defaultLength` and `settingsService.getSync().podcast.defaultLength` does NOT contain it (the dot in `settings.` is escaped in the regex, so `settings` must appear directly before `.podcast`). Rebound: `() => { const settings = settingsService.getSync(); return settings.podcast.defaultLength ?? 'standard'; }`. Same runtime, regex now matches.
- **Precomputed `todayConceptIds` via useMemo.** First implementation used `generatePodcast(today(), todayConcepts.map((c) => c.id), { length, style })` and failed the regex `/generatePodcast\([^)]*\{\s*length[^}]*style[^}]*\}\)/` because `[^)]*` is greedy and the inner `(c) => c.id` introduces a `)` that breaks the match. Refactored to precompute `const todayConceptIds = useMemo(() => todayConcepts.map((c) => c.id), [todayConcepts]);` and pass `todayConceptIds` directly. Both improvements: regex matches AND the same memoized array now feeds the dirty-hash derivation.
- **Mount-time playbackRate sync uses `audioRef.current.playbackRate` (not `audio.playbackRate`).** Functionally identical at runtime since `audioRef.current = audio` happened the line before. Choice driven by the source-read regex `/audioRef\.current\.playbackRate\s*=/` requiring ≥2 matches (one for the cycle button, one for the mount sync). The plan body suggested `audio.playbackRate = playbackRate` but the acceptance criterion required the `audioRef.current.` form.
- **`as const satisfies readonly PodcastLength[]` over `as PodcastLength[]`.** Preserves readonly tuple semantics so chip-button rendering iterates a stable enum order, while still enforcing the type constraint at compile time. Reverting to a plain array literal would lose readonly inference.
- **Chip selectors render in BOTH the no-podcast AND ready-podcast states.** The plan called for chips above the player when ready (so users can A/B different options without leaving the player view) but framed them as smaller "read-and-change" presentation. I rendered the same-shape chips uniformly to avoid duplicating the JSX with conditional sizing — operator memory `feedback_tile_simplicity_preference` favors fewer visual variants over rich per-state presentations. The dirty-state Regenerate button is the disambiguator.

## Deviations from Plan

- **[Rule 3 - Source-text adjustment]** Bound `const settings = settingsService.getSync()` inside both chip-state useState initializers so the source-read invariant `/settings\.podcast\.defaultLength\s*\?\?\s*['"]standard['"]/` matches. The plan's pseudocode used `() => settingsService.getSync().podcast.defaultLength ?? 'standard'` which does NOT contain the literal substring `settings.podcast.defaultLength`. Same runtime semantics, source text now matches the regex. **Files modified:** `app/src/screens/PodcastScreen.tsx` (4 lines of refactor at the useState init block). **Commit:** included in `eb6f3d81`.
- **[Rule 3 - Source-text adjustment]** Introduced `todayConceptIds = useMemo(() => todayConcepts.map((c) => c.id), [todayConcepts])` instead of inlining `todayConcepts.map((c) => c.id)` at each call site. The plan's pseudocode used the inline form, which contains `)` characters that break the source-read regex `/generatePodcast\([^)]*\{\s*length[^}]*style[^}]*\}\)/` because `[^)]*` is greedy. Side benefit: the same memoized array now feeds the dirty-hash useMemo so a single derivation flows through all consumers. **Files modified:** `app/src/screens/PodcastScreen.tsx` (3 call sites + 1 new useMemo declaration). **Commit:** included in `eb6f3d81`.
- **[Rule 3 - Source-text adjustment]** Used `audioRef.current.playbackRate = playbackRate` (not the local `audio.playbackRate = playbackRate` form from the plan body) at the mount-time sync site. The acceptance criterion required `grep -cE "audioRef\.current\.playbackRate\s*=" >= 2` — the plan body's wording suggested using the local alias, which would have yielded only 1 match (on the cycle button). Same runtime semantics since `audioRef.current` was assigned `audio` the line above. **Files modified:** `app/src/screens/PodcastScreen.tsx` (1 line at the audio-mount useEffect). **Commit:** included in `eb6f3d81`.

All three deviations are pure source-text adjustments to clear strict-regex source-read invariants from Plan 52-01's Wave-0 tests. No runtime-semantic changes. Documented per the project's "tests must guard the live code path" rule (Phase 32.1 best practice #2).

## Issues Encountered

- **Same `app/node_modules` symlink issue as Plans 52-01 + 52-02.** Worktree had no `node_modules`. Resolved identically: `ln -s /Users/Code/EchoLearn/app/node_modules /Users/Code/EchoLearn/.claude/worktrees/agent-a97b529014aaa3cb5/app/node_modules`. `node_modules` is gitignored — symlink doesn't enter commit history.
- **Regex strictness on source-reads required 3 small refactors.** All three caught immediately on first test run (D-11 fallback regex, generatePodcast call-shape regex, audioRef.current.playbackRate count). Each refactor was a pure source-text change with identical runtime semantics. Phase 32.1 best practice #2 ("tests must guard the live code path") applied — the source-read test pattern is intentional and protects against subtle drift; matching its exact form is part of the work.

## User Setup Required

None. Existing user settings load with the new optional fields `undefined` and fall back via read-site defaults (`'standard'` / `'conversational'` / `'tts-1'`) per `feedback_no_normalize_for_optional_fields.md`. No migration helper, no boot-time defaulting, no first-visit prompt — fields populate only when the user explicitly saves in SettingsFeaturesScreen / SettingsAIScreen.

## Outstanding Manual Verifications

These are queued for `52-VERIFICATION.md` (verify-phase + operator device UAT per D-10):

- **tts-1-hd audio quality on iOS + Android** (PODCAST-05 device UAT gate).
- **Playback-rate 1.5x / 2x on iOS + Android** — verify the native HTMLAudioElement.playbackRate works as expected on both WebView implementations (Android WebView's audio behavior has historically diverged from iOS WKWebView).
- **Educational-content quality across 4 × 3 = 12 length × style combos** (PODCAST-04 substring-eval is structural; semantic quality requires human review).
- **Visual check that the dirty badge + Regenerate button appear/disappear correctly** when the user toggles chips before AND after a podcast is generated (D-04 + D-06 UX correctness).
- **i18n visual review** of zh/es/ja chip labels — verify Japanese chip labels (短め / 標準 / 詳細 / 長尺) fit within the chip width on a narrow phone screen.

## Next Phase Readiness

- **Phase 52 acceptance posture fully met.** All five requirements (PODCAST-01..PODCAST-05) have their structural test contracts GREEN. Manual device UAT items above are deferred to the verify-phase per the planner's D-10 contract.
- **No new event types introduced.** PodcastScreen reacts to existing PODCAST_GENERATION_COMPLETED via the usePodcast hook (no-refresh rule satisfied).
- **No `normalize()` helper added anywhere.** Additive-optional-field rule preserved across all 7 modified files.
- **No "Save as default?" prompt anywhere** (D-12 — chip changes are ephemeral; persistence happens only via SettingsFeaturesScreen).
- **No modal confirmation before regeneration** (D-04 — the explicit "Regenerate with new options" button IS the confirmation).
- **No regressions.** 149/149 npm test suite GREEN. tsc clean. Existing podcast-prompt + tts-bracketing-exempt + locale-bundle-parity + missing-key suites all unchanged.

## Self-Check: PASSED

- `app/src/locales/en.json` contains `podcast.options.{lengthLabel,brief,standard,deep,extended,styleLabel,focused,conversational,review,regenerateWithNew}` plus `podcast.player.optionsBadge` (with `{{length}}` + `{{style}}`) and `podcast.player.playbackRateLabel` plus 5 settings.fields keys and 3 settings.descriptions keys (verified via grep + JSON parse).
- `app/src/locales/zh.json`, `es.json`, `ja.json` carry the same 19-key superset with non-empty values; proper nouns (tts-1, tts-1-hd, OpenAI) appear in each (verified via grep).
- `app/src/screens/PodcastScreen.tsx` contains: `podcast.options.lengthLabel` (1+), `podcast.options.styleLabel` (1+), `settings.podcast.defaultLength ?? 'standard'` (1), `settings.podcast.defaultStyle ?? 'conversational'` (1), `generatePodcast([^)]*\{\s*length[^}]*style[^}]*\}\)` (2 matches), `podcast.options.regenerateWithNew` (1+), `podcast.player.optionsBadge` (1+), `audioRef.current.playbackRate =` (3 matches, ≥2 required), and 0 occurrences of "Save as default" — all verified.
- `app/src/screens/settings/SettingsFeaturesScreen.tsx` contains: `podcastDefaultLength` (4 refs), `podcastDefaultStyle` (4 refs), `settings.fields.podcastDefaultLength` (1), `settings.fields.podcastDefaultStyle` (1), `defaultLength: podcastDefaultLength` (1), `defaultStyle: podcastDefaultStyle` (1) — all verified.
- `app/src/screens/settings/SettingsAIScreen.tsx` contains: `tts.provider === 'openai'` (5 refs, ≥2 required), `settings.fields.ttsModel\b` (1), `value={tts.model ?? 'tts-1'}` (1), `tts-1-hd` (1+) — all verified.
- Commit `559750f7` (Task 1) exists in `git log` (verified).
- Commit `eb6f3d81` (Task 2) exists in `git log` (verified).
- Commit `44a5fdc4` (Task 3) exists in `git log` (verified).
- `cd app && npx tsc -b --noEmit` exits 0 (verified).
- `cd app && node --test tests/services/podcast-prompt.test.mjs tests/services/podcast-options.test.mjs tests/screens/PodcastScreen.options.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs tests/providers/tts-bracketing-exempt.test.mjs` → 56/56 GREEN (verified).
- `cd app && npm test` → 149/149 GREEN (verified — no regressions).

---
*Phase: 52-podcast-quality-defaults-and-learner-controls*
*Plan: 03 (Wave 2)*
*Completed: 2026-05-19*
