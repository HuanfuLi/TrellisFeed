# Phase 26: Trellis Harvest Panel — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
**Areas discussed:** Harvest mechanic & credits, Status panel layout & interaction, Dying/dead node actions, Suggested moves refactor scope

---

## Harvest Mechanic & Credits

| Option | Description | Selected |
|--------|-------------|----------|
| Visible currency | Balance shown, spendable on cosmetic unlocks in future | ✓ |
| Achievement counter | Running total, no spending, purely motivational | |
| Gamification points | XP system with levels/milestones | |
| No persistent credits | Just celebration animation, no storage | |

**User's choice:** Visible currency. Spendable after a future phase — just store for now.

| Option | Description | Selected |
|--------|-------------|----------|
| Confetti burst | Reuse Confetti component from ReviewScreen | |
| Fruit-specific particles | Harvested fruit type explodes into colored particles | |
| Collection animation + confetti | Fruit flies into counter + confetti burst | ✓ |
| Simple glow + toast | Glow effect + toast message | |

**User's choice:** Collection animation + confetti burst. Since batch harvest is possible, cannot use fruit-specific animation.

**Additional decisions from user:**
- Fruit/credit counter at upper-right corner of Planner header bar
- Dying/dead nodes get a "prune" action with scissors cutting animation
- Pruning is soft delete → archive → optional hard delete (prevents accidental loss)

---

## Status Panel Layout & Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand | Expand list below panel on tap | |
| Bottom sheet | Half-screen sheet with node list and actions | ✓ |
| Navigate to screen | New route with full-screen list | |

**User's choice:** Bottom sheet, reuse existing suggested moves pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Count + icon only | e.g. icon 5 | ✓ |
| Count + icon + label | e.g. icon 5 Ready to harvest | |
| Count + icon + mini preview | Shows first 1-2 anchor names | |

**User's choice:** Icon + count only. Concise. NO emoji — use lucide-react icons.

---

## Dying/Dead Node Actions

| Option | Description | Selected |
|--------|-------------|----------|
| User chooses each time | Both buttons always shown | |
| Based on overdue severity | Dying → review; Dead → podcast | |
| Based on Q&A count | Few → review; Many → podcast | |
| Based on last interaction | Mirror previous study mode | |

**User's choice:** Neither — both review AND podcast happen in parallel for dying nodes. For dead nodes: generate post to read, then review existing flashcards (no new flashcard generation).

| Option | Description | Selected |
|--------|-------------|----------|
| Soft delete | Flagged/hidden, can restore | |
| Hard delete | Permanent removal | |
| Archive (two-step) | Archive first, hard delete from pruned section | ✓ |

**User's choice:** Two-step: soft delete to "Pruned" section first, then hard delete available inside pruned section. Prevents accidental deletion.

---

## Suggested Moves Refactor Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Trellis replaces both | Remove autoGen and chunks entirely | |
| Trellis primary, autoGen supplement | Dying/dead top priority, autoGen fills below, dedup | ✓ |
| Merge all three | All sources into single prioritized list | |
| Keep separate sections | Panel for trellis, moves for exploration | |

**User's choice:** Option 2 (trellis primary, autoGen supplement) based on Claude's recommendation. Reasoning: healthy gardens with all green nodes still need suggestions; chunks system removed since check-in was removed; single prioritized list avoids confusion.

**Notes:** User's concern about autoGen duplicating trellis actions resolved by dedup filter — autoGen moves targeting same anchor as dying/dead nodes are skipped. Ripe fruits stay in status panel only (not in suggested moves list).

---

## Claude's Discretion

- Lucide icon choices for 3 panel columns
- Pruned section placement
- Bottom sheet internal layout
- Confetti parameterization
- Scissors animation implementation approach

## Deferred Ideas

- Credit spending mechanic (cosmetics, themes)
- Streak bonuses for consecutive harvests
- Social sharing of garden state
- Pruned section as full "garden history"
