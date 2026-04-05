---
phase: 19-web-search-integration-for-ask-and-feed
plan: 04
status: complete
---

## Summary

Implemented newspaper-style news cards in InfoFlow, Tavily API key settings, and news post detail rendering. Visual checkpoint revealed four UX issues that were fixed inline:

1. **Web search streaming** — tool-call pattern (`[TOOL:web_search]`) no longer leaks to user; "Searching the web..." shown inline below Pass 1 text
2. **Citation styling** — inline `[N]` tags rendered as muted superscript; sources always visible below response (not collapsed); extraction handles multiple LLM output formats
3. **AskScreen persistence** — always mounted like HomeScreen; session, streaming state, and scroll position preserved across navigation
4. **Feed refresh timing** — delayed re-fetch after new questions ensures posts appear without manual pull

## Key Files

### Created
- `.planning/phases/19-web-search-integration-for-ask-and-feed/19-04-SUMMARY.md`

### Modified
- `app/src/App.tsx` — AskScreen always mounted with display toggle
- `app/src/components/ChatMessage.tsx` — citation tag styling, always-visible sources section
- `app/src/components/Markdown.tsx` — added rehype-raw for inline HTML citation tags
- `app/src/screens/AskScreen.tsx` — persistent mount support, auto-send prompt fix
- `app/src/screens/HomeScreen.tsx` — delayed feed re-fetch after question changes
- `app/src/services/web-search.service.ts` — lenient multi-format source extraction
- `app/src/state/useQuestions.ts` — tool pattern stripping during stream, inline search indicator
- `app/src/components/InfoFlow.tsx` — newspaper-style news card
- `app/src/screens/SettingsScreen.tsx` — Tavily API key field
- `app/src/screens/PostDetailScreen.tsx` — news post detail rendering

## Deviations

- Added `rehype-raw` dependency to support HTML `<sup>` citation tags in Markdown
- Sources section changed from collapsible to always-visible (user feedback)
- AskScreen made persistent (user-requested, beyond original plan scope)
