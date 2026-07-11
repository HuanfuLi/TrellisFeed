import assert from 'node:assert/strict';
import test from 'node:test';

// localStorage shim for Node — must be defined BEFORE the settings.service import
// since load() reads localStorage at module init time only if invoked.
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
  configurable: true,
  writable: true,
});

const { settingsService } = await import('../../src/services/settings.service.ts');
const { detectInitialLocale } = await import('../../src/lib/locale.ts');

test('locale round-trips through set/get', async () => {
  store.clear();
  const prefs = settingsService.getSync().preferences;
  await settingsService.set('preferences', { ...prefs, locale: 'zh' });
  assert.equal(settingsService.getSync().preferences.locale, 'zh');
});

test('legacy preferences.language migrates to locale on load', () => {
  store.clear();
  store.set(
    'questiontrace_settings',
    JSON.stringify({
      preferences: {
        theme: 'system',
        language: 'ja',
        onboardingCompleted: true,
      },
    }),
  );
  assert.equal(settingsService.getSync().preferences.locale, 'ja');
});

test('legacy language=en-US normalizes to locale=en', () => {
  store.clear();
  store.set(
    'questiontrace_settings',
    JSON.stringify({
      preferences: {
        theme: 'system',
        language: 'en-US',
        onboardingCompleted: true,
      },
    }),
  );
  assert.equal(settingsService.getSync().preferences.locale, 'en');
});

test('legacy language=ko-KR (unsupported) → locale=en', () => {
  store.clear();
  store.set(
    'questiontrace_settings',
    JSON.stringify({
      preferences: {
        theme: 'system',
        language: 'ko-KR',
        onboardingCompleted: true,
      },
    }),
  );
  assert.equal(settingsService.getSync().preferences.locale, 'en');
});

test('fresh install (no stored settings) → locale=en', () => {
  store.clear();
  assert.equal(settingsService.getSync().preferences.locale, 'en');
});

test('fresh install ignores a non-English navigator locale', () => {
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'zh-CN', languages: ['zh-CN', 'en-US'] },
    configurable: true,
  });
  try {
    assert.equal(detectInitialLocale(undefined), 'en');
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, 'navigator', { value: previousNavigator, configurable: true });
  }
});

test('a persisted supported locale still wins', () => {
  assert.equal(detectInitialLocale('ja'), 'ja');
});

test('stored locale wins over stored legacy language', () => {
  store.clear();
  store.set(
    'questiontrace_settings',
    JSON.stringify({
      preferences: {
        theme: 'system',
        locale: 'es',
        language: 'ja',
        onboardingCompleted: true,
      },
    }),
  );
  assert.equal(settingsService.getSync().preferences.locale, 'es');
});
