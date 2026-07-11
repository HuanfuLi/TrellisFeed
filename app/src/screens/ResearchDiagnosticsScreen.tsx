import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, LockKeyhole } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { eventBus } from '../lib/event-bus';
import { researchConfig } from '../services/research-config';
import { exportLocalRecoveryBlob } from '../services/research-export.service';
import {
  getLastSuccessfulUploadAt,
  getPendingCount,
  hydrateResearchMetadata,
} from '../services/research-metadata.service';
import { studyContextService } from '../services/study-context.service';

interface UploadStatus {
  pending: number;
  lastSuccessfulUploadAt: string | null;
}

function readUploadStatus(): UploadStatus {
  return {
    pending: getPendingCount(),
    lastSuccessfulUploadAt: getLastSuccessfulUploadAt(),
  };
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalDigest(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function ResearchDiagnosticsScreen() {
  const { t, i18n } = useTranslation();
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [status, setStatus] = useState<UploadStatus>(readUploadStatus);

  useEffect(() => {
    let active = true;
    void hydrateResearchMetadata().then(() => {
      if (active) setStatus(readUploadStatus());
    });
    const unsubscribe = eventBus.subscribe('UPLOAD_STATUS_CHANGED', () => {
      setStatus(readUploadStatus());
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    const expectedDigest = researchConfig.pinSha256;
    if (!expectedDigest) return;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
    const matches = equalDigest(toHex(digest), expectedDigest);
    setPin('');
    setPinError(!matches);
    if (matches) setUnlocked(true);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      const blob = await exportLocalRecoveryBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `questiontrace-recovery-${studyContextService.getRequired().userId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  const lastUpload = status.lastSuccessfulUploadAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' })
      .format(new Date(status.lastSuccessfulUploadAt))
    : t('researchDiagnostics.neverUploaded');

  return (
    <main style={{ minHeight: '100vh', padding: 'calc(var(--safe-area-top) + 32px) 20px 32px', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
      <div style={{ width: '100%', maxWidth: '448px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>{t('researchDiagnostics.title')}</h1>

        {!unlocked ? (
          <Card>
            <form onSubmit={(event) => void handleUnlock(event)}>
              <label htmlFor="research-pin" style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>
                {t('researchDiagnostics.pinLabel')}
              </label>
              <input
                id="research-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                disabled={!researchConfig.pinSha256}
                onChange={(event) => {
                  setPin(event.target.value);
                  setPinError(false);
                }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)', marginBottom: '12px' }}
              />
              {!researchConfig.pinSha256 && (
                <p role="alert" style={{ color: 'var(--danger)', marginBottom: '12px' }}>{t('researchDiagnostics.notConfigured')}</p>
              )}
              {pinError && (
                <p role="alert" style={{ color: 'var(--danger)', marginBottom: '12px' }}>{t('researchDiagnostics.invalidPin')}</p>
              )}
              <Button type="submit" fullWidth disabled={!pin || !researchConfig.pinSha256}>
                <LockKeyhole size={18} aria-hidden="true" />
                {t('researchDiagnostics.unlock')}
              </Button>
            </form>
          </Card>
        ) : (
          <Card>
            <dl style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                <dt>{t('researchDiagnostics.pendingUploads')}</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{status.pending}</dd>
              </div>
              <div style={{ padding: '14px 0 20px' }}>
                <dt style={{ marginBottom: '4px' }}>{t('researchDiagnostics.lastUpload')}</dt>
                <dd style={{ margin: 0, color: 'var(--muted-foreground)' }}>{lastUpload}</dd>
              </div>
            </dl>
            <Button type="button" fullWidth loading={exporting} onClick={() => void handleExport()}>
              <Download size={18} aria-hidden="true" />
              {t('researchDiagnostics.downloadRecovery')}
            </Button>
            {exportError && (
              <p role="alert" style={{ color: 'var(--danger)', marginTop: '12px' }}>{t('researchDiagnostics.exportFailed')}</p>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
