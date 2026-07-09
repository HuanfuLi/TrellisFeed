// Phase 55.1 BUGFIX-02 / CR-01 — EXECUTING guard for the text-art fragment gate.
//
// The original inline gate `!/\s/.test(s) && s.length < 8` (1) discarded valid
// short CJK headlines after a LOCALE_CHANGED to zh/ja, and (2) never caught the
// dangling "Is your" fragment it was written for. This test runs the extracted
// pure predicate over representative inputs so both defects stay closed — unlike
// the source-reading `text-art-tightener.test.mjs`, this actually executes it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUnusableTextArtFragment } from '../../src/services/text-art-fragment.ts';

describe('isUnusableTextArtFragment (Phase 55.1 BUGFIX-02 / CR-01)', () => {
  it('rejects empty / whitespace-only input', () => {
    assert.equal(isUnusableTextArtFragment(''), true);
    assert.equal(isUnusableTextArtFragment('   '), true);
    assert.equal(isUnusableTextArtFragment(null), true);
    assert.equal(isUnusableTextArtFragment(undefined), true);
  });

  it('rejects a single starved Latin token under the floor', () => {
    assert.equal(isUnusableTextArtFragment('T'), true);
    assert.equal(isUnusableTextArtFragment('RAG'), true);
  });

  it('rejects a dangling multi-word Latin fragment with no terminator', () => {
    // The exact fragment the original gate claimed to catch but did not.
    assert.equal(isUnusableTextArtFragment('Is your'), true);
  });

  it('KEEPS valid short CJK headlines (no inter-word spaces) — locale regression guard', () => {
    assert.equal(isUnusableTextArtFragment('世界模型为何重要'), false); // zh, 7 chars
    assert.equal(isUnusableTextArtFragment('注意機構とは'), false); // ja
    assert.equal(isUnusableTextArtFragment('어텐션이란'), false); // ko
  });

  it('KEEPS valid Latin headlines', () => {
    assert.equal(isUnusableTextArtFragment('RAG is dead.'), false); // short, terminated
    assert.equal(
      isUnusableTextArtFragment('Why the Smell of Safety Makes AI Unsafe'),
      false,
    ); // long, no terminator — above the dangling floor
  });
});
