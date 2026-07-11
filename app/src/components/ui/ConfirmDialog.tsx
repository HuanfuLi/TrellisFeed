import type { ReactNode } from 'react';

/**
 * ConfirmDialog — reusable confirmation modal (Phase 49-03).
 *
 * Shared by confirmation flows that need a consistent modal surface.
 *
 * Invariants (CLAUDE.md / 49-PATTERNS.md):
 *   - Backdrop click invokes `onCancel`, NEVER `onConfirm` (T-49-11 click-jacking
 *     defense). Inner card uses `e.stopPropagation()` so taps inside don't bubble.
 *   - zIndex 300 — sits above BottomNavigation (~zIndex 100) and above
 *     CorrectionCard's backdrop (zIndex 249) + card (250) from Plan 49-02.
 *     Below BottomSheet (~zIndex 500) since dialog is the higher-trust surface.
 *   - CSS variables only — no Tailwind classes.
 *   - `children` slot renders BETWEEN the body and the button row. Plan 49-03
 *     Test 2 ("ConfirmDialog children slot renders between body and buttons")
 *     enforces this ordering.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional preview slot rendered between body and the button row. */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  // D-09 — destructive variant swaps to var(--danger).
  const confirmColor = destructive ? 'var(--danger)' : 'var(--primary-40)';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px',
          width: '100%',
          maxWidth: '340px',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>{title}</p>
        {body && (
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--muted-foreground)',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}
          >
            {body}
          </p>
        )}
        {children && <div style={{ marginBottom: '16px' }}>{children}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '100px',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--muted-foreground)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '100px',
              backgroundColor: confirmColor,
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
