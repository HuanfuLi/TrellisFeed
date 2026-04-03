---
phase: 18-feed-redesign-short-videos-text-art-posts
plan: 02
subsystem: ui, feed
tags: [react, typescript, feed, text-art, card-cleanup, llm]

requires:
  - phase: 18-feed-redesign-short-videos-text-art-posts
    plan: 01
    provides: PresentationStyle type system, assignPresentationStyles function
provides:
  - Cleaned card faces (no badge row, no keyword tags, conditional preview)
  - Text-art notebook card rendering with dot grid background
  - generateTextArtContent LLM function for feed-time content generation
affects: [feed-rendering, post-detail, concept-feed-service]

tech-stack:
  added: []
  patterns:
    - "Text-art card uses radial-gradient dot grid on #FFFDE7 background"
    - "generateTextArtContent batches parallel LLM calls with Promise.allSettled"
    - "Text-art content persisted to cache after generation for reload availability"

key-files:
  created: []
  modified:
    - app/src/components/InfoFlow.tsx
    - app/src/services/concept-feed.service.ts

key-decisions:
  - "CONCEPT_BADGE_META and FALLBACK_BADGE removed entirely since no card renders a badge"
  - "ConnectionCard header badge row removed; cosineSimilarity and showScore props kept in interface but prefixed with _ for forward compat"
  - "Text-art hook rendered inside notebook card; non-text-art hook rendered in separate padding div"
  - "generateTextArtContent checks LLM config before calling; gracefully returns unmodified posts if not configured"
  - "Cache write-back after text-art generation ensures textArtContent survives page reload"

patterns-established:
  - "presentationStyle drives mutually exclusive rendering branches in ConceptCard"
  - "Feed-time LLM enrichment pattern: generate content at feed-build, cache for reuse"

requirements-completed: [FEED-07, FEED-08, FEED-09, FEED-10, VIDEO-01, TART-01, TART-02, TART-03]

duration: 10min
completed: 2026-04-03
---

# Phase 18 Plan 02: Card Face Cleanup & Text-Art Posts Summary

**Cleaned all card faces (badge, tags, preview) and added text-art notebook post rendering with LLM-generated content**

## What Was Done

### Task 1: Card face cleanup (be753380)
- Removed `CONCEPT_BADGE_META`, `FALLBACK_BADGE` constants and badge row from ConceptCard
- Removed keyword tag pills (`post.keywords.slice(0,3).map(...)`)
- Made preview text conditional: only shown when `presentationStyle === 'image-less'`
- Removed ConnectionCard header badge row (Connect badge + "Read essay" link)
- Updated InlineInfoFlow minHeight for image-less concept cards from 320px to 200px
- Video cards retain channel attribution (`by {channelTitle}`) but no badge or keywords

### Task 2: Text-art notebook post rendering & LLM generation (d3add8bb)
- Added text-art rendering branch in ConceptCard with dot grid notebook background (`backgroundColor: '#FFFDE7'`, `radial-gradient(circle, #C5CAE9 0.8px, transparent 0.8px)`)
- Text-art card renders `post.textArtContent` split by newlines as individual paragraphs
- Hook text renders inside notebook card for text-art; outside in standard padding div for other styles
- AI image block guarded with `presentationStyle !== 'text-art'` to prevent rendering on text-art cards
- Added `generateTextArtContent` function in concept-feed.service.ts with batched parallel LLM calls via `Promise.allSettled`
- Wired `generateTextArtContent` into `getDailyPosts` (fresh generation path) and `generateMorePosts`
- Cache-hit paths skip text-art generation (content already persisted from initial feed-build)
- Text-art content persisted back to cache after generation for reload availability
- LLM calls use `serviceName: 'text-art'` and `maxTokens: 256` for token usage tracking

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
