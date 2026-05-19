# Phase 52: Podcast Quality Defaults and Learner Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 52-podcast-quality-defaults-and-learner-controls
**Areas discussed:** option-set-design, regeneration-ux, tts-surface, defaults-home-scheduler

---

## Option Set Design (PODCAST-02)

### Length set

| Option | Description | Selected |
|--------|-------------|----------|
| Brief / Standard / Deep (3 options) | ~60s / ~90s / ~3min. Researcher's recommendation. | |
| Two options only (Standard / Deep) | Drop Brief as too short to satisfy 5-section coverage. | |
| **Four options (Brief / Standard / Deep / Extended)** | Add ~5min Extended tier for longer commutes / deeper review sessions. | ✓ |

**User's choice:** Four options.
**Notes:** Operator wants more granularity than researcher proposed. Extended is the commute/long-form tier.

### Extended duration target

| Option | Description | Selected |
|--------|-------------|----------|
| **~5 min / ~750 words** | Recommended. ~2x Deep. Comfortable within TTS request timeout. | ✓ |
| ~8 min / ~1200 words | Long-form deep-review session; may approach TTS timeout. | |
| ~10 min / ~1500 words | Full-session length; would require TTS chunking. | |

**User's choice:** ~5 min / ~750 words.
**Notes:** No chunking required; existing TTS path unchanged.

### Style set

| Option | Description | Selected |
|--------|-------------|----------|
| **Focused / Conversational / Review Drill (3 options)** | Researcher's recommendation. | ✓ |
| Two options only (Conversational / Review Drill) | Drop Focused as minor tonal variant. | |
| Different labels | Same intents but different names (Lecture/Radio/Quiz). | |

**User's choice:** Focused / Conversational / Review Drill — as researched.
**Notes:** Locked.

### Default combo

| Option | Description | Selected |
|--------|-------------|----------|
| **Standard + Conversational** | Closest to current behavior, lowest perceived change. | ✓ |
| Standard + Review Drill | Bias toward active recall; aligns with v1.6 ethical engagement theme. | |
| Brief + Conversational | Bias toward shorter content; reduce token cost. | |

**User's choice:** Standard + Conversational.
**Notes:** Existing users keep their last choice once persisted.

---

## Regeneration UX (PODCAST-03)

### Trigger when options change on ready podcast

| Option | Description | Selected |
|--------|-------------|----------|
| **Explicit 'Regenerate with new options' button** | Options remain editable. Button appears when current ≠ cached. Avoids accidental token spend. | ✓ |
| Auto-regenerate immediately on chip change | Lowest friction; spends tokens silently every chip fidget. | |
| Read-only badges once ready | Must Delete to change; loses A/B affordance. | |

**User's choice:** Explicit button.
**Notes:** Operator controls token spend explicitly.

### Cache invalidation aggression

| Option | Description | Selected |
|--------|-------------|----------|
| **Discard script + audio, keep concept list** | Matches `addConceptToPodcast` pattern. | ✓ |
| Discard script only, keep audio until new ready | Briefly mismatched audio + script. | |
| Full reset (status → pending) | Mirrors fresh-created podcast; simplest mental model. | |

**User's choice:** Discard script + audio, keep concept list.
**Notes:** Reuses existing invalidation pattern.

### Dirty-state UI

| Option | Description | Selected |
|--------|-------------|----------|
| **Inline badge + Regenerate button** | "Cached: Standard · Conversational" + button when diff. One visual + one CTA. | ✓ |
| Modal confirm on chip change | Sheet 'Change podcast length? This will regenerate.' | |
| No dirty-state UI, button always visible | Simplest but unclear when it actually does something. | |

**User's choice:** Inline badge + button.
**Notes:** Clear diff signal; no modal interruption.

---

## TTS Surface (PODCAST-05)

### Model surface

| Option | Description | Selected |
|--------|-------------|----------|
| **Opt-in dropdown in SettingsAIScreen** | TTSConfig.model added (default 'tts-1'). Dropdown in TTS section. | ✓ |
| Hidden — un-hardcode only | No UI; power users edit settings JSON directly. | |
| Full surface incl. quick toggle on PodcastScreen | Dropdown + 'HD audio' toggle near Generate. More discoverable but cluttered. | |

**User's choice:** Opt-in dropdown in SettingsAIScreen.
**Notes:** Default stays tts-1; tts-1-hd is the opt-in upgrade.

### Voice/Speed beyond model un-hardcoding

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing additional in Phase 52 | Voice + speed already configurable; model un-hardcoding satisfies PODCAST-05. | |
| Add Speed slider to SettingsAIScreen TTS section | UI binding for TTSConfig.speed. | |
| **Add per-podcast speed override on PodcastScreen** | 1x/1.5x/2x buttons using HTML `<audio>.playbackRate` — NOT TTS synthesis speed. | ✓ |

**User's choice:** Per-podcast playback-rate buttons.
**Notes:** Clarified during ask: this is HTML5 audio `playbackRate`, not provider-side TTS speed. No regeneration, no provider call.

### UAT evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Defaults don't change — no UAT needed | tts-1 / locale voice / 1.0 speed stay default; only opt-ins added. | |
| **Operator runs device UAT on each new option** | iOS + Android UAT for tts-1-hd before merge; log committed to 52-VERIFICATION.md. | ✓ |
| Device UAT only when fallback fires in dogfooding | Ship opt-ins as 'may fail back'; real UAT happens in production. | |

**User's choice:** Operator runs device UAT on each new model/voice option.
**Notes:** Stricter than research recommendation. UAT log committed in verification phase. Future default-change phases inherit the same requirement.

---

## Defaults Home + Scheduler

### Where defaults live

| Option | Description | Selected |
|--------|-------------|----------|
| **Both — PodcastSettings persisted + per-generation override** | Settings field + PodcastScreen chips. Override per-generation does not write back. | ✓ |
| Settings only — PodcastScreen read-only | Settings drives generation; loses per-day A/B affordance. | |
| PodcastScreen only — scheduler hardcodes | No PodcastSettings extension; loses auto-gen customization. | |

**User's choice:** Both — settings persisted, per-generation override on PodcastScreen.
**Notes:** Override stays ephemeral by D-12.

### Save-as-default prompt

| Option | Description | Selected |
|--------|-------------|----------|
| **No prompt — override stays ephemeral** | iOS Settings-app convention; user opens Settings to persist. | ✓ |
| Inline 'Set as default' button on player card | Non-modal; tap once to persist after non-default regeneration. | |
| Modal prompt after generation completes | Toast/sheet 'Use Deep + Review Drill for future podcasts?' | |

**User's choice:** No prompt.
**Notes:** Avoids modal interruption; aligns with iOS conventions.

### Fallback for pre-Phase-52 users

| Option | Description | Selected |
|--------|-------------|----------|
| **Fall back to Standard+Conversational silently** | Pure additive; settings populate on explicit user save. No migration. | ✓ |
| Populate defaults at first app boot post-upgrade | Eager normalization; contradicts 'no normalize for optional fields' rule. | |
| Prompt user on first PodcastScreen visit post-upgrade | One-time sheet for choosing defaults; onboarding friction. | |

**User's choice:** Silent fallback to Standard + Conversational.
**Notes:** No migration code. Settings fields populate only when user explicitly saves.

---

## Claude's Discretion

The operator deferred these to Claude's judgment (implicit via research recommendations or established conventions):

- `PodcastOptions` type shape and `optionsHash` computation (research R7 / R9).
- 5-section prompt structure (locked by PODCAST-01; Brief still includes all 5).
- Coverage enforcement strategy (prompt-only + substring eval test).
- No new event types — existing `PODCAST_GENERATION_*` carries new options field.
- i18n workflow (Sonnet subagent + all 4 bundles same PR).
- Leaf-module pattern for `podcast-prompt.ts`.
- Duration estimation: `wordCount / 2.5` instead of `script.length / 15`.

## Deferred Ideas

Captured for future phases (full list in CONTEXT.md `<deferred>`):

- `gptsovits` TTS provider implementation.
- Free-text style prompts.
- Per-podcast TTS synthesis speed override (separate from playback rate).
- `tts-1-hd` as default (requires future device UAT phase).
- Modal confirm before regeneration.
- Inline 'Set as default' button.
- Boot-time normalization.
- First-visit onboarding sheet for defaults.
- Word-count enforcement on LLM output.
- Second-LLM-pass validator for coverage.
- TTS audio chunking for very long podcasts.
- Weak-concept auto-balancing (PODCAST-F01).
- Chapters + interactive audio quizzes (PODCAST-F02).
