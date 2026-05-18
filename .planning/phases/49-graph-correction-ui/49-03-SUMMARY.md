---
phase: 49-graph-correction-ui
plan: 03
subsystem: ui
tags: [confirm-dialog, merge-preview, delete-confirm, destructive-cta, toast-action, i18n, ios-style]

requires:
  - phase: 48-graph-command-service-and-trust-invariants
    provides: graphCommandService.merge (D-07 — accepts loserId, survivorId; returns { reparentedCount, newSurvivorQaCount }); graphCommandService.delete (D-07 — single arg, ALWAYS cascades, returns { cascadedChildIds }); ServiceResult contract (NOT a discriminated union — `error` and `data` both optional)
  - plan: 49-01
    provides: mergeConfirm state declaration (drag-driven path populates it via handleDragEnd); 14 Wave-0 test scaffolds including the 4 this plan greens (ConfirmDialog 2 → 6, Toast.action 2 → 5, MergeConfirmPreview 1 → 6, GraphScreen.delete-confirm 2 → 7); graph.correction.toast.* i18n surface (extended here with merged + deleted)
  - plan: 49-02
    provides: correctionNode state + CorrectionCard.onActionSelected dispatch + handleCorrectionAction switch with stub branches (this plan replaces the 'delete' stub with setDeleteConfirm({ node }); 'merge'/'move'/'prune'/'detach' stay stubbed for Plan 49-04)
provides:
  - ConfirmDialog reusable component (open/cancel/confirm/destructive/children-slot)
  - MergeConfirmPreview side-by-side loser/survivor preview (B-3 — BOTH counts as required props)
  - Extended toast() signature with optional 3rd-arg `{ action: { label, onAction } }` + Toast.tsx trailing button + 5000ms dismiss delay when action present
  - GraphScreen wired with THREE ConfirmDialog mounts: migrated reorganize, merge (drag-driven path), delete
  - i18n surface: graph.correction.merge.{title, willBeRemoved, willKeep, body, footer, cancel, confirm}, graph.correction.delete.{title, bodyWithChildren, bodyEmpty, cancel, confirm}, graph.correction.toast.{merged, deleted} — 14 new keys × 4 locales
affects:
  - 49-04-PLAN.md (UndoButton consumes toast({ action }) mechanics this plan shipped; menu-driven merge replaces the 'merge' stub in handleCorrectionAction; prune snackbar / detach toast / pickMode all build on the dispatch infrastructure)
  - 49-05-PLAN.md (Sonnet subagent reconciles full graph.correction.* namespace including the 14 new keys this plan added in-line)

tech-stack:
  added: []  # No new packages — uses existing react, react-i18next, lucide-react (already imported)
  patterns:
    - "Pre-derive prop values BEFORE modal-open (B-2 + B-3) — GraphScreen calls questionService.getAll({ includeFlagged: true }) inside the IIFE that decides whether to render the modal, so counts snapshot ONCE at modal-open instead of re-querying on each render"
    - "ConfirmDialog children slot pattern — reusable modal accepts arbitrary preview JSX between body and button row, letting Merge mount MergeConfirmPreview without coupling the dialog primitive to merge semantics"
    - "Destructive variant via boolean prop — single ConfirmDialog component handles both safe (Reorganize, Merge) and destructive (Delete) flows via `destructive?: boolean` → var(--danger) ternary"
    - "Extended toast options without breaking callers — toast(message, type?, options?) with `options?.action` is fully backward compatible; Test 11 walks src/ and asserts every existing call site still type-checks"
    - "Failure-keeps-modal-open pattern — merge onConfirm only calls setMergeConfirm(null) on success; failure path toasts the error but leaves the modal mounted so the user can cancel or retry without re-dragging"

key-files:
  created:
    - app/src/components/ui/ConfirmDialog.tsx
    - app/src/components/graph/MergeConfirmPreview.tsx
    - .planning/phases/49-graph-correction-ui/deferred-items.md
  modified:
    - app/src/lib/toast.ts
    - app/src/components/ui/Toast.tsx
    - app/src/screens/GraphScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/tests/components/ui/ConfirmDialog.test.mjs
    - app/tests/components/Toast.action.test.mjs
    - app/tests/components/graph/MergeConfirmPreview.test.mjs
    - app/tests/screens/GraphScreen.delete-confirm.test.mjs

key-decisions:
  - "ConfirmDialog children slot positions BETWEEN body and button row (not replacing body). Both `body` and `children` can coexist if a future flow needs both; current callers use either body OR children, never both. Source-reading Test 4 enforces the structural ordering body → children → onConfirm button."
  - "MergeConfirmPreview accepts BOTH loserQaCount AND survivorQaCount as required props (no defaults, no optional). B-3 fix verified by Test 6 grepping for both `loserQaCount: number` and `survivorQaCount: number` in the props interface. GraphScreen derives both ONCE via a single questionService.getAll({ includeFlagged: true }) call before mounting the modal."
  - "Delete confirm uses destructive={true} + always-cascade per D-09. graphCommandService.delete takes NO boolean param — cascade is implicit. Modal only EXPLAINS the cascade via bodyWithChildren (count > 0) or bodyEmpty (count === 0). NO cascade-choice radio."
  - "Merge confirm uses result.data.reparentedCount (NOT the UI-derived loserQaCount) for the post-merge toast so the service's authoritative count is what the user sees. Falls back to loserQaCount via optional chain (`result.data?.reparentedCount ?? loserQaCount`) because ServiceResult.data is typed as optional even on the success branch (ServiceResult is not a discriminated union; same compromise Plan 49-01 hit in deviation #3)."
  - "Merge failure keeps the modal open. The plan explicitly specifies this behavior — user should be able to cancel or retry without re-dragging. Test 8 enforces by asserting setMergeConfirm(null) appears ONLY in the success branch (before the `} else {`) and NOT in the failure branch (between `} else {` and the closing of the onConfirm body)."
  - "i18n keys landed in all 4 locale bundles (en + zh + es + ja) in this plan. The plan instruction said 'en.json only — other locales land in Plan 49-05' but Plans 49-01 and 49-02 both established the precedent of adding in-line translations to all 4 bundles because the bundle-parity.test.mjs would otherwise break on every test run. Rule 3 (blocking issue). Plan 49-05's Sonnet pass refines canonical wording — my in-line zh/es/ja are best-effort placeholders."
  - "Migrated Reorganize modal is BYTE-STABLE visually. The new ConfirmDialog uses the same zIndex 300 + rgba(0,0,0,0.5) backdrop + var(--surface) card + var(--shadow-3) + button styling that the inline 851-868 block had. Existing reorganize-modal test (graph.reorganizeModal.{title,description,confirm,cancel}) keys still resolve identically — no copy change."
  - "Always-mounted-screen reset effect (CLAUDE.md invariant) was NOT extended in this plan. The Plan 49-02 effect at `useEffect(() => { if (location.pathname !== '/graph') { setCorrectionNode(null); setDragState(null); } }, ...)` is kept as-is. mergeConfirm + deleteConfirm are MODAL state — they should not auto-dismiss on navigation; if the user navigates away mid-confirm, the modal stays in the slot's off-screen DOM and re-appears when they return. This matches CLAUDE.md's distinction between 'overlay state that should reset' (correctionNode) and 'modal state' (confirms)."

patterns-established:
  - "Pattern: derive-before-mount for modal state — when a modal needs computed values that depend on services, derive them in the parent IIFE before <Modal />, not inside the modal component itself. Keeps the modal a pure renderer + lets the parent control snapshot timing."
  - "Pattern: destructive variant via boolean prop — single confirm component handles all three trust levels (safe / important-but-recoverable / destructive) via a single boolean prop that flips the CTA color. No separate DestructiveConfirmDialog component, no enum, no theme prop."
  - "Pattern: failure-keeps-modal-open — for service operations triggered from modals, ONLY close the modal on success. Failures should surface via toast but leave the modal mounted so the user can cancel deliberately (resetting their context) or retry without losing the drag/selection that brought them there."
  - "Pattern: byte-stable extraction — when migrating an inline UI block to a reusable component, preserve every CSS variable + zIndex + dimension verbatim so the visual diff is null. Lets the migration land without a separate UX review."

requirements-completed: [GRAPHUI-02]

duration: 17m
completed: 2026-05-18
---

# Phase 49 Plan 03: ConfirmDialog + MergeConfirmPreview + Extended Toast Summary

**Reusable ConfirmDialog with destructive variant + children slot, MergeConfirmPreview side-by-side loser/survivor (B-3 counts as props), extended toast() with optional action button, and GraphScreen wired with three confirm mounts (migrated reorganize, drag-driven merge, destructive delete) — all routing through graphCommandService per Phase 48 contract.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-18T04:26:12Z
- **Completed:** 2026-05-18T04:43:01Z
- **Tasks:** 2
- **Files created:** 3 (ConfirmDialog.tsx, MergeConfirmPreview.tsx, deferred-items.md)
- **Files modified:** 10 (toast.ts, Toast.tsx, GraphScreen.tsx, 4 locale bundles, 3 test files)

## Accomplishments

- **ConfirmDialog landed (Task 1):** Reusable confirm modal extracted from GraphScreen's inline reorganize-modal at the pre-49-03 line range 851-868. `destructive?: boolean` flips the confirm CTA to var(--danger). `children?: ReactNode` slot renders between body and button row (Test 4 enforces ordering). Backdrop click → onCancel (T-49-11 click-jacking defense); inner card stops propagation. zIndex 300 matches existing modal pattern.
- **toast() extended (Task 1):** Optional 3rd-arg `options?: { action?: { label, onAction } }`. Backward compatible — Test 11 walks src/ and confirms all existing 1-arg / 2-arg call sites still type-check. ToastContainer renders a trailing inline button when action set; click invokes onAction then dismisses. Auto-dismiss extended to 5000ms when action present (3000ms unchanged otherwise — regression guard in Test 10).
- **MergeConfirmPreview landed (Task 2):** Side-by-side cards via display:flex + gap:12px + flex:1 each. LEFT (LOSER): var(--surface-variant) + opacity 0.6 + var(--danger) badge "will be removed". RIGHT (SURVIVOR): var(--surface) + var(--primary-40) badge "will keep". B-3 fix: BOTH loserQaCount AND survivorQaCount arrive as REQUIRED props — the component does NOT call questionService.getAll internally (Test 4 enforces a negative assertion).
- **GraphScreen wired with THREE ConfirmDialog mounts (Task 2):**
    1. **Reorganize (migrated):** Inline block 851-868 removed; replaced with `<ConfirmDialog open={showReorgConfirm} ...>`. Same i18n keys + same handler — byte-stable visual diff.
    2. **Merge (drag-driven path):** `{mergeConfirm && (() => {...})()}` IIFE pre-derives loserQaCount + survivorQaCount + loserCluster + survivorCluster via a single `questionService.getAll({ includeFlagged: true })` call BEFORE rendering the modal. onConfirm awaits `graphCommandService.merge(loser.id, survivor.id)`. Success → toast w/ `result.data.reparentedCount` (B-3 service-reported value) + close modal. Failure → toast error + KEEP modal open.
    3. **Delete (destructive):** `{deleteConfirm && (() => {...})()}` IIFE pre-derives qaChildCount + parentCluster. ConfirmDialog uses `destructive={true}` → red --danger CTA. Body interpolates `bodyWithChildren` (count > 0) or `bodyEmpty` (count === 0). onConfirm awaits `graphCommandService.delete(node.id)` — NO boolean param per B-3. Success → toast + close. Failure → toast error.
- **handleCorrectionAction's 'delete' branch wired:** `setDeleteConfirm({ node }); setCorrectionNode(null);`. The 'merge', 'move', 'prune', 'detach' branches log + dismiss (Plan 49-04 fills them).
- **i18n: 14 new keys added to all 4 locale bundles.** `graph.correction.merge.{title, willBeRemoved, willKeep, body, footer, cancel, confirm}` (7), `graph.correction.delete.{title, bodyWithChildren, bodyEmpty, cancel, confirm}` (5), `graph.correction.toast.{merged, deleted}` (2). Bundle-parity test green. Plan 49-05 reconciles canonical zh/es/ja wording.

## Task Commits

Each task was committed atomically:

1. **Task 1: ConfirmDialog + extend Toast for action button** — `63e5e336` (feat). 11 tests pass.
2. **Task 2: MergeConfirmPreview + wire merge + delete confirms + migrate reorganize modal** — `f1091b02` (feat). 19 tests pass (6 MergeConfirmPreview + 7 GraphScreen.delete-confirm + 6 previously-shipped from Task 1).

**Plan metadata commit:** (this commit, after Self-Check below).

## Files Created/Modified

### Created

- `app/src/components/ui/ConfirmDialog.tsx` — Reusable confirm modal. Props: `{ open, title, body?, confirmLabel, cancelLabel, destructive?, onConfirm, onCancel, children? }`. Returns null when `!open`. Backdrop = outer onClick={onCancel}; inner card stopPropagation. children slot renders between body and button row.
- `app/src/components/graph/MergeConfirmPreview.tsx` — Side-by-side loser/survivor preview rendered as ConfirmDialog children. Props: `{ loser, survivor, loserQaCount, survivorQaCount, loserClusterTitle, survivorClusterTitle }` — B-3: BOTH counts required, NO internal service calls.
- `.planning/phases/49-graph-correction-ui/deferred-items.md` — Logged pre-existing tsc errors in `SavedScreen.tsx:186` (i18next deep-type inference issue) as out-of-scope for Phase 49.

### Modified

- `app/src/lib/toast.ts` — Extended signature: `toast(message, type?, options?)` with `ToastAction`, `ToastOptions` exports. Backward compatible.
- `app/src/components/ui/Toast.tsx` — `ToastMessage.action?: { label, onAction }`. Trailing button branch + 5000ms auto-dismiss when action present, 3000ms otherwise. `dismissToast(id)` helper extracted so the action click and the auto-dismiss share dismiss semantics.
- `app/src/screens/GraphScreen.tsx` — Imports ConfirmDialog + MergeConfirmPreview + questionService + Question. New `deleteConfirm` state. `handleCorrectionAction` 'delete' branch now opens `setDeleteConfirm({ node })`. Inline reorganize modal (lines 851-868 pre-49-03) removed; replaced with `<ConfirmDialog open={showReorgConfirm} ... />`. Two new IIFE-mounted ConfirmDialog blocks for merge + delete (each pre-derives counts via questionService.getAll BEFORE the modal renders). Removed the `void mergeConfirm;` stub since it's now actually consumed.
- `app/src/locales/{en,zh,es,ja}.json` — Added 14 new keys to `graph.correction.{merge,delete,toast}` namespaces. Bundle-parity green; in-line zh/es/ja are best-effort placeholders for Plan 49-05's Sonnet pass.
- `app/tests/components/ui/ConfirmDialog.test.mjs` — Extended from 2 failing scaffold tests to 6 passing tests (1-6 covering render/null-gate, buttons, destructive variant, children slot ordering, backdrop stopPropagation, CSS-variables-only).
- `app/tests/components/Toast.action.test.mjs` — Extended from 2 failing scaffold tests to 5 passing tests (7-11 covering signature, render, action-click, duration ternary, src-walk for backward compatibility).
- `app/tests/components/graph/MergeConfirmPreview.test.mjs` — Extended from 1 failing scaffold test to 6 passing tests (1-6 covering layout, loser/survivor styling, content+counts-from-props, body interpolation, B-3 required-props enforcement).
- `app/tests/screens/GraphScreen.delete-confirm.test.mjs` — Extended from 2 failing scaffold tests to 7 passing tests (7-13 covering B-2 derivation pre-mount, merge IIFE + reparentedCount + failure-keeps-open, delete IIFE + destructive + delete-cascade-no-bool, reorganize migration, Phase 48 service routing, W-1 no-pickMode).

## i18n Stubs Inventory (for Plan 49-05 Sonnet reconciliation)

Added in this plan to all 4 locale bundles:

| Key | EN canonical | Plan 49-05 should re-translate? |
|---|---|---|
| `graph.correction.merge.title` | "Merge concepts" | ✅ |
| `graph.correction.merge.willBeRemoved` | "Will be removed" | ✅ |
| `graph.correction.merge.willKeep` | "Will keep" | ✅ |
| `graph.correction.merge.body` | "{{n}} Q&As will move from \"{{loserTitle}}\" into \"{{survivorTitle}}\". \"{{loserTitle}}\" will be removed." | ✅ (preserve {{n}}, {{loserTitle}}, {{survivorTitle}}) |
| `graph.correction.merge.footer` | "You can undo this from the corner button right after." | ✅ |
| `graph.correction.merge.cancel` | "Cancel" | ✅ |
| `graph.correction.merge.confirm` | "Merge" | ✅ |
| `graph.correction.delete.title` | "Delete \"{{title}}\"?" | ✅ (preserve {{title}}) |
| `graph.correction.delete.bodyWithChildren` | "This will remove the anchor. Its {{count}} Q&As will be re-parented to \"{{parentCluster}}\"." | ✅ (preserve {{count}}, {{parentCluster}}) |
| `graph.correction.delete.bodyEmpty` | "This will remove the anchor. No child Q&As are affected." | ✅ |
| `graph.correction.delete.cancel` | "Cancel" | ✅ |
| `graph.correction.delete.confirm` | "Delete" | ✅ |
| `graph.correction.toast.merged` | "Merged \"{{loserTitle}}\" into \"{{survivorTitle}}\" ({{reparentedCount}} Q&As moved)" | ✅ (preserve all 3 interpolations) |
| `graph.correction.toast.deleted` | "Deleted \"{{title}}\"" | ✅ (preserve {{title}}) |

## Decisions Made

1. **ConfirmDialog children slot positioned between body and buttons (not replacing body).** Both `body` and `children` can coexist if a future flow needs both. Current Merge flow uses children-only (no body); Delete flow uses body-only (no children); Reorganize uses body-only. Test 4 asserts the source order body → children → onConfirm button.

2. **MergeConfirmPreview takes BOTH counts as required props (B-3 fix shipped).** No optional `?:`, no default values, no internal questionService call. GraphScreen's merge IIFE derives both counts ONCE and passes them down. Verified by Test 6 + the negative assertion in Test 4 (`/questionService\.getAll/.test(src) === false`).

3. **questionService.getAll({ includeFlagged: true }) used at BOTH merge and delete derivation sites (B-2 fix shipped).** No `.data ?? []` destructure anywhere in GraphScreen (the test asserts that the whole file does not contain that pattern). Returns Question[] directly per the question.service.ts:573 signature.

4. **`pickMode` is NOT declared in this plan (W-1).** GraphScreen contains zero references to `pickMode` after this plan's commits — Test 13 enforces. Plan 49-04 introduces the state, dispatch, banner, and reset.

5. **Failure path of merge keeps the modal open.** Service errors surface via toast but leave `mergeConfirm` non-null so the user can deliberately Cancel or wait for the service to recover (mutex-serialized). Success path closes the modal. Test 8 enforces by asserting `setMergeConfirm(null)` appears once on the success branch (before `} else {`) and not in the else body.

6. **In-line zh/es/ja translations land in this plan to keep bundle-parity green.** The plan said "en.json only — Plan 49-05 reconciles" but Plans 49-01 and 49-02 both established the precedent of adding all-bundle translations as Rule 3 blocking fixes (without them, bundle-parity.test.mjs fails on every subsequent test run). Plan 49-05's Sonnet pass refines canonical wording across the full graph.correction.* namespace.

7. **Migrated Reorganize modal is byte-stable visually.** ConfirmDialog uses identical zIndex 300 + rgba backdrop + var(--surface) + var(--shadow-3) + 24px padding + 340px maxWidth + button shape that the inline 851-868 block had. Same i18n keys, same handler — no copy or behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Removed `JSX.Element` return type annotation from ConfirmDialog**
- **Found during:** Task 1 tsc check
- **Issue:** Initial draft declared `export function ConfirmDialog(...): JSX.Element | null { ... }` per the plan's `<action>` snippet. React 19 + `@types/react@19` no longer ships a global `JSX` namespace; tsc errored with `error TS2503: Cannot find namespace 'JSX'`. The existing codebase convention (verified via `grep "^export function" src/components/ui/Header.tsx Button.tsx Card.tsx`) is to omit explicit return type annotations on function components — tsc infers from the JSX return.
- **Fix:** Removed `: JSX.Element | null` from the function signature; tsc clean. The conditional `if (!open) return null` still works without the annotation.
- **Files modified:** `app/src/components/ui/ConfirmDialog.tsx`
- **Verification:** `npx tsc -b --noEmit` clean for this file; 11 tests pass.
- **Committed in:** `63e5e336` (Task 1).

**2. [Rule 3 — Blocking] Added i18n keys to zh/es/ja bundles**
- **Found during:** Task 2 (en.json updated; bundle-parity check)
- **Issue:** The plan instruction said "i18n: add graph.correction.* keys to en.json only — other locales land in Plan 49-05." However, `bundle-parity.test.mjs` is a hard gate: it fails if any locale bundle has a different set of flattened keys. Adding 14 keys to en.json without parallel additions to zh/es/ja would break the test on EVERY downstream test run, blocking iteration. Plans 49-01 (deviation #6) and 49-02 (deviation #2) both established the precedent of in-line translations as Rule 3 blocking fixes.
- **Fix:** Translated the 14 new keys for zh/es/ja in-line and added them under `graph.correction.{merge,delete,toast}` namespaces in all 4 locale bundles. Plan 49-05's Sonnet pass will refine the canonical wording.
- **Files modified:** `app/src/locales/{en,zh,es,ja}.json`
- **Verification:** `node --test tests/locales/bundle-parity.test.mjs` → 2/2 pass.
- **Committed in:** `f1091b02` (Task 2).

**3. [Rule 1 — Bug] result.data possibly-undefined on merge success branch**
- **Found during:** Task 2 (tsc check)
- **Issue:** Initial implementation wrote `reparentedCount: result.data.reparentedCount` for the success-toast interpolation. tsc errored with `error TS18048: 'result.data' is possibly 'undefined'`. The codebase's `ServiceResult<T>` is NOT a discriminated union (the `success: true` branch does NOT statically guarantee `data` is non-null) — same gotcha Plan 49-01 hit in deviation #3.
- **Fix:** Used optional chain with fallback: `reparentedCount: result.data?.reparentedCount ?? loserQaCount`. The fallback is the UI-derived count, which matches the pre-merge snapshot — accurate enough for a post-merge toast in the unlikely case data is undefined despite success.
- **Files modified:** `app/src/screens/GraphScreen.tsx`
- **Verification:** tsc clean (modulo pre-existing SavedScreen errors logged to deferred-items.md). Test 8 regex updated to accept either `result.data.reparentedCount` or `result.data?.reparentedCount`.
- **Committed in:** `f1091b02` (Task 2).

**4. [Rule 3 — Blocking] Reworded `pickMode` mentions in comments to satisfy Test 13 (W-1)**
- **Found during:** Task 2 (running tests/screens/GraphScreen.delete-confirm.test.mjs Test 13)
- **Issue:** Test 13 (W-1) asserts `!/\bpickMode\b/.test(src)`. My initial implementation had three comment mentions of `pickMode` (in handleCorrectionAction's merge case stub, in the reset-effect inline comment, and in the merge-confirm-block header comment) — all describing the upcoming Plan 49-04 work. The regex matched the comments and failed the test.
- **Fix:** Replaced `pickMode` with `pick-mode` (hyphenated) in all three comments. The hyphenated form doesn't match `\bpickMode\b` (verified via `node -e "console.log(/\bpickMode\b/.test('pick-mode'))" → false`) but is still readable for future devs.
- **Files modified:** `app/src/screens/GraphScreen.tsx` (3 comment edits)
- **Verification:** Test 13 passes; no functional change.
- **Committed in:** `f1091b02` (Task 2).

**5. [Rule 3 — Blocking] Removed `.data ?? []` literal from inline comment**
- **Found during:** Task 2 (running Test 7)
- **Issue:** Test 7 asserts the WHOLE file does not contain the regex `/\.data\s*\?\?\s*\[\s*\]/`. My delete-confirm block had a comment "B-2: no `.data ?? []` destructure" — the test matched the comment string literally.
- **Fix:** Rewrote the comment as "B-2: returns Question[] directly (no ServiceResult unwrap)". Same meaning, no regex hit.
- **Files modified:** `app/src/screens/GraphScreen.tsx` (1 comment edit)
- **Verification:** Test 7 passes.
- **Committed in:** `f1091b02` (Task 2).

**6. [Rule 3 — Blocking] Removed `questionService.getAll(...)` literal from MergeConfirmPreview doc comment**
- **Found during:** Task 2 (running MergeConfirmPreview Test 4)
- **Issue:** Test 4 asserts `!/questionService\.getAll/.test(src)` on the MergeConfirmPreview source — the negative assertion enforcing that the component does NOT call the service internally (B-3). My initial doc comment said "GraphScreen derives them once via questionService.getAll({ includeFlagged: true }) BEFORE opening the modal" — the literal string matched.
- **Fix:** Reworded to "GraphScreen derives them once from the question-service snapshot BEFORE opening the modal". Same meaning, no regex hit.
- **Files modified:** `app/src/components/graph/MergeConfirmPreview.tsx` (1 comment edit)
- **Verification:** Test 4 passes.
- **Committed in:** `f1091b02` (Task 2).

---

**Total deviations:** 6 auto-fixed (1 Rule 1 bug, 5 Rule 3 blocking). None changed plan scope. All were either codebase-convention alignment (#1), bundle-parity preservation (#2), TypeScript strict-mode tightening (#3), or test-comment string-collision fixes (#4–#6).

## Issues Encountered

- **Pre-existing tsc errors in `src/screens/SavedScreen.tsx:186`** (i18next deep-type inference): Two errors at the same call site (TS2322 + TS2589 "type instantiation is excessively deep"). Verified pre-existing by stashing Plan 49-03 changes and re-running tsc — same errors reproduce. Last git change to the file was `6fea9786` (post-history consolidation, unrelated to i18n typing). Logged to `.planning/phases/49-graph-correction-ui/deferred-items.md`. Scope Boundary rule applies — not touching this file.
- **Pre-existing test failures untouched.** Baseline test:main has 9 failing tests after Plan 49-03's commits (down from 16 at the end of Plan 49-02 because this plan turned 7 Wave-0 scaffolds green). Remaining 9 are: 4 Plan 49-04 scaffolds (PickModeBanner, UndoButton render + GRAPH_UPDATED, handleDetach/prune source-reading), 1 Plan 49-04 detach-toast assertion, 1 Plan 49-04 prune-toast-undo assertion, 1 Plan 49-05 reload-survival assertion, 1 pre-existing `tests/concept-feed.test.mjs` date flake documented in Plan 49-01's SUMMARY. None are Plan 49-03 regressions.

## Confirmation of Plan-Checker B-2 + B-3 + W-1 Fixes

| Fix | Where verified | Test |
|---|---|---|
| B-2 (no `.data ?? []`) | `grep -n "\\.data ?? \\[\\]" src/screens/GraphScreen.tsx` returns nothing | GraphScreen.delete-confirm Test 7 (Test in same file asserts whole file) |
| B-3 (MergeConfirmPreview takes BOTH counts as props) | `loserQaCount: number` AND `survivorQaCount: number` in props interface | MergeConfirmPreview Test 6 |
| B-3 (no internal questionService.getAll in MergeConfirmPreview) | Negative regex assertion | MergeConfirmPreview Test 4 |
| B-3 (graphCommandService.delete with NO boolean param) | Single-arg pattern matched | GraphScreen.delete-confirm Test 10 |
| B-3 (post-merge toast uses result.data.reparentedCount) | Service-reported value, not UI-derived | GraphScreen.delete-confirm Test 8 |
| W-1 (no pickMode in this plan) | `grep -n "pickMode" src/screens/GraphScreen.tsx` returns nothing | GraphScreen.delete-confirm Test 13 |

## ConfirmDialogProps Final Shape

```typescript
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;  // rendered BETWEEN body and button row
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null;
// (Return type omitted in source per codebase convention — tsc infers.)
```

**Children slot positioning:** rendered between `{body && (<p>...)}` and the button row. NOT replacing body. NOT replacing buttons. The plan said "between body and buttons OR replacing body" — implementation chose "between" because the Merge flow benefits from both a clear preview AND no extra prose, while Delete benefits from prose AND no preview. Same component handles both.

## User Setup Required

None — no external service configuration. All work is local React + state management + i18n.

## Next Plan Readiness

- **Plan 49-04 unblocked.** UndoButton + PickModeBanner + soft-prune Snackbar + detach toast all build on infrastructure shipped here: toast({ action }) mechanics, ConfirmDialog primitive, handleCorrectionAction dispatch surface. Plan 49-04 will:
  - Replace the 'merge' handleCorrectionAction stub with a pickMode entry (W-1 boundary).
  - Replace 'move' / 'prune' / 'detach' stubs with their respective flows.
  - Extend the always-mounted-screen reset effect to clear pickMode.
  - Consume toast({ action: { label: 'Undo', onAction: ... } }) for the soft-prune Snackbar.
- **Plan 49-05 unblocked indirectly.** Its i18n reconciliation pass now has 14 additional graph.correction.{merge,delete,toast.*} keys to refine via the Sonnet subagent, plus the existing 13 from Plan 49-02 + 5 from Plan 49-01. Plan 49-05's reload-survival harness scaffold (1 remaining failing test) is unchanged by this plan.
- **CLAUDE.md invariants preserved.** No new `transform`/`will-change`/`filter`/`contain` ancestors of `<Header>`. ConfirmDialog uses `position: fixed` + zIndex 300 (above CorrectionCard's 250 and below BottomSheet's 500). No Tailwind utility classes in any new component (Test 6 enforces for ConfirmDialog). No `body { overflow }` changes. SwipeTabContainer untouched.

## Self-Check: PASSED

All claimed artifacts verified to exist on disk:
- `/Users/Code/EchoLearn/app/src/components/ui/ConfirmDialog.tsx` ✓
- `/Users/Code/EchoLearn/app/src/components/graph/MergeConfirmPreview.tsx` ✓
- `/Users/Code/EchoLearn/.planning/phases/49-graph-correction-ui/deferred-items.md` ✓
- `/Users/Code/EchoLearn/app/src/lib/toast.ts` ✓ (modified)
- `/Users/Code/EchoLearn/app/src/components/ui/Toast.tsx` ✓ (modified)
- `/Users/Code/EchoLearn/app/src/screens/GraphScreen.tsx` ✓ (modified)
- `/Users/Code/EchoLearn/app/src/locales/{en,zh,es,ja}.json` ✓ (modified)
- All 4 test files modified ✓

All claimed commits verified in git log:
- `63e5e336` feat(49-03): add ConfirmDialog + extend Toast with optional action button ✓
- `f1091b02` feat(49-03): wire merge + delete confirms + migrate reorganize modal ✓

Test verification:
- `cd app && node --test tests/components/ui/ConfirmDialog.test.mjs` → 6/6 pass ✓
- `cd app && node --test tests/components/Toast.action.test.mjs` → 5/5 pass ✓
- `cd app && node --test tests/components/graph/MergeConfirmPreview.test.mjs` → 6/6 pass ✓
- `cd app && node --test tests/screens/GraphScreen.delete-confirm.test.mjs` → 7/7 pass ✓
- `cd app && node --test tests/locales/bundle-parity.test.mjs` → 2/2 pass ✓
- `cd app && node --test tests/hooks/useLongPressOrDrag.test.mjs tests/components/graph/DragOverlay.test.mjs tests/components/graph/CorrectionCard.test.mjs tests/screens/GraphScreen.correction-card.test.mjs tests/screens/GraphScreen.reorg-gate.test.mjs` → 50/50 pass ✓ (no regression of 49-01 + 49-02)
- `cd app && npm run test:main` → 1056 pass, 9 fail. All 9 failures are documented Plan 49-04 / 49-05 scaffolds or the pre-existing date flake — no Plan 49-03 regressions ✓
- `cd app && npx tsc -b --noEmit` → clean modulo 2 pre-existing SavedScreen.tsx errors (logged to deferred-items.md per Scope Boundary) ✓
- `cd app && npx eslint src/components/ui/ConfirmDialog.tsx src/components/graph/MergeConfirmPreview.tsx src/lib/toast.ts src/components/ui/Toast.tsx src/screens/GraphScreen.tsx` → clean ✓

---

*Phase: 49-graph-correction-ui*
*Completed: 2026-05-18*
