import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain, Image, Radio, Shield, Palette, ChevronRight, RotateCcw, Languages } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../locales';
import type { SupportedLocale } from '../types';
import { eventBus } from '../lib/event-bus';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { settingsService } from '../services/settings.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { applyTheme } from '../lib/theme';
import type { AppSettings } from '../types';

function MenuRow({ icon, label, description, onClick }: { icon: React.ReactNode; label: string; description?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="active-squish"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        padding: '14px 4px',
        borderBottom: '1px solid var(--border)',
        background: 'none',
        border: 'none',
        borderBottomStyle: 'solid',
        borderBottomWidth: '1px',
        borderBottomColor: 'var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ color: 'var(--primary-40)', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>{label}</p>
        {description && <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>{description}</p>}
      </div>
      <ChevronRight size={18} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
    </button>
  );
}

function SettingRowInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500 }}>{label}</p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export function SettingsScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const navigate = useNavigate();

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

  const [theme, setTheme] = useState<AppSettings['preferences']['theme']>(() => settingsService.getSync().preferences.theme);

  const handleReset = async () => {
    if (confirm(t('settings.confirm.reset'))) {
      await settingsService.reset();
      toast(t('settings.toast.settingsReset'), 'success');
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>
      <Header title={t('settings.title')} />

      {/* Language & Theme — inline, always visible */}
      <Card style={{ marginBottom: '16px' }}>
        <SettingRowInline label={t('settings.fields.language')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Languages size={16} style={{ color: 'var(--muted-foreground)' }} />
            <select
              value={locale}
              onChange={(e) => void handleLocaleChange(e.target.value as SupportedLocale)}
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
              <option value="en">English</option>
              <option value="zh">简体中文</option>
              <option value="es">Español</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </SettingRowInline>
        <SettingRowInline label={t('settings.fields.theme')}>
          <select
            value={theme}
            onChange={async (e) => {
              const nextTheme = e.target.value as AppSettings['preferences']['theme'];
              setTheme(nextTheme);
              applyTheme(nextTheme);
              const prefs = settingsService.getSync().preferences;
              await settingsService.set('preferences', { ...prefs, theme: nextTheme });
            }}
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
            <option value="light">{t('settings.themes.light')}</option>
            <option value="dark">{t('settings.themes.dark')}</option>
            <option value="system">{t('settings.themes.system')}</option>
          </select>
        </SettingRowInline>
      </Card>

      {/* Navigation rows */}
      <Card style={{ marginBottom: '16px' }}>
        <MenuRow
          icon={<Brain size={20} />}
          label={t('settings.menu.aiModels')}
          description={t('settings.menu.aiModelsDesc')}
          onClick={() => navigate('/settings/ai')}
        />
        <MenuRow
          icon={<Image size={20} />}
          label={t('settings.menu.contentSources')}
          description={t('settings.menu.contentSourcesDesc')}
          onClick={() => navigate('/settings/content')}
        />
        <MenuRow
          icon={<Radio size={20} />}
          label={t('settings.menu.features')}
          description={t('settings.menu.featuresDesc')}
          onClick={() => navigate('/settings/features')}
        />
        <MenuRow
          icon={<Shield size={20} />}
          label={t('settings.menu.dataPrivacy')}
          description={t('settings.menu.dataPrivacyDesc')}
          onClick={() => navigate('/settings/data')}
        />
      </Card>

      {/* About & Reset */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
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
