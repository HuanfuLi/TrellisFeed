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

## Phase 12: Portal Navigation & Rich Moves Linking ⏳ PLANNING COMPLETE

**Status:** Planning complete — 12-01-PLAN.md ready for execution (2026-03-27)

**Goal:** Implement navigation portals for suggested moves to enable users to navigate directly to related review content (flashcards, posts, or questions) when tapping suggested moves.

**Plans:** 2/2 plans complete
- [x] 12-01-PLAN.md — moveNavigator utility + screen integration + navigation flows

**Requirements:**
- PLANNER-06: Rich "Moves" linking
- NAV-01: Portal navigation routing
- NAV-02: Context-aware screen parameters

**Success Criteria:**
1. When user taps a suggested move, system navigates to relevant content screen
2. Navigation based on move type: flashcard → ReviewScreen, post → PostDetailScreen, question → QuestionDetailScreen
3. Target screens receive proper context parameters (e.g., conceptId for filtered reviews)
4. Navigation maintains back-stack consistency
5. All existing navigation patterns work without regression

---

## Phase 13: Planner Redesign (Bug Fixes & UX Polish) 📋 PLANNING

**Goal:** Fix Daily Check-in workflow (remove inert threads), improve recommendation algorithm (prioritize weak areas), and clarify Planner UX (sourceSignal context, priority badges).

**Status:** Investigation complete (2026-03-28) — Ready for detailed planning

**Requirements:**
- PLANNER-07: Remove thread data model
- PLANNER-08: Fix signal extraction (confusion vs curiosity)
- PLANNER-09: Improve weak area detection
- PLANNER-10: Clarify UI and add sourceSignal context

**Success Criteria:**
1. Daily Check-in creates actionable chunks (not inert threads)
2. Curiosity signals → post chunks; confusion signals → flashcard chunks
3. Weak areas effectively prioritized (40-50% of concepts identified, +30 boost)
4. UI shows top 5 suggestions by default with [Show All] button
5. Each chunk displays source context ("From check-in: ...")
6. Priority badges (🔴 🟠 🟡 ⚪) show why each chunk was suggested
7. Section renamed to "Your Learning Progress" for clarity
8. No regression in existing features

**Plans:** 0 plans (planning in progress)

---

## Phase 14: Knowledge Graph Classification & Anchor Nodes

**Goal:** Fix mindmap branch/cluster name quality by separating classification into a dedicated second LLM call, and introduce concept anchor nodes so the mindmap displays clean concept names instead of raw questions.

**Status:** COMPLETE (2026-03-29)

**Requirements:**
- GRAPH-01: Dedicated second LLM classification call (post-filterQuestion gate)
- GRAPH-02: Second call receives question + existing tree structure (branches/clusters)
- GRAPH-03: `decideIngestionOutcome` stripped to outcome + targetNodeId only
- GRAPH-04: Concept anchor nodes (LLM-created, clean noun names)
- GRAPH-05: Q&A attachment via parentId + append-only anchor nodeSummary
- GRAPH-06: Mindmap renders anchors only with Mind-Elixir expand/retract

**Plans:** 5/4 plans complete
- [x] 14-01-PLAN.md — Strip knowledgeDecision from first call, strip IngestionDecision labels, add anchor type fields
- [x] 14-02-PLAN.md — Second classification LLM call, anchor creation, Q&A attachment logic
- [x] 14-03-PLAN.md — Mindmap renders anchor nodes only with Mind-Elixir expand/retract

**Success Criteria:**
1. Branch and cluster names in the mindmap reflect actual academic domains (e.g., "Psychology", "Machine Learning") — not generic fallbacks like "Your concepts" or "Concept cluster"
2. First LLM call JSON schema contains no `knowledgeDecision` field
3. `decideIngestionOutcome` returns only `{ outcome, targetNodeId? }` — zero label fields
4. Second LLM call fires only when `filterQuestion` confirms `flagged !== true`
5. Second call context includes current branch/cluster tree, not candidate node labels
6. Anchor nodes (isAnchorNode: true) created with clean concept names; Q&As attach via parentId
7. Mindmap leaf nodes are anchor nodes only; Q&As visible via expand/retract
8. Anchor nodeSummary grows as `[qa-id] ≤80-word summary` entries appended on each Q&A attachment
9. No regression in existing ask flow, spaced repetition, or flashcard generation

---

## Phase 15: Cluster Detail System ✓ COMPLETE

**Goal:** Extend the anchor detail system (bottom panel, detail page, review buttons) to cluster-level nodes, so users can view aggregated Q&As and summaries from all child anchors, review flashcards across an entire cluster, and generate post essays from cluster-wide knowledge.

**Status:** COMPLETE (2026-03-29)

**Plans:** 3/3 plans complete
- [x] 15-01-PLAN.md — Type extensions + cluster creation in classifyAndAnchor + reflection tree + guards (COMPLETE 2026-03-29)
- [x] 15-02-PLAN.md — GraphScreen cluster node rendering + bottom panel
- [x] 15-03-PLAN.md — ClusterDetailScreen + route + ReviewScreen clusterReview + breadcrumb navigation

**Requirements:**
- CLUSTER-01: Cluster nodes stored as Question entities with isClusterNode flag
- CLUSTER-02: Bottom detail panel on cluster node tap in mindmap graph
- CLUSTER-03: Cluster detail page aggregating Q&As and summaries from all child anchors
- CLUSTER-04: Review Flashcards button gathering cards from all child anchors' Q&As
- CLUSTER-05: Learn as Post button generating essay from cluster-wide nodeSummary entries
- CLUSTER-06: Breadcrumb cluster label navigates to cluster detail page

**Success Criteria:**
1. Cluster nodes exist as stored entities with `isClusterNode: true` and metadata
2. Tapping a cluster node in the mindmap shows a bottom detail panel with cluster name, total Q&A count, and "View details" CTA
3. Cluster detail page at `/cluster/:id` displays all Q&As and summaries from every child anchor
4. "Review Flashcards" button on cluster detail filters and launches review for all Q&As across child anchors
5. "Learn as Post" button generates an essay using only `nodeSummary` entries from child anchors
6. Cluster label in anchor detail breadcrumb is tappable and navigates to cluster detail page
7. No regression in existing anchor detail, graph rendering, or ask flow

---

## Phase 16: Token Optimization

**Goal:** Reduce LLM token consumption via append-only session history (enabling KV-cache hits) and add pluggable token usage monitoring with per-service breakdown in Settings > Developer.

**Status:** Planning complete

**Requirements:**
- D-01: Restructure askStreaming/ask to send full session history as append-only message array
- D-02: Remove "3 recent global Q&As" hack from system prompt
- D-03: Wire session history from existing sessionService (no new storage)
- D-04: Enable provider-side KV-cache via stable message prefix
- D-05: No system prompt trimming needed (only Q&A flow changes)
- D-06: Leave maxTokens defaults as-is (4096/8192)
- D-07: Token usage tracker in Settings > Developer with per-service breakdown
- D-08: Parse usage from API responses (not client-side estimation)
- D-09: Pluggable TokenUsageReporter interface (local now, remote-ready)

**Depends on:** Phase 15

**Plans:** 3/3 plans complete

Plans:
- [x] 17-00-PLAN.md — Wave 0 test scaffold for youtube.service.ts
- [x] 16-01-PLAN.md — Session history wiring for askStreaming and ask (remove global Q&A hack)
- [x] 16-02-PLAN.md — Token usage service + provider usage extraction in llm/index.ts
- [x] 16-03-PLAN.md — Call site serviceName tagging + Token Usage UI in Settings

**Success Criteria:**
1. askStreaming and ask send append-only session history enabling KV-cache
2. "3 recent global Q&As" hack fully removed from both call sites
3. Knowledge graph candidate context preserved in system prompt
4. TokenUsageReporter interface is pluggable (local implementation, remote-ready)
5. All 15 LLM call sites tagged with serviceName for per-service tracking
6. Settings > Developer shows token usage table with per-service breakdown
7. maxTokens values unchanged (4096 default, 8192 for reorganization)
8. No regression in any existing LLM call behavior

---

## Phase 17: Auto-fetch Online Videos for Posts

**Goal:** Auto-search YouTube for educational videos based on concepts due for review (SM-2 schedule), and present them as a new video post type mixed into the existing feed with embedded YouTube player and AI-generated transcript summaries.

**Status:** Planning complete

**Requirements:**
- D-01: Auto-search YouTube based on concepts due for review (SM-2 schedule)
- D-02: Use YouTube Data API v3 (free tier: 10,000 quota units/day)
- D-03: Generate 3 video posts on initial load, 4 on pull-for-more
- D-04: Video posts mix into existing feed alongside AI-generated posts
- D-05: Embed YouTube videos via iframe in Capacitor WebView
- D-06: Detail page shows embedded video player + AI-generated summary
- D-07: Add sourceType 'video' to PostSnapshot type
- D-08: Use YouTube thumbnail as card image (no AI image generation)
- D-09: Generate summary from video transcript via YouTube captions/Innertube
- D-10: Use chatCompletion to summarize transcript (serviceName: 'video-summary')

**Depends on:** Phase 16

**Plans:** 4/4 plans complete

Plans:
- [x] 17-00-PLAN.md — Wave 0 test scaffold for youtube.service.ts
- [x] 17-01-PLAN.md — Type extensions (VideoMetadata, sourceType 'video') + youtube.service.ts
- [x] 17-02-PLAN.md — Feed interleaving in concept-feed.service.ts + video card UI in InfoFlow
- [ ] 17-03-PLAN.md — YouTubeEmbed component + PostDetailScreen video variant + Settings API key

**Success Criteria:**
1. YouTube search finds educational videos based on SM-2 due concepts
2. 3 video posts appear on initial feed load, 4 more on pull-for-more
3. Video posts interleave with AI posts in the home feed
4. Video cards show YouTube thumbnails with play icon overlay and 'Video' badge
5. Post detail page shows embedded YouTube player with AI-generated transcript summary
6. YouTube API key configurable in Settings
7. Feed degrades gracefully when YouTube API key is not configured
8. No regression in existing feed, post detail, or settings functionality

---

## Phase 18: Feed Redesign, Short Videos & Text-Art Posts

**Goal:** Redesign all feed card faces for cleaner swipe-friendly experience. Add portrait short video posts and text-art notebook posts as new post types. Introduce weighted random feed mix to control image generation cost. Add settings toggle for image generation.

**Status:** Planning complete

**Requirements:**
- FEED-07: Remove badge & context label row from all card types
- FEED-08: Kill preview text when AI image present (image + hook only)
- FEED-09: Text-forward fallback for no-image cards (hook + preview, shorter card)
- FEED-10: Remove keyword tag pills from all card faces
- SHORT-01: Portrait short video card (9:16 thumbnail-dominant, minimal chrome)
- SHORT-02: Direct inline play on tap (no detail page navigation)
- SHORT-03: Brief 1-2 sentence AI takeaway shown below player after tap
- TART-01: Notebook-paper background (white/light yellow, dot grid pattern)
- TART-02: LLM-generated mixed content (questions, facts, quotes) with inline emojis
- TART-03: Same height as image cards for consistent feed rhythm
- MIX-01: Weighted random feed mix (~30% image, 25% text-art, 20% image-less, 25% video/short)
- MIX-02: Settings toggle to enable/disable image generation (no API calls when off)
- VIDEO-01: Apply card cleanup to existing landscape video posts (remove badge row, keyword tags)

**Depends on:** Phase 17

**Plans:** 4 plans

Canonical refs: `.planning/phases/18-feed-redesign-short-videos-text-art-posts/18-CONTEXT.md`

Plans:
- [ ] 18-01-PLAN.md — Type extensions + weighted mix + settings toggle + imageResolved gating
- [ ] 18-02-PLAN.md — Card face cleanup + text-art notebook post rendering
- [ ] 18-03-PLAN.md — Short video posts (YouTube Shorts search + portrait card + inline play)
- [ ] 18-04-PLAN.md — Visual verification checkpoint

---

## Requirement Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 7 | FEED-01, FEED-02, FEED-03, IMAGE-01, IMAGE-02, IMAGE-03 | 6 |
| Phase 8 | FEED-04, FEED-05, FEED-06 | 3 |
| Phase 9 | IMAGE-04, IMAGE-05 | 2 |
| Phase 10 | PLANNER-01, PLANNER-02, PLANNER-03, PLANNER-05 | 4 |
| Phase 11 | PLANNER-04, CARDS-01, CARDS-02, CARDS-03 | 4 |
| Phase 12 | PLANNER-06, NAV-01, NAV-02 | 3 |
| Phase 13 | PLANNER-07, PLANNER-08, PLANNER-09, PLANNER-10 | 4 |
| Phase 14 | GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06 | 6 |
| Phase 15 | CLUSTER-01, CLUSTER-02, CLUSTER-03, CLUSTER-04, CLUSTER-05, CLUSTER-06 | 6 |
| Phase 16 | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09 | 9 |
| Phase 17 | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10 | 10 |
| Phase 18 | FEED-07, FEED-08, FEED-09, FEED-10, SHORT-01, SHORT-02, SHORT-03, TART-01, TART-02, TART-03, MIX-01, MIX-02, VIDEO-01 | 13 |
| **Total** | **64 requirements** | **64** |

---

## Build Dependencies

- **Phase 7** must complete before Phase 8 (image generation needed for carousel)
- **Phase 8** must complete before Phase 9 (post detail page used for regeneration flow)
- **Phase 9** can proceed in parallel with Phase 10
- **Phase 10** should complete before Phase 11 (base suggestions before retry logic)
- **Phase 11** is final polish (card designs, retry UX)
- **Phase 15** must complete before Phase 16 (classifyAndAnchor call sites need to exist)
- **Phase 16** must complete before Phase 17 (token tracking infrastructure needed for video-summary serviceName)
- **Phase 17** must complete before Phase 18 (video post types and YouTube service needed for shorts extension)

## Phase 19: Web Search Integration for Ask and Feed

**Goal:** Add web search capability to Ask screen LLM (tool-use pattern with manual globe toggle and inline citations) and to Home feed (enriched AI posts + new newspaper-style "News" post type with daily background fetch).

**Requirements:**
- WEB-01: LLM tool-use pattern — web_search tool definition in system prompt, LLM decides when to search
- WEB-02: Globe toggle in ChatInput — forces web search when LLM fails to invoke it, sticky until toggled off
- WEB-03: Inline citations [1][2] in responses with collapsible "Sources" section (URLs + titles)
- WEB-04: Web search API provider integration (free tier preferred)
- NEWS-01: Enriched AI posts — existing concept posts get web context during generation
- NEWS-02: New "News" post type — purely web-sourced, related to user's learning concepts
- NEWS-03: Daily background fetch — 2-3 news posts per day, separate from main post generation
- NEWS-04: Newspaper-style card — headline-forward, newsprint texture/serif font, source attribution visible

**Depends on:** Phase 18

**Plans:** 1/4 plans executed

Canonical refs: `.planning/phases/19-web-search-integration-for-ask-and-feed/19-CONTEXT.md`

Plans:
- [ ] TBD (run /gsd:plan-phase 19 to break down)

---

## Requirement Traceability

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 7 | FEED-01, FEED-02, FEED-03, IMAGE-01, IMAGE-02, IMAGE-03 | 6 |
| Phase 8 | FEED-04, FEED-05, FEED-06 | 3 |
| Phase 9 | IMAGE-04, IMAGE-05 | 2 |
| Phase 10 | PLANNER-01, PLANNER-02, PLANNER-03, PLANNER-05 | 4 |
| Phase 11 | PLANNER-04, CARDS-01, CARDS-02, CARDS-03 | 4 |
| Phase 12 | PLANNER-06, NAV-01, NAV-02 | 3 |
| Phase 13 | PLANNER-07, PLANNER-08, PLANNER-09, PLANNER-10 | 4 |
| Phase 14 | GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06 | 6 |
| Phase 15 | CLUSTER-01, CLUSTER-02, CLUSTER-03, CLUSTER-04, CLUSTER-05, CLUSTER-06 | 6 |
| Phase 16 | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09 | 9 |
| Phase 17 | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10 | 10 |
| Phase 18 | FEED-07, FEED-08, FEED-09, FEED-10, SHORT-01, SHORT-02, SHORT-03, TART-01, TART-02, TART-03, MIX-01, MIX-02, VIDEO-01 | 13 |
| Phase 19 | WEB-01, WEB-02, WEB-03, WEB-04, NEWS-01, NEWS-02, NEWS-03, NEWS-04 | 8 |
| **Total** | **72 requirements** | **72** |

---

## Build Dependencies

- **Phase 7** must complete before Phase 8 (image generation needed for carousel)
- **Phase 8** must complete before Phase 9 (post detail page used for regeneration flow)
- **Phase 9** can proceed in parallel with Phase 10
- **Phase 10** should complete before Phase 11 (base suggestions before retry logic)
- **Phase 11** is final polish (card designs, retry UX)
- **Phase 15** must complete before Phase 16 (classifyAndAnchor call sites need to exist)
- **Phase 16** must complete before Phase 17 (token tracking infrastructure needed for video-summary serviceName)
- **Phase 17** must complete before Phase 18 (video post types and YouTube service needed for shorts extension)
- **Phase 18** must complete before Phase 19 (feed mix and presentation styles needed for news post integration)

---

_Created: 2026-03-26 | v1.1 Roadmap | 13 phases | 72 requirements mapped_
