---
status: partial
phase: 42-masonry-feed-layout
source: [42-VERIFICATION.md]
started: 2026-05-09T02:00:00.000Z
updated: 2026-05-09T02:30:00.000Z
---

## Current Test

[awaiting operator retest of UAT-1..UAT-6 after fix commits `1de44017` (Bug A+B), `5f8a77f9` (Bug C — column overflow), `f2471499` (UAT-6 — card typography for half-width)]

## Tests

### 1. VineBloomCard end-to-end
expected: After all anchors are explored (real CONCEPT_EXPLORED events fired by reading every post in the daily feed), the VineBloomCard renders at the bottom of the home feed with the vine illustration, suggested-tomorrow plan, and Heal/Re-plant/Open Planner CTAs visible.
result: [pending — blocked by UAT-5]

### 2. Column stability under scroll
expected: With real card heights (image posts, variable text-art lengths, video tiles, news tiles), cards never jump between columns when scrolling or when new tiles append. Each tile stays in the column it was first assigned to (height-accumulating split is append-only — confirmed by `tileColumnAssignmentsRef` immutability guard at MasonryFeed.tsx:382).
result: [pending — blocked by UAT-5]

### 3. Reduced Motion honored
expected: With `System Preferences → Accessibility → Reduce Motion → ON`, reload `/home` and trigger swipe-for-more. New tiles appear instantly with no fade-up entrance animation. `<MotionConfig reducedMotion="user">` wrapper should propagate through framer-motion v12 (RESEARCH.md Pitfall 1).
result: [pending — blocked by UAT-5]

### 4. VineBloomCard navigation CTAs
expected: With a real anchor dataset (mix of dying/dead leafStates), tapping Heal navigates to `/review` with anchorId/qaIds/title; tapping Re-plant navigates to `/posts/anchor-post-{id}`; tapping Open Planner navigates to `/planner`. ZERO new methods on `trellisActionsService` (Pitfall 3 — confirmed by source-reading test).
result: [pending — blocked by UAT-5]

### 5. Two columns side-by-side (MASONRY-01 happy path)
expected: With ≥2 tiles in the feed, the masonry renders both columns with tiles distributed across them via the height-accumulating split. Right column should have content, not be empty.
result: RESOLVED — fix committed at `1de44017` (advance heights in Pass 1 + move assignment to render body). Two regression locks added in MasonryFeed.layout.test.mjs (test count 39 → 42, all green; tsc clean).
evidence: Operator screenshot at retest after Wave 4 close-out showed ALL tiles piled into the LEFT column; right column was completely empty all the way down. Diagnosis below stays in record for posterity.

### 5b. Columns adapt to screen width (MASONRY-01 fit)
expected: Both masonry columns fit inside HomeScreen's 448px maxWidth content area. Right column does NOT overflow off-screen on any device width.
result: RESOLVED — fix committed at `5f8a77f9` (minWidth: 0 on BOTH column wrappers + width: 100% on outer flex container). Same root cause as CLAUDE.md ChatInput rule. 1 new regression lock added (layout test count 10 → 11, all green; tsc clean). Awaiting operator visual retest.
evidence: Operator screenshot 2026-05-09 after `1de44017` shows 2 columns rendering but right column overflows off the right edge of the viewport. Cards inside have intrinsic content width that flex refuses to shrink without minWidth: 0.

### 6. Card typography tuned for half-width
expected: Existing card components (NewsCard, video card, text-art card) were designed for full-width InlineInfoFlow. At 50% width inside masonry columns, font sizes / paddings / line-heights need to shrink so headlines don't dominate the column or wrap to 1-2 words per line.
result: RESOLVED — fix committed at `f2471499`. News headline 1.25 → 0.95rem; concept hook 1.2 → 0.95rem; text-art breakpoints 1.25/1.5/2rem → 0.95/1.15/1.5rem; internal paddings tightened proportionally. InlineInfoFlow is no longer used by any screen so direct edits are safe. 42/42 Phase 42 tests + counterweights green; tsc clean. Awaiting operator visual retest. Connection/milestone cards untouched — surface only if reported.
evidence: Operator screenshot 2026-05-09 after `5f8a77f9` shows news cards with massive serif headlines wrapping to 1-2 words per line at half-width.

## Summary

total: 7
passed: 0
issues: 2
pending: 5
skipped: 0
blocked: 0

## Gaps

### Gap 1 — Tiles all assigned to column 0 (MASONRY-01 broken at runtime)
status: resolved
resolution_commit: 1de44017
test: UAT-5
phase_origin: 42 (Wave 1, Plan 42-01)
file: app/src/components/MasonryFeed.tsx
lines: 378-394 (Pass 1 + Pass 2 of useLayoutEffect) AND 468-469 (column filters)

### Diagnosis (2 ordering bugs)

**Bug A — Pass 1 comparator never advances heights** (MasonryFeed.tsx:378-386):
```tsx
for (const item of items) {
  const itemId = getId(item);
  if (!itemId) continue;
  if (tileColumnAssignmentsRef.current.has(itemId)) continue;
  const heights = columnHeightsRef.current;
  const col: 0 | 1 = heights[0] <= heights[1] ? 0 : 1;  // ≤ → ties go to 0
  tileColumnAssignmentsRef.current.set(itemId, col);
  // MISSING: columnHeightsRef.current[col] += <estimated height>;
}
```
With initial heights `[0, 0]` and `<=` tie-breaker, every item in the first batch is assigned to column 0. Pass 2 (DOM re-measure at 388-393) runs AFTER all assignments — it confirms "16 tiles in col 0, 0 tiles in col 1" but cannot redistribute (the assignment Map is append-only by design — `tileColumnAssignmentsRef` immutability invariant per MasonryFeed.tsx:382).

**Bug B — Render-time filters read assignments before useLayoutEffect populates them** (MasonryFeed.tsx:468-469):
```tsx
const colATiles = items.filter((i) => tileColumnAssignmentsRef.current.get(getId(i)) === 0);
const colBTiles = items.filter((i) => tileColumnAssignmentsRef.current.get(getId(i)) === 1);
```
On first render, `tileColumnAssignmentsRef.current` is empty Map → both filters return `[]` → empty DOM committed. `useLayoutEffect` then populates the Map but does NOT trigger a re-render (refs don't). Tiles only appear after some unrelated state change (e.g., videoPlaying) forces a re-render.

### Required fix

**1. Advance the height estimate during Pass 1** (so the comparator zigzags):
```tsx
const el = tileRefsMap.current.get(itemId);
const h = el?.clientHeight ?? 280; // 280px estimate ≈ avg card height
columnHeightsRef.current[col] += h + 12;
```

**2. Move Pass 1 from useLayoutEffect to the render body** (idempotent under StrictMode double-invoke because of the `has()` guard) so first-render filters see populated assignments. Pass 2 (DOM re-measure) stays in useLayoutEffect to refine heights for the NEXT batch.

### Files affected
- `app/src/components/MasonryFeed.tsx` (Pass 1 relocation + per-iteration height advance; ~10 LOC delta)

### Test coverage
- `tests/components/MasonryFeed.layout.test.mjs` already asserts the algorithm shape; add a behavioral assertion that with 4+ tiles, both `colATiles` and `colBTiles` are non-empty after the assignment loop.

