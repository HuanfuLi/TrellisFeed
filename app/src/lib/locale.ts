import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
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
 * Priority: (1) saved preference, (2) navigator.language (sync on web), (3) default 'en'.
 * For native-device detection (async), use `detectDeviceLocale()`.
 */
export function detectInitialLocale(savedPref: SupportedLocale | undefined): SupportedLocale {
  if (savedPref) return savedPref;
  if (typeof navigator !== 'undefined' && navigator) {
    return normalizeLocale(navigator.language ?? navigator.languages?.[0]);
  }
  return 'en';
}

/** Native-device locale detection (async; for first-launch onboarding prefill). */
export async function detectDeviceLocale(): Promise<SupportedLocale> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Device.getLanguageCode();
      return normalizeLocale(value);
    }
  } catch {
    /* fall through to navigator */
  }
  return normalizeLocale(typeof navigator !== 'undefined' ? navigator.language : 'en');
}
