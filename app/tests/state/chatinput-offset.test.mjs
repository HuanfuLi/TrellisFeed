import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Pure helper lives in a React-free module so it imports directly under
// `node --test` (Node strips TS types). Mirrors keyboard-hysteresis.test.mjs.
// ATTEMPT 2 contract: resolveChatInputOffset returns the LIVE keyboard inset
// from raw visualViewport geometry, so the bar can follow the keyboard's
// animated rise frame-by-frame. The decay helper is removed.
import { resolveChatInputOffset } from '../../src/state/chatinput-offset.ts';

// Reference geometry: a 800px layout viewport, keyboard ~320px tall.
const INNER = 800;
const KEYBOARD = 320;

// --- resolveChatInputOffset: live keyboard inset contract ---

test('resolveChatInputOffset returns 0 when the keyboard is fully closed', () => {
  // viewportHeight ≈ innerHeight, no offset → inset 0.
  assert.equal(
    resolveChatInputOffset({ innerHeight: INNER, viewportHeight: INNER, viewportOffsetTop: 0 }),
    0,
    'closed keyboard: the visual viewport fills the layout viewport, inset is 0',
  );
});

test('resolveChatInputOffset returns the full keyboard inset when fully open (height-shrink form)', () => {
  // Android adjustResize: visualViewport.height shrinks by the keyboard height.
  assert.equal(
    resolveChatInputOffset({ innerHeight: INNER, viewportHeight: INNER - KEYBOARD, viewportOffsetTop: 0 }),
    KEYBOARD,
    'fully open: inset equals the full keyboard height',
  );
});

test('resolveChatInputOffset subtracts offsetTop (top-gap is not keyboard inset)', () => {
  // offsetTop is the gap ABOVE the visual viewport, not below it. The keyboard
  // inset (the bottom gap the bar must clear) is innerHeight - viewportHeight -
  // offsetTop, so any top offset reduces the computed bottom inset.
  assert.equal(
    resolveChatInputOffset({
      innerHeight: INNER,
      viewportHeight: INNER - KEYBOARD,
      viewportOffsetTop: 40,
    }),
    KEYBOARD - 40,
    'a 40px top-gap is not part of the bottom keyboard inset',
  );
});

test('resolveChatInputOffset returns a partial inset mid-animation (the whole point — bar tracks)', () => {
  // Halfway through the keyboard animation: only half the keyboard height has
  // been consumed. The bar must follow this partial value.
  const partial = resolveChatInputOffset({
    innerHeight: INNER,
    viewportHeight: INNER - KEYBOARD / 2,
    viewportOffsetTop: 0,
  });
  assert.ok(partial > 0, 'mid-animation yields a non-zero inset');
  assert.ok(partial < KEYBOARD, 'mid-animation inset is strictly less than the full inset');
  assert.equal(partial, KEYBOARD / 2, '160px consumed → 160px inset');
});

test('resolveChatInputOffset clamps NaN / negative geometry to 0', () => {
  assert.equal(
    resolveChatInputOffset({ innerHeight: NaN, viewportHeight: 480, viewportOffsetTop: 0 }),
    0,
    'NaN innerHeight → 0',
  );
  assert.equal(
    resolveChatInputOffset({ innerHeight: INNER, viewportHeight: NaN, viewportOffsetTop: 0 }),
    INNER,
    'NaN viewportHeight treated as 0 → inset = innerHeight',
  );
  assert.equal(
    resolveChatInputOffset({ innerHeight: 400, viewportHeight: 800, viewportOffsetTop: 0 }),
    0,
    'viewport taller than layout (transient over-report) clamps to 0 — never pushes the bar below rest',
  );
});

test('resolveChatInputOffset is idempotent across repeat calls', () => {
  const args = { innerHeight: INNER, viewportHeight: INNER - KEYBOARD, viewportOffsetTop: 0 };
  const first = resolveChatInputOffset(args);
  const second = resolveChatInputOffset(args);
  const third = resolveChatInputOffset(args);
  assert.equal(first, second);
  assert.equal(second, third);
});

// --- source-guards: React-free module + decay approach removed ---

const source = readFileSync(new URL('../../src/state/chatinput-offset.ts', import.meta.url), 'utf8');

test('chatinput-offset.ts imports no react (pure helper invariant)', () => {
  assert.equal(
    (source.match(/from\s+['"]react['"]/g) || []).length,
    0,
    'chatinput-offset.ts must not import react — it is a pure, node:test-able helper',
  );
  assert.match(source, /export function resolveChatInputOffset/, 'must export resolveChatInputOffset');
});

test('chatinput-offset.ts no longer exports the rejected decay helper (attempt 1)', () => {
  assert.equal(
    (source.match(/resolveChatInputSettleDistance|MAX_CHATINPUT_SETTLE_DISTANCE/g) || []).length,
    0,
    'the 55.1-05 decay approach (settle-distance) is removed in attempt 2',
  );
});
