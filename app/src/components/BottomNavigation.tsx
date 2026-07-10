import { motion, useTransform } from 'framer-motion';
import { Home, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSwipeTab } from '../lib/swipe-tab-context';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  index: number;
}

// Shared style to suppress all native mobile long-press / callout behaviors
const noCallout: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

interface BottomNavigationProps {
  /**
   * Phase 28 D-06 — when false, the nav slides down off-screen (y: '100%').
   * Also hidden while the virtual keyboard is open so one animation owner
   * controls the vertical transform.
   * Defaults to true so any caller that hasn't wired the prop yet keeps
   * the nav visible (back-compat).
   */
  isTopLevelScreen?: boolean;
  keyboardOpen?: boolean;
}

/**
 * Spring config for the slide-down animation — matches SwipeTabContainer's
 * SPRING so visual motion feels coherent between swipe commit and nav
 * show/hide. Exported for the pure-function test.
 */
const SLIDE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

/**
 * Pure helper surfaced for BottomNavigation.slide.test.mjs. Keeps the
 * slide-target derivation testable without a DOM.
 */
export const getNavYTarget = (isTop: boolean, keyboardOpen = false): number | string => (
  isTop && !keyboardOpen ? 0 : '100%'
);

/** Tab button with real-time color tracking via swipeProgress MotionValue */
function TabButton({ item, swipeProgress, onTap }: {
  item: NavItem;
  swipeProgress: import('framer-motion').MotionValue<number>;
  onTap: () => void;
}) {
  const i = item.index;
  const color = useTransform(
    swipeProgress,
    [i - 1, i, i + 1],
    ['var(--muted-foreground)', 'var(--primary-40)', 'var(--muted-foreground)'],
  );
  const bgColor = useTransform(
    swipeProgress,
    [i - 0.5, i, i + 0.5],
    ['transparent', 'var(--secondary-container)', 'transparent'],
  );

  return (
    <motion.button
      onClick={onTap}
      onContextMenu={(e) => e.preventDefault()}
      className="active-squish"
      style={{
        ...noCallout,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '8px 16px',
        borderRadius: 'var(--radius-pill)',
        transition: 'none',
        minWidth: '56px',
        height: '56px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: bgColor,
        color,
        flex: 1,
      }}
    >
      {item.icon}
      <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{item.label}</span>
    </motion.button>
  );
}

export function BottomNavigation({
  isTopLevelScreen = true,
  keyboardOpen = false,
}: BottomNavigationProps) {
  const { t } = useTranslation();
  const { swipeProgress, navigateToTab } = useSwipeTab();

  const items: NavItem[] = [
    { icon: <Home size={22} />, label: t('common.nav.home'), index: 0 },
    { icon: <Settings size={22} />, label: t('common.nav.settings'), index: 1 },
  ];

  return (
    <motion.nav
      id="bottom-navigation"
      // Phase 28 D-06 / Android startup: slide down off-screen when user is
      // on a sub-screen or the keyboard is open, with React as the sole owner
      // of vertical nav movement.
      initial={false}
      animate={{ y: getNavYTarget(isTopLevelScreen, keyboardOpen) }}
      // BUGFIX-03 (gap closure): hide INSTANTLY when the keyboard opens so the
      // bar is gone before Android adjustResize can re-anchor the fixed element
      // upward (the rise-then-collapse flicker). Show keeps the spring. Pairs
      // with the focus-driven front-run in useKeyboard.ts / keyboard-hysteresis.ts.
      transition={keyboardOpen ? { duration: 0 } : SLIDE_SPRING}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--surface-container)',
        borderTop: '1px solid var(--border)',
        padding: '8px',
        paddingBottom: 'calc(8px + var(--safe-area-bottom))',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: '448px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '4px',
          height: '64px',
        }}
      >
        {items.map((item) => (
          <TabButton
            key={item.index}
            item={item}
            swipeProgress={swipeProgress}
            onTap={() => navigateToTab(item.index)}
          />
        ))}
      </div>
    </motion.nav>
  );
}
