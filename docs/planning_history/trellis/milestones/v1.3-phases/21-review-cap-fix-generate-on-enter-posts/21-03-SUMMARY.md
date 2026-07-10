---
phase: 21-review-cap-fix-generate-on-enter-posts
plan: "03"
subsystem: post-detail
tags: [streaming, essay, on-enter, ui-shell, caching, error-handling]
dependency_graph:
  requires:
    - phase: 21-02
      provides: post-essay.service.ts (generatePostEssay, generateEssayMeta, patchPostEssayInCache)
  provides: [on-enter-essay-streaming, pre-built-ui-shell, essay-caching, error-retry]
  affects: [PostDetailScreen]
tech_stack:
  added: []
  patterns: [on-enter-streaming, pre-built-ui-shell, abort-ref-cleanup, cache-patching]
key_files:
  created: []
  modified:
    - app/src/screens/PostDetailScreen.tsx
decisions:
  - "On-enter useEffect triggers when post loaded with empty bodyMarkdown -- skips connection, discover, and short sourceTypes"
  - "Streaming body rendered via Markdown component during generation; replaced by post.bodyMarkdown after cache patch"
  - "onEnterAbortRef prevents state updates after component unmount or navigation away"
  - "patchPostEssayInCache called after streaming completes for instant re-visits"
  - "Error state with RefreshCw retry resets bodyMarkdown to empty string to re-trigger generation"
  - "Pre-built UI shell (minHeight: 200px container) prevents layout shift during streaming"
  - "quickAskPrompts memo falls through to onEnterMeta when post data not yet cached"
metrics:
  duration: ~5min
  completed: "2026-04-05"
---

# Phase 21 Plan 03: PostDetailScreen On-Enter Essay Streaming Summary

**On-enter essay streaming into a pre-built UI shell with progressive text rendering, meta generation, cache patching, and error retry**

## What Was Built

### On-Enter Essay Streaming UseEffect
When a user opens a post with empty `bodyMarkdown` (the deferred-generation marker from Plan 02), a useEffect triggers `generatePostEssay()` which streams essay content chunk-by-chunk. The streaming body is accumulated and rendered progressively via the `<Markdown>` component. Connection, discover, and short posts are excluded (they have their own generation flows).

### Pre-Built UI Shell
The detail page shell (back button, header/title, image carousel/video embed, essay container, follow-up section) renders immediately before any LLM content arrives. The essay container uses `minHeight: 200px` to prevent layout shift. A skeleton pulse animation displays while waiting for the first chunk.

### Streaming Text Rendering
State variables `streamingBody`, `isStreamingOnEnter`, and `onEnterError` manage the streaming lifecycle. During streaming, `<Markdown>{streamingBody}</Markdown>` renders the accumulated text. After completion, the body is patched into the post state and the streaming buffer is cleared.

### Meta Generation After Body Completes
After the essay body finishes streaming, `generateEssayMeta()` is called to produce `whyCare`, `takeaway`, and `quickAskPrompts`. These are stored in `onEnterMeta` state and the full `EssayContent` is assembled for caching.

### Cache Patching for Instant Re-Visits
`patchPostEssayInCache(post.id, essay)` writes the completed essay back to the correct localStorage cache (main, video, news, or shorts). Re-visiting the post loads the cached essay instantly without re-generation.

### Error State with Retry
If the LLM call fails, an error block displays with a `<RefreshCw>` retry button. Clicking retry resets `bodyMarkdown` to empty string, which re-triggers the on-enter useEffect.

### Abort Ref Cleanup
`onEnterAbortRef` is set to `true` on component unmount (useEffect cleanup return), preventing state updates on unmounted components and stopping the streaming generator.

## Commits

| # | Hash | Message | Key Changes |
|---|------|---------|-------------|
| 1 | 3580ff25 | feat(21-03): add on-enter essay streaming with pre-built UI shell | Full on-enter streaming implementation |

Related follow-up commits:
- ab04af35: fix(PostDetailScreen): resolve TypeScript errors in skeleton post initialization
- f37e9923: style: refine Curiosity Feed UI and unify Post Detail generation
- 233488ab: fix: resolve redundant LLM calls in post detail screens

## Files Modified

| File | Changes |
|------|---------|
| `app/src/screens/PostDetailScreen.tsx` | Added generatePostEssay/generateEssayMeta/patchPostEssayInCache imports, streamingBody/isStreamingOnEnter/onEnterError/onEnterMeta state, on-enter useEffect, pre-built UI shell with minHeight container, error retry block, quickAskPrompts memo fallthrough |

## Requirements Satisfied

| Requirement | Description | Evidence |
|-------------|-------------|----------|
| POST-02 | On-enter streaming LLM call in PostDetailScreen | `generatePostEssay` call in useEffect at line 203; streams into `streamingBody` state |
| POST-03 | Pre-built detail page UI shell renders independently of LLM content | `minHeight: 200px` container at line 647; shell (back button, title, carousel) renders before essay |
| POST-07 | Text-art posts get vivid essay on-enter | `generatePostEssay` dispatches by sourceType/presentationStyle (handles text-art in post-essay.service.ts) |
| POST-08 | Error state with retry button on LLM failure | `onEnterError` state at line 76; `<RefreshCw>` retry button at line 660 |

## Deviations from Plan

None -- plan executed as written. The on-enter streaming, UI shell, caching, and error handling were implemented exactly as specified.

Note: The daily goal progress bar (REVIEW-03/REVIEW-04) added in Plan 01 (commit d02ea9bc) was subsequently removed in a follow-up fix (commit 36d6ea8b) that replaced the daily goal bar with the existing completion progress bar and removed the getReviewedTodayCount/incrementReviewedToday helpers. This was a deliberate UX decision made after Plan 01 execution and does not affect Plan 03's scope.

## Known Stubs

None -- all data sources are wired. The streaming pipeline connects PostDetailScreen to post-essay.service.ts, which connects to the LLM provider. Cache patching writes to localStorage for persistence.

## Self-Check: PASSED

- FOUND: app/src/screens/PostDetailScreen.tsx (818 lines)
- VERIFIED: generatePostEssay import at line 20
- VERIFIED: isStreamingOnEnter state at line 75
- VERIFIED: streamingBody state at line 74
- VERIFIED: onEnterError state at line 76
- VERIFIED: minHeight: '200px' at line 647
- VERIFIED: RefreshCw retry button at line 660
- VERIFIED: patchPostEssayInCache call at line 232
- FOUND: commit 3580ff25

---
*Phase: 21-review-cap-fix-generate-on-enter-posts*
*Completed: 2026-04-05*
