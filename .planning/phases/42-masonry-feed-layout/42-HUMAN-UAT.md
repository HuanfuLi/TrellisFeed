---
status: partial
phase: 42-masonry-feed-layout
source: [42-VERIFICATION.md]
started: 2026-05-09T02:00:00.000Z
updated: 2026-05-09T02:30:00.000Z
---

## Current Test

[awaiting operator retest of UAT-1..UAT-10 after `3a02c45d` (UAT-8 round 3 letterbox→paddingTop hack + UAT-10 queue 16→24 + swipe pop 4→8)]

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
result: RESOLVED across 3 commits. `f2471499` first-pass shrink (news headline 1.25 → 0.95rem; concept hook 1.2 → 0.95rem). `afe42922` (1A) chrome tightening: borderRadius 16 → 8, padding 14 → 10 across all variants, suggestion-card nested padding fix (TopicButton padding 0/16 → 6/10, ChevronRight removed). `df3a2553` (3B) text-art prompt+tightener at the source so cards never receive multi-sentence content. 47/47 Phase 42 tests + counterweights green; tsc clean.
evidence: Operator screenshot 2026-05-09 after `5f8a77f9` showed news cards with massive serif headlines. Subsequent screenshot after `f2471499` showed text-art still wrapping ('Why the Smell of Safety Makes AI Unsafe' → 5 lines) and suggestion-card pills wrapping to 4 lines.

### 7. Inline-play removed from feed video cards
expected: Per operator: "Remove the inline play feature." Tapping a video card should navigate to PostDetailScreen (not start inline playback in the feed).
result: RESOLVED — fix committed at `db864ffa`. Removed videoPlaying state, conditional iframe branch, transparent pointer-overlay, close button, thumbnail-tap CONCEPT_EXPLORED emit, AND the play-button overlay (gray-circle/white-triangle in card center). Also deleted the dead InlineInfoFlow + InfoFlowPreview functions (760 LOC removed). CLAUDE.md "Video post completion signals" section rewritten — Detector D (PostDetailScreen postMessage) is now the sole feed-level video signal; new rule #6 documents the 5:4 thumbnail aspect choice with the operator-rejected alternatives. Test contract flipped from positive (assert markExplored exactly once) to negative (assert ZERO markExplored / videoPlaying / inline iframe).
evidence: Operator screenshot 2026-05-09 showed gray-circle play button overlay center-blocking the YouTube thumbnail.

### 8. Video thumbnail aspect — 5:4 landscape crop
expected: Per operator after rejecting portrait + native + hide-thumbnail options: "G sounds a little better if crop 5:4 (landscape) for landscape thumbnails. Vertical crop WILL DEFINITELY cause poor visual."
result: RESOLVED across 2 rounds. Round 2 `db864ffa` used `aspectRatio: '5 / 4'` CSS — produced LETTERBOX (black bars top+bottom) instead of cropping (operator: "did not crop thumbnail but actually added black upper and lower edges"). Round 3 `3a02c45d` switched to the bulletproof `paddingTop: '80%'` hack (4/5 = 0.8) with the img absolute-positioned over the padding box. Forces a real computed height before the img lays out, so `object-fit: cover` correctly crops L+R and preserves vertical framing. Test contract updated from asserting the aspectRatio literal to asserting paddingTop + position absolute + objectFit cover (3 paired assertions).
evidence: Operator report 2026-05-10 after `db864ffa` showed black bars top/bottom — letterbox geometry consistent with the img falling back to its intrinsic 16:9 ratio inside a 0-height container. CSS aspect-ratio property likely didn't compute a real height inside the flex column ancestor.

### 10. Buffer queue + per-swipe pop bumped for masonry consumption
expected: Per operator 2026-05-10: "Should enlarge buffer queue to 24 and each swipe for more should pop 8 posts." Masonry half-width tiles consume twice as fast as the prior single-column InlineInfoFlow.
result: RESOLVED — fix committed at `3a02c45d`. REFILL_THRESHOLD 16 → 24 (post-queue.service.ts), walker batchSize 16 → 24 (concept-feed.service.ts:1275), generateMorePosts default count 4 → 8, loadNextBatch default limit 4 → 8, HomeScreen swipe call site passes 8 explicitly. MAX_QUEUE_SIZE held at 32 — increasing further risks longer initial load waits without proportional UX gain. CLAUDE.md "Concept Feed Generation Pipeline" numeric defaults updated with new constants + dated rationale.

### 9. Suggestion-card nested padding
expected: SuggestionCard topic pills (multi-line topic strings) wrapped to 4+ lines because of nested padding (16px outer card pad + 16px button pad = 32px lost per side at half-width). Should denest.
result: RESOLVED in `afe42922`. Outer card padding 16 → 10, removed minHeight: 280px (let masonry compute), TopicButton padding 0/16 → 6/10, fontSize 14 → 13, removed ChevronRight icon (saves 20px), Sparkles 16 → 13, header gap/marginBottom 8/16 → 6/8.
evidence: Operator screenshot 2026-05-09 showed "PLA vs PETG / thermal / resistance / comparison" wrapping to 4 lines per topic pill.

### REGRESSION TRIAGE — text-art / image distribution skewed
status: open (NOT a Phase 42 regression — separate investigation queued)
operator_observation: "All posts are news and videos again. No text-art and image posts."
phase 42 surface confirmed clean: Phase 42 commits only touched MasonryFeed.tsx, InfoFlow.tsx (exports + 3 deletions + chrome typography + inline-play removal), HomeScreen.tsx (swap), index.css (1 keyframe), 4 locale bundles, 5 test files. ZERO touch to style-assignment.ts, concept-feed.service.ts (until 3B text-art prompt — but that affects content per post, not distribution), post-queue.service.ts.
last pipeline-relevant change before this skew: Phase 41-01 commits 83804b5c, c68bd4b2 (sourceDiversityService wired into news pre-fetch + Tavily maxResults 3).
effective STYLE_WEIGHTS (style-assignment.ts:23-29): text-art 55%, video 20%, image 10%, news 10%, suggestion 5% (when all API keys present).
suggested next step: `/gsd:debug "feed dominated by news+video, text-art absent despite 55% weight"` after operator confirms Phase 42 layout work is complete. Likely investigation paths: (a) cache holding pre-rebalance posts (Force-New-Day clears), (b) image-gen failure path silently downgrading to text-art at line 1386 then text-art content failing → fallback path → cards not rendering, (c) Phase 41-01 sourceDiversityService over-pre-fetching news.

## Summary

total: 10
passed: 0
issues: 6
pending: 4
skipped: 0
blocked: 0
note: All 6 issues are RESOLVED with code commits awaiting operator visual retest. Once UAT-1..4 are confirmed (currently still pending behavioral verification independent of layout), phase verification can flip to `passed`.

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

