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
//     MemoizedConceptCard's video thumbnail onClick. MasonryFeed.tsx must NOT
//     add a parallel emit at the wrapper level.
//
// Pattern A (positive presence + negative grep in same file). Mirrors
// tests/components/InfoFlow.video-tap-emit.test.mjs.
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
});
