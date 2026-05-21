// Phase 55.1-07 (GAP-C / BUGFIX-06) — cold-start fix invariant test.
//
// MEASURED stall (Task 1, scripts/profile-cold-start.mjs): on a COLD filter-
// corpus cache, `filterQuestion` dominates the in-process first-ask cost
// (~6875ms / 89.6%) — the 124 SEQUENTIAL corpus embeds it pays inside
// `loadCorpusEmbeddings`. Because the malicious RAW-ARGMAX pre-gate runs
// `filterQuestion` BEFORE `chatStream` on every ask, the first ask after a cold
// launch blocks the whole roundtrip on that serial embed loop (the device's
// ~1-min stall).
//
// FIX (Task 2): `prewarmFilterCorpus(embConfig)` warms the SAME
// `loadCorpusEmbeddings` cache at app boot, fire-and-forget. This test is the
// EXECUTING invariant — it drives the real code path and asserts behavior via
// an embed-call spy, NOT a source-read:
//
//   - After boot pre-warm, the FIRST ask's `loadCorpusEmbeddings` does ZERO
//     embeds (the cold 124-embed cost moved off the first-ask path → boot).
//   - Pre-warm NO-OPS when embedding is unconfigured (key-absent / offline-safe).
//   - Pre-warm is SINGLE-FLIGHT (concurrent boot callers share one warm-up; the
//     corpus is embedded once, not N times).
//
// Mirrors tests/services/filter-cache.test.mjs scaffold (same mock loader +
// localStorage shim + embedSpy).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { register } from 'node:module';
import fs from 'node:fs';

// CRITICAL: register the embedding mock loader BEFORE importing the SUT so the
// `../providers/embedding` import inside filter-corpus.service.ts routes to the
// spy. Once Node resolves the specifier the resolution is cached.
register('../services/_filter-mock-loader.mjs', import.meta.url);

// In-process localStorage shim (filter-corpus caches under
// trellis_filter_corpus_emb_v1). Reset between tests.
const _store = new Map();
globalThis.localStorage = {
  getItem(k) { return _store.has(k) ? _store.get(k) : null; },
  setItem(k, v) { _store.set(k, String(v)); },
  removeItem(k) { _store.delete(k); },
  clear() { _store.clear(); },
  get length() { return _store.size; },
  key(i) { return [..._store.keys()][i] ?? null; },
};

const {
  prewarmFilterCorpus,
  loadCorpusEmbeddings,
  _resetPrewarmLatch,
} = await import('../../src/services/filter-corpus.service.ts');
const { embedSpy } = await import('../services/_filter-mock-embedding.mjs');

const corpus = JSON.parse(
  fs.readFileSync(new URL('../../src/data/filter-corpus.json', import.meta.url), 'utf-8'),
);
const CORPUS_LEN = corpus.entries.length;

const CONFIGURED = { provider: 'openai', model: 'text-embedding-3-small', isConfigured: true };
const UNCONFIGURED = { provider: 'openai', model: 'text-embedding-3-small', isConfigured: false };

describe('cold-start fix: filter-corpus boot pre-warm (Phase 55.1-07 GAP-C)', () => {
  beforeEach(() => {
    embedSpy.reset();
    _store.clear();
    _resetPrewarmLatch();
  });

  it('boot pre-warm embeds the corpus once, then the FIRST ask pays ZERO embeds (cold cost moved off first-ask path)', async () => {
    // ── Boot: warm the corpus cache (fire-and-forget in App.tsx; awaited here). ──
    await prewarmFilterCorpus(CONFIGURED);
    assert.equal(
      embedSpy.callCount,
      CORPUS_LEN,
      `boot pre-warm must embed every corpus entry once — expected ${CORPUS_LEN}, got ${embedSpy.callCount}`,
    );

    // ── First ask: filterQuestion → loadCorpusEmbeddings. With a warm cache it
    //    must do ZERO additional embeds (the measured cold 124-embed stall is gone). ──
    const before = embedSpy.callCount;
    await loadCorpusEmbeddings(CONFIGURED);
    assert.equal(
      embedSpy.callCount,
      before,
      `first ask after pre-warm must hit the warm cache (0 corpus embeds) — count went ${before} → ${embedSpy.callCount}`,
    );
  });

  it('NO-OP when embedding is unconfigured (key-absent / offline-safe)', async () => {
    await prewarmFilterCorpus(UNCONFIGURED);
    assert.equal(
      embedSpy.callCount,
      0,
      `unconfigured pre-warm must embed nothing — got ${embedSpy.callCount}`,
    );
    // And it resolves (does not throw / hang).
    await prewarmFilterCorpus(undefined);
    assert.equal(embedSpy.callCount, 0, 'undefined config pre-warm must also be a no-op');
  });

  it('SINGLE-FLIGHT: concurrent pre-warm callers share ONE warm-up (corpus embedded once)', async () => {
    // Fire several concurrent pre-warms (e.g. a boot warm-up racing the first
    // ask). They must share the in-flight Promise, embedding the corpus once.
    await Promise.all([
      prewarmFilterCorpus(CONFIGURED),
      prewarmFilterCorpus(CONFIGURED),
      prewarmFilterCorpus(CONFIGURED),
    ]);
    assert.equal(
      embedSpy.callCount,
      CORPUS_LEN,
      `concurrent pre-warms must embed the corpus exactly once — expected ${CORPUS_LEN}, got ${embedSpy.callCount}`,
    );
  });

  it('warm-up is best-effort: a populated cache makes pre-warm an O(1) no-embed read', async () => {
    // Pre-populate the cache (first boot).
    await prewarmFilterCorpus(CONFIGURED);
    const after_first = embedSpy.callCount;
    assert.equal(after_first, CORPUS_LEN, 'sanity: cold pre-warm embedded the corpus');

    // A second boot (latch released) must NOT re-embed — the cache is warm.
    _resetPrewarmLatch();
    await prewarmFilterCorpus(CONFIGURED);
    assert.equal(
      embedSpy.callCount,
      after_first,
      `re-running pre-warm on a warm cache must not re-embed — count went ${after_first} → ${embedSpy.callCount}`,
    );
  });
});
