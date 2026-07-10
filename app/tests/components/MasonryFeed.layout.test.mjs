// Phase 42 plan 42-05 — MasonryFeed source-reading invariants.
//
// Locks the structural contracts from UI-SPEC § Source-Reading Invariant Tests
// (#1 leaf-tile-only motion.div, #2 D-02 no CSS column-count, #3 Header
// positioning rule no will-change/perspective, #6 D-02 immutability) plus the
// two NEW invariants discovered during research:
//   - RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect
//     prefers-reduced-motion; <MotionConfig reducedMotion="user"> wrapper opt-in
//     is mandatory.
//   - RESEARCH.md Pitfall 4 — GAP-C single-emit invariant: the canonical
//     dailyReadService.markExplored + CONCEPT_EXPLORED emit lives in
//     MemoizedConceptCard's concept-card onClick. MasonryFeed.tsx must NOT
//     add a parallel emit at the wrapper level.
//
// Pattern A (positive presence + negative grep in same file). Mirrors
// source-reading component tests.
//
// All assertions are pure source-read; no DOM render; runs in <1s.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASONRY_PATH = resolve(__dirname, '../../src/components/MasonryFeed.tsx');
const HOMESCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');

const masonrySource = readFileSync(MASONRY_PATH, 'utf-8');
const homeSource = readFileSync(HOMESCREEN_PATH, 'utf-8');

describe('MasonryFeed layout invariants (Phase 42)', () => {
  // Counterweight — proves the test reaches the file and the load-bearing
  // structures exist (D-02 height-accumulator).
  it('contains the columnHeightsRef state declaration (counterweight)', () => {
    assert.ok(
      masonrySource.includes('columnHeightsRef'),
      'MasonryFeed.tsx must declare columnHeightsRef — D-02 height-accumulating split.',
    );
    assert.ok(
      masonrySource.includes('tileColumnAssignmentsRef'),
      'MasonryFeed.tsx must declare tileColumnAssignmentsRef — D-02 immutability invariant Map.',
    );
  });

  // UI-SPEC invariant #2 — D-02 negative grep.
  it('does NOT use CSS column-count or break-inside (D-02 height-accumulating split chosen over CSS column-count)', () => {
    assert.ok(
      !/column-count/i.test(masonrySource),
      'MasonryFeed.tsx must NOT contain `column-count` CSS — D-02 selected height-accumulating JS split (CSS column-count shuffles tiles between columns on append).',
    );
    assert.ok(
      !/columnCount/.test(masonrySource),
      'MasonryFeed.tsx must NOT contain `columnCount` JSX style — same reason.',
    );
    assert.ok(
      !/break-inside/i.test(masonrySource),
      'MasonryFeed.tsx must NOT contain `break-inside` CSS — D-02 selected height-accumulating JS split.',
    );
    assert.ok(
      !/breakInside/.test(masonrySource),
      'MasonryFeed.tsx must NOT contain `breakInside` JSX style — same reason.',
    );
  });

  // UI-SPEC invariant #3 — Header positioning rule (CLAUDE.md load-bearing).
  it('does NOT use will-change / perspective on root or column wrappers (CLAUDE.md Header positioning load-bearing rule)', () => {
    assert.ok(
      !/will-change/i.test(masonrySource),
      'MasonryFeed.tsx must NOT use will-change — Header positioning rule (any ancestor of <Header> with these properties creates a containing block, breaking portal-vs-in-tree shape).',
    );
    assert.ok(
      !/willChange/.test(masonrySource),
      'MasonryFeed.tsx must NOT use willChange — Header positioning rule.',
    );
    assert.ok(
      !/perspective:/.test(masonrySource),
      'MasonryFeed.tsx must NOT use perspective — Header positioning rule.',
    );
  });

  // UI-SPEC invariant #1 — leaf-tile only motion.div.
  it('contains at least one motion.div leaf-tile wrapper (D-03 leaf-tile entrance animation)', () => {
    assert.ok(
      /motion\.div/.test(masonrySource),
      'MasonryFeed.tsx must contain at least one <motion.div> wrapper — D-03 leaf-tile entrance animation.',
    );
  });

  // UI-SPEC invariant #1 (cross-file) — motion.div absent from HomeScreen.
  it('motion.div NOT used in HomeScreen.tsx (D-03 — wrapper-level animation forbidden)', () => {
    assert.ok(
      !/motion\.div/.test(homeSource),
      'HomeScreen.tsx must NOT contain <motion.div> — D-03 says framer-motion entrance is on leaf tiles inside MasonryFeed only, not at HomeScreen scroll-container level.',
    );
  });

  // NEW invariant from RESEARCH.md Pitfall 1 — framer-motion v12 reduced-motion opt-in.
  it('contains MotionConfig with reducedMotion="user" wrapper (RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect prefers-reduced-motion)', () => {
    assert.ok(
      /MotionConfig/.test(masonrySource),
      'MasonryFeed.tsx must import + use MotionConfig — framer-motion v12 does NOT auto-respect prefers-reduced-motion (verified motion.dev/docs/react-accessibility 2026-05-09).',
    );
    assert.ok(
      /reducedMotion=["']user["']/.test(masonrySource),
      'MasonryFeed.tsx MotionConfig must set reducedMotion="user" — opts in to OS-level Reduce Motion honoring for all motion descendants.',
    );
  });

  // UI-SPEC invariant #6 (source-reading proxy) — column assignment immutability.
  it('column assignment is gated by tileColumnAssignmentsRef.current.has() check (D-02 immutability invariant)', () => {
    assert.ok(
      /tileColumnAssignmentsRef\.current\.has\([^)]+\)\)\s*continue/.test(masonrySource) ||
        /if\s*\(tileColumnAssignmentsRef\.current\.has/.test(masonrySource),
      'MasonryFeed.tsx assignment loop must skip already-assigned tiles via tileColumnAssignmentsRef.current.has(itemId) — D-02 immutability invariant.',
    );
  });

  // RESEARCH.md Pitfall 4 — GAP-C single-emit (no parallel emit in MasonryFeed).
  it('does NOT add a parallel CONCEPT_EXPLORED emit (Pitfall 4 — GAP-C emit lives in MemoizedConceptCard)', () => {
    assert.ok(
      !/dailyReadService\.markExplored/.test(masonrySource),
      'MasonryFeed.tsx must NOT contain dailyReadService.markExplored call — GAP-C single-emit invariant; the canonical emit lives inside MemoizedConceptCard.',
    );
    assert.ok(
      !/type:\s*['"]CONCEPT_EXPLORED['"]/.test(masonrySource),
      'MasonryFeed.tsx must NOT emit CONCEPT_EXPLORED — Pitfall 4 from RESEARCH.md; the canonical emit lives inside MemoizedConceptCard.',
    );
  });

  // UAT-5 regression lock (Phase 42 post-execute fix) — Bug A.
  // Pass 1 MUST advance columnHeightsRef per iteration so the comparator
  // zigzags during the initial batch. Without this, [0,0] + <= tie-breaker
  // piles every newly-assigned item into column 0.
  it('Pass 1 advances columnHeightsRef during the assignment loop (UAT-5 Bug A regression lock)', () => {
    assert.ok(
      /columnHeightsRef\.current\[col\]\s*\+=/.test(masonrySource),
      'MasonryFeed.tsx Pass 1 must advance columnHeightsRef.current[col] += <height> after each assignment — without it, the first batch piles into column 0 (UAT-5 from 2026-05-09 retest).',
    );
  });

  // UAT-12 regression lock — per-style height estimates (Solution A).
  // Before: Pass 1 used a fixed 280px estimate per tile so the comparator
  // balanced COUNT, not HEIGHT. After: per-style estimates close the 60-110px
  // height differences between styles so tall tiles correctly land in the
  // shorter column from the very first render.
  it('Pass 1 estimates per-tile height by style (UAT-12 column-balance regression lock)', () => {
    assert.ok(
      /STYLE_HEIGHT_ESTIMATES/.test(masonrySource),
      'MasonryFeed.tsx must declare a STYLE_HEIGHT_ESTIMATES table — without per-style estimates, ' +
      'a fixed default makes the Pass 1 comparator balance count instead of height (UAT-12 from 2026-05-10).',
    );
    assert.ok(
      /function\s+estimateHeightForItem\s*\(/.test(masonrySource),
      'MasonryFeed.tsx must declare an estimateHeightForItem(item) helper that maps each ' +
      'InfoFlowItem to its per-style height estimate.',
    );
    assert.ok(
      /estimateHeightForItem\(item\)/.test(masonrySource),
      'MasonryFeed.tsx Pass 1 must call estimateHeightForItem(item) (or equivalent style-aware ' +
      'estimator) when no measured height is cached. A fixed numeric fallback like `?? 280` regresses ' +
      'the column-balance fix.',
    );
    assert.ok(
      !/\?\?\s*280/.test(masonrySource),
      'MasonryFeed.tsx Pass 1 must NOT use the fixed `?? 280` fallback that the per-style ' +
      'estimate replaced. Found a `?? 280` literal — this regresses UAT-12.',
    );
    // Spot-check that the table covers all the major presentation styles
    // touched by the masonry pipeline.
    for (const key of ['image', 'text-art', 'suggestion']) {
      assert.ok(
        new RegExp(`['"]?${key}['"]?\\s*:\\s*\\d`).test(masonrySource),
        `STYLE_HEIGHT_ESTIMATES must include a numeric entry for "${key}".`,
      );
    }
  });

  // UAT-5 regression lock (Phase 42 post-execute fix) — Bug B.
  // Pass 1 (assignment loop) must run during render (not exclusively inside a
  // useLayoutEffect) so first-paint filters see populated assignments.
  // Refs do not trigger re-renders, so a ref-only post-commit assignment
  // would leave the first paint with empty columns.
  // UAT-5b regression lock — flex columns must shrink below intrinsic content width.
  // Same root cause as CLAUDE.md ChatInput rule: flex children with intrinsic content
  // (image-bearing cards, text-art captions) overflow the parent unless minWidth: 0 is
  // explicit on each column. The fix also pins the outer container to width: '100%'
  // so it fills HomeScreen's maxWidth-capped content area predictably.
  it('column wrappers have minWidth: 0 alongside flex: 1 (UAT-5b regression lock — same as ChatInput rule)', () => {
    const minWidthCount = (masonrySource.match(/minWidth:\s*0/g) || []).length;
    assert.ok(
      minWidthCount >= 2,
      `MasonryFeed.tsx must declare minWidth: 0 on BOTH column wrappers (found ${minWidthCount} occurrence(s)). Without minWidth: 0, flex children with intrinsic content width overflow the parent — same load-bearing gotcha as the ChatInput input (CLAUDE.md "ChatInput flex shrink"). UAT-5b from 2026-05-09 retest.`,
    );
    assert.ok(
      /width:\s*['"]100%['"]/.test(masonrySource),
      'MasonryFeed.tsx outer flex container must declare width: "100%" so it fills the HomeScreen maxWidth-capped content area. UAT-5b from 2026-05-09 retest.',
    );
  });

  it('Pass 1 assignment loop runs during render, not exclusively inside useLayoutEffect (UAT-5 Bug B regression lock)', () => {
    // The assignment loop signature is `tileColumnAssignmentsRef.current.set(itemId, col)`.
    // Find its position. Pass 1 must run during render so first-paint filters see
    // populated assignments — refs do not trigger re-renders, so a ref-only post-commit
    // assignment leaves first paint with empty columns. Proxy: assignment must appear
    // BEFORE the first `useLayoutEffect(` call site (skips the import-line match).
    const assignmentIdx = masonrySource.indexOf('tileColumnAssignmentsRef.current.set');
    const layoutEffectCallMatch = masonrySource.match(/useLayoutEffect\s*\(/);
    assert.ok(
      assignmentIdx > 0,
      'MasonryFeed.tsx must contain a tileColumnAssignmentsRef.current.set() call (the column assignment).',
    );
    assert.ok(
      layoutEffectCallMatch && layoutEffectCallMatch.index !== undefined,
      'MasonryFeed.tsx must contain at least one useLayoutEffect( call site (Pass 2 DOM re-measure).',
    );
    assert.ok(
      assignmentIdx < layoutEffectCallMatch.index,
      'MasonryFeed.tsx Pass 1 (tileColumnAssignmentsRef.current.set) must appear BEFORE the first useLayoutEffect( call site — render-time assignment is required so first-paint filters see populated assignments (refs do not trigger re-renders). UAT-5 Bug B from 2026-05-09 retest.',
    );
  });
});
