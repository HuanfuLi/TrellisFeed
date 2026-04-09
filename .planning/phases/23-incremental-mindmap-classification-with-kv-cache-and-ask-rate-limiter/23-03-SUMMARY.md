---
phase: 23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
plan: 03
subsystem: ask-pipeline-wiring
tags: [pipeline, rate-limiter, wiring, askscreen, useQuestions]
dependency_graph:
  requires: [classifyAndAnchorIncremental, getRateLimitStatus, incrementAskCount, askMonthlyLimit]
  provides: [rate-limited-ask-flow, incremental-classification-wiring, ask-banner-ui]
  affects: [useQuestions.ts, question.service.ts, AskScreen.tsx]
tech_stack:
  added: []
  patterns: [rate-limit-guard-before-llm, increment-after-save, lazy-state-initializer]
key_files:
  created: []
  modified:
    - app/src/state/useQuestions.ts
    - app/src/services/question.service.ts
    - app/src/screens/AskScreen.tsx
decisions:
  - "Rate limit guard placed after aiConsent and isConfigured checks, before try block in askStreaming"
  - "incrementAskCount called after buildAndSave (reflects actually-saved questions)"
  - "rateLimitStatus state uses lazy initializer to read settings at mount time"
  - "refreshRateLimit called after generateAiReply completes in handleSend"
  - "classifyAndAnchor removed from imports (unused after replacement with classifyAndAnchorIncremental)"
metrics:
  duration: 140s
  completed: "2026-04-09T22:49:43Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 23 Plan 03: Pipeline + Rate Limiter Wiring Summary

Wire classifyAndAnchorIncremental into both call sites (useQuestions, question.service) and add rate limit guard + AskScreen banner with disabled send button

## Tasks Completed

### Task 1: Wire pipeline + rate limiter into useQuestions and question.service
- **Commit:** 568ec435
- Replaced `classifyAndAnchor` with `classifyAndAnchorIncremental` in useQuestions.ts (fire-and-forget after save)
- Replaced `classifyAndAnchor` with `classifyAndAnchorIncremental` in question.service.ts (fire-and-forget after flagged check)
- Added rate limit guard at top of askStreaming: reads `askMonthlyLimit` from settings, calls `getRateLimitStatus`, blocks with user message when `canAsk` is false
- Added `incrementAskCount()` call immediately after `buildAndSave` in askStreaming
- Removed unused `classifyAndAnchor` from imports in both files

### Task 2: AskScreen inline banner + send button disable
- **Commit:** 8a3cbfa4
- Added `getRateLimitStatus` and `RateLimitStatus` imports from ask-rate-limiter service
- Added `rateLimitStatus` state with lazy initializer reading settings at mount
- Added `refreshRateLimit` callback called after each handleSend completes
- Rendered inline banner above ChatInput when `nearLimit` is true:
  - Warning style (yellow) when approaching limit with count/total display
  - Error style (red) when limit reached
- Updated ChatInput `disabled` prop to include `!rateLimitStatus.canAsk`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compiles with zero errors (npx tsc --noEmit)
- Both classifyAndAnchor call sites now use classifyAndAnchorIncremental
- Rate limit guard active in askStreaming
- AskScreen banner renders conditionally based on nearLimit
- Send button disabled when monthly limit reached

## Known Stubs

None. All functionality is fully wired.

## Self-Check: PASSED
