/**
 * Pure swipe gesture logic functions.
 *
 * Extracted from SwipeTabContainer for testability.
 * All functions are pure (no side effects, no DOM access).
 *
 * @module swipe-tab-logic
 */

/**
 * Determines axis lock direction based on gesture offset.
 *
 * After the offset exceeds the threshold on one axis, that axis wins
 * and the other is ignored for the rest of the gesture. (D-07)
 *
 * @param offset - Current gesture offset {x, y} in pixels
 * @param threshold - Minimum movement to trigger lock (default 10px)
 * @returns 'x' | 'y' | null
 */
export function resolveAxisLock(
  offset: { x: number; y: number },
  threshold = 10,
): 'x' | 'y' | null {
  const absX = Math.abs(offset.x);
  const absY = Math.abs(offset.y);

  if (absX < threshold && absY < threshold) {
    return null;
  }

  return absX >= absY ? 'x' : 'y';
}

/**
 * Computes the effective drag offset, applying rubber-band resistance at edges. (D-13)
 *
 * At index 0 (leftmost), dragging right (positive offset) is resisted.
 * At last index, dragging left (negative offset) is resisted.
 * Middle screens pass through unchanged.
 *
 * @param rawOffset - Raw horizontal offset in pixels from gesture
 * @param activeIndex - Current committed screen index
 * @param screenCount - Total number of screens
 * @param rubberBandFactor - Resistance multiplier at edges (default 0.25)
 * @returns Effective drag offset in pixels
 */
export function computeDragOffset(
  rawOffset: number,
  activeIndex: number,
  screenCount: number,
  rubberBandFactor = 0.25,
): number {
  // Left edge: dragging right (positive)
  if (activeIndex === 0 && rawOffset > 0) {
    return rawOffset * rubberBandFactor;
  }
  // Right edge: dragging left (negative)
  if (activeIndex === screenCount - 1 && rawOffset < 0) {
    return rawOffset * rubberBandFactor;
  }
  return rawOffset;
}

/**
 * Resolves the target screen index after a swipe gesture ends. (D-14)
 *
 * If the offset exceeds the threshold ratio of screen width, commits to
 * the adjacent screen. Otherwise snaps back to the current screen.
 * Clamped to valid index range.
 *
 * @param offset - Final horizontal offset in pixels
 * @param activeIndex - Current committed screen index
 * @param screenWidth - Current viewport width in pixels
 * @param screenCount - Total number of screens
 * @param thresholdRatio - Fraction of screen width to trigger commit (default 0.2)
 * @returns Target screen index
 */
export function resolveCommitIndex(
  offset: number,
  activeIndex: number,
  screenWidth: number,
  screenCount: number,
  thresholdRatio = 0.2,
): number {
  const threshold = screenWidth * thresholdRatio;

  // Swipe left (negative offset) → go to next screen
  if (offset < -threshold && activeIndex < screenCount - 1) {
    return activeIndex + 1;
  }
  // Swipe right (positive offset) → go to previous screen
  if (offset > threshold && activeIndex > 0) {
    return activeIndex - 1;
  }
  // Below threshold → snap back
  return activeIndex;
}

/**
 * Determines whether the swipe gesture should be blocked. (D-08, D-09)
 *
 * Blocked when the soft keyboard is open (input focused) or when the
 * touch started inside a nested draggable element (data-no-swipe-nav).
 *
 * @param state - Current blocking state
 * @returns true if gesture should be suppressed
 */
export function shouldBlockGesture(state: {
  keyboardOpen: boolean;
  gestureBlocked: boolean;
}): boolean {
  return state.keyboardOpen || state.gestureBlocked;
}

/**
 * Computes the absolute strip x position for a given screen index and viewport width. (Phase 28 D-05)
 *
 * Pure helper surfaced so the resize listener + dev invariant in SwipeTabContainer
 * can share the same arithmetic without embedding a magic formula.
 *
 * @param index - Active screen index (0-based)
 * @param width - Current viewport width in pixels
 * @returns Strip translate-x value (negative or zero)
 */
export function computeTargetX(index: number, width: number): number {
  return -index * width;
}
