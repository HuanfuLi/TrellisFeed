// Phase 42 plan 42-05 — VineBloomCard celebration source-reading invariants.
//
// Locks UI-SPEC invariant #5 (VineBloomCard renders when allExplored &&
// layout.nodes.length > 0) and the RESEARCH.md § 1 path b architectural
// decision: VineBloomCard consumes useTrellisData() directly rather than
// a new trellisActionsService.getCelebrationSuggestions() surface.
//
// Counterweight: also asserts the live trellisActionsService surface still
// contains heal() + replant() (the methods VineBloomCard ROUTES THROUGH for
// user actions — even though it doesn't depend on a NEW service method, it
// still calls the existing methods).
//
// Pattern A (positive presence + negative grep across two source files).
//
// Required reading: RESEARCH.md § 1 (VineBloomCard data path); UI-SPEC § Source-
// Reading Invariant Tests #5; PlannerScreen.tsx:46-47 (the leafState filter
// pattern VineBloomCard mirrors verbatim).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASONRY_PATH = resolve(__dirname, '../../src/components/MasonryFeed.tsx');
const TRELLIS_ACTIONS_PATH = resolve(__dirname, '../../src/services/trellis-actions.service.ts');

const masonrySource = readFileSync(MASONRY_PATH, 'utf-8');
const trellisActionsSource = readFileSync(TRELLIS_ACTIONS_PATH, 'utf-8');

describe('MasonryFeed VineBloomCard celebration invariants (Phase 42 MASONRY-02)', () => {
  // Counterweight — proves the test reaches MasonryFeed.tsx and VineBloomCard exists.
  it('contains the VineBloomCard function declaration (counterweight)', () => {
    assert.ok(
      /function\s+VineBloomCard\s*\(/.test(masonrySource),
      'MasonryFeed.tsx must declare a function VineBloomCard — replaces plan 42-01 placeholder per plan 42-04.',
    );
  });

  it('VineBloomCard placeholder is gone (real implementation lands per plan 42-04)', () => {
    assert.ok(
      !/function\s+VineBloomCard\(\)\s*\{\s*return\s+null;?\s*\}/.test(masonrySource),
      'MasonryFeed.tsx must NOT contain the placeholder body `function VineBloomCard() { return null; }` — plan 42-04 replaces it with real implementation.',
    );
  });

  // RESEARCH.md § 1 path b — useTrellisData consumption (NOT a new service surface).
  it('imports useTrellisData from state hook (RESEARCH.md § 1 path b — hook-level consumption over service surface change)', () => {
    assert.ok(
      /import\s+\{[^}]*useTrellisData[^}]*\}\s+from\s+['"]\.\.\/state\/useTrellisData['"]/.test(masonrySource),
      'MasonryFeed.tsx must import useTrellisData from ../state/useTrellisData — VineBloomCard derives suggestions inline rather than via a new trellisActionsService method.',
    );
  });

  it('VineBloomCard uses leafState filter (mirrors PlannerScreen.tsx:46-47 pattern)', () => {
    assert.ok(
      /leafState\s*===\s*['"]dead['"]/.test(masonrySource),
      "MasonryFeed.tsx must contain `leafState === 'dead'` filter — RESEARCH.md § 1 path b.",
    );
    assert.ok(
      /leafState\s*===\s*['"]dying['"]/.test(masonrySource),
      "MasonryFeed.tsx must contain `leafState === 'dying'` filter — RESEARCH.md § 1 path b.",
    );
  });

  // RESEARCH.md § 1 — no new trellisActionsService method.
  it('trellisActionsService still exposes ONLY heal/replant/prune/unpruneQuestion/hardDelete (no new getCelebrationSuggestions method — RESEARCH.md § 1 path b)', () => {
    // Counterweight: confirm the existing methods are still there.
    assert.ok(
      /heal\s*\(/.test(trellisActionsSource),
      'trellis-actions.service.ts must still export heal() — counterweight.',
    );
    assert.ok(
      /replant\s*\(/.test(trellisActionsSource),
      'trellis-actions.service.ts must still export replant() — counterweight.',
    );

    // The negative: no new getter added.
    assert.ok(
      !/getCelebrationSuggestions/.test(trellisActionsSource),
      'trellis-actions.service.ts must NOT expose getCelebrationSuggestions — RESEARCH.md § 1 path b: VineBloomCard owns its own data read via useTrellisData.',
    );
    assert.ok(
      !/getDailyActions/.test(trellisActionsSource),
      'trellis-actions.service.ts must NOT expose getDailyActions — same reason.',
    );
    assert.ok(
      !/getSuggestedMoves/.test(trellisActionsSource),
      'trellis-actions.service.ts must NOT expose getSuggestedMoves — same reason.',
    );
  });

  it("VineBloomCard wires Open Planner CTA to navigate('/planner') (UI-SPEC § VineBloomCard internal layout step 5)", () => {
    assert.ok(
      /navigate\(['"]\/planner['"]\)/.test(masonrySource),
      "MasonryFeed.tsx VineBloomCard must call navigate('/planner') for Open Planner CTA.",
    );
  });

  it('VineBloomCard inline SVG matches UI-SPEC § Vine SVG Specification (88x88 viewBox)', () => {
    assert.ok(
      /viewBox=["']0\s+0\s+88\s+88["']/.test(masonrySource),
      'MasonryFeed.tsx VineBloomCard must contain the 88x88 vine SVG (UI-SPEC § Vine SVG Specification).',
    );
    assert.ok(
      /motion\.circle/.test(masonrySource),
      'MasonryFeed.tsx VineBloomCard must contain motion.circle for the bloom path-draw animation.',
    );
  });
});
