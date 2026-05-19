import { useRef, useEffect, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { hapticImpactLight } from '../lib/haptics';

/**
 * 480ms long-press hook — codebase-wide convention (see CLAUDE.md "Best practices",
 * RESEARCH.md Section 1, original pattern at ChatMessage.tsx:119-140).
 *
 * Returns:
 * - didLongPress: ref consumers check in their onClick handler to suppress the
 *   short-tap action after a long-press fires. Set to true when the timer
 *   elapses; reset to false on each pointerdown.
 * - bind: pointer event handlers to spread onto the target element.
 *
 * Pointer-event policy (do NOT migrate to touch events or the browser's native
 * long-press menu hook):
 * - The native long-press menu handler is intentionally NOT registered. Android
 *   WebView surfaces the native text-selection menu on long-press if that handler
 *   is unhandled. The timer-only path here avoids surfacing it (verified by the
 *   live ChatMessage.tsx pattern).
 * - onPointerMove cancels the timer ONLY when displacement from the pointerdown
 *   coord exceeds DRAG_THRESHOLD_PX (8). Phase 50 UAT-4 G13 fix: cancelling on
 *   ANY pointermove broke long-press on real touch hardware because finger
 *   jitter fires constant pointermoves during a held press. Mirror the 8px
 *   threshold from useLongPressOrDrag.ts:132-159 so vertical scrolling still
 *   cancels (any deliberate movement >8px) but micro-jitter does not.
 */
const DRAG_THRESHOLD_PX = 8;

export function useLongPress(ms: number, onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const callbackRef = useRef(onLongPress);
  const startCoordRef = useRef<{ x: number; y: number } | null>(null);

  // Keep latest callback in a ref so the timer always invokes the freshest closure
  useEffect(() => {
    callbackRef.current = onLongPress;
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startCoordRef.current = null;
  }, []);

  const start = useCallback(
    (e: ReactPointerEvent) => {
      didLongPress.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      startCoordRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        didLongPress.current = true;
        // Fire-and-forget haptic — wrapper no-ops on web. Matches the sibling
        // useLongPressOrDrag.ts:120 pattern. Phase 50 UAT G13 follow-up:
        // before the G13 fix the OS-native long-press fired this haptic for
        // free, so operators were used to feeling it; now the JS recognizer
        // owns the path end-to-end and must fire it explicitly.
        void hapticImpactLight();
        callbackRef.current();
      }, ms);
    },
    [ms],
  );

  // Cancel only on deliberate movement (>8px Euclidean) — micro-jitter from
  // a held finger on touch hardware must NOT cancel the press. See G13.
  const handleMove = useCallback((e: ReactPointerEvent) => {
    const start = startCoordRef.current;
    if (start === null || timerRef.current === null) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      startCoordRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  const bind = {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerMove: handleMove,
  };

  return { didLongPress, bind };
}
