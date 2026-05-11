// Phase 43 Plan 43-11 — source-reading regression for UAT Test 5 fix.
//
// Asserts that the HomeScreen Bookmark icon is INLINE in the greeting row
// inside the scroll container, NOT a fixed-position viewport-anchored
// sibling of the compact VineProgress bar.
//
// Guards against regression to the original Phase 43-06 SV-02 fixed-position
// implementation, which overlapped the compact VineProgress bar slide-in
// and never scrolled away with page content.
//
// Pattern: pure regex + indexOf against the live source — no React render,
// no jsdom. Follows the Phase 39/40/41/42/43 source-reading discipline.
//
// See .planning/debug/bookmark-icon-viewport-fixed.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/HomeScreen.tsx'), 'utf8');

test('43-11: HomeScreen no longer renders a fixed-position Bookmark button (zIndex 195 + safe-area-top offset deleted)', () => {
  assert.doesNotMatch(
    src,
    /zIndex:\s*195/,
    'HomeScreen.tsx must not contain zIndex: 195 — that was the deleted fixed-position Bookmark block',
  );
  assert.doesNotMatch(
    src,
    /top:\s*['"]calc\(var\(--safe-area-top\) \+ 8px\)['"]/,
    'HomeScreen.tsx must not retain the fixed-position Bookmark `top: calc(var(--safe-area-top) + 8px)` offset',
  );
});

test('43-11: HomeScreen wraps greeting in an inline flex row with space-between', () => {
  // The flex row wrapper must exist near the `getGreeting()` call site so
  // the greeting <h1> AND the new inline Bookmark button are siblings.
  const greetingIdx = src.indexOf('{getGreeting()}');
  assert.ok(greetingIdx > 0, 'HomeScreen.tsx must call getGreeting() in the inline greeting row');
  // Look BACKWARD from the greeting for the wrapper. Scope a ~600-char
  // pre-window to keep the search precise.
  const preWindow = src.slice(Math.max(0, greetingIdx - 600), greetingIdx);
  assert.match(
    preWindow,
    /justifyContent:\s*['"]space-between['"]/,
    'HomeScreen.tsx must wrap the greeting in a flex row using justifyContent: space-between',
  );
});

test('43-11: HomeScreen contains exactly one navigate("/saved") call (the inline Bookmark)', () => {
  const calls = (src.match(/navigate\(['"]\/saved['"]\)/g) || []).length;
  assert.strictEqual(
    calls,
    1,
    'HomeScreen.tsx must contain exactly one navigate("/saved") call — the inline Bookmark in the greeting row',
  );
});

test('43-11: inline Bookmark button preserves WCAG 44x44 tap floor', () => {
  const greetingIdx = src.indexOf('{getGreeting()}');
  const postWindow = src.slice(greetingIdx, greetingIdx + 1200);
  assert.match(
    postWindow,
    /minWidth:\s*['"]44px['"]/,
    'inline Bookmark button must declare minWidth: 44px (WCAG tap floor)',
  );
  assert.match(
    postWindow,
    /minHeight:\s*['"]44px['"]/,
    'inline Bookmark button must declare minHeight: 44px (WCAG tap floor)',
  );
});

test('43-11: inline Bookmark button uses marginRight: "-8px" optical alignment', () => {
  const greetingIdx = src.indexOf('{getGreeting()}');
  const postWindow = src.slice(greetingIdx, greetingIdx + 1200);
  assert.match(
    postWindow,
    /marginRight:\s*['"]-8px['"]/,
    'inline Bookmark button must use marginRight: -8px so its glyph optically aligns with the 16px container padding-right',
  );
});

test('43-11: compact VineProgress bar at zIndex 190 is preserved (not accidentally deleted)', () => {
  // The compact bar was a sibling of the deleted Bookmark; ensure the
  // deletion did NOT take the compact bar with it.
  assert.match(
    src,
    /zIndex:\s*190/,
    'compact VineProgress bar (zIndex 190) must be preserved — only the Bookmark fixed-position block was deleted',
  );
});
