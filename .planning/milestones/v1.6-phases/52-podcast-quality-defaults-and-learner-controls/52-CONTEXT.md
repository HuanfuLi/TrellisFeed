# Phase 52: Podcast Quality Defaults and Learner Controls - Context

**Gathered:** 2026-05-19
**Status:** Ready for replanning (existing 52-01..52-03 plans were generated without operator context — replan after this discussion)

<domain>
## Phase Boundary

Turn the hardcoded 90-second "conversational radio recap" into a structured, learner-controlled educational podcast:

- **PODCAST-01** — Default script produces 5 structured sections (recap / connections / misconception check / retrieval questions / next action).
- **PODCAST-02** — User picks bounded **Length** and **Style** options before generation. Bounded enums (not free-text) so style cannot degrade into entertainment-only output.
- **PODCAST-03** — Cached podcasts carry their `options` + `optionsHash` (concept IDs + locale + length + style). Mismatch on regenerate invalidates cache.
- **PODCAST-04** — Coverage constraint: every length × style combo must mention every provided concept. Enforced by prompt + tested via substring eval.
- **PODCAST-05** — TTS model/voice/speed are configurable with provider-safe fallback. Defaults do not change without operator device UAT evidence.

**Out of scope for Phase 52:**
- Weak-concept auto-focus / due-balance for podcast inclusion — **PODCAST-F01** (post-v1.6).
- Podcast chapters + interactive audio quizzes — **PODCAST-F02** (post-v1.6).
- `gptsovits` TTS provider implementation — type-union exists, no implementation. Out of scope.
- Free-text style prompts — explicitly rejected (would let users request "funny standup" and lose learning density).
- Modal confirm before regeneration — explicitly rejected in favor of explicit button + dirty-state badge.
- Modal "Save as default?" prompts after generation — explicitly rejected in favor of ephemeral overrides.
- Migration framework for new optional fields — explicitly rejected (operator's "no normalize for optional fields" rule).

</domain>

<decisions>
## Implementation Decisions

### Length and Style Option Sets (PODCAST-02)

- **D-01:** Length is a 4-option enum: `'brief' | 'standard' | 'deep' | 'extended'`. Word-count / duration targets:
  - `brief` → ~150 words / ~60s
  - `standard` → ~225 words / ~90s (current behavior, default)
  - `deep` → ~450 words / ~3min
  - `extended` → ~750 words / ~5min
  Operator chose 4 options over the researcher's 3 — Extended adds commute-friendly long-form. Targets stay ≤5min in Phase 52 so no TTS chunking is required (60s OpenAI request timeout remains comfortable for ~750 words).

- **D-02:** Style is a 3-option enum: `'focused' | 'conversational' | 'review'` with the labels Focused / Conversational / Review Drill in UI. Prompt-side guidance:
  - `focused` → structured section-by-section delivery, minimal asides
  - `conversational` → warm radio-host style with smooth transitions (current behavior, default)
  - `review` → heavy retrieval-question emphasis, self-test format

- **D-03:** Default combo for new users + auto-generation = `{ length: 'standard', style: 'conversational' }`. Closest to current behavior, lowest perceived change for existing users. The default is also the silent fallback for any pre-Phase-52 user whose `PodcastSettings.defaultLength/defaultStyle` are `undefined`.

### Regeneration UX (PODCAST-03)

- **D-04:** Option drift is detected by comparing current chip selections against the cached podcast's `optionsHash`. When they diverge, an inline **"Regenerate with new options"** button appears below the player card. Auto-regenerate on chip change was rejected — user controls token spend. Read-only-once-ready was rejected — user can A/B different lengths same day without deleting.

- **D-05:** When the user confirms regeneration, the cached **script + audio are discarded** but the **concept list is preserved** (matches existing `addConceptToPodcast` invalidation pattern). `optionsHash` is recomputed from the new options. `status` returns to `pending` then `generating`. No keep-old-audio-during-regenerate path.

- **D-06:** Dirty-state UI = **inline badge on player card** showing the cached combo (e.g., "Cached: Standard · Conversational") plus the **Regenerate button** appearing only when chip selection ≠ cached options. One visual diff signal + one CTA. No modal confirm on chip change.

### TTS Surface (PODCAST-05)

- **D-07:** Add `model?: string` to `TTSConfig` (default `'tts-1'`). Surface as an **opt-in dropdown in SettingsAIScreen TTS section**: "Standard (tts-1)" / "HD (tts-1-hd)". Default stays `tts-1`. Power users opt-in to HD. Provider-safe fallback already exists (TTS errors are non-fatal — podcast goes audio-less + toast).

- **D-08:** Add **per-podcast playback-rate buttons (1x / 1.5x / 2x)** on the player card. These set `<audio>.playbackRate` — they are NOT TTS synthesis speed. No regeneration, no provider call, no impact on optionsHash. Local UI state, not persisted.

- **D-09:** TTS synthesis `speed` (in `TTSConfig`) is NOT exposed in Phase 52 UI beyond the existing configuration path. Voice already configurable (alloy/nova/shimmer/echo).

- **D-10:** **Default model/voice/speed do not change in Phase 52.** Only new opt-in options are added. Therefore PODCAST-05's "device UAT before defaults change" gate does not fire in this phase. **However**, the operator runs device UAT on each new option (tts-1-hd synthesis on iOS + Android) before merging — UAT log committed to `52-VERIFICATION.md`. Future phases that change the *default* model/voice/speed must produce device UAT evidence first.

### Defaults Home + Scheduler (PODCAST-02 / PODCAST-03)

- **D-11:** Defaults live in **both** locations:
  1. `PodcastSettings.defaultLength?: PodcastLength` and `defaultStyle?: PodcastStyle` — persisted user preference. Surfaced in **SettingsFeaturesScreen Podcast section** (alongside autoGenerate / sleepTime / advanceMinutes).
  2. **Per-generation override** on PodcastScreen chip selectors. Initial chip selection reads from `settings.podcast.defaultLength/defaultStyle` ?? `'standard' / 'conversational'`. User can change chips before tapping Generate; that change applies to THIS generation only.

- **D-12:** Per-generation overrides are **ephemeral**. No "Save as default?" prompt after generation completes. To change defaults, user opens SettingsFeaturesScreen explicitly. Aligns with iOS Settings-app convention; avoids modal interruption after every generation.

- **D-13:** **Scheduler** (`scheduler.service.ts:87`) reads `settings.podcast.defaultLength ?? 'standard'` and `settings.podcast.defaultStyle ?? 'conversational'` and passes them as the `options` parameter to `generatePodcast()`. ConceptIds remain unspecified for auto-generation (uses SM-2 due list).

- **D-14:** **Silent fallback** for existing users pre-Phase 52 — when `defaultLength` / `defaultStyle` are `undefined`, scheduler and PodcastScreen both fall back to `'standard'` / `'conversational'`. **No migration code, no boot-time normalization, no first-visit prompt.** Settings fields populate only when user explicitly saves in SettingsFeaturesScreen. Matches operator's "no normalize for optional fields" rule.

### Claude's Discretion

These were not asked because they follow established conventions or research recommendations:

- **PodcastOptions type shape:** `interface PodcastOptions { length: PodcastLength; style: PodcastStyle }`. New file `app/src/services/podcast-prompt.ts` owns the prompt assembly (composable parts: BASE / SECTION / COVERAGE / LENGTH_MAP[length] / STYLE_MAP[style]). Mirrors research R7 + R9.
- **`optionsHash` computation:** Deterministic JSON-string hash of `{ conceptIds: sorted, locale, length, style }`. Not a security primitive — local cache invalidation key only. No crypto needed.
- **5-section prompt structure** (PODCAST-01) — Recap / Connections / Misconception Check / Retrieval Questions / Next Action — locked by requirement. Operator did not ask to remove or rename any section. Brief style still includes all 5 sections; the LENGTH_MAP modifier shortens each section proportionally.
- **Coverage enforcement** (PODCAST-04) — prompt-engineering only (BASE constraint "you MUST cover every concept") + substring-match eval test asserting every concept appears in output. No second-LLM-pass validator. If a concept is consistently dropped, fix is prompt tuning. Research R5 + R17 (medium-risk acknowledged).
- **No new event types** — existing `PODCAST_GENERATION_STARTED/PROGRESS/COMPLETED/FAILED/PODCAST_CONCEPT_ADDED` are sufficient. `DailyPodcast` payload carries `options` after the type addition.
- **i18n** — every new string lands en/zh/es/ja bundles in the same PR per Phase 27. New namespace: `podcast.options.*` plus `settings.fields.podcastDefaultLength / .podcastDefaultStyle`. Sonnet subagent handles zh/es/ja.
- **No JSON imports / `lib/date.ts` / `react-i18next` in `podcast-prompt.ts`** — leaf-module pattern per Phase 27 (avoids breaking `tests/locales/bundle-parity.test.mjs` chain under `node --test`).
- **Duration estimation:** Replace `script.length / 15` with word-count-based `wordCount / 2.5` (150 wpm = 2.5 words/second). Low priority but cheap to ship alongside other changes — research R17 ALLOW with [ASSUMED] confidence.
- **`addConceptToPodcast` already invalidates** — sets `status: 'pending'` and clears script/audio, which makes `optionsHash` mismatch belt-and-suspenders. No changes needed there beyond eventually re-computing hash on next generate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements + research
- `.planning/REQUIREMENTS.md` §PODCAST — PODCAST-01..PODCAST-05 source text
- `.planning/ROADMAP.md` §"Phase 52: Podcast Quality Defaults and Learner Controls" — domain + 5 success criteria
- `.planning/phases/52-podcast-quality-defaults-and-learner-controls/52-RESEARCH.md` — implementation patterns (R1–R18), files inventory, prompt assembly, type changes, risk assessment

### Existing services and components (must read before modifying)
- `app/src/services/podcast.service.ts` — `generatePodcast`, cache-skip at line 155, `addConceptToPodcast` invalidation pattern, `audioBlobUrls` map, retryGeneration
- `app/src/screens/PodcastScreen.tsx` — player card, generate button, options chip selectors land here, dirty-state inline badge + Regenerate button, playback-rate buttons
- `app/src/state/usePodcast.ts` — hook wrapper; pass-through for `options` param
- `app/src/providers/tts/index.ts` — `synthesize()`, hardcoded `model: 'tts-1'` line that gets un-hardcoded
- `app/src/services/scheduler.service.ts:87` — auto-generation call site that reads `settings.podcast.defaultLength/defaultStyle`
- `app/src/screens/settings/SettingsFeaturesScreen.tsx` — Podcast section (autoGenerate / sleepTime / advanceMinutes); gets defaultLength + defaultStyle SelectInputs
- `app/src/screens/settings/SettingsAIScreen.tsx` — TTS section (voice already configurable); gets Model SelectInput
- `app/src/types/index.ts` — `DailyPodcast` (line 187), `PodcastStatus` (line 202), `PodcastSettings` (line 284), `TTSConfig` (line 269); all gain additive optional fields
- `app/src/locales/en.json` — `podcast.*` namespace + `settings.fields.podcast*` keys; canonical bundle authored first

### Adjacent phase context (load-bearing)
- `.planning/phases/50-retrieval-and-library-foundation/50-CONTEXT.md` — leaf-service pattern reference (`engagementService` blueprint); no JSON imports / no `lib/date.ts` / no `react-i18next` rule
- `.planning/STATE.md` — milestone v1.6 status, Phase 51 just completed

### Conventions and load-bearing rules
- `CLAUDE.md` §"i18n Workflow" — every new string in all 4 locale bundles same PR; bundle-parity test enforced; podcast.* namespace listed under "Namespaces"
- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — one-signal-per-semantic-event rule (no new podcast events needed)
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_no_normalize_for_optional_fields.md` — optional `?:` fields don't need migration framework; D-14 enforces this for `defaultLength/defaultStyle`
- `~/.claude/projects/-Users-Code-EchoLearn/memory/project_serverless_no_background_tasks.md` — scheduler auto-gen works only when app is open; D-13 inherits this constraint
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_no_refresh_assumption.md` — UI must reactively re-read service state via event-bus; PodcastScreen chip selectors + dirty-state badge resync on `PODCAST_GENERATION_COMPLETED`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`chatCompletion` (not `chatStream`)** in `app/src/providers/llm/index.ts` — current podcast generation uses single-shot completion (script is consumed whole for TTS, not streamed to user). Keep this. Research R9 confirms.
- **`audioBlobUrls` in-memory Map** (`podcast.service.ts:11`) — IndexedDB-backed audio path; cleaned up on regeneration via `URL.revokeObjectURL`. D-05 invalidation reuses the existing pattern from `addConceptToPodcast`.
- **`patchPodcast(id, patch)` helper** (`podcast.service.ts:133`) — partial update path; new `options` and `optionsHash` flow through this.
- **`settingsService.getSync().podcast`** — already typed, already persisted. Adding optional `defaultLength?`/`defaultStyle?` is purely additive; existing settings JSON loads as-is with these undefined.
- **`SettingsFeaturesScreen.tsx` Podcast section** (lines 53–82) — existing `<SectionHeader icon={<Radio />}>` block with autoGenerate / sleepTime / advanceMinutes; extend with two new `<SettingRow>` containing SelectInput for Length and Style.
- **`SettingsAIScreen.tsx` TTS section** (lines 389+) — existing `<SettingRow label={voice}>` with SelectInput; add a sibling `<SettingRow label={model}>` with Standard/HD options.
- **HTML `<audio>` element + `audioRef`** in `PodcastScreen.tsx:40` — `playbackRate` is a native attribute (no library needed). 1x/1.5x/2x buttons just set `audioRef.current.playbackRate = rate`.

### Established Patterns

- **Leaf-module pattern** (Phase 27, reinforced Phase 50 D-03): `podcast-prompt.ts` MUST be a leaf module — no JSON imports, no `lib/date.ts`, no `react-i18next`. Pure prompt-string assembly. Otherwise `tests/locales/bundle-parity.test.mjs` chain breaks under `node --test`.
- **Additive optional fields, no migration** (operator rule, project memory): `PodcastOptions`, `optionsHash`, `defaultLength`, `defaultStyle`, `model` are all `?:` and load as `undefined` for pre-Phase-52 data. Fallback to defaults at read time. Mirrors Phase 50 leaf-service pattern.
- **One signal per semantic event** (CLAUDE.md §Event bus): no new events. Existing `PODCAST_GENERATION_*` payload carries `DailyPodcast` which now includes `options`/`optionsHash`. PodcastScreen subscribers resync naturally.
- **iOS-style controls** (Phase 49 + Phase 50): chip-group selectors for length/style (tap = select); playback-rate buttons (tap = cycle 1x→1.5x→2x→1x). No long-press, no hidden gestures.
- **i18n bundle authorship**: en.json canonical, Sonnet subagent generates zh/es/ja, all 4 land in same PR (bundle-parity.test.mjs enforced).

### Integration Points

- **`podcast.service.ts:generatePodcast`** signature change: `(date, conceptIds?, options?)`. All 5 call sites updated per research R8.
- **`scheduler.service.ts:87`** reads `settings.podcast.defaultLength ?? 'standard'` + `.defaultStyle ?? 'conversational'` and passes as third arg.
- **`usePodcast.ts:84`** hook wrapper passes options through.
- **`PodcastScreen.tsx`** — three new UI elements:
  1. **Pre-generation chip selectors** (Length + Style) — shown when no podcast exists OR status is pending/failed; initialized from settings defaults
  2. **Player-card dirty-state badge** (e.g., "Cached: Standard · Conversational") + **"Regenerate with new options"** button — appear only when current chip selection ≠ cached `options`
  3. **Playback-rate buttons** (1x / 1.5x / 2x) on player card — sets `audioRef.current.playbackRate`
- **`SettingsFeaturesScreen.tsx` Podcast section** — two new SelectInput rows: Default Podcast Length, Default Podcast Style.
- **`SettingsAIScreen.tsx` TTS section** — one new SelectInput row: TTS Model (Standard / HD).
- **`providers/tts/index.ts`** — `synthesize()` reads `config.model ?? 'tts-1'`; HTTP body uses that value.
- **`podcast-prompt.ts` (new)** — exports `buildPodcastPrompt(conceptLines: string, options: PodcastOptions): { system: string; user: string }` and `computeOptionsHash(conceptIds: string[], locale: string, options: PodcastOptions): string`.
- **`types/index.ts`** additive: `PodcastOptions`, `PodcastLength`, `PodcastStyle`; `DailyPodcast` gains `options?`, `optionsHash?`; `PodcastSettings` gains `defaultLength?`, `defaultStyle?`; `TTSConfig` gains `model?`.

</code_context>

<specifics>
## Specific Ideas

- **YouTube-style playback-rate cycle** for the 1x/1.5x/2x buttons — operator's mental model for media controls (Phase 50 D-04 also referenced YouTube). One button area, taps cycle through rates; current rate shown as the button label.
- **"Cached: Standard · Conversational" inline badge** as the diff signal — single line below the player title, muted-foreground color, no icon. Style mirrors existing post-source badges. Disappears when chip selection matches cached options.
- **No "Save as default?" prompt** anywhere in the flow — operator's stated preference for low-friction overrides. Settings is the explicit affordance for persistence.
- **Brief style still includes all 5 sections** — coverage constraint applies at all lengths. The LENGTH_MAP prompt modifier shortens each section, doesn't omit any. PODCAST-04 enforced by test.

</specifics>

<deferred>
## Deferred Ideas

These were raised or implicit during discussion but pushed out of Phase 52:

- **`gptsovits` TTS provider implementation** — type-union has it as a stub; no implementation. Future phase.
- **Free-text style prompts** ("custom style") — explicitly rejected (would let users request entertainment-only output and violate PODCAST-04).
- **Per-podcast TTS synthesis speed override** (separate from playback rate) — kept in TTSConfig only, no UI beyond existing Settings path. Future phase if users request.
- **`tts-1-hd` as default** — defaults don't change in Phase 52. If dogfooding shows users universally prefer HD and the operator runs device UAT, a future phase can flip the default with evidence.
- **Modal confirm before regeneration** ("Change podcast length? This will regenerate") — rejected in favor of dirty-state badge + explicit button.
- **Inline "Set as default" button on player card** after non-default regeneration — rejected in favor of Settings-only persistence.
- **Boot-time normalization of `defaultLength`/`defaultStyle`** — rejected per operator's "no normalize for optional fields" rule.
- **First-PodcastScreen-visit onboarding sheet** for choosing defaults — rejected as friction for users who may not care about the feature.
- **Word-count enforcement on LLM output** (truncate or pad to target) — not pursued; LLMs don't count words precisely, ±25% is acceptable for audio duration estimation.
- **Second-LLM-pass validator for concept coverage** (PODCAST-04) — too expensive. Substring-match eval test is sufficient.
- **TTS audio chunking + concatenation** for very long podcasts (>5min) — not needed at Extended's ~750-word target. If a future phase adds longer options, chunking becomes required.
- **Podcast weak-concept auto-balancing** — PODCAST-F01, post-v1.6.
- **Chapters + interactive audio quizzes** — PODCAST-F02, post-v1.6.

None — discussion stayed within phase scope. (Scope creep redirects went into deferred ideas above.)

</deferred>

---

*Phase: 52-Podcast Quality Defaults and Learner Controls*
*Context gathered: 2026-05-19*
