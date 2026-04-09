import { useRef } from 'react';
import { motion, useTransform } from 'framer-motion';
import { Home, GitBranch, Mic, Calendar, Settings } from 'lucide-react';
import { hapticImpactLight } from '../lib/haptics';
import { useSwipeTab } from '../lib/swipe-tab-context';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  index: number;
}

const leftItems: NavItem[] = [
  { icon: <Home size={22} />, label: 'Home', index: 0 },
  { icon: <Calendar size={22} />, label: 'Planner', index: 1 },
];

const rightItems: NavItem[] = [
  { icon: <GitBranch size={22} />, label: 'Graph', index: 3 },
  { icon: <Settings size={22} />, label: 'Settings', index: 4 },
];

// Shared style to suppress all native mobile long-press / callout behaviors
const noCallout: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

interface BottomNavigationProps {
  onAskLongPress?: () => void;
  onAskLongPressRelease?: () => void;
}

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

export function BottomNavigation({ onAskLongPress, onAskLongPressRelease }: BottomNavigationProps) {
  const { swipeProgress, navigateToTab } = useSwipeTab();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const handleAskPointerDown = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      longPressTimer.current = null;
      void hapticImpactLight();
      onAskLongPress?.();
    }, 500);
  };

  const handleAskPointerRelease = () => {
    if (longPressTimer.current !== null) {
      // Timer still pending — quick tap, cancel long-press
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    } else if (longPressFired.current) {
      // Long-press confirmed and now released — signal stop
      longPressFired.current = false;
      onAskLongPressRelease?.();
    }
  };

  const handleAskClick = () => {
    // Only navigate on a clean tap (long-press resets longPressFired in handleAskPointerRelease)
    if (!longPressFired.current) navigateToTab(2);
  };

  // Ask FAB color tracking (index 2)
  const fabBg = useTransform(
    swipeProgress,
    [1.5, 2, 2.5],
    ['var(--primary-40)', 'var(--primary-30)', 'var(--primary-40)'],
  );
  const fabShadow = useTransform(
    swipeProgress,
    [1.5, 2, 2.5],
    [
      '0 4px 14px rgba(0,0,0,0.2)',
      '0 0 0 4px color-mix(in srgb, var(--primary-40) 25%, transparent), 0 4px 14px rgba(0,0,0,0.25)',
      '0 4px 14px rgba(0,0,0,0.2)',
    ],
  );
  const fabScale = useTransform(
    swipeProgress,
    [1.5, 2, 2.5],
    [1, 1.08, 1],
  );

  return (
    <nav
      id="bottom-navigation"
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
        {/* Left items */}
        {leftItems.map((item) => (
          <TabButton
            key={item.index}
            item={item}
            swipeProgress={swipeProgress}
            onTap={() => navigateToTab(item.index)}
          />
        ))}

        {/* Center FAB — Ask */}
        <motion.button
          onClick={handleAskClick}
          onPointerDown={handleAskPointerDown}
          onPointerUp={handleAskPointerRelease}
          onPointerLeave={handleAskPointerRelease}
          onPointerCancel={handleAskPointerRelease}
          onContextMenu={(e) => e.preventDefault()}
          className="active-squish"
          style={{
            ...noCallout,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            width: '60px',
            height: '60px',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: fabBg,
            color: 'white',
            boxShadow: fabShadow,
            flexShrink: 0,
            scale: fabScale,
          }}
        >
          <Mic size={24} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.02em' }}>Ask</span>
        </motion.button>

        {/* Right items */}
        {rightItems.map((item) => (
          <TabButton
            key={item.index}
            item={item}
            swipeProgress={swipeProgress}
            onTap={() => navigateToTab(item.index)}
          />
        ))}
      </div>
    </nav>
  );
}
