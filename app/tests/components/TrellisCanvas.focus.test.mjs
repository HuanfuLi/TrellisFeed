import assert from 'node:assert/strict';
import test from 'node:test';

// ── Phase 28 D-12 Wave 0 test ─────────────────────────────────────────────
//
// Inline mirror of isLeafFocused from TrellisCanvas.tsx. Source-side export
// verified separately via grep in the plan's acceptance_criteria. Contract
// must stay in lockstep between mirror and source.
//
// Same rationale as TrellisLeaf.shake.test.mjs / BottomNavigation.slide.test.mjs.

const isLeafFocused = (focusedAnchorId, leafAnchorId) => {
  if (!focusedAnchorId || !leafAnchorId) return false;
  return focusedAnchorId === leafAnchorId;
};

test('isLeafFocused returns true on match', () => {
  assert.equal(isLeafFocused('a1', 'a1'), true);
});

test('isLeafFocused returns false on mismatch', () => {
  assert.equal(isLeafFocused('a1', 'a2'), false);
});

test('isLeafFocused returns false when focusedAnchorId is null', () => {
  assert.equal(isLeafFocused(null, 'a1'), false);
});

test('isLeafFocused returns false when focusedAnchorId is undefined', () => {
  assert.equal(isLeafFocused(undefined, 'a1'), false);
});

test('isLeafFocused returns false when leafAnchorId is null', () => {
  assert.equal(isLeafFocused('a1', null), false);
});

test('isLeafFocused returns false when both are null', () => {
  assert.equal(isLeafFocused(null, null), false);
});

test('isLeafFocused returns false on empty strings (falsy guard)', () => {
  assert.equal(isLeafFocused('', 'a1'), false);
  assert.equal(isLeafFocused('a1', ''), false);
});
