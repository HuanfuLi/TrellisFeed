import type { CSSProperties, ReactNode } from 'react';

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
  /** Extra inline styles on the outer fixed container */
  style?: CSSProperties;
}

/**
 * Fixed page header that sits directly below the status-bar safe-area shield.
 *
 * Each screen using this component should add `paddingTop: HEADER_HEIGHT` (or more)
 * to its scrollable content so it doesn't sit behind the header.
 */
export function Header({ title, left, right, centered, style }: HeaderProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--safe-area-top)',
        left: 0,
        right: 0,
        height: `${HEADER_HEIGHT}px`,
        backgroundColor: 'var(--surface)',
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
        {centered ? (
          <>
            <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center' }}>
              {left}
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
            <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {right}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ flex: 1, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h1>
            {left}
            {right}
          </>
        )}
      </div>
    </div>
  );
}
