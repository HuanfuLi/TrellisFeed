import { useState } from 'react';
import { Brain, Volume2, Network, Radio, BookOpen, Palette, RotateCcw, CheckCircle, XCircle, Shield, Download, Upload, Trash2, Sparkles, Loader2, Image, CalendarClock, BarChart3, Youtube } from 'lucide-react';
import { tokenUsageReporter, type ServiceAggregate } from '../services/token-usage.service';
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

  // Image generation settings
  const [imageGen, setImageGen] = useState<ImageGenerationSettings>(() => settingsService.getSync().imageGeneration);
  const [cacheStats, setCacheStats] = useState(() => imageGenerationService.getCacheStats());
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<Record<string, ServiceAggregate>>(() => tokenUsageReporter.getByService());

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
      llm: result.ok ? `✓ ${result.latencyMs}ms` : `✗ ${result.error ?? 'Failed'}`,
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
        embedding: Array.isArray(vec) && vec.length > 0 ? `✓ ${latencyMs}ms (${vec.length}d)` : '✗ Empty vector returned',
      }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        embedding: `✗ ${err instanceof Error ? err.message : 'Failed'}`,
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
      tts: result.ok ? `✓ ${result.latencyMs}ms` : `✗ ${result.error ?? 'Failed'}`,
    }));
    setTimeout(() => setTestResult((prev) => ({ ...prev, tts: null })), 5000);
  };

  const handleToggleAiConsent = async () => {
    const prefs = settingsService.getSync().preferences;
    const next = !aiConsent;
    await settingsService.set('preferences', { ...prefs, aiConsentGiven: next });
    setAiConsent(next);
    toast(next ? 'AI transmission enabled.' : 'AI transmission disabled.', 'success');
  };

  const handleDeleteApiKeys = async () => {
    if (!confirm('Delete all stored API keys? This will disable AI and TTS features until you re-enter your keys.')) return;
    const nextLlm = { ...llm, apiKey: '', isConfigured: noKeyRequired(llm.provider) };
    const nextTts = { ...tts, apiKey: '', isConfigured: tts.provider === 'gptsovits' ? !!tts.baseUrl : false };
    await settingsService.set('llm', nextLlm);
    await settingsService.set('tts', nextTts);
    setLlm(nextLlm);
    setTts(nextTts);
    toast('All API keys deleted.', 'success');
  };

  const handleClearAllData = () => {
    if (!confirm('Delete ALL data?\n\nThis removes every question, flashcard, session, planner entry, and podcast. Settings are kept.\n\nThis cannot be undone.')) return;
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
      toast('All data cleared — reloading…', 'success');
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
    if (confirm('Reset all settings to defaults?')) {
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
    toast('Image generation settings saved.', 'success');
  };

  const refreshTokenUsage = () => setTokenUsage(tokenUsageReporter.getByService());
  const handleClearTokenUsage = () => {
    tokenUsageReporter.clear();
    setTokenUsage({});
    toast('Token usage data cleared.', 'success');
  };

  const handleClearImageCache = async () => {
    if (!confirm('Clear all cached post images? They will be regenerated on next view.')) return;
    setIsClearingCache(true);
    await imageGenerationService.clearImageCache();
    setCacheStats(imageGenerationService.getCacheStats());
    setIsClearingCache(false);
    toast('Image cache cleared.', 'success');
  };

  const handleTestImageConnection = async () => {
    setIsTesting((prev) => ({ ...prev, imageGen: true }));
    setTestResult((prev) => ({ ...prev, imageGen: null }));

    const opts = { timeoutMs: 90_000, maxRetries: 1 };
    const results: string[] = [];

    if (imageGen.nanoBananaApiKey.trim()) {
      const nb = new NanoBananaProvider(imageGen.nanoBananaApiKey);
      const r = await nb.generate('A small coloured circle on white background.', 'photo', opts);
      results.push(`NanoBanana: ${r.success ? '✓ OK' : (r.error?.message ?? 'failed')}`);
    }

    if (imageGen.geminiApiKey.trim()) {
      const g = new GeminiProvider(imageGen.geminiApiKey);
      const r = await g.generate('A small coloured circle on white background.', 'photo', opts);
      results.push(`Gemini: ${r.success ? '✓ OK' : (r.error?.message ?? 'failed')}`);
    }

    if (results.length === 0) {
      setTestResult((prev) => ({ ...prev, imageGen: '✗ No API keys configured' }));
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
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 96px`, maxWidth: '448px', margin: '0 auto' }}>
      <Header title="Settings" />

      {/* LLM Section */}
      <SectionHeader icon={<Brain size={20} />} title="Language Model" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Provider">
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
              { value: 'openai', label: 'OpenAI' },
              { value: 'claude', label: 'Claude' },
              { value: 'gemini', label: 'Gemini' },
              { value: 'lmstudio', label: 'LM Studio' },
              { value: 'local', label: 'Local (Ollama)' },
            ]}
          />
        </SettingRow>
        {!noKeyRequired(llm.provider) && (
          <SettingRow label="API Key">
            <TextInput
              type="password"
              value={llm.apiKey ?? ''}
              onChange={(v) => setLlm((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveLlm()}
              placeholder={
                llm.provider === 'claude' ? 'sk-ant-...' :
                  llm.provider === 'gemini' ? 'AIza...' :
                    'sk-...'
              }
            />
          </SettingRow>
        )}
        {(llm.provider === 'local' || llm.provider === 'lmstudio') && (
          <SettingRow
            label="Base URL"
            description={llm.provider === 'lmstudio' ? 'LM Studio server URL' : 'Ollama server URL'}
          >
            <TextInput
              value={llm.baseUrl ?? ''}
              onChange={(v) => setLlm((prev) => ({ ...prev, baseUrl: v }))}
              onBlur={() => saveLlm()}
              placeholder={llm.provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434/v1'}
            />
          </SettingRow>
        )}
        <SettingRow label="Model">
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
          <Button size="sm" onClick={() => { saveLlm(); toast('LLM settings saved.', 'success'); }} variant="secondary">Save</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestLLM}
            loading={isTesting['llm']}
          >
            Test
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
      <SectionHeader icon={<Sparkles size={20} />} title="Embedding Model" />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          Used for semantic similarity between concepts. Powers connection card quality.
          Separate from the LLM — Anthropic has no embedding model.
        </p>
        <SettingRow label="Provider">
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
              { value: 'openai',   label: 'OpenAI' },
              { value: 'google',   label: 'Google' },
              { value: 'local',    label: 'Local (Ollama)' },
              { value: 'lmstudio', label: 'LM Studio' },
            ]}
          />
        </SettingRow>
        {embedding.provider !== 'local' && embedding.provider !== 'lmstudio' && (
          <SettingRow label="API Key">
            <TextInput
              type="password"
              value={embedding.apiKey ?? ''}
              onChange={(v) => setEmbedding((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveEmbedding()}
              placeholder={embedding.provider === 'google' ? 'AIza...' : 'sk-...'}
            />
          </SettingRow>
        )}
        {(embedding.provider === 'local' || embedding.provider === 'lmstudio') && (
          <SettingRow
            label="Base URL"
            description={embedding.provider === 'lmstudio' ? 'LM Studio server URL' : 'Ollama server URL'}
          >
            <TextInput
              value={embedding.baseUrl ?? ''}
              onChange={(v) => setEmbedding((prev) => ({ ...prev, baseUrl: v }))}
              onBlur={() => saveEmbedding()}
              placeholder={embedding.provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434'}
            />
          </SettingRow>
        )}
        <SettingRow label="Model ID">
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
        <SettingRow label="Dimensions" description="Optional: reduce output size (OpenAI only)">
          <TextInput
            value={String(embedding.dimensions ?? '')}
            onChange={(v) => setEmbedding((prev) => ({ ...prev, dimensions: v ? parseInt(v) || undefined : undefined }))}
            onBlur={() => saveEmbedding()}
            placeholder="256"
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" variant="secondary" onClick={() => { saveEmbedding(); toast('Embedding settings saved.', 'success'); }}>Save</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestEmbedding}
            loading={isTesting['embedding']}
          >
            Test
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
            Debug
          </p>
          <SettingRow
            label="Similarity Threshold"
            description={`${embeddingDebug.similarityThreshold.toFixed(2)} — minimum cosine score for connection cards`}
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
          <SettingRow label="Show Similarity Scores" description="Display cosine score on connection cards">
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
      <SectionHeader icon={<Volume2 size={20} />} title="Text-to-Speech & Speech Recognition" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Provider">
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
              { value: 'openai', label: 'OpenAI TTS' },
              { value: 'gptsovits', label: 'GPT-SoVITS' },
            ]}
          />
        </SettingRow>
        {tts.provider === 'openai' && (
          <SettingRow
            label="API Key"
            description={!tts.apiKey && llm.apiKey ? '✓ Using your LLM API key' : undefined}
          >
            <TextInput
              type="password"
              value={tts.apiKey ?? ''}
              onChange={(v) => setTts((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveTts()}
              placeholder={llm.apiKey ? '(using LLM key)' : 'sk-...'}
            />
          </SettingRow>
        )}
        {tts.provider === 'gptsovits' && (
          <SettingRow label="Server URL" description="GPT-SoVITS local server">
            <TextInput
              value={tts.baseUrl ?? ''}
              onChange={(v) => setTts((prev) => ({ ...prev, baseUrl: v }))}
              onBlur={() => saveTts()}
              placeholder="http://localhost:9880"
            />
          </SettingRow>
        )}
        <SettingRow label="Voice">
          <SelectInput
            value={tts.voice}
            onChange={(v) => {
              const next = { ...tts, voice: v };
              setTts(next);
              saveTts(next);
            }}
            options={[
              { value: 'alloy', label: 'Alloy' },
              { value: 'nova', label: 'Nova' },
              { value: 'shimmer', label: 'Shimmer' },
              { value: 'echo', label: 'Echo' },
            ]}
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" onClick={() => { saveTts(); toast('TTS settings saved.', 'success'); }} variant="secondary">Save</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestTTS}
            loading={isTesting['tts']}
          >
            Test
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
          <SectionHeader icon={<Network size={20} />} title="ZeroTier Network" />
          <Card style={{ marginBottom: '8px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px' }}>
              Connect to a ZeroTier virtual LAN to reach a remote {llm.provider === 'lmstudio' ? 'LM Studio' : 'Ollama'} server.
            </p>
            <SettingRow label="Network ID">
              <TextInput
                value={ztNetworkId}
                onChange={setZtNetworkId}
                placeholder="e.g. 8056c2e21c000001"
              />
            </SettingRow>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
              <Button
                size="sm"
                onClick={async () => {
                  await settingsService.set('zerotier', { networkId: ztNetworkId, isConnected: false });
                  toast('ZeroTier settings saved.', 'success');
                }}
                variant="secondary"
              >
                Save
              </Button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                {settingsService.getSync().zerotier.isConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
          </Card>
        </>
      )}

      {/* Image Generation Section */}
      <SectionHeader icon={<Image size={20} />} title="Image Generation" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Image Generation" description="Generate AI images for feed posts">
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
          AI-generated images for feed posts. Add API keys to enable real generation; mock placeholders are used when keys are absent.
        </p>
        <SettingRow label="Primary Provider" description="Which provider to use first when generating images">
          <SelectInput
            value={imageGen.primaryProvider ?? 'auto'}
            onChange={(v) => {
              const next = { ...imageGen, primaryProvider: v as ImageProviderPrimary };
              setImageGen(next);
              void saveImageGen(next);
            }}
            options={[
              { value: 'auto', label: 'Auto (use available keys)' },
              { value: 'nanoBanana', label: 'Nano Banana (primary)' },
              { value: 'gemini', label: 'Gemini' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Nano Banana API Key" description="Primary image provider (nanobanana.ai)">
          <TextInput
            type="password"
            value={imageGen.nanoBananaApiKey}
            onChange={(v) => setImageGen((prev) => ({ ...prev, nanoBananaApiKey: v }))}
            onBlur={() => void saveImageGen()}
            placeholder="nb-..."
          />
        </SettingRow>
        <SettingRow label="Gemini API Key" description="Fallback image provider (Google)">
          <TextInput
            type="password"
            value={imageGen.geminiApiKey}
            onChange={(v) => setImageGen((prev) => ({ ...prev, geminiApiKey: v }))}
            onBlur={() => void saveImageGen()}
            placeholder="AIza..."
          />
        </SettingRow>
        <SettingRow label="Gemini Model" description="Model name from Google's documentation">
          <TextInput
            value={imageGen.geminiModel ?? 'gemini-3.1-flash-image-preview'}
            onChange={(v) => setImageGen((prev) => ({ ...prev, geminiModel: v }))}
            onBlur={() => void saveImageGen()}
            placeholder="gemini-3.1-flash-image-preview"
          />
        </SettingRow>
        <SettingRow label="Cache Limit (MB)" description="Max local image cache size">
          <TextInput
            value={String(imageGen.maxCacheSizeMb)}
            onChange={(v) => setImageGen((prev) => ({ ...prev, maxCacheSizeMb: parseInt(v) || 50 }))}
            onBlur={() => void saveImageGen()}
            placeholder="50"
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
            Cache Stats
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--foreground)', flexWrap: 'wrap' }}>
            <span><strong>{cacheStats.itemCount}</strong> images cached</span>
            <span><strong>{formatBytes(cacheStats.totalSizeBytes)}</strong> used</span>
            <span>limit: <strong>{imageGen.maxCacheSizeMb} MB</strong></span>
          </div>
        </div>

        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void saveImageGen()}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isTesting['imageGen'] || (!imageGen.nanoBananaApiKey.trim() && !imageGen.geminiApiKey.trim())}
            onClick={() => void handleTestImageConnection()}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isTesting['imageGen'] ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Test
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={isClearingCache || cacheStats.itemCount === 0}
            onClick={() => void handleClearImageCache()}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isClearingCache ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Clear Cache
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
      <SectionHeader icon={<Youtube size={20} />} title="YouTube Videos" />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          Enable video posts in the feed. Get your API key from Google Cloud Console and enable YouTube Data API v3.
        </p>
        <SettingRow label="API Key" description="YouTube Data API v3 key">
          <TextInput
            type="password"
            value={youtubeApiKey}
            onChange={(v) => setYoutubeApiKey(v)}
            onBlur={() => void settingsService.set('youtube', { apiKey: youtubeApiKey })}
            placeholder="YouTube Data API v3 key"
          />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await settingsService.set('youtube', { apiKey: youtubeApiKey });
              toast('YouTube settings saved.', 'success');
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      {/* Podcast Settings */}
      <SectionHeader icon={<Radio size={20} />} title="Podcast" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Auto-Generate" description="Generate podcast automatically at preset time">
          <MaterialSwitch
            checked={podcastAutoGenerate}
            onChange={() => setPodcastAutoGenerate((v) => !v)}
          />
        </SettingRow>
        <SettingRow label="Sleep Time" description="When to generate daily podcast">
          <TextInput type="time" value={podcastSleepTime} onChange={setPodcastSleepTime} placeholder="22:00" />
        </SettingRow>
        <SettingRow label="Advance Minutes" description="Minutes before sleep to generate">
          <TextInput value={podcastAdvance} onChange={setPodcastAdvance} placeholder="60" />
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
                toast('Podcast settings saved.', 'success');
                void scheduleNativeNotifications(); // Reschedule with new times
              } else {
                toast(result.error?.message || 'Failed to save settings.', 'error');
              }
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      {/* Review Settings */}
      <SectionHeader icon={<BookOpen size={20} />} title="Review" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Daily Limit" description="Max cards per day">
          <TextInput value={reviewLimit} onChange={setReviewLimit} placeholder="20" />
        </SettingRow>
        <SettingRow label="Notifications">
          <MaterialSwitch
            checked={reviewNotif}
            onChange={() => setReviewNotif((v) => !v)}
          />
        </SettingRow>
        {reviewNotif && (
          <SettingRow label="Reminder Time">
            <TextInput type="time" value={reviewReminderTime} onChange={setReviewReminderTime} placeholder="09:00" />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await settingsService.set('review', {
                dailyLimit: parseInt(reviewLimit) || 20,
                notificationsEnabled: reviewNotif,
                reminderTime: reviewReminderTime,
              });
              toast('Review settings saved.', 'success');
              void scheduleNativeNotifications(); // Reschedule with new times
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      {/* Planner Auto-Suggestions */}
      <SectionHeader icon={<CalendarClock size={20} />} title="Planner" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Daily Auto-Refresh" description="Refresh suggestions once per day">
          <MaterialSwitch
            checked={plannerRefreshEnabled}
            onChange={() => savePlannerRefreshEnabled(!plannerRefreshEnabled)}
          />
        </SettingRow>
        {plannerRefreshEnabled && (
          <SettingRow label="Preferred Refresh Time" description="Default: 8:00 AM; also triggers after podcast">
            <TextInput type="time" value={plannerRefreshTime} onChange={savePlannerRefreshTime} placeholder="08:00" />
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
                  const checkInText = `I want to revisit and deepen my understanding of: ${summaryLines}. I'm curious about connections between these topics and want to explore areas that feel fuzzy.`;
                  await plannerService.submitCheckIn(checkInText);
                }
                await plannerAutoGenService.generateAndStoreSuggestions(true);
                toast('Planner refreshed!', 'success');
              } catch {
                toast('Refresh failed', 'error');
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
            {isRefreshingPlanner ? 'Generating...' : 'Generate Planner'}
          </Button>
        </div>
      </Card>

      {/* App Preferences */}
      <SectionHeader icon={<Palette size={20} />} title="Appearance" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Theme">
          <SelectInput
            value={theme}
            onChange={async (v) => {
              const t = v as AppSettings['preferences']['theme'];
              setTheme(t);
              applyTheme(t);
              const prefs = settingsService.getSync().preferences;
              await settingsService.set('preferences', { ...prefs, theme: t });
            }}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </SettingRow>
      </Card>

      {/* Privacy & Data Section */}
      <SectionHeader icon={<Shield size={20} />} title="Privacy & Data" />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          EchoLearn is local-first. All notes, flashcards, and sessions are stored only on this device.
          No EchoLearn server ever receives your data.
        </p>
        <SettingRow
          label="AI Data Transmission"
          description="Allow questions to be sent to your configured AI provider"
        >
          <MaterialSwitch checked={aiConsent} onChange={() => void handleToggleAiConsent()} />
        </SettingRow>
        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => toast('Exporting data...', 'info')} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Download size={16} /> Export Data
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toast('Importing data...', 'info')} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Upload size={16} /> Import Data
          </Button>
          <Button variant="danger" size="sm" onClick={() => void handleDeleteApiKeys()}>
            Delete API Keys
          </Button>
        </div>
      </Card>

      {/* Developer / Debug */}
      <SectionHeader icon={<Trash2 size={20} />} title="Developer" />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
          Debug tools for development. Destructive actions cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearAllData}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <Trash2 size={16} /> Clear All Data
          </Button>
        </div>
      </Card>

      {/* Token Usage */}
      <SectionHeader icon={<BarChart3 size={20} />} title="Token Usage" />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          LLM API token usage per service. Data from provider responses.
        </p>
        {Object.keys(tokenUsage).length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No usage data recorded yet.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Service</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Prompt</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Completion</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Calls</th>
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
                    <td style={{ padding: '6px 8px' }}>Total</td>
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
          <Button size="sm" variant="secondary" onClick={refreshTokenUsage}>Refresh</Button>
          <Button size="sm" variant="danger" onClick={handleClearTokenUsage}>Clear</Button>
        </div>
      </Card>

      {/* Reset & About */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
          EchoLearn v1.0.0
        </p>
        <button
          onClick={() => toast('Licenses modal coming soon', 'info')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-40)', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '24px' }}
        >
          View Licenses &rarr;
        </button>
        <br />
        <Button variant="danger" size="sm" onClick={handleReset} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={16} /> Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
