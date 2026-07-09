// Phase 51-01 Task 1: tests for resolveAnchorId(qaId).
//
// Pure-function test — seeds localStorage with a small fixture set, then
// exercises the 5 documented branches in the plan:
//   1. Q&A whose parent is an anchor → returns parent.id
//   2. Anchor itself (isAnchorNode: true) → returns same id
//   3. Orphan Q&A (no parentId) → null
//   4. Q&A whose parent is NOT an anchor → null (no deeper walk)
//   5. Unknown id → null
//
// localStorage polyfill follows the pattern at tests/concept-quota.test.mjs.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { resolveAnchorId } = await import('../../src/lib/anchor-resolution.ts');
const { questionService } = await import('../../src/services/question.service.ts');

// Phase 55-07: questions are an in-memory mirror (IndexedDB-backed). resolveAnchorId
// reads questionService.getAll(), so tests seed the mirror via restoreDeleted()
// (the one sanctioned direct-insert seam) instead of writing the localStorage key.

// Minimal Question shape — only the fields the helper actually reads.
function q(overrides) {
  return {
    id: overrides.id,
    timestamp: 0,
    date: '2026-05-19',
    content: 'placeholder',
    answer: '',
    summary: '',
    title: overrides.id,
    keywords: [],
    relatedQuestionIds: [],
    categoryIds: [],
    reviewSchedule: { nextReviewDate: '', reviewCount: 0, easeFactor: 2.5 },
    createdAt: 0,
    ...overrides,
  };
}

function seed(questions) {
  for (const question of questions) questionService.restoreDeleted(question);
}

describe('resolveAnchorId (Phase 51-01 Task 1)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    // Clear the in-memory question mirror between tests.
    for (const existing of questionService.getAll({ includeFlagged: true })) {
      void questionService.delete(existing.id);
    }
  });

  it('returns parent.id when Q&A.parent is an anchor', () => {
    seed([
      q({ id: 'anchor-1', isAnchorNode: true }),
      q({ id: 'qa-1', parentId: 'anchor-1' }),
    ]);
    assert.equal(resolveAnchorId('qa-1'), 'anchor-1');
  });

  it('returns same id when the node IS an anchor (isAnchorNode: true)', () => {
    seed([
      q({ id: 'anchor-1', isAnchorNode: true }),
    ]);
    assert.equal(resolveAnchorId('anchor-1'), 'anchor-1');
  });

  it('returns null for an orphan Q&A with no parentId', () => {
    seed([
      q({ id: 'qa-orphan' }), // no parentId at all
    ]);
    assert.equal(resolveAnchorId('qa-orphan'), null);
  });

  it('returns null when parent exists but is NOT an anchor (does not walk further up)', () => {
    // Trellis fixed-depth invariant: anchor → Q&A. If parent is not an anchor,
    // we treat as unresolvable rather than risk returning a non-anchor id.
    seed([
      q({ id: 'qa-grandparent', isAnchorNode: false }),
      q({ id: 'qa-parent', parentId: 'qa-grandparent', isAnchorNode: false }),
      q({ id: 'qa-leaf', parentId: 'qa-parent' }),
    ]);
    assert.equal(resolveAnchorId('qa-leaf'), null);
  });

  it('returns null for an unknown id', () => {
    seed([
      q({ id: 'anchor-1', isAnchorNode: true }),
    ]);
    assert.equal(resolveAnchorId('does-not-exist'), null);
  });

  it('returns null for empty/undefined-like input', () => {
    seed([q({ id: 'anchor-1', isAnchorNode: true })]);
    assert.equal(resolveAnchorId(''), null);
  });

  it('resolves correctly when questionService store is empty', () => {
    // Empty store — no seeding.
    assert.equal(resolveAnchorId('anything'), null);
  });
});
