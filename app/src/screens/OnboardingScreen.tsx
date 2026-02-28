import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Key, Zap, Shield, Smartphone, Cloud, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSettings } from '../state/useSettings';
import type { LLMConfig } from '../types';

type Step = 'welcome' | 'consent' | 'llm';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { set } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [consentChecked, setConsentChecked] = useState(false);
  const [provider, setProvider] = useState<LLMConfig['provider']>('openai');
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // "Skip for now" — completes onboarding, preserves consent value at time of call
  const handleSkip = async (consent: boolean) => {
    await set('preferences', {
      theme: 'system',
      language: 'en',
      onboardingCompleted: true,
      aiConsentGiven: consent,
    });
    navigate('/home', { replace: true });
  };

  // "Continue" from LLM step — user explicitly gave consent on the consent screen
  const handleContinue = async () => {
    setIsSaving(true);
    await set('llm', {
      provider,
      apiKey,
      model: provider === 'openai' ? 'gpt-4o' : provider === 'claude' ? 'claude-sonnet-4-6' : 'local',
      isConfigured: apiKey.length > 0 || provider === 'local',
    });
    await set('preferences', {
      theme: 'system',
      language: 'en',
      onboardingCompleted: true,
      aiConsentGiven: true,
    });
    setIsSaving(false);
    navigate('/home', { replace: true });
  };

  const providers: { value: LLMConfig['provider']; label: string; description: string }[] = [
    { value: 'openai', label: 'OpenAI', description: 'GPT-4o and other OpenAI models' },
    { value: 'claude', label: 'Claude (Anthropic)', description: 'Claude Sonnet and Opus models' },
    { value: 'local', label: 'Local LLM', description: 'Ollama, LM Studio, etc.' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: '400px', width: '100%' }}>

        {/* ── Welcome step ──────────────────────────────────────────── */}
        {step === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-80), var(--primary-40))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <Brain size={40} color="white" />
            </div>
            <h1 style={{ marginBottom: '12px' }}>Welcome to EchoLearn</h1>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '40px', lineHeight: 1.6 }}>
              Your personal AI-powered learning companion. Ask anything, review with spaced repetition, and listen to daily podcasts of your knowledge.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', textAlign: 'left' }}>
              {[
                { icon: <MessageBubble />, title: 'Ask Anything', desc: 'Get AI-powered answers stored as structured knowledge' },
                { icon: <RepeatIcon />, title: 'Spaced Repetition', desc: 'Review cards at optimal intervals to maximize retention' },
                { icon: <HeadphonesIcon />, title: 'Daily Podcasts', desc: 'Listen to summaries of your learning while on the go' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{
                    flexShrink: 0, width: '40px', height: '40px',
                    backgroundColor: 'var(--primary-90)', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--primary-40)',
                  }}>
                    {icon}
                  </div>
                  <div>
                    <p style={{ fontWeight: 500, marginBottom: '2px' }}>{title}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button fullWidth onClick={() => setStep('consent')}>Get Started</Button>
            <button
              onClick={() => void handleSkip(false)}
              style={{ display: 'block', width: '100%', marginTop: '12px', padding: '12px', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ── Consent step ──────────────────────────────────────────── */}
        {step === 'consent' && (
          <div>
            <button
              onClick={() => setStep('welcome')}
              style={{ color: 'var(--primary-40)', background: 'none', border: 'none', marginBottom: '24px', padding: 0 }}
            >
              ← Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Shield size={24} color="var(--primary-40)" />
              <h2>Data &amp; Privacy</h2>
            </div>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '20px' }}>
              EchoLearn is a privacy-first app. Here's exactly what happens with your data:
            </p>

            {/* Data flow info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {[
                {
                  icon: <Smartphone size={18} color="var(--primary-40)" />,
                  text: 'All notes, flashcards, and calendar data are stored locally on your device only.',
                },
                {
                  icon: <Cloud size={18} color="var(--primary-40)" />,
                  text: 'When you ask a question, it is sent directly to your configured AI provider (e.g., OpenAI, Anthropic) using only your own API key.',
                },
                {
                  icon: <Lock size={18} color="var(--primary-40)" />,
                  text: 'EchoLearn never transmits your data to any EchoLearn server. There is no EchoLearn backend.',
                },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', backgroundColor: 'var(--surface-variant)', borderRadius: 'var(--radius)' }}>
                  <div style={{ flexShrink: 0, marginTop: '1px' }}>{icon}</div>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--foreground)' }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Consent checkbox */}
            <label
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                padding: '16px',
                backgroundColor: consentChecked ? 'var(--primary-90)' : 'var(--surface-variant)',
                border: `1.5px solid ${consentChecked ? 'var(--primary-40)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                marginBottom: '24px',
                cursor: 'pointer',
                transition: 'background-color 0.2s, border-color 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--primary-40)', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                I understand and agree that my questions will be sent to my configured AI provider using my own API key.
              </span>
            </label>

            <Button fullWidth onClick={() => setStep('llm')} disabled={!consentChecked}>
              Continue
            </Button>
            <button
              onClick={() => void handleSkip(false)}
              style={{ display: 'block', width: '100%', marginTop: '12px', padding: '12px', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
            >
              Skip — I'll use EchoLearn without AI features
            </button>
          </div>
        )}

        {/* ── LLM step ──────────────────────────────────────────────── */}
        {step === 'llm' && (
          <div>
            <button
              onClick={() => setStep('consent')}
              style={{ color: 'var(--primary-40)', background: 'none', border: 'none', marginBottom: '24px', padding: 0 }}
            >
              ← Back
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Key size={24} color="var(--primary-40)" />
              <h2>Configure LLM</h2>
            </div>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px' }}>
              Choose your AI provider and enter your API key to get started.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Provider</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {providers.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setProvider(p.value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '16px', borderRadius: 'var(--radius)',
                      border: `2px solid ${provider === p.value ? 'var(--primary-40)' : 'var(--border)'}`,
                      backgroundColor: provider === p.value ? 'var(--primary-90)' : 'var(--card)',
                      transition: 'all 0.15s', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{p.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{p.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                API Key {provider === 'local' && <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--surface-variant)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <Zap size={16} color="var(--muted-foreground)" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'local' ? 'No key needed for local' : 'sk-...'}
                  style={{ flex: 1, background: 'none', color: 'var(--foreground)' }}
                />
              </div>
              {/* §2.2 note: In native builds, use iOS Keychain / Android Keystore to store this key */}
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '6px' }}>
                Your key is stored locally on this device and sent only to your chosen provider.
              </p>
            </div>

            <Button fullWidth onClick={() => void handleContinue()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Continue'}
            </Button>
            <button
              onClick={() => void handleSkip(true)}
              style={{ display: 'block', width: '100%', marginTop: '12px', padding: '12px', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
            >
              Skip for now
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function MessageBubble() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function RepeatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function HeadphonesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}
