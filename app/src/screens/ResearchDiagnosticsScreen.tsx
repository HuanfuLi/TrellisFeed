import { useTranslation } from 'react-i18next';

/** Placeholder route. PIN-gated diagnostics and recovery export arrive in Plan 09. */
export function ResearchDiagnosticsScreen() {
  const { t } = useTranslation();

  return (
    <main
      data-research-diagnostics-stub
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--surface)',
        color: 'var(--muted-foreground)',
      }}
    >
      {t('researchDiagnostics.placeholder')}
    </main>
  );
}
