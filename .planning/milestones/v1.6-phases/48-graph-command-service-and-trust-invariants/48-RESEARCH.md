# Phase 48: Graph Command Service and Trust Invariants - Research

**Researched:** 2026-05-17
**Domain:** local-first graph mutation service + persistent edit journal
**Confidence:** HIGH (all claims tied to file:line in this repo)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Stale-write protection = persistent edit journal injected into `reorganizeMindmap()` LLM prompt as constraints. NOT a `rev: number` counter. NOT `manuallyEdited: boolean`. Storage key `trellis_graph_edit_log`.
- **D-02** Protection scope is `reorganizeMindmap()` only. `commitClassificationResult()` is unguarded.
- **D-03** ONE journal, TWO consumers (reorg-prompt + undo). Single source of truth.
- **D-04** Journal entry shape: `{ id, ts, cmd, targetIds, before, after }`. `cmd` ∈ `'rename' | 'move' | 'merge' | 'detach' | 'prune' | 'delete'`. Full Question pre-image on hard-delete/merge-loser; compact field diff on rename/move/prune/detach.
- **D-05** Depth + retention cap = N=10. Same number for both.
- **D-06** Journal is append-only. `undo()` pushes a new "inverse" entry (does NOT mutate prior entries).
- **D-07** `merge(loserId, survivorId)` — direction operator-supplied.
- **D-08** Survivor preserves its `title`, `clusterNodeId`, `parentId`, `branchLabel`, `clusterLabel`.
- **D-09** Loser's QA children reparent to `survivorId`.
- **D-10** Loser anchor is hard-deleted (via `questionService.delete`). No alias.
- **D-11** Survivor's `qaCount` + `embeddingVector` recomputed post-merge.
- **D-12** Public API = named methods per verb: `rename, move, merge, detach, prune, delete, undo`. Each returns `ServiceResult`. Each writes exactly one journal entry on success.
- **D-13** `detach(qaId)` clears placement fields AND fires `classifyAndAnchorIncremental` fire-and-forget.
- **D-14** `prune(anchorId)` is soft — `flagged: true` + `prunedFromTrellis: true`. Children stay parented.
- **D-15** `delete(id)` is hard — calls `questionService.delete(id)`. Researcher decides cascade rule.
- **D-16** `rename(id, newTitle)` bypasses `normalizeAnchorName`. Hard validation only: reject empty/whitespace-only; cap 100 chars; trim leading/trailing whitespace.
- **D-17** Every successful command emits ONE `GRAPH_UPDATED` event. Merge = one command = one event.
- **D-18** Commands are synchronous from caller's perspective until persistence + event emit. Detach exception: classification call is fire-and-forget.
- **D-19** Commands accept `AbortSignal`; `LOCALE_CHANGED` mid-flight should cancel detach's classification.
- **D-20** Reorg-prompt integration: append journal-derived constraints in byte-stable order to preserve KV-cache reuse.

### Claude's Discretion

- Consolidate `trellisActionsService.prune`/`unpruneQuestion` into the command service vs. parallel callers.
- Cascade rule on hard-delete of anchor with children (re-parent to cluster vs. Unassigned vs. cascading delete) — default = re-parent to cluster.
- Journal entry inverse representation (back-reference vs. inverse-verb-with-swapped-snapshots).
- Canonical phrasing for each `cmd` type when serialized into the reorg prompt.
- Whether `undo()` is exposed even when journal is empty (return error vs. no-op).
- ULID vs. timestamp-string for journal entry `id`.
- Reorg prompt cap distinct from journal retention cap (default same N=10).

### Deferred Ideas (OUT OF SCOPE)

- Per-node `rev:number` / `manuallyEdited:boolean` locks.
- Guarding `classifyAndAnchorIncremental` with edit log.
- Alias / redirect record on merge.
- Multi-level undo UI (redo, history scrub).
- Cascade-delete on anchor delete (alternative to default re-parent).
- Journal entries SQLite-backed for durability.
- Reorg prompt constraint length cap / summarization.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRAPH-01 | Graph corrections run through a dedicated service boundary that validates commands, patches affected Question records, writes durable state, records undo metadata, and emits graph update events. | R1 catalogues current mutation sites that consolidate behind the new service. R5 specifies the single `GRAPH_UPDATED` emit per command. R11 Plan 02-04 build the service surface. |
| GRAPH-02 | User can rename anchors/clusters and move/reassign anchors or Q&As while preserving parent IDs, labels, cluster IDs, counts, summaries, review links, and retrieval identity. | R2 enumerates the exact Question fields that change per command; D-08 plus R6 confirm survivor field preservation. |
| GRAPH-03 | User can merge duplicate anchors, detach misplaced Q&As, prune/delete graph nodes, and undo the last graph correction without losing source Q&A content. | R2 (merge / detach / delete diff shapes), R7 (detach wiring), R6 (prune consolidation), R10 (snapshot-bloat mitigation for delete). |
| GRAPH-04 | Manual graph corrections are protected from stale in-flight classification or global reorganization commits through structural revision or manual-lock metadata. | R4 (reorg prompt injection point + template), R3 (journal persistence), R10 (undo-after-reorg risk register). |
</phase_requirements>

---

## Summary

Phase 48 builds **one** named-method service (`graphCommandService`) over the existing `questionService.patchQuestion` / `questionService.delete` write path, plus a persistent `trellis_graph_edit_log` localStorage array that serves two consumers: undo and `reorganizeMindmap()`'s system prompt. The work is **service-only** — no UI, no new event types, no parallel Anchor/Cluster types. CONTEXT.md locks 20 decisions; this research extends them with codebase facts.

**Primary recommendation:**

1. Build the command service as a thin orchestration layer over the existing single write path (`questionService.patchQuestion` at `question.service.ts:610` and `questionService.delete` at `question.service.ts:565`). Do NOT create a new write path.
2. Build the journal as a leaf module (`graph-edit-journal.service.ts`) with no transitive deps on the i18n/locale chain so it can be unit-tested under `node --test` directly (same pattern as `refill-mutex.ts`).
3. Inject journal entries into `reorganizeMindmap()`'s system prompt at `canonical-knowledge.service.ts:1622-1642` as a new bullet block — preserves byte-stability for KV-cache.
4. **Consolidate** `trellisActionsService.prune` and `unpruneQuestion` into the command service (R6 recommends delegation rather than removal; preserves PrunedSection callers).
5. **Cascade rule on `delete(anchorId)`**: re-parent children to the anchor's `parentId` (cluster) — least destructive, preserves Q&A content per GRAPH-03 intent. Snapshot child ID list in journal `before` so undo restores parentage.
6. **Journal inverse representation**: inverse-verb-with-swapped-snapshots (e.g., undo of `rename` writes another `rename` with swapped before/after, not a synthetic `cmd: 'undo'`). Operator framing in CONTEXT.md `<specifics>` favors prompt-input layer truth — "user did X then undid it" reads more naturally as two ordinary commands than one synthetic undo.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Command validation (rename length, merge direction, etc.) | Service (graph-command-service) | — | Single boundary per D-01/D-12; centralizes operator-trust rules so callers never bypass |
| Persistence (Question patch + delete) | Service (questionService) | Storage (localStorage + SQLite cold backup) | Existing single write path at `question.service.ts:610` / `:565` is load-bearing; reuse, don't duplicate |
| Journal storage | Service (graph-edit-journal) | Storage (localStorage `trellis_graph_edit_log`) | Append-only log; D-06 requires immutability; ~5-10KB at N=10 per D-05 |
| Reorg prompt injection | Service (canonical-knowledge → graph-edit-journal) | LLM (`reorganizeMindmap`) | D-01: journal is the prompt-input layer, not the write-conflict layer |
| Event emission | Service (graph-command-service → eventBus) | UI subscribers (`useTrellisData`, `useQuestions`, `PrunedSection`, `GraphScreen`) | D-17: one event per command; no new event types per CLAUDE.md unified GRAPH_UPDATED rule |
| Undo dispatch | Service (graph-command-service) | Journal (read newest entry) | D-06: undo pushes inverse entry; never mutates prior entries |
| UI surfaces (selected-node controls, merge picker, undo toast) | — | — | **Phase 49 only.** Phase 48 ships service with NO UI consumer |

---

## R1. Existing graph-mutation call sites — what does the new service subsume?

Catalogue of every site in `app/src` that currently mutates a `Question`'s graph-shape fields (`isAnchorNode`, `isClusterNode`, `branchLabel`, `clusterLabel`, `parentId`, `anchorId`, `clusterId`, `prunedFromTrellis`, title, qaCount):

| File:line | Function | Graph mutation | Emits `GRAPH_UPDATED`? | Concurrency guard? | Disposition in Phase 48 |
|-----------|----------|----------------|------------------------|-----------------------|----------------|
| `question.service.ts:565` | `delete(id)` | Removes entire record | YES (line 569) | None | **REUSE** — `graphCommandService.delete()` delegates here |
| `question.service.ts:610` | `patchQuestion(id, patch)` | Atomic field patch | NO (this is the workhorse — emit happens at command boundary) | None | **REUSE** — every command writes through this single path |
| `question.service.ts:599` | `updateRelatedIds(id, ids)` | Edge mutation (`relatedQuestionIds`) | NO | None | Out of scope; Phase 48 owns hierarchy, not edge mutations |
| `question.service.ts:589` | `updateReviewSchedule(id, sched)` | Schedule patch (not graph-shape) | NO | None | Out of scope |
| `canonical-knowledge.service.ts:935` | `commitClassificationResult` (Q&A patch) | Sets `rootLabel`, `branchLabel`, `clusterLabel`, `placementReason`, `parentId`, `clusterNodeId` | YES (line 974) | None | **UNGUARDED by D-02.** Phase 48 does NOT route this through the command service (intentional). |
| `canonical-knowledge.service.ts:951` | `commitClassificationResult` (anchor patch) | Increments `qaCount`, appends to `nodeSummary` | YES (single emit at 974) | None | Same — unguarded per D-02 |
| `canonical-knowledge.service.ts:967` | `commitClassificationResult` (cluster patch) | Updates aggregated `qaCount` | YES (single emit at 974) | None | Same — unguarded per D-02 |
| `canonical-knowledge.service.ts:840-846` + `:917-924` | `commitClassificationResult` direct localStorage writes (cluster + anchor create) | Inserts new `Question` with `isClusterNode: true` / `isAnchorNode: true` | YES (line 974) | None | Same — unguarded per D-02. Note: this bypasses `questionService.patchQuestion` and writes localStorage directly. Out of Phase 48 scope but flagged for awareness. |
| `canonical-knowledge.service.ts:863, 888` | `commitClassificationResult` (anchor patch via patchQuestion) | Sets `clusterNodeId` on existing anchor | YES (line 974) | None | Same — unguarded |
| `canonical-knowledge.service.ts:1917` | `_doReorganize` localStorage bulk write | Rewrites anchor + cluster + QA tree | NO direct emit; emits `REORG_COMPLETED` at line 1919 | `_reorgInProgress` flag at line 1406-1410 | **CONSUMER** of journal per D-01 — reads recent entries, injects as prompt constraints. Does NOT route through command service. |
| `trellis-actions.service.ts:93-100` | `replant(anchorId, ...)` (via patchQuestion) | Bumps `reviewSchedule` to dying for anchor + children | YES (line 107) | None | Out of scope — schedule mutation, not graph-shape |
| `trellis-actions.service.ts:127` | `prune(anchorId)` (via patchQuestion) | Sets `flagged: true`, `prunedFromTrellis: true` | Emits `ANCHOR_DELETED` (NOT `GRAPH_UPDATED`) at line 128 | None | **CONSOLIDATE** — `graphCommandService.prune()` delegates here (R6). Existing emit semantics preserved for PrunedSection. |
| `trellis-actions.service.ts:137` | `unpruneQuestion(anchorId)` (via patchQuestion) | Clears `flagged`, `prunedFromTrellis` | YES (line 138) | None | **CONSOLIDATE** — exposed as inverse of `prune()` via `undo()` path |
| `trellis-actions.service.ts:146` | `hardDelete(anchorId)` (via questionService.delete) | Removes record | YES (delegated via question.service.ts:569) | None | **CONSOLIDATE** — `graphCommandService.delete()` is the new public form |
| `graph.service.ts:96-99` | `linkNodes(srcId, tgtId)` (via updateRelatedIds) | Bidirectional `relatedQuestionIds` edge | NO | None | **DEAD CODE.** Zero callers in `app/src` (`grep -rn "graphService\." app/src` returns only `getGraph` and `reinforceEdge`). Out of Phase 48 scope. |
| `graph.service.ts:183` | `moveToParent(nodeId, newParentId)` (via patchQuestion) | Sets `parentId` to new value (or undefined) | NO | None | **DEAD CODE.** Zero callers. **SUBSUMED** logically by `graphCommandService.move()` — replace this function body or leave as-is dead. |
| `flashcard.service.ts:63` | `patchQuestion` | Sets various fields when flashcard mutated | NO | None | Out of scope — flashcard service, not graph |
| `flashcard.service.ts:118` | `questionService.delete` | Cascading delete | YES (delegated) | None | Out of scope |
| `review.service.ts:63, 97` | `patchQuestion(card.nodeId, { lastReviewedAt })` | Timestamp patch | NO | None | Out of scope — review state, not graph-shape |
| `question.service.ts:422, 436, 499, 513` | `patchQuestion` (embedding async) | Sets `embeddingVector`, `relatedQuestionIds` | NO | None | Out of scope — internal to question.service |
| `question.service.ts:362, 326` | `patchQuestion` (off-topic flag) | Sets `flagged: true` for off-topic | NO | None | Out of scope — filter behavior, not graph correction |
| `useQuestions.ts:362` | `patchQuestion` (D-01 off-topic override) | Sets `flagged: true` | NO | None | Out of scope |
| `AskScreen.tsx:509` | `patchQuestion` (override flagged) | Clears `flagged` and re-fires classification | NO; classification emits GRAPH_UPDATED | None | Out of scope — filter override, not graph correction |
| `AskScreen.tsx:500` + `QuestionDetailScreen.tsx:68` + `AnchorDetailScreen.tsx:104, 106` + `ClusterDetailScreen.tsx:123, 126, 128` | `questionService.delete` (various) | Removes Question | YES (line 569) | None | **In Phase 49** these screens MAY migrate to `graphCommandService.delete()` for undo support; Phase 48 leaves them untouched. Document for Phase 49 backlog. |
| `screens/GraphScreen.tsx:464` | `setSelectedNode` | Read-only UI state | N/A | N/A | **Phase 49 hook point.** Phase 48 changes nothing here. |

**Verdict:**

- **In scope (Phase 48):** prune / unprune / delete consolidation via delegation (R6); new methods `rename`, `move`, `merge`, `detach`, `undo`; reorg prompt injection.
- **Out of scope (Phase 48):** classification-write sites (D-02), screen-level `questionService.delete` callers (Phase 49 migration), `graph.service.ts` dead code (no callers — leave alone).
- **Hidden risk:** `canonical-knowledge.service.ts:840-846` + `:917-924` bypasses `patchQuestion` and writes localStorage directly. Per D-02 this stays as-is, but if a future phase routes anchor creation through `patchQuestion` (cleaner), the journal would gain visibility into creation events too. Out of Phase 48 scope.

---

## R2. Question schema fields touched by graph commands — exact shape for journal `before`/`after`

**Question type** (`app/src/types/index.ts:5-39`) — the fields graph commands touch:

```ts
interface Question {
  // identity (never mutated by graph commands except create/delete)
  id: string; timestamp: number; date: string; createdAt: number;

  // content (mutated by rename ONLY for anchors/clusters where title IS the node name)
  title?: string; content: string; answer: string; summary: string;

  // graph-shape (mutated by Phase 48 commands)
  parentId?: string;          // anchor ← cluster; QA ← anchor
  branchLabel?: string;       // discipline (e.g., "Psychology")
  clusterLabel?: string;      // domain (e.g., "Learning Theory")
  rootLabel?: string;         // top-level (always "Knowledge")
  clusterNodeId?: string;     // pointer to parent cluster ID
  nodeSummary?: string;       // anchor accumulator: `[qaId] short\n[qaId] short`
  placementReason?: string;   // human-readable provenance string
  isAnchorNode?: boolean;     // marker — DO NOT MUTATE (anchor vs QA identity)
  isClusterNode?: boolean;    // marker — DO NOT MUTATE
  qaCount?: number;           // recomputed by merge per D-11
  embeddingVector?: number[]; // recomputed by merge per D-11; rename triggers re-embed
  shortSummary?: string;      // <=80w concept summary; nominally unchanged by graph commands

  // not mutated by graph commands (out of scope)
  keywords, relatedQuestionIds, categoryIds, reviewSchedule, aliases, sourcePrompts,
  sourceQuestionIds, lastReviewedAt, pinned, coCreationSignals, flagged, prunedFromTrellis,
  storyHook, isAnchorNode, isClusterNode
}
```

**Note:** `flagged` and `prunedFromTrellis` ARE mutated by `prune()` per D-14 (matching existing `trellisActionsService.prune` semantics at `trellis-actions.service.ts:127`).

### Per-command before/after diff specification

**`rename(id, newTitle)`** — anchor or cluster identity rename

| Field | before | after | Notes |
|-------|--------|-------|-------|
| `title` | old title | new (trimmed, validated) title | Required |
| `content` | old content (= old title) | new title | Anchors store title in both `content` AND `title` per `canonical-knowledge.service.ts:896-899` |
| `summary` | old summary (= old title) | new title | Same fields-mirror-each-other pattern |
| `embeddingVector` | old vector | (cleared, re-embedded fire-and-forget) | Title changed → semantic identity changed → re-embed (mirrors merge D-11 logic) |

Journal `before` = `{ title, content, summary, embeddingVector }`; `after` = `{ title, content, summary, embeddingVector: undefined }` (let async re-embed populate). Compact shape — well under 1KB.

**`move(id, newParentId)`** — anchor → new cluster, or QA → new anchor

For ANCHOR move (anchor → new cluster):

| Field on moved anchor | before | after |
|-----------------------|--------|-------|
| `clusterNodeId` | old cluster id | new cluster id |
| `branchLabel` | old branch | new branch (inherited from new cluster) |
| `clusterLabel` | old cluster | new cluster (inherited) |
| `parentId` | old cluster id | new cluster id |
| `placementReason` | old reason | `"Manually moved under {branch} > {cluster}"` |

For QA move (QA → new anchor):

| Field on moved QA | before | after |
|-------------------|--------|-------|
| `parentId` | old anchor id | new anchor id |
| `clusterNodeId` | old cluster id | new cluster id (inherited from new anchor) |
| `branchLabel` | old branch | new branch |
| `clusterLabel` | old cluster | new cluster |
| `placementReason` | old reason | `"Manually moved under {branch} > {cluster} > {anchor}"` |

Side effects (NOT stored in `before`/`after` — recomputed deterministically on undo by walking children):

| Field on OLD parent (anchor or cluster) | before | after | Recompute |
|--------|--------|-------|-----------|
| `qaCount` | old count | old count - 1 | Same pattern as `commitClassificationResult:946-957` |
| `nodeSummary` | with this QA's `[id] summary` entry | with entry removed | For anchors only |

Journal `before` = `{ parentId, clusterNodeId, branchLabel, clusterLabel, placementReason }` (5 string fields, <500 bytes).

**`merge(loserId, survivorId)`** — duplicate consolidation

`targetIds: [loserId, survivorId]`.

Survivor mutations (D-08 preserves title/clusterNodeId/parentId/branchLabel/clusterLabel — only `qaCount` + `embeddingVector` change per D-11):

| Field on survivor | before | after |
|-------------------|--------|-------|
| `qaCount` | old count | old count + reparented count |
| `embeddingVector` | old vector | cleared (re-embed fire-and-forget) |
| `nodeSummary` | old | old + reparented children summaries appended |

Children reparenting (per D-09):

For each Question where `parentId === loserId`:
- `parentId`: `loserId` → `survivorId`
- `clusterNodeId`: loser's `clusterNodeId` → survivor's `clusterNodeId`
- `branchLabel`: loser's → survivor's
- `clusterLabel`: loser's → survivor's

Loser: hard-deleted via `questionService.delete(loserId)` per D-10.

Journal `before` per D-10:
```ts
{
  loser: { /* FULL Question record */ },
  survivor: { qaCount, embeddingVector, nodeSummary },
  reparentedChildren: Array<{ id, parentId, clusterNodeId, branchLabel, clusterLabel }>
}
```

Sizing: full anchor record ~1-2KB; survivor compact diff ~1KB; each child diff ~200 bytes; with ~10 children, ~4-5KB total. Within budget.

**`detach(qaId)`** — clear placement, re-classify

| Field on QA | before | after |
|-------------|--------|-------|
| `parentId` | old anchor id | `undefined` |
| `branchLabel` | old | `undefined` |
| `clusterLabel` | old | `undefined` |
| `clusterNodeId` | old | `undefined` |
| `nodeSummary` | old | `undefined` |
| `placementReason` | old | `undefined` |

Side effect: old anchor's `qaCount` decrements; `nodeSummary` line removed.

After patch persists, fire `classifyAndAnchorIncremental(question, allQuestions, llmConfig, signal)` fire-and-forget per D-13 + R7. **Do NOT await.**

Journal `before` = `{ parentId, branchLabel, clusterLabel, clusterNodeId, nodeSummary, placementReason }` — 6 fields, ~500 bytes. Undo: restore these fields AND skip re-classification (`after` records that classification was triggered; undo just re-patches).

**`prune(anchorId)`** — soft archive (matches existing `trellisActionsService.prune`)

| Field on anchor | before | after |
|-----------------|--------|-------|
| `flagged` | `false`/undefined | `true` |
| `prunedFromTrellis` | `false`/undefined | `true` |

Journal `before` = `{ flagged, prunedFromTrellis }` — 2 fields, ~50 bytes.

**`delete(id)`** — hard removal

Journal `before` = FULL Question record (per D-04). Recommended cap: if `bodyMarkdown`-like fields ever exceed 10KB, truncate or warn. Current `Question` doesn't have `bodyMarkdown` (that's `DailyPost`), so typical anchor/cluster Question is <2KB.

For anchor delete: also store `childIds: string[]` (list of child Question IDs at time of delete) so undo cascade-restores parentage.

Cascade rule (Claude's discretion per D-15): **Re-parent children to the anchor's `parentId` (the cluster).** Each child Question gets `parentId: anchor.parentId, clusterNodeId: anchor.clusterNodeId, branchLabel: anchor.branchLabel, clusterLabel: anchor.clusterLabel`. Journal records:

```ts
{
  deletedRecord: Question,    // full record for resurrect
  reparentedChildren: Array<{ id, parentId, clusterNodeId, branchLabel, clusterLabel /* old values */ }>
}
```

Cluster delete: same pattern but children (anchors) re-parent to root (no parentId).

---

## R3. localStorage write path + persistence model

**Current storage shape:** primary key is `trellis_questions` (`question.service.ts:17`). Holds ALL Question records (Q&As + anchors + clusters discriminated by `isAnchorNode`/`isClusterNode`).

**Existing `trellis_*` localStorage key inventory** (`grep -oE "'trellis_[^']*'"`):

```
trellis_questions             ← Question store (primary)
trellis_reorg_snapshot        ← canonical-knowledge.service.ts:1402 (compact reorg revert snapshot)
trellis_daily_read            ← daily-read.service.ts:17
trellis_post_queue            ← feed queue
trellis_post_queue_yesterday  ← yesterday snapshot
trellis_sessions, trellis_planner_chunks, trellis_planner_checkins, trellis_planned_moves,
trellis_engagement_v1, trellis_daily_posts, trellis_news_posts, trellis_connection_posts,
trellis_flashcards, trellis_podcasts, trellis_post_history, trellis_audio, trellis_images,
trellis_video_cache, trellis_filter_corpus_emb_v1, trellis_blossom_dates, trellis_fruit_credits,
trellis_active_session, trellis_settings, trellis_api_availability_day, trellis_ask_rate_limit,
trellis_dev_mode, trellis_feed_views, trellis_scheduler_planner_done,
trellis_scheduler_podcast_done, trellis_scheduler_review_done, trellis_suggestions_last_refresh,
trellis_token_usage, trellis_trajectory_signals, trellis_db_*
```

**`trellis_graph_edit_log` (D-04) is NOT in use** — no collision risk.

**Write pattern: `patchQuestion` (`question.service.ts:610-618`)**:
```ts
patchQuestion(questionId, patch) {
  const store = loadStore({ includeFlagged: true });
  const idx = store.findIndex((q) => q.id === questionId);
  if (idx !== -1) {
    store[idx] = { ...store[idx], ...patch };
    saveStore(store);             // localStorage.setItem (sync, primary)
    persistToSQLite(store[idx]);  // fire-and-forget (cold backup)
  }
}
```

`saveStore` (`question.service.ts:109-117`) handles `QuotaExceededError` with a toast. SQLite write is via `dbExecute('INSERT OR REPLACE ...')` (`question.service.ts:23-28`).

**Hydration on cold boot:** `hydrateFromSQLite()` (`question.service.ts:62-84`) — restores from SQLite ONLY when localStorage is empty (the "deleted nodes resurrect" regression fixed at 2026-04-21). Load-bearing rule: localStorage is primary truth.

### Journal storage shape recommendation

Storage key: **`trellis_graph_edit_log`** (matches D-04 verbatim).

Value: JSON array of `GraphEditLogEntry`, append-only. Read on every command + every reorg. Capped at N=10 per D-05.

```ts
interface GraphEditLogEntry {
  id: string;                  // ULID or `${ts}-${rand}`
  ts: number;                  // Date.now()
  cmd: 'rename' | 'move' | 'merge' | 'detach' | 'prune' | 'delete';
  targetIds: string[];         // primary node(s) — e.g., ['loserId','survivorId'] for merge
  before: Record<string, unknown>;  // compact per R2 spec
  after: Record<string, unknown>;
}
```

### Quota analysis

Worst-case journal size (10 entries):

| Command | Typical entry size | 10× |
|---------|---------------------|-----|
| rename | ~500 bytes | 5KB |
| move | ~500 bytes | 5KB |
| merge | ~5KB (full loser record) | 50KB |
| detach | ~500 bytes | 5KB |
| prune | ~50 bytes | 500B |
| delete | ~2-5KB (full record + child list) | 50KB |

**Worst-case all-merges/all-deletes journal: ~50KB.** Safari/Chromium per-origin quota is 5MB. Headroom is ~100×. Safe.

**No SQLite backup for journal in Phase 48** (matches CONTEXT.md `<deferred>`). If `localStorage` is wiped (clear-all-data, dev affordance), journal is gone — acceptable per deferred decision.

### Load / save helpers (recommended shape)

Use the same defensive try/catch pattern as `daily-read.service.ts:29-51`:

```ts
function loadJournal(): GraphEditLogEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveJournal(entries: GraphEditLogEntry[]): void {
  try {
    // Cap at N=10 per D-05 — drop oldest beyond cap
    const capped = entries.slice(-10);
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(capped));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[Trellis] graph edit log quota exceeded — dropping oldest');
    }
  }
}
```

---

## R4. `reorganizeMindmap` prompt structure — where does the journal inject?

**Current prompt structure** (`canonical-knowledge.service.ts:1622-1642`):

```ts
const systemPrompt = [
  'You are a knowledge organization assistant. Given a list of Q&A items, organize them into a coherent academic knowledge hierarchy.',
  '',
  'Structure policy (strictly follow):',
  '- rootLabel: always "Knowledge"',
  '- branchLabel: a TOP-LEVEL academic discipline (e.g., "Psychology", "Computer Science", ...)',
  '- clusterLabel: a domain, theory, or sub-field WITHIN that discipline ...',
  '- anchorName: a specific concept ... Must NEVER duplicate clusterLabel.',
  '- keyword: a single most descriptive keyword for the anchor concept',
  '- qaIds: array of Q&A item IDs that belong under this anchor concept',
  '',
  'Rules:',
  '- Every Q&A ID from the input must appear in exactly ONE anchor\'s qaIds array. ...',
  '- Group related Q&As under the same anchor when they discuss the same concept.',
  '- Create separate anchors for distinct concepts, even if they share a cluster.',
  '- Prefer fewer, well-organized branches and clusters over many fragmented ones.',
  '- Each anchor must have at least 1 qaId.',
  '',
  'Respond ONLY with valid JSON (no markdown, no explanation, no trailing characters):',
  '{"hierarchy":[...]}',
].join('\n');

const userMessage = JSON.stringify(qaManifest);
```

**Two message roles only**: `system` (static template) + `user` (compact QA manifest).

**Natural injection point:** between the "Rules:" block and "Respond ONLY with valid JSON" block — append a new "Manual corrections to preserve:" section. This keeps the BEGINNING of the system prompt byte-stable (good for KV-cache reuse across consecutive reorgs IF the journal hasn't changed).

**Byte-stability per D-20:** When the journal IS unchanged, the entire prompt is byte-identical across invocations → full prefix cache hit. When the journal changes, the cache-break boundary moves to just before the inserted constraints. Phase 35-style discipline.

### Injection block template (no journal entries)

```
Manual corrections to preserve:
(none)
```

### Injection block template (with journal entries — newest LAST for human readability, but the same direction every time per D-20 byte-stability)

```
Manual corrections to preserve (most recent learner edits — do not undo these in your reorganization):
1. 2026-05-15: User renamed anchor "Photosyntheis" to "Photosynthesis" — preserve this name.
2. 2026-05-16: User merged anchor "SRS" into "Spaced Repetition" — do not re-create "SRS" as a separate anchor.
3. 2026-05-16: User moved anchor "Transformer Architecture" under cluster "Deep Learning" — preserve this placement.
4. 2026-05-17: User pruned anchor "Off-topic ramblings" — do not recreate this anchor.
5. 2026-05-17: User detached Q&A q-12345 from anchor "Photosynthesis" — leave it unassigned to that anchor.
```

Direction (newest first OR newest last): **newest LAST** recommended. Aligns with the chronological human-readable narrative ("first the user did X, then Y, then Z"). D-20 only requires consistency, not direction.

### Canonical phrasing per `cmd` type

| cmd | Phrasing template |
|-----|-------------------|
| `rename` | `{date}: User renamed {nodeKind} "{before.title}" to "{after.title}" — preserve this name.` |
| `move` | `{date}: User moved {nodeKind} "{name}" under {targetKind} "{newParentName}" — preserve this placement.` |
| `merge` | `{date}: User merged {kind} "{loser.title}" into "{survivor.title}" — do not re-create "{loser.title}" as a separate {kind}.` |
| `detach` | `{date}: User detached Q&A {qaId} from anchor "{oldAnchor.title}" — leave it free to re-classify.` |
| `prune` | `{date}: User pruned anchor "{title}" — do not recreate this anchor.` |
| `delete` | `{date}: User deleted {kind} "{title}" — do not recreate this {kind}.` |

`{nodeKind}` is `"anchor"` or `"cluster"` from the `isAnchorNode`/`isClusterNode` flags in `before`. `{date}` is `YYYY-MM-DD` from `ts`. Use `before.title` (since rename `after` is the current title).

### Token budget estimate

Each constraint line is ~30-50 tokens (English prose + ID strings). 10 entries × ~50 tokens = **500 tokens added** to the system prompt. Existing system prompt is ~250 tokens. New total ~750 tokens. The `chatCompletion` call uses `maxTokens: 16384` (`canonical-knowledge.service.ts:1655`) — output budget unaffected. Input cost: marginal.

### Empty-journal case

When `loadJournal().length === 0`, append the literal string `"\n\nManual corrections to preserve:\n(none)\n"` to the system prompt. Always present (keeps prompt shape consistent) but with no operational content. This is byte-stable when no edits have happened.

### Existing prompt has no "respect manual corrections" instruction

`canonical-knowledge.service.ts:1622-1642` makes NO mention of respecting prior edits. The injection block is genuinely new instruction, not a replacement.

---

## R5. `GRAPH_UPDATED` event — payload extension proposal

**Current shape** (`app/src/types/index.ts:719`):

```ts
| { type: 'GRAPH_UPDATED' };  // NO payload
```

**Emitters** (all five identified by `grep -rn "GRAPH_UPDATED"`):

| File:line | Site | Trigger |
|-----------|------|---------|
| `question.service.ts:569` | `delete(id)` | Q deleted |
| `canonical-knowledge.service.ts:974` | `commitClassificationResult` | New Q&A classified |
| `trellis-actions.service.ts:107` | `replant(...)` | Replant flow |
| `trellis-actions.service.ts:138` | `unpruneQuestion(...)` | Un-prune |
| (Phase 48 new) `graph-command-service.ts` | every command success | Rename/move/merge/detach/prune/delete/undo |

**Subscribers**:

| File:line | Subscriber | Reload pattern |
|-----------|------------|----------------|
| `state/useQuestions.ts:78` | `useQuestions` hook | Calls `questionService.getRecent(50)` → setQuestions |
| `state/useTrellisData.ts:33` | `useTrellisData` hook | Calls `buildTrellisState(questions)` → setLayout |
| `screens/GraphScreen.tsx:496` | `GraphScreen` | Calls `graphService.getGraph()` → setNodes/setEdges |
| `components/trellis/PrunedSection.tsx:25` | `PrunedSection` | Calls `questionService.getPrunedQuestions()` |

**All four subscribers re-read the entire store on `GRAPH_UPDATED`** — no current consumer filters on a payload kind. The unified-signal discipline from CLAUDE.md §"Event bus — unified GRAPH_UPDATED" is preserved.

### Proposed payload extension

```ts
| {
    type: 'GRAPH_UPDATED';
    payload?: {
      kind?: 'rename' | 'move' | 'merge' | 'detach' | 'prune' | 'delete' | 'undo'
            | 'classification' | 'replant' | 'unprune';
      anchorId?: string;
      affectedIds?: string[];
    };
  };
```

`payload` is OPTIONAL — emit sites that don't need to discriminate (existing `commitClassificationResult` at `:974`, existing replant at `:107`, etc.) MAY pass `{ payload: { kind: 'classification' } }` for future-proofing OR continue emitting `{ type: 'GRAPH_UPDATED' }` with no payload. Backward-compatible.

### Subscriber impact

| Subscriber | Action |
|------------|--------|
| `useQuestions` (`state/useQuestions.ts:78`) | NONE — already does full reload regardless |
| `useTrellisData` (`state/useTrellisData.ts:33`) | NONE — full recompute |
| `GraphScreen` (`screens/GraphScreen.tsx:496`) | NONE — full reload |
| `PrunedSection` (`components/trellis/PrunedSection.tsx:25`) | NONE — full pruned-list reload |
| (Phase 49 NEW) selected-node UI | Could use `payload.kind === 'undo'` to show a toast like "Undid: rename"; Phase 48 ships the payload but no Phase 48 consumer needs it |

**No subscriber needs to filter today.** Payload exists for Phase 49 / future use. **Do NOT remove existing payload-less emit sites** to avoid mechanical churn.

---

## R6. `trellisActionsService.prune` consolidation — keep or fold in?

**Existing prune** (`trellis-actions.service.ts:126-130`):

```ts
prune(anchorId: string): { pruned: true } {
  questionService.patchQuestion(anchorId, { flagged: true, prunedFromTrellis: true });
  eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId } });
  return { pruned: true };
}
```

**Existing callers:**
- `screens/PlannerScreen.tsx:90` (`handlePrune` for scissors button on Suggested Moves rows)
- `components/trellis/PrunedSection.tsx:31` (`handleUnprune` for restore — uses `unpruneQuestion`)
- `components/trellis/PrunedSection.tsx:36` (`handleHardDelete` — uses `hardDelete`)

**Behavioral comparison** vs. desired Phase 48 `graphCommandService.prune`:

| Behavior | Existing `trellisActionsService.prune` | New `graphCommandService.prune` per D-14 |
|----------|----------------------------------------|------------------------------------------|
| Sets `flagged: true, prunedFromTrellis: true` | YES | YES (same semantics) |
| Emits `ANCHOR_DELETED` | YES | Required for PrunedSection to refresh |
| Emits `GRAPH_UPDATED` | NO | YES per D-17 |
| Records journal entry | NO | YES (single entry per D-12) |
| Reversible via `undo()` | NO | YES (inverse-entry per D-06) |

### Recommendation: **DELEGATE (not replace)**

`graphCommandService.prune(anchorId)` should:

1. Validate (anchor exists, is `isAnchorNode === true`, not already pruned)
2. Snapshot `before = { flagged: q.flagged, prunedFromTrellis: q.prunedFromTrellis }`
3. **Call `trellisActionsService.prune(anchorId)`** — preserves existing PrunedSection subscriber behavior (ANCHOR_DELETED emit)
4. Write journal entry
5. Emit `GRAPH_UPDATED` per D-17

`unpruneQuestion` path: similar delegation. `graphCommandService.undo()` of a prune call dispatches to `trellisActionsService.unpruneQuestion(anchorId)`.

**Why delegate, not replace:**

- PrunedSection (`components/trellis/PrunedSection.tsx:24-26`) subscribes to ALL THREE of `ANCHOR_DELETED`, `GRAPH_UPDATED`, `QUESTION_DELETED`. Replacing prune to emit only `GRAPH_UPDATED` would still work, but `ANCHOR_DELETED` is also subscribed by `useTrellisData` (`state/useTrellisData.ts:34`). Preserving the existing emit shape is zero-risk.
- PlannerScreen (`screens/PlannerScreen.tsx:90`) calls `trellisActionsService.prune` synchronously inline. Migrating its call site to `graphCommandService.prune` belongs in Phase 49 (UI changes). Phase 48 leaves Planner unchanged — but the new command service exists for Phase 49 to migrate to.

### Migration path for Phase 49

| Caller | Phase 48 behavior | Phase 49 migration |
|--------|-------------------|---------------------|
| `PlannerScreen.handlePrune` | Still calls `trellisActionsService.prune` directly | Migrate to `graphCommandService.prune` so it appears in undo journal |
| `PrunedSection.handleUnprune` | Still calls `trellisActionsService.unpruneQuestion` | Migrate to `graphCommandService.undo()` if user wants chronological undo |
| `PrunedSection.handleHardDelete` | Still calls `trellisActionsService.hardDelete` | Migrate to `graphCommandService.delete` for undo support |

Phase 48 ships the new command service AND leaves the old paths working. Phase 49 owns the migration.

---

## R7. `detach` re-classify wiring — fire-and-forget call signature

**Function signature** (`canonical-knowledge.service.ts:1007-1012`):

```ts
export async function classifyAndAnchorIncremental(
  question: Question,         // FULL Question object, not just id
  allQuestions: Question[],   // current store snapshot
  llmConfig: LLMConfig,       // user's configured LLM provider
  signal?: AbortSignal,       // optional cancellation per D-19
): Promise<void>
```

**What it expects in the question record:**

- `question.content` — required for embedding pre-check (`canonical-knowledge.service.ts:1020`)
- `question.title` — optional, included in prompt at `:1043` if present
- `question.id` — required for `commitClassificationResult` (writes patches keyed by this id)
- `question.embeddingVector` — **optional**: the function computes a fresh query embedding via `preCheckAnchorMatch` (`:1020`). No pre-existing vector required.
- `question.parentId` / `branchLabel` / `clusterLabel` / `clusterNodeId` — should be **undefined/cleared** before this call (because detach is specifically asking "where should this go?"). After Phase 48's detach patch clears these fields, `classifyAndAnchorIncremental` will treat the question as unassigned and route it.

**Pre-check threshold (Phase 33 UAT-4):** `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82` (`canonical-knowledge.service.ts:42`). Detach triggers it via `preCheckAnchorMatch(question, allQuestions)` at `:1020`. If the detached QA still cosine-matches its previous anchor above 0.82, `commitClassificationResult` will route it back — **no-op detach scenario** explicitly noted in D-13.

**`await` vs. fire-and-forget:** Function returns `Promise<void>`. Existing callers in `question.service.ts:340-342` use the fire-and-forget pattern:

```ts
void classifyAndAnchorIncremental(question, loadStore({ includeFlagged: true }), llmConfig, signal)
  .catch((err: unknown) => {
    console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
  });
```

Phase 48's `detach()` should match this pattern verbatim — fire after the placement-clearing patch persists.

**Emit ordering:** `classifyAndAnchorIncremental` → `commitClassificationResult` → `eventBus.emit({ type: 'GRAPH_UPDATED' })` at `canonical-knowledge.service.ts:974`. So:

1. `detach()` patches QA (clears placement fields)
2. `detach()` writes journal entry
3. `detach()` emits `GRAPH_UPDATED` (per D-17 — one event per command)
4. `detach()` fires `classifyAndAnchorIncremental` fire-and-forget
5. Later (async) `commitClassificationResult` emits its OWN `GRAPH_UPDATED` when classification finishes

This is a **two-event sequence for one detach call** — subscribers reload twice. NOT a violation of D-17 (one event PER COMMAND) — the second emit comes from a downstream service (`commitClassificationResult`), not from `graphCommandService`. Document explicitly so reviewers don't mistake this for a duplicate emit bug.

**AbortSignal threading:** D-19 + the Phase 27 `LOCALE_CHANGED` pattern. If detach receives a signal that fires mid-classification, the in-flight classification call cancels cleanly via the signal already wired through `classifyAndAnchorIncremental`'s `runStepWithRetry → chatCompletion` chain.

---

## R8. Test infrastructure — where do graph command tests live?

**Existing graph-related test files** (`app/tests/services/`):

| File | What it tests | Mock pattern |
|------|---------------|--------------|
| `classification-dedup.test.mjs` | `canonical-knowledge.service.ts` source-reading invariants | Reads source file via fs, asserts code patterns exist |
| `trellis-prune.test.mjs` | `trellisActionsService.prune/unprune/hardDelete` | `_actions-mock-question.mjs` in-memory store; full `_actions-mock-loader.mjs` register hook |
| `trellis-heal.test.mjs` | `trellisActionsService.heal` | Same actions-mock loader |
| `trellis-replant.test.mjs` | `trellisActionsService.replant` | Same |
| `trellis-state.test.mjs` | `buildTrellisState` pure-logic | Direct import (leaf module) |
| `daily-read.service.test.mjs` | `dailyReadService` localStorage path | localStorage shim (`storage = new Map()`) |

**Mock pattern for `questionService`** (canonical example: `_actions-mock-question.mjs` lines 1-39):

```js
let _store = [];
export function _resetStore(questions) { _store = questions ? [...questions] : []; }
export function _getStore() { return [..._store]; }
export const questionService = {
  getAll(opts) { return opts?.includeFlagged ? [..._store] : _store.filter((q) => !q.flagged); },
  getPrunedQuestions() { return _store.filter((q) => q.flagged === true && q.prunedFromTrellis === true); },
  patchQuestion(questionId, patch) {
    const idx = _store.findIndex((q) => q.id === questionId);
    if (idx !== -1) _store[idx] = { ..._store[idx], ...patch };
  },
  async delete(questionId) { _store = _store.filter((q) => q.id !== questionId); },
};
```

Used via `register('./_actions-mock-hooks.mjs')` in `_actions-mock-loader.mjs` — these tests need their own `npm run test:actions` script entry (see `package.json`).

**localStorage shim pattern** (canonical example: `trellis-prune.test.mjs:4-11`):

```js
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
```

**Event-emission test pattern** (canonical: `trellis-prune.test.mjs:47-63`):

```js
const events = [];
const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));
// ... action ...
unsub();
assert.equal(events.length, 1, 'must emit exactly one GRAPH_UPDATED');
```

### Recommended new test files

| File | What it tests | Mock strategy |
|------|---------------|---------------|
| `tests/services/graph-edit-journal.test.mjs` | Leaf module: append, cap at N=10, load/save, persistence across reload (localStorage shim) | Standalone — graph-edit-journal has zero deps beyond localStorage |
| `tests/services/graph-command-service.rename.test.mjs` | rename: validation (empty/whitespace/100-char cap), patch correctness, journal entry, single GRAPH_UPDATED emit, normalizeAnchorName NOT called | `_actions-mock-question.mjs` + localStorage shim + `_actions-mock-loader.mjs`-style register hook |
| `tests/services/graph-command-service.move.test.mjs` | move: anchor→cluster, QA→anchor, label inheritance, qaCount recompute, journal `before` shape | Same mocks |
| `tests/services/graph-command-service.merge.test.mjs` | merge: reparent children, hard-delete loser, recompute survivor qaCount, embeddingVector cleared, full-loser-record in journal | Same mocks + embedding mock (`_actions-mock-embedding.mjs`) |
| `tests/services/graph-command-service.detach.test.mjs` | detach: clears placement, fires classifyAndAnchorIncremental fire-and-forget, journal `before` shape | Same mocks + canonical-knowledge mock |
| `tests/services/graph-command-service.prune.test.mjs` | prune: delegates to trellisActionsService.prune, journal entry, GRAPH_UPDATED emit | Same mocks |
| `tests/services/graph-command-service.delete.test.mjs` | delete: full-record snapshot, cascade re-parent children to cluster, undo cascade | Same mocks |
| `tests/services/graph-command-service.undo.test.mjs` | undo: pops newest, inverts each `cmd` correctly, append-only invariant, depth=10 cap | Same mocks |
| `tests/services/reorg-prompt-journal-injection.test.mjs` | Source-reading: reorganizeMindmap system prompt includes "Manual corrections to preserve:" block; byte-stability across two calls when journal unchanged | fs-based source read (same pattern as classification-dedup.test.mjs) |
| `tests/services/graph-command-service.integration.test.mjs` | End-to-end: rename → move → merge → undo sequence; assert store + journal state after each | Same mocks; verifies command composition |

### Reuse existing fixtures

- `_actions-mock-question.mjs` — extend with `updateRelatedIds` if needed (currently absent)
- `_actions-mock-embedding.mjs` — for merge survivor re-embed tests
- `_actions-mock-loader.mjs` register hook — add the graph-command-service tests to the `test:actions` script in package.json
- localStorage shim pattern — copy verbatim into new test files

---

## R9. UI integration touch-points (read-only inventory — DO NOT design UI)

**Phase 49 consumers** (per ROADMAP success criteria 1):

- `screens/GraphScreen.tsx` — selected-node correction controls. Current `setSelectedNode` plumbing at `:464`. Detail card at `:570-599` shows node info; Phase 49 adds rename / move / merge / detach / prune / delete buttons here.
- `screens/PlannerScreen.tsx:90` — `handlePrune` migrates to `graphCommandService.prune` for undo support
- `components/trellis/PrunedSection.tsx:31, 36` — `handleUnprune` and `handleHardDelete` may migrate to `graphCommandService.undo()` / `.delete()`
- `screens/QuestionDetailScreen.tsx:68`, `AnchorDetailScreen.tsx:104, 106`, `ClusterDetailScreen.tsx:123, 126, 128` — direct `questionService.delete` calls may migrate to `graphCommandService.delete()`

### Service return shapes (Phase 48 surface for Phase 49)

```ts
type GraphCommandService = {
  // Simple commands — no return data needed
  rename(id: string, newTitle: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>>;
  move(id: string, newParentId: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>>;
  prune(anchorId: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>>;

  // Detach — operator wants to know if it no-op'd (per D-13: "Phase 49 may surface a toast")
  detach(qaId: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>>;
  // Note: re-classification is fire-and-forget, so this can't synchronously report outcome.
  // Phase 49 may subscribe to GRAPH_UPDATED + detect QA's new parentId === old parentId to show toast.

  // Merge — Phase 49 needs preview data BEFORE commit (preview is in Phase 49)
  merge(loserId: string, survivorId: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<{
    reparentedCount: number;     // for "Moved N Q&As to {survivor.title}" toast
    newSurvivorQaCount: number;
  }>>;

  // Delete — return removed-children count for confirmation toast
  delete(id: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<{
    cascadedChildIds: string[];  // children re-parented to cluster
  }>>;

  // Undo — return enough info to show "Undid: rename 'Old' → 'New'" toast (per R9 question)
  undo(): Promise<ServiceResult<{
    undoneCmd: 'rename' | 'move' | 'merge' | 'detach' | 'prune' | 'delete';
    targetIds: string[];
    summary: string;  // human-readable, e.g., "rename 'Spaced Rep' → 'Spaced Repetition'"
  }>>;
};
```

### Empty journal undo behavior

When `loadJournal().length === 0`, `undo()` returns:

```ts
{ success: false, error: { code: 'NOT_FOUND', message: 'Nothing to undo.', retryable: false } }
```

Phase 49 UI can either grey out the undo button when journal is empty, or display the error message as a neutral toast. Implementation detail per CONTEXT.md Claude's-discretion.

---

## R10. Risks + landmines specific to this phase

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | **Race: detach mid-`commitClassificationResult`** — user detaches QA while another QA is being classified into the same anchor. Reads of `allQuestions` snapshot get stale. | Medium | Stale qaCount on anchor for ~10s | Use fresh `questionService.getAll()` reads inside each command (pattern: `question.service.ts:405` "Read-modify-write against fresh localStorage"). Don't pass long-held snapshots. |
| 2 | **localStorage quota exceeded** | Low | Journal write fails silently; oldest entries lost | At N=10 with worst-case 50KB, headroom is ~100×. Guard `saveJournal` with try/catch + console.warn (pattern: `question.service.ts:113-115`). |
| 3 | **Snapshot bloat on `delete(anchorId)` with 200 children** | Low (200 children on ONE anchor is unusual) | Single journal entry ~50KB+ | Cap `cascadedChildIds` array but NOT individual records (we only store IDs, not full child records — children are still in `questionService` store, journal just records re-parent diff). At 200 IDs × ~12 bytes ≈ 2.4KB. Fine. |
| 4 | **Undo-after-reorg** — user renames anchor A → reorg runs → user undoes. Reorg consumed the journal but didn't write a journal entry itself. Undo pops the rename entry and tries to apply inverse. | Medium | Inverse `rename` may target a node that no longer exists (reorg restructured) | Validate `targetIds` exist in store before applying inverse. If missing, return `ServiceResult` with `NOT_FOUND`, leave journal entry in place. Phase 49 surfaces as "Undo unavailable — the original record no longer exists." Decision: **reorg is NOT undoable in Phase 48** (out of scope per CONTEXT.md `<deferred>`). |
| 5 | **Two `GRAPH_UPDATED` emits per detach** (one from command, one from later classification) | Always | Subscribers reload twice | Documented in R7 — not a bug, but flag in implementation comments so reviewers don't try to "fix" it. |
| 6 | **`merge()` recomputes `embeddingVector` via fire-and-forget — fails silently if embedding provider down** | Medium | Survivor anchor has stale vector → Phase 33 pre-check may miss future near-duplicates | D-11 explicit: graceful-degradation matches Phase 47 D-12. Survivor keeps existing vector if re-embed fails. Document inline. |
| 7 | **Cluster delete cascades to anchors, anchors cascade to QAs** | Low (clusters rarely deleted manually) | Two-level cascade requires nested re-parent logic | Cluster delete: child anchors re-parent to root (no parent). Child QAs of those anchors stay parented to their anchor — they only move if anchor itself is deleted. Single-level cascade. Avoids unbounded recursion. |
| 8 | **Test isolation: localStorage tests share state** | High in tests | Test 2 sees Test 1's journal | Standard pattern: `storage.clear()` at top of every test (canonical `trellis-prune.test.mjs:32`). Document in new test files. |
| 9 | **Concurrent merge of A→B and B→C in parallel** | Very low (no UI affordance in Phase 48) | Loser-B is deleted by first command before second command's read; second command fails with NOT_FOUND | Phase 49 UI naturally serializes (one button-press at a time). Phase 48 doesn't need a mutex — but `merge` MUST re-read store inside the command (not use stale snapshot). |
| 10 | **Reorg prompt journal entries reference deleted nodes** | Medium | LLM sees `"User renamed anchor X..."` but anchor X no longer exists | Acceptable. The instruction is "preserve this name" — if the node is gone, the instruction is moot. LLM can ignore. No filtering needed in Phase 48. |
| 11 | **`rename` with `newTitle === current title`** | Low | Wasted journal entry, no semantic change | Validate: if `newTitle.trim() === existing.title?.trim()`, return success without writing journal. Saves a journal slot. |
| 12 | **`move` to same parent** | Low | Wasted journal entry | Same: validate `newParentId === existing.parentId`, no-op. |
| 13 | **`merge(X, X)` self-merge** | Low | Would delete the only copy | Validate `loserId !== survivorId`, return `VALIDATION_ERROR` if same. |
| 14 | **Detach of an already-unassigned QA** | Low | Detach has nothing to clear | Validate: if `parentId === undefined`, return success without writing journal. |

---

## R11. Recommended plan decomposition

Five plans, three waves. Parallelism friendly inside each wave.

### Plan 48-01 — Journal + types + storage + reorg prompt injection (Wave 1)

**Title:** Graph edit journal: types, storage, retention, and reorg-prompt injection
**Requirements:** GRAPH-04 (partial), foundation for GRAPH-01
**Files created:**
- `app/src/services/graph-edit-journal.service.ts` — new leaf module: `append`, `loadEntries`, `clear`, retention cap N=10
- `app/src/services/graph-edit-journal-phrasing.ts` — per-cmd canonical prompt phrasing (R4 templates)
- `app/tests/services/graph-edit-journal.test.mjs` — leaf module behavioral tests
- `app/tests/services/reorg-prompt-journal-injection.test.mjs` — source-reading invariant for prompt block

**Files modified:**
- `app/src/types/index.ts` — add `GraphEditLogEntry` interface; extend `GRAPH_UPDATED` payload (optional `kind`/`anchorId`/`affectedIds` per R5)
- `app/src/services/canonical-knowledge.service.ts:1622-1642` — inject journal-derived constraints into `reorganizeMindmap` system prompt; preserve byte-stability when journal is empty

**Wave assignment:** Wave 1 (foundation — every other plan imports from here)
**Dependencies:** none

### Plan 48-02 — graphCommandService rename + move + delete (Wave 2)

**Title:** Graph command service: rename, move, delete
**Requirements:** GRAPH-01 (boundary), GRAPH-02 (rename + move), GRAPH-03 (delete partial)
**Files created:**
- `app/src/services/graph-command.service.ts` — new service with `rename`, `move`, `delete` methods (stubs for merge/detach/prune/undo to be filled by Plans 03/04)
- `app/tests/services/graph-command-service.rename.test.mjs`
- `app/tests/services/graph-command-service.move.test.mjs`
- `app/tests/services/graph-command-service.delete.test.mjs`

**Wave:** Wave 2 (after Plan 01)
**Dependencies:** Plan 01

### Plan 48-03 — graphCommandService merge + detach + prune (Wave 2, parallel with 02)

**Title:** Graph command service: merge, detach, prune
**Requirements:** GRAPH-03 (merge + detach + prune)
**Files created:**
- (extends `graph-command.service.ts` from Plan 02)
- `app/tests/services/graph-command-service.merge.test.mjs`
- `app/tests/services/graph-command-service.detach.test.mjs`
- `app/tests/services/graph-command-service.prune.test.mjs`

**Files modified:**
- (none beyond extending graph-command.service.ts)

**Wave:** Wave 2 (parallel with Plan 02 — separate methods, separate test files)
**Dependencies:** Plan 01. **Soft coordination with Plan 02** because both add methods to the same `graph-command.service.ts` file; planner should sequence file commits to avoid merge conflict, OR have Plan 02 land first as the file's structural author.

### Plan 48-04 — undo + integration tests + payload wiring (Wave 3)

**Title:** Graph command service: undo, payload wiring, end-to-end integration
**Requirements:** GRAPH-04 (full), GRAPH-01 (closure)
**Files created:**
- `app/tests/services/graph-command-service.undo.test.mjs`
- `app/tests/services/graph-command-service.integration.test.mjs` — rename → move → merge → undo composition

**Files modified:**
- `app/src/services/graph-command.service.ts` — add `undo()` method using inverse-verb-with-swapped-snapshots strategy (R11 main recommendation)
- `app/package.json` — add new test files to `test:actions` script

**Wave:** Wave 3 (after Plans 02 + 03)
**Dependencies:** Plans 01 + 02 + 03

### Plan 48-05 — consolidation (defer to Phase 49 OR Wave 3 if time)

**Title:** Migrate existing prune/unprune callers through graph command service
**Requirements:** none new (already satisfied by 02-04)
**Files modified:**
- `app/src/services/trellis-actions.service.ts` — `prune()` and `unpruneQuestion()` kept (PrunedSection still uses them) but get a comment noting `graphCommandService` is the new public form
- (Optional) `app/src/screens/PlannerScreen.tsx:90` — migrate `handlePrune` to `graphCommandService.prune` for undo support

**Wave:** Wave 3 (last) OR defer to Phase 49
**Dependencies:** Plans 02-04
**Recommendation:** **DEFER to Phase 49.** Phase 48 ships the new command service with no UI consumer. Existing callers continue working unchanged. Phase 49 owns migration as part of building the UI.

### Wave summary

```
Wave 1: [Plan 01]               (journal + reorg prompt injection)
        ↓
Wave 2: [Plan 02] [Plan 03]     (parallel — rename/move/delete + merge/detach/prune)
        ↓               ↓
Wave 3: [Plan 04]               (undo + integration)
        (Plan 05 deferred to Phase 49)
```

---

## Files Inventory

| File | Plan | Action | Lines (est) |
|------|------|--------|-------------|
| `app/src/services/graph-edit-journal.service.ts` | 01 | CREATE | ~120 |
| `app/src/services/graph-edit-journal-phrasing.ts` | 01 | CREATE | ~60 |
| `app/src/services/graph-command.service.ts` | 02 (skeleton), 03 (extend), 04 (undo) | CREATE | ~400 total |
| `app/src/types/index.ts` | 01 | MODIFY (`GraphEditLogEntry`, payload extension) | +30 |
| `app/src/services/canonical-knowledge.service.ts` | 01 | MODIFY (reorg system prompt injection at lines 1622-1642) | +25 |
| `app/src/services/trellis-actions.service.ts` | 05 (deferred) | MODIFY (comment noting consolidation surface) | +5 |
| `app/package.json` | 04 | MODIFY (extend `test:actions` script) | +1 line |
| `app/tests/services/graph-edit-journal.test.mjs` | 01 | CREATE | ~200 |
| `app/tests/services/reorg-prompt-journal-injection.test.mjs` | 01 | CREATE | ~80 |
| `app/tests/services/graph-command-service.rename.test.mjs` | 02 | CREATE | ~200 |
| `app/tests/services/graph-command-service.move.test.mjs` | 02 | CREATE | ~250 |
| `app/tests/services/graph-command-service.delete.test.mjs` | 02 | CREATE | ~200 |
| `app/tests/services/graph-command-service.merge.test.mjs` | 03 | CREATE | ~300 |
| `app/tests/services/graph-command-service.detach.test.mjs` | 03 | CREATE | ~200 |
| `app/tests/services/graph-command-service.prune.test.mjs` | 03 | CREATE | ~150 |
| `app/tests/services/graph-command-service.undo.test.mjs` | 04 | CREATE | ~250 |
| `app/tests/services/graph-command-service.integration.test.mjs` | 04 | CREATE | ~200 |

**Total new code (est):** ~2,000 LOC of tests + ~600 LOC of source.

---

## Standard Stack

No new dependencies. Phase 48 is pure TypeScript over existing infrastructure:

| Library/Module | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `node:test` (built-in) | Node 20+ | Test runner | CLAUDE.md mandate: "Test framework: Node.js built-in `node --test` with esbuild tsx loader" |
| `node:assert/strict` (built-in) | Node 20+ | Assertions | Same — existing tests use this throughout |
| `localStorage` (Web API) | n/a | Journal storage | Primary store per existing project pattern (`question.service.ts:17`) |
| `eventBus` (in-repo) | n/a | `GRAPH_UPDATED` emit | `app/src/lib/event-bus.ts:28` — unified event hub per CLAUDE.md |

No npm packages to install. No Package Legitimacy Audit needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic Question patch | New writer | `questionService.patchQuestion` (`question.service.ts:610`) | Single write path; introducing a second writer would break the "deletes resurrect" guard at `:62-84` |
| Hard delete | New delete path | `questionService.delete` (`question.service.ts:565`) | Already handles SQLite cold-backup + `QUESTION_DELETED`+`GRAPH_UPDATED` emit |
| Soft prune | New prune logic | Delegate to `trellisActionsService.prune` (`trellis-actions.service.ts:126`) | Preserves PrunedSection's `ANCHOR_DELETED` subscriber |
| Anchor name normalization | Apply on rename | **BYPASS** per D-16. `normalizeAnchorName` (`canonical-knowledge.service.ts:769`) is LLM-laziness defense, not for human input |
| Concurrent reorg mutex | New flag | `_reorgInProgress` (`canonical-knowledge.service.ts:1406-1410`) — already exists |
| Embedding re-compute on rename/merge | New embed call | `embedText(text, EmbeddingConfig)` (`providers/embedding/index.ts:29`) — same call site as `canonical-knowledge.service.ts:669` (anchor backfill) |
| New event type for graph commands | `GRAPH_RENAMED`, `GRAPH_MERGED`, etc. | **EXTEND** `GRAPH_UPDATED` payload (R5). CLAUDE.md §"Event bus — unified GRAPH_UPDATED" forbids parallel event types. |
| Reorg revert backup | New snapshot system | `REORG_SNAPSHOT_KEY` (`canonical-knowledge.service.ts:1402`) — already exists; journal is independent of this |
| ULID generation | Pull in `ulid` package | Use timestamp + Math.random pattern at `canonical-knowledge.service.ts:818` (`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`) — zero-dep |

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │       Phase 49 UI (NOT in Phase 48)        │
                    │   GraphScreen / PrunedSection / Planner    │
                    └────────────────────┬────────────────────────┘
                                         │
                                  (Phase 49 wires here)
                                         │
                                         ▼
                    ┌─────────────────────────────────────────────┐
                    │           graphCommandService                │
                    │   rename / move / merge / detach /          │
                    │   prune / delete / undo  (D-12)             │
                    │                                              │
                    │  Validation → Snapshot before → Patch       │
                    │  → Write journal entry → Emit GRAPH_UPDATED │
                    └──┬──────────────┬──────────────┬──────────┘
                       │              │              │
        patchQuestion  │   delete     │  journal     │ eventBus.emit
       (single write   │              │  append      │ GRAPH_UPDATED
        path - R3)     │              │              │ (per D-17)
                       ▼              ▼              ▼
            ┌─────────────────┐  ┌──────────┐  ┌──────────────────┐
            │ questionService │  │  graph-  │  │   eventBus       │
            │  patch / delete │  │  edit-   │  │                  │
            │                 │  │ journal  │  │  GRAPH_UPDATED   │
            └────────┬────────┘  │ service  │  │      ↓           │
                     │           │ (D-04)   │  │ useTrellisData   │
                     ▼           └─────┬────┘  │ useQuestions     │
            ┌─────────────────┐        │       │ PrunedSection    │
            │  localStorage   │        ▼       │ GraphScreen      │
            │ trellis_questions│  ┌─────────┐  └──────────────────┘
            └────────┬────────┘   │trellis_ │
                     │            │graph_   │
            fire-and-forget       │edit_log │
                     ▼            │(N=10)   │
            ┌─────────────────┐   └────┬────┘
            │   SQLite cold   │        │
            │     backup      │        │ readJournal
            └─────────────────┘        │
                                       ▼
                    ┌─────────────────────────────────────────────┐
                    │      reorganizeMindmap() (D-02)             │
                    │                                              │
                    │  System prompt = [structure rules, ...,     │
                    │   "Manual corrections to preserve:", ...    │
                    │   journal entries phrased per R4 template]  │
                    │                                              │
                    │  → chatCompletion → reorg tree → reconcile  │
                    │    with concurrent mutations (existing      │
                    │    pattern at :1877-1915)                   │
                    └─────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │     commitClassificationResult (D-02)        │
                    │  UNGUARDED — does NOT consult journal       │
                    │  Per-Q&A classification routes by embedding │
                    │  similarity, not by anchor name             │
                    └─────────────────────────────────────────────┘
```

### Recommended file structure

```
app/src/services/
├── graph-command.service.ts          # NEW — commands (D-12 API)
├── graph-edit-journal.service.ts     # NEW — append-only log (D-04)
├── graph-edit-journal-phrasing.ts    # NEW — per-cmd prompt strings (R4)
├── question.service.ts               # EXISTING — sole writer
├── canonical-knowledge.service.ts    # EXISTING — extended at line ~1622
└── trellis-actions.service.ts        # EXISTING — delegated by prune (R6)

app/tests/services/
├── graph-edit-journal.test.mjs                       # Plan 01
├── reorg-prompt-journal-injection.test.mjs           # Plan 01
├── graph-command-service.rename.test.mjs             # Plan 02
├── graph-command-service.move.test.mjs               # Plan 02
├── graph-command-service.delete.test.mjs             # Plan 02
├── graph-command-service.merge.test.mjs              # Plan 03
├── graph-command-service.detach.test.mjs             # Plan 03
├── graph-command-service.prune.test.mjs              # Plan 03
├── graph-command-service.undo.test.mjs               # Plan 04
└── graph-command-service.integration.test.mjs        # Plan 04
```

### Pattern 1: Read-fresh-localStorage before mutate

**What:** Each command reads `questionService.getAll({ includeFlagged: true })` AT THE START of the command, never holds a long-lived snapshot.

**When to use:** Every method on `graphCommandService`.

**Example:** Mirrors `question.service.ts:402-410`:
```ts
// Don't trust the caller's snapshot — read fresh
const store = questionService.getAll({ includeFlagged: true });
const target = store.find((q) => q.id === id);
if (!target) return { success: false, error: { code: 'NOT_FOUND', ... } };
```

### Pattern 2: Single-emit-per-command discipline

**What:** Each successful command emits exactly ONE `GRAPH_UPDATED`. Even merge (multi-record write) emits once.

**When to use:** Every public method on `graphCommandService` that mutates state.

**Example:** `eventBus.emit({ type: 'GRAPH_UPDATED', payload: { kind: 'merge', anchorId: survivorId, affectedIds: [...reparentedIds] } });` AFTER all `patchQuestion` calls complete.

Note: detach's downstream `classifyAndAnchorIncremental` emits its own `GRAPH_UPDATED` later — that's a SECOND command (classification), not a duplicate emit (R7).

### Pattern 3: Leaf-module test isolation

**What:** New service modules with no transitive deps on the i18n/locale chain so `node --test` can import them directly.

**When to use:** `graph-edit-journal.service.ts` — keep it pure.

**Example:** `app/src/services/refill-mutex.ts` (`tests/services/refill-mutex.test.mjs:31` imports directly: `await import('../../src/services/refill-mutex.ts')`).

### Anti-Patterns to Avoid

- **`questionService` snapshot held across awaits.** Stale reads cause "deletes resurrect" regressions (`question.service.ts:40-61`).
- **Direct `localStorage.setItem('trellis_questions', ...)`.** Bypasses SQLite mirror at `question.service.ts:23-28`. The ONE existing exception is `canonical-knowledge.service.ts:840-846, 917-924` (anchor/cluster creation) — Phase 48 does NOT add new exceptions.
- **Aliases / phantom records on merge.** D-10 explicit rejection. No "soft" merge, no redirect entries.
- **Per-node revs / locks.** D-01 explicit rejection.
- **New event types** (`GRAPH_RENAMED`, `GRAPH_MERGED`). CLAUDE.md unified-event rule.
- **Apply `normalizeAnchorName` on rename input.** D-16 explicit bypass.

---

## Runtime State Inventory

Phase 48 is a service-build phase — NOT a rename/refactor/migration. Steps 2.5 of the research protocol are skipped.

For completeness on rename-relevant axes:

| Category | Items | Action |
|----------|-------|--------|
| Stored data | `trellis_graph_edit_log` is NEW (no existing data to migrate). Existing `trellis_questions` is unchanged in shape. | None — additive. |
| Live service config | None — no external services. | None. |
| OS-registered state | None — pure browser/Capacitor app. | None. |
| Secrets/env vars | None new. | None. |
| Build artifacts | None — no rename of build outputs. | None. |

---

## Common Pitfalls

### Pitfall 1: Hidden second `GRAPH_UPDATED` emit from downstream classification

**What goes wrong:** Detach emits `GRAPH_UPDATED` once. Then fires `classifyAndAnchorIncremental` which emits `GRAPH_UPDATED` again ~5-15s later when classification completes.

**Why it happens:** D-17 enforces ONE emit per COMMAND, but classification is a separate command in `canonical-knowledge.service.ts` with its own emit at `:974`.

**How to avoid:** Document inline. Subscribers (`useTrellisData`, etc.) already idempotent on re-fire — double reload is wasted CPU, not a correctness bug.

**Warning signs:** Reviewer flags "two emits per detach is a bug" → point at R7.

### Pitfall 2: Direct localStorage write bypassing patchQuestion

**What goes wrong:** `canonical-knowledge.service.ts:840-846, 917-924` writes `trellis_questions` directly. If Phase 48 adds NEW direct-write paths, the journal won't see them, and SQLite mirror won't sync.

**How to avoid:** Every Phase 48 write goes through `questionService.patchQuestion` or `questionService.delete`. No exceptions.

**Warning signs:** PR diff contains `localStorage.setItem('trellis_questions', ...)`.

### Pitfall 3: Snapshot held across await

**What goes wrong:** Command reads `questionService.getAll()` once at start, performs async work, then writes back the stale snapshot — clobbers concurrent mutations.

**How to avoid:** Re-read fresh inside command body. Pattern at `question.service.ts:402-410` is the canonical example.

**Warning signs:** Variable named `store` or `allQuestions` held across `await`.

### Pitfall 4: `undo()` of a deleted-then-renamed target

**What goes wrong:** User deletes anchor A. Reorg recreates an anchor with same name but new ID A'. User clicks undo. Inverse `delete` tries to resurrect anchor A with old ID — collides nothing since A no longer exists, but A' is still there with same title. Result: duplicate anchors with same name.

**How to avoid:** R10 risk 4 — validate `targetIds` exist OR check name collision before resurrect. If A's title now matches A''s title, return `VALIDATION_ERROR` ("Cannot undo: name conflict with existing anchor"). Defer auto-merge to Phase 49 UX.

**Warning signs:** Integration test "delete → reorg → undo" passes silently.

### Pitfall 5: Journal entries reference IDs that no longer exist

**What goes wrong:** Reorg-prompt injection includes `"User renamed anchor X..."` but anchor X was deleted. LLM gets confused.

**How to avoid:** Per R10 risk 10 — acceptable for v1.6. LLM ignores instructions about missing nodes. Don't add filter logic in Phase 48 (out of scope; would add per-emit store walks).

---

## Code Examples

### Example 1: Journal append + retention cap

```ts
// app/src/services/graph-edit-journal.service.ts
const JOURNAL_KEY = 'trellis_graph_edit_log';
const MAX_ENTRIES = 10;  // D-05

export interface GraphEditLogEntry {
  id: string;
  ts: number;
  cmd: 'rename' | 'move' | 'merge' | 'detach' | 'prune' | 'delete';
  targetIds: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

function loadJournal(): GraphEditLogEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveJournal(entries: GraphEditLogEntry[]): void {
  try {
    const capped = entries.slice(-MAX_ENTRIES);  // D-05: drop oldest beyond N=10
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(capped));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[Trellis] graph edit log quota exceeded');
    }
  }
}

export const graphEditJournal = {
  append(entry: Omit<GraphEditLogEntry, 'id' | 'ts'>): GraphEditLogEntry {
    const full: GraphEditLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
    };
    const entries = loadJournal();
    entries.push(full);
    saveJournal(entries);
    return full;
  },
  list(): GraphEditLogEntry[] { return loadJournal(); },
  popNewest(): GraphEditLogEntry | undefined {
    const entries = loadJournal();
    const newest = entries.pop();
    saveJournal(entries);
    return newest;
  },
  clear(): void { saveJournal([]); },
};
```

### Example 2: `rename` command (D-12, D-16, D-17)

```ts
// app/src/services/graph-command.service.ts (excerpt)
async rename(id: string, newTitle: string): Promise<ServiceResult<void>> {
  // D-16 hard validation only — no normalizeAnchorName
  const trimmed = newTitle.trim();
  if (!trimmed) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title cannot be empty.', retryable: false } };
  if (trimmed.length > 100) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title cannot exceed 100 characters.', retryable: false } };

  // Read fresh — never trust caller snapshot
  const store = questionService.getAll({ includeFlagged: true });
  const target = store.find((q) => q.id === id);
  if (!target) return { success: false, error: { code: 'NOT_FOUND', message: 'Node not found.', retryable: false } };

  // Pitfall 11 — no-op if unchanged
  if ((target.title?.trim() ?? '') === trimmed) return { success: true };

  // Snapshot before
  const before = { title: target.title, content: target.content, summary: target.summary, embeddingVector: target.embeddingVector };

  // Patch — title + content + summary mirror per canonical-knowledge anchor shape (lines 896-899)
  questionService.patchQuestion(id, { title: trimmed, content: trimmed, summary: trimmed, embeddingVector: undefined });

  // Journal D-04
  graphEditJournal.append({
    cmd: 'rename',
    targetIds: [id],
    before,
    after: { title: trimmed, content: trimmed, summary: trimmed },
  });

  // D-17 single emit
  eventBus.emit({ type: 'GRAPH_UPDATED', payload: { kind: 'rename', anchorId: id } });

  // Fire-and-forget re-embed — graceful degradation per D-11
  const embCfg = settingsService.getSync().embedding;
  if (embCfg.isConfigured) {
    void embedText(trimmed, embCfg)
      .then((vec) => questionService.patchQuestion(id, { embeddingVector: vec }))
      .catch((err) => console.warn('[Trellis] rename re-embed failed:', err));
  }

  return { success: true };
}
```

### Example 3: Reorg prompt injection (D-01, D-20)

```ts
// app/src/services/canonical-knowledge.service.ts (extension at line ~1642)
import { graphEditJournal } from './graph-edit-journal.service.ts';
import { phraseJournalEntry } from './graph-edit-journal-phrasing.ts';

// ... existing systemPrompt array build ...

const journalEntries = graphEditJournal.list();
const constraintsBlock = journalEntries.length === 0
  ? 'Manual corrections to preserve:\n(none)'
  : 'Manual corrections to preserve (most recent learner edits — do not undo these in your reorganization):\n'
    + journalEntries.map((entry, i) => `${i + 1}. ${phraseJournalEntry(entry)}`).join('\n');

const systemPrompt = [
  'You are a knowledge organization assistant. ...',
  // ... existing structure policy + rules block ...
  '',
  constraintsBlock,
  '',
  'Respond ONLY with valid JSON ...',
].join('\n');
```

---

## State of the Art

No state-of-the-art shift. This phase uses established in-repo patterns (localStorage primary, event-bus unified signal, `ServiceResult` returns, fire-and-forget SQLite mirror, `node --test` test runner).

External references confirming the journal-as-prompt-constraint approach as a valid pattern (vs. per-node locks):
- LLM prompt-engineering best practice: include domain constraints in the system prompt rather than post-process outputs. Operator intuition in CONTEXT.md `<specifics>` matches this.
- The pattern is analogous to OpenAI Cookbook "Constrain the model with a system message" guidance — `[ASSUMED, not verified in this session — directional only, not load-bearing]`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Journal entry size estimates (rename ~500B, merge ~5KB worst-case) | R3, R10 risk 2 | Wrong by 2-3× would still fit quota; wrong by 100× would hit the limit. Confirm by adding a quota-test to Plan 01 that writes 10 max-size entries. |
| A2 | Reorg prompt token budget (existing ~250 + journal ~500 = ~750 total) | R4 | If far more, may need to truncate constraints (CONTEXT.md `<deferred>`). Confirm via dev console once Plan 01 lands. |
| A3 | LLM providers' prefix-cache behavior with the new constraint block | R4 byte-stability | If cache miss is more disruptive than estimated, may be worth measuring. Not load-bearing for correctness. |
| A4 | Cascade rule on `delete(anchorId)` = re-parent to cluster (Claude's discretion per D-15) | R2, R10 risk 7 | If operator prefers cascade-delete OR re-parent to Unassigned, Plan 02's delete logic needs adjustment. Confirm during plan-check. |
| A5 | Reorg is NOT undoable in Phase 48 | R10 risk 4 | If operator wants reorg undo, that's a NEW scope item — would change Plan 04. Confirm during plan-check. |
| A6 | `graph.service.ts:linkNodes` and `moveToParent` truly have no callers in `app/src` (verified via grep) | R1 | If a test file or build script uses them, the "dead code" claim is wrong. Verified via `grep -rn "graphService\." app/src` — only `getGraph` (`GraphScreen.tsx:469`) and `reinforceEdge` (`ReviewScreen.tsx:385`) called. |
| A7 | The `_actions-mock-loader.mjs` register-hook pattern will work for the new command service tests | R8 | If new tests need additional mock surfaces (embedding, canonical-knowledge), Plan 02 may need to extend the mock hook map. Low risk — existing mocks already cover all needed deps. |

---

## Open Questions (RESOLVED)

1. **Should `undo()` resurrect a hard-deleted anchor with its original ID, or assign a new ID?**
   - What we know: Journal `before` contains the FULL Question record including `id`. Undo writes it back via the localStorage primary path.
   - What's unclear: If the original ID was reused (extremely unlikely with timestamp-based IDs) or if downstream caches keyed on the deleted id still hold stale refs, behavior may differ.
   - Recommendation: Resurrect with original ID. Existing ID generator (`Date.now()`) practically guarantees no collision. Document inline.
   - **RESOLVED (2026-05-17, plan-check iteration 2):** Plan 04 Task 1 implements `restoreDeleted(before.deletedRecord as Question)` preserving the embedded `id` — same path the journal recorded. Plan 04 acceptance criterion asserts the restored anchor has the original `id`.

2. **When the LLM re-organize call respects journal constraints, how is "respected" verified?**
   - What we know: D-01 says journal-as-prompt-constraint. No assertion logic is mandated.
   - What's unclear: Should `_doReorganize` (`canonical-knowledge.service.ts:1598`) post-validate that recent journal targets still exist in the result tree? Or trust the LLM?
   - Recommendation: TRUST the LLM in Phase 48. Add observability ONLY (log if a journal-named anchor is missing from the post-reorg store). Auto-revert is a Phase 49+ if needed.
   - **RESOLVED (2026-05-17, plan-check iteration 2):** TRUST-ONLY in Phase 48 — no post-validation, no observability log, no auto-revert. Plans 01–04 add no `_doReorganize` post-check task. Rationale: the journal-as-prompt-constraint already shapes the LLM's input; auto-validation would re-introduce the "lock vs. restructured tree" trap that D-01 was written to avoid. If operator finds the LLM ignoring constraints during Phase 49 dogfooding, observability + auto-revert becomes a Phase 49+ scope item. Tracked in `48-VALIDATION.md` Manual-Only Verifications row 1.

3. **What's the operator's expected behavior when undo is the FIRST action after app boot (no journal in memory)?**
   - What we know: Journal persists in localStorage; `loadJournal()` reads it on every call.
   - What's unclear: Does this Just Work? (Yes — confirmed by reading the load function.)
   - Recommendation: Test it explicitly in `graph-command-service.undo.test.mjs`.
   - **RESOLVED (2026-05-17, plan-check iteration 2):** Plan 04 Task 1 behavior bullet 1 covers `"empty journal → undo() returns { success: false, error: 'NOT_FOUND' }"`. Plan 04 acceptance criterion includes the cold-boot-empty-journal case in `graph-command-service.undo.test.mjs`.

---

## Environment Availability

Phase 48 has no external dependencies beyond what the project already requires. Skipping detailed audit.

- **localStorage:** Available in browser AND Capacitor WebView ✓
- **SQLite:** Available in Capacitor; gracefully degrades on web (per `question.service.ts:81-83`) ✓
- **Embedding provider:** Optional — only required for merge survivor re-embed; graceful degradation per D-11 + Phase 47 D-12 pattern ✓
- **LLM provider:** Required for `reorganizeMindmap` (not new — already required) ✓
- **node --test runner:** Required for the new test files. Available via existing `npm test` ✓

**No missing dependencies. No fallbacks required beyond existing graceful-degradation patterns.**

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (Node 20+) |
| Config file | `app/package.json` scripts `test`, `test:main`, `test:actions` |
| Quick run command | `cd app && node --test tests/services/graph-command-service.<verb>.test.mjs` (per-file) |
| Full suite command | `cd app && npm test` |
| Mock loader for service tests | `--import ./tests/services/_actions-mock-loader.mjs` (for tests needing question-service mocks) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | One service boundary for all six command verbs | unit (per-verb) + integration | `cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.*.test.mjs` | ❌ all new (Plans 02-04 Wave 0) |
| GRAPH-01 | Each command writes exactly one journal entry on success | unit | (included in per-verb tests) | ❌ |
| GRAPH-01 | Each command emits exactly one `GRAPH_UPDATED` | unit | (included in per-verb tests) | ❌ |
| GRAPH-02 | Rename: title patched; embeddingVector cleared; bypass `normalizeAnchorName`; 100-char cap; empty rejected | unit | `... graph-command-service.rename.test.mjs` | ❌ |
| GRAPH-02 | Move: parentId/branchLabel/clusterLabel/clusterNodeId updated; qaCount recomputed; nodeSummary updated | unit | `... graph-command-service.move.test.mjs` | ❌ |
| GRAPH-03 | Merge: children reparented; loser hard-deleted; survivor qaCount+embeddingVector recomputed; full loser record in journal | unit | `... graph-command-service.merge.test.mjs` | ❌ |
| GRAPH-03 | Detach: placement fields cleared; classifyAndAnchorIncremental fires fire-and-forget | unit | `... graph-command-service.detach.test.mjs` | ❌ |
| GRAPH-03 | Prune: delegates to trellisActionsService.prune; journal entry; GRAPH_UPDATED emit | unit | `... graph-command-service.prune.test.mjs` | ❌ |
| GRAPH-03 | Delete: full record snapshot; cascade re-parent children to cluster | unit | `... graph-command-service.delete.test.mjs` | ❌ |
| GRAPH-03 | Undo: pops newest entry; correctly inverts each cmd type; append-only invariant (writes inverse entry) | unit | `... graph-command-service.undo.test.mjs` | ❌ |
| GRAPH-03 | Undo: empty journal returns NOT_FOUND error | unit | (in undo test) | ❌ |
| GRAPH-04 | Reorg prompt includes `Manual corrections to preserve:` block | source-reading | `... reorg-prompt-journal-injection.test.mjs` | ❌ |
| GRAPH-04 | Reorg prompt byte-stable when journal unchanged | source-reading + behavioral | (in injection test) | ❌ |
| GRAPH-04 | Journal: append-only, capped at N=10, persists across `loadJournal()` re-calls | unit | `... graph-edit-journal.test.mjs` | ❌ |
| GRAPH-04 (durability) | Journal survives `localStorage` clear/re-populate cycle (success criterion 3 — "user-visible graph state survives reload") | unit (localStorage shim re-populate) | (in journal test) | ❌ |
| GRAPH-04 | Integration: rename → move → merge → undo sequence produces expected store + journal state | integration | `... graph-command-service.integration.test.mjs` | ❌ |

### Sampling Rate

- **Per task commit:** `cd app && node --test tests/services/graph-command-service.<verb>.test.mjs` (single file, <2s)
- **Per wave merge:** `cd app && npm test` (full suite, ~30-60s with the new files)
- **Phase gate:** Full suite green before `/gsd:verify-work`. Plan-checker should verify all 10 new test files exist + pass.

### Wave 0 Gaps

- [ ] `tests/services/graph-edit-journal.test.mjs` — covers GRAPH-04 (journal mechanics)
- [ ] `tests/services/reorg-prompt-journal-injection.test.mjs` — covers GRAPH-04 (reorg prompt)
- [ ] `tests/services/graph-command-service.rename.test.mjs` — covers GRAPH-02 (rename)
- [ ] `tests/services/graph-command-service.move.test.mjs` — covers GRAPH-02 (move)
- [ ] `tests/services/graph-command-service.merge.test.mjs` — covers GRAPH-03 (merge)
- [ ] `tests/services/graph-command-service.detach.test.mjs` — covers GRAPH-03 (detach)
- [ ] `tests/services/graph-command-service.prune.test.mjs` — covers GRAPH-03 (prune)
- [ ] `tests/services/graph-command-service.delete.test.mjs` — covers GRAPH-03 (delete)
- [ ] `tests/services/graph-command-service.undo.test.mjs` — covers GRAPH-03 (undo) + GRAPH-04 (depth=10 cap)
- [ ] `tests/services/graph-command-service.integration.test.mjs` — covers GRAPH-01 (boundary) end-to-end
- [ ] `package.json` — extend `test:actions` script to include the new files using the `_actions-mock-loader.mjs` register hook

**Framework install:** None — already in place. `node --test` is built-in.

---

## Sources

### Primary (HIGH confidence — all in-repo file:line refs)

- `app/src/types/index.ts:5-39` — `Question` schema
- `app/src/types/index.ts:719` — `GRAPH_UPDATED` event def
- `app/src/services/question.service.ts:17` — STORAGE_KEY
- `app/src/services/question.service.ts:62-84` — `hydrateFromSQLite` (load-bearing invariant)
- `app/src/services/question.service.ts:565-571` — `delete(id)` (single hard-delete path)
- `app/src/services/question.service.ts:610-618` — `patchQuestion(id, patch)` (single write path)
- `app/src/services/canonical-knowledge.service.ts:42` — `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` (0.82)
- `app/src/services/canonical-knowledge.service.ts:769-786` — `normalizeAnchorName` (BYPASSED by rename per D-16)
- `app/src/services/canonical-knowledge.service.ts:788-975` — `commitClassificationResult` (UNGUARDED per D-02)
- `app/src/services/canonical-knowledge.service.ts:840-846, 917-924` — direct localStorage writes (anchor/cluster create — Phase 48 does NOT touch these)
- `app/src/services/canonical-knowledge.service.ts:1007-1183` — `classifyAndAnchorIncremental` (detach fire-and-forget target)
- `app/src/services/canonical-knowledge.service.ts:1402-1410` — `REORG_SNAPSHOT_KEY`, `STORAGE_KEY`, `_reorgInProgress`
- `app/src/services/canonical-knowledge.service.ts:1580-1928` — `reorganizeMindmap` + `_doReorganize` (D-01 prompt injection target at lines 1622-1642)
- `app/src/services/canonical-knowledge.service.ts:1877-1915` — reorg reconciliation pattern (proven concurrent-mutation handling)
- `app/src/services/trellis-actions.service.ts:126-130` — `prune` (DELEGATED by R6)
- `app/src/services/trellis-actions.service.ts:136-138` — `unpruneQuestion`
- `app/src/services/trellis-actions.service.ts:145-147` — `hardDelete`
- `app/src/services/graph.service.ts:86-101` — `linkNodes` (DEAD CODE, no callers)
- `app/src/services/graph.service.ts:183-185` — `moveToParent` (DEAD CODE, no callers)
- `app/src/services/daily-read.service.ts:17, 29-51` — load/save pattern for localStorage-backed services
- `app/src/services/refill-mutex.ts` — leaf-module test pattern
- `app/src/providers/embedding/index.ts:15-25` — `cosine`, `embedText` (D-11 survivor re-embed call)
- `app/src/lib/event-bus.ts:28` — `eventBus.emit`/`subscribe`
- `app/src/state/useQuestions.ts:78-82` — `GRAPH_UPDATED` subscriber
- `app/src/state/useTrellisData.ts:33` — `GRAPH_UPDATED` subscriber
- `app/src/screens/GraphScreen.tsx:464, 496-498` — `setSelectedNode` (Phase 49 hook), `GRAPH_UPDATED` subscriber
- `app/src/screens/PlannerScreen.tsx:90` — `trellisActionsService.prune` caller
- `app/src/components/trellis/PrunedSection.tsx:24-26, 31, 36` — subscribers + `unpruneQuestion`/`hardDelete` callers
- `app/tests/services/_actions-mock-question.mjs` — mock pattern
- `app/tests/services/_actions-mock-hooks.mjs` — register hook pattern
- `app/tests/services/_actions-mock-loader.mjs` — register-hook entry
- `app/tests/services/trellis-prune.test.mjs` — canonical test shape for command-service tests
- `app/tests/services/classification-dedup.test.mjs` — canonical source-reading test pattern
- `app/tests/services/refill-mutex.test.mjs:31` — leaf-module direct-import pattern
- `app/tests/services/daily-read.service.test.mjs` — canonical localStorage shim pattern
- `app/package.json` scripts.test/test:main/test:actions — test entry points
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-CONTEXT.md` — D-01..D-20
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-DISCUSSION-LOG.md` — operator reasoning
- `.planning/REQUIREMENTS.md:34-37` — GRAPH-01..04
- `.planning/ROADMAP.md:53-62` — Phase 48 success criteria
- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — single-event rule
- `CLAUDE.md` §"Anchor name normalization" — normalizeAnchorName is for LLM defense, not human input (basis for D-16)
- `CLAUDE.md` §"Classification dedup — embedding pre-check" — 0.82 threshold context
- `CLAUDE.md` §"Best practices learned in Phase 32.1" — 10 lessons applied throughout

### Secondary (MEDIUM confidence — derived from primary sources)

- Estimated journal entry sizes (R10 risk 2 / A1) — derived from observed Question record sizes via grep
- Token budget for reorg prompt extension (R4 / A2) — heuristic English-prose estimation

### Tertiary (LOW confidence — flagged in Assumptions Log)

- A3: Provider KV-cache reuse benefit from byte-stability — directional only, not verified in this session

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new deps; everything in-repo
- Architecture: HIGH — single command service over existing single-writer pattern is well-established in the codebase
- Pitfalls: HIGH — derived directly from CLAUDE.md "Best practices learned in Phase 32.1" + concrete file:line observations
- Code examples: HIGH — patterns lifted verbatim from existing leaf modules

**Research date:** 2026-05-17
**Valid until:** Stable for ~60 days — pure service-build phase over established infrastructure; risk of staleness mainly from CLAUDE.md / event-bus invariants drift, which is unlikely on this timescale.

---

## RESEARCH COMPLETE

Phase 48 is a thin orchestration service over the existing single Question write path, plus a 10-entry append-only localStorage journal whose two consumers (undo + reorg-prompt injection) implement GRAPH-01..04 without any new event types, types, dependencies, or UI surfaces — Phase 49 owns all UI.
