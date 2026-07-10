---
status: resolved
resolved_at: 2026-05-19T07:00:00Z
resolved_by: "Plan 49-06 — useLongPressOrDrag onLongPressRecognized + capture-phase pointermove + state-machine feed. Phantom-finger leak fix at 49-06.1; drag-starvation fix at 49-06.2."
trigger: "Phase 49 UAT Test 1 — long-press menu fires on finger release instead of 480ms tick AND canvas pans with the dragged ghost so the node cannot be repositioned"
created: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

reasoning_checkpoint:
  hypothesis: |
    Two independent root causes blocking Test 1:
    (1) `useLongPressOrDrag.ts` (`createLongPressOrDragMachine`) sets `didLongPress = true` inside the 480ms timeout but does not invoke any "long-press recognized" callback; the actual `onLongPressRelease` fires inside `onPointerUp` — so the CorrectionCard only mounts when the user lifts their finger. This is the WRONG state machine shape: the codebase-wide feed-tile pattern (`useLongPress.ts:42-45`) invokes the menu-open callback INSIDE the timer.
    (2) The implementation never suppresses MindElixir's pan handler. MindElixir registers its own `pointerdown`/`pointermove` listeners on the same container GraphScreen attaches to, sets pointer capture on the FIRST pointerdown, and panes the map on every subsequent `pointermove` (because `editable: false` short-circuits its drag branch and falls into the pan branch). GraphScreen's `setPointerCapture` only fires inside `onDragStart` — too late, and pointer-capture transfer doesn't stop a co-registered listener on the SAME element from firing.
  confirming_evidence:
    - "useLongPressOrDrag.ts:104-108 — only side-effect of the 480ms timer is `didLongPress = true` + haptic; no callback fires while finger is still down."
    - "useLongPressOrDrag.ts:141-149 — `onLongPressRelease` (the menu callback) is invoked from inside `onPointerUp`, gated on `didLongPress && !didDrag`."
    - "useLongPress.ts:42-45 — for comparison, the feed-tile pattern fires `callbackRef.current()` INSIDE the setTimeout, which is the behavior the operator's complaint matches against."
    - "GraphScreen.tsx:436-460 — `onLongPressRelease` config wires `onLongPressReleaseRef.current(activeNode, x, y)` → `handleLongPressRelease` in GraphScreen → `setCorrectionNode(...)`. This is the menu mount, and it transitively only runs through `onPointerUp`."
    - "GraphScreen.tsx:404-484 — `handlePointerDown` does NOT call `event.stopPropagation()` or `event.preventDefault()` on either pointerdown OR pointermove. MindElixir's listeners co-fire."
    - "MindElixir bundle `MindElixir.js:1097-1101` — registers `pointerdown`, `pointermove`, `pointerup`, `pointercancel` on `_` (= `e.container`), which is the SAME element GraphScreen attaches its own pointerdown listener to."
    - "MindElixir.js:1044-1045 — with `editable: false`, the pointerdown handler `L` falls into the pan branch: `W = true` always, so `t.mousedown = true` AND `w.setPointerCapture(f.pointerId)` fires on the FIRST pointerdown."
    - "MindElixir.js:1046-1075 — pointermove handler `T` calls `t.onMove(dx, dy)` on every move, which calls `e.move(dx, dy)` (= map pan) via `Uo` (`MindElixir.js:2716-2724`)."
    - "GraphScreen.tsx:446 — `setPointerCapture` is called inside `onDragStart` (after 480ms + 8px). By then MindElixir has been panning since the very first pointermove. Pointer-capture transfer reroutes events but does NOT stop other listeners on the captured element from firing."
    - "RESEARCH §R1 line 297 explicitly named `setPointerCapture` + 'so MindElixir's pan/zoom stops fighting' as the strategy, but the implementation only applies it at drag-start, not at long-press recognition; AND pointer capture alone does not stop co-registered listeners on the same element."
    - "GraphScreen.tsx:379-380 — code comment says 'Do NOT stopPropagation() on raw pointerdown — MindElixir's pan still needs the pointer until long-press is recognized.' The implementation never adds the *post-recognition* stopPropagation step the comment implies."
    - "tests/hooks/useLongPressOrDrag.test.mjs Test 1 line 82-86 asserts `onLongPressRelease` fires after `setTimeout(25)` + `onPointerUp(...)` — the test is encoded against the bug, not against the operator's expectation. There is no test for 'menu fires WHILE finger is still down at the 480ms tick.'"
  falsification_test: |
    For Finding 1: stub the factory to invoke a new `onLongPressRecognized` callback inside the 480ms setTimeout (parallel to setting didLongPress). Wire GraphScreen's `setCorrectionNode` to that new callback instead of `onLongPressRelease`. With finger still held down at the 500ms mark, the CorrectionCard should now mount BEFORE pointerup. If it does not, Finding 1 is wrong.
    For Finding 2: in the same setTimeout (after 480ms recognized), call `pointerdownEvent.stopImmediatePropagation()` AND override MindElixir's dragMoveHelper state (`mei.dragMoveHelper.clear()`) AND attach a pointermove listener in the CAPTURE phase that calls `e.stopPropagation()`. Drag the node and observe whether the canvas stays still while the ghost translates. If the canvas still pans, Finding 2 is wrong (and the real cause is elsewhere in MindElixir, e.g., the wheel handler or a separate transform pipeline).
  fix_rationale: |
    Finding 1 fix: split the state machine into THREE callbacks — `onLongPressRecognized(x, y)` fires inside the timer (matches feed-tile pattern); `onDragStart` fires when post-recognition movement crosses 8px; `onDragEnd` fires on pointerup-after-drag. Drop the `onLongPressRelease` callback (or repurpose it as a no-op default). GraphScreen's `setCorrectionNode` wires to `onLongPressRecognized` so the menu mounts mid-press. Click suppression keeps working via `didLongPress` flag for the synthetic click that follows pointerup.
    Finding 2 fix: AT the moment long-press is recognized (inside the 480ms timer), forcibly disable MindElixir's pan handler. Three layered defenses needed: (a) `mei.dragMoveHelper.clear()` to reset MindElixir's internal `mousedown=true` state set on pointerdown so its next pointermove no-ops; (b) attach a pointermove listener in the CAPTURE phase (`{ capture: true }`) that calls `event.stopPropagation()` so MindElixir's bubbling handler never fires; (c) re-`setPointerCapture` to GraphScreen's overlay target so MindElixir's pointerup also routes correctly. Defenses must engage at long-press-recognition (480ms timer fires), not at drag-start (which is 8px later). Need to re-enable MindElixir's pan on `pointerup` / `pointercancel` so subsequent gestures work normally.
  blind_spots: |
    - Have not tested on a real touch device — all reasoning is source-reading of MindElixir's bundled dist and the React code. Possible the bundle's actual runtime behavior diverges from the static read (minified/compiled vs the source comments).
    - The exact API to "tell MindElixir to stop panning" is not documented (no `me.disablePan()` exists). The proposed `dragMoveHelper.clear()` + capture-phase stopPropagation is the inferred-correct approach but may require iteration.
    - Pointer-events spec interaction with MindElixir's pre-existing capture is subtle — the implementation may need to release MindElixir's capture explicitly before claiming it (via `releasePointerCapture` then `setPointerCapture`).
    - GraphScreen's container has `touchAction: 'none'` (line 632), which DISABLES browser-native gestures. This is correct, but the interaction with `editable: false` MindElixir taking pointer capture on every touch may produce subtly different behavior on iOS Safari WebView vs Android Chromium vs desktop Chrome. Operator was testing on web; phone behavior may differ.

test: "(diagnosis only — no fix applied)"
expecting: "plan-phase --gaps to produce the fix plan based on the two root causes and suggested directions below."
next_action: "Return ROOT CAUSE FOUND structured response to orchestrator."

## Symptoms

expected: "Long-press anchor at default 0.5× zoom → haptic + ghost @480ms (while finger is still down) → drag toward another anchor → halo activates within ~32px → ghost snaps to target. Acceptable band 24-48px."
actual: "Yes popover displayed, but was triggered by release of finger after long-press instead of time-lapsed of long-press like the long-press behavior in feed post tiles. Another issue: The graph canvas is also moved along with the node when user long-press and drag the node, which keeps the node centered and cannot really be repositioned to other location. Blocked."
errors: []
reproduction: |
  1. Open Graph tab at default 0.5× zoom with ≥5 anchors visible
  2. Long-press an anchor (hold past 480ms)
  3. Observe: nothing visible until finger is released — then the CorrectionCard appears (Finding 1)
  4. Repeat the long-press, but this time after 480ms start dragging — observe the canvas panning along with the finger so the node stays visually centered (Finding 2)
started: "2026-05-17 Phase 49 first UAT pass — implementation was tested via source-reading tests only; no on-device gesture verification."

## Eliminated

(none — both root causes confirmed via static code analysis)

## Evidence

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/src/hooks/useLongPressOrDrag.ts:78-200 (full createLongPressOrDragMachine factory)"
  found: |
    The 480ms setTimeout (line 104-108) only sets `didLongPress = true` and fires
    haptic. No callback fires the "menu should now open" signal mid-press. The
    actual `onLongPressRelease` callback that mounts the CorrectionCard fires
    inside onPointerUp (line 141-149), gated on `didLongPress && !didDrag`.
  implication: |
    This is mechanically a "long-tap" gesture, not a "long-press recognized while
    finger is still down" gesture. The state machine is missing an
    `onLongPressRecognized` event that the feed-tile pattern emits.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/src/hooks/useLongPress.ts:39-46 (reference feed-tile pattern)"
  found: |
    `useLongPress` fires `callbackRef.current()` INSIDE the setTimeout (line 44).
    The consuming feed-tile component (e.g., MasonryFeed.tsx:354) passes the
    menu-open callback as the second argument — the menu mounts while finger
    is still down. This is the behavior the operator's complaint references.
  implication: |
    `useLongPressOrDrag` should have ported the same "fire callback in timer"
    pattern, but split it into two callbacks (recognized + released) instead.
    It only kept the released one.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/src/screens/GraphScreen.tsx:436-484 (delegated listener wire-up) + 769-797 (handleLongPressRelease)"
  found: |
    GraphScreen creates a fresh machine per pointerdown with `onLongPressRelease`
    wired to `setCorrectionNode({ node, anchorX, anchorY })`. There is no
    `onLongPressRecognized` callback in the factory's options shape, so
    GraphScreen has no way to mount the card mid-press even if it wanted to.
  implication: |
    Fix requires extending the factory's `UseLongPressOrDragOptions` interface
    with a new optional `onLongPressRecognized(x, y)` field, and GraphScreen
    wires the card-mount to it.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/node_modules/mind-elixir/dist/MindElixir.js:1029-1075 (pointerdown handler L + pointermove handler T)"
  found: |
    Line 1044: `W = !e.editable || ...` — with `editable: false`, `W = true`.
    Line 1045: enters the pan branch `t.mousedown = !0, w.setPointerCapture(f.pointerId)`.
    Line 1069-1074: `T` calls `t.onMove(dx, dy)` on every pointermove not in
    drag mode (and with editable:false drag mode is never entered).
    Line 2716-2724 (Uo): `onMove(dx, dy)` calls `e.move(dx, dy)` — pans the map.
  implication: |
    MindElixir pans the map on EVERY pointermove with editable:false. This
    starts the moment the user touches a node and continues until pointerup.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/node_modules/mind-elixir/dist/MindElixir.js:1095-1108 (event registration)"
  found: |
    All listeners (pointerdown, pointermove, pointerup, pointercancel, click,
    dblclick, contextmenu, wheel, blur, keydown, keyup) are registered on
    `_` = `e.container`. GraphScreen's `containerRef.current` IS that same
    container — both libraries' listeners coexist on the identical element.
  implication: |
    `setPointerCapture` from GraphScreen's `onDragStart` does NOT prevent
    MindElixir's own pointermove listener from firing — they are co-registered
    on the same element. Pointer capture controls routing across DOM, not
    same-element listener fanout.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/src/screens/GraphScreen.tsx:436-484 + 379-380 comment"
  found: |
    Implementation comment at 379-380 explicitly acknowledges "Do NOT
    stopPropagation() on raw pointerdown — MindElixir's pan still needs the
    pointer until long-press is recognized." But there is no symmetric step
    AFTER recognition: no pointermove `stopPropagation`, no call to
    `mei.dragMoveHelper.clear()`, no swap of MindElixir's pointer capture.
  implication: |
    The author understood the requirement ("until long-press is recognized")
    but did not implement the second half: "after long-press is recognized,
    DO suppress MindElixir's pan." That step is missing.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/tests/hooks/useLongPressOrDrag.test.mjs Test 1 (line 64-87)"
  found: |
    Test asserts `onLongPressRelease` fires AFTER `setTimeout(25)` + `onPointerUp`.
    There is NO test asserting "a callback fires while finger is held down at
    the 480ms tick." The test contract was written against the implementation,
    not against the operator's UX expectation.
  implication: |
    The tests passed while the UX was broken. Fix must ALSO add a new
    behavioral test that fires onLongPressRecognized at 480ms with NO pointerup,
    and asserts the callback invoked.

- timestamp: 2026-05-18T00:00:00Z
  checked: "app/tests/components/graph/DragOverlay.test.mjs (full file)"
  found: |
    Test file is source-reading only: portal target, snap radius constant, halo
    colors, zIndex layers, SSR guard. No behavioral test for "MindElixir pan is
    suppressed during drag" or "ghost translates while canvas stays still."
  implication: |
    No regression coverage existed for Finding 2. Fix must add a behavioral
    test (probably at GraphScreen integration level, not DragOverlay unit
    level) that triggers a long-press-drag and verifies MindElixir's `mei.move`
    is NOT called between long-press-recognized and pointerup.

## Resolution

root_cause:
  finding_1: |
    `useLongPressOrDrag.ts` `createLongPressOrDragMachine` (lines 98-149)
    omits the "long-press recognized" callback. The 480ms timer only sets the
    internal `didLongPress` flag (line 105) plus haptic; the consumer-visible
    `onLongPressRelease` callback fires inside `onPointerUp` (line 148), gated
    on `didLongPress && !didDrag`. GraphScreen wires its CorrectionCard mount
    to `onLongPressRelease` (GraphScreen.tsx:439-442 → handleLongPressRelease
    at 769-797 → setCorrectionNode), so the card only mounts after the user
    lifts their finger. The codebase-wide convention at `useLongPress.ts:42-45`
    fires the callback INSIDE the timer — the new hook lost that semantic.

  finding_2: |
    Two stacked issues conspire:
    (a) MindElixir registers its own pointerdown / pointermove / pointerup /
        pointercancel listeners on the SAME container GraphScreen attaches its
        delegated listener to (`MindElixir.js:1095-1101`).
    (b) With `editable: false` (the Trellis config), MindElixir's pointerdown
        handler ALWAYS falls into the pan branch — `t.mousedown = true` +
        `setPointerCapture(pointerId)` — on the FIRST touch
        (`MindElixir.js:1044-1045`). Every subsequent pointermove invokes
        `t.onMove(dx, dy)` which calls `e.move(dx, dy)` to pan the map
        (`MindElixir.js:1071-1074` + `MindElixir.js:2723-2724`).

    GraphScreen never neutralizes MindElixir's pan after long-press is
    recognized: no call to `mei.dragMoveHelper.clear()`, no capture-phase
    pointermove listener with `stopPropagation()`, no override of MindElixir's
    pointer capture. The `setPointerCapture` at GraphScreen.tsx:446 fires only
    on drag-start (480ms + 8px later) and only reroutes events to GraphScreen's
    target — it does NOT prevent MindElixir's co-registered listener on the
    same container from firing. The implementer comment at GraphScreen.tsx:379-380
    correctly identifies the "do not stopPropagation BEFORE recognition"
    constraint but never implements the symmetric "DO stopPropagation AFTER
    recognition" step.

fix:
  finding_1: |
    1. Extend `UseLongPressOrDragOptions` interface in
       `app/src/hooks/useLongPressOrDrag.ts` with a new optional callback:
       `onLongPressRecognized?: (x, y) => void`.
    2. Inside the 480ms `setTimeout` (currently line 104-108), after setting
       `didLongPress = true` and firing haptic, also invoke
       `opts.onLongPressRecognized?.(startCoord.x, startCoord.y)`.
    3. Decide what to do with the existing `onLongPressRelease` callback:
       either drop it entirely (consumers migrate to `onLongPressRecognized`)
       OR keep it as a separate "released without drag" callback for
       consumers that need the distinction. Recommendation: drop it —
       GraphScreen only cared about the mid-press recognition signal, and
       the cleanup-on-pointerup is already idempotent (state already set).
    4. In `GraphScreen.tsx` (around line 436-460): rename
       `onLongPressRelease` config to `onLongPressRecognized` (matching
       the new factory signature).
    5. Update tests at `app/tests/hooks/useLongPressOrDrag.test.mjs`:
       Test 1 must now assert `onLongPressRecognized` fires BEFORE pointerup
       (after ~25ms of held-down with NO pointerup call). Add a new test
       verifying `onLongPressRecognized` does NOT fire if pointermove crosses
       the 8px threshold before 480ms (pan path cancels recognition).

  finding_2: |
    Inside the 480ms timer in `createLongPressOrDragMachine` (the same place
    Finding 1's fix adds `onLongPressRecognized`), engage MindElixir-pan
    suppression. Approach (layered defenses, all needed):

    1. Add a new `onLongPressRecognized` callback parameter to the factory
       that GraphScreen wires to a handler doing:
       (a) `mei.dragMoveHelper.clear()` — resets MindElixir's internal
           `mousedown` flag set on the initial pointerdown, so its next
           pointermove no-ops the pan.
       (b) Attach a capture-phase pointermove listener on the container that
           calls `event.stopPropagation()` for the remainder of the gesture.
           Tear down on pointerup/pointercancel.
       (c) Call `containerRef.current.setPointerCapture(pointerdownEvent.pointerId)`
           (NOT the target node — the container, so MindElixir's pointerup
           also routes correctly).

    2. The pan-suppression engages at long-press RECOGNITION (480ms), not at
       drag-start (480ms + 8px). This way the canvas freezes the moment the
       gesture commits to the long-press path, even before the user starts
       dragging.

    3. Move the existing `setPointerCapture` call from `onDragStart`
       (GraphScreen.tsx:446) into the new `onLongPressRecognized` handler.

    4. Tear down: on pointerup or pointercancel, REMOVE the capture-phase
       pointermove listener so MindElixir's pan re-enables for subsequent
       gestures. The dragMoveHelper.clear() already resets state — no
       affirmative re-enable needed.

    5. Verify on real touch device: the comment at GraphScreen.tsx:379-380
       must be UPDATED to reflect the new symmetric policy ("Do NOT
       stopPropagation BEFORE long-press recognized; DO stopPropagation
       AFTER").

    6. Add an integration test (probably at
       `app/tests/screens/GraphScreen.gesture-isolation.test.mjs` — new file)
       that simulates a 480ms+ hold then drag and asserts `mei.move` is NOT
       invoked between recognition and pointerup. The DragOverlay unit tests
       are not the right place — this is a cross-library coordination test.

verification: "(diagnosis only — fix will be planned by plan-phase --gaps and applied by execute-phase --gaps-only)"

files_changed: []
