import { useState } from 'react';
import { Brain, Volume2, Network, Radio, BookOpen, Palette, RotateCcw, CheckCircle, XCircle, Shield } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mockSettingsService } from '../services/mock/settings.mock';
import { testLLMConnection } from '../providers/llm';
import { testTTSConnection } from '../providers/tts';
import type { LLMConfig, TTSConfig, AppSettings } from '../types';
import { toast } from '../lib/toast';
import { applyTheme } from '../lib/theme';

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
        width: '160px',
      }}
    />
  );
}

export function SettingsScreen() {
  const [testResult, setTestResult] = useState<Record<string, string | null>>({});
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});

  const [llm, setLlm] = useState<LLMConfig>(() => mockSettingsService.getSync().llm);
  const [tts, setTts] = useState<TTSConfig>(() => mockSettingsService.getSync().tts);
  const [ztNetworkId, setZtNetworkId] = useState(() => mockSettingsService.getSync().zerotier.networkId ?? '');
  const [podcastSleepTime, setPodcastSleepTime] = useState(() => mockSettingsService.getSync().podcast.sleepTime);
  const [podcastAdvance, setPodcastAdvance] = useState(() => String(mockSettingsService.getSync().podcast.advanceMinutes));
  const [reviewLimit, setReviewLimit] = useState(() => String(mockSettingsService.getSync().review.dailyLimit));
  const [reviewNotif, setReviewNotif] = useState(() => mockSettingsService.getSync().review.notificationsEnabled);
  const [reviewReminderTime, setReviewReminderTime] = useState(() => mockSettingsService.getSync().review.reminderTime);
  const [theme, setTheme] = useState<AppSettings['preferences']['theme']>(() => mockSettingsService.getSync().preferences.theme);
  const [aiConsent, setAiConsent] = useState(() => mockSettingsService.getSync().preferences.aiConsentGiven ?? false);

  const noKeyRequired = (p: LLMConfig['provider']) => p === 'local' || p === 'lmstudio';

  const saveLlm = (current: LLMConfig = llm) => {
    mockSettingsService.set('llm', { ...current, isConfigured: !!current.apiKey || noKeyRequired(current.provider) });
  };

  const saveTts = (current: TTSConfig = tts) => {
    const isConfigured =
      current.provider === 'openai' ? !!current.apiKey :
      current.provider === 'gptsovits' ? !!current.baseUrl :
      false;
    mockSettingsService.set('tts', { ...current, isConfigured });
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

  const handleTestTTS = async () => {
    setIsTesting((prev) => ({ ...prev, tts: true }));
    setTestResult((prev) => ({ ...prev, tts: null }));
    const isConfigured =
      tts.provider === 'openai' ? !!tts.apiKey :
      tts.provider === 'gptsovits' ? !!tts.baseUrl :
      false;
    const config = { ...tts, isConfigured };
    const result = await testTTSConnection(config);
    setIsTesting((prev) => ({ ...prev, tts: false }));
    setTestResult((prev) => ({
      ...prev,
      tts: result.ok ? `✓ ${result.latencyMs}ms` : `✗ ${result.error ?? 'Failed'}`,
    }));
    setTimeout(() => setTestResult((prev) => ({ ...prev, tts: null })), 5000);
  };

  const handleToggleAiConsent = async () => {
    const prefs = mockSettingsService.getSync().preferences;
    const next = !aiConsent;
    await mockSettingsService.set('preferences', { ...prefs, aiConsentGiven: next });
    setAiConsent(next);
    toast(next ? 'AI transmission enabled.' : 'AI transmission disabled.', 'success');
  };

  const handleDeleteApiKeys = async () => {
    if (!confirm('Delete all stored API keys? This will disable AI and TTS features until you re-enter your keys.')) return;
    const nextLlm = { ...llm, apiKey: '', isConfigured: noKeyRequired(llm.provider) };
    const nextTts = { ...tts, apiKey: '', isConfigured: tts.provider === 'gptsovits' ? !!tts.baseUrl : false };
    await mockSettingsService.set('llm', nextLlm);
    await mockSettingsService.set('tts', nextTts);
    setLlm(nextLlm);
    setTts(nextTts);
    toast('All API keys deleted.', 'success');
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults?')) {
      await mockSettingsService.reset();
      const s = mockSettingsService.getSync();
      setLlm(s.llm);
      setTts(s.tts);
      setZtNetworkId(s.zerotier.networkId ?? '');
      setPodcastSleepTime(s.podcast.sleepTime);
      setPodcastAdvance(String(s.podcast.advanceMinutes));
      setReviewLimit(String(s.review.dailyLimit));
      setReviewNotif(s.review.notificationsEnabled);
      setReviewReminderTime(s.review.reminderTime);
      setTheme(s.preferences.theme);
      applyTheme(s.preferences.theme);
    }
  };

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ marginBottom: '4px' }}>Settings</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>Configure your EchoLearn experience</p>
      </div>

      {/* LLM Section */}
      <SectionHeader icon={<Brain size={20} />} title="Language Model" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Provider">
          <SelectInput
            value={llm.provider}
            onChange={(v) => {
              const p = v as LLMConfig['provider'];
              const defaults: Record<string, Partial<LLMConfig>> = {
                openai:   { model: 'gpt-4o',              baseUrl: '',                         apiKey: '' },
                claude:   { model: 'claude-sonnet-4-6',   baseUrl: '',                         apiKey: '' },
                gemini:   { model: 'gemini-2.0-flash',    baseUrl: '',                         apiKey: '' },
                local:    { model: 'llama3',               baseUrl: 'http://localhost:11434/v1', apiKey: '' },
                lmstudio: { model: 'local-model',          baseUrl: 'http://localhost:1234',     apiKey: '' },
              };
              const next = { ...llm, provider: p, ...defaults[p] } as LLMConfig;
              setLlm(next);
              saveLlm(next);
            }}
            options={[
              { value: 'openai',   label: 'OpenAI' },
              { value: 'claude',   label: 'Claude' },
              { value: 'gemini',   label: 'Gemini' },
              { value: 'lmstudio', label: 'LM Studio' },
              { value: 'local',    label: 'Local (Ollama)' },
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
              llm.provider === 'gemini'   ? 'gemini-2.0-flash' :
              llm.provider === 'claude'   ? 'claude-sonnet-4-6' :
              llm.provider === 'lmstudio' ? 'local-model' :
              'gpt-4o'
            }
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" onClick={() => saveLlm()} variant="secondary">Save</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestLLM}
            loading={isTesting['llm']}
          >
            Test Connection
          </Button>
          {testResult['llm'] && (
            <span style={{
              fontSize: '0.8rem',
              color: testResult['llm'].startsWith('✓') ? 'var(--primary-40)' : '#E53935',
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

      {/* TTS Section */}
      <SectionHeader icon={<Volume2 size={20} />} title="Text-to-Speech" />
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
              { value: 'openai',    label: 'OpenAI TTS' },
              { value: 'gptsovits', label: 'GPT-SoVITS' },
            ]}
          />
        </SettingRow>
        {tts.provider === 'openai' && (
          <SettingRow label="API Key">
            <TextInput
              type="password"
              value={tts.apiKey ?? ''}
              onChange={(v) => setTts((prev) => ({ ...prev, apiKey: v }))}
              onBlur={() => saveTts()}
              placeholder="sk-..."
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
              { value: 'alloy',   label: 'Alloy' },
              { value: 'nova',    label: 'Nova' },
              { value: 'shimmer', label: 'Shimmer' },
              { value: 'echo',    label: 'Echo' },
            ]}
          />
        </SettingRow>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', alignItems: 'center' }}>
          <Button size="sm" onClick={() => saveTts()} variant="secondary">Save</Button>
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
              color: testResult['tts'].startsWith('✓') ? 'var(--primary-40)' : '#E53935',
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
                  await mockSettingsService.set('zerotier', { networkId: ztNetworkId, isConnected: false });
                }}
                variant="secondary"
              >
                Save
              </Button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                {mockSettingsService.getSync().zerotier.isConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
          </Card>
        </>
      )}

      {/* Podcast Settings */}
      <SectionHeader icon={<Radio size={20} />} title="Podcast" />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label="Sleep Time" description="When to generate daily podcast">
          <TextInput value={podcastSleepTime} onChange={setPodcastSleepTime} placeholder="22:00" />
        </SettingRow>
        <SettingRow label="Advance Minutes" description="Minutes before sleep to generate">
          <TextInput value={podcastAdvance} onChange={setPodcastAdvance} placeholder="60" />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await mockSettingsService.set('podcast', {
                sleepTime: podcastSleepTime,
                advanceMinutes: parseInt(podcastAdvance) || 60,
                autoGenerate: mockSettingsService.getSync().podcast.autoGenerate,
              });
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
            <TextInput value={reviewReminderTime} onChange={setReviewReminderTime} placeholder="09:00" />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await mockSettingsService.set('review', {
                dailyLimit: parseInt(reviewLimit) || 20,
                notificationsEnabled: reviewNotif,
                reminderTime: reviewReminderTime,
              });
            }}
          >
            Save
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
              const prefs = mockSettingsService.getSync().preferences;
              await mockSettingsService.set('preferences', { ...prefs, theme: t });
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
        <div style={{ paddingTop: '12px' }}>
          <Button variant="danger" size="sm" onClick={() => void handleDeleteApiKeys()}>
            Delete All API Keys
          </Button>
        </div>
      </Card>

      {/* Reset */}
      <div style={{ marginTop: '32px' }}>
        <Button variant="danger" size="sm" onClick={handleReset} style={{ marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <RotateCcw size={16} /> Reset to Defaults
        </Button>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>
          EchoLearn v1.0.0
        </p>
      </div>
    </div>
  );
}
