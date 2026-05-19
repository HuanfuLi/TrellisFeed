---
status: complete
phase: 49-graph-correction-ui
source: 49-05-SUMMARY.md, 49-06-SUMMARY.md
started: 2026-05-18T00:00:00Z
updated: 2026-05-19T07:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Magnetic snap on long-press drag
expected: Long-press anchor at default 0.5× zoom → haptic + ghost @480ms → drag toward another anchor → halo activates within ~32px → ghost snaps to target. Acceptable band 24-48px.
result: pass
resolved_by: "Plan 49-06 — `useLongPressOrDrag` renamed `onLongPressRelease` → `onLongPressRecognized` and fires the callback inside the 480ms setTimeout; `GraphScreen.tsx` capture-phase pointermove listener now drives the state machine AND calls stopPropagation (49-06.2 at commit f28049a4) so MindElixir's bubble-phase pan handler stays silent for the duration of the gesture. Phantom-finger leak (tier-a/b/setPointerCapture preempting MindElixir's pinch-zoom Map cleanup) removed at 49-06.1 (28ecc89b)."
re_tested: "2026-05-19 — Pixel 10 Pro pass"

### 2. Haptic feedback
expected: Long-press a node → light tap haptic at 480ms. Drag + drop on a valid cluster → medium tap haptic at drop.
result: pass
re_tested: "2026-05-19 — Pixel 10 Pro pass. Plan 49-06 moved the haptic into the 480ms setTimeout (`useLongPressOrDrag.ts`), so the tap fires while the finger is still down."

### 3. Drag does not fight MindElixir pan/zoom
expected: Pinch-zoom out to ~0.3×; long-press a deep anchor; drag toward a different cluster. Gesture commits without the map snapping back to default scale.
result: skipped
reason: "DEFERRED TO PHASE 53 (known issue). On Pixel 10 Pro at non-default zoom, drop or undo currently resets the viewport to the default 0.5× center. Four fix attempts (49-06.3 capture/restore transform; 49-06.4 init/refresh split; two first-run-skip variants) were rolled back at commit c6ac6170 — likely a React 19 StrictMode + MindElixir.init ordering hazard. Further attempts need on-device console.log instrumentation. Plan 49-06 SUMMARY documents this as the sole UAT-deferred item. Tracked alongside other graph-hygiene gaps for Phase 53."
severity: minor

### 4. Pick-mode banner + Header positioning
expected: Long-press an anchor → Move row → banner appears below Header. Swipe to Planner tab and back to Graph. Header stays in place; banner is still visible OR resets cleanly (always-mounted reset effect nulls pickMode on /graph leave).
result: pass
note: "Confirmed 'resets cleanly' path — pickMode nulled on /graph leave, banner gone on return. Operator confirmed the disappearing element was the pick-mode banner (intentional), not the Graph tab Header (which would be a regression)."

### 5. Pick-mode original-coord restore (W-2)
expected: Long-press an anchor in the upper-left of the visible map → Move row → banner → tap Cancel in banner. CorrectionCard reappears at the ORIGINAL anchor position (upper-left), NOT at screen-center.
result: pass

### 6. Reorganize gate (D-16)
expected: Trigger Reorganize; during reorg, long-press an anchor → card shows paused row; attempt drag → toast "Reorganize in progress — try again in a moment" and ghost does NOT mount; Undo button is grayed. After REORG_COMPLETED, all controls re-enable.
result: pass

### 7. Detach two-emit correlation (B-1)
expected: Long-press a Q&A leaf → Detach (Re-classify) row → wait for classifier. Toast surfaces the re-anchored OR same-anchor variant with the resulting anchor title. If LLM is slow (>5s), toast may be silent (B-1 timeout fallback) but the map still updates correctly.
result: pass

### 8. Undo summary toast (B-5)
expected: Rename an anchor → tap Undo corner button → toast reads `Undone: rename '<new>' → '<old>'` (operator-facing `summary`), NOT a bare verb literal like `Undone: rename`.
result: pass

### 9. Prune toast type review (W-6)
expected: Prune an anchor → snackbar appears with type `'info'` (current default). Operator decides: accept `'info'` OR file a follow-up to switch to `'success'`. Record the decision in 49-05-SUMMARY.md's Operator Decisions section.
result: pass
decision: "info — accepted current default; prune is a soft reversible action, neutral coloring is appropriate. No follow-up needed."

### 10. All translations (zh / es / ja)
expected: Switch app to zh / es / ja in Settings. Repeat long-press → correction card flow; action labels render in the selected locale; interpolated titles render correctly. Proper nouns like "Trellis" are NOT translated.
result: pass

## Summary

total: 10
passed: 9
issues: 0
pending: 0
skipped: 1
blocked: 0

deferred_to_next_phase:
  - test: 3
    reason: "Drag-vs-pinch viewport reset on drop/undo at non-default zoom. Tracked for Phase 53 (graph hygiene)."

## Gaps

[resolved — original gesture-engine bug closed by Plan 49-06 (commits 28ecc89b, f28049a4). Test 3 viewport-preservation deferred to Phase 53, documented in 49-06-SUMMARY.md and 49-VALIDATION.md's UAT scorecard.]

## Resolution log

- 2026-05-18 Initial UAT surfaced Test 1 issue → Phase 49 gap-closure cycle.
- 2026-05-18 Diagnosis at `.planning/debug/phase-49-gesture-engine.md`.
- 2026-05-18 Plan 49-06 generated + checker-verified.
- 2026-05-18 → 2026-05-19 Execution. Phantom-finger fix (49-06.1, 28ecc89b). Drag state-machine starvation fix (49-06.2, f28049a4). Four Test 3 attempts rolled back to f28049a4 (c6ac6170).
- 2026-05-19 Inline UAT-surfaced bonus fixes: self-snap drag (a8bd34f7), extractor union + cascade cleanup (2c296870), rename fire-and-forget (c2f6b8c4), prune cascade (8ea088c5).
- 2026-05-19 Phase 49 closed: 49-VALIDATION.md nyquist_compliant=true, 49-06-SUMMARY.md written, commit 3a51a5e6.
