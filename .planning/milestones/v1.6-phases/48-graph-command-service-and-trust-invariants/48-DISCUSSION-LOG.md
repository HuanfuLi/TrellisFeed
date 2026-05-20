# Phase 48 Discussion Log

**Date:** 2026-05-17
**Phase:** 48 — Graph Command Service and Trust Invariants

This is a human-reference audit of the discuss-phase session. Not consumed by downstream agents (researcher, planner, executor) — they read `48-CONTEXT.md`.

---

## Areas selected for discussion

Operator selected ALL 4 surfaced gray areas:

1. Stale-write protection mechanism
2. Undo scope + depth + durability
3. Merge semantics
4. Command surface + rename normalization

---

## Area 1 — Stale-write protection

### Q1.1: Which stale-write protection mechanism?

**Options presented:**
- Manual-lock only (Recommended) — `manuallyEdited: boolean` per node
- Revision counter only — `rev: number` per node, async writes check rev
- Both layered

**Operator answer:** *"There is always only one user in a graph. Machine overwrite human correction can happen, but a machine overwrite happens only in a complete overhaul of the graph, so the tree structure can be different, making the lock lose its point. We probably should come up with a better way, like injecting human edit into the re-organize prompt as an extra guideline."*

**Interpretation captured:** Per-node revision or manual-lock both miss the point. The real hazard is `reorganizeMindmap()` rewriting tree structure such that "locked" nodes survive but their meaningful neighborhood does not. Protection lives at the *prompt input* layer (telling the reorg LLM what edits to respect), not at the *write conflict* layer.

**→ D-01:** Persistent edit journal in localStorage, injected into reorg LLM prompt as constraints.

### Q1.2: Where does the protection apply?

**Options presented:**
- Reorg only (Recommended)
- Reorg + classification respects prune list
- Reorg + classification respects all manual edits

**Operator answer:** Reorg only.

**→ D-02:** `commitClassificationResult` left unguarded. Per-Q&A classification routes by embedding similarity; renames don't break it. Re-creating a pruned anchor via new classification is "a different user moment."

---

## Area 2 — Undo scope + depth + durability

### Q2.1: One journal or two structures (edit log + undo stack)?

**Options presented:**
- One journal, two consumers (Recommended)
- Two separate structures

**Operator answer:** One journal, two consumers.

**→ D-03, D-04:** Single `trellis_graph_edit_log` array in localStorage. Schema defined in CONTEXT.md.

### Q2.2: Undo depth + journal retention cap?

**Options presented:**
- N=10 (Recommended)
- N=25
- N=50 (unbounded)

**Operator response:** Wanted Last-N undo, asked for clarification on what "journal" meant. Claude explained: persistent `trellis_graph_edit_log` localStorage array; entries like `{id, cmd, targetIds, before, after, ts}`; serves both reorg-prompt-constraints AND undo (pop newest, invert, push inverse).

**Operator answer:** N = 10 (recommended).

**→ D-05, D-06:** Cap and undo depth share the same N=10. Append-only; undo pushes an inverse entry rather than mutating prior entries.

---

## Area 3 — Merge semantics

### Q3.1 (initial): When merging anchor X into anchor Y, which side survives?

**Options presented:**
- User picks survivor explicitly (Recommended)
- Target always wins, source becomes alias
- Survivor inferred by heuristic, source hard-deleted

**Operator response:** Asked grounding question — *"I don't understand. In what situation will a merge happen? We currently only have reorg for entire map, and I assume we are adding user manual edit?"*

**Claude grounded the scenario:**
- Today: merge doesn't exist; reorg is the only restructure
- Phase 49 will surface UI for user-driven merge
- Motivating cases: duplicate anchors slipping past Phase 33's 0.82 dedup, conceptual consolidation, post-rename cleanup
- Re-asked: how does operator pick survivor?

**Operator answer (Q3.1 restated):** User picks explicitly in UI.

**→ D-07:** Service signature `merge(loserId, survivorId)`. UI presents directional "Merge X → Y" / "Merge Y → X" actions.

### Q3.2: Loser anchor fate after merge?

**Options presented:**
- Hard-delete; undo can resurrect (Recommended)
- Keep as alias (isAnchorNode=false, hidden, id resolves to survivor)

**Operator answer:** Hard-delete; undo can resurrect.

**→ D-10:** Loser anchor hard-deleted via `questionService.delete`. Journal entry stores loser's full pre-merge record so undo fully resurrects.

**Locked-by-cascade decisions:** D-08 (survivor preserves fields), D-09 (loser's QAs reparent — locked by GRAPH-03), D-11 (survivor qaCount + embeddingVector recomputed).

---

## Area 4 — Command surface + rename normalization

### Q4.1: What does `detach(qaId)` actually do?

**Options presented:**
- Move to 'Unassigned' default anchor (Recommended)
- parentId = null; renderer special-cases orphan bucket
- Re-classify (fire `classifyAndAnchorIncremental` again)

**Operator answer:** Re-classify.

**→ D-13:** `detach(qaId)` clears placement fields + fires `classifyAndAnchorIncremental` fire-and-forget. UX semantics = "find a better home for this." May no-op (route back to same anchor) — Phase 49 may surface toast.

### Q4.2 (batched): Command service surface?

**Options presented:**
- Named methods for each verb (Recommended)
- Few primitives + composition (patch, deleteOne, batch)

**Operator answer:** Named methods for each verb.

**→ D-12:** Public API has `rename`, `move`, `merge`, `detach`, `prune`, `delete`, `undo` as named methods.

### Q4.3 (batched): Rename normalization?

**Options presented:**
- Bypass — trust operator intent (Recommended)
- Apply `normalizeAnchorName`
- Smart middle ground (apply only when input looks question-shaped)

**Operator answer:** Bypass.

**→ D-16:** `rename` bypasses `normalizeAnchorName`. Hard validation only: reject empty, cap 100 chars, trim whitespace.

---

## Scope creep checks

None triggered. All 4 areas stayed within Phase 48 boundary (graph command service + journal + stale-write protection). Phase 49 UI surface noted in passing (merge direction picker, detach toast) but not designed in this session.

---

## Deferred items

Captured in CONTEXT.md `<deferred>` section. Key ones:
- Per-node `rev` / `manuallyEdited` (revisit if sync/collab mode ever)
- Alias-on-merge (revisit if Phase 50 retrieval needs stable IDs)
- Multi-level undo / redo UI (v1.7+ if heavy editing emerges)
- SQLite-backed journal (v1.7+)
- Consolidating `trellisActionsService.prune` into command service (researcher's call)

---

*Discussion completed: 2026-05-17. CONTEXT.md ready for `/gsd:plan-phase 48`.*
