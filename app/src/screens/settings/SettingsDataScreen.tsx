import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Shield, Trash2, BarChart3, Download, Upload, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { settingsService } from '../../services/settings.service';
import { toast } from '../../lib/toast';
import { tokenUsageReporter, type ServiceAggregate } from '../../services/token-usage.service';
import { getRateLimitStatus } from '../../services/ask-rate-limiter.service';
import { imageGenerationService } from '../../services/imageGeneration.service';
import { conceptFeedService } from '../../services/concept-feed.service';
import { clearAllTables } from '../../services/db.service';
import { dailyReadService } from '../../services/daily-read.service';
import { postQueueService } from '../../services/post-queue.service';
import { SectionHeader, SettingRow, MaterialSwitch, SelectInput, TextInput, SUB_SCREEN_STYLE } from './SettingsShared';

export function SettingsDataScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(() => settingsService.getSync());
  const [aiConsent, setAiConsent] = useState(() => settingsService.getSync().preferences.aiConsentGiven ?? false);
  const [tokenUsage, setTokenUsage] = useState<Record<string, ServiceAggregate>>(() => tokenUsageReporter.getByService());
  const [askMonthlyLimit, setAskMonthlyLimit] = useState<number>(() => settingsService.getSync().preferences.askMonthlyLimit ?? 0);
  const rateLimitStatus = getRateLimitStatus(askMonthlyLimit);

  // Used as a dummy state to force re-render for trellis dev mode switch
  const [, setReviewNotif] = useState(() => settingsService.getSync().review.notificationsEnabled);

  const [trellisDevMode, setTrellisDevMode] = useState(() => localStorage.getItem('trellis_dev_mode') === 'true');

  const handleToggleAiConsent = async () => {
    const prefs = settingsService.getSync().preferences;
    const next = !aiConsent;
    await settingsService.set('preferences', { ...prefs, aiConsentGiven: next });
    setAiConsent(next);
    toast(next ? t('settings.toast.aiConsentOn') : t('settings.toast.aiConsentOff'), 'success');
  };

  const handleDeleteApiKeys = async () => {
    if (!confirm(t('settings.confirm.deleteApiKeys'))) return;
    const s = settingsService.getSync();
    const noKeyRequired = (p: string) => p === 'local' || p === 'lmstudio';
    await settingsService.set('llm', { ...s.llm, apiKey: '', isConfigured: noKeyRequired(s.llm.provider) });
    await settingsService.set('tts', { ...s.tts, apiKey: '', isConfigured: s.tts.provider === 'gptsovits' ? !!s.tts.baseUrl : false });
    toast(t('settings.toast.apiKeysDeleted'), 'success');
  };

  const handleClearAllData = () => {
    if (!confirm(t('settings.confirm.clearAllData'))) return;
    // Clear all echolearn_ keys from localStorage (except settings)
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('echolearn_') && k !== 'echolearn_settings');
    for (const k of keys) localStorage.removeItem(k);
    // Explicitly set an empty array so flashcardService doesn't auto-re-seed on next load
    localStorage.setItem('echolearn_flashcards', '[]');
    // Clear sessionStorage (connection post cache, etc.)
    const sessionKeys = Object.keys(sessionStorage).filter((k) => k.startsWith('echolearn_'));
    for (const k of sessionKeys) sessionStorage.removeItem(k);
    // Clear the concept feed post cache
    conceptFeedService.clearCache();
    // Clear cached images from IndexedDB
    void imageGenerationService.clearImageCache();
    // Clear SQLite tables (Android native) — fire-and-forget before reload
    void clearAllTables().finally(() => {
      toast(t('settings.toast.dataCleared'), 'success');
      setTimeout(() => window.location.reload(), 800);
    });
  };

  const refreshTokenUsage = () => setTokenUsage(tokenUsageReporter.getByService());

  const handleClearTokenUsage = () => {
    tokenUsageReporter.clear();
    setTokenUsage({});
    toast(t('settings.toast.tokenUsageCleared'), 'success');
  };

  const handleAskLimitChange = (value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setAskMonthlyLimit(num);
    const current = settingsService.getSync();
    settingsService.set('preferences', { ...current.preferences, askMonthlyLimit: num });
  };

  const handleReset = async () => {
    if (confirm(t('settings.confirm.reset'))) {
      await settingsService.reset();
      toast(t('settings.toast.settingsReset'), 'success');
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <div style={SUB_SCREEN_STYLE}>
      <Header title={t('settings.titles.dataPrivacy')} backTo="/settings" />

      {/* Privacy & Data Section */}
      <SectionHeader icon={<Shield size={20} />} title={t('settings.sections.privacy')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.privacyBlurb')}
        </p>
        <SettingRow
          label={t('settings.fields.aiDataTransmission')}
          description={t('settings.descriptions.aiConsentHint')}
        >
          <MaterialSwitch checked={aiConsent} onChange={() => void handleToggleAiConsent()} />
        </SettingRow>
        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => toast(t('settings.toast.exporting'), 'info')} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Download size={16} /> {t('settings.buttons.exportData')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toast(t('settings.toast.importing'), 'info')} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Upload size={16} /> {t('settings.buttons.importData')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => void handleDeleteApiKeys()}>
            {t('settings.buttons.deleteApiKeys')}
          </Button>
        </div>
      </Card>

      {/* Developer / Debug */}
      <SectionHeader icon={<Trash2 size={20} />} title={t('settings.sections.developer')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
          {t('settings.descriptions.developerBlurb')}
        </p>
        <SettingRow label={t('settings.fields.trellisDevMode')}>
          <MaterialSwitch
            checked={trellisDevMode}
            onChange={() => {
              const next = !trellisDevMode;
              localStorage.setItem('trellis_dev_mode', String(next));
              setTrellisDevMode(next);
              toast(next ? t('settings.toast.trellisDevOn') : t('settings.toast.trellisDevOff'));
              // Force re-render so the switch updates
              setReviewNotif((v) => { setTimeout(() => setReviewNotif(v), 0); return !v; });
            }}
          />
        </SettingRow>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '-8px', marginBottom: '16px', lineHeight: 1.4 }}>
          {t('settings.descriptions.trellisDevModeHint')}
        </p>
        <SettingRow label={t('settings.fields.postRetention')}>
          <SelectInput
            value={settings.feed?.postRetentionDays === null ? 'all' : '7'}
            options={[
              { value: '7', label: t('settings.fields.postRetention7d') },
              { value: 'all', label: t('settings.fields.postRetentionAll') },
            ]}
            onChange={(v) => {
              const feed = { ...settings.feed, postRetentionDays: v === 'all' ? null : 7 };
              settingsService.set('feed', feed as typeof settings.feed);
              setSettings((s) => ({ ...s, feed: feed as typeof s.feed }));
            }}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.fields.generationCap')}
          description={t('settings.descriptions.generationCap')}
        >
          <TextInput
            value={String(settings.feed?.dailyGenerationCapMultiplier ?? 5)}
            type="number"
            onChange={(v) => {
              const feed = { ...settings.feed, dailyGenerationCapMultiplier: Math.max(1, parseInt(v) || 5) };
              settingsService.set('feed', feed as typeof settings.feed);
              setSettings((s) => ({ ...s, feed: feed as typeof s.feed }));
            }}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.fields.bonusCap')}
          description={t('settings.descriptions.bonusCap')}
        >
          <TextInput
            value={String(settings.feed?.bonusPostCap ?? 8)}
            type="number"
            onChange={(v) => {
              const feed = { ...settings.feed, bonusPostCap: Math.max(1, parseInt(v) || 8) };
              settingsService.set('feed', feed as typeof settings.feed);
              setSettings((s) => ({ ...s, feed: feed as typeof s.feed }));
            }}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.sendFeedback')}>
          <a
            href="mailto:huanfuli4408@gmail.com?subject=EchoLearn%20Feed%20Feedback"
            style={{ color: 'var(--primary-40)', fontSize: '14px', textDecoration: 'underline' }}
          >
            {t('settings.fields.sendFeedback')}
          </a>
        </SettingRow>
        <SettingRow label={t('home.history.title')}>
          <button
            onClick={() => navigate('/history')}
            style={{ color: 'var(--primary-40)', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('home.history.title')}
          </button>
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAllData}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <Trash2 size={16} /> {t('settings.buttons.clearAllData')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              dailyReadService.reset();
              postQueueService.resetForNewDay();
              toast('Today\'s review/post status reset', 'success');
              setTimeout(() => window.location.reload(), 600);
            }}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <RotateCcw size={16} /> Reset Today
          </Button>
        </div>
      </Card>

      {/* Usage */}
      <SectionHeader icon={<BarChart3 size={20} />} title={t('settings.sections.usage')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.usageBlurb')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px', background: 'var(--surface-variant)', borderRadius: 'var(--radius-xl)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('settings.usageTable.monthlyLimit')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>
              {askMonthlyLimit === 0
                ? t('settings.usageTable.unlimited')
                : t('settings.usageTable.usedThisMonth', { count: rateLimitStatus.count, limit: askMonthlyLimit })}
            </div>
            {askMonthlyLimit > 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                {t('settings.usageTable.resets', { date: rateLimitStatus.resetDate })}
              </div>
            )}
          </div>
          <input
            type="number"
            min="0"
            value={askMonthlyLimit}
            onChange={(e) => handleAskLimitChange(e.target.value)}
            style={{
              width: '80px', padding: '6px 8px', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontSize: '0.85rem', textAlign: 'center',
            }}
            placeholder={t('settings.placeholders.askLimit')}
          />
        </div>
        {Object.keys(tokenUsage).length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>{t('settings.usageTable.empty')}</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>{t('settings.usageTable.service')}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{t('settings.usageTable.prompt')}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{t('settings.usageTable.completion')}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{t('settings.usageTable.total')}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>{t('settings.usageTable.calls')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tokenUsage)
                    .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
                    .map(([service, agg]) => (
                      <tr key={service} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 500, textTransform: 'capitalize' }}>{service}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{agg.promptTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{agg.completionTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{agg.totalTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{agg.callCount}</td>
                      </tr>
                    ))}
                  {/* Totals row */}
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                    <td style={{ padding: '6px 8px' }}>{t('settings.usageTable.totalRow')}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Object.values(tokenUsage).reduce((s, a) => s + a.promptTokens, 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Object.values(tokenUsage).reduce((s, a) => s + a.completionTokens, 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Object.values(tokenUsage).reduce((s, a) => s + a.totalTokens, 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Object.values(tokenUsage).reduce((s, a) => s + a.callCount, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <Button size="sm" variant="secondary" onClick={refreshTokenUsage}>{t('settings.buttons.refresh')}</Button>
          <Button size="sm" variant="danger" onClick={handleClearTokenUsage}>{t('settings.buttons.clear')}</Button>
        </div>
      </Card>

      {/* Reset & About */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
          {t('settings.about.version')}
        </p>
        <button
          onClick={() => toast(t('settings.about.licenseSoon'), 'info')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-40)', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '24px' }}
        >
          {t('settings.buttons.viewLicenses')}
        </button>
        <br />
        <Button variant="danger" size="sm" onClick={() => void handleReset()} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={16} /> {t('settings.buttons.reset')}
        </Button>
      </div>
    </div>
  );
}
