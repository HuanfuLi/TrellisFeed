/**
 * Phase 55.1 GAP-B (BUGFIX-05) — Trellis render-layer animation gate.
 *
 * The PlannerScreen is one of 5 always-mounted SwipeTabContainer slots. Its
 * framer-motion trellis leaves kept animating even while the Planner was
 * OFF-SCREEN, starving the compositor during Home↔Planner↔Ask horizontal
 * swipes and Home feed vertical scroll (worst with Trellis Dev Mode ON,
 * ~31 simultaneously-animated nodes). This is a RENDER cost, not a build cost
 * — 55.1-06 already batched the blossom-date build path; that path is bypassed
 * by `buildDevTrellisState()` anyway.
 *
 * Mirrors trellis-perf-mask.ts in style: React-free, framer-motion-free, so it
 * unit-tests under `node --test` without a JSX transform. Keep this module
 * free of react and framer-motion dependencies.
 *
 * Contract for `shouldAnimateTrellis`:
 *   - isPlannerActive === false → ALWAYS false. Off-screen leaves do ZERO
 *     per-frame motion work.
 *   - Dev layouts and layouts above TAP_ANIMATION_THRESHOLD → false even while
 *     Planner is active. They stay on one plain-SVG tree across route changes,
 *     avoiding the full intrinsic↔motion subtree replacement seen in UAT.
 *   - firstVisitComplete === true → false. A small normal trellis gets one
 *     animated first visit; after the user leaves, subsequent returns reuse the
 *     static tree and never replay all entrance animations.
 *
 * `inView` remains accepted for call-site compatibility with the finer-grained
 * leaf mask; it does not override these whole-tree lifecycle gates.
 *
 * @module trellis-animation-gate
 */

import { TAP_ANIMATION_THRESHOLD } from './trellis-perf-mask.ts';

export interface ShouldAnimateTrellisInput {
  /** True when the Planner route is the active/foreground screen. Dominant lever. */
  isPlannerActive: boolean;
  /** Trellis Dev Mode flag — accepted for composition; does NOT override the route gate. */
  devMode?: boolean;
  /** Number of trellis nodes — accepted for composition; does NOT override the route gate. */
  nodeCount?: number;
 /** Whether the leaf/canvas is in the viewport — accepted for composition; does NOT override the route gate. */
  inView?: boolean;
  /** True after the first animated Planner visit has ended. Prevents replay on return. */
  firstVisitComplete?: boolean;
}

/**
 * Returns `true` only for the first active visit of a small, non-dev trellis.
 * Every other state uses the stable plain-SVG branch.
 */
export const shouldAnimateTrellis = ({
  isPlannerActive,
  devMode = false,
  nodeCount = 0,
  firstVisitComplete = false,
}: ShouldAnimateTrellisInput): boolean => {
  if (!isPlannerActive) return false;
  if (devMode || nodeCount > TAP_ANIMATION_THRESHOLD || firstVisitComplete) return false;
  return true;
};
