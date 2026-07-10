# Phase 22: Swipe Navigation Between First-Level Screens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 22-swipe-navigation-between-first-level-screens
**Areas discussed:** Screen order & scope, Gesture conflicts, Mounting strategy, Transition & edge behavior

---

## Screen Order & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include Ask | All 5 screens in order: Home → Planner → Ask → Graph → Settings. Matches bottom nav 1:1. | ✓ |
| Skip Ask | 4 screens only. Ask reachable only via FAB tap. | |

**User's choice:** Include Ask
**Notes:** User wants full 1:1 mapping between swipe order and bottom nav layout.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Block swipe on sub-screens | Swipe only on 5 top-level screens. Sub-screens require back button first. | ✓ |
| Always allow swipe | Swiping works everywhere, even on sub-screens. | |

**User's choice:** Block swipe on sub-screens

---

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time tracking | Bottom nav highlight follows finger proportionally during drag. | ✓ |
| Snap after swipe | Nav updates only after swipe completes. | |

**User's choice:** Real-time tracking
**Notes:** User chose the premium feel option.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Slide animation on tap | Tapping nav tab triggers slide animation, consistent with swipe. | ✓ |
| Keep instant navigation | Tap navigates instantly, only swipe shows animation. | |

**User's choice:** Slide animation on tap

---

| Option | Description | Selected |
|--------|-------------|----------|
| Direct slide | Slide directly from current to target for non-adjacent tabs. | ✓ |
| Slide through all | Briefly show each intermediate screen. | |

**User's choice:** Direct slide

---

| Option | Description | Selected |
|--------|-------------|----------|
| Live peek | Both screens visible during drag (side-by-side sliding). | ✓ |
| Blank until complete | Next screen appears only after gesture completes. | |

**User's choice:** Live peek

---

## Gesture Conflicts

| Option | Description | Selected |
|--------|-------------|----------|
| Axis lock after threshold | After ~10px, lock to dominant axis. | ✓ |
| Edge-only swipe zones | Horizontal swipe only from left/right 30px edges. | |
| You decide | Claude picks. | |

**User's choice:** Axis lock after threshold

---

| Option | Description | Selected |
|--------|-------------|----------|
| Disable nav swipe inside carousels | Nav swipe suppressed inside horizontal-draggable elements. | ✓ |
| Nav swipe always wins | Navigation takes priority everywhere. | |
| You decide | Claude picks. | |

**User's choice:** Disable nav swipe inside carousels

---

| Option | Description | Selected |
|--------|-------------|----------|
| Disable swipe when keyboard open | Suppressed when input focused. | ✓ |
| Always allow swipe | Works even with keyboard open. | |

**User's choice:** Disable swipe when keyboard open

---

| Option | Description | Selected |
|--------|-------------|----------|
| Disable inside graph canvas | Suppressed inside mind-elixir container only. | ✓ |
| Disable on entire Graph screen | No swipe at all on Graph screen. | |
| You decide | Claude picks. | |

**User's choice:** Disable inside graph canvas

---

## Mounting Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Always-mount all 5 | All screens always in DOM with display:none toggling. | ✓ |
| Sliding window (mount 3) | Mount current + adjacent, unmount others. | |
| You decide | Claude picks. | |

**User's choice:** Always-mount all 5

---

| Option | Description | Selected |
|--------|-------------|----------|
| Eager load all | Remove lazy loading for GraphScreen. | ✓ |
| Lazy until first visit | Keep lazy, handle loading state on first swipe. | |

**User's choice:** Eager load all

---

## Transition & Edge Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Rubber-band | Screen resists and bounces back at edges. | ✓ |
| Hard stop | Gesture doesn't register at edges. | |
| Wrap around | Circular navigation loop. | |

**User's choice:** Rubber-band

---

| Option | Description | Selected |
|--------|-------------|----------|
| ~20% screen width | About 75px threshold. | ✓ |
| Velocity-based | Fast flick triggers regardless of distance. | |
| You decide | Claude picks. | |

**User's choice:** ~20% screen width

---

| Option | Description | Selected |
|--------|-------------|----------|
| Light haptic on commit | hapticImpactLight() on threshold cross. | |
| No haptics | Silent transitions. | ✓ |

**User's choice:** No haptics

---

| Option | Description | Selected |
|--------|-------------|----------|
| ~250ms spring | Quick spring animation. | ✓ |
| ~400ms smooth | Slower, more elegant slide. | |
| You decide | Claude picks. | |

**User's choice:** ~250ms spring

---

## Claude's Discretion

- Spring curve parameters (stiffness, damping)
- Exact axis-lock threshold
- Keyboard detection method
- Nested draggable suppression approach

## Deferred Ideas

None — discussion stayed within phase scope
