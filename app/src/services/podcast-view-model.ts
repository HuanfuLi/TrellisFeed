// src/services/podcast-view-model.ts (Phase 52-04 — PODCAST-03 GAP-3/GAP-4)
//
// Pure leaf module holding the PodcastScreen selection + render-gate logic so
// the LIVE path is unit-testable. The prior source-read-only test gave false
// confidence and missed both UAT bugs (CLAUDE.md best-practice #2: tests must
// guard the live code path).
//
// Leaf-module rule (mirrors podcast-prompt.ts): NO JSON imports, NO lib/date,
// NO react-i18next, NO Audio/IndexedDB. Type-only import of DailyPodcast /
// PodcastOptions / SupportedLocale from ../types. May import computeOptionsHash
// from ./podcast-prompt (itself a pure leaf). This keeps `node --test` able to
// import it and the tests/locales/bundle-parity.test.mjs chain intact.
//
// Root-cause fix (GAP-3 + GAP-4): the screen previously derived `selected` with
// a `podcasts[0]` fallback. When today's podcast was undefined the player bound
// to a STALE prior-day podcast — rendering the player AND the "No podcast for
// today" empty state simultaneously (GAP-3), and binding the audio element to
// the wrong blob (GAP-4). deriveSelectedPodcast intentionally has NO podcasts[0]
// fallback: the main player only shows TODAY's podcast; old podcasts are reached
// via the History sub-view, which sets selectedId explicitly.

import type { DailyPodcast, PodcastOptions, SupportedLocale } from '../types';
import { computeOptionsHash } from './podcast-prompt.ts';

/**
 * Resolve the podcast to display in the main player.
 *
 * - If selectedId is set AND found in podcasts → that podcast (History wins).
 * - Else → todayPodcast ?? null.
 *
 * CRITICAL: NO `podcasts[0]` fallback. The History sub-view handles browsing
 * old podcasts via an explicit selectedId. This omission is the GAP-3/GAP-4
 * root-cause fix.
 */
export function deriveSelectedPodcast(input: {
  selectedId: string | null;
  podcasts: DailyPodcast[];
  todayPodcast: DailyPodcast | undefined;
}): DailyPodcast | null {
  const { selectedId, podcasts, todayPodcast } = input;
  if (selectedId) {
    const found = podcasts.find((p) => p.id === selectedId);
    if (found) return found;
    // selectedId points at a podcast that no longer exists (deleted) — fall
    // through to today rather than to a stale podcasts[0].
  }
  return todayPodcast ?? null;
}

/**
 * The empty / generate-CTA block is visible when there is no usable today
 * podcast yet. Keyed on todayPodcast ONLY so it stays mutually exclusive with
 * the player (which is keyed on the derived `selected`).
 */
export function isEmptyStateVisible(input: { todayPodcast: DailyPodcast | undefined }): boolean {
  const { todayPodcast } = input;
  return !todayPodcast || todayPodcast.status === 'pending' || todayPodcast.status === 'failed';
}

/**
 * The player block is visible when the derived selection is a ready podcast.
 * Combined with deriveSelectedPodcast (no podcasts[0] fallback) this is
 * mutually exclusive with isEmptyStateVisible: when todayPodcast is undefined,
 * selected is null → player hidden, empty shown.
 */
export function isPlayerVisible(input: { selected: DailyPodcast | null }): boolean {
  const { selected } = input;
  return selected != null && selected.status === 'ready';
}

/**
 * Hash the CURRENT chip selection over the SERVICE-resolved concept-id list
 * stored on the selected podcast (selected.questionIds). This is what reconciles
 * the screen's hash with the service's optionsHash (GAP-4 isDirty loop fix):
 * the service computes optionsHash over the same conceptIdList it writes to
 * questionIds, so a fresh, unchanged-chip podcast produces an identical hash.
 *
 * When selected is null, hash over [] so the result is stable and never matches
 * a real podcast's hash.
 */
export function computeCurrentHashForSelected(
  selected: DailyPodcast | null,
  locale: SupportedLocale,
  options: PodcastOptions,
): string {
  const conceptIds = selected?.questionIds ?? [];
  return computeOptionsHash(conceptIds, locale, options);
}

/**
 * The Regenerate CTA is dirty when the cached podcast carries an optionsHash
 * that diverges from the current chip selection. Pre-Phase-52 podcasts have no
 * optionsHash → never dirty (no phantom CTA).
 */
export function isDirty(input: { selected: DailyPodcast | null; currentHash: string }): boolean {
  const cachedHash = input.selected?.optionsHash;
  return !!cachedHash && cachedHash !== input.currentHash;
}
