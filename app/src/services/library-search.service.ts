// Library search service — Phase 50 D-13 / D-14 / D-15.
//
// Pure-function wrapper around Fuse.js for the /saved (Library) screen's
// search bar. Encapsulates the load-bearing Fuse configuration so consumers
// (SavedScreen, CollectionDrillInScreen — plan 50-09) don't reach into
// Fuse internals or risk silently dropping the ignore-location knob.
//
// Leaf-module discipline (Phase 27/37 D-01 / D-08 + CLAUDE.md i18n rule):
//   - No JSON imports.
//   - No `react-i18next` import.
//   - No `lib/date.ts` import — date math is local pure functions so the
//     node --test loader does not pull i18next via lib/date's transitive
//     chain.
//   - Sync API. No localStorage. No event emission. No mutation.
//   - All exports are pure functions plus the FUSE_OPTIONS constant.
//
// Load-bearing rules (do NOT regress):
//   1. The ignore-location knob in FUSE_OPTIONS MUST stay set. Without it
//      Fuse silently drops body matches past character ~60 (RESEARCH
//      §Pitfall 1). The library-search test suite asserts a body match
//      at position 250 in the corpus to make a future drop fail loudly.
//   2. `capQuery(query)` enforces a 200-char hard cap BEFORE Fuse receives
//      input. Mitigates T-50-QUERY-DOS — multi-KB regex-like queries can
//      hang the WebView (Bitap is O(query × text)).
//   3. Consumers MUST wrap `buildIndex(corpus)` in `useMemo` keyed on the
//      corpus identity (RESEARCH §Pitfall 3). Index creation is ~3ms for
//      ≤250 posts but allocating per keystroke is 16× wasteful.
//
// Public surface:
//   - FUSE_OPTIONS           — Fuse config (exported for test introspection)
//   - MAX_QUERY_LENGTH       — 200-char cap constant
//   - buildIndex(posts)      — `new Fuse(posts, FUSE_OPTIONS)`
//   - search(index, query)   — `index.search(capQuery(query))`
//   - capQuery(query)        — `query.slice(0, MAX_QUERY_LENGTH)` (no trim)
//   - extractSnippet(...)    — 120-char body excerpt centered on first match
//   - dateFilter(t, preset)  — today | last7 | last30 | all
//   - rebaseIndices(...)     — re-base Fuse indices into a snippet window

import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import type { DailyPost } from '../types/index.ts';

/**
 * Hard cap on search query length (T-50-QUERY-DOS mitigation).
 *
 * Fuse.js Bitap implementation is O(query × text). A multi-KB regex-like
 * query can lock the WebView main thread on a 200-post corpus. Capping
 * upstream of Fuse keeps worst-case latency bounded.
 */
export const MAX_QUERY_LENGTH = 200;

/**
 * Fuse.js configuration for library search.
 *
 * Weighted multi-field search per RESEARCH §Pattern 3 + UI-SPEC Surface 7:
 *   - title              weight 0.5  (primary signal)
 *   - bodyMarkdown       weight 0.3  (substantive body match)
 *   - sourceQuestionTitles weight 0.15 (concept noun phrase from anchor)
 *   - contextLabel       weight 0.05 (provider / source label)
 *
 * D-14 relevance ordering depends on these relative weights — a title
 * match for query Q must score lower (= better in Fuse) than a body-only
 * match for the same Q.
 *
 * The ignore-location knob below is LOAD-BEARING — see file header rule #1.
 *
 * `threshold: 0.4` matches Fuse's default and is intentionally tunable
 * later. Lower = stricter; higher = more lenient.
 */
export const FUSE_OPTIONS: IFuseOptions<DailyPost> = {
  keys: [
    { name: 'title',                weight: 0.5 },
    { name: 'bodyMarkdown',         weight: 0.3 },
    { name: 'sourceQuestionTitles', weight: 0.15 },
    { name: 'contextLabel',         weight: 0.05 },
  ],
  threshold: 0.4,
  ignoreLocation: true,    // CRITICAL — Pitfall 1; do NOT remove. Body matches past pos 60 silently miss without this.
  includeMatches: true,    // returns indices for HighlightedText (plan 50-06)
  includeScore: true,      // enables D-14 relevance sort
  minMatchCharLength: 2,
  shouldSort: true,
};

/**
 * Build a Fuse index over the active tab's corpus.
 *
 * Consumers MUST wrap the call in `useMemo(() => buildIndex(corpus), [corpus])`
 * — see file header rule #3. Building inside the render body or inside a
 * search `onChange` handler costs ~3ms per keystroke (RESEARCH §Pitfall 3).
 *
 * Index construction is synchronous and completes well under one frame for
 * ≤250-post corpora per RESEARCH §"Fuse.js Scale Analysis".
 */
export function buildIndex(posts: DailyPost[]): Fuse<DailyPost> {
  return new Fuse(posts, FUSE_OPTIONS);
}

/**
 * Enforce the MAX_QUERY_LENGTH cap before Fuse receives input.
 *
 * Returns the query truncated to at most MAX_QUERY_LENGTH characters.
 * Does NOT trim, lowercase, or otherwise normalize — fuzzy match is
 * intentionally case-insensitive and space-tolerant on the Fuse side.
 */
export function capQuery(query: string): string {
  if (query.length <= MAX_QUERY_LENGTH) return query;
  return query.slice(0, MAX_QUERY_LENGTH);
}

/**
 * Search the index with the given query.
 *
 * Returns Fuse's native result shape: `{ item, score?, matches? }[]` sorted
 * by relevance (lower `score` = better match) thanks to `shouldSort: true`
 * + the per-field weights in FUSE_OPTIONS.
 *
 * The query is automatically capped via `capQuery()` so callers cannot
 * accidentally bypass the T-50-QUERY-DOS mitigation.
 */
export function search(
  index: Fuse<DailyPost>,
  query: string,
): FuseResult<DailyPost>[] {
  return index.search(capQuery(query));
}

/**
 * Extract a 120-character snippet from `body` centered on the first match.
 *
 * Returns `{ text, offset }` where `text` is the snippet with `…` (Unicode
 * U+2026) bookends when truncated and `offset` is the index of `text[0]`
 * in `body` AFTER accounting for the prefix ellipsis. Consumers pass
 * `offset` to `rebaseIndices()` when wiring Fuse match indices into the
 * snippet for `<HighlightedText>` rendering (plan 50-09 / Surface 7).
 *
 * Edge cases (test-enforced):
 *   - Empty body            → { text: '', offset: 0 }
 *   - Match within first half-window → no '…' prefix
 *   - Match within last half-window  → no '…' suffix
 *   - Body shorter than maxChars     → returns full body, no bookends
 */
export function extractSnippet(
  body: string,
  firstMatchStart: number,
  maxChars: number = 120,
): { text: string; offset: number } {
  if (!body) return { text: '', offset: 0 };
  if (body.length <= maxChars) return { text: body, offset: 0 };

  const half = Math.floor(maxChars / 2);
  let rawStart = Math.max(0, firstMatchStart - half);
  let rawEnd = rawStart + maxChars;
  if (rawEnd > body.length) {
    rawEnd = body.length;
    rawStart = Math.max(0, rawEnd - maxChars);
  }

  const middle = body.slice(rawStart, rawEnd);
  const prefix = rawStart > 0 ? '…' : '';
  const suffix = rawEnd < body.length ? '…' : '';

  return {
    text: prefix + middle + suffix,
    // `offset` is the position of text[0] in `body`. The leading '…' is at
    // -prefix.length relative to the slice start, so:
    offset: rawStart - prefix.length,
  };
}

/**
 * Re-base Fuse match indices into a snippet window.
 *
 * Fuse returns `indices` as `[start, end]` pairs into the FULL body. To
 * highlight matched runs inside a snippet, each pair must be shifted by
 * `-offset` and clipped to `[0, maxLen)`. Pairs entirely outside the
 * snippet window are dropped; partial overlaps are clamped.
 *
 * Used by SavedScreen (plan 50-09) when rendering
 * `<HighlightedText indices={rebaseIndices(matches[0].indices, offset, snippet.length)}>`.
 */
export function rebaseIndices(
  indices: readonly (readonly [number, number])[],
  offset: number,
  maxLen: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (const [start, end] of indices) {
    const shiftedStart = start - offset;
    const shiftedEnd = end - offset;
    // Drop pairs entirely outside the window.
    if (shiftedEnd < 0 || shiftedStart >= maxLen) continue;
    // Clamp partial overlaps.
    const clampedStart = Math.max(0, shiftedStart);
    const clampedEnd = Math.min(maxLen - 1, shiftedEnd);
    if (clampedEnd >= clampedStart) out.push([clampedStart, clampedEnd]);
  }
  return out;
}

/**
 * Date-filter preset names (D-12).
 *
 * `today`  — same calendar day as `Date.now()` (uses local midnight)
 * `last7`  — within 7 × 24h of `Date.now()`
 * `last30` — within 30 × 24h of `Date.now()`
 * `all`    — identity (no filter)
 */
export type DateFilterPreset = 'today' | 'last7' | 'last30' | 'all';

/**
 * Apply the D-12 preset date filter to a `generatedAt` timestamp.
 *
 * Pure date arithmetic — no `lib/date.ts` import (leaf-discipline rule).
 * Returns `true` when the timestamp passes the filter.
 */
export function dateFilter(generatedAt: number, filter: DateFilterPreset): boolean {
  if (filter === 'all') return true;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (filter === 'today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return generatedAt >= todayStart.getTime();
  }
  if (filter === 'last7') return generatedAt >= now - 7 * dayMs;
  if (filter === 'last30') return generatedAt >= now - 30 * dayMs;
  return true; // exhaustive — TypeScript narrows to never here.
}
