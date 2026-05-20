# Phase 52 Research: Podcast Quality Defaults and Learner Controls

**Phase:** 52
**Requirements:** PODCAST-01, PODCAST-02, PODCAST-03, PODCAST-04, PODCAST-05
**Researcher:** Claude Opus 4.6
**Date:** 2026-05-18

---

## R1. Current Podcast Architecture — Files Inventory

| File | Role | Lines |
|------|------|-------|
| `app/src/services/podcast.service.ts` | Core service: generation, TTS, caching, IndexedDB audio | 342 |
| `app/src/screens/PodcastScreen.tsx` | Player UI, concept list, generation triggers, history | 622 |
| `app/src/state/usePodcast.ts` | React hook wrapping podcast.service + event bus subscriptions | 119 |
| `app/src/providers/tts/index.ts` | TTS synthesis (OpenAI tts-1, locale-aware voice) | ~80 |
| `app/src/providers/llm/index.ts` | chatCompletion/chatStream, locale directive, bracketing | ~400 |
| `app/src/services/scheduler.service.ts` | Auto-generation at sleepTime − advanceMinutes | ~150 |
| `app/src/services/moveGenerator.service.ts` | Weak-concept → podcast move type | - |
| `app/src/services/trellis-actions.service.ts` | `heal()` calls `addConceptToPodcast()` | - |
| `app/src/types/index.ts` | `DailyPodcast`, `PodcastStatus`, `PodcastSettings`, `TTSConfig` | - |
| `app/src/locales/en.json` | `podcast.*` namespace (~50 keys) | - |
| `app/tests/services/_actions-mock-podcast.mjs` | Mock for trellis-actions tests | - |

**Confidence:** HIGH [VERIFIED: full file reads of all listed files]

---

## R2. Current Script Generation — What Needs to Change (PODCAST-01)

### Current state

```typescript
// podcast.service.ts:204-211
chatCompletion(
  [
    { role: 'system', content: 'Write a 90-second spoken podcast recap. Conversational radio style. No stage directions, no music cues. Just the words to be spoken.' },
    { role: 'user', content: `Create a daily learning recap for:\n${questionLines}` },
  ],
  settings.llm,
  { serviceName: 'podcast' },
);
```

- System prompt: single sentence, hardcoded "90-second" target, "conversational radio style"
- User context: flat `- [content]: [summary]` bullet list of questions
- No structured sections (recap, connections, misconception checks, retrieval questions, next action)
- No concept coverage enforcement
- No length/style parameterization

### What PODCAST-01 requires

Default podcast must include structured sections:
1. **Recap** — summarize what was learned
2. **Connections** — link concepts across anchors/clusters
3. **Misconception checks** — surface common misunderstandings
4. **Retrieval questions** — active recall prompts
5. **Next action** — what to do next (review, explore, etc.)

### Recommendation

Replace the system prompt with a structured template that names the five sections. The prompt should instruct the LLM to cover all provided concepts across sections (PODCAST-04 coverage guarantee). Length target should be parameterized (see R3).

**Confidence:** HIGH [VERIFIED: direct read of podcast.service.ts:204-211]

---

## R3. Length and Style Controls (PODCAST-02)

### Current state

- No user-facing length/style options anywhere in PodcastScreen or settings
- Hardcoded "90-second" in system prompt
- `PodcastSettings` type has only: `sleepTime`, `advanceMinutes`, `autoGenerate`
- `DailyPodcast` type has no `options`/`length`/`style` fields

### Design: bounded option sets

**Length options** (bounded, not free-form):

| Option | Label | Target duration | Prompt guidance |
|--------|-------|----------------|-----------------|
| `brief` | Brief | ~60s / ~150 words | Hit key points, skip connections |
| `standard` | Standard | ~90s / ~225 words | Full five sections |
| `deep` | Deep | ~3min / ~450 words | Expand connections, more retrieval Qs |

**Style options** (bounded, not free-form):

| Option | Label | Prompt guidance |
|--------|-------|-----------------|
| `focused` | Focused | Structured, section-by-section, minimal asides |
| `conversational` | Conversational | Natural flow, transitions, "radio host" feel |
| `review` | Review Drill | Heavy on retrieval questions, self-test format |

Why bounded: PODCAST-04 says "style controls cannot degrade learning density into entertainment-only output." Bounded enums with curated prompts per combination make this structurally impossible. Free-text style would let users request "funny standup" and lose learning content.

### UI placement

Pre-generation controls should appear on PodcastScreen BEFORE the generate button. Two select/chip-group controls: Length and Style. Defaults: `standard` + `conversational` (closest to current behavior).

**Confidence:** HIGH for the option-set pattern [ASSUMED — specific option names/labels need operator confirmation during discuss-phase]

---

## R4. Cache Identity and Option Hash (PODCAST-03)

### Current cache behavior

- `generatePodcast(date, conceptIds?)` skips if `status === 'ready' && audioBlobUrls.has(id)` (podcast.service.ts:155)
- Podcast ID is `pod-{timestamp}`, keyed by date (one podcast per date)
- `addConceptToPodcast()` clears script/audio when concept list changes
- No options hash — changing length/style AFTER generation has no mechanism to invalidate

### What PODCAST-03 requires

Cache key must include: concept IDs + locale + options (length, style). If ANY of these change, the podcast must regenerate (or at minimum, the script must regenerate).

### Recommendation

Add optional fields to `DailyPodcast`:

```typescript
export interface DailyPodcast {
  // ... existing fields ...
  options?: PodcastOptions;       // length + style chosen at generation time
  optionsHash?: string;           // deterministic hash of (conceptIds, locale, options)
}

export interface PodcastOptions {
  length: 'brief' | 'standard' | 'deep';
  style: 'focused' | 'conversational' | 'review';
}
```

Cache-skip condition becomes: `status === 'ready' && audioBlobUrls.has(id) && optionsHash === computeHash(currentConceptIds, locale, options)`. On mismatch, clear script and re-generate.

The `optionsHash` field is a simple deterministic string (e.g., `JSON.stringify({conceptIds: sorted, locale, length, style})`). No crypto needed — it's a local cache invalidation key, not a security primitive.

**Confidence:** HIGH [VERIFIED: current skip logic at podcast.service.ts:152-157; type definitions in types/index.ts:187-202]

---

## R5. Concept Coverage Across Options (PODCAST-04)

### The constraint

Style controls cannot degrade learning density. Even a "Brief" podcast must mention every provided concept. A "Review Drill" style must still cover all concepts, just with more retrieval questions per concept.

### Prompt engineering approach

Each length × style combination gets a composed prompt template:

1. **Base constraint (all combinations):** "You MUST mention every concept listed below. Do not skip any."
2. **Length modifier:** Controls word count target and section depth
3. **Style modifier:** Controls tone, section emphasis, and retrieval question density

The prompt template is assembled from parts, not stored as 9 separate strings. Example:

```
SYSTEM: {BASE_INSTRUCTION}
{LENGTH_INSTRUCTION[options.length]}
{STYLE_INSTRUCTION[options.style]}
{COVERAGE_CONSTRAINT}

USER: Concepts to cover:
{conceptLines}
```

### Validation approach

No runtime validation of LLM output is proposed (too expensive — would require a second LLM call). Instead:
- Prompt engineering makes coverage explicit ("list ALL concepts before writing")
- Test coverage: eval set with 5+ concepts verifying each appears in output (substring check)
- If a concept is consistently dropped, the fix is prompt tuning, not runtime enforcement

**Confidence:** MEDIUM [ASSUMED — prompt engineering effectiveness is empirical; coverage guarantee via prompt constraint is standard practice but not formally verified]

---

## R6. TTS Safety and Provider Support (PODCAST-05)

### Current TTS implementation

```typescript
// tts/index.ts — synthesize()
POST ${baseUrl}/v1/audio/speech
body: { model: 'tts-1', input: text, voice, speed }
```

- **Model:** Hardcoded `tts-1` (OpenAI standard quality)
- **Voice:** Locale-aware with fallback map: en→alloy, zh/es/ja→nova. User override respected if non-default.
- **Speed:** From `TTSConfig.speed` (default 1.0, OpenAI range 0.25–4.0)
- **Provider:** Only OpenAI TTS supported (plus stub `gptsovits` in type union, not implemented)
- **Timeout:** 60s per request
- **Fallback:** TTS failure is non-fatal — podcast ready without audio, user shown toast
- **Bracketing exemption:** TTS is exempt from Phase 47 FILTER-03 content bracketing (vocalization, not instruction-following)

### What PODCAST-05 requires

TTS model/voice/speed changes need:
1. Provider-safe fallback behavior
2. Device UAT evidence before changing defaults

### OpenAI TTS models available [ASSUMED]

| Model | Quality | Latency | Cost |
|-------|---------|---------|------|
| `tts-1` | Standard | Low | $15/1M chars |
| `tts-1-hd` | Higher | Higher | $30/1M chars |

### Recommendation

1. **Model selection:** Add `ttsModel` to settings or derive from a quality toggle. Default stays `tts-1`. Expose `tts-1-hd` as an opt-in for users who want better quality.
2. **Voice selection:** Already works — user can change voice in Settings. Locale fallback is correct.
3. **Speed:** Already configurable via `TTSConfig.speed`. Consider adding a UI control on PodcastScreen itself (not just buried in Settings) — but this may be out of scope for Phase 52.
4. **Fallback:** Already non-fatal. If `tts-1-hd` is not available on the user's endpoint (e.g., local/proxy that only supports `tts-1`), the error is caught and the podcast goes audio-less with a toast. This is sufficient fallback behavior.
5. **Device UAT:** PODCAST-05 says "device UAT evidence before defaults change." If we DON'T change defaults (keep `tts-1` as default, offer `tts-1-hd` as opt-in), no UAT needed for the default path. UAT only needed if we propose changing the DEFAULT model/voice/speed.
6. **gptsovits provider:** The type union includes `'gptsovits'` but it's not implemented. Out of scope for Phase 52 — don't build it.

**Confidence:** HIGH for current implementation [VERIFIED: full read of tts/index.ts]; MEDIUM for tts-1-hd availability/pricing [ASSUMED — based on training knowledge of OpenAI API as of May 2025]

---

## R7. Type Changes Required

### New types

```typescript
export interface PodcastOptions {
  length: PodcastLength;
  style: PodcastStyle;
}

export type PodcastLength = 'brief' | 'standard' | 'deep';
export type PodcastStyle = 'focused' | 'conversational' | 'review';
```

### Modified types

**`DailyPodcast`** — add optional fields (no migration needed per project convention):
- `options?: PodcastOptions` — chosen at generation time
- `optionsHash?: string` — cache invalidation key

**`PodcastSettings`** — add default option preferences:
- `defaultLength?: PodcastLength` — persisted user preference (default: `'standard'`)
- `defaultStyle?: PodcastStyle` — persisted user preference (default: `'conversational'`)

### No migration needed

Per project convention (CLAUDE.md + `feedback_no_normalize_for_optional_fields.md`): adding optional `?:` fields doesn't require a migration framework. Existing `DailyPodcast` objects load with `options` and `optionsHash` as `undefined`, which triggers regeneration on next generate — correct behavior.

**Confidence:** HIGH [VERIFIED: project convention from CLAUDE.md and memory files]

---

## R8. generatePodcast Signature Change

### Current signature

```typescript
generatePodcast(date: string, conceptIds?: string[]): Promise<ServiceResult<DailyPodcast>>
```

### Proposed signature

```typescript
generatePodcast(
  date: string,
  conceptIds?: string[],
  options?: PodcastOptions,
): Promise<ServiceResult<DailyPodcast>>
```

The third parameter is optional. When omitted, defaults to `{ length: 'standard', style: 'conversational' }`. All existing call sites (scheduler, PodcastScreen generate button, retry) continue to work without changes until they're updated to pass options.

Call sites to update:
1. `PodcastScreen.tsx:566` — generate button (will pass user-selected options)
2. `PodcastScreen.tsx:516` — regenerate audio button (should pass stored podcast options)
3. `scheduler.service.ts:87` — auto-generation (should use `settings.podcast.defaultLength/defaultStyle`)
4. `usePodcast.ts:84` — hook wrapper (pass-through)
5. `podcast.service.ts:280` — retryGeneration (reuse existing podcast's options)

**Confidence:** HIGH [VERIFIED: grep of all generatePodcast call sites]

---

## R9. System Prompt Template Design

### Structured prompt template (PODCAST-01 + PODCAST-04)

The prompt must be assembled from composable parts:

```
BASE_INSTRUCTION:
  "You are creating a spoken learning podcast recap. Write ONLY the words to be spoken — no stage directions, no music cues, no markdown formatting."

SECTION_INSTRUCTION:
  "Structure the podcast with these sections (use natural transitions, don't announce section names):
  1. RECAP: Summarize what was learned for each concept
  2. CONNECTIONS: Link concepts to each other or to broader ideas
  3. MISCONCEPTION CHECK: Address one common misunderstanding per key concept
  4. RETRIEVAL QUESTIONS: Ask the listener 2-3 recall questions they should pause to answer
  5. NEXT ACTION: Suggest what the learner should do next (review, explore related topics, practice)"

COVERAGE_CONSTRAINT:
  "IMPORTANT: You MUST cover ALL of the following concepts. Do not skip any."

LENGTH_MAP:
  brief: "Keep it concise: approximately 150 words (~60 seconds spoken). Focus on recap and one retrieval question. Abbreviate connections and misconceptions."
  standard: "Target approximately 225 words (~90 seconds spoken). Cover all five sections."
  deep: "Target approximately 450 words (~3 minutes spoken). Expand connections across concepts, include 2+ misconception checks, and ask 4-5 retrieval questions."

STYLE_MAP:
  focused: "Use a structured, section-by-section delivery. Be precise and direct. Minimal asides."
  conversational: "Use a warm, natural radio-host style. Add smooth transitions between sections. Make it engaging but stay educational."
  review: "Emphasize active recall. After each concept recap, immediately pose a retrieval question. End with a rapid-fire self-test covering all concepts."
```

### Why not one-shot LLM call for podcast?

Current design uses `chatCompletion` (not `chatStream`). This is correct — podcast scripts are consumed as a whole for TTS, not streamed to the user. Keep `chatCompletion`.

### serviceName for token tracking

The `{ serviceName: 'podcast' }` option is already passed, preserving per-service token usage reporting.

**Confidence:** HIGH for structure [VERIFIED: current prompt at podcast.service.ts:204-211]; MEDIUM for word-count-to-duration mapping [ASSUMED — standard spoken English is ~150 wpm; ratio is approximate]

---

## R10. PodcastScreen UI Changes

### Current PodcastScreen layout (top to bottom)

1. Header (back + history button)
2. Title + subtitle
3. Concept insertion banner (from Planner, conditional)
4. Player card (if podcast ready)
5. Generate/retry card (if no podcast or failed)
6. Generating progress card (if generating)
7. Knowledge Today concept list

### Proposed additions

**Pre-generation options** (between title and generate card):
- Two chip-group selectors: Length (Brief / Standard / Deep) and Style (Focused / Conversational / Review Drill)
- Only shown when no podcast exists for today OR podcast is pending/failed
- When a ready podcast exists, options are read-only (shown as badges on the player card)
- Defaults loaded from `settings.podcast.defaultLength/defaultStyle`
- Selected options passed to `generatePodcast()`

**Player card enhancement:**
- Show current options as small badges (e.g., "Standard · Conversational")
- If user changes options while a ready podcast exists, show "Regenerate with new options" button

### No new screens needed

Options live inline on PodcastScreen. No settings sub-page addition needed — `PodcastSettings` already has a section in `SettingsFeaturesScreen.tsx`. Default length/style preferences can go there.

**Confidence:** HIGH [VERIFIED: full read of PodcastScreen.tsx layout]

---

## R11. Event Bus — No New Events Needed

Current podcast events are sufficient:
- `PODCAST_GENERATION_STARTED` — triggers UI loading state
- `PODCAST_GENERATION_PROGRESS` — updates progress bar
- `PODCAST_GENERATION_COMPLETED` — swaps in completed podcast (includes options in payload via DailyPodcast)
- `PODCAST_GENERATION_FAILED` — error state
- `PODCAST_CONCEPT_ADDED` — concept insertion

No new event types needed. The `PODCAST_GENERATION_COMPLETED` payload already carries the full `DailyPodcast` object, which will include `options` and `optionsHash` after the type change.

**Confidence:** HIGH [VERIFIED: event types in types/index.ts:716-720]

---

## R12. i18n Keys to Add

New keys needed in `podcast.*` namespace:

```
podcast.options.lengthLabel        — "Length"
podcast.options.brief              — "Brief"
podcast.options.standard           — "Standard"
podcast.options.deep               — "Deep"
podcast.options.styleLabel         — "Style"
podcast.options.focused            — "Focused"
podcast.options.conversational     — "Conversational"
podcast.options.review             — "Review Drill"
podcast.options.regenerateWithNew  — "Regenerate with new options"
podcast.player.optionsBadge        — "{{length}} · {{style}}"
```

Settings keys for defaults:
```
settings.fields.podcastDefaultLength    — "Default Podcast Length"
settings.fields.podcastDefaultStyle     — "Default Podcast Style"
settings.descriptions.podcastDefaultLength — "Length used when auto-generating"
settings.descriptions.podcastDefaultStyle  — "Style used when auto-generating"
```

Per project convention (CLAUDE.md i18n workflow): all 4 locale bundles updated in the same PR. Sonnet subagent handles zh/es/ja translations.

**Confidence:** HIGH [VERIFIED: existing podcast.* namespace pattern in en.json]

---

## R13. Interaction with Scheduler Auto-Generation

`scheduler.service.ts:87` calls `podcastService.generatePodcast(today())` with no conceptIds and no options.

After Phase 52:
- Scheduler should pass `settings.podcast.defaultLength` and `settings.podcast.defaultStyle` as the options parameter
- If defaults are undefined (pre-Phase 52 settings), fall back to `{ length: 'standard', style: 'conversational' }`
- ConceptIds remain unspecified for auto-generation (uses SM-2 due list)

**Confidence:** HIGH [VERIFIED: scheduler.service.ts:87]

---

## R14. Interaction with addConceptToPodcast

`addConceptToPodcast(date, questionId)` clears script/audio when a concept is added (podcast.service.ts:326-335). After Phase 52, this should also clear `optionsHash` (or it already will, since it sets `script: ''` and `status: 'pending'`, which means the cache-skip check will fail on next generate).

Actually, the current behavior already handles this: `addConceptToPodcast` sets `status: 'pending'`, so the `existing?.status === 'ready'` check at line 155 will fail, triggering regeneration. The `optionsHash` mismatch is a belt-and-suspenders check. No additional changes needed in `addConceptToPodcast`.

**Confidence:** HIGH [VERIFIED: podcast.service.ts:320-339]

---

## R15. TTS Model Configuration (PODCAST-05 detail)

### Current hardcoded model

```typescript
// tts/index.ts
body: JSON.stringify({
  model: 'tts-1',
  input: text,
  voice,
  speed: config.speed,
}),
```

### Recommendation

Add `model?: string` to `TTSConfig` (optional, default `'tts-1'`). The `synthesize()` function reads `config.model ?? 'tts-1'`.

Settings UI in SettingsAIScreen (where TTS config already lives) can offer a dropdown: `tts-1` (Standard) / `tts-1-hd` (HD). Default stays `tts-1`.

### Fallback behavior

If the user's endpoint doesn't support the selected model:
1. `synthesize()` gets an HTTP error (likely 400 or 404)
2. Existing error handling catches it, shows toast
3. Podcast goes audio-less (non-fatal)
4. User can change model back to `tts-1` in settings

This is the EXISTING fallback behavior — no new code needed for fallback. The only change is making the model configurable instead of hardcoded.

### Alternative: do NOT expose model selection

If the operator considers model selection too niche (most users are on OpenAI anyway), we can simply un-hardcode the model to read from `TTSConfig` without adding UI. The field would exist for power users who edit settings directly or for future UI.

**Confidence:** HIGH for implementation approach [VERIFIED: tts/index.ts read]; LOW for whether operator wants model UI exposed [ASSUMED — needs discuss-phase confirmation]

---

## R16. Existing Test Coverage

### Current podcast test files

Only one test file exists: `app/tests/services/_actions-mock-podcast.mjs` — a mock for trellis-actions integration tests, not a test of podcast.service itself.

### Tests needed for Phase 52

| Test file | What it covers |
|-----------|---------------|
| `tests/services/podcast-options.test.mjs` | Options hash computation, cache invalidation on option change, default fallback |
| `tests/services/podcast-prompt.test.mjs` | System prompt assembly for each length × style combo, coverage constraint present, section names present |
| `tests/services/podcast-generation.test.mjs` | generatePodcast with options, retryGeneration preserves options, scheduler passes defaults |
| `tests/screens/PodcastScreen.options.test.mjs` | Option chip selection, generate passes options, ready podcast shows option badges |

### Test approach

Tests should mock `chatCompletion` and `synthesize` (both are imports from providers). Verify:
1. The system prompt passed to `chatCompletion` contains the expected length/style instructions
2. The coverage constraint is always present regardless of options
3. `optionsHash` is deterministic and changes when inputs change
4. Cache skip works when hash matches, regenerates when hash mismatches

**Confidence:** HIGH [VERIFIED: test patterns from prior phases; mock pattern from _actions-mock-podcast.mjs]

---

## R17. Risk Assessment

### Low risk
- **Type additions** (PodcastOptions, fields on DailyPodcast) — purely additive, no migration
- **i18n bundle additions** — mechanical, well-established workflow
- **Cache invalidation** — simple hash comparison, existing pattern

### Medium risk
- **Prompt engineering quality** — whether the structured prompt actually produces good podcasts with all 5 sections. Mitigated by eval-style tests checking section coverage in output.
- **Word count accuracy** — LLMs don't count words precisely. "150 words" might produce 120-200. Acceptable for audio duration estimation purposes.
- **TTS duration estimation** — current `script.length / 15` is rough. With variable length options, the estimate becomes less reliable. Consider improving to word-count-based: `wordCount / 2.5` (150 wpm = 2.5 words/second). [ASSUMED]

### Low risk but notable
- **Breaking change for scheduler** — scheduler currently passes no options. Adding default options is backwards-compatible (undefined → defaults). No risk.
- **Existing podcast data** — podcasts without `options` field load fine (`undefined`). Regeneration triggers correctly since `optionsHash` mismatch on the first generate-with-options.

---

## R18. Open Questions for Discuss Phase

1. **Option set confirmation:** Are Brief/Standard/Deep and Focused/Conversational/Review Drill the right bounded options? Or does the operator want different labels/granularity? [ASSUMED — needs confirmation]

2. **TTS model UI:** Should `tts-1-hd` be exposed as a user-selectable option, or just un-hardcode the model for future use? [ASSUMED — needs confirmation]

3. **Default option persistence:** Should default length/style live in `PodcastSettings` (alongside sleepTime/advanceMinutes), or as inline state on PodcastScreen only? Recommendation: PodcastSettings, so scheduler can read them. [ASSUMED]

4. **Regeneration UX:** When user changes options on PodcastScreen while a ready podcast exists, should we (a) immediately regenerate, or (b) show a "Regenerate" button and let the user confirm? Recommendation: (b) explicit confirm — avoids accidental regeneration and wasted LLM tokens. [ASSUMED]

5. **Duration estimation improvement:** Replace `script.length / 15` with word-count-based estimation? Low priority but easy to do alongside other changes. [ASSUMED]

---

## Files Inventory — Production Files to Create or Modify

### New files
| File | Purpose |
|------|---------|
| `app/src/services/podcast-prompt.ts` | Prompt template assembly (length × style × coverage) |

### Modified files
| File | Changes |
|------|---------|
| `app/src/types/index.ts` | Add `PodcastOptions`, `PodcastLength`, `PodcastStyle` types; extend `DailyPodcast` and `PodcastSettings` |
| `app/src/services/podcast.service.ts` | Accept options param, compute optionsHash, assemble prompt via podcast-prompt.ts, cache invalidation |
| `app/src/screens/PodcastScreen.tsx` | Option chip selectors, option badges on player, regenerate-with-new-options button |
| `app/src/state/usePodcast.ts` | Pass options through to service |
| `app/src/providers/tts/index.ts` | Read model from config instead of hardcoded `'tts-1'` |
| `app/src/services/scheduler.service.ts` | Pass default options from settings |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | Default length/style selectors |
| `app/src/locales/en.json` | New podcast.options.* and settings.* keys |
| `app/src/locales/zh.json` | Translations |
| `app/src/locales/es.json` | Translations |
| `app/src/locales/ja.json` | Translations |

### New test files
| File | Purpose |
|------|---------|
| `app/tests/services/podcast-prompt.test.mjs` | Prompt assembly correctness |
| `app/tests/services/podcast-options.test.mjs` | Options hash, cache invalidation |
| `app/tests/screens/PodcastScreen.options.test.mjs` | UI option selection and display |

**Confidence:** HIGH [VERIFIED: all file paths confirmed via codebase reads]

---

## Validation Architecture

### Test count estimate
- `podcast-prompt.test.mjs`: ~12 tests (3 lengths × 3 styles + coverage constraint + section names + default fallback)
- `podcast-options.test.mjs`: ~8 tests (hash determinism, hash changes on input change, cache skip, cache invalidate, undefined options fallback, retry preserves options, addConcept invalidates)
- `PodcastScreen.options.test.mjs`: ~6 tests (chips render, selection state, generate passes options, ready shows badges, regenerate button appears, default from settings)

**Total:** ~26 new tests, ~2-3s additional test time

**Confidence:** HIGH [VERIFIED: test patterns from Phase 50/51 research]
