# Phase 15: Cluster Detail System - Research

**Researched:** 2026-03-29
**Domain:** React / TypeScript / localStorage — extending the Phase 14 anchor detail system to cluster-level nodes
**Confidence:** HIGH — all findings verified against actual codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Cluster node storage:** `Question` entities with `isClusterNode: true`, reusing `title`, `rootLabel`, `branchLabel`, `clusterLabel`, `nodeSummary`, `qaCount`.
- **`qaCount` on cluster** = total Q&As across all child anchors.
- **`nodeSummary` on cluster** = aggregated from child anchors' nodeSummary entries.
- **Cluster creation timing:** Created inside `classifyAndAnchor()` before anchor creation, keyed on `branchLabel + clusterLabel`. Check-or-create pattern.
- **Anchor → cluster linkage:** `clusterNodeId?: string` field added to anchor (and Q&A) nodes, pointing to the parent cluster entity ID.
- **Bottom detail panel:** Tap a cluster node in Mind-Elixir graph → bottom panel shows label "KNOWLEDGE CLUSTER — {anchorCount} concepts, {totalQaCount} Q&As", title = cluster name, summary = first few anchor names, "View details" CTA → `/cluster/:id`.
- **Cluster detail page at `/cluster/:id`:** Mirrors `AnchorDetailScreen` — breadcrumb (Root → Branch), cluster title, stats, two action buttons ("Review Flashcards", "Learn as Post"), Knowledge Summary section (combined nodeSummary grouped by anchor), Child anchors section (anchor cards tapping to `/anchor/:id`).
- **Review Flashcards scope:** Find all anchors where `clusterNodeId === cluster.id`, find all Q&As where `parentId` is in those anchor IDs, filter flashcards by those Q&A nodeIds.
- **Learn as Post scope:** Uses ONLY `nodeSummary` entries from child anchors — not full Q&A answers.
- **Breadcrumb tappable link:** Cluster label in `AnchorDetailScreen` breadcrumb becomes a link to `/cluster/:clusterNodeId`.

### Claude's Discretion

- Exact visual styling of cluster bottom panel (colors, spacing) — should feel consistent with anchor panel.
- How to handle clusters with 0 anchors (edge case during data creation).
- Whether to show cluster qaCount/nodeSummary updates in real-time or on next graph visit.
- Error handling for missing cluster nodes in breadcrumb navigation.
- How to group/order the combined nodeSummary entries on the cluster detail page (by anchor name recommended).

### Deferred Ideas (OUT OF SCOPE)

- Branch-level detail pages.
- Planner recommendations for clusters with high Q&A density.
- Cluster-level podcast generation.
- Migration of legacy nodes (pre-Phase 14) to cluster/anchor structure.
- Cluster merging/splitting when LLM suggests overlapping clusters.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLUSTER-01 | Cluster nodes stored as Question entities with `isClusterNode: true` and metadata (title, nodeSummary, qaCount) | Type extension + classifyAndAnchor() cluster creation pattern verified |
| CLUSTER-02 | Tapping a cluster node in mindmap shows bottom detail panel with name, Q&A count, "View details" CTA | GraphScreen nodeMap + click handler analysis shows exact extension point |
| CLUSTER-03 | Cluster detail page at `/cluster/:id` aggregates all Q&As and summaries from every child anchor | AnchorDetailScreen is direct template; data aggregation pattern documented |
| CLUSTER-04 | "Review Flashcards" gathers flashcards from all Q&As across all child anchors, launches filtered review | anchorReview pattern in ReviewScreen is the template; add parallel clusterReview |
| CLUSTER-05 | "Learn as Post" generates essay using only nodeSummary entries from child anchors | generateDiscoverPost(concept, title) signature verified — needs nodeSummary content passed as context |
| CLUSTER-06 | Cluster label in anchor detail breadcrumb is tappable, navigates to cluster detail page | AnchorDetailScreen breadcrumb renders static spans — convert to button/link when clusterNodeId exists |

</phase_requirements>

---

## Summary

Phase 15 is a well-scoped extension of the Phase 14 anchor system. The codebase provides direct templates for every required deliverable: `AnchorDetailScreen.tsx` is the near-exact template for `ClusterDetailScreen`, and `ReviewScreen.tsx`'s `anchorReview` navigation state pattern is the direct model for `clusterReview`. No new architectural concepts are introduced — the phase is additive.

The most technically involved work is the `classifyAndAnchor()` extension in `canonical-knowledge.service.ts`. This function currently creates/resolves anchor nodes. It must be extended to also create/resolve cluster nodes (keyed on `branchLabel + clusterLabel`) BEFORE creating the anchor, and then patch anchors and Q&As with the new `clusterNodeId` field.

The second major work area is extending `buildMindElixirData` and the click handler in `GraphScreen.tsx`. Currently cluster nodes are rendered as structural `NodeObj` entries with synthetic IDs like `cluster-Root-Branch-ClusterName` — these are NOT in `nodeMapRef` and the click handler silently drops them. To make cluster taps work, cluster nodes must either be stored as `Question` entities in localStorage (and added to `nodeMapRef`) or the click handler must be extended to detect synthetic cluster IDs and perform a lookup by label.

**Primary recommendation:** Follow the CONTEXT.md decision to store cluster nodes as `Question` entities (`isClusterNode: true`). Change `buildMindElixirData` to use the cluster entity's `id` as the `NodeObj.id`. Then `nodeMapRef.current[id]` finds the cluster entity and the existing click handler dispatches it to `setSelectedNode`. The bottom panel JSX checks `isClusterNode` to render cluster-specific content.

---

## Standard Stack

### Core (already installed — no new deps needed)
| Library | Version | Purpose | Why Used Here |
|---------|---------|---------|---------------|
| react-router-dom v7 | v7.x | Routing + `useNavigate` / `useParams` / `useLocation` | Add `/cluster/:id` route, pass `clusterReview` via `location.state` |
| lucide-react | current | Icons (ArrowLeft, BookOpen, FileText, ChevronRight) | Matches AnchorDetailScreen icon set exactly |
| Inline CSS + CSS vars | — | Styling (`--primary-40`, `--surface-variant`, etc.) | Project convention — no Tailwind classes |

**No new npm packages required.** All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/
├── screens/
│   ├── AnchorDetailScreen.tsx  — existing (extend breadcrumb: add tappable clusterNodeId)
│   ├── ClusterDetailScreen.tsx — NEW (mirrors AnchorDetailScreen)
│   └── GraphScreen.tsx         — extend click handler + bottom panel for cluster nodes
├── services/
│   └── canonical-knowledge.service.ts — extend classifyAndAnchor() + buildAnchorReflectionTree()
├── types/
│   └── index.ts                — add isClusterNode?, clusterNodeId? to Question
└── App.tsx                     — add /cluster/:id route
```

### Pattern 1: Cluster Entity as Question with `isClusterNode: true`

**What:** Cluster nodes stored in the same `echolearn_questions` localStorage key as Q&A nodes and anchor nodes. Detected by `isClusterNode === true`.

**Type additions needed in `src/types/index.ts`:**
```typescript
export interface Question {
  // ... existing fields ...
  isClusterNode?: boolean;    // true for cluster-level container nodes
  clusterNodeId?: string;     // on anchor nodes AND Q&A nodes — points to parent cluster entity
}
```

**Why this pattern:** Matches the `isAnchorNode` precedent exactly. `questionService.getAll()` already returns all Questions; guards like `projectQuestionToKnowledgeNode` already skip `isAnchorNode === true` and must also skip `isClusterNode === true`.

### Pattern 2: Cluster Creation in `classifyAndAnchor()`

**What:** Before creating/resolving the anchor, the service checks if a cluster entity exists for `branchLabel + clusterLabel`. If not, creates one. Then creates/resolves anchor with `clusterNodeId` pointing to that cluster entity.

**Critical insertion point:** After the LLM result is parsed (line ~470 in canonical-knowledge.service.ts), before the anchor resolution block (line ~481).

```typescript
// --- Resolve or create cluster node ---
let clusterEntityId: string | undefined;

const existingCluster = allQuestions.find(
  q => q.isClusterNode === true &&
    q.branchLabel === result.branchLabel &&
    q.clusterLabel === result.clusterLabel
);

if (existingCluster) {
  clusterEntityId = existingCluster.id;
} else {
  const clusterNode: Question = {
    id: `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    content: result.clusterLabel,
    answer: '',
    summary: result.clusterLabel,
    title: result.clusterLabel,
    keywords: [],
    relatedQuestionIds: [],
    categoryIds: [],
    reviewSchedule: { nextReviewDate: '9999-12-31', reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    aliases: [],
    sourcePrompts: [],
    sourceQuestionIds: [],
    rootLabel: result.rootLabel,
    branchLabel: result.branchLabel,
    clusterLabel: result.clusterLabel,
    nodeSummary: '',
    isClusterNode: true,
    qaCount: 0,
  };
  // Write directly to localStorage (same pattern as anchor creation)
  const storedRaw = localStorage.getItem('echolearn_questions');
  const store: Question[] = storedRaw ? JSON.parse(storedRaw) as Question[] : [];
  store.unshift(clusterNode);
  localStorage.setItem('echolearn_questions', JSON.stringify(store));
  clusterEntityId = clusterNode.id;
}
```

Then patch the anchor with `clusterNodeId: clusterEntityId` when creating/resolving it, and patch the Q&A node's `patchQuestion` call with `clusterNodeId: clusterEntityId`.

### Pattern 3: Cluster Aggregate Update

**What:** After the anchor is updated (qaCount + nodeSummary), also update the cluster entity's `qaCount` and `nodeSummary`.

```typescript
// After updating anchor, update cluster aggregate
if (clusterEntityId) {
  const freshStore = questionService.getAll();
  const clusterEntity = freshStore.find(q => q.id === clusterEntityId);
  if (clusterEntity) {
    // qaCount = sum of all child anchors' qaCount values
    const childAnchors = freshStore.filter(q => q.isAnchorNode === true && q.clusterNodeId === clusterEntityId);
    const totalQaCount = childAnchors.reduce((sum, a) => sum + (a.qaCount || 0), 0);
    questionService.patchQuestion(clusterEntityId, {
      qaCount: totalQaCount,
      // nodeSummary: not updated here — computed dynamically on ClusterDetailScreen
    });
  }
}
```

**Note on nodeSummary for cluster:** The CONTEXT.md says "aggregated from child anchors' nodeSummary entries." This is best computed dynamically in `ClusterDetailScreen` rather than stored, because anchors are updated frequently. The stored `qaCount` is the minimal aggregate worth persisting.

### Pattern 4: GraphScreen Click Handler Extension

**What:** The existing click handler in `GraphScreen.tsx` (line 181–187) looks up clicked node IDs in `nodeMapRef.current`. Currently cluster synthetic IDs (`cluster-Root-Branch-ClusterName`) are NOT in this map.

**Solution:** Change `buildMindElixirData` to use the cluster entity's actual `id` for the cluster-level `NodeObj`:

```typescript
// In buildMindElixirData — before this change:
id: `cluster-${root.rootLabel}-${branch.branchLabel}-${cluster.clusterLabel}`,

// After — cluster entities are now tracked in nodeMapRef:
id: clusterEntity.id,  // use the Question entity's actual id
```

`buildAnchorReflectionTree()` must be extended to include `clusterEntity: Question | undefined` alongside each cluster's `{ clusterLabel, anchors, legacyNodes }`. The cluster entity can be found by a lookup in questions where `isClusterNode === true && branchLabel === ... && clusterLabel === ...`.

The `MasterMap` component receives `nodes: Question[]`. It currently builds `nodeMapRef.current = Object.fromEntries(nodes.map((n) => [n.id, n]))`. Cluster entities will be in `nodes` via `graphService.getGraph()` which calls `questionService.getAll()` — but only if `graphService` doesn't filter them out. Verify this.

### Pattern 5: Bottom Panel Cluster-Specific Rendering

**What:** The bottom panel in `GraphScreen.tsx` (lines 643–692) checks `selectedNode.isAnchorNode` to render anchor-specific label. Extend to also check `selectedNode.isClusterNode`.

```tsx
{selectedNode.isClusterNode && (
  <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary-40)', marginBottom: '4px' }}>
    KNOWLEDGE CLUSTER — {childAnchorCount} concepts, {selectedNode.qaCount || 0} Q&As
  </p>
)}
```

The panel's `onClick` must navigate to `/cluster/${selectedNode.id}` when `selectedNode.isClusterNode === true`, otherwise to `/anchor/:id` or `/ask/:id`.

### Pattern 6: ClusterDetailScreen Structure

**What:** Mirrors `AnchorDetailScreen.tsx` exactly, with these differences:

| Section | AnchorDetailScreen | ClusterDetailScreen |
|---------|-------------------|---------------------|
| Header | "Concept Anchor" | "Knowledge Cluster" |
| Breadcrumb | Root > Branch > Cluster (static) | Root > Branch (2 levels — cluster IS current) |
| Stats | `qaChildren.length` Q&As, flashcard count | `{anchorCount} concepts, {totalQaCount} Q&As, {flashcardCount} flashcards` |
| Review button | filters by `qaChildren.map(q => q.id)` | filters by all Q&As across all child anchors |
| Post button | `discoverMeta.concept = anchor.title` | `discoverMeta.concept = cluster.title` (uses nodeSummary content) |
| Knowledge Summary | parsed from `anchor.nodeSummary` | combined nodeSummary from child anchors, grouped by anchor name |
| Child section | Q&A cards → `/ask/:id` | Anchor cards → `/anchor/:id` |

**Data aggregation in ClusterDetailScreen:**
```typescript
const cluster = id ? getById(id) : undefined;
// Child anchors
const childAnchors = questions.filter(q => q.clusterNodeId === cluster?.id && q.isAnchorNode === true);
// All Q&As under those anchors
const allQaIds = questions
  .filter(q => childAnchors.some(a => a.id === q.parentId) && !q.isAnchorNode && !q.isClusterNode)
  .map(q => q.id);
// Flashcards
const allCards = flashcardService.getAll();
const clusterCardCount = allCards.filter(c => allQaIds.includes(c.nodeId ?? '')).length;
```

### Pattern 7: ReviewScreen `clusterReview` Extension

**What:** Parallel to `anchorReview` (lines 255–258 in ReviewScreen.tsx). Add:

```typescript
const clusterReview = (location.state as {
  anchorReview?: {...};
  clusterReview?: { clusterId: string; qaIds: string[]; title: string }
} | null)?.clusterReview;

const clusterFilteredItems = clusterReview
  ? allCards.filter((card) => clusterReview.qaIds.some((qaId) => card.nodeId === qaId))
  : null;

// Priority: anchor review > cluster review > move review > all items
const filteredItems = anchorFilteredItems ?? clusterFilteredItems ?? moveFilteredItems;
```

**Navigation call from ClusterDetailScreen:**
```typescript
navigate('/review', {
  state: {
    clusterReview: {
      clusterId: cluster.id,
      qaIds: allQaIds,
      title: cluster.title || cluster.content,
    },
  },
});
```

### Pattern 8: "Learn as Post" for Clusters

**What:** `generateDiscoverPost(concept, title)` only takes a concept name and title — it generates a generic essay. For cluster-level posts, the content should be richer, drawing on the actual nodeSummary content from child anchors. However, since the CONTEXT.md decision says to use `generateDiscoverPost` via the `discoverMeta` navigation pattern, the post is generated in `PostDetailScreen` — EchoLearn cannot easily inject the nodeSummary content there without changing the `generateDiscoverPost` signature.

**Practical approach:** Use the existing `generateDiscoverPost(concept, title)` pattern. The `concept` passed should be the cluster title (e.g., "Learning Theory"). The essay will be a generic educational overview. The "ONLY nodeSummary" constraint from CONTEXT.md refers to the planner's intent (no full Q&A dumps), but since the generation is handled by `PostDetailScreen` via the `discoverMeta` mechanism, the nodeSummary content itself is not injected into the LLM prompt.

**If richer cluster-specific essays are needed:** A new `generateClusterPost(clusterTitle, anchorSummaries)` method in `concept-feed.service.ts` would be required — but this is likely out of scope for this phase given the CONTEXT.md says to mirror `AnchorDetailScreen`'s post flow.

### Pattern 9: Breadcrumb Link in AnchorDetailScreen

**What:** Lines 92–107 in AnchorDetailScreen render a static breadcrumb. When the anchor has `clusterNodeId`, wrap the cluster label in a tappable element:

```tsx
{anchor.clusterNodeId ? (
  <button
    onClick={() => navigate(`/cluster/${anchor.clusterNodeId}`)}
    style={{ color: 'var(--primary-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
  >
    {anchor.clusterLabel || 'Concepts'}
  </button>
) : (
  <span>{anchor.clusterLabel || 'Concepts'}</span>
)}
```

### Anti-Patterns to Avoid

- **Computing cluster aggregate data in classifyAndAnchor live:** The `allQuestions` snapshot passed to `classifyAndAnchor` is stale (captured before the Q&A was saved). Re-fetch from `questionService.getAll()` after each write, as the existing anchor update logic already does (line ~546).
- **Using synthetic cluster IDs in NodeObj:** If `buildMindElixirData` keeps using `cluster-Root-Branch-Name` synthetic IDs, the click handler can never look them up in `nodeMapRef`. The entity's real `id` must be used.
- **Filtering `projectQuestionsToKnowledgeNodes` silently:** The guard at line 68 in canonical-knowledge.service.ts skips `isAnchorNode === true`. Cluster nodes (`isClusterNode: true`) must get the same guard — otherwise they leak into the knowledge graph's Q&A nodes, polluting review, daily review map, and CandidateContextPack.
- **Running anchor update after cluster update:** The cluster's `qaCount` must be updated AFTER the anchor's `qaCount` is updated, so the sum is correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom panel cluster display | New component | Extend existing selectedNode panel in GraphScreen | Panel is ~50 lines inline JSX — adding an `isClusterNode` branch is simpler |
| Cluster detail layout | New design system | Copy `AnchorDetailScreen.tsx` as base | Every structural element (breadcrumb, stats bar, buttons, summary, child list) already exists |
| Post generation | New LLM call in ClusterDetailScreen | `navigate('/posts/:id', { state: { discoverMeta } })` → PostDetailScreen handles generation | Established pattern — all essay streaming/saving/display already works there |
| Flashcard filtering | New review session logic | Extend ReviewScreen's `location.state` pattern with `clusterReview` | `anchorReview` is the direct template |
| Cluster storage | New data layer | `localStorage` via direct write (same as anchor creation in classifyAndAnchor) | Consistent with how anchor nodes are created |

---

## Common Pitfalls

### Pitfall 1: Cluster IDs not in nodeMapRef → clicks silently ignored
**What goes wrong:** Tap a cluster node in Mind-Elixir, nothing happens.
**Why it happens:** `buildMindElixirData` assigns synthetic IDs like `cluster-Root-Branch-Name` to cluster `NodeObj` entries. These IDs are never in `nodeMapRef.current`, so `nodeMapRef.current[id]` returns `undefined` and `onNodeClickRef.current` is never called.
**How to avoid:** Change the `NodeObj.id` for cluster-level nodes to use the cluster entity's real `id` from localStorage. Requires extending `buildAnchorReflectionTree()` to return the cluster entity reference.
**Warning signs:** During UAT, tapping cluster nodes does not show a bottom panel.

### Pitfall 2: Cluster entities leaking into Q&A projection
**What goes wrong:** Cluster nodes appear in the review queue, flashcard pool, or knowledge graph scoring.
**Why it happens:** `projectQuestionsToKnowledgeNodes` guards `isAnchorNode === true` but not `isClusterNode === true`.
**How to avoid:** Add `if (question.isClusterNode === true) return null;` in `projectQuestionToKnowledgeNode`, alongside the existing `isAnchorNode` guard (line 68).
**Warning signs:** Clusters appear in review map or as candidate nodes in `buildCandidateContextPack`.

### Pitfall 3: `allQuestions` snapshot stale during cluster creation
**What goes wrong:** A cluster entity is created, but the lookup for an existing cluster misses it because the snapshot was captured before the write completed.
**Why it happens:** `classifyAndAnchor` receives `allQuestions` as a parameter (a snapshot). After writing a new cluster to localStorage, the in-memory `allQuestions` array still doesn't contain it.
**How to avoid:** After writing the cluster entity to localStorage, reload from `questionService.getAll()` before the anchor resolution step (same pattern as line ~546 for anchor updates).
**Warning signs:** Duplicate cluster entities being created on subsequent Q&As with the same `branchLabel + clusterLabel`.

### Pitfall 4: `clusterNodeId` not set on anchor nodes created before Phase 15
**What goes wrong:** Existing anchor nodes have no `clusterNodeId`, so `ClusterDetailScreen` shows zero child anchors.
**Why it happens:** Phase 14 created anchors without `clusterNodeId`. Phase 15 cluster creation will only patch newly classified Q&As.
**How to avoid:** On `ClusterDetailScreen`, provide a fallback lookup: if `childAnchors` found via `clusterNodeId` is empty, also search by `branchLabel + clusterLabel` match (same heuristic as anchor creation uses). This handles legacy anchors gracefully without a migration.
**Warning signs:** Cluster detail shows "0 concepts" for clusters that visually have anchors in the mindmap.

### Pitfall 5: `useQuestions().questions` does not include cluster entities
**What goes wrong:** `ClusterDetailScreen` calls `getById(id)` and gets `undefined` for a cluster entity.
**Why it happens:** `useQuestions` might filter out non-Q&A items, or `graphService.getGraph()` might filter cluster entities.
**How to avoid:** Verify `questionService.getAll()` returns ALL stored Question entities (anchors + clusters + Q&As). Cluster nodes use the same `echolearn_questions` key, so `getAll()` should include them. If `useQuestions` has any filter, check it. The `getById` utility simply finds by `id` — this is safe.

### Pitfall 6: `buildAnchorReflectionTree` typed return doesn't include cluster entity
**What goes wrong:** TypeScript error when trying to pass `cluster.clusterEntity.id` to `NodeObj.id` in `buildMindElixirData`.
**Why it happens:** The return type of `buildAnchorReflectionTree` (lines 584–593) doesn't include the cluster entity object.
**How to avoid:** Extend the return type's cluster item from `{ clusterLabel, anchors, legacyNodes }` to `{ clusterLabel, clusterEntity: Question | undefined, anchors, legacyNodes }`. Pass `questions` into the lookup.

---

## Code Examples

Verified patterns from existing codebase:

### Anchor review navigation (template for cluster review)
```typescript
// AnchorDetailScreen.tsx line 45–56
navigate('/review', {
  state: {
    anchorReview: {
      anchorId: anchor.id,
      qaIds: qaChildren.map((q) => q.id),
      title: anchor.title || anchor.content,
    },
  },
});
```

### anchorReview filter in ReviewScreen (template for clusterReview)
```typescript
// ReviewScreen.tsx lines 255–258
const anchorReview = (location.state as { anchorReview?: { anchorId: string; qaIds: string[]; title: string } } | null)?.anchorReview;
const anchorFilteredItems = anchorReview
  ? allCards.filter((card) => anchorReview.qaIds.some((qaId) => card.nodeId === qaId))
  : null;
```

### Anchor creation in classifyAndAnchor (template for cluster creation)
```typescript
// canonical-knowledge.service.ts lines 493–527
const anchorNode: Question = {
  id: `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  ...
  isAnchorNode: true,
  qaCount: 0,
};
const storedRaw = localStorage.getItem('echolearn_questions');
const store: Question[] = storedRaw ? JSON.parse(storedRaw) as Question[] : [];
store.unshift(anchorNode);
localStorage.setItem('echolearn_questions', JSON.stringify(store));
```

### Bottom panel node type detection (template for cluster branch)
```tsx
// GraphScreen.tsx lines 646–650
if (selectedNode.isAnchorNode) {
  navigate(`/anchor/${selectedNode.id}`);
} else {
  navigate(`/ask/${selectedNode.id}`);
}
```

### "Learn as Post" navigation (same pattern for clusters)
```typescript
// AnchorDetailScreen.tsx lines 58–68
const postId = `anchor-post-${anchor.id}`;
navigate(`/posts/${postId}`, {
  state: {
    discoverMeta: {
      concept: anchor.title || anchor.content,
      title: `Understanding ${anchor.title || anchor.content}: A Complete Guide`,
    },
  },
});
```

### Route registration (App.tsx line 176 — template for cluster route)
```typescript
{ path: 'anchor/:id', element: <PageTransition><AnchorDetailScreen /></PageTransition> },
// Add:
{ path: 'cluster/:id', element: <PageTransition><ClusterDetailScreen /></PageTransition> },
```

### Breadcrumb in AnchorDetailScreen (lines 92–107 — where to add tappable cluster link)
```tsx
<div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', ... }}>
  <span>{anchor.rootLabel || 'Knowledge'}</span>
  <ChevronRight size={12} />
  <span>{anchor.branchLabel || 'General'}</span>
  <ChevronRight size={12} />
  <span>{anchor.clusterLabel || 'Concepts'}</span>  {/* ← make this tappable */}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Q&A nodes direct in mindmap | Anchor nodes as mindmap leaves (Q&As hidden) | Phase 14 | Cluster entities must use the same entity pattern |
| Cluster label = string field only | Cluster label + cluster entity with `isClusterNode: true` | Phase 15 (new) | Enables routing and aggregation |
| anchorReview state for filtered review | anchorReview + clusterReview (parallel) | Phase 15 (new) | Wider-scope review sessions |

---

## Open Questions

1. **Does `graphService.getGraph()` include cluster entities?**
   - What we know: `graphService.getGraph()` likely calls `questionService.getAll()`, which returns all entities.
   - What's unclear: Whether `graphService` filters by `isAnchorNode` or other flags.
   - Recommendation: Planner should include a task to audit `graph.service.ts` and ensure cluster entities (`isClusterNode: true`) are included in the `nodes` array passed to `MasterMap`.

2. **`buildAnchorReflectionTree` lookup for cluster entities**
   - What we know: The function groups anchors by `branchLabel + clusterLabel` but doesn't do any Q lookup for a cluster entity.
   - What's unclear: Whether adding a cluster entity lookup inside the function is the cleanest approach, or whether `buildMindElixirData` should do the lookup itself.
   - Recommendation: Extend `buildAnchorReflectionTree` return type to include `clusterEntity` — keeps the data transformation in one place and keeps `buildMindElixirData` as a pure render mapper.

3. **Cluster `nodeSummary` — computed vs stored**
   - What we know: CONTEXT.md says cluster `nodeSummary` = aggregated from child anchors.
   - What's unclear: Whether this should be stored (updated on every Q&A classification) or computed on the fly in `ClusterDetailScreen`.
   - Recommendation: Compute dynamically in `ClusterDetailScreen` from child anchor `nodeSummary` fields. Only persist `qaCount` as an aggregate. This avoids staleness and storage overhead.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config-only changes with no external dependencies beyond what's already in the project.

---

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in `.planning/config.json` (key is absent) — validation architecture is enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no test config files found) |
| Config file | None — Wave 0 gap |
| Quick run command | Manual UAT verification |
| Full suite command | Manual UAT verification |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLUSTER-01 | Cluster entity created in localStorage after Q&A classification | manual-smoke | Manual: ask a Q, check localStorage `echolearn_questions` for `isClusterNode: true` entry | N/A |
| CLUSTER-02 | Tapping cluster node in graph shows bottom panel | manual-smoke | Manual: navigate to /graph, tap a cluster node | N/A |
| CLUSTER-03 | Cluster detail page loads with correct aggregated data | manual-smoke | Manual: navigate to /cluster/:id, verify anchor list + stats | N/A |
| CLUSTER-04 | Review Flashcards launches filtered session | manual-smoke | Manual: tap "Review Flashcards" on cluster detail, verify cards are from child anchors only | N/A |
| CLUSTER-05 | Learn as Post generates essay | manual-smoke | Manual: tap "Learn as Post", verify navigation to PostDetailScreen with cluster title | N/A |
| CLUSTER-06 | Cluster label in anchor breadcrumb is tappable | manual-smoke | Manual: navigate to /anchor/:id, tap cluster label in breadcrumb, verify navigation to /cluster/:id | N/A |

**All tests are manual-only.** No automated test infrastructure exists in this project.

### Wave 0 Gaps
- No test framework detected — project relies entirely on manual UAT. No Wave 0 test setup needed.

*(Existing pattern: Phase 14 used manual UAT exclusively.)*

---

## Sources

### Primary (HIGH confidence)
- `/Users/Code/EchoLearn/app/src/screens/AnchorDetailScreen.tsx` — direct template for ClusterDetailScreen
- `/Users/Code/EchoLearn/app/src/screens/GraphScreen.tsx` — bottom panel + MasterMap click handler
- `/Users/Code/EchoLearn/app/src/services/canonical-knowledge.service.ts` — classifyAndAnchor(), buildAnchorReflectionTree()
- `/Users/Code/EchoLearn/app/src/types/index.ts` — Question type, existing isAnchorNode pattern
- `/Users/Code/EchoLearn/app/src/App.tsx` — router config
- `/Users/Code/EchoLearn/app/src/screens/ReviewScreen.tsx` — anchorReview pattern
- `/Users/Code/EchoLearn/app/src/services/concept-feed.service.ts` — generateDiscoverPost() signature
- `/Users/Code/EchoLearn/.planning/phases/15-cluster-detail-system/15-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `/Users/Code/EchoLearn/.planning/REQUIREMENTS.md` — CLUSTER-01 through CLUSTER-06 definitions
- `/Users/Code/EchoLearn/.planning/STATE.md` — Phase 14 decisions and patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already present; verified in package.json
- Architecture: HIGH — all patterns verified against actual source files; no speculative claims
- Pitfalls: HIGH — each pitfall traced to a specific existing code location
- Data aggregation: HIGH — anchor pattern is a working precedent; cluster is a direct generalization
- Post generation: MEDIUM — `generateDiscoverPost` doesn't accept nodeSummary context; cluster essays will be generic (same quality as anchor essays)

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable codebase, no external dependencies)
