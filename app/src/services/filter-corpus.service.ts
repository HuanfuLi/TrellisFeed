// Filter corpus loader + (provider, model)-keyed embedding cache
// (Phase 47 leaf extraction).
//
// This is a LEAF module: it has zero transitive deps on settings.service /
// llm-provider / locales bundles, so node --test can import it directly
// without hitting Node ESM's ERR_IMPORT_ATTRIBUTE_MISSING on en.json.
// (question-filter.service.ts re-uses this loader so the runtime classifier
// path shares its semantics — this file gives tests a clean import surface.)
//
// See CLAUDE.md i18n section "Phase 27 locale tests avoid the JSON-import-
// attribute failure chain by importing i18next directly; follow the same
// pattern for any new pure-logic helpers."
//
// ─── Why a payload-internal (provider, model) discriminator ─────────────────
//
// Per D-10, the cache key is bound to (provider, model). A user switching
// from OpenAI to Google embeddings (or even text-embedding-3-small to
// text-embedding-3-large within OpenAI) puts the new query vector in a
// fundamentally different vector space — comparing it against cached
// vectors from the prior provider/model produces meaningless cosine values
// (RESEARCH §"Common Pitfalls" Pitfall 2 — silent vector-space corruption).
//
// We use ONE storage key (FILTER_CORPUS_CACHE_KEY) with the discriminator
// stored INSIDE the payload, not per-(provider, model) keys. Why: a config
// change OVERWRITES the cache rather than accumulating stale entries.
// Local-first storage is finite; one valid cache beats N orphaned ones.
//
// Quota handling: writes are wrapped in try/catch — a QuotaExceededError
// just warns and falls back to in-memory only (next call re-embeds).
// Classifier still works, just slower until storage frees up.

import type { EmbeddingConfig } from '../types/index.ts';
import { embedText } from '../providers/embedding/index.ts';
import corpus from '../data/filter-corpus.json' with { type: 'json' };

// ─── Boot pre-warm guard (Phase 55.1-07, GAP-C / BUGFIX-06) ──────────────────
// Single-flight latch so concurrent boot callers (and a boot pre-warm racing
// the user's first ask) share ONE warm-up Promise instead of N corpus embeds.
let _prewarmInFlight: Promise<void> | null = null;

// ─── Public exports ──────────────────────────────────────────────────────────

/**
 * Cache-schema version for this loader. Bump when the FilterCorpusCache
 * shape changes OR the corpus content changes; old payloads will be discarded
 * as stale. v2 (2026-05-21): added 20 real-world off-topic exemplars
 * (off-en-041..060 — weather/food/sports/logistics/travel/tasks) to close the
 * greeting-only off-topic coverage gap found in Phase 55 threshold tuning.
 */
export const FILTER_CORPUS_VERSION = 2;

/**
 * localStorage key for the embedded corpus cache. Single key for the whole
 * app — the (provider, model) discriminator lives INSIDE the payload, so
 * a settings change overwrites cleanly.
 */
export const FILTER_CORPUS_CACHE_KEY = 'questiontrace_filter_corpus_emb_v1';

export type FilterLabel = 'on-topic' | 'off-topic' | 'malicious';

export interface FilterCorpusEntry {
  id: string;
  label: FilterLabel;
  text: string;
  vector: number[];
}

// ─── Internal cache payload type (NOT exported) ──────────────────────────────

interface FilterCorpusCache {
  version: 1;
  corpusVersion: number;
  provider: string;
  model: string;
  generatedAt: number;
  entries: FilterCorpusEntry[];
}

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Load the filter corpus with cached embeddings under (provider, model).
 *
 * On cache hit (matching version + corpusVersion + provider + model):
 *   - Returns the cached `FilterCorpusEntry[]` immediately. Zero embedText calls.
 *
 * On cache miss (cold cache, corrupted JSON, schema/corpus/provider/model
 * mismatch):
 *   - Sequentially embeds every corpus entry via the user's configured
 *     embedding provider.
 *   - Persists the resulting payload to localStorage.
 *   - Returns the embedded entries.
 *
 * Errors are absorbed defensively: a QuotaExceededError on the localStorage
 * write warns and returns the in-memory entries (next call will re-embed).
 *
 * Cost: cold cache pays N sequential embedText calls (~5s for 100 entries
 * over OpenAI cloud). Subsequent calls are O(1) localStorage read + JSON.parse.
 *
 * Caller (question-filter.service.ts:layer2Embedding) passes
 * `settingsService.getSync().embedding` — the embedding config is NOT
 * imported here so the loader stays leaf.
 */
export async function loadCorpusEmbeddings(
  embConfig: EmbeddingConfig,
): Promise<FilterCorpusEntry[]> {
  // ── Cache lookup ──────────────────────────────────────────────────────
  try {
    const raw = localStorage.getItem(FILTER_CORPUS_CACHE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<FilterCorpusCache>;
      if (
        parsed?.version === 1 &&
        parsed.corpusVersion === FILTER_CORPUS_VERSION &&
        parsed.provider === embConfig.provider &&
        parsed.model === embConfig.model &&
        Array.isArray(parsed.entries)
      ) {
        return parsed.entries as FilterCorpusEntry[];
      }
    }
  } catch {
    // Corrupted JSON or storage read failure — fall through to re-embed.
  }

  // ── Cache miss: embed every corpus entry sequentially ─────────────────
  // Sequential (not Promise.all) to avoid burst-rate-limiting against the
  // user's embedding provider. ~100 entries × ~50ms cloud-OpenAI = ~5s
  // first-ask latency. Acceptable trade per RESEARCH §"First-ask cost".
  const entries: FilterCorpusEntry[] = [];
  for (const entry of corpus.entries) {
    const vector = await embedText(entry.text, embConfig);
    entries.push({
      id: entry.id,
      label: entry.label as FilterLabel,
      text: entry.text,
      vector,
    });
  }

  // ── Persist payload (best-effort) ─────────────────────────────────────
  const payload: FilterCorpusCache = {
    version: 1,
    corpusVersion: FILTER_CORPUS_VERSION,
    provider: embConfig.provider,
    model: embConfig.model,
    generatedAt: Date.now(),
    entries,
  };
  try {
    localStorage.setItem(FILTER_CORPUS_CACHE_KEY, JSON.stringify(payload));
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn(
        '[Trellis] filter corpus cache write failed (storage full); will re-embed on next ask',
      );
    } else {
      // Non-quota error — also non-fatal; we still return the in-memory
      // entries. Logged at warn level for diagnostic visibility.
      console.warn(
        '[Trellis] filter corpus cache write failed:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  return entries;
}

// ─── Boot pre-warm (Phase 55.1-07, GAP-C / BUGFIX-06 — MEASURED FIX) ──────────
//
// MEASUREMENT (55.1-07 Task 1, scripts/profile-cold-start.mjs): on a COLD
// filter-corpus cache, `filterQuestion` dominated the in-process first-ask cost
// at ~6875ms / 89.6% — the 124 SEQUENTIAL corpus embeds (filter-corpus.json)
// it pays inside `loadCorpusEmbeddings`. The malicious RAW-ARGMAX pre-gate runs
// `filterQuestion` BEFORE `chatStream` on every ask, so on the FIRST ask after a
// cold launch this serial embed loop blocks the entire roundtrip → the device's
// ~1-min first-response stall (GAP-C).
//
// FIX: warm the SAME `loadCorpusEmbeddings` cache at app boot, fire-and-forget,
// so the first ask hits the warm localStorage cache (O(1) read) instead of the
// 124-embed cold path. The filter→chatStream order and the RAW-ARGMAX gate are
// untouched — only WHEN the corpus is embedded changes (boot vs first-ask).
//
// Invariants (load-bearing — see CLAUDE.md):
//   - NON-BLOCKING: returns a Promise the caller does NOT await on the render
//     path; App.tsx fires it without gating first paint.
//   - KEY-ABSENT / OFFLINE-SAFE: no-ops when embedding is unconfigured; swallows
//     any embed error (it's a best-effort warm-up — the first ask still works,
//     just paying the cold cost as before if the warm-up failed).
//   - SINGLE-FLIGHT: `_prewarmInFlight` dedups concurrent callers AND a boot
//     warm-up racing the user's very-first ask, so the corpus is embedded once.
//
/**
 * Best-effort, non-blocking boot warm-up of the filter-corpus embedding cache.
 *
 * Idempotent: `loadCorpusEmbeddings` returns immediately on a warm cache, so
 * repeated calls (and the post-warm first ask) cost an O(1) localStorage read.
 * Returns a Promise for testability; callers on the render path MUST NOT await
 * it (App.tsx fires it fire-and-forget).
 *
 * @param embConfig the user's embedding config (settingsService.getSync().embedding)
 */
export function prewarmFilterCorpus(embConfig: EmbeddingConfig): Promise<void> {
  // Key-absent guard: never attempt embeds without a configured provider/key.
  // Mirrors question-filter.service.ts D-12 graceful-degradation behavior.
  if (!embConfig?.isConfigured) return Promise.resolve();

  // Single-flight: share one warm-up Promise across concurrent callers.
  if (_prewarmInFlight) return _prewarmInFlight;

  _prewarmInFlight = (async () => {
    try {
      // Populates FILTER_CORPUS_CACHE_KEY exactly as the first ask would, but at
      // boot. On a warm cache this is an O(1) read + early return (zero embeds).
      await loadCorpusEmbeddings(embConfig);
    } catch (e: unknown) {
      // Offline / missing key / quota — best-effort only. The first ask still
      // works (it re-attempts the embed and falls back to on-topic on failure
      // per D-12). Logged at warn for diagnostic visibility.
      console.warn(
        '[Trellis] filter-corpus boot pre-warm failed (non-fatal):',
        e instanceof Error ? e.message : e,
      );
    } finally {
      // Release the latch so a later config change (clearEmbedCache + cache
      // invalidation) can re-warm under the new provider/model.
      _prewarmInFlight = null;
    }
  })();

  return _prewarmInFlight;
}

/** Test-only: resets the single-flight latch so a test can drive multiple warm-ups. */
export function _resetPrewarmLatch(): void {
  _prewarmInFlight = null;
}
