/**
 * useLongPressOrDrag.test.mjs — Phase 49-01 Task 2 (Wave 0 scaffold)
 *
 * Behavioral coverage for the 480ms long-press / 8px drag-threshold state
 * machine + factory used by GraphScreen's delegated pointer listener.
 *
 * Failing assertions go GREEN when Plan 49-01 Task 2 ships
 * `app/src/hooks/useLongPressOrDrag.ts`.
 *
 * Test style: behavioral via the plain factory `createLongPressOrDragMachine`
 * (W-3 LOCKED — the factory is exported alongside the hook). The factory has
 * no React dependency so we can drive it with synthetic PointerEvent stubs
 * under node --test without jsdom.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = resolve(here, '../../src/hooks/useLongPressOrDrag.ts');

// FAILS until Plan 49-01 Task 2 ships app/src/hooks/useLongPressOrDrag.ts
test('useLongPressOrDrag.ts source file exists', () => {
  assert.equal(
    existsSync(HOOK_PATH),
    true,
    `Expected ${HOOK_PATH} after Plan 49-01 Task 2`,
  );
});

// FAILS until Plan 49-01 Task 2 ships exports
test('useLongPressOrDrag.ts exports useLongPressOrDrag + createLongPressOrDragMachine (W-3 locked)', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  assert.match(
    source,
    /export\s+function\s+useLongPressOrDrag\s*\(/,
    'Expected `export function useLongPressOrDrag(` declaration',
  );
  assert.match(
    source,
    /export\s+function\s+createLongPressOrDragMachine\s*\(/,
    'Expected `export function createLongPressOrDragMachine(` (W-3 LOCKED — factory ships alongside hook)',
  );
});

// Helper to create a synthetic PointerEvent-like object the factory can consume.
function pe(type, x, y, extras = {}) {
  return {
    type,
    clientX: x,
    clientY: y,
    pointerId: 1,
    stopPropagation() { this._stopped = true; },
    preventDefault() { this._prevented = true; },
    target: { setPointerCapture() {} },
    ...extras,
  };
}

// Phase 49-06 gap closure: recognition signal MUST fire inside the 480ms
// timer BEFORE any pointerup call. Previously this test waited 25ms then
// called pointerup then asserted onLongPressRelease — encoding the bug.
test('Test 1: onLongPressRecognized fires INSIDE the 480ms timer, BEFORE pointerup', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;
  assert.ok(
    typeof createLongPressOrDragMachine === 'function',
    'createLongPressOrDragMachine must be a function',
  );

  let recognizedFired = false;
  let recognizedCoord = null;
  const machine = createLongPressOrDragMachine({
    longPressMs: 10, // small for test speed
    dragThresholdPx: 8,
    onLongPressRecognized: (x, y) => { recognizedFired = true; recognizedCoord = { x, y }; },
    onDragStart: () => {},
    onDragMove: () => {},
    onDragEnd: () => {},
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  await new Promise((r) => setTimeout(r, 25));
  // CRITICAL: assert WITHOUT pointerup — the callback must fire mid-press.
  assert.equal(recognizedFired, true, 'onLongPressRecognized must fire INSIDE the 480ms timer (before any pointerup)');
  assert.deepEqual(recognizedCoord, { x: 100, y: 100 }, 'onLongPressRecognized must receive original pointerdown coordinates');
});

// FAILS until Plan 49-01 Task 2 ships factory
test('Test 2: pointermove > 8px BEFORE long-press cancels timer (pan path)', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;

  let didLongPressFired = false;
  let didDragStart = false;
  const machine = createLongPressOrDragMachine({
    longPressMs: 50, // big enough to interrupt with a pre-threshold move
    dragThresholdPx: 8,
    onLongPressRecognized: () => { didLongPressFired = true; },
    onDragStart: () => { didDragStart = true; },
    onDragMove: () => {},
    onDragEnd: () => {},
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  // Move 20px BEFORE timer elapses — should cancel.
  machine.onPointerMove(pe('pointermove', 120, 100));
  await new Promise((r) => setTimeout(r, 80));
  machine.onPointerUp(pe('pointerup', 120, 100));

  assert.equal(didLongPressFired, false, 'pre-threshold pan must cancel long-press timer');
  assert.equal(didDragStart, false, 'pre-threshold pan must NOT trigger drag-start');
});

// FAILS until Plan 49-01 Task 2 ships factory
test('Test 3: pointermove > 8px AFTER long-press transitions to drag-start', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;

  let dragStartCalls = 0;
  let dragMoveCalls = 0;
  let initialCoord = null;
  const machine = createLongPressOrDragMachine({
    longPressMs: 10,
    dragThresholdPx: 8,
    onLongPressRecognized: () => {},
    onDragStart: (x, y) => { dragStartCalls++; initialCoord = { x, y }; },
    onDragMove: () => { dragMoveCalls++; },
    onDragEnd: () => {},
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  await new Promise((r) => setTimeout(r, 25));
  // Now move 20px — should transition to drag.
  machine.onPointerMove(pe('pointermove', 120, 100));
  machine.onPointerMove(pe('pointermove', 130, 100));
  machine.onPointerMove(pe('pointermove', 140, 100));

  assert.equal(dragStartCalls, 1, 'onDragStart must fire EXACTLY once at the first post-threshold move');
  assert.deepEqual(initialCoord, { x: 100, y: 100 }, 'onDragStart receives the ORIGINAL pointerdown coordinates');
  assert.ok(dragMoveCalls >= 2, 'subsequent moves must invoke onDragMove (got ' + dragMoveCalls + ')');
});

// Phase 49-06 gap closure: recognition fires at the timer tick; pointerup-in-place
// does NOT fire any extra callback (onDragEnd is reserved for drag-after-recognition).
test('Test 4: long-press recognized + pointerup-in-place — recognition fired at timer, no onDragEnd', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;

  let recognizedFired = false;
  let endFired = false;
  const machine = createLongPressOrDragMachine({
    longPressMs: 10,
    dragThresholdPx: 8,
    onLongPressRecognized: () => { recognizedFired = true; },
    onDragStart: () => {},
    onDragMove: () => {},
    onDragEnd: () => { endFired = true; },
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  await new Promise((r) => setTimeout(r, 25));
  // Recognition must already have fired at the timer tick — BEFORE pointerup.
  assert.equal(recognizedFired, true, 'onLongPressRecognized must fire at the 480ms tick');
  machine.onPointerUp(pe('pointerup', 100, 100));
  assert.equal(endFired, false, 'onDragEnd must NOT fire on release-in-place (no drag started)');
});

// Phase 49-06: drag started + pointerup fires onDragEnd. onLongPressRecognized
// fired ONCE at the 480ms tick (before the drag); it must NOT re-fire on pointerup.
test('Test 5: drag started + pointerup fires onDragEnd; onLongPressRecognized does NOT re-fire on pointerup', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;

  let recognizedCallCount = 0;
  let endFired = false;
  let endCoord = null;
  const machine = createLongPressOrDragMachine({
    longPressMs: 10,
    dragThresholdPx: 8,
    onLongPressRecognized: () => { recognizedCallCount++; },
    onDragStart: () => {},
    onDragMove: () => {},
    onDragEnd: (x, y) => { endFired = true; endCoord = { x, y }; },
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  await new Promise((r) => setTimeout(r, 25));
  // Recognition fired ONCE at the timer tick — capture the count BEFORE the drag.
  assert.equal(recognizedCallCount, 1, 'onLongPressRecognized must fire exactly once at the 480ms tick');
  machine.onPointerMove(pe('pointermove', 130, 100));
  machine.onPointerUp(pe('pointerup', 130, 100));

  assert.equal(endFired, true, 'onDragEnd must fire after drag has started');
  assert.deepEqual(endCoord, { x: 130, y: 100 }, 'onDragEnd receives the final pointerup coordinates');
  assert.equal(recognizedCallCount, 1, 'onLongPressRecognized must NOT re-fire on pointerup');
});

// FAILS until Plan 49-01 Task 2 ships factory
test('Test 6: onClickCapture after long-press calls stopPropagation + preventDefault (click suppression)', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;

  const machine = createLongPressOrDragMachine({
    longPressMs: 10,
    dragThresholdPx: 8,
    onLongPressRecognized: () => {},
    onDragStart: () => {},
    onDragMove: () => {},
    onDragEnd: () => {},
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  await new Promise((r) => setTimeout(r, 25));
  machine.onPointerUp(pe('pointerup', 100, 100));

  const clickEvent = pe('click', 100, 100);
  machine.onClickCapture(clickEvent);
  assert.equal(clickEvent._stopped, true, 'onClickCapture must call stopPropagation when didLongPress is true');
  assert.equal(clickEvent._prevented, true, 'onClickCapture must call preventDefault when didLongPress is true');
});

// Phase 49-06: pointercancel during active drag fires onDragEnd. Recognition
// already fired once at the timer tick (before the drag); pointercancel must
// not re-fire it.
test('Test 7: pointercancel clears timer and calls onDragEnd if drag was active', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  const { createLongPressOrDragMachine } = mod;

  let endFired = false;
  let recognizedCallCount = 0;
  const machine = createLongPressOrDragMachine({
    longPressMs: 10,
    dragThresholdPx: 8,
    onLongPressRecognized: () => { recognizedCallCount++; },
    onDragStart: () => {},
    onDragMove: () => {},
    onDragEnd: () => { endFired = true; },
  });

  machine.onPointerDown(pe('pointerdown', 100, 100));
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(recognizedCallCount, 1, 'recognition must fire once at the timer tick');
  machine.onPointerMove(pe('pointermove', 130, 100));
  machine.onPointerCancel(pe('pointercancel', 130, 100));

  assert.equal(endFired, true, 'pointercancel must invoke onDragEnd when drag was active');
  assert.equal(recognizedCallCount, 1, 'pointercancel must NOT re-fire onLongPressRecognized');
});

// FAILS until Plan 49-01 Task 2 ships factory (hook wrapper parity)
test('Test 8: useLongPressOrDrag (hook wrapper) is exported and returns { bind, didLongPress } shape', async () => {
  const mod = await import('../../src/hooks/useLongPressOrDrag.ts');
  assert.ok(typeof mod.useLongPressOrDrag === 'function', 'useLongPressOrDrag hook must be exported');
  // Source-reading parity check — hook returns { bind, didLongPress }.
  const source = readFileSync(HOOK_PATH, 'utf-8');
  assert.match(
    source,
    /return\s*\{\s*bind/,
    'Hook must return an object with `bind`',
  );
  assert.match(
    source,
    /didLongPress/,
    'Hook must expose a `didLongPress` ref',
  );
});

// Phase 49-06 gap closure — negative source-reading. Dynamic identifier
// construction (string-split-and-join) keeps the literal byte sequence out of
// the test source so Task 2's `! grep -rn "onLongPressRelease" src tests` grep
// gate remains satisfiable. A literal `/onLongPressRelease/` regex here would
// trip the gate on this test file itself.
test('Test 9: useLongPressOrDrag.ts source has no remaining onLongPressRelease identifier', () => {
  const src = readFileSync(HOOK_PATH, 'utf-8');
  const banned   = ['onLongPress', 'Release'].join('');
  const expected = ['onLongPress', 'Recognized'].join('');
  assert.doesNotMatch(src, new RegExp(banned), `${banned} must be fully removed from useLongPressOrDrag.ts`);
  assert.match(src, new RegExp(expected), `${expected} must be the new callback name in useLongPressOrDrag.ts`);
});
