import { useEffect, useState } from 'react';
import {
  MIN_KEYBOARD_HEIGHT,
  CLOSE_KEYBOARD_HEIGHT,
  resolveKeyboardOpen,
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
    let appliedKeyboardOpen: boolean | null = null;

    const applyKeyboardOpen = (nextOpen: boolean) => {
      document.body.classList.toggle('keyboard-open', nextOpen);
      if (appliedKeyboardOpen === nextOpen) return;
      appliedKeyboardOpen = nextOpen;
      setKeyboardOpen(nextOpen);
    };

    const handleResize = () => {
      const currentHeight = viewport.height;
      const currentWidth = viewport.width;
      const widthChanged = Math.abs(currentWidth - viewportState.width) > VIEWPORT_WIDTH_RESET_DELTA;
      if (widthChanged) {
        viewportState.width = currentWidth;
        viewportState.baselineHeight = currentHeight;
      }

      const editableFocused = isEditableElement(document.activeElement);
      if (!editableFocused) {
        if (!widthChanged && currentHeight > viewportState.baselineHeight) {
          viewportState.baselineHeight = currentHeight;
        }
        applyKeyboardOpen(false);
        return;
      }

      if (!widthChanged && currentHeight > viewportState.baselineHeight) {
        viewportState.baselineHeight = currentHeight;
      }

      const heightDelta = viewportState.baselineHeight - currentHeight;
      // BUGFIX-03: hysteresis (open 150 / close 80) so a transient mid-animation
      // viewport height in the [close, open] band cannot flip an already-settled
      // keyboardOpen and reverse the BottomNavigation y-spring. See
      // keyboard-hysteresis.ts and CLAUDE.md "SwipeTabContainer resize + keyboard".
      const nextOpen =
        editableFocused &&
        resolveKeyboardOpen({
          heightDelta,
          wasOpen: appliedKeyboardOpen === true,
          openThreshold: MIN_KEYBOARD_HEIGHT,
          closeThreshold: CLOSE_KEYBOARD_HEIGHT,
        });
      applyKeyboardOpen(nextOpen);
    };

    viewport.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    document.addEventListener('focusin', handleResize);
    document.addEventListener('focusout', handleResize);
    handleResize();

    return () => {
      viewport.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleResize);
      document.removeEventListener('focusout', handleResize);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return keyboardOpen;
}
