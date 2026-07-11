import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../locales';
import type { SupportedLocale } from '../types';
import { eventBus } from '../lib/event-bus';
import { Card } from '../components/ui/Card';
import { settingsService } from '../services/settings.service';
import { studyContextService } from '../services/study-context.service';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';

function SettingRowInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <p style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>{label}</p>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export function SettingsScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const accountId = studyContextService.getRequired().userId;
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    const current = i18nInstance.language;
    return (SUPPORTED_LOCALES as readonly string[]).includes(current)
      ? (current as SupportedLocale)
      : 'en';
  });

  const handleLocaleChange = async (next: SupportedLocale) => {
    await i18nInstance.changeLanguage(next);
    const preferences = settingsService.getSync().preferences;
    await settingsService.set('preferences', { ...preferences, locale: next, language: next });
    eventBus.emit({ type: 'LOCALE_CHANGED', payload: { locale: next } });
    setLocale(next);
  };

  return (
    <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>
      <Header title={t('settings.title')} />

      <Card>
        <SettingRowInline label={t('settings.fields.accountId')}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{accountId}</span>
        </SettingRowInline>
        <SettingRowInline label={t('settings.fields.language')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Languages size={16} aria-hidden="true" style={{ color: 'var(--muted-foreground)' }} />
            <select
              aria-label={t('settings.fields.language')}
              value={locale}
              onChange={(event) => void handleLocaleChange(event.target.value as SupportedLocale)}
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
      </Card>
    </div>
  );
}
