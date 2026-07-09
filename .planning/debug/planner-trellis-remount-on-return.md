---
status: verifying
slug: planner-trellis-remount-on-return
created: 2026-07-08T20:05:00-04:00
updated: 2026-07-08T20:25:00-04:00
severity: minor
source: .planning/phases/56-ui-polish-documentation/56-UAT.md
---

# Planner trellis remounts and replays animations on return

## Symptoms

- Expected: once the always-mounted Planner trellis has rendered, returning to Planner should reuse the existing SVG and should not replay every leaf/fruit/vine entrance animation.
- Actual: Android still feels slightly janky; returning to Planner visibly redraws the trellis and replays its animations.
- Amplifier: Trellis Dev Mode renders 31 nodes, making the redraw much more visible and expensive.
- Errors: none.

## Reproduction

1. Enable Trellis Dev Mode.
2. Open Home, then Planner, then Home, then Planner.
3. Observe all development leaves/fruits/vines animate again on every Planner entry.

## Root Cause

Confirmed in `TrellisHero.tsx`, `TrellisCanvas.tsx`, and `TrellisLeaf.tsx`.

`animationsEnabled` is currently identical to `isPlannerActive`:

- Off-screen: vines use intrinsic `<path>` and leaves early-return intrinsic `<g>`.
- Planner active: vines use `motion.path` and leaves render nested `motion.g` components with `initial` entrance props.

Although both branches produce SVG tags in the DOM, their React element types differ (`'path'` vs `motion.path`, intrinsic `<g>` vs `TrellisLeaf`'s motion subtree). React therefore replaces the nodes whenever the route gate flips. The newly mounted Framer components replay `initial → animate`.

Chrome CDP identity probe with the 31-node dev trellis:

| Transition | Groups | Marker preserved |
|---|---:|---:|
| Home static baseline | 118 | yes |
| Home → Planner | 180 | no |
| Planner → Home | 118 | no |

This proves the user-visible redraw is a real DOM replacement, not only a perception caused by swipe animation.

## Why Dev Mode Is Worse

The same branch switch exists in normal mode. Dev Mode magnifies it because it always builds 31 nodes covering all seven leaf states. More nodes means more Framer VisualElements and more simultaneous entrance work.

## Fix Direction

- Dev layouts and other large layouts must remain on the plain-SVG branch even while Planner is active.
- A normal small trellis may animate on its first Planner visit.
- After the first Planner visit completes (the user leaves once), future returns remain on the plain-SVG branch so node identity stays stable and entrance animations do not replay.
- Off-screen trellis remains plain SVG with zero continuous Framer/filter work.

## Verification

- Pure gate tests cover inactive, dev, large, first-visit, and completed-first-visit cases.
- Existing off-screen static SVG guards remain green.
- Chrome CDP identity probe must change from marker loss to marker preservation in Dev Mode.
- Full targeted tests, TypeScript, build, and browser performance checks must pass.

## Fix Applied

Commit `b367e773`:

- Dev layouts and layouts over 30 nodes remain plain SVG while active and inactive.
- A small normal trellis may animate on its first Planner visit.
- `TrellisHero` latches the end of that first visit; all subsequent returns stay on the static branch.
- Existing off-screen zero-motion behavior remains intact.

## Automated Re-verification

- Node identity, Home → Planner: preserved.
- Node identity, Planner → Home: preserved.
- SVG group count across both transitions: stable at 118 (previously 118 → 180 → 118).
- Dev trellis running animations: 0.
- Dev trellis drop-shadow styles: 0.
- Chrome frame sample: p95 ~9.3ms, max ~17.4ms.
- Targeted trellis tests: 16/16.
- Main suite: 1598/1598.
- Actions suite: 149/149.
- TypeScript, lint (0 errors), production build: pass.
- Production browser UAT: 9/9.

## Pending

Physical Android confirmation that the visible swipe/scroll hitch is gone.
