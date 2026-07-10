# Phase 8: Post Detail & Infinite Scroll

**Milestone:** v1.1 (Engagement & Discovery Iteration)  
**Status:** Planning  
**Depends on:** Phase 7 (Post Feed Redesign & Image Integration)

## Goal

Build the post detail page with image carousel and implement scroll-release (infinite scroll with explicit user action) mechanism for discovering more posts in the feed.

## Requirements

- **FEED-04**: Scroll-release to load more posts (explicit action trigger)
- **FEED-05**: Post detail page with image carousel at top
- **FEED-06**: Multiple images display in carousel before essay content

## User Stories

1. **As a learner**, I want to tap on a post and see a dedicated detail page with multiple generated images in a carousel so that I can explore different visual representations of the concept.
2. **As a learner**, I want to scroll to the bottom of the feed and trigger a release-swipe to load more posts so that I can discover new content without a manual button click.
3. **As a developer**, I need a performant infinite scroll implementation that doesn't duplicate posts or cause layout thrashing.

## Success Criteria

1. ✅ Post detail page displays first image in carousel format above title
2. ✅ User can swipe through all generated images for a post
3. ✅ Carousel transitions are smooth (60 fps)
4. ✅ Scroll-to-bottom shows clear "Swipe Up" or "Pull Up" affordance
5. ✅ Releasing at bottom loads next batch of posts
6. ✅ No duplicate posts across pagination
7. ✅ New posts lazy-load images (don't block UI)
8. ✅ Post detail shows full essay content after image carousel
9. ✅ Navigation back to feed preserves scroll position

## Task Breakdown

### Wave 1: Post Detail Page Structure (Days 1-2)

#### T8.1: PostDetail Screen Component
- Create `src/screens/PostDetailScreen.tsx`
- Accept postId from route params
- Fetch post + metadata from service
- Implement loading state while fetching
- **Acceptance:** Screen renders without errors, post data loads

#### T8.2: Image Carousel Component
- Create `src/components/UI/ImageCarousel.tsx`
- Accept array of `GeneratedImage` objects
- Implement swipe gestures (left/right via Framer Motion)
- Show image counter (1/3)
- Preload next image while swiping
- **Acceptance:** Carousel renders, swipes work smoothly, counter updates

#### T8.3: Post Detail Layout
- Compose PostDetailScreen with:
  - ImageCarousel at top
  - Post title and metadata below
  - Full essay content
  - Related posts / back button
- Use safe area aware padding
- **Acceptance:** Layout responsive on 375px to 600px+ screens

#### T8.4: Navigation Integration
- Wire up PostDetail route in React Router
- Handle navigation from FeedPost → PostDetail
- Implement back button to return to feed
- Preserve feed scroll position using router state
- **Acceptance:** Navigation works both ways, no scroll jumps

### Wave 2: Infinite Scroll Mechanism (Days 2-3)

#### T8.5: Scroll-Release Detection
- Create hook `useScrollRelease()` for detecting bottom-release
- Listen for scroll events on feed container
- Detect user reaches bottom + releases (explicit action)
- Show "Swipe Up" affordance when near bottom
- Return release trigger event
- **Acceptance:** Hook detects bottom release accurately

#### T8.6: Pagination State Management
- Create hook `useFeedPagination()` 
- Track: currentPage, pageSize (20 posts), hasMore flag
- Implement loadNextPage() function
- Deduplicate posts using Set<postId>
- **Acceptance:** Pagination state tracks correctly, no duplicates

#### T8.7: Feed Integration
- Update `FeedScreen` to use scroll-release + pagination
- Show loading indicator when loading more
- Append new posts to feed (preserve existing posts)
- Handle "no more posts" state (disable loading)
- **Acceptance:** Feed loads new posts on scroll-release

#### T8.8: Performance Optimization
- Implement post virtualization (only render visible posts)
- Lazy-load images for off-screen posts
- Profile feed with 50+ posts (measure memory, fps)
- Implement request debouncing (ignore rapid scroll releases)
- **Acceptance:** Feed stays smooth with 50+ posts, no jank

### Wave 3: Testing & Polish (Days 3-4)

#### T8.9: Component Tests
- Test ImageCarousel swipe gestures
- Test PostDetail navigation flow
- Test scroll-release detection
- Test pagination logic
- **Acceptance:** All tests pass, >80% coverage

#### T8.10: Integration Tests
- E2E: Feed → tap post → PostDetail → carousel → back
- Test scroll-release multiple times (no duplicates)
- Test loading states and errors
- **Acceptance:** All flows work end-to-end

#### T8.11: Mobile Testing
- Test on iOS/Android (safe area, status bar)
- Test swipe gestures on different device sizes
- Test slow network (throttling)
- Test edge cases (empty feed, single post)
- **Acceptance:** All devices work, no crashes

#### T8.12: Handoff Documentation
- Document image carousel props/API
- Document scroll-release hook usage
- Update VERIFICATION.md
- **Acceptance:** Phase 9 can use these components directly

---

## Estimated Scope: 4-5 working days

**Key technical challenge:** Smooth carousel transitions + scroll detection without jank.

---

_Phase 8 Plan | Post Detail & Infinite Scroll_
