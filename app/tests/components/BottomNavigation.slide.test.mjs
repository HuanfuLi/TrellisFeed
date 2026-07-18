import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Pure hysteresis helper lives in a React-free module so it can be imported
// directly under `node --test` (importing useKeyboard.ts pulls in `react` and
// fails ERR_MODULE_NOT_FOUND). This keeps the state transitions executable
// without importing the React component tree.
import {
  resolveKeyboardOpen,
  nextKeyboardState,
  INITIAL_KEYBOARD_NAV_STATE,
} from '../../src/state/keyboard-hysteresis.ts';

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
    /nextKeyboardState\(\s*navState\s*,\s*\{[\s\S]*?editableFocused\s*,/,
    'keyboard-open classification must route editable focus through the nextKeyboardState machine',
  );
});

// --- BUGFIX-03: anti-flicker hysteresis source-guards (red until Task 2) ---

const hysteresisSource = readFileSync(new URL('../../src/state/keyboard-hysteresis.ts', import.meta.url), 'utf8');

test('useKeyboard wires the hysteresis helper (anti-flicker mechanism present)', () => {
  // Open threshold constant must still exist (load-bearing per plan must_haves.artifacts.contains).
  assert.match(keyboardSource, /MIN_KEYBOARD_HEIGHT/, 'open threshold MIN_KEYBOARD_HEIGHT must be present in useKeyboard.ts');
  // A distinct CLOSE threshold is the hysteresis (separate open/close thresholds).
  assert.match(keyboardSource, /CLOSE_KEYBOARD_HEIGHT/, 'a distinct CLOSE_KEYBOARD_HEIGHT threshold must exist for hysteresis');
  // The handler must route the open/close decision through the focus-aware machine.
  assert.match(keyboardSource, /nextKeyboardState\(/, 'useKeyboard must call nextKeyboardState (focus-aware hysteresis)');
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

// --- BUGFIX-03 gap closure: focus-driven instant hide state machine ---

const ev = (over) => ({
  kind: 'resize',
  editableFocused: true,
  heightDelta: 0,
  isTouchDevice: true,
  openThreshold: OPEN,
  closeThreshold: CLOSE,
  ...over,
});

test('focusin on a touch device hides the nav INSTANTLY (front-runs the resize) and enters grace', () => {
  const s = nextKeyboardState(INITIAL_KEYBOARD_NAV_STATE, ev({ kind: 'focusin', heightDelta: 0 }));
  assert.equal(s.open, true, 'tap into the input hides the nav before the keyboard animates');
  assert.equal(s.pending, true, 'grace window is active until the keyboard height confirms');
});

test('focusin on a NON-touch device does not hide the nav (desktop/web regression guard)', () => {
  const s = nextKeyboardState(INITIAL_KEYBOARD_NAV_STATE, ev({ kind: 'focusin', isTouchDevice: false }));
  assert.equal(s.open, false, 'focusing the Ask input on desktop must NOT hide the nav (no virtual keyboard)');
});

test('grace window keeps the nav hidden while the keyboard animates (small transient deltas ignored)', () => {
  const opened = nextKeyboardState(INITIAL_KEYBOARD_NAV_STATE, ev({ kind: 'focusin' }));
  // First resize during the open animation reports a tiny delta — must NOT re-show.
  const mid = nextKeyboardState(opened, ev({ kind: 'resize', heightDelta: 20 }));
  assert.equal(mid.open, true, 'a small mid-animation delta must not re-show the nav during grace');
  assert.equal(mid.pending, true, 'still pending until height confirms the keyboard is up');
});

test('height confirmation exits the grace window (definitively open)', () => {
  const opened = nextKeyboardState(INITIAL_KEYBOARD_NAV_STATE, ev({ kind: 'focusin' }));
  const confirmed = nextKeyboardState(opened, ev({ kind: 'resize', heightDelta: OPEN + 50 }));
  assert.equal(confirmed.open, true);
  assert.equal(confirmed.pending, false, 'grace clears once the keyboard height is confirmed');
});

test('focusout shows the nav again', () => {
  const opened = nextKeyboardState(INITIAL_KEYBOARD_NAV_STATE, ev({ kind: 'focusin' }));
  const out = nextKeyboardState(opened, ev({ kind: 'focusout', editableFocused: false, heightDelta: 0 }));
  assert.equal(out.open, false, 'leaving the input shows the nav');
  assert.equal(out.pending, false);
});

test('back-button closes keyboard while focus retained → height recedes → nav shows', () => {
  // Confirmed-open state, focus still on the input, then the system back button
  // dismisses the keyboard (height returns toward baseline) with no focusout.
  const confirmed = { open: true, pending: false };
  const closed = nextKeyboardState(confirmed, ev({ kind: 'resize', editableFocused: true, heightDelta: 0 }));
  assert.equal(closed.open, false, 'keyboard dismissed (height recedes below close threshold) re-shows the nav');
});

test('BottomNavigation hides instantly (duration 0) when keyboard open, springs otherwise', () => {
  assert.match(
    bottomNavigationSource,
    /transition=\{\s*keyboardOpen\s*\?\s*\{\s*duration:\s*0\s*\}\s*:\s*SLIDE_SPRING\s*\}/,
    'the nav must use a zero-duration (instant) hide when keyboardOpen so it is gone before ' +
    'adjustResize re-anchors the fixed bar upward; show keeps the SLIDE_SPRING.',
  );
});

test('useKeyboard gates the focus front-run on a touch device (no desktop hide)', () => {
  assert.match(
    keyboardSource,
    /const\s+isTouchDevice\s*=/,
    'useKeyboard must compute isTouchDevice and only front-run the hide on touch devices',
  );
  assert.match(
    keyboardSource,
    /maxTouchPoints|ontouchstart/,
    'isTouchDevice must derive from a touch-capability signal',
  );
});
