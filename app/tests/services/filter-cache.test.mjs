// Phase 47 Plan 02 Task 1 — filter-corpus.service.ts cache invalidation tests.
//
// Guards the (provider, model)-keyed cache discipline (D-10, RESEARCH §"Corpus
// Cache"). The cache key is shape-discriminated by payload-internal `provider`
// + `model` + `corpusVersion` + cache-schema `version` so a settings change
// or corpus bump invalidates the cached vectors cleanly. Without this guard
// (Pitfall 2 — silent vector-space corruption), a user switching from OpenAI
// to Google embeddings would compare new query vectors against old OpenAI
// vectors, with cosine values from a fundamentally different vector space.
//
// Test flow:
//   1. Inline-register the filter mock loader. This rewrites the
//      `../providers/embedding` import inside filter-corpus.service.ts to
//      point at `_filter-mock-embedding.mjs`, which exports the same
//      `embedText` + `cosine` API plus an `embedSpy` invocation counter.
//   2. Stub localStorage in globalThis (filter-corpus uses
//      `localStorage.getItem` / `setItem` for the cache).
//   3. Dynamic-import the service-under-test AFTER the loader is registered.
//   4. Behavioral assertions — invocation count tracks cache hit/miss.
//
// Mirrors `app/tests/services/refill-mutex.test.mjs` scaffold (leaf-module
// discipline test analog) per 47-PATTERNS.md §"app/tests/services/filter-cache.test.mjs".

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { register } from 'node:module';

// CRITICAL: register the loader BEFORE the first dynamic import below.
register('./_filter-mock-loader.mjs', import.meta.url);

// Minimal localStorage shim — filter-corpus.service.ts caches the embedded
// payload under `trellis_filter_corpus_emb_v1`. The shim is in-process and
// resets between tests via `globalThis.localStorage.clear()`.
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
  get length() {
    return _store.size;
  },
  key(i) {
    return [..._store.keys()][i] ?? null;
  },
};

const { loadCorpusEmbeddings, FILTER_CORPUS_CACHE_KEY, FILTER_CORPUS_VERSION } = await import(
  '../../src/services/filter-corpus.service.ts'
);
const { embedSpy } = await import('./_filter-mock-embedding.mjs');

// Read the corpus directly so tests assert against the real entry count.
const corpus = JSON.parse(
  await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../../src/data/filter-corpus.json', import.meta.url), 'utf-8'),
  ),
);
const CORPUS_LEN = corpus.entries.length;

const OPENAI_CFG = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  isConfigured: true,
};
const GOOGLE_CFG = {
  provider: 'google',
  model: 'text-embedding-004',
  isConfigured: true,
};
const OPENAI_DIFFERENT_MODEL = {
  provider: 'openai',
  model: 'text-embedding-3-large',
  isConfigured: true,
};

describe('filter-corpus.service.ts — cache invalidation (Phase 47 Plan 02 Task 1)', () => {
  beforeEach(() => {
    embedSpy.reset();
    _store.clear();
  });

  it('Test 1 — cold cache: first call invokes embedText for every corpus entry', async () => {
    const result = await loadCorpusEmbeddings(OPENAI_CFG);

    assert.equal(
      embedSpy.callCount,
      CORPUS_LEN,
      `cold cache must embed every corpus entry once — expected ${CORPUS_LEN}, got ${embedSpy.callCount}`,
    );
    assert.equal(
      result.length,
      CORPUS_LEN,
      `loadCorpusEmbeddings must return one entry per corpus row — expected ${CORPUS_LEN}, got ${result.length}`,
    );
    // Each entry has the documented shape.
    for (const entry of result) {
      assert.equal(typeof entry.id, 'string');
      assert.ok(['on-topic', 'off-topic', 'malicious'].includes(entry.label));
      assert.equal(typeof entry.text, 'string');
      assert.ok(Array.isArray(entry.vector) && entry.vector.length > 0);
    }
  });

  it('Test 2 — warm cache: same (provider, model) skips embedText', async () => {
    await loadCorpusEmbeddings(OPENAI_CFG);
    const after_first = embedSpy.callCount;
    assert.equal(after_first, CORPUS_LEN, 'sanity: cold cache embedded all entries');

    await loadCorpusEmbeddings(OPENAI_CFG);
    assert.equal(
      embedSpy.callCount,
      after_first,
      `warm cache (same provider, same model) must NOT re-embed — invocation count went from ${after_first} to ${embedSpy.callCount}`,
    );
  });

  it('Test 3 — provider mismatch invalidates cache', async () => {
    await loadCorpusEmbeddings(OPENAI_CFG);
    const after_openai = embedSpy.callCount;

    await loadCorpusEmbeddings(GOOGLE_CFG);
    assert.equal(
      embedSpy.callCount,
      after_openai + CORPUS_LEN,
      `provider switch must re-embed — expected ${after_openai + CORPUS_LEN}, got ${embedSpy.callCount} (Pitfall 2 guard)`,
    );
  });

  it('Test 4 — model mismatch invalidates cache', async () => {
    await loadCorpusEmbeddings(OPENAI_CFG);
    const after_first = embedSpy.callCount;

    await loadCorpusEmbeddings(OPENAI_DIFFERENT_MODEL);
    assert.equal(
      embedSpy.callCount,
      after_first + CORPUS_LEN,
      `model switch (same provider) must re-embed — expected ${after_first + CORPUS_LEN}, got ${embedSpy.callCount} (Pitfall 2 guard)`,
    );
  });

  it('Test 5 — corrupted cache JSON triggers re-embed without throwing', async () => {
    _store.set(FILTER_CORPUS_CACHE_KEY, '{not valid json');
    let threw = false;
    try {
      await loadCorpusEmbeddings(OPENAI_CFG);
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, false, 'corrupted cache JSON must not throw — loader recovers by re-embedding');
    assert.equal(
      embedSpy.callCount,
      CORPUS_LEN,
      `corrupted-cache recovery must re-embed all entries — got ${embedSpy.callCount}`,
    );
  });

  it('Test 6 — cache schema-version mismatch triggers re-embed', async () => {
    // Manually plant a payload with an obsolete schema version. The loader
    // must discard it and re-embed (allows future schema migrations).
    const stalePayload = {
      version: 99, // not the current 1
      corpusVersion: FILTER_CORPUS_VERSION,
      provider: OPENAI_CFG.provider,
      model: OPENAI_CFG.model,
      generatedAt: Date.now(),
      entries: [],
    };
    _store.set(FILTER_CORPUS_CACHE_KEY, JSON.stringify(stalePayload));

    await loadCorpusEmbeddings(OPENAI_CFG);
    assert.equal(
      embedSpy.callCount,
      CORPUS_LEN,
      `obsolete schema-version must trigger re-embed — got ${embedSpy.callCount}`,
    );
  });

  it('Cache payload shape: localStorage write is valid JSON with documented top-level keys', async () => {
    await loadCorpusEmbeddings(OPENAI_CFG);
    const raw = _store.get(FILTER_CORPUS_CACHE_KEY);
    assert.ok(typeof raw === 'string' && raw.length > 0, 'cache must persist to localStorage on cold-fill');

    const parsed = JSON.parse(raw);
    const expectedKeys = ['version', 'corpusVersion', 'provider', 'model', 'generatedAt', 'entries'];
    for (const key of expectedKeys) {
      assert.ok(key in parsed, `cache payload must include top-level key '${key}'`);
    }
    assert.equal(parsed.version, 1, 'cache schema version must be 1');
    assert.equal(parsed.corpusVersion, FILTER_CORPUS_VERSION);
    assert.equal(parsed.provider, OPENAI_CFG.provider);
    assert.equal(parsed.model, OPENAI_CFG.model);
    assert.equal(typeof parsed.generatedAt, 'number');
    assert.ok(Array.isArray(parsed.entries) && parsed.entries.length === CORPUS_LEN);
  });
});
