---
phase: 19-web-search-integration-for-ask-and-feed
plan: 02
subsystem: ask-screen
tags: [web-search, tool-use, citations, streaming, globe-toggle]
dependency_graph:
  requires: [19-01]
  provides: [askStreaming-web-search, globe-toggle, citation-rendering]
  affects: [useQuestions, ChatInput, ChatMessage, AskScreen]
tech_stack:
  added: []
  patterns: [two-pass-tool-use, citation-extraction, collapsible-sources]
key_files:
  created: []
  modified:
    - app/src/state/useQuestions.ts
    - app/src/components/ChatInput.tsx
    - app/src/components/ChatMessage.tsx
    - app/src/screens/AskScreen.tsx
decisions:
  - WEB_SEARCH_TOOL_PROMPT appended to system prompt in all askStreaming calls (not conditional)
  - Two-pass pattern streams first response then checks for TOOL marker or forced globe toggle
  - Globe toggle placed between Mic and input field for easy thumb access
  - webSearchEnabled added to generateAiReply dependency array to avoid stale closure
  - SourcesSection uses IIFE in render to extract citations per-message
metrics:
  duration: 4m16s
  completed: "2026-04-05T04:42:25Z"
  tasks: 2
  files_modified: 4
---

# Phase 19 Plan 02: Ask Screen Web Search Integration Summary

Two-pass tool-use streaming with globe toggle and collapsible citation sources in Ask screen.

## What Was Done

### Task 1: Two-pass tool-use in askStreaming and globe toggle in ChatInput (a50e0bf9)

- Added `WEB_SEARCH_TOOL_PROMPT` and `TOOL_PATTERN` constants to `useQuestions.ts`
- Extended `askStreaming` signature with optional `webSearchEnabled` parameter
- Implemented two-pass logic: Pass 1 streams normal LLM response, detects `[TOOL:web_search]` marker or checks globe toggle. If search needed, shows "Searching the web..." indicator, calls Tavily via `webSearch()`, then Pass 2 re-prompts LLM with search context and citation instructions
- Added `Globe` toggle button to `ChatInput.tsx` between Mic button and text input, using same styling pattern (34px circle, primary-40 when active)
- Added `webSearchEnabled` sticky state in `AskScreen.tsx`, passed to both `ChatInput` and `askStreaming`

### Task 2: Inline citation rendering with collapsible Sources in ChatMessage (2ca2f66a)

- Created `SourcesSection` component with Globe icon, source count, and expand/collapse arrow
- Replaced direct `<Markdown>{content}</Markdown>` with citation-aware rendering via `extractCitations(content)` that strips the Sources block from body and renders it as a clean collapsible UI
- Sources collapsed by default with "N sources" label; expanded shows clickable links opening in new tab
- Inline `[1][2]` references remain in Markdown body as natural bracketed numbers

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Tool prompt always in system prompt:** `WEB_SEARCH_TOOL_PROMPT` is appended unconditionally so the LLM can autonomously decide to search even without globe toggle
2. **Globe toggle between Mic and input:** Placed for thumb-reachable access on mobile
3. **webSearchEnabled in generateAiReply deps:** Added to useCallback dependency array to prevent stale closure when toggle state changes between messages
4. **IIFE citation extraction:** Used inline IIFE in ChatMessage render to keep extraction per-message without adding extra component layers

## Verification

- `tsc --noEmit` passes with zero errors
- All acceptance criteria grep patterns confirmed present in target files

## Known Stubs

None - all functionality is fully wired to Plan 01's web-search.service.ts.

## Self-Check: PASSED
