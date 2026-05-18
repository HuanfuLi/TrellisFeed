# Phase 49: Graph Correction UI - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

User-facing surface for the Phase 48 graph command service. Adds **iOS-style direct-manipulation controls** on `GraphScreen`:

- **Tap a node** → existing inspector card → navigate (unchanged).
- **Long-press + release in place** → inline correction card with a vertical action list (Rename, Move, Merge, Detach, Prune, Delete).
- **Long-press + drag past threshold** → drag-to-relocate with ghost node, line-to-original-parent preview, and magnetic halo on hover. Drop on cluster = Move. Drop on another anchor = Merge.
- **Undo** lives at the right-lower corner of the graph viewport next to the existing expand/collapse button; tap = direct undo + toast.

High-impact actions (merge, hard-delete) get a structured confirm modal; soft prune commits with a Snackbar+Undo toast (no modal). Reorganize-in-progress disables correction controls until `REORG_COMPLETED` fires. Reload survival (GRAPHUI-03) is satisfied by Phase 48's `patchQuestion` localStorage durability — no new UI plumbing needed.

Phase 48 ships the validated service; Phase 49 ships the gesture surface, confirmations, and i18n bundles.

</domain>

<decisions>
## Implementation Decisions

### Invocation model — gesture surface (GRAPHUI-01)

- **D-01:** Three pointer behaviors on a graph node, exhaustive:
  1. **Tap** (quick, no drag) — current behavior. Selects node → shows existing inspector card at line 570 of `GraphScreen.tsx`. No change to this path.
  2. **Long-press + release in place** (no drag past threshold) — pops up the **correction card** (new). Replaces no existing surface; coexists with the inspector card.
  3. **Long-press + drag past threshold** — enters **drag-to-relocate** mode with ghost-node + line-to-origin + target halo.
  - Rationale (operator): native-iOS feel. Tap is for inspection, long-press-release is for "do something to this node," long-press-drag is for "put it somewhere else." Direct-manipulation gestures map to the spatial verbs (Move, Merge) and a menu covers the non-spatial verbs (Rename, Detach, Prune, Delete, Undo).
  - Threshold values (researcher to confirm against existing pointer-event patterns + Capacitor mobile target):
    - Long-press duration: ~400ms (iOS default).
    - Drag-start threshold: ~8px move after long-press recognized.
    - Haptic feedback: fire on long-press recognized AND on drop-onto-valid-target (`navigator.vibrate` web API, or Capacitor Haptics plugin if available — researcher).

- **D-02:** Correction card layout = **vertical action list**. iOS-style rows: leading icon + label + chevron. Each tap on a row opens that action's sub-flow which replaces the card content. Cancel in sub-flow returns to the action list. Tap-outside or an X close button dismisses the card entirely. The card overlays the map without blocking pan/scroll underneath.

- **D-03:** Correction card and inspector card are **two distinct surfaces**, not modes of the same card. They may coexist (tap selects a node → inspector card; long-press the same node → correction card appears, inspector card dismisses). Visually they look different (inspector = brief metadata + chevron-into-detail; correction = action list).

### Drag-and-drop semantics (GRAPHUI-01)

- **D-04:** Drop-target rules:
  - **Drop anchor on cluster** = Move (anchor's new parent = cluster).
  - **Drop anchor on another anchor** = Merge (dragged anchor is the LOSER; drop target is the SURVIVOR). Matches the "long-press = loser" convention from D-08.
  - **Drop QA leaf on anchor** = (deferred to Claude's discretion — researcher decides if this is a valid spatial move or stays menu-only via Detach + re-classify; safer default is "QA drags are not enabled in Phase 49" since detach is re-classify-based, not free-form parent-pick).
  - **Drop on invalid target** (e.g., anchor on QA leaf, or anchor on root) → brief haptic + toast "Not a valid drop target," ghost snaps back to origin.

- **D-05:** Drag preview:
  - **Ghost node** = semi-transparent copy of the dragged node tracks the finger.
  - **Origin line** = subtle line from the ghost back to the original parent so the user remembers where the node came from. Renders even when origin scrolls off-screen.
  - **Hover halo on valid targets** = teal halo on cluster targets (Move semantics), warning-colored halo (e.g., amber/orange) on anchor targets (Merge semantics). Color choice via CSS variables; researcher to map to the project palette (`--primary-40` for teal, suggested warning var = `--node-peach` or new `--warn-40` per palette audit).
  - **Magnetic snap** = when ghost is within ~24–32px of a valid target's center, snap-to-target with a brief animation; commit-confirm dialog opens on release.
  - **Invalid hover** = no halo; neutral.

- **D-06:** Drag is the **primary** path for Move and Merge; the action menu retains "Move…" and "Merge with…" entries as a **fallback** (operator confirmed: keep both paths). Menu-driven flow enters a **tap-second-node mode**:
  - Header banner replaces right-side Reorganize button area: *"Tap a cluster to move \"X\" into it"* or *"Tap an anchor to merge \"X\" into"*, with a Cancel button.
  - Invalid taps in pick-mode produce a brief toast "Not a valid target."
  - Cancel returns to the correction card open on the original node.
  - Map continues to render normally during pick mode; no overlay tint (avoid MindElixir theme conflicts).

### Confirm dialogs — preview content (GRAPHUI-02)

- **D-07:** **Merge confirm** = **side-by-side cards** dialog:
  - Two compact cards rendered horizontally. Left card = LOSER (grayed, "will be removed" badge). Right card = SURVIVOR (highlighted, "will keep" badge).
  - Each card shows: title, Q&A count (`qaCount`), cluster name.
  - Body line: *"Merging will move {{n}} Q&As under \"{{survivor.title}}\" and remove the \"{{loser.title}}\" anchor."*
  - Footer: *"Survivor's title and cluster are preserved. This can be undone."*
  - Buttons: **Cancel** / **Merge** (primary, accent color).
  - Source: drag-drop sets loser/survivor from gesture (dragged = loser); menu+tap path uses the same convention (long-pressed = loser, tapped-second = survivor) — D-08.
  - **No direction-swap button** in the modal. If the user picked the wrong direction, they cancel and re-drag / re-tap. Matches Phase 48 D-07 "service does NOT auto-pick by heuristic."

- **D-08:** Merge direction convention: **the long-pressed (or dragged-from) node is the LOSER**. Captured in two flows:
  - Drag: dragged = loser; drop target = survivor.
  - Menu+tap: long-pressed = loser; tapped-second-node = survivor.
  - The confirm modal makes this explicit via "will be removed" / "will keep" badges, so even if the user mis-mapped the convention they see it before committing.

- **D-09:** **Hard-delete confirm** = full modal with cascade explanation:
  - Title: *"Delete \"{{title}}\" permanently?"*
  - Body: *"{{n}} Q&As will be re-parented to the cluster \"{{parentCluster}}\". This can be undone within the last 10 graph edits."*
  - Footer button: **Cancel** / **Delete** (destructive red).
  - **Cascade rule (Phase 48 D-15 → Phase 49 lock):** **re-parent children to the anchor's cluster** is the default. **No cascade-delete option in the modal.** Operator chose "Modal with cascade explanation + child count" (option A), not "Modal with cascade choice" (option B). If the user wants to also delete children, they delete each QA leaf first (or use the existing AnchorDetailScreen's bulk delete which already chains questionService.delete on children).
  - Empty-anchor case (no QA children): same modal but body says "This anchor has no Q&As. Deleting removes it from the map."

- **D-10:** **Soft prune** = **no modal**, immediate commit + Snackbar with Undo:
  - On tap "Prune" in the correction card → service commits → toast at bottom: *"\"Anchor X\" pruned. [Undo]"* for ~5s.
  - The toast's [Undo] calls the same `commandService.undo()` path as the persistent corner button.
  - Pruned anchor immediately disappears from the visible mind-map (existing `flagged !== true` filter at `GraphScreen.tsx:513`) and appears in `PrunedSection` (already wired to `GRAPH_UPDATED`).
  - No confirm even when the anchor has Q&A children — pruning is soft + reversible + the children stay parented to the pruned anchor per Phase 48 D-14.

- **D-11:** **Rename, Move, Detach** = no confirm modal:
  - **Rename:** the action row expands inline into a text input pre-filled with current title; submit on Enter or tap "Save"; service commits; toast confirms. Hard validation per Phase 48 D-16 (non-empty, ≤100 chars, trim). No `normalizeAnchorName` — operator-trust.
  - **Move:** confirm IS the drop-onto-target gesture; service commits on release with a toast *"\"X\" moved to \"Y\""*. (For menu+tap path: same — the tap on the target node IS the confirm; no modal.)
  - **Detach:** commit immediately (D-13 from Phase 48) → fire `classifyAndAnchorIncremental` → on result, toast per D-13 below.

### Detach result UX (GRAPHUI-01)

- **D-12:** Detach always emits a toast with the classifier result, distinguishing re-anchored vs. no-op:
  - If `result.anchorId !== originalAnchorId`: toast *"\"{{qaTitle}}\" re-anchored under \"{{newAnchor.title}}\""* (success variant, teal).
  - If `result.anchorId === originalAnchorId`: toast *"\"{{qaTitle}}\" stayed under \"{{anchor.title}}\" (best match)"* (info variant, neutral). Distinct from silence so the user knows classification ran.
  - Toast tap-target navigates to the new (or unchanged) anchor's detail screen — researcher to confirm whether the existing toast component supports actions or just dismiss.

### Undo surface (GRAPHUI-02)

- **D-13:** **Persistent Undo button at the right-lower corner of the graph viewport**, immediately left of the existing expand/collapse button (`GraphScreen.tsx:417-441`):
  - 36px circular button, same visual treatment as the existing expand/collapse button. Icon = `Undo2` or `RotateCcw` from `lucide-react` (researcher's call based on which renders best at 18px).
  - **Tap behavior:** **direct undo + toast**. Single tap calls `commandService.undo()` (no confirm modal). The returned `ServiceResult<{ undoneCmd: string }>` (Phase 48 D-12) feeds the toast text: *"Undone: rename \"SRS\" → \"Spaced Repetition\""* / *"Undone: delete \"X\""* etc. Toast persists ~5s.
  - **Disabled state:** when the journal is empty (`localStorage.getItem('trellis_graph_edit_log')` is null or `[]`), the button is grayed and tap is a no-op (or surfaces a brief "Nothing to undo" toast — researcher's call).
  - **Subscribes to `GRAPH_UPDATED`** to recompute enabled/disabled state (any new command → enabled; undo of last entry → maybe disabled).
  - Mirrors "phone back-button" feel — chosen explicitly over a confirm-modal-per-tap.

- **D-14:** **Snackbar-with-Undo for soft prune only** (D-10). Other commands rely on the persistent corner Undo button. Rationale: soft prune is the only command where the visual effect is immediate dismissal of the node from the map — an inline recovery affordance prevents "I just lost my anchor, where did it go?" panic. Rename/move/merge/delete all open a modal or transition through a visible interaction, so the persistent Undo button is sufficient.

### Per-node-type action matrix (GRAPHUI-01)

- **D-15:** Tight per-type matrix — gate by node type, not "show all + gray invalid":

  | Node type | Long-press action menu shows |
  |---|---|
  | Root (`root-knowledge`) | No actions. Long-press emits a toast *"Root node — not editable"* and does not open the correction card. Drag is also blocked. |
  | Branch (synthetic ID like `branch-Knowledge-Math`) | **Rename only.** Branches are derived labels on Question records (`branchLabel`), not separate records. Phase 49 ships Rename for branches as a future-proofing affordance; underlying service applies the rename across all child Questions sharing that `branchLabel` (researcher to validate the service supports this — Phase 48 D-12 surface defines `rename(id, newTitle)` for record IDs; branch rename may need a new method or a wrapper). **If complexity is high, defer branch rename to a later phase** and treat branches as read-only in v1.6 (Claude's discretion). |
  | Cluster | **Rename, Move (→ branch parent change), Merge with cluster, Delete.** Clusters are Question records with `isClusterNode = true`. No prune (clusters don't go through the trellis "leafState" flow). |
  | Anchor | **Rename, Move (→ cluster), Merge with anchor, Prune (soft), Delete.** Full surface. |
  | QA leaf | **Detach (re-classify), Delete.** No rename (Q&A questions are user-typed content, not labels). No merge (Phase 48 service supports `merge(loser, survivor)` agnostic of type, but operator's mental model for merge is "two anchor duplicates," not Q&A consolidation). |

  Undo is a **global** action, surfaced via the corner button, not per-node.

### Reorganize-in-progress (GRAPHUI-02 + GRAPHUI-03)

- **D-16:** While `isReorgInProgress() === true`:
  - **Action menu shows a single non-actionable row**: *"Reorganizing — manual corrections paused"* with no buttons. Tap-outside dismisses.
  - **Drag-start is blocked**: if user attempts to drag a node, drag is canceled with a brief toast *"Reorganize in progress — try again in a moment"*. (Long-press still recognized to enable the menu pop-up which then shows the paused message.)
  - **Persistent Undo button is also disabled** during reorg (defensive — undo writes to the same journal the reorg LLM is reading from).
  - **On `REORG_COMPLETED` event** (already subscribed by `GraphScreen.tsx:482`): controls re-enable automatically. No reload of journal state needed — Phase 48's journal is its own structure independent of reorg.
  - **On `REORG_FAILED`**: same auto-re-enable (controls aren't blocked by a failed reorg).

### i18n surface (GRAPHUI-01 + project rule)

- **D-17:** Phase 49 adds a new namespace `graph.correction.*` (rather than overloading the existing `graph.toast.*` / `graph.selected.*`). Per CLAUDE.md i18n rule, every PR adds canonical EN value + runs the Sonnet subagent for zh/es/ja, and `bundle-parity.test.mjs` enforces parity.

  Keys to add (researcher to finalize the canonical EN list; this is the minimum surface):
  ```
  graph.correction.actions.rename
  graph.correction.actions.move
  graph.correction.actions.merge
  graph.correction.actions.detach
  graph.correction.actions.prune
  graph.correction.actions.delete
  graph.correction.actions.undo
  graph.correction.actions.close
  graph.correction.pickMode.move
  graph.correction.pickMode.merge
  graph.correction.pickMode.cancel
  graph.correction.pickMode.invalidTarget
  graph.correction.rename.placeholder
  graph.correction.rename.save
  graph.correction.rename.tooLong
  graph.correction.rename.empty
  graph.correction.merge.title
  graph.correction.merge.willBeRemoved
  graph.correction.merge.willKeep
  graph.correction.merge.body
  graph.correction.merge.footer
  graph.correction.merge.cancel
  graph.correction.merge.confirm
  graph.correction.delete.title
  graph.correction.delete.bodyWithChildren
  graph.correction.delete.bodyEmpty
  graph.correction.delete.cancel
  graph.correction.delete.confirm
  graph.correction.toast.renamed
  graph.correction.toast.moved
  graph.correction.toast.merged
  graph.correction.toast.detachedNewAnchor
  graph.correction.toast.detachedSameAnchor
  graph.correction.toast.pruned
  graph.correction.toast.prunedUndo
  graph.correction.toast.deleted
  graph.correction.toast.undone
  graph.correction.toast.nothingToUndo
  graph.correction.toast.dropInvalid
  graph.correction.toast.reorgInProgress
  graph.correction.toast.rootNotEditable
  graph.correction.reorgPaused
  ```
  - **Do NOT** translate proper nouns (Trellis, OpenAI, etc.) or anchor titles passed via interpolation `{{title}}` — already covered by the i18n rule.

### Claude's Discretion (researcher decides)

- Whether `rename` on a branch node is feasible in Phase 49 or deferred (D-15). Service surface is `rename(id, newTitle)` per Phase 48 D-12 — branches aren't record-IDs in the canonical model. Reasonable default: defer branch rename, surface branches as "Tap to rename — coming soon" or simply no action on branch long-press in v1.6.
- Whether QA-leaf drag-to-anchor is a valid Phase 49 gesture, or QA drags are disabled and detach is the only QA-leaf relocation path (D-04).
- Magnetic snap radius (24–32px suggested), drag-start threshold (8px suggested), long-press duration (400ms suggested) — all empirically tunable; researcher to verify against existing pointer-event patterns in `app/src/components/SwipeTabContainer.tsx` and MindElixir's own gesture handlers.
- Whether to use `navigator.vibrate` web API for haptics or Capacitor `Haptics` plugin (the latter is already a dependency for native targets per `package.json` — researcher to confirm).
- MindElixir gesture override: how to capture long-press + drag without conflicting with MindElixir's built-in pointer handlers (the library may already consume `pointerdown`/`pointermove` for pan/zoom). Likely requires `data-no-swipe-nav="true"` already on the container (`GraphScreen.tsx:408`) plus a node-level event delegate. Researcher to investigate.
- Ghost-node rendering approach: portal a clone of the MindElixir node DOM, render an absolutely-positioned floating element with the node's title + position transform, or use a CSS pseudo-element. The choice affects perf on dense graphs.
- Origin-line preview rendering: SVG overlay vs. canvas vs. DOM-line. SVG fits with MindElixir's existing rendering layer.
- Snackbar component: existing `toast()` helper in `src/lib/toast.ts` returns dismiss; does it support an action button? If not, Phase 49 needs to extend `toast()` (or add a `<SnackbarWithAction>` component). Researcher to confirm.
- Confirm modal component: existing `showReorgConfirm` pattern in `GraphScreen.tsx:518-535` is one-off inline; should Phase 49 extract a reusable `<ConfirmDialog>` component or repeat the pattern? Suggested: extract — at least 3 use sites (merge, delete, plus reuse for future).
- Whether the persistent Undo button's tap on an empty journal is silent or surfaces "Nothing to undo" toast (D-13).
- Visual style of the correction card vs. the inspector card: same `--surface-variant` shell, different content? Different elevation? Researcher to align with existing iOS-style settings sub-page pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements

- `.planning/REQUIREMENTS.md` §GRAPHUI (GRAPHUI-01..03) — three locked requirements for this phase
- `.planning/REQUIREMENTS.md` §"Out of Scope" — v1.6 non-goals; **per-node "why was this placed here" inspection is out of scope** for Phase 49 (private answer to professor Q1)
- `.planning/ROADMAP.md` §"Phase 49" — success criteria 1–3 + scope note

### Upstream phase contract (mandatory before any UI design)

- `.planning/phases/48-graph-command-service-and-trust-invariants/48-CONTEXT.md` — Phase 48 D-01..D-20. Locked service surface, merge direction convention (D-07), rename normalization bypass (D-16), detach = re-classify (D-13), prune is soft (D-14), delete is hard with researcher-chosen cascade (D-15), N=10 undo journal (D-05).
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-RESEARCH.md` — the implementation research for the service layer; UI must consume the public API, not re-implement validation.
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-01-PLAN.md` / `48-02-PLAN.md` — locked Phase 48 plans (if executed before Phase 49 starts).

### Project + cross-cutting invariants

- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — one event per mutation; existing GraphScreen subscriber already reloads on `GRAPH_UPDATED` so manual reload plumbing is not needed.
- `CLAUDE.md` §"i18n Workflow (Phase 27+)" — EN-first + Sonnet subagent for zh/es/ja + `bundle-parity.test.mjs` enforces parity; `graph.correction.*` namespace must land all 4 bundles in the same PR.
- `CLAUDE.md` §"Header positioning (Phase 32.1)" — `GraphScreen` is a top-level swipe-tab slot; its `Header` renders in-tree. Pick-mode header banner replacement must respect this (don't break the in-tree/portal split).
- `CLAUDE.md` §"Anchor name normalization" — rename UI bypasses `normalizeAnchorName` per Phase 48 D-16; trust operator input; hard validation only.
- `CLAUDE.md` §"Always-mounted screens must explicitly re-read service state on navigation" — `GraphScreen` is always-mounted; correction-card state may need explicit re-read on `location.pathname` change to avoid stale selection after sub-screen navigation.

### Codebase entry points (must read before designing)

- `app/src/screens/GraphScreen.tsx`
  - Line 412 `touchAction: 'none'` on MindElixir container — pointer event surface for long-press + drag overlays
  - Line 408 `data-no-swipe-nav="true"` — already opts out of SwipeTabContainer's horizontal swipe so our gestures won't fight the tab strip
  - Line 417–441 — existing expand/collapse button at `bottom: 12px, right: 12px`; Phase 49 Undo button mirrors this position, immediately left
  - Line 464 `setSelectedNode` — existing tap-to-select state; correction card uses a separate `correctionNode` state to coexist
  - Line 482–500 — existing `eventBus.subscribe('GRAPH_UPDATED'…)` reload path; new commands flow through this for free
  - Line 568 `onNodeClick={setSelectedNode}` — MindElixir tap handler; long-press handler must be wired without breaking this
  - Line 570–647 — existing selected-node inspector card; stays unchanged
- `app/src/screens/AnchorDetailScreen.tsx:99–111` — existing DetailMenu (delete + chain children deletion). Phase 49 may keep this pattern; new correction-card surface is additive.
- `app/src/screens/ClusterDetailScreen.tsx:118–130` — same as above for clusters.
- `app/src/services/graph.service.ts` — `getGraph()` is the existing reload path; Phase 48's command service is the WRITE path. Phase 49 only calls the command service for writes, not graph.service directly.
- `app/src/components/SwipeTabContainer.tsx` — pointer events + `data-no-swipe-nav="true"` opt-out (already applied on graph container); reference for gesture-vs-strip conflict resolution.
- `app/src/lib/toast.ts` — existing toast helper. Phase 49 may need an action-button variant (`toast.actionable(message, { label, onAction })` or new `SnackbarWithAction` component) for D-10's [Undo] in the prune toast.
- `app/src/lib/event-bus.ts` — Phase 49 SUBSCRIBES to `GRAPH_UPDATED` (for Undo button enabled/disabled state) but does NOT emit new events (Phase 48 emits via the command service).
- `app/src/locales/en.json` — `graph.*` namespace (lines 225–288); add `graph.correction.*` subtree.
- `app/src/components/ui/Header.tsx` + CLAUDE.md §"Header positioning (Phase 32.1)" — pick-mode header banner must not move the Header out of its in-tree/portal mode.

### Operator memory (context only — not user-facing docs)

- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_tile_simplicity_preference.md` — tile-specific simplicity preference does NOT apply to interactive surfaces like the correction card. Detail screens and PostDetail can be interactive + state-rich; same applies here.
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_phase_32_1_lessons.md` — meta-rules; especially: position:fixed + overflow:auto + Android WebView is cursed; correction card uses parent `translateZ(0)` containing block, not `position: fixed` against the document.

### External / library

- MindElixir docs (search context7 / official docs) — confirm how to listen for long-press vs. tap, whether the library exposes per-node pointer events vs. only `onNodeClick`, and whether drag is supported natively (we override either way per GRAPHUI-01 "without making MindElixir's internal tree the source of truth").
- `mind-elixir` package types in `node_modules/mind-elixir/dist/*.d.ts` — `NodeObj`, `MindElixirData`, `MindElixirInstance` already imported in `GraphScreen.tsx:6`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`GraphScreen.tsx` expand/collapse button at lines 417–441** — exact visual treatment for the new persistent Undo button. Same 36px circular shape, same `--surface` background + `--shadow-1`, same absolute positioning at `bottom: 12px`. Undo button sits at `right: 56px` (12 + 36 + 8 gap) to the left of the existing button.
- **`GraphScreen.tsx:482–500` GRAPH_UPDATED subscriber** — already reloads `graph.service.getGraph()` on every command. Phase 49 doesn't need to add a new subscriber for command results — existing path handles it. Just ADD a subscriber on the same event to recompute Undo button enabled/disabled state.
- **`GraphScreen.tsx:518–535` reorganize-confirm-modal pattern** — inline absolute-positioned modal at `zIndex: 300` with `backgroundColor: 'rgba(0,0,0,0.5)'` backdrop. Phase 49 merge + delete confirm modals reuse this exact pattern (or extract a `<ConfirmDialog>` component — Claude's discretion).
- **`AnchorDetailScreen.tsx:99–111` DetailMenu** — proves that destructive actions in this codebase use kebab-overflow menus on detail screens. Phase 49's correction card is a different pattern (inline action list), so the DetailMenu doesn't directly reuse, but the visual language (icon + label rows) is shared.
- **`trellisActionsService.prune`** (`app/src/services/trellis-actions.service.ts:126`) + `unpruneQuestion` (line 136) — existing soft-prune call sites. Phase 48 D-14 leaves consolidation as Claude's discretion. Phase 49 calls the new `commandService.prune()` regardless; the question is whether `trellisActionsService.prune` still exists for the PlannerScreen Suggested Moves path.
- **`PrunedSection.tsx`** — already subscribes to GRAPH_UPDATED and refreshes pruned-archive list. Phase 49 prune toasts the [Undo] which calls commandService.undo() — PrunedSection updates automatically.
- **`toast()` helper** (`app/src/lib/toast.ts`) — primary feedback channel. May need extension for action button (researcher to confirm or add `<SnackbarWithAction>`).
- **`SwipeTabContainer` pointer-events opt-out via `data-no-swipe-nav="true"`** — already applied at `GraphScreen.tsx:408`. Long-press + drag gestures inside the graph container won't fight the tab strip's swipe handler. Reference for cleanly co-existing gestures.
- **CSS variables** — `--primary-40` (teal accent for Move target halo), `--surface-variant` (card background), `--node-peach` or new `--warn-40` (orange halo for Merge target). Researcher to verify or extend.
- **`navigator.vibrate` or `@capacitor/haptics`** — Capacitor is already a dependency (`package.json` per CLAUDE.md tech stack); haptics plugin may already be installed. Researcher to confirm.

### Established Patterns

- **`ServiceResult<T>` return convention** — Phase 48's command service returns `ServiceResult` per method; Phase 49 UI handlers check `result.success` and toast `result.error` on failure.
- **`GRAPH_UPDATED` is the only graph-mutation signal** — Phase 49 emits NOTHING new; Phase 48's command service is the sole emitter.
- **Inline absolute-positioned modals with `zIndex: 300`** — matches existing reorganize-confirm-modal; consistent z-index avoids stacking conflicts.
- **CSS variables over Tailwind classes** for most UI styling.
- **iOS-style sub-page navigation** for Settings — informs the correction-card aesthetic: clean rows, icon + label + chevron, no marketing copy.
- **i18n EN-first + Sonnet subagent + bundle-parity test** — every new key lands all 4 locales in one PR.

### Integration Points

- **Phase 48 commandService** — Phase 49 imports and calls; no validation in the UI layer (service owns validation per Phase 48 D-12).
- **`GraphScreen` selected-node state** (`selectedNode`, `setSelectedNode`) — coexists with new `correctionNode` state; long-press sets `correctionNode`, tap sets `selectedNode`. Both can be non-null simultaneously (rare); long-press during inspector-card open dismisses the inspector and opens the correction card.
- **MindElixir gesture interception** — researcher decides whether to use MindElixir's `onNodeClick` only and add a parallel long-press listener on the container, or to fully wrap node DOM with a custom pointer overlay.
- **`isReorgInProgress()`** from `canonical-knowledge.service.ts` — already imported in GraphScreen; Phase 49 uses it for D-16's reorg-block.
- **PlannerScreen Suggested Moves** — calls `trellisActionsService.prune` today; Phase 48 D-14 leaves consolidation as discretion. Phase 49 doesn't touch PlannerScreen; coordination is in Phase 48's scope.

</code_context>

<specifics>
## Specific Ideas

- **Operator framing for invocation:** "What about long-press a node and pop up the inline card. Normal user click stays as is." This rejected the "edit-mode toggle" and "DetailMenu on detail screen" options in favor of a tap-vs-long-press gesture split — closer to iPhone home-screen / Notes-app interaction conventions.

- **Operator framing for drag:** "User long-press and release to show the menu (merge/delete/etc), and user can long-press and drag around to move a node/anchor to other anchor/cluster with magnetic feel and line preview." This expanded the long-press into TWO gestures: release-in-place = menu, drag-past-threshold = relocation. The "magnetic feel" cue means snap-to-target hover behavior; the "line preview" cue means a visible connection from the dragged ghost back to its origin parent.

- **Operator framing for merge direction:** Chose "pick-order = direction (long-pressed = loser)" over the explicit "A→B / B→A buttons in confirm modal" — operator-trust convention. The side-by-side confirm modal still surfaces the convention visually via "will be removed" / "will keep" badges so accidental wrong-direction is recoverable via Cancel.

- **Operator framing for Undo placement:** "We already have a expand/collapse all button at the right lower corner of graph viewport. Add a back button next to it and use it as undo." Reuses existing visual real estate; mirrors a phone back-button affordance. Direct-tap, no confirm modal.

- **Operator framing for delete cascade:** Chose the explicit "re-parent children to cluster" default + cascade-explanation modal over the "user-choice radio (re-parent vs. cascade-delete)" option. Single decision-path, fewer modal widgets, matches Phase 48 D-15 Claude's-discretion default.

- **Operator framing for prune:** Chose Snackbar-with-Undo over modal-confirm for soft prune — matches iOS Mail "Message deleted, [Undo]" idiom. Reflects that prune is reversible and low-stakes.

- **Operator framing for detach:** "Always toast with the result, distinguishing no-op vs re-anchored." Recognizes that detach's re-classify path can land on the original anchor (no-op) and that silent no-op feels like nothing happened. Always-toast makes the system's response visible.

</specifics>

<deferred>
## Deferred Ideas

- **QA-leaf drag-to-anchor as a free-form parent-pick gesture** — Phase 49 leaves QA leaf drag-and-drop as Claude's discretion (D-04). Detach via menu is the canonical QA relocation path because it uses re-classify (Phase 48 D-13). If operator UAT surfaces "I want to manually pick the new anchor for this Q&A," a future phase can extend the QA-leaf drag flow.

- **Branch rename** — Phase 49 D-15 conditionally includes branch rename, but researcher may defer to a later phase if the service-layer wrapper for `branchLabel` rename across all child Questions is non-trivial. Branches are labels, not records, in the canonical model — true branch rename means a batch patch across N records.

- **Cascade-delete option in the delete confirm modal** — Operator chose the explicit "always re-parent children" path. If operator UAT surfaces "I want to delete the anchor AND all its Q&As in one action," surface a checkbox in a future phase.

- **Direction-swap button in merge confirm modal** — Rejected for operator-trust convention. If users frequently cancel + re-drag because they had the direction wrong, surface a swap button in a future phase.

- **Recent Edits panel (last 10 undo with timestamps)** — Phase 48 D-05 deferred multi-level undo UI to v1.7+. Phase 49 ships single-step Undo only.

- **Drag-to-merge cross-cluster + cluster-merge gesture** — Phase 49 ships anchor-to-anchor merge via drag. Cluster-to-cluster merge stays menu-driven (no drag-on-cluster-to-cluster). Future phase if operator surfaces a need.

- **Right-click / two-finger long-press for desktop** — Phase 49 targets the Capacitor mobile build first. Desktop accessibility (keyboard shortcuts, right-click context menu) can be added in a future a11y phase.

- **AI-suggested merge candidates surfaced in the merge picker** — operator chose tap-second-node mode over "similarity-suggested list" for menu-driven merge. If embedding-based suggestions prove useful, fold into a future GRAPH-F01 (AI-suggested corrections) phase.

- **Per-action haptic patterns** — D-01 suggests "haptic on long-press recognized + on drop-onto-valid-target." Per-action variants (different vibration for merge vs. move) deferred to refinement phase.

- **Inline edit on MindElixir node topic** — explicitly out of scope; GRAPHUI-01 mandates "without making MindElixir's internal tree the source of truth." Rename goes through `commandService.rename` writing to the Question record, never to MindElixir's tree directly.

</deferred>

---

*Phase: 49-Graph Correction UI*
*Context gathered: 2026-05-17*
