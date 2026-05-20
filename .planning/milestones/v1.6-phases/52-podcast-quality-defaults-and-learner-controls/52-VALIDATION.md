---
phase: 52
slug: podcast-quality-defaults-and-learner-controls
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
updated: 2026-05-20
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | none — uses `app/tests/canonical-knowledge.test.mjs` pattern |
| **Quick run command** | `cd app && node --test tests/services/podcast-prompt.test.mjs tests/services/podcast-options.test.mjs tests/screens/PodcastScreen.options.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~3 seconds (per-phase tests); ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (touches only Phase 52 tests + closely related services)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 0 | PODCAST-01, PODCAST-02 | — | N/A | unit | `cd app && node --test tests/services/podcast-prompt.test.mjs` | ✅ | ✅ green |
| 52-01-02 | 01 | 0 | PODCAST-04 | — | optionsHash deterministic | unit | `cd app && node --test tests/services/podcast-options.test.mjs` | ✅ | ✅ green |
| 52-02-01 | 02 | 1 | PODCAST-03 | — | Cache invalidation on hash mismatch | unit | `cd app && node --test tests/services/podcast-options.test.mjs` | ✅ | ✅ green |
| 52-02-02 | 02 | 1 | PODCAST-05 | — | TTS fallback safe on unsupported model | unit | `cd app && node --test tests/services/podcast-options.test.mjs` | ✅ | ✅ green |
| 52-03-01 | 03 | 2 | PODCAST-02, PODCAST-03 | — | UI option selection persists into generation | unit | `cd app && node --test tests/screens/PodcastScreen.options.test.mjs` | ✅ | ✅ green |
| 52-03-02 | 03 | 2 | PODCAST-02 | — | i18n bundle parity preserved | unit | `cd app && node --test tests/locales/bundle-parity.test.mjs` | ✅ | ✅ green |

> Task IDs are placeholders — final IDs assigned by gsd-planner. Per-task entries are upserted by the planner during plan generation. Wave 0 entries are tests created in Wave 0; ✅ entries reference existing tests.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/tests/services/podcast-prompt.test.mjs` — 17 tests covering 4 lengths × 3 styles + coverage constraint + section names + default fallback (PODCAST-01, PODCAST-02) — 17/17 pass
- [x] `app/tests/services/podcast-options.test.mjs` — 9 tests covering optionsHash determinism, cache skip, cache invalidate, undefined-options fallback, retry preserves options, addConcept invalidates (PODCAST-03, PODCAST-04) — 9/9 pass
- [x] `app/tests/screens/PodcastScreen.options.test.mjs` — 19 tests covering chip render, selection state, generate passes options, ready shows badges, regenerate button visibility, default from settings (PODCAST-02, PODCAST-03) — 19/19 pass

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TTS audio quality for `tts-1-hd` on iOS + Android device | PODCAST-05 | TTS provider call requires API key + device speakers; subjective audio quality cannot be unit-tested | (1) Switch TTS model to `tts-1-hd` in SettingsAIScreen. (2) Generate a podcast on iOS device. (3) Generate same podcast on Android device. (4) Compare to baseline `tts-1` output. (5) Append findings + commit decision to `52-VERIFICATION.md`. |
| HTML5 `<audio>.playbackRate` 1x / 1.5x / 2x on iOS + Android | PODCAST-05 | Browser/WebView audio playback behavior is device-specific; cannot be replicated in node test env | (1) Play any podcast on PodcastScreen. (2) Tap 1.5x button; confirm audible speed change without pitch artifacts. (3) Tap 2x button; confirm audible speed change. (4) Repeat on iOS + Android. (5) Append findings to `52-VERIFICATION.md`. |
| Podcast educational content quality across length × style combinations | PODCAST-04 | LLM output quality is subjective; coverage of 5 sections needs human read-through to confirm density not degraded | Generate one podcast per length × style combo (12 podcasts). Confirm each contains recap, connections, misconception checks, retrieval questions, and a next action. Note any combinations that degrade into entertainment-only output. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-20 — all 6 per-task automated commands re-run green (47/47 tests pass: podcast-prompt 17, podcast-options 9, PodcastScreen.options 19, bundle-parity 2). Manual-only verifications (PODCAST-04 content quality, PODCAST-05 device TTS/playback) remain manual; covered by passed 52-VERIFICATION.md.
