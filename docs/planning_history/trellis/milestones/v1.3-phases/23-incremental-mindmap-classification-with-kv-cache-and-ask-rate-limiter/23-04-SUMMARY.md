---
phase: 23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
plan: 04
subsystem: llm-providers, reorganize
tags: [json-mode, parser-robustness, retry, schema-validation]
dependency_graph:
  requires: [chatCompletion, reorganizeMindmap]
  provides: [CompletionOptions.jsonMode, repairJson, parseReorgResponse, coverage-validation]
  affects: [canonical-knowledge.service.ts, providers/llm/index.ts]
tech_stack:
  added: []
  patterns: [provider-native-json-mode, three-tier-parser, retry-with-feedback, coverage-gating]
key_files:
  created:
    - app/tests/reorg-json-parser.test.mjs
  modified:
    - app/src/providers/llm/index.ts
    - app/src/services/canonical-knowledge.service.ts
decisions:
  - "Used Claude assistant-prefill pattern (push `{`, prepend on return) since Messages API has no dedicated json_object flag"
  - "Three-tier fallback: direct parse → balanced-brace extraction → structural repair. Each tier cheap to attempt, bails early on success."
  - "repairJson handles mid-string truncation by scanning to lastSafeEnd (outside any unclosed string) then rebalancing"
  - "Coverage threshold set to 90% — below this, we assume the LLM truncated or hallucinated and reject the result entirely rather than apply a mangled hierarchy"
  - "Retry budget capped at 1 (one retry, one additional LLM call) — more would stall user too long on bad models"
requirements_completed: [REORG-01, REORG-02, REORG-03, REORG-04, REORG-05]
metrics:
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 23 Plan 04: Reorganize JSON Robustness Summary

Provider-level JSON mode + hardened three-tier parser + auto-retry + coverage validation. Eliminates the "Invalid JSON in LLM response" toast on reorganize for well-behaved models and makes recovery automatic on misbehaving ones.

## Tasks Completed

### Task 1: jsonMode option across LLM providers
- **Commit:** `be5a4c56`
- `CompletionOptions` gains `jsonMode?: boolean`
- OpenAI: `response_format: { type: "json_object" }` added to body when `jsonMode=true`
- Gemini: `generationConfig.responseMimeType: "application/json"` via extended `toGeminiPayload(..., jsonMode)`
- Claude: pushes `{ role: "assistant", content: "{" }` as the final message and prepends `{` to the response (Messages API has no dedicated flag)
- Streaming variants unchanged — reorg is non-streaming
- Default behavior unchanged when `jsonMode` is unset (regression-safe)

### Task 2: Harden `_doReorganize` parser + auto-retry + schema validation
- **Commit:** `c1f7282c`
- New exported `repairJson(raw)`:
  - Strips ``` ```json ``` / ``` ``` fences and leading preamble
  - Removes trailing commas before `}` and `]`
  - Walks the string tracking brace/bracket depth and string state
  - On mid-string truncation, cuts back to `lastSafeEnd` before rebalancing
  - Trims dangling keys (`"foo":`), then appends missing `]` / `}` closers
- New `parseReorgResponse()` implements the three-tier fallback
- `_doReorganize` now calls `chatCompletion` with `{ jsonMode: true, maxTokens: 16384 }`
- Auto-retry: on all three parse tiers failing, one retry with error-feedback message and the bad response as assistant context
- Coverage validation: `mentionedIds.size / qaNodes.length < 0.9` → reject with `COVERAGE_ERROR` before mutating state
- 11 new unit tests (`tests/reorg-json-parser.test.mjs`) all pass

## Verification Results

- `npx tsc --noEmit` → clean
- `npx tsx --test tests/reorg-json-parser.test.mjs tests/canonical-knowledge-pipeline.test.mjs tests/ask-rate-limiter.test.mjs` → 34/34 pass

## Deviations from Plan

None — plan executed as written. Claude prefill approach kept as-is (no `stop_sequences` added); happy to revisit if we observe over-generation in practice.

## Known Stubs

None.

## Manual Verification To Do

- Open GraphScreen, click "Reorganize" on a mindmap of 40+ QAs — should complete without "Invalid JSON" toast
- Observe console for `[EchoLearn] Reorg:` warnings — in a successful run there should be none
- Artificially stress-test by setting a very weak model in settings; the auto-retry should kick in and console should show `initial parse failed, retrying with feedback`

## Self-Check: PASSED
