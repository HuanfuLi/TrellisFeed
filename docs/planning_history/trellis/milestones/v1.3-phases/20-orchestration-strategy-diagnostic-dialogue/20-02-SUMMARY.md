---
phase: 20-orchestration-strategy-diagnostic-dialogue
plan: 02
subsystem: diagnostic-dialogue
tags: [service, llm, localStorage, multi-turn, signals]
dependency_graph:
  requires: []
  provides: [diagnosticDialogueService, DialogueTurn, DiagnosticSession]
  affects: [planner.service.ts (pattern reuse)]
tech_stack:
  added: []
  patterns: [multi-turn session management, incremental signal merging, localStorage persistence]
key_files:
  created:
    - app/src/services/diagnostic-dialogue.service.ts
    - app/tests/services/diagnostic-dialogue.test.mjs
  modified: []
decisions:
  - Duplicated heuristicExtractSignals, mergeSignals, extractSignals from planner.service.ts (~80 lines) since they are private helpers; shared extraction is out of scope for this phase
  - Follow-up prompt uses system-only message (no user message in chatCompletion call) for cleaner coach persona
metrics:
  duration: 151s
  completed: "2026-04-05T06:20:27Z"
  tasks_completed: 1
  tasks_total: 1
  tests_passed: 9
  tests_total: 9
---

# Phase 20 Plan 02: Diagnostic Dialogue Service Summary

Multi-turn Socratic diagnostic dialogue service with incremental signal merging, 3-turn cap, and localStorage persistence using heuristic + LLM signal extraction.

## What Was Built

The `diagnosticDialogueService` manages the full lifecycle of a diagnostic check-in conversation:

1. **startSession** - Creates a session from initial check-in text, extracts confusion/curiosity/confidence signals via heuristic parsing + LLM fallback
2. **generateFollowUp** - Builds a coaching prompt from merged signals and calls chatCompletion to generate a targeted follow-up question
3. **processReply** - Extracts signals from user reply, merges incrementally with existing session signals, auto-finalizes at 3 user turns
4. **finalize** - Marks session completed and clears localStorage
5. **getActiveSession / clearSession** - localStorage persistence for navigation survival

### Key Implementation Details

- Signal extraction duplicates planner.service.ts patterns (heuristicExtractSignals, mergeSignals, extractSignals) since those are private helpers
- MAX_TURNS = 3 enforces session cap (initial + 2 follow-ups)
- All LLM calls tagged with `serviceName: 'diagnostic'` for token tracking
- Session stored at `echolearn_diagnostic_session` localStorage key

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d166ff7c | test | Add 9 failing tests for diagnostic dialogue service |
| c971088d | feat | Implement diagnostic dialogue service |

## Test Results

All 9 tests passing:
- startSession creates session with initial turn and extracted signals
- startSession sets status to active with populated mergedSignals
- generateFollowUp returns non-empty string referencing confusion/curiosity
- processReply adds user turn, re-extracts signals, merges with existing
- processReply increments turn count correctly
- Session capped at 3 user turns with auto-finalization
- finalize sets completed status and clears localStorage
- Active session persists to and loads from localStorage
- Signals merge incrementally (DIAG-03) across turns

No regression on plannerAutoGen tests (8/8 passing).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all service methods are fully implemented with real logic.
