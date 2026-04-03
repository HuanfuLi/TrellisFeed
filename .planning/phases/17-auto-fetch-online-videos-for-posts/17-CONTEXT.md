# Phase 17: Auto-fetch Online Videos for Posts - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-search YouTube for educational videos based on concepts due for review (SM-2 schedule), and present them as a new video post type in the feed. Video posts mix into the existing feed alongside AI-generated posts. Detail page shows embedded YouTube player + AI-generated summary from transcript.

</domain>

<decisions>
## Implementation Decisions

### Video Discovery
- **D-01:** Auto-search YouTube based on concepts due for review today, using the same SM-2 spaced repetition schedule that drives flashcard review. Reuse existing review scheduling logic.
- **D-02:** Use YouTube Data API v3 (free tier: 10,000 quota units/day) for search queries derived from due concepts.
- **D-03:** Generate 3 video posts per day on initial load. When user pulls for more, generate 4 additional video posts each time.
- **D-04:** Video posts mix into the existing feed alongside AI-generated posts (not a separate section).

### In-App Video Playback
- **D-05:** Embed YouTube videos via iframe (`https://www.youtube.com/embed/{videoId}`). Works in Capacitor WebView on native — no native SDK needed.

### Post Type & UX
- **D-06:** New post form: appears in feed like a regular post (thumbnail + title), but detail page shows embedded YouTube video player on top + AI-generated summary below.
- **D-07:** Add new `sourceType: 'video'` to the `PostSnapshot` type.
- **D-08:** Use YouTube thumbnail as the card image in the feed — no AI image generation for video posts.

### Content Extraction
- **D-09:** Generate summary from video transcript via YouTube captions/transcript API.
- **D-10:** Use AI (existing chatCompletion) to summarize the transcript into a concise educational summary for the detail page.

### Claude's Discretion
- YouTube API key storage (likely reuse existing settings pattern in mockSettingsService)
- Transcript extraction method (YouTube captions API vs third-party)
- How to handle videos with no available transcript (fallback to title+description summary, or skip)
- Feed interleaving strategy (how video posts are ordered among AI posts)
- VideoPost detail screen layout specifics

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Post System
- `app/src/types/index.ts` — `PostSnapshot`, `DailyPost`, `PostOriginContext`, `sourceType` union
- `app/src/services/concept-feed.service.ts` — Daily post generation, `getDailyPosts()`, `generateMorePosts()`, feed caching
- `app/src/screens/HomeScreen.tsx` — Feed rendering with ConceptCard
- `app/src/screens/PostDetailScreen.tsx` — Post detail page (will need video variant)
- `app/src/services/postFormatting.service.ts` — `inferImageStyle()`, `buildImagePrompt()` (skip for video posts)

### Spaced Repetition / Review Schedule
- `app/src/services/mock/review.mock.ts` — SM-2 scheduling, due items calculation
- `app/src/state/useReview.ts` — Review state hook, exposes due items
- `app/src/services/flashcard.service.ts` — FlashCard storage, review scheduling (reuse due-date logic)

### Image & Feed Infrastructure
- `app/src/services/imageGeneration.service.ts` — Image cache (video posts use thumbnail instead)
- `app/src/services/imageGeneration.bootstrap.ts` — Provider initialization
- `app/src/providers/llm/index.ts` — `chatCompletion` for transcript summarization (tag with serviceName: 'video-summary')

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- SM-2 review scheduling in `review.mock.ts` — can derive "concepts due today" for YouTube search queries
- `concept-feed.service.ts` `getDailyPosts()` / `generateMorePosts()` — pattern for daily generation + pull-for-more
- `DailyPost` type with `sourceType` union — extend with `'video'`
- `chatCompletion` with `serviceName` option — reuse for transcript summarization
- Feed caching in localStorage via `loadCache()` / `saveCache()` — video posts can follow same pattern

### Established Patterns
- `ServiceResult<T>` for all service returns
- `mockSettingsService` for localStorage-based settings (YouTube API key storage)
- `eventBus` for cross-component communication
- Image-forward feed cards with `ConceptCard` component

### Integration Points
- `HomeScreen.tsx` feed rendering — needs to handle `sourceType: 'video'` cards (thumbnail instead of AI image)
- `PostDetailScreen.tsx` — needs video variant with embedded player
- `concept-feed.service.ts` — needs to interleave video posts with AI posts
- New YouTube service for search + transcript fetching

</code_context>

<specifics>
## Specific Ideas

- Video posts should feel native in the feed — same card style but with a play icon overlay on the thumbnail to signal it's a video.
- The pull-for-more pattern (4 additional video posts) should match the existing infinite scroll behavior.
- Transcript summarization should use the same LLM provider the user has configured, tagged with `serviceName: 'video-summary'` for token monitoring.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-auto-fetch-online-videos-for-posts*
*Context gathered: 2026-04-02*
