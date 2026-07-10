# Phase 8 Context: Post Detail & Infinite Scroll

**Phase:** 08  
**Status:** Context Locked (Ready for Research & Planning)  
**Requirements:** FEED-04, FEED-05, FEED-06 (3 requirements)  
**Dependencies:** Phase 7 (Image generation, caching, error handling complete)

---

## Executive Summary

Phase 8 delivers two interconnected features:
1. **Post Detail Page:** Displays a single post with a carousel of AI-generated images at the top
2. **Infinite Scroll Mechanism:** Allows users to pull up at the bottom of the feed to load more posts explicitly

Key principle: **Explicit action only** — no auto-scroll pagination.

---

## Locked Decisions

### 1. Post Detail Layout

**Decision:** Header visible, carousel contained (350-400px height)

**Rationale:** 
- Shows context first (title/author/date)
- Carousel is readable without full screen
- Essay content flows naturally below
- Balances visual impact with content hierarchy

**Implementation Approach:**
```
┌─────────────────────────────────┐
│ Title                           │
│ Author  •  Date                 │ ← Header
├─────────────────────────────────┤
│      [IMAGE CAROUSEL]           │ ← 350-400px
│   ◀  2/5 →                      │
├─────────────────────────────────┤
│ Essay content starts here...    │
│                                 │ ← Scrollable
└─────────────────────────────────┘
```

### 2. Carousel Interaction

**Decision A - Navigation:** Swipe only (cleanest for mobile)
- No tap arrows or dots
- Swipe gestures only
- Improves mobile UX
- Image counter at bottom-right (minimal indicator)

**Decision B - Auto-Rotation:** Manual only (no auto-rotate)
- User must swipe to advance
- Respects user intention
- No distracting animations
- Counter visible at bottom-right

**Decision C - Counter Position:** Bottom-right corner (minimal)
- Shows "2/5" or similar
- Non-intrusive placement
- Doesn't obscure image content

**Decision D - Loading State:** Show skeleton loading (placeholder while images load)
- Grey rectangle placeholder appears immediately
- Skeleton height matches carousel height
- Feels responsive (not hanging)

### 3. Infinite Scroll Trigger

**Decision A - Gesture Type:** Pull-up gesture (drag content up to trigger)
- User drags feed content upward
- Like pull-to-refresh but inverted
- Explicit, discoverable action
- Satisfying haptic feedback

**Decision B - Trigger Point:** At absolute bottom (when last post is visible)
- Not 50dp before bottom (more precise)
- User must scroll to absolute end
- Clear intent signal

**Decision C - Affordance:** Show affordance hint (e.g., 'Pull up to load more')
- Text hint or icon at bottom of feed
- Makes gesture discoverable
- Reduces confusion

**Decision D - Batch Size:** Load 10 posts per batch (more requests, faster response)
- 10 posts per pull-up action
- Faster server response
- Users can control pagination pace
- Smaller data payload

### 4. State & Navigation

**Decision A - Carousel Position on Return:** Reset to first image when returning from detail (fresh start)
- When user opens same post again, see first image
- Simpler state management
- Fresh experience each time
- No need to persist carousel scroll position

**Decision B - Back Gesture:** Yes, support back swipe (like iOS native)
- Swipe from left edge goes back
- Standard iOS pattern (users expect it)
- More fluid navigation
- Works alongside back button

**Decision C - Deep Links:** Don't support deep links (post detail only in-app)
- Post detail pages not shareable as external links
- Simpler implementation (no route/deep link handling needed)
- Users share posts within app or as post cards
- Reduces surface area

### 5. Performance & Edge Cases

**Decision A - Single Image Carousel:** Skip carousel, show image directly if only 1
- If post has 1 image, don't show carousel UI
- Image displayed as static (no swipe needed)
- UX adapts to content
- Cleaner for posts with single images

**Decision B - No Images Generated:** Omit image entirely (show essay without image)
- If image generation failed (0 images), don't show error
- Just display essay content normally
- Graceful degradation
- User doesn't see broken state

**Decision C - Carousel Image Loading:** Lazy-load images in carousel (load as user swipes)
- First image loads with page
- Remaining images load as user swipes
- Faster initial page load
- Slight wait when swiping (acceptable for lazy loading)

**Decision D - Duplicate Detection:** Strict: Compare post IDs (prevent exact duplicates)
- When loading new posts, check entire feed history
- Prevent same post appearing twice
- Client-side deduplication (reliable)
- May require pagination cursor or offset tracking

---

## Canonical References

Files that define standards for this phase:

- `.planning/REQUIREMENTS.md` — Full FEED-04/05/06 acceptance criteria
- `.planning/PROJECT.md` — Vision, principles (privacy-first, mobile-first)
- `.planning/ROADMAP.md` — Phase 8 goal statement
- `.planning/phases/07-post-feed-redesign-image-integration/PHASE.md` — Image generation architecture (Phase 7)
- `.planning/phases/07-post-feed-redesign-image-integration/IMPLEMENTATION-GUIDE.md` — What Phase 7 provides to Phase 8
- `app/src/services/imageGeneration.service.ts` — How to access cached/generated images
- `app/src/components/UI/Card.tsx` (if exists) — Post card component pattern

---

## Integration Points with Phase 7

Phase 8 builds directly on Phase 7's foundation:

**From Phase 7 (already done):**
- `imageGeneration.service.ts`: Provides `generateImage()` method + cache
- `imageCache.service.ts`: Manages image retrieval + LRU eviction (50MB max)
- `GeminiProvider` & `NanoBananaProvider`: Real API integration
- `SettingsScreen`: API key management (user has keys configured)

**Phase 8 needs:**
- Call `imageGeneration.getImage(postId, style)` to retrieve cached images for carousel
- Handle case where no images exist (show essay without image)
- Display multiple images in carousel (Phase 7 generates 2-3 per post per style)

---

## Deferred Ideas (Not in Scope)

These ideas were considered but are outside Phase 8 scope:

- **Comments on posts** — Would be a separate "Comments" phase
- **Search/filtering posts** — Separate "Feed Search" phase
- **Bookmarking posts** — Separate "Bookmarks" phase
- **Auto-scroll pagination** — Explicitly rejected in favor of explicit pull-up
- **Image regeneration** — Separate phase (Phase 9)
- **Deep linking to specific posts** — Out of scope (decided)
- **Carousel auto-rotation** — Out of scope (decided)
- **Pagination via button** — Out of scope (pull-up gesture only)

---

## Success Criteria (from Roadmap)

For Phase 8 to be complete:

✅ Post detail page displays first image in carousel format above title  
✅ User can swipe through all generated images for a post  
✅ Carousel transitions are smooth (60 fps)  
✅ Scroll-to-bottom shows clear "Swipe Up" or "Pull Up" affordance  
✅ Releasing at bottom loads next batch of posts (10 per pull-up)  
✅ No duplicate posts across pagination  
✅ New posts lazy-load images (don't block UI)  
✅ Post detail shows full essay content after image carousel  
✅ Navigation back to feed works (iOS back swipe + button)  

---

## Team Notes

**Assumptions:**
- Phase 7 provides `imageGeneration.getImage(postId, style)` synchronously or via hook
- Existing post Card component can be reused/extended for detail page
- Feed infinite scroll can reuse existing `useInfiniteQuery` hook (from ROADMAP phase 4)

**Blockers:**
- None — Phase 7 complete, APIs ready

**Questions for Research Phase:**
- How does Capacitor handle swipe gestures (back swipe from left edge)?
- What carousel library should be used (Framer Motion, React Spring, custom)?
- How to implement pull-to-load-more gesture detection?
- What's the best way to track "scroll to absolute bottom" in React?

---

## Next Steps

1. **Research Phase:** Investigate:
   - Swipe gesture libraries (iOS back swipe, pull-up detection)
   - Carousel component options (performance for 2-5 images)
   - Feed infinite scroll patterns (cursor tracking, duplicate detection)
   
2. **Planning Phase:** Create detailed task breakdown based on these locked decisions

3. **Execution:** Implement tasks in waves (1. Detail page layout, 2. Carousel, 3. Infinite scroll)

---

**Context Created:** After Phase 8 planning discussion  
**Status:** Ready for gsd-plan-phase execution
