# Phase 14: Knowledge Graph Classification & Anchor Nodes - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Source:** Design discussion (discuss-phase equivalent)

<domain>
## Phase Boundary

Fix the root cause of vague mindmap branch/cluster names ("Your concepts", "Concept cluster") by:
1. Separating classification from answer generation into a dedicated second LLM call
2. Introducing concept anchor nodes so the mindmap displays clean, stable concept names

This phase does NOT include: Planner integration for anchor recommendations, anchor detail page, delegated flashcard/podcast review from anchors (deferred to Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Classification Architecture — Two-Call Split (LOCKED)

**Problem diagnosed:** The first LLM call asks the model to simultaneously answer a question AND classify it hierarchically. Classification is treated as an afterthought; the LLM optimizes for the answer and fills `knowledgeDecision` cheaply. Additionally, `formatCandidateContextPack` feeds existing (potentially bad) branch labels back to the LLM as "Likely branches", creating a self-reinforcing feedback loop of vague names.

**Decision:** Remove `knowledgeDecision` entirely from the first LLM call. A dedicated second call handles classification only.

- First call JSON schema: `{ answer, summary, keywords, storyHook, shortSummary }` — no `knowledgeDecision`
- `shortSummary` is new: ≤80 words, used as anchor summary entry when Q&A attaches to an anchor
- Second call fires ONLY after `filterQuestion` confirms `flagged !== true` (Q&A is eligible for mindmap)
- Second call is never fired for flagged/off-topic/small-talk Q&As

### Second Classification Call Design (LOCKED)

**What the second call receives:**
- The user's question text only (not full Q&A — saves tokens)
- The current tree structure: unique existing branch names + their cluster names (no roots — root is always "Knowledge")
- Does NOT receive "Likely branches" from candidate scoring — that was the source of the feedback loop

**What the second call's prompt asks the model to do:**
1. Write a ≤30-word answer to the question for self-context
2. Extract the single most descriptive keyword
3. Using both, determine: `branchLabel`, `clusterLabel`, `anchorName` (reuse existing anchor or propose new clean noun), `anchorId` (if attaching to existing anchor)

**Response shape:** `{ rootLabel: "Knowledge", branchLabel, clusterLabel, anchorName, anchorId? }`

**Branch/cluster naming guidance in prompt:** Branches should be broad sub-disciplines (e.g., "Psychology", "Computer Science"). Clusters should be topic groupings that can hold multiple Q&As (e.g., "Memory", "Machine Learning") — NOT the specific concept of the question itself.

### `decideIngestionOutcome` — Label Stripping (LOCKED)

- Keep merge/refine/new outcome logic and targetNodeId selection (score-based deduplication is valuable)
- Strip ALL label fields from the return value — function returns only `{ outcome, targetNodeId? }`
- No label inheritance from `top.branchLabel`, `top.rootLabel`, etc.
- Labels come exclusively from the second call result
- For merge case: existing anchor's labels are preserved (not reclassified) — the merge target is already correctly anchored

### `buildAndSave` Changes (LOCKED)

- Remove `knowledgeDecision` from `meta` parameter
- Questions initially saved with empty/undefined label fields
- Labels patched onto the question after second call resolves
- For merge case: `buildCanonicalQuestionPatch` still handles aliases/sourcePrompts deduplication; label fields simply remain unchanged on the merged node (second call's labels applied in post-patch)

### Concept Anchor Node Design (LOCKED)

**What an anchor is:** A stable concept node with a clean noun/concept name (e.g., "Transformer", "Spaced Repetition", "Entropy"). Created explicitly by the LLM in the second classification call. Separate from individual Q&A leaf nodes.

**Schema additions to `Question` type:**
- `isAnchorNode: boolean` — true for anchor nodes
- `qaCount: number` — incremented each time a Q&A attaches (used for Planner recommendations in Phase 15)
- `nodeSummary` — already exists; used as append-only log: `[qa-id] ≤80-word summary\n[qa-id] ...`

**Anchor creation:** Second call returns `anchorName` (new) or `anchorId` (existing). If new, system creates an anchor node via `questionService` before patching the Q&A. Anchor node has: `isAnchorNode: true`, `title: anchorName`, `rootLabel: "Knowledge"`, `branchLabel`, `clusterLabel`, `nodeSummary: ""`, `qaCount: 0`.

**Q&A attachment:** After anchor exists, patch the Q&A node: `parentId = anchor.id`. Append `[qa-id] shortSummary` to `anchor.nodeSummary`. Increment `anchor.qaCount`.

### Anchor Node — What It Is NOT (LOCKED)

- NOT added to daily spaced repetition review
- NOT added to flashcard generation pipeline
- NOT added to podcast generation pipeline
- No `reviewSchedule` set on anchor nodes
- Excluded from `projectQuestionsToKnowledgeNodes` when `isAnchorNode === true`
- Anchor-level review is deferred to Phase 15 (Planner recommendations, anchor detail page)

### Hierarchy Understanding (LOCKED)

- Root: "Knowledge" (always one root, never shown as a separate node in mindmap)
- Branch: broad sub-discipline (e.g., "Psychology", "Computer Science", "Physics")
- Cluster: topic grouping that HOLDS MULTIPLE LEAF NODES (e.g., "Memory", "Machine Learning") — not a 1:1 with a specific question concept
- Anchor node: the leaf of the mindmap (e.g., "Transformer", "Spaced Repetition") — a concept container holding multiple Q&As
- Q&A nodes: individual question/answer pairs attached to an anchor via `parentId`, NOT visible in mindmap

### Mindmap Rendering (LOCKED)

- Only anchor nodes (`isAnchorNode: true`) appear as leaf nodes in the mindmap
- Individual Q&A nodes (`parentId` pointing to anchor) are hidden from the mindmap tree
- Mind-Elixir expand/retract: clicking an anchor node reveals its attached Q&A nodes as children
- `buildMindElixirData` in `GraphScreen.tsx` must filter out non-anchor leaf nodes from `buildReflectionTree` output
- Q&A nodes revealed on expand show their `title` (question text, truncated)

### Merge Behavior (LOCKED)

- `outcome: merge` means two Q&As are truly about the same concept → second Q&A merges into existing node
- For merged nodes: existing anchor's labels are preserved (anchor was already correctly classified)
- Second call's `anchorId` determines which anchor the merged node belongs to
- Merge does NOT reclassify the anchor

### Claude's Discretion

- Exact prompt wording for the second classification call
- Whether to batch anchor creation + Q&A patching in one DB transaction or two sequential patches
- Error handling if second call fails (e.g., network error) — fallback to keyword-derived labels acceptable
- Exact Mind-Elixir API calls for expand/retract behavior
- How to handle Q&As created before Phase 14 (legacy nodes without anchors) — suggest showing them as-is under their existing branch/cluster without anchors until a migration pass

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Classification Pipeline
- `app/src/services/question.service.ts` — `ask()` function (first LLM call, filterQuestion gate), `buildAndSave()` — primary modification target
- `app/src/services/canonical-knowledge.service.ts` — `decideIngestionOutcome()`, `buildCandidateContextPack()`, `formatCandidateContextPack()`, `buildReflectionTree()` — core classification logic
- `app/src/services/question-filter.service.ts` — `filterQuestion()` — the gate that determines second call eligibility

### Mindmap Rendering
- `app/src/screens/GraphScreen.tsx` — `buildMindElixirData()`, `MasterMap` component — mindmap tree construction
- `app/src/services/graph.service.ts` — `graphService.getGraph()`, `getChildren()` — graph data access

### Types & Schema
- `app/src/types/index.ts` — `Question` type (add `isAnchorNode`, `qaCount`), `KnowledgeNode` type, `IngestionDecision` type

### Existing Patterns
- `app/src/providers/llm/index.ts` — `chatCompletion()` — how to make LLM calls

</canonical_refs>

<specifics>
## Specific Ideas

- Second call response JSON: `{ "briefAnswer": "...(≤30 words)", "keyword": "...", "rootLabel": "Knowledge", "branchLabel": "...", "clusterLabel": "...", "anchorName": "...", "anchorId": "optional-existing-anchor-id" }`
- Anchor `nodeSummary` format: `[qa-abc123] Spaced repetition uses increasing intervals to improve long-term retention efficiently.\n[qa-def456] The forgetting curve shows exponential decay of memory without reinforcement.`
- Branch naming examples in prompt: "Psychology", "Computer Science", "Physics", "Economics", "Biology" — broad academic domains
- Cluster naming examples: "Memory", "Machine Learning", "Thermodynamics" — topic groupings (NOT "Spaced Repetition concepts" or "Memory cluster")
- Anchor naming examples: "Spaced Repetition", "Transformer Architecture", "Entropy" — clean nouns

</specifics>

<deferred>
## Deferred to Phase 15

- Planner recommendations when `qaCount > 5`
- Anchor detail page (navigate from mindmap tap)
- Delegated flashcard review (all Q&A flashcards for an anchor)
- Comprehensive podcast generation from anchor `nodeSummary`
- Migration pass for legacy Q&A nodes without anchors

</deferred>

---

*Phase: 14-knowledge-graph-classification-anchor-nodes*
*Context gathered: 2026-03-29 via design discussion*
