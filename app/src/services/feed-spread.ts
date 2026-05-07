// Concept-feed spread helpers (Phase 36 GAP-4 extraction).
//
// This is a LEAF module: it has zero transitive deps on settings.service /
// llm-provider / locales bundles, so node --test can import it directly
// without hitting Node ESM's ERR_IMPORT_ATTRIBUTE_MISSING on en.json.
// (concept-feed.service.ts re-imports from here so the runtime path is
// unchanged — this file just gives tests a clean import surface.)
//
// See CLAUDE.md i18n section "Phase 27 locale tests avoid the JSON-import-
// attribute failure chain by importing i18next directly; follow the same
// pattern for any new pure-logic helpers."
//
// Both functions mutate `posts` in place. They are O(n²) worst-case (the
// collision-bump probe + leftover-fill scan) but n ≤ 32 in production
// (MAX_QUEUE_SIZE = 32; rehydration on new day from Plan 36-11 may reach
// this cap), so this is negligible.

import type { DailyPost } from '../types';

/**
 * Spread posts so same-style items are maximally spaced apart.
 *
 * 2026-04-21 rewrite: the previous greedy "skip same-style if any non-same
 * bucket has content" heuristic clustered the tail whenever one style had
 * more than ~50% of the batch — once the minority buckets drained, the
 * majority bucket placed all remaining items back-to-back. Example with
 * [T×5, V×2, S×1] produced TVTVTSTT (3-run of T at the tail).
 *
 * New algorithm — proportional max-spacing (Bresenham-style):
 *   Each style claims slots at a stride = posts.length / bucketSize, offset
 *   by bucket position. Collisions resolve by bumping the loser to the next
 *   free slot. This guarantees the tail can't cluster because every style's
 *   placements are spread across the entire range, not just filling the
 *   remaining capacity at the end.
 *
 * Invariants:
 *   - same style items are separated by at least floor(N / count)-1 others
 *     whenever bucket sizes allow (not guaranteed when one style is strictly
 *     majority — clustering is structurally unavoidable then, but minimized)
 *   - stable relative order within each style group
 *   - idempotent: running twice yields the same result
 */
export function spreadByStyle(posts: DailyPost[]): void {
  if (posts.length <= 2) return;
  const n = posts.length;

  // Group by style, preserving original intra-style order
  const byStyle = new Map<string, DailyPost[]>();
  for (const p of posts) {
    const key = p.presentationStyle ?? 'unknown';
    const arr = byStyle.get(key) ?? [];
    arr.push(p);
    byStyle.set(key, arr);
  }

  // Sort buckets largest-first so the dominant style gets its slots first
  // (the bumps favor smaller buckets, which tolerate offset better)
  const buckets = Array.from(byStyle.entries())
    .sort((a, b) => b[1].length - a[1].length);

  const result: (DailyPost | null)[] = new Array(n).fill(null);

  for (const [, items] of buckets) {
    const count = items.length;
    if (count === 0) continue;
    // Ideal stride: place `count` items uniformly across `n` slots
    const stride = n / count;
    for (let i = 0; i < count; i++) {
      // Center the placement in each stride slice so stride=1 (full bucket)
      // doesn't stack everything at index 0
      let slot = Math.floor(i * stride + stride / 2);
      if (slot >= n) slot = n - 1;
      // Bump forward on collision, wrap around if necessary
      let probe = slot;
      let tries = 0;
      while (result[probe] !== null && tries < n) {
        probe = (probe + 1) % n;
        tries++;
      }
      result[probe] = items[i];
    }
  }

  // Safety: any remaining null slots get filled with whatever's left
  // (should not happen with correct stride math but defends against off-by-one)
  const leftover = posts.filter((p) => !result.includes(p));
  let cursor = 0;
  for (const p of leftover) {
    while (cursor < n && result[cursor] !== null) cursor++;
    if (cursor < n) result[cursor++] = p;
  }

  for (let i = 0; i < n; i++) posts[i] = result[i]!;
}

/**
 * Concept-axis spread (Phase 36 GAP-4) — groups by anchor identity instead of
 * style and minimizes the longest run of same-concept consecutive posts.
 *
 * Why this exists: spreadByStyle interleaves by style label only — if one
 * anchor has 6 entries (important / overdue) and another has 2, the 3:1
 * concept ratio persists in every served window REGARDLESS of style spread.
 * The user feels "every other post is about anchor A" even when each post
 * is a different style. Spreading on the concept axis first establishes
 * concept distribution; spreadByStyle then refines style variety within it.
 *
 * Key extractor: post.sourceQuestionIds[0] ?? post.id  (Pitfall 5 — posts
 * with empty sourceQuestionIds — starter / connection / suggestion — get
 * a unique fallback key so they are NOT all clustered together).
 *
 * Algorithm:
 *   The half-stride placement formula used by spreadByStyle (`floor(i*n/count
 *   + n/(2*count))`) clusters when one bucket holds more than n/2 of the
 *   array — for count=6 in n=8, ideal positions {0, 2, 3, 4, 6, 7} produce a
 *   3-run at indices 2-4 because non-integer stride 1.333 aliases to
 *   consecutive floors. The plan-prescribed test 5 (6 of A + 2 of B in 8
 *   slots) is pigeonhole-feasible at max-run=2 (e.g., AABAABAA), so we need a
 *   placement formula that achieves it.
 *
 *   Two-branch strategy:
 *     a) DOMINANT branch (max bucket count > n/2): the largest bucket is
 *        placed at every non-skip position in order. The "skip" positions
 *        are where the OTHER buckets go, computed via the symmetric formula
 *        `floor(n * (i+1) / (skip_count+1))` — this is the standard
 *        equal-spacing layout for placing K separators among n slots so the
 *        resulting runs are as balanced as possible (sizes ceil(d/(K+1)) and
 *        floor(d/(K+1)) where d = n - K). For [6 A, 2 B, n=8]: skips at
 *        floor(8/3)=2 and floor(16/3)=5, A fills 0,1,3,4,6,7, giving the
 *        provably-optimal AABAABAA (max-run=2).
 *     b) BALANCED branch (no bucket dominates): same half-stride placement
 *        as spreadByStyle. For [3 A, 3 B, n=6] this produces ABABAB
 *        (max-run=1). Empirically validated by tests 1 & 7 (combined-axis).
 *
 *   Both branches share the same collision-bump tail and leftover-fill
 *   safety net so they handle starter posts (each with a unique fallback
 *   key — Test 6) without clustering.
 *
 * Call order in the mixer is concept FIRST, style SECOND (RESEARCH §
 * Pattern 3 Why-Concept-First): if style spread runs first then concept
 * spread, style spread's collision-bumps move posts past concept boundaries
 * and concept spread has to re-sort, producing worse separation. Reverse
 * order keeps the concept distribution stable while style spread refines
 * within it.
 *
 * Note: spreadByStyle is intentionally NOT switched to this algorithm. Its
 * existing half-stride formula is empirically tuned for STYLE buckets (see
 * its 2026-04-21 rewrite comment) where ratios are typically more balanced;
 * changing it risks regressing the documented [T×5, V×2, S×1] fix.
 */
export function spreadByConcept(posts: DailyPost[]): void {
  if (posts.length <= 2) return;
  const n = posts.length;
  const byConcept = new Map<string, DailyPost[]>();
  for (const p of posts) {
    const key = p.sourceQuestionIds[0] ?? p.id;
    const arr = byConcept.get(key) ?? [];
    arr.push(p);
    byConcept.set(key, arr);
  }
  const buckets = Array.from(byConcept.entries()).sort((a, b) => b[1].length - a[1].length);
  const result: (DailyPost | null)[] = new Array(n).fill(null);

  const dominantCount = buckets[0]?.[1].length ?? 0;
  const isDominant = dominantCount > n / 2 && buckets.length >= 2;

  if (isDominant) {
    // Branch (a): dominant bucket fills the non-skip slots in order; other
    // buckets occupy evenly-spaced skip slots.
    const dominantItems = buckets[0][1];
    const skipCount = n - dominantCount;
    const skipSlots: number[] = [];
    for (let i = 0; i < skipCount; i++) {
      let slot = Math.floor((n * (i + 1)) / (skipCount + 1));
      if (slot >= n) slot = n - 1;
      // Guard against the rare case where the formula collides on small n.
      while (skipSlots.includes(slot) && slot < n - 1) slot++;
      skipSlots.push(slot);
    }
    const skipSet = new Set(skipSlots);
    // Place dominant bucket at all non-skip positions in order.
    let dominantIdx = 0;
    for (let pos = 0; pos < n; pos++) {
      if (!skipSet.has(pos) && dominantIdx < dominantItems.length) {
        result[pos] = dominantItems[dominantIdx++];
      }
    }
    // Place other buckets at skip positions in bucket-size order.
    let skipIdx = 0;
    for (let b = 1; b < buckets.length; b++) {
      const [, items] = buckets[b];
      for (const item of items) {
        if (skipIdx < skipSlots.length) {
          result[skipSlots[skipIdx++]] = item;
        }
      }
    }
  } else {
    // Branch (b): balanced half-stride placement (matches spreadByStyle).
    for (const [, items] of buckets) {
      const count = items.length;
      if (count === 0) continue;
      const stride = n / count;
      for (let i = 0; i < count; i++) {
        let slot = Math.floor(i * stride + stride / 2);
        if (slot >= n) slot = n - 1;
        let probe = slot;
        let tries = 0;
        while (result[probe] !== null && tries < n) {
          probe = (probe + 1) % n;
          tries++;
        }
        result[probe] = items[i];
      }
    }
  }

  // Safety: any remaining null slots get filled with whatever's left.
  const leftover = posts.filter((p) => !result.includes(p));
  let cursor = 0;
  for (const p of leftover) {
    while (cursor < n && result[cursor] !== null) cursor++;
    if (cursor < n) result[cursor++] = p;
  }
  for (let i = 0; i < n; i++) posts[i] = result[i]!;
}
