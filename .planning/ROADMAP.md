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

## Phase 11: Planner Retry & Milestone Card Variety ⊘ SKIPPED

**Goal:** Add user control for suggestion regeneration and expand milestone card visual designs.

**Status:** Skipped — superseded by Phase 13 (Planner Redesign) which restructured the Planner UX. Retry and milestone card features were deprioritized in favor of signal-based chunk creation and priority badges.

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
6. Priority badges show why each chunk was suggested
7. Section renamed to "Your Learning Progress" for clarity
8. No regression in existing features

**Plans:** 1/1 plans complete

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

**Plans:** 4/4 plans complete

Canonical refs: `.planning/phases/19-web-search-integration-for-ask-and-feed/19-CONTEXT.md`

Plans:
- [x] TBD (run /gsd:plan-phase 19 to break down) (completed 2026-04-05)

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

## Phase 20: Orchestration Strategy & Diagnostic Dialogue

**Goal:** Formalize the trajectory-to-planner pipeline with an OrchestrationStrategy interface for decentralized learning hints. Enhance Planner check-in into multi-turn Socratic diagnostic dialogue. Replace flat planner suggestions with portal cards linking to posts, flashcards, and questions.

**Requirements:**
- ORCH-01: Define OrchestrationStrategy interface on top of trajectoryAnalyzerService
- ORCH-02: Feed service consumes strategy hints to bias post selection toward weak areas
- ORCH-03: Planner scoring incorporates strategy hints (retrieval vs discovery mode)
- DIAG-01: Multi-turn Socratic check-in — LLM asks follow-up questions based on extracted signals
- DIAG-02: Conversation rendered within existing PlannerScreen check-in UI
- DIAG-03: Check-in signals (confusion, curiosity, confidence) update after each turn
- PORTAL-01: Replace flat planner suggestions with portal cards
- PORTAL-02: Portal card shows topic, description, and quick-access links to related posts/flashcards/questions
- PORTAL-03: Portal card navigation uses existing moveNavigator pattern

**Depends on:** Phase 19

**Plans:** 1/4 plans executed

Canonical refs: `.planning/phases/20-orchestration-strategy-diagnostic-dialogue/20-CONTEXT.md`

Plans:
- [x] 20-01-PLAN.md — OrchestrationStrategy interface + defaultStrategy + tests (ORCH-01)
- [ ] 20-02-PLAN.md — Diagnostic dialogue service + tests (DIAG-01, DIAG-03)
- [x] 20-03-PLAN.md — Strategy consumers: scorer + feed bias (ORCH-02, ORCH-03)
- [ ] 20-04-PLAN.md — PortalCard + DiagnosticChat + PlannerScreen integration (DIAG-02, PORTAL-01-03)

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
| Phase 20 | ORCH-01, ORCH-02, ORCH-03, DIAG-01, DIAG-02, DIAG-03, PORTAL-01, PORTAL-02, PORTAL-03 | 9 |
| **Total** | **81 requirements** | **81** |

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
- **Phase 19** must complete before Phase 20 (web search enrichment needed for strategy-driven content selection)

## Phase 21: Review Cap Fix & Generate-on-Enter Posts

**Goal:** (1) Remove the hard `dailyLimit` cap from the review queue, repurpose as daily goal with progress indicator. (2) Rework post generation to card-face-only at feed time, deferring essay body + metadata to on-demand streaming LLM calls when user opens a post — saving tokens and dramatically reducing feed load time.

**Requirements:**

*Review Cap:*
- REVIEW-01: `getTodayReviewItems()` returns all due cards (remove `.slice(0, limit)`)
- REVIEW-02: Review count badges on Home/Planner show true due count
- REVIEW-03: Daily goal progress bar in ReviewScreen (e.g., "12/20 reviewed today")
- REVIEW-04: Rename setting from "Daily Limit / Max cards per day" to "Daily Goal"
- REVIEW-05: Raise default from 20 to 50

*Generate-on-Enter Posts:*
- POST-01: Strip `bodyMarkdown` from batch feed generation LLM call — generate only card-face fields (title, teaser hook/preview, keywords, contextLabel, sourceType, narrativeMode)
- POST-02: On-enter streaming LLM call in PostDetailScreen — generates bodyMarkdown, whyCare, takeaway, quickAskPrompts, streamed into pre-built UI shell
- POST-03: Pre-built detail page UI shell (heading, essay container, follow-up section) renders independently of LLM content — no layout shift or broken UI during streaming
- POST-04: Cache generated essay to DB/localStorage on completion so re-visits are instant
- POST-05: Video posts — keep transcript fetch in background, defer LLM summary (serviceName: 'video-summary') to on-enter streaming call
- POST-06: News posts — keep web search in background, defer LLM summary to on-enter streaming call
- POST-07: Text-art posts get a detail page with vivid, story-focused or conversation-focused essay (generated on-enter)
- POST-08: Error state with retry button if on-enter LLM call fails

**Depends on:** None (independent fix)

**Success Criteria:**
1. All due flashcards visible in review queue; daily goal progress shown (not hard cap)
2. Feed loads in <3s (card-face-only generation, no essay bodies)
3. Opening any post streams essay body into pre-rendered UI shell — first words visible in <1s
4. UI shell (heading, body container, follow-up section) renders before LLM response begins — incomplete/streaming response never damages layout
5. Generated essays cached and persist across re-visits
6. Video post detail streams transcript summary on-enter (transcript pre-fetched in background)
7. News post detail streams summary on-enter (web search results pre-fetched in background)
8. Text-art posts open a detail page with story/conversation-focused essay
9. No regression in existing feed, post detail, or review functionality

**Plans:** 3 plans (2 waves)

Plans:
- [ ] 21-01-PLAN.md — Review cap removal + daily goal progress (REVIEW-01..05)
- [ ] 21-02-PLAN.md — Card-face-only batch generation + post-essay service + video/news deferrals (POST-01, POST-04..06)
- [ ] 21-03-PLAN.md — PostDetailScreen on-enter streaming + UI shell + caching + error handling (POST-02, POST-03, POST-07, POST-08)

### Phase 22: Swipe Navigation Between First-Level Screens

**Goal:** Enable horizontal swipe gestures to switch between the 5 top-level tabs (Home, Planner, Ask, Graph, Settings) with real-time bottom nav tracking, slide animations, gesture conflict resolution, and always-mounted screen strategy.

**Requirements:**
- SWIPE-01: Axis lock after ~10px — horizontal wins for swipe, vertical wins for scroll
- SWIPE-02: Swipe threshold at 20% screen width — below snaps back, above commits
- SWIPE-03: Rubber-band resistance at edges (Home left, Settings right)
- SWIPE-04: Keyboard-open suppresses swipe (Ask screen input focus)
- SWIPE-05: Nested draggable suppression (PostCarousel, mind-elixir canvas)
- SWIPE-06: All 5 screens always-mounted with display toggling
- SWIPE-07: GraphScreen eager-loaded (remove React.lazy)
- SWIPE-08: Bottom nav real-time highlight tracking proportional to drag
- SWIPE-09: Tab tap triggers slide animation (not instant), non-adjacent skips intermediates
- SWIPE-10: Sub-screens disable swipe, render via Outlet overlay

**Depends on:** Phase 21

**Plans:** 2/2 plans complete

Plans:
- [x] 22-01-PLAN.md — Pure swipe logic functions + tests + SwipeTabContainer + context
- [x] 22-02-PLAN.md — App.tsx restructuring + BottomNavigation tracking + gesture conflict attributes + visual verification

### Phase 23: Incremental Mindmap Classification with KV Cache and Ask Rate Limiter

**Goal:** Replace the single-call mindmap classification with an incremental 3-step LLM pipeline (branch -> cluster -> anchor) that leverages KV cache for cost efficiency at scale. Add a configurable monthly rate limiter for user Q&A streaming requests on the Ask screen.

**Requirements:**
- PIPE-01: 3-step sequential LLM pipeline (branch -> cluster -> anchor) with append-only conversation threading
- PIPE-02: Index-based selection format (bare integer or {"index":"NEW","name":"..."})
- PIPE-03: Stable system prompt (no dynamic content) for KV cache maximization
- PIPE-04: Short-circuit on NEW -- skip remaining steps, create downstream nodes in code
- PIPE-05: Retry failed step once, then fall back to existing single-call classifyAndAnchor
- PIPE-06: No partial commits -- collect all 3 decisions before creating/attaching nodes
- PIPE-07: Old classifyAndAnchor kept as fallback, not removed
- RATE-01: Monthly quota model tracking askStreaming requests per calendar month
- RATE-02: Only counts user Q&A streaming requests (not system LLM calls)
- RATE-03: Off by default (0 = unlimited)
- RATE-04: Combined "Usage" section in Settings (renamed from "Token Usage") with count, limit, reset date
- RATE-05: Inline banner in Ask screen at 80%+ of limit
- RATE-06: Hard block when limit reached -- send button disabled

**Depends on:** Phase 22

**Plans:** 3/3 plans complete

Plans:
- [x] 23-01-PLAN.md -- Pipeline helpers + classifyAndAnchorIncremental function (PIPE-01..07)
- [x] 23-02-PLAN.md -- Rate limiter service + type extensions + Settings Usage UI (RATE-01..06)
- [x] 23-03-PLAN.md -- Wire pipeline + rate limiter into callers (useQuestions, question.service, AskScreen)

**Success Criteria:**
1. Classification uses 3-step incremental pipeline with KV cache-friendly append-only messages
2. Short-circuit on NEW skips remaining steps
3. Failed pipeline falls back to existing single-call classifyAndAnchor
4. Monthly rate limiter tracks and optionally caps askStreaming requests
5. Settings "Usage" section shows monthly count, limit, token usage
6. Ask screen shows warning at 80%+, blocks at 100% with disabled send button
7. No regression in existing ask flow, mindmap rendering, or settings functionality


### Phase 24: Retroactive Verification & Documentation Gap Closure

**Goal:** Close audit gaps by creating missing VERIFICATION.md files for phases 20 and 21, generating missing SUMMARYs (20-04, 21-03), completing Phase 23 Nyquist validation, and deferring out-of-scope requirements to v1.2.

**Gap Closure:** Closes gaps from v1.1-MILESTONE-AUDIT.md

**Requirements:**
- DIAG-02: Verify DiagnosticChat wired to PlannerScreen (Phase 20)
- PORTAL-01, PORTAL-02, PORTAL-03: Verify PortalCard implementation (Phase 20)
- POST-02: Verify PostDetailScreen on-enter streaming (Phase 21)

**Plans:** 3/3 plans complete

Plans:
- [ ] 24-01-PLAN.md — Phase 20 VERIFICATION.md + 20-04-SUMMARY.md (DIAG-02, PORTAL-01..03)
- [ ] 24-02-PLAN.md — Phase 21 VERIFICATION.md + 21-03-SUMMARY.md (POST-02)
- [x] 24-03-PLAN.md — Phase 23 VALIDATION.md completion + REQUIREMENTS.md deferrals

**Success Criteria:**
1. Phase 20 VERIFICATION.md exists with status: passed or human_needed
2. Phase 21 VERIFICATION.md exists with status: passed or human_needed
3. Phase 23 VALIDATION.md has nyquist_compliant: true
4. REQUIREMENTS.md deferred items moved to Future section
5. Re-audit passes with no requirement gaps

### Phase 25: Anime knowledge tree for Planner page — motivational review visualization

**Goal:** Ship a motivational Ghibli-aesthetic "Trellis" hero on PlannerScreen that visualizes review health as a vine garden (leaves change color per overdue status, bloom when mastered, bear fruit after sustained mastery). Build three switchable rendering variants (A: static image + SVG, C: pure SVG, V: loop video + SVG) sharing one data layer, so the best variant can be picked from empirical comparison.

**Requirements**: PHASE-25-WAVE-0, PHASE-25-DATA-LAYER, PHASE-25-VARIANT-C, PHASE-25-VARIANT-A, PHASE-25-VARIANT-V, PHASE-25-POLISH-AND-INTEGRATION
**Depends on:** Phase 24
**Plans:** 1/6 plans complete

Plans:
- [x] 25-00-PLAN.md — Wave 0 foundations: AppEvent types, blossom-date persistence, asset directory with AI-prompt README, REVIEW_COMPLETED bridge
- [ ] 25-01-PLAN.md — Data layer: seeded PRNG + vine/leaf layout + state aggregation + useTrellisData hook
- [ ] 25-02-PLAN.md — Variant C (pure SVG): TrellisHero + TrellisCanvas + TrellisLeaf + TrellisTooltip + TrellisEmptyState + PlannerScreen integration
- [ ] 25-03-PLAN.md — Variant A (static image + SVG) with graceful fallback
- [ ] 25-04-PLAN.md — Variant V (loop video + SVG) with useVideoPauseGuard hook
- [ ] 25-05-PLAN.md — Route-aware sway gate + end-to-end smoke test + final verification

---

_Created: 2026-03-26 | v1.1 Roadmap | 17 phases | 91 requirements mapped_
