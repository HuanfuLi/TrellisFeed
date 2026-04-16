import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveAxisLock,
  computeDragOffset,
  resolveCommitIndex,
  shouldBlockGesture,
  computeTargetX,
} from '../../src/lib/swipe-tab-logic.ts';

// ── resolveAxisLock ─────────────────────────────────────────────────────────

test('resolveAxisLock returns null below threshold', () => {
  assert.equal(resolveAxisLock({ x: 0, y: 0 }), null);
  assert.equal(resolveAxisLock({ x: 5, y: 5 }), null);
  assert.equal(resolveAxisLock({ x: 9, y: 9 }), null);
});

test('resolveAxisLock picks x when |x| >= |y|', () => {
  assert.equal(resolveAxisLock({ x: 15, y: 10 }), 'x');
  assert.equal(resolveAxisLock({ x: -20, y: 5 }), 'x');
  assert.equal(resolveAxisLock({ x: 10, y: 10 }), 'x'); // tie goes to x
});

test('resolveAxisLock picks y when |y| > |x|', () => {
  assert.equal(resolveAxisLock({ x: 5, y: 15 }), 'y');
  assert.equal(resolveAxisLock({ x: 2, y: -20 }), 'y');
});

// ── computeDragOffset ───────────────────────────────────────────────────────

test('computeDragOffset passes through in middle indices', () => {
  assert.equal(computeDragOffset(50, 2, 5), 50);
  assert.equal(computeDragOffset(-50, 2, 5), -50);
});

test('computeDragOffset rubber-bands positive offset at left edge', () => {
  assert.equal(computeDragOffset(100, 0, 5), 25); // 100 * 0.25
  assert.equal(computeDragOffset(-100, 0, 5), -100); // negative passes through
});

test('computeDragOffset rubber-bands negative offset at right edge', () => {
  assert.equal(computeDragOffset(-100, 4, 5), -25); // 100 * 0.25
  assert.equal(computeDragOffset(100, 4, 5), 100); // positive passes through
});

// ── resolveCommitIndex ─────────────────────────────────────────────────────

test('resolveCommitIndex commits forward past threshold', () => {
  assert.equal(resolveCommitIndex(-100, 1, 375, 5), 2); // |offset| > 75 (0.2 * 375)
});

test('resolveCommitIndex commits backward past threshold', () => {
  assert.equal(resolveCommitIndex(100, 2, 375, 5), 1);
});

test('resolveCommitIndex snaps back below threshold', () => {
  assert.equal(resolveCommitIndex(-50, 2, 375, 5), 2);
  assert.equal(resolveCommitIndex(50, 2, 375, 5), 2);
});

test('resolveCommitIndex clamps at edges', () => {
  assert.equal(resolveCommitIndex(-1000, 4, 375, 5), 4); // no next screen
  assert.equal(resolveCommitIndex(1000, 0, 375, 5), 0); // no previous screen
});

// ── shouldBlockGesture ─────────────────────────────────────────────────────

test('shouldBlockGesture blocks when keyboard open', () => {
  assert.equal(shouldBlockGesture({ keyboardOpen: true, gestureBlocked: false }), true);
});

test('shouldBlockGesture blocks when gesture blocked flag', () => {
  assert.equal(shouldBlockGesture({ keyboardOpen: false, gestureBlocked: true }), true);
});

test('shouldBlockGesture allows gesture when neither blocker', () => {
  assert.equal(shouldBlockGesture({ keyboardOpen: false, gestureBlocked: false }), false);
});

// ── computeTargetX — Phase 28 D-05 ─────────────────────────────────────────

test('computeTargetX returns -index * width', () => {
  // index 0 yields -0 in pure JS; normalize via Math.abs for the zero case so
  // assert.equal (Object.is semantics in Node 25) doesn't trip.
  assert.equal(Math.abs(computeTargetX(0, 375)), 0);
  assert.equal(computeTargetX(1, 375), -375);
  assert.equal(computeTargetX(2, 768), -1536);
  assert.equal(computeTargetX(3, 375), -1125);
  assert.equal(computeTargetX(4, 375), -1500);
});
