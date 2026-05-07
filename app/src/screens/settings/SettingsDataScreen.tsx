import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Shield, Trash2, BarChart3, Download, Upload, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { settingsService, FEED_DEFAULTS } from '../../services/settings.service';
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
      setTimeout(() => window.location.assign('/home'), 800);
    });
  };

  // Phase 36 GAP-D Fix B (dev-only): roll the post-queue date back to yesterday
  // so the next /home mount runs the cold-start warm-start path. Lets us verify
  // the warm-start guard (Plan 36-06) + durable yesterday snapshot (Plan 36-09)
  // without waiting for an actual midnight rollover.
  // See .planning/debug/cold-start-warm-start-fragile.md for full context.
  const handleForceNewDay = () => {
    try {
      const raw = localStorage.getItem('echolearn_post_queue');
      if (!raw) {
        toast('No post queue to roll back. Generate some posts first.', 'info');
        return;
      }
      const parsed = JSON.parse(raw);
      // Set date to yesterday so the next loadQueue() detects the mismatch
      // and (a) snapshots the current payload to STORAGE_KEY_YESTERDAY
      // (Plan 36-09); (b) rehydrates _state.posts from parsed.posts
      // (Plan 36-11) so yesterday's UNSERVED queue auto-populates today's
      // feed. See round-3 sub-issue (b cause #1) and Plan 36-11.
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      parsed.date = yesterday;
      localStorage.setItem('echolearn_post_queue', JSON.stringify(parsed));
      postQueueService.loadQueue();
      // Phase 36-15 (round-4 sub-issue b storage): also mutate the served-
      // posts cache key. Plan 36-11's loadCache() rejection fires only when
      // `parsed.date !== today()` — but the dev button cannot advance the
      // wall clock. So `today()` returns real-today before AND after this
      // handler runs; if we leave the served-posts cache untouched, it
      // still equals today(), loadCache() returns truthy, getDailyPosts()
      // hits its cache-hit branch (concept-feed.service.ts ~1530), and
      // dequeue()-of-rehydrated-state never runs. The rehydrated _state.posts
      // from Plan 36-11 sits unreachable. Mirror the same date mutation here
      // so loadCache()'s rejection fires symmetrically — same logic as the
      // queue mutation above, applied to the second date-stamped cache key.
      // This is the wall-clock-asymmetry pattern: services that gate self-
      // reset on today() comparisons cannot fire when the dev button doesn't
      // (and shouldn't) advance the clock — the handler must mimic each
      // mutation that natural midnight rollover would have triggered.
      // Plan 36-13 reverted this mutation calling it a "redundant dual-
      // cache hack"; round-4 UAT proved the reversion broke sub-issue (b).
      // Plan 36-14 owns the runtime consequence (HomeScreen falls back to
      // postQueueService.getYesterdayQueue() when getCachedDailyPosts()
      // returns []) — without that re-fallback effect, this storage
      // mutation alone produces an empty feed. The two plans are
      // complementary, not duplicative.
      // See .planning/debug/feed-not-auto-populating-after-force-new-day.md.
      const dailyRaw = localStorage.getItem('echolearn_daily_posts');
      if (dailyRaw) {
        try {
          const dailyParsed = JSON.parse(dailyRaw);
          dailyParsed.date = yesterday;
          localStorage.setItem('echolearn_daily_posts', JSON.stringify(dailyParsed));
        } catch {
          // Malformed cache — leave it; loadCache() will reject on parse failure anyway.
        }
      }
      // Reset vine progress (echolearn_daily_read). On a real midnight,
      // dailyReadService.loadState() self-resets via the parsed.date !==
      // today() check, but the dev button cannot advance today() — so the
      // service still sees parsed.date === today() (real today) and never
      // resets. Manually mimic the midnight reset here. See round-3
      // sub-issue (a) and daily-read.service.ts:36.
      dailyReadService.reset();
      toast('Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.', 'success');
      navigate('/home');
    } catch (err) {
      console.warn('[SettingsDataScreen] force-new-day failed:', err);
      toast('Force new day failed. Check console.', 'error');
    }
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
        {/* Strings hardcoded English: this button is gated by import.meta.env.DEV
            and never reaches production users, so the i18n workflow's "all 4 bundles
            per UI string" rule does NOT apply. See CLAUDE.md i18n workflow exemption
            reasoning. */}
        {import.meta.env.DEV && (
          <SettingRow
            label="Force new day (dev)"
            description="Sets the post queue date to yesterday and reloads, so the next /home mount runs the cold-start warm-start path. Dev builds only — never visible in production. See .planning/debug/cold-start-warm-start-fragile.md for context."
          >
            <Button variant="secondary" size="sm" onClick={handleForceNewDay}>
              Roll back date
            </Button>
          </SettingRow>
        )}
        <SettingRow label={t('settings.fields.postRetention')}>
          <SelectInput
            value={settings.feed?.postRetentionDays === null ? 'all' : String(settings.feed?.postRetentionDays ?? FEED_DEFAULTS.postRetentionDays)}
            options={[
              { value: '7', label: t('settings.fields.postRetention7d') },
              { value: 'all', label: t('settings.fields.postRetentionAll') },
            ]}
            onChange={(v) => {
              const feed = { ...settings.feed, postRetentionDays: v === 'all' ? null : FEED_DEFAULTS.postRetentionDays };
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
            value={String(settings.feed?.dailyGenerationCapMultiplier ?? FEED_DEFAULTS.dailyGenerationCapMultiplier)}
            type="number"
            onChange={(v) => {
              const feed = { ...settings.feed, dailyGenerationCapMultiplier: Math.max(1, parseInt(v) || FEED_DEFAULTS.dailyGenerationCapMultiplier) };
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
            value={String(settings.feed?.bonusPostCap ?? FEED_DEFAULTS.bonusPostCap)}
            type="number"
            onChange={(v) => {
              const feed = { ...settings.feed, bonusPostCap: Math.max(1, parseInt(v) || FEED_DEFAULTS.bonusPostCap) };
              settingsService.set('feed', feed as typeof settings.feed);
              setSettings((s) => ({ ...s, feed: feed as typeof s.feed }));
            }}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.sendFeedback')}>
          <a
            href="mailto:huanfuli4408@gmail.com?subject=Trellis%20Feedback"
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
              toast(t('settings.toast.todayReset'), 'success');
              setTimeout(() => window.location.reload(), 600);
            }}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <RotateCcw size={16} /> {t('settings.buttons.resetToday')}
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
