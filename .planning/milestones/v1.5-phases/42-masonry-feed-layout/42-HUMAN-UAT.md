---
status: resolved
phase: 42-masonry-feed-layout
source: [42-VERIFICATION.md]
started: 2026-05-09T02:00:00.000Z
updated: 2026-05-10T01:00:00.000Z
---

## Current Test

[testing complete — all gaps resolved via plan 42-08 (commits ec5f8fe1 → f86d273c → 406974f5 → 9e746fe7); phase re-verified `passed`]

## Tests

### 1. VineBloomCard end-to-end
expected: After all anchors are explored (real CONCEPT_EXPLORED events fired by reading every post in the daily feed), the VineBloomCard renders at the bottom of the home feed with the vine illustration, suggested-tomorrow plan, and Heal/Re-plant/Open Planner CTAs visible.
result: pass
note: Operator confirmed end-to-end render works 2026-05-10 BUT flagged visual quality: "the vine is super ugly, need to fine tune its appearance." Logged as follow-up — see "Follow-up notes" section below. NOT a Phase 42 blocker (Phase 42 contract is layout/structure, not illustration polish).

### 2. Column stability under scroll
expected: With real card heights (image posts, variable text-art lengths, video tiles, news tiles), cards never jump between columns when scrolling or when new tiles append. Each tile stays in the column it was first assigned to (height-accumulating split is append-only — confirmed by `tileColumnAssignmentsRef` immutability guard at MasonryFeed.tsx:382).
result: pass
evidence: Operator confirmed pass 2026-05-10 — tiles stable through scroll + swipe-for-more append. tileColumnAssignmentsRef immutability invariant holding.

### 3. Reduced Motion honored
expected: With `System Preferences → Accessibility → Reduce Motion → ON`, reload `/home` and trigger swipe-for-more. New tiles appear instantly with no fade-up entrance animation. `<MotionConfig reducedMotion="user">` wrapper should propagate through framer-motion v12 (RESEARCH.md Pitfall 1).
result: skipped
reason: Operator cannot test now (no easy way to toggle Reduce Motion at retest time). Source-reading invariant test exists at `tests/components/MasonryFeed.reduced-motion.test.mjs` (asserts MotionConfig wrapper present). Behavioral verification deferred to next opportunity with OS settings access.

### 4. VineBloomCard navigation CTAs
expected: With a real anchor dataset (mix of dying/dead leafStates), tapping Heal navigates to `/review` with anchorId/qaIds/title; tapping Re-plant navigates to `/posts/anchor-post-{id}`; tapping Open Planner navigates to `/planner`. ZERO new methods on `trellisActionsService` (Pitfall 3 — confirmed by source-reading test).
result: resolved
reported: "I clicked Heal 'Feynman Technique' and I am navigated to review page correctly, but I see mock flashcards like 'What is dialectical materialism' and 'Quantum entanglement'"
severity: major
resolution_commit: f86d273c
resolution_plan: 42-08-heal-review-empty-anchor-fix-PLAN.md
resolution_notes: Heal CTA's data half is now correct — when the requested anchor has 0 extracted flashcards, ReviewScreen renders an anchor-scoped empty state with the anchor title interpolated, instead of silently dumping the user into today's full SM-2 queue. Re-plant and Open Planner CTAs deferred — operator should retest those flows whenever convenient (no fix shipped because they were not exercised; if a similar fail-open exists in their data path, file a new gap).
partial_coverage: Only Heal CTA tested originally. Navigation half passed (route lands on /review). Data half failed — wrong cards rendered instead of cards filtered to the Feynman Technique anchor. Plan 42-08 fixed the data half. Re-plant and Open Planner CTAs were NOT tested in either round.
suspected_paths:
  - VineBloomCard not forwarding anchorId/qaIds/title in navigate() state payload
  - ReviewScreen not reading the state payload to filter cards (falls back to whole library)
  - Residual mock-flashcard seed not cleared by Phase 38-04 commit `8829a68c` (which removed hardcoded mock seeds for the fresh-install path — may not have covered Heal-flow seed source)
  - Cards shown ("dialectical materialism", "quantum entanglement") look like prior seed/test data, not anchor's real QAs

### 5. Two columns side-by-side (MASONRY-01 happy path)
expected: With ≥2 tiles in the feed, the masonry renders both columns with tiles distributed across them via the height-accumulating split. Right column should have content, not be empty.
result: pass
resolution_commit: 1de44017
evidence: Operator screenshot at retest after Wave 4 close-out showed ALL tiles piled into the LEFT column; right column was completely empty all the way down. Operator confirmed pass 2026-05-10 after `1de44017` shipped (advance heights in Pass 1 + move assignment to render body). Two regression locks added in MasonryFeed.layout.test.mjs.

### 5b. Columns adapt to screen width (MASONRY-01 fit)
expected: Both masonry columns fit inside HomeScreen's 448px maxWidth content area. Right column does NOT overflow off-screen on any device width.
result: pass
resolution_commit: 5f8a77f9
evidence: Operator screenshot 2026-05-09 after `1de44017` showed 2 columns rendering but right column overflowed off the right edge. Operator confirmed pass 2026-05-10 after `5f8a77f9` shipped (minWidth: 0 on BOTH column wrappers + width: 100% outer flex container). Same root cause as CLAUDE.md ChatInput rule.

### 6. Card typography tuned for half-width
expected: Existing card components (NewsCard, video card, text-art card) were designed for full-width InlineInfoFlow. At 50% width inside masonry columns, font sizes / paddings / line-heights need to shrink so headlines don't dominate the column or wrap to 1-2 words per line.
result: pass
resolution_commits: [f2471499, afe42922, df3a2553]
evidence: Operator screenshot 2026-05-09 after `5f8a77f9` showed news cards with massive serif headlines; subsequent screenshot after `f2471499` showed text-art wrapping to 5 lines and suggestion-card pills wrapping to 4 lines. Operator confirmed pass 2026-05-10 after the 3-commit chain landed (first-pass shrink + chrome tightening + LLM prompt tightener for text-art at source).

### 7. Inline-play removed from feed video cards
expected: Per operator: "Remove the inline play feature." Tapping a video card should navigate to PostDetailScreen (not start inline playback in the feed).
result: pass
resolution_commit: db864ffa
evidence: Operator screenshot 2026-05-09 showed gray-circle play button overlay center-blocking the YouTube thumbnail. Operator confirmed pass 2026-05-10 after removal: tap navigates to PostDetailScreen with no inline iframe, no play-icon overlay, no close button. Detector D (PostDetailScreen postMessage) is now the sole feed-level video signal.

### 8. Video thumbnail aspect — 5:4 landscape crop
expected: Per operator after rejecting portrait + native + hide-thumbnail options: "G sounds a little better if crop 5:4 (landscape) for landscape thumbnails. Vertical crop WILL DEFINITELY cause poor visual."
result: pass
resolution_commit: dec6241c
evidence: Operator reports 2026-05-10 after rounds 2 + 3 both showed black bars top/bottom. Round 4 diagnosed the root cause: bars are BAKED INTO YouTube's hqdefault.jpg. Operator confirmed pass 2026-05-10 after `dec6241c` shipped (transform: scale(1.34) zooms past the 12.5% bars; outer overflow: hidden clips the overscan).

### 11. Image post borderRadius mismatch with new card chrome
expected: AI-generated image posts (FeedPostImage) should have NO own corner crop — let the parent ConceptCard's overflow: hidden + 8px borderRadius clip the image to the card corners (same pattern as the video thumbnail).
result: pass
resolution_commit: d9f2af55
evidence: Operator screenshot 2026-05-10 round 2 retest showed image (library scene) inside card with visible card-background gradient between the image's rounded corners and the card's tighter corners. Operator confirmed pass 2026-05-10 after `d9f2af55` shipped (caught the missed aspectPadding branch). New regression test `FeedPostImage.no-self-radius.test.mjs` locks NO borderRadius anywhere + overflow: hidden present on both branches.

### 10. Buffer queue + per-swipe pop bumped for masonry consumption
expected: Per operator 2026-05-10: "Should enlarge buffer queue to 24 and each swipe for more should pop 8 posts." Masonry half-width tiles consume twice as fast as the prior single-column InlineInfoFlow.
result: pass
resolution_commit: 3a02c45d
evidence: Operator confirmed pass 2026-05-10 — swipe-for-more pops 8 (was 4), refill threshold 24 (was 16), walker batchSize 24, MAX_QUEUE_SIZE held at 32. CLAUDE.md "Concept Feed Generation Pipeline" numeric defaults updated.

### 9. Suggestion-card nested padding
expected: SuggestionCard topic pills (multi-line topic strings) wrapped to 4+ lines because of nested padding (16px outer card pad + 16px button pad = 32px lost per side at half-width). Should denest.
result: pass
resolution_commits: [afe42922, b2626cd4]
evidence: Operator screenshot 2026-05-09 showed "PLA vs PETG / thermal / resistance / comparison" wrapping to 4 lines per topic pill. Operator confirmed pass 2026-05-10 after `afe42922` (denest) + `b2626cd4` (font shrink to 11px) shipped.

### 12. Column balance with per-style height estimates
expected: After per-style height estimates land (commit `32ec3d65`), the masonry columns visually balance — no more 4-tile-tall vs 1-tile-tall skew. STYLE_HEIGHT_ESTIMATES table (news 225 / image 280 / video 250 / text-art 290 / suggestion 180 / connection 280 / milestone 240 / default 260) feeds Pass 1's comparator instead of a flat 280 estimate, so 60-110px style differences are visible from the very first render.
result: pass
resolution_commit: 32ec3d65
evidence: Operator screenshot 2026-05-10 (UAT-12 round 1) showed left column with 4 visible tiles vs right column with 1 visible tile. Operator confirmed pass 2026-05-10 after `32ec3d65` shipped (per-style estimates feed Pass 1 comparator). Solution C (ResizeObserver feedback cache) held in reserve if rebalancing still skews after a session of usage.

## Follow-up notes (NOT Phase 42 blockers — separate visual-polish work)

### F-1 — VineBloomCard vine illustration is ugly
captured: 2026-05-10 during UAT-1 retest
operator_quote: "the vine is super ugly, need to fine tune its appearance"
status: open
phase 42 surface: end-to-end render passes (vine appears + CTAs work) — UAT-1 contract met
recommendation: Schedule a separate UI polish phase for VineBloomCard illustration. Likely path: replace SVG / commission proper vine illustration / use a richer animated SVG with bloom + leaves. Not in scope for Phase 42's layout deliverable.

### REGRESSION TRIAGE — text-art / image distribution skewed
status: open (NOT a Phase 42 regression — separate investigation queued)
operator_observation: "All posts are news and videos again. No text-art and image posts."
phase 42 surface confirmed clean: Phase 42 commits only touched MasonryFeed.tsx, InfoFlow.tsx (exports + 3 deletions + chrome typography + inline-play removal), HomeScreen.tsx (swap), index.css (1 keyframe), 4 locale bundles, 5 test files. ZERO touch to style-assignment.ts, concept-feed.service.ts (until 3B text-art prompt — but that affects content per post, not distribution), post-queue.service.ts.
last pipeline-relevant change before this skew: Phase 41-01 commits 83804b5c, c68bd4b2 (sourceDiversityService wired into news pre-fetch + Tavily maxResults 3).
effective STYLE_WEIGHTS (style-assignment.ts:23-29): text-art 55%, video 20%, image 10%, news 10%, suggestion 5% (when all API keys present).
suggested next step: `/gsd:debug "feed dominated by news+video, text-art absent despite 55% weight"` after operator confirms Phase 42 layout work is complete. Likely investigation paths: (a) cache holding pre-rebalance posts (Force-New-Day clears), (b) image-gen failure path silently downgrading to text-art at line 1386 then text-art content failing → fallback path → cards not rendering, (c) Phase 41-01 sourceDiversityService over-pre-fetching news.

## Summary

total: 12
passed: 10
issues: 1
pending: 0
skipped: 1
blocked: 0
note: 10 passes, 1 skipped (UAT-3 Reduce Motion — operator unable to toggle OS setting at retest time; source-reading invariant test covers structural side), 1 originally-issue → resolved via plan 42-08 commit f86d273c (UAT-4 Heal CTA: ReviewScreen fail-open boolean fixed + anchor-scoped empty state across 4 locales). Follow-up F-1 logged: vine illustration polish (separate phase).

## Gaps

### Gap 2 — Heal CTA renders unfiltered/mock-looking cards instead of anchor-specific QAs
status: resolved
resolution_commit: f86d273c
resolution_plan: 42-08-heal-review-empty-anchor-fix-PLAN.md
resolution_notes: Plan 42-08 changed `Boolean(filteredItems && filteredItems.length > 0)` to `filteredItems !== null` (distinguishing "filter not requested" from "filter requested but zero matches") and added an anchor-scoped empty branch with `{{title}}` interpolation across en/zh/es/ja. Source-reading regression test at `tests/screens/ReviewScreen.anchor-empty-state.test.mjs` locks both shapes. The optional follow-up (seed flashcards from QA records on `heal()`) was deferred — operator can plan-gate it later if the anchor-empty state surfaces too often.
test: UAT-4
phase_origin: PRE-EXISTING in `ReviewScreen.tsx:299` (NOT a Phase 42 regression). Phase 42 Wave 4 made it user-visible by promoting heal into the always-on celebration UX. Same bug pre-exists in PlannerScreen heal/replant flow.
operator_quote: "I clicked Heal 'Feynman Technique' and I am navigated to review page correctly, but I see mock flashcards like 'What is dialectical materialism' and 'Quantum entanglement'"
severity: major
debug_session: .planning/debug/heal-review-shows-mock-cards.md
root_cause: |
  `app/src/screens/ReviewScreen.tsx:299`:
    const isFiltered = Boolean(filteredItems && filteredItems.length > 0);
  Fail-open boolean. When VineBloomCard navigates to /review with
  state.anchorReview = { anchorId, qaIds, title } for an anchor whose QAs have
  ZERO extracted flashcards, anchorFilteredItems is [], so isFiltered becomes
  false, and reviewItems falls back to `items` (today's full SM-2 due queue).
  User sees real cards from OTHER anchors — not Feynman cards, not empty state.

  Why "Feynman Technique" specifically has 0 matching cards: flashcards are
  LLM-extracted from chat sessions in flashcard.service.ts:174-204 with nodeId
  assigned via fuzzy keyword overlap. Anchors the user never chatted about
  have no flashcards with `nodeId === any qaId`. The celebration UX
  statistically targets such anchors (dying/dead suggestions = anchors the
  user has been ignoring).
ruled_out:
  - NOT residual mock seeds (codebase-wide grep for "dialectical"/"Quantum entanglement" returns zero hits in app/src; Phase 38-04 commit `8829a68c` already cleared those)
  - NOT a Phase 42 regression (VineBloomCard.tsx correctly passes result.state at MasonryFeed.tsx:76; contract matches PlannerScreen.tsx:79-87 verbatim)
  - NOT a trellisActionsService.heal() bug (service returns the correct nav payload at trellis-actions.service.ts:54-72)
artifacts: [app/src/screens/ReviewScreen.tsx]
missing: |
  Two-state distinction in ReviewScreen between "no filter requested" and
  "filter requested but zero matches", plus an explicit anchor-scoped empty
  state for the latter so the user sees a meaningful message instead of being
  silently routed to the global SM-2 queue.
suggested_fix:
  - ReviewScreen.tsx:299 — change `Boolean(filteredItems && filteredItems.length > 0)` to `filteredItems !== null` (distinguish requested-vs-not from matched-vs-not)
  - ReviewScreen.tsx ~line 519 (done || reviewItems.length === 0 branch) — when isFiltered && filteredItems.length === 0, render "No flashcards yet for {anchorReview.title} — start a chat about it to generate cards" using the title from nav state
  - Optional out-of-scope follow-up: on heal(), seed flashcards from QA records (question.content → front, question.answer → back) so celebration UX always has reviewable cards. Plan-gated, NOT bundled into this bug fix.

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

