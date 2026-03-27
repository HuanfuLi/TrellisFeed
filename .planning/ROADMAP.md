# Roadmap: Milestone v1.1 (Engagement & Discovery Iteration)

**Starting phase:** 7 (continuing from v1.0 which ended at phase 6)

**Total requirements:** 18 | **Target phases:** 5

---

## Phase 7: Post Feed Redesign & Image Integration ✓ COMPLETE

**Goal:** Redesign Home Feed to image-forward layout (Rednote-style) and integrate AI image generation pipeline.

**Requirements:**
- FEED-01: Image-forward post design
- FEED-02: Multiple image style generation
- FEED-03: Catchy title/question/story overlay
- IMAGE-01: Nano Banana API integration
- IMAGE-02: Gemini API integration
- IMAGE-03: Image caching

**Success Criteria:**
1. Home Feed displays posts with large images and emoji/text overlays
2. AI generates 2+ image styles per post (infograph, illustration, etc.)
3. Images are cached locally and persist across app restarts
4. Post generation time remains under 5 seconds with local LLM or 10 seconds with API
5. Image generation failures show error state with user-friendly messaging

---

## Phase 8: Post Detail & Infinite Scroll ✓ COMPLETE

**Goal:** Implement post detail page with image carousel and scroll-release feed loading mechanism.

**Status:** COMPLETE — 08-01-PLAN.md (2026-03-27)

**Requirements:**
- FEED-04: Scroll-release to load more posts ✓
- FEED-05: Post detail page with image carousel ✓
- FEED-06: Multiple images display in carousel ✓

**Delivered:**
- PostCarousel component (Framer Motion swipe, lazy load, counter badge)
- useInfiniteScroll hook (scroll detection, debounce, concurrent-load guard)
- infiniteScrollService (batch fetch + deduplication)
- PullUpHint affordance component
- HomeScreen updated with scroll-triggered pagination
- PostDetailScreen updated with carousel above essay

**Success Criteria:**
1. Scroll to bottom of feed and release shows explicit "Load More" affordance (swipe-up or pull gesture) ✓
2. Post detail page displays first image above title in carousel format ✓
3. User can swipe through generated images for each post ✓
4. Carousel transitions are smooth and performant (60 fps) ✓
5. No duplicate posts load when triggering scroll-release multiple times ✓

---

## Phase 9: Image Regeneration & Error Handling

**Goal:** Add user control for image regeneration and graceful error handling for API failures.

**Requirements:**
- IMAGE-04: Image regeneration on demand
- IMAGE-05: Error handling and recovery

**Success Criteria:**
1. User can tap "Regenerate" button to create new image styles for a post
2. Failed image generation shows retry option with clear error message
3. Fallback to placeholder or alternative style if all providers fail
4. Rate limit and quota issues are communicated to user
5. Regeneration respects API usage limits (no rapid-fire requests)

---

## Phase 10: Planner Auto-Suggestions Engine ✓ COMPLETE

**Goal:** Implement auto-generation of Planner suggestions when Knowledge Graph is populated and Planner is empty, with daily refresh.

**Status:** COMPLETE — 10-01-PLAN.md + 10-02-PLAN.md + 10-03-PLAN.md (2026-03-27)

**Plans delivered:**
- 10-01: Core engine (trajectory analysis, scoring, move generation, PlannerScreen UI, daily refresh hook, settings UI)
- 10-02: Gap closure (useDailyRefresh wired into PlannerScreen, plannerRefreshEnabled/Time persisted to localStorage)
- 10-03: UAT gap closure (unified Suggested Moves section, always-visible Refresh, toast-wired Skip All)

**Requirements:**
- PLANNER-01: Trigger auto-generation (5+ nodes AND empty)
- PLANNER-02: Display suggestions automatically
- PLANNER-03: Daily auto-refresh logic
- PLANNER-05: Trajectory-aware scoring algorithm

**Success Criteria:**
1. System detects when Knowledge Graph has 5+ nodes AND Planner is completely empty
2. Auto-generated suggestions appear on Planner screen without manual trigger
3. Suggestions include moves that link to Posts, Questions, or Reviews
4. Daily refresh triggers after podcast time (if scheduled)
5. Suggestions algorithm considers: review performance, question frequency, time since last review
6. Generated suggestions are stored locally and survive app restarts

---

## Phase 11: Planner Retry & Milestone Card Variety

**Goal:** Add user control for suggestion regeneration and expand milestone card visual designs.

**Requirements:**
- PLANNER-04: Retry/regenerate suggestions button
- PLANNER-06: Rich "Moves" linking
- CARDS-01: Multiple card designs (3+)
- CARDS-02: Card design rotation/shuffling
- CARDS-03: Accessibility and readability standards

**Success Criteria:**
1. "Retry" button appears next to "Suggested Moves" header
2. User can regenerate suggestions immediately (respects API rate limits)
3. Milestone cards display in 3+ distinct visual styles
4. Cards rotate/shuffle to prevent visual fatigue over time
5. All card designs meet WCAG accessibility standards
6. Card designs are responsive across mobile screen sizes (375px to 600px+)

---

## Requirement Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 7 | FEED-01, FEED-02, FEED-03, IMAGE-01, IMAGE-02, IMAGE-03 | 6 |
| Phase 8 | FEED-04, FEED-05, FEED-06 | 3 |
| Phase 9 | IMAGE-04, IMAGE-05 | 2 |
| Phase 10 | PLANNER-01, PLANNER-02, PLANNER-03, PLANNER-05 | 4 |
| Phase 11 | PLANNER-04, PLANNER-06, CARDS-01, CARDS-02, CARDS-03 | 5 |
| **Total** | **18 requirements** | **18** |

✓ All requirements mapped. 100% coverage.

---

## Build Dependencies

- **Phase 7** must complete before Phase 8 (image generation needed for carousel)
- **Phase 8** must complete before Phase 9 (post detail page used for regeneration flow)
- **Phase 9** can proceed in parallel with Phase 10
- **Phase 10** should complete before Phase 11 (base suggestions before retry logic)
- **Phase 11** is final polish (card designs, retry UX)

---

_Created: 2026-03-26 | v1.1 Roadmap | 5 phases | 18 requirements mapped_
