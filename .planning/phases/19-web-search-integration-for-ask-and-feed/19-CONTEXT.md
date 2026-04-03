# Phase 19: Web Search Integration for Ask and Feed - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add web search capability to the Ask screen LLM (tool-use pattern with manual globe toggle) and to the Home feed (enriched AI posts + new "News" post type with daily background fetch). Responses include inline citations with collapsible sources.

</domain>

<decisions>
## Implementation Decisions

### Ask Screen — LLM Web Search
- **D-01:** Tool-use pattern — LLM receives a `web_search` tool definition in its system prompt. It decides autonomously when a question needs real-time information (e.g., "latest on X", "current best practice for Y"). No keyword heuristics or always-search.
- **D-02:** Globe toggle icon next to the send button in ChatInput. When active, the next message always includes web search results regardless of whether the LLM would have invoked the tool.
- **D-03:** Globe toggle is sticky — stays on for all subsequent messages in the session until user explicitly taps it off.
- **D-04:** Inline citations in response text — small numbered links [1][2][3] within the LLM response. A collapsible "Sources" section at the bottom of the message shows full URLs and titles for each citation.
- **D-05:** Search provider at Claude's discretion — pick whichever works well (Brave Search API, Exa, or similar). Free tier preferred.

### Home Feed — Web-Enriched Posts
- **D-06:** Two modes of web integration: (1) Enriched AI posts — existing concept posts get web-searched context appended during generation, making them more current/factual. (2) New "News" post type — a distinct post category that's purely web-sourced, showing trending topics and recent developments related to user's learning concepts.
- **D-07:** Periodic background fetch — separate from main post generation. Fetches news/updates for user's learning concepts on a schedule, creates posts from interesting findings.
- **D-08:** Daily fetch, 2-3 news posts per day. Fetched once per day alongside daily post generation. Small batch to keep it fresh without flooding the feed.

### News Post Visual Treatment
- **D-09:** Newspaper style — headline-forward card with subtle newsprint texture or serif font treatment. Source attribution visible on the card face. Distinct from regular AI posts.

### Claude's Discretion
- Web search API provider selection and configuration
- How to structure the `web_search` tool definition for the LLM
- Citation extraction approach (LLM generates citations vs post-processing)
- How enriched AI posts blend web context into their narrative
- News post background fetch scheduling mechanism (timer, app lifecycle, etc.)
- Newsprint texture CSS implementation (font choice, background pattern)
- How to handle search API failures/rate limits gracefully
- News post data model (extend DailyPost or new type)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ask Screen / Chat System
- `app/src/screens/AskScreen.tsx` — Chat UI, session management, streaming responses
- `app/src/components/ChatInput.tsx` — Message input component (add globe toggle here)
- `app/src/components/ChatMessage.tsx` — Message rendering (add citation display here)
- `app/src/state/useQuestions.ts` — `askStreaming()` function, LLM call orchestration
- `app/src/providers/llm/index.ts` — `chatCompletion()`, `streamChatCompletion()` — tool-use support

### Feed System
- `app/src/services/concept-feed.service.ts` — Daily post generation, feed mix, caching
- `app/src/components/InfoFlow.tsx` — `ConceptCard` rendering (add news card variant)
- `app/src/types/index.ts` — `DailyPost`, `PostSnapshot`, `sourceType` union, `PresentationStyle`
- `app/src/screens/HomeScreen.tsx` — Feed rendering, pull-to-load

### Settings & Services
- `app/src/services/mock/settings.mock.ts` — localStorage settings pattern
- `app/src/screens/SettingsScreen.tsx` — Settings UI
- `app/src/services/youtube.service.ts` — Reference pattern for background content fetching + caching

### Phase 18 Context (feed mix)
- `.planning/phases/18-feed-redesign-short-videos-text-art-posts/18-CONTEXT.md` — Feed mix strategy, weighted random, presentation styles

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chatCompletion` / `streamChatCompletion` in `providers/llm/index.ts` — May already support tool definitions depending on provider
- `concept-feed.service.ts` feed mix — Phase 18 adds weighted random mix; news posts integrate into same system
- `youtubeService` background fetch pattern — Reference for how to do periodic background content fetching with caching
- `mockSettingsService` localStorage pattern — For storing web search API key and preferences
- `eventBus` — For notifying feed of new background-fetched news posts

### Established Patterns
- `ServiceResult<T>` for all service returns
- `sourceType` union on `PostSnapshot` — extend with `'news'`
- `PresentationStyle` (added in Phase 18) — add `'news'` variant
- Streaming responses in AskScreen via `streamChatCompletion`

### Integration Points
- `ChatInput.tsx` — Add globe toggle icon
- `ChatMessage.tsx` — Add citation rendering with collapsible sources
- `useQuestions.ts` `askStreaming()` — Add web search tool and result injection
- `concept-feed.service.ts` — Add news post generation and feed integration
- `InfoFlow.tsx` `ConceptCard` — Add news card visual variant

</code_context>

<specifics>
## Specific Ideas

- The globe toggle should feel like a simple on/off — not a complex UI. Small icon that lights up when active.
- Citations should be unobtrusive — small superscript numbers that don't break reading flow. Sources section collapsed by default.
- News posts should feel like a morning newspaper digest — curated, headline-focused, authoritative.
- Background fetch should not block app startup or feed loading — fire-and-forget like video post generation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-web-search-integration-for-ask-and-feed*
*Context gathered: 2026-04-03*
