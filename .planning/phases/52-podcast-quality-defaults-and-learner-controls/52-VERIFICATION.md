---
phase: 52-podcast-quality-defaults-and-learner-controls
verified: 2026-05-19T18:30:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "TTS audio quality: tts-1-hd vs tts-1 on iOS + Android device"
    expected: "tts-1-hd produces audibly higher-quality speech on both platforms; no synthesis errors; podcast falls back to audio-less with toast if TTS fails"
    why_human: "TTS provider call requires a live API key and device speakers; audio quality is subjective; iOS WKWebView and Android WebView behave differently"
  - test: "HTML5 <audio>.playbackRate 1x / 1.5x / 2x on iOS + Android"
    expected: "Tapping 1.5x and 2x buttons audibly speed up playback without pitch artifacts on both iOS and Android; button label updates each tap"
    why_human: "HTMLAudioElement.playbackRate behavior is WebView-implementation-specific; Android WebView audio has historically diverged from iOS; cannot replicate in node test env"
  - test: "Educational content quality across 4 × 3 = 12 length × style combos"
    expected: "Every generated podcast contains all five sections (recap, connections, misconception check, retrieval questions, next action); no combo degrades into entertainment-only output; coverage constraint honored for all concepts"
    why_human: "LLM output quality is subjective; substring-match tests only verify prompt structure, not actual response quality; requires human read-through of 12 generated scripts"
  - test: "Visual correctness of dirty badge + Regenerate button appear/disappear"
    expected: "Changing chip selection when a ready podcast exists shows the 'Cached: {length} · {style}' badge and reveals the 'Regenerate with new options' button; reverting chips back to match the cached hash hides the button again"
    why_human: "isDirty logic depends on runtime computeOptionsHash equality — React state + useMemo interaction cannot be verified by static source-read; UI state transitions require visual inspection"
  - test: "i18n visual check: zh/es/ja chip labels fit narrow phone screens"
    expected: "All chip labels (Brief/Standard/Deep/Extended, Focused/Conversational/Review Drill) render without overflow or truncation on a narrow phone display in all four locales; Japanese chip labels (e.g., 短め / 標準 / 詳細 / 長尺) fit chip width"
    why_human: "Font metrics and container widths are device/OS-dependent; not capturable by static analysis or headless rendering"
---

# Phase 52: Podcast Quality Defaults and Learner Controls — Verification Report

**Phase Goal:** Users can generate higher-quality educational podcasts with bounded controls that preserve concept coverage and cache identity.
**Verified:** 2026-05-19T18:30:00Z
**Status:** human_needed (all automated checks passed; 5 items require operator device UAT)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Default podcast generation includes recap, connections, misconception checks, retrieval questions, and a next action | VERIFIED | `podcast-prompt.ts` SECTION_INSTRUCTION contains all five named sections verbatim (lines 37-41); 21/21 prompt tests pass asserting /RECAP/, /CONNECTIONS/, /MISCONCEPTION/, /RETRIEVAL QUESTIONS/, /NEXT ACTION/ per length×style combo |
| 2 | User can choose bounded podcast length and style before generation | VERIFIED | `PodcastScreen.tsx` renders LENGTH_CHIPS (4: brief/standard/deep/extended) and STYLE_CHIPS (3: focused/conversational/review) above the generate button; chip state initializes from settings defaults; 19/19 PodcastScreen.options tests pass |
| 3 | Regenerated or cached podcasts honor the chosen options, concept IDs, locale, and options hash | VERIFIED | `podcast.service.ts` cache-skip extended with `existing.optionsHash === optionsHash`; `computeOptionsHash` sorts conceptIds, includes locale, length, style; `retryGeneration` passes `pod.options`; 9/9 podcast-options tests pass |
| 4 | Podcast output preserves required concept coverage across length/style settings; style cannot degrade learning density | VERIFIED (structural) | COVERAGE_CONSTRAINT byte-stable literal "MUST mention every concept" present in all 12 prompt variants; prompt tests assert every concept name appears in the `user` half; LLM output quality requires human review (see Manual UAT #3) |
| 5 | TTS model, voice, and speed changes have provider-safe fallback behavior and device UAT evidence before defaults change | VERIFIED (structural) + HUMAN NEEDED | `tts/index.ts:54` reads `config.model ?? 'tts-1'` (default unchanged per D-10); SettingsAIScreen TTS Model SelectInput gated on `tts.provider === 'openai'`; existing TTS error non-fatal path unchanged; device UAT for tts-1-hd quality deferred to operator (see Manual UAT #1-2) |

**Score:** 5/5 truths verified (structural) — 5 manual UAT items pending operator device runs

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/types/index.ts` | PodcastLength (4), PodcastStyle (3), PodcastOptions; additive optional fields on DailyPodcast / PodcastSettings / TTSConfig | VERIFIED | `PodcastLength = 'brief' \| 'standard' \| 'deep' \| 'extended'` at line 207; `PodcastStyle = 'focused' \| 'conversational' \| 'review'` at line 210; `PodcastOptions` interface at line 213; `DailyPodcast.options?`, `.optionsHash?` at lines 200-201; `PodcastSettings.defaultLength?`, `.defaultStyle?` at lines 303-304; `TTSConfig.model?` at line 290; no normalize/migration code |
| `app/src/services/podcast-prompt.ts` | Leaf module: buildPodcastPrompt + computeOptionsHash; no JSON/lib/date/react-i18next imports | VERIFIED | `buildPodcastPrompt` exported at line 76; `computeOptionsHash` exported at line 98; 0 forbidden imports confirmed by grep; leaf-module test asserts 4 source-read invariants |
| `app/tests/services/podcast-prompt.test.mjs` | 21 tests, all GREEN | VERIFIED | 21/21 pass; covers 12-matrix (4 lengths × 3 styles) + 4 word-count tests + coverage substring + leaf-module source-reads |
| `app/tests/services/podcast-options.test.mjs` | 9 tests, all GREEN after Wave 1 | VERIFIED | 9/9 pass; hash determinism + all 4 cross-plan source-read invariants on `podcast.service.ts` match |
| `app/tests/screens/PodcastScreen.options.test.mjs` | 19 tests, all GREEN after Wave 2 | VERIFIED | 19/19 pass; 8 PodcastScreen source-reads + 11 locale-parity assertions across en/zh/es/ja |
| `app/src/services/podcast.service.ts` | generatePodcast(date, conceptIds?, options?); cache-skip with optionsHash; buildPodcastPrompt call; retryGeneration passthrough | VERIFIED | Signature at line 152; `buildPodcastPrompt` import at line 9; cache-skip with `existing.optionsHash === optionsHash` at lines 186-190; `retryGeneration` calls `this.generatePodcast(pod.date, pod.questionIds, pod.options)` at line 312; old 90-second prompt removed (0 matches) |
| `app/src/state/usePodcast.ts` | Hook pass-through: (date, conceptIds?, options?) | VERIFIED | Interface at line 13; useCallback at line 80; service call at line 84 all include options parameter |
| `app/src/services/scheduler.service.ts` | Reads settings defaults with silent fallback | VERIFIED | `defaultLength ?? 'standard'` at line 92; `defaultStyle ?? 'conversational'` at line 93; `generatePodcast(today(), undefined, defaultOptions)` at line 95 |
| `app/src/providers/tts/index.ts` | `config.model ?? 'tts-1'` replaces hardcoded literal | VERIFIED | `model: config.model ?? 'tts-1'` at line 54; old `model: 'tts-1'` literal absent (0 matches); tts-bracketing-exempt tests 4/4 GREEN |
| `app/src/screens/PodcastScreen.tsx` | Chip selectors; dirty badge; Regenerate button; playback-rate buttons | VERIFIED | LENGTH_CHIPS constant; STYLE_CHIPS constant; `settings.podcast.defaultLength ?? 'standard'` in useState init; `isDirty` logic at lines 112-122; `computeOptionsHash` imported and called; `podcast.options.regenerateWithNew` button at line 730; `audioRef.current.playbackRate =` at lines 213 and 703 (≥2 matches); 0 occurrences of "Save as default" |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | Two SelectInput rows; save payload extended | VERIFIED | `podcastDefaultLength` state + SelectInput + save payload (4 refs); `podcastDefaultStyle` state + SelectInput + save payload (4 refs); `defaultLength: podcastDefaultLength` at line 109; `defaultStyle: podcastDefaultStyle` at line 110 |
| `app/src/screens/settings/SettingsAIScreen.tsx` | TTS Model SelectInput gated on OpenAI provider | VERIFIED | `tts.provider === 'openai'` conditional at line 408; `settings.fields.ttsModel` at line 409; `value={tts.model ?? 'tts-1'}` at line 411; `tts-1-hd` option at line 419 |
| `app/src/locales/en.json` | podcast.options.* (10 keys) + player.optionsBadge + settings.fields /* | VERIFIED | All 10 podcast.options keys present; `optionsBadge: "Cached: {{length}} · {{style}}"` with both placeholders; 5 settings.fields keys; 3 settings.descriptions keys |
| `app/src/locales/zh.json`, `es.json`, `ja.json` | Same 19-key set translated; proper nouns preserved | VERIFIED | All 4 locales carry identical key set (bundle-parity test 2/2 GREEN); tts-1-hd preserved in all 3; OpenAI preserved; {{length}}/{{style}} placeholders intact |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `podcast-prompt.ts` | `types/index.ts` | `import type { PodcastOptions, PodcastLength, PodcastStyle, SupportedLocale }` | VERIFIED | Type-only import confirmed; leaf-module rule maintained |
| `podcast.service.ts` | `podcast-prompt.ts` | `import { buildPodcastPrompt, computeOptionsHash }` | VERIFIED | Import at line 9; both functions called in `generatePodcast` |
| `podcast.service.ts` | `i18n-leaf.ts` | `import { t, getCurrentLocale }` | VERIFIED | Import at line 4; `getCurrentLocale()` called at line 161 |
| `scheduler.service.ts` | `podcast.service.ts` | `generatePodcast(today(), undefined, defaultOptions)` | VERIFIED | Three-arg call at line 95; defaultOptions constructed from settings with silent fallback |
| `PodcastScreen.tsx` | `podcast-prompt.ts` | `import { computeOptionsHash }` | VERIFIED | Import at line 16; called in useMemo dirty-hash derivation at line 114 |
| `PodcastScreen.tsx` | `usePodcast.ts` | `generatePodcast(..., { length, style })` | VERIFIED | Three call sites pass options object: lines 728, 740, 790 |
| `PodcastScreen.tsx` | HTML5 `<audio>` | `audioRef.current.playbackRate = rate` | VERIFIED | Lines 213 (mount sync) and 703 (cycle button); ≥2 matches as required |
| `SettingsFeaturesScreen.tsx` | `settingsService.set('podcast', ...)` | `defaultLength: podcastDefaultLength, defaultStyle: podcastDefaultStyle` | VERIFIED | Lines 109-110 in save payload |
| `SettingsAIScreen.tsx` | `settingsService` (via saveTts) | TTS Model instant-save on SelectInput onChange | VERIFIED | `setTts(next); saveTts(next)` pattern at the model SelectInput onChange |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `podcast.service.ts:generatePodcast` | `resolvedOptions` | Caller arg → `settingsService.getSync()` → literal defaults | Yes — three-step fallback chain, no hardcoded static return | FLOWING |
| `podcast.service.ts:generatePodcast` | `optionsHash` | `computeOptionsHash(conceptIdList, locale, resolvedOptions)` — deterministic from real inputs | Yes — hash reflects actual concepts/locale/options at call time | FLOWING |
| `PodcastScreen.tsx` | `selectedLength`, `selectedStyle` | `useState(() => settingsService.getSync().podcast.defaultLength ?? 'standard')` | Yes — reads live settings at mount, user can change via chips | FLOWING |
| `PodcastScreen.tsx` | `isDirty` | `useMemo` over `computeOptionsHash` vs `selected?.optionsHash` | Yes — recomputed when todayConceptIds, selectedLength, or selectedStyle changes | FLOWING |
| `PodcastScreen.tsx` | `playbackRate` | Local React `useState(1)` | Yes — local UI state, not from a service; sets `audioRef.current.playbackRate` directly | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| podcast-prompt tests (21) | `cd app && node --test tests/services/podcast-prompt.test.mjs` | 21/21 pass | PASS |
| podcast-options tests (9) | `cd app && node --test tests/services/podcast-options.test.mjs` | 9/9 pass | PASS |
| PodcastScreen.options tests (19) | `cd app && node --test tests/screens/PodcastScreen.options.test.mjs` | 19/19 pass | PASS |
| bundle-parity tests (2) | `cd app && node --test tests/locales/bundle-parity.test.mjs` | 2/2 pass | PASS |
| tts-bracketing-exempt tests (4) | `cd app && node --test tests/providers/tts-bracketing-exempt.test.mjs` | 4/4 pass | PASS |
| full npm test suite (149) | `cd app && npm test` | 149/149 pass | PASS |
| TypeScript compilation | `cd app && npx tsc -b --noEmit` | Exit 0, no errors | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` probes declared or found; no phase probe contract in any PLAN or SUMMARY file.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PODCAST-01 | 52-01 (types), 52-02 (service), 52-03 (UI) | Default podcast script has 5 structured sections | SATISFIED | SECTION_INSTRUCTION contains RECAP / CONNECTIONS / MISCONCEPTION CHECK / RETRIEVAL QUESTIONS / NEXT ACTION; 21 prompt tests assert all 5 section names across all 12 length×style combos; `buildPodcastPrompt` replaced the old "90-second conversational radio" inline prompt |
| PODCAST-02 | 52-01 (types), 52-03 (UI + settings) | User can choose bounded length (4) and style (3) before generation | SATISFIED | PodcastLength has exactly 4 members; PodcastStyle has exactly 3 members; PodcastScreen chip selectors wired; SettingsFeaturesScreen persists defaults; chip initialization reads settings with fallback |
| PODCAST-03 | 52-01 (types), 52-02 (service), 52-03 (UI) | Cache keyed by options + conceptIds + locale; mismatch triggers regeneration | SATISFIED | `computeOptionsHash` is deterministic over sorted conceptIds, locale, length, style; cache-skip requires `existing.optionsHash === optionsHash`; "Regenerate with new options" button appears when isDirty; `retryGeneration` passes `pod.options` |
| PODCAST-04 | 52-01 (prompt), 52-02 (service) | Concept coverage preserved; style cannot degrade to entertainment-only | SATISFIED (structural) | COVERAGE_CONSTRAINT present in every assembled prompt; podcast-prompt tests assert every concept name in user half; LLM output quality requires human review |
| PODCAST-05 | 52-01 (types), 52-02 (tts/index.ts), 52-03 (SettingsAIScreen + playback-rate) | TTS model configurable; provider-safe fallback; defaults unchanged until device UAT | SATISFIED (structural) + HUMAN NEEDED | `config.model ?? 'tts-1'` in tts/index.ts; SettingsAIScreen TTS Model selector (OpenAI-only); playback-rate buttons set `audioRef.current.playbackRate`; defaults (tts-1) unchanged per D-10; device UAT required per 52-VALIDATION.md Manual-Only section |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TBD / FIXME / XXX / TODO / PLACEHOLDER found in any Phase 52 modified files. No `normalize()` or migration code introduced. No "Save as default?" prompt introduced (D-12/D-13 honored). No new event types introduced. `addConceptToPodcast` correctly left untouched.

The only `migration` text found in modified files (`app/src/types/index.ts:320`) is a pre-existing JSDoc on an unrelated field — not introduced by Phase 52.

---

### Human Verification Required

#### 1. TTS tts-1-hd Audio Quality (PODCAST-05)

**Test:** Switch TTS Model to "HD (tts-1-hd)" in SettingsAIScreen (requires OpenAI provider). Generate a podcast on iOS device. Generate same podcast on Android device. Compare audio quality vs baseline tts-1 output.
**Expected:** tts-1-hd produces audibly higher-quality speech with clearer pronunciation and less artifact noise; synthesis completes without error; if synthesis fails, podcast goes audio-less with toast (non-fatal path unchanged).
**Why human:** TTS provider call requires a live API key and device speakers. Audio quality is subjective. Cannot be replicated in node test environment.

#### 2. HTML5 playbackRate on iOS + Android (PODCAST-05)

**Test:** Play any ready podcast on PodcastScreen. Tap the playback-rate cycle button: 1x → 1.5x → 2x → 1x. Repeat on iOS WKWebView and Android WebView.
**Expected:** Audible speed change without pitch artifacts at each rate; button label updates (1x → 1.5x → 2x → 1x); rate persists when switching to another podcast (mount-time sync); no audio glitch or stutter on rate change.
**Why human:** `HTMLAudioElement.playbackRate` behavior is WebView-implementation-specific; Android WebView audio has historically diverged from iOS WKWebView in this project; cannot replicate in node test env.

#### 3. Educational Content Quality Across 12 Combos (PODCAST-04)

**Test:** Generate one podcast per length × style combo (4 × 3 = 12 podcasts) with at least 2 concepts. Read each script.
**Expected:** Every script contains a recognizable recap, connections paragraph, misconception check, retrieval questions, and a next action. No combo produces entertainment-only output. Brief style is noticeably shorter than Extended; Review Drill style asks substantially more retrieval questions than Focused style.
**Why human:** LLM output quality is subjective. The prompt-structure tests verify the system instruction is correct, not that the model followed it. Coverage constraint enforcement requires reading actual output.

#### 4. Dirty Badge + Regenerate Button State Transitions (PODCAST-03, D-04, D-06)

**Test:** (a) Generate a podcast with default settings. (b) Change the Length chip to a different value. Verify "Cached: {length} · {style}" badge appears AND "Regenerate with new options" button appears. (c) Change back to original chips. Verify button disappears. (d) Tap Regenerate. Verify new podcast generates with the selected options.
**Expected:** Badge and button appear/disappear reactively when chip selection diverges from/matches the cached optionsHash. Regeneration uses the newly selected options.
**Why human:** isDirty computation depends on runtime `useMemo` over `computeOptionsHash`; React state transitions and reactivity correctness require visual inspection; a source-read test cannot verify the conditional render lifecycle.

#### 5. zh/es/ja Chip Labels Visual Fit (i18n)

**Test:** Open PodcastScreen on a narrow phone (~375px screen width) with zh, es, and ja locale set. Inspect the Length and Style chip rows.
**Expected:** All chip labels render without overflow or truncation in all three locales; Japanese labels (短め/標準/詳細/長尺) fit within chip boundaries; Spanish labels (which run ~20% longer than English) wrap gracefully if needed.
**Why human:** Font metrics and container widths are device/OS-dependent; not capturable by static analysis.

---

### Gaps Summary

No automated gaps found. All 5 PODCAST requirements have structural verification evidence. The test suite (149/149) passes cleanly, TypeScript compiles without error, and no debt markers were introduced.

The `human_needed` status is due to 5 behavioral/device UAT items in the Manual-Only Verifications section of `52-VALIDATION.md`, which are carried forward here for the operator's device run before Phase 52 is fully closed.

---

_Verified: 2026-05-19T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
