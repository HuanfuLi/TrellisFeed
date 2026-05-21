/**
 * keyboard-hysteresis.ts
 *
 * React-free pure helper for virtual-keyboard open/close detection with
 * HYSTERESIS (separate open and close thresholds). Lives in its own module so
 * it can be unit-tested under `node --test` without pulling in `react`
 * (importing useKeyboard.ts fails ERR_MODULE_NOT_FOUND on the React import).
 * Mirrors the feed-spread.ts / trellis-perf-mask.ts pure-helper pattern.
 *
 * BUGFIX-03 (Phase 55.1): The Android WebView keyboard-open animation fires
 * `visualViewport.resize` repeatedly, with the viewport height crossing a single
 * threshold in BOTH directions mid-animation. A single `MIN_KEYBOARD_HEIGHT`
 * threshold therefore toggled `keyboardOpen` up/down, reversing the
 * BottomNavigation `y` spring (the visible flicker). Hysteresis fixes this at the
 * root: a delta in the band between the close and open thresholds keeps the prior
 * state, so a transient mid-animation height cannot flip an already-settled state.
 */

/** Open threshold — viewport must shrink by MORE than this to register keyboard-open. */
export const MIN_KEYBOARD_HEIGHT = 150;

/**
 * Close threshold — keyboard is only considered closed once the viewport shrink
 * drops BELOW this (distinct from / lower than the open threshold). The band
 * [CLOSE_KEYBOARD_HEIGHT, MIN_KEYBOARD_HEIGHT] is the no-flip hysteresis zone.
 * Empirical; confirmed by on-device UAT.
 */
export const CLOSE_KEYBOARD_HEIGHT = 80;

export interface ResolveKeyboardOpenArgs {
  /** Current viewport shrink relative to baseline (baselineHeight - currentHeight). */
  heightDelta: number;
  /** The currently-applied keyboard-open state (the value we are debouncing against). */
  wasOpen: boolean;
  /** Delta must exceed this to OPEN from a closed state. */
  openThreshold: number;
  /** Delta must drop below this to CLOSE from an open state. */
  closeThreshold: number;
}

/**
 * Hysteresis decision:
 * - From CLOSED: open only when `heightDelta > openThreshold`.
 * - From OPEN: close only when `heightDelta < closeThreshold`.
 * - Mid-range (between close and open thresholds): keep the prior `wasOpen` value.
 */
export function resolveKeyboardOpen({
  heightDelta,
  wasOpen,
  openThreshold,
  closeThreshold,
}: ResolveKeyboardOpenArgs): boolean {
  if (wasOpen) {
    // Stay open until the shrink clearly recedes below the close threshold.
    return heightDelta >= closeThreshold;
  }
  // Stay closed until the shrink clearly exceeds the open threshold.
  return heightDelta > openThreshold;
}

/**
 * BUGFIX-03 (gap closure, 2026-05-21): focus-driven instant hide.
 *
 * Hysteresis alone did not stop the on-device flicker. Two layout authorities
 * were fighting over the `position: fixed; bottom: 0` BottomNavigation:
 *   1. Android `adjustResize` shrinks the layout viewport when the keyboard
 *      opens, re-anchoring the fixed bar UPWARD instantly (the "nav rises with
 *      the screen edge").
 *   2. The JS spring then slides it DOWN to hide it (the "collapse back").
 * The gap between the instant native reposition and the lagged spring IS the
 * flicker. Hysteresis only debounced the boolean — it never removed the race.
 *
 * Fix: `focusin` on an editable element is the deterministic, EARLY signal
 * (fires at tap, before the keyboard animation / resize). On a touch device we
 * hide the nav at that instant — front-running the resize so the bar is already
 * off-screen before it can rise. `pending` marks the focus→keyboard grace window
 * so the small transient resize deltas during the keyboard animation do not
 * re-show the nav. Height-based hysteresis still governs the steady state (and
 * the back-button-closes-keyboard-while-focused case). The hide is applied with
 * a zero-duration transition (see BottomNavigation.tsx); show keeps the spring.
 */
export type KeyboardEventKind = 'focusin' | 'focusout' | 'resize';

export interface KeyboardNavState {
  open: boolean;
  /** Set on a touch `focusin`; cleared once height confirms open or focus leaves. */
  pending: boolean;
}

export const INITIAL_KEYBOARD_NAV_STATE: KeyboardNavState = { open: false, pending: false };

export interface NextKeyboardStateArgs {
  kind: KeyboardEventKind;
  /** Whether an editable element currently holds focus. */
  editableFocused: boolean;
  /** Current viewport shrink relative to baseline (baselineHeight - currentHeight). */
  heightDelta: number;
  /** Whether the device has a virtual keyboard (touch). Focus front-run only fires here. */
  isTouchDevice: boolean;
  openThreshold: number;
  closeThreshold: number;
}

export function nextKeyboardState(
  prev: KeyboardNavState,
  ev: NextKeyboardStateArgs,
): KeyboardNavState {
  // Focus left the editable element → the keyboard is going away; show the nav.
  if (ev.kind === 'focusout' || !ev.editableFocused) {
    return INITIAL_KEYBOARD_NAV_STATE;
  }

  // Tap into an input on a touch device: the virtual keyboard WILL appear. Hide
  // instantly NOW, ahead of adjustResize, and enter the grace window.
  if (ev.kind === 'focusin') {
    return ev.isTouchDevice ? { open: true, pending: true } : prev;
  }

  // resize, editable still focused:
  // Keyboard height confirmed — definitively open, leave the grace window.
  if (ev.heightDelta > ev.openThreshold) return { open: true, pending: false };

  // Still in the focus→keyboard grace window: keep hidden, ignore transient delta.
  if (prev.pending) return { open: true, pending: true };

  // Steady state: hysteresis (handles close + back-button-while-focused).
  return {
    open: resolveKeyboardOpen({
      heightDelta: ev.heightDelta,
      wasOpen: prev.open,
      openThreshold: ev.openThreshold,
      closeThreshold: ev.closeThreshold,
    }),
    pending: false,
  };
}
