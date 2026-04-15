---
status: partial
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
source: [26-VERIFICATION.md]
started: 2026-04-15T07:00:00Z
updated: 2026-04-15T07:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Harvest animation — fly-to-counter + confetti
expected: Tapping "Harvest All" in the fruit bottom sheet fires amber cherry particles flying from the status panel center to the header counter, then triggers a confetti burst 1.2s later. All particles share a unified animation (not per-fruit-type).
result: [pending]

### 2. Fruit column glow when count > 0
expected: The Fruits column in the status panel pulses with a warm amber glow (status-glow keyframe, 3s loop) when any anchor has leafState==='fruit'. Column is inert when count is 0.
result: [pending]

### 3. Heal flow — parallel podcast add + review navigation
expected: Tapping "Heal" on a dying anchor in the bottom sheet (or in the Suggested Moves list) adds the topic to today's podcast queue AND navigates to /review with the anchor filtered. Both happen together, not sequentially as choices.
result: [pending]

### 4. Re-plant flow — schedule reset + post generation + review navigation
expected: Tapping "Re-plant" on a dead anchor resets all flashcard and question SM-2 schedules to today (reviewCount=0, easeFactor=2.5), generates a new post for the anchor topic, shows a "Schedule reset - review to revive" toast, then navigates to /review filtered to that anchor.
result: [pending]

### 5. Prune animation — scissors cut + leaf fall
expected: Tapping "Prune" on a dying or dead node plays a scissors rotation animation (prune-cut keyframe, 0.3s) on the scissors icon, then the node card translates down 60px while fading out (prune-fall keyframe, 0.5s). After 0.8s the node disappears from the sheet and appears in the pruned archive below the status panel.
result: [pending]

### 6. Suggested Moves priority ordering with real trellis data
expected: With a mix of dead, dying, and healthy anchors — dead anchors appear first with Sprout icon and "Re-plant" red badge; dying anchors appear second with Heart icon and "Heal" yellow badge; autoGen moves appear third. The total count badge on the section header reflects all three groups combined.
result: [pending]

### 7. AutoGen dedup — no anchor appears in both trellis moves and autoGen
expected: If an autoGen move's conceptId matches a dying or dead anchor, that autoGen move is suppressed from the list. The same anchor does not appear in two places in Suggested Moves.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
