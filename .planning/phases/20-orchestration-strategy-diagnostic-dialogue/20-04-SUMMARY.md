---
phase: 20-orchestration-strategy-diagnostic-dialogue
plan: "04"
subsystem: planner-ui
tags: [portal-card, diagnostic-chat, planner, ui-integration, multi-turn]
dependency_graph:
  requires: [diagnosticDialogueService from Plan 02, StrategyHints from Plan 01, rankConcepts from Plan 03, moveNavigator from Phase 12]
  provides: [PortalCard, PortalCardData, buildPortalData, DiagnosticChat, PlannerScreen portal+dialogue integration]
  affects: [PlannerScreen, planner UX, check-in flow]
tech_stack:
  added: []
  patterns: [portal card aggregation, multi-turn diagnostic chat UI, single-shot check-in with optional dialogue]
key_files:
  created:
    - app/src/components/PortalCard.tsx
    - app/src/components/DiagnosticChat.tsx
    - app/tests/services/portal-card.test.mjs
  modified:
    - app/src/screens/PlannerScreen.tsx
    - app/src/state/usePlanner.ts
decisions:
  - "PortalCard reads localStorage directly for post counts (avoids circular dependency with conceptFeedService)"
  - "DiagnosticChat auto-scrolls to bottom on new turns via useRef + scrollIntoView"
  - "Single-shot check-in preserved with optional dialogue — user can submit without multi-turn"
  - "buildPortalData is a synchronous function that aggregates counts from flashcardService, questionService, and localStorage"
metrics:
  completed: "2026-04-06"
  tasks_completed: 4
  tasks_total: 4
  test_count: 10
  test_pass: 10
---

# Phase 20 Plan 04: PortalCard + DiagnosticChat UI Integration Summary

Portal cards replacing flat MoveCard/ChunkCard suggestions on PlannerScreen with content type indicators (posts/flashcards/questions counts), plus multi-turn diagnostic chat UI for check-in area with Reply/Done flow.

## Completed Tasks

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | PortalCard component with buildPortalData and tests (TDD) | 150e0033 | PortalCard.tsx, portal-card.test.mjs |
| 2 | DiagnosticChat component | f64fde94 | DiagnosticChat.tsx |
| 3 | Wire PortalCard + DiagnosticChat into PlannerScreen | 3b9e3c74 | PlannerScreen.tsx |
| 4 | Visual verification + fix | f4b9cf4e | PlannerScreen.tsx, PortalCard.tsx |

## Implementation Details

### Task 1: PortalCard Component with Tests (TDD)

Created `app/src/components/PortalCard.tsx` (284 lines) exporting:
- **PortalCardData interface** — conceptId, title, description, relatedPosts, relatedFlashcards, relatedQuestions, primaryAction, move
- **buildPortalData(conceptId, title, reason)** — synchronous aggregation function counting related flashcards (via flashcardService.getAll filtered by nodeId), related questions (via questionService.getAll filtered by id/relatedQuestionIds), and related posts (from localStorage echolearn_daily_posts filtered by sourceQuestionIds)
- **PortalCard component** — renders card with border-left color from MOVE_TYPE_CONFIG, topic title + relevance badge, description, 3 tappable content type indicators (BookOpen for flashcards, FileText for posts, HelpCircle for questions) with counts, primary CTA button, and Skip option

Tests: 10 test cases in `app/tests/services/portal-card.test.mjs` covering buildPortalData count aggregation, zero-count edge case, PortalCardData shape validation, and post count from localStorage.

### Task 2: DiagnosticChat Component

Created `app/src/components/DiagnosticChat.tsx` (185 lines) exporting:
- **DiagnosticChat component** — multi-turn conversation thread UI with:
  - Chat bubbles for user turns (right-aligned, primary-40 background) and assistant turns (left-aligned, surface-variant background)
  - Auto-scroll to bottom on new turns via useRef + scrollIntoView
  - Text input + Reply button + Done button (when session active and user turns < 3)
  - "Thinking..." indicator when isProcessing is true
  - Auto-complete when max turns reached

Props: session (DiagnosticSession), onReply, onDone, isProcessing.

### Task 3: PlannerScreen Integration

Modified `app/src/screens/PlannerScreen.tsx` to:
- Replace MoveCard imports with PortalCard + buildPortalData imports
- Add DiagnosticChat import and diagnosticDialogueService import
- Add diagnosticSession state + isDialogueProcessing state
- Render PortalCard in auto-moves section instead of MoveCard, calling buildPortalData for each move
- Add handleDialogueReply callback (processReply -> generateFollowUp loop)
- Add handleDialogueDone callback (finalize session -> submitCheckIn with merged text -> toast)
- Conditional render: DiagnosticChat when session active, otherwise existing textarea

### Task 4: Post-verification Fix

Commit f4b9cf4e fixed single-shot check-in to work alongside optional diagnostic dialogue and fixed flashcard scroll behavior.

## Deviations from Plan

**1. [Rule 1 - Bug] Single-shot check-in fix**
- **Found during:** Task 4 (human verification)
- **Issue:** Check-in flow needed to support both single-shot submit and multi-turn dialogue
- **Fix:** Preserved single-shot path; dialogue is optional
- **Commit:** f4b9cf4e

## Known Stubs

None.

## Verification

- All 10 portal-card tests passing
- TypeScript compiles without errors
- PortalCard renders on PlannerScreen with content type counts
- DiagnosticChat renders conversation within check-in area
- Navigation from content type indicators routes to correct screens

## Self-Check: PASSED
