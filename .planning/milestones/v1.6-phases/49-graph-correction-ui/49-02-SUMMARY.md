---
phase: 49-graph-correction-ui
plan: 02
subsystem: ui
tags: [correction-card, action-matrix, rename-flow, reorg-gate, ios-style, i18n, always-mounted-screen]

requires:
  - phase: 48-graph-command-service-and-trust-invariants
    provides: graphCommandService.rename (called by CorrectionCard's inline rename sub-flow); ServiceResult contract with VALIDATION_ERROR fast-path; D-16 100-char rename validation
  - plan: 49-01
    provides: useLongPressOrDrag factory + DragOverlay + GraphScreen pointerdown gesture engine; correctionNode placeholder state with anchorX/Y coords; setSelectedNode(null) on long-press release (D-03 coexistence)
provides:
  - CorrectionCard component (iOS-style vertical action list + inline Rename sub-flow + PausedRow when isReorganizing)
  - getActionsForNode pure-function matrix (cluster→4, anchor→5, QA-leaf→2, orphan/flagged/synthetic→[]) — exported from correction-actions.ts AND re-exported from CorrectionCard.tsx
  - GraphScreen wired: useLocation import + always-mounted reset effect (B-4); B-6 silent-return guard via getActionsForNode().length === 0; CorrectionCard + zIndex-249 backdrop mount; isReorganizing prop propagation (D-16)
  - i18n stubs (graph.correction.actions.*, graph.correction.rename.*, graph.correction.reorgPaused, graph.correction.toast.renamed) in all 4 locale bundles
affects:
  - 49-03-PLAN.md (delete + merge confirms consume CorrectionCard.onActionSelected dispatch via handleCorrectionAction's stub branches; replace `case 'delete'` + `case 'merge'`)
  - 49-04-PLAN.md (pickMode entry for Move/Merge, prune snackbar, detach toast all consume handleCorrectionAction stub branches; pickMode reset added to the always-mounted reset effect at the location.pathname change)
  - 49-05-PLAN.md (Sonnet subagent finalizes the full graph.correction.* namespace — Plan 49-02's in-line zh/es/ja translations are best-effort placeholders)

tech-stack:
  added: []  # No new packages — uses lucide-react (Pencil, Move, GitMerge, Scissors, Trash2, ArrowLeftRight, ChevronRight, X, Loader2), react-i18next, react, react-router-dom (all existing deps)
  patterns:
    - "Pure-function in .ts sibling + .tsx re-export — getActionsForNode lives in correction-actions.ts so node --test can dynamically import it without a TSX loader; CorrectionCard.tsx re-exports for ergonomic single-import in app code"
    - "Sub-flow content swap via local state — `flow: 'list' | 'rename'` state inside CorrectionCard switches body content per RESEARCH R14; Cancel returns to list without closing the card"
    - "ServiceResult VALIDATION_ERROR fast-path — UI mirrors Phase 48 D-16 validation rules client-side (non-empty trim, ≤100 chars) for instant feedback; service-side validation is authoritative; VALIDATION_ERROR surfaces inline without closing the card so the user can correct and retry"
    - "Tap-outside backdrop pattern — fixed zIndex 249 transparent div sibling to a zIndex 250 card with stopPropagation, mirroring BottomSheet's approach but without portal (the card itself anchors to GraphScreen's containing block per CLAUDE.md Header positioning invariant)"

key-files:
  created:
    - app/src/components/graph/CorrectionCard.tsx
    - app/src/components/graph/correction-actions.ts
  modified:
    - app/src/screens/GraphScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/tests/components/graph/CorrectionCard.test.mjs
    - app/tests/screens/GraphScreen.correction-card.test.mjs
    - app/tests/screens/GraphScreen.reorg-gate.test.mjs

key-decisions:
  - "getActionsForNode lives in a sibling .ts file (correction-actions.ts), not inside the .tsx. Reason: node --test cannot dynamically import .tsx without a TSX loader, but Tests 2–6b require behavioral import of the pure function. CorrectionCard.tsx re-exports both `getActionsForNode` and `CorrectionAction` so app code single-imports."
  - "correctionNode state stores the captured release coords (anchorX/Y) at card-mount time — does NOT re-read from the source node's DOM rect. The MindElixir `me-tpc` element's bounding rect can move (zoom/pan/relayout) between long-press release and card-paint; pinning to the release coords keeps the card visually anchored to where the user's finger was. This matches the 49-01 placeholder shape exactly so no contract change."
  - "Card placement algorithm: clampPlacement(anchorX, anchorY, estimatedHeight) uses Math.min/Math.max against window.innerWidth/innerHeight with a 12px viewport padding and an estimated card height (44 + 52*N for action list, 180 for rename form, 100 for PausedRow). SSR guard returns `{ left: anchorX, top: anchorY }` when window is undefined so tests pass without jsdom."
  - "useLocation was added as a NEW import to GraphScreen.tsx (B-4 fix). Verified pre-edit grep: `useLocation` did not previously appear. Added alongside the existing `useNavigate` from react-router-dom."
  - "handleCorrectionAction's rename branch is a no-op because CorrectionCard owns the inline rename submission via graphCommandService.rename and calls onClose() itself. The UP-dispatch only fires for move/merge/prune/detach/delete — and those are stubs logging 'Pending Plan 49-03/04' for now."
  - "Backdrop uses zIndex 249 (one below card's 250). Both are below ConfirmDialog's planned 300 (Plan 49-03) and BottomSheet's 500. Transparent backgroundColor means the underlying graph is still visible — only the tap-out gesture is captured."

patterns-established:
  - "Pattern: behavioral-test-friendly component split — when a React component owns both pure-function logic AND JSX, extract the pure-function half to a .ts sibling so node --test can exercise it directly; the .tsx re-exports for ergonomic app-side imports"
  - "Pattern: sub-flow content swap — single component owns multiple content modes via local state (`flow: 'list' | 'rename'`), Cancel returns to the prior mode without unmounting; the header and close button persist across modes for visual continuity"
  - "Pattern: always-mounted-screen reset effect — top-level swipe-tab screens that own ephemeral overlay state (CorrectionCard mount, dragState, pickMode) MUST reset that state when `location.pathname !== this-route`. Verified via source-reading test that the effect's condition AND deps array both reference location.pathname (CLAUDE.md invariant)"

requirements-completed: []  # GRAPHUI-01 marked complete by Plan 49-01; Plan 49-02 extends it.

duration: 11m
completed: 2026-05-18
---

# Phase 49 Plan 02: CorrectionCard + Per-Node-Type Action Matrix + Reorg Gate Summary

**iOS-style vertical action list with per-type matrix (cluster=4, anchor=5, QA-leaf=2, orphan/flagged=[]) + inline Rename sub-flow via graphCommandService.rename + D-16 reorg-paused state + B-4 useLocation + B-6 silent-return guard wired into GraphScreen on top of Plan 49-01's gesture engine.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-18T04:09:19Z
- **Completed:** 2026-05-18T04:20:14Z
- **Tasks:** 2
- **Files created:** 2 (CorrectionCard.tsx + correction-actions.ts)
- **Files modified:** 7 (GraphScreen.tsx + 4 locale bundles + 3 test files)

## Accomplishments

- **Per-node-type matrix locked in code (D-15 + B-6):** `getActionsForNode` returns the exact ordered action lists per type, including `[]` for orphan QA, flagged QA, and synthetic root/branch IDs. Tested with 7 behavioral assertions in `CorrectionCard.test.mjs` (Tests 2–6b).
- **iOS-style action list rendered:** ActionRow component mirrors `SettingsScreen.MenuRow` shape (icon + label + chevron with `active-squish` class). Delete action uses `var(--danger)` color for both icon and label per CONTEXT D-09 destructive-CTA convention.
- **Inline Rename sub-flow lands:** RenameForm sub-component owns local state for the text input + validation. Submit awaits `graphCommandService.rename(node.id, trimmed)`; success toasts `graph.correction.toast.renamed` and closes the card; `VALIDATION_ERROR` surfaces inline without closing; any other failure code toasts the error and closes.
- **Reorg-paused state (D-16):** When `isReorganizing` prop is true, the card body renders only a single `PausedRow` (rotating Loader2 icon + paused message) instead of the action list. The drag-start gate in GraphScreen (already wired in Plan 49-01) is unchanged — both paths are symmetric.
- **B-4 useLocation explicit import:** Pre-edit grep confirmed `useLocation` was NOT in GraphScreen.tsx; added as a new import alongside the existing `useNavigate`. Hook declaration `const location = useLocation();` placed near the top of the GraphScreen component.
- **Always-mounted reset effect (CLAUDE.md invariant):** New `useEffect(() => { if (location.pathname !== '/graph') { setCorrectionNode(null); setDragState(null); } }, [location.pathname])`. Plan 49-04 will extend this to also reset pickMode.
- **B-6 silent-return guard:** GraphScreen's long-press release handler now calls `getActionsForNode(sourceNode)` and returns early without mounting the card when `actions.length === 0` (orphan/flagged/malformed). The card never opens empty.
- **Tap-outside backdrop:** Fixed transparent div at zIndex 249 (below the card's 250) captures clicks outside the card and resets `correctionNode` to null. Card itself has `onClick={(e) => e.stopPropagation()}` so taps inside don't bubble.
- **i18n stubs added in all 4 locale bundles:** `graph.correction.actions.{rename,move,merge,detach,prune,delete,close}`, `graph.correction.rename.{placeholder,save,cancel,empty,tooLong}`, `graph.correction.reorgPaused`, `graph.correction.toast.renamed`. Bundle-parity test stays green. Plan 49-05 will reconcile via the Sonnet subagent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build CorrectionCard component + getActionsForNode (B-6 matrix fix)** — `772bb4ad` (feat)
2. **Task 2: Wire CorrectionCard into GraphScreen with reorg gate + useLocation + always-mounted reset (B-4 fix)** — `920d9399` (feat)

No separate test/refactor commits — tests scaffold lived in `tests/components/graph/CorrectionCard.test.mjs` (created by Plan 49-01 as a 3-test failing scaffold) and was extended to 15 tests inside Task 1. Source-reading tests in `tests/screens/GraphScreen.{correction-card,reorg-gate}.test.mjs` were extended inside Task 2.

## Files Created/Modified

### Created

- `app/src/components/graph/correction-actions.ts` — Pure-function module exporting `CorrectionAction` type + `getActionsForNode(node: Question): CorrectionAction[]` per the D-15 matrix and B-6 edge cases.
- `app/src/components/graph/CorrectionCard.tsx` — React component owning the card shell, ActionRow sub-component, RenameForm sub-component, PausedRow sub-component, and clampPlacement helper. Re-exports `getActionsForNode` and `CorrectionAction` for ergonomic single-import in app code.

### Modified

- `app/src/screens/GraphScreen.tsx` — Added `useLocation` import + hook declaration; imported `CorrectionCard`, `getActionsForNode`, `CorrectionAction` from `../components/graph/CorrectionCard`; B-6 guard inside `handleLongPressRelease`; new `handleCorrectionAction` dispatcher (rename no-op, others stub); always-mounted reset useEffect on `location.pathname`; mounted CorrectionCard + zIndex-249 backdrop gated on `correctionNode`; passed `isReorganizing={reorganizing}` prop.
- `app/src/locales/{en,zh,es,ja}.json` — Added 13 new keys to the existing `graph.correction.*` namespace (actions: 7, rename: 5, reorgPaused: 1) + 1 `toast.renamed`. Bundle-parity test stays green; in-line zh/es/ja translations are best-effort placeholders for Plan 49-05's canonical pass.
- `app/tests/components/graph/CorrectionCard.test.mjs` — Extended from 3 failing scaffold tests to 15 passing tests (6 matrix + 9 source-reading).
- `app/tests/screens/GraphScreen.correction-card.test.mjs` — Extended from 7 tests (6 passing + 1 failing) to 14 passing tests (added B-4 useLocation + reset effect assertions + B-6 silent-return assertion + Test E backdrop zIndex 249).
- `app/tests/screens/GraphScreen.reorg-gate.test.mjs` — Extended from 2 tests (1 passing + 1 failing) to 4 passing tests (added REORG_STARTED/COMPLETED/FAILED subscription assertions + CorrectionCard onClose handler assertion).

## Decisions Made

1. **Pure-function in .ts sibling pattern.** When I first tried to dynamically import `CorrectionCard.tsx` from `node --test` for behavioral matrix tests, Node's native ESM resolver rejected `.tsx` with `ERR_UNKNOWN_FILE_EXTENSION`. The codebase test convention (per CLAUDE.md "Phase 27 locale tests avoid the JSON-import-attribute failure chain by importing i18next directly; follow the same pattern for any new pure-logic helpers") is to extract pure logic to a `.ts` file. Created `correction-actions.ts` with `getActionsForNode` + `CorrectionAction` type; CorrectionCard.tsx imports + re-exports both. Tests now import from the `.ts` directly; app code can still single-import from the `.tsx`.

2. **correctionNode stores release coordinates at mount time** — not the source node's DOM rect at render time. MindElixir's zoom/pan/relayout can move `me-tpc` elements between long-press release and the next paint frame; pinning the card to the release coords keeps the visual feel of "card popped up where my finger was."

3. **clampPlacement uses simple Math.min/Math.max + estimated height.** No `getBoundingClientRect` measurement or post-mount layout effect — the card's content sizes are predictable enough (44px header + 52px per action row, or 180px for rename form) that an estimated height suffices for the clamp. SSR guard short-circuits to the raw coords.

4. **handleCorrectionAction is a single switch with stubs for non-rename branches.** Plans 49-03 (delete + merge confirm) and 49-04 (pickMode for move/merge, prune snackbar, detach toast) will replace the stub cases. Today they `console.warn` and `setCorrectionNode(null)` — pragmatic so the card dismisses if a user taps an unimplemented action during dev.

5. **VALIDATION_ERROR fast-path is inline, all other failures close the card.** Rationale: VALIDATION_ERROR means "user input was invalid, fix and retry" — keep the form open. Any other code (NOT_FOUND, STORAGE_ERROR, etc.) means "something is wrong outside the user's input" — toast and dismiss so the user isn't stuck in a dead modal.

6. **Backdrop is sibling to the card, NOT a wrapping parent.** A wrapping parent would have positioned the card relative to the backdrop's containing block (the page), but the card's `position: absolute` already anchors to GraphScreen's containing block. Sibling backdrop with `position: fixed; inset: 0` gives the tap-outside capture without affecting card placement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Cannot dynamically import .tsx from node --test**
- **Found during:** Task 1 (running CorrectionCard.test.mjs after initial component write)
- **Issue:** Test 2–6b in the plan specify `const mod = await import('.../CorrectionCard.tsx')` for behavioral assertions on `getActionsForNode`. Node's native ESM resolver rejects `.tsx` with `ERR_UNKNOWN_FILE_EXTENSION` (no TSX loader is registered for the test runner; `.ts` works because the codebase has typescript ESM loader integration for it but `.tsx` does not).
- **Fix:** Extracted `getActionsForNode` and `CorrectionAction` to `app/src/components/graph/correction-actions.ts`; CorrectionCard.tsx imports + re-exports both. Updated all 6 matrix-test `await import(...)` calls to point at `correction-actions.ts`.
- **Files modified:** `app/src/components/graph/CorrectionCard.tsx` (removed duplicate function + type, added re-export); created `app/src/components/graph/correction-actions.ts`; updated `app/tests/components/graph/CorrectionCard.test.mjs` import paths.
- **Verification:** All 15 tests in `CorrectionCard.test.mjs` pass.
- **Committed in:** `772bb4ad` (Task 1).

**2. [Rule 2 — Missing Critical] Added i18n stubs for actions.close + rename.cancel that the plan did not explicitly list**
- **Found during:** Task 1 (CorrectionCard component implementation needed an aria-label for the X close button and a label for the rename Cancel button)
- **Issue:** Plan lists `graph.correction.rename.{placeholder,save,tooLong,empty}` but the Cancel button needs a label too; X close button needs an aria-label.
- **Fix:** Added `graph.correction.actions.close` and `graph.correction.rename.cancel` to all 4 locale bundles. Pattern matches the existing `graph.reorganizeModal.cancel` key.
- **Files modified:** `app/src/locales/{en,zh,es,ja}.json`.
- **Verification:** `bundle-parity.test.mjs` green; CorrectionCard test 13 ("no Tailwind") still green.
- **Committed in:** `772bb4ad` (Task 1).

**3. [Rule 1 — Bug] ServiceResult.error?.code conditional access TypeScript safety**
- **Found during:** Task 1 (running tsc -b --noEmit after the component write)
- **Issue:** Initial draft of `handleRenameSubmit` had `result.error.code === 'VALIDATION_ERROR'`; `ServiceResult<T>.error` is optional even on the `success: false` branch (it's not a discriminated union — same issue Plan 49-01 hit in deviation #3).
- **Fix:** Used `result.error?.code === 'VALIDATION_ERROR'` with the optional-chain operator. Also added `result.error?.message ?? t('graph.correction.toast.dropInvalid')` for the fallback toast.
- **Files modified:** `app/src/components/graph/CorrectionCard.tsx`.
- **Verification:** `tsc -b --noEmit` clean.
- **Committed in:** `772bb4ad` (Task 1).

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical, 1 Rule 3 blocker). None changed plan scope.

## Issues Encountered

- **The 16 remaining test:main failures are pre-existing scaffolds + 1 date-related flake** (per Plan 49-01 SUMMARY). They are owned by Plans 49-03, 49-04, 49-05 (Toast extension, ConfirmDialog, MergeConfirmPreview, PickModeBanner, UndoButton, delete confirm, detach, prune snackbar, reload survival) — these go GREEN as their plans land. The `tests/concept-feed.test.mjs` failure is the date-related flake documented in 49-01 SUMMARY's "Issues Encountered" section. Plan 49-02 did NOT auto-fix any of these per the Scope Boundary rule.

## i18n Stubs Inventory (for Plan 49-05 Sonnet reconciliation)

Added in this plan to all 4 locale bundles:

| Key | EN canonical | Plan 49-05 should re-translate? |
|---|---|---|
| `graph.correction.actions.rename` | "Rename" | ✅ (proper noun-free) |
| `graph.correction.actions.move` | "Move" | ✅ |
| `graph.correction.actions.merge` | "Merge" | ✅ |
| `graph.correction.actions.detach` | "Detach" | ✅ |
| `graph.correction.actions.prune` | "Prune" | ✅ |
| `graph.correction.actions.delete` | "Delete" | ✅ |
| `graph.correction.actions.close` | "Close" | ✅ |
| `graph.correction.rename.placeholder` | "New title" | ✅ |
| `graph.correction.rename.save` | "Save" | ✅ |
| `graph.correction.rename.cancel` | "Cancel" | ✅ |
| `graph.correction.rename.empty` | "Title cannot be empty" | ✅ |
| `graph.correction.rename.tooLong` | "Title cannot exceed 100 characters" | ✅ |
| `graph.correction.reorgPaused` | "Reorganizing — manual corrections paused" | ✅ |
| `graph.correction.toast.renamed` | "Renamed to \"{{title}}\"" | ✅ (preserve `{{title}}` interpolation) |

All zh/es/ja translations were authored in-line by Claude (operator + Sonnet pass in Plan 49-05 will refine).

## Final Shape of CorrectionCard Surface

```typescript
export type CorrectionAction =
  | { kind: 'rename' }
  | { kind: 'move' }
  | { kind: 'merge' }
  | { kind: 'detach' }
  | { kind: 'prune' }
  | { kind: 'delete' };

export interface CorrectionCardProps {
  node: Question;
  isReorganizing: boolean;
  onClose: () => void;
  onActionSelected: (action: CorrectionAction) => void;
  anchorX: number;  // long-press release viewport coord (px)
  anchorY: number;  // long-press release viewport coord (px)
}

export function getActionsForNode(node: Question): CorrectionAction[];
export function CorrectionCard(props: CorrectionCardProps): JSX.Element;
```

`handleCorrectionAction` shape in GraphScreen (for Plan 49-03 + 49-04 to extend):

```typescript
const handleCorrectionAction = useCallback((action: CorrectionAction) => {
  switch (action.kind) {
    case 'rename':
      return;  // CorrectionCard owns the inline rename commit + onClose
    case 'move':
    case 'merge':
    case 'prune':
    case 'detach':
    case 'delete':
      // Plan 49-02 stub — Plans 49-03 + 49-04 replace these branches.
      console.warn(`[Phase 49-02] correction action "${action.kind}" pending Plans 49-03/04`);
      setCorrectionNode(null);
      return;
  }
}, []);
```

## Confirmation: useLocation Was Added As a New Import

Pre-edit `grep -n "useLocation" src/screens/GraphScreen.tsx` returned no matches. Post-edit:
```typescript
import { useNavigate, useLocation } from 'react-router-dom';
// ...
const location = useLocation();
```
B-4 fix confirmed — `useLocation` is now imported AND its hook is invoked in the GraphScreen component body. Plan-checker B-4 directive satisfied.

## User Setup Required

None — no external configuration. All work is local React + state-management changes.

## Next Plan Readiness

- **Plan 49-03 unblocked.** ConfirmDialog + MergeConfirmPreview + extended Toast scaffolds remain failing; their source files don't exist yet. The dispatch surface (`onActionSelected` with `'delete'` and `'merge'` kinds) is ready — Plan 49-03 wires the confirm modals.
- **Plan 49-04 unblocked.** UndoButton + PickModeBanner + soft-prune snackbar + detach-toast scaffolds remain failing. The dispatch surface for `'move'`, `'merge'` (alternate menu+tap path), `'prune'`, `'detach'` is ready. Plan 49-04 also extends the always-mounted reset effect to clear pickMode.
- **Plan 49-05 unblocked.** i18n bundles need the full `graph.correction.*` namespace reconciliation via the Sonnet subagent; this plan added stubs for the keys it directly consumes. Plan 49-05's reload-survival harness scaffold is unchanged.
- **CLAUDE.md invariants preserved.** No new `transform`/`will-change`/`filter`/`contain` ancestors of `<Header>`; `data-no-swipe-nav="true"` untouched; `touchAction: 'none'` untouched; ChatInput flex-shrink rule N/A (RenameForm input has `width: 100%; minWidth: 0; flex: 1; boxSizing: border-box` so it shrinks correctly inside the card); no Tailwind utility classes in CorrectionCard.tsx.

## Self-Check: PASSED

All claimed artifacts verified to exist on disk:
- `/Users/Code/EchoLearn/app/src/components/graph/CorrectionCard.tsx` ✓
- `/Users/Code/EchoLearn/app/src/components/graph/correction-actions.ts` ✓
- `/Users/Code/EchoLearn/app/tests/components/graph/CorrectionCard.test.mjs` ✓ (modified)
- `/Users/Code/EchoLearn/app/tests/screens/GraphScreen.correction-card.test.mjs` ✓ (modified)
- `/Users/Code/EchoLearn/app/tests/screens/GraphScreen.reorg-gate.test.mjs` ✓ (modified)
- `/Users/Code/EchoLearn/app/src/locales/{en,zh,es,ja}.json` ✓ (modified)

All claimed commits verified in git log:
- `772bb4ad` feat(49-02): add CorrectionCard with per-node-type action matrix ✓
- `920d9399` feat(49-02): wire CorrectionCard into GraphScreen with reorg gate ✓

Test verification:
- `cd app && node --test tests/components/graph/CorrectionCard.test.mjs` → 15/15 pass ✓
- `cd app && node --test tests/screens/GraphScreen.correction-card.test.mjs` → 14/14 pass ✓
- `cd app && node --test tests/screens/GraphScreen.reorg-gate.test.mjs` → 4/4 pass ✓
- `cd app && npx tsc -b --noEmit` → clean ✓
- `cd app && npm run test:main` → 1032 pass, 16 fail (all pre-existing scaffolds owned by Plans 49-03/04/05 + 1 documented date-related flake; no regression vs. Plan 49-01 baseline) ✓
- `cd app && npx eslint src/components/graph/CorrectionCard.tsx src/components/graph/correction-actions.ts src/screens/GraphScreen.tsx` → clean ✓

---

*Phase: 49-graph-correction-ui*
*Completed: 2026-05-18*
