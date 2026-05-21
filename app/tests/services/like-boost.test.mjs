// Wave 0 scaffold (55-01); turned green by 55-04.
//
// like-boost (Phase 55 D-14) — a liked concept gets 4->8 derived-list multiplicity
// using the SAME BASE_ENTRIES_PER_CONCEPT * 2 lever as importance, without inventing
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
  // Source-reading: like-boost reuses the isImportant||isLiked boost flag.
  it('buildConceptBatch uses isBoosted = isImportant || isLiked, not a new list', () => {
    assert.match(
      feedSource,
      /isBoosted\s*=\s*isImportant\s*\|\|\s*isLiked/,
      'like-boost must reuse the isImportant||isLiked pattern (D-14 no-new-list invariant)',
    );
  });

  it('buildConceptBatch uses BASE_ENTRIES_PER_CONCEPT * 2 for boosted (like or important)', () => {
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
});
