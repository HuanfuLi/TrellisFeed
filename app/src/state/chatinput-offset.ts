/**
 * chatinput-offset.ts
 *
 * React-free pure helper (GAP-A / BUGFIX-05, Phase 55.1) resolving the pixel
 * translateY the Ask-screen ChatInput should sit at while the WebView keyboard
 * reflow is in flight. Lives in its own module so it can be unit-tested under
 * `node --test` without importing `react`. Mirrors the keyboard-hysteresis.ts
 * pure-helper module style.
 *
 * Why this exists
 * ---------------
 * On Android the keyboard opens with `adjustResize`: the WebView layout viewport
 * SHRINKS and the AskScreen 100dvh flex-column reflows INSTANTLY, so the
 * `flexShrink:0` ChatInput re-anchors above the keyboard in a single frame — it
 * "teleports". Device UAT round 2 flagged this as a polish defect (the nav fix in
 * commit 6fb7b325 was accepted; the input teleport remained).
 *
 * The fix is to pair a CSS `transition` on the bar's own `transform` with a single,
 * deterministic offset value so the visible motion is eased rather than instant. The
 * native adjustResize is the layout authority that LIFTS the bar (we must NOT add a
 * second mover that double-shifts it — that would fight adjustResize). This helper's
 * STEADY-STATE offset is therefore 0 in both states: at rest the bar sits where the
 * flex column places it. The eased motion comes from the component applying a brief,
 * non-zero transient transform on the open/close edge (see ChatInput.tsx), settling
 * back to this resolved value. Exposing the mapping here keeps it testable and
 * documents the contract: the helper never double-moves the bar.
 *
 * Contract
 * --------
 *  - isKeyboardOpen === false        → 0   (bar at rest; adjustResize not engaged)
 *  - isKeyboardOpen === true         → 0   (adjustResize already lifted the bar;
 *                                           the helper must NOT add a second offset)
 *  - keyboardHeight is clamped to >= 0 and used only to derive the transient settle
 *    distance via `resolveChatInputSettleDistance` (the eased delta the component
 *    animates THROUGH, not a resting offset).
 *
 * Deterministic, no DOM reads. Inputs come from `window.visualViewport` geometry
 * only, resolved by the caller.
 */

export interface ResolveChatInputOffsetArgs {
  /** Keyboard height in px derived from visualViewport geometry (baseline - current). */
  keyboardHeight: number;
  /** Whether the keyboard is currently open (from useKeyboard / hysteresis machine). */
  isKeyboardOpen: boolean;
}

/**
 * Maximum transient settle distance (px) the component eases THROUGH on the
 * open/close edge. The visible motion is bounded so a tall keyboard cannot produce
 * a long, sluggish slide; ~24px reads as a smooth lift without lagging behind the
 * native reflow. Empirical; confirm on-device.
 */
export const MAX_CHATINPUT_SETTLE_DISTANCE = 24;

/**
 * The resting translateY offset for the ChatInput.
 *
 * Always 0 — adjustResize is the sole layout authority that lifts the bar, so the
 * resting position is wherever the flex column places it. Returning a non-zero
 * resting offset here would double-move the bar and fight the native reflow.
 *
 * The function still takes geometry so callers have a single, documented entry
 * point and so the contract (no double-move) is enforced by a test rather than by
 * convention.
 */
export function resolveChatInputOffset({
  keyboardHeight,
  isKeyboardOpen,
}: ResolveChatInputOffsetArgs): number {
  // Guard against negative / NaN geometry without changing the resting contract.
  void (Number.isFinite(keyboardHeight) ? Math.max(0, keyboardHeight) : 0);
  void isKeyboardOpen;
  return 0;
}

/**
 * The transient settle distance (px) the component animates THROUGH when the
 * keyboard state changes. This is the eased delta — NOT a resting offset.
 *
 *  - closed → returns 0 (nothing to settle; bar is already at rest)
 *  - open   → returns a small bounded distance scaled by keyboard height, capped at
 *    MAX_CHATINPUT_SETTLE_DISTANCE, so the bar eases up rather than teleporting.
 *
 * Scaling: a fraction of the keyboard height, clamped. A larger keyboard implies a
 * larger native jump, so a slightly larger (but bounded) eased distance keeps the
 * perceived motion proportional without ever exceeding the cap.
 */
export function resolveChatInputSettleDistance({
  keyboardHeight,
  isKeyboardOpen,
}: ResolveChatInputOffsetArgs): number {
  if (!isKeyboardOpen) return 0;
  const safeHeight = Number.isFinite(keyboardHeight) ? Math.max(0, keyboardHeight) : 0;
  // 1/12 of the keyboard height, capped — a 300px keyboard yields 25 → clamps to 24.
  return Math.min(MAX_CHATINPUT_SETTLE_DISTANCE, Math.round(safeHeight / 12));
}
