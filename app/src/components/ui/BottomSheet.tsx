import type { ReactNode, MouseEvent } from 'react';

// Per CONTEXT D-09: reusable slide-up bottom sheet. Overlay zIndex 500 clears the
// app Header (zIndex 190) per RESEARCH Pitfall 5. Inline styles only — project
// convention is CSS variables, not Tailwind utility classes.

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  compact?: boolean;  // when true, overrides minHeight to 'auto' and maxHeight to '50vh' (per Phase 43 LP-01 — 3-row engagement menu should not show 45vh empty space)
}

export function BottomSheet({ open, onClose, title, children, compact }: BottomSheetProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
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
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 40px',
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
}
