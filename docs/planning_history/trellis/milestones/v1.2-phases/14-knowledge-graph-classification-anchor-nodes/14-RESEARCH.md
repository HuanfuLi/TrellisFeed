# Phase 14: Knowledge Graph Classification & Anchor Nodes - Research

**Researched:** 2026-03-29
**Domain:** LLM Integration, Knowledge Graph Architecture, Mind-Elixir Tree Rendering, Database Schema
**Confidence:** HIGH (locked decisions well-documented; implementation patterns verified from codebase)

## Summary

Phase 14 implements a two-call LLM architecture that separates question answering from knowledge graph classification, introducing concept anchor nodes to replace noisy branch/cluster names in the mindmap. The design is technically sound and implementable with existing patterns already established in the codebase:

1. **First LLM call** (existing): Returns `{answer, summary, keywords, storyHook, shortSummary}` only — no classification
2. **Second LLM call** (new): After `filterQuestion` confirms the Q&A enters the knowledge graph, classify via LLM returning `{branchLabel, clusterLabel, anchorName, anchorId?}`
3. **Anchor nodes**: Stable concept containers (clean noun names) that appear as mindmap leaves; Q&A nodes hidden via `parentId` attachment
4. **Mindmap filtering**: `buildMindElixirData` must filter `buildReflectionTree` output to show only `isAnchorNode: true` leaves

**Primary recommendation:** Implement sequential LLM calls (first → filterQuestion gate → second) with deferred error handling to fallback on second-call failure; use Mind-Elixir's native `expanded` property for anchor expand/retract (no custom collapse logic needed).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Two-call split (LOCKED):** Remove `knowledgeDecision` from first call; dedicated second call handles classification only
- **Second call gate (LOCKED):** Fires ONLY after `filterQuestion` confirms `flagged !== true`
- **Anchor node schema (LOCKED):** `isAnchorNode: boolean`, `qaCount: number`, `nodeSummary` as append-only log
- **Q&A attachment (LOCKED):** Via `parentId` field; `nodeSummary` appended with Q&A ID bindings
- **Mindmap rendering (LOCKED):** Only anchor nodes (`isAnchorNode === true`) appear as leaves
- **Merge behavior (LOCKED):** Existing anchor's labels preserved (not reclassified); second call's `anchorId` determines target

### the agent's Discretion
- Exact prompt wording for second classification call
- Whether anchor creation + Q&A patching use one DB transaction or two sequential patches
- Error handling if second call fails (network, timeout, invalid JSON) — fallback acceptable
- Exact Mind-Elixir API calls for expand/retract behavior
- Q&A handling created before Phase 14 (legacy without anchors) — show as-is until migration

### Deferred Ideas (OUT OF SCOPE)
- Planner recommendations when `qaCount > 5` (Phase 15)
- Anchor detail page navigation (Phase 15)
- Delegated flashcard/podcast review from anchors (Phase 15)
- Comprehensive migration pass for legacy nodes (Phase 15+)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRAPH-01 | Classification uses dedicated second LLM call (fired only after filterQuestion confirms Q&A enters mindmap), keeping answer generation and placement separate | Sequential call pattern documented; filterQuestion gate confirmed in codebase |
| GRAPH-02 | Second call receives question text, ≤30-word self-answer for context, most descriptive keyword, and existing branches/clusters from tree — never inherits labels from poorly-classified nodes | `buildCandidateContextPack` provides branch/cluster extraction; prompt engineering for second call detailed below |
| GRAPH-03 | `decideIngestionOutcome` returns only `{outcome, targetNodeId}` — all label fields stripped; labels sourced exclusively from second call | Current `decideIngestionOutcome` returns labels; requires refactoring to strip labels |
| GRAPH-04 | Concept anchor nodes explicitly created by LLM with clean noun/concept name, separate from Q&A leaf nodes | Anchor creation flow designed as sequential patches; schema additions to `Question` type |
| GRAPH-05 | Q&A nodes attach to concept anchor via `parentId`; anchor maintains append-only `nodeSummary` log of short Q&A summaries with Q&A ID bindings | `parentId` already exists in schema; `nodeSummary` append pattern detailed |
| GRAPH-06 | Mindmap renders only concept anchor nodes as leaves; individual Q&As hidden and accessible via Mind-Elixir expand/retract | `buildMindElixirData` must filter `buildReflectionTree` by `isAnchorNode`; expand/retract handled by Mind-Elixir native `expanded` property |
</phase_requirements>

## Standard Stack

### Core Dependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mind-elixir | 5.9.3 | Knowledge graph mindmap visualization | Already integrated in EchoLearn; native expand/retract support |
| OpenAI/Claude/Gemini | (via providers/llm) | LLM API calls (both classification calls) | Multi-provider abstraction already established |
| React | 18.x | UI framework for GraphScreen tree rendering | Project standard |
| SQLite (via db.service) | (Capacitor) | Persistent storage for questions and labels | Existing data layer |

### Supporting Patterns
| Pattern | Location | Purpose | Usage |
|---------|----------|---------|-------|
| `chatCompletion()` | `app/src/providers/llm/index.ts` | Multi-provider LLM abstraction | Call twice: first for Q&A, second for classification |
| `filterQuestion()` | `app/src/services/question-filter.service.ts` | Off-topic/meta-Q&A gate | Must complete before second LLM call fires |
| `buildReflectionTree()` | `app/src/services/canonical-knowledge.service.ts` | Hierarchical tree structure builder | Used by mindmap; must filter by `isAnchorNode` |
| `dbExecute()` / `dbQuery()` | `app/src/services/db.service.ts` | SQLite transaction wrapper | For anchor creation + Q&A patching (single or sequential) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequential LLM calls | Batch/parallel calls | Batch saves latency but ambiguous error handling; sequential is clearer for gate logic |
| Anchor creation via second LLM | Hard-coded clustering algorithm | LLM provides semantic quality; algorithm less flexible to domain changes |
| `parentId` for Q&A attachment | New `anchorIds` array | `parentId` already in schema; single parent simpler than multi-ancestor |

---

## Architecture Patterns

### Two-Call LLM Pipeline

**Pattern:** Sequential LLM calls with gate between them, not parallel.

**Flow:**
```
1. ask() → chatCompletion(question) → {answer, summary, keywords, storyHook, shortSummary}
2. buildAndSave() → Save Q&A with empty labels (rootLabel, branchLabel, clusterLabel = undefined)
3. filterQuestion() → Evaluate if off-topic/flagged
4. IF flagged !== true:
      → Second LLM call for classification
      → classifyQuestion(question, existingTree) → {branchLabel, clusterLabel, anchorName, anchorId?}
   ELSE: (flagged Q&A: skip second call, no mindmap entry)
5. IF anchorId provided: Attach Q&A to existing anchor
   ELSE IF anchorName provided: Create new anchor node, then attach Q&A
```

**Why sequential, not parallel:**
- Gate logic requires `filterQuestion()` to complete first
- Second call needs clean tree structure as context (no "Likely branches" from candidate pack — avoids feedback loop)
- Error handling clearer: if first succeeds but second fails, Q&A saved with fallback labels

**Why NOT inherited labels:** Second call receives only `branchLabel` and `clusterLabel` names (not summaries or full nodes). This breaks the feedback loop where vague existing labels inform the LLM to produce more vague labels. The LLM sees "Machine Learning" branch exists and can reason about it; does NOT see "Your concepts" cluster and get confused.

### Schema Additions

**Question type updates:**

```typescript
export interface Question {
  // ... existing fields ...
  
  // Phase 14 additions
  isAnchorNode?: boolean;      // true if this Question is a concept anchor (not a Q&A)
  qaCount?: number;            // count of Q&As attached to this anchor
  shortSummary?: string;       // ≤80 words, used as anchor nodeSummary entry
  
  // Existing fields repurposed
  parentId?: string;           // Points to anchor node ID if Q&A is attached to anchor
  nodeSummary?: string;        // Append-only log: "[qa-id] summary\n[qa-id] summary"
}
```

**IngestionDecision refactoring:**

Current:
```typescript
export interface IngestionDecision {
  outcome: 'merge' | 'refine' | 'new';
  targetNodeId?: string;
  rootLabel?: string;           // ← Include in decision
  branchLabel?: string;         // ← Include in decision
  clusterLabel?: string;        // ← Include in decision
  placementReason?: string;     // ← Include in decision
}
```

Phase 14 change:
```typescript
export interface IngestionDecision {
  outcome: 'merge' | 'refine' | 'new';
  targetNodeId?: string;
  // Labels REMOVED — sourced from second LLM call only
  // (decideIngestionOutcome no longer returns labels)
}
```

### Anchor Creation & Q&A Attachment Flow

**Step 1: Create Anchor (if new)**

```typescript
// Second LLM call returns anchorName (new) or anchorId (existing)
if (classificationResult.anchorId) {
  // Attach to existing anchor — skip creation
  targetAnchorId = classificationResult.anchorId;
} else {
  // Create new anchor node
  const anchorNode: Question = {
    id: newId(),
    timestamp: Date.now(),
    date: today(),
    content: '',  // Anchors have no original question
    answer: '',
    summary: '',
    title: classificationResult.anchorName,
    keywords: [classificationResult.keyword],
    relatedQuestionIds: [],
    categoryIds: [],
    reviewSchedule: { nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    // Classification labels from second call
    rootLabel: 'Knowledge',
    branchLabel: classificationResult.branchLabel,
    clusterLabel: classificationResult.clusterLabel,
    // Anchor-specific fields
    isAnchorNode: true,
    qaCount: 0,
    nodeSummary: '',
    flagged: false,  // Anchors are never flagged
  };
  persistToSQLite(anchorNode);
  targetAnchorId = anchorNode.id;
}
```

**Step 2: Attach Q&A to Anchor**

```typescript
// Patch the Q&A with anchor reference
const qaNode = questionService.getAll().find(q => q.id === qaId);
const patch: Partial<Question> = {
  parentId: targetAnchorId,
  rootLabel: classificationResult.branchLabel, // Inherit classification labels
  branchLabel: classificationResult.branchLabel,
  clusterLabel: classificationResult.clusterLabel,
};
questionService.patchQuestion(qaId, patch);

// Append to anchor's nodeSummary log
const anchor = questionService.getAll().find(q => q.id === targetAnchorId);
const newSummaryEntry = `[${qaId}] ${classificationResult.shortSummary}\n`;
const updatedNodeSummary = (anchor.nodeSummary || '') + newSummaryEntry;
questionService.patchQuestion(targetAnchorId, {
  nodeSummary: updatedNodeSummary,
  qaCount: (anchor.qaCount || 0) + 1,
});
```

**Transaction safety:**
- Single vs. sequential: Claude's discretion
- **Recommended:** Sequential patches (anchor creation → Q&A patch → nodeSummary append) because:
  - Simpler error recovery: if second patch fails, anchor exists but Q&A not yet attached
  - No concurrent write conflicts if multiple Q&As attach to same anchor simultaneously (each patchQuestion call is independent)
  - Fallback strategy clear: if second-call fails, Q&A saved with empty labels (visible in mindmap under fallback "General concepts" until second-call retry succeeds)

### Second LLM Classification Call — Prompt Design

**System prompt guidance:**

```
You are a knowledge graph classifier. Your task is to classify a learning question into a concept hierarchy and assign it to a concept anchor.

HIERARCHY DEFINITION:
- Root: "Knowledge" (always — do not modify)
- Branch: broad academic sub-discipline (e.g., "Psychology", "Computer Science", "Physics", "Biology", "Economics")
  → Branches are ALWAYS ≥2 words, wide topics that can hold many clusters
  → Examples: "Cognitive Science", "Distributed Systems", "Organic Chemistry"
- Cluster: topic grouping that holds multiple anchors (e.g., "Memory", "Machine Learning", "Thermodynamics")
  → Clusters are groupings, NOT the concept of the question itself
  → Examples: "Memory" (holds "Spaced Repetition", "Forgetting Curve", "Encoding Specificity")
            "Machine Learning" (holds "Neural Networks", "Decision Trees", "Gradient Descent")
- Anchor: clean noun/concept name for this specific question (e.g., "Transformer", "Spaced Repetition", "Entropy")
  → Anchors are singular concepts — what IS the question asking about?

TREE CONTEXT:
You are provided the existing tree structure as a list of branches and their clusters. Reuse existing branches/clusters when the question fits them. Create new ones only when necessary.

CLASSIFICATION TASK:
1. Write a ≤30-word self-answer to the question (for your own context — not returned)
2. Extract the single most descriptive keyword from the question
3. Determine: branchLabel, clusterLabel, anchorName, and (if attaching to existing anchor) anchorId
4. Format response as JSON:
{
  "briefAnswer": "≤30 words",
  "keyword": "single_keyword",
  "rootLabel": "Knowledge",
  "branchLabel": "broad academic domain",
  "clusterLabel": "topic grouping",
  "anchorName": "concept noun or existing anchor name if reusing",
  "anchorId": "optional existing anchor ID to reuse"
}

RULES:
- Branch names are BROAD sub-disciplines (Psychology, Computer Science). Never make them question-specific.
- Cluster names are TOPIC GROUPINGS (Memory, Machine Learning). Never make them the concept itself.
- Anchor names are the CONCEPT OF THE QUESTION (Spaced Repetition, Transformer, Entropy).
- If the question is about "How does the transformer architecture work?" → anchor should be "Transformer", not "Transformer architecture" or "How transformers work".
- Existing tree: {branch: [cluster1, cluster2, ...]} — reuse branches and clusters you recognize.
- If question doesn't fit any existing cluster, propose a new cluster name that groups similar concepts.
```

**Example call (for context):**

Input:
```
Question: "What is spaced repetition and how does it improve memory?"
Existing tree: {
  "Psychology": ["Memory", "Learning", "Cognition"],
  "Computer Science": ["Machine Learning", "Algorithms"]
}
```

Expected output:
```json
{
  "briefAnswer": "Spaced repetition uses increasing time intervals between review sessions to optimally combat forgetting.",
  "keyword": "spaced_repetition",
  "rootLabel": "Knowledge",
  "branchLabel": "Psychology",
  "clusterLabel": "Memory",
  "anchorName": "Spaced Repetition"
}
```

(No `anchorId` — first time seeing this concept, so new anchor created.)

### Mind-Elixir Expand/Retract Integration

**Current behavior:**
- `buildMindElixirData()` creates tree: Root → Branches → Clusters → Nodes
- Each node is clickable; clicking navigates to question detail
- No native expand/retract — all levels expanded by default

**Phase 14 changes:**
- Anchor nodes become new leaf level (replacing Q&A nodes)
- Q&A nodes become hidden children of anchor nodes
- Click anchor → expand to show attached Q&As
- Click Q&A (when expanded) → navigate to question detail

**Mind-Elixir API for expand/retract:**

From `mind-elixir` types, `NodeObj` includes:
```typescript
export interface NodeObj {
  topic: string;
  id: string;
  children?: NodeObj[];     // Sub-nodes
  expanded?: boolean;       // Native Mind-Elixir expand/retract flag
  // ... other properties
}
```

**Native expand/retract behavior:**
- `expanded: true` → node's children shown
- `expanded: false` → node's children hidden
- Mind-Elixir handles UI state automatically (expand/retract arrows)
- Clicking expander arrow toggles `expanded` state

**Implementation:**

```typescript
function buildMindElixirData(nodes: Question[]): MindElixirData {
  const rootObj: NodeObj = {
    id: 'root-knowledge',
    topic: 'Knowledge',
    children: [],
    expanded: true,
  };

  if (nodes.length === 0) return { nodeData: rootObj };
  
  // Build reflection tree (existing)
  const reflection = buildReflectionTree(nodes);
  
  // PHASE 14: Filter to anchors only at leaf level
  const children: NodeObj[] = [];
  for (const root of reflection) {
    if (root.rootLabel === 'Knowledge') {
      for (const branch of root.branches) {
        children.push({
          id: `branch-${branch.branchLabel}`,
          topic: branch.branchLabel,
          expanded: false,  // Branches collapsed by default
          children: branch.clusters.map((cluster) => ({
            id: `cluster-${branch.branchLabel}-${cluster.clusterLabel}`,
            topic: cluster.clusterLabel,
            expanded: false,  // Clusters collapsed by default
            // PHASE 14: Filter to anchor nodes only
            children: cluster.nodes
              .filter(node => node.isAnchorNode === true)  // Show only anchors
              .map((anchorNode) => {
                // Get attached Q&A nodes via parentId filter
                const attachedQAs = nodes
                  .filter(q => q.parentId === anchorNode.id && !q.isAnchorNode)
                  .map(qa => ({
                    id: qa.id,
                    topic: truncate(qa.title, 60),
                    children: [],
                  }));
                
                return {
                  id: anchorNode.id,
                  topic: truncate(anchorNode.title, 60),
                  expanded: false,  // Anchor collapsed by default; expand to show Q&As
                  children: attachedQAs,  // Q&A nodes as children of anchor
                };
              }),
          })),
        });
      }
    }
  }
  rootObj.children = children;
  return { nodeData: rootObj };
}
```

**Why this works:**
1. Mind-Elixir natively handles `expanded` state — no custom collapse logic needed
2. Clicking anchor node shows/hides Q&A children (automatic)
3. Q&A nodes appear as leaf nodes when anchor expanded (or not rendered at all if collapsed)
4. Clicking Q&A node → same handler as current implementation → navigate to question detail

**Backward compatibility (legacy Q&As without anchors):**
- If a Q&A node has NO `parentId` and `isAnchorNode !== true`, show it as-is in cluster
- Filter logic: `if (node.isAnchorNode === true || !node.parentId)` → show in tree
- Anchor only if `isAnchorNode === true`
- Q&A only if `parentId && !isAnchorNode`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Node expand/collapse UI | Custom state machine for expand/retract | Mind-Elixir's native `expanded: boolean` property | Mind-Elixir handles rendering, animation, arrow state automatically; custom code would duplicate this |
| Tree filtering | Custom recursive filter for anchor-only leaves | Phase logic in `buildMindElixirData()` — filter `buildReflectionTree` output at map-time | Single-pass filter is clear; recursive traversal would be fragile |
| LLM prompt engineering | Custom JSON template parsing | Use structured `chatCompletion()` with example in system prompt | Project already routes LLM calls through `chatCompletion()`; examples in system prompt work across all providers |
| Transaction coordination | Custom anchor + Q&A update sequencing with locks | Sequential `patchQuestion()` calls (already atomic at individual level) | SQLite via Capacitor handles row-level isolation; multiple questions won't race on same patch |
| Error handling for second LLM call | Custom fallback classifier algorithm | Simple fallback: use keyword-derived labels if second call fails | Keywords already extracted; labels already have fallback generation in `buildFallbackPlacement()` |

**Key insight:** Mind-Elixir's tree model is already hierarchical and supports expand/retract natively. The implementation is a data structure change (add anchor nodes, filter Q&As to be children), NOT a UI change.

## Common Pitfalls

### Pitfall 1: Second LLM Call Receives "Likely Branches" from Candidate Pack
**What goes wrong:** If `formatCandidateContextPack()` is called again for the second classification call, the LLM sees "Likely branches: Your concepts, Concept cluster..." and perpetuates vague labels.

**Why it happens:** Current `ask()` uses `formatCandidateContextPack()` to give the LLM context. This pattern might be copied for the second call without realizing the source of the labels is the problem.

**How to avoid:** Second call receives ONLY:
- Question text
- ≤30-word self-answer (from first call result)
- Most descriptive keyword
- **Existing tree: list of unique branch names and their cluster names only** (no summaries, no candidate nodes, no "Likely" prefix)

**Implementation:**
```typescript
// DO THIS for second call context:
const existingBranches = new Map<string, Set<string>>();
for (const q of store) {
  if (q.branchLabel && q.clusterLabel) {
    const clusters = existingBranches.get(q.branchLabel) || new Set();
    clusters.add(q.clusterLabel);
    existingBranches.set(q.branchLabel, clusters);
  }
}
const treeContext = Array.from(existingBranches.entries())
  .map(([branch, clusters]) => `${branch}: ${Array.from(clusters).join(', ')}`)
  .join('\n');

// NOT THIS (current pattern for first call):
// const candidatePack = buildCandidateContextPack(question, store);
// const contextStr = formatCandidateContextPack(candidatePack);  // ← Do not use
```

### Pitfall 2: Filtering `buildReflectionTree` Output at Wrong Time
**What goes wrong:** Trying to filter `buildReflectionTree` output INSIDE the function instead of in `buildMindElixirData()`, causing cascading issues (empty clusters, broken tree hierarchy).

**Why it happens:** Temptation to filter early for "efficiency", but `buildReflectionTree` groups by branch/cluster regardless of anchor status.

**How to avoid:** Filter in `buildMindElixirData()` AFTER `buildReflectionTree()` returns. Map-time filtering is clear and preserves tree structure.

**Warning signs:** If `buildReflectionTree` suddenly returns empty clusters or the tree has gaps, filtering happened too early.

### Pitfall 3: `parentId` Points to Non-Existent Anchor
**What goes wrong:** Second LLM call returns `anchorId` referencing an anchor that doesn't exist (typo, stale ID, race condition on concurrent writes).

**Why it happens:** No validation that `anchorId` exists before using it to patch Q&A.

**How to avoid:** Before attaching Q&A, verify anchor exists:
```typescript
const anchorToUse = store.find(q => q.id === classificationResult.anchorId);
if (!anchorToUse || !anchorToUse.isAnchorNode) {
  // Anchor missing or invalid — create new anchor with anchorName
  // (fallback to new anchor creation)
}
```

**Warning signs:** Q&A nodes with `parentId` pointing to non-existent nodes; mindmap shows orphaned Q&As.

### Pitfall 4: Second LLM Call Fails — Q&A Saved Without Labels
**What goes wrong:** If the second LLM call times out or returns invalid JSON, the Q&A is already saved with undefined/empty label fields, leaving it orphaned.

**Why it happens:** First call completes, Q&A saved immediately. Second call fires asynchronously. If async fails, no rollback.

**How to avoid:** 
- Expected behavior: Q&A saved with empty labels initially
- Second call classifies and patches labels onto the Q&A
- If second call fails: labels remain empty, displayed via `buildFallbackPlacement()` fallback generation
- This is acceptable (not an error state) — Q&A is still in the knowledge graph, just under generic fallback labels

**Alternative:** Defer Q&A save until second call completes (but increases latency for user feedback).

**Warning signs:** Many Q&As with `rootLabel`, `branchLabel`, `clusterLabel` all undefined; indicates second call failures. Should be visible in logs/metrics.

### Pitfall 5: `nodeSummary` Append Without Deduplication
**What goes wrong:** If a Q&A is attached to the same anchor twice (user retry, duplicate ingestion, merge), `nodeSummary` accumulates duplicates: `[qa-id] summary\n[qa-id] summary\n`.

**Why it happens:** No check for existing Q&A ID in the append-only log before adding entry.

**How to avoid:** Before appending to `nodeSummary`, check if Q&A ID already present:
```typescript
const existing = anchor.nodeSummary || '';
if (!existing.includes(`[${qaId}]`)) {
  const updated = existing + `[${qaId}] ${shortSummary}\n`;
  // ... patch anchor
}
```

**Warning signs:** `nodeSummary` contains same Q&A ID multiple times; indicates append happened without deduplication check.

### Pitfall 6: Merge Outcome — Should NOT Reclassify Existing Anchor
**What goes wrong:** When two Q&As merge into the same node, the second LLM call re-classifies the target, overwriting its original branch/cluster labels.

**Why it happens:** Confusion about whether the second call should *always* return labels or only for *new* questions.

**How to avoid:** For `outcome: merge`, **skip the second LLM call entirely**. The target node's existing labels are already correct. Use its `branchLabel` and `clusterLabel` directly for the merged Q&A.

```typescript
if (decision.outcome === 'merge' && decision.targetNodeId) {
  // DO NOT call second LLM for merge
  // Reuse target's existing classification
  const targetNode = store.find(q => q.id === decision.targetNodeId);
  return {
    branchLabel: targetNode.branchLabel,
    clusterLabel: targetNode.clusterLabel,
    anchorName: targetNode.title,
    anchorId: decision.targetNodeId,
  };
}
```

**Warning signs:** Merges cause anchor labels to change unexpectedly; indicates reclassification happening.

### Pitfall 7: Legacy Q&As Without Anchors — Confusion in Hierarchy
**What goes wrong:** Q&As created before Phase 14 have no `parentId` and `isAnchorNode` is undefined. When mixed with new anchor-based Q&As, the tree structure becomes confusing (some leaves are Q&As, some are anchors).

**Why it happens:** Schema migration incomplete; legacy data not transformed during Phase 14 execution.

**How to avoid:** Phase 14 does NOT include migration pass (deferred to Phase 15). For now:
- In `buildMindElixirData()`, show legacy Q&As as-is (no change to existing behavior)
- New Q&As attach to anchors
- Mixed tree is acceptable during transition period
- Filtering: show node if `isAnchorNode === true` OR (`!parentId && !isAnchorNode`) — include both anchors and legacy orphans

**Migration strategy (Phase 15):** Batch classify all legacy Q&As, create/attach to anchors retroactively.

**Warning signs:** Mixed tree with some leaves as Q&As and some as anchors; indicates no filtering applied or incomplete migration.

## Code Examples

### Example 1: Second LLM Classification Call — Sequential Pattern

```typescript
// Location: question.service.ts ask() method, after filterQuestion gate

async function classifyQuestion(
  question: Question,
  store: Question[],
  llmConfig: LLMConfig,
): Promise<{
  branchLabel: string;
  clusterLabel: string;
  anchorName: string;
  anchorId?: string;
  shortSummary: string;
  keyword: string;
}> {
  // Build tree context: unique branches and their clusters (NO candidate pack)
  const existingBranches = new Map<string, Set<string>>();
  for (const q of store) {
    if (q.branchLabel && q.clusterLabel && q.flagged !== true) {
      const clusters = existingBranches.get(q.branchLabel) || new Set();
      clusters.add(q.clusterLabel);
      existingBranches.set(q.branchLabel, clusters);
    }
  }
  const treeContext = Array.from(existingBranches.entries())
    .map(([branch, clusters]) => `${branch}: ${Array.from(clusters).join(', ')}`)
    .join('\n') || '(empty tree)';

  // Extract keyword (most descriptive from keywords array)
  const keyword = question.keywords?.[0] || 'general';

  const systemPrompt = `You are a knowledge graph classifier...
[Full prompt from Pitfall section above]

Current tree structure:
${treeContext}`;

  const userPrompt = `Question: "${question.content}"
Self-answer (≤30 words): "${question.summary?.slice(0, 100)}"
Keyword: "${keyword}"

Classify this question into the tree. Respond ONLY with valid JSON (no markdown).`;

  try {
    const raw = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      llmConfig,
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
      briefAnswer?: string;
      keyword?: string;
      rootLabel?: string;
      branchLabel?: string;
      clusterLabel?: string;
      anchorName?: string;
      anchorId?: string;
    };

    return {
      branchLabel: parsed.branchLabel || 'General concepts',
      clusterLabel: parsed.clusterLabel || 'Open questions',
      anchorName: parsed.anchorName || question.title || 'New concept',
      anchorId: parsed.anchorId,
      shortSummary: question.summary?.slice(0, 80) || '',
      keyword: parsed.keyword || keyword,
    };
  } catch (err) {
    console.warn('[EchoLearn] classification call failed, using fallback labels:', err);
    // Graceful degradation: return fallback labels
    return {
      branchLabel: 'General concepts',
      clusterLabel: keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' cluster',
      anchorName: question.title || 'New concept',
      shortSummary: question.summary?.slice(0, 80) || '',
      keyword,
    };
  }
}

// In ask() method, after filterQuestion:
if (question.flagged !== true) {
  try {
    const classification = await classifyQuestion(question, store, llmConfig);
    // ... proceed with anchor creation + Q&A attachment (Example 2)
  } catch (err) {
    // If classification fails, Q&A already saved with fallback labels
    console.warn('[EchoLearn] classification error, Q&A saved with fallback labels:', err);
  }
}
```

**Source:** Pattern derived from `question.service.ts` existing `ask()` method and `providers/llm/index.ts` `chatCompletion()` pattern.

### Example 2: Anchor Creation & Q&A Attachment — Sequential Patches

```typescript
// Location: question.service.ts, after classifyQuestion() returns

async function attachToAnchor(
  qaQuestion: Question,
  classification: ReturnType<typeof classifyQuestion>,
  llmConfig: LLMConfig,
): Promise<void> {
  const store = loadStore();

  // Step 1: Find or create anchor
  let targetAnchorId: string;
  if (classification.anchorId) {
    // Verify anchor exists
    const existingAnchor = store.find(q => q.id === classification.anchorId);
    if (existingAnchor?.isAnchorNode === true) {
      targetAnchorId = classification.anchorId;
    } else {
      // Anchor missing or invalid — create new one
      targetAnchorId = await createAnchorNode(classification);
    }
  } else {
    // Create new anchor
    targetAnchorId = await createAnchorNode(classification);
  }

  // Step 2: Patch Q&A with parentId and classification labels
  const qaPatch: Partial<Question> = {
    parentId: targetAnchorId,
    rootLabel: 'Knowledge',
    branchLabel: classification.branchLabel,
    clusterLabel: classification.clusterLabel,
  };
  questionService.patchQuestion(qaQuestion.id, qaPatch);

  // Step 3: Append Q&A to anchor's nodeSummary (with dedup check)
  const freshStore = loadStore();
  const anchor = freshStore.find(q => q.id === targetAnchorId);
  if (anchor) {
    const existing = anchor.nodeSummary || '';
    // Dedup check
    if (!existing.includes(`[${qaQuestion.id}]`)) {
      const newEntry = `[${qaQuestion.id}] ${classification.shortSummary}\n`;
      const updated = existing + newEntry;
      questionService.patchQuestion(targetAnchorId, {
        nodeSummary: updated,
        qaCount: (anchor.qaCount || 0) + 1,
      });
    }
  }
}

async function createAnchorNode(classification: ReturnType<typeof classifyQuestion>): Promise<string> {
  const anchorNode: Question = {
    id: `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    date: today(),
    content: '',  // Anchors have no original question
    answer: '',
    summary: '',
    title: classification.anchorName,
    keywords: [classification.keyword],
    relatedQuestionIds: [],
    categoryIds: [],
    reviewSchedule: { nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    aliases: [],
    sourcePrompts: [],
    sourceQuestionIds: [],
    rootLabel: 'Knowledge',
    branchLabel: classification.branchLabel,
    clusterLabel: classification.clusterLabel,
    nodeSummary: '',
    placementReason: 'Anchor node for concept grouping',
    isAnchorNode: true,
    qaCount: 0,
    flagged: false,
  };
  
  // Persist to both localStorage and SQLite
  const store = loadStore();
  saveStore([...store, anchorNode]);
  persistToSQLite(anchorNode);
  
  return anchorNode.id;
}
```

**Source:** Pattern derived from `question.service.ts` `buildAndSave()` method; `patchQuestion()` already exists.

### Example 3: Mindmap Filtering for Anchor-Only Leaves

```typescript
// Location: GraphScreen.tsx buildMindElixirData() function

function buildMindElixirData(nodes: Question[]): MindElixirData {
  const rootObj: NodeObj = {
    id: 'root-knowledge',
    topic: 'Knowledge',
    children: [],
    expanded: true,
  };

  if (nodes.length === 0) return { nodeData: rootObj };
  
  const reflection = buildReflectionTree(nodes);

  const children: NodeObj[] = [];
  for (const root of reflection) {
    if (root.rootLabel === 'Knowledge') {
      for (const branch of root.branches) {
        children.push({
          id: `branch-${branch.branchLabel}`,
          topic: branch.branchLabel,
          expanded: false,
          children: branch.clusters.map((cluster) => ({
            id: `cluster-${branch.branchLabel}-${cluster.clusterLabel}`,
            topic: cluster.clusterLabel,
            expanded: false,
            // PHASE 14: Filter to anchor nodes + legacy orphans (with children = attached Q&As)
            children: cluster.nodes
              // Show if anchor OR legacy Q&A without parentId
              .filter(node => node.isAnchorNode === true || (!node.parentId && !node.isAnchorNode))
              .map((node) => {
                // If anchor, include attached Q&As as children
                if (node.isAnchorNode === true) {
                  const attachedQAs = nodes
                    .filter(q => q.parentId === node.id && !q.isAnchorNode)
                    .map(qa => ({
                      id: qa.id,
                      topic: truncate(qa.title, 60),
                      children: [],
                    }));

                  return {
                    id: node.id,
                    topic: truncate(node.title, 60),
                    expanded: false,  // Collapsed by default; expand to show Q&As
                    children: attachedQAs,
                  };
                } else {
                  // Legacy Q&A (no anchor) — show as-is
                  return {
                    id: node.id,
                    topic: truncate(node.title, 60),
                    children: [],
                  };
                }
              }),
          })),
        });
      }
    } else {
      // Non-"Knowledge" roots (rare, but preserved for completeness)
      children.push({
        id: `root-${root.rootLabel}`,
        topic: root.rootLabel,
        expanded: false,
        children: root.branches.map((branch) => ({
          id: `branch-${root.rootLabel}-${branch.branchLabel}`,
          topic: branch.branchLabel,
          expanded: false,
          children: branch.clusters.map((cluster) => ({
            id: `cluster-${root.rootLabel}-${branch.branchLabel}-${cluster.clusterLabel}`,
            topic: cluster.clusterLabel,
            expanded: false,
            children: cluster.nodes
              .filter(node => node.isAnchorNode === true || (!node.parentId && !node.isAnchorNode))
              .map((node) => {
                if (node.isAnchorNode === true) {
                  const attachedQAs = nodes
                    .filter(q => q.parentId === node.id && !q.isAnchorNode)
                    .map(qa => ({ id: qa.id, topic: truncate(qa.title, 60), children: [] }));
                  return {
                    id: node.id,
                    topic: truncate(node.title, 60),
                    expanded: false,
                    children: attachedQAs,
                  };
                } else {
                  return {
                    id: node.id,
                    topic: truncate(node.title, 60),
                    children: [],
                  };
                }
              }),
          })),
        })),
      });
    }
  }
  rootObj.children = children;

  return { nodeData: rootObj };
}
```

**Source:** Adapted from existing `buildMindElixirData()` in GraphScreen.tsx; filter logic added at `children: cluster.nodes.filter(...)`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single LLM call for Q&A + classification | Two-call split (answer, then classify) | Phase 14 | Fixes vague labels by giving classification dedicated focus |
| Branch/cluster names from fallback generation | Branch/cluster names from dedicated LLM call | Phase 14 | Cleaner, more semantic tree structure |
| Q&A nodes directly in mindmap leaves | Anchor nodes as leaves; Q&As hidden | Phase 14 | Reduces visual clutter; improves discoverability of related concepts |
| "Likely branches" in candidate pack fed to LLM | Clean branch/cluster list only (no summaries) | Phase 14 | Breaks feedback loop of perpetuating vague labels |
| No explicit concept nodes | Explicit anchor nodes with `isAnchorNode` flag | Phase 14 | Enables Planner phase 15 recommendations at anchor level |
| No Q&A grouping metadata | `nodeSummary` append-only log + `qaCount` | Phase 14 | Enables anchor-level review (Phase 15) and podcast generation |

**Deprecated/outdated:**
- **`formatCandidateContextPack()` for second call:** Old pattern (feeding summarized candidates) creates label feedback loop. New second call uses clean branch/cluster names only.
- **Single LLM response containing both Q&A and classification:** Conflicting objectives confused the model. Separated into two focused calls.

## Open Questions

1. **Error recovery on second LLM call timeout**
   - What we know: Phase 14 defers second call to async (after Q&A persisted), so timeout doesn't block user
   - What's unclear: Should UI show "Classifying..." indicator? Should we retry on failure?
   - Recommendation: Let async complete silently; if fails, Q&A visible under fallback labels. Retry as part of Phase 15 batch classification pass.

2. **Mind-Elixir expand/retract performance with large anchor trees**
   - What we know: Mind-Elixir handles hierarchy natively; expand/retract is standard feature
   - What's unclear: Rendering performance if one anchor has 100+ Q&As attached
   - Recommendation: Reasonable for MVP (Phase 14). If Q&A count > 50 per anchor, consider lazy-loading children on Phase 15.

3. **Concurrent Q&A attachment to same anchor — race condition?**
   - What we know: Sequential `patchQuestion()` calls are atomic (SQLite row-level isolation)
   - What's unclear: If two Q&As simultaneously attach to same anchor, does `nodeSummary` append lose entries?
   - Recommendation: Sequential patches are safe because each `patchQuestion()` reads → appends → writes atomically. However, race on READ: both might read same `nodeSummary`, then both append. Acceptable for Phase 14 (edge case); fix in Phase 15 with mutex/queue pattern if needed.

4. **Legacy Q&A migration strategy — how aggressive?**
   - What we know: Phase 14 does NOT include migration; legacy Q&As show as-is
   - What's unclear: Should Phase 15 auto-migrate all legacy Q&As to anchors, or wait for user action?
   - Recommendation: Batch auto-migration in Phase 15. Classify all flagged=false Q&As without anchors; create/attach to anchors retroactively.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| LLM Provider (OpenAI/Claude/Gemini) | Second classification call | ✓ (user config) | varies | Fallback to keyword-derived labels |
| mind-elixir | Mindmap rendering (expand/retract UI) | ✓ | 5.9.3 | N/A — required for Phase 14 |
| SQLite (Capacitor) | Anchor creation + Q&A patching persistence | ✓ | (built-in) | localStorage fallback (already used) |
| Embedding service | Pre-call embedding for context ranking (first call) | ✓ (optional) | varies | Keyword-only ranking if unavailable |

**Missing dependencies with no fallback:**
- None — all critical dependencies available

**Missing dependencies with fallback:**
- LLM API: Second call fails → use keyword-derived fallback labels (already implemented in `buildFallbackPlacement()`)
- Embedding service: First call still works with keyword ranking only (graceful degradation)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing) |
| Config file | `app/jest.config.cjs` |
| Quick run command | `npm test -- --testPathPattern="question\|canonical" --maxWorkers=4` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | Classification second call fires after filterQuestion gate, not during first call | unit | `npm test -- question.service.test.ts -t "classifyQuestion"` | ❌ Wave 0 |
| GRAPH-02 | Second call receives clean tree (branch/cluster names only, no candidate summaries) | unit | `npm test -- question.service.test.ts -t "buildTreeContext"` | ❌ Wave 0 |
| GRAPH-03 | `decideIngestionOutcome` returns only `{outcome, targetNodeId}`, not labels | unit | `npm test -- canonical-knowledge.service.test.ts -t "decideIngestionOutcome"` | ✅ (exists, needs update) |
| GRAPH-04 | Anchor node creation sets `isAnchorNode: true`, `qaCount: 0`, `nodeSummary: ""` | unit | `npm test -- question.service.test.ts -t "createAnchorNode"` | ❌ Wave 0 |
| GRAPH-05 | Q&A attachment patches `parentId` and appends to anchor's `nodeSummary` without duplication | unit | `npm test -- question.service.test.ts -t "attachToAnchor"` | ❌ Wave 0 |
| GRAPH-06 | `buildMindElixirData` filters `buildReflectionTree` output: shows only anchor nodes as leaves, Q&As as children | unit | `npm test -- GraphScreen.test.tsx -t "buildMindElixirData filters"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="question\|canonical\|GraphScreen" --maxWorkers=4` (quick run)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `app/src/services/question.service.test.ts` — covers GRAPH-01, GRAPH-04, GRAPH-05 (second call gate, anchor creation, Q&A attachment)
- [ ] `app/src/services/question-filter.service.test.ts` — covers GRAPH-01 (filterQuestion gate behavior; existing tests may cover this)
- [ ] `app/src/screens/__tests__/GraphScreen.test.tsx` — covers GRAPH-06 (mindmap filtering for anchors)
- [ ] `app/src/types/index.ts` updates — add `isAnchorNode`, `qaCount`, `shortSummary` to `Question` interface
- [ ] `app/src/services/canonical-knowledge.service.test.ts` — update existing `decideIngestionOutcome` tests to verify labels are NOT returned (GRAPH-03)
- [ ] Framework: Jest already configured; no additional setup needed

*(Existing test infrastructure covers most patterns; Phase 14 adds new anchor-specific and filtering logic that requires new test coverage.)*

## Sources

### Primary (HIGH confidence)
- **Codebase — `app/src/services/question.service.ts`:** First LLM call pattern (`ask()` method), `buildAndSave()` Q&A persistence, `filterQuestion` gate integration verified (lines 161–292)
- **Codebase — `app/src/services/canonical-knowledge.service.ts`:** Current `decideIngestionOutcome()` logic, `buildReflectionTree()` hierarchy structure verified (lines 250–314)
- **Codebase — `app/src/screens/GraphScreen.tsx`:** Current `buildMindElixirData()` tree construction verified (lines 31–90); Mind-Elixir integration pattern confirmed
- **Codebase — `app/src/providers/llm/index.ts`:** Multi-provider `chatCompletion()` abstraction verified (lines 26–32); supports OpenAI, Claude, Gemini
- **Codebase — `app/src/types/index.ts`:** Current `Question`, `IngestionDecision` interfaces verified; schema additions identified
- **Mind-Elixir docs — `node_modules/mind-elixir/dist/types/types/index.d.ts`:** `NodeObj` interface includes `expanded: boolean` property (native expand/retract support confirmed)
- **CONTEXT.md — `.planning/phases/14-knowledge-graph-classification-anchor-nodes/14-CONTEXT.md`:** Design decisions locked; all major architecture points verified against current codebase

### Secondary (MEDIUM confidence)
- **npm registry — mind-elixir@5.9.3:** Installed version verified; matches project `package.json`
- **EchoLearn codebase patterns:** Transaction patterns in `db.service.ts`, patch patterns in `question.service.ts` (patchQuestion method), fallback label generation in `buildFallbackPlacement()` all verified as existing patterns
- **LLM provider patterns:** Sequential call pattern inferred from `ask()` method; second call pattern designed to match first call's error handling

### Tertiary (LOW confidence)
- **Mind-Elixir expand/retract performance:** Assumed to scale reasonably (typical tree nodes < 100 children); no explicit performance testing data in codebase. Recommendation: profile during Phase 14 implementation if anchor node > 50 Q&As.

## Metadata

**Confidence breakdown:**
- Standard Stack: **HIGH** — All libraries (mind-elixir, LLM providers, SQLite) already integrated; versions verified
- Architecture: **HIGH** — Design locked in CONTEXT.md; all patterns (two-call LLM, anchor nodes, mindmap filtering) verified against existing codebase; no novel approaches
- Pitfalls: **HIGH** — Common pitfalls identified by analyzing current `ask()` method, `buildReflectionTree()`, and `buildMindElixirData()` patterns
- Code Examples: **MEDIUM-HIGH** — Examples derived from existing patterns; some components (second LLM call, anchor creation) are new but follow established patterns
- Environment: **HIGH** — All dependencies already available; no missing tooling
- Validation: **MEDIUM** — Existing Jest framework; test coverage gaps for new anchor-specific logic clearly identified

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (30 days; stable domain, no rapid LLM API changes expected; mind-elixir stable minor version)

---

**Next Phase:** Ready for `/gsd-plan-phase` to create PLAN.md files. All research questions answered; no blockers identified. Implementation patterns clear; confidence sufficient to proceed.
