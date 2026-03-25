import { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, GitBranch, MessageSquare, Calendar, Settings } from 'lucide-react';
import { hapticImpactLight } from '../lib/haptics';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const leftItems: NavItem[] = [
  { to: '/home', icon: <Home size={22} />, label: 'Home' },
  { to: '/planner', icon: <Calendar size={22} />, label: 'Planner' },
];

const rightItems: NavItem[] = [
  { to: '/graph', icon: <GitBranch size={22} />, label: 'Graph' },
  { to: '/settings', icon: <Settings size={22} />, label: 'Settings' },
];

interface BottomNavigationProps {
  onAskLongPress?: () => void;
}

export function BottomNavigation({ onAskLongPress }: BottomNavigationProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAskPointerDown = () => {
    void hapticImpactLight();
    longPressTimer.current = setTimeout(() => {
      onAskLongPress?.();
    }, 600);
  };

  const handleAskPointerUp = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <nav
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
          <NavLink
            key={item.to}
            to={item.to}
            className="active-squish"
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              transition: 'all 0.2s',
              minWidth: '56px',
              height: '56px',
              textDecoration: 'none',
              backgroundColor: isActive ? 'var(--secondary-container)' : 'transparent',
              color: isActive ? 'var(--primary-40)' : 'var(--muted-foreground)',
              flex: 1,
            })}
          >
            {item.icon}
            <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}

        {/* Center FAB — Ask */}
        <NavLink
          to="/ask"
          className="active-squish"
          onPointerDown={handleAskPointerDown}
          onPointerUp={handleAskPointerUp}
          onPointerLeave={handleAskPointerUp}
          onPointerCancel={handleAskPointerUp}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            width: '60px',
            height: '60px',
            borderRadius: '20px',
            textDecoration: 'none',
            backgroundColor: isActive ? 'var(--primary-30)' : 'var(--primary-40)',
            color: 'white',
            boxShadow: isActive
              ? '0 0 0 4px color-mix(in srgb, var(--primary-40) 25%, transparent), 0 4px 14px rgba(0,0,0,0.25)'
              : '0 4px 14px rgba(0,0,0,0.2)',
            flexShrink: 0,
            transform: isActive ? 'scale(1.08)' : 'scale(1)',
            transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          })}
        >
          <MessageSquare size={24} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.02em' }}>Ask</span>
        </NavLink>

        {/* Right items */}
        {rightItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="active-squish"
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              transition: 'all 0.2s',
              minWidth: '56px',
              height: '56px',
              textDecoration: 'none',
              backgroundColor: isActive ? 'var(--secondary-container)' : 'transparent',
              color: isActive ? 'var(--primary-40)' : 'var(--muted-foreground)',
              flex: 1,
            })}
          >
            {item.icon}
            <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
