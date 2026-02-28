import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--primary-40)',
    color: 'white',
  },
  secondary: {
    backgroundColor: 'var(--surface-variant)',
    color: 'var(--foreground)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--primary-40)',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--primary-40)',
    border: '1.5px solid var(--primary-40)',
  },
  danger: {
    backgroundColor: '#E53935',
    color: 'white',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: '0.875rem', borderRadius: '20px' },
  md: { padding: '12px 24px', fontSize: '1rem', borderRadius: '24px' },
  lg: { padding: '16px 32px', fontSize: '1.0625rem', borderRadius: '28px' },
};

function Spinner() {
  return (
    <>
      <style>{`@keyframes btn-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          animation: 'btn-spin 0.6s linear infinite',
          flexShrink: 0,
        }}
      />
    </>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth,
  style,
  disabled,
  loading,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 500,
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.2s, transform 0.2s',
        opacity: isDisabled ? 0.65 : 1,
        width: fullWidth ? '100%' : undefined,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
