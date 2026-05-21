import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Volume2, Network, Sparkles } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { settingsService } from '../../services/settings.service';
import { testLLMConnection } from '../../providers/llm';
import { testTTSConnection } from '../../providers/tts';
import { embedText, clearEmbedCache } from '../../providers/embedding';
import { toast } from '../../lib/toast';
import type { LLMConfig, TTSConfig, EmbeddingConfig, EmbeddingDebugConfig } from '../../types';
import {
  SectionHeader,
  SettingRow,
  MaterialSwitch,
  SelectInput,
  TextInput,
  TestResult,
  SUB_SCREEN_STYLE,
} from './SettingsShared';

export function SettingsAIScreen() {
  const { t } = useTranslation();

  const [testResult, setTestResult] = useState<Record<string, string | null>>({});
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});

  const [llm, setLlm] = useState<LLMConfig>(() => settingsService.getSync().llm);
  const [tts, setTts] = useState<TTSConfig>(() => settingsService.getSync().tts);
  const [embedding, setEmbedding] = useState<EmbeddingConfig>(() => settingsService.getSync().embedding);
  const [embeddingDebug, setEmbeddingDebug] = useState<EmbeddingDebugConfig>(() => settingsService.getSync().embeddingDebug);
  const [ztNetworkId, setZtNetworkId] = useState(() => settingsService.getSync().zerotier.networkId ?? '');

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
    // Phase 55 D-07 / Pitfall 5: when the embedding provider or model changes,
    // invalidate the in-memory session embed cache so a stale, wrong-dimensionality
    // vector from the previous model can never be returned for the new one.
    const prev = settingsService.getSync().embedding;
    if (prev.provider !== current.provider || prev.model !== current.model) {
      clearEmbedCache();
    }
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

  return (
    <div style={SUB_SCREEN_STYLE}>
      <Header title={t('settings.titles.aiModels')} backTo="/settings" />

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
              // Phase 52 GAP-5: stash the currently-entered key under the OLD
              // provider, then restore the NEW provider's saved key. Override
              // apiKey AFTER the defaults spread (defaults[p] sets apiKey:'').
              const savedKeys = { ...(llm.apiKeys ?? {}), [llm.provider]: llm.apiKey ?? '' };
              const restoredKey = savedKeys[p] ?? '';
              const next = { ...llm, provider: p, ...defaults[p], apiKey: restoredKey, apiKeys: savedKeys } as LLMConfig;
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
              // Phase 52 GAP-5: remember the entered key under the current provider so a switch-away-and-back restores it.
              onChange={(v) => setLlm((prev) => ({ ...prev, apiKey: v, apiKeys: { ...(prev.apiKeys ?? {}), [prev.provider]: v } }))}
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
          <Button size="sm" onClick={() => { saveLlm(); toast(t('settings.toast.llmSaved'), 'success'); }} variant="primary">{t('settings.buttons.save')}</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleTestLLM}
            loading={isTesting['llm']}
          >
            {t('settings.buttons.test')}
          </Button>
          <TestResult result={testResult['llm'] ?? null} />
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
              // Phase 52 GAP-5: same per-provider key memory as the LLM selector.
              const savedKeys = { ...(embedding.apiKeys ?? {}), [embedding.provider]: embedding.apiKey ?? '' };
              const restoredKey = savedKeys[p] ?? '';
              const next = { ...embedding, provider: p, ...defaults[p], apiKey: restoredKey, apiKeys: savedKeys } as EmbeddingConfig;
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
              // Phase 52 GAP-5: remember the entered key under the current provider so a switch-away-and-back restores it.
              onChange={(v) => setEmbedding((prev) => ({ ...prev, apiKey: v, apiKeys: { ...(prev.apiKeys ?? {}), [prev.provider]: v } }))}
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
          <Button size="sm" variant="primary" onClick={() => { saveEmbedding(); toast(t('settings.toast.embeddingSaved'), 'success'); }}>{t('settings.buttons.save')}</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleTestEmbedding}
            loading={isTesting['embedding']}
          >
            {t('settings.buttons.test')}
          </Button>
          <TestResult result={testResult['embedding'] ?? null} />
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
              // Phase 52 GAP-5: intentionally NO apiKeys map on TTSConfig. TTS has
              // no multi-provider key-loss problem worth the complexity — OpenAI TTS
              // falls back to the LLM key via effectiveTtsApiKey, and gptsovits uses
              // baseUrl, not apiKey. Do NOT "consistency-fix" this to add apiKeys.
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
        {/* Phase 52 PODCAST-05 + D-07: TTS model picker, OpenAI-only.
            Default stays 'tts-1' (D-10 — defaults unchanged until device
            UAT). gptsovits has no equivalent so the row is provider-gated. */}
        {tts.provider === 'openai' && (
          <SettingRow label={t('settings.fields.ttsModel')} description={t('settings.descriptions.ttsModel')}>
            <SelectInput
              value={tts.model ?? 'tts-1'}
              onChange={(v) => {
                const next = { ...tts, model: v };
                setTts(next);
                saveTts(next);
              }}
              options={[
                { value: 'tts-1', label: t('settings.fields.ttsModelStandard') },
                { value: 'tts-1-hd', label: t('settings.fields.ttsModelHd') },
              ]}
            />
          </SettingRow>
        )}
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" onClick={() => { saveTts(); toast(t('settings.toast.ttsSaved'), 'success'); }} variant="primary">{t('settings.buttons.save')}</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleTestTTS}
            loading={isTesting['tts']}
          >
            {t('settings.buttons.test')}
          </Button>
          <TestResult result={testResult['tts'] ?? null} />
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
                variant="primary"
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
    </div>
  );
}
