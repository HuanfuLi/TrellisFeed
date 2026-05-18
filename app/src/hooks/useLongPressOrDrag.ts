import { useRef, useEffect } from 'react';
import { hapticImpactLight } from '../lib/haptics.ts';

/**
 * useLongPressOrDrag — Phase 49-01 (sibling to useLongPress.ts).
 *
 * 480ms long-press recognizer + 8px Euclidean drag-threshold state machine.
 * Three exhaustive gesture outcomes (per CONTEXT D-01):
 *   1. Pointerdown released < 480ms with no drag      → tap (caller's click path)
 *   2. Pointerdown held ≥ 480ms                       → onLongPressRecognized(x, y) fires INSIDE the timer
 *      (released in place → no extra callback; drag past threshold → continues to outcome 3)
 *   3. Pointerdown held ≥ 480ms then moved > 8px      → onDragStart + onDragMove* + onDragEnd
 *
 * Two-phase pointermove policy:
 *   - Movement > 8px BEFORE 480ms cancels the timer (pan path — caller's click handler handles tap).
 *   - Movement > 8px AFTER 480ms transitions to drag mode (no cancellation).
 *
 * Phase 49-06 gap closure: onLongPressRecognized fires INSIDE the 480ms timer
 * (matching the feed-tile useLongPress.ts:42-45 convention). The previous
 * pointerup-driven release callback was removed — the card/menu must appear
 * while the finger is still down at the 480ms tick.
 *
 * Click suppression: didLongPress flag is preserved through onPointerUp so the
 * synthetic click that follows pointerup can be suppressed in onClickCapture
 * via stopPropagation + preventDefault. The flag clears on the next animation
 * frame so subsequent clean clicks are not affected.
 *
 * W-3 LOCKED: ships BOTH the hook AND a plain factory used by GraphScreen's
 * delegated pointer listener (where a hook indirection is impossible because
 * the listener attaches directly to the MindElixir container via
 * addEventListener). Both share the same state-machine implementation.
 *
 * Threshold values are codebase convention (RESEARCH §R2):
 *   longPressMs   = 480  (NOT 400ms from CONTEXT D-01 placeholder)
 *   dragThresholdPx = 8
 */

// ─── Public types ────────────────────────────────────────────────────────────

export interface UseLongPressOrDragOptions {
  longPressMs?: number;
  dragThresholdPx?: number;
  /**
   * Phase 49-06 — fires INSIDE the 480ms timer (alongside didLongPress=true +
   * haptic) BEFORE any pointerup. Matches the feed-tile useLongPress.ts:42-45
   * convention so the consumer-visible long-press signal is delivered while
   * the finger is still down. Optional because some consumers may only care
   * about drag transitions.
   */
  onLongPressRecognized?: (x: number, y: number) => void;
  onDragStart: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}

interface MinimalPointerEvent {
  clientX: number;
  clientY: number;
  pointerId?: number;
  stopPropagation?: () => void;
  preventDefault?: () => void;
}

export interface LongPressOrDragMachine {
  onPointerDown(e: MinimalPointerEvent): void;
  onPointerMove(e: MinimalPointerEvent): void;
  onPointerUp(e: MinimalPointerEvent): void;
  onPointerCancel(e: MinimalPointerEvent): void;
  onClickCapture(e: MinimalPointerEvent): void;
  /** Read-only accessor — true while the post-pointerup click is still suppressible. */
  getDidLongPress(): boolean;
  /** Force-reset internal state (used in unmount cleanup paths). */
  reset(): void;
}

// ─── Plain factory (no React) ────────────────────────────────────────────────

/**
 * createLongPressOrDragMachine — plain factory consumable from outside React.
 *
 * GraphScreen's delegated pointerdown listener uses this directly (W-3 LOCKED).
 * The hook wrapper below caches an instance across renders and exposes
 * `didLongPress` as a React ref for component-level consumers.
 */
export function createLongPressOrDragMachine(
  opts: UseLongPressOrDragOptions,
): LongPressOrDragMachine {
  const longPressMs = opts.longPressMs ?? 480;
  const dragThresholdPx = opts.dragThresholdPx ?? 8;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let didLongPress = false;
  let didDrag = false;
  let startCoord: { x: number; y: number } | null = null;
  let lastCoord: { x: number; y: number } = { x: 0, y: 0 };

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function reset() {
    clearTimer();
    didLongPress = false;
    didDrag = false;
    startCoord = null;
  }

  function onPointerDown(e: MinimalPointerEvent): void {
    didLongPress = false;
    didDrag = false;
    startCoord = { x: e.clientX, y: e.clientY };
    lastCoord = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer = setTimeout(() => {
      didLongPress = true;
      // Fire-and-forget haptic — wrapper no-ops on web.
      void hapticImpactLight();
      // Phase 49-06 gap closure: fire the consumer-visible recognition signal
      // INSIDE the timer (matches useLongPress.ts:42-45). The card/menu must
      // appear while the finger is still down — operator UAT Test 1 verified
      // this is the correct mid-press behavior on real touch hardware.
      const sc = startCoord;
      if (sc !== null) {
        opts.onLongPressRecognized?.(sc.x, sc.y);
      }
    }, longPressMs);
  }

  function onPointerMove(e: MinimalPointerEvent): void {
    lastCoord = { x: e.clientX, y: e.clientY };
    if (startCoord === null) return;

    const dx = e.clientX - startCoord.x;
    const dy = e.clientY - startCoord.y;
    const dist = Math.hypot(dx, dy);

    if (dist > dragThresholdPx) {
      if (!didLongPress) {
        // Pre-480ms threshold breach → pan path. Cancel timer + bail out so
        // the caller's existing click listener handles whatever follows.
        clearTimer();
        startCoord = null;
        return;
      }
      // Post-480ms first threshold breach → drag-start.
      if (!didDrag) {
        didDrag = true;
        // onDragStart receives the ORIGINAL pointerdown coords, not the
        // post-threshold pointer position — the ghost-node origin must
        // anchor to where the node was first touched.
        opts.onDragStart(startCoord.x, startCoord.y);
      }
      // All subsequent moves (including the first one that crossed the
      // threshold) feed onDragMove with the live pointer position.
      opts.onDragMove(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e: MinimalPointerEvent): void {
    clearTimer();
    lastCoord = { x: e.clientX, y: e.clientY };

    if (didLongPress && didDrag) {
      opts.onDragEnd(e.clientX, e.clientY);
    }
    // Phase 49-06: release-in-place after recognition no longer fires an extra
    // callback — onLongPressRecognized already fired inside the 480ms timer.
    // Tap path (no recognition, no drag): do nothing — the caller's click
    // handler already fires.

    // Preserve didLongPress through to onClickCapture (the synthetic click
    // that follows pointerup needs to read the flag before it clears).
    // onClickCapture is responsible for clearing it on the next frame.
    didDrag = false;
    startCoord = null;
  }

  function onPointerCancel(e: MinimalPointerEvent): void {
    clearTimer();
    if (didDrag) {
      opts.onDragEnd(lastCoord.x, lastCoord.y);
    }
    didLongPress = false;
    didDrag = false;
    startCoord = null;
    void e;
  }

  function onClickCapture(e: MinimalPointerEvent): void {
    if (didLongPress) {
      e.stopPropagation?.();
      e.preventDefault?.();
      // Defer the reset so any other capture-phase handlers that read the
      // flag synchronously still see true. requestAnimationFrame is the
      // standard cadence; fall back to setTimeout(0) outside the browser.
      const raf =
        typeof globalThis.requestAnimationFrame === 'function'
          ? globalThis.requestAnimationFrame
          : (cb: () => void) => setTimeout(cb, 0);
      raf(() => {
        didLongPress = false;
      });
    }
  }

  function getDidLongPress(): boolean {
    return didLongPress;
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
    getDidLongPress,
    reset,
  };
}

// ─── Hook wrapper ────────────────────────────────────────────────────────────

/**
 * useLongPressOrDrag — React hook wrapper around `createLongPressOrDragMachine`.
 *
 * Caches the machine across renders and exposes a React `didLongPress`
 * MutableRefObject synced from the factory's internal flag (for consumers
 * that want to check the flag from JSX click handlers).
 */
export function useLongPressOrDrag(opts: UseLongPressOrDragOptions): {
  bind: {
    onPointerDown: (e: MinimalPointerEvent) => void;
    onPointerMove: (e: MinimalPointerEvent) => void;
    onPointerUp: (e: MinimalPointerEvent) => void;
    onPointerCancel: (e: MinimalPointerEvent) => void;
    onClickCapture: (e: MinimalPointerEvent) => void;
  };
  didLongPress: React.MutableRefObject<boolean>;
} {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  // Single machine instance per hook lifetime. Closures inside read the
  // latest callbacks via optsRef.
  const machineRef = useRef<LongPressOrDragMachine | null>(null);
  if (machineRef.current === null) {
    machineRef.current = createLongPressOrDragMachine({
      longPressMs: opts.longPressMs,
      dragThresholdPx: opts.dragThresholdPx,
      onLongPressRecognized: (x, y) => optsRef.current.onLongPressRecognized?.(x, y),
      onDragStart: (x, y) => optsRef.current.onDragStart(x, y),
      onDragMove: (x, y) => optsRef.current.onDragMove(x, y),
      onDragEnd: (x, y) => optsRef.current.onDragEnd(x, y),
    });
  }

  // Mirror the factory's internal flag into a React ref so JSX consumers can
  // read it synchronously.
  const didLongPressRef = useRef(false);

  // Cleanup on unmount.
  useEffect(() => {
    const m = machineRef.current;
    return () => {
      m?.reset();
    };
  }, []);

  const m = machineRef.current!;
  const bind = {
    onPointerDown: (e: MinimalPointerEvent) => {
      m.onPointerDown(e);
      didLongPressRef.current = m.getDidLongPress();
    },
    onPointerMove: (e: MinimalPointerEvent) => {
      m.onPointerMove(e);
      didLongPressRef.current = m.getDidLongPress();
    },
    onPointerUp: (e: MinimalPointerEvent) => {
      m.onPointerUp(e);
      didLongPressRef.current = m.getDidLongPress();
    },
    onPointerCancel: (e: MinimalPointerEvent) => {
      m.onPointerCancel(e);
      didLongPressRef.current = m.getDidLongPress();
    },
    onClickCapture: (e: MinimalPointerEvent) => {
      m.onClickCapture(e);
      didLongPressRef.current = m.getDidLongPress();
    },
  };

  return { bind, didLongPress: didLongPressRef };
}
