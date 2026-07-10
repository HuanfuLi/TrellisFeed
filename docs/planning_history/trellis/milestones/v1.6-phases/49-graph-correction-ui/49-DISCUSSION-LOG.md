# Phase 49: Graph Correction UI — Discussion Log

**Date:** 2026-05-17
**Phase:** 49 — Graph Correction UI
**Prior context:** Phase 48 (Graph Command Service and Trust Invariants) CONTEXT.md locked the service surface, merge direction convention, rename normalization bypass, detach=re-classify, soft-prune, hard-delete + researcher-chosen cascade, N=10 undo journal.

---

## Gray areas presented

1. Control surface + invocation
2. Merge & move target picker
3. Preview + confirmation + undo placement
4. Per-node-type control set + edge cases

User selected: **all four**.

---

## Area A — Control surface + invocation

### A.1 Where do correction controls live for a selected node?

**Options presented:**
- Inline on GraphScreen card (recommended)
- Extend DetailMenu in AnchorDetail / ClusterDetail
- Both (quick on card, deep on detail)
- Behind "Edit graph" mode toggle

**User choice:** **Long-press a node → pop up the inline correction card; normal click stays unchanged.**

Operator counter-proposal — rejected all four presented options in favor of a gesture-based split (tap vs. long-press) closer to iOS conventions. This redirected the discussion from "which surface" to "which gesture maps to which surface."

### A.2 Layout of the correction card

**Options:** Vertical action list / Compact icon grid / Icon row + overflow / Replace inspector content
**User choice:** **Vertical action list (recommended)**

### A.3 Card dismissal

**Options:** Tap-outside or X / Backdrop dim / Bottom sheet (rejected per Phase 25/26 UAT memory) / Replace inspector
**User choice:** **Tap outside or X close button (recommended)**

### A.* Revision (mid-session)

User then expanded the long-press model: *"User long-press and release to show the menu (merge/delete/etc), and user can long-press and drag around to move a node/anchor to other anchor/cluster with magnetic feel and line preview."*

This split long-press into TWO behaviors:
- Release in place = menu pop
- Drag past threshold = drag-to-relocate with ghost-node + magnetic snap + line preview

Captured in D-01 + D-04 + D-05. The Area B prior choice (tap-second-node merge mode) was reinterpreted as the MENU-DRIVEN FALLBACK for merge/move; drag-and-drop became the primary spatial path.

---

## Area B — Merge & move target picker

### B.1 Merge counterparty picker (originally asked before drag-and-drop revision)

**Options:** Similarity-suggested list + search / Search-only / Tap-two-nodes mode / Pure full list
**User choice:** **Tap-two-nodes multi-select mode**

After A.* revision, this became the menu-driven FALLBACK path; drag-and-drop is the primary path.

### B.2 Direction resolution for merge

**Options:** Confirmation modal with A→B / B→A buttons / Pick-order = loser / Pick-order = survivor
**User choice:** **Pick-order = direction (long-pressed = loser)**

Captured in D-08. Side-by-side confirm modal still makes the convention visually explicit via "will be removed" / "will keep" badges.

### B.3 Move target picker

**Options:** Tap-second-node (same as merge) / Tree picker / Search/autocomplete
**User choice:** **Tap-second-node mode (recommended)** — consistent with merge muscle memory

### B.4 Pick-mode indicator + cancel

**Options:** Persistent header banner + Cancel / Overlay tint + floating Cancel / Toast prompt + tap-elsewhere
**User choice:** **Persistent header banner with Cancel button (recommended)**

### B.5 Drag-drop semantics (NEW after A.* revision)

**Options:** Drop on cluster = Move + drop on anchor = Merge (recommended) / Drop on cluster only = Move + menu-driven merge / Drop on valid parent only + reject anchor-on-anchor
**User choice:** **Drop on cluster = Move; drop on another anchor = Merge (recommended)**

### B.6 Drag preview

**Options:** Ghost + origin line + halo / Ghost + halo only / Halo only no ghost
**User choice:** **Ghost node follows finger + line to original parent + halo on hover target (recommended)**

### B.7 Menu retention after drag becomes primary

**Options:** Drag primary + menu keeps Move/Merge fallback / Drag only / Drag-only Move + menu-only Merge
**User choice:** **Drag is the primary; menu keeps Move/Merge as fallback (recommended)**

---

## Area C — Preview + confirmation + undo placement

### C.1 Merge confirm dialog

**Options:** Side-by-side cards with survivor highlighted / Plain text confirm / Side-by-side + swap-direction button
**User choice:** **Side-by-side cards with survivor highlighted + child counts (recommended)**

### C.2 Soft prune confirm

**Options:** Snackbar with Undo / Confirm modal / Modal only if has children
**User choice:** **Just commit + Snackbar toast with 'Undo' button (recommended)**

### C.3 Hard-delete confirm

**Options:** Modal with cascade explanation + child count / Modal with cascade choice (radio) / Two-step button confirm
**User choice:** **Modal with cascade explanation + child count (recommended)** — explicit re-parent default, no user-choice radio

### C.4 Undo surface placement

**Options:** Snackbar + persistent header button / Snackbar only / Snackbar + Recent Edits panel
**User counter-proposal:** **Place Undo button at the right-lower corner of graph viewport, next to the existing expand/collapse button.**

Captured in D-13.

### C.5 Undo tap behavior

**Options:** Direct undo + toast / Confirm modal before commit / Hybrid (confirm only for destructive)
**User choice:** **Direct undo + toast showing what was undone (recommended)** — phone-back-button feel

---

## Area D — Per-node-type control set + edge cases

### D.1 Action matrix per node type

**Options:** Tight per-type matrix / Broad with disabled greys / Anchor-only Phase 49
**User choice:** **Tight per-type matrix (recommended)** — captured in D-15

### D.2 Reorg-in-progress behavior

**Options:** Disable controls + explain / Allow corrections (race) / Queue corrections
**User choice:** **Disable correction controls during reorg + show explanation (recommended)** — captured in D-16

### D.3 Detach result communication

**Options:** Always toast distinguishing no-op vs re-anchored / Toast only when re-anchored / Confirm before with classifier preview
**User choice:** **Always toast with the result, distinguishing no-op vs re-anchored (recommended)** — captured in D-12

---

## Wrap-up

**User choice:** **"I'm satisfied — write CONTEXT.md."**

Deferred to researcher / Claude's discretion:
- Branch rename feasibility (D-15)
- QA-leaf drag-to-anchor (D-04)
- Magnetic snap radius, drag threshold, long-press duration (D-01)
- Haptic API choice (web vibrate vs. Capacitor Haptics)
- MindElixir gesture interception strategy
- Ghost-node rendering approach
- Origin-line rendering (SVG vs. canvas vs. DOM)
- Snackbar-with-action component (extend `toast()` or new `<SnackbarWithAction>`)
- ConfirmDialog component extraction
- Empty-journal Undo button behavior (silent vs. "Nothing to undo" toast)
- Cluster vs. branch-level rename across multiple records

---

## Deferred ideas (future phases)

- QA-leaf free-form drag-to-anchor parent-pick
- Branch rename (if researcher determines complexity is high)
- Cascade-delete option in delete confirm modal
- Direction-swap button in merge confirm modal
- Recent Edits panel (multi-level undo with timestamps) — Phase 48 D-05 already deferred this to v1.7+
- Drag-to-merge for clusters
- Desktop right-click / two-finger context menu (a11y phase)
- AI-suggested merge candidates (GRAPH-F01)
- Per-action haptic patterns
- Inline edit on MindElixir node topic (explicitly out of scope per GRAPHUI-01)

---

## Operator framing — verbatim quotes

> "What about long-press a node and pop up the inline card. Normal user click stays as is"

> "User long-press and release to show the menu (merge/delete/etc), and user can long-press and drag around to move a node/anchor to other anchor/cluster with magnetic feel and line preview."

> "We already have a expand/collapse all button at the right lower corner of graph viewport. Add a back button next to it and use it as undo"

These are load-bearing for Phase 49's gesture model and Undo placement.
