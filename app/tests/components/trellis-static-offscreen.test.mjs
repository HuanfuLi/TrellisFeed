import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// ── Phase 55.1 GAP-B (BUGFIX-05, round 5) — off-screen render-cost guard ─────
//
// Round 4 device UAT FAILED: 55.1-09's `animationsEnabled` gate only flipped
// framer-motion animation TARGETS to static, but left ALL the machinery mounted
// and painting whether or not the Planner was on-screen:
//   - ~3 `motion.g` VisualElements per leaf (×31 dev nodes) + ~70 vine
//     `motion.path` — per-element framer-motion overhead even when static.
//   - a per-leaf `filter: drop-shadow(...)` — forces an SVG rasterization pass.
// The fix: when `animationsEnabled === false`, render PLAIN SVG (`<g>` / `<path>`,
// no `motion.*`, no `drop-shadow` filter) so the always-mounted off-screen canvas
// costs ZERO per-frame work and ZERO filter passes. These are source-reading
// guards (the project renders no DOM in node:test) — they keep the static branch
// from silently regressing back to a motion/filter branch.

const leafSrc = readFileSync(
  new URL('../../src/components/trellis/TrellisLeaf.tsx', import.meta.url),
  'utf8',
);
const canvasSrc = readFileSync(
  new URL('../../src/components/trellis/TrellisCanvas.tsx', import.meta.url),
  'utf8',
);

// ── TrellisLeaf: static early-return branch ─────────────────────────────────

test('TrellisLeaf has an early static return gated on !animationsEnabled', () => {
  assert.match(
    leafSrc,
    /if\s*\(\s*!animationsEnabled\s*\)\s*\{[\s\S]*?return\s*\(/,
    'TrellisLeaf must early-return a static group when animationsEnabled is false',
  );
});

test('TrellisLeaf static branch precedes the motion.g branch', () => {
  const staticIdx = leafSrc.search(/if\s*\(\s*!animationsEnabled\s*\)/);
  const firstMotionIdx = leafSrc.search(/<motion\.g/);
  assert.ok(staticIdx > -1, 'static branch must exist');
  assert.ok(firstMotionIdx > -1, 'motion.g branch must still exist for the foreground');
  assert.ok(
    staticIdx < firstMotionIdx,
    'the static early-return must come BEFORE any <motion.g> so off-screen leaves never mount a VisualElement',
  );
});

test('TrellisLeaf static branch carries the resting transform (scale + rotate, fill-box)', () => {
  // Bound the slice to the if-block itself (ends where `const swayActive` begins),
  // so we don't read the foreground branch's "Outer motion.g" comment text.
  const staticIdx = leafSrc.search(/if\s*\(\s*!animationsEnabled\s*\)/);
  const endIdx = leafSrc.indexOf('const swayActive', staticIdx);
  const staticBlock = leafSrc.slice(staticIdx, endIdx);
  assert.match(staticBlock, /scale\(\$\{LEAF_SCALE\}\)\s*rotate\(\$\{rotation\}deg\)/,
    'static leaf must apply the same scale→rotate as the motion.g resting state');
  assert.match(staticBlock, /transformBox:\s*'fill-box'/,
    'static leaf must match transformBox: fill-box so there is no positional jump');
  assert.doesNotMatch(staticBlock, /drop-shadow/,
    'static leaf branch must NOT apply a drop-shadow filter (the round-4 cost)');
  assert.doesNotMatch(staticBlock, /motion\./,
    'static leaf branch must NOT use any framer-motion element');
});

// ── TrellisCanvas: vines render plain <path> when off-screen ────────────────

test('TrellisCanvas selects a plain path tag when animationsEnabled is false', () => {
  assert.match(
    canvasSrc,
    /const\s+VinePath\s*=\s*\(animationsEnabled\s*\?\s*motion\.path\s*:\s*'path'\)/,
    'vines must render as plain <path> (no VisualElement) when off-screen',
  );
});

test('TrellisCanvas no longer hardcodes <motion.path> for vine stems', () => {
  assert.doesNotMatch(
    canvasSrc,
    /<motion\.path/,
    'vine stems must go through VinePath, not a hardcoded <motion.path>',
  );
});

test('TrellisCanvas spreads motion-only props ONLY when animating', () => {
  // Both vine paths must guard initial/animate/transition behind animationsEnabled
  // so the plain <path> tag never receives invalid DOM attributes.
  const guarded = (canvasSrc.match(/\{\.\.\.\(animationsEnabled[\s\S]{0,120}?initial:\s*\{\s*pathLength/g) || []).length;
  assert.ok(guarded >= 2, `both vine paths must conditionally spread draw-on props (found ${guarded})`);
});
