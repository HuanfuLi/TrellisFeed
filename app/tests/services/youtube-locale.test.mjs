import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

// Initialize i18next singleton once — youtube.service reads i18next.language.
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

// localStorage shim so settingsService.getSync() finds a youtube apiKey.
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
store.set(
  'echolearn_settings',
  JSON.stringify({ youtube: { apiKey: 'test-key' } }),
);

// Capture YouTube Data API URL on fetch.
let capturedUrl = '';
globalThis.fetch = async (url) => {
  capturedUrl = typeof url === 'string' ? url : String(url);
  return {
    ok: true,
    status: 200,
    async text() {
      return '';
    },
    async json() {
      return { items: [] };
    },
  };
};

// NOTE: youtube.service.ts imports chatCompletion from providers/llm/index.ts,
// which transitively imports services/token-usage.service without file
// extensions — blocked by Node 25 TS-stripping (see deferred-items.md). So
// this test CANNOT import the whole youtube.service module; instead it
// imports a small pure URL-builder. The production URL construction is
// wrapped in an exported helper (`buildYoutubeSearchUrl`) so we can verify
// it here without pulling the transitively-broken chain.
const { buildYoutubeSearchUrl } = await import(
  '../../src/services/youtube-locale-url.ts'
);

test('zh → URL contains hl=zh-CN, regionCode=CN, relevanceLanguage=zh', async () => {
  await i18next.changeLanguage('zh');
  const url = buildYoutubeSearchUrl({
    query: 'test',
    maxResults: 5,
    apiKey: 'test-key',
  });
  capturedUrl = url;
  assert.match(capturedUrl, /hl=zh-CN/);
  assert.match(capturedUrl, /regionCode=CN/);
  assert.match(capturedUrl, /relevanceLanguage=zh/);
});

test('en → URL contains hl=en-US, regionCode=US, relevanceLanguage=en', async () => {
  await i18next.changeLanguage('en');
  const url = buildYoutubeSearchUrl({
    query: 'test',
    maxResults: 5,
    apiKey: 'test-key',
  });
  capturedUrl = url;
  assert.match(capturedUrl, /hl=en-US/);
  assert.match(capturedUrl, /regionCode=US/);
  assert.match(capturedUrl, /relevanceLanguage=en/);
});

test('ja → URL contains hl=ja, regionCode=JP, relevanceLanguage=ja', async () => {
  await i18next.changeLanguage('ja');
  const url = buildYoutubeSearchUrl({
    query: 'test',
    maxResults: 5,
    apiKey: 'test-key',
  });
  capturedUrl = url;
  assert.match(capturedUrl, /hl=ja(?!-)/); // bare ja (not zh-Hans, not es-419)
  assert.match(capturedUrl, /regionCode=JP/);
  assert.match(capturedUrl, /relevanceLanguage=ja/);
});

test('es → URL contains hl=es, regionCode=ES, relevanceLanguage=es', async () => {
  await i18next.changeLanguage('es');
  const url = buildYoutubeSearchUrl({
    query: 'test',
    maxResults: 5,
    apiKey: 'test-key',
  });
  capturedUrl = url;
  assert.match(capturedUrl, /hl=es(?!-)/);
  assert.match(capturedUrl, /regionCode=ES/);
  assert.match(capturedUrl, /relevanceLanguage=es/);
});

test('query + apiKey + safeSearch still preserved alongside locale params', async () => {
  await i18next.changeLanguage('zh');
  const url = buildYoutubeSearchUrl({
    query: 'quantum computing',
    maxResults: 7,
    apiKey: 'test-key',
  });
  assert.match(url, /q=quantum%20computing/);
  assert.match(url, /maxResults=7/);
  assert.match(url, /safeSearch=strict/);
  assert.match(url, /key=test-key/);
});
