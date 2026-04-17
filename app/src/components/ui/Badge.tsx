import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  /**
   * Phase 28 D-29 — when provided, the badge becomes interactive and
   * renders with a 44×44 minimum touch target (WCAG 2.5.8). Non-interactive
   * badges keep their visually compact footprint.
   */
  onClick?: MouseEventHandler<HTMLSpanElement>;
  /**
   * Optional inline style overrides. Spread last so consumers can tune
   * without losing the base color/layout.
   */
  style?: CSSProperties;
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  green: { bg: 'var(--primary-90)', text: 'var(--primary-30)' },
  yellow: { bg: 'var(--secondary-80)', text: 'var(--badge-yellow-text)' },
  red: { bg: 'var(--danger-light)', text: 'var(--danger-dark)' },
  blue: { bg: 'var(--node-sky)', text: 'var(--badge-blue-text)' },
  purple: { bg: 'var(--node-lilac)', text: 'var(--badge-purple-text)' },
  gray: { bg: 'var(--surface-variant)', text: 'var(--muted-foreground)' },
};

export function Badge({ children, color = 'gray', onClick, style }: BadgeProps) {
  const { bg, text } = colorMap[color];
  const interactive = Boolean(onClick);
  const touchStyles: CSSProperties = interactive
    ? {
        minWidth: '44px',
        minHeight: '44px',
        justifyContent: 'center',
        cursor: 'pointer',
      }
    : {};
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.75rem',
        fontWeight: 500,
        backgroundColor: bg,
        color: text,
        whiteSpace: 'nowrap',
        ...touchStyles,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
