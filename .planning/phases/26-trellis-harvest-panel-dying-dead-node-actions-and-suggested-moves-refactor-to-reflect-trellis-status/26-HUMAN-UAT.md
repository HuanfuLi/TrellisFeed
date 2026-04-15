---
status: partial
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
source: [26-VERIFICATION.md (re-verification after architecture simplification)]
started: 2026-04-15T07:00:00Z
updated: 2026-04-15T10:00:00Z
---

## Current Test

[tests 1, 2, 6 passed in first UAT round; tests 3, 4, 5, 7 pending retest after hashStr fix and architecture simplification]

## UX Architecture Note

Bottom sheets were removed after the first UAT round. The simplified UX is:
- Status panel: Dying (display only) | Fruit (direct harvest button) | Dead (display only)
- Actions: Heal = tap dying row in Suggested Moves. Re-plant = tap dead row in Suggested Moves.
- Prune = scissors button on any dying or dead row in Suggested Moves (stopPropagation, direct archive, no animation).
- PrunedSection: collapsible "Pruned (N)" pill at the bottom of PlannerScreen after Suggested Moves.

Tests 3, 4, 5, and 7 were previously blocked by a pre-existing `hashStr is not defined` runtime error in `trellis-state.service.ts` (fixed in commit 715e5ec4). They are now retestable with real trellis data.

## Tests

### 1. Harvest animation — fly-to-counter + confetti
expected: Tapping the Fruit button (center column of status panel) directly triggers up to 8 amber circular particles flying from the button center toward the header credit counter span. After ~1.2s, a confetti burst fires. The credit counter increments immediately on tap. No bottom sheet is shown.
result: passed (first round, pre-simplification — animation origin is now the fruit button, not a sheet; re-verify if behavior changed)

### 2. Fruit column glow when count > 0
expected: The Fruit button pulses with a warm amber glow (status-glow keyframe, 3s loop) and has an amber background when fruitNodes.length > 0. When count is 0, the button shows neutral surface-variant background, no glow, is disabled, and shows "Fruits" (not "Harvest").
result: passed

### 3. Heal flow — Suggested Moves row tap (needs retest)
expected: Tapping a dying anchor row (not the scissors button) in Suggested Moves adds its topic to today's podcast queue AND navigates to /review filtered to that anchor's Q&As. Both happen together. The row has a Heart icon leading and "Heal" yellow badge trailing.
result: pending — blocked in first round by `hashStr is not defined` runtime error preventing real dying nodes from appearing. Fixed in commit 715e5ec4. Awaiting retest.
notes: Action is now on the Suggested Moves row, not inside a bottom sheet. Verify that tapping the row (not scissors) fires heal.

### 4. Re-plant flow — dead row tap (needs retest)
expected: Tapping a dead anchor row (not the scissors button) resets SM-2 schedules to today (reviewCount=0, easeFactor=2.5), generates a new post for the anchor topic, shows "Schedule reset - review to revive" toast, and navigates to /review filtered to that anchor. Row has a Sprout icon leading and "Re-plant" red badge trailing.
result: pending — blocked in first round by same hashStr error. Fixed. Awaiting retest.
notes: Action is now on the Suggested Moves row, not inside a bottom sheet.

### 5. Prune button — direct archive, no sheet, stopPropagation (needs retest)
expected: Tapping only the scissors button on a dying or dead row in Suggested Moves shows "Pruned — moved to archive" toast. The row disappears from Suggested Moves. The "Pruned (N)" collapsible pill appears (or increments) at the bottom of PlannerScreen. The main row tap action (heal or re-plant) does NOT fire — scissors click is isolated by stopPropagation.
result: pending — previous test was for the bottom-sheet UX (prune inside a sheet with animation). UX has changed entirely: prune is now a plain service call + toast, no sheet, no prune-cut/prune-fall animation. Awaiting retest of the new simplified flow.
notes: Verify the "Pruned (N)" section at the bottom shows the pruned node. Verify that expanding it shows Restore and Delete buttons. Verify Restore removes the node from PrunedSection and it can reappear in trellis state.

### 6. Suggested Moves priority ordering with real trellis data
expected: With a mix of dead, dying, and healthy anchors — dead anchors appear first (Sprout icon + red "Re-plant" badge), dying anchors second (Heart icon + yellow "Heal" badge), autoGen moves third (PortalCard style). The total count badge on the "Suggested Moves" section header sums all three groups.
result: passed (first round — re-verify after hashStr fix ensures dead/dying nodes appear with real data)

### 7. AutoGen dedup — same anchor not in trellis rows and autoGen simultaneously (needs retest)
expected: If an autoGen move's conceptId matches a currently dying or dead anchor, that autoGen move is suppressed from Suggested Moves. The anchor appears only once (in its trellis row), not in the PortalCard group.
result: pending — blocked in first round by hashStr error (no real dying/dead nodes to create overlap). Fixed. Awaiting retest.

## Summary

total: 7
passed: 2 (tests 1, 2 — animations; test 6 passed but should be re-confirmed with real data after hashStr fix)
issues: 0
pending: 5 (tests 3, 4, 5, 7 need retest after hashStr fix; test 1 may need recheck after harvest button origin changed)
skipped: 0
blocked: 0

## Gaps

### Gap 1: hashStr not imported in trellis-state.service.ts
status: resolved
detected: 2026-04-15 during human UAT test #3
resolution: commit 715e5ec4 — added hashStr to existing import from trellis-layout.service.ts
source_test: 3, 4, 6, 7
notes: Pre-existing bug (logged in deferred-items.md) surfaced during real-data testing. Now fixed.

### Gap 2: Bottom-sheet UX removed (architecture simplification)
status: resolved — intentional UX change
detected: 2026-04-15 after first UAT round
resolution: User requested simplification. Bottom sheets removed. Direct harvest button, prune on Suggested Moves rows, PrunedSection at page bottom.
source_test: 3, 4, 5 (tests updated to reflect new flow)
notes: D-09 and D-17 voided. Tests 3/4/5 test descriptions updated in this file to match the simplified UX.
