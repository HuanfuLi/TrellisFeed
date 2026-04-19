import type { CSSProperties, ReactNode } from 'react';
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HeaderScrollContext } from '../../lib/header-scroll-context';
import { SwipeTabContext } from '../../lib/swipe-tab-context';

/** Height of the header bar (excluding safe-area). Use in content padding. */
export const HEADER_HEIGHT = 56;

interface HeaderProps {
  /** Primary title text */
  title: string;
  /** Element rendered on the left side (e.g. hamburger button) */
  left?: ReactNode;
  /** Element rendered on the right side (e.g. action buttons) */
  right?: ReactNode;
  /** When true, title is centered between left/right slots. Default: left-aligned. */
  centered?: boolean;
  /** When provided, renders a back-arrow left slot that navigates to this path */
  backTo?: string;
  /** Extra inline styles on the outer fixed container */
  style?: CSSProperties;
  /**
   * Phase 28 D-07 — when true, Header paints a subtle `var(--shadow-1)` to
   * separate itself from scrolled content beneath. If omitted, the component
   * consumes `HeaderScrollContext` (published by App.tsx's Outlet wrapper).
   */
  scrolled?: boolean;
}

/**
 * Fixed page header that sits directly below the status-bar safe-area shield.
 *
 * Each screen using this component should add `paddingTop: HEADER_HEIGHT` (or more)
 * to its scrollable content so it doesn't sit behind the header.
 *
 * Architecture: Header DOM is portaled to document.body via createPortal. This
 * decouples Header positioning from any ancestor's CSS — scroll containers,
 * transforms, filters, animations, containing-block creators in the React parent
 * tree have ZERO effect on Header. position:fixed always anchors to the viewport.
 *
 * Why portal (and not just position:fixed in-tree): position:fixed elements re-parent
 * to a transformed/filtered/will-change'd/contained/perspective'd ancestor (CSS spec),
 * AND on Android Chromium WebView even an `overflow: auto` ancestor can capture
 * fixed children as scroll-content. This bug class has recurred multiple times
 * (commits 8df7980c, a7203a65, 2dcef5d7, 73d657a0) — every time someone adds a new
 * scrollable wrapper or transform-based animation, Header positioning breaks again.
 * Portaling Header to document.body makes it structurally impossible: there is no
 * ancestor between Header and the viewport that can interfere.
 *
 * React context still propagates through portals — HeaderScrollContext continues
 * to work across the portal boundary.
 */
export function Header({ title, left, right, centered, backTo, style, scrolled: scrolledProp }: HeaderProps) {
  const navigate = useNavigate();
  const ctx = useContext(HeaderScrollContext);
  const scrolled = scrolledProp ?? ctx?.scrolled ?? false;

  const effectiveLeft = left ?? (backTo ? (
    <button onClick={() => navigate(backTo)} style={{ background: 'none', border: 'none', padding: '8px', marginLeft: '-8px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
      <ArrowLeft size={20} />
    </button>
  ) : undefined);
  const effectiveCentered = centered ?? !!backTo;
  const headerNode = (
    <div
      style={{
        position: 'fixed',
        top: 'var(--safe-area-top)',
        left: 0,
        right: 0,
        height: `${HEADER_HEIGHT}px`,
        backgroundColor: 'var(--surface)',
        // Phase 28 D-07 — scroll-aware shadow. 150ms ease-out so the
        // transition feels subtle; no shadow at rest keeps the flat look.
        boxShadow: scrolled ? 'var(--shadow-1)' : 'none',
        transition: 'box-shadow 150ms ease-out',
        zIndex: 190,
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: '448px',
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
        }}
      >
        {effectiveCentered ? (
          <>
            {/* Phase 28 D-29 — WCAG 2.5.8 44×44 minimum touch target for the
                 left/right slots. The back button inside inherits from the
                 flex container; we also stretch the slot to the full header
                 height so any nested button has at least 44px tap surface. */}
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {effectiveLeft}
            </div>
            <h1
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '1.125rem',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </h1>
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {right}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ flex: 1, fontSize: '1.25rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
            {/* Phase 28 D-29 — 44×44 enforced at the slot level so consumer
                 back buttons inherit a minimum tap area regardless of their
                 own inline styles. */}
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {effectiveLeft}
            </div>
            <div style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
              {right}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Portal ONLY for sub-screen Headers (rendered inside the App's Outlet wrapper,
  // a sibling of SwipeTabContainer). Top-level swipe-tab Headers (Settings, Planner,
  // Graph, Ask) MUST render in-tree — their slots have transform:translateZ(0) which
  // creates a per-slot containing block, so position:fixed Headers stay scoped to
  // the active slot and float off-screen with their slot when inactive (per the
  // 8df7980c "comprehensive swipe navigation rewrite" pattern).
  //
  // If we portal a top-level swipe-tab Header to document.body it becomes ALWAYS
  // visible regardless of which tab is active — operator caught this as a global
  // Settings banner appearing on Home/Planner/etc.
  //
  // Detection: SwipeTabContext is provided ONLY by SwipeTabContainer, wrapping the
  // strip slots. Sub-screens rendered through Outlet are siblings of SwipeTabContainer
  // and have ctx === null. So `insideSwipeTab` cleanly distinguishes the two cases
  // without needing a prop.
  const insideSwipeTab = useContext(SwipeTabContext) !== null;
  return insideSwipeTab ? headerNode : createPortal(headerNode, document.body);
}
