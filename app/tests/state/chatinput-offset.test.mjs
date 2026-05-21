import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Pure helper lives in a React-free module so it imports directly under
// `node --test` (Node 26 strips TS types). Mirrors keyboard-hysteresis.test.mjs.
import {
  resolveChatInputOffset,
  resolveChatInputSettleDistance,
  MAX_CHATINPUT_SETTLE_DISTANCE,
} from '../../src/state/chatinput-offset.ts';

// --- resolveChatInputOffset: resting-offset contract (never double-moves) ---

test('resolveChatInputOffset returns 0 when the keyboard is closed', () => {
  assert.equal(
    resolveChatInputOffset({ keyboardHeight: 0, isKeyboardOpen: false }),
    0,
    'at rest with no keyboard the bar sits where the flex column places it',
  );
});

test('resolveChatInputOffset returns 0 when the keyboard is open (adjustResize already lifted the bar)', () => {
  assert.equal(
    resolveChatInputOffset({ keyboardHeight: 320, isKeyboardOpen: true }),
    0,
    'the helper must NOT add a second offset on top of the native adjustResize lift',
  );
});

test('resolveChatInputOffset is idempotent across repeat calls', () => {
  const args = { keyboardHeight: 280, isKeyboardOpen: true };
  const first = resolveChatInputOffset(args);
  const second = resolveChatInputOffset(args);
  const third = resolveChatInputOffset(args);
  assert.equal(first, second);
  assert.equal(second, third);
});

test('resolveChatInputOffset tolerates non-finite geometry without changing the contract', () => {
  assert.equal(resolveChatInputOffset({ keyboardHeight: NaN, isKeyboardOpen: true }), 0);
  assert.equal(resolveChatInputOffset({ keyboardHeight: -50, isKeyboardOpen: true }), 0);
});

// --- resolveChatInputSettleDistance: eased transient distance (the smoothing) ---

test('resolveChatInputSettleDistance is 0 when the keyboard is closed', () => {
  assert.equal(
    resolveChatInputSettleDistance({ keyboardHeight: 320, isKeyboardOpen: false }),
    0,
    'nothing to ease when closed — the bar is already at rest',
  );
});

test('resolveChatInputSettleDistance returns a small bounded eased distance when open', () => {
  const d = resolveChatInputSettleDistance({ keyboardHeight: 240, isKeyboardOpen: true });
  assert.ok(d > 0, 'an open keyboard yields a non-zero eased settle distance');
  assert.ok(d <= MAX_CHATINPUT_SETTLE_DISTANCE, 'eased distance never exceeds the cap');
  assert.equal(d, 20, '240px keyboard → round(240/12) = 20');
});

test('resolveChatInputSettleDistance clamps a tall keyboard to the cap', () => {
  const d = resolveChatInputSettleDistance({ keyboardHeight: 600, isKeyboardOpen: true });
  assert.equal(d, MAX_CHATINPUT_SETTLE_DISTANCE, 'round(600/12)=50 clamps to the 24px cap');
});

test('resolveChatInputSettleDistance is idempotent across repeat calls', () => {
  const args = { keyboardHeight: 300, isKeyboardOpen: true };
  assert.equal(
    resolveChatInputSettleDistance(args),
    resolveChatInputSettleDistance(args),
  );
});

// --- source-guard: React-free module (must unit-test without react) ---

const source = readFileSync(new URL('../../src/state/chatinput-offset.ts', import.meta.url), 'utf8');

test('chatinput-offset.ts imports no react (pure helper invariant)', () => {
  assert.equal(
    (source.match(/from\s+['"]react['"]/g) || []).length,
    0,
    'chatinput-offset.ts must not import react — it is a pure, node:test-able helper',
  );
  assert.match(source, /export function resolveChatInputOffset/, 'must export resolveChatInputOffset');
});
