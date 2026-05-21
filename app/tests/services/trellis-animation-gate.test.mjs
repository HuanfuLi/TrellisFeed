import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { shouldAnimateTrellis } from '../../src/services/trellis-animation-gate.ts';

// ── Phase 55.1 GAP-B (BUGFIX-05) — render-layer animation gate ──────────────
//
// Pure .ts file — Node loads directly, no JSX transform needed. The gate's ONLY
// decision is the Planner-active route check; the cross-screen lag fix is that
// off-screen Planner leaves do zero per-frame motion work.

test('Planner inactive → false even with devMode + 31 nodes + inView (the GAP-B case)', () => {
  assert.equal(
    shouldAnimateTrellis({ isPlannerActive: false, devMode: true, nodeCount: 31, inView: true }),
    false,
  );
});

test('Planner inactive → false regardless of any composition input', () => {
  assert.equal(shouldAnimateTrellis({ isPlannerActive: false }), false);
  assert.equal(shouldAnimateTrellis({ isPlannerActive: false, nodeCount: 0, inView: false }), false);
  assert.equal(shouldAnimateTrellis({ isPlannerActive: false, devMode: false, nodeCount: 100, inView: true }), false);
});

test('Planner active → true (foreground animates as before)', () => {
  assert.equal(shouldAnimateTrellis({ isPlannerActive: true }), true);
  assert.equal(shouldAnimateTrellis({ isPlannerActive: true, devMode: true, nodeCount: 31, inView: false }), true);
  assert.equal(shouldAnimateTrellis({ isPlannerActive: true, devMode: false, nodeCount: 1, inView: true }), true);
});

test('route gate is dominant — nodeCount/inView/devMode never flip the route decision', () => {
  // Small + inView + Planner-off must still be false.
  assert.equal(shouldAnimateTrellis({ isPlannerActive: false, nodeCount: 1, inView: true }), false);
  // Large + offView + Planner-on must still be true.
  assert.equal(shouldAnimateTrellis({ isPlannerActive: true, nodeCount: 999, inView: false }), true);
});

test('idempotent — same inputs return the same boolean', () => {
  const input = { isPlannerActive: true, devMode: true, nodeCount: 12, inView: true };
  const a = shouldAnimateTrellis(input);
  const b = shouldAnimateTrellis(input);
  assert.equal(a, b);
  assert.equal(a, true);
});

test('source imports no react / framer-motion (stays node:test-loadable)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(here, '../../src/services/trellis-animation-gate.ts'), 'utf8');
  // Match only real ES import statements that pull from react / framer-motion
  // (prose mentions of the words in doc comments are fine).
  const importsReactOrFramer = src
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line))
    .some((line) => /from\s+['"](react|framer-motion)['"]/.test(line));
  assert.equal(importsReactOrFramer, false);
});
