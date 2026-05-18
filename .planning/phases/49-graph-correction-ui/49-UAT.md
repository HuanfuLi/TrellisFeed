---
status: complete
phase: 49-graph-correction-ui
source: 49-05-SUMMARY.md
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Magnetic snap on long-press drag
expected: Long-press anchor at default 0.5× zoom → haptic + ghost @480ms → drag toward another anchor → halo activates within ~32px → ghost snaps to target. Acceptable band 24-48px.
result: issue
reported: "Yes popover displayed, but was triggered by release of finger after long-press instead of time-lapsed of long-press like the long-press behavior in feed post tiles. Another issue: The graph canvas is also moved along with the node when user long-press and drag the node, which keeps the node centered and cannot really be repositioned to other location. Blocked."
severity: major
findings:
  - "Long-press menu fires on FINGER RELEASE rather than on the 480ms TIMER tick. Expected: menu pops while finger is still down at 480ms (matches feed post tile long-press behavior)."
  - "Canvas pans along with the dragged ghost — node stays visually centered relative to viewport, so the user cannot reposition the node relative to other anchors. MindElixir pan/zoom is not being suppressed during long-press-drag."

### 2. Haptic feedback
expected: Long-press a node → light tap haptic at 480ms. Drag + drop on a valid cluster → medium tap haptic at drop.
result: skipped
reason: "Skipped after Test 1 failure surfaced that the long-press menu fires on finger-release instead of at the 480ms timer tick. Haptic-at-480ms is likely affected by the same root cause; defer to post-fix re-verification on phone."

### 3. Drag does not fight MindElixir pan/zoom
expected: Pinch-zoom out to ~0.3×; long-press a deep anchor; drag toward a different cluster. Gesture commits without the map snapping back to default scale.
result: skipped
reason: "Pinch-zoom needs a touch device; operator testing on web (no Capacitor deploy yet). Test 1 already captured the broader 'canvas pans with drag' issue at default zoom."

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
passed: 7
issues: 1
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "Long-press menu fires at the 480ms timer tick (haptic + ghost appear while finger is still pressed); long-press-drag suppresses MindElixir pan/zoom so the dragged node can be repositioned relative to other anchors."
  status: failed
  reason: "User reported: 'Yes popover displayed, but was triggered by release of finger after long-press instead of time-lapsed of long-press like the long-press behavior in feed post tiles. Another issue: The graph canvas is also moved along with the node when user long-press and drag the node, which keeps the node centered and cannot really be repositioned to other location. Blocked.'"
  severity: major
  test: 1
  findings:
    - "Long-press menu fires on FINGER RELEASE rather than at the 480ms TIMER tick. Expected: menu pops while finger is still down at 480ms (matches feed post tile long-press behavior)."
    - "Canvas pans along with the dragged ghost — node stays visually centered, so it cannot be repositioned relative to other anchors. MindElixir pan/zoom is not suppressed during long-press-drag."
  artifacts: []
  missing: []
