---
phase: 50-retrieval-and-library-foundation
plan: 06
subsystem: ui
tags: [phase50, ui-primitive, save-picker, filter-picker, highlight, xss-mitigation]
type: execute
status: complete
completed: 2026-05-18
requires:
  - 50-03 (collectionService — addPost / removePost / createCollection / getCollections / getPostCollections)
  - 50-04 (librarySearchService — Fuse match indices consumed by HighlightedText)
provides:
  - HighlightedText (default export): match-index → <mark> JSX primitive
  - CollectionPickerSheet: YouTube-faithful "Save to..." sheet (D-04 / D-05)
  - FilterPickerSheet: shared single-select picker reused by Concept / Source / Date chips
affects:
  - SavedScreen.tsx (plan 50-09 — consumes all three components)
  - CollectionDrillInScreen.tsx (plan 50-08 — consumes CollectionPickerSheet)
  - HomeScreen + PostDetailScreen (plan 50-09 — host CollectionPickerSheet alongside LongPressMenu)
tech_added: []
tech_patterns:
  - "React text-node escaping as XSS mitigation (T-50-XSS-HL, T-50-XSS-NAME): all user-derived text wraps in JSX children, never via dangerouslySetInnerHTML"
  - "Captured-on-open baseline + commit-on-Done diff (T-50-PICKER-RACE mitigation): picker reads engagementService.isSaved + collectionService.getPostCollections into useMemo'd originals, drafts diverge in local state, handleDone fires the minimal mutation set"
  - "Source-reading tests at the UI-primitive layer (no DOM render): same pattern as LongPressMenu.test.mjs — assert JSX shape + import boundary + negative invariants via regex over the .tsx source"
  - "Rules of Hooks under defensive guard: all hooks declared above the postId !== null short-circuit return; useEffect re-syncs drafts when the baseline (postId) changes so a single instance can host multiple opens"
key_files:
  created:
    - app/src/components/ui/HighlightedText.tsx
    - app/src/components/CollectionPickerSheet.tsx
    - app/src/components/FilterPickerSheet.tsx
    - app/tests/components/FilterPickerSheet.test.mjs
  modified:
    - app/tests/components/HighlightedText.test.mjs
    - app/tests/components/CollectionPickerSheet.test.mjs
decisions:
  - "HighlightedText defaults to plain text fragment when indices is empty/undefined — callers can pass result.matches.find(m => m.key === 'title')?.indices unconditionally without a defensive guard"
  - "CollectionPickerSheet baseline captured via useMemo(() => engagementService.isSaved(postId), [postId]) and re-synced into useState via useEffect on postId change; this lets the host reuse a single instance across multiple opens (HomeScreen pattern in 50-09)"
  - "CollectionPickerSheet uses the React HTML-injection escape hatch nowhere: collection names render as React text-node children — the project-wide CLAUDE.md XSS discipline is the mitigation"
  - "FilterPickerSheet is a pure UI primitive — data flows in via props, no service imports. This keeps it reusable across Concept / Source / Date chips (one component, three data sources)"
  - "All hooks declared above the postId === null defensive guard in CollectionPickerSheet (Rules of Hooks). The guard short-circuits the RETURN, not the hook call sequence"
metrics:
  duration: 1 session
  commits: 6
  files_created: 4
  files_modified: 2
---

# Phase 50 Plan 50-06: UI Primitives (HighlightedText + CollectionPickerSheet + FilterPickerSheet) Summary

Built the three new UI building blocks that drive Phase 50's user-facing surfaces, each isolated at the primitive layer with source-reading tests so screen-level composition in plans 50-08 / 50-09 can verify integration separately.

## What changed

### `HighlightedText` (UI-SPEC Surface 7 — search-result highlighting)

```ts
interface HighlightedTextProps {
  text: string;
  indices?: readonly (readonly [number, number])[];  // Fuse [start, end] inclusive pairs
}
function HighlightedText(props: HighlightedTextProps): JSX.Element;
export default HighlightedText;
```

- Iterates indices with a cursor; wraps each `[start, end]` slice in a `<mark>` JSX node styled via inline CSS variables (`var(--primary-40)` background, `#fff` text, 2px radius, 4px inline padding per UI-SPEC §"Spacing Scale").
- Empty / undefined `indices` → returns `<>{text}</>` so callers can pass `result.matches.find(m => m.key === 'title')?.indices` without a guard.
- Inclusive Fuse `[start, end]` → JavaScript half-open `text.slice(start, end + 1)`.
- Defensive clamps against out-of-order tuples (negative starts, ends past `text.length - 1`) so a malformed Fuse result cannot crash the render.
- **T-50-XSS-HL mitigation:** Zero occurrences of the React HTML-injection escape hatch. React's built-in text-node escaping is the XSS boundary — indices themselves are integers operating on the same `text` argument; there is no HTML-string concatenation path.

### `CollectionPickerSheet` (UI-SPEC Surface 4 — YouTube-faithful save sheet)

```ts
interface CollectionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
}
export function CollectionPickerSheet(props: CollectionPickerSheetProps): JSX.Element;
export default CollectionPickerSheet;
```

- Anatomy from top to bottom: title row → implicit Saved row (pinned, Bookmark icon, 22×22 custom checkbox) → 1px `var(--border)` divider → custom collection rows (Folder icon + name + postCount badge) → 1px divider → `+ New collection` row (morphs to inline TextInput on tap) → full-width Done button.
- **Baseline capture (T-50-PICKER-RACE):** `originalSaved` and `originalMemberIds` snapshot from `engagementService.isSaved(postId)` + `collectionService.getPostCollections(postId)` via `useMemo` keyed on `postId`. Per-tap toggles update DRAFT state only (`useState<boolean>` + `useState<Set<string>>`). Done computes the diff against the baseline and fires the minimal set of `savePost` / `removeSavedPost` + `addPost` / `removePost` mutations. Concurrent rapid taps on different rows cannot interleave service writes.
- **D-05 single-tap-save preserved:** On open, the implicit Saved row is pre-checked from `engagementService.isSaved(postId)`. If the user immediately taps Done without flipping anything, the diff reduces to "save the post" (when not already saved) and toasts `engagement.toast.saved` "Saved".
- **Inline + New collection flow:** Tap `+ New collection` → row morphs to an autoFocus `<input type="text">`. Enter (via `onKeyDown`) → `collectionService.createCollection(value.trim())`. Success path adds the new collection's id to the draft Set + clears the input + stays in createMode for chaining. Failure path renders the error key (`nameEmpty` / `nameTooLong` / `nameDuplicate`) as inline `var(--danger)` Caption text via `t(`library.savePicker.${error}`)`. Escape collapses back to the row label.
- **Tap-outside === Done:** `BottomSheet onClose={handleDone}` so tap-outside commits the diff identically.
- **Toast composition (UI-SPEC §"Toast table"):** single-add → `added` with collection name, multi-add → `addedMultiple` with count, remove → `removed` with collection name, save-only → `engagement.toast.saved`, unsave-only → `engagement.toast.unsaved`. Silent close when nothing changed.
- **Rules of Hooks:** All hooks declared above the `if (!postId)` defensive guard. `useEffect` keyed on `[postId, originalSaved, originalMemberIds]` re-syncs draft state so the host can reuse a single instance across multiple opens.
- **T-50-XSS-NAME mitigation:** Zero occurrences of the React HTML-injection escape hatch. Collection names render as React text-node children.

### `FilterPickerSheet` (UI-SPEC Surface 2 — Concept / Source / Date shared picker)

```ts
export interface FilterPickerOption {
  label: string;
  value: string;
}
interface FilterPickerSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: FilterPickerOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
}
export function FilterPickerSheet(props: FilterPickerSheetProps): JSX.Element;
export default FilterPickerSheet;
```

- Single-select picker reused across the three filter chips: SavedScreen passes `options = questionService.getAnchors().map(...)` for Concept, deduped `contextLabel` set for Source, and the fixed 4-row preset list for Date.
- Each row tap commits via `onSelect(option.value)` AND dismisses via `onClose()` in the same handler — no Done button (single-tap-commits per UI-SPEC §"Surface 2").
- Active row indicator: leading `Check` icon at `var(--primary-40)` for the selected option, `transparent` for the rest so layout doesn't shift on selection.
- Empty-state branch when `options.length === 0` AND `emptyTitle` is provided — centered title + optional body, no CTA (Concept and Source pickers use this; Date picker never enters this branch because it ships a fixed 4-row list).
- **Pure UI:** No service / provider imports. Data flows in via props — caller owns the data sourcing.

## Tests

| File | RED → GREEN | Assertions | Pattern |
|------|-------------|------------|---------|
| `app/tests/components/HighlightedText.test.mjs` | replaced Wave 0 scaffold | 7 | source-reading (no DOM render) — default-export, `<mark>` shape, `var(--primary-40)` + `#fff` styling, slice/substring offset-based splitting, empty-indices early-return, pure-UI import boundary, negative invariant on the HTML-injection escape hatch |
| `app/tests/components/CollectionPickerSheet.test.mjs` | replaced Wave 0 scaffold | 12 | source-reading — `<BottomSheet compact>` shell, isSaved pre-check, addPost/removePost wiring, no direct eventBus emit (signal flows via collectionService), postId-null defensive guard, i18n key references, createMode + Enter key handler, handleDone diff against original baseline, getPostCollections seeding, toast wiring, T-50-XSS-NAME negative invariant |
| `app/tests/components/FilterPickerSheet.test.mjs` | **new** | 7 | source-reading — `<BottomSheet compact>` shell, onSelect + onClose together (single-tap-commits), Check icon conditional color, empty-state branch, no Done button (negative invariants on `library.savePicker.done` reuse and `>Done<` JSX text), no service imports, no HTML-injection escape hatch |

All 26 component tests GREEN. Test count delta: `+19` (Wave 0 scaffolds had 4 HL tests + 5 CPS tests = 9 placeholder tests; this plan replaces them with 7 HL + 12 CPS + 7 FPS = 26 real assertions).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] CollectionPickerSheet: hooks called after early return (Rules of Hooks violation)**
- **Found during:** Task 2 implementation
- **Issue:** The plan's pseudocode put the `if (!postId) return <BottomSheet open={false}/>` defensive guard BEFORE the `useMemo` / `useState` hook calls. That violates React's Rules of Hooks — hook order must be stable across renders. When `postId` transitions from `null` → non-null, the second render would call `useMemo` for the first time after a render where it was skipped, throwing `Rendered more hooks than during the previous render`.
- **Fix:** Moved all hook calls above the early return. `useMemo` for `originalSaved` / `originalMemberIds` collapses to safe defaults (`false`, empty Set) when `postId` is null, then the guard short-circuits the RETURN only.
- **Files modified:** `app/src/components/CollectionPickerSheet.tsx`
- **Commit:** `65bf51cd` (the fix was applied during the GREEN implementation step, so it lives in the same commit as the component)

**2. [Rule 2 — Missing critical functionality] CollectionPickerSheet: instance-reuse draft-state staleness**
- **Found during:** Task 2 self-review after passing tests
- **Issue:** The plan's pseudocode initialized draft state via `useState(() => engagementService.isSaved(postId))` — a lazy initializer that runs ONCE per mount. The plan comment said "the host re-mounts the sheet by toggling `open` + setting `postId`", but if the host (HomeScreen in 50-09) reuses a SINGLE instance and only changes the `postId` prop, the draft state would not re-sync and the user would see stale checkboxes from the previous post on the second open.
- **Fix:** Added a `useEffect` keyed on `[postId, originalSaved, originalMemberIds]` that resets `draftSavedChecked`, `draftMemberIds`, `createMode`, `createValue`, and `createError` whenever the baseline changes. Single instance + multiple opens now work correctly.
- **Files modified:** `app/src/components/CollectionPickerSheet.tsx`
- **Commit:** `65bf51cd`

**3. [Rule 3 — Blocking issue] HighlightedText test scaffold pointed at wrong path**
- **Found during:** Task 1 RED-state verification
- **Issue:** The Wave 0 scaffold at `app/tests/components/HighlightedText.test.mjs` read `src/components/HighlightedText.tsx`, but the canonical path per PLAN.md, UI-SPEC.md, PATTERNS.md, and downstream plan 50-09 (`import HighlightedText from '../components/ui/HighlightedText'`) is `src/components/ui/HighlightedText.tsx` (the `ui/` subdirectory). Without the fix, the test would have been RED forever even after implementation landed at the canonical path.
- **Fix:** Updated the test's `SRC_REL` constant to `src/components/ui/HighlightedText.tsx`. This was already required by the plan's `<action>` step 2 ("Replace Wave 0 scaffold body … with concrete assertions") — the path correction is bundled into that rewrite.
- **Files modified:** `app/tests/components/HighlightedText.test.mjs`
- **Commit:** `5badfc99`

### Architectural changes
None.

### Pre-existing failures noted
Running `npm test` from the worktree surfaces 52 failures, all pre-existing and unrelated to 50-06:
- Tests importing `@capacitor/core` / `@capacitor/local-notifications` (canonical-knowledge, concept-feed, trellis, lib/date.locale, providers/llm-locale, providers/tts-locale, etc.) fail with `Cannot find package '@capacitor/core'` — the worktree has no `node_modules` installed. These were failing on the base commit.
- Other 50-XX Wave 0 RED scaffolds explicitly tagged `[plan 50-08 …]` / `[plan 50-09 …]` remain RED until those plans land — the intended TDD state for downstream waves.

## Verification

```bash
cd app && node --test tests/components/HighlightedText.test.mjs tests/components/CollectionPickerSheet.test.mjs tests/components/FilterPickerSheet.test.mjs
# → tests 26, pass 26, fail 0

cd app && grep -c "dangerouslySetInnerHTML" src/components/ui/HighlightedText.tsx src/components/CollectionPickerSheet.tsx src/components/FilterPickerSheet.tsx
# → all three files: 0

cd app && node --test $(find tests/components -name '*.test.mjs')
# → tests 196, pass 196, fail 0 (full component-test suite)
```

## Downstream consumers

- **Plan 50-08 (CollectionDrillInScreen):** imports `CollectionPickerSheet` to allow renaming/saving membership from inside the drill-in. Will also import `HighlightedText` once search-inside-drill-in is wired (deferred to 50-09 per UI-SPEC).
- **Plan 50-09 (SavedScreen Collections tab + search):**
  - hosts `CollectionPickerSheet` alongside `LongPressMenu` — Save row tap → close menu + open picker
  - hosts `FilterPickerSheet` three times (Concept / Source / Date), each with different `options` data sources
  - uses `HighlightedText` in `SavedRow` to highlight matched runs in titles + body snippets

## Self-Check: PASSED

- [x] `app/src/components/ui/HighlightedText.tsx` exists
- [x] `app/src/components/CollectionPickerSheet.tsx` exists
- [x] `app/src/components/FilterPickerSheet.tsx` exists
- [x] `app/tests/components/HighlightedText.test.mjs` updated and passes (7/7)
- [x] `app/tests/components/CollectionPickerSheet.test.mjs` updated and passes (12/12)
- [x] `app/tests/components/FilterPickerSheet.test.mjs` created and passes (7/7)
- [x] All 6 commits present: `5badfc99`, `07af0406`, `41de11bd`, `65bf51cd`, `e695ab7a`, `f472814e`
- [x] `dangerouslySetInnerHTML` grep returns 0 across all 3 new component files
- [x] No modifications to STATE.md / ROADMAP.md
