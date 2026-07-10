---
phase: 17-auto-fetch-online-videos-for-posts
plan: "01"
subsystem: services
tags: [youtube, video, types, service, llm]
dependency_graph:
  requires: [17-00]
  provides: [youtube.service.ts, VideoMetadata type, video sourceType]
  affects: [app/src/types/index.ts, app/src/services/youtube.service.ts]
tech_stack:
  added: [YouTube Data API v3, CapacitorHttp transcript extraction]
  patterns: [ServiceResult pattern, localStorage cache with date-check, chatCompletion with serviceName token tracking]
key_files:
  created:
    - app/src/services/youtube.service.ts
  modified:
    - app/src/types/index.ts
decisions:
  - VideoMetadata interface exported from types/index.ts with videoId, channelTitle, thumbnailUrl, transcript?, summary?, duration?
  - PostSnapshot sourceType union extended with 'video'
  - DailyPost has optional videoMeta?: VideoMetadata field
  - AppSettings has optional youtube?: { apiKey: string } field
  - youtubeService._fetchNewVideoPosts is an internal method (underscore prefix) keeping public API clean
  - 1.5s sleep between transcript fetches guards against YouTube rate limiting
  - Concepts grouped 2-3 per search query to minimize quota consumption (100 units/call)
  - getCachedVideoPosts is the ONLY public read path for echolearn_video_cache
  - generateVideoPosts checks cache first; returns cached on same-day re-call
  - fetchTranscript falls back gracefully (returns null) in browser due to CORS
metrics:
  duration: "1 minute"
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 2
---

# Phase 17 Plan 01: Video Types & YouTube Service Summary

YouTube Data API v3 foundation service with transcript extraction, LLM summarization, SM-2-driven search, and localStorage caching producing DailyPost objects with sourceType 'video'.

## What Was Built

### Task 1: Type Extensions (app/src/types/index.ts)

- Added `VideoMetadata` interface with `videoId`, `channelTitle`, `thumbnailUrl`, `transcript?`, `summary?`, `duration?`
- Extended `PostSnapshot.sourceType` union to include `'video'`
- Added `videoMeta?: VideoMetadata` field to `DailyPost`
- Added `youtube?: { apiKey: string }` field to `AppSettings`

### Task 2: youtube.service.ts (app/src/services/youtube.service.ts)

Created full video discovery pipeline with 6 exported methods plus 1 internal helper:

1. **`searchVideos(query, maxResults?)`** — YouTube Data API v3 via `fetch()`. Reads API key from `mockSettingsService.getSync().youtube?.apiKey`. Returns `ServiceResult<YouTubeSearchResult[]>`. Handles 403 quotaExceeded with specific error. Quota cost: 100 units/call.

2. **`fetchTranscript(videoId)`** — Uses `CapacitorHttp.get` on native (iOS/Android), standard `fetch` fallback in browser (returns null due to CORS). Extracts `captionTracks` via regex, prefers manual English track over auto-generated. Parses caption XML, decodes HTML entities, returns plain text or null.

3. **`summarizeTranscript(transcript, videoTitle, videoDescription?)`** — Calls `chatCompletion` with `serviceName: 'video-summary'` for token tracking. Truncates transcript to 4000 chars. Falls back to title+description summary if no transcript, marking it as description-based.

4. **`generateVideoPosts(count = 3)`** — Cache-first: returns today's cached posts if available. Otherwise: gets SM-2 due items via `mockReviewService.getTodayReviewItems()`, groups concepts into search queries, fetches videos, extracts transcripts, generates summaries, builds `DailyPost[]` with `sourceType: 'video'`.

5. **`generateMoreVideoPosts(count = 4)`** — Same pipeline but skips existing cached videoIds. Appends new posts to cache.

6. **`getCachedVideoPosts()`** — Reads `echolearn_video_cache` from localStorage, validates date matches today, returns posts or `[]`. Only public cache read path.

7. **`_fetchNewVideoPosts(count, seenIds)`** — Internal: full pipeline from due concepts to DailyPost[]. 1.5s delay between transcript fetches to avoid rate limiting.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `app/src/types/index.ts` — VideoMetadata, 'video' sourceType, videoMeta, youtube config
- [x] `app/src/services/youtube.service.ts` — all 6 methods exported on youtubeService
- [x] Commits: ebb78c6f (types), 5fd80042 (service)
- [x] TypeScript compiles with no errors (`npx tsc --noEmit` clean)
- [x] `mockReviewService.getTodayReviewItems` pattern confirmed in _fetchNewVideoPosts
- [x] `serviceName: 'video-summary'` confirmed in summarizeTranscript
