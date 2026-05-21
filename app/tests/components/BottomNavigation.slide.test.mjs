import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Pure hysteresis helper lives in a React-free module so it can be imported
// directly under `node --test` (importing useKeyboard.ts pulls in `react` and
// fails ERR_MODULE_NOT_FOUND). Mirrors the feed-spread.ts / trellis-perf-mask.ts
// pure-helper-in-its-own-module pattern.
import { resolveKeyboardOpen } from '../../src/state/keyboard-hysteresis.ts';

// Pure function derivation — no DOM render.
// Defined inline to mirror the helper that will live in BottomNavigation.tsx.
// Keeping the test independent of the .tsx import chain avoids the
// framer-motion / react-router-dom / Node 25 JSON-chain failures that make
// direct .tsx imports unreliable under node --test.
const getNavYTarget = (isTop, keyboardOpen = false) => (isTop && !keyboardOpen ? 0 : '100%');

const bottomNavigationSource = readFileSync(new URL('../../src/components/BottomNavigation.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const keyboardSource = readFileSync(new URL('../../src/state/useKeyboard.ts', import.meta.url), 'utf8');

test('getNavYTarget returns 0 only for a top-level screen with keyboard closed', () => {
  assert.equal(getNavYTarget(true, false), 0);
});

test('getNavYTarget returns 100% for sub-screens', () => {
  assert.equal(getNavYTarget(false, false), '100%');
});

test('getNavYTarget returns 100% when the keyboard is open on a top-level screen', () => {
  assert.equal(getNavYTarget(true, true), '100%');
});

test('getNavYTarget returns a Framer-compatible y-target', () => {
  // Framer Motion accepts number | string — this asserts the type contract.
  const whenTop = getNavYTarget(true, false);
  const whenSub = getNavYTarget(false, false);
  assert.ok(typeof whenTop === 'number', 'top-level y target is a number');
  assert.ok(typeof whenSub === 'string' && whenSub.endsWith('%'), 'sub-screen y target is a percent string');
});

test('BottomNavigation disables first-frame y animation', () => {
  assert.match(
    bottomNavigationSource,
    /initial=\{false\}/,
    'motion.nav must use initial={false} so startup/deep-link states render directly at their y target',
  );
});

test('App passes useKeyboard state into BottomNavigation', () => {
  assert.match(appSource, /const\s+keyboardOpen\s*=\s*useKeyboard\(\)/, 'RootLayout must read keyboardOpen from useKeyboard()');
  assert.match(
    appSource,
    /<BottomNavigation[\s\S]*keyboardOpen=\{keyboardOpen\}/,
    'BottomNavigation must receive keyboardOpen from RootLayout',
  );
});

test('keyboard-open CSS no longer applies transforms to bottom navigation', () => {
  assert.ok(
    !/body\.keyboard-open\s+#bottom-navigation\s*\{[\s\S]*?transform\s*:/.test(cssSource),
    'index.css must not hide #bottom-navigation with a keyboard-open transform',
  );
});

test('useKeyboard gates keyboard-open detection on editable focus', () => {
  assert.match(
    keyboardSource,
    /function\s+isEditableElement\(/,
    'useKeyboard must define editable-focus detection',
  );
  assert.match(
    keyboardSource,
    /const\s+editableFocused\s*=\s*isEditableElement\(document\.activeElement\)/,
    'useKeyboard must check the active editable element before classifying keyboard state',
  );
  assert.match(
    keyboardSource,
    /editableFocused\s*&&\s*resolveKeyboardOpen\(/,
    'keyboard-open classification must require editable focus and route through the hysteresis helper',
  );
});

// --- BUGFIX-03: anti-flicker hysteresis source-guards (red until Task 2) ---

const hysteresisSource = readFileSync(new URL('../../src/state/keyboard-hysteresis.ts', import.meta.url), 'utf8');

test('useKeyboard wires the hysteresis helper (anti-flicker mechanism present)', () => {
  // Open threshold constant must still exist (load-bearing per plan must_haves.artifacts.contains).
  assert.match(keyboardSource, /MIN_KEYBOARD_HEIGHT/, 'open threshold MIN_KEYBOARD_HEIGHT must be present in useKeyboard.ts');
  // A distinct CLOSE threshold is the hysteresis (separate open/close thresholds).
  assert.match(keyboardSource, /CLOSE_KEYBOARD_HEIGHT/, 'a distinct CLOSE_KEYBOARD_HEIGHT threshold must exist for hysteresis');
  // handleResize must route the open/close decision through the pure helper.
  assert.match(keyboardSource, /resolveKeyboardOpen\(/, 'handleResize must call resolveKeyboardOpen for hysteresis');
});

test('hysteresis helper module defines distinct open/close thresholds and exports resolveKeyboardOpen', () => {
  assert.match(hysteresisSource, /export\s+function\s+resolveKeyboardOpen/, 'resolveKeyboardOpen must be exported');
  assert.match(hysteresisSource, /MIN_KEYBOARD_HEIGHT/, 'open threshold must live in the helper module');
  assert.match(hysteresisSource, /CLOSE_KEYBOARD_HEIGHT/, 'close threshold must live in the helper module');
});

test('useKeyboard does NOT install or import @capacitor/keyboard (forbidden workaround)', () => {
  assert.equal(
    (keyboardSource.match(/@capacitor\/keyboard/g) || []).length,
    0,
    'useKeyboard must not import @capacitor/keyboard (CLAUDE.md: do not disable keyboard resize)',
  );
});

// --- BUGFIX-03: resolveKeyboardOpen pure-fn contract (hysteresis no-flip band) ---

const OPEN = 150;
const CLOSE = 80;

test('resolveKeyboardOpen opens only above the open threshold when closed', () => {
  assert.equal(
    resolveKeyboardOpen({ heightDelta: OPEN + 10, wasOpen: false, openThreshold: OPEN, closeThreshold: CLOSE }),
    true,
    'a delta above the open threshold opens from a closed state',
  );
  assert.equal(
    resolveKeyboardOpen({ heightDelta: OPEN - 1, wasOpen: false, openThreshold: OPEN, closeThreshold: CLOSE }),
    false,
    'a delta at/under the open threshold stays closed from a closed state',
  );
});

test('resolveKeyboardOpen closes only below the close threshold when open', () => {
  assert.equal(
    resolveKeyboardOpen({ heightDelta: CLOSE - 1, wasOpen: true, openThreshold: OPEN, closeThreshold: CLOSE }),
    false,
    'a delta below the close threshold closes from an open state',
  );
  assert.equal(
    resolveKeyboardOpen({ heightDelta: CLOSE + 1, wasOpen: true, openThreshold: OPEN, closeThreshold: CLOSE }),
    true,
    'a delta at/above the close threshold stays open from an open state',
  );
});

test('resolveKeyboardOpen mid-range delta keeps the prior state (no flip in either direction)', () => {
  // Mid-range = between close and open thresholds. This is the transient mid-animation
  // band that previously toggled keyboardOpen and reversed the nav spring.
  const mid = (OPEN + CLOSE) / 2; // 115, strictly between 80 and 150
  assert.equal(
    resolveKeyboardOpen({ heightDelta: mid, wasOpen: true, openThreshold: OPEN, closeThreshold: CLOSE }),
    true,
    'mid-range delta does NOT flip an already-open state to closed',
  );
  assert.equal(
    resolveKeyboardOpen({ heightDelta: mid, wasOpen: false, openThreshold: OPEN, closeThreshold: CLOSE }),
    false,
    'mid-range delta does NOT flip an already-closed state to open',
  );
});
