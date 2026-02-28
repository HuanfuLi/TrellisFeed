import type { AppSettings } from '../types';

type ThemePref = AppSettings['preferences']['theme'];

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark');
}
