---
phase: 16-token-optimization
plan: "02"
subsystem: token-usage-monitoring
tags: [token-usage, llm, monitoring, localStorage, pluggable-service]
dependency_graph:
  requires: []
  provides: [token-usage.service.ts, CompletionOptions.serviceName, tokenUsageReporter.record]
  affects: [app/src/providers/llm/index.ts, app/src/services/token-usage.service.ts]
tech_stack:
  added: []
  patterns: [pluggable-interface, FIFO-eviction, localStorage-persistence]
key_files:
  created:
    - app/src/services/token-usage.service.ts
  modified:
    - app/src/providers/llm/index.ts
decisions:
  - LocalTokenUsageReporter uses FIFO eviction at 500 records — prevents unbounded localStorage growth
  - Usage recording is conditional on serviceName being present — no-op for existing callers that don't pass serviceName
  - Streaming functions (openAIStream, claudeStream, geminiStream) accept options pass-through for future SSE extraction
  - void options in streaming functions silences noUnusedLocals — SSE usage extraction deferred to future plan
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_changed: 2
---

# Phase 16 Plan 02: Token Usage Infrastructure Summary

## One-liner

Pluggable `TokenUsageReporter` service (localStorage-backed, 500-record FIFO) wired into all 3 provider completion functions in `llm/index.ts` via `serviceName` option.

## What Was Built

### Task 1: token-usage.service.ts
- `UsageMetadata` interface — normalized token counts across all providers
- `TokenUsageRecord` interface — per-call record with id, serviceName, provider, timestamp
- `ServiceAggregate` interface — aggregated stats by service (callCount + token totals)
- `TokenUsageReporter` interface — pluggable (per D-09), swappable for remote implementation
- `LocalTokenUsageReporter` class — localStorage persistence, FIFO eviction at 500 records, `getByService()` aggregation
- `tokenUsageReporter` singleton export

### Task 2: llm/index.ts wiring
- Added `serviceName?: string` to `CompletionOptions` interface
- Added `normalizeOpenAIUsage`, `normalizeClaudeUsage`, `normalizeGeminiUsage` private functions
- Each provider completion function (`openAICompletion`, `claudeCompletion`, `geminiCompletion`) extracts usage from API response and calls `tokenUsageReporter.record()` when `serviceName` is provided
- `chatCompletion` routes `options` through to provider functions
- `chatStream` and all 3 streaming functions accept `options?: CompletionOptions` for future SSE extraction
- `testLLMConnection` unchanged — compiles fine, `serviceName` is optional

## Commits

- `e3af0722` — feat(16-02): create TokenUsageReporter interface and LocalTokenUsageReporter
- `ade95555` — feat(16-02): wire token usage extraction into chatCompletion and chatStream

## Verification

- `npx tsc --noEmit` passes with zero errors
- 3 `tokenUsageReporter.record` calls confirmed (one per provider)
- `serviceName` option confirmed in `CompletionOptions`
- No breaking changes to existing callers

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all recording logic is fully implemented. Usage data will be recorded for any caller that passes `serviceName`. Callers currently don't pass `serviceName` (that happens in Plan 03), so no data is written yet — this is by design.

## Self-Check: PASSED

- `app/src/services/token-usage.service.ts` — exists
- `app/src/providers/llm/index.ts` — modified with usage wiring
- Commits `e3af0722` and `ade95555` — verified in git log
