import type { TrellisVariant } from './types.ts';

export interface TrellisVariantPickerProps {
  variant: TrellisVariant;
  onChange: (v: TrellisVariant) => void;
}

export function TrellisVariantPicker({ variant, onChange }: TrellisVariantPickerProps) {
  if (!import.meta.env.DEV) return null;
  const cycle = () => {
    const next: Record<TrellisVariant, TrellisVariant> = { A: 'C', C: 'V', V: 'A' };
    const v = next[variant];
    try { localStorage.setItem('trellis_variant_dev', v); } catch { /* ignore */ }
    onChange(v);
  };
  return (
    <button
      onClick={cycle}
      aria-label={`Switch trellis variant (current: ${variant})`}
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 60,
        padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        background: 'var(--surface-variant)', fontSize: '11px', border: '1px solid var(--border)',
        cursor: 'pointer', color: 'var(--foreground)',
      }}
    >
      Variant: {variant}
    </button>
  );
}
