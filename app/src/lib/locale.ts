import type { SupportedLocale } from '../types';

// Duplicated from `locales/index.ts` to break circular import (locales/index.ts → lib/locale.ts → locales/index.ts).
// Must stay in lockstep with `SUPPORTED_LOCALES` there.
const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'zh', 'es', 'ja'];

export function normalizeLocale(raw: string | undefined | null): SupportedLocale {
  if (!raw) return 'en';
  const base = raw.toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as SupportedLocale) : 'en';
}

/**
 * Called SYNCHRONOUSLY at i18n init time.
 * Priority: (1) saved preference, (2) deterministic research default 'en'.
 * Device/browser locale is intentionally ignored on first launch; participants
 * may explicitly select any supported UI language during onboarding or Settings.
 */
export function detectInitialLocale(savedPref: SupportedLocale | undefined): SupportedLocale {
  if (savedPref) return savedPref;
  return 'en';
}
