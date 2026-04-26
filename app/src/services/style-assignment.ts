/**
 * style-assignment.ts
 * Weighted random style assignment for feed posts (Phase 31, D-17/D-18).
 * Styles are decided BEFORE generation — this module is called early in the pipeline.
 */

import type { PresentationStyle } from '../types';

// 2026-04-21 re-balance (second pass): cut news 20% → 10% per operator
// request ("news posts are way too much") and push the redistributed share
// into text-art (now 55%). YouTube share kept at 25% total. Image still
// held at 10% because image generation is expensive on both providers.
//
// Effective distribution when YouTube is unavailable (drained quota):
//   video+short redistributed to text-art (+25%) → text-art = 80%, news = 10%,
//   image = 10%, suggestion = 5% — prevents the "news flood" seen when YouTube
//   was off.
export const STYLE_WEIGHTS: Record<string, number> = {
  image: 0.10,
  'text-art': 0.55,
  suggestion: 0.05,
  news: 0.10,
  video: 0.10,
  short: 0.10,
};

export interface StyleAssignment {
  conceptId: string;
  style: PresentationStyle;
}

export interface ApiAvailability {
  hasYoutubeKey: boolean;
  hasTavilyKey: boolean;
  hasImageGenKey: boolean;
}

/**
 * Assigns styles to a list of concept IDs using weighted random selection.
 * Unavailable API styles are redistributed to text-art.
 * Per D-18: styles are decided BEFORE generation.
 */
export function assignStyles(
  conceptIds: string[],
  availability: ApiAvailability,
): StyleAssignment[] {
  // Build effective weights: zero out unavailable styles, redistribute to text-art
  const weights = { ...STYLE_WEIGHTS };

  if (!availability.hasYoutubeKey) {
    weights['text-art'] += weights.video + weights.short;
    weights.video = 0;
    weights.short = 0;
  }
  if (!availability.hasTavilyKey) {
    weights['text-art'] += weights.news;
    weights.news = 0;
  }
  if (!availability.hasImageGenKey) {
    weights['text-art'] += weights.image;
    weights.image = 0;
  }

  const styleNames = Object.keys(weights);
  const cumulative: { style: PresentationStyle; threshold: number }[] = [];
  let sum = 0;
  for (const s of styleNames) {
    if (weights[s] <= 0) continue;
    sum += weights[s];
    cumulative.push({ style: s as PresentationStyle, threshold: sum });
  }

  const result = conceptIds.map((conceptId) => {
    const r = Math.random() * sum;
    const style = cumulative.find((c) => r < c.threshold)?.style ?? 'text-art';
    return { conceptId, style };
  });

  // Dev-mode instrumentation (2026-04-21): print the style distribution per call
  // so missing-style regressions (e.g. "no image posts across 50+ posts") surface
  // in the devtools console instead of requiring code-read to diagnose.
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const counts: Record<string, number> = {};
    for (const a of result) counts[a.style] = (counts[a.style] ?? 0) + 1;
    const availStr = `yt=${availability.hasYoutubeKey ? 1 : 0} tv=${availability.hasTavilyKey ? 1 : 0} img=${availability.hasImageGenKey ? 1 : 0}`;
    console.info(`[assignStyles] n=${conceptIds.length} avail{${availStr}} →`, counts);
  }

  return result;
}

/**
 * Reassign failed fetches (video/news that returned no results) to text-art.
 * Per D-20.
 */
export function reassignFailures(
  assignments: StyleAssignment[],
  failedConceptIds: Set<string>,
): StyleAssignment[] {
  return assignments.map((a) =>
    failedConceptIds.has(a.conceptId) &&
    (a.style === 'video' || a.style === 'short' || a.style === 'news')
      ? { ...a, style: 'text-art' as PresentationStyle }
      : a,
  );
}
