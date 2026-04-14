---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: Milestone complete
stopped_at: Completed 25-00-PLAN.md
last_updated: "2026-04-14T23:49:38.502Z"
progress:
  total_phases: 18
  completed_phases: 5
  total_plans: 16
  completed_plans: 16
---

# Project State: Milestone 1.1

## Current Milestone

Milestone v1.1: Engagement & Discovery Iteration

## Milestone Goal

Enhance user engagement through rich post formats (Rednote-style), smarter milestone cards, and automated Planner suggestions.

## Current Phase

Phase 9 - Image Regeneration & Error Handling (next to start)

## Roadmap

- **Phase 7:** Post Feed Redesign & Image Integration (COMPLETE)
- **Phase 8:** Post Detail & Infinite Scroll (COMPLETE — 08-01-PLAN.md)
- **Phase 9:** Image Regeneration & Error Handling (SKIPPED)
- **Phase 10:** Planner Auto-Suggestions Engine (COMPLETE)
- **Phase 11:** Planner Retry & Milestone Card Variety (COMPLETE)
- **Phase 12:** Portal Navigation & Rich Moves Linking (12-01-PLAN.md — COMPLETE, 12-02-PLAN.md — COMPLETE)
- **Phase 13:** Planner Redesign (13-01-PLAN.md — COMPLETE)
- **Phase 14:** Knowledge Graph Classification & Anchor Nodes (14-01-PLAN.md — COMPLETE, 14-02-PLAN.md — COMPLETE, 14-03-PLAN.md — COMPLETE, 14-04-PLAN.md — COMPLETE)

## Latest Decisions

- Redesign Home Feed to image-forward (Rednote-style) with emoji/text overlays
- Generate multiple image styles per post (infograph, illustration, photo-style)
- Multi-provider image integration (Nano Banana + Gemini)
- Scroll-release (explicit action) to load more posts
- Post detail page with image carousel (multiple generated images)
- Auto-generate Planner suggestions when Knowledge Graph has 5+ nodes AND Planner is empty
- Daily auto-refresh after podcast time
- 3+ distinct milestone card designs with rotation
- All image generation failures handled gracefully with retry options
- [Phase 7] NanoBanana provider is a structurally complete placeholder with mock SVG fallback
- [Phase 7] Image cache uses localStorage LRU (50MB/30d TTL), no SQLite (consistent with app-wide pattern)
- [Phase 7] ConceptCard owns image generation lifecycle (useEffect) rather than HomeScreen
- [Phase 8] PostCarousel uses Framer Motion drag=x with 50px threshold (no custom touch listeners)
- [Phase 8] infiniteScrollService wraps conceptFeedService.generateMorePosts() (no new batch API)
- [Phase 8] HomeScreen wrapped in 100dvh scroll container for containerRef attachment
- [Phase 8] questionsRef pattern for stable onLoadMore callback (prevents scroll listener reset)
- [Phase 10-02] useDailyRefresh called without return capture in PlannerScreen to satisfy noUnusedLocals TypeScript config
- [Phase 10-02] savePlannerRefreshEnabled/Time wrappers persist settings immediately to localStorage on every change

## Latest Decisions (Phase 10-03)

- [Phase 10-03] totalSuggestions hoisted to component level (not IIFE) so CTA can reference it outside the section block
- [Phase 10-03] handleSkipAll wraps skipAll() + toast so UAT Test 6 Skip All toast is verifiable
- [Phase 10-03] Refresh button always rendered (no autoMoves.length guard) so UAT Test 7 Refresh is always accessible
- [Phase 12-01] Centralized move routing in moveNavigator.ts utility (not inline in components)
- [Phase 12-01] MoveNavigationState passed via location.state (React Router 7 pattern)
- [Phase 12-01] ReviewScreen filters items by linkedResource.id (nodeId match) when from move navigation
- [Phase 12-01] PostDetailScreen back button navigates to -1 when moveState present (returns to Planner)
- [Phase 12-02] deepdive moves route to PostDetailScreen at /posts/:id (not AskScreen at /ask/:id)
- [Phase 12-02] NAV-01 and NAV-02 registered in REQUIREMENTS.md as checked [x] — implemented in Phase 12

## Last Session

Completed Phase 25 Plan 00 (25-00-PLAN.md) — Wave 0 Foundations
**Stopped At:** Completed 25-00-PLAN.md
**Date:** 2026-04-14

## Latest Decisions (Phase 25-00)

- [Phase 25-00] questionService imported at top-level in review.service.ts (already present), no dynamic import needed for anchor resolution
- [Phase 25-00] REVIEW_COMPLETED emitted synchronously after REVIEW_SUBMITTED using existing questionService.getAll() for anchor lookup
- [Phase 25-00] Blossom date service uses trellis_blossom_dates localStorage key, separate from review schedule storage

## Latest Decisions (Phase 16-03)

- [Phase 16-03] serviceName tags across all 15 LLM call sites: ask(x3 — useQuestions, question.service, post-context-qa), filter(x1), classification(x2, preserving maxTokens:8192 on reorganization call), posts(x4 — concept-feed), planner(x2), podcast(x1), flashcards(x1), title(x1 — AskScreen generateSessionTitle)
- [Phase 16-03] Token Usage state initialized via useState lazy initializer (not useEffect) — loads once at mount; explicit Refresh button for re-pull pattern
- [Phase 16-03] handleClearTokenUsage sets local state to {} immediately after tokenUsageReporter.clear() for instant UI feedback without re-reading localStorage

## Latest Decisions (Phase 16-02)

- [Phase 16-02] LocalTokenUsageReporter uses FIFO eviction at 500 records — prevents unbounded localStorage growth
- [Phase 16-02] Usage recording conditional on serviceName — no-op for existing callers; serviceName tagging happens in Plan 03
- [Phase 16-02] Streaming functions accept options pass-through (void options) for future SSE usage extraction
- [Phase 16-02] tokenUsageReporter singleton exported from token-usage.service.ts — swap LocalTokenUsageReporter for remote implementation without touching call sites

## Latest Decisions (Phase 15-03)

- [Phase 15-03] ClusterDetailScreen child anchor lookup uses clusterNodeId primary + branchLabel/clusterLabel fallback for legacy anchors
- [Phase 15-03] clusterReview state passed via navigate for ReviewScreen to filter cards across all child anchor Q&As
- [Phase 15-03] Priority chain in ReviewScreen: anchorFilteredItems ?? clusterFilteredItems ?? moveFilteredItems
- [Phase 15-03] AnchorDetailScreen cluster breadcrumb is tappable only when clusterNodeId exists; legacy anchors stay static span

## Latest Decisions (Phase 15-02)

- [Phase 15-02] buildMindElixirData uses cluster.clusterEntity?.id as NodeObj id (falls back to synthetic ID for clusters without stored entity)
- [Phase 15-02] Bottom panel onClick checks isClusterNode first before isAnchorNode — navigates to /cluster/:id
- [Phase 15-02] Cluster bottom panel shows child anchor names as summary instead of raw cluster label
- [Phase 15-02] childAnchorCount computed inline via IIFE to avoid hoisting to component scope

## Latest Decisions (Phase 15-01)

- [Phase 15-01] Cluster nodes stored as Question entities with isClusterNode=true, mirroring isAnchorNode pattern
- [Phase 15-01] clusterNodeId field added to anchor/Q&A nodes pointing to parent cluster entity ID
- [Phase 15-01] freshQuestions local variable refreshed after cluster creation so anchor resolution sees new cluster
- [Phase 15-01] Cluster entity creation occurs before anchor creation in classifyAndAnchor
- [Phase 15-01] Cluster qaCount aggregated from child anchors filtered by clusterNodeId after anchor update
- [Phase 15-01] buildAnchorReflectionTree skips isClusterNode nodes in both loops; returns clusterEntity per group

## Latest Decisions (Phase 14-04)

- [Phase 14-04] classifyAndAnchor imported directly in useQuestions.ts — no circular dependency since useQuestions.ts is not in canonical-knowledge.service.ts import chain
- [Phase 14-04] questionService.getAll() called at classification time in askStreaming for freshest snapshot (includes just-saved question)
- [Phase 14-04] Fire-and-forget pattern with .catch(console.warn) mirrors question.service.ts ask() exactly

## Latest Decisions (Phase 14-03)

- [Phase 14-03] buildAnchorReflectionTree added alongside buildReflectionTree — mindmap renders anchors as collapsed cluster leaves with Q&A children
- [Phase 14-03] Anchor NodeObj uses expanded=false; mind-elixir built-in expand/collapse requires no extra code
- [Phase 14-03] Legacy Q&As without anchor parents rendered directly as cluster leaves — full backward compatibility
- [Phase 14-03] Detail panel cursor:default and no 'View details' chevron for anchor nodes to signal non-navigable

## Latest Decisions (Phase 14-02)

- [Phase 14-02] classifyAndAnchor lazy-imports questionService via dynamic import to prevent circular dependency
- [Phase 14-02] Second classification call fire-and-forget after flagged check — labels patched asynchronously
- [Phase 14-02] Anchor creation writes directly to localStorage (same echolearn_questions key) to avoid re-entrant ask() logic
- [Phase 14-02] loadStore() called fresh at classifyAndAnchor invocation time for most current snapshot
- [Phase 14-02] Anchor-first resolution: by anchorId → by name+cluster match → create new

## Latest Decisions (Phase 14-01)

- [Phase 14-01] IngestionDecision stripped to outcome+targetNodeId only — labels come from dedicated second call (Plan 02)
- [Phase 14-01] First LLM call schema now requests shortSummary (<=80 words) instead of knowledgeDecision
- [Phase 14-01] formatCandidateContextPack feedback loop removed from ask() system prompt — was source of vague branch names
- [Phase 14-01] Anchor nodes excluded from projectQuestionsToKnowledgeNodes via isAnchorNode===true guard
- [Phase 14-01] ClassificationResult interface exported with anchorName+anchorId for Plan 02 consumption

## Latest Decisions (Phase 13-01)

- [Phase 13-01] PlannerThread interface deleted — chunks are the single source of truth for all learning actions
- [Phase 13-01] Signal-aware chunk creation: confusion→repair, curiosity→connect, connection→connect, revisit→retrieve
- [Phase 13-01] sourceSignal + sourceText fields added to PlannerChunk for full provenance tracking
- [Phase 13-01] Weak area boost increased from +15 to +30; detection expanded to 3 signals (easeFactor<2.0, overdue+declining, never-reviewed)
- [Phase 13-01] Top 5 suggestions shown by default with Show All toggle in PlannerScreen
- [Phase 13-01] Priority badges (WEAK AREA/OVERDUE/ACTIVE/EXPLORE) derived from relevanceScore thresholds 75/60/45

### Phase 12: NEW

- Requirement: PLANNER-06 (Rich Moves linking) — moved from Phase 11
- Purpose: Navigate suggested moves to target content (flashcards, posts, questions)
- Architecture: moveNavigator utility + SuggestedMovesSection integration
- Effort: 8-12 hours (4 waves)
- Removed from Phase 11: PLANNER-06; Phase 11 now covers only PLANNER-04 + CARDS-01/02/03

## Latest Decisions (Phase 16-01)

- [Phase 16-01] sessionHistory parameter is optional — all existing callers not passing it continue to work unchanged
- [Phase 16-01] priorMessages uses slice(0,-1) to exclude just-appended user message preventing LLM duplication
- [Phase 16-01] historyMessages conversion maps SessionMessage type field (user/ai) to ChatMessage role field (user/assistant) for KV-cache threading

## Accumulated Context

### Roadmap Evolution

- Phase 16 added: token optimization
- Phase 18 added: Feed Redesign, Short Videos & Text-Art Posts
- Phase 19 added: Web Search Integration for Ask and Feed
- Phase 20 added: Orchestration Strategy & Diagnostic Dialogue (from original Milestone 2 ROADMAP.md Phases 17-18, renumbered)
- Phase 22 added: Swipe navigation between first-level screens
