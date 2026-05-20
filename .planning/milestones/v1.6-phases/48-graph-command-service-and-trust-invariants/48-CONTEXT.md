# Phase 48: Graph Command Service and Trust Invariants - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a single validated **graph command service** that owns every manual graph correction — rename, move, merge, detach, prune (soft), delete (hard), undo — over canonical `Question` records. Service-only phase; Phase 49 builds the selected-node UI on top.

Add a persistent **edit journal** in localStorage that serves two consumers: (a) `reorganizeMindmap()` reads it as LLM-prompt constraints so a full-tree LLM redo cannot silently undo manual corrections, and (b) `undo()` pops the newest entry and inverts it.

No new `Anchor` / `Cluster` types — anchors and clusters remain `Question` records with `isAnchorNode` / `isClusterNode` markers. All writes route through `questionService.patchQuestion` (localStorage primary, SQLite fire-and-forget backup). Single unified `GRAPH_UPDATED` event for emissions (no parallel event types — Phase 32.1 rule).

</domain>

<decisions>
## Implementation Decisions

### Stale-write protection (GRAPH-04)

- **D-01:** Stale-write protection is a **persistent edit journal injected into the reorg LLM prompt** as constraints, NOT a `rev: number` counter and NOT a `manuallyEdited: boolean` per-node lock.
  - Rationale (operator): single-user local app — no human-vs-human races to defend against. The real hazard is the global `reorganizeMindmap()` operation rewriting the tree structure such that locked nodes lose their meaningful neighborhood. A per-node lock would survive but the user's manual *intent* would not. Telling the reorg LLM "the user did X, Y, Z — respect those" preserves intent even when the tree shape changes.
  - Implementation: storage key `trellis_graph_edit_log` (localStorage). Each entry written by the command service; reorg prompt builder reads recent entries and emits them as numbered "manual corrections to preserve" constraints in the system prompt.

- **D-02:** Protection scope is **`reorganizeMindmap()` only**. `commitClassificationResult()` (per-Q&A incremental classification) is **NOT** guarded.
  - Rationale: per-Q&A classification doesn't restructure — it routes ONE new Q&A. Phase 33 embedding pre-check finds anchors by similarity not by name, so a rename doesn't break routing. If the user pruned anchor X and a new question semantically belongs to X, recreating X is acceptable ("a different user moment"). Adds zero surface to the classification hot path.

### Edit journal — single structure, two consumers (GRAPH-01 + GRAPH-03)

- **D-03:** **One** journal, **two** consumers. Single source of truth. The journal feeds both reorg-prompt-guidance AND undo. Two separate structures rejected as drift risk.

- **D-04:** Journal entry shape:
  ```ts
  type GraphEditLogEntry = {
    id: string;                  // ULID or timestamp+rand
    ts: number;                  // epoch ms
    cmd: 'rename' | 'move' | 'merge' | 'detach' | 'prune' | 'delete';
    targetIds: string[];         // primary node(s) the command operated on
    before: Record<string, unknown>;  // full pre-image snapshot of affected fields (full Question record on hard-delete/merge-loser so undo can resurrect)
    after: Record<string, unknown>;   // post-image (for audit + reorg-prompt summarization)
  };
  ```
  - On hard-delete (`delete`) and merge-loser-removal (`merge`): `before` contains the **full** Question record so `undo` can fully resurrect.
  - On rename/move/prune/detach: `before` contains only the patched fields' old values (compact).

- **D-05:** Depth and retention cap: **N = 10**. Last-10 undo; oldest entry dropped beyond that. Same number for retention (storage hygiene) and undo (operator surface). Estimated localStorage footprint: ~5–10 KB.

- **D-06:** Journal is append-only; `undo()` does NOT mutate prior entries — instead it pushes a new "inverse" entry. (Keeps reorg prompt history honest: "user did X then undid it" is itself useful guidance.) Design detail for researcher: whether the inverse entry carries `cmd: 'undo'` with a back-reference to the undone entry's id, or if it carries the inverse verb (e.g., `undo` of `rename` writes another `rename` entry with swapped before/after).

### Merge semantics (GRAPH-03)

- **D-07:** Service signature: `merge(loserId, survivorId)`. Direction is operator-supplied; service does NOT auto-pick by heuristic. UI (Phase 49) presents "Merge X → Y" and "Merge Y → X" as distinct actions; operator chooses which.

- **D-08:** Survivor preserves its `title`, `clusterNodeId`, `parentId`, `branchLabel`, `clusterLabel`. Cross-cluster merge case: survivor's cluster wins (consequence of "survivor's fields preserved" — not a separate decision point).

- **D-09:** Loser's QA children (any Question with `parentId === loserId`) are **reparented** to `survivorId` via `patchQuestion`. Source Q&A content is preserved per GRAPH-03.

- **D-10:** Loser anchor record is **hard-deleted** (via `questionService.delete`). No alias / redirect record retained. Phantom records rejected.
  - Undo path: journal entry's `before` contains the loser's full pre-merge record AND the list of reparented child IDs. `undo()` resurrects the loser record and moves the children back.
  - Phase 50 retrieval is designed against survivor-id from day one (no historical citation references in v1.6 to break).

- **D-11:** Survivor's `qaCount` and `embeddingVector` are **recomputed** after reparent:
  - `qaCount` = count of Questions where `parentId === survivorId` after the reparent batch.
  - `embeddingVector` = re-embed survivor's (possibly merged) `title` via the user's configured embedding provider (same path as `classifyAndAnchorIncremental` backfill). If embedding provider is unavailable, leave the existing vector and proceed (matches Phase 47 D-12 graceful-degradation pattern).

### Command surface (GRAPH-01 + GRAPH-02)

- **D-12:** Public API is **named methods per verb**, not primitives + composition. Each returns `ServiceResult`. Each writes exactly one journal entry on success.

  ```ts
  type GraphCommandService = {
    rename(id: string, newTitle: string): Promise<ServiceResult<void>>;
    move(id: string, newParentId: string): Promise<ServiceResult<void>>;
    merge(loserId: string, survivorId: string): Promise<ServiceResult<void>>;
    detach(qaId: string): Promise<ServiceResult<void>>;   // = re-classify (D-13)
    prune(anchorId: string): Promise<ServiceResult<void>>; // soft (D-14)
    delete(id: string): Promise<ServiceResult<void>>;      // hard (D-15)
    undo(): Promise<ServiceResult<{ undoneCmd: string }>>;
  };
  ```

- **D-13:** `detach(qaId)` = clear placement fields (`parentId`, `branchLabel`, `clusterLabel`, `clusterNodeId`, `nodeSummary`, `placementReason`) AND fire `classifyAndAnchorIncremental(question, allQuestions, llmConfig, signal)` to re-route. Operator chose "re-classify" over "move to Unassigned bucket" or "set parentId=null" — UX intent is "find a better home for this," not "park it." Side effect: classification may route back to the original anchor (no-op detach); Phase 49 may surface a toast.
  - Journal `before` captures pre-detach placement fields; undo restores them and skips re-classification.

- **D-14:** `prune(anchorId)` is **soft** — sets `flagged: true` + `prunedFromTrellis: true` (matching existing `trellisActionsService.prune` semantics). Reversible via `undo()` OR the existing `unpruneQuestion` path. Soft prune does NOT remove children — children stay parented to the pruned anchor, follow `flagged` filters downstream.
  - Phase 48 may consolidate `trellisActionsService.prune` and `unpruneQuestion` into the new command service, or leave them as parallel callers — researcher to decide based on call-site count and i18n surfaces.

- **D-15:** `delete(id)` is **hard** — calls existing `questionService.delete(id)` semantics (filter from store + remove from SQLite + emit `QUESTION_DELETED` + `GRAPH_UPDATED`). On anchor delete, children become orphaned (parentId points to deleted record) — they should be either re-parented to the anchor's `parentId` (cluster), reparented to "Unassigned," or also deleted. **Researcher decides** the cascade rule; suggested default = re-parent to cluster (least destructive, preserves Q&A content per GRAPH-03 intent).

- **D-16:** `rename(id, newTitle)` **bypasses** `normalizeAnchorName`. Operator typed exactly what they want; normalization is for LLM-laziness defense, not human input. Hard validation only:
  - Reject empty/whitespace-only.
  - Cap at 100 chars (UX: graph node label budget).
  - Trim leading/trailing whitespace.
  - No casing or punctuation transformations.

### Pipeline + integration

- **D-17:** Every successful command emits **one** `GRAPH_UPDATED` event (unified-event-bus rule from CLAUDE.md §"Event bus — unified GRAPH_UPDATED"). Merge is one command → one event, even though it touches multiple Questions. Subscribers (`useTrellisData`, `useQuestions`, `PrunedSection`) already reload on `GRAPH_UPDATED`.

- **D-18:** Commands are **synchronous** from the caller's perspective until persistence + event emit completes. Detach is the exception: it fires `classifyAndAnchorIncremental` fire-and-forget after persisting the cleared-placement state (matches existing Q&A creation flow).

- **D-19:** Commands accept an **`AbortSignal`** matching existing service patterns. `LOCALE_CHANGED` mid-flight (Phase 27 D-22) should cancel detach's classification call cleanly.

- **D-20:** Reorg-prompt integration: `reorganizeMindmap()` builds its system prompt by appending journal-derived constraints in a **byte-stable** order (newest-first or oldest-first — researcher's call, but stable across invocations) so KV-cache reuse holds across consecutive reorgs. Constraint phrasing example: `"User manually renamed anchor 'Photosyntheis' to 'Photosynthesis' on 2026-05-15 — preserve this name."` Researcher to define the canonical phrasing per `cmd` type.

### Claude's Discretion

- Whether to consolidate `trellisActionsService.prune` / `unpruneQuestion` into the new command service or leave as parallel callers — researcher.
- Cascade rule on hard-delete of an anchor with children (re-parent to cluster vs. Unassigned vs. cascading delete) — researcher; suggested default = re-parent to cluster.
- Journal entry `inverse` representation (back-reference vs. inverse-verb-with-swapped-snapshots) — researcher.
- Canonical phrasing for each `cmd` type when serialized into the reorg prompt — researcher.
- Whether `undo()` is exposed to UI even when journal is empty (return error vs. no-op) — implementation detail.
- ULID vs. timestamp-string for journal entry `id` — implementation detail.
- Whether the reorg prompt cap (e.g., "include last 10" vs. "include last 20") differs from the journal retention cap — researcher; default = same N (=10) for both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements

- `.planning/REQUIREMENTS.md` §GRAPH (GRAPH-01..04) — four locked requirements for this phase
- `.planning/REQUIREMENTS.md` §"Out of Scope" — v1.6 non-goals (no mind-map generation transparency, no four-state triage)
- `.planning/ROADMAP.md` §"Phase 48" — success criteria 1–4

### Project + cross-cutting invariants

- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — one event per semantic mutation; merge emits ONE event despite multi-record write
- `CLAUDE.md` §"Anchor name normalization" — `normalizeAnchorName` is for classification (LLM-laziness defense); D-16 bypasses it on manual rename
- `CLAUDE.md` §"Classification dedup — embedding pre-check" — 0.82 threshold pattern; merge's post-survivor embedding recompute uses the same `embedText` infra
- `CLAUDE.md` §"Question filter — dual-vector scoring (Phase 47 UAT-5)" — context only (Phase 47 just landed); no direct dependency

### Codebase entry points (must read before designing)

- `app/src/services/question.service.ts` — `patchQuestion` (line 610), `delete` (565), `buildAndSave` (369), `loadStore` (98), `hydrateFromSQLite` (62) — ALL command writes route through patchQuestion + delete; do NOT introduce a second write path
- `app/src/services/canonical-knowledge.service.ts` — `commitClassificationResult` (788), `classifyAndAnchorIncremental` (1007), `reorganizeMindmap` (~1877+ with reconciliation pattern), `normalizeAnchorName` (769); reorg is the stale-write hazard target (D-02)
- `app/src/services/trellis-actions.service.ts` — `heal` (54), `replant` (88), `prune` (126), `unpruneQuestion` (136), `hardDelete` (145); D-14 may consolidate or leave parallel
- `app/src/services/graph.service.ts` — `linkNodes` (86), `moveToParent` (183); existing graph mutation surface — may be absorbed into the new command service
- `app/src/lib/event-bus.ts` — current event types; do NOT add new event types for graph mutations (D-17)
- `app/src/types/index.ts:5-39` — `Question` shape; D-04 uses Question fields directly in journal `before/after`
- `app/src/providers/embedding/index.ts` — `embedText` / `cosine`; D-11 reuses for survivor embedding recompute
- `app/src/screens/GraphScreen.tsx:464,568-599` — existing node-selection plumbing; Phase 49 hooks the command service in here (read-only awareness for Phase 48)

### Operator memory (context only — not user-facing docs)

- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_no_normalize_for_optional_fields.md` — adding optional `?:` fields like the journal's storage key doesn't need a migration framework; v1.5 data loads with `undefined` and the command service initializes lazily

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`patchQuestion(id, patch)`** (`question.service.ts:610`) — atomic patch + re-persist (localStorage write + SQLite fire-and-forget). The single write path. Every command method delegates here.
- **`questionService.delete(id)`** (`question.service.ts:565`) — hard removal; already emits `QUESTION_DELETED` + `GRAPH_UPDATED`. `delete()` and `merge()`-loser-removal reuse this.
- **`graph.service.ts`** `linkNodes` (86), `moveToParent` (183) — existing manual graph mutations that should be replaced by / absorbed into the new command service (`move`, plus undecided whether `linkNodes` joins).
- **`trellis-actions.service.ts`** `prune` (126), `unpruneQuestion` (136), `hardDelete` (145) — existing soft/hard mutations; D-14 keeps prune's existing semantics and may consolidate or leave parallel.
- **`reorganizeMindmap` reconciliation pattern** (`canonical-knowledge.service.ts:1877-1915`) — proves the "read-fresh-localStorage, reconcile IDs, filter-dropped, append-new" pattern works in production; reorg-prompt-constraint injection in D-20 layers on top.
- **`embedText(text, EmbeddingConfig)` + `cosine(a, b)`** (`providers/embedding/index.ts`) — Phase 47 reused; Phase 48's merge survivor-embedding recompute (D-11) uses the same call.
- **`classifyAndAnchorIncremental`** (`canonical-knowledge.service.ts:1007`) — detach (D-13) fires this fire-and-forget after persisting the cleared-placement state.
- **Phase 47 `MaliciousBlockSentinel` pattern + sentinel return path** — distant analog for "command service returns a structured result type with a discriminated reason"; D-12's `ServiceResult<{ undoneCmd: string }>` follows the same shape.

### Established Patterns

- **`ServiceResult<T>` return convention** — all command methods return `ServiceResult` for symmetry with `questionService`, `trellisActionsService`, etc.
- **`GRAPH_UPDATED` is the only graph-mutation signal** — never add a parallel event type; merge emits ONE event despite touching multiple records (D-17).
- **localStorage as primary source of truth** — journal lives in `localStorage` (not SQLite first). SQLite write-through is optional in Phase 48; researcher to confirm whether journal needs SQLite backup or localStorage durability is enough (suggested: localStorage only; journal is recoverable from `Question` revision history if needed, and SQLite write-through is extra surface).
- **`AbortSignal` threading** — Phase 27 D-22 (`LOCALE_CHANGED` cancels in-flight LLM work); command methods accept the signal and propagate to detach's classification call.
- **Anchor records can be Questions** — anchors are `Question` with `isAnchorNode=true`; clusters with `isClusterNode=true`. Do NOT introduce parallel Anchor/Cluster types.
- **Fire-and-forget SQLite write** — `persistToSQLite()` (question.service.ts:24); commands DO NOT await SQLite. localStorage is the durability contract for the response.

### Integration Points

- **GraphScreen.tsx** node selection plumbing (line 464, `setSelectedNode`) already exists; Phase 49 wires it to the command service. Phase 48 ships the service with no UI consumer initially — test surface is unit tests + (optionally) one programmatic exercise from a test fixture.
- **useTrellisData**, **useQuestions**, **PrunedSection** all subscribe to `GRAPH_UPDATED` — re-read after every command without additional plumbing.
- **`reorganizeMindmap` prompt builder** — D-20 modifies this to read journal entries and inject as constraints. Must preserve byte-stability for KV-cache reuse (CLAUDE.md §"Ask-chat system prompt — byte-stable across turns" — same discipline, different surface).
- **i18n**: no UI in Phase 48, so no new copy bundles. Phase 49 will own the user-facing strings for command results / undo confirmations.

</code_context>

<specifics>
## Specific Ideas

- Operator framing on stale-write protection: "There is always only one user in a graph. Machine overwrite human correction can happen, but a machine overwrite happens only in a complete overhaul of the graph, so the tree structure can be different, making the lock lose its point. We probably should come up with a better way, like injecting human edit into the re-organize prompt as an extra guideline." — This rejects both `rev: number` and `manuallyEdited: boolean` per-node approaches. The protection lives at the *prompt input* layer, not the *write conflict* layer. D-01/D-02 capture this.

- Operator on merge: asked the grounding question "in what situation will a merge happen?" before committing to a control model. The motivating scenarios are duplicate anchors slipping past Phase 33's 0.82 embedding dedup ("SRS" vs "Spaced Repetition System"), conceptual consolidation ("Transformers" + "Attention" → one), and post-rename cleanup. UI presents directional "Merge X → Y" / "Merge Y → X" actions; service takes `(loserId, survivorId)`.

- Operator on detach: chose "re-classify" over "move to Unassigned bucket" or "set parentId=null." UX semantics = "this Q&A is misplaced, find it a better home." Service clears placement fields then fires `classifyAndAnchorIncremental`. May no-op (route back to original anchor) — UI may surface a toast in Phase 49.

- Operator on rename normalization: implied trust-operator-intent. `normalizeAnchorName` is a defense against LLM-generated anchor titles like "What is photosynthesis" being persisted as anchor names; it does not apply when a human typed exactly what they want. D-16 bypasses normalization; hard validation only.

- Operator on N for undo / journal cap: chose 10 (recommended default). Local single-user app — a deep edit history surface isn't load-bearing; 10 is enough to cover a typical editing session.

</specifics>

<deferred>
## Deferred Ideas

- **Per-node `rev: number` counter for fine-grained concurrency** — rejected in D-01 as overkill for a single-user app. Revisit if Trellis ever ships a sync/collab mode (would need to land before any multi-writer feature).
- **`manuallyEdited: boolean` per-node lock** — rejected in D-01 as ineffective against full-tree reorg (lock survives but the meaningful neighborhood doesn't). Same revisit condition as above.
- **`classifyAndAnchorIncremental` guarded by edit log** — D-02 explicitly excludes per-Q&A classification from journal protection. Reconsider if operator reports "I pruned X, then asked a new question, and X came back" as a real-world frustration (it's currently judged as "different user moment" = acceptable).
- **Alias / redirect record on merge** — D-10 rejects keeping the loser anchor as a phantom alias. Reconsider if Phase 50 retrieval discovers external links / citation refs that need stable IDs across merges.
- **Multi-level undo UI (redo, history scrub)** — D-05 ships last-N=10 undo only. Operator did not ask for redo; deferred to a possible v1.7+ if heavy graph-editing usage emerges.
- **Cascade-delete on anchor `delete`** — Claude's discretion (D-15); default = re-parent children to cluster, but full cascade is a documented alternative researcher may pick.
- **Consolidating `trellisActionsService.prune` / `unpruneQuestion` into the new command service** — Claude's discretion (D-14); current Trellis code has its own consumers (PlannerScreen suggested-moves), and consolidating without breaking those is researcher's call.
- **Journal entries SQLite-backed for durability** — Phase 48 uses localStorage only. If localStorage gets wiped (clear-all-data, dev affordance), journal is gone. Acceptable trade for v1.6; SQLite backup is a v1.7+ if needed.
- **Reorg prompt constraint length cap** — D-20's "researcher to define canonical phrasing" assumes the 10-entry budget fits in prompt headroom. If a long edit session blows the token budget, researcher may need to summarize / truncate; flag as known-limit if encountered.

</deferred>

---

*Phase: 48-Graph Command Service and Trust Invariants*
*Context gathered: 2026-05-17*
