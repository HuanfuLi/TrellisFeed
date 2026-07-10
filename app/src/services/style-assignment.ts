/**
 * style-assignment.ts
 * Weighted random style assignment for feed posts (Phase 31, D-17/D-18).
 * Styles are decided BEFORE generation — this module is called early in the pipeline.
 */

import type { PresentationStyle } from '../types';

export const STYLE_WEIGHTS: Record<string, number> = {
  image: 0.15,
  'text-art': 0.75,
  suggestion: 0.10,
};

export interface StyleAssignment {
  conceptId: string;
  style: PresentationStyle;
}

export interface ApiAvailability {
  hasImageGenKey: boolean;
}

/**
 * Assigns styles to a list of concept IDs using weighted random selection.
 * Unavailable image style weight is redistributed to text-art.
 * Per D-18: styles are decided BEFORE generation.
 */
export function assignStyles(
  conceptIds: string[],
  availability: ApiAvailability,
): StyleAssignment[] {
  // Build effective weights: zero out unavailable styles, redistribute to text-art
  const weights = { ...STYLE_WEIGHTS };

  if (!availability.hasImageGenKey) {
    weights['text-art'] += weights.image;
    weights.image = 0;
  }

  // ─── Stratified allocation (Phase 36 GAP-3) ──────────────────────────────
  // Replaces the prior i.i.d. draw that produced E[image]=0.8 in N=8 batches
  // (most batches contained ZERO image posts — operator-confirmed defect).
  // Largest-remainder (Hamilton's method) gives provable ±1 of round(N×w) per
  // style, every run. Fisher-Yates shuffle then randomizes within-batch ORDER
  // so the COUNTS are exact but the SEQUENCE is varied.
  //
  // CRITICAL: this runs on `weights` (effective, post-API-redirect) NOT on
  // STYLE_WEIGHTS — see RESEARCH § Pitfall 2. The redistribution block above
  // must execute first.
  const sum = Object.values(weights).reduce<number>((a, b) => a + (b > 0 ? b : 0), 0);

  if (sum <= 0) {
    // Pathological: every weight zeroed. Should not happen — text-art always
    // retains its base 0.55 (and absorbs redistributions). Return all-text-art.
    const fallback: PresentationStyle = 'text-art';
    return conceptIds.map((conceptId) => ({ conceptId, style: fallback }));
  }

  const items: Array<{ style: PresentationStyle; count: number; rem: number }> = [];
  for (const [s, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    const exact = (conceptIds.length * w) / sum;
    const count = Math.floor(exact);
    items.push({ style: s as PresentationStyle, count, rem: exact - count });
  }
  const deficit = conceptIds.length - items.reduce((acc, x) => acc + x.count, 0);
  items.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < deficit; i++) items[i].count++;

  const slots: PresentationStyle[] = [];
  for (const { style, count } of items) {
    for (let i = 0; i < count; i++) slots.push(style);
  }
  // Fisher-Yates shuffle (in place, Math.random — non-deterministic by design;
  // tests assert COUNTS, not sequences, see RESEARCH § Risk Register row 3).
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const result = conceptIds.map((conceptId, i) => ({ conceptId, style: slots[i] }));

  // Dev-mode instrumentation (2026-04-21): print the style distribution per call
  // so missing-style regressions (e.g. "no image posts across 50+ posts") surface
  // in the devtools console instead of requiring code-read to diagnose.
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const counts: Record<string, number> = {};
    for (const a of result) counts[a.style] = (counts[a.style] ?? 0) + 1;
    const availStr = `img=${availability.hasImageGenKey ? 1 : 0}`;
    console.info(`[assignStyles] n=${conceptIds.length} avail{${availStr}} →`, counts);
  }

  return result;
}

/**
 * Reassign failed style attempts to text-art.
 * Per D-20.
 */
export function reassignFailures(
  assignments: StyleAssignment[],
  failedConceptIds: Set<string>,
): StyleAssignment[] {
  return assignments.map((a) =>
    failedConceptIds.has(a.conceptId)
      ? { ...a, style: 'text-art' as PresentationStyle }
      : a,
  );
}

// Phase 36 GAP-3 — alias for unambiguous import in tests / external callers
// that want to reference the stratified algorithm by name. The body of
// assignStyles IS the stratified algorithm now (replaced i.i.d. on 2026-05-06).
// Kept as a separate export so the Wave 0 test file
// `tests/services/style-assignment-stratified.test.mjs` resolves cleanly.
export const assignStylesStratified = assignStyles;
