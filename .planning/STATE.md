---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: Executing Phase 28
stopped_at: Completed 27-01-PLAN.md
last_updated: "2026-04-16T08:29:24.588Z"
progress:
  total_phases: 22
  completed_phases: 6
  total_plans: 35
  completed_plans: 28
---

# Project State: Milestone 1.1

## Current Milestone

Milestone v1.1: Engagement & Discovery Iteration

## Milestone Goal

Enhance user engagement through rich post formats (Rednote-style), smarter milestone cards, and automated Planner suggestions.

## Current Phase

Phase 27 — Add i18n/L10n support (Plan 01 of 07 complete — Foundation + Wave 0 landed)

## Roadmap

- **Phase 7:** Post Feed Redesign & Image Integration (COMPLETE)
- **Phase 8:** Post Detail & Infinite Scroll (COMPLETE — 08-01-PLAN.md)
- **Phase 9:** Image Regeneration & Error Handling (SKIPPED)
- **Phase 10:** Planner Auto-Suggestions Engine (COMPLETE)
- **Phase 11:** Planner Retry & Milestone Card Variety (COMPLETE)
- **Phase 12:** Portal Navigation & Rich Moves Linking (12-01-PLAN.md — COMPLETE, 12-02-PLAN.md — COMPLETE)
- **Phase 13:** Planner Redesign (13-01-PLAN.md — COMPLETE)
- **Phase 14:** Knowledge Graph Classification & Anchor Nodes (14-01-PLAN.md — COMPLETE, 14-02-PLAN.md — COMPLETE, 14-03-PLAN.md — COMPLETE, 14-04-PLAN.md — COMPLETE)

## Latest Decisions (Phase 27-01)

- [Phase 27-01] i18next@26.0.5 + react-i18next@17.0.3 + @capacitor/device@8.0.2 installed; sync init from main.tsx (side-effect `import './locales'` before createRoot) — no Suspense flash
- [Phase 27-01] Static-imported 4 JSON bundles (en canonical, zh/es/ja parity stubs duplicating EN values — Plan 07's Sonnet subagent replaces values); bundle-parity test green today
- [Phase 27-01] Type-safe t() via module augmentation (Option A from RESEARCH.md) — typo in `t('home.titlee')` fails tsc compile
- [Phase 27-01] TDD inversion: lib/locale.ts landed in Task 1 (not Task 2) because locales/index.ts imports it and Task 1 acceptance requires tsc/build exits 0; Task 2 retrofits TDD test coverage
- [Phase 27-01] UserPreferences.locale staged optional (Task 1) → required (Task 3) so each task commit compiles standalone; legacy `language` kept as @deprecated for one-time migration only
- [Phase 27-01] Legacy migration in settings.service.load(): if stored `preferences.language` exists and `locale` is missing, normalize (toLowerCase, split-'-', allowlist check) to 'en'/'zh'/'es'/'ja'; unsupported → 'en'
- [Phase 27-01] SUPPORTED_LOCALES duplicated in lib/locale.ts to break circular import with locales/index.ts (per plan Task 2 NOTE)
- [Phase 27-01] SupportedLocale inlined in types/index.ts (no cross-module dependency from types/ to locales/)
- [Phase 27-01] resolveJsonModule + allowSyntheticDefaultImports added to tsconfig.app.json for JSON imports under strict verbatimModuleSyntax
- [Phase 27-01] Node 25 globalThis.navigator is a read-only getter; tests use Object.defineProperty with configurable:true for shimming (also applied to globalThis.localStorage)
- [Phase 27-01] Wave 0 suite: 11 test files total (4 live + 6 Plan-02/04 skeletons + 1 TDD via Task 2); 21 live cases pass in ~280ms; 6 skeletons have placeholder assertions with TODO markers
- [Phase 27-01] Pre-existing Node 25 TS-stripping failures (affecting tests that transitively import src/providers/llm/index.ts → token-usage.service) logged to deferred-items.md, out of scope
- [Phase 27-01] Pre-existing 8 tsc errors in GraphScreen/canonical-knowledge/review/trellis-state files — not introduced by Phase 27-01; logged to deferred-items.md

## Latest Decisions (Phase 28)

- [Phase 28] Scope = full audit (Waves A+B+C+D) per user selection; P0 showstoppers, visual chrome, trellis interaction + naming, P2 micro-polish all included
- [Phase 28] A-2 SwipeTabContainer desync root cause hypothesis: screenWidthRef captured once, never refreshes on visualViewport resize (keyboard/rotation/browser chrome); fix = resize + visualViewport.resize listeners + re-snap stripX when not mid-gesture + dev invariant
- [Phase 28] Sub-screen bottom nav hides via slide-down animation (~200ms spring, reusing SwipeTabContainer SPRING constant) when isTopLevelScreen=false; 5 screens stay mounted per Phase 22 D-11
- [Phase 28] Sub-screen Header gets scroll-aware shadow (--shadow-1 when scrollTop > 4px); background already opaque --surface, no border needed
- [Phase 28] Trellis leaf shake = 300ms rotate variant (0° → +4° → -4° → +2° → 0°) + hapticImpactLight on tap (any state); purely decorative, no tooltip/nav/sheet — preserves "no new mental model"
- [Phase 28] Trellis pulse-on-focus = scale 1→1.15→1 (600ms) + drop-shadow glow (--primary-40, 2s fade) when Suggested Move row tap matches anchorId; clears on action or navigate
- [Phase 28] Leaf animation perf guard: when leaves.length > 30, shake/pulse run only on viewport-visible leaves (IntersectionObserver or whileInView) — extends Phase 25 D-55 convention
- [Phase 28] "Mind Map" → "Knowledge Graph" rename via graph.title key in all 4 locale bundles (en/zh/es/ja) using Phase 27 Sonnet-subagent workflow; graceful degradation to direct string edit + TODO comment if Phase 27 key-extraction hasn't run
- [Phase 28] Withdrawn audit findings (Dev Mode default, Suggested Moves debug labels, harvest chip decrement) NOT in scope — were Dev-Mode-enabled artifacts, not bugs
- [Phase 28] Depends on Phase 27 (i18n scaffold); planner may split into 2 plans (A+B, then C+D)

## Latest Decisions (Phase 26-04)

- [Phase 26-04] PlannerScreen Suggested Moves refactored to trellis-first ordering: dead (Re-plant) → dying (Heal) → filtered autoGen; suggestedChunks/ChunkCard system deleted entirely (D-22)
- [Phase 26-04] dyingDeadIds Set built per render filters autoMoves by conceptId — deterministic dedup (D-23) without service-layer changes to plannerAutoGen
- [Phase 26-04] deadNodes/dyingNodes/filteredAutoMoves derived as plain const (no useMemo) — cheap filters on small layout.nodes list, correct re-derivation on every render
- [Phase 26-04] visibleAutoMoves uses `Math.max(0, TOP_N - trellisCount)` to keep TOP_N total visible across priority groups (never negative)
- [Phase 26-04] usePlanner hook marked @deprecated (not deleted) — retains compatibility for lingering imports while signalling removal intent
- [Phase 26-04] Skip-all button gated on filteredAutoMoves.length (not autoMoves.length) so it hides when only trellis rows remain — trellis rows require explicit Heal/Prune/Re-plant per D-11..D-18
- [Phase 26-04] Ripe fruits (leafState === 'fruit') excluded from Suggested Moves by filter construction — harvesting remains exclusive to TrellisStatusPanel (D-21)

## Latest Decisions (Phase 26-03)

- [Phase 26-03] heal()/replant() return navigation intents ({ navigateTo, state }) instead of calling navigate() — keeps service pure, component owns sheet-close timing
- [Phase 26-03] replant() resets BOTH flashcard schedules (authoritative per fcMap in computeLeafState) AND Question.lastReviewedAt (fallback signal) so anchor can return to 'bud' state
- [Phase 26-03] replant() awaits conceptFeedService.generateMorePosts wrapped in try/catch so post generation never blocks review navigation
- [Phase 26-03] prune() reuses existing ANCHOR_DELETED event instead of defining PRUNE_COMPLETED — same trellis recompute path, reversible via unpruneQuestion
- [Phase 26-03] unpruneQuestion() emits CLASSIFICATION_COMPLETED with empty anchorName — subscriber only uses event type for recompute, payload is cosmetic
- [Phase 26-03] Prune animation delays flagged flip by 800ms (300ms scissors cut + 500ms leaf fall) so visual completes before row disappears
- [Phase 26-03] Pruned archive lives below the 3-column panel (not inside a sheet) so archive count is always visible
- [Phase 26-03] Two-button row layout (primary action + Prune) extracted as renderActionableItem closure — shared between dying and dead sheets

## Latest Decisions (Phase 26-02)

- [Phase 26-02] Dying bucket = leafState yellow ∪ falling (D-08) — merged into a single "needs attention" column
- [Phase 26-02] Fruit glow pulses via scoped `<style>` + status-glow keyframe; only active when fruitNodes.length > 0
- [Phase 26-02] Fly-to-counter vector measured at click time (getBoundingClientRect on both panel and counter refs) so layout shifts don't strand particles
- [Phase 26-02] Particle count capped at Math.min(count, 8) to avoid visual noise on large harvests
- [Phase 26-02] Celebration choreography unified per D-03: 1s fly-to-counter → 1.2s delay → 3.5s confetti
- [Phase 26-02] Computed-key cast `['--fly-dx' as string]` preferred over `@ts-expect-error` (noUnusedLocals flags the directive as unused when the `as CSSProperties` cast already widens the type)
- [Phase 26-02] Header counter is a `<span ref={counterRef}>` inside a pill div so getBoundingClientRect targets the number glyph, not pill padding

## Latest Decisions (Phase 26-01)

- [Phase 26-01] Credits service stores plain integer strings in localStorage (not JSON) for single-counter simplicity
- [Phase 26-01] BottomSheet overlay uses zIndex 500 to clear app Header at zIndex 190; inline-styles-only convention preserved
- [Phase 26-01] getPrunedQuestions requires both flagged && isAnchorNode so off-topic Q&A flag does not pollute pruned anchor archive
- [Phase 26-01] trellisCreditsService.add clamps to non-negative integers via Math.floor+Math.max to defend against bad callers
- [Phase 26-01] HARVEST_COMPLETED placed after ANCHOR_DELETED in AppEvent union for logical grouping with trellis events

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

Completed Phase 27 Plan 01 (27-01-PLAN.md) — i18next + react-i18next + @capacitor/device installed; sync init from main.tsx; UserPreferences.locale + legacy language migration; 11 Wave 0 test files (21 cases pass in ~280ms)
**Stopped At:** Completed 27-01-PLAN.md
**Date:** 2026-04-16

## Latest Decisions (Phase 25)

- [Phase 25-00] questionService imported at top-level in review.service.ts (already present), no dynamic import needed for anchor resolution
- [Phase 25-00] REVIEW_COMPLETED emitted synchronously after REVIEW_SUBMITTED using existing questionService.getAll() for anchor lookup
- [Phase 25-00] Blossom date service uses trellis_blossom_dates localStorage key, separate from review schedule storage
- [Phase 25] Variant V (video background) removed — user decided against video background variant; only A (image) and C (SVG) remain
- [Phase 25] Learning Check-In section removed from PlannerScreen — redundant with Ask screen; users go there to explore topics
- [Phase 25] Leaf state reads FlashCard review data (via flashcardService.getAll()) as authoritative source — Question.reviewSchedule is never updated by the review flow
- [Phase 25] Legacy questions (not classified as anchors) rendered as standalone trellis leaves with their own state
- [Phase 25] Vine colors use natural green/brown hex tones (#6B8E5A, #8B7355, etc.) not rainbow --node-* CSS vars
- [Phase 25] Background Variant C: diamond cross-hatch lattice with wooden rails, not rectangular grid
- [Phase 25] Leaf shapes are Ghibli-style botanical silhouettes (pointed leaves with veins, sakura blossom, apple fruit) — not colored dots
- [Phase 25] Leaf stems connect to vine via branch lines and rotate toward vine attachment point (stemAngle from layout service)
- [Phase 25] Leaf shapes scaled 1.8x for visibility in 800x400 viewBox

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

## Latest Decisions (Phase 25-02)

- [Phase 25-02] Anchor display name uses title ?? content ?? 'anchor' fallback (Question type has no name field)
- [Phase 25-02] esbuild-based tsx loader hooks for unit testing pure functions from .tsx files with node --test
- [Phase 25-02] TrellisHero renders as topmost content in PlannerScreen above Review Banner
- [Phase 25-02] Ambient sway threshold set to 20 leaves; above threshold only 1-in-3 leaves sway

## Accumulated Context

### Roadmap Evolution

- Phase 16 added: token optimization
- Phase 18 added: Feed Redesign, Short Videos & Text-Art Posts
- Phase 19 added: Web Search Integration for Ask and Feed
- Phase 20 added: Orchestration Strategy & Diagnostic Dialogue (from original Milestone 2 ROADMAP.md Phases 17-18, renumbered)
- Phase 22 added: Swipe navigation between first-level screens
- Phase 26 added: Trellis harvest panel, dying/dead node actions, and suggested moves refactor to reflect trellis status
- Phase 27 added: Add i18n/L10n support
- Phase 28 added: UI/UX polish from audit findings
