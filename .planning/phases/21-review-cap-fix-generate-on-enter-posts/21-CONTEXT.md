# Phase 21: Review Cap Fix & Generate-on-Enter Posts - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Source:** In-conversation discussion

<domain>
## Phase Boundary

Two independent improvements delivered in one phase:

**Part A — Review Cap Fix:** Remove the hard `dailyLimit` cap from the flashcard review queue. Currently `review.service.ts:getTodayReviewItems()` applies `.slice(0, limit)` which hides due cards. Instead, show ALL due cards and repurpose the setting as a "daily goal" with a progress indicator.

**Part B — Generate-on-Enter Posts:** Rework post generation so that batch feed generation only produces card-face fields (title, teaser, keywords). The essay body (`bodyMarkdown`, `whyCare`, `takeaway`, `quickAskPrompts`) is generated on-demand when the user opens a post, streamed into a pre-built UI shell. This saves tokens (only posts the user opens get essays) and dramatically reduces feed load time.

</domain>

<decisions>
## Implementation Decisions

### Review Cap (Part A)
- Remove `.slice(0, limit)` from `review.service.ts:getTodayReviewItems()` — return ALL due cards
- `getTodayReviewCount()` reflects true due count (flows to Home/Planner badges automatically)
- Rename setting label from "Daily Limit" / "Max cards per day" to "Daily Goal"
- Raise default from 20 to 50
- Add daily goal progress bar in ReviewScreen (e.g., "12/20 reviewed today")
- Planner system already sees all knowledge nodes — no changes needed there
- Trajectory analyzer already accesses flashcardService directly — no changes needed

### Post Generation Rework (Part B)
- **Card-face-only batch generation:** Strip `bodyMarkdown` from the batch LLM call in `concept-feed.service.ts`. The generation prompt should only request: title, teaserHook, teaserPreview, keywords, contextLabel, sourceType, narrativeMode, sourceQuestionIds
- **On-enter streaming LLM call:** When user opens PostDetailScreen, make a new streaming LLM call with params: the concept/QA linked to that post, the heading/hook of the post. Stream `bodyMarkdown`, `whyCare`, `takeaway`, `quickAskPrompts` into the pre-built UI shell.
- **Pre-built UI shell (CRITICAL):** Render the complete detail page layout BEFORE any LLM content arrives — heading container, essay body container, follow-up section all pre-built with proper layout. Incomplete/streaming LLM response must NEVER damage the layout. Previous on-demand LLM calls suffered from UI render issues during streaming — this must be solved by building UI independent of LLM content and injecting streamed text into containers.
- **Caching:** Once essay is generated, cache it to localStorage/DB so re-visits are instant. All posts should persist.
- **Video posts:** Transcript fetch stays in background (uses Innertube scraping, zero YouTube API quota cost). LLM summary (serviceName: 'video-summary') deferred to on-enter streaming call. Params: transcript text + video title + description.
- **News posts:** Web search stays in background (gets raw results cached). LLM summary deferred to on-enter streaming call. Params: web search results + concept context.
- **Text-art posts:** Get a new detail page with vivid, story-focused or conversation-focused essay generated on-enter. More vivid than normal posts.
- **Error handling:** Show error state with retry button if on-enter LLM call fails. This is acceptable since failures should be rare.
- **Connection/Discover posts:** Already generate on-enter via streaming — no changes needed.

### Claude's Discretion
- Exact streaming UI implementation (skeleton, progressive reveal, etc.)
- Essay generation prompt design for on-enter calls
- Cache eviction strategy for generated essays
- How to pass post context (concept/QA, heading) to the on-enter LLM call
- Whether to use a single service function or post-type-specific functions for on-enter generation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Review System
- `app/src/services/review.service.ts` — Current dailyLimit enforcement (line 31-32)
- `app/src/state/useReview.ts` — Review hook exposing items and reviewCount
- `app/src/screens/ReviewScreen.tsx` — Review UI
- `app/src/screens/SettingsScreen.tsx` — Daily limit setting UI (lines 134, 976-1010)
- `app/src/services/settings.service.ts` — Default settings (dailyLimit: 20)
- `app/src/types/index.ts` — ReviewSettings interface (line 282-286)

### Post Generation System
- `app/src/services/concept-feed.service.ts` — Main feed generation, batch LLM call, all post types
- `app/src/screens/PostDetailScreen.tsx` — Post detail rendering, existing streaming patterns
- `app/src/types/index.ts` — PostSnapshot, DailyPost, FeedTeaser types
- `app/src/services/youtube.service.ts` — Video post generation, transcript fetch, summary LLM call
- `app/src/services/news.service.ts` — News post generation, web search + LLM summary
- `app/src/providers/llm/index.ts` — chatCompletion, chatStream providers

### Navigation & State
- `app/src/screens/HomeScreen.tsx` — Review count badge, feed display
- `app/src/screens/PlannerScreen.tsx` — Review count badge

</canonical_refs>

<specifics>
## Specific Ideas

- Feed should load in <3s with card-face-only generation
- First essay words visible in <1s when opening a post
- Daily goal progress: "12/20 reviewed today" format
- Text-art detail essays should be more vivid, story-focused or conversation-focused than normal posts
- UI shell must be fully rendered before LLM streaming begins — this is the #1 priority for Part B

</specifics>

<deferred>
## Deferred Ideas

- Backend API for pre-generating posts (future consideration for even faster feeds)
- Remote token usage tracking for generate-on-enter calls

</deferred>

---

*Phase: 21-review-cap-fix-generate-on-enter-posts*
*Context gathered: 2026-04-05 via in-conversation discussion*
