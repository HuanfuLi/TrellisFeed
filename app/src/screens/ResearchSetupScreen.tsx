import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { researchConfig } from '../services/research-config';
import { studyContextService } from '../services/study-context.service';
import type { StudyCondition } from '../types';

interface InstallResolveResponse {
  condition: StudyCondition;
  topicId: string;
}

function isInstallResolveResponse(value: unknown): value is InstallResolveResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<InstallResolveResponse>;
  return (response.condition === 'control' || response.condition === 'experimental') &&
    typeof response.topicId === 'string' && response.topicId.trim().length > 0;
}

/** Researcher-led, one-time account binding for a fresh participant installation. */
export function ResearchSetupScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bindAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUserId = userId.trim();
    if (!/^\d+$/.test(normalizedUserId)) {
      setError(t('researchSetup.invalidAccountId'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`${researchConfig.apiBaseUrl}/v1/install/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: normalizedUserId }),
      });
      if (!response.ok) {
        throw new Error('Account resolution failed');
      }

      const assignment: unknown = await response.json();
      if (!isInstallResolveResponse(assignment)) {
        throw new Error('Account resolution returned an invalid assignment');
      }

      await studyContextService.bindOnce({
        userId: normalizedUserId,
        condition: assignment.condition,
        topicId: assignment.topicId,
        boundAt: new Date().toISOString(),
      });
      navigate('/home', { replace: true });
    } catch {
      // Keep server assignment details and any network implementation details out
      // of the setup UI; researchers can retry after resolving the local issue.
      setError(t('researchSetup.resolveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(24px + var(--safe-area-top)) 16px calc(24px + var(--safe-area-bottom))',
        backgroundColor: 'var(--surface)',
      }}
    >
      <Card style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{t('researchSetup.title')}</h1>
        <p style={{ color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: '24px' }}>
          {t('researchSetup.body')}
        </p>

        <form onSubmit={(event) => void bindAccount(event)}>
          <label htmlFor="research-account-id" style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>
            {t('researchSetup.accountIdLabel')}
          </label>
          <input
            id="research-account-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            disabled={submitting}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--foreground)',
              fontSize: '1rem',
              marginBottom: '12px',
            }}
          />
          {error && (
            <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '12px' }}>
              {error}
            </p>
          )}
          <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
            {t('researchSetup.confirm')}
          </Button>
        </form>
      </Card>
    </main>
  );
}
