// Wave 0 scaffold (55-01); turned green by 55-02.
//
// embed-cache (Phase 55 D-07) — in-memory session embedding cache.
// Asserts: same text+model -> cache hit (fetch once), different model -> miss,
// getCachedEmbedding returns a hit after embedText.
//
// The cache exports (clearEmbedCache, getCachedEmbedding) and the cache wrap of
// embedText do NOT exist yet — the 55-02 executor adds them. This scaffold gates
// the body behind a guarded import so the file PARSES and RUNS under node --test
// (the suite reports as skipped/red pre-implementation, never an unhandled
// rejection that aborts the runner). 55-02 removes the guard.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// localStorage shim (verbatim from filter-classifier.unit.test.mjs lines 29-43).
const _store = new Map();
globalThis.localStorage = {
  getItem(k) {
    return _store.has(k) ? _store.get(k) : null;
  },
  setItem(k, v) {
    _store.set(k, String(v));
  },
  removeItem(k) {
    _store.delete(k);
  },
  clear() {
    _store.clear();
  },
};

// Stub fetch so embedText network calls return a deterministic vector + counter.
let _fetchCallCount = 0;
globalThis.fetch = async () => {
  _fetchCallCount += 1;
  return {
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
  };
};

const baseCfg = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  apiKey: 'k',
  dimensions: 256,
  baseUrl: '',
  isConfigured: true,
};

// Guarded import: clearEmbedCache / getCachedEmbedding do not exist until 55-02.
let mod = null;
let importError = null;
try {
  mod = await import('../../src/providers/embedding/index.ts');
} catch (err) {
  importError = err;
}

const cacheReady =
  mod &&
  typeof mod.embedText === 'function' &&
  typeof mod.clearEmbedCache === 'function' &&
  typeof mod.getCachedEmbedding === 'function';

describe('embed-cache (Phase 55 D-07)', () => {
  it('embed-cache exports exist (clearEmbedCache + getCachedEmbedding) — RED until 55-02', () => {
    assert.ok(!importError, `embedding provider import must not throw: ${importError}`);
    assert.ok(
      cacheReady,
      'clearEmbedCache + getCachedEmbedding must be exported from providers/embedding (added by 55-02)',
    );
  });

  it('same text + model -> cache hit, fetch called once', { skip: !cacheReady }, async () => {
    const { embedText, clearEmbedCache } = mod;
    clearEmbedCache();
    _fetchCallCount = 0;
    await embedText('hello world', baseCfg);
    await embedText('hello world', baseCfg);
    assert.equal(_fetchCallCount, 1, 'fetch must be called exactly once for identical text+model');
  });

  it('different model -> cache miss', { skip: !cacheReady }, async () => {
    const { embedText, clearEmbedCache } = mod;
    clearEmbedCache();
    _fetchCallCount = 0;
    const cfgA = { ...baseCfg, model: 'text-embedding-3-small' };
    const cfgB = { ...baseCfg, model: 'text-embedding-3-large' };
    await embedText('hello', cfgA);
    await embedText('hello', cfgB);
    assert.equal(_fetchCallCount, 2, 'different model must not hit cache');
  });

  it('getCachedEmbedding returns hit after embedText call', { skip: !cacheReady }, async () => {
    const { embedText, clearEmbedCache, getCachedEmbedding } = mod;
    clearEmbedCache();
    await embedText('test', baseCfg);
    const hit = getCachedEmbedding('test', baseCfg);
    assert.ok(Array.isArray(hit), 'getCachedEmbedding must return vector after embedText');
  });
});
