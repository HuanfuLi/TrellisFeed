# Phase 15: Cluster Detail System - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing anchor detail system (bottom panel, detail page, review/post buttons) to cluster-level nodes in the knowledge graph. Users can tap a cluster in the mindmap or breadcrumb to see aggregated Q&As and summaries from all child anchors, review flashcards across the cluster, and generate a post essay from cluster-wide knowledge.

This phase does NOT include: Branch-level detail pages, Planner integration for cluster recommendations, migration of legacy nodes, cluster-level podcast generation.

</domain>

<decisions>
## Implementation Decisions

### Cluster Node Storage — Question Entity Pattern (LOCKED)

**Decision:** Cluster nodes are stored as `Question` entities with `isClusterNode: true`, mirroring the anchor pattern (`isAnchorNode: true`). This gives clusters a stable `id` for routing (`/cluster/:id`) and a place to store aggregated metadata.

**Schema additions to `Question` type:**
- `isClusterNode?: boolean` — true for cluster nodes
- Reuses existing fields: `title` (= clusterLabel), `rootLabel`, `branchLabel`, `clusterLabel`, `nodeSummary`, `qaCount`
- `qaCount` on cluster = total Q&As across all child anchors
- `nodeSummary` on cluster = aggregated from child anchors' nodeSummary entries

### Cluster Node Creation Timing (LOCKED)

**Decision:** Cluster nodes are created during `classifyAndAnchor`, before anchor creation. When the second LLM call returns a `clusterLabel`, the system checks if a cluster node exists for that `branchLabel + clusterLabel` combination. If not, creates one. Then creates/resolves the anchor under that cluster.

**Anchor → Cluster linkage:** Add `clusterNodeId?: string` field to anchor nodes (and Q&A nodes), pointing to the parent cluster entity ID. This mirrors the `parentId` pattern used for Q&A → anchor linkage.

### Bottom Detail Panel — Cluster Tap in Mindmap (LOCKED)

**Decision:** When a user taps a cluster node in the Mind-Elixir graph, a bottom detail panel appears — same layout as the anchor panel but with cluster-specific content:
- Label: "KNOWLEDGE CLUSTER — {anchorCount} concepts, {totalQaCount} Q&As"
- Title: cluster name (e.g., "Learning Theory")
- Summary: first few anchor names listed (e.g., "Feynman Technique, Spaced Repetition, Interleaving")
- "View details" CTA → navigates to `/cluster/:id`

### Cluster Detail Page (LOCKED)

**Decision:** New `ClusterDetailScreen` at route `/cluster/:id`. Mirrors `AnchorDetailScreen` structure:

1. **Breadcrumb:** Root → Branch (just two levels, since cluster IS the current level)
2. **Cluster title** — large heading
3. **Stats:** "{N} concepts, {M} Q&As, {K} flashcards"
4. **Two action buttons:**
   - "Review Flashcards" (green) — gathers all flashcards from all Q&As across all child anchors, navigates to `/review` with state `{ clusterReview: { clusterId, qaIds, title } }`
   - "Learn as Post" (secondary) — generates essay using only `nodeSummary` entries from child anchors, navigates to `/posts/{postId}` with state `{ discoverMeta: { concept, title } }`
5. **Knowledge Summary section** — combined nodeSummary entries from all child anchors, grouped by anchor name
6. **Child anchors section** — list of anchor cards, each showing anchor name + Q&A count + summary preview. Tapping an anchor card navigates to `/anchor/:id`

### Breadcrumb Navigation (LOCKED)

**Decision:** In `AnchorDetailScreen`, the cluster label in the breadcrumb (e.g., "Root > Branch > **Cluster**") becomes a tappable link that navigates to `/cluster/:clusterNodeId`. This provides a second entry point to the cluster detail page beyond the mindmap graph.

### Post Generation Scope (LOCKED)

**Decision:** "Learn as Post" for clusters uses ONLY `nodeSummary` entries from child anchors — does not include full Q&A answers. This keeps the essay concise and concept-focused.

### Review Flashcards Scope (LOCKED)

**Decision:** "Review Flashcards" gathers cards by: finding all anchors where `clusterNodeId === cluster.id`, then finding all Q&As where `parentId` is in those anchor IDs, then filtering flashcards by those Q&A nodeIds. Same pattern as anchor review but one level wider.

### Claude's Discretion

- Exact visual styling of cluster bottom panel (colors, spacing) — should feel consistent with anchor panel
- How to handle clusters with 0 anchors (edge case during data creation)
- Whether to show cluster qaCount/nodeSummary updates in real-time or on next graph visit
- Error handling for missing cluster nodes in breadcrumb navigation
- How to group/order the combined nodeSummary entries on the cluster detail page (by anchor name recommended)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Anchor Detail System (reference implementation)
- `app/src/screens/AnchorDetailScreen.tsx` — Full anchor detail page with Q&As, summaries, review/post buttons. PRIMARY REFERENCE for ClusterDetailScreen.
- `app/src/screens/GraphScreen.tsx` — Bottom detail panel on node tap, Mind-Elixir graph rendering, `MasterMap` component, `buildMindElixirData`

### Classification & Knowledge Service
- `app/src/services/canonical-knowledge.service.ts` — `classifyAndAnchor()` (where cluster creation will be added), `buildAnchorReflectionTree()` (must be extended for cluster entities), `buildTreeContext()`
- `app/src/services/question.service.ts` — Question storage, `patchQuestion()`

### Types & Schema
- `app/src/types/index.ts` — `Question` type (add `isClusterNode`, `clusterNodeId`), existing `isAnchorNode`, `parentId`, `nodeSummary` fields

### Navigation & Routing
- `app/src/App.tsx` — Router config (add `/cluster/:id` route)
- `app/src/screens/ReviewScreen.tsx` — Review filtering by anchor (extend for cluster filtering)

### Post Generation
- Post generation flow via `conceptFeedService` — used by AnchorDetailScreen's "Learn as Post" button

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnchorDetailScreen.tsx` — Direct template for ClusterDetailScreen (breadcrumb, stats, buttons, summary, child list)
- `GraphScreen.tsx` bottom panel — Already handles anchor node taps; extend click handler for cluster nodes
- `ReviewScreen.tsx` anchor filtering — `anchorReview` state pattern; add parallel `clusterReview` pattern
- `flashcardService.getAll()` — Existing flashcard aggregation used by anchor detail
- `buildAnchorReflectionTree()` — Already groups anchors by cluster; cluster entity creation fits naturally here

### Established Patterns
- Node entities as `Question` objects with type flags (`isAnchorNode`) — extend with `isClusterNode`
- `parentId` linkage for Q&A → anchor — extend with `clusterNodeId` for anchor → cluster
- Bottom panel triggered by `onNodeClick` in GraphScreen — extend node type detection
- Navigation with state passing (e.g., `{ anchorReview: {...} }`) — add `{ clusterReview: {...} }`
- Inline styles with CSS variables (`--primary-40`, `--surface`, etc.)

### Integration Points
- `classifyAndAnchor()` — Insert cluster creation/resolution before anchor creation
- `buildAnchorReflectionTree()` — Include cluster entities in tree output
- `GraphScreen.tsx` click handler — Detect cluster vs anchor node type
- `App.tsx` router — Add `/cluster/:id` route
- `AnchorDetailScreen.tsx` breadcrumb — Make cluster label tappable

</code_context>

<specifics>
## Specific Ideas

- User's example: "Feynman Technique" and "Spaced Repetition" are anchors under "Learning Theory" cluster. Clicking "Learning Theory" shows aggregated view of both anchors' Q&As and summaries.
- Cluster detail page gathers ALL content from child anchors — it's a higher-level view of the same knowledge.
- Two entry points: mindmap graph tap + breadcrumb tap in anchor detail page.
- Post essay for cluster should cover the broader topic (e.g., "Understanding Learning Theory") using all anchor summaries.

</specifics>

<deferred>
## Deferred Ideas

- Branch-level detail pages (one more level up from clusters)
- Planner recommendations for clusters with high Q&A density
- Cluster-level podcast generation
- Migration of legacy nodes (pre-Phase 14) to cluster/anchor structure
- Cluster merging/splitting when LLM suggests overlapping clusters

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-cluster-detail-system*
*Context gathered: 2026-03-29*
