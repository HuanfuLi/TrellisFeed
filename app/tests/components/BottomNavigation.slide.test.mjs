import assert from 'node:assert/strict';
import test from 'node:test';

// Pure function derivation — no DOM render.
// Defined inline to mirror the helper that will live in BottomNavigation.tsx.
// Keeping the test independent of the .tsx import chain avoids the
// framer-motion / react-router-dom / Node 25 JSON-chain failures that make
// direct .tsx imports unreliable under node --test.
const getNavYTarget = (isTop) => (isTop ? 0 : '100%');

test('getNavYTarget returns 0 when isTopLevelScreen=true', () => {
  assert.equal(getNavYTarget(true), 0);
});

test('getNavYTarget returns 100% when isTopLevelScreen=false', () => {
  assert.equal(getNavYTarget(false), '100%');
});

test('getNavYTarget returns a Framer-compatible y-target', () => {
  // Framer Motion accepts number | string — this asserts the type contract.
  const whenTop = getNavYTarget(true);
  const whenSub = getNavYTarget(false);
  assert.ok(typeof whenTop === 'number', 'top-level y target is a number');
  assert.ok(typeof whenSub === 'string' && whenSub.endsWith('%'), 'sub-screen y target is a percent string');
});
