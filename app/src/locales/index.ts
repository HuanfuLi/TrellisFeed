import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';
import es from './es.json';
import ja from './ja.json';
import { detectInitialLocale } from '../lib/locale.ts';
import { settingsService } from '../services/settings.service.ts';

export const SUPPORTED_LOCALES = ['en', 'zh', 'es', 'ja'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// Human-readable names for LLM "Respond in {name}" directive (D-12)
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  es: 'Spanish',
  ja: 'Japanese',
};

const savedLocale = settingsService.getSync().preferences.locale;
const initial = detectInitialLocale(savedLocale);

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      es: { translation: es },
      ja: { translation: ja },
    },
    lng: initial,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, _ns, key) =>
          console.warn(
            `[i18n] missing key: ${key} (lng=${Array.isArray(lngs) ? lngs.join(',') : lngs})`,
          )
      : undefined,
  });

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-locale', initial);
  document.documentElement.lang = initial;
  i18n.on('languageChanged', (lng) => {
    document.documentElement.setAttribute('data-locale', lng);
    document.documentElement.lang = lng;
  });
}

export default i18n;
