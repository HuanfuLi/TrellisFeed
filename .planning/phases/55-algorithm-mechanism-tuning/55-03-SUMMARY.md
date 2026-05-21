---
phase: 55-algorithm-mechanism-tuning
plan: 03
subsystem: filter-thresholds
tags: [thresholds, security, debug-knobs, golden-fixtures, embedding]
requires: ["55-02"]
provides:
  - "EmbeddingDebugConfig per-threshold knobs (debugEnabled, offTopicThreshold, maliciousThreshold, anchorDedupThreshold)"
  - "question-filter getActiveThresholds with D-06 malicious clamp [0.78, 0.85]"
  - "canonical-knowledge preCheckAnchorMatch reads + clamps anchorDedupThreshold"
  - "frozen golden-fixture corpus (D-03 evidence bar)"
affects:
  - app/src/types/index.ts
  - app/src/services/settings.service.ts
  - app/src/services/question-filter.service.ts
  - app/src/services/canonical-knowledge.service.ts
  - app/src/screens/settings/SettingsAIScreen.tsx
tech-stack:
  added: []
  patterns:
    - "Optional/additive type extension, no migration framework (CLAUDE.md feedback_no_normalize_for_optional_fields)"
    - "deepMerge { ...defaults, ...stored } gives Pitfall-3 shape-change defaulting for free"
    - "In-service threshold clamp is the load-bearing security guard; UI clamp is belt-and-suspenders"
key-files:
  created:
    - .planning/phases/55-algorithm-mechanism-tuning/55-03-SUMMARY.md
  modified:
    - app/src/types/index.ts
    - app/src/services/settings.service.ts
    - app/src/services/question-filter.service.ts
    - app/src/services/canonical-knowledge.service.ts
    - app/src/screens/settings/SettingsAIScreen.tsx
    - app/tests/services/filter-golden-fixtures.test.mjs
    - app/tests/services/classification-dedup.test.mjs
decisions:
  - "Final threshold values locked: off-topic 0.75, malicious 0.82, anchor-dedup 0.82 (the existing hardcoded constants — verified correct on the golden corpus, no change needed)"
  - "Dev-only debug labels stay English (not added to en/zh/es/ja.json); Phase 56 i18n sweep should not flag them"
  - "The frozen golden-fixture corpus is the durable D-03 artifact, NOT the transient live tuning session"
metrics:
  duration: ~35m
  tasks: 3
  files-modified: 7
  completed: 2026-05-21
---

# Phase 55 Plan 03: Threshold Source-of-Truth + Security-Band Lock Summary

Replaced the dead single `similarityThreshold = 0.65` debug slider with three real, dev-gated, clamped per-threshold knobs (off-topic / malicious / anchor-dedup), wired the anchor-dedup knob into `preCheckAnchorMatch`, clamped the malicious + anchor-dedup knobs to the empirical 0.78-0.85 band in BOTH the UI and the service read paths, and froze the golden-fixture corpus (including the buried-payload evasion case) as the durable D-03 regression bar.

## What Was Built

**Task 1 — Per-threshold reads with the D-06 clamp (`d1aa7840`)**
- `EmbeddingDebugConfig` extended additively: `debugEnabled?`, `offTopicThreshold?`, `maliciousThreshold?`, `anchorDedupThreshold?`. Legacy `similarityThreshold` + `showScores` retained (no migration — optional fields load as `undefined` and read paths fall back to constants).
- `settings.service.ts` `defaultSettings.embeddingDebug` now defaults the four knobs (debugEnabled false, offTopic 0.75, malicious 0.82, anchorDedup 0.82). The existing `deepMerge` spreads `{ ...defaults, ...stored }` for the `embeddingDebug` object, so pre-feature stored configs pick up the new defaults automatically — this IS the Pitfall-3 shape-change defaulting on the kept settings key, without a normalize framework.
- `question-filter.service.ts` `getActiveThresholds(embDebug)`: production (`debugEnabled !== true` OR no `embDebug`) returns the hardcoded constants; debug returns the live knobs with malicious clamped via `Math.min(0.85, Math.max(0.78, ...))`. Threaded into `layer2Embedding` and used in both threshold comparisons. The rawVec/contextVec dual-vector construction is untouched.
- D-02 dev-gated would-flip-distance instrumentation added in `layer2Embedding` (gated `import.meta.env?.DEV && embDebug?.debugEnabled === true`).
- `canonical-knowledge.service.ts` `preCheckAnchorMatch` reads `settings.embeddingDebug.anchorDedupThreshold`, clamps it to `[0.78, 0.85]` when debug is on, else uses the constant. The pre-check still runs before the tree descent.

**Task 2 — Three dev-gated knobs in SettingsAIScreen (`7ea60a9a`)**
- Master "Debug mode" `MaterialSwitch` bound to `embeddingDebug.debugEnabled`; the three knobs render only when it is on (D-04 release-hide affordance).
- Off-topic range `0.60-0.95` step `0.01`; malicious + anchor-dedup ranges `min={0.78} max={0.85}` step `0.01` (D-06 UI clamp mirroring the service clamp).
- Dead `similarityThreshold` slider no longer rendered; the field is retained in the type.

**Task 3 — Frozen golden corpus + anchor-dedup band test (`792ae633`)**
- `filter-golden-fixtures.test.mjs` populated with 4 labeled cases: off-topic greeting (Layer 1), on-topic learning question, verbatim jailbreak → malicious, and the security-critical benign-preamble + verbatim-jailbreak → malicious (mirrors filter-classifier Test 18d at the golden level). Fixed the scaffold to call the real `(content, context?)` signature (embConfig comes from the stubbed settingsService, not a positional arg).
- `classification-dedup.test.mjs` gained two assertions: the `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` source value is in `[0.78, 0.85]`, and `preCheckAnchorMatch` clamps the debug knob via `Math.min(0.85, Math.max(0.78, ...))`.

## Final Threshold Values (locked)

| Threshold | Value | Clamp band | Notes |
|-----------|-------|-----------|-------|
| Off-topic | 0.75 | none (UI 0.60-0.95) | flag-with-LLM, false-positive tolerable |
| Malicious | 0.82 | [0.78, 0.85] (D-06) | block-no-LLM; clamp in service + UI |
| Anchor-dedup | 0.82 | [0.78, 0.85] | CLAUDE.md empirical dedup band |

The three hardcoded constants were verified correct on the golden corpus and required no change — the tuning outcome confirmed the existing values. The durable artifact is the frozen corpus, not the live dev-slider session.

## Deviations from Plan

None — plan executed exactly as written. One implementation observation handled inline (not a deviation): the plan's golden-fixture pattern showed `evaluateQuestion(input, {}, mockEmbConfig)`, but the real signature is `(content, context?, signal?)` — embConfig is read from the lazily-imported (and test-stubbed) `settingsService`. The fixtures were written to the real signature; the mock loader supplies `isConfigured: true`, so no positional embConfig is needed.

## Security Notes (D-06, load-bearing)

- The malicious clamp `Math.min(0.85, Math.max(0.78, ...))` lives in `getActiveThresholds` (service read path) — this is the load-bearing guard; the UI `min={0.78} max={0.85}` is belt-and-suspenders. Detuning below 0.78 from any path is impossible.
- The dual-vector rawVec/contextVec construction in `layer2Embedding` was not touched; malicious is still scored on the raw bare-content vector. filter-classifier Test 18d remains green.
- The anchor-dedup knob is clamped to the same band; the pre-check still runs before `buildStepPrompt('branch')`.

## i18n Note (for Phase 56)

The three threshold knob labels and the "Debug mode" toggle label are dev-only debug strings rendered only when `debugEnabled` is on. Per the plan's discretion note, they intentionally stay English and were NOT added to `en/zh/es/ja.json`. `bundle-parity.test.mjs` is green (no new keys). The Phase 56 i18n sweep should not flag these.

## Verification

- `tsc -b --noEmit` clean (exit 0).
- `node --test` green across: `filter-classifier.unit.test.mjs` (incl. Test 18d), `classification-dedup.test.mjs`, `filter-golden-fixtures.test.mjs`, `bundle-parity.test.mjs` — 41 tests, 0 fail.

## Known Stubs

None. No hardcoded empty values or placeholder data introduced. The legacy `similarityThreshold` field is intentionally retained (read-side backwards-compat) but no longer drives any UI control or threshold — documented in the type comment.

## Self-Check: PASSED

All 8 modified/created files present on disk. All 4 commits (`d1aa7840`, `7ea60a9a`, `792ae633`, `1fbd1951`) found in git log. STATE.md / ROADMAP.md untouched (orchestrator-owned).
