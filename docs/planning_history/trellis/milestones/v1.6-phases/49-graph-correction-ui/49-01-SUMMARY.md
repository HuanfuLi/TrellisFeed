---
phase: 49-graph-correction-ui
plan: 01
subsystem: ui
tags: [pointer-events, long-press, drag-drop, react, mind-elixir, capacitor-haptics, portal]

requires:
  - phase: 48-graph-command-service-and-trust-invariants
    provides: graphCommandService.move (called by drop-commit branch); ServiceResult contract; per-process mutex serialization of commands
provides:
  - useLongPressOrDrag hook + createLongPressOrDragMachine factory (480ms long-press + 8px drag-threshold state machine; W-3 LOCKED factory parity)
  - DragOverlay portaled ghost-node + SVG origin-line + magnetic-snap math (32px Euclidean; cluster→teal, anchor→peach halo)
  - GraphScreen delegated pointerdown listener wired alongside the existing click listener; DragOverlay mounted conditionally on dragState
  - 14 Wave-0 test scaffolds for Phase 49 (Plans 49-02..05) with FAILING assertions and ZERO .skip placeholders (B-8 fix)
  - graph.correction.toast.* i18n surface (5 keys × 4 locales) for the 5 toast paths this plan emits
affects:
  - 49-02-PLAN.md (CorrectionCard + per-node-type action matrix consumes correctionNode state + isReorganizing prop)
  - 49-03-PLAN.md (ConfirmDialog + MergeConfirmPreview + extended Toast read mergeConfirm state + add destructive variant)
  - 49-04-PLAN.md (UndoButton + PickModeBanner + soft-prune Snackbar + detach toast use the gesture engine's setCorrectionNode trigger)
  - 49-05-PLAN.md (i18n bundles + GRAPHUI-03 reload-survival harness fills out graph.correction.* namespace)

tech-stack:
  added: []  # No new packages — uses existing react, react-dom, mind-elixir, @capacitor/haptics
  patterns:
    - "Factory + hook duality (W-3 LOCKED): ship plain createLongPressOrDragMachine factory alongside React hook wrapper so delegated DOM listeners get state-machine semantics without hook indirection"
    - "Snapshot drop targets ONCE at gesture-start via containerRef.querySelectorAll('me-tpc') (T-49-02 mitigation — later DOM mutations cannot change the target set mid-drag)"
    - "Callback refs (onLongPressReleaseRef etc.) so the delegated listener closure sees latest state setters without forcing a heavy MindElixir re-init when callbacks change identity"
    - "Two-phase pointermove policy: pre-480ms threshold cancels (pan); post-480ms threshold transitions to drag (no cancellation)"

key-files:
  created:
    - app/src/hooks/useLongPressOrDrag.ts
    - app/src/components/graph/DragOverlay.tsx
    - app/tests/hooks/useLongPressOrDrag.test.mjs
    - app/tests/components/graph/DragOverlay.test.mjs
    - app/tests/components/graph/CorrectionCard.test.mjs
    - app/tests/components/graph/MergeConfirmPreview.test.mjs
    - app/tests/components/graph/UndoButton.test.mjs
    - app/tests/components/graph/PickModeBanner.test.mjs
    - app/tests/components/ui/ConfirmDialog.test.mjs
    - app/tests/components/Toast.action.test.mjs
    - app/tests/screens/GraphScreen.correction-card.test.mjs
    - app/tests/screens/GraphScreen.reorg-gate.test.mjs
    - app/tests/screens/GraphScreen.reload-survival.test.mjs
    - app/tests/screens/GraphScreen.detach-toast.test.mjs
    - app/tests/screens/GraphScreen.delete-confirm.test.mjs
    - app/tests/screens/GraphScreen.prune-undo.test.mjs
  modified:
    - app/src/screens/GraphScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json

key-decisions:
  - "Factory + hook duality (W-3 LOCKED) — both shapes share the same state-machine via closure variables; the hook wraps the factory and mirrors didLongPress into a React ref"
  - "Drop-end handler is synchronous-with-await — calls graphCommandService.move with await before showing the success/failure toast; setMergeConfirm path is fire-and-forget (Plan 49-03 owns the modal)"
  - "Drag-state lifecycle: setDragState(initialState) on onDragStart; setDragState(prev=>{...,pointerX,pointerY}) on onDragMove; setDragState(null) on every onDragEnd branch (success, failure, invalid). Single source of truth in GraphScreen"
  - "Capture-phase click listener (third arg `true` on addEventListener) for click-after-long-press suppression — fires before MindElixir's bubbling onNodeClick handler"
  - "setPointerCapture only inside onDragStart callback (NOT on raw pointerdown) — RESEARCH R1 invariant preserves MindElixir's pan until long-press is recognized"

patterns-established:
  - "Pattern: delegated pointer-state-machine on dynamic DOM (mind-elixir me-tpc elements) — snapshot DOM nodes at gesture-start, never re-query mid-gesture, freeze the target set"
  - "Pattern: callback refs for delegated DOM listeners — wrap user callbacks via useRef + sync useEffect so the addEventListener closure doesn't capture stale identity"
  - "Pattern: dual-export (hook + plain factory) for state-machine hooks that may run outside the React render path"

requirements-completed: [GRAPHUI-01]

duration: 22m
completed: 2026-05-18
---

# Phase 49 Plan 01: Gesture Engine + DragOverlay + Wave-0 Scaffolds Summary

**480ms long-press / 8px drag-threshold state machine + portaled ghost-node with 32px magnetic-snap + 14 failing Wave-0 test scaffolds (B-8 fix) wired into GraphScreen via a delegated pointerdown listener alongside the existing click listener.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-18T03:43:24Z
- **Completed:** 2026-05-18T04:05:11Z
- **Tasks:** 4
- **Files created:** 16 (1 hook, 1 component, 14 test scaffolds)
- **Files modified:** 5 (GraphScreen.tsx + 4 locale bundles)

## Accomplishments

- **Gesture engine landed:** `useLongPressOrDrag` + `createLongPressOrDragMachine` exported from a single module; factory ships plain (no React) for the GraphScreen delegated listener (W-3 LOCKED).
- **DragOverlay portals to document.body** with SVG origin-line + ghost div + halo overlay; magnetic snap fires at 32px Euclidean to the nearest target center; cluster targets render `var(--primary-40)` halo (Move semantics), anchor targets `var(--node-peach)` (Merge semantics).
- **GraphScreen wired without breaking MindElixir's pan:** delegated `pointerdown`/`pointermove`/`pointerup`/`pointercancel`/`click-capture` listeners attached inside MasterMap's existing useEffect (sibling to `handleClick` at line 294); same useEffect cleanup removes them all. `setPointerCapture` fires only inside `onDragStart` (post-480ms recognized), so MindElixir's pan still sees the pointer until long-press is committed.
- **14 Wave-0 test scaffolds with FAILING assertions (no `.skip` placeholders) — B-8 fix:** 44 failing tests at end of Task 1; Tasks 2-4 then turned 25 of those failing tests GREEN, leaving 19 that the downstream Plans 49-02..05 will green when they ship their respective sources.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold 14 Wave-0 test files (B-8 fix)** — `88fb509d` (test)
2. **Task 2: Build useLongPressOrDrag hook + factory** — `16d3ac94` (feat). TDD RED was inside the Task 1 scaffold commit; this is the GREEN commit. No separate REFACTOR commit (clean from the start).
3. **Task 3: Build DragOverlay component** — `fd0717c6` (feat). Same TDD shape — scaffold was in Task 1; this commit is GREEN.
4. **Task 4: Wire GraphScreen + i18n stubs** — `25f128cc` (feat). Single commit covering source + 4 locale bundle additions (5 keys × 4 locales) so bundle-parity stays green.

**Plan metadata:** (this commit, after Self-Check below).

## Files Created/Modified

### Created
- `app/src/hooks/useLongPressOrDrag.ts` — Factory + hook for 480ms long-press / 8px drag-threshold state machine with click-suppression.
- `app/src/components/graph/DragOverlay.tsx` — Portaled ghost-node + SVG origin-line + magnetic-snap halo (32px Euclidean).
- 14 test scaffolds (see `key-files.created` in frontmatter) — every file owns 1–9 failing assertions that go GREEN when the downstream plan ships its source.

### Modified
- `app/src/screens/GraphScreen.tsx` — Imports `createLongPressOrDragMachine`, `DragOverlay`, `DragState`, `DropTargetSnapshot`, `graphCommandService`, `hapticImpactMedium`. New MasterMap props for gesture callbacks (4 callback-refs + 1 tRef for i18n). Delegated pointer listeners added inside the existing useEffect at lines 229-354 and removed in the SAME teardown. GraphScreen gains 4 new state hooks (`dragState`, `dropTargets`, `mergeConfirm` stub, `correctionNode` stub) and renders `<DragOverlay dragState={dragState} targets={dropTargets} />` at the JSX root.
- `app/src/locales/{en,zh,es,ja}.json` — `graph.correction.toast.*` subtree added with 5 keys: dropInvalid, moved, reorgInProgress, rootNotEditable, branchNotEditable. Bundle-parity test green.

## Decisions Made

1. **Factory + hook duality (W-3 LOCKED).** Both `useLongPressOrDrag` (component-level hook) and `createLongPressOrDragMachine` (plain factory) share the same closure-based state machine. The factory has no React dependency so GraphScreen's delegated listener can instantiate it inside an addEventListener callback without violating the rules of hooks.

2. **Drop-end commit is `await`-based.** `handleDragEnd` is `async` and awaits `graphCommandService.move(...)` before toasting success/failure. The `setMergeConfirm` path stays synchronous (Plan 49-03 owns the modal mount + its own commit flow).

3. **Drag-state lifecycle is set on onDragStart / mutated on onDragMove (prev-state pattern, single source of truth in GraphScreen) / cleared on EVERY onDragEnd branch (success, failure, invalid).** No leaking ghost ever.

4. **Capture-phase click listener (`addEventListener('click', handleClickCapture, true)`) for click-after-long-press suppression.** Fires before MindElixir's bubbling `onNodeClick`, so the long-press release does not also navigate to the inspector card.

5. **Callback refs for the delegated listener.** Identity changes on `onLongPressRelease` / `onDragStart` / `onDragMove` / `onDragEnd` / `t` do NOT trigger MindElixir re-init (the heavy useEffect's deps array stays at `[nodes, edges, isVisible]`). Mirrors the existing `onNodeClickRef` pattern.

6. **Hook order stability in DragOverlay.** `useMemo` placed BEFORE the early returns (SSR guard + null dragState guard). Inside the memo body we handle `dragState === null` ourselves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `.ts` extension to relative haptics import**
- **Found during:** Task 2 (running useLongPressOrDrag tests)
- **Issue:** `import { hapticImpactLight } from '../lib/haptics'` failed with `ERR_MODULE_NOT_FOUND` under `node --test`'s native ESM resolver; Vite resolves extensionless imports at build time but Node does not.
- **Fix:** Changed to `'../lib/haptics.ts'` to match the codebase convention in `canonical-knowledge.service.ts` (other production files use explicit `.ts` extensions for relative imports).
- **Files modified:** `app/src/hooks/useLongPressOrDrag.ts`
- **Verification:** All 10 tests in `tests/hooks/useLongPressOrDrag.test.mjs` pass.
- **Committed in:** `16d3ac94` (Task 2 commit).

**2. [Rule 1 - Bug] Fixed React hook order violation in DragOverlay**
- **Found during:** Task 3 (post-write self-review)
- **Issue:** `useMemo` was placed AFTER `if (typeof document === 'undefined') return null;` + `if (dragState === null) return null;`. React's Rules of Hooks forbid hooks behind early returns; would have produced runtime warnings + flaky behavior on first transition from null→state.
- **Fix:** Moved `useMemo` BEFORE the early returns; the memo body now handles `dragState === null` internally.
- **Files modified:** `app/src/components/graph/DragOverlay.tsx`
- **Verification:** All 7 DragOverlay tests pass; tsc clean.
- **Committed in:** `fd0717c6` (Task 3 commit).

**3. [Rule 1 - Bug] Fixed possibly-undefined `result.error` after graphCommandService.move**
- **Found during:** Task 4 (running tsc -b --noEmit)
- **Issue:** `ServiceResult<T>` is NOT a discriminated union (the `error?: ServiceError` field is optional, not the negative branch of a `success: false` discriminant). My handler wrote `result.error.message` which tsc rejected as possibly undefined.
- **Fix:** `result.error?.message ?? t('graph.correction.toast.dropInvalid')` — null-coalesce to a sensible fallback toast key.
- **Files modified:** `app/src/screens/GraphScreen.tsx`
- **Verification:** `tsc -b --noEmit` clean.
- **Committed in:** `25f128cc` (Task 4 commit).

**4. [Rule 2 - Missing Critical] Added `tRef` callback ref for i18n inside gesture handler**
- **Found during:** Task 4 (eslint react-hooks/exhaustive-deps warning)
- **Issue:** The gesture handler closure calls `t('graph.correction.toast.reorgInProgress')` but the existing useEffect deps array is `[nodes, edges, isVisible]` (intentionally narrow — locale changes shouldn't tear down MindElixir). Direct `t` reference would either trigger the eslint warning OR force a re-init on every locale change.
- **Fix:** Added a `tRef = useRef(t)` mirror synced via a tiny useEffect (matches the existing `onNodeClickRef` pattern). Gesture handler reads via `tRef.current('...')`.
- **Files modified:** `app/src/screens/GraphScreen.tsx`
- **Verification:** `npx eslint src/screens/GraphScreen.tsx` clean; tsc clean.
- **Committed in:** `25f128cc` (Task 4 commit).

**5. [Rule 1 - Bug] Removed accidentally-passing test grep strings from comment**
- **Found during:** Task 4 (running GraphScreen.correction-card.test.mjs)
- **Issue:** My comment "Tests in 49-02 grep for \`correctionNode &&\` + <CorrectionCard." accidentally contained the literal strings `correctionNode &&` and `<CorrectionCard` — which Plan 49-02's source-reading test (Test 4 of 7) matches via regex. The test passed PREMATURELY (the actual CorrectionCard mount is owned by Plan 49-02).
- **Fix:** Rewrote the comment without the grep-sensitive substrings so the Plan-49-02 test fails as designed.
- **Files modified:** `app/src/screens/GraphScreen.tsx`
- **Verification:** Test 4 now fails with `// FAILS until Plan 49-02 ships {source}` semantics restored.
- **Committed in:** `25f128cc` (Task 4 commit).

**6. [Rule 3 - Blocking] Added `graph.correction.toast.*` keys to zh/es/ja bundles**
- **Found during:** Task 4 (bundle-parity.test.mjs)
- **Issue:** Adding 5 keys to en.json without parallel additions to zh/es/ja would have broken `bundle-parity.test.mjs` (a baseline-green test) on EVERY downstream test run, blocking iteration.
- **Fix:** Translated all 5 keys for zh/es/ja in-line (the i18n rule allows hand-authored translations; Plan 49-05's Sonnet pass will reconcile the FULL `graph.correction.*` namespace later — this plan only ships the 5 keys it directly consumes).
- **Files modified:** `app/src/locales/{zh,es,ja}.json`
- **Verification:** `node --test tests/locales/bundle-parity.test.mjs` green (both tests pass).
- **Committed in:** `25f128cc` (Task 4 commit).

---

**Total deviations:** 6 auto-fixed (3 Rule 1 bugs, 2 Rule 3 blockers, 1 Rule 2 missing critical).
**Impact on plan:** None of the auto-fixes changed scope. All were either Node-vs-Vite resolution differences, TypeScript strict-mode tightening, React Rules-of-Hooks correctness, or CI-keeping i18n bundle parity. No scope creep; every fix is a correctness or unblocking concern.

## Issues Encountered

- **Pre-existing test failures untouched.** Baseline test:main has 2 failing tests (`concept-feed.test.mjs`, `trellis-state.test.mjs`) — both are date-related and unrelated to Phase 49 (today's wall-clock is 2026-05-18 but the fixtures use 2026-05-17). Logged to deferred-items.md if it exists; this plan does NOT auto-fix them per the Scope Boundary rule.
- **bundle-parity placeholder translations for zh/es/ja.** The 5 keys this plan added were translated in-line so the parity test stays green. Plan 49-05's Sonnet pass owns the canonical translations for the full `graph.correction.*` namespace; my in-line strings may need refinement at that point (especially the Spanish/Japanese phrasing).

## Wave-0 Scaffold Inventory (B-8 fix)

All 14 scaffolds present, ZERO `.skip` placeholders. Failing-assertion counts at end of Plan 49-01:

| # | File | Failing assertions (start) | Failing assertions (end of 49-01) | Owner plan |
|---|---|---|---|---|
| 1 | tests/hooks/useLongPressOrDrag.test.mjs | 10 | 0 ✅ | 49-01 Task 2 (GREEN) |
| 2 | tests/components/graph/DragOverlay.test.mjs | 7 | 0 ✅ | 49-01 Task 3 (GREEN) |
| 3 | tests/components/graph/CorrectionCard.test.mjs | 3 | 3 | 49-02 |
| 4 | tests/components/graph/MergeConfirmPreview.test.mjs | 1 | 1 | 49-03 |
| 5 | tests/components/graph/UndoButton.test.mjs | 2 | 2 | 49-04 |
| 6 | tests/components/graph/PickModeBanner.test.mjs | 1 | 1 | 49-04 |
| 7 | tests/components/ui/ConfirmDialog.test.mjs | 2 | 2 | 49-03 |
| 8 | tests/components/Toast.action.test.mjs | 2 | 2 | 49-03 |
| 9 | tests/screens/GraphScreen.correction-card.test.mjs | 7 | 1 | 49-01 (6 GREEN) + 49-02 (1 left) |
| 10 | tests/screens/GraphScreen.reorg-gate.test.mjs | 2 | 1 | 49-01 (1 GREEN) + 49-02 (1 left) |
| 11 | tests/screens/GraphScreen.reload-survival.test.mjs | 1 | 1 | 49-05 |
| 12 | tests/screens/GraphScreen.detach-toast.test.mjs | 2 | 2 | 49-04 |
| 13 | tests/screens/GraphScreen.delete-confirm.test.mjs | 2 | 2 | 49-03 |
| 14 | tests/screens/GraphScreen.prune-undo.test.mjs | 2 | 2 | 49-04 |
| | **Totals** | **44** | **19 remaining** | 25 turned GREEN by Plan 49-01 |

## Drag-State Lifecycle (final implementation)

| Event | dragState | dropTargets | What sets it |
|---|---|---|---|
| Module load | `null` | `[]` | Initial useState |
| onPointerDown on a non-root/branch node | unchanged | unchanged | (machine timer starts) |
| Long-press fires (480ms) | unchanged | unchanged | (haptic only; no UI mutation yet) |
| First pointermove > 8px after long-press | `{ sourceNode, originRect, ghostRect, pointerX, pointerY, snappedTargetId: null }` | snapshotted targets | `handleDragStart` |
| Subsequent pointermove (drag active) | `{...prev, pointerX, pointerY}` | unchanged | `handleDragMove` |
| pointerup with valid cluster drop | `null` | unchanged | `handleDragEnd` after await on `graphCommandService.move` |
| pointerup with valid anchor drop | `null` | unchanged | `handleDragEnd` + `setMergeConfirm` (Plan 49-03 consumes) |
| pointerup with invalid drop (no snap or QA-target) | `null` | unchanged | `handleDragEnd` + toast `dropInvalid` |
| pointercancel during drag | `null` | unchanged | `handleDragEnd` via `onDragEnd(lastCoord)` |

`dropTargets` is reset to `[]` only on full GraphScreen unmount — kept across consecutive drags so the user can drag again immediately without a re-snapshot ceremony.

## User Setup Required

None — no external service configuration required. All work is local React + DOM.

## Next Phase Readiness

- **Plan 49-02 unblocked.** It depends on `correctionNode` state + `isReorganizing` prop + the gesture engine's `setCorrectionNode` trigger — all wired here. Its 5 remaining failing assertions (across 2 test files) will go GREEN when 49-02 mounts the CorrectionCard.
- **Plan 49-03..05 unblocked indirectly.** Their Wave-0 scaffolds are in the suite as failing tests. 49-03 adds ConfirmDialog + MergeConfirmPreview + extended Toast. 49-04 adds UndoButton + PickModeBanner + detach toast + soft-prune snackbar. 49-05 fills out i18n + reload-survival harness.
- **CLAUDE.md invariants preserved.** No `transform`/`will-change`/`filter`/`contain` added to ancestors of `<Header>`; `data-no-swipe-nav="true"` (line 408 of original) untouched; `touchAction: 'none'` untouched; the existing click listener at line 294 untouched and still wired.

## Self-Check: PASSED

All claimed artifacts verified to exist on disk and all claimed commits verified in git log.

---

*Phase: 49-graph-correction-ui*
*Completed: 2026-05-18*
