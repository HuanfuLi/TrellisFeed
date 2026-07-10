// Wave 0 scaffold (55-01); turned green by 55-04.
//
// like-boost (Phase 55 D-14) — a liked concept gets 4->8 derived-list multiplicity
// using BASE_ENTRIES_PER_CONCEPT * 2, without inventing
// a new list or touching the append-only derived list inside buildConceptBatch
// (CLAUDE.md 3-list pipeline invariant). Source-reading asserts; RED until 55-04.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

const feedSource = fs.readFileSync(
  new URL('../../src/services/concept-feed.service.ts', import.meta.url),
  'utf-8',
);

const batchIdx = feedSource.indexOf('function buildConceptBatch');
// Slice the FULL function body (start → its column-0 closing brace) rather than a
// fixed char window. The real 55-04 implementation carries a rationale comment block
// that pushed the boost code past the original 1200-char estimate; scanning the whole
// function keeps both the positive (BASE*2 / isBoosted) and negative (no list mutation)
// assertions sound regardless of comment length.
const batchEnd = batchIdx === -1 ? -1 : feedSource.indexOf('\n}', batchIdx);
const batchBlock = batchIdx === -1 ? '' : feedSource.slice(batchIdx, batchEnd === -1 ? batchIdx + 1200 : batchEnd + 2);

describe('like-boost (Phase 55 D-14)', () => {
  it('buildConceptBatch uses isLiked, not a new list', () => {
    assert.match(
      feedSource,
      /const\s+isLiked\s*=\s*likedConceptIds\.has\(anchor\.id\)/,
      'like-boost must derive a local isLiked flag from likedConceptIds',
    );
  });

  it('buildConceptBatch uses BASE_ENTRIES_PER_CONCEPT * 2 for liked anchors', () => {
    assert.ok(batchIdx !== -1, 'buildConceptBatch must exist in concept-feed.service.ts');
    assert.match(
      batchBlock,
      /BASE_ENTRIES_PER_CONCEPT\s*\*\s*2/,
      'liked concept multiplicity must equal BASE_ENTRIES_PER_CONCEPT * 2 — same as importance doubling',
    );
  });

  // Source-reading: 3-list pipeline not violated (derived list stays append-only).
  it('buildConceptBatch does not call appendToDerivedList or splice the derived list', () => {
    assert.ok(batchIdx !== -1, 'buildConceptBatch must exist in concept-feed.service.ts');
    assert.doesNotMatch(
      batchBlock,
      /appendToDerivedList|derivedList\.splice/,
      'buildConceptBatch must not touch the derived list — it only returns conceptIds for the caller to append',
    );
  });

  // Key-link: liked postIds are resolved to anchor ids before the loop (plan key_links).
  it('buildConceptBatch resolves liked postIds via engagementService.getLikedPostIds', () => {
    assert.match(
      batchBlock,
      /engagementService\.getLikedPostIds\(\)/,
      'like-boost must read the recorded like signal via getLikedPostIds',
    );
    assert.match(
      batchBlock,
      /sourceQuestionIds\?\.\[0\]/,
      'liked post → anchor id mapping must use sourceQuestionIds[0] (pipeline convention; DailyPost has no conceptId)',
    );
  });

  it('like-boost is not additive — no new starvation vector', () => {
    assert.doesNotMatch(
      batchBlock,
      /BASE_ENTRIES_PER_CONCEPT\s*\*\s*[34]/,
      'multiplicity must not exceed BASE*2 — additive stacking (BASE*3/BASE*4) would create a new starvation vector',
    );
  });
});

// ── STYLE_WEIGHTS verify-and-keep ───────────────────────────────────────────
// These are lightweight verify-and-keep checks. The exhaustive STYLE_WEIGHTS sum
// and stratified-allocation behavior live in style-assignment.test.mjs +
// style-assignment-stratified.test.mjs (referenced, NOT duplicated here).
const styleSource = fs.readFileSync(
  new URL('../../src/services/style-assignment.ts', import.meta.url),
  'utf-8',
);

describe('weights verify-and-keep (Phase 55 D-15)', () => {
  it('STYLE_WEIGHTS sum to 1.0', () => {
    // Parse the numeric literals from the STYLE_WEIGHTS object literal.
    const block = styleSource.slice(
      styleSource.indexOf('export const STYLE_WEIGHTS'),
      styleSource.indexOf('};', styleSource.indexOf('export const STYLE_WEIGHTS')),
    );
    const nums = [...block.matchAll(/:\s*(0?\.\d+)/g)].map((m) => parseFloat(m[1]));
    assert.ok(nums.length >= 3, 'STYLE_WEIGHTS must declare its style weights');
    const sum = nums.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `STYLE_WEIGHTS sum to ${sum}, expected 1.0`);
  });

  it('STYLE_WEIGHTS carries a rationale comment (verify-and-keep)', () => {
    const idx = styleSource.indexOf('export const STYLE_WEIGHTS');
    const preamble = styleSource.slice(Math.max(0, idx - 900), idx);
    assert.match(preamble, /Weighted random style assignment|distribution|styles are decided/i,
      'STYLE_WEIGHTS must keep its rationale comment per D-15');
  });

  it('assignStyles has dev-gated realized-mix instrumentation (D-02)', () => {
    assert.match(styleSource, /import\.meta\.env\?\.DEV/,
      'realized style-mix instrumentation must be dev-gated');
    assert.match(styleSource, /\[assignStyles\]/,
      'assignStyles must log the realized counts for drift detection');
  });

});
