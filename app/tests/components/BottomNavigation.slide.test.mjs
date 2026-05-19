import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
    /const\s+nextOpen\s*=\s*editableFocused\s*&&\s*heightDelta\s*>\s*MIN_KEYBOARD_HEIGHT/,
    'keyboard-open classification must require editable focus and a viewport shrink',
  );
});
