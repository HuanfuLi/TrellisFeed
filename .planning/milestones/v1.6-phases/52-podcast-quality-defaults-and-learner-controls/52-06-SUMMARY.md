---
phase: 52-podcast-quality-defaults-and-learner-controls
plan: 06
subsystem: settings
tags: [settings, api-keys, provider-switch, gap-closure]
requires:
  - LLMConfig / EmbeddingConfig in app/src/types/index.ts
  - SettingsAIScreen provider selectors (introduced commit 6bdd3f4a)
provides:
  - Per-provider API-key memory (apiKeys map) that survives provider switch + switch-back
affects:
  - app/src/types/index.ts
  - app/src/screens/settings/SettingsAIScreen.tsx
tech-stack:
  added: []
  patterns:
    - "Additive optional field with read-site fallback (no migration framework) per CLAUDE.md feedback_no_normalize_for_optional_fields"
key-files:
  created:
    - app/tests/screens/SettingsAIScreen.provider-key-persistence.test.mjs
  modified:
    - app/src/types/index.ts
    - app/src/screens/settings/SettingsAIScreen.tsx
decisions:
  - "TTSConfig intentionally gets NO apiKeys map — OpenAI TTS falls back to the LLM key via effectiveTtsApiKey; gptsovits uses baseUrl. Documented inline to prevent a future consistency-fix."
metrics:
  duration: "~15m"
  completed: 2026-05-19
  tasks: 3
  files: 3
requirements: [PODCAST-05]
---

# Phase 52 Plan 06: Per-Provider API-Key Persistence (GAP-5) Summary

Closed GAP-5: switching the AI provider in Settings no longer wipes the entered API key. Per-provider keys are now remembered in an additive `apiKeys` map and restored on switch-back, for both the LLM and embedding selectors.

## What Was Built

- **Additive type field** (`apiKeys?: Record<string, string>`) on `LLMConfig` and `EmbeddingConfig`. No migration framework — pre-GAP-5 stored settings load with `apiKeys` undefined and the read-site fallback (`apiKeys?.[provider] ?? ''`) is the entire strategy. `settings.service.ts` `defaultSettings` untouched.
- **Provider onChange (LLM + embedding):** before switching, stash the current entered key under the OLD provider; after the `defaults[p]` spread (which sets `apiKey: ''`), override `apiKey` with the NEW provider's saved key and persist the map. `saveLlm`/`saveEmbedding` derive `isConfigured` from the (now-restored) `apiKey`, so `isConfigured` semantics are preserved (truth #3).
- **apiKey TextInput onChange (LLM + embedding):** writes the entered value into `apiKeys` under the current provider so a later switch-away-and-back restores it.
- **TTS left as-is** with an inline comment documenting the intentional exclusion (OpenAI TTS uses the LLM-key fallback; gptsovits uses baseUrl). `effectiveTtsApiKey` and `saveTts` untouched (truth #4).
- **Regression test:** source-read invariants (stash + restore-after-defaults-spread + embedding parity + `effectiveTtsApiKey` unchanged) plus a pure-logic round-trip proving a key survives switch-away-and-back independent of React.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add additive apiKeys field to LLMConfig + EmbeddingConfig | 4f99ef43 | app/src/types/index.ts |
| 2 | Restore per-provider keys on provider switch (LLM + embedding) | f907119f | app/src/screens/settings/SettingsAIScreen.tsx |
| 3 | Regression test for key-restore-on-switch | 657e28ad | app/tests/screens/SettingsAIScreen.provider-key-persistence.test.mjs |

## Verification

- `tsc -b --noEmit` clean (run via the main repo's installed compiler; the worktree had no `node_modules`, resolved by a gitignored symlink to `/Users/Code/EchoLearn/app/node_modules`).
- New regression test: 7/7 pass.
- Full suite: 1408/1413 (`test:main`) + 147/149 (`test:actions`) pass. The 7 failures are pre-existing date-dependent trellis fixtures (`trellis-state.service.test.mjs`, `trellis-replant.test.mjs`) asserting wall-clock-relative dates (`actual 2026-05-18` vs `expected 2026-05-19`) — unrelated to this plan's files. Logged to `deferred-items.md`.

## Deviations from Plan

None — plan executed as written. (One environment note: the worktree shipped without `node_modules`, so verification used a gitignored symlink to the main repo's install. This does not affect committed artifacts.)

## Known Stubs

None.

## Threat Flags

None — `apiKeys` reuses the existing localStorage trust surface (T-52-06-01 accepted in the plan threat model); the restore-on-switch logic is pinned by the pure-logic round-trip test (T-52-06-02 mitigated).

## Self-Check: PASSED

- FOUND: app/src/types/index.ts (apiKeys? count = 2)
- FOUND: app/src/screens/settings/SettingsAIScreen.tsx (apiKeys count = 8)
- FOUND: app/tests/screens/SettingsAIScreen.provider-key-persistence.test.mjs
- FOUND commit: 4f99ef43 (Task 1)
- FOUND commit: f907119f (Task 2)
- FOUND commit: 657e28ad (Task 3)
