---
phase: 52-podcast-quality-defaults-and-learner-controls
verified: 2026-05-19T20:30:00Z
status: human_needed
score: 5/5
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "GAP-4 (blocker): freshly generated podcast plays — stale podcasts[0] fallback removed; select-on-generate via PODCAST_GENERATION_COMPLETED; isDirty reconciled over selected.questionIds"
    - "GAP-3 (major): player and empty-state are now mutually exclusive — both derived from podcast-view-model.ts; no dual-render possible"
    - "GAP-1 (minor): 'brief' PodcastLength removed everywhere — type, LENGTH_MAP, chips, settings dropdown, all 4 locales, all affected tests"
    - "GAP-2 (minor): config panel is collapsible (default collapsed), repositioned below player/empty-state, above Knowledge Today"
    - "GAP-5 (major): provider API key survives provider switch and switch-back — additive apiKeys map on LLMConfig + EmbeddingConfig; TTS intentionally excluded"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "TTS tts-1-hd audio quality on iOS + Android device"
    expected: "tts-1-hd produces audibly higher-quality speech on both platforms; no synthesis errors; podcast falls back to audio-less with toast if TTS fails"
    why_human: "TTS provider call requires a live API key and device speakers; audio quality is subjective; iOS WKWebView and Android WebView behave differently"
  - test: "HTML5 playbackRate 1x / 1.5x / 2x on iOS + Android"
    expected: "Tapping 1.5x and 2x audibly speed up playback without pitch artifacts on both platforms; button label updates each tap; rate persists when switching podcast"
    why_human: "HTMLAudioElement.playbackRate is WebView-implementation-specific; Android WebView audio has historically diverged from iOS; cannot replicate in node test env"
  - test: "Educational content quality across 3 × 3 = 9 length × style combos (post-GAP-1 matrix)"
    expected: "Every generated podcast contains all five sections; no combo degrades into entertainment-only output; Standard noticeably shorter than Extended; Review style asks substantially more retrieval questions than Focused"
    why_human: "LLM output quality is subjective; substring-match tests verify prompt structure, not actual response quality; requires human read-through of 9 generated scripts"
  - test: "Visual correctness of dirty badge + Regenerate button appear/disappear"
    expected: "Changing chip when ready podcast exists shows 'Cached: {length} · {style}' badge and Regenerate button; reverting chips hides the button"
    why_human: "isDirty logic depends on runtime computeOptionsHash equality and React useMemo reactivity; UI state transitions require visual inspection"
  - test: "zh/es/ja chip labels fit narrow phone screens (updated 3-length matrix)"
    expected: "All chip labels (Standard/Deep/Extended, Focused/Conversational/Review) render without overflow or truncation on a narrow phone in all four locales; Japanese labels (標準/詳細/長尺 / 重点/対話風/復習) fit chip width"
    why_human: "Font metrics and container widths are device/OS-dependent; not capturable by static analysis"
  - test: "Collapsible config panel — collapsed default, correct position, expand/collapse"
    expected: "Config panel appears collapsed by default below the player/empty-state card and above Knowledge Today; tapping header expands to show Length + Style chips; tapping again collapses"
    why_human: "Collapsible UI state and visual layout position require device inspection; static analysis confirmed source order but cannot verify rendered appearance"
  - test: "API key survives provider switch and switch-back"
    expected: "Enter an OpenAI API key, switch to Claude, observe key field blanks; switch back to OpenAI, observe the original key is restored; same behavior for embedding provider"
    why_human: "The apiKeys map round-trip is proven by a pure-logic test; the full flow (React useState + onChange + saveLlm) requires visual/interactive verification"
---

# Phase 52: Podcast Quality Defaults and Learner Controls — Verification Report (Re-verification)

**Phase Goal:** Users can generate higher-quality educational podcasts with bounded controls that preserve concept coverage and cache identity.
**Verified:** 2026-05-19T20:30:00Z
**Status:** human_needed — all automated checks pass; 7 items require operator device UAT
**Re-verification:** Yes — after gap closure by plans 52-04 (GAP-3 + GAP-4), 52-05 (GAP-1 + GAP-2), 52-06 (GAP-5)

---

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Default podcast generation includes recap, connections, misconception checks, retrieval questions, and a next action | VERIFIED | `podcast-prompt.ts` SECTION_INSTRUCTION contains all five named sections verbatim; 17/17 prompt tests pass asserting five section names across all 9 length×style combos (3×3 post-GAP-1) |
| 2 | User can choose bounded podcast length and style before generation | VERIFIED | `PodcastLength = 'standard' \| 'deep' \| 'extended'` (3 members, GAP-1 applied); `PodcastStyle = 'focused' \| 'conversational' \| 'review'` (3 members); `LENGTH_CHIPS` and `STYLE_CHIPS` in PodcastScreen.tsx line 27-28; chip state reads `settings.podcast.defaultLength ?? 'standard'`; SettingsFeaturesScreen persists defaults |
| 3 | Regenerated or cached podcasts honor the chosen options, concept IDs, locale, and options hash | VERIFIED | `computeOptionsHash` deterministic over sorted conceptIds + locale + length + style; cache-skip requires `existing.optionsHash === optionsHash`; GAP-3/GAP-4 closed: `deriveSelectedPodcast` has no `podcasts[0]` fallback; select-on-generate via `PODCAST_GENERATION_COMPLETED`; `currentHash` now hashes over `selected.questionIds` (service-resolved list) so freshly-generated unchanged-chip podcast yields `isDirty===false`; 19/19 view-model behavioral tests pass |
| 4 | Podcast output preserves required concept coverage; style cannot degrade to entertainment-only | VERIFIED (structural) | `COVERAGE_CONSTRAINT` literal present in all 9 assembled prompts; prompt tests assert every concept name appears in user half; LLM output quality requires human review (item #3 below) |
| 5 | TTS model, voice, and speed have provider-safe fallback behavior; defaults unchanged until device UAT | VERIFIED (structural) | `config.model ?? 'tts-1'` in `tts/index.ts:54`; SettingsAIScreen TTS Model SelectInput gated on `tts.provider === 'openai'`; existing non-fatal TTS error path unchanged; device UAT required (items #1-2 below) |

**Score:** 5/5 truths verified (structural) — 7 manual UAT items pending operator device runs

---

### Re-verification: Gap Closure Status

| Gap | Severity | Plan | Status |
|-----|----------|------|--------|
| GAP-1: 'brief' removal + "Review Drill"→"Review" | minor | 52-05 | CLOSED |
| GAP-2: config panel collapsible + repositioned | minor | 52-05 | CLOSED |
| GAP-3: player / empty-state dual-render | major | 52-04 | CLOSED |
| GAP-4: freshly generated podcast does not play | blocker | 52-04 | CLOSED |
| GAP-5: API key wiped on provider switch | major | 52-06 | CLOSED |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/podcast-view-model.ts` | Pure leaf: deriveSelectedPodcast (no podcasts[0]), isEmptyStateVisible, isPlayerVisible, isDirty, computeCurrentHashForSelected | VERIFIED | File exists; only 2 imports: `type { DailyPodcast, PodcastOptions, SupportedLocale }` and `computeOptionsHash from ./podcast-prompt.ts`; no forbidden imports (locales, lib/date, react-i18next, Audio, IndexedDB); `deriveSelectedPodcast` returns `todayPodcast ?? null` with no `podcasts[0]` fallback |
| `app/tests/services/podcast-view-model.test.mjs` | 19 behavioral tests covering mutual exclusion, fresh-play binding, isDirty===false | VERIFIED | 19/19 pass; covers: deriveSelectedPodcast (5), isEmptyStateVisible (5), isPlayerVisible (2), mutual exclusion invariant (2), isDirty + computeCurrentHashForSelected (5) |
| `app/src/types/index.ts` | PodcastLength with exactly 3 members (no 'brief'); apiKeys? on LLMConfig + EmbeddingConfig (not TTSConfig) | VERIFIED | `PodcastLength = 'standard' \| 'deep' \| 'extended'` at line 207; `apiKeys?: Record<string, string>` on EmbeddingConfig (line 264) and LLMConfig (line 279); TTSConfig has no apiKeys (confirmed) |
| `app/src/services/podcast-prompt.ts` | LENGTH_MAP with exactly 3 entries (standard/deep/extended) | VERIFIED | `const LENGTH_MAP: Record<PodcastLength, string>` contains exactly standard/deep/extended; tsc enforces exact key set via Record<PodcastLength,...> |
| `app/src/screens/PodcastScreen.tsx` | LENGTH_CHIPS 3-member; isPlayerVisible/isEmptyStateVisible gates; showConfig local state; config section after player/empty-state, before Knowledge Today; PODCAST_GENERATION_COMPLETED select-on-generate; currentHash over selected.questionIds | VERIFIED | `LENGTH_CHIPS = ['standard', 'deep', 'extended']` at line 27; `STYLE_CHIPS = ['focused', 'conversational', 'review']` at line 28; `isPlayerVisible` gate at line 593; `isEmptyStateVisible` gate at line 739; config section gate at line 780 (AFTER player + empty-state, BEFORE BookOpen/Knowledge Today at line 867); `showConfig` state at line 54; PODCAST_GENERATION_COMPLETED subscriber at line 181; `computeCurrentHashForSelected` over `selected?.questionIds ?? []` |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | No 'brief' option in length dropdown | VERIFIED | `grep -n "brief" SettingsFeaturesScreen.tsx` returns nothing |
| `app/src/screens/settings/SettingsAIScreen.tsx` | apiKeys stash-and-restore on LLM + embedding provider switch; TTS intentionally excluded with inline comment | VERIFIED | 7 occurrences of `apiKeys` (stash, restore, persist on LLM onChange; stash, restore, persist on embedding onChange; TTS comment); `effectiveTtsApiKey` unchanged |
| `app/src/locales/en.json` | podcast.options: no 'brief' key; 'review' value = "Review"; 'configHeading' = "Length & style" | VERIFIED | Keys: configHeading, lengthLabel, standard, deep, extended, styleLabel, focused, conversational, review, regenerateWithNew — no 'brief'; review value = "Review" |
| `app/src/locales/zh.json` | Same 10-key set; 'review' = "复习"; 'configHeading' = "长度与风格" | VERIFIED | Confirmed via grep |
| `app/src/locales/es.json` | Same 10-key set; 'review' = "Repaso"; 'configHeading' = "Duración y estilo" | VERIFIED | Confirmed via grep |
| `app/src/locales/ja.json` | Same 10-key set; 'review' = "復習"; 'configHeading' = "長さとスタイル" | VERIFIED | Confirmed via grep |
| `app/tests/screens/SettingsAIScreen.provider-key-persistence.test.mjs` | 7 tests covering source-read invariants + pure-logic round-trip | VERIFIED | 7/7 pass; covers stash pattern, restore-after-defaults-spread, embedding parity, effectiveTtsApiKey negative assertion, round-trip switch-away-and-back |
| `app/tests/services/podcast-prompt.test.mjs` | 17 tests (9-combo matrix after brief removal) | VERIFIED | 17/17 pass; 3×3 matrix; 'brief' references absent from test source |
| `app/tests/services/podcast-options.test.mjs` | 9 tests; no 'brief' references | VERIFIED | 9/9 pass |
| `app/tests/screens/PodcastScreen.options.test.mjs` | No 'brief' in REQUIRED_OPTION_KEYS | VERIFIED | 19/19 pass (merged with routeFilter: 24/24 combined) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PodcastScreen.tsx` | `podcast-view-model.ts` | `import { deriveSelectedPodcast, isEmptyStateVisible, isPlayerVisible, computeCurrentHashForSelected }` | VERIFIED | Lines 17-19 import; all four functions used in JSX/hooks |
| `PodcastScreen.tsx` (player gate) | `PodcastScreen.tsx` (empty-state gate) | Both derive from the same single source; `isPlayerVisible` and `isEmptyStateVisible` are mutually exclusive by construction | VERIFIED | player at line 593, empty-state at line 739; mutual exclusion proven in 2 behavioral tests |
| `PodcastScreen.tsx` | `PODCAST_GENERATION_COMPLETED` (eventBus) | `eventBus.subscribe('PODCAST_GENERATION_COMPLETED', (e) => { if (e.payload.date === today()) setSelectedId(e.payload.id); })` | VERIFIED | Lines 181-186; reuses existing signal per CLAUDE.md one-signal-per-event |
| `PodcastScreen.tsx` | `selected.questionIds` | `computeCurrentHashForSelected(selected, getCurrentLocale(), { length, style })` | VERIFIED | Line 130; reconciles screen hash with service optionsHash |
| `SettingsAIScreen.tsx` (LLM onChange) | `llm.apiKeys` | Stash current key under old provider, restore new provider's key after defaults spread | VERIFIED | Lines 150-152; stash pattern confirmed; order: `...defaults[p], apiKey: restoredKey, apiKeys: savedKeys` |
| `SettingsAIScreen.tsx` (embedding onChange) | `embedding.apiKeys` | Same stash-and-restore pattern | VERIFIED | Lines 239-241 |
| `types/index.ts PodcastLength` | `podcast-prompt.ts LENGTH_MAP` | `Record<PodcastLength, string>` enforces exact 3 keys at compile time | VERIFIED | tsc exits 0; LENGTH_MAP has standard/deep/extended only |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `podcast-view-model.ts:deriveSelectedPodcast` | `selected` | `todayPodcast ?? null` (no podcasts[0] fallback) | Yes — derives from live service state passed by PodcastScreen | FLOWING |
| `PodcastScreen.tsx:isDirty` | `currentHash` | `computeCurrentHashForSelected(selected, locale, chips)` over `selected.questionIds` (service-resolved list) | Yes — reconciles with `selected.optionsHash` computed from same list by service | FLOWING |
| `SettingsAIScreen.tsx:llm.apiKeys` | `restoredKey` | `savedKeys[newProvider] ?? ''` where savedKeys accumulates from prior stash events | Yes — real key values written on TextInput onChange and stashed on provider switch | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| podcast-view-model behavioral tests (19) | `cd app && node --test tests/services/podcast-view-model.test.mjs` | 19/19 pass | PASS |
| podcast-prompt tests (17 — 3×3 matrix) | `cd app && node --test tests/services/podcast-prompt.test.mjs` | 17/17 pass | PASS |
| podcast-options tests (9) | `cd app && node --test tests/services/podcast-options.test.mjs` | 9/9 pass | PASS |
| PodcastScreen.options + routeFilter (24) | `cd app && node --test tests/screens/PodcastScreen.options.test.mjs tests/screens/PodcastScreen.routeFilter.test.mjs` | 24/24 pass | PASS |
| SettingsAIScreen provider-key-persistence (7) | `cd app && node --test tests/screens/SettingsAIScreen.provider-key-persistence.test.mjs` | 7/7 pass | PASS |
| bundle-parity (2) | `cd app && node --test tests/locales/bundle-parity.test.mjs` | 2/2 pass | PASS |
| Full npm test suite | `cd app && npm test` | 1423/1428 + 147/149 pass (7 pre-existing date-sensitive trellis/SM-2 failures, documented in deferred-items.md, not Phase 52) | PASS (Phase 52 scope) |
| TypeScript compilation | `cd app && npx tsc -b --noEmit` | Exit 0, no errors | PASS |
| 'brief' absent from all targets | `grep -n "brief" types/index.ts podcast-prompt.ts PodcastScreen.tsx SettingsFeaturesScreen.tsx locales/{en,zh,es,ja}.json` | Zero matches (doc comment about 'dropped brief' in types/index.ts line 206 and an unrelated `briefAnswer` field are not podcast controls) | PASS |
| "Review Drill" absent from locales | `grep -n "Review Drill" locales/{en,zh,es,ja}.json` | Zero matches | PASS |
| No podcasts[0] fallback in PodcastScreen | `grep -n "podcasts\[0\]" PodcastScreen.tsx` | Line 114 is a comment (the word appears in "NO podcasts[0] fallback") — no live code path uses it | PASS |
| All 10 gap-closure commits verified | `git log --oneline \| grep <commits>` | All 10 commits found: a7db5b93, 0adf7959, 5a2fde9c, c21e2d02 (52-04) + 44e1f75b, b5ea005b, a4036486 (52-05) + 4f99ef43, f907119f, 657e28ad (52-06) | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` probes declared or found for Phase 52.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PODCAST-01 | 52-01, 52-02, 52-03 | Default podcast includes 5 structured sections | SATISFIED | SECTION_INSTRUCTION in `podcast-prompt.ts` contains RECAP / CONNECTIONS / MISCONCEPTION CHECK / RETRIEVAL QUESTIONS / NEXT ACTION; 17 prompt tests cover all 9 combos |
| PODCAST-02 | 52-01, 52-03, 52-05 | User can choose bounded length (now 3) and style (3) | SATISFIED (operator revised D-01 during UAT: 4→3 lengths, 'brief' removed); PodcastLength has 3 members; chips wired; settings persist defaults |
| PODCAST-03 | 52-01, 52-02, 52-03, 52-04 | Cache keyed by options + conceptIds + locale; mismatch triggers Regenerate | SATISFIED | `computeOptionsHash` deterministic; cache-skip with optionsHash equality; GAP-3/GAP-4 closed — mutual exclusion + fresh-play + isDirty reconciliation; 19 view-model behavioral tests |
| PODCAST-04 | 52-01, 52-02 | Concept coverage preserved; style cannot degrade to entertainment-only | SATISFIED (structural) | `COVERAGE_CONSTRAINT` in every prompt; prompt tests assert concepts in user half; LLM output quality is human-verified (item #3) |
| PODCAST-05 | 52-01, 52-02, 52-03, 52-06 | TTS model configurable; fallback safe; defaults unchanged until device UAT | SATISFIED (structural) + HUMAN NEEDED | `config.model ?? 'tts-1'` in tts/index.ts; SettingsAIScreen TTS Model gated on OpenAI; GAP-5 apiKeys stash-restore folded in per operator approval; device UAT for tts-1-hd and playbackRate required |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TBD / FIXME / XXX / TODO / PLACEHOLDER found in any Phase 52 modified files. No `podcasts[0]` fallback remains in live code paths. No new event types introduced. No migration framework introduced (additive optional field only). TTSConfig intentionally excluded from apiKeys (documented with inline comment).

---

### Human Verification Required

#### 1. TTS tts-1-hd Audio Quality (PODCAST-05)

**Test:** Switch TTS Model to "HD (tts-1-hd)" in Settings → AI (requires OpenAI TTS provider). Generate a podcast on iOS device, then on Android device. Compare audio quality vs. baseline tts-1.
**Expected:** tts-1-hd produces audibly higher-quality speech with clearer pronunciation and less artifact noise; synthesis completes without error; if synthesis fails, podcast goes audio-less with toast (non-fatal path unchanged).
**Why human:** TTS provider call requires a live API key and device speakers. Audio quality is subjective. Cannot replicate in node test environment.

#### 2. HTML5 playbackRate on iOS + Android (PODCAST-05)

**Test:** Play any ready podcast on PodcastScreen. Tap the playback-rate cycle button: 1x → 1.5x → 2x → 1x. Repeat on iOS WKWebView and Android WebView.
**Expected:** Audible speed change without pitch artifacts at each rate; button label updates; rate persists when switching to another podcast; no audio glitch on rate change.
**Why human:** `HTMLAudioElement.playbackRate` behavior is WebView-implementation-specific; Android WebView audio has historically diverged from iOS in this project.

#### 3. Educational Content Quality Across 9 Combos (PODCAST-04)

**Test:** Generate one podcast per length × style combo (3 × 3 = 9 podcasts, post-GAP-1 matrix) with at least 2 concepts. Read each script.
**Expected:** Every script contains all five sections. No combo produces entertainment-only output. Standard noticeably shorter than Extended. Review style asks substantially more retrieval questions than Focused.
**Why human:** LLM output quality is subjective; prompt-structure tests verify system instruction, not that the model followed it.

#### 4. Dirty Badge + Regenerate Button State Transitions (PODCAST-03, D-04, D-06)

**Test:** (a) Generate a podcast with default settings. (b) Change a Length chip. Verify "Cached: {length} · {style}" badge appears AND Regenerate button appears. (c) Revert chips to original. Verify button disappears. (d) Tap Regenerate. Verify new podcast generates with selected options.
**Expected:** Badge and button appear/disappear reactively when chip selection diverges from/matches the cached optionsHash.
**Why human:** isDirty computation depends on runtime useMemo over computeOptionsHash; React state reactivity requires visual inspection.

#### 5. zh/es/ja Chip Labels Visual Fit (i18n — 3-length matrix)

**Test:** Open PodcastScreen on a narrow phone (~375px) with zh, es, and ja locale. Inspect Length and Style chip rows (now 3 × 3).
**Expected:** All chip labels render without overflow or truncation in all three locales; Japanese labels (標準/詳細/長尺 / 重点/対話風/復習) fit chip boundaries.
**Why human:** Font metrics and container widths are device/OS-dependent.

#### 6. Collapsible Config Panel — Default Collapsed, Position, Expand/Collapse (GAP-2)

**Test:** Open PodcastScreen (fresh session). Observe the config panel is NOT visible below the player/empty-state. Tap the "Length & style" header. Observe the chip rows expand. Tap again to collapse.
**Expected:** Config panel starts collapsed; header toggle shows ChevronRight/ChevronDown affordance; position is below player/empty-state card and above Knowledge Today section; chip state and isDirty logic still work when expanded.
**Why human:** Collapsible UI state, visual position, and layout hierarchy require device/browser inspection. Source order confirmed (player at line 593, config at line 780, Knowledge Today at line 867) but rendered appearance cannot be verified statically.

#### 7. API Key Survives Provider Switch and Switch-Back (GAP-5)

**Test:** In Settings → AI, enter an OpenAI API key. Switch AI provider to Claude — verify the key field goes blank for Claude. Enter a Claude key. Switch back to OpenAI — verify the original OpenAI key is restored. Repeat test for the embedding provider selector.
**Expected:** Per-provider keys are remembered and restored on switch-back for both LLM and embedding providers. isConfigured status is correct after restoration.
**Why human:** The pure-logic round-trip is proven by regression test; the full React-state flow (useState + onChange + saveLlm persistence to localStorage + reload) requires interactive device verification.

---

### Gaps Summary

No automated gaps found. All 5 UAT gaps (GAP-1 through GAP-5) are closed with code evidence and passing behavioral tests. The phase goal is structurally achieved.

The `human_needed` status reflects 7 behavioral/device UAT items that require operator verification before Phase 52 is fully closed. All automated checks pass (78/78 relevant tests, tsc clean, bundle-parity green). The 7 pre-existing date-sensitive trellis/SM-2 test failures are documented in `deferred-items.md` and are not Phase 52 regressions.

---

_Verified: 2026-05-19T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure by plans 52-04, 52-05, 52-06_
