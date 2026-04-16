import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Volume2, Network, Radio, BookOpen, Palette, RotateCcw, CheckCircle, XCircle, Shield, Download, Upload, Trash2, Sparkles, Loader2, Image, CalendarClock, BarChart3, Youtube, Globe } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../locales';
import type { SupportedLocale } from '../types';
import { eventBus } from '../lib/event-bus';
import { tokenUsageReporter, type ServiceAggregate } from '../services/token-usage.service';
import { getRateLimitStatus } from '../services/ask-rate-limiter.service';
import { plannerAutoGenService } from '../services/plannerAutoGen.service';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { settingsService } from '../services/settings.service';
import { testLLMConnection } from '../providers/llm';
import { testTTSConnection } from '../providers/tts';
import type { LLMConfig, TTSConfig, EmbeddingConfig, EmbeddingDebugConfig, AppSettings, ImageGenerationSettings, ImageProviderPrimary } from '../types';
import { imageGenerationService } from '../services/imageGeneration.service';
import { bootstrapImageGeneration } from '../services/imageGeneration.bootstrap';
import { NanoBananaProvider } from '../providers/nanoBanana.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { applyTheme } from '../lib/theme';
import { clearAllTables } from '../services/db.service';
import { conceptFeedService } from '../services/concept-feed.service';
import { plannerService } from '../services/planner.service';
import { scheduleNativeNotifications } from '../services/scheduler.native';
import { questionService } from '../services/question.service';
import { embedText } from '../providers/embedding';

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '24px' }}>
      <div style={{ color: 'var(--primary-40)' }}>{icon}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
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

function MaterialSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
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

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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

function TextInput({ value, onChange, onBlur, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-variant)',
        color: 'var(--foreground)',
        fontSize: '0.875rem',
        width: type === 'time' ? '120px' : '160px',
      }}
    />
  );
}

export function SettingsScreen() {
  const { t, i18n: i18nInstance } = useTranslation();

  // Locale switcher (D-19) — local state reflects current i18n.language so the
  // select box stays in sync after handleLocaleChange. NOTE: we read + write
  // preferences via settingsService directly (rather than the useSettings hook)
  // because every other row in this screen already uses settingsService.getSync
  // + settingsService.set for its own state; introducing the hook here would
  // create two parallel sources of truth for the settings snapshot. Documented
  // deviation — see SUMMARY.
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    const cur = i18nInstance.language;
    return (SUPPORTED_LOCALES as readonly string[]).includes(cur)
      ? (cur as SupportedLocale)
      : 'en';
  });

  const handleLocaleChange = async (next: SupportedLocale) => {
    await i18nInstance.changeLanguage(next);
    const prefs = settingsService.getSync().preferences;
    await settingsService.set('preferences', { ...prefs, locale: next, language: next });
    eventBus.emit({ type: 'LOCALE_CHANGED', payload: { locale: next } });
    setLocale(next);
  };

  const [testResult, setTestResult] = useState<Record<string, string | null>>({});
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});

  const [llm, setLlm] = useState<LLMConfig>(() => settingsService.getSync().llm);
  const [tts, setTts] = useState<TTSConfig>(() => settingsService.getSync().tts);
  const [embedding, setEmbedding] = useState<EmbeddingConfig>(() => settingsService.getSync().embedding);
  const [embeddingDebug, setEmbeddingDebug] = useState<EmbeddingDebugConfig>(() => settingsService.getSync().embeddingDebug);
  const [ztNetworkId, setZtNetworkId] = useState(() => settingsService.getSync().zerotier.networkId ?? '');
  const [podcastAutoGenerate, setPodcastAutoGenerate] = useState(() => settingsService.getSync().podcast.autoGenerate);
  const [podcastSleepTime, setPodcastSleepTime] = useState(() => settingsService.getSync().podcast.sleepTime);
  const [podcastAdvance, setPodcastAdvance] = useState(() => String(settingsService.getSync().podcast.advanceMinutes));
  const [reviewLimit, setReviewLimit] = useState(() => String(settingsService.getSync().review.dailyLimit));
  const [reviewNotif, setReviewNotif] = useState(() => settingsService.getSync().review.notificationsEnabled);
  const [reviewReminderTime, setReviewReminderTime] = useState(() => settingsService.getSync().review.reminderTime);
  const [plannerRefreshEnabled, setPlannerRefreshEnabled] = useState(() => {
    const stored = localStorage.getItem('echolearn_planner_refresh_enabled');
    return stored !== null ? stored === 'true' : true;
  });
  const [plannerRefreshTime, setPlannerRefreshTime] = useState(() => {
    return localStorage.getItem('echolearn_planner_refresh_time') ?? '08:00';
  });
  const [isRefreshingPlanner, setIsRefreshingPlanner] = useState(false);
  const [theme, setTheme] = useState<AppSettings['preferences']['theme']>(() => settingsService.getSync().preferences.theme);
  const [aiConsent, setAiConsent] = useState(() => settingsService.getSync().preferences.aiConsentGiven ?? false);

  // YouTube settings
  const [youtubeApiKey, setYoutubeApiKey] = useState(() => settingsService.getSync().youtube?.apiKey ?? '');

  // Web Search settings
  const [tavilyApiKey, setTavilyApiKey] = useState(() => settingsService.getSync().webSearch?.tavilyApiKey ?? '');

  // Image generation settings
  const [imageGen, setImageGen] = useState<ImageGenerationSettings>(() => settingsService.getSync().imageGeneration);
  const [cacheStats, setCacheStats] = useState(() => imageGenerationService.getCacheStats());
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<Record<string, ServiceAggregate>>(() => tokenUsageReporter.getByService());
  const [askMonthlyLimit, setAskMonthlyLimit] = useState<number>(settingsService.getSync().preferences.askMonthlyLimit ?? 0);
  const rateLimitStatus = getRateLimitStatus(askMonthlyLimit);

  const noKeyRequired = (p: LLMConfig['provider']) => p === 'local' || p === 'lmstudio';

  const saveLlm = (current: LLMConfig = llm) => {
    settingsService.set('llm', { ...current, isConfigured: !!current.apiKey || noKeyRequired(current.provider) });
    // Keep TTS isConfigured in sync: OpenAI TTS reuses the LLM key as a fallback
    if (tts.provider === 'openai') {
      const effectiveKey = tts.apiKey || (current.apiKey ?? '');
      settingsService.set('tts', { ...tts, isConfigured: !!effectiveKey });
    }
  };

  // The effective TTS API key: use the dedicated TTS key if set, otherwise fall back
  // to the LLM key when both provider is OpenAI (they share the same credentials).
  const effectiveTtsApiKey = tts.apiKey || (tts.provider === 'openai' ? (llm.apiKey ?? '') : '');

  const saveEmbedding = (current: EmbeddingConfig = embedding) => {
    const isConfigured =
      current.provider === 'local' || current.provider === 'lmstudio' ? !!current.baseUrl :
        !!current.apiKey;
    settingsService.set('embedding', { ...current, isConfigured });
  };

  const saveEmbeddingDebug = (current: EmbeddingDebugConfig = embeddingDebug) => {
    settingsService.set('embeddingDebug', current);
  };

  const saveTts = (current: TTSConfig = tts) => {
    const fallbackKey = current.provider === 'openai' ? (llm.apiKey ?? '') : '';
    const effectiveKey = current.apiKey || fallbackKey;
    const isConfigured =
      current.provider === 'openai' ? !!effectiveKey :
        current.provider === 'gptsovits' ? !!current.baseUrl :
          false;
    settingsService.set('tts', { ...current, isConfigured });
  };

  const handleTestLLM = async () => {
    setIsTesting((prev) => ({ ...prev, llm: true }));
    setTestResult((prev) => ({ ...prev, llm: null }));
    const config = { ...llm, isConfigured: !!llm.apiKey || noKeyRequired(llm.provider) };
    const result = await testLLMConnection(config);
    setIsTesting((prev) => ({ ...prev, llm: false }));
    setTestResult((prev) => ({
      ...prev,
      llm: result.ok ? `✓ ${result.latencyMs}ms` : `✗ ${result.error ?? t('settings.test.defaultFailed')}`,
    }));
    setTimeout(() => setTestResult((prev) => ({ ...prev, llm: null })), 5000);
  };

  const handleTestEmbedding = async () => {
    setIsTesting((prev) => ({ ...prev, embedding: true }));
    setTestResult((prev) => ({ ...prev, embedding: null }));
    const config: EmbeddingConfig = {
      ...embedding,
      isConfigured: embedding.provider === 'local' || embedding.provider === 'lmstudio' ? !!embedding.baseUrl : !!embedding.apiKey,
    };
    const start = Date.now();
    try {
      const vec = await embedText('test', config);
      const latencyMs = Date.now() - start;
      setTestResult((prev) => ({
        ...prev,
        embedding: Array.isArray(vec) && vec.length > 0 ? `✓ ${latencyMs}ms (${vec.length}d)` : t('settings.test.emptyVector'),
      }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        embedding: `✗ ${err instanceof Error ? err.message : t('settings.test.defaultFailed')}`,
      }));
    } finally {
      setIsTesting((prev) => ({ ...prev, embedding: false }));
      setTimeout(() => setTestResult((prev) => ({ ...prev, embedding: null })), 5000);
    }
  };

  const handleTestTTS = async () => {
    setIsTesting((prev) => ({ ...prev, tts: true }));
    setTestResult((prev) => ({ ...prev, tts: null }));
    // Use fallback key so the test works even when TTS key field is empty
    const config = {
      ...tts,
      apiKey: effectiveTtsApiKey,
      isConfigured: tts.provider === 'openai' ? !!effectiveTtsApiKey : !!tts.baseUrl,
    };
    const result = await testTTSConnection(config);
    setIsTesting((prev) => ({ ...prev, tts: false }));
    setTestResult((prev) => ({
      ...prev,
      tts: result.ok ? `✓ ${result.latencyMs}ms` : `✗ ${result.error ?? t('settings.test.defaultFailed')}`,
    }));
    setTimeout(() => setTestResult((prev) => ({ ...prev, tts: null })), 5000);
  };

  const handleToggleAiConsent = async () => {
    const prefs = settingsService.getSync().preferences;
    const next = !aiConsent;
    await settingsService.set('preferences', { ...prefs, aiConsentGiven: next });
    setAiConsent(next);
    toast(next ? t('settings.toast.aiConsentOn') : t('settings.toast.aiConsentOff'), 'success');
  };

  const handleDeleteApiKeys = async () => {
    if (!confirm(t('settings.confirm.deleteApiKeys'))) return;
    const nextLlm = { ...llm, apiKey: '', isConfigured: noKeyRequired(llm.provider) };
    const nextTts = { ...tts, apiKey: '', isConfigured: tts.provider === 'gptsovits' ? !!tts.baseUrl : false };
    await settingsService.set('llm', nextLlm);
    await settingsService.set('tts', nextTts);
    setLlm(nextLlm);
    setTts(nextTts);
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

  const savePlannerRefreshEnabled = (value: boolean) => {
    setPlannerRefreshEnabled(value);
    localStorage.setItem('echolearn_planner_refresh_enabled', String(value));
  };
  const savePlannerRefreshTime = (value: string) => {
    setPlannerRefreshTime(value);
    localStorage.setItem('echolearn_planner_refresh_time', value);
  };

  const handleReset = async () => {
    if (confirm(t('settings.confirm.reset'))) {
      await settingsService.reset();
      const s = settingsService.getSync();
      setLlm(s.llm);
      setTts(s.tts);
      setEmbedding(s.embedding);
      setEmbeddingDebug(s.embeddingDebug);
      setZtNetworkId(s.zerotier.networkId ?? '');
      setPodcastAutoGenerate(s.podcast.autoGenerate);
      setPodcastSleepTime(s.podcast.sleepTime);
      setPodcastAdvance(String(s.podcast.advanceMinutes));
      setReviewLimit(String(s.review.dailyLimit));
      setReviewNotif(s.review.notificationsEnabled);
      setReviewReminderTime(s.review.reminderTime);
      setTheme(s.preferences.theme);
      applyTheme(s.preferences.theme);
    }
  };

  const saveImageGen = async (current: ImageGenerationSettings = imageGen) => {
    await settingsService.set('imageGeneration', current);
    // Re-bootstrap providers with new keys.
    bootstrapImageGeneration();
    toast(t('settings.toast.imageGenSaved'), 'success');
  };

  const handleAskLimitChange = (value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setAskMonthlyLimit(num);
    const current = settingsService.getSync();
    settingsService.set('preferences', { ...current.preferences, askMonthlyLimit: num });
  };

  const refreshTokenUsage = () => setTokenUsage(tokenUsageReporter.getByService());
  const handleClearTokenUsage = () => {
    tokenUsageReporter.clear();
    setTokenUsage({});
    toast(t('settings.toast.tokenUsageCleared'), 'success');
  };

  const handleClearImageCache = async () => {
    if (!confirm(t('settings.confirm.clearImageCache'))) return;
    setIsClearingCache(true);
    await imageGenerationService.clearImageCache();
    setCacheStats(imageGenerationService.getCacheStats());
    setIsClearingCache(false);
    toast(t('settings.toast.imageCacheCleared'), 'success');
  };

  const handleTestImageConnection = async () => {
    setIsTesting((prev) => ({ ...prev, imageGen: true }));
    setTestResult((prev) => ({ ...prev, imageGen: null }));

    const opts = { timeoutMs: 90_000, maxRetries: 1 };
    const results: string[] = [];

    if (imageGen.nanoBananaApiKey.trim()) {
      const nb = new NanoBananaProvider(imageGen.nanoBananaApiKey);
      const r = await nb.generate(t('settings.test.testPrompt'), 'photo', opts);
      results.push(r.success ? t('settings.test.nanoBananaOk') : t('settings.test.nanoBananaFail', { error: r.error?.message ?? t('settings.test.defaultFailed').toLowerCase() }));
    }

    if (imageGen.geminiApiKey.trim()) {
      const g = new GeminiProvider(imageGen.geminiApiKey);
      const r = await g.generate(t('settings.test.testPrompt'), 'photo', opts);
      results.push(r.success ? t('settings.test.geminiOk') : t('settings.test.geminiFail', { error: r.error?.message ?? t('settings.test.defaultFailed').toLowerCase() }));
    }

    if (results.length === 0) {
      setTestResult((prev) => ({ ...prev, imageGen: t('settings.test.noKeys') }));
    } else {
      const allOk = results.every((r) => r.includes('✓'));
      setTestResult((prev) => ({ ...prev, imageGen: (allOk ? '✓ ' : '✗ ') + results.join(' | ') }));
    }

    setIsTesting((prev) => ({ ...prev, imageGen: false }));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>
      <Header title={t('settings.title')} />

      {/* Locale Switcher (D-19) — Top of list so users stuck in an unreadable locale
          can still find it. Label is hardcoded in all 4 scripts (cross-locale affordance
          per D-18/D-19); description is translated. Per-option labels stay in their
          native scripts. */}
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow
          label="Language / 语言 / Idioma / 言語"
          description={t('settings.language.description')}
        >
          <SelectInput
            value={locale}
            onChange={(v) => void handleLocaleChange(v as SupportedLocale)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh', label: '简体中文' },
              { value: 'es', label: 'Español' },
              { value: 'ja', label: '日本語' },
            ]}
          />
        </SettingRow>
      </Card>

      {/* LLM Section */}
      <SectionHeader icon={<Brain size={20} />} title={t('settings.sections.languageModel')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.provider')}>
          <SelectInput
            value={llm.provider}
            onChange={(v) => {
              const p = v as LLMConfig['provider'];
              const defaults: Record<string, Partial<LLMConfig>> = {
                openai: { model: 'gpt-4o', baseUrl: '', apiKey: '' },
                claude: { model: 'claude-sonnet-4-6', baseUrl: '', apiKey: '' },
                gemini: { model: 'gemini-3.1-flash-image-preview', baseUrl: '', apiKey: '' },
                local: { model: 'llama3', baseUrl: 'http://localhost:11434/v1', apiKey: '' },
                lmstudio: { model: 'local-model', baseUrl: 'http://localhost:1234', apiKey: '' },
              };
              const next = { ...llm, provider: p, ...defaults[p] } as LLMConfig;
              setLlm(next);
              saveLlm(next);
            }}
            options={[
              { value: 'openai', label: t('settings.providerLabels.openai') },
              { value: 'claude', label: t('settings.providerLabels.claude') },
              { value: 'gemini', label: t('settings.providerLabels.gemini') },
              { value: 'lmstudio', label: t('settings.providerLabels.lmstudio') },
              { value: 'local', label: t('settings.providerLabels.localOllama') },
            ]}
          />
        </SettingRow>
        {!noKeyRequired(llm.provider) && (
          <SettingRow label={t('settings.fields.apiKey')}>
            <TextInput
              type="password"
              value={llm.apiKey ?? ''}
              onChange={(v) => setLlm((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveLlm()}
              placeholder={
                llm.provider === 'claude' ? t('settings.placeholders.claudeKey') :
                  llm.provider === 'gemini' ? t('settings.placeholders.geminiKey') :
                    t('settings.placeholders.apiKey')
              }
            />
          </SettingRow>
        )}
        {(llm.provider === 'local' || llm.provider === 'lmstudio') && (
          <SettingRow
            label={t('settings.fields.baseUrl')}
            description={llm.provider === 'lmstudio' ? t('settings.descriptions.lmStudioServer') : t('settings.descriptions.ollamaServer')}
          >
            <TextInput
              value={llm.baseUrl ?? ''}
              onChange={(v) => setLlm((prev) => ({ ...prev, baseUrl: v }))}
              onBlur={() => saveLlm()}
              placeholder={llm.provider === 'lmstudio' ? t('settings.placeholders.lmStudioUrl') : t('settings.placeholders.ollamaUrl')}
            />
          </SettingRow>
        )}
        <SettingRow label={t('settings.fields.model')}>
          <TextInput
            value={llm.model}
            onChange={(v) => setLlm((prev) => ({ ...prev, model: v }))}
            onBlur={() => saveLlm()}
            placeholder={
              llm.provider === 'gemini' ? 'gemini-3.1-flash-image-preview' :
                llm.provider === 'claude' ? 'claude-sonnet-4-6' :
                  llm.provider === 'lmstudio' ? 'local-model' :
                    'gpt-4o'
            }
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" onClick={() => { saveLlm(); toast(t('settings.toast.llmSaved'), 'success'); }} variant="secondary">{t('settings.buttons.save')}</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestLLM}
            loading={isTesting['llm']}
          >
            {t('settings.buttons.test')}
          </Button>
          {testResult['llm'] && (
            <span style={{
              fontSize: '0.8rem',
              color: testResult['llm'].startsWith('✓') ? 'var(--primary-40)' : 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {testResult['llm'].startsWith('✓')
                ? <CheckCircle size={16} />
                : <XCircle size={16} />}
              {testResult['llm']}
            </span>
          )}
        </div>
      </Card>

      {/* Embedding Model Section */}
      <SectionHeader icon={<Sparkles size={20} />} title={t('settings.sections.embeddingModel')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.embeddingBlurb')}
        </p>
        <SettingRow label={t('settings.fields.provider')}>
          <SelectInput
            value={embedding.provider}
            onChange={(v) => {
              const p = v as EmbeddingConfig['provider'];
              const defaults: Record<string, Partial<EmbeddingConfig>> = {
                openai:    { model: 'text-embedding-3-small', baseUrl: '', apiKey: '' },
                google:    { model: 'text-embedding-004', baseUrl: '', apiKey: '' },
                local:     { model: 'nomic-embed-text', baseUrl: 'http://localhost:11434', apiKey: '' },
                lmstudio:  { model: 'nomic-embed-text', baseUrl: 'http://localhost:1234', apiKey: '' },
              };
              const next = { ...embedding, provider: p, ...defaults[p] } as EmbeddingConfig;
              setEmbedding(next);
              saveEmbedding(next);
            }}
            options={[
              { value: 'openai',   label: t('settings.providerLabels.openai') },
              { value: 'google',   label: t('settings.providerLabels.google') },
              { value: 'local',    label: t('settings.providerLabels.localOllama') },
              { value: 'lmstudio', label: t('settings.providerLabels.lmstudio') },
            ]}
          />
        </SettingRow>
        {embedding.provider !== 'local' && embedding.provider !== 'lmstudio' && (
          <SettingRow label={t('settings.fields.apiKey')}>
            <TextInput
              type="password"
              value={embedding.apiKey ?? ''}
              onChange={(v) => setEmbedding((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveEmbedding()}
              placeholder={embedding.provider === 'google' ? t('settings.placeholders.geminiKey') : t('settings.placeholders.apiKey')}
            />
          </SettingRow>
        )}
        {(embedding.provider === 'local' || embedding.provider === 'lmstudio') && (
          <SettingRow
            label={t('settings.fields.baseUrl')}
            description={embedding.provider === 'lmstudio' ? t('settings.descriptions.lmStudioServer') : t('settings.descriptions.ollamaServer')}
          >
            <TextInput
              value={embedding.baseUrl ?? ''}
              onChange={(v) => setEmbedding((prev) => ({ ...prev, baseUrl: v }))}
              onBlur={() => saveEmbedding()}
              placeholder={embedding.provider === 'lmstudio' ? t('settings.placeholders.lmStudioUrl') : t('settings.placeholders.ollamaPlainUrl')}
            />
          </SettingRow>
        )}
        <SettingRow label={t('settings.fields.modelId')}>
          <TextInput
            value={embedding.model}
            onChange={(v) => setEmbedding((prev) => ({ ...prev, model: v }))}
            onBlur={() => saveEmbedding()}
            placeholder={
              embedding.provider === 'google'   ? 'text-embedding-004' :
              embedding.provider === 'local'    ? 'nomic-embed-text' :
              embedding.provider === 'lmstudio' ? 'nomic-embed-text' :
                'text-embedding-3-small'
            }
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.dimensions')} description={t('settings.descriptions.dimensionsOptional')}>
          <TextInput
            value={String(embedding.dimensions ?? '')}
            onChange={(v) => setEmbedding((prev) => ({ ...prev, dimensions: v ? parseInt(v) || undefined : undefined }))}
            onBlur={() => saveEmbedding()}
            placeholder={t('settings.placeholders.dimensions')}
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" variant="secondary" onClick={() => { saveEmbedding(); toast(t('settings.toast.embeddingSaved'), 'success'); }}>{t('settings.buttons.save')}</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestEmbedding}
            loading={isTesting['embedding']}
          >
            {t('settings.buttons.test')}
          </Button>
          {testResult['embedding'] && (
            <span style={{
              fontSize: '0.8rem',
              color: testResult['embedding'].startsWith('✓') ? 'var(--primary-40)' : 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {testResult['embedding'].startsWith('✓')
                ? <CheckCircle size={16} />
                : <XCircle size={16} />}
              {testResult['embedding']}
            </span>
          )}
        </div>

        {/* Developer debug subsection */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
            {t('settings.debug')}
          </p>
          <SettingRow
            label={t('settings.fields.similarityThreshold')}
            description={t('settings.descriptions.similarityThreshold', { score: embeddingDebug.similarityThreshold.toFixed(2) })}
          >
            <input
              type="range"
              min={0.40}
              max={0.95}
              step={0.05}
              value={embeddingDebug.similarityThreshold}
              onChange={(e) => {
                const next = { ...embeddingDebug, similarityThreshold: parseFloat(e.target.value) };
                setEmbeddingDebug(next);
                saveEmbeddingDebug(next);
              }}
              style={{ width: '120px', accentColor: 'var(--primary-40)', cursor: 'pointer' }}
            />
          </SettingRow>
          <SettingRow label={t('settings.fields.showSimilarityScores')} description={t('settings.descriptions.showScoresHint')}>
            <MaterialSwitch
              checked={embeddingDebug.showScores}
              onChange={() => {
                const next = { ...embeddingDebug, showScores: !embeddingDebug.showScores };
                setEmbeddingDebug(next);
                saveEmbeddingDebug(next);
              }}
            />
          </SettingRow>
        </div>
      </Card>

      {/* TTS Section */}
      <SectionHeader icon={<Volume2 size={20} />} title={t('settings.sections.tts')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.provider')}>
          <SelectInput
            value={tts.provider}
            onChange={(v) => {
              const p = v as TTSConfig['provider'];
              const next: TTSConfig = {
                ...tts,
                provider: p,
                apiKey: '',
                baseUrl: p === 'gptsovits' ? 'http://localhost:9880' : '',
              };
              setTts(next);
              saveTts(next);
            }}
            options={[
              { value: 'openai', label: t('settings.providerLabels.openaiTts') },
              { value: 'gptsovits', label: t('settings.providerLabels.gptsovits') },
            ]}
          />
        </SettingRow>
        {tts.provider === 'openai' && (
          <SettingRow
            label={t('settings.fields.apiKey')}
            description={!tts.apiKey && llm.apiKey ? t('settings.descriptions.ttsUsingLlmKey') : undefined}
          >
            <TextInput
              type="password"
              value={tts.apiKey ?? ''}
              onChange={(v) => setTts((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveTts()}
              placeholder={llm.apiKey ? t('settings.placeholders.openaiTtsFallback') : t('settings.placeholders.apiKey')}
            />
          </SettingRow>
        )}
        {tts.provider === 'gptsovits' && (
          <SettingRow label={t('settings.fields.serverUrl')} description={t('settings.descriptions.ttsServer')}>
            <TextInput
              value={tts.baseUrl ?? ''}
              onChange={(v) => setTts((prev) => ({ ...prev, baseUrl: v }))}
              onBlur={() => saveTts()}
              placeholder={t('settings.placeholders.gptsovitsUrl')}
            />
          </SettingRow>
        )}
        <SettingRow label={t('settings.fields.voice')}>
          <SelectInput
            value={tts.voice}
            onChange={(v) => {
              const next = { ...tts, voice: v };
              setTts(next);
              saveTts(next);
            }}
            options={[
              { value: 'alloy', label: t('settings.voices.alloy') },
              { value: 'nova', label: t('settings.voices.nova') },
              { value: 'shimmer', label: t('settings.voices.shimmer') },
              { value: 'echo', label: t('settings.voices.echo') },
            ]}
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" onClick={() => { saveTts(); toast(t('settings.toast.ttsSaved'), 'success'); }} variant="secondary">{t('settings.buttons.save')}</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestTTS}
            loading={isTesting['tts']}
          >
            {t('settings.buttons.test')}
          </Button>
          {testResult['tts'] && (
            <span style={{
              fontSize: '0.8rem',
              color: testResult['tts'].startsWith('✓') ? 'var(--primary-40)' : 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {testResult['tts'].startsWith('✓')
                ? <CheckCircle size={16} />
                : <XCircle size={16} />}
              {testResult['tts']}
            </span>
          )}
        </div>
      </Card>

      {/* ZeroTier Section — only relevant for local model providers */}
      {noKeyRequired(llm.provider) && (
        <>
          <SectionHeader icon={<Network size={20} />} title={t('settings.sections.zerotier')} />
          <Card style={{ marginBottom: '8px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
              {t('settings.descriptions.zerotierBlurb', { server: llm.provider === 'lmstudio' ? t('settings.descriptions.zerotierLmstudio') : t('settings.descriptions.zerotierOllama') })}
            </p>
            <SettingRow label={t('settings.fields.networkId')}>
              <TextInput
                value={ztNetworkId}
                onChange={setZtNetworkId}
                placeholder={t('settings.placeholders.ztNetworkId')}
              />
            </SettingRow>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
              <Button
                size="sm"
                onClick={async () => {
                  await settingsService.set('zerotier', { networkId: ztNetworkId, isConnected: false });
                  toast(t('settings.toast.zerotierSaved'), 'success');
                }}
                variant="secondary"
              >
                {t('settings.buttons.save')}
              </Button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                {settingsService.getSync().zerotier.isConnected ? t('settings.zerotier.connected') : t('settings.zerotier.disconnected')}
              </span>
            </div>
          </Card>
        </>
      )}

      {/* Image Generation Section */}
      <SectionHeader icon={<Image size={20} />} title={t('settings.sections.imageGeneration')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.imageGeneration')} description={t('settings.descriptions.imageGenToggle')}>
          <MaterialSwitch
            checked={imageGen.enabled ?? true}
            onChange={() => {
              const next = { ...imageGen, enabled: !(imageGen.enabled ?? true) };
              setImageGen(next);
              void saveImageGen(next);
            }}
          />
        </SettingRow>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.imageGenBlurb')}
        </p>
        <SettingRow label={t('settings.fields.primaryProvider')} description={t('settings.descriptions.imageGenPrimary')}>
          <SelectInput
            value={imageGen.primaryProvider ?? 'auto'}
            onChange={(v) => {
              const next = { ...imageGen, primaryProvider: v as ImageProviderPrimary };
              setImageGen(next);
              void saveImageGen(next);
            }}
            options={[
              { value: 'auto', label: t('settings.providerLabels.autoKeys') },
              { value: 'nanoBanana', label: t('settings.providerLabels.nanoBananaPrimary') },
              { value: 'gemini', label: t('settings.providerLabels.geminiProvider') },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.nanoBananaApiKey')} description={t('settings.descriptions.nanoBanana')}>
          <TextInput
            type="password"
            value={imageGen.nanoBananaApiKey}
            onChange={(v) => setImageGen((prev) => ({ ...prev, nanoBananaApiKey: v }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.nanoBananaKey')}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.geminiApiKey')} description={t('settings.descriptions.geminiFallback')}>
          <TextInput
            type="password"
            value={imageGen.geminiApiKey}
            onChange={(v) => setImageGen((prev) => ({ ...prev, geminiApiKey: v }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.geminiKey')}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.geminiModel')} description={t('settings.descriptions.geminiModelHint')}>
          <TextInput
            value={imageGen.geminiModel ?? 'gemini-3.1-flash-image-preview'}
            onChange={(v) => setImageGen((prev) => ({ ...prev, geminiModel: v }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.geminiModel')}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.cacheLimit')} description={t('settings.descriptions.cacheLimitHint')}>
          <TextInput
            value={String(imageGen.maxCacheSizeMb)}
            onChange={(v) => setImageGen((prev) => ({ ...prev, maxCacheSizeMb: parseInt(v) || 50 }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.maxCacheSize')}
          />
        </SettingRow>

        {/* Cache stats */}
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            {t('settings.cacheStats.title')}
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--foreground)', flexWrap: 'wrap' }}>
            <span>{t('settings.cacheStats.imagesCached', { count: cacheStats.itemCount })}</span>
            <span>{t('settings.cacheStats.used', { size: formatBytes(cacheStats.totalSizeBytes) })}</span>
            <span>{t('settings.cacheStats.limit', { mb: imageGen.maxCacheSizeMb })}</span>
          </div>
        </div>

        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void saveImageGen()}
          >
            {t('settings.buttons.save')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isTesting['imageGen'] || (!imageGen.nanoBananaApiKey.trim() && !imageGen.geminiApiKey.trim())}
            onClick={() => void handleTestImageConnection()}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isTesting['imageGen'] ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {t('settings.buttons.test')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={isClearingCache || cacheStats.itemCount === 0}
            onClick={() => void handleClearImageCache()}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isClearingCache ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {t('settings.buttons.clearCache')}
          </Button>
        </div>
        {testResult['imageGen'] && (
          <div style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            fontSize: '0.8rem',
            color: testResult['imageGen'].startsWith('✓') ? 'var(--primary-40)' : 'var(--danger)',
            lineHeight: 1.5,
          }}>
            {testResult['imageGen'].startsWith('✓') ? <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} /> : <XCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />}
            <span>{testResult['imageGen']}</span>
          </div>
        )}
      </Card>

      {/* YouTube Section */}
      <SectionHeader icon={<Youtube size={20} />} title={t('settings.sections.youtube')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.youtubeBlurb')}
        </p>
        <SettingRow label={t('settings.fields.apiKey')} description={t('settings.descriptions.youtubeApiKey')}>
          <TextInput
            type="password"
            value={youtubeApiKey}
            onChange={(v) => setYoutubeApiKey(v)}
            onBlur={() => void settingsService.set('youtube', { apiKey: youtubeApiKey })}
            placeholder={t('settings.descriptions.youtubeApiKey')}
          />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await settingsService.set('youtube', { apiKey: youtubeApiKey });
              toast(t('settings.toast.youtubeSaved'), 'success');
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Web Search Section */}
      <SectionHeader icon={<Globe size={20} />} title={t('settings.sections.webSearch')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.webSearchBlurb1')}{' '}
          <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-40)' }}>
            tavily.com
          </a>{' '}
          {t('settings.descriptions.webSearchBlurb2')}
        </p>
        <SettingRow label={t('settings.fields.apiKey')} description={t('settings.descriptions.tavilyApiKey')}>
          <TextInput
            type="password"
            value={tavilyApiKey}
            onChange={(v) => setTavilyApiKey(v)}
            onBlur={() => void settingsService.set('webSearch', { tavilyApiKey })}
            placeholder="tvly-..."
          />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await settingsService.set('webSearch', { tavilyApiKey });
              toast(t('settings.toast.webSearchSaved'), 'success');
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Podcast Settings */}
      <SectionHeader icon={<Radio size={20} />} title={t('settings.sections.podcast')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.autoGenerate')} description={t('settings.descriptions.podcastAutoGenerate')}>
          <MaterialSwitch
            checked={podcastAutoGenerate}
            onChange={() => setPodcastAutoGenerate((v) => !v)}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.sleepTime')} description={t('settings.descriptions.podcastSleepTime')}>
          <TextInput type="time" value={podcastSleepTime} onChange={setPodcastSleepTime} placeholder={t('settings.placeholders.sleepTime')} />
        </SettingRow>
        <SettingRow label={t('settings.fields.advanceMinutes')} description={t('settings.descriptions.podcastAdvance')}>
          <TextInput value={podcastAdvance} onChange={setPodcastAdvance} placeholder={t('settings.placeholders.advance')} />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const result = await settingsService.set('podcast', {
                autoGenerate: podcastAutoGenerate,
                sleepTime: podcastSleepTime,
                advanceMinutes: Number.isNaN(parseInt(podcastAdvance)) ? 60 : parseInt(podcastAdvance),
              });
              if (result.success) {
                toast(t('settings.toast.podcastSaved'), 'success');
                void scheduleNativeNotifications(); // Reschedule with new times
              } else {
                toast(result.error?.message || t('settings.toast.podcastSaveFailed'), 'error');
              }
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Review Settings */}
      <SectionHeader icon={<BookOpen size={20} />} title={t('settings.sections.review')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.notifications')}>
          <MaterialSwitch
            checked={reviewNotif}
            onChange={() => setReviewNotif((v) => !v)}
          />
        </SettingRow>
        {reviewNotif && (
          <SettingRow label={t('settings.fields.reminderTime')}>
            <TextInput type="time" value={reviewReminderTime} onChange={setReviewReminderTime} placeholder={t('settings.placeholders.reminder')} />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await settingsService.set('review', {
                dailyLimit: parseInt(reviewLimit) || 50,
                notificationsEnabled: reviewNotif,
                reminderTime: reviewReminderTime,
              });
              toast(t('settings.toast.reviewSaved'), 'success');
              void scheduleNativeNotifications(); // Reschedule with new times
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Planner Auto-Suggestions */}
      <SectionHeader icon={<CalendarClock size={20} />} title={t('settings.sections.planner')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.dailyAutoRefresh')} description={t('settings.descriptions.plannerAutoRefresh')}>
          <MaterialSwitch
            checked={plannerRefreshEnabled}
            onChange={() => savePlannerRefreshEnabled(!plannerRefreshEnabled)}
          />
        </SettingRow>
        {plannerRefreshEnabled && (
          <SettingRow label={t('settings.fields.preferredRefreshTime')} description={t('settings.descriptions.plannerRefreshTime')}>
            <TextInput type="time" value={plannerRefreshTime} onChange={savePlannerRefreshTime} placeholder={t('settings.placeholders.plannerRefresh')} />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            variant="secondary"
            disabled={isRefreshingPlanner}
            onClick={async () => {
              setIsRefreshingPlanner(true);
              try {
                const questions = questionService.getAll();
                if (questions.length > 0) {
                  const summaryLines = questions
                    .slice(0, 20)
                    .map((q) => q.summary || q.content)
                    .join('. ');
                  const checkInText = t('settings.planner.checkIn', { summary: summaryLines });
                  await plannerService.submitCheckIn(checkInText);
                }
                await plannerAutoGenService.generateAndStoreSuggestions(true);
                toast(t('settings.toast.plannerRefreshed'), 'success');
              } catch {
                toast(t('settings.toast.plannerRefreshFailed'), 'error');
              } finally {
                setIsRefreshingPlanner(false);
              }
            }}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isRefreshingPlanner
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <Sparkles size={16} />
            }
            {isRefreshingPlanner ? t('settings.buttons.generating') : t('settings.buttons.generatePlanner')}
          </Button>
        </div>
      </Card>

      {/* App Preferences */}
      <SectionHeader icon={<Palette size={20} />} title={t('settings.sections.appearance')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.theme')}>
          <SelectInput
            value={theme}
            onChange={async (v) => {
              const nextTheme = v as AppSettings['preferences']['theme'];
              setTheme(nextTheme);
              applyTheme(nextTheme);
              const prefs = settingsService.getSync().preferences;
              await settingsService.set('preferences', { ...prefs, theme: nextTheme });
            }}
            options={[
              { value: 'light', label: t('settings.themes.light') },
              { value: 'dark', label: t('settings.themes.dark') },
              { value: 'system', label: t('settings.themes.system') },
            ]}
          />
        </SettingRow>
      </Card>

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
            checked={localStorage.getItem('trellis_dev_mode') === 'true'}
            onChange={() => {
              const next = localStorage.getItem('trellis_dev_mode') === 'true' ? 'false' : 'true';
              localStorage.setItem('trellis_dev_mode', next);
              toast(next === 'true' ? t('settings.toast.trellisDevOn') : t('settings.toast.trellisDevOff'));
              // Force re-render so the switch updates
              setReviewNotif((v) => { setTimeout(() => setReviewNotif(v), 0); return !v; });
            }}
          />
        </SettingRow>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '-8px', marginBottom: '16px', lineHeight: 1.4 }}>
          {t('settings.descriptions.trellisDevModeHint')}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAllData}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <Trash2 size={16} /> {t('settings.buttons.clearAllData')}
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
        <Button variant="danger" size="sm" onClick={handleReset} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={16} /> {t('settings.buttons.reset')}
        </Button>
      </div>
    </div>
  );
}
