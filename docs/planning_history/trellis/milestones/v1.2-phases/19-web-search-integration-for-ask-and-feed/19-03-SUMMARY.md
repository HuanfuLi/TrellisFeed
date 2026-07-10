---
phase: 19-web-search-integration-for-ask-and-feed
plan: 03
subsystem: feed-news-integration
tags: [web-search, news, feed, tavily, llm]
dependency_graph:
  requires: [19-01]
  provides: [news-service, web-enriched-posts, news-feed-interleaving]
  affects: [concept-feed-service, daily-post-types]
tech_stack:
  added: []
  patterns: [fire-and-forget-background-fetch, localStorage-date-cache, news-interleaving]
key_files:
  created:
    - app/src/services/news.service.ts
  modified:
    - app/src/services/concept-feed.service.ts
    - app/src/types/index.ts
decisions:
  - "News service uses same fire-and-forget + localStorage cache pattern as youtube.service.ts"
  - "Web enrichment is best-effort: search failure silently skipped, LLM prompt unaffected"
  - "News posts interleaved every 3rd position in feed, not appended"
  - "NEWS_POSTS_READY event added to AppEvent for future UI reactivity"
metrics:
  duration: "5m 37s"
  completed: "2026-04-05"
  tasks_completed: 2
  tasks_total: 2
requirements: [NEWS-01, NEWS-02, NEWS-03]
---

# Phase 19 Plan 03: News Service & Feed Web Integration Summary

News service generates 2-3 daily news posts from Tavily news search + LLM summarization, cached in localStorage with fire-and-forget background fetch matching the youtube.service.ts pattern. AI posts enriched with web context during generation for more current/factual content.

## What Was Done

### Task 1: Create news.service.ts (914711dd)

Created `app/src/services/news.service.ts` with:

- **getCachedNewsPosts()**: Reads today's cached news posts from localStorage (`echolearn_news_posts`), returns empty array if stale
- **generateNewsPosts(count?)**: Full pipeline: extract user's top 3 learning concepts from recent questions, search Tavily with `topic: 'news'`, deduplicate by URL, LLM-summarize each result into a DailyPost with `sourceType: 'news'`, `presentationStyle: 'news'`, and `newsMeta` with source citations
- Domain extraction helper for contextLabel (e.g., "nytimes.com")
- Added `NEWS_POSTS_READY` event to `AppEvent` union type for future UI reactivity
- Graceful degradation: returns empty array when Tavily API key not configured, LLM not set up, or no questions exist

### Task 2: Enrich AI posts with web context and integrate news (5a5e017a)

Modified `app/src/services/concept-feed.service.ts`:

- **Web enrichment (NEWS-01)**: Before the LLM call in `generateDailyPostsWithLLM`, searches Tavily for the primary concept's latest research findings and appends web context to the user prompt. Best-effort: search failures silently ignored.
- **Background news generation (NEWS-03)**: `_backgroundGenerateNews()` function follows the same fire-and-forget pattern as `_backgroundGenerateVideos()`. Called at all 3 return paths in `getDailyPosts`.
- **News interleaving (NEWS-02)**: `interleaveNewsPosts()` inserts a news post after every 3rd feed post, remaining appended at end. Applied at all 3 return paths in `getDailyPosts`.
- Added `'news'` to `VALID_SOURCE_TYPES` set for cache validation.
- Imported `newsService` and `webSearch`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data paths are fully wired.

## Verification

- `npx tsc --noEmit` passes with zero errors
- All acceptance criteria grep checks pass for both tasks
- `_backgroundGenerateNews()` appears 4 times (1 definition + 3 call sites)
