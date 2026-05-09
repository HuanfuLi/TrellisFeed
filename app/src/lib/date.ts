import { t, getCurrentLocale } from './i18n-leaf.ts';
import type { SupportedLocale } from '../types';

// ─── Locale-aware date/greeting (D-11) ────────────────────────────────────────
// Reads the active locale via the i18n-leaf shim (Phase 37 — TECHDEBT-01),
// which delegates to the i18next singleton in production and to identity
// defaults under `node --test`. INTL_LOCALE maps our bare locale codes to the
// BCP-47 tag Intl wants (zh → zh-CN so Intl uses Simplified Chinese month
// names). This module imports the leaf shim (not '../locales/index.ts') so
// Node 25's `node --test` can exercise it without triggering the JSON
// import-attribute error on {en,zh,es,ja}.json.
const INTL_LOCALE: Record<SupportedLocale, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  es: 'es-ES',
  ja: 'ja-JP',
};

export function currentIntlLocale(): string {
  const lng = getCurrentLocale() as SupportedLocale;
  const locale: SupportedLocale = lng in INTL_LOCALE ? lng : 'en';
  return INTL_LOCALE[locale];
}

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(currentIntlLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isToday(date: string): boolean {
  return date === today();
}

// Parse a YYYY-MM-DD string using the local-time multi-arg constructor.
// This avoids browser/platform inconsistencies with ISO date strings:
//   - "YYYY-MM-DD" (date-only) is parsed as UTC midnight by spec → off-by-one in UTC+ zones
//   - "YYYY-MM-DDTHH:mm:ss" (no tz offset) is *supposed* to be local, but older iOS Safari
//     treated it as UTC.  The multi-arg constructor is always local on every platform.
function parseDateLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const dt = parseDateLocal(date);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(date: string): string {
  if (isToday(date)) return t('common.today');
  const dt = parseDateLocal(date);
  return dt.toLocaleDateString(currentIntlLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('common.greeting.morning');
  if (hour < 17) return t('common.greeting.afternoon');
  return t('common.greeting.evening');
}
