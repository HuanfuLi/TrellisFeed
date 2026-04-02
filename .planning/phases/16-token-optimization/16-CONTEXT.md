# Phase 16: Token Optimization - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce LLM token consumption and add token usage monitoring across all services. The primary change is restructuring the Question Answering flow to use append-only session history (enabling KV-cache hits). Secondary: add a pluggable token monitoring system in Settings > Developer.

</domain>

<decisions>
## Implementation Decisions

### Question Answering — Session History (Major Change)
- **D-01:** Restructure `askStreaming` (in `useQuestions.ts`) and `ask` (in `question.service.ts`) to send the full session chat history as an append-only message array instead of a single user message. Format: `[system, user1, assistant1, user2, assistant2, ..., userN]`.
- **D-02:** Remove the "3 recent global Q&As stuffed into system prompt" hack — the real session history replaces it. The knowledge graph candidate context in the system prompt stays.
- **D-03:** Session message history is already available via `sessionService` and `AskScreen` state — wire it through to the LLM call. No new storage needed.
- **D-04:** This enables provider-side KV-cache (OpenAI, Claude, Gemini all support prefix caching) — cached input tokens are 50-90% cheaper and faster. Also improves answer quality since the LLM sees real conversation flow.

### Prompt Trimming
- **D-05:** All 13 existing system prompts are fine as-is. No trimming needed. Only the Question Answering flow changes structurally (D-01 through D-04).

### maxTokens Tuning
- **D-06:** Leave `maxTokens` defaults as-is (4096 everywhere, 8192 for reorganization). maxTokens is a ceiling — providers charge for tokens actually generated, not the cap. Keeping current values provides robustness against runaway responses.

### Token Usage Monitoring
- **D-07:** Add a token usage tracker in Settings > Developer section. Per-service breakdown (Ask, Posts, Planner, Classification, Podcast, Flashcards, etc.).
- **D-08:** Parse `usage.prompt_tokens` and `usage.completion_tokens` from API responses (OpenAI, Claude, Gemini all return these). Do not use client-side estimation.
- **D-09:** Design the monitoring module as a pluggable service so it can later be swapped to report to a remote server in a future milestone. Local storage for now, but the interface should be remote-ready (e.g., a `TokenUsageReporter` interface with a `LocalTokenUsageReporter` implementation).

### Claude's Discretion
- Token usage storage format (localStorage key structure, aggregation granularity)
- How to surface per-service breakdown in the Developer UI (table, chart, etc.)
- How to extract usage data from each provider's response format (implementation detail)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Key Implementation Files
- `app/src/state/useQuestions.ts` — `askStreaming()` method, primary target for session history change
- `app/src/services/question.service.ts` — `ask()` method, non-streaming fallback
- `app/src/providers/llm/index.ts` — `chatCompletion()` and `chatStream()`, where usage data must be captured
- `app/src/services/session.service.ts` — `ChatSession` CRUD, already stores full message history
- `app/src/screens/AskScreen.tsx` — Wires askStreaming, has session state
- `app/src/screens/SettingsScreen.tsx` — Where Developer section with monitoring UI will live

### All LLM Call Sites (13 total — only #1 changes)
1. `app/src/state/useQuestions.ts` — askStreaming (**CHANGE: session history**)
2. `app/src/services/question.service.ts:205` — ask (non-streaming fallback, same change)
3. `app/src/services/question-filter.service.ts:75` — isOffTopicByLLM
4. `app/src/services/canonical-knowledge.service.ts:446` — classifyAndAnchor
5. `app/src/services/canonical-knowledge.service.ts:944` — reorganization
6. `app/src/services/concept-feed.service.ts:550` — daily post generation
7. `app/src/services/concept-feed.service.ts:715` — more posts generation
8. `app/src/services/concept-feed.service.ts:804` — connection post streaming
9. `app/src/services/concept-feed.service.ts:921` — discover post streaming
10. `app/src/services/planner.service.ts:261` — signal extraction
11. `app/src/services/planner.service.ts:369` — discover title generation
12. `app/src/services/podcast.service.ts:203` — podcast script
13. `app/src/services/flashcard.service.ts:203` — flashcard extraction
14. `app/src/services/post-context-qa.service.ts:52` — post context Q&A streaming

### Image Generation (no changes)
- `app/src/providers/gemini.provider.ts` — Already uses 512px (lowest resolution)
- `app/src/services/postFormatting.service.ts` — Image prompt builder, compact already

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sessionService` (`src/services/session.service.ts`): Already stores full `ChatSession` with `SessionMessage[]` — can be wired directly to LLM calls
- `chatCompletion` / `chatStream` (`src/providers/llm/index.ts`): Central routing layer — ideal place to intercept API responses for usage data extraction
- `mockSettingsService` (`src/services/mock/settings.mock.ts`): localStorage-based settings persistence — monitoring data can follow the same pattern

### Established Patterns
- `ServiceResult<T>` pattern used across all services — monitoring service should follow this
- `eventBus` pub/sub used for cross-component communication — can emit token usage events
- Provider-specific response parsing already exists in `chatCompletion` / `chatStream` — extend to extract `usage` field

### Integration Points
- `chatCompletion()` / `chatStream()` return values need to carry usage metadata alongside content
- `SettingsScreen.tsx` already has sections — add Developer section for monitoring UI
- `askStreaming` in `useQuestions.ts` currently constructs messages inline — needs session history passed in

</code_context>

<specifics>
## Specific Ideas

- Token monitoring should be designed as plug-and-play: local storage now, remote server later. Use an interface/abstraction so the swap is trivial.
- Per-service granularity: each LLM call site should tag its service name when reporting usage.
- The append-only session history approach should just pass the `SessionMessage[]` from the active session — no need to reconstruct from global Q&A store.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-token-optimization*
*Context gathered: 2026-04-01*
