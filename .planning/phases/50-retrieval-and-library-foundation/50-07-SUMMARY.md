---
phase: 50-retrieval-and-library-foundation
plan: 07
subsystem: ui-components
tags: [longpressmenu, collection-picker, drill-in, byte-stable-visual, graceful-degradation, undo-affordance]
requires:
  - app/src/components/LongPressMenu.tsx (Phase 43 — existing 3-row engagement menu)
  - app/src/services/collection.service.ts (Plan 50-03 — addPost / removePost; emits COLLECTIONS_CHANGED)
  - app/src/lib/toast.ts (Plan 49-03 — 3rd-arg ToastOptions.action {label, onAction})
  - app/src/locales/{en,zh,es,ja}.json library.collections.{removeFromCollection,toast.removed} keys (Plan 50-02)
provides:
  - LongPressMenu prop `onOpenCollectionPicker?: (postId: string) => void` (D-04 picker-opener Save)
  - LongPressMenu prop `collectionContext?: { collectionId: string; collectionName: string }` (drill-in Remove row)
  - common.undo i18n key across all 4 locale bundles (canonical Undo affordance label)
affects:
  - app/src/screens/HomeScreen.tsx — existing LongPressMenu callsite continues to work unchanged (no new props passed; graceful-degradation path preserved); plan 50-09 will wire onOpenCollectionPicker
  - app/src/screens/CollectionDrillInScreen.tsx — plan 50-08 will host LongPressMenu with both new props
tech-stack:
  added: []
  patterns:
    - "Optional props for forward-compat extension (graceful degradation): adding a new prop as `?:` instead of required keeps every existing callsite compiling without churn — matches Phase 43 LongPressMenu host-state-lifting and Phase 49 toast() 3rd-arg extension"
    - "Source-reading invariants: tests grep the .tsx file for prop signatures, ordering (handleSave calls onOpenCollectionPicker BEFORE onClose), and anti-wire violations — same Phase 43 pattern (tests/components/LongPressMenu.test.mjs) reused"
    - "React 19 state-batching as sheet-flash prevention: state setter (onOpenCollectionPicker) called BEFORE onClose() in the same handler so both renders happen in one cycle (Pitfall 4)"
key-files:
  created: []
  modified:
    - app/src/components/LongPressMenu.tsx
    - app/tests/components/LongPressMenu.test.mjs
    - app/src/locales/en.json (added common.undo)
    - app/src/locales/zh.json (added common.undo)
    - app/src/locales/es.json (added common.undo)
    - app/src/locales/ja.json (added common.undo)
decisions:
  - "Add `common.undo` to all 4 locale bundles (vs reuse `graph.correction.actions.undo`): canonical Undo label belongs in the common namespace because the Phase 50 toast is a library-level affordance, not a graph-correction action. All 4 translations seeded from the existing `graph.correction.actions.undo` values (Undo / 撤销 / Deshacer / 元に戻す) — bundle-parity test still green."
  - "Undo handler calls `collectionService.addPost` only — NOT a manual `eventBus.emit({ type: 'COLLECTIONS_CHANGED', ... })`. PATTERNS.md sketched a manual emit, but `addPost` already emits on real additions (collection.service.ts:232-235). Duplicate emits would desync subscribers (CLAUDE.md `One signal per semantic event`) and would also fail the anti-wire test (`eventBus.emit` count must be 0)."
metrics:
  duration: ~3 minutes wall clock (tight TDD cycle — one RED commit, one GREEN commit)
  completed: 2026-05-18
---

# Phase 50 Plan 50-07: LongPressMenu API extension Summary

## One-liner

Added two optional props to LongPressMenu — `onOpenCollectionPicker` (D-04 picker-opener Save behavior) and `collectionContext` (drill-in Remove-from-collection row) — with the existing 3-row feed-tile contract preserved as the graceful-degradation default.

## What changed

### `LongPressMenu.tsx`

**Props interface extended** (additive only — both new fields are optional):

```typescript
interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
  onOpenCollectionPicker?: (postId: string) => void;                          // NEW — D-04
  collectionContext?: { collectionId: string; collectionName: string };        // NEW — drill-in context
}
```

**`handleSave` branches on `onOpenCollectionPicker` presence:**

- **Provided** (HomeScreen wave 50-09, CollectionDrillInScreen 50-08): calls `onOpenCollectionPicker(postId)` FIRST, then `onClose()`. The picker-state-setter-before-closer ordering is the Pitfall 4 fix — React 19 batches both state updates in one render cycle so CollectionPickerSheet mounts as LongPressMenu unmounts. No blank frame.
- **Absent** (every current callsite, including HomeScreen.tsx:1053 today): legacy direct-toggle path retained — `engagementService.savePost` / `removeSavedPost` + matching toast. This is the graceful-degradation contract; existing tests still pass.

**Save row visual is byte-stable.** Same Bookmark icon, same `isSaved`-driven fill (`currentColor` vs `none`), same `var(--primary-40)` accent when saved, same Save/Unsave label semantics. No new spacing, color, or font added. The label slot does NOT change to "Save to..." — the row's surface-level identity stays identical so existing CSS/layout tests (e.g., 56px minHeight) continue to hold.

**New Remove-from-collection row** (conditional on `collectionContext`):

- Rendered between Save and Not Interested → final order in drill-in context: Like → Save → Remove from collection → Not Interested.
- `FolderMinus` icon from lucide-react, `size={22}`, `color="var(--foreground)"`, `fill="none"`.
- Label: `t('library.collections.removeFromCollection')` (already in all 4 locales per 50-02).
- Tap fires `collectionService.removePost(collectionContext.collectionId, postId)` + a toast `t('library.collections.toast.removed', { collection: collectionContext.collectionName })` with an Undo action that calls `collectionService.addPost(collectionId, postId)`.

**Non-destructive.** Per UI-SPEC §Color rules + 50-CONTEXT D-07, removing a post from a collection does NOT remove it from Saved/History — only this collection's membership clears. No confirmation dialog; the Undo toast covers accidental taps.

### Locale bundles

Added `common.undo` to all 4 bundles (`en`/`zh`/`es`/`ja`). The Phase 27 i18n workflow demands all locales in the same PR; `bundle-parity` test (run during verify) confirms identical key sets across the 4 files.

| Locale | Translation |
|--------|-------------|
| en     | Undo        |
| zh     | 撤销         |
| es     | Deshacer    |
| ja     | 元に戻す      |

Canonical translations cloned from the existing `graph.correction.actions.undo` entries (the only prior `undo` key in the project), reviewed for cross-locale consistency.

### `LongPressMenu.test.mjs`

Added 6 new source-reading tests under the existing Phase 43 pattern (`readFileSync` + regex assertions, no React DOM harness):

| Test ID | Assertion |
|---------|-----------|
| LP-50-07: props interface declares optional onOpenCollectionPicker + collectionContext | Both new props declared as optional (`?:`) — graceful-degradation contract |
| LP-50-07: handleSave picker branch calls onOpenCollectionPicker(postId) BEFORE onClose() | Source-position ordering check: picker call index < onClose index in handleSave body (Pitfall 4) |
| LP-50-07: graceful degradation — direct-toggle Save path preserved when onOpenCollectionPicker absent | Source still contains `engagementService.savePost` + `removeSavedPost` + matching toasts |
| LP-50-07: Remove-from-collection row renders only when collectionContext provided | JSX conditional `{collectionContext && ...}` + `FolderMinus` import + `library.collections.removeFromCollection` key reference |
| LP-50-07: Remove row handler calls collectionService.removePost + toast with Undo action | `collectionService.removePost(...)`, 3-arg toast with `{ action: { label, onAction } }`, Undo calls `collectionService.addPost` |
| LP-50-07: anti-wire invariants preserved | Zero occurrences of `eventBus.emit`, `CONCEPT_EXPLORED`, `dailyReadService.markExplored` |

All 7 pre-existing tests (LP-01..LP-04, anti-wire, minHeight 56px) still pass — the visual + semantic contract is unchanged for the 3-row case.

## Commits

| Commit | Type | Subject |
|--------|------|---------|
| bb2688d7 | test | add failing tests for LongPressMenu API extension (RED) |
| 967890ef | feat | extend LongPressMenu with onOpenCollectionPicker + collectionContext (GREEN) |

## Verification

| Check | Result |
|-------|--------|
| `node --test tests/components/LongPressMenu.test.mjs` | 13/13 pass (7 existing + 6 new) |
| `node --test tests/locales/bundle-parity.test.mjs` | 2/2 pass (en/zh/es/ja key sets identical) |
| `node --test tests/components/CollectionPickerSheet.test.mjs tests/components/FilterPickerSheet.test.mjs tests/components/HighlightedText.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs` | 37/37 pass — no adjacent-test regression |
| `grep -c "onOpenCollectionPicker" src/components/LongPressMenu.tsx` | 8 |
| `grep -c "collectionContext" src/components/LongPressMenu.tsx` | 11 |
| `grep -c "onOpenCollectionPicker(postId)" src/components/LongPressMenu.tsx` | 2 (declaration use + JSDoc) |
| `grep -c "FolderMinus" src/components/LongPressMenu.tsx` | 3 (import + render + JSDoc) |
| `grep -c "collectionService.removePost" src/components/LongPressMenu.tsx` | 2 (handler + JSDoc) |
| Save-row visual byte-stable | preserved — same Bookmark icon, same isSaved fill, same Save/Unsave label semantics, same rowStyle |
| Anti-wire invariants | zero `eventBus.emit`, zero `CONCEPT_EXPLORED`, zero `dailyReadService.markExplored` references |

## How downstream plans wire this

**Plan 50-08 (CollectionDrillInScreen):** Host both LongPressMenu + CollectionPickerSheet at screen level. Pass both new props:

```tsx
<LongPressMenu
  open={menuOpen}
  onClose={() => setMenuOpen(false)}
  postId={menuPostId}
  anchorId={menuAnchorId}
  onOpenCollectionPicker={(pid) => { setPickerPostId(pid); setPickerOpen(true); }}
  collectionContext={{ collectionId: id!, collectionName: collection.name }}
/>
```

**Plan 50-09 (HomeScreen + PostDetailScreen):** Wire `onOpenCollectionPicker` only (no `collectionContext` — feed context). Save row will open the picker instead of direct-toggling.

```tsx
<LongPressMenu
  open={menuOpen}
  onClose={closeMenu}
  postId={menuPostId}
  anchorId={menuAnchorId}
  onOpenCollectionPicker={(pid) => { setPickerPostId(pid); setPickerOpen(true); }}
/>
```

After 50-09 lands, the legacy direct-toggle fallback path in `handleSave` becomes structurally unreachable from the feed (HomeScreen always passes `onOpenCollectionPicker`). It is intentionally retained in the component so any future surface that needs single-tap save (e.g., a hypothetical post-detail kebab) keeps the option. If that path is ever truly dead, a future plan can simplify.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Critical functionality] `common.undo` i18n key did not exist**

- **Found during:** Reading locale bundles before implementing the Undo toast.
- **Issue:** Plan + PATTERNS prescribe `t('common.undo')` but the only existing Undo translation was nested at `graph.correction.actions.undo`. Without `common.undo`, the `t()` call would render the missing-key fallback (literal `"common.undo"`).
- **Fix:** Added `common.undo` to all 4 locale bundles in the same commit (en/zh/es/ja). Cloned canonical translations from `graph.correction.actions.undo` so values are consistent across the project. Phase 27 bundle-parity test confirms identical key sets across all 4 bundles after the change.
- **Files modified:** `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json`
- **Commit:** 967890ef

**2. [Rule 1 — Bug — pre-existing test regex sensitivity] Anti-wire test mismatched a JSDoc comment**

- **Found during:** First test run after GREEN implementation.
- **Issue:** The pre-existing anti-wire test counts `eventBus.emit` occurrences in source. The string also appeared in a documentation comment explaining that `collectionService` emits internally (so this component does NOT need to call `eventBus.emit` itself). The substring match flagged the comment.
- **Fix:** Rephrased the comment to `"no direct bus-emit calls in this component"` — preserves the documentation intent without tripping the substring grep. No behavioral change; same semantic meaning.
- **Files modified:** `app/src/components/LongPressMenu.tsx` (JSDoc only)
- **Commit:** 967890ef

### Deferred Issues (not in scope)

- **`tsc -b --noEmit` not runnable in this worktree:** The worktree has no `node_modules/` (it was created without `npm install`). `tsc` is unavailable; tests that import `i18next` (e.g., `tests/locales/missing-key.test.mjs`) also fail to load. This is pre-existing infrastructure, not a regression from this plan. Tracked in `deferred-items.md`. The orchestrator's main checkout (with `npm install`) is the canonical location to run `tsc` and the i18next-dependent tests; the source-reading tests in this plan run cleanly under bare `node --test` and validate the contract just as strictly.

## Test plan (orchestrator verification)

- [ ] `cd app && node --test tests/components/LongPressMenu.test.mjs` returns 13/13 pass
- [ ] `cd app && node --test tests/locales/bundle-parity.test.mjs` returns 2/2 pass
- [ ] In the merged main repo with `node_modules/` installed: `cd app && npx tsc -b --noEmit` is clean modulo pre-existing SavedScreen errors
- [ ] HomeScreen renders unchanged on `/home` — no visual regression on long-press menu (still 3 rows; Save row identical icon/label/behavior)

## Self-Check: PASSED

- File `app/src/components/LongPressMenu.tsx` exists at FOUND
- File `app/src/locales/en.json` exists at FOUND (with `common.undo`)
- File `app/src/locales/zh.json` exists at FOUND (with `common.undo`)
- File `app/src/locales/es.json` exists at FOUND (with `common.undo`)
- File `app/src/locales/ja.json` exists at FOUND (with `common.undo`)
- File `app/tests/components/LongPressMenu.test.mjs` exists at FOUND
- Commit `bb2688d7` FOUND in `git log --all`
- Commit `967890ef` FOUND in `git log --all`
- Both commits on the per-agent worktree branch (`worktree-agent-ab292439b5e4da2f5`)
- No deletions in either commit (post-commit deletion check returned empty)
