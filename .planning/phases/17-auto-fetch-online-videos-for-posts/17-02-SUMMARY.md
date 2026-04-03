---
phase: 17-auto-fetch-online-videos-for-posts
plan: "02"
subsystem: feed-integration
tags: [video, youtube, concept-feed, infoflow, interleaving]
dependency_graph:
  requires: [17-01]
  provides: [video-posts-in-feed, video-card-ui]
  affects: [HomeScreen, concept-feed.service, InfoFlow]
tech_stack:
  added: []
  patterns: [interleave-helper, optional-integration-fallback, cache-encapsulation]
key_files:
  created: []
  modified:
    - app/src/services/concept-feed.service.ts
    - app/src/components/InfoFlow.tsx
decisions:
  - "interleaveVideoPosts inserts video post after every 2nd AI post, appends extras at end"
  - "getDailyPosts and generateMorePosts both catch YouTube errors so feed degrades gracefully"
  - "getCachedDailyPosts reads video cache via youtubeService.getCachedVideoPosts() — not raw localStorage"
  - "AI post cache unchanged — video posts use youtube.service.ts own cache"
  - "Video card skips AI image generation entirely (isVideoPost guard in useEffect)"
  - "Context label for video cards shows channelTitle instead of contextLabel"
metrics:
  duration_seconds: 149
  completed_date: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 17 Plan 02: Video Feed Integration Summary

Video posts interleaved into the existing feed via concept-feed.service.ts (3 on load, 4 on pull-for-more), with YouTube thumbnail + play overlay rendering in InfoFlow.tsx ConceptCard, red 'Video' badge, channel name as context label, and graceful degradation when YouTube API key is absent.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add video to VALID_SOURCE_TYPES, import youtubeService, add interleaveVideoPosts helper, modify getDailyPosts/generateMorePosts/getCachedDailyPosts | 47b08ff6 |
| 2 | Add 'video' entry to CONCEPT_BADGE_META, thumbnail+play overlay, skip AI image gen for video posts, channel name as context label | c2bfabb2 |

## What Was Built

### concept-feed.service.ts

- Added `'video'` to `VALID_SOURCE_TYPES` — fixes cache validation for video posts (Plan research pitfall 5)
- Imported `youtubeService` from `./youtube.service`
- Added `interleaveVideoPosts(aiPosts, videoPosts)` helper function — inserts a video post after every 2nd AI post, appends remaining videos at end
- Modified all three return paths in `getDailyPosts` (cache-hit exact, cache-hit fingerprint changed, fresh generation) to call `youtubeService.generateVideoPosts(3)` and interleave
- Modified `generateMorePosts` to call `youtubeService.generateMoreVideoPosts(4)` and interleave
- Modified `getCachedDailyPosts` to read video cache via `youtubeService.getCachedVideoPosts()` — not raw localStorage (cache encapsulation preserved)
- All YouTube calls wrapped in try/catch — feed works normally when YouTube API key is absent

### InfoFlow.tsx

- Added `video: { label: 'Video', color: '#FF0000' }` to `CONCEPT_BADGE_META`
- `ConceptCard` now derives `isVideoPost = post.sourceType === 'video'`
- `imageResolved` initial state is `true` for video posts (no async wait)
- `useEffect` for image generation returns early when `isVideoPost` — no AI image generation triggered
- When `isVideoPost && post.videoMeta?.thumbnailUrl`: renders `<img>` with YouTube thumbnail + absolute-positioned play icon (white triangle in dark circle) overlay
- Non-video posts render `FeedPostImage` as before
- Context label shows `post.videoMeta.channelTitle` for video posts, `post.contextLabel` otherwise

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is wired. Video posts appear in feed when YouTube API key is configured; feed degrades gracefully (empty video array) when key is absent.

## Self-Check: PASSED

Files verified:
- `app/src/services/concept-feed.service.ts` — exists, contains 'video' in VALID_SOURCE_TYPES, interleaveVideoPosts, youtubeService import, getCachedVideoPosts usage
- `app/src/components/InfoFlow.tsx` — exists, contains video badge entry, thumbnailUrl rendering, play overlay, isVideoPost guard
- Commit 47b08ff6 — verified in git log
- Commit c2bfabb2 — verified in git log
- `npx tsc --noEmit` — passes (no output)
- `node --test tests/services/concept-feed.test.mjs` — 7 pass, 0 fail, 1 todo
- `node --test tests/services/youtube.test.mjs` — 11 pass, 0 fail, 6 todo
