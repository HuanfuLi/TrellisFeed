import { useEffect } from 'react';

/**
 * useKeyboard.ts
 * 
 * Global hook to detect Android/iOS virtual keyboard presence via visualViewport.
 * Adds the `keyboard-open` class to document.body, allowing CSS to hide or adjust
 * elements (like BottomNavigation) that would otherwise steal screen real estate.
 */
export function useKeyboard() {
  useEffect(() => {
    if (!window.visualViewport) return;

    const MIN_KEYBOARD_HEIGHT = 150;
    
    // Store original height on mount
    const originalHeight = window.visualViewport.height;

    const handleResize = () => {
      if (!window.visualViewport) return;
      
      const currentHeight = window.visualViewport.height;
      const isKeyboardOpen = originalHeight - currentHeight > MIN_KEYBOARD_HEIGHT;

      if (isKeyboardOpen) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    // Initial check
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);
}
