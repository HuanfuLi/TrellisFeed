import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Network, Sparkles, Zap } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { settingsService } from '../../services/settings.service';
import { testLLMConnection } from '../../providers/llm';
import { embedText, clearEmbedCache } from '../../providers/embedding';
import { toast } from '../../lib/toast';
import type { LLMConfig, EmbeddingConfig, EmbeddingDebugConfig, FastModelConfig } from '../../types';
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
  // Phase 55.1 GAP-E — optional low-latency generation model. The default-defaulting in
  // settings.service.ts guarantees getSync().fastModel is present, but keep a defensive
  // fallback for any older runtime path.
  const [fastModel, setFastModel] = useState<FastModelConfig>(() =>
    settingsService.getSync().fastModel ?? {
      enabled: false, provider: 'openai', apiKey: '', baseUrl: '', model: 'gpt-4o-mini', isConfigured: false,
    },
  );
  const [embedding, setEmbedding] = useState<EmbeddingConfig>(() => settingsService.getSync().embedding);
  const [embeddingDebug, setEmbeddingDebug] = useState<EmbeddingDebugConfig>(() => settingsService.getSync().embeddingDebug);
  const [ztNetworkId, setZtNetworkId] = useState(() => settingsService.getSync().zerotier.networkId ?? '');

  const noKeyRequired = (p: LLMConfig['provider']) => p === 'local' || p === 'lmstudio';

  const saveLlm = (current: LLMConfig = llm) => {
    settingsService.set('llm', { ...current, isConfigured: !!current.apiKey || noKeyRequired(current.provider) });
  };

  const saveFastModel = (current: FastModelConfig = fastModel) => {
    const isConfigured = noKeyRequired(current.provider) ? !!current.baseUrl : !!current.apiKey;
    settingsService.set('fastModel', { ...current, isConfigured });
  };

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

      {/* Fast Generation Model Section (Phase 55.1 GAP-E) — optional low-latency model for
          on-open post-body / post-context-Q&A streaming, thinking disabled. */}
      <SectionHeader icon={<Zap size={20} />} title={t('settings.sections.fastModel')} />
      <Card style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '12px', lineHeight: 1.5 }}>
          {t('settings.descriptions.fastModelBlurb')}
        </p>
        <SettingRow label={t('settings.fields.fastModelEnabled')} description={t('settings.descriptions.fastModelEnabled')}>
          <MaterialSwitch
            checked={fastModel.enabled}
            onChange={() => {
              const next = { ...fastModel, enabled: !fastModel.enabled };
              setFastModel(next);
              saveFastModel(next);
            }}
          />
        </SettingRow>
        {fastModel.enabled && (
          <>
            <SettingRow label={t('settings.fields.provider')}>
              <SelectInput
                value={fastModel.provider}
                onChange={(v) => {
                  const p = v as FastModelConfig['provider'];
                  const defaults: Record<string, Partial<FastModelConfig>> = {
                    openai: { model: 'gpt-4o-mini', baseUrl: '', apiKey: '' },
                    claude: { model: 'claude-haiku-4-5', baseUrl: '', apiKey: '' },
                    gemini: { model: 'gemini-3.1-flash', baseUrl: '', apiKey: '' },
                    local: { model: 'llama3', baseUrl: 'http://localhost:11434/v1', apiKey: '' },
                    lmstudio: { model: 'local-model', baseUrl: 'http://localhost:1234', apiKey: '' },
                  };
                  const savedKeys = { ...(fastModel.apiKeys ?? {}), [fastModel.provider]: fastModel.apiKey ?? '' };
                  const restoredKey = savedKeys[p] ?? '';
                  const next = { ...fastModel, provider: p, ...defaults[p], apiKey: restoredKey, apiKeys: savedKeys } as FastModelConfig;
                  setFastModel(next);
                  saveFastModel(next);
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
            {!noKeyRequired(fastModel.provider) && (
              <SettingRow label={t('settings.fields.apiKey')}>
                <TextInput
                  type="password"
                  value={fastModel.apiKey ?? ''}
                  onChange={(v) => setFastModel((prev) => ({ ...prev, apiKey: v, apiKeys: { ...(prev.apiKeys ?? {}), [prev.provider]: v } }))}
                  onBlur={() => saveFastModel()}
                  placeholder={
                    fastModel.provider === 'claude' ? t('settings.placeholders.claudeKey') :
                      fastModel.provider === 'gemini' ? t('settings.placeholders.geminiKey') :
                        t('settings.placeholders.apiKey')
                  }
                />
              </SettingRow>
            )}
            {(fastModel.provider === 'local' || fastModel.provider === 'lmstudio') && (
              <SettingRow
                label={t('settings.fields.baseUrl')}
                description={fastModel.provider === 'lmstudio' ? t('settings.descriptions.lmStudioServer') : t('settings.descriptions.ollamaServer')}
              >
                <TextInput
                  value={fastModel.baseUrl ?? ''}
                  onChange={(v) => setFastModel((prev) => ({ ...prev, baseUrl: v }))}
                  onBlur={() => saveFastModel()}
                  placeholder={fastModel.provider === 'lmstudio' ? t('settings.placeholders.lmStudioUrl') : t('settings.placeholders.ollamaUrl')}
                />
              </SettingRow>
            )}
            <SettingRow label={t('settings.fields.model')} description={t('settings.descriptions.fastModelHint')}>
              <TextInput
                value={fastModel.model}
                onChange={(v) => setFastModel((prev) => ({ ...prev, model: v }))}
                onBlur={() => saveFastModel()}
                placeholder={
                  fastModel.provider === 'gemini' ? 'gemini-3.1-flash' :
                    fastModel.provider === 'claude' ? 'claude-haiku-4-5' :
                      fastModel.provider === 'lmstudio' ? 'local-model' :
                        'gpt-4o-mini'
                }
              />
            </SettingRow>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
              <Button size="sm" onClick={() => { saveFastModel(); toast(t('settings.toast.fastModelSaved'), 'success'); }} variant="primary">{t('settings.buttons.save')}</Button>
            </div>
          </>
        )}
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
          {/*
            Phase 55: per-knob tuning controls, dev-only (rendered only when debugEnabled).
            Labels stay English and are NOT added to locale bundles. Post-RAW-ARGMAX
            (55-FILTER-TUNING-REPORT.md): the question filter no longer uses an absolute
            off-topic OR malicious threshold — it uses a scale-invariant relative rule with
            a malicious FLOOR. So the off-topic slider is retired and the malicious slider now
            overrides the floor, clamped to [0.35, 0.70] in BOTH the UI and the service read
            path (resolveMaliciousFloor). The anchor-dedup knob is a SEPARATE classifier
            (canonical-knowledge.service.ts) and keeps its [0.78, 0.85] band.
          */}
          {/* Master debug-mode gate — knobs hidden in release when off (D-04). */}
          <SettingRow label="Debug mode" description="Show per-threshold tuning controls (dev only)">
            <MaterialSwitch
              checked={embeddingDebug.debugEnabled ?? false}
              onChange={() => {
                const next = { ...embeddingDebug, debugEnabled: !(embeddingDebug.debugEnabled ?? false) };
                setEmbeddingDebug(next);
                saveEmbeddingDebug(next);
              }}
            />
          </SettingRow>
          {embeddingDebug.debugEnabled && (
            <>
              {/* Malicious FLOOR override (RAW-ARGMAX) — clamped to [0.35, 0.70]. */}
              {(() => {
                const floorValue = Math.min(0.70, Math.max(0.35, embeddingDebug.maliciousThreshold ?? 0.50));
                return (
                  <SettingRow
                    label={`Malicious floor: ${floorValue.toFixed(2)}`}
                    description="RAW-ARGMAX floor, clamped 0.35-0.70. Lower = catches more attacks but risks blocking benign; higher = misses attacks. Production uses the validated per-model floor."
                  >
                    <input
                      type="range"
                      min={0.35}
                      max={0.70}
                      step={0.01}
                      value={floorValue}
                      onChange={(e) => {
                        const next = { ...embeddingDebug, maliciousThreshold: parseFloat(e.target.value) };
                        setEmbeddingDebug(next);
                        saveEmbeddingDebug(next);
                      }}
                      style={{ width: '120px', accentColor: 'var(--primary-40)', cursor: 'pointer' }}
                    />
                  </SettingRow>
                );
              })()}
              {/* Anchor-dedup threshold — CLAMPED to 0.78-0.85 (CLAUDE.md dedup band). */}
              <SettingRow
                label={`Anchor dedup threshold: ${(embeddingDebug.anchorDedupThreshold ?? 0.82).toFixed(2)}`}
                description="Clamped 0.78-0.85 — lower = missed dedups, higher = wrong merges"
              >
                <input
                  type="range"
                  min={0.78}
                  max={0.85}
                  step={0.01}
                  value={embeddingDebug.anchorDedupThreshold ?? 0.82}
                  onChange={(e) => {
                    const next = { ...embeddingDebug, anchorDedupThreshold: parseFloat(e.target.value) };
                    setEmbeddingDebug(next);
                    saveEmbeddingDebug(next);
                  }}
                  style={{ width: '120px', accentColor: 'var(--primary-40)', cursor: 'pointer' }}
                />
              </SettingRow>
            </>
          )}
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
