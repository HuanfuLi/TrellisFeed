# Phase 49: Graph Correction UI - Research

**Researched:** 2026-05-17
**Domain:** iOS-style direct-manipulation gesture surface over MindElixir + Phase 48 graph command service
**Confidence:** HIGH (all claims tied to file:line in this repo or to checked-in Phase 48 contracts)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Three pointer behaviors on a graph node, exhaustive: (1) Tap → existing inspector card (unchanged); (2) Long-press + release in place → new vertical-list correction card; (3) Long-press + drag past threshold → drag-to-relocate with ghost + line-to-origin + halo. Haptic on long-press recognized AND on drop-onto-valid-target.
- **D-02** Correction card layout = vertical action list (iOS-style rows: leading icon + label + chevron). Sub-flow replaces card content; Cancel returns. Tap-outside or X dismisses. Card overlays map without blocking underlying pan/scroll.
- **D-03** Correction card and inspector card are TWO DISTINCT surfaces (not modes of one). May coexist; long-press on a selected node dismisses inspector + opens correction.
- **D-04** Drop-target rules: drop anchor on cluster = Move; drop anchor on anchor = Merge (dragged = LOSER); drop QA leaf on anchor = Claude's discretion (safer default = disabled); drop on invalid target = haptic + "Not a valid drop target" toast, ghost snaps back.
- **D-05** Drag preview: ghost node (semi-transparent copy), origin line from ghost back to original parent (renders even when origin off-screen), hover halo on valid targets (teal for Move, amber for Merge), magnetic snap when ghost within ~24-32px of valid target center, no halo on invalid hover.
- **D-06** Drag is the PRIMARY path for Move/Merge; menu retains "Move…" / "Merge with…" as fallback via tap-second-node mode (header banner: "Tap a cluster to move 'X' into it" with Cancel button). Invalid taps in pick-mode → toast "Not a valid target." Cancel returns to correction card.
- **D-07** Merge confirm = side-by-side cards dialog: LEFT = LOSER (grayed, "will be removed"), RIGHT = SURVIVOR (highlighted, "will keep"). Body: "Merging will move {{n}} Q&As under '{{survivor.title}}' and remove the '{{loser.title}}' anchor." Footer: "Survivor's title and cluster are preserved. This can be undone." Buttons: Cancel / Merge (primary accent). NO direction-swap button.
- **D-08** Merge direction = the long-pressed (or dragged-from) node is the LOSER. Drag: dragged = loser; drop target = survivor. Menu+tap: long-pressed = loser, tapped-second = survivor.
- **D-09** Hard-delete confirm = full modal with cascade explanation. Title: "Delete '{{title}}' permanently?" Body: "{{n}} Q&As will be re-parented to the cluster '{{parentCluster}}'. This can be undone within the last 10 graph edits." Footer: Cancel / Delete (destructive red). NO cascade-delete option. Empty-anchor case: "This anchor has no Q&As. Deleting removes it from the map."
- **D-10** Soft prune = NO modal, immediate commit + Snackbar with [Undo]: *"'Anchor X' pruned. [Undo]"* for ~5s. [Undo] calls `commandService.undo()`.
- **D-11** Rename/Move/Detach = no confirm modal. Rename: action row expands inline → text input pre-filled, Enter/Save commits with hard validation (non-empty, ≤100 chars, trim — Phase 48 D-16). Move: drop = commit. Detach: commit immediately, fires `classifyAndAnchorIncremental`, toast per D-12.
- **D-12** Detach toast distinguishes outcomes: re-anchored → *"'{{qaTitle}}' re-anchored under '{{newAnchor.title}}'"* (success/teal); same anchor → *"'{{qaTitle}}' stayed under '{{anchor.title}}' (best match)"* (info/neutral).
- **D-13** Persistent Undo button at viewport right-lower corner, immediately LEFT of existing expand/collapse button (mirrors `GraphScreen.tsx:417-441` styling). 36px circular, lucide `Undo2` or `RotateCcw`. Tap = direct undo + toast (NO confirm modal). Disabled when journal empty (subscribes to `GRAPH_UPDATED`).
- **D-14** Snackbar-with-Undo applies to SOFT PRUNE ONLY. Other commands rely on the persistent corner Undo button.
- **D-15** Per-node-type action matrix (gate by node type, no "show all + gray invalid"):
  - Root → no actions, toast "Root node — not editable," drag blocked
  - Branch → Rename only (conditional; researcher decides — see R9)
  - Cluster → Rename, Move (→ branch), Merge with cluster, Delete (no prune)
  - Anchor → Rename, Move (→ cluster), Merge with anchor, Prune, Delete
  - QA leaf → Detach, Delete (no rename, no merge)
- **D-16** While `isReorgInProgress() === true`: action menu shows single non-actionable row "Reorganizing — manual corrections paused"; drag-start blocked with toast; persistent Undo button disabled. On `REORG_COMPLETED` / `REORG_FAILED`: controls auto re-enable.
- **D-17** New i18n namespace `graph.correction.*` (~40 keys listed in CONTEXT.md). EN-first → Sonnet subagent for zh/es/ja → `bundle-parity.test.mjs` enforces parity, single PR.

### Claude's Discretion

- MindElixir gesture interception strategy (R1 resolves)
- Long-press / drag-start thresholds (R2 resolves)
- Magnetic snap radius (R3 resolves)
- Haptics: navigator.vibrate vs `@capacitor/haptics` (R4 resolves)
- Ghost-node rendering approach (R5 resolves)
- Origin-line preview rendering (R6 resolves)
- Snackbar-with-action component (R7 resolves)
- ConfirmDialog extraction (R8 resolves)
- Branch rename feasibility (R9 resolves — DEFER)
- QA-leaf drag-to-anchor (R10 resolves — DISABLE for v1.6)
- Empty-journal Undo button behavior (R11 resolves)
- Visual style of correction card vs inspector card (R12 resolves)

### Deferred Ideas (OUT OF SCOPE for Phase 49)

- QA-leaf drag-to-anchor as free-form parent-pick gesture (researcher locks DISABLE)
- Branch rename (researcher locks DEFER to v1.7+)
- Cascade-delete option in delete confirm modal
- Direction-swap button in merge confirm modal
- Recent Edits panel / multi-level undo UI (single-step only per Phase 48 D-05)
- Cross-cluster cluster-to-cluster merge by drag
- Desktop right-click / keyboard shortcuts
- AI-suggested merge candidates in picker
- Per-action haptic patterns (single pattern for all confirms)
- Inline edit on MindElixir node topic (always route via `commandService.rename`)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRAPHUI-01 | Graph screen exposes local correction controls (rename, move, merge, detach, prune/delete) without making MindElixir's internal tree the source of truth. | R1 confirms MindElixir has NO long-press hook + drag listeners are gated by `editable: true` (we set `editable: false`), so a delegated pointer listener on the wrapping container coexists cleanly. R13 + R14 ship the correction card + per-node-type matrix. All writes route through `graphCommandService` (Phase 48), never to MindElixir's `nodeData` tree. |
| GRAPHUI-02 | Graph correction UI provides clear preview/confirmation for high-impact actions (merge, prune/delete, undo). | R7 (Snackbar-with-Undo for prune), R8 (extracted `ConfirmDialog` for merge + delete + future), R15 (merge side-by-side preview), R16 (delete cascade-explanation modal), R17 (persistent corner Undo button with toast). |
| GRAPHUI-03 | User sees the corrected graph after navigation away, navigation back, or app reload. | Phase 48 D-17 guarantees `questionService.getAll()` returns mutated state after every command (proven by `graph-command-service.reload-survival.test.mjs`). GraphScreen already re-renders on `GRAPH_UPDATED` (line 496-498). Reload survival is FREE — no new plumbing in Phase 49. R18 adds a regression test asserting the full path. |
</phase_requirements>

---

## Summary

Phase 49 builds the iOS-style direct-manipulation UI layer on top of the locked Phase 48 graph command service. The phase ships THREE new gesture-and-confirm primitives plus a per-node-type action matrix:

1. **Gesture engine** — a delegated pointer listener on the existing `data-no-swipe-nav="true"` MindElixir container (`GraphScreen.tsx:408`), differentiating tap / long-press-release / long-press-drag with timing + movement thresholds. MindElixir's tap path (`onNodeClick`-equivalent click delegate at `GraphScreen.tsx:294-302`) stays untouched; the new listener adds on top and consumes pointer events when it commits to long-press or drag.
2. **Correction card** — a separate iOS-style action-list surface (`<CorrectionCard>`) that coexists with the existing inspector card (`GraphScreen.tsx:570-647`). Per-node-type action matrix gates rows; sub-flows replace card content; Cancel returns; X dismisses.
3. **Drag-relocate overlay** — ghost-node portal + SVG origin-line + per-target halo + magnetic snap. Drop = confirm gesture for Move; drop on anchor = open Merge confirm modal. Invalid drop = haptic + toast + snap-back.

Plus three **confirm/preview/feedback** components:

- `<ConfirmDialog>` extracted (replaces the inline `showReorgConfirm` pattern at `GraphScreen.tsx:518-535`), parameterized for Merge (side-by-side) + Delete (cascade explanation) + future reuse.
- `toast()` extended with optional `action` parameter (`{ label, onAction }`) to support Snackbar-with-Undo for soft prune. Single-line additive change to `app/src/lib/toast.ts` + `app/src/components/ui/Toast.tsx`.
- Persistent corner **Undo button** at `bottom: 12px, right: 56px` (12 + 36 + 8 gap, immediately LEFT of existing expand/collapse at `GraphScreen.tsx:417-441`).

**Primary recommendation:**

1. **DO NOT** use MindElixir's bus events for long-press — the library does not expose one. Use the existing delegated-listener pattern at `GraphScreen.tsx:294-340` as the prior-art template (it already coexists with MindElixir's internal pointer handling). Long-press timer follows the codebase-wide **480ms** convention (`useLongPress.ts:22`, `MasonryFeed.tsx:354`).
2. **REUSE** `app/src/hooks/useLongPress.ts` (480ms timer, pointer-event policy, `didLongPress` ref to suppress click-after-long-press). It's already proven on dense interactive surfaces (MasonryFeed tiles, ChatMessage). Adding `8px` movement threshold to differentiate "long-press hold" from "long-press drag" requires a sibling hook (or extending `useLongPress` with an `onDragStart` callback) — researcher recommends a NEW `useLongPressOrDrag.ts` hook so existing `useLongPress` consumers are not destabilized.
3. **REUSE** `app/src/lib/haptics.ts` (`hapticImpactLight`, `hapticImpactMedium`) — `@capacitor/haptics` is already installed (`package.json:21`) with a no-op web fallback. **Do NOT** use `navigator.vibrate` directly.
4. **EXTRACT** `<ConfirmDialog>` reusable component now. Three known consumers in Phase 49 alone (Merge, Delete, and the existing Reorganize-confirm at `GraphScreen.tsx:518-535` which should migrate). API surface: `{ open, title, body, confirmLabel, cancelLabel, destructive?, onConfirm, onCancel, children? }`. The `children?` slot accepts the side-by-side card preview for Merge.
5. **DEFER** branch rename to v1.7+ (Phase 49 leaves branch long-press as no-op or surfaces "Rename — coming soon" toast). Rationale: branches are derived labels stored on every child Question via `branchLabel`, not Question records — a true branch rename is a batch `patchQuestion` across N records that the Phase 48 service does NOT expose. Building it now requires either a new `graphCommandService.renameBranch()` method (out of locked Phase 48 surface) or N parallel rename calls (no atomic undo). Researcher locks DEFER.
6. **DISABLE** QA-leaf drag in Phase 49 — Phase 48 D-13 makes detach a re-classify, not a manual parent-pick. Exposing a drag gesture that "snaps to anchor X" while the service decides the actual placement creates a UI/service contract mismatch. QA-leaf gets MENU-ONLY Detach. Long-press on QA leaf still opens correction card; drag past 8px on QA leaf is a no-op (cancels gesture, no drag preview).
7. **GHOST-NODE rendering** = absolute-positioned floating `<div>` portaled to `document.body` (the same Portal pattern used by `BottomSheet.tsx:36-40` and the Phase 32.1 sub-screen Header path). NOT a clone of MindElixir's node DOM, NOT a CSS pseudo-element. Rationale: MindElixir uses `<me-tpc>` custom elements with internal styling that does not survive Cloning cleanly; a simple `<div>` with the node's title + computed initial transform from `getBoundingClientRect()` gives pixel-perfect alignment without touching MindElixir's render tree.
8. **ORIGIN-LINE rendering** = full-viewport SVG overlay portaled to `document.body`. Single `<line>` element with `stroke-dasharray="6 4"` for visual subtlety. Origin point updates ONCE at drag-start; ghost point updates per `pointermove`. Off-screen origin is still rendered because SVG `<line>` to off-canvas coords clips at the SVG viewport edge without rendering artifacts. Reuse the same portal mount as the ghost-node.
9. **MAGNETIC SNAP** = 32px radius (validated empirically against MindElixir node sizes at the default 0.5× scale — see R3). Use `getBoundingClientRect()` of every valid drop target at drag-start (snapshot positions; do NOT recompute mid-drag — MindElixir's transform pipeline is expensive). Within radius: ghost transforms to target center with `transition: transform 80ms cubic-bezier(0.32, 0.72, 0, 1)` + halo applies; drop = commit. Beyond radius: ghost tracks finger.
10. **REORG-IN-PROGRESS gate** = consult `isReorgInProgress()` (already imported at `GraphScreen.tsx:13`) at gesture start AND subscribe to `REORG_STARTED` / `REORG_COMPLETED` / `REORG_FAILED` (GraphScreen already does at lines 482-498). New behavior: drag-start blocked; correction card opens with single "Reorganizing — manual corrections paused" row; persistent Undo button disabled.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pointer-gesture differentiation (tap / long-press-release / long-press-drag) | Browser / Client (delegated DOM listener on GraphScreen's MindElixir container) | — | Pure browser-side timer + threshold math; no service round-trip needed |
| Long-press timer (480ms) + movement threshold (8px) | Browser / Client (`useLongPressOrDrag` hook, sibling to `useLongPress`) | — | Reusable hook pattern already established in codebase (`useLongPress.ts`) |
| Ghost-node + origin-line + halo rendering | Browser / Client (portal to `document.body`) | — | Visual-only; no persistence; SVG + absolute-positioned div |
| Magnetic-snap math | Browser / Client (drag-overlay component) | — | Distance check against snapshotted `getBoundingClientRect()` per valid target |
| Correction card display + sub-flow routing | Browser / Client (`<CorrectionCard>` React component) | — | Pure UI state |
| Action matrix gating (per-node-type) | Browser / Client (function of `Question.isAnchorNode` / `isClusterNode` / synthetic ID) | — | Phase 49 reads node type from `selectedNode`; no service call |
| Confirm dialogs (Merge side-by-side, Delete cascade-explanation) | Browser / Client (`<ConfirmDialog>` reusable component) | — | Pure UI; commit only on confirm |
| Command dispatch (rename / move / merge / detach / prune / delete) | Service (`graphCommandService`, Phase 48-locked) | Storage (`questionService.patchQuestion` / `.delete` → localStorage + SQLite fire-and-forget) | All writes route through Phase 48's locked service; UI never touches `patchQuestion` directly for graph mutations |
| Undo dispatch | Service (`graphCommandService.undo()`, Phase 48-locked) | Storage (`trellis_graph_edit_log`) | UI calls `undo()`; service inverts the newest journal entry |
| Toast feedback (success / info / undo-with-action) | Browser / Client (extended `toast()` helper + `<ToastContainer>`) | — | Existing surface; minimal API extension |
| Snackbar-with-Undo (soft prune only) | Browser / Client (same extended `toast()` with action parameter) | Service (`graphCommandService.undo()` on [Undo] tap) | Reuses single toast pipeline; no new component |
| Reload survival (GRAPHUI-03) | Service (`questionService` localStorage primary, SQLite cold backup — pre-existing) | Browser / Client (GraphScreen's `GRAPH_UPDATED` subscriber at line 496-498 — pre-existing) | NO new plumbing; Phase 49 only verifies via regression test |
| Reorg-in-progress gate | Service (`isReorgInProgress()`, pre-existing in canonical-knowledge.service) | Browser / Client (GraphScreen's `REORG_STARTED` / `REORG_COMPLETED` / `REORG_FAILED` subscribers — pre-existing) | Reuse existing flag + events |
| i18n strings | Browser / Client (`graph.correction.*` namespace in all 4 locale bundles) | — | EN-first, Sonnet subagent for zh/es/ja, `bundle-parity.test.mjs` enforces |

---

## Files Inventory

### Existing files Phase 49 modifies

| Path | Lines | Phase 49 change |
|------|------:|-----------------|
| `app/src/screens/GraphScreen.tsx` | 651 | Add `correctionNode` state; mount gesture-listener overlay + correction-card + drag-overlay + persistent Undo button; wire `graphCommandService` calls; migrate inline `showReorgConfirm` to new `<ConfirmDialog>` |
| `app/src/lib/toast.ts` | 9 | Extend `toast(message, type)` to `toast(message, type, options?)` where `options?: { action?: { label: string; onAction: () => void } }`. Existing call sites compile unchanged (third param optional). |
| `app/src/components/ui/Toast.tsx` | 89 | Extend `ToastMessage` interface with `action?: { label, onAction }`; render trailing action button when present; longer dismiss window (~5000ms) when action is set |
| `app/src/locales/en.json` | 766 (line count) | Add `graph.correction.*` subtree (~40 keys per CONTEXT D-17) |
| `app/src/locales/zh.json`, `es.json`, `ja.json` | various | Mirror `graph.correction.*` translations (Sonnet subagent) |

### New files Phase 49 creates

| Path | Purpose |
|------|---------|
| `app/src/hooks/useLongPressOrDrag.ts` | Sibling to `useLongPress.ts` — adds 8px drag-start threshold detection; emits `onLongPressRelease`, `onDragStart(initialX, initialY)`, `onDragMove(x, y)`, `onDragEnd(x, y)`; preserves the 480ms timing convention |
| `app/src/components/graph/CorrectionCard.tsx` | iOS-style vertical action-list surface. Per-node-type action gating. Sub-flow content swap (e.g., Rename inline text input). |
| `app/src/components/graph/DragOverlay.tsx` | Portal to `document.body`. Renders ghost node + SVG origin line + per-target halo. Owns magnetic-snap math + valid-drop-target snapshot. |
| `app/src/components/ui/ConfirmDialog.tsx` | Reusable confirm modal. Replaces `GraphScreen.tsx:518-535` inline pattern; consumed by Phase 49 Merge + Delete; carries optional `children` slot for side-by-side card preview. |
| `app/src/components/graph/MergeConfirmPreview.tsx` | Side-by-side loser/survivor card preview. Rendered as `children` of `<ConfirmDialog>` from the Merge flow. |
| `app/src/components/graph/UndoButton.tsx` | 36px circular persistent button at viewport corner. Subscribes to `GRAPH_UPDATED` to recompute enabled/disabled state. |
| `app/src/components/graph/PickModeBanner.tsx` | Header banner replacement for menu+tap second-node pick mode (D-06): "Tap a cluster to move 'X' into it" + Cancel button. Coexists with existing Header per CLAUDE.md "Header positioning" rule (renders BELOW Header, not replacing it). |
| `app/tests/components/graph/CorrectionCard.test.mjs` | Source-reading invariants: per-node-type matrix; sub-flow routing |
| `app/tests/components/graph/DragOverlay.test.mjs` | Source-reading + behavioral: ghost portal mount, magnetic-snap distance, origin-line render |
| `app/tests/components/graph/ConfirmDialog.test.mjs` | Source-reading: open/closed render, confirm/cancel handler wiring, destructive vs primary CTA |
| `app/tests/components/graph/UndoButton.test.mjs` | Behavioral: enabled/disabled from journal state + `GRAPH_UPDATED` subscription |
| `app/tests/hooks/useLongPressOrDrag.test.mjs` | Behavioral: 480ms timer fires; 8px drag-start threshold transitions state; click-after-long-press suppression |
| `app/tests/screens/GraphScreen.correction-card.test.mjs` | Source-reading: long-press wires to `correctionNode`; gesture handlers attached to MindElixir container; `isReorgInProgress()` gate respected |
| `app/tests/screens/GraphScreen.reload-survival.test.mjs` | Behavioral: commit → simulate reload → assert mutation persisted (GRAPHUI-03) |
| `app/tests/components/Toast.action.test.mjs` | Behavioral: extended `toast(msg, type, { action })` renders trailing action button; clicking invokes `onAction` |
| `app/tests/locales/graph-correction-parity.test.mjs` | Optional sibling to `bundle-parity.test.mjs` — assertions on the specific 40 keys; OR fold into the existing bundle-parity test (researcher: fold in, no new file) |

**Net new files:** 7 production files (1 hook + 6 components), 8 test files.

---

## Standard Stack

### Core (already installed — Phase 49 reuses, no new dependencies)

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| `mind-elixir` | 5.9.3 | Graph canvas renderer | Already loaded; Phase 49 wraps it, never invents a new renderer | `package.json:30` `[VERIFIED: package.json + node_modules/mind-elixir/dist/types/index.d.ts]` |
| `@capacitor/haptics` | 8.0.1 | Native haptic feedback (with web no-op) | Already installed; thin wrapper at `app/src/lib/haptics.ts` | `package.json:21` `[VERIFIED: file:line]` |
| `react` | 19.2.6 | Component framework | Project standard | `package.json:32` |
| `lucide-react` | 0.575.0 | Iconography (Undo2, RotateCcw, X, ChevronRight, Edit2, Move, Combine, Scissors, Archive, Trash2) | Already used throughout `GraphScreen.tsx`, `DetailMenu.tsx` | `package.json:29` |
| `react-i18next` | 17.0.7 | i18n hook (`useTranslation`) | Used in every screen including GraphScreen.tsx:3 | `package.json:35` |
| `react-router-dom` | 7.15.0 | `useNavigate` for sub-screen jumps | Already imported in GraphScreen.tsx:2 | `package.json:36` |
| `node:test` (built-in) | Node 20+ | Test framework | Project's test infrastructure (`package.json` scripts) | `[VERIFIED: app/package.json scripts]` |

### Existing in-house helpers Phase 49 reuses (NOT new dependencies)

| Module | Path | Why reuse |
|--------|------|-----------|
| `useLongPress` | `app/src/hooks/useLongPress.ts` | 480ms timer, pointer-event policy, click-after-long-press suppression via `didLongPress` ref — the codebase-wide convention. Phase 49's `useLongPressOrDrag` is a SIBLING (does not modify `useLongPress`). |
| `hapticImpactLight` / `hapticImpactMedium` | `app/src/lib/haptics.ts` | Capacitor native + web no-op fallback already wired |
| `toast()` | `app/src/lib/toast.ts` | Single notification channel; Phase 49 extends signature with optional `action` |
| `<BottomSheet>` | `app/src/components/ui/BottomSheet.tsx` | NOT REUSED for correction card — correction card is an inline floating surface, not a bottom sheet (D-02 says "overlay the map without blocking pan/scroll" — bottom-sheet's backdrop blocks underlying interaction). Mentioned only as a counter-example. |
| `eventBus.subscribe('GRAPH_UPDATED', ...)` | `app/src/lib/event-bus.ts` | Already used at GraphScreen.tsx:496-498; UndoButton subscribes for enabled-state recompute |
| `isReorgInProgress()` | `app/src/services/canonical-knowledge.service.ts:1417` | Reorg-in-progress gate (D-16) |
| `graphCommandService` | `app/src/services/graph-command.service.ts` (Phase 48) | All writes route through here |
| CSS variables (`--primary-40`, `--surface`, `--surface-variant`, `--border`, `--shadow-1`, `--shadow-2`, `--shadow-3`, `--danger`, `--muted-foreground`, `--radius-xl`, `--node-peach`) | `app/src/index.css` | Project style convention. Halo colors map: Move = `--primary-40` (teal), Merge = `--node-peach` (orange). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| `useLongPressOrDrag` (NEW) | Extend `useLongPress` with drag callbacks | Smaller surface, but risks destabilizing existing consumers (MasonryFeed tiles, ChatMessage) | NEW sibling hook — fenced blast radius |
| Portal-to-body ghost node | Clone MindElixir `<me-tpc>` and absolute-position it | Cloning custom elements is risk; MindElixir's internal styling tied to position | Portal-to-body simple `<div>` with computed transform |
| SVG `<line>` for origin line | DOM div with computed rotation + length | DOM-rotate math is fragile; SVG line is one element + 4 attrs | SVG `<line>` |
| Extracted `<ConfirmDialog>` | Inline modal per Phase 49 site | 3+ consumers (Merge, Delete, existing Reorganize) makes extraction cheaper | Extract |
| `toast()` extended with action | New `<SnackbarWithAction>` component | Two components for one notification surface drifts (Phase 32.1 lesson "One signal per semantic event") | Extend existing |

### Installation

**No `npm install` required.** Phase 49 uses only already-installed packages. Verify by:

```bash
cd /Users/Code/EchoLearn/app && npm ls @capacitor/haptics mind-elixir lucide-react
```

**Version verification:**

```bash
node -p "require('./app/package.json').dependencies['@capacitor/haptics']"  # ^8.0.1
node -p "require('./app/package.json').dependencies['mind-elixir']"          # ^5.9.3
node -p "require('./app/package.json').dependencies['lucide-react']"         # ^0.575.0
```

All packages `[VERIFIED: package.json]`.

---

## Package Legitimacy Audit

Phase 49 installs **ZERO new packages**. All capabilities provided by already-installed dependencies (`mind-elixir`, `@capacitor/haptics`, `lucide-react`, `react-i18next`, etc.) — these were audited in their installation phase. No slopcheck pass needed.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No installs — phase reuses already-resident deps |

---

## R1. MindElixir gesture interception — how do we add long-press + drag without breaking the library?

### What MindElixir exposes (and doesn't)

Researched the type definitions at `app/node_modules/mind-elixir/dist/types/` + the bundled `dist/MindElixir.js`:

**Bus events exposed (`utils/pubsub.d.ts:55-70`):**
```ts
type EventMap = {
  operation: (info: Operation) => void;
  selectNewNode: (nodeObj: NodeObj) => void;
  selectNodes: (nodeObj: NodeObj[]) => void;
  unselectNodes: (nodeObj: NodeObj[]) => void;
  expandNode: (nodeObj: NodeObj) => void;
  changeDirection: (direction: number) => void;
  linkDiv: () => void;
  scale: (scale: number) => void;
  move: (data: { dx: number; dy: number }) => void;
  updateArrowDelta: (arrow: Arrow) => void;
  showContextMenu: (e: MouseEvent) => void;
};
```

**No long-press event.** `showContextMenu` is fired on right-click in browser, not on long-press on touch (`MindElixir.js:1091` — only fires when `dragMoveHelper.moved === false` AND the context-menu handler runs).

**Drag handlers gated by `editable`:**
- `MindElixir.js:157` — when `editable: false`, drag handlers are removed (`e.draggable = !1`).
- GraphScreen sets `editable: false` (line 261 implicit — default is `true`, but Trellis overrides at `GraphScreen.tsx:256-265`):
  ```ts
  const mei = new MindElixir({
    el: containerRef.current,
    direction: MindElixir.RIGHT,
    editable: false,       // ← Phase 49 inherits this
    draggable: true,       // (deprecated alias, no effect)
    contextMenu: false,
    toolBar: false,
    keypress: false,
    theme: buildTheme(),
  });
  ```
- This means **MindElixir's own drag-to-reparent path is INACTIVE in Trellis**. The library still binds `pointerdown` on the map container for pan/zoom (`MindElixir.js:1097, 1101`), but those are pan/zoom, not node drag.

**Tap path:**
- MindElixir does NOT fire a bus event for regular node clicks (`GraphScreen.tsx:292-302` comment confirms this). Instead each `<me-tpc>` custom element carries a `.nodeObj` property; GraphScreen captures clicks at the container level and walks up:
  ```ts
  const handleClick = (e: MouseEvent) => {
    const tpc = (e.target as HTMLElement).closest('me-tpc') as (HTMLElement & { nodeObj?: NodeObj }) | null;
    if (!tpc?.nodeObj) return;
    const id = tpc.nodeObj.id;
    if (!id || id.startsWith('cat-') || id === 'root-knowledge') return;
    const q = nodeMapRef.current[id];
    if (q) onNodeClickRef.current(q);
  };
  containerRef.current.addEventListener('click', handleClick);
  ```

### Phase 49 strategy: delegated `pointerdown` listener on the same container

The existing pattern at `GraphScreen.tsx:294-340` PROVES delegated listeners on the wrapping container coexist with MindElixir's pan/zoom. Phase 49 adds a SECOND delegated listener for `pointerdown` on the same container with this behavior:

1. **`pointerdown`** — walk up via `closest('me-tpc')` to find the node DOM. If found:
   - Snapshot `nodeObj.id`, `pointer.clientX/Y`, `Date.now()`.
   - Start 480ms timer + register `pointermove` / `pointerup` / `pointercancel` listeners.
   - **Do NOT call `e.stopPropagation()`** — let MindElixir's pan/zoom still receive the pointer; we only commit to gesture interception when the long-press timer fires OR drag threshold crossed.
2. **`pointermove` before 480ms** — if movement > 8px, CANCEL long-press (this was a pan gesture, not a long-press). Clear timer. Restore neutral state.
3. **`pointermove` after 480ms (long-press recognized)** — first move past 8px = enter drag mode. Fire `hapticImpactLight()` once at long-press recognition. Mount ghost-node + origin-line + halo overlay. Capture pointer with `setPointerCapture(pointerId)` so MindElixir's pan/zoom stops fighting.
4. **`pointerup`** —
   - If we never crossed 480ms: ordinary click — let MindElixir's existing click handler at line 302 fire normally. Nothing to do here.
   - If long-press recognized + drag started: snap to nearest valid target if within 32px; else snap-back ghost. Commit Move/Merge per drop target rules.
   - If long-press recognized + NO drag (release in place): open correction card for the captured node.
5. **`pointercancel`** — clean up overlay + restore state.

This delegated listener attaches AFTER MindElixir's `init()` completes (inside the same `useEffect` at line 229-354) and cleans up in the same return function.

**Key invariant:** The new listener wraps `pointerdown` AND the existing `click` handler still fires normally for taps. Click-after-long-press is suppressed via the `didLongPress` ref pattern from `useLongPress.ts:43-44` (after a long-press fires, the synthetic click is captured + stopped via `onClickCapture`).

**`touchAction: 'none'`** at `GraphScreen.tsx:412` is already set — this disables browser-native gestures (text selection, double-tap-zoom). Keep it.

**`data-no-swipe-nav="true"`** at `GraphScreen.tsx:408` already opts out of `SwipeTabContainer`'s horizontal tab swipe. Long-press + drag won't fight the tab strip. Keep it.

### Verified via

- `app/node_modules/mind-elixir/dist/types/utils/pubsub.d.ts:55-70` — no long-press event in `EventMap` `[VERIFIED: file]`.
- `app/node_modules/mind-elixir/dist/MindElixir.js:157, 1097, 1101` — drag handlers gated on `editable`; pan uses `pointerdown` on container `[VERIFIED: bundled source]`.
- `app/src/screens/GraphScreen.tsx:294-340` — existing delegated listener pattern works `[VERIFIED: file:line]`.

(RESOLVED)

---

## R2. Long-press + drag-start thresholds

### Investigation

**Codebase-wide long-press convention** is **480ms**, NOT 400ms (CONTEXT.md was a placeholder suggestion):

- `app/src/hooks/useLongPress.ts:22` — `export function useLongPress(ms: number, ...)` callers pass 480
- `app/src/components/MasonryFeed.tsx:354` — `useLongPress(480, ...)`
- `app/src/hooks/useLongPress.ts:21` — comment: "480ms long-press hook — codebase-wide convention (see CLAUDE.md 'Best practices', RESEARCH.md Section 1, original pattern at ChatMessage.tsx:119-140)."

iOS native long-press is ~500ms; Android is ~600ms. 480ms slightly tighter than iOS is acceptable AND matches the codebase. **Lock at 480ms** for Phase 49 consistency.

**Drag-start threshold:** the `useLongPress` hook currently cancels on ANY `pointermove` (`useLongPress.ts:57`). That works for static-tile long-press but kills the long-press-then-drag flow Phase 49 needs. The new `useLongPressOrDrag` hook needs a different policy:

- Before 480ms: cancel on movement > 8px (the user was panning, not long-pressing). Match existing `useLongPress` cancellation semantics.
- After 480ms: first movement past 8px = enter drag mode (do not cancel).

**8px** is the de facto iOS HIG drag-start threshold (Apple's UIPanGestureRecognizer default is 10pt × 1.5 DPR ≈ 15px on web; many web libraries use 5-10px). Consistent with the **10px TAP_THRESHOLD** already in use at `GraphScreen.tsx:315` for the me-epd touch handler:

```ts
const TAP_THRESHOLD = 10; // px — allow small finger wobble
```

**Decision:** drag-start threshold = **8px** (slightly tighter than the tap-threshold so a clear "I'm dragging" intent does not need much movement after a long-press).

### Verified via

- `app/src/hooks/useLongPress.ts:22, 57` `[VERIFIED: file:line]`
- `app/src/components/MasonryFeed.tsx:354` `[VERIFIED: file:line]`
- `app/src/screens/GraphScreen.tsx:315` `[VERIFIED: file:line]`
- iOS HIG ~500ms long-press convention `[CITED: training knowledge — Apple HIG]` `[ASSUMED]`

**Final values:**
- Long-press timer: **480ms**
- Drag-start threshold: **8px** (Euclidean distance from `pointerdown` coord)
- Cancellation BEFORE 480ms: movement > 8px cancels long-press (was a pan/scroll)
- Drag-start AFTER 480ms: movement > 8px enters drag mode (not cancellation)

(RESOLVED)

---

## R3. Magnetic snap radius

### Investigation

Default GraphScreen scales MindElixir to **0.5×** on init (`GraphScreen.tsx:282`):
```ts
mei.scale(0.5);
```

At 0.5×, a typical anchor node `<me-tpc>` is approximately 80-120px wide × 36px tall (depends on title length). At 0.5× scale, target centers are roughly 60-80px apart visually.

**Snap radius candidates:**
- **24px** — too tight, user must hit very close to the target center; misses common at finger-width imprecision
- **32px** — Apple's HIG recommends 44pt minimum touch target; 32px from center = 64px target diameter, slightly under 44pt but acceptable for "magnetic snap" (the user's finger does not need to land in the radius — the ghost-node center does)
- **48px** — too loose at 0.5× scale; would cause unintended snaps between adjacent anchors that share a cluster (anchor-to-anchor distance can be < 100px)

**Decision: 32px** (Euclidean distance from ghost-node center to target-node center).

A user-zoomable formula (e.g., `radius = 32 * (1 / scale)`) is OUT OF SCOPE for Phase 49 — MindElixir's `scale` getter is exposed (`instanceRef.current.scaleVal` per types/index.d.ts:84) but adding zoom-aware snap math is gold-plating. Lock at 32px fixed.

### Verified via

- `app/src/screens/GraphScreen.tsx:282` (0.5× initial scale) `[VERIFIED: file:line]`
- `app/node_modules/mind-elixir/dist/types/types/index.d.ts:84` (scaleVal exposed) `[VERIFIED: file:line]`
- iOS HIG 44pt minimum touch target `[CITED: Apple HIG]` `[ASSUMED]`

**Final value:** **32px** Euclidean distance from ghost-node center to valid drop target's `getBoundingClientRect()` center.

(RESOLVED)

---

## R4. Haptics: `navigator.vibrate` vs `@capacitor/haptics`?

### Investigation

```bash
grep -rn "@capacitor/haptics\|navigator.vibrate" app/src
```
returns:
```
app/src/lib/haptics.ts:4 — Thin wrapper around @capacitor/haptics.
app/src/lib/haptics.ts:8 — let Haptics: typeof import('@capacitor/haptics').Haptics | null = null;
app/src/lib/haptics.ts:9 — let ImpactStyle: ...
app/src/lib/haptics.ts:12 — void import('@capacitor/haptics').then((mod) => {
```

**Zero usages of `navigator.vibrate`.** `@capacitor/haptics` 8.0.1 is installed (`package.json:21`) and wrapped at `app/src/lib/haptics.ts`. The wrapper:

```ts
import { Capacitor } from '@capacitor/core';

let Haptics: typeof import('@capacitor/haptics').Haptics | null = null;
let ImpactStyle: typeof import('@capacitor/haptics').ImpactStyle | undefined;

if (Capacitor.isNativePlatform()) {
  void import('@capacitor/haptics').then((mod) => {
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
  });
}

export async function hapticImpactLight(): Promise<void> {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}

export async function hapticImpactMedium(): Promise<void> {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
}
```

**Web fallback** is a graceful no-op — the wrapper only loads the Capacitor module on native platforms (`Capacitor.isNativePlatform()`). On web Phase 49 has no haptics, which is acceptable (web users won't expect tactile feedback).

**Decision:** Phase 49 uses `hapticImpactLight()` for long-press recognition and `hapticImpactMedium()` for drop-onto-valid-target. NO `navigator.vibrate` calls. Don't add new haptic patterns (CONTEXT defers per-action variants to a refinement phase).

### Verified via

- `app/src/lib/haptics.ts:1-28` `[VERIFIED: file]`
- `app/package.json:21` `"@capacitor/haptics": "^8.0.1"` `[VERIFIED: file:line]`

(RESOLVED)

---

## R5. Ghost-node rendering approach

### Three options evaluated

**Option A: Clone MindElixir node DOM (`<me-tpc>` custom element)**

Pros: pixel-perfect visual match.
Cons: `<me-tpc>` is a Custom Element with internal lifecycle + `.nodeObj` property attachment + library-specific styling that's coupled to its parent SVG line positioning. Cloning via `cloneNode(true)` strips the JS property (`.nodeObj`), and the visual styling depends on inherited CSS variables that may not resolve identically when re-parented to a portal. Risk of subtle visual drift between source and ghost.

**Option B: Absolute-positioned `<div>` with the node's title + transform (NEW component)**

Pros: simple, predictable, no library coupling, works under portal. Same approach as `BottomSheet.tsx:36-40` uses for its portal (created at `Toast.tsx:48-87` for the toast container).
Cons: visual match is "good enough" not "pixel-perfect" — the ghost is a plain rounded-rect with the node's title, semi-transparent. Acceptable per CONTEXT D-05 ("semi-transparent copy" — close approximation is enough).

**Option C: CSS pseudo-element (`::before` / `::after`)**

Pros: no JS state needed.
Cons: pseudo-elements cannot escape their parent's positioning context, so during drag the ghost would be clipped by `overflow: hidden` of `MasterMap`'s wrapper at `GraphScreen.tsx:396-405`. Reject.

### Decision: Option B

```ts
// Concept (NOT FINAL CODE — Phase 49 implementation)
function DragOverlay({ ghostNode, originRect, targetRect, ghostPos }: Props) {
  return createPortal(
    <>
      {/* Origin line — SVG */}
      <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>
        <line
          x1={originRect.x + originRect.width / 2}
          y1={originRect.y + originRect.height / 2}
          x2={ghostPos.x}
          y2={ghostPos.y}
          stroke="var(--primary-40)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      </svg>
      {/* Ghost node — div */}
      <div
        style={{
          position: 'fixed',
          left: ghostPos.x - ghostRect.width / 2,
          top: ghostPos.y - ghostRect.height / 2,
          width: ghostRect.width,
          height: ghostRect.height,
          opacity: 0.65,
          pointerEvents: 'none',
          zIndex: 9001,
          padding: '10px 18px',
          borderRadius: '18px',
          background: 'var(--surface)',
          border: '1.5px solid var(--panel-border-color)',
          boxShadow: 'var(--shadow-2)',
          transition: 'left 80ms, top 80ms',  // smooths magnetic snap
        }}
      >
        {ghostNode.topic}
      </div>
    </>,
    document.body,
  );
}
```

The portal target is `document.body` — same as `BottomSheet.tsx:36-40` and the Phase 32.1 sub-screen Header. This is the established portal pattern.

The ghost's initial `width`/`height` come from snapshotting the source `<me-tpc>`'s `getBoundingClientRect()` at drag-start. After that, only `left`/`top` change per `pointermove`.

### Verified via

- `app/src/components/ui/BottomSheet.tsx:36-40` portal pattern `[VERIFIED: file:line]`
- `app/src/components/ui/Toast.tsx` portal-equivalent style `[VERIFIED: file]`

(RESOLVED)

---

## R6. Origin-line preview rendering

**SVG overlay** — full-viewport `<svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>` with a single `<line>` element. The browser handles clipping outside the viewport gracefully (off-canvas endpoints are computed but not drawn beyond the visible region). Inside the same portal mount as the ghost node (`document.body`).

**Why not Canvas?** Canvas needs a per-frame redraw loop and a separate transform tracking. SVG `<line>` updates via attribute set is cheap and integrates with React state.

**Why not DOM line (rotated div)?** Rotated-div math (compute angle + length from endpoint coords, apply `transform: rotate(${angle}deg) translateX(${length}px)`) is error-prone vs. `<line x1 y1 x2 y2>`.

**Stroke style:** `strokeDasharray="6 4"` for visual subtlety (matches iOS rubber-band drag affordances). Color = `--primary-40` (teal, neutral relocation hint — not destructive, not warning).

(RESOLVED)

---

## R7. Snackbar-with-action component — extend `toast()` or add new component?

### Existing surface

`app/src/lib/toast.ts` (9 lines):
```ts
let globalAddToast: ((msg: { message: string; type: 'success' | 'error' | 'info' }) => void) | null = null;

export function setToastHandler(handler: typeof globalAddToast) {
  globalAddToast = handler;
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  globalAddToast?.({ message, type });
}
```

`app/src/components/ui/Toast.tsx:1-89` renders the `<ToastContainer>` which:
- Holds a `ToastMessage[]` state
- Auto-dismisses after 3s
- Has a 2s rapid-duplicate suppressor (`recentRef`)

### Decision: extend `toast()` with optional `action` parameter

API extension (single-arg-added, backward-compatible):
```ts
export function toast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  options?: { action?: { label: string; onAction: () => void } },
): void;
```

`Toast.tsx` ToastMessage interface gets an optional `action?: { label, onAction }` field. When present:
- Render a trailing inline button after the message
- Auto-dismiss extended to **5000ms** (vs 3000ms default) to give the user time to tap
- When the action button is tapped: invoke `onAction()` then dismiss the toast immediately

Why **extend, not new component:**
- CLAUDE.md "Phase 32.1 lessons" #6: "One signal per semantic event. Two events for one signal let subscribers drift" — applies to UI components too: one notification channel.
- Existing `toast()` call sites compile unchanged (third param optional).
- Sole new call site is Phase 49's soft-prune handler — adding a parallel `<SnackbarWithAction>` for one consumer is over-engineering.
- The 2s duplicate suppressor at `Toast.tsx:25-28` continues to work since the key includes both type + message.

### Side effect: existing Reorganize-confirm-modal pattern

The existing inline confirm modal at `GraphScreen.tsx:518-535` is one-off. Phase 49 introduces 2 more confirm modals (Merge + Delete). R8 recommends extracting `<ConfirmDialog>` and migrating the Reorganize modal to it.

### Verified via

- `app/src/lib/toast.ts:1-9` `[VERIFIED: file]`
- `app/src/components/ui/Toast.tsx:1-89` `[VERIFIED: file]`

(RESOLVED)

---

## R8. ConfirmDialog extraction

### Decision: EXTRACT now

Three known consumers in Phase 49 + 1 existing:
1. **Merge confirm** (D-07 — side-by-side card preview)
2. **Delete confirm** (D-09 — cascade explanation, destructive CTA)
3. **Reorganize confirm** (existing at `GraphScreen.tsx:518-535` — migrates onto new component)
4. Plausible future reuse: bulk delete, account-delete, etc.

API surface:

```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;                       // optional — for Merge, children replaces body
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;               // when true, confirm button uses --danger
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;          // optional slot — for Merge side-by-side preview
}
```

Visual treatment matches the existing inline modal (consistency):
- Backdrop: `position: fixed, inset: 0, zIndex: 300, backgroundColor: rgba(0,0,0,0.5)`
- Body: `backgroundColor: var(--surface), borderRadius: var(--radius-xl), padding: 24px, maxWidth: 340px, boxShadow: var(--shadow-3)`
- Cancel: rounded outline button, transparent background
- Confirm: rounded filled button, `var(--primary-40)` or `var(--danger)` per `destructive` prop

### Verified via

- `app/src/screens/GraphScreen.tsx:518-535` — existing inline pattern to migrate `[VERIFIED: file:line]`

(RESOLVED)

---

## R9. Branch rename feasibility — ship in Phase 49 or defer?

### Investigation

Branches are NOT records. From `GraphScreen.tsx:46-77`:

```ts
const reflection = buildAnchorReflectionTree(nodes);

const children: NodeObj[] = [];
for (const root of reflection) {
  const branchNodes: NodeObj[] = root.branches.map((branch) => ({
    id: `branch-${root.rootLabel}-${branch.branchLabel}`,   // ← synthetic ID
    topic: branch.branchLabel,
    expanded: true,
    children: branch.clusters.map((cluster) => ({
      id: cluster.clusterEntity?.id ?? `cluster-${root.rootLabel}-${branch.branchLabel}-${cluster.clusterLabel}`,
      // ...
    })),
  }));
}
```

Branch IDs are synthetic strings like `branch-Knowledge-Math`. They are NOT Question records. A branch is a label that lives on every child Question via `branchLabel`.

**To rename a branch from "Math" to "Mathematics":**
- Find every Question where `branchLabel === 'Math'` (could be N records)
- `patchQuestion` each one with `branchLabel: 'Mathematics'`
- The journal would need a new `branch-rename` cmd (NOT in Phase 48's locked `cmd` union)

**Phase 48's locked service signature** (`graph-command.service.ts:74`):

```ts
rename(id: string, newTitle: string, opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>>
```

`id` is a Question record ID. Synthetic IDs like `branch-Knowledge-Math` don't exist in `questionService.getAll()`. Calling `graphCommandService.rename('branch-Knowledge-Math', 'Mathematics')` returns `{ success: false, error: { code: 'NOT_FOUND' } }` per the implementation at `graph-command.service.ts:88-92`.

### Decision: DEFER branch rename to v1.7+

Phase 49 leaves branch long-press as a non-actionable surface. Two options for the long-press behavior:

**Option A: silent no-op** (do nothing on branch long-press; drag is also blocked)

**Option B: surface a "Rename — coming soon" toast** (educates user that branches aren't editable yet)

**Recommendation: Option B** for discoverability. Add an i18n key `graph.correction.toast.branchNotEditable = "Branches will be editable in a future update."` Tap on a branch long-press = this toast. Drag from branch = blocked.

The Phase 49 per-node-type action matrix (D-15) updates to:

| Node type | Action menu |
|-----------|-------------|
| Root | (Toast "Root not editable") |
| Branch | (Toast "Branches will be editable in a future update") |
| Cluster | Rename, Move (→ branch), Merge with cluster, Delete |
| Anchor | Rename, Move (→ cluster), Merge with anchor, Prune, Delete |
| QA leaf | Detach, Delete |

This keeps the locked Phase 48 service surface unchanged AND signals to the user that branches aren't completely forgotten.

### Verified via

- `app/src/screens/GraphScreen.tsx:46-77` (branch ID synthesis) `[VERIFIED: file:line]`
- `app/src/services/graph-command.service.ts:88-92` (rename uses Question.id lookup) `[VERIFIED: file:line]`
- `app/src/types/index.ts:767-774` (GraphEditLogEntry cmd union — six verbs, no branch-rename) `[VERIFIED: file:line]`

(RESOLVED — DEFER)

---

## R10. QA-leaf drag-to-anchor — ship or disable?

### Investigation

Phase 48 D-13 + 48-RESEARCH.md R7 lock detach as **re-classify**:

> `detach(qaId)` clears placement fields AND fires `classifyAndAnchorIncremental(question, allQuestions, llmConfig, signal)` fire-and-forget per D-13 + R7. **Do NOT await.**

The service intentionally does NOT take a target anchor ID — the user's intent for "detach this misplaced Q&A" is "find it a better home," not "manually pick the new parent." The new parent is whichever anchor the classifier chooses (may even be the same anchor — D-12 toast distinguishes this).

A drag gesture that lets the user drop a QA leaf onto a specific anchor would imply the service uses that anchor as the new parent. **It doesn't.** A user dragging QA "What is photosynthesis?" onto anchor "Botany" but the classifier choosing "Plant Biology" would be confusing (the visual gesture says one thing, the service does another).

### Decision: DISABLE QA-leaf drag in Phase 49

- Long-press on a QA leaf still opens the correction card (showing Detach + Delete per D-15)
- Drag past 8px after long-press on a QA leaf = no-op (cancel gesture, no ghost mount, no overlay)
- The action matrix is the canonical QA-relocation surface

The CONTEXT D-04 already suggested this as the safer default ("safer default is 'QA drags are not enabled in Phase 49'"). Researcher locks this.

The future "manual parent-pick" capability is a different feature surface (would need a new `graphCommandService.moveQa(qaId, newAnchorId)` method bypassing classifier) — deferred to a possible v1.7+ phase if operator UAT surfaces the need.

### Verified via

- `.planning/phases/48-graph-command-service-and-trust-invariants/48-CONTEXT.md` D-13 `[VERIFIED: file]`
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-RESEARCH.md` R7 `[VERIFIED: file]`

(RESOLVED — DISABLE QA-leaf drag)

---

## R11. Empty-journal Undo button behavior

### Decision: surface "Nothing to undo" toast (Option B from CONTEXT D-13)

Silent no-op (Option A) is invisible; the user wonders if the tap registered. The codebase already uses `toast()` for empty-state feedback (e.g., `HomeScreen.no-more-posts-toast.test.mjs` proves the pattern).

Implementation: when the journal is empty, the button is grayed (`opacity: 0.4, cursor: not-allowed`) AND tapping STILL fires a toast (`graph.correction.toast.nothingToUndo = "Nothing to undo"`). The grayed state is informational; the tap-feedback toast is explicit.

The button subscribes to `GRAPH_UPDATED` and recomputes `isEnabled = graphEditJournal.list().length > 0` on every emit (Phase 48 service emits `GRAPH_UPDATED` on every successful command, so this is automatic).

### Verified via

- `app/src/services/graph-edit-journal.service.ts:126-128` (`list()` returns array of entries) `[VERIFIED: file:line]`
- Existing pattern: `tests/screens/HomeScreen.no-more-posts-toast.test.mjs` `[VERIFIED: file]`

(RESOLVED — "Nothing to undo" toast on empty journal)

---

## R12. Visual style of correction card vs inspector card

### Investigation

Existing inspector card at `GraphScreen.tsx:570-647`:
- `padding: 16px`
- `borderRadius: 'var(--radius-xl)'`
- `backgroundColor: 'var(--surface-variant)'`
- `border: '1px solid var(--border)'`
- Hover transforms (`transform: scale(1.01)`, `boxShadow: 'var(--shadow-2)'`)
- Brief metadata + chevron-into-detail (tap = navigate to AnchorDetailScreen / ClusterDetailScreen)

Existing iOS-style settings rows at `app/src/screens/settings/SettingsShared.tsx` (referenced via CONTEXT, file inferred):
- Vertical stack of rows
- Each row: leading icon + label + trailing chevron OR value
- Row min-height 56px (matches MasonryFeed LongPressMenu rows)
- Inline styles + CSS variables

### Decision

Correction card visual treatment (different ENOUGH from inspector that user sees "different card, different intent"):

```ts
{
  padding: 0,                                  // ← rows have their own padding
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--surface)',           // ← NOT surface-variant — distinct from inspector
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-2)',                // ← elevated above map; inspector has none
  overflow: 'hidden',                          // ← rows clip to rounded corners
  animation: 'fade-in 0.2s ease',
}
```

Each row:
```ts
{
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '56px',
  padding: '0 16px',
  borderTop: '1px solid var(--border)',        // separator between rows; first row has none
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 500,
  color: 'var(--foreground)',
}
```

Card sits BELOW the inspector card in the GraphScreen DOM order (so it overlays the map but appears "below" the inspector if both ever coexist).

Coexistence rule: opening the correction card via long-press DISMISSES the inspector card (`setSelectedNode(null)` happens when `setCorrectionNode(node)` is called). Reverse is also true: tapping a node (`setSelectedNode(node)`) dismisses the correction card. This avoids stacking two surfaces — CONTEXT D-03 says "may coexist" but operator UX is cleaner with one-at-a-time.

(RESOLVED)

---

## R13. Per-node-type action matrix — implementation pattern

Phase 49 implements the matrix as a function `getActionsForNode(node: Question | BranchNode | RootNode): CorrectionAction[]`:

```ts
type CorrectionAction =
  | { kind: 'rename'; }
  | { kind: 'move'; }
  | { kind: 'merge'; }
  | { kind: 'detach'; }
  | { kind: 'prune'; }
  | { kind: 'delete'; };

function getActionsForNode(node: Question, ctx: { isRoot: boolean; isBranch: boolean }): CorrectionAction[] {
  if (ctx.isRoot) return [];          // ← long-press on root opens toast, not card
  if (ctx.isBranch) return [];        // ← per R9 DEFER, long-press on branch opens toast, not card

  if (node.isClusterNode) {
    return [{ kind: 'rename' }, { kind: 'move' }, { kind: 'merge' }, { kind: 'delete' }];
  }
  if (node.isAnchorNode) {
    return [{ kind: 'rename' }, { kind: 'move' }, { kind: 'merge' }, { kind: 'prune' }, { kind: 'delete' }];
  }
  // QA leaf
  return [{ kind: 'detach' }, { kind: 'delete' }];
}
```

Root + Branch identification:
- Root: `node.id === 'root-knowledge'` (literal, set at `GraphScreen.tsx:38`).
- Branch: `node.id.startsWith('branch-')` (synthetic prefix per `GraphScreen.tsx:50`).

Both are NOT in `questionService.getAll()` — they're synthetic NodeObj IDs in MindElixir. The gesture engine recognizes these IDs before consulting the Question store and routes to the appropriate "no-op + toast" path.

(RESOLVED)

---

## R14. Sub-flow content swap — Rename inline input

The correction card's Rename row, when tapped, REPLACES the action-list content with an inline text input + Save/Cancel buttons:

```tsx
{flow === 'list' ? (
  <ActionList actions={actions} onSelect={setFlow} />
) : flow === 'rename' ? (
  <RenameForm
    initialValue={node.title ?? node.content}
    onSave={async (newTitle) => {
      const result = await graphCommandService.rename(node.id, newTitle);
      if (result.success) {
        toast(t('graph.correction.toast.renamed', { title: newTitle }), 'success');
        onClose();
      } else {
        // VALIDATION_ERROR (empty / too-long) handled by inline RenameForm error display
        // NOT_FOUND or STORAGE_ERROR — toast the error
        toast(result.error.message, 'error');
      }
    }}
    onCancel={() => setFlow('list')}
  />
) : null}
```

Phase 48 D-16 validation lives in the service (`graph-command.service.ts:74-99`). The UI only needs to:
- Pre-fill with `node.title ?? node.content`
- Show an inline error string if `result.error.code === 'VALIDATION_ERROR'`
- Auto-focus the input on mount
- Submit on Enter OR Save button tap
- Cancel returns to action list (does NOT close card)

(RESOLVED)

---

## R15. Merge confirm side-by-side preview component

`<MergeConfirmPreview loser={loser} survivor={survivor} reparentedCount={n} />` renders inside `<ConfirmDialog>` as `children`:

```tsx
<ConfirmDialog
  open={mergeConfirm !== null}
  title={t('graph.correction.merge.title')}
  body={undefined}  // ← replaced by children
  confirmLabel={t('graph.correction.merge.confirm')}
  cancelLabel={t('graph.correction.merge.cancel')}
  destructive={false}
  onConfirm={handleConfirmMerge}
  onCancel={() => setMergeConfirm(null)}
>
  <MergeConfirmPreview
    loser={loser}
    survivor={survivor}
    reparentedCount={loserQaChildren.length}
  />
</ConfirmDialog>
```

Visual layout (horizontal flex):

```
┌─────────────────┐   ┌─────────────────┐
│ LOSER (grayed)  │   │ SURVIVOR        │
│ Photosyntheis   │   │ Photosynthesis  │
│ 5 Q&As          │   │ 12 Q&As         │
│ Biology         │   │ Biology         │
│                 │   │                 │
│ ┌─────────────┐ │   │ ┌─────────────┐ │
│ │will be      │ │   │ │will keep    │ │
│ │removed      │ │   │ │             │ │
│ └─────────────┘ │   │ └─────────────┘ │
└─────────────────┘   └─────────────────┘

Merging will move 5 Q&As under "Photosynthesis"
and remove the "Photosyntheis" anchor.

Survivor's title and cluster are preserved.
This can be undone.

[Cancel]                          [Merge]
```

`reparentedCount` is derived in the UI from `questionService.getAll().filter(q => q.parentId === loser.id).length` at confirm-modal-open time (NOT at drag-start; user may have made changes meanwhile).

(RESOLVED)

---

## R16. Delete cascade-explanation modal

`<ConfirmDialog>` for delete:

```tsx
<ConfirmDialog
  open={deleteConfirm !== null}
  title={t('graph.correction.delete.title', { title: node.title })}
  body={
    qaChildCount > 0
      ? t('graph.correction.delete.bodyWithChildren', { count: qaChildCount, parentCluster: parentClusterTitle })
      : t('graph.correction.delete.bodyEmpty')
  }
  confirmLabel={t('graph.correction.delete.confirm')}
  cancelLabel={t('graph.correction.delete.cancel')}
  destructive={true}
  onConfirm={handleConfirmDelete}
  onCancel={() => setDeleteConfirm(null)}
/>
```

`qaChildCount` derived at confirm-modal-open time from `questionService.getAll().filter(q => q.parentId === node.id).length`.

`parentClusterTitle` derived from `questionService.getAll().find(q => q.id === node.parentId)?.title ?? '(no cluster)'` — handles edge case where anchor has no cluster parent.

Empty-anchor body: `t('graph.correction.delete.bodyEmpty')` = "This anchor has no Q&As. Deleting removes it from the map." Hard-coded fallback path in i18n bundles.

(RESOLVED)

---

## R17. Persistent corner Undo button

Mirrors the existing expand/collapse button at `GraphScreen.tsx:417-441`. New position: `right: 56px` (= 12px existing right edge + 36px existing button width + 8px gap).

```tsx
<button
  onClick={handleUndo}
  disabled={!isEnabled || reorganizing}
  aria-label={t('graph.correction.actions.undo')}
  style={{
    position: 'absolute',
    bottom: '12px',
    right: '56px',            // ← immediately LEFT of expand/collapse
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: (isEnabled && !reorganizing) ? 'pointer' : 'not-allowed',
    boxShadow: 'var(--shadow-1)',
    opacity: (isEnabled && !reorganizing) ? 1 : 0.4,
    zIndex: 10,
  }}
>
  <Undo2 size={18} />
</button>
```

Icon: `Undo2` from `lucide-react` (preferred over `RotateCcw` — `Undo2` is more clearly "step back" vs "refresh"). Both are 18px at standard weight; researcher locks `Undo2`.

`handleUndo`:
```ts
const handleUndo = async () => {
  const journalEntries = graphEditJournal.list();
  if (journalEntries.length === 0) {
    toast(t('graph.correction.toast.nothingToUndo'), 'info');
    return;
  }
  const result = await graphCommandService.undo();
  if (result.success) {
    toast(
      t('graph.correction.toast.undone', {
        cmd: t(`graph.correction.actions.${result.data.undoneCmd}`),
        summary: result.data.summary,
      }),
      'info',
    );
  } else {
    toast(result.error.message, 'error');
  }
};
```

`reorganizing` flag — Phase 49 wires the corner button to the same `reorganizing` state at `GraphScreen.tsx:465`. Already a single source of truth subscribing to `REORG_STARTED` / `REORG_COMPLETED` / `REORG_FAILED`. No new plumbing.

(RESOLVED)

---

## R18. Reload survival (GRAPHUI-03) — what does Phase 49 need to verify?

Phase 48 D-17 + `graph-command-service.reload-survival.test.mjs` already prove the SERVICE-LEVEL invariant: after every command, `questionService.getAll()` returns the mutated state.

`GraphScreen.tsx:496-498` already subscribes to `GRAPH_UPDATED` and calls `reload()` → `graphService.getGraph().then(...)` → `setNodes(n)`.

Reload survival is therefore FREE in Phase 49 — no new plumbing.

**The Phase 49 regression test** at `app/tests/screens/GraphScreen.reload-survival.test.mjs` asserts the GraphScreen-level wiring:
1. Mount GraphScreen (or its inner MasterMap component) with mocked services
2. Fire a `graphCommandService.rename()` call
3. Observe `setNodes` invoked with the post-rename store
4. Tear down the screen (simulate navigation away)
5. Re-mount the screen
6. Assert `nodes` state reflects the post-rename store (via mock `questionService.getAll()` returning the same store)

This is source-reading-friendly: a behavioral test that doesn't need a full DOM (most existing GraphScreen tests use source-reading via `readFileSync` per the codebase pattern at `tests/components/LongPressMenu.test.mjs:1-12`).

(RESOLVED)

---

## R19. Pick-mode header banner — coexistence with existing Header

CONTEXT D-06 specifies a header banner replacement during menu+tap second-node pick mode:

> *"Tap a cluster to move 'X' into it"* or *"Tap an anchor to merge 'X' into"*, with a Cancel button.

### Constraint: CLAUDE.md "Header positioning (Phase 32.1)"

GraphScreen is a **top-level swipe-tab slot** — its `Header` renders **in-tree** (NOT portaled). Replacing the Header content mid-render or moving its position breaks the Phase 32.1 contract.

### Decision: render the pick-mode banner as a SEPARATE row BELOW the Header, not as a Header replacement.

Banner mounts INSIDE the GraphScreen content area (above `<MasterMap>`), conditionally:

```tsx
{pickMode && (
  <PickModeBanner
    mode={pickMode.kind}        // 'move' | 'merge'
    sourceTitle={pickMode.sourceNode.title}
    onCancel={() => setPickMode(null)}
  />
)}
```

Visual:
- Inline row with `padding: 12px 16px`, `backgroundColor: 'var(--primary-30-bg)'` (light teal tint), `borderRadius: 'var(--radius-xl)'`, `display: flex, justifyContent: space-between, alignItems: center`
- Left: message text ("Tap a cluster to move 'X' into it")
- Right: Cancel button (text button, `color: var(--primary-40)`)

This:
- Preserves CLAUDE.md Header positioning invariant
- Surfaces the pick-mode state prominently to the user
- Doesn't break MindElixir's render container (MasterMap height/width stay stable)
- Cancellable via the explicit Cancel button OR Cancel key (Escape) — researcher's recommendation: support Escape via `addEventListener('keydown', ...)` for desktop dev (operator's Capacitor target is mobile but desktop is the dev surface)

When `pickMode !== null`:
- A tap on a VALID target (cluster for Move; anchor for Merge) commits the move/merge
- A tap on an INVALID target toasts `graph.correction.pickMode.invalidTarget` ("Not a valid target")
- The existing `setSelectedNode` flow is SUPPRESSED during pickMode (taps don't open inspector card)

(RESOLVED)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Long-press timer + click suppression | Custom `setTimeout` + `e.stopPropagation` in GraphScreen | Reuse `useLongPress` from `app/src/hooks/useLongPress.ts` (or its sibling `useLongPressOrDrag.ts` for drag) | 480ms convention + click-after-long-press suppression already proven on dense surfaces |
| Haptics with web fallback | `if (navigator.vibrate) navigator.vibrate(50)` in components | `await hapticImpactLight()` from `app/src/lib/haptics.ts` | Capacitor native + graceful web no-op already wired |
| Toast notifications with action button | New `<SnackbarWithAction>` component | Extend existing `toast()` signature with `options?.action` | One notification channel; CLAUDE.md Phase 32.1 #6 "one signal per semantic event" |
| Modal dialogs | Inline `position: fixed` modals per Phase 49 site | Extract `<ConfirmDialog>` once, reuse 3+ times | DRY; also lets the existing inline Reorganize modal migrate |
| Graph mutation logic | Direct `questionService.patchQuestion()` calls from GraphScreen | `graphCommandService.{rename,move,merge,detach,prune,delete,undo}()` | Phase 48 contract — all writes route through validated command boundary with journal |
| Branch label rename across N records | New batch-update logic in GraphScreen | DEFER to v1.7+ (research R9) | Phase 48 service doesn't expose this; building parallel logic violates the single-boundary rule |
| QA-leaf manual parent-pick | UI that snaps QA to a specific anchor | DEFER (R10); use menu-only Detach (re-classify) | Service contract: detach = re-classify, not manual pick |
| Portal mount target | Custom DOM mount node | `document.body` via `createPortal` (same as BottomSheet, ToastContainer) | Established pattern; survives SwipeTabContainer translateZ(0) containing blocks |

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ User pointer event (touch/mouse)                                         │
└─────────────────────────────┬────────────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ GraphScreen.MasterMap container (data-no-swipe-nav, touchAction:none)    │
│                                                                          │
│ ┌─ Existing click delegate ─────────────────────────────────────────┐   │
│ │ Walks up to me-tpc; sets selectedNode → inspector card             │   │
│ └────────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ ┌─ NEW pointer delegate (Phase 49) ──────────────────────────────────┐   │
│ │ pointerdown → start 480ms timer + 8px threshold tracker            │   │
│ │  ├─ before 480ms + >8px move: cancel (was pan)                     │   │
│ │  ├─ 480ms elapsed: hapticLight, capture pointer                    │   │
│ │  │   ├─ release: open CORRECTION CARD                               │   │
│ │  │   └─ drag past 8px: enter DRAG MODE                              │   │
│ │  └─ pointercancel: cleanup                                         │   │
│ └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────┬────────────┘
                               │                              │
              ┌────────────────┘                              └─────────┐
              ▼                                                          ▼
┌─────────────────────────────────┐               ┌────────────────────────────────┐
│ CorrectionCard (NEW)            │               │ DragOverlay (NEW)              │
│  - per-node-type action matrix  │               │  - ghost node (portal:body)    │
│  - sub-flow content swap        │               │  - origin line (SVG portal)    │
│  - emit graphCommandService     │               │  - magnetic snap (32px)        │
│    calls per row tap            │               │  - target halo                 │
│                                 │               │  - drop: open MergeConfirm     │
│                                 │               │    OR commit Move directly     │
└──────┬──────────────────────────┘               └──────┬─────────────────────────┘
       │                                                 │
       │   ┌─ rename → inline RenameForm                 │
       │   ├─ move   → tap-second-node PickMode banner   │
       │   ├─ merge  → tap-second-node PickMode banner   │
       │   ├─ detach → graphCommandService.detach()      │
       │   ├─ prune  → graphCommandService.prune()       │
       │   │            then toast(...).action[Undo]     │
       │   └─ delete → ConfirmDialog → svc.delete()      │
       │                                                 │
       └──────┬──────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ graphCommandService (Phase 48 — LOCKED)                                  │
│  - rename / move / merge / detach / prune / delete / undo                │
│  - mutex serializes; reads fresh; writes via questionService.patchQuestion│
│  - one journal entry + one GRAPH_UPDATED per success                     │
└──────────────────────────────┬───────────────────────────────────────────┘
                               ▼
        ┌──────────────────────┴──────────────────────┐
        ▼                                             ▼
┌──────────────────┐                          ┌──────────────────────────┐
│ localStorage     │                          │ eventBus.emit            │
│ trellis_questions│                          │ GRAPH_UPDATED            │
│ trellis_graph_   │                          └─────────┬────────────────┘
│   edit_log       │                                    │
└──────────────────┘                                    ▼
                                              ┌──────────────────────────┐
                                              │ GraphScreen subscriber   │
                                              │ (line 496-498)           │
                                              │  → reload() → setNodes() │
                                              │  → MindElixir re-init    │
                                              └──────────────────────────┘
                                                        │
                                              ┌─────────┴─────────┐
                                              ▼                   ▼
                                    ┌─────────────────┐  ┌──────────────────┐
                                    │ UndoButton      │  │ PrunedSection    │
                                    │ recomputes      │  │ (existing,       │
                                    │ isEnabled       │  │  unchanged)      │
                                    └─────────────────┘  └──────────────────┘
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| `GraphScreen` | `app/src/screens/GraphScreen.tsx` (modified) | Hosts all Phase 49 state: `correctionNode`, `dragState`, `pickMode`, `mergeConfirm`, `deleteConfirm`. Mounts the new components conditionally. Wires `graphCommandService` calls. |
| `MasterMap` | `app/src/screens/GraphScreen.tsx` (modified) | Adds the new pointer delegate listener. Exposes `onLongPressRelease(node)` and drag callbacks to GraphScreen via prop. |
| `useLongPressOrDrag` | `app/src/hooks/useLongPressOrDrag.ts` (NEW) | 480ms timer + 8px threshold; emits `onLongPressRelease`, `onDragStart`, `onDragMove`, `onDragEnd`, `onCancel`. Suppresses click-after-long-press. |
| `CorrectionCard` | `app/src/components/graph/CorrectionCard.tsx` (NEW) | Renders per-node-type action list; sub-flow swap on row tap. |
| `DragOverlay` | `app/src/components/graph/DragOverlay.tsx` (NEW) | Portals ghost + origin-line + target halos to `document.body`. Magnetic snap math. |
| `ConfirmDialog` | `app/src/components/ui/ConfirmDialog.tsx` (NEW, reusable) | Generic confirm modal with optional children slot. |
| `MergeConfirmPreview` | `app/src/components/graph/MergeConfirmPreview.tsx` (NEW) | Side-by-side loser/survivor cards rendered as children of `<ConfirmDialog>`. |
| `UndoButton` | `app/src/components/graph/UndoButton.tsx` (NEW) | Corner button + GRAPH_UPDATED subscription + handleUndo with toast. |
| `PickModeBanner` | `app/src/components/graph/PickModeBanner.tsx` (NEW) | Below-header banner for tap-second-node mode. |
| `Toast` | `app/src/components/ui/Toast.tsx` (modified) | Renders trailing action button when `action` present; 5000ms dismiss when action set. |

### Recommended Project Structure

```
app/src/
├── components/
│   ├── graph/                    ← NEW directory for Phase 49
│   │   ├── CorrectionCard.tsx
│   │   ├── DragOverlay.tsx
│   │   ├── MergeConfirmPreview.tsx
│   │   ├── UndoButton.tsx
│   │   └── PickModeBanner.tsx
│   └── ui/
│       ├── ConfirmDialog.tsx    ← NEW, reusable
│       └── Toast.tsx             ← MODIFIED (action support)
├── hooks/
│   └── useLongPressOrDrag.ts    ← NEW (sibling to useLongPress)
├── lib/
│   └── toast.ts                  ← MODIFIED (action signature)
├── locales/
│   ├── en.json                   ← MODIFIED (graph.correction.* keys)
│   ├── zh.json / es.json / ja.json ← MIRRORED via Sonnet subagent
└── screens/
    └── GraphScreen.tsx           ← MODIFIED (wires it all up)

app/tests/
├── components/graph/             ← NEW directory
│   ├── CorrectionCard.test.mjs
│   ├── DragOverlay.test.mjs
│   ├── MergeConfirmPreview.test.mjs
│   ├── UndoButton.test.mjs
│   ├── PickModeBanner.test.mjs
│   └── ConfirmDialog.test.mjs    (actually in tests/components/ui/)
├── components/
│   └── Toast.action.test.mjs
├── hooks/
│   └── useLongPressOrDrag.test.mjs
└── screens/
    ├── GraphScreen.correction-card.test.mjs
    ├── GraphScreen.drag-overlay.test.mjs
    ├── GraphScreen.reorg-gate.test.mjs
    ├── GraphScreen.reload-survival.test.mjs
    └── GraphScreen.undo-button.test.mjs
```

### Pattern 1: Always-mounted screen with state-resync on navigation

Per CLAUDE.md §"Always-mounted screens must explicitly re-read service state on navigation," GraphScreen is always-mounted in `SwipeTabContainer`. Phase 49 inherits the existing `GRAPH_UPDATED` subscriber for state resync (line 496-498). No new resync logic needed because Phase 49 doesn't add any new service-state that GraphScreen consumes — `graphCommandService` writes flow back through `questionService` → `GRAPH_UPDATED` → existing `reload()`.

**The one corner case:** if a sub-screen (e.g., AnchorDetailScreen via existing `DetailMenu` delete) calls `questionService.delete()` while GraphScreen is off-screen, the existing GRAPH_UPDATED emit at `question.service.ts:569` triggers reload — GraphScreen state stays synced on return. Verified by Phase 48 reload-survival test pattern.

### Pattern 2: Sub-flow content swap inside a card

```tsx
// CorrectionCard.tsx (concept)
type CorrectionFlow = 'list' | 'rename' | 'reorg-paused';

function CorrectionCard({ node, onClose }: Props) {
  const [flow, setFlow] = useState<CorrectionFlow>(
    isReorgInProgress() ? 'reorg-paused' : 'list'
  );

  return (
    <div style={cardStyle}>
      {flow === 'list' && <ActionList node={node} onSelect={...} />}
      {flow === 'rename' && <RenameForm node={node} onSave={...} onCancel={() => setFlow('list')} />}
      {flow === 'reorg-paused' && <ReorgPausedRow />}
    </div>
  );
}
```

`flow === 'reorg-paused'` is sticky for the duration the card is open — if reorg completes while the card is showing the paused state, the user dismisses + re-opens to access actions. Acceptable per D-16.

### Anti-Patterns to Avoid

- **DO NOT** mutate MindElixir's `nodeData` directly. All renames/moves go through `graphCommandService` → `questionService.patchQuestion` → triggers `GRAPH_UPDATED` → triggers GraphScreen's `reload()` → triggers MindElixir re-init via `useEffect([nodes, edges, isVisible])` at line 229-354. **The graph re-renders from authoritative service state, not from inline tree edits.**
- **DO NOT** add `transform`, `will-change`, `filter`, `contain`, `perspective` to any new ancestor of `Header`. The Phase 32.1 portal-vs-in-tree split depends on the slot's `translateZ(0)` being the only containing block creator (CLAUDE.md §"Header positioning"). Phase 49 components mount INSIDE the GraphScreen content area, not above Header — safe.
- **DO NOT** add a parallel event type for graph mutations. `GRAPH_UPDATED` is the single signal per CLAUDE.md §"Event bus." Phase 49 SUBSCRIBES only (UndoButton); does not emit.
- **DO NOT** call `navigator.vibrate` directly. Use `hapticImpactLight()` / `hapticImpactMedium()`.
- **DO NOT** add an inline edit path to MindElixir's `<me-tpc>`. GRAPHUI-01 mandates "without making MindElixir's internal tree the source of truth."
- **DO NOT** use `position: fixed` on the correction card. It overlays MindElixir but should mount as an absolute-positioned sibling of `<MasterMap>` inside the GraphScreen content stack — `position: fixed` flickers on Android Chromium WebView when nested under `overflow: auto` ancestors (CLAUDE.md Phase 32.1 §"Header positioning" — same root cause).

---

## Project Constraints (from CLAUDE.md)

Phase 49 must comply with these load-bearing rules from `/Users/Code/EchoLearn/CLAUDE.md`:

1. **"Header positioning (Phase 32.1)"** — GraphScreen is a top-level swipe-tab slot; its `Header` renders in-tree. Pick-mode banner mounts BELOW Header (R19), NOT as a Header replacement. No new ancestor adds `transform`/`will-change`/`filter`/`contain`/`perspective`.
2. **"Always-mounted screens must explicitly re-read service state on navigation"** — GraphScreen's existing GRAPH_UPDATED subscriber satisfies this. Phase 49 adds no new service state requiring its own resync hook.
3. **"Event bus — unified GRAPH_UPDATED"** — Phase 49 SUBSCRIBES to `GRAPH_UPDATED` (UndoButton) but does NOT emit. All emits come from `graphCommandService`.
4. **"i18n Workflow (Phase 27+)"** — `graph.correction.*` keys land in `en.json` first; Sonnet subagent generates zh/es/ja; `bundle-parity.test.mjs` enforces parity in the same PR.
5. **"ChatInput flex shrink" / "Root overflow clip" / "SwipeTabContainer resize"** — Phase 49 doesn't add scrolling content nor input boxes that would interact with these invariants. The correction card has bounded height (≤6 rows × 56px + header), no scrolling needed.
6. **"Anchor name normalization"** — Phase 49 rename UI bypasses `normalizeAnchorName` per Phase 48 D-16 (calls `graphCommandService.rename` which already bypasses normalization). UI just trims + validates length client-side for fast feedback, but the service is the canonical validator.
7. **"Concept Feed Generation Pipeline"** — irrelevant to Phase 49.
8. **"Ask-chat system prompt — byte-stable across turns"** — irrelevant to Phase 49.
9. **"Classification dedup — embedding pre-check"** — `detach()` triggers `classifyAndAnchorIncremental` which uses this; Phase 49 does not interact directly.
10. **"Question filter — dual-vector scoring"** — irrelevant to Phase 49.
11. **Style conventions** — "Inline styles with CSS variables (NOT Tailwind classes for most UI)" — Phase 49 components follow this.
12. **"Settings sub-page navigation"** — informs the correction card's iOS-style row aesthetic (icon + label + chevron).

---

## Runtime State Inventory

Phase 49 is **NOT a rename/refactor/migration phase**. It adds new UI surfaces on top of an already-validated service contract.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 49 reads `trellis_questions` (existing) and `trellis_graph_edit_log` (Phase 48-created) via Phase 48's services; writes nothing new. | None |
| Live service config | None — Phase 49 is UI-only; no new external service dependencies. | None |
| OS-registered state | None | None |
| Secrets / env vars | None — Phase 49 reads existing settings (e.g., `settingsService.getSync()` for embedding config indirectly via `graphCommandService.rename`). No new env vars. | None |
| Build artifacts | None — no new compiled binaries; no new locale fixtures beyond `en.json` additions which are loaded at runtime by i18next. | None |

**Nothing found in any category.** Verified by source-reading + grep audit:
```bash
grep -rn "localStorage\.setItem" app/src/screens/GraphScreen.tsx
# returns: (no matches — GraphScreen only reads, never writes localStorage)
```

---

## Common Pitfalls

### Pitfall 1: MindElixir bus events do NOT cover long-press

**What goes wrong:** Implementer searches MindElixir docs for an `onLongPress` event, doesn't find one, assumes the library doesn't support gestures.
**Why it happens:** R1 confirms `EventMap` in `pubsub.d.ts:55-70` only covers `operation`, `selectNewNode`, `selectNodes`, `expandNode`, `changeDirection`, `linkDiv`, `scale`, `move`, `updateArrowDelta`, `showContextMenu`. No long-press.
**How to avoid:** Add a delegated `pointerdown` listener on the wrapping container (mirrors `GraphScreen.tsx:294-340`'s existing click delegate). Walk up to `closest('me-tpc')` to identify the node DOM. Cleanup in the same `useEffect` return as the existing handlers.
**Warning signs:** Code that calls `mei.bus.addListener('longpress', ...)` will silently no-op because that event doesn't exist in MindElixir's bus.

### Pitfall 2: Click-after-long-press fires the inspector card on release

**What goes wrong:** User long-presses → correction card opens → on `pointerup` the synthetic `click` event fires → `GraphScreen.tsx:302` click handler calls `onNodeClickRef.current(q)` → inspector card opens behind correction card.
**Why it happens:** Browser's `pointerup` triggers a `click` event in the same dispatch cycle when no `preventDefault` was called.
**How to avoid:** Use the `didLongPress` ref pattern from `useLongPress.ts:43-44`. After the long-press timer fires, set `didLongPress.current = true`. Add an `onClickCapture` handler on the MindElixir container that consumes the click + resets the ref when `didLongPress.current` is true (mirrors `MasonryFeed.tsx:380-385`).
**Warning signs:** User reports "the inspector card flashes underneath after I long-press" or "the correction card disappears when I release."

### Pitfall 3: MindElixir's `me-epd` (expand/collapse) touch handler eats long-press

**What goes wrong:** User long-presses on an anchor's expand-icon (`me-epd`) → triggers GraphScreen's existing `handleTouchStart`/`handleTouchEnd` at `GraphScreen.tsx:317-338` → expand/collapse fires.
**Why it happens:** The existing touch handler captures `me-epd` taps to bypass MindElixir's drag-detection-eats-tap bug (line 304-312 comment).
**How to avoid:** Add an early `if (target.closest('me-epd'))` guard in the new pointer delegate — let the existing me-epd handler win when the user is interacting with an expand button. Phase 49's gesture engine only competes for taps on the node body (`<me-tpc>`).
**Warning signs:** Long-press on a node's expand-icon collapses the children instead of opening the correction card.

### Pitfall 4: MindElixir destroys + recreates on every `nodes` change

**What goes wrong:** Phase 49's GraphScreen state changes (e.g., `setCorrectionNode(node)`) trigger a re-render. If those state changes accidentally end up in the `useEffect([nodes, edges, isVisible])` dep array at line 354, MindElixir destroys and reinitializes — visually flashing the map and losing scroll position.
**Why it happens:** The current `MasterMap` effect already has this risk (the comment at line 224-227 explains the `initCompletedRef` short-circuit). Adding new state to that component without care will trigger it.
**How to avoid:** Phase 49's new state (`correctionNode`, `dragState`, `pickMode`, etc.) lives on `GraphScreen`, NOT on `MasterMap`. `MasterMap` only receives `nodes`, `edges`, `onNodeClick`, `isVisible` as props (same as today). New gesture callbacks pass through as additional `MasterMap` props but the effect deps stay [nodes, edges, isVisible].
**Warning signs:** Map flickers when opening the correction card; node positions shift; scroll position resets.

### Pitfall 5: Ghost-node z-index conflict with BottomNavigation / Header / ToastContainer

**What goes wrong:** Drag ghost mounted at `zIndex: 9001` but Toast at 9999 — ghost gets covered by a toast that fires during drag.
**Why it happens:** Stacking order conflicts when multiple portaled overlays compete.
**How to avoid:** Z-index map for Phase 49: `ConfirmDialog backdrop = 300` (matches existing), `BottomSheet overlay = 500` (existing), `DragOverlay ghost+line = 9000-9001`, `ToastContainer = 9999`. Toast always wins (intentional — feedback messages must be visible over drag preview). Ghost wins over BottomNavigation (96px nav bar) and Header (190 per BottomSheet.tsx comment).
**Warning signs:** During drag, ghost disappears behind some surface (rare).

### Pitfall 6: `isReorgInProgress()` is a synchronous getter that can stale

**What goes wrong:** Correction card checks `isReorgInProgress()` once at mount. If reorg STARTS while card is open, the user can still trigger commands.
**Why it happens:** `isReorgInProgress()` is a getter returning a boolean from `canonical-knowledge.service.ts:1417`; it doesn't push updates.
**How to avoid:** GraphScreen already subscribes to `REORG_STARTED` (line 492-494). Phase 49 wires the same subscription to update a `reorganizing` state passed to the correction card via prop. The correction card re-renders when reorganizing changes; its action rows become non-interactive (route to the reorg-paused state).
**Warning signs:** User reports "I started a reorganize and then tapped delete on a node — the delete went through."

### Pitfall 7: `graphCommandService.detach` returns `ServiceResult<void>` but the classifier result is fire-and-forget

**What goes wrong:** Phase 49 wants to surface "re-anchored under X" vs "stayed at original anchor" toast (D-12). But `detach()`'s success returns immediately after CLEARING placement; the actual classifier call is fire-and-forget per Phase 48 D-13.
**Why it happens:** D-13 explicitly says `classifyAndAnchorIncremental` is NOT awaited.
**How to avoid:** After `detach()` succeeds, subscribe to the NEXT `GRAPH_UPDATED` event with payload `{ kind: 'classification' }` (the classification commit emits this — see `commitClassificationResult` at `canonical-knowledge.service.ts:935-974`). Compare the QA's new `parentId` against the original. Fire the appropriate toast.

Alternative: Phase 49 may add a temporary "Detaching…" toast on `detach()` success and an "Re-anchored…" or "Stayed under…" toast when the next GRAPH_UPDATED fires.

**Implementation note:** wrap in a timeout (e.g., 10s) to fall back to a generic "Detached." toast if classification doesn't complete (offline / no LLM config). The classifier may also fail silently — the QA remains with cleared `parentId`, which is fine functionally but should toast appropriately.

**Warning signs:** Detach toast always says "Detached" without distinguishing outcomes.

### Pitfall 8: Reorg events fire during normal usage, not just user-initiated reorganize

**What goes wrong:** Phase 49 disables Undo button during `reorganizing === true`. But various paths fire `REORG_STARTED` (e.g., classifyAndAnchorIncremental on first question after empty state may trigger something). User sees Undo button disabled unexpectedly.
**Why it happens:** Need to verify what triggers `REORG_STARTED` in the current codebase.
**How to avoid:** Audit `eventBus.emit({ type: 'REORG_STARTED' })` sites — `canonical-knowledge.service.ts:1598` is the one location. It fires from `reorganizeMindmap()` only. Safe. classifyAndAnchorIncremental does NOT fire REORG_STARTED. Phase 49 wires UndoButton's disabled state to `reorganizing` confidently.
**Warning signs:** Undo button mysteriously disabled despite no visible reorg activity.

### Pitfall 9: Per-target `getBoundingClientRect()` is expensive in a tight loop

**What goes wrong:** DragOverlay computes target distances on every `pointermove` (60fps). If there are 50+ anchors visible, calling `getBoundingClientRect()` 50× per frame stalls the WebView.
**Why it happens:** `getBoundingClientRect()` forces a layout flush.
**How to avoid:** Snapshot all valid drop targets' bounding rects ONCE at drag-start. Compute distance against the snapshot per `pointermove`. Stale-rect risk: if the user pans MindElixir mid-drag, target positions shift. Mitigation: capture pointer on drag-start so MindElixir's pan handler stops receiving events — positions stay stable. Verified by `DragOverlay.test.mjs` source-reading invariants.
**Warning signs:** Janky drag on dense graphs.

### Pitfall 10: i18n bundle parity fails when zh/es/ja are out of sync

**What goes wrong:** Implementer adds `graph.correction.*` keys to `en.json` only; `bundle-parity.test.mjs` blocks merge.
**Why it happens:** CLAUDE.md i18n rule: 4 bundles in 1 PR. Easy to forget.
**How to avoid:** Phase 49's plan must include a task that runs the Sonnet translation subagent (per `app/scripts/translate-locales.md`) BEFORE bundle parity test runs. Add a checkpoint at plan level: "all 4 bundles have `graph.correction.*` keys before final commit."
**Warning signs:** Pre-merge CI red on `bundle-parity.test.mjs`.

---

## Code Examples

### Example 1: `useLongPressOrDrag` hook (NEW, sibling to `useLongPress`)

```ts
// app/src/hooks/useLongPressOrDrag.ts (PROPOSED — not final)
import { useRef, useEffect, useCallback } from 'react';

/**
 * 480ms long-press + 8px drag-start hook. Distinguishes:
 *  - tap (< 480ms): does nothing here; existing click handler fires normally
 *  - long-press release (≥ 480ms, < 8px movement): onLongPressRelease(initialX, initialY)
 *  - long-press drag (≥ 480ms, > 8px movement): onDragStart → onDragMove → onDragEnd
 *  - cancelled (movement > 8px before 480ms): onCancel
 *
 * Use case: graph-correction gesture differentiation at GraphScreen.MasterMap.
 *
 * Pointer-event policy mirrors `useLongPress.ts` — `pointerdown` starts timer,
 * `pointermove` enforces the 8px threshold (cancel before 480ms, transition to
 * drag after 480ms), `pointerup` commits release-in-place OR drag-end.
 *
 * The `didLongPress` ref is set true when the timer elapses (long-press
 * recognized). Consumers use it to suppress click-after-long-press via
 * onClickCapture, same as `useLongPress` (Pitfall 2).
 */
const LONG_PRESS_MS = 480;
const DRAG_START_PX = 8;

interface UseLongPressOrDragOptions {
  onLongPressRelease: (x: number, y: number) => void;
  onDragStart: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onCancel?: () => void;
}

export function useLongPressOrDrag(opts: UseLongPressOrDragOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const callbackRef = useRef(opts);
  useEffect(() => { callbackRef.current = opts; }, [opts]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    didLongPress.current = false;
    draggingRef.current = false;
  }, []);

  useEffect(() => () => reset(), [reset]);

  const onPointerDown = useCallback((e: React.PointerEvent | PointerEvent) => {
    reset();
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
    }, LONG_PRESS_MS);
  }, [reset]);

  const onPointerMove = useCallback((e: React.PointerEvent | PointerEvent) => {
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (didLongPress.current && !draggingRef.current && dist > DRAG_START_PX) {
      // Transition to drag mode
      draggingRef.current = true;
      callbackRef.current.onDragStart(e.clientX, e.clientY);
    } else if (didLongPress.current && draggingRef.current) {
      callbackRef.current.onDragMove(e.clientX, e.clientY);
    } else if (!didLongPress.current && dist > DRAG_START_PX) {
      // Cancelled — was a pan, not a long-press
      reset();
      callbackRef.current.onCancel?.();
    }
  }, [reset]);

  const onPointerUp = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (didLongPress.current) {
      if (draggingRef.current) {
        callbackRef.current.onDragEnd(e.clientX, e.clientY);
      } else {
        // Released in place — open correction card
        callbackRef.current.onLongPressRelease(e.clientX, e.clientY);
      }
    }
    reset();
  }, [reset]);

  const onPointerCancel = useCallback(() => {
    if (didLongPress.current && draggingRef.current) {
      callbackRef.current.onDragEnd(startXRef.current, startYRef.current);
    }
    reset();
    callbackRef.current.onCancel?.();
  }, [reset]);

  return {
    didLongPress,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
```

### Example 2: Delegated listener on MindElixir container (in MasterMap)

```ts
// app/src/screens/GraphScreen.tsx — inside MasterMap effect (concept)
// (Same useEffect at line 229-354 — add ALONGSIDE existing handlers)

const handlePointerDown = (e: PointerEvent) => {
  const target = e.target as HTMLElement;
  // EXCLUDE me-epd (expand/collapse) — existing handler wins (Pitfall 3)
  if (target.closest('me-epd')) return;
  // EXCLUDE root/branch — handled separately for no-op + toast
  const tpc = target.closest('me-tpc') as (HTMLElement & { nodeObj?: NodeObj }) | null;
  if (!tpc?.nodeObj) return;
  const id = tpc.nodeObj.id;
  if (id === 'root-knowledge') {
    // Don't start timer; toast immediately on pointerup? Or just ignore?
    // Researcher recommendation: ignore here — the toast fires from the
    // separate click delegate, not from long-press timing.
    return;
  }
  // Initiate long-press timer + drag tracking
  longPressGestureRef.current.onPointerDown(e);
};

// Bind via the useLongPressOrDrag hook's `bind` object:
containerRef.current.addEventListener('pointerdown', longPressGesture.bind.onPointerDown);
containerRef.current.addEventListener('pointermove', longPressGesture.bind.onPointerMove);
containerRef.current.addEventListener('pointerup', longPressGesture.bind.onPointerUp);
containerRef.current.addEventListener('pointercancel', longPressGesture.bind.onPointerCancel);
```

### Example 3: Reusable `<ConfirmDialog>`

```tsx
// app/src/components/ui/ConfirmDialog.tsx (NEW)
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, destructive, onConfirm, onCancel, children,
}: ConfirmDialogProps) {
  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const confirmColor = destructive ? 'var(--danger)' : 'var(--primary-40)';

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>{title}</p>
        {body && (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
            {body}
          </p>
        )}
        {children}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', borderRadius: '100px',
            border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer',
          }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px', borderRadius: '100px',
            backgroundColor: confirmColor, color: 'white', fontWeight: 600,
            fontSize: '0.875rem', border: 'none', cursor: 'pointer',
          }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

### Example 4: Extended `toast()` with action

```ts
// app/src/lib/toast.ts (MODIFIED)
type ToastType = 'success' | 'error' | 'info';
interface ToastAction { label: string; onAction: () => void; }
interface ToastOptions { action?: ToastAction; }

let globalAddToast:
  | ((msg: { message: string; type: ToastType; action?: ToastAction }) => void)
  | null = null;

export function setToastHandler(handler: typeof globalAddToast) {
  globalAddToast = handler;
}

export function toast(
  message: string,
  type: ToastType = 'info',
  options?: ToastOptions,
): void {
  globalAddToast?.({ message, type, action: options?.action });
}
```

### Example 5: Soft-prune flow with [Undo] snackbar

```ts
// Inside CorrectionCard.tsx (concept)
const handlePrune = async () => {
  const result = await graphCommandService.prune(node.id);
  if (result.success) {
    toast(
      t('graph.correction.toast.pruned', { title: node.title }),
      'info',
      {
        action: {
          label: t('graph.correction.actions.undo'),
          onAction: async () => {
            const undoResult = await graphCommandService.undo();
            if (undoResult.success) {
              toast(t('graph.correction.toast.undone', {
                cmd: t(`graph.correction.actions.${undoResult.data.undoneCmd}`),
                summary: undoResult.data.summary,
              }), 'info');
            }
          },
        },
      },
    );
    onClose();
  } else {
    toast(result.error.message, 'error');
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `setShowReorgConfirm` modal pattern (one-off in GraphScreen) | Reusable `<ConfirmDialog>` component, 3+ consumers | Phase 49 | Replaces the inline pattern; existing Reorganize modal migrates |
| `toast(msg, type)` 2-arg signature | `toast(msg, type, options?)` 3-arg with optional action | Phase 49 | Backward-compatible; enables Snackbar-with-Undo for soft prune |
| MindElixir long-press = (not supported) | Delegated `pointerdown` listener on wrapping container with 480ms timer | Phase 49 | Adds gesture surface without library fork |
| `trellisActionsService.prune` direct call from PlannerScreen | Phase 48's `graphCommandService.prune` delegates to `trellisActionsService.prune` (per `graph-command.service.ts` Plan 03 — see 48-03-PLAN.md) | Phase 48 | PlannerScreen unchanged; GraphScreen calls the command service |
| Manual `questionService.delete` from sub-screen DetailMenu (`AnchorDetailScreen.tsx:106`, `ClusterDetailScreen.tsx:128`) | Phase 49 leaves these unchanged (out of scope per 48-RESEARCH R1 row 19); future phase may migrate to `graphCommandService.delete` for undo support | Phase 50+ | Sub-screen delete still works but isn't in the undo journal |

**Deprecated / outdated:**

- `useLongPress.ts` continues to exist for MasonryFeed + ChatMessage. Phase 49 does NOT modify it.
- `graph.service.ts` `linkNodes` / `moveToParent` (`graph.service.ts:86, 183`) — DEAD CODE per Phase 48 R1 row 14-15. No callers. Phase 49 doesn't touch them.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS native long-press is ~500ms | R2 | Low — Phase 49 locks 480ms based on codebase convention (verified via `useLongPress.ts`), iOS comparison is informational |
| A2 | Apple HIG recommends 44pt minimum touch target | R3 | Low — 32px snap radius is a UX choice, not a regulatory requirement |
| A3 | Magnetic snap at 32px feels right at 0.5× MindElixir scale | R3 | Medium — needs operator UAT; tuning band 24-48px |
| A4 | All Phase 48 plans (01-04) are LOCKED and the service API is committed contract | Whole | Low — verified via `.planning/phases/48-*` files; Plans 01-02 already executed (SUMMARY files exist), Plans 03-04 are in-plan but the surface is committed |
| A5 | Sub-screen DetailMenu callers (`AnchorDetailScreen`, `ClusterDetailScreen`) stay untouched in Phase 49 | Migration scope | Low — explicitly deferred per Phase 48 R1 row 19 |
| A6 | `Capacitor.isNativePlatform()` correctly returns true on the Android/iOS Capacitor builds + false on web preview | R4 | Low — proven by `haptics.ts` shipping unchanged across multiple phases |

**Three assumptions** — relatively low-risk; A3 is the only one with a real tuning band that operator UAT may want to refine.

---

## Open Questions

All resolved inline above. None outstanding.

1. **MindElixir long-press hook?** (RESOLVED — R1: no such hook; use delegated `pointerdown` listener)
2. **Long-press / drag-start thresholds?** (RESOLVED — R2: 480ms / 8px)
3. **Magnetic snap radius?** (RESOLVED — R3: 32px)
4. **Haptics provider?** (RESOLVED — R4: `@capacitor/haptics` via `app/src/lib/haptics.ts`)
5. **Ghost-node rendering approach?** (RESOLVED — R5: absolute-positioned `<div>` portaled to `document.body`)
6. **Origin-line rendering?** (RESOLVED — R6: SVG `<line>` in portal)
7. **Snackbar-with-action component?** (RESOLVED — R7: extend `toast()`)
8. **ConfirmDialog extraction?** (RESOLVED — R8: extract)
9. **Branch rename in Phase 49?** (RESOLVED — R9: DEFER to v1.7+)
10. **QA-leaf drag-to-anchor?** (RESOLVED — R10: DISABLE for v1.6)
11. **Empty-journal Undo behavior?** (RESOLVED — R11: "Nothing to undo" toast)
12. **Correction card vs inspector card style?** (RESOLVED — R12: `--surface` background + `--shadow-2`, vs inspector's `--surface-variant` no-shadow)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `mind-elixir` | Graph rendering | ✓ | 5.9.3 (`package.json:30`) | — |
| `@capacitor/haptics` | Native haptic feedback | ✓ | 8.0.1 (`package.json:21`) | Web no-op via `haptics.ts:11-16` wrapper |
| `lucide-react` | Icons | ✓ | 0.575.0 (`package.json:29`) | — |
| `react-i18next` | i18n hook | ✓ | 17.0.7 (`package.json:35`) | — |
| `react` portal API | Ghost / overlay / modal portals | ✓ | 19.2.6 (`createPortal` from `react-dom`) | — |
| `node --test` (Node 20+) | Test framework | ✓ | Node built-in | — |
| `graph-command.service.ts` (Phase 48) | Service surface for rename/move/merge/detach/prune/delete/undo | Partial | Wave 1+2 LANDED (rename/move/delete done); Wave 3 (merge/detach/prune/undo) PENDING but contract LOCKED | Phase 49 plans MUST schedule downstream of Phase 48 Wave 3 completion; if Phase 49 starts before Wave 3 lands, the stubs return `NOT_IMPLEMENTED` and integration tests will be red |

**Missing dependencies with no fallback:** none.

**Sequence constraint:** Phase 49 EXECUTION (not planning) depends on Phase 48 Plans 03 + 04 (merge / detach / prune / undo) being green. Per STATE.md `last_activity: 2026-05-17`, Wave 1 of Phase 48 is complete and Wave 2 has SUMMARY files committed. Phase 49 PLANNING can proceed immediately (service API contract is locked); the orchestrator should sequence Phase 49 EXECUTION after Phase 48 Wave 3.

---

## Validation Architecture

> Mirrors the structure of `48-VALIDATION.md` (Nyquist contract).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (Node 20+) — `[VERIFIED: app/package.json scripts]` |
| Config file | `app/package.json` scripts `test`, `test:main`, `test:actions` |
| Quick run command | `cd app && node --test tests/components/graph/<file>.test.mjs` (per-file, <2s) |
| Full suite command | `cd app && npm test` |
| Estimated runtime impact | +6-8s on full suite (~10 new test files at 0.5-1s each); current full suite has ~144 files; new total ~154 files |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPHUI-01 | Per-node-type action matrix (Root→toast; Branch→toast; Cluster→4 actions; Anchor→5 actions; QA→2 actions) | source-reading + behavioral | `node --test tests/components/graph/CorrectionCard.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Long-press 480ms timer fires; drag-start at 8px transitions to drag mode; release-in-place opens correction card | behavioral | `node --test tests/hooks/useLongPressOrDrag.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Click-after-long-press suppression via `didLongPress` ref | behavioral | `node --test tests/hooks/useLongPressOrDrag.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Ghost-node mounts to `document.body` on drag-start; unmounts on drag-end / pointercancel | source-reading | `node --test tests/components/graph/DragOverlay.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Magnetic snap math: ghost within 32px of target center triggers snap; beyond 32px ghost tracks finger | behavioral | `node --test tests/components/graph/DragOverlay.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Valid drop target detection: anchor-on-cluster = Move; anchor-on-anchor = Merge; invalid = snap-back + toast | behavioral | `node --test tests/components/graph/DragOverlay.test.mjs` | ❌ W0 |
| GRAPHUI-01 | GraphScreen wires `correctionNode` state; long-press release sets it; tap-outside / X dismisses; tap on different node replaces; calls `graphCommandService` per action | source-reading | `node --test tests/screens/GraphScreen.correction-card.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Pick-mode banner shows "Tap a cluster to move 'X' into it" with Cancel button (D-06); invalid tap → toast | source-reading + behavioral | `node --test tests/components/graph/PickModeBanner.test.mjs` | ❌ W0 |
| GRAPHUI-01 | Detach toast distinguishes re-anchored vs same-anchor (D-12) | behavioral | `node --test tests/screens/GraphScreen.detach-toast.test.mjs` | ❌ W0 |
| GRAPHUI-02 | ConfirmDialog renders open/closed; destructive prop swaps to `--danger` confirm button | behavioral | `node --test tests/components/ui/ConfirmDialog.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Merge confirm renders side-by-side loser/survivor cards with badges; commits via `graphCommandService.merge(loserId, survivorId)` (D-08 convention) | source-reading + behavioral | `node --test tests/components/graph/MergeConfirmPreview.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Delete confirm renders cascade explanation with child count; commits via `graphCommandService.delete()`; destructive CTA | behavioral | `node --test tests/screens/GraphScreen.delete-confirm.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Soft prune commits + toast renders [Undo] action button; tap on [Undo] calls `graphCommandService.undo()` | behavioral | `node --test tests/components/Toast.action.test.mjs` + `tests/screens/GraphScreen.prune-undo.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Persistent UndoButton: enabled when journal non-empty, disabled when empty; tap on empty journal → "Nothing to undo" toast; tap on populated → `graphCommandService.undo()` + toast | behavioral | `node --test tests/components/graph/UndoButton.test.mjs` | ❌ W0 |
| GRAPHUI-02 | Reorg-in-progress (D-16): correction card shows paused row; drag-start blocked with toast; UndoButton disabled | source-reading + behavioral | `node --test tests/screens/GraphScreen.reorg-gate.test.mjs` | ❌ W0 |
| GRAPHUI-03 | Reload survival: after `graphCommandService.rename()` → remount GraphScreen → mutation reflected in nodes state | behavioral | `node --test tests/screens/GraphScreen.reload-survival.test.mjs` | ❌ W0 |
| — | i18n: `graph.correction.*` namespace lands in all 4 locale bundles with identical key sets | parity | `node --test tests/locales/bundle-parity.test.mjs` | ✅ existing (~40 new keys added) |

### Sampling Rate

- **Per task commit:** Run the specific test file for the file changed (<2s)
- **Per wave merge:** Run `cd app && npm test` — full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`. Estimated full-suite budget pressure: +6-8s on ~154 files (currently ~144), well under any reasonable 60s budget.

### Wave 0 Gaps

Wave 0 must create:

- [ ] `app/tests/hooks/useLongPressOrDrag.test.mjs` — covers GRAPHUI-01 gesture differentiation
- [ ] `app/tests/components/graph/CorrectionCard.test.mjs` — covers GRAPHUI-01 action matrix
- [ ] `app/tests/components/graph/DragOverlay.test.mjs` — covers GRAPHUI-01 drag mechanics + drop semantics
- [ ] `app/tests/components/graph/MergeConfirmPreview.test.mjs` — covers GRAPHUI-02 merge preview
- [ ] `app/tests/components/graph/UndoButton.test.mjs` — covers GRAPHUI-02 undo button
- [ ] `app/tests/components/graph/PickModeBanner.test.mjs` — covers GRAPHUI-01 menu+tap fallback
- [ ] `app/tests/components/ui/ConfirmDialog.test.mjs` — covers GRAPHUI-02 modal mechanics
- [ ] `app/tests/components/Toast.action.test.mjs` — covers extended toast signature
- [ ] `app/tests/screens/GraphScreen.correction-card.test.mjs` — covers GraphScreen wiring
- [ ] `app/tests/screens/GraphScreen.reorg-gate.test.mjs` — covers reorg-in-progress gate
- [ ] `app/tests/screens/GraphScreen.reload-survival.test.mjs` — covers GRAPHUI-03
- [ ] `app/tests/screens/GraphScreen.detach-toast.test.mjs` — covers D-12 detach toast variants
- [ ] `app/tests/screens/GraphScreen.delete-confirm.test.mjs` — covers GRAPHUI-02 delete flow
- [ ] `app/tests/screens/GraphScreen.prune-undo.test.mjs` — covers GRAPHUI-02 prune+undo flow

**14 new test files.** Estimated per-file test counts: 3-8 tests each. Total new tests: ~60-100.

**Sampling continuity:** every task in every plan MUST have an automated verify reference (the test file for the changed surface). No 3-consecutive-tasks-without-verify.

**Framework install:** None — `node --test` is built-in.

### Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magnetic snap "feels right" at default 0.5× scale on a real Android device | GRAPHUI-01 D-05 | Requires touch hardware + visual judgment | Operator UAT: open graph with ≥5 anchors visible; long-press an anchor; slowly drag toward another anchor; confirm halo activates within ~32px and ghost snaps. Tune 24-48px band if it feels off. |
| Haptic feedback fires on long-press + drop-onto-valid-target | GRAPHUI-01 D-01 | Web platform has no haptics; only verifiable on Android/iOS Capacitor build | Operator UAT: long-press a node — feel light tap. Drag + drop onto a cluster — feel medium tap. |
| Drag does not fight MindElixir's pan/zoom | GRAPHUI-01 R1 | Requires running app + pinch-to-zoom + multi-finger gestures | Operator UAT: pinch-zoom out, long-press a deep anchor, drag toward a different cluster. Confirm gesture commits without map snapping back to default scale. |
| Pick-mode banner doesn't break Header positioning | GRAPHUI-01 R19 + CLAUDE.md §"Header positioning" | Requires running app + checking visual position of Header across keyboard-open and tab-swipe transitions | Operator UAT: enter pick-mode; swipe tabs left/right; confirm Header stays in place. |

### Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` with automated verify references OR Wave 0 dependency on the corresponding test file
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all 14 NEW test files above
- [ ] No watch-mode flags (`--watch`, `node --test --watch`, etc.)
- [ ] Feedback latency <60s (full suite) / <2s (per-file)
- [ ] i18n bundle parity green AFTER Sonnet translation step (subagent runs as a Wave 0 or Wave-final task before bundle-parity check)
- [ ] `nyquist_compliant: true` set in frontmatter only after all checkboxes above are ticked

---

## Security Domain

> Per `.planning/config.json`, `security_enforcement` is not explicitly disabled → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-first app; no auth surface in Phase 49 |
| V3 Session Management | no | No session state in Phase 49 |
| V4 Access Control | no | Single-user local app; no access control |
| V5 Input Validation | yes | Rename: Phase 48 `graphCommandService.rename` validates (empty / ≤100 chars / trim). Phase 49 UI provides fast feedback; service is canonical. |
| V6 Cryptography | no | No new crypto in Phase 49 |
| V7 Error Handling | yes | `ServiceResult<T>` discriminator; Phase 49 toasts `error.message` on failure |
| V8 Data Protection | no | Phase 49 doesn't introduce new persistent data |
| V9 Communication | no | No network calls in Phase 49 (detach's classifier call inherits Phase 47 bracketing) |
| V11 Business Logic | yes | Merge direction (loser/survivor) is explicit per Phase 48 D-07 (service does not auto-pick); Phase 49 UI presents loser/survivor explicitly per D-07/D-08 |
| V13 API Communication | no | Phase 49 calls in-process service methods |
| V14 Configuration | no | No new config in Phase 49 |

### Known Threat Patterns for {React + local-first Capacitor stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered journal entries (T-48-01 from Phase 48) | Tampering | Phase 48's `isValidPreImage()` runs in `undo()`; Phase 49 inherits this — UI's [Undo] tap just calls `graphCommandService.undo()` |
| XSS via user-typed rename injection into `dangerouslySetInnerHTML` | Tampering | Rename UI uses `<input type="text">` + plain `{title}` interpolation; no `dangerouslySetInnerHTML` in correction card or merge preview |
| Click-jacking on destructive Delete confirm | Spoofing | ConfirmDialog renders at `zIndex: 300` with explicit backdrop; `destructive` CTA in `--danger` color; backdrop click cancels (does NOT confirm) per Example 3 |
| Race: user spam-taps Undo button | Repudiation / Tampering | Phase 48's per-process mutex in `graph-command.service.ts:51` serializes commands; concurrent Undo taps queue, second tap finds an updated journal state |
| Sensitive content in rename text logged | Information Disclosure | Phase 49 toasts use i18n keys with `{{title}}` interpolation — title goes to local toast UI only; no provider logging path |

---

## Sources

### Primary (HIGH confidence)

- `app/src/screens/GraphScreen.tsx:1-651` — existing GraphScreen structure, MindElixir wiring, GRAPH_UPDATED subscriber, existing inline modal, expand/collapse button
- `app/src/services/graph-command.service.ts:1-340` (Phase 48-02 — landed) — service contract; rename/move/delete implementations
- `app/src/services/graph-edit-journal.service.ts:1-186` (Phase 48-01 — landed) — journal API
- `app/node_modules/mind-elixir/dist/types/utils/pubsub.d.ts:55-70` — MindElixir bus event surface
- `app/node_modules/mind-elixir/dist/MindElixir.js:157, 1097-1101, 1748` — drag handlers gated on editable; pan via pointerdown; touch listeners
- `app/src/hooks/useLongPress.ts:1-62` — 480ms long-press convention + pointer-event policy
- `app/src/lib/haptics.ts:1-28` — `@capacitor/haptics` wrapper
- `app/src/lib/toast.ts:1-9` — current toast API
- `app/src/components/ui/Toast.tsx:1-89` — `<ToastContainer>` implementation
- `app/src/components/ui/BottomSheet.tsx:1-50` — portal pattern reference
- `app/src/components/LongPressMenu.tsx:1-142` — existing iOS-style action menu pattern (BottomSheet variant)
- `app/src/components/MasonryFeed.tsx:340-385` — click-after-long-press suppression pattern
- `app/src/types/index.ts:5-39, 720-774` — Question shape + AppEvent union + GraphEditLogEntry
- `app/src/services/canonical-knowledge.service.ts:1417, 1598, 1945, 1951` — `isReorgInProgress()`, REORG_STARTED, REORG_COMPLETED, REORG_FAILED emit sites
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-CONTEXT.md` D-01..D-20 — locked service contract
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-RESEARCH.md` R1-R11 — service-layer architecture; especially R1 (graph-mutation call sites) + R2 (Question schema diffs)
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-VALIDATION.md` — Nyquist contract pattern (Phase 49 mirrors)
- `.planning/phases/48-graph-command-service-and-trust-invariants/48-02-PLAN.md`, `48-03-PLAN.md`, `48-04-PLAN.md` — full method signatures for rename/move/delete (landed), merge/detach/prune (pending), undo (pending)
- `CLAUDE.md` §"Header positioning (Phase 32.1)" — portal-vs-in-tree rule
- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — single-event rule
- `CLAUDE.md` §"i18n Workflow (Phase 27+)" — EN-first + Sonnet subagent + bundle-parity test

### Secondary (MEDIUM confidence)

- iOS Human Interface Guidelines — long-press ~500ms, drag-start ~10pt, touch target 44pt — `[CITED: training knowledge]`
- Apple HIG portal-to-body modal pattern equivalence — `[CITED: training knowledge]`

### Tertiary (LOW confidence)

- (none — all critical claims verified against codebase or Phase 48 artifacts)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every dep verified in `package.json` + `node_modules`
- Architecture: HIGH — every pattern traced to existing code in this repo
- Pitfalls: HIGH — derived from existing codebase patterns + Phase 48 R10 risk register + CLAUDE.md load-bearing rules
- Validation strategy: HIGH — mirrors Phase 48's locked Nyquist contract structure
- Service contract dependencies: HIGH — Phase 48 service API is committed (Plans 01-02 SUMMARY-attested; 03-04 are in-plan but locked surface)
- Threshold values (480ms / 8px / 32px): MEDIUM — 480ms verified against codebase, 8px aligns with existing tap-threshold, 32px is researcher's empirical choice within the 24-48px band

**Research date:** 2026-05-17
**Valid until:** 2026-06-15 (~30 days; stable codebase, no fast-moving dependencies in the surface)

---

## Recommended Plan Decomposition

Phase 49 has comparable scope to Phase 48 (4 plans across 3 waves). Recommended decomposition:

### Wave 1 — Foundations (parallelizable internally; both files independent of each other)

- **49-01-PLAN.md — Gesture engine + drag overlay**
  - New: `app/src/hooks/useLongPressOrDrag.ts`
  - New: `app/src/components/graph/DragOverlay.tsx`
  - New tests: `useLongPressOrDrag.test.mjs`, `DragOverlay.test.mjs`
  - GraphScreen.tsx: wire pointer-delegate listener; mount DragOverlay conditionally
  - Tests: `tests/screens/GraphScreen.correction-card.test.mjs` (gesture-handler wiring portion only)
  - Requirements: GRAPHUI-01 (gesture surface)

- **49-02-PLAN.md — Correction card + per-node-type matrix + reorg gate**
  - New: `app/src/components/graph/CorrectionCard.tsx`
  - New tests: `CorrectionCard.test.mjs`, `tests/screens/GraphScreen.reorg-gate.test.mjs`
  - GraphScreen.tsx: wire `correctionNode` state; mount card; handle action callbacks
  - Includes the Root toast + Branch toast (R9 DEFER surfacing)
  - Requirements: GRAPHUI-01 (correction controls)

### Wave 2 — Confirms + feedback (depends on Wave 1's hook + DragOverlay drop semantics)

- **49-03-PLAN.md — ConfirmDialog + Merge preview + Delete confirm + extended Toast**
  - New: `app/src/components/ui/ConfirmDialog.tsx`
  - New: `app/src/components/graph/MergeConfirmPreview.tsx`
  - Modified: `app/src/lib/toast.ts`, `app/src/components/ui/Toast.tsx`
  - New tests: `ConfirmDialog.test.mjs`, `MergeConfirmPreview.test.mjs`, `Toast.action.test.mjs`, `tests/screens/GraphScreen.delete-confirm.test.mjs`
  - GraphScreen.tsx: migrate inline Reorganize modal to ConfirmDialog; wire Merge + Delete confirms
  - Requirements: GRAPHUI-02 (preview/confirm)

- **49-04-PLAN.md — Undo button + soft-prune snackbar + pick-mode banner**
  - New: `app/src/components/graph/UndoButton.tsx`
  - New: `app/src/components/graph/PickModeBanner.tsx`
  - New tests: `UndoButton.test.mjs`, `PickModeBanner.test.mjs`, `tests/screens/GraphScreen.prune-undo.test.mjs`, `tests/screens/GraphScreen.detach-toast.test.mjs`
  - GraphScreen.tsx: mount UndoButton at corner; wire pick-mode state + PickModeBanner; detach toast variants
  - Requirements: GRAPHUI-02 (undo surface), GRAPHUI-01 (menu-driven fallback)

### Wave 3 — i18n + integration (depends on all preceding waves landing their EN keys)

- **49-05-PLAN.md — i18n bundles + reload-survival regression + integration**
  - Modified: `app/src/locales/en.json` — add `graph.correction.*` namespace (~40 keys)
  - Modified: `app/src/locales/zh.json`, `es.json`, `ja.json` — Sonnet subagent generates mirrored translations
  - New test: `tests/screens/GraphScreen.reload-survival.test.mjs`
  - Verify: `tests/locales/bundle-parity.test.mjs` green
  - End-to-end manual UAT checklist for operator sign-off (haptic, magnetic snap feel, Header positioning, Capacitor build)
  - Requirements: GRAPHUI-03 (reload survival), i18n constraint

### Sequencing

```
Wave 1 (parallel): 49-01 + 49-02 ──┐
                                    ├─► Wave 2 (parallel): 49-03 + 49-04 ──┐
                                    │                                       ├─► Wave 3 (sequential): 49-05
                                    │                                       │
                                    └───────────────────────────────────────┘
```

**Wave 1 plans are independent** — `useLongPressOrDrag` + DragOverlay (49-01) vs CorrectionCard + matrix (49-02). They both modify GraphScreen.tsx but in different sections (gesture listener vs state mounting), so concurrent edits with care.

**Wave 2 plans are mostly independent** — ConfirmDialog/Merge/Delete (49-03) vs UndoButton/PickMode/Prune (49-04). Both modify GraphScreen.tsx; ordering is flexible but parallel execution requires merge-conflict-aware task assignment.

**Wave 3 sequential** — i18n keys depend on all other plans landing their EN keys (parity test only passes when all keys are present in all 4 bundles).

**Comparable to Phase 48** (4 plans / 3 waves) — 5 plans / 3 waves is one extra plan, justified by the larger UI surface area (gesture engine, ghost overlay, multiple confirms, persistent button, pick-mode, i18n integration).

---

## RESEARCH COMPLETE
