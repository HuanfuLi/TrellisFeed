import type { ReactNode, MouseEvent } from 'react';
import { createPortal } from 'react-dom';

// Per CONTEXT D-09: reusable slide-up bottom sheet. Overlay zIndex 500 clears the
// app Header (zIndex 190) per RESEARCH Pitfall 5. Inline styles only — project
// convention is CSS variables, not Tailwind utility classes.
//
// Phase 43 Plan 43-09 (UAT Test 2 gap closure): the outer overlay is wrapped in
// createPortal(overlay, document.body) so the sheet escapes any ancestor
// containing block (specifically SwipeTabContainer's per-slot translateZ(0)).
// Without this, position:fixed anchors to the slot bottom rather than the viewport,
// and the BottomNavigation (~80px row + safe-area-bottom) physically eclipses the
// bottom row(s) of the sheet. Matches the Phase 32.1 Header portal-vs-in-tree
// pattern documented in CLAUDE.md.
//
// Nav-clearance is applied as inner-sheet paddingBottom (NOT as a bottom: calc
// offset on the sheet's position), because the slide-up animation uses
// transform: translateY(100%). Anchoring `bottom` above zero means the closed
// sheet only translates partway off-screen — its tail covers the BottomNavigation
// even when the menu is dismissed. Keep `bottom: 0` so translateY(100%) fully
// hides the sheet; push the LAST ROW above the nav via paddingBottom.

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  compact?: boolean;  // when true, overrides minHeight to 'auto' and maxHeight to '50vh' (per Phase 43 LP-01 — 3-row engagement menu should not show 45vh empty space)
}

export function BottomSheet({ open, onClose, title, children, compact }: BottomSheetProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  // SSR / non-browser guard — document is undefined in pre-hydration contexts.
  // Skipping the portal in that branch means the sheet simply doesn't render
  // (matches the previous in-tree behavior on the server: zero output).
  if (typeof document === 'undefined') return null;

  const overlay = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        backgroundColor: open ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0)',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'background-color 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <div
        onClick={stop}
        style={{
          position: 'absolute',
          // Phase 43 gap-closure (UAT Test 2 re-fix): keep sheet anchored to
          // viewport-bottom so translateY(100%) fully hides it off-screen.
          // Nav-clearance lives in paddingBottom below — pushes the last row
          // above the fixed BottomNavigation (~80px) + iOS safe-area-bottom.
          // See .planning/debug/dismiss-row-clipped-by-bottom-nav.md (resolved)
          // and the follow-up screenshot 2026-05-12 showing the prior
          // bottom: calc(...) offset left a sheet-tail covering the nav.
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          paddingTop: 20,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 'calc(24px + 80px + var(--safe-area-bottom))',
          boxShadow: 'var(--shadow-3)',
          minHeight: compact ? 'auto' : '45vh',
          maxHeight: compact ? '50vh' : '75vh',
          overflowY: 'auto',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {title !== undefined && (
          <>
            <div
              style={{
                width: 40,
                height: 4,
                backgroundColor: 'var(--border)',
                borderRadius: 2,
                margin: '0 auto 16px',
              }}
            />
            <h3
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              {title}
            </h3>
          </>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
