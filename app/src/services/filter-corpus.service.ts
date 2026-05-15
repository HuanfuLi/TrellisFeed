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

// ─── Public exports ──────────────────────────────────────────────────────────

/**
 * Cache-schema version for this loader. Bump when the FilterCorpusCache
 * shape changes; old payloads will be discarded as stale.
 */
export const FILTER_CORPUS_VERSION = 1;

/**
 * localStorage key for the embedded corpus cache. Single key for the whole
 * app — the (provider, model) discriminator lives INSIDE the payload, so
 * a settings change overwrites cleanly.
 */
export const FILTER_CORPUS_CACHE_KEY = 'trellis_filter_corpus_emb_v1';

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
