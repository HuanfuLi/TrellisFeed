/**
 * SwipeTabContainer.tsx
 * Horizontal strip container with gesture-driven swipe navigation.
 *
 * Lays out all screens side by side in a horizontal strip.
 * Handles: axis lock, rubber-band edges, commit threshold,
 * keyboard guard, nested-drag suppression, spring animation,
 * tab-tap animation, URL sync on commit only.
 *
 * Each screen slot has `transform: translateZ(0)` to create a per-slot
 * containing block for `position: fixed` descendants — without this,
 * the strip's CSS transform captures all fixed elements and breaks
 * header/modal positioning.
 *
 * Children (e.g. BottomNavigation) are rendered outside the strip but
 * inside the SwipeTabContext.Provider so they can read swipeProgress.
 */

import { useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { PanInfo, AnimationPlaybackControls } from 'framer-motion';
import { SwipeTabContext } from '../lib/swipe-tab-context';
import {
  resolveAxisLock,
  computeDragOffset,
  resolveCommitIndex,
  shouldBlockGesture,
  computeTargetX,
} from '../lib/swipe-tab-logic';

interface SwipeTabContainerProps {
  screens: React.ReactNode[];
  routes: readonly string[];
  children?: React.ReactNode;
}

/** Spring transition (~250ms feel) for swipe commit and tab-tap animations */
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

function getScreenWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : 375;
}

export function SwipeTabContainer({ screens, routes, children }: SwipeTabContainerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Refs (all gesture state in refs — zero re-renders during interaction) ──
  const screenWidthRef = useRef(getScreenWidth());
  const lockAxisRef = useRef<'x' | 'y' | null>(null);
  const gestureBlockedRef = useRef(false);
  const keyboardOpenRef = useRef(false);
  const animatingRef = useRef(false);
  const animControlsRef = useRef<AnimationPlaybackControls | null>(null);

  // Resolve initial index from current route (once on mount)
  const initialIndex = useMemo(() => {
    const idx = routes.indexOf(location.pathname);
    return idx !== -1 ? idx : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeIndexRef = useRef(initialIndex);

  // ── Primary MotionValue: absolute strip pixel position ──────────────────
  // Single source of truth for visual position. No derived transforms with
  // stale refs — stripX is set directly during pan and animated on commit.
  const stripX = useMotionValue(-(initialIndex * getScreenWidth()));

  // Fractional screen index (0=Home … 4=Settings) for BottomNavigation color interpolation
  const swipeProgress = useTransform(stripX, (x) => {
    const w = screenWidthRef.current;
    return w > 0 ? -x / w : 0;
  });

  // ── Keyboard detection (ref-only, no state / no re-renders) ─────────────
  // Phase 33 UAT-4 (2026-04-20): on focus-out, we also force a stripX
  // re-snap to recover from any horizontal drift accumulated while the
  // keyboard was open. Without this, AskScreen stays mis-aligned until
  // the user navigates to another tab (navigateToTab unconditionally
  // re-snaps), which is exactly the reported "keyboard deform doesn't
  // recover" symptom.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) {
        keyboardOpenRef.current = true;
      }
    };
    const onFocusOut = () => {
      keyboardOpenRef.current = false;
      // Defer one frame so the keyboard-close viewport resize finishes
      // before we read getScreenWidth(). Unconditional snap — mirrors
      // navigateToTab's recovery path. Also reset document.scrollLeft
      // as defense-in-depth against the keyboard-scroll-into-view drift
      // (primary fix is overflow-x: hidden on html/body, see index.css).
      requestAnimationFrame(() => {
        screenWidthRef.current = getScreenWidth();
        if (!animatingRef.current && lockAxisRef.current !== 'x') {
          stripX.set(computeTargetX(activeIndexRef.current, screenWidthRef.current));
        }
        const root = document.scrollingElement ?? document.documentElement;
        if (root && root.scrollLeft !== 0) root.scrollLeft = 0;
      });
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [stripX]);

  // ── Viewport resize re-sync (Phase 28 D-05, hardened Phase 33 UAT-4) ────
  // Without re-sync, a device rotation or browser-UI expand/collapse leaves
  // `screenWidthRef` stale — subsequent route syncs use the old width and
  // the strip ends up pointing at a non-existent slot. Refresh width and
  // re-snap whenever the visual viewport width genuinely changes.
  //
  // The height-only change guard (Phase 33 UAT-4, 2026-04-20) is load-
  // bearing: keyboard open/close on Android WebView fires
  // visualViewport.resize events where HEIGHT shrinks but WIDTH stays the
  // same — or WIDTH transiently reports pixel-ratio-adjusted values mid-
  // animation. Re-snapping stripX during those transients placed the
  // active slot at a wrong X, producing the "Ask screen zooms/deforms"
  // symptom that didn't recover until the user navigated away. Only
  // re-snap when width actually changed; keyboard events are now no-ops.
  useEffect(() => {
    const resync = () => {
      const newWidth = getScreenWidth();
      if (newWidth === screenWidthRef.current) return; // height-only (e.g. keyboard) → no-op
      screenWidthRef.current = newWidth;
      const midGesture = lockAxisRef.current === 'x';
      if (!animatingRef.current && !midGesture) {
        stripX.set(computeTargetX(activeIndexRef.current, screenWidthRef.current));
      }
    };
    window.addEventListener('resize', resync);
    window.visualViewport?.addEventListener('resize', resync);
    return () => {
      window.removeEventListener('resize', resync);
      window.visualViewport?.removeEventListener('resize', resync);
    };
  }, [stripX]);

  // ── Route sync (back button, programmatic navigate, initial load) ───────
  // useLayoutEffect prevents one-frame flash before paint
  useLayoutEffect(() => {
    // Always refresh width first — a resize event may have fired in the
    // same tick the user navigated, and we want route-sync to land on the
    // current viewport, not a stale one.
    screenWidthRef.current = getScreenWidth();
    const idx = routes.indexOf(location.pathname);
    if (idx !== -1 && idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      // Snap immediately — don't interfere with an in-progress animation
      // (navigateToTab / onPanEnd already animate to the correct position)
      if (!animatingRef.current) {
        stripX.set(computeTargetX(idx, screenWidthRef.current));
      }
    }
    // Dev invariant (Phase 28 D-05): catch regressions where stripX drifts
    // from its expected position after a route change. Warn only in dev;
    // production builds strip the branch.
    if (import.meta.env.DEV && !animatingRef.current) {
      const expected = computeTargetX(activeIndexRef.current, screenWidthRef.current);
      if (Math.abs(stripX.get() - expected) > 2) {
        console.warn('[SwipeTabContainer] stripX drift', { actual: stripX.get(), expected });
      }
    }
  }, [location.pathname, routes, stripX]);

  // ── Pan handlers ────────────────────────────────────────────────────────

  const onPanStart = useCallback((_e: PointerEvent) => {
    // Stop any running spring animation so it doesn't fight with the gesture
    animControlsRef.current?.stop();
    animControlsRef.current = null;
    animatingRef.current = false;
    lockAxisRef.current = null;
    screenWidthRef.current = getScreenWidth();
    gestureBlockedRef.current = !!((_e.target as HTMLElement)?.closest?.('[data-no-swipe-nav]'));
  }, []);

  const onPan = useCallback((_e: PointerEvent, info: PanInfo) => {
    if (shouldBlockGesture({ keyboardOpen: keyboardOpenRef.current, gestureBlocked: gestureBlockedRef.current })) return;

    // Axis lock after ~10px
    if (lockAxisRef.current === null) {
      const resolved = resolveAxisLock({ x: info.offset.x, y: info.offset.y });
      if (resolved !== null) lockAxisRef.current = resolved;
    }
    if (lockAxisRef.current !== 'x') return;

    // Set strip position directly — no derived transform, no stale ref
    const offset = computeDragOffset(info.offset.x, activeIndexRef.current, routes.length);
    stripX.set(-(activeIndexRef.current * screenWidthRef.current) + offset);
  }, [routes.length, stripX]);

  const onPanEnd = useCallback((_e: PointerEvent, info: PanInfo) => {
    const sw = screenWidthRef.current;

    // Blocked or vertical → snap back to current screen
    if (gestureBlockedRef.current || lockAxisRef.current !== 'x') {
      animControlsRef.current = animate(stripX, -(activeIndexRef.current * sw), SPRING);
      return;
    }

    // Resolve commit target (20% threshold)
    const newIndex = resolveCommitIndex(info.offset.x, activeIndexRef.current, sw, routes.length);
    activeIndexRef.current = newIndex;
    animatingRef.current = true;

    animControlsRef.current = animate(stripX, -(newIndex * sw), {
      ...SPRING,
      onComplete: () => { animatingRef.current = false; }
    });

    // Sync URL only if the route actually changed
    if (routes[newIndex] !== location.pathname) {
      navigate(routes[newIndex]);
    }
  }, [routes, navigate, stripX, location.pathname]);

  // ── navigateToTab (called by BottomNavigation tap) ──────────────────────
  // Instant transport (pre-phase-22 behavior). The animated multi-tab jump was
  // fragile and flickery in practice; tapping a nav button now snaps the strip
  // to the target in a single frame. Finger-swipe still uses the spring animation
  // via onPanEnd — this only affects taps.
  const navigateToTab = useCallback((targetIndex: number) => {
    if (targetIndex === activeIndexRef.current) return;
    if (targetIndex < 0 || targetIndex >= routes.length) return;

    animControlsRef.current?.stop();
    animControlsRef.current = null;
    animatingRef.current = false;

    activeIndexRef.current = targetIndex;
    stripX.set(-(targetIndex * screenWidthRef.current));

    navigate(routes[targetIndex]);
  }, [routes, navigate, stripX]);

  // ── Context (stable identity) ───────────────────────────────────────────
  const contextValue = useMemo(() => ({
    swipeProgress,
    navigateToTab,
  }), [swipeProgress, navigateToTab]);

  return (
    <SwipeTabContext.Provider value={contextValue}>
      <motion.div
        onPanStart={onPanStart}
        onPan={onPan}
        onPanEnd={onPanEnd}
        style={{
          display: 'flex',
          width: `${routes.length * 100}vw`,
          x: stripX,
          touchAction: 'pan-y',
        }}
      >
        {screens.map((screen, i) => (
          <div
            key={routes[i]}
            style={{
              width: '100vw',
              flexShrink: 0,
              height: '100dvh',
              overflow: 'hidden',
              // Creates a per-slot containing block so position:fixed elements
              // (Header, modals) are scoped to their own screen, not the strip.
              transform: 'translateZ(0)',
            }}
          >
            {screen}
          </div>
        ))}
      </motion.div>
      {children}
    </SwipeTabContext.Provider>
  );
}
