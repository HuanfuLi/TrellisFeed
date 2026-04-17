import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button.tsx';

export function TrellisEmptyState() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--trellis-empty-bg)',
        gap: 16,
        textAlign: 'center',
        padding: 16,
      }}
      aria-live="polite"
    >
      <div style={{ fontSize: 32, lineHeight: 1 }} role="img" aria-label="Seed">🌱</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>{t('planner.trellis.emptyTitle')}</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0, maxWidth: 280 }}>
        {t('planner.trellis.emptyBody')}
      </p>
      <Button size="md" variant="primary" onClick={() => navigate('/ask')}>{t('planner.trellis.askCta')}</Button>
    </div>
  );
}
