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
 *     per-frame motion work, regardless of nodeCount / devMode / inView. This
 *     is the dominant lever for the cross-screen lag.
 *   - isPlannerActive === true  → ALWAYS true. Foreground Planner animates
 *     exactly as before (entry spring + ambient sway for small graphs +
 *     pulse-on-focus). The nodeCount / inView / devMode inputs do NOT suppress
 *     animation here — above the count threshold the canvas still composes with
 *     the existing `leafAnimationMask` to suppress individual off-VIEW leaves,
 *     but that is a separate, finer-grained gate at the call site.
 *
 * The route check (`isPlannerActive`) is the dominant lever; `nodeCount`,
 * `inView`, and `devMode` are accepted only so the gate can compose with the
 * existing count/visibility logic in TrellisCanvas without re-plumbing inputs.
 *
 * @module trellis-animation-gate
 */

export interface ShouldAnimateTrellisInput {
  /** True when the Planner route is the active/foreground screen. Dominant lever. */
  isPlannerActive: boolean;
  /** Trellis Dev Mode flag — accepted for composition; does NOT override the route gate. */
  devMode?: boolean;
  /** Number of trellis nodes — accepted for composition; does NOT override the route gate. */
  nodeCount?: number;
  /** Whether the leaf/canvas is in the viewport — accepted for composition; does NOT override the route gate. */
  inView?: boolean;
}

/**
 * Returns `true` when the trellis leaf framer-motion animations should run.
 *
 * Deterministic and DOM-free. The ONLY decision is the route gate: animations
 * run iff the Planner is the active route. Off-screen Planner → no animation.
 */
export const shouldAnimateTrellis = ({ isPlannerActive }: ShouldAnimateTrellisInput): boolean => {
  // Route gate is dominant and sufficient. When the Planner is off-screen, no
  // leaf may animate — that is the entire point of GAP-B. nodeCount / inView /
  // devMode never flip a false route into true (or vice versa); they exist for
  // call-site composition with leafAnimationMask only.
  return isPlannerActive === true;
};
