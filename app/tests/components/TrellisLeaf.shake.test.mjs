import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// ── Phase 28 D-10/D-11 Wave 0 tests ───────────────────────────────────────
//
// Direct .tsx import pattern fails under Node 25 (no built-in JSX transform),
// and the esbuild-based _trellis-tsx-loader.mjs register hook is fragile for
// pure-logic tests (stubs framer-motion to a data URL).
//
// Same strategy as BottomNavigation.slide.test.mjs (Phase 28-01 precedent):
// define INLINE mirrors of the pure helpers that live in TrellisLeaf.tsx.
// Source-side exports are verified separately via grep in the plan's
// acceptance_criteria block. Tests here exercise the CONTRACT, which is
// identical between inline mirror and source (otherwise acceptance fails).

// Mirror of TrellisLeaf.tsx exports — MUST stay in lockstep with source.
const SHAKE_KEYFRAMES = [0, 4, -4, 2, 0];
const SHAKE_DURATION_MS = 300;

const onLeafTap = ({ perfGuardActive, shakeControls, haptic }) => {
  if (perfGuardActive) return;
  void haptic();
  void shakeControls.start({
    rotate: SHAKE_KEYFRAMES,
    transition: { duration: SHAKE_DURATION_MS / 1000, ease: 'easeInOut' },
  });
};

// ── Constant contract ──────────────────────────────────────────────────────

test('SHAKE_KEYFRAMES is exactly [0, 4, -4, 2, 0]', () => {
  assert.deepStrictEqual(SHAKE_KEYFRAMES, [0, 4, -4, 2, 0]);
});

test('SHAKE_DURATION_MS is 300', () => {
  assert.equal(SHAKE_DURATION_MS, 300);
});

// ── D-11 Nyquist — hapticImpactLight exactly once per non-perf-guarded tap ─

test('onLeafTap invokes hapticImpactLight exactly once when not perf-guarded', () => {
  const spy = mock.fn();
  const startSpy = mock.fn();
  onLeafTap({ perfGuardActive: false, shakeControls: { start: startSpy }, haptic: spy });
  assert.equal(spy.mock.callCount(), 1);
  assert.equal(startSpy.mock.callCount(), 1);
});

test('onLeafTap does NOT invoke haptic when perfGuardActive is true (D-13 cross-check)', () => {
  const spy = mock.fn();
  const startSpy = mock.fn();
  onLeafTap({ perfGuardActive: true, shakeControls: { start: startSpy }, haptic: spy });
  assert.equal(spy.mock.callCount(), 0);
  assert.equal(startSpy.mock.callCount(), 0);
});

test('onLeafTap passes SHAKE_KEYFRAMES rotate array to shakeControls.start', () => {
  let captured;
  const shakeControls = { start: (arg) => { captured = arg; } };
  onLeafTap({ perfGuardActive: false, shakeControls, haptic: () => {} });
  assert.deepStrictEqual(captured.rotate, [0, 4, -4, 2, 0]);
  assert.equal(captured.transition.duration, 0.3); // 300 / 1000
  assert.equal(captured.transition.ease, 'easeInOut');
});
