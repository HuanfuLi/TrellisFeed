import assert from 'node:assert/strict';
import test from 'node:test';
import { leafAnimationMask, TAP_ANIMATION_THRESHOLD } from '../../src/services/trellis-perf-mask.ts';

// ── Phase 28 D-13 Wave 0 test ─────────────────────────────────────────────
//
// Pure .ts file — Node 25 loads directly, no JSX transform needed.

test('TAP_ANIMATION_THRESHOLD is 30', () => {
  assert.equal(TAP_ANIMATION_THRESHOLD, 30);
});

test('leafAnimationMask returns true when count <= 30 regardless of inView', () => {
  assert.equal(leafAnimationMask({ totalCount: 0, inView: false }), true);
  assert.equal(leafAnimationMask({ totalCount: 10, inView: false }), true);
  assert.equal(leafAnimationMask({ totalCount: 30, inView: false }), true);
  assert.equal(leafAnimationMask({ totalCount: 30, inView: true }), true);
});

test('leafAnimationMask returns inView when count > 30', () => {
  assert.equal(leafAnimationMask({ totalCount: 31, inView: true }), true);
  assert.equal(leafAnimationMask({ totalCount: 50, inView: true }), true);
  assert.equal(leafAnimationMask({ totalCount: 100, inView: true }), true);
  assert.equal(leafAnimationMask({ totalCount: 31, inView: false }), false);
  assert.equal(leafAnimationMask({ totalCount: 50, inView: false }), false);
  assert.equal(leafAnimationMask({ totalCount: 100, inView: false }), false);
});
