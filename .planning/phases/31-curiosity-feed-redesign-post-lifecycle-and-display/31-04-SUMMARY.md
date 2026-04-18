---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 04
subsystem: feed-ui
tags: [suggestion-card, infoflow, ask-navigation]
dependency_graph:
  requires: [31-01]
  provides: [SuggestionCard, autoSend-navigation]
  affects: [InfoFlow, AskScreen]
tech_stack:
  added: []
  patterns: [early-return-post-type, location-state-auto-send]
key_files:
  created:
    - app/src/components/SuggestionCard.tsx
  modified:
    - app/src/components/InfoFlow.tsx
    - app/src/screens/AskScreen.tsx
decisions:
  - "D-23/D-26: Suggestion card body is non-interactive; only topic buttons have click handlers"
  - "D-25: Topic tap navigates to /ask with state.autoSend, reusing existing auto-send pattern"
  - "Extended AskScreen location.state to accept autoSend alongside existing prompt key"
metrics:
  duration: 84s
  completed: "2026-04-18T01:33:49Z"
---

# Phase 31 Plan 04: SuggestionCard Component and InfoFlow Integration Summary

SuggestionCard renders 3 tappable topic suggestions with Sparkles header and ChevronRight arrows; tapping navigates to Ask with auto-send via location.state.autoSend.

## What Was Done

### Task 1: Create SuggestionCard component
- Created `app/src/components/SuggestionCard.tsx` with Sparkles icon header, i18n title (`home.feed.suggestionTitle`), and 3 topic buttons
- Each button has minHeight 48px, surface-variant background, ChevronRight icon
- Tap calls `navigate('/ask', { state: { autoSend: topic } })`
- Card body div has no onClick (D-26 compliance)
- **Commit:** `aa65eeb5`

### Task 2: Wire SuggestionCard into InfoFlow + handle autoSend in AskScreen
- Added early return in `ConceptCard` for `sourceType === 'suggestion'` before image generation logic
- Imported `SuggestionCard` in InfoFlow.tsx
- Extended AskScreen's existing `location.state` handling to accept `autoSend` alongside `prompt`
- Reused the existing `lastAutoPrompt` dedup pattern for both state keys
- **Commit:** `69f9e50e`

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Vite build: PASSED (2.95s)
- `SuggestionCard` import in InfoFlow: present
- `sourceType === 'suggestion'` in InfoFlow: present
- `autoSend` in AskScreen: present

## Known Stubs

None. All data flows are wired to real navigation and existing i18n keys.

## Self-Check: PASSED
