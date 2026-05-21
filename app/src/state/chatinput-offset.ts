/**
 * chatinput-offset.ts
 *
 * React-free pure helper (GAP-A / BUGFIX-05, Phase 55.1 — ATTEMPT 2) resolving
 * the LIVE keyboard inset (in px) the Ask-screen ChatInput should translate by
 * while the WebView keyboard animation is in flight. Lives in its own module so
 * it can be unit-tested under `node --test` without importing `react`.
 *
 * Why this exists — ATTEMPT 2 (the decay approach is REJECTED)
 * -----------------------------------------------------------
 * The first attempt (55.1-05) paired a CSS `transition` with a transient
 * translateY (a bounded "settle distance") that decayed to 0 over a 0.18s ease.
 * It FAILED on device (round 3): Android applies `adjustResize` and the
 * AskScreen 100dvh flex-column reflows in the SAME paint that the transient
 * offset is applied AND removed — so no transit was ever visible. The bar still
 * teleported. That transient/decay helper is REMOVED.
 *
 * New approach — continuous tracking off visualViewport events
 * ------------------------------------------------------------
 * Android emits a STREAM of `visualViewport` `resize` AND `scroll` events
 * throughout the keyboard animation. On each event the caller reads the live
 * geometry and computes the keyboard inset:
 *
 *     inset = max(0, innerHeight - viewportHeight - viewportOffsetTop)
 *
 * As the keyboard animates open, `viewportHeight` shrinks / `offsetTop` grows
 * across the event stream, so the returned inset GROWS frame-by-frame. The
 * component translates the bar by this live value, so the bar FOLLOWS the
 * keyboard's animated rise rather than snapping. The motion comes from the
 * event stream itself, not from a CSS transition.
 *
 * Residual reconciliation (the on-device tuning knob, owned by the component):
 * under `adjustResize` the layout viewport ALSO shrinks (the flex column already
 * re-anchors the bar). The component must translate by the RESIDUAL between the
 * visual-viewport inset this helper returns and the layout-viewport reflow so
 * the bar neither double-lifts nor lags. This helper computes the raw visual
 * inset; the component reconciles against the layout viewport.
 *
 * Contract
 * --------
 *  - fully closed (viewportHeight ≈ innerHeight, offsetTop 0) → 0
 *  - fully open                                               → full keyboard inset
 *  - mid-animation (partial inset)                            → the partial value
 *  - non-finite / negative geometry                           → clamped to 0
 *
 * Deterministic, no DOM reads. Inputs come from `window.visualViewport` geometry
 * only, resolved by the caller.
 */

export interface ResolveChatInputOffsetArgs {
  /** `window.innerHeight` — the layout-viewport height (does not shrink with the keyboard). */
  innerHeight: number;
  /** `window.visualViewport.height` — shrinks as the keyboard animates open. */
  viewportHeight: number;
  /** `window.visualViewport.offsetTop` — grows when the viewport is offset by the keyboard. */
  viewportOffsetTop: number;
}

/**
 * The LIVE keyboard inset (px) = `max(0, innerHeight - viewportHeight - viewportOffsetTop)`.
 *
 * Called on every `visualViewport` resize/scroll event during the keyboard
 * animation. Because the geometry changes across the event stream, the returned
 * value tracks the keyboard's partial position frame-by-frame — the bar follows
 * the keyboard up and back down.
 *
 * Non-finite inputs (NaN/Infinity) are treated as 0; the result is clamped to
 * `>= 0` so a transient over-report cannot push the bar below its rest position.
 */
export function resolveChatInputOffset({
  innerHeight,
  viewportHeight,
  viewportOffsetTop,
}: ResolveChatInputOffsetArgs): number {
  const safeInner = Number.isFinite(innerHeight) ? innerHeight : 0;
  const safeViewport = Number.isFinite(viewportHeight) ? viewportHeight : 0;
  const safeOffset = Number.isFinite(viewportOffsetTop) ? viewportOffsetTop : 0;
  const inset = safeInner - safeViewport - safeOffset;
  return inset > 0 ? inset : 0;
}
