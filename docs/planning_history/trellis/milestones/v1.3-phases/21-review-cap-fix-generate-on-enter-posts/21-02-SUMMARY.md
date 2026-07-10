---
phase: 21-review-cap-fix-generate-on-enter-posts
plan: 02
subsystem: feed
tags: [llm, streaming, caching, deferred-generation, post-essay]

requires:
  - phase: 21-00
    provides: Phase context and research
provides:
  - Card-face-only batch prompt for fast feed loads
  - On-enter essay generation service (post-essay.service.ts)
  - Deferred video/news LLM summaries
  - Four-cache getPostById lookup
  - Four-cache patchPostEssayInCache
affects: [21-03, PostDetailScreen, concept-feed, youtube, news]

tech-stack:
  added: []
  patterns: [deferred-generation, streaming-essay, four-cache-lookup]

key-files:
  created:
    - app/src/services/post-essay.service.ts
  modified:
    - app/src/services/concept-feed.service.ts
    - app/src/services/youtube.service.ts
    - app/src/services/news.service.ts

key-decisions:
  - "Batch prompt requests only card-face fields (title, teaserHook, teaserPreview, narrativeMode, contextLabel, sourceType, sourceQuestionIds, keywords)"
  - "bodyMarkdown/whyCare/takeaway/quickAskPrompts deferred to on-enter generation via post-essay.service.ts"
  - "isValidDailyPost relaxed to accept undefined bodyMarkdown and no quickAskPrompts requirement"
  - "getPostById extended to check all four caches: main, video, news, shorts"
  - "Video and news batch generation sets bodyMarkdown to empty string, deferring LLM calls"
  - "chatCompletion import removed from news.service.ts (no longer used)"

patterns-established:
  - "Deferred essay generation: batch creates card-face only, essay streamed on post open"
  - "Four-cache pattern: main (echolearn_daily_posts), video (echolearn_video_cache), news (echolearn_news_posts), shorts (echolearn_short_posts)"
  - "patchPostEssayInCache early-returns on first cache hit for efficiency"

requirements-completed: [POST-01, POST-04, POST-05, POST-06]

duration: 3min
completed: 2026-04-05
---

# Phase 21 Plan 02: Deferred Essay Generation Summary

**Card-face-only batch feed generation with on-enter essay streaming via post-essay.service.ts, deferring video and news LLM summaries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T21:26:51Z
- **Completed:** 2026-04-05T21:30:20Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

### Task 1: Strip bodyMarkdown from batch generation and relax validators
- Updated `buildGenerationPrompt()` to request only card-face fields
- Removed `!bodyMarkdown` guard from `extractPosts()` so posts with empty body are accepted
- Relaxed `isValidDailyPost()` to accept undefined bodyMarkdown, removed mandatory whyCare/takeaway/quickAskPrompts checks
- Extended `getPostById()` to search video, news, and shorts caches after main and connection stores
- STARTER_POSTS remain unchanged with full bodyMarkdown content
- **Commit:** 25edefc8

### Task 2: Create post-essay.service.ts and defer video/news summaries
- Created `post-essay.service.ts` with type-specific essay generators: standard, video, news, text-art
- `generatePostEssay()` dispatches by sourceType/presentationStyle to the correct streaming generator
- `generateEssayMeta()` generates whyCare/takeaway/quickAskPrompts in a single non-streaming call
- `patchPostEssayInCache()` patches essay content into the correct localStorage cache (main, video, news, shorts)
- Deferred video transcript summarization: `_fetchNewVideoPosts` sets bodyMarkdown to empty string, keeps transcript fetch
- Deferred news LLM summarization: `generateNewsPosts` builds posts directly from search hits without chatCompletion
- Removed unused `chatCompletion` and `SourceCitation` imports from news.service.ts
- **Commit:** 6a564829

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Cleanup] Removed unused SourceCitation import from news.service.ts**
- **Found during:** Task 2
- **Issue:** After removing chatCompletion usage, SourceCitation type was also no longer referenced
- **Fix:** Removed from import statement to avoid unused import warning
- **Files modified:** app/src/services/news.service.ts
- **Commit:** 6a564829

## Known Stubs

None -- all functions are fully wired. The empty bodyMarkdown strings are intentional deferred-generation markers that Plan 03 (PostDetailScreen) will consume to trigger on-enter streaming.

## Self-Check: PASSED

- FOUND: app/src/services/post-essay.service.ts
- FOUND: app/src/services/concept-feed.service.ts
- FOUND: app/src/services/youtube.service.ts
- FOUND: app/src/services/news.service.ts
- FOUND: commit 25edefc8
- FOUND: commit 6a564829
