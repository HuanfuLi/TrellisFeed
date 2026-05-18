# Phase 49: Graph Correction UI — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 13 (5 modified + 7 new production + 1 namespace bundle)
**Analogs found:** 13 / 13 (no genuine novelty — every new file copies from a verified in-codebase analog)

## File Classification

| File | New/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|--------------|------|-----------|----------------|---------------|
| `app/src/hooks/useLongPressOrDrag.ts` | NEW | hook | pointer-event-driven state machine | `app/src/hooks/useLongPress.ts` | exact (sibling) |
| `app/src/components/graph/CorrectionCard.tsx` | NEW | component | request-response (per-node action list) | `app/src/screens/SettingsScreen.tsx` MenuRow (lines 16–45) | exact (same iOS-style row pattern) |
| `app/src/components/graph/DragOverlay.tsx` | NEW | component | portal-to-body, pointer-driven animation | `app/src/components/ui/BottomSheet.tsx` (portal) + `app/src/screens/GraphScreen.tsx:294–340` (delegated pointer listener) | role-match (portal portion) + role-match (gesture portion) |
| `app/src/components/ui/ConfirmDialog.tsx` | NEW | component | request-response modal | `app/src/screens/GraphScreen.tsx:518–535` (inline reorganize modal) | exact (literal extraction) |
| `app/src/components/graph/MergeConfirmPreview.tsx` | NEW | component | render-only | `app/src/screens/AnchorDetailScreen.tsx:166–199` (paired flex:1 buttons) + `TrellisStatusPanel.tsx:81–122` (flex:1 columns as cards) | role-match (flex:1 row pattern) |
| `app/src/components/graph/UndoButton.tsx` | NEW | component | event-bus subscriber + click handler | `app/src/screens/GraphScreen.tsx:417–441` (expand/collapse button) + lines 482–500 (GRAPH_UPDATED subscriber) | exact (visual literal copy) |
| `app/src/components/graph/PickModeBanner.tsx` | NEW | component | render-only banner | `app/src/screens/GraphScreen.tsx:518–535` outer container (inline absolute styled row) — and Header.tsx's "render in-tree below Header" pattern | role-match |
| `app/src/screens/GraphScreen.tsx` | MODIFIED | screen | event-bus + state orchestration | self (existing GraphScreen patterns at 462–500) | self-reference |
| `app/src/lib/toast.ts` | MODIFIED | utility | global singleton | self (9 lines extended) | self-reference |
| `app/src/components/ui/Toast.tsx` | MODIFIED | component | container + auto-dismiss | self (lines 1–89 extended with action field) | self-reference |
| `app/src/locales/en.json` | MODIFIED | i18n bundle | static config | existing `graph.*` namespace (lines 225–288) | exact |
| `app/src/locales/{zh,es,ja}.json` | MODIFIED | i18n bundle | static config | mirror of `en.json` via Sonnet subagent | exact |

---

## Pattern Assignments

### `app/src/hooks/useLongPressOrDrag.ts` (NEW)

**Role:** Sibling hook to `useLongPress`. Adds an 8px drag-start threshold after the 480ms long-press recognized, distinguishing release-in-place (menu) from drag-past-threshold (relocate).
**Closest analog:** `app/src/hooks/useLongPress.ts` (entire 62 lines).

**Imports pattern** (`useLongPress.ts:1`):
```ts
import { useRef, useEffect, useCallback } from 'react';
```

**Timer + ref state machine** (`useLongPress.ts:22–47`):
```ts
export function useLongPress(ms: number, onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const callbackRef = useRef(onLongPress);

  useEffect(() => { callbackRef.current = onLongPress; }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    didLongPress.current = false;
    cancel();
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      callbackRef.current();
    }, ms);
  }, [ms, cancel]);
```

**Bind shape** (`useLongPress.ts:53–58`):
```ts
const bind = {
  onPointerDown: start,
  onPointerUp: cancel,
  onPointerLeave: cancel,
  onPointerMove: cancel,   // ← Phase 49 hook OVERRIDES this: only cancel pre-480ms, not post
};
```

**Adapt for Phase 49 by:**
- Add 8px Euclidean drag-start threshold (per RESEARCH R2; consistent with `GraphScreen.tsx:315` TAP_THRESHOLD=10).
- Replace `useLongPress`'s blanket "cancel on any move" with two-phase policy: before 480ms → cancel if movement > 8px (was a pan); after 480ms → first movement > 8px transitions to `dragging` state, do NOT cancel.
- Emit four new callbacks: `onLongPressRelease(x, y)`, `onDragStart(initialX, initialY)`, `onDragMove(x, y)`, `onDragEnd(x, y)`.
- Preserve the `didLongPress` ref pattern so `onClickCapture` in GraphScreen suppresses the click-after-long-press.
- Lock ms = **480** (codebase convention, NOT 400ms placeholder in CONTEXT D-01).

---

### `app/src/components/graph/CorrectionCard.tsx` (NEW)

**Role:** iOS-style vertical action-list surface; per-node-type action gating (Rename, Move, Merge, Detach, Prune, Delete); sub-flow content swap for inline Rename input.
**Closest analog:** `app/src/screens/SettingsScreen.tsx` MenuRow (lines 16–45). Same icon + label + chevron row.

**Row pattern from MenuRow** (`SettingsScreen.tsx:16–45`):
```tsx
function MenuRow({ icon, label, description, onClick }: { icon: React.ReactNode; label: string; description?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="active-squish"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        padding: '14px 4px',
        borderBottom: '1px solid var(--border)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ color: 'var(--primary-40)', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>{label}</p>
        {description && <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>{description}</p>}
      </div>
      <ChevronRight size={18} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
    </button>
  );
}
```

**Card shell** — derive from RESEARCH R12's decision (slight variation from inspector card at `GraphScreen.tsx:570–647`):
```ts
{
  padding: 0,
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--surface)',          // distinct from inspector's --surface-variant
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-2)',
  overflow: 'hidden',
  animation: 'fade-in 0.2s ease',
}
```

**Adapt for Phase 49 by:**
- Copy MenuRow shape verbatim; swap `description` slot for nothing (Phase 49 rows are icon + label + chevron only).
- Implement `getActionsForNode()` per RESEARCH R13 (root/branch → empty array + toast; cluster → 4 actions; anchor → 5 actions; QA leaf → 2 actions).
- Add `flow` state (`'list' | 'rename'`) for sub-flow content swap per RESEARCH R14.
- Wire each row's `onClick` to either set sub-flow (Rename) OR invoke graphCommandService directly + close card OR open ConfirmDialog (Merge, Delete) OR enter pickMode (menu-driven Move/Merge).
- Card sits in DOM order BELOW the inspector card; coexistence rule per R12 — opening one dismisses the other.

---

### `app/src/components/graph/DragOverlay.tsx` (NEW)

**Role:** Portal to `document.body`. Renders ghost-node + SVG origin-line + per-target halo overlay; owns magnetic-snap distance math.
**Closest analogs (two):** `app/src/components/ui/BottomSheet.tsx` (portal mechanics) AND `app/src/screens/GraphScreen.tsx:294–340` (delegated pointer listener at the container).

**Portal pattern from BottomSheet** (`BottomSheet.tsx:1–2, 31–108`):
```tsx
import type { ReactNode, MouseEvent } from 'react';
import { createPortal } from 'react-dom';

export function BottomSheet({ open, ... }: BottomSheetProps) {
  // SSR / non-browser guard
  if (typeof document === 'undefined') return null;

  const overlay = (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      backgroundColor: open ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0)',
      pointerEvents: open ? 'auto' : 'none',
      transition: 'background-color 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    }}>
      {/* contents */}
    </div>
  );

  return createPortal(overlay, document.body);
}
```

**Delegated pointer listener pattern from GraphScreen** (`GraphScreen.tsx:294–302`):
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

**Adapt for Phase 49 by:**
- Render the ghost (`<div>` with semi-transparent transform tracking `pointerX, pointerY`), the SVG origin-line (`<svg>` with a single `<line>` element computing endpoints from origin-node rect + pointer), and per-target halo overlay all inside ONE portaled `<div>` at `zIndex: 400` (BELOW BottomSheet's 500 but ABOVE the existing modal 300).
- Skip the BottomSheet's `position: absolute` inner element + slide-up animation — DragOverlay is opacity-only, pointer-tracking.
- Compute valid drop targets ONCE at drag-start by snapshotting all `me-tpc` DOM rects: `containerRef.current.querySelectorAll('me-tpc')` → map to `{ id, rect, kind }`. (Snapshot avoids per-frame DOM walk.)
- Magnetic snap radius: **32px** (RESEARCH R3 locks this).
- Halo colors per RESEARCH R5: Move target → `--primary-40` (teal); Merge target → `--node-peach` (orange).
- Use `setPointerCapture(pointerId)` per RESEARCH R1 step 3 so MindElixir's pan/zoom stops fighting.

---

### `app/src/components/ui/ConfirmDialog.tsx` (NEW)

**Role:** Reusable confirm modal. Replaces inline pattern at `GraphScreen.tsx:518–535`; consumed by Phase 49 Merge + Delete + migrated Reorganize.
**Closest analog:** `app/src/screens/GraphScreen.tsx:518–535` (LITERAL extraction — operator's `showReorgConfirm` block).

**Excerpt to extract verbatim** (`GraphScreen.tsx:518–535`):
```tsx
{showReorgConfirm && (
  <div style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
    <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: 'var(--shadow-3)' }}>
      <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>{t('graph.reorganizeModal.title')}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
        {t('graph.reorganizeModal.description')}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setShowReorgConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
          {t('graph.reorganizeModal.cancel')}
        </button>
        <button onClick={handleReorganize} style={{ flex: 1, padding: '10px', borderRadius: '100px', backgroundColor: 'var(--primary-40)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
          {t('graph.reorganizeModal.confirm')}
        </button>
      </div>
    </div>
  </div>
)}
```

**Adapt for Phase 49 by:**
- Extract into `<ConfirmDialog open title body? confirmLabel cancelLabel destructive? onConfirm onCancel children?>` per RESEARCH R8.
- Replace the inline `t('graph.reorganizeModal.title')` with `props.title`; same for body + buttons.
- Add `destructive?: boolean` flag: when true, confirm button uses `var(--danger)` instead of `var(--primary-40)` (mirrors DetailMenu.tsx:98–104 destructive-CTA pattern).
- Add `children?: React.ReactNode` slot to host MergeConfirmPreview between body and buttons; when `children` is non-null, omit `body`.
- Keep `zIndex: 300` (matches existing — avoids stacking against BottomSheet 500 / Header 190).
- Migrate `GraphScreen.tsx`'s existing `showReorgConfirm` block to use the new component (same site, new wrapper).

---

### `app/src/components/graph/MergeConfirmPreview.tsx` (NEW)

**Role:** Side-by-side loser/survivor card preview rendered as `children` of `<ConfirmDialog>` from the Merge flow.
**Closest analogs (two):** `app/src/screens/AnchorDetailScreen.tsx:166–199` (paired `flex: 1` buttons) AND `app/src/components/trellis/TrellisStatusPanel.tsx:81–122` (`flex: 1` column-as-card with badges).

**Paired flex:1 layout pattern** (`AnchorDetailScreen.tsx:166–188`):
```tsx
<div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
  <button
    onClick={handleReviewCards}
    style={{
      flex: 1,
      padding: '12px 16px',
      borderRadius: 'var(--radius-xl)',
      backgroundColor: anchorCardCount > 0 ? 'var(--primary-40)' : 'var(--surface-variant)',
      color: anchorCardCount > 0 ? 'white' : 'var(--muted-foreground)',
      fontWeight: 600,
      fontSize: '0.85rem',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    }}
  >
    <BookOpen size={16} />
    {t('graph.anchor.flashcardsButton')}
  </button>
  {/* second button at flex: 1 ... */}
</div>
```

**Column-as-card pattern from TrellisStatusPanel** (`TrellisStatusPanel.tsx:81–91`):
```ts
const columnBase: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '6px 12px',
  borderRadius: 'var(--radius-xl)',
  backgroundColor: 'var(--surface-variant)',
  border: '1px solid var(--border)',
};
```

**Adapt for Phase 49 by:**
- Outer `<div style={{ display: 'flex', gap: '12px' }}>` (copy from AnchorDetail line 166).
- Two children, each `flex: 1` with `padding: 16px`, `borderRadius: var(--radius-xl)`, `border: 1px solid var(--border)`.
- LOSER card: `backgroundColor: var(--surface-variant)`, `opacity: 0.6` (grayed); pill badge inside reading `t('graph.correction.merge.willBeRemoved')` with `backgroundColor: var(--danger)` + white text.
- SURVIVOR card: `backgroundColor: var(--surface)`, normal opacity; pill badge reading `t('graph.correction.merge.willKeep')` with `backgroundColor: var(--primary-40)` + white text.
- Each card body: `title`, Q&A count (use existing `t('graph.anchor.qaCount', { count })` key), cluster name.
- Below the row: body paragraph from `t('graph.correction.merge.body', { n, survivorTitle, loserTitle })` and footer `t('graph.correction.merge.footer')`.
- Render BETWEEN ConfirmDialog title and buttons (i.e., as `children` slot).

---

### `app/src/components/graph/UndoButton.tsx` (NEW)

**Role:** 36px circular persistent button at viewport corner. Subscribes to `GRAPH_UPDATED` to recompute enabled state. Direct-tap = `commandService.undo()` + toast.
**Closest analog:** `app/src/screens/GraphScreen.tsx:417–441` (LITERAL visual copy of the expand/collapse button) plus `GraphScreen.tsx:482–500` (event-bus subscriber pattern).

**Button visual treatment to copy** (`GraphScreen.tsx:417–441`):
```tsx
<button
  onClick={handleToggleExpand}
  title={allExpanded ? t('graph.toggleCollapseTitle') : t('graph.toggleExpandTitle')}
  style={{
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-1)',
    fontSize: '15px',
    fontWeight: 700,
    zIndex: 10,
  }}
>
  {allExpanded ? <FoldVertical size={18} /> : <UnfoldVertical size={18} />}
</button>
```

**Event-bus subscribe pattern to copy** (`GraphScreen.tsx:482–500`):
```ts
useEffect(() => {
  const unsub1 = eventBus.subscribe('REORG_COMPLETED', (event) => { /* ... */ });
  const unsub4 = eventBus.subscribe('GRAPH_UPDATED', () => {
    reload();
  });
  return () => { unsub1(); /* ... */ unsub4(); };
}, [reload, t]);
```

**Adapt for Phase 49 by:**
- Position: `right: 56px` (= 12 + 36 + 8 gap), immediately LEFT of the existing button. All other style props identical.
- Icon: `Undo2 size={18}` from `lucide-react` (RESEARCH R17 locks `Undo2` over `RotateCcw`).
- Disabled state: `disabled={!isEnabled || reorganizing}`; visual `opacity: (isEnabled && !reorganizing) ? 1 : 0.4`, `cursor: 'not-allowed'` when disabled.
- Subscribe to `GRAPH_UPDATED` in `useEffect`; on emit, recompute `isEnabled = graphEditJournal.list().length > 0`.
- `handleUndo` per RESEARCH R17 (lines 1015–1033): if empty journal → toast `nothingToUndo`; else `await graphCommandService.undo()` → toast `undone` with command summary.
- The `reorganizing` flag is the SAME state already maintained in GraphScreen at line 465 — pass it down as a prop OR read via context.

---

### `app/src/components/graph/PickModeBanner.tsx` (NEW)

**Role:** In-tree banner for menu+tap second-node pick mode (D-06). Renders BELOW Header, not as Header replacement.
**Closest analog:** `app/src/screens/GraphScreen.tsx:518–520` outer modal style row pattern + `app/src/screens/SettingsScreen.tsx` SettingRowInline (lines 47–56) for the inline row-with-trailing-CTA pattern.

**Inline row pattern from SettingsScreen** (`SettingsScreen.tsx:47–56`):
```tsx
function SettingRowInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500 }}>{label}</p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
```

**Adapt for Phase 49 by:**
- Render inside `GraphScreen` content area (between Header and `<MasterMap>`) — NOT inside Header, NOT portaled (per CLAUDE.md §"Header positioning"; GraphScreen is a top-level swipe-tab slot and Header is in-tree).
- Visual per RESEARCH R19: `padding: 12px 16px`, `backgroundColor: var(--primary-30-bg)` (or fallback to `color-mix(in srgb, var(--primary-40) 15%, transparent)` if `--primary-30-bg` not defined — see `index.css:11–12` confirming `--primary-40` and `--primary-30` exist), `borderRadius: var(--radius-xl)`, `display: flex; justifyContent: space-between; alignItems: center`.
- Left: message text — `t('graph.correction.pickMode.move', { title })` or `t('graph.correction.pickMode.merge', { title })`.
- Right: Cancel button — text button, `color: var(--primary-40)`, `background: none`, `border: none`.
- Add `addEventListener('keydown', ...)` for Escape key (per R19 recommendation; desktop dev surface).
- Banner mounts when `pickMode !== null`; unmounts when `pickMode === null`.

---

### `app/src/screens/GraphScreen.tsx` (MODIFIED — existing 651-line file)

**Role:** Top-level swipe-tab screen orchestrating MindElixir canvas + correction surfaces.
**Closest analog:** self. Phase 49 EXTENDS existing patterns; does not introduce new ones.

**State additions** — add alongside existing state at line 462–466:
```ts
const [correctionNode, setCorrectionNode] = useState<Question | null>(null);
const [pickMode, setPickMode] = useState<{ kind: 'move' | 'merge'; sourceNode: Question } | null>(null);
const [mergeConfirm, setMergeConfirm] = useState<{ loser: Question; survivor: Question } | null>(null);
const [deleteConfirm, setDeleteConfirm] = useState<{ node: Question } | null>(null);
const [dragState, setDragState] = useState<DragState | null>(null);
```

**Gesture overlay wiring** — extend the existing `useEffect` at line 229–354 that attaches the delegated `click` listener. ADD a sibling delegated `pointerdown` listener inside the same effect, with the same teardown semantics (line 345–353).

**Event-bus subscriber additions** — extend `useEffect` at lines 481–500 with one additional subscription for Undo enabled-state recompute. The existing `GRAPH_UPDATED → reload()` at line 496 already handles graph mutations; no new subscriber needed for that signal.

**Reorg-gate** — D-16 — already wired: `reorganizing` state at line 465 subscribes to `REORG_STARTED/COMPLETED/FAILED`. Pass to CorrectionCard + UndoButton + drag handler as a prop.

**Migrate reorganize-confirm-modal** — replace inline block at 518–535 with `<ConfirmDialog open={showReorgConfirm} title={t('graph.reorganizeModal.title')} body={t('graph.reorganizeModal.description')} confirmLabel={t('graph.reorganizeModal.confirm')} cancelLabel={t('graph.reorganizeModal.cancel')} onConfirm={handleReorganize} onCancel={() => setShowReorgConfirm(false)} />`.

**Adapt for Phase 49 by:**
- All write paths route through `graphCommandService` (NEW import) — NEVER `questionService.patchQuestion` directly.
- All correction UI gated on `reorganizing === false`.
- DO NOT add new `transform`/`will-change`/`filter`/`contain` ancestors of Header (CLAUDE.md §"Header positioning" invariant).
- DO NOT remove `data-no-swipe-nav="true"` (line 408) or `touchAction: 'none'` (line 412).

---

### `app/src/lib/toast.ts` (MODIFIED — extend signature)

**Role:** Global toast notification singleton.
**Closest analog:** self (current 9 lines).

**Current implementation** (`toast.ts:1–9`):
```ts
let globalAddToast: ((msg: { message: string; type: 'success' | 'error' | 'info' }) => void) | null = null;

export function setToastHandler(handler: typeof globalAddToast) {
  globalAddToast = handler;
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  globalAddToast?.({ message, type });
}
```

**Adapt for Phase 49 by:**
- Extend `toast` signature to `toast(message, type, options?: { action?: { label: string; onAction: () => void } })`.
- Extend handler payload type: `{ message; type; action? }`.
- All existing call sites compile unchanged (third param optional).
- The single new call site is the soft-prune handler (CONTEXT D-10).

---

### `app/src/components/ui/Toast.tsx` (MODIFIED — extend ToastMessage)

**Role:** Renders `ToastContainer` from `globalAddToast` calls.
**Closest analog:** self (current 89 lines).

**ToastMessage interface to extend** (`Toast.tsx:4–9`):
```ts
interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}
```

**Auto-dismiss timer** (`Toast.tsx:32–37`):
```ts
setTimeout(() => {
  setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 200);
}, 3000);
```

**Adapt for Phase 49 by:**
- Add `action?: { label: string; onAction: () => void }` field to `ToastMessage`.
- When `t.action` is present: render an inline trailing `<button>` with `color: white`, `background: none`, `border: none`, `fontWeight: 700`, `padding: '0 0 0 12px'`, `cursor: 'pointer'` after the message text inside the existing `<div>` at lines 65–80.
- When `t.action` is present: extend auto-dismiss from 3000ms to **5000ms** to give the user time to tap.
- On action click: invoke `onAction()` THEN immediately dismiss the toast (set `exiting: true` early).
- Existing 2s duplicate suppressor at `Toast.tsx:25–28` continues to work (key includes type + message; not affected by action).

---

### `app/src/locales/en.json` (MODIFIED — add `graph.correction.*` subtree)

**Role:** Canonical EN i18n bundle.
**Closest analog:** existing `graph.*` namespace at lines 225–288 — paste new subtree as a sibling key.

**Existing pattern** (`en.json:225–254`):
```json
"graph": {
  "title": "Knowledge Graph",
  "headerTitle": "Knowledge Graph",
  "reorganizeButton": "Reorganize",
  "reorganizeModal": {
    "title": "Reorganize Map",
    "description": "...",
    "cancel": "Cancel",
    "confirm": "Reorganize"
  },
  "selected": { ... },
  "toast": {
    "reorganized": "Map reorganized: {{clusterCount}} clusters, {{anchorCount}} concepts",
    "reorganizeFailed": "Reorganization failed",
    "reorganizing": "Reorganizing your knowledge map..."
  }
}
```

**Adapt for Phase 49 by:**
- Add `graph.correction.*` as a peer subtree alongside `graph.toast.*`, `graph.selected.*`, `graph.anchor.*` (do NOT overload existing keys per CONTEXT D-17).
- ~40 keys per CONTEXT D-17 list — see canonical list in CONTEXT.md.
- Interpolation placeholders use `{{name}}` (double-brace) syntax — matches existing keys like `{{clusterCount}}` at line 251.
- After updating `en.json`, run the Sonnet subagent per `app/scripts/translate-locales.md` for zh.json, es.json, ja.json (CLAUDE.md §"i18n Workflow").
- Run `node --test tests/locales/bundle-parity.test.mjs` to confirm parity.

---

## Shared Patterns

### Pattern: ServiceResult success/error handling
**Source:** Every Phase 48 `graphCommandService` method returns `ServiceResult<T>`.
**Apply to:** CorrectionCard (rename/move/merge/detach/prune/delete handlers), UndoButton (undo handler).
**Excerpt:**
```ts
const result = await graphCommandService.rename(node.id, newTitle);
if (result.success) {
  toast(t('graph.correction.toast.renamed', { title: newTitle }), 'success');
  onClose();
} else {
  toast(result.error.message, 'error');
}
```

### Pattern: Event-bus subscribe in useEffect with teardown
**Source:** `GraphScreen.tsx:481–500`
**Apply to:** UndoButton.tsx (subscribe to `GRAPH_UPDATED` for enabled-state recompute).
**Excerpt:**
```ts
useEffect(() => {
  const unsub = eventBus.subscribe('GRAPH_UPDATED', () => {
    setIsEnabled(graphEditJournal.list().length > 0);
  });
  return () => unsub();
}, []);
```

### Pattern: Haptics on user-meaningful events
**Source:** `app/src/lib/haptics.ts` + `BottomNavigation.tsx:114`, `Flashcard.tsx:29,35`
**Apply to:** useLongPressOrDrag (fire `hapticImpactLight()` on long-press recognized + on drop-onto-valid-target).
**Excerpt:**
```ts
import { hapticImpactLight } from '../lib/haptics';
// ...
void hapticImpactLight();
```

### Pattern: Inline absolute modal with backdrop
**Source:** `GraphScreen.tsx:518–535` (extracted into ConfirmDialog by Phase 49)
**Apply to:** ConfirmDialog (all confirm flows: Merge, Delete, migrated Reorganize).
**Excerpt:** see ConfirmDialog section above.

### Pattern: Portal-to-body for sub-screen overlays
**Source:** `BottomSheet.tsx:108`, `Header.tsx:155`
**Apply to:** DragOverlay (portal to escape SwipeTabContainer's per-slot `translateZ(0)` containing block).
**Excerpt:**
```ts
if (typeof document === 'undefined') return null;
return createPortal(overlay, document.body);
```

### Pattern: i18n via useTranslation hook + key interpolation
**Source:** every screen (`SettingsScreen.tsx:59`, `GraphScreen.tsx:458`)
**Apply to:** every new component (CorrectionCard, DragOverlay, MergeConfirmPreview, ConfirmDialog, UndoButton, PickModeBanner).
**Excerpt:**
```ts
const { t } = useTranslation();
// ...
{t('graph.correction.actions.rename')}
{t('graph.correction.toast.renamed', { title: newTitle })}
```

### Pattern: CSS variables over Tailwind for inline styles
**Source:** every screen + CLAUDE.md §"Style Conventions"
**Apply to:** every new file. Use `var(--primary-40)`, `var(--surface)`, `var(--surface-variant)`, `var(--border)`, `var(--shadow-1/2/3)`, `var(--radius-xl)`, `var(--danger)`, `var(--muted-foreground)`, `var(--node-peach)`. All confirmed present in `app/src/index.css`.

---

## No Analog Found

None. Every Phase 49 file copies from a verified in-codebase pattern. The closest thing to "genuine novelty" is the **drag-overlay magnetic-snap math** in `DragOverlay.tsx`, but the portal mechanics + delegated pointer listener it relies on are both established (`BottomSheet.tsx`, `GraphScreen.tsx:294`); only the snap-distance computation is new — and that is pure pixel math, not a pattern.

---

## Summary Table

| New file | Closest analog | Match quality | Key reuse |
|----------|----------------|---------------|-----------|
| `hooks/useLongPressOrDrag.ts` | `hooks/useLongPress.ts` (62 lines) | exact sibling | timer + ref state machine, didLongPress ref for click suppression |
| `components/graph/CorrectionCard.tsx` | `screens/SettingsScreen.tsx` MenuRow (16–45) | exact | icon + label + chevron row, `active-squish` class |
| `components/graph/DragOverlay.tsx` | `components/ui/BottomSheet.tsx` + `screens/GraphScreen.tsx:294–340` | role-match (portal) + role-match (gesture) | createPortal pattern, delegated pointer listener |
| `components/ui/ConfirmDialog.tsx` | `screens/GraphScreen.tsx:518–535` | exact (literal extraction) | inline absolute modal with backdrop at zIndex 300 |
| `components/graph/MergeConfirmPreview.tsx` | `AnchorDetailScreen.tsx:166–199` + `TrellisStatusPanel.tsx:81–122` | role-match | `flex: 1` paired cards, badge pills |
| `components/graph/UndoButton.tsx` | `screens/GraphScreen.tsx:417–441` + `:482–500` | exact (visual) + exact (event-bus) | 36px circular button at absolute corner, GRAPH_UPDATED subscriber |
| `components/graph/PickModeBanner.tsx` | `SettingsScreen.tsx:47–56` SettingRowInline | role-match | inline flex row with trailing CTA |
| `screens/GraphScreen.tsx` (mod) | self (lines 462–500, 518–535) | self-reference | existing state + event-bus + modal patterns |
| `lib/toast.ts` (mod) | self (9 lines) | self-reference | extend signature |
| `components/ui/Toast.tsx` (mod) | self (89 lines) | self-reference | extend ToastMessage type, trailing action button |
| `locales/en.json` (mod) | `en.json:225–288` existing `graph.*` namespace | exact | sibling subtree, `{{name}}` interpolation |

## Metadata

**Analog search scope:** `app/src/screens/`, `app/src/components/`, `app/src/hooks/`, `app/src/lib/`, `app/src/locales/`
**Files scanned:** ~25 (verified analogs read in full or in targeted ranges)
**Pattern extraction date:** 2026-05-17
**Phase 48 cross-reference:** All write paths in Phase 49 route through `graphCommandService` (Phase 48 deliverable). UI never calls `questionService.patchQuestion` directly.
