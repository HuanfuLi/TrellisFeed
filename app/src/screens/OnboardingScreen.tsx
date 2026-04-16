import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Brain, Key, Zap, Shield, Smartphone, Cloud, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSettings } from '../state/useSettings';
import i18n from '../locales';
import { detectDeviceLocale } from '../lib/locale';
import { eventBus } from '../lib/event-bus';
import type { LLMConfig, SupportedLocale } from '../types';

type Step = 'welcome' | 'language' | 'consent' | 'llm';

const LOCALE_OPTIONS: readonly { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'es', label: 'Español' },
  { code: 'ja', label: '日本語' },
] as const;

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { set } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [consentChecked, setConsentChecked] = useState(false);
  const [provider, setProvider] = useState<LLMConfig['provider']>('openai');
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Seed from i18n.language synchronously, then refine via async device detection.
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(() => {
    const cur = i18n.language;
    return (['en', 'zh', 'es', 'ja'] as const).includes(cur as SupportedLocale)
      ? (cur as SupportedLocale)
      : 'en';
  });

  useEffect(() => {
    void detectDeviceLocale().then((detected) => setSelectedLocale(detected));
  }, []);

  // "Skip for now" — completes onboarding, preserves consent value at time of call
  const handleSkip = async (consent: boolean) => {
    await set('preferences', {
      theme: 'system',
      locale: selectedLocale,
      language: selectedLocale,   // legacy back-compat; matches locale
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
      locale: selectedLocale,
      language: selectedLocale,   // legacy back-compat; matches locale
      onboardingCompleted: true,
      aiConsentGiven: true,
    });
    setIsSaving(false);
    navigate('/home', { replace: true });
  };

  // Confirm the language selection: applies instantly, persists, emits LOCALE_CHANGED.
  const handleConfirmLanguage = async () => {
    await i18n.changeLanguage(selectedLocale);
    eventBus.emit({ type: 'LOCALE_CHANGED', payload: { locale: selectedLocale } });
    setStep('consent');
  };

  const providers: { value: LLMConfig['provider']; label: string; description: string }[] = [
    { value: 'openai', label: t('onboarding.llm.providers.openaiLabel'), description: t('onboarding.llm.providers.openaiDesc') },
    { value: 'claude', label: t('onboarding.llm.providers.claudeLabel'), description: t('onboarding.llm.providers.claudeDesc') },
    { value: 'local', label: t('onboarding.llm.providers.localLabel'), description: t('onboarding.llm.providers.localDesc') },
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
            <h1 style={{ marginBottom: '12px' }}>{t('onboarding.welcome.title')}</h1>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '40px', lineHeight: 1.6 }}>
              {t('onboarding.welcome.body')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', textAlign: 'left' }}>
              {[
                { icon: <MessageBubble />, title: t('onboarding.welcome.featureAskTitle'), desc: t('onboarding.welcome.featureAskDesc') },
                { icon: <RepeatIcon />, title: t('onboarding.welcome.featureReviewTitle'), desc: t('onboarding.welcome.featureReviewDesc') },
                { icon: <HeadphonesIcon />, title: t('onboarding.welcome.featurePodcastTitle'), desc: t('onboarding.welcome.featurePodcastDesc') },
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

            <Button fullWidth onClick={() => setStep('language')}>{t('onboarding.welcome.getStarted')}</Button>
            <button
              onClick={() => void handleSkip(false)}
              style={{ display: 'block', width: '100%', marginTop: '12px', padding: '12px', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
            >
              {t('onboarding.welcome.skip')}
            </button>
          </div>
        )}

        {/* ── Language step (D-18) ──────────────────────────────────── */}
        {step === 'language' && (
          <div>
            <button
              onClick={() => setStep('welcome')}
              style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '24px' }}
            >
              <ArrowLeft size={20} />
            </button>

            {/* 4-language header so user recognizes step regardless of current locale (D-18). */}
            <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>
              Language / 语言 / Idioma / 言語
            </h2>
            <p style={{ fontSize: '0.875rem', textAlign: 'center', color: 'var(--muted-foreground)', marginBottom: '24px' }}>
              Choose your language · 选择语言 · Elige tu idioma · 言語を選択
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {LOCALE_OPTIONS.map((opt) => {
                const isSelected = selectedLocale === opt.code;
                return (
                  <button
                    key={opt.code}
                    onClick={() => setSelectedLocale(opt.code)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-xl)',
                      border: `2px solid ${isSelected ? 'var(--primary-40)' : 'var(--border)'}`,
                      backgroundColor: isSelected ? 'var(--primary-90)' : 'var(--surface-variant)',
                      color: 'var(--foreground)',
                      fontSize: '1rem',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s, border-color 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <Button fullWidth onClick={() => void handleConfirmLanguage()}>
              Continue · 继续 · Continuar · 続ける
            </Button>
          </div>
        )}

        {/* ── Consent step ──────────────────────────────────────────── */}
        {step === 'consent' && (
          <div>
            <button
              onClick={() => setStep('language')}
              style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '24px' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Shield size={24} color="var(--primary-40)" />
              <h2>{t('onboarding.consent.title')}</h2>
            </div>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '20px' }}>
              {t('onboarding.consent.intro')}
            </p>

            {/* Data flow info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {[
                {
                  icon: <Smartphone size={18} color="var(--primary-40)" />,
                  text: t('onboarding.consent.rowLocal'),
                },
                {
                  icon: <Cloud size={18} color="var(--primary-40)" />,
                  text: t('onboarding.consent.rowCloud'),
                },
                {
                  icon: <Lock size={18} color="var(--primary-40)" />,
                  text: t('onboarding.consent.rowNoServer'),
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
                {t('onboarding.consent.consent')}
              </span>
            </label>

            <Button fullWidth onClick={() => setStep('llm')} disabled={!consentChecked}>
              {t('onboarding.consent.continue')}
            </Button>
            <button
              onClick={() => void handleSkip(false)}
              style={{ display: 'block', width: '100%', marginTop: '12px', padding: '12px', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
            >
              {t('onboarding.consent.skip')}
            </button>
          </div>
        )}

        {/* ── LLM step ──────────────────────────────────────────────── */}
        {step === 'llm' && (
          <div>
            <button
              onClick={() => setStep('consent')}
              style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '24px' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Key size={24} color="var(--primary-40)" />
              <h2>{t('onboarding.llm.title')}</h2>
            </div>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px' }}>
              {t('onboarding.llm.intro')}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>{t('onboarding.llm.providerLabel')}</label>
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
                {t('onboarding.llm.apiKeyLabel')} {provider === 'local' && <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>{t('onboarding.llm.apiKeyOptional')}</span>}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--surface-variant)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <Zap size={16} color="var(--muted-foreground)" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'local' ? t('onboarding.llm.apiKeyPlaceholderLocal') : t('onboarding.llm.apiKeyPlaceholderCloud')}
                  style={{ flex: 1, background: 'none', color: 'var(--foreground)' }}
                />
              </div>
              {/* §2.2 note: In native builds, use iOS Keychain / Android Keystore to store this key */}
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '6px' }}>
                {t('onboarding.llm.apiKeyHint')}
              </p>
            </div>

            <Button fullWidth onClick={() => void handleContinue()} disabled={isSaving}>
              {isSaving ? t('onboarding.llm.saving') : t('onboarding.llm.continue')}
            </Button>
            <button
              onClick={() => void handleSkip(true)}
              style={{ display: 'block', width: '100%', marginTop: '12px', padding: '12px', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}
            >
              {t('onboarding.llm.skip')}
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
