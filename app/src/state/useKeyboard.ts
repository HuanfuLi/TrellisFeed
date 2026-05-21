import { useEffect, useState } from 'react';
import {
  MIN_KEYBOARD_HEIGHT,
  CLOSE_KEYBOARD_HEIGHT,
  INITIAL_KEYBOARD_NAV_STATE,
  nextKeyboardState,
  type KeyboardEventKind,
  type KeyboardNavState,
} from './keyboard-hysteresis';

const VIEWPORT_WIDTH_RESET_DELTA = 40;
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly && !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return false;
}

/**
 * useKeyboard.ts
 *
 * Global hook to detect Android/iOS virtual keyboard presence via visualViewport.
 * Returns keyboard state and keeps `keyboard-open` on document.body for layout
 * variables that reduce keyboard-era bottom spacing.
 */
export function useKeyboard() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      document.body.classList.remove('keyboard-open');
      setKeyboardOpen(false);
      return;
    }

    const viewportState = {
      baselineHeight: Math.max(viewport.height, window.innerHeight || 0),
      width: viewport.width,
    };
    // Focus front-run (instant hide) only applies where a virtual keyboard
    // exists — on desktop/web, focusing the Ask input must NOT hide the nav.
    const isTouchDevice =
      (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
    let navState: KeyboardNavState = INITIAL_KEYBOARD_NAV_STATE;

    const applyState = (next: KeyboardNavState) => {
      document.body.classList.toggle('keyboard-open', next.open);
      if (navState.open !== next.open) setKeyboardOpen(next.open);
      navState = next;
    };

    // BUGFIX-03 (gap closure): a single handler drives the focus-aware state
    // machine. `focusin` hides the nav instantly (front-running adjustResize);
    // `resize` confirms/closes via hysteresis; `focusout` shows. See
    // keyboard-hysteresis.ts and CLAUDE.md "SwipeTabContainer resize + keyboard".
    const handle = (kind: KeyboardEventKind) => {
      const currentHeight = viewport.height;
      const currentWidth = viewport.width;
      const widthChanged = Math.abs(currentWidth - viewportState.width) > VIEWPORT_WIDTH_RESET_DELTA;
      if (widthChanged) {
        viewportState.width = currentWidth;
        viewportState.baselineHeight = currentHeight;
      } else if (currentHeight > viewportState.baselineHeight) {
        // Track the tallest seen height as the keyboard-closed baseline.
        viewportState.baselineHeight = currentHeight;
      }

      const editableFocused = isEditableElement(document.activeElement);
      const heightDelta = viewportState.baselineHeight - currentHeight;
      applyState(
        nextKeyboardState(navState, {
          kind,
          editableFocused,
          heightDelta,
          isTouchDevice,
          openThreshold: MIN_KEYBOARD_HEIGHT,
          closeThreshold: CLOSE_KEYBOARD_HEIGHT,
        }),
      );
    };

    const handleResize = () => handle('resize');
    const handleFocusIn = () => handle('focusin');
    const handleFocusOut = () => handle('focusout');

    viewport.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    handleResize();

    return () => {
      viewport.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return keyboardOpen;
}
