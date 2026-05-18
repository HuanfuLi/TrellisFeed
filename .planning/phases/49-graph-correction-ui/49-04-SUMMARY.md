---
phase: 49-graph-correction-ui
plan: 04
subsystem: ui
tags: [undo, pick-mode, snackbar, detach, two-emit-correlation, prune, soft-delete, i18n, always-mounted-screen]

requires:
  - phase: 48-graph-command-service-and-trust-invariants
    provides: graphCommandService.undo (returns { undoneCmd, targetIds, summary }); graphCommandService.detach (ServiceResult<void> + fire-and-forget classifyAndAnchorIncremental that emits a SECOND GRAPH_UPDATED on completion); graphCommandService.prune (delegates to trellisActionsService.prune; emits typed GRAPH_UPDATED with payload.kind='prune'); graphEditJournal.list() (localStorage-backed, N=10 cap)
  - plan: 49-01
    provides: gesture engine (long-press release coordinates feed correctionNode.anchorX/Y); 14 Wave-0 test scaffolds including the 4 this plan greens (UndoButton 2 → 8, PickModeBanner 1 → 6, GraphScreen.prune-undo 2 → 5, GraphScreen.detach-toast 2 → 9)
  - plan: 49-02
    provides: correctionNode state with anchorX/Y; CorrectionCard.onActionSelected dispatch + handleCorrectionAction switch (this plan replaces 'move'/'merge'/'prune'/'detach' stubs with the real flows); always-mounted reset effect on location.pathname (this plan extends to also clear pickMode)
  - plan: 49-03
    provides: extended toast(message, type?, { action }) signature for Snackbar-with-Undo (D-10); ConfirmDialog (Plan 49-04 does NOT add new mounts — prune commits immediately per D-10; detach commits immediately per D-12)
provides:
  - UndoButton component (36px circular at right:56px, GRAPH_UPDATED subscriber, B-5 summary fix)
  - PickModeBanner component (in-tree banner below Header, Escape-key cancel, role=status + aria-live=polite a11y)
  - GraphScreen pickMode state machine with originalAnchorX/Y preservation (W-2 fix shipped)
  - GraphScreen handlePrune handler (soft-prune snackbar via toast {action} per D-10; W-6 'info' toast type)
  - GraphScreen handleDetach handler (B-1 Two-emit GRAPH_UPDATED correlation; 5s timeout fallback)
  - i18n surface extension: graph.correction.actions.undo, graph.correction.toast.{undone, nothingToUndo, pruned, detachedNewAnchor, detachedSameAnchor}, graph.correction.pickMode.{move, merge, cancel, invalidTarget} — 9 new keys × 4 locales (36 total)
affects:
  - 49-05-PLAN.md (Sonnet subagent reconciles the full graph.correction.* namespace; this plan added 9 new keys in-line as best-effort placeholders; reload-survival harness scaffold unchanged)

tech-stack:
  added: []  # No new packages — uses existing react, react-i18next, lucide-react (Undo2 icon)
  patterns:
    - "Persistent corner affordance with state-derived disabled — UndoButton mirrors the existing expand/collapse button's visual treatment + position vocabulary, derives its enabled state from a service journal length, recomputes on GRAPH_UPDATED"
    - "GRAPH_UPDATED subscription as state-derivation channel — single subscribe in useEffect with cleanup; useState lazy initializer reads from journal at mount to prevent first-paint disabled→enabled flicker"
    - "Pick-mode interception via callback-ref pattern — GraphScreen owns the pickMode state machine; MasterMap's delegated click listener delegates ALL node taps to a `onPickModeTap(target)` callback that returns true (consumed) or false (fall through). Mirrors the existing onNodeClickRef pattern; no MindElixir re-init on pickMode changes"
    - "Original-coord preservation via state-time capture (W-2) — pickMode state captures originalAnchorX/Y from the live correctionNode at entry, NOT a window-center fallback. handlePickModeCancel reads pickMode.originalAnchorX/Y directly when restoring the CorrectionCard"
    - "Two-emit GRAPH_UPDATED correlation for fire-and-forget side effects (B-1) — Phase 48's detach() returns ServiceResult<void> but downstream classifyAndAnchorIncremental emits a SECOND GRAPH_UPDATED on completion. GraphScreen subscribes AFTER the await resolves; the next emit observed is the classify signal. 5s setTimeout fallback silently exits — the first GRAPH_UPDATED already updated the visible graph"
    - "Soft-delete with inline Undo affordance (D-10) — no confirmation modal; commit + Snackbar-with-Undo. The action button on the toast (Plan 49-03's extended signature) invokes the same graphCommandService.undo as the corner button — single recovery path"

key-files:
  created:
    - app/src/components/graph/UndoButton.tsx
    - app/src/components/graph/PickModeBanner.tsx
  modified:
    - app/src/screens/GraphScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/tests/components/graph/UndoButton.test.mjs
    - app/tests/components/graph/PickModeBanner.test.mjs
    - app/tests/screens/GraphScreen.correction-card.test.mjs
    - app/tests/screens/GraphScreen.prune-undo.test.mjs
    - app/tests/screens/GraphScreen.detach-toast.test.mjs
    - app/tests/screens/GraphScreen.delete-confirm.test.mjs

key-decisions:
  - "UndoButton useState initial value uses the lazy-init form `useState<boolean>(() => graphEditJournal.list().length > 0)`. Hydrating at mount avoids the first-paint disabled→enabled flicker that a default-false + post-mount-effect approach would produce. The graphEditJournal module is a leaf module (zero transitive deps on settings/llm/locales per Phase 48 D-01) so reading at mount is fast and safe."
  - "pickModeRef was indeed needed (as anticipated in the plan's <output> section). The delegated click listener inside MasterMap's useEffect captures pickModeRef at attachment time; reading pickModeRef.current inside the listener closure picks up the latest GraphScreen state without forcing a heavy MindElixir re-init on every pickMode change. Mirrors the existing onNodeClickRef pattern from Plan 49-01."
  - "pickMode state shape captures originalAnchorX/Y (W-2 fix shipped). The shape is `{ kind, sourceNode, originalAnchorX, originalAnchorY } | null`. handleCorrectionAction's move/merge cases read correctionNode.anchorX/Y AND copy them into the new pickMode object BEFORE clearing correctionNode. handlePickModeCancel then restores CorrectionCard at THOSE coords (NOT a window-center fallback)."
  - "Detach handler uses two-emit GRAPH_UPDATED correlation pattern (B-1 fix shipped). The handler subscribes to GRAPH_UPDATED AFTER the await on graphCommandService.detach resolves. Because detach's command-boundary emit fires synchronously inside the mutex BEFORE the await resolves, the first emit observed by the new subscription is the classify-completion emit (or never, in which case the 5s timeout fires). The handler never references result.data.anchorId — Phase 48's contract is ServiceResult<void>. Source contains the load-bearing 'Two-emit correlation' comment marker."
  - "All undo-toast references use result.data.summary, NEVER result.data.undoneCmd (B-5 fix shipped). UndoButton's handleUndo callback uses result.data.summary directly. handlePrune's inner [Undo] callback uses undoResult.data.summary. Two negative greps now enforce: `! grep result.data.undoneCmd src/components/graph/UndoButton.tsx src/screens/GraphScreen.tsx`. The verb-literal undoneCmd is intended for log telemetry only — the plan's `<interfaces>` section makes this distinction load-bearing."
  - "Prune toast type stays 'info' (W-6 acceptable per codebase convention; flag for operator UAT review). The plan considered destructive-coloring it but Plan 49-PATTERNS notes destructive toasts feel alarmist for a recoverable soft-delete that already shows a clear [Undo] affordance. Operator can revisit at UAT."
  - "Always-mounted reset effect extended to also clear pickMode on tab navigation away. The Plan 49-02 effect at `useEffect(() => { if (location.pathname !== '/graph') { setCorrectionNode(null); setDragState(null); } }, [location.pathname])` now also calls `setPickMode(null)`. Any in-progress menu-driven Move/Merge cancels on navigation, matching CLAUDE.md's always-mounted-screen invariant."
  - "Plan 49-03's W-1 boundary test (`Test 13 — no pickMode state in GraphScreen`) inverted post-49-04. The test now asserts pickMode IS present. Plan 49-03 owned that test as its boundary; Plan 49-04's intended scope is to break it (W-1 was the planner-checker resolution boundary, not a permanent invariant)."
  - "MasterMap gained a new `onPickModeTap: (target) => boolean` prop (callback-ref-mirrored via onPickModeTapRef). The delegated click listener now consults the callback FIRST; if it returns true, the listener short-circuits (the tap was consumed by pick-mode commit OR invalid-target toast). Otherwise the listener falls through to the standard onNodeClick path. Single insertion point, zero churn on the long-press / drag paths from Plan 49-01."

patterns-established:
  - "Pattern: state-derivation from service journal — components subscribe to GRAPH_UPDATED and recompute local state via service.list().length or similar reads. Lazy-init in useState prevents first-paint flicker. Cleanup via captured unsub return."
  - "Pattern: pickModeRef closure-vs-state racing — when a delegated DOM listener inside a heavy useEffect (MindElixir re-init) needs to read latest React state, pass a callback prop AND mirror via useRef + sync useEffect. The listener reads via ref.current; identity changes on the callback prop don't tear down the heavy effect."
  - "Pattern: two-emit GRAPH_UPDATED correlation — when a command's downstream side effect (fire-and-forget classify) emits a second GRAPH_UPDATED some time later, UI handlers subscribe AFTER the command's own emit and read state on the next emit. Bounded by setTimeout fallback so a never-arriving second emit doesn't leak the subscription."
  - "Pattern: soft-commit with inline Undo affordance — for recoverable operations (soft-delete / prune), commit immediately + toast with an [Undo] action button. The action invokes the same service.undo() as a persistent corner button. Two surfaces, one recovery path."

requirements-completed: [GRAPHUI-02, GRAPHUI-01]  # GRAPHUI-02 (preview/confirmation for high-impact actions: merge, prune/delete, undo) finalized by this plan. GRAPHUI-01 already marked complete by Plan 49-01; Plan 49-04 extends it.

duration: 12m
completed: 2026-05-18
---

# Phase 49 Plan 04: UndoButton + PickModeBanner + Soft-Prune Snackbar + Detach Two-Emit Correlation Summary

**Persistent right-corner UndoButton (D-13) + menu-driven Move/Merge PickModeBanner with W-2 original-coord preservation + soft-prune snackbar with inline [Undo] action (D-10 / W-6) + detach toast variants via B-1 two-emit GRAPH_UPDATED correlation pattern — completing GRAPHUI-02 ahead of Plan 49-05's i18n + UAT pass.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-18T04:50:29Z
- **Completed:** 2026-05-18T05:02:42Z
- **Tasks:** 3
- **Files created:** 2 (UndoButton.tsx, PickModeBanner.tsx)
- **Files modified:** 10 (GraphScreen.tsx + 4 locale bundles + 5 test files)

## Accomplishments

- **UndoButton landed at right: 56px** — 36px circular, visual treatment mirrors the existing expand/collapse button (R17 / 49-PATTERNS §"UndoButton.tsx"). Subscribes to GRAPH_UPDATED on mount; recomputes `isEnabled = graphEditJournal.list().length > 0`. Initial state read at mount via the useState lazy initializer (no first-paint disabled→enabled flicker). Successful undo toasts `result.data.summary` (B-5 — the operator-facing phrase). Empty journal taps surface "Nothing to undo" (R11 / D-13 Option B). `reorganizing === true` disables tap visually + functionally (D-16).
- **PickModeBanner landed in-tree below the Header (R19)** — NOT portaled. Renders 'Tap a cluster to move "X" into it' OR 'Tap an anchor to merge "X" into' depending on `pickMode.kind`. Cancel button + Escape key both fire `onCancel`. `role="status"` + `aria-live="polite"` for screen reader announcement of pick-mode entry.
- **GraphScreen pickMode state machine with W-2 original-coord preservation** — pickMode state shape: `{ kind, sourceNode, originalAnchorX, originalAnchorY } | null`. handleCorrectionAction's move/merge cases capture `correctionNode.anchorX/Y` BEFORE clearing correctionNode + entering pickMode. handlePickModeCancel restores the CorrectionCard at `pickMode.originalAnchorX/Y` — NOT a window-center fallback. `! grep window.innerWidth/2 src/screens/GraphScreen.tsx` passes.
- **Pick-mode tap interception via onPickModeTap callback** — MasterMap gains a new `onPickModeTap: (target) => boolean` prop, mirrored via `onPickModeTapRef`. The delegated click listener consults the callback FIRST; if it returns true, the listener short-circuits (the tap was consumed by commit or invalid-target toast). Otherwise falls through to the standard onNodeClick path. Valid move target = `isClusterNode === true` → `graphCommandService.move` + success toast. Valid merge target = `isAnchorNode === true` → `setMergeConfirm({ loser, survivor })` so Plan 49-03's ConfirmDialog takes over. Invalid target → `graph.correction.pickMode.invalidTarget` toast.
- **handlePrune with Snackbar-with-Undo (D-10 / D-14 / W-6)** — awaits `graphCommandService.prune(node.id)`. On success, toasts with extended 3rd-arg `{ action: { label, onAction } }` (Plan 49-03's signature). Toast type stays `'info'` (W-6 acceptable per codebase convention; flag for operator UAT). Action label = `t('graph.correction.actions.undo')`. Action callback awaits `graphCommandService.undo()`; the follow-up toast uses `undoResult.data.summary` (B-5 — NEVER undoneCmd). NO ConfirmDialog mount (D-10 — soft prune is immediate commit + Undo).
- **handleDetach with B-1 Two-emit GRAPH_UPDATED correlation pattern** — Phase 48's `graphCommandService.detach` returns `ServiceResult<void>` (NOT `{ anchorId }` — that field never existed). The handler captures `originalParentId = node.parentId` BEFORE the detach call, awaits the detach (which emits its own GRAPH_UPDATED synchronously before await resolves), THEN subscribes to GRAPH_UPDATED. The next emit observed is the classify-completion signal; on that emit OR after a 5s timeout the handler re-reads `questionService.getAll({ includeFlagged: true })` and determines `newParentId`. Different → `detachedNewAnchor` toast (success). Same → `detachedSameAnchor` toast (info — best-match no-op). Source contains the load-bearing `// Two-emit correlation` comment marker (B-1 documentation).
- **Always-mounted reset effect extended to clear pickMode on tab navigation away** — `useEffect(() => { if (location.pathname !== '/graph') { setCorrectionNode(null); setDragState(null); setPickMode(null); } }, [location.pathname])`. Any in-progress menu-driven Move/Merge cancels on navigation, matching CLAUDE.md's always-mounted-screen invariant.
- **9 new i18n keys × 4 locales = 36 entries** — `graph.correction.actions.undo`, `graph.correction.toast.{undone, nothingToUndo, pruned, detachedNewAnchor, detachedSameAnchor}`, `graph.correction.pickMode.{move, merge, cancel, invalidTarget}`. Bundle-parity test stays green. Plan 49-05's Sonnet pass refines canonical zh/es/ja wording.

## Task Commits

Each task was committed atomically (RED test commit → GREEN feat commit):

1. **Task 1 RED — UndoButton 8 failing tests for B-5 summary fix** — `bbb49815` (test)
2. **Task 1 GREEN — UndoButton at right:56px + GraphScreen mount** — `b00b1b5c` (feat)
3. **Task 2 RED — PickModeBanner 6 tests + GraphScreen pickMode tests 7-14** — `b086410f` (test)
4. **Task 2 GREEN — PickModeBanner + menu-driven Move/Merge with W-2 preservation** — `e8fc6841` (feat)
5. **Task 3 RED — prune-undo (5) + detach-toast (9) tests for B-1 + B-5 + W-6** — `7dbcee6b` (test)
6. **Task 3 GREEN — soft-prune snackbar + detach two-emit correlation** — `f05e6b5a` (feat)

**Plan metadata commit:** (this commit, after Self-Check below).

## Files Created/Modified

### Created

- `app/src/components/graph/UndoButton.tsx` — Persistent corner Undo affordance. 36px circular at `bottom: 12px; right: 56px`. GRAPH_UPDATED subscriber recomputes `isEnabled` from `graphEditJournal.list().length`. B-5 toast uses `result.data.summary`.
- `app/src/components/graph/PickModeBanner.tsx` — In-tree banner below Header. Branches on `pickMode.kind` for the message. Escape-key cancel. role=status + aria-live=polite.

### Modified

- `app/src/screens/GraphScreen.tsx` — Imports UndoButton + PickModeBanner. MasterMap gains `reorganizing` + `onPickModeTap` props (callback-ref-mirrored). New pickMode state with W-2 shape. handleCorrectionAction move/merge cases capture original coords + enter pickMode. handlePickModeTap callback gives MasterMap's delegated click listener first crack at every tap. handlePickModeCancel restores at original coords. New handlePrune + handleDetach handlers (Task 3). Always-mounted reset effect extended to clear pickMode.
- `app/src/locales/{en,zh,es,ja}.json` — 9 new keys per locale (36 total): `graph.correction.actions.undo`, `graph.correction.toast.{undone, nothingToUndo, pruned, detachedNewAnchor, detachedSameAnchor}`, `graph.correction.pickMode.{move, merge, cancel, invalidTarget}`.
- `app/tests/components/graph/UndoButton.test.mjs` — Extended from 2 failing scaffold tests to 8 passing tests.
- `app/tests/components/graph/PickModeBanner.test.mjs` — Extended from 1 failing scaffold test to 6 passing tests.
- `app/tests/screens/GraphScreen.correction-card.test.mjs` — Extended from 14 passing tests (Plan 49-02) to 22 passing tests (added tests 7–14 for pickMode + W-2 + PickModeBanner mount).
- `app/tests/screens/GraphScreen.prune-undo.test.mjs` — Extended from 2 failing scaffold tests to 5 passing tests.
- `app/tests/screens/GraphScreen.detach-toast.test.mjs` — Extended from 2 failing scaffold tests to 9 passing tests.
- `app/tests/screens/GraphScreen.delete-confirm.test.mjs` — Plan 49-03's Test 13 (W-1 boundary forbidding pickMode in 49-03) INVERTED to assert pickMode IS present after Plan 49-04.

## i18n Stubs Inventory (for Plan 49-05 Sonnet reconciliation)

Added in this plan to all 4 locale bundles:

| Key | EN canonical | Plan 49-05 should re-translate? |
|---|---|---|
| `graph.correction.actions.undo` | "Undo" | ✅ |
| `graph.correction.toast.undone` | "Undone: {{summary}}" | ✅ (preserve `{{summary}}` interpolation — B-5) |
| `graph.correction.toast.nothingToUndo` | "Nothing to undo" | ✅ |
| `graph.correction.toast.pruned` | `"\"{{title}}\" pruned"` | ✅ (preserve `{{title}}`) |
| `graph.correction.toast.detachedNewAnchor` | `"\"{{qaTitle}}\" re-anchored under \"{{newAnchorTitle}}\""` | ✅ (preserve both interpolations) |
| `graph.correction.toast.detachedSameAnchor` | `"\"{{qaTitle}}\" stayed under \"{{anchorTitle}}\" (best match)"` | ✅ (preserve both interpolations) |
| `graph.correction.pickMode.move` | `"Tap a cluster to move \"{{title}}\" into it"` | ✅ (preserve `{{title}}`) |
| `graph.correction.pickMode.merge` | `"Tap an anchor to merge \"{{title}}\" into"` | ✅ (preserve `{{title}}`) |
| `graph.correction.pickMode.cancel` | "Cancel" | ✅ |
| `graph.correction.pickMode.invalidTarget` | "Not a valid target" | ✅ |

All zh/es/ja translations were authored in-line by Claude (Plan 49-05's Sonnet pass will refine canonical wording).

## Decisions Made

1. **UndoButton useState initial value uses the lazy-init form** `useState<boolean>(() => graphEditJournal.list().length > 0)`. Hydrating at mount avoids the first-paint disabled→enabled flicker that a default-false + post-mount-effect approach would produce. The graphEditJournal module is a leaf module (zero transitive deps per Phase 48 D-01) so reading at mount is fast and safe.
2. **pickModeRef was needed** (as anticipated in the plan's `<output>` section). The delegated click listener inside MasterMap's useEffect captures pickModeRef at attachment time; reading `pickModeRef.current` inside the listener closure picks up the latest GraphScreen state without forcing a heavy MindElixir re-init on every pickMode change. Mirrors the existing `onNodeClickRef` pattern from Plan 49-01.
3. **pickMode state shape captures originalAnchorX/Y (W-2 fix shipped).** Shape: `{ kind, sourceNode, originalAnchorX, originalAnchorY } | null`. handleCorrectionAction's move/merge cases read `correctionNode.anchorX/Y` AND copy them into the new pickMode object BEFORE clearing correctionNode. handlePickModeCancel then restores CorrectionCard at THOSE coords (NOT a window-center fallback).
4. **Detach handler uses two-emit GRAPH_UPDATED correlation pattern (B-1 fix shipped).** The handler subscribes to GRAPH_UPDATED AFTER the await on graphCommandService.detach resolves. Because detach's command-boundary emit fires synchronously inside the mutex BEFORE the await resolves, the first emit observed by the new subscription is the classify-completion emit (or never, in which case the 5s timeout fires). The handler never references `result.data.anchorId` — Phase 48's contract is `ServiceResult<void>`. Source contains the load-bearing `// Two-emit correlation` comment marker.
5. **All undo-toast references use `result.data.summary`, NEVER `result.data.undoneCmd` (B-5 fix shipped).** UndoButton's handleUndo callback uses `result.data?.summary`. handlePrune's inner [Undo] callback uses `undoResult.data?.summary`. The verb-literal `undoneCmd` is intended for log telemetry only — the plan's `<interfaces>` section makes this distinction load-bearing.
6. **Prune toast type stays `'info'` (W-6 acceptable per codebase convention; flag for operator UAT review).** Destructive-coloring it would feel alarmist for a recoverable soft-delete that already shows a clear [Undo] affordance. Operator can revisit at UAT.
7. **Always-mounted reset effect extended to also clear pickMode on tab navigation away.** Any in-progress menu-driven Move/Merge cancels on navigation, matching CLAUDE.md's always-mounted-screen invariant.
8. **Plan 49-03's W-1 boundary test inverted post-49-04.** Plan 49-03's `Test 13 — no pickMode state in GraphScreen` now asserts pickMode IS present. The original test was the planner-checker W-1 boundary forbidding pickMode in 49-03; Plan 49-04's intended scope is to break it.
9. **MasterMap gained a new `onPickModeTap: (target) => boolean` prop (callback-ref-mirrored via onPickModeTapRef).** The delegated click listener now consults the callback FIRST; if it returns true, the listener short-circuits. Otherwise falls through to the standard `onNodeClick` path. Single insertion point, zero churn on the long-press / drag paths from Plan 49-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Accidental `Record<string, Function>` type during Task 2 edit**
- **Found during:** Task 2 (running tsc post-edit)
- **Issue:** While extending `MasterMapProps` with the new `onPickModeTap` field, an Edit op accidentally replaced `Record<string, Question>` with `Record<string, Function>` in the `onDragEnd` signature. tsc would have flagged it; caught visually before the verify step.
- **Fix:** Reverted the type back to `Record<string, Question>` via a follow-up Edit.
- **Files modified:** `app/src/screens/GraphScreen.tsx`
- **Verification:** tsc clean modulo the pre-existing SavedScreen errors.
- **Committed in:** `e8fc6841` (Task 2 GREEN commit — all squashed together).

**2. [Rule 3 — Blocking] Plan 49-03's Test 13 (W-1 boundary forbidding pickMode in 49-03) inverted**
- **Found during:** Task 2 verify (running the GraphScreen.delete-confirm test after wiring pickMode)
- **Issue:** Plan 49-03 shipped a W-1 boundary test asserting `pickMode` MUST NOT appear in `GraphScreen.tsx`. Plan 49-04 introduces pickMode by design, breaking that test. Without inverting, the test would block every downstream test run.
- **Fix:** Inverted Test 13 to assert pickMode IS present. The test header comment + assertion message now read "post-49-04" semantics.
- **Files modified:** `app/tests/screens/GraphScreen.delete-confirm.test.mjs`
- **Verification:** Test 13 passes; all 7 GraphScreen.delete-confirm tests still pass.
- **Committed in:** `e8fc6841` (Task 2 GREEN commit).

**3. [Rule 3 — Blocking] Added 9 i18n keys × 4 locales = 36 entries to keep bundle-parity green**
- **Found during:** Tasks 1–3 (after adding each new i18n key to en.json)
- **Issue:** Adding keys to en.json without parallel additions to zh/es/ja breaks `bundle-parity.test.mjs`. Plans 49-01..03 all established the same precedent — Rule 3 blocking fixes.
- **Fix:** Translated all 9 keys for zh/es/ja in-line.
- **Files modified:** `app/src/locales/{zh,es,ja}.json`
- **Verification:** `node --test tests/locales/bundle-parity.test.mjs` → 2/2 pass.
- **Committed in:** Spread across `b00b1b5c` (Task 1), `e8fc6841` (Task 2), `f05e6b5a` (Task 3).

**4. [Rule 1 — Bug] UndoButton.tsx initial draft had `result.data.undoneCmd` inside a doc comment**
- **Found during:** Task 1 verify (running UndoButton Test 6's B-5 negative grep)
- **Issue:** My first draft of the UndoButton doc comment included the string "the verb literal ('rename' | 'move' | ...) intended for log telemetry only. NEVER use `result.data.undoneCmd` in user-facing toast." Test 6's negative grep `! /result\.data\.undoneCmd/.test(src)` matched the comment string and failed. Same regex-string-collision pattern Plan 49-03 hit twice in deviations #4 and #6.
- **Fix:** Reworded the comment to "NEVER use the verb-literal cmd field in user-facing toast" — preserves meaning without the literal grep hit.
- **Files modified:** `app/src/components/graph/UndoButton.tsx`
- **Verification:** Test 6 passes; `! grep result.data.undoneCmd src/components/graph/UndoButton.tsx` → exit 1 (no match).
- **Committed in:** `b00b1b5c` (Task 1 GREEN commit).

**5. [Rule 1 — Bug] UndoButton.test.mjs Test 3 regex `useState[^(]*\(` was too strict**
- **Found during:** Task 1 verify (running UndoButton tests)
- **Issue:** Test 3 asserted the useState initial value reads `graphEditJournal.list().length` via the regex `/useState[^(]*\([^)]*graphEditJournal\.list\(\)\.length/`. The `[^)]*` clause forbids parens inside the match — but the lazy initializer `() => graphEditJournal.list()...` contains parens. The regex would never match a valid lazy-init form.
- **Fix:** Loosened to `/useState[\s\S]*?graphEditJournal\.list\(\)\.length/` — single non-greedy any-char so parens are allowed.
- **Files modified:** `app/tests/components/graph/UndoButton.test.mjs`
- **Verification:** Test 3 passes against the lazy-init source shape.
- **Committed in:** `b00b1b5c` (Task 1 GREEN commit — RED test was committed first as `bbb49815`, then loosened in the GREEN commit).

---

**Total deviations:** 5 auto-fixed (2 Rule 1 bugs, 3 Rule 3 blocking). None changed plan scope. All were either type-correctness (#1), test-boundary inversion (#2), bundle-parity preservation (#3), regex-string-collision (#4), or my own RED test being too strict (#5).
**Impact on plan:** Zero scope creep. Every fix was either an unblocking concern (bundle-parity, type-correctness, test-inversion) or my own test-authoring error (the regex bug + the comment-string collision).

## Issues Encountered

- **Pre-existing test failures untouched.** After Plan 49-04's commits, `npm run test:main` reports `1092 pass, 2 fail`:
  - `tests/concept-feed.test.mjs` — the date-related flake documented in Plan 49-01's SUMMARY (today is 2026-05-18 but fixture expects 2026-05-17).
  - `tests/screens/GraphScreen.reload-survival.test.mjs` — the Plan 49-05 reload-survival harness scaffold (`_graph-screen-reload-harness.mjs` not yet created). Owned by Plan 49-05.
  - Neither is a Plan 49-04 regression. The test count moved from `9 fail` at end of Plan 49-03 → `2 fail` at end of Plan 49-04 — Plan 49-04 turned 7 Wave-0 scaffolds GREEN.
- **Pre-existing tsc errors in `src/screens/SavedScreen.tsx:186`** unchanged (i18next deep-type inference issue, logged to `deferred-items.md` by Plan 49-03 per Scope Boundary).

## Confirmation of Plan-Checker B-1 + B-5 + W-2 + W-6 Fixes

| Fix | Where verified | Test / grep |
|---|---|---|
| B-1 (no `result.data.anchorId`) | `! grep result.data.anchorId src/screens/GraphScreen.tsx` | exit 1 ✓ |
| B-1 (Two-emit correlation comment marker) | `grep -q "Two-emit correlation" src/screens/GraphScreen.tsx` | exit 0 ✓ |
| B-1 (`questionService.getAll({ includeFlagged: true })` in detach) | `tests/screens/GraphScreen.detach-toast.test.mjs` Test 8 | passes ✓ |
| B-1 (5s timeout fallback) | `tests/screens/GraphScreen.detach-toast.test.mjs` Test 7 | passes ✓ |
| B-5 (no `result.data.undoneCmd` in user-facing toast) | `! grep result.data.undoneCmd src/components/graph/UndoButton.tsx src/screens/GraphScreen.tsx` | exit 1 ✓ |
| B-5 (`result.data.summary` referenced) | `tests/components/graph/UndoButton.test.mjs` Test 6 + `tests/screens/GraphScreen.prune-undo.test.mjs` Test 3 | both pass ✓ |
| W-2 (no `window.innerWidth / 2`) | `! grep -E "window\.innerWidth\s*/\s*2" src/screens/GraphScreen.tsx` | exit 1 ✓ |
| W-2 (originalAnchorX/Y in pickMode shape) | `tests/screens/GraphScreen.correction-card.test.mjs` Tests 7, 9, 10, 13 | all pass ✓ |
| W-6 (prune toast type stays `'info'`) | source-reading via `tests/screens/GraphScreen.prune-undo.test.mjs` Test 2 | passes ✓ |

## UndoButton + PickModeBanner Final Shapes

```typescript
// UndoButton
export interface UndoButtonProps {
  reorganizing: boolean;
}
export function UndoButton({ reorganizing }: UndoButtonProps);

// PickModeBanner
export interface PickModeBannerProps {
  pickMode: { kind: 'move' | 'merge'; sourceNode: Question };
  onCancel: () => void;
}
export function PickModeBanner({ pickMode, onCancel }: PickModeBannerProps);

// GraphScreen — pickMode state shape (W-2)
type PickModeState = {
  kind: 'move' | 'merge';
  sourceNode: Question;
  originalAnchorX: number;    // W-2: captured at pickMode-entry from correctionNode.anchorX
  originalAnchorY: number;    // W-2: captured at pickMode-entry from correctionNode.anchorY
} | null;
```

## User Setup Required

None — no external service configuration. All work is local React + state management + i18n.

## Operator-UAT Flag (W-6)

Prune toast type currently `'info'` per W-6 — acceptable per codebase convention; flag for operator UAT review. If the operator prefers destructive-colored prune snackbars, switch to `'error'` (existing Toast types don't include a 'warning' or 'destructive' literal). Recommended: keep `'info'` unless UAT shows users are missing the prune event in the toast stream.

## Next Plan Readiness

- **Plan 49-05 unblocked.** Its i18n reconciliation pass now has 9 additional `graph.correction.*` keys to refine via the Sonnet subagent, in addition to the 18 from Plans 49-01..03 (5 + 13 + 14 = 32 prior). Plan 49-05's reload-survival harness scaffold (`tests/screens/_graph-screen-reload-harness.mjs`) is unchanged — 1 remaining failing test.
- **CLAUDE.md invariants preserved:**
  - No new `transform`/`will-change`/`filter`/`contain` ancestors of `<Header>`.
  - PickModeBanner renders in-tree (NOT portaled) below the Header in `GraphScreen`'s plain `<div>` wrapper.
  - UndoButton mounts inside `MasterMap`'s containing block — same containing block as the existing expand/collapse button. No additional containing-block creators added.
  - `data-no-swipe-nav="true"` (line 408 of original) untouched.
  - `touchAction: 'none'` untouched.
  - The existing click + pointerdown listeners are still wired at the same insertion points.
  - No Tailwind utility classes in any new component.
  - No `body { overflow }` changes. SwipeTabContainer untouched.
- **Phase 49 mandate met: GRAPHUI-02 complete.** "Clear preview/confirmation for high-impact actions (merge, prune/delete, undo)" — merge has MergeConfirmPreview (Plan 49-03), delete has destructive ConfirmDialog (Plan 49-03), prune has Snackbar-with-Undo (Plan 49-04), undo has the persistent corner button + per-action [Undo] (Plan 49-04). Detach uses the two-variant toast (Plan 49-04).

## Self-Check: PASSED

All claimed artifacts verified to exist on disk:
- `/Users/Code/EchoLearn/app/src/components/graph/UndoButton.tsx` ✓ (created)
- `/Users/Code/EchoLearn/app/src/components/graph/PickModeBanner.tsx` ✓ (created)
- `/Users/Code/EchoLearn/app/src/screens/GraphScreen.tsx` ✓ (modified)
- `/Users/Code/EchoLearn/app/src/locales/{en,zh,es,ja}.json` ✓ (all 4 modified)
- All 5 test files modified ✓

All claimed commits verified in git log:
- `bbb49815` test(49-04): RED — UndoButton 8 failing tests for B-5 summary fix ✓
- `b00b1b5c` feat(49-04): GREEN — UndoButton at right:56px + GraphScreen mount ✓
- `b086410f` test(49-04): RED — PickModeBanner 6 tests + GraphScreen pickMode tests 7-14 ✓
- `e8fc6841` feat(49-04): GREEN — PickModeBanner + menu-driven Move/Merge with W-2 original-coord preservation ✓
- `7dbcee6b` test(49-04): RED — prune-undo (5) + detach-toast (9) tests for B-1 + B-5 + W-6 ✓
- `f05e6b5a` feat(49-04): GREEN — soft-prune snackbar + detach two-emit correlation (B-1 + B-5 + W-6) ✓

Test verification:
- `cd app && node --test tests/components/graph/UndoButton.test.mjs` → 8/8 pass ✓
- `cd app && node --test tests/components/graph/PickModeBanner.test.mjs` → 6/6 pass ✓
- `cd app && node --test tests/screens/GraphScreen.prune-undo.test.mjs` → 5/5 pass ✓
- `cd app && node --test tests/screens/GraphScreen.detach-toast.test.mjs` → 9/9 pass ✓
- `cd app && node --test tests/screens/GraphScreen.correction-card.test.mjs` → 22/22 pass ✓
- `cd app && node --test tests/locales/bundle-parity.test.mjs` → 2/2 pass ✓
- `cd app && node --test tests/hooks/useLongPressOrDrag.test.mjs tests/components/graph/DragOverlay.test.mjs tests/components/graph/CorrectionCard.test.mjs tests/components/graph/MergeConfirmPreview.test.mjs tests/components/ui/ConfirmDialog.test.mjs tests/components/Toast.action.test.mjs tests/screens/GraphScreen.reorg-gate.test.mjs tests/screens/GraphScreen.delete-confirm.test.mjs` → all 49 pass ✓ (no regression of 49-01/02/03)
- `cd app && npm run test:main` → 1092 pass, 2 fail. The 2 failures are documented pre-existing: `tests/concept-feed.test.mjs` (date flake, owned 49-01 SUMMARY) + `tests/screens/GraphScreen.reload-survival.test.mjs` (Plan 49-05 harness scaffold). Plan 49-04 turned 7 Wave-0 scaffolds GREEN (from 9 fail end-of-49-03 to 2 fail end-of-49-04) with zero regressions ✓
- `cd app && npx tsc -b --noEmit` → clean modulo 2 pre-existing SavedScreen.tsx errors (logged to deferred-items.md per Scope Boundary) ✓
- `cd app && npx eslint src/components/graph/UndoButton.tsx src/components/graph/PickModeBanner.tsx src/screens/GraphScreen.tsx` → clean ✓

Verification greps:
- `! grep result.data.undoneCmd src/components/graph/UndoButton.tsx src/screens/GraphScreen.tsx` → exit 1 (B-5) ✓
- `! grep result.data.anchorId src/screens/GraphScreen.tsx` → exit 1 (B-1) ✓
- `grep -q "Two-emit correlation" src/screens/GraphScreen.tsx` → exit 0 (B-1 marker) ✓
- `! grep -E "window\.innerWidth\s*/\s*2" src/screens/GraphScreen.tsx` → exit 1 (W-2) ✓

---

*Phase: 49-graph-correction-ui*
*Completed: 2026-05-18*
