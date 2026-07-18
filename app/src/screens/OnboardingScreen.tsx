import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Brain, Shield, Smartphone, Cloud, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSettings } from '../state/useSettings';
import i18n from '../locales';
import { eventBus } from '../lib/event-bus';
import { prewarmFilterCorpus } from '../services/filter-corpus.service';
import { hasAffirmativeResearchConsent } from '../services/research-consent.service';
import { settingsService } from '../services/settings.service';
import { studyContextService } from '../services/study-context.service';
import type { SupportedLocale } from '../types';

type Step = 'welcome' | 'language' | 'consent';

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
  const [isSaving, setIsSaving] = useState(false);

  // Seed from the saved i18n preference. A fresh study install is always English;
  // device/browser locale never silently changes the assigned research shell.
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(() => {
    const cur = i18n.language;
    return (['en', 'zh', 'es', 'ja'] as const).includes(cur as SupportedLocale)
      ? (cur as SupportedLocale)
      : 'en';
  });

  // Research credentials are supplied by the study build; participants only consent.
  const handleContinue = async () => {
    setIsSaving(true);
    await set('preferences', {
      theme: 'system',
      locale: selectedLocale,
      language: selectedLocale,   // legacy back-compat; matches locale
      onboardingCompleted: true,
      aiConsentGiven: true,
    });
    const settings = settingsService.getSync();
    if (studyContextService.isBound() && hasAffirmativeResearchConsent()
      && settings.preferences.aiConsentGiven) {
      void prewarmFilterCorpus(settings.embedding);
    }
    setIsSaving(false);
    navigate('/home', { replace: true });
  };

  // Confirm the language selection: applies instantly, persists, emits LOCALE_CHANGED.
  const handleConfirmLanguage = async () => {
    await i18n.changeLanguage(selectedLocale);
    eventBus.emit({ type: 'LOCALE_CHANGED', payload: { locale: selectedLocale } });
    setStep('consent');
  };

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

            <Button fullWidth onClick={() => void handleContinue()} disabled={!consentChecked || isSaving} loading={isSaving}>
              {t('onboarding.consent.continue')}
            </Button>
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
