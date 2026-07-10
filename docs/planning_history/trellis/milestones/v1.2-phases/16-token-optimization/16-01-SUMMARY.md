---
phase: 16-token-optimization
plan: "01"
subsystem: question-answering
tags: [token-optimization, kv-cache, session-history, llm]
dependency_graph:
  requires: []
  provides: [session-history-threading, kv-cache-ready-ask-streaming]
  affects: [useQuestions, question.service, AskScreen]
tech_stack:
  added: []
  patterns: [append-only-message-array, SessionMessage-to-ChatMessage-conversion]
key_files:
  created: []
  modified:
    - app/src/state/useQuestions.ts
    - app/src/services/question.service.ts
    - app/src/screens/AskScreen.tsx
decisions:
  - sessionHistory parameter is optional — all existing callers not passing it continue to work unchanged
  - priorMessages uses slice(0,-1) to exclude just-appended user message preventing duplication
  - store variable retained in useQuestions.ts askStreaming for candidatePack and buildAndSave usage
  - historyMessages conversion maps SessionMessage type field (user/ai) to ChatMessage role field (user/assistant)
metrics:
  duration: "15m"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase 16 Plan 01: Session History Threading for KV-Cache Summary

**One-liner:** Append-only session history replaces the "3 recent global Q&As in system prompt" hack, enabling provider-side KV-cache hits (50-90% cheaper cached input tokens) and real multi-turn conversation context.

## What Was Built

Restructured both LLM call sites in the Question Answering flow to accept and thread a `SessionMessage[]` parameter instead of stuffing 3 recent questions from the global store into the system prompt.

### Changes

**`app/src/state/useQuestions.ts`**
- Added `SessionMessage` import from `../types`
- Extended `UseQuestionsReturn.askStreaming` interface signature with `sessionHistory?: SessionMessage[]` as 4th parameter
- Extended `askStreaming` useCallback signature with same optional parameter
- Removed `recentContext`, `contextLines` variables (the "3 recent global Q&As" hack)
- Rebuilt `systemPrompt` without the recent context injection — knowledge graph candidate context stays
- Added `historyMessages` conversion loop mapping `SessionMessage[]` to `{ role: 'user' | 'assistant'; content }[]`
- Updated `chatStream` call to spread `...historyMessages` between system prompt and current user message

**`app/src/services/question.service.ts`**
- Added `SessionMessage` import from `../types/index.ts`
- Extended `ask()` method signature with `sessionHistory?: SessionMessage[]` as 3rd parameter
- Removed `recentContext`, `contextLines` variables from `ask()`
- Rebuilt `systemPrompt` in `ask()` without recent context injection — JSON format instructions preserved
- Added `historyMessages` conversion loop (same pattern as useQuestions.ts)
- Updated `chatCompletion` call to spread `...historyMessages` between system prompt and current user message

**`app/src/screens/AskScreen.tsx`**
- In `generateAiReply`, extracted `priorMessages = sessionRef.current.messages.slice(0, -1)` before the `askStreaming` call
- Passed `priorMessages` as the 4th argument to `askStreaming`
- The `slice(0, -1)` excludes the just-appended user message (which is also passed as `userContent`) to prevent duplication

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `app/src/state/useQuestions.ts` — modified, sessionHistory parameter present
- `app/src/services/question.service.ts` — modified, sessionHistory parameter present
- `app/src/screens/AskScreen.tsx` — modified, priorMessages slice present
- Commits 60a90253 and 791e0107 exist in git log
- TypeScript compiles with zero errors
- `recentContext` count: 0 in both service files
