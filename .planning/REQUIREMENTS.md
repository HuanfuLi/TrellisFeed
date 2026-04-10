# Milestone v1.1 Requirements

**Engagement & Discovery Iteration**

## Active Requirements

### Post Feed Redesign (FEED)
- [x] **FEED-01**: User can view posts with image-forward design (large image with emoji/text overlay)
- [x] **FEED-02**: AI generates multiple image styles per post (infograph, illustration, photo-style)
- [x] **FEED-03**: Posts display catchy titles/questions/stories as hook text over images
- [x] **FEED-04**: User can scroll through feed and scroll-release to load more posts (explicit action trigger)
- [x] **FEED-05**: User can navigate to post detail page showing image carousel/gallery at top
- [x] **FEED-06**: Post detail displays multiple generated images in carousel before essay content

### Image Generation Integration (IMAGE)
- [x] **IMAGE-01**: System integrates Nano Banana API for AI image generation
- [x] **IMAGE-02**: System integrates Gemini API as fallback image generation provider
- [x] **IMAGE-03**: Images are cached locally to prevent re-generation on app restart
- [ ] ~~**IMAGE-04**: User can trigger image regeneration if unsatisfied with quality~~ _(deferred to v1.2)_
- [ ] ~~**IMAGE-05**: Image generation failures are handled gracefully (error states, retry options)~~ _(deferred to v1.2)_

### Planner Auto-Suggestions (PLANNER)
- [x] **PLANNER-01**: When Knowledge Graph has 5+ nodes AND Planner is empty, system auto-generates "Suggested Moves"
- [x] **PLANNER-02**: Auto-generated suggestions appear on Planner screen without user intervention
- [x] **PLANNER-03**: Suggestions regenerate daily (after podcast time) automatically
- [ ] ~~**PLANNER-04**: User can retry/regenerate suggestions with "Retry" button if unsatisfied~~ _(deferred to v1.2)_
- [x] **PLANNER-05**: Suggestion algorithm considers trajectory: review performance, question frequency, engagement patterns
- [x] **PLANNER-06**: Suggestions link directly to Posts, Questions, or Review sessions (rich "Moves")

### Navigation (NAV)
- [x] **NAV-01**: Move taps navigate to the screen matching the linkedResource type (review→ReviewScreen, post→PostDetailScreen, question→QuestionDetailScreen)
- [x] **NAV-02**: Navigation preserves history stack so back button returns to the originating screen (Planner or Explore)

### Milestone Card Variety (CARDS)
- [ ] ~~**CARDS-01**: System provides 3+ distinct visual designs for milestone cards~~ _(deferred to v1.2 — Phase 11 skipped, superseded by Phase 13)_
- [ ] ~~**CARDS-02**: Cards alternate or shuffle designs to prevent visual fatigue~~ _(deferred to v1.2)_
- [ ] ~~**CARDS-03**: All card designs maintain accessibility and readability standards~~ _(deferred to v1.2)_

### Knowledge Graph Classification (GRAPH)
- [x] **GRAPH-01**: Classification uses a dedicated second LLM call (fired only after filterQuestion confirms Q&A enters mindmap), keeping answer generation and placement decisions separate
- [x] **GRAPH-02**: Second classification call receives the question text, a ≤30-word self-answer for context, most descriptive keyword, and the existing branches/clusters from the tree — never inherits labels from poorly-classified existing nodes
- [x] **GRAPH-03**: `decideIngestionOutcome` returns only `{ outcome, targetNodeId }` — all label fields stripped; labels sourced exclusively from the second call
- [x] **GRAPH-04**: Concept anchor nodes are explicitly created by LLM with a clean noun/concept name (e.g., "Transformer"), separate from individual Q&A leaf nodes
- [x] **GRAPH-05**: Q&A nodes attach to their concept anchor via `parentId`; anchor maintains an append-only `nodeSummary` log of short Q&A summaries (≤80 words each) with Q&A ID bindings
- [x] **GRAPH-06**: Mindmap renders only concept anchor nodes as leaves; individual Q&As are hidden and accessible via Mind-Elixir expand/retract on each anchor node

### Cluster Detail System (CLUSTER)
- [x] **CLUSTER-01**: Cluster nodes stored as Question entities with `isClusterNode: true` flag and metadata (title, nodeSummary, qaCount aggregated from child anchors)
- [x] **CLUSTER-02**: Tapping a cluster node in the mindmap graph shows a bottom detail panel with cluster name, total Q&A count, and "View details" CTA
- [x] **CLUSTER-03**: Cluster detail page at `/cluster/:id` aggregates and displays all Q&As and summaries from every child anchor under the cluster
- [x] **CLUSTER-04**: "Review Flashcards" button on cluster detail gathers flashcards from all Q&As across all child anchors and launches a filtered review session
- [x] **CLUSTER-05**: "Learn as Post" button on cluster detail generates an essay using only `nodeSummary` entries from child anchors
- [x] **CLUSTER-06**: Cluster label in anchor detail breadcrumb is tappable and navigates to the cluster detail page

---

## Requirements by Category

### Feed Engagement (4 requirements)
- FEED-01 through FEED-06: Image-forward feed design, scroll-to-load, post details with image carousel

### Image Generation (5 requirements)
- IMAGE-01 through IMAGE-05: Multi-provider image generation, caching, error handling

### Planner Intelligence (6 requirements)
- PLANNER-01 through PLANNER-06: Auto-generation, daily refresh, retry pattern, trajectory-aware

### Navigation (2 requirements)
- NAV-01 through NAV-02: Move-type routing to correct target screens, history stack preservation

### Visual Variety (3 requirements)
- CARDS-01 through CARDS-03: Multiple card designs, rotation strategy

### Knowledge Graph Classification (6 requirements)
- GRAPH-01 through GRAPH-06: Two-call classification architecture, anchor node schema, Q&A attachment, mindmap rendering of anchors only

### Cluster Detail System (6 requirements)
- CLUSTER-01 through CLUSTER-06: Cluster node storage, bottom panel, detail page, flashcard review, post generation, breadcrumb navigation

---

## Future Requirements (Deferred)

These may be considered for v1.2+:

### Deferred from v1.1

- [ ] **IMAGE-04**: User can trigger image regeneration if unsatisfied with quality _(deferred from v1.1 Phase 9)_
- [ ] **IMAGE-05**: Image generation failures are handled gracefully _(deferred from v1.1 Phase 9)_
- [ ] **PLANNER-04**: User can retry/regenerate suggestions with "Retry" button _(deferred from v1.1 Phase 11)_
- [ ] **CARDS-01**: System provides 3+ distinct visual designs for milestone cards _(deferred from v1.1 Phase 11)_
- [ ] **CARDS-02**: Cards alternate or shuffle designs to prevent visual fatigue _(deferred from v1.1 Phase 11)_
- [ ] **CARDS-03**: All card designs maintain accessibility and readability standards _(deferred from v1.1 Phase 11)_

### Future Ideas

- [ ] **EXTENDED-01**: User can customize image generation styles (e.g., "always infographs" preference)
- [ ] **EXTENDED-02**: Planner suggestions show confidence scores
- [ ] **EXTENDED-03**: Posts support video backgrounds (animated SVG or short video clips)
- [ ] **EXTENDED-04**: A/B testing framework for card designs to optimize engagement

---

## Out of Scope

- **EXCLUDED-01**: Backend/cloud synchronization (remains local-first only)
- **EXCLUDED-02**: Social sharing of posts (privacy-first, local-only)
- **EXCLUDED-03**: Custom image upload (AI-generated only per v1.1 scope)
- **EXCLUDED-04**: Real-time collaborative planning (single-user focus)

---

## Traceability

| Phase | Requirements | Status |
|-------|--------------|--------|
| 7 — Post Feed Redesign | FEED-01..06, IMAGE-01..03 | Complete |
| 8 — Post Detail & Infinite Scroll | FEED-04..06 | Complete |
| 9 — Image Regeneration & Error Handling | IMAGE-04, IMAGE-05 | Skipped — deferred to v1.2 |
| 10 — Planner Auto-Suggestions | PLANNER-01..03, PLANNER-05 | Complete |
| 11 — Planner Retry & Milestone Cards | PLANNER-04, CARDS-01..03 | Skipped — deferred to v1.2 |
| 12 — Portal Navigation & Rich Moves | PLANNER-06, NAV-01, NAV-02 | Complete |
| 13 — Planner Redesign | PLANNER-05 (enhanced) | Complete |
| 14 — Knowledge Graph Classification | GRAPH-01..06 | Complete |
| 15 — Cluster Detail System | CLUSTER-01..06 | Complete |

---

_Last updated: 2026-04-10 — deferred requirements added to Future section_
