/**
 * Phase 28 D-13 — Trellis tap-animation perf guard.
 *
 * Separate from Phase 25 D-55's AMBIENT_SWAY_THRESHOLD = 20 (continuous animation ceiling).
 * TAP_ANIMATION_THRESHOLD = 30 is the event-driven-animation ceiling — taps/pulses
 * can tolerate more leaves because they're one-shot and not continuously re-rendering.
 *
 * Pure predicate: tells TrellisCanvas whether a given leaf should receive shake/pulse
 * animations based on total leaf count + whether the leaf is in the visible viewport.
 *
 * Contract:
 *   - totalCount <= TAP_ANIMATION_THRESHOLD → always animate (perf is fine at this scale)
 *   - totalCount > TAP_ANIMATION_THRESHOLD → only animate when inView === true
 *
 * When IntersectionObserver isn't layered, TrellisCanvas currently passes inView=true
 * unconditionally (simplest path per RESEARCH Pattern 6 / UI-SPEC D-13). The predicate
 * is structured so an IO layer can drop in later without touching the call site.
 *
 * @module trellis-perf-mask
 */

export interface LeafAnimationMaskInput {
  totalCount: number;
  inView: boolean;
}

/**
 * Phase 28 D-13 threshold for event-driven tap/pulse animations.
 * Paired with (but distinct from) Phase 25 D-55 AMBIENT_SWAY_THRESHOLD = 20.
 */
export const TAP_ANIMATION_THRESHOLD = 30;

/**
 * Returns `true` when the leaf at this position should run tap/pulse animations,
 * `false` when the perf guard kicks in (large canvas + off-screen leaf).
 */
export const leafAnimationMask = ({ totalCount, inView }: LeafAnimationMaskInput): boolean => {
  if (totalCount <= TAP_ANIMATION_THRESHOLD) return true;
  return inView === true;
};
