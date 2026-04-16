import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

// Initialize i18next singleton once (TTS provider reads i18next.language).
await i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
    zh: { translation: {} },
    es: { translation: {} },
    ja: { translation: {} },
  },
});

// Mock window.fetch + fetch on globalThis — synthesize() uses window.fetch,
// which in Node exists if we attach it to globalThis.window. We capture the
// request body so the test can assert the selected voice.
let captured;
const fakeFetch = async (_url, init) => {
  captured = JSON.parse(init.body);
  // minimal Response-ish shape — synthesize() calls .ok, .blob() on it
  return {
    ok: true,
    status: 200,
    async blob() {
      return { type: 'audio/mpeg' };
    },
    async text() {
      return '';
    },
  };
};
globalThis.window = globalThis.window ?? {};
globalThis.window.fetch = fakeFetch;
globalThis.fetch = fakeFetch;
globalThis.URL = globalThis.URL ?? {};
globalThis.URL.createObjectURL = () => 'blob://stub';

// Import AFTER shims are installed. The TTS provider is a clean leaf module
// with no JSON or extension-less .ts transitive imports, so node --test
// resolves it OK on Node 25 (verified manually during plan research).
const { synthesize } = await import('../../src/providers/tts/index.ts');

const baseConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com',
  voice: 'alloy',
  speed: 1.0,
  isConfigured: true,
};

test('zh: default voice (alloy) → nova (locale fallback)', async () => {
  await i18next.changeLanguage('zh');
  captured = undefined;
  await synthesize('hi', baseConfig);
  assert.equal(captured.voice, 'nova');
});

test('es: default voice (alloy) → nova (locale fallback)', async () => {
  await i18next.changeLanguage('es');
  captured = undefined;
  await synthesize('hi', baseConfig);
  assert.equal(captured.voice, 'nova');
});

test('ja: default voice (alloy) → nova (locale fallback)', async () => {
  await i18next.changeLanguage('ja');
  captured = undefined;
  await synthesize('hi', baseConfig);
  assert.equal(captured.voice, 'nova');
});

test('en: default voice (alloy) → alloy (unchanged)', async () => {
  await i18next.changeLanguage('en');
  captured = undefined;
  await synthesize('hi', baseConfig);
  assert.equal(captured.voice, 'alloy');
});

test('user override (echo) respected regardless of locale', async () => {
  await i18next.changeLanguage('ja');
  captured = undefined;
  await synthesize('hi', { ...baseConfig, voice: 'echo' });
  assert.equal(captured.voice, 'echo');
});

test('user override (shimmer) respected under zh', async () => {
  await i18next.changeLanguage('zh');
  captured = undefined;
  await synthesize('hi', { ...baseConfig, voice: 'shimmer' });
  assert.equal(captured.voice, 'shimmer');
});
