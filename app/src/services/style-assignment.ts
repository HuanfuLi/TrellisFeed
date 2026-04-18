/**
 * style-assignment.ts
 * Weighted random style assignment for feed posts (Phase 31, D-17/D-18).
 * Styles are decided BEFORE generation — this module is called early in the pipeline.
 */

import type { PresentationStyle } from '../types';

export const STYLE_WEIGHTS: Record<string, number> = {
  image: 0.10,
  'text-art': 0.25,
  suggestion: 0.05,
  news: 0.20,
  video: 0.15,
  short: 0.25,
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

  return conceptIds.map((conceptId) => {
    const r = Math.random() * sum;
    const style = cumulative.find((c) => r < c.threshold)?.style ?? 'text-art';
    return { conceptId, style };
  });
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
