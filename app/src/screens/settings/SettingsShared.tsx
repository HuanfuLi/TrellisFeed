import { useState, type CSSProperties } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

export function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '24px' }}>
      <div style={{ color: 'var(--primary-40)' }}>{icon}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

export function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, marginBottom: description ? '2px' : 0 }}>{label}</p>
        {description && <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{description}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export function MaterialSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        position: 'relative',
        width: '52px',
        height: '32px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: checked ? 'var(--primary-40)' : 'var(--switch-background)',
        transition: 'background-color 0.2s',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '24px',
          height: '24px',
          top: '4px',
          left: checked ? '24px' : '4px',
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

export function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-variant)',
        color: 'var(--foreground)',
        fontSize: '0.875rem',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function TextInput({ value, onChange, onBlur, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string; placeholder?: string }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';

  const wrapperStyle: CSSProperties | undefined = isPassword ? {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  } : undefined;

  const input = (
    <input
      type={isPassword && revealed ? 'text' : type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{
        padding: '8px 12px',
        paddingRight: isPassword ? '36px' : '12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-variant)',
        color: 'var(--foreground)',
        fontSize: '0.875rem',
        width: type === 'time' ? '120px' : '160px',
      }}
    />
  );

  if (!isPassword) return input;

  return (
    <div style={wrapperStyle}>
      {input}
      <button
        type="button"
        onClick={() => setRevealed(p => !p)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted-foreground)',
          padding: '4px',
        }}
      >
        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export function TestResult({ result }: { result: string | null }) {
  if (!result) return null;
  const ok = result.startsWith('✓');
  return (
    <span style={{
      fontSize: '0.8rem',
      color: ok ? 'var(--primary-40)' : 'var(--danger)',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      {ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {result}
    </span>
  );
}

export const SUB_SCREEN_STYLE: CSSProperties = {
  paddingTop: '64px',
  paddingLeft: '16px',
  paddingRight: '16px',
  paddingBottom: 'var(--bottom-nav-safe)',
  maxWidth: '448px',
  margin: '0 auto',
};
