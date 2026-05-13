import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mulberry32, hashStr, generateVinePath, getLeafPosition, getVineColor,
  TRELLIS_VIEWBOX_W, TRELLIS_VIEWBOX_H, VINE_COLOR_VARS,
} from '../../src/services/trellis-layout.service.ts';

test('mulberry32 is deterministic for the same seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const firstA = a();
  const firstB = b();
  assert.equal(firstA, firstB);
  // Also verify it's not trivially 0 or 1
  assert.ok(firstA > 0 && firstA < 1);
});

test('hashStr is stable across 100 calls', () => {
  const first = hashStr('branch-abc');
  for (let i = 0; i < 100; i++) {
    assert.equal(hashStr('branch-abc'), first);
  }
});

test('generateVinePath produces identical d across 100 calls for same inputs', () => {
  const first = generateVinePath('b1', 0, 3);
  for (let i = 0; i < 100; i++) {
    const next = generateVinePath('b1', 0, 3);
    assert.equal(next.d, first.d);
    assert.equal(next.p0x, first.p0x);
    assert.equal(next.p3y, first.p3y);
  }
});

test('getLeafPosition is deterministic for same anchorId + vineSpec', () => {
  const vine = generateVinePath('b1', 0, 3);
  const first = getLeafPosition('anchor-x', vine);
  for (let i = 0; i < 100; i++) {
    const next = getLeafPosition('anchor-x', vine);
    assert.equal(next.x, first.x);
    assert.equal(next.y, first.y);
  }
});

test('Different branchIds produce different vine paths', () => {
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const spec = generateVinePath(`branch-${i}`, i, 20);
    assert.ok(!seen.has(spec.d), `collision on branch-${i}`);
    seen.add(spec.d);
  }
});

test('Leaf positions fall within jitter-expanded viewBox bounds', () => {
  const vine = generateVinePath('b1', 1, 3);
  for (let i = 0; i < 50; i++) {
    const pos = getLeafPosition(`anchor-${i}`, vine);
    // Positions should be within viewBox +/- jitter (30/20 respectively, 40 margin)
    assert.ok(pos.x >= -40 && pos.x <= TRELLIS_VIEWBOX_W + 40, `x=${pos.x} out of bounds`);
    assert.ok(pos.y >= -40 && pos.y <= TRELLIS_VIEWBOX_H + 40, `y=${pos.y} out of bounds`);
  }
});

test('getVineColor returns one of VINE_COLOR_VARS', () => {
  for (let i = 0; i < 20; i++) {
    const color = getVineColor(`branch-${i}`);
    assert.ok(VINE_COLOR_VARS.includes(color));
  }
});
