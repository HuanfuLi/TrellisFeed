// Phase 43 Plan 43-09 — source-reading regression for UAT Test 2 fix.
//
// Asserts that BottomSheet.tsx:
//   (a) imports createPortal from 'react-dom'
//   (b) invokes createPortal(overlay, document.body) so the sheet escapes
//       the SwipeTabContainer slot's translateZ(0) containing block
//       (Phase 32.1 portal pattern — same bug class as the Header fix)
//   (c) has an SSR-safe `typeof document === 'undefined'` guard returning null
//   (d) offsets the inner sheet by calc(80px + var(--safe-area-bottom)) so
//       the third (Dismiss) row clears the fixed BottomNavigation
//
// Pattern: pure regex + indexOf against the live source file — no React
// render, no jsdom. Follows the Phase 39/40/41/42/43 source-reading test
// discipline.
//
// See .planning/debug/dismiss-row-clipped-by-bottom-nav.md for the geometric
// proof of why the Dismiss row was clipped and the multi-layer fix rationale.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/components/ui/BottomSheet.tsx'), 'utf8');

test('43-09: BottomSheet imports createPortal from react-dom', () => {
  assert.match(
    src,
    /import\s+\{\s*createPortal\s*\}\s+from\s+['"]react-dom['"]/,
    'createPortal must be imported from react-dom at the top of BottomSheet.tsx',
  );
});

test('43-09: BottomSheet invokes createPortal with document.body target', () => {
  // Tolerate either `createPortal(overlay, document.body)` or whitespace
  // variants — but require the document.body target literally.
  assert.match(
    src,
    /createPortal\s*\([^,]+,\s*document\.body\s*\)/,
    'BottomSheet must return createPortal(node, document.body) so the sheet escapes the slot containing block',
  );
});

test('43-09: BottomSheet has SSR-safe document-undefined guard returning null', () => {
  assert.match(
    src,
    /typeof\s+document\s*===\s*['"]undefined['"]/,
    'SSR guard must check `typeof document === undefined` before reaching createPortal(..., document.body)',
  );
  // Ensure the guard returns null (vs. returning the overlay JSX, which
  // would crash if document is undefined).
  const guardIdx = src.search(/typeof\s+document\s*===\s*['"]undefined['"]/);
  const after = src.slice(guardIdx, guardIdx + 80);
  assert.match(after, /return\s+null/, 'document-undefined guard must `return null`');
});

test('43-09: inner sheet has nav-clearance offset above BottomNavigation', () => {
  assert.match(
    src,
    /bottom:\s*['"]calc\(80px\s*\+\s*var\(--safe-area-bottom\)\)['"]/,
    'inner sheet bottom must be calc(80px + var(--safe-area-bottom)) to clear the BottomNavigation footprint',
  );
});

test('43-09: inner sheet position is still absolute (no layout regression)', () => {
  assert.match(
    src,
    /position:\s*['"]absolute['"]/,
    'inner sheet must keep position: absolute (translateY animation depends on absolute positioning relative to the overlay)',
  );
});

test('43-09: inner sheet does NOT regress to bottom: 0 (the original clipped placement)', () => {
  // Negative invariant: the original `bottom: 0,` line (note the trailing
  // comma, not a hex color or rgba boundary) must not exist in the inner
  // sheet block. We anchor the search on the segment between
  // `position: 'absolute'` and `left: 0` to scope precisely.
  const absIdx = src.indexOf("position: 'absolute'");
  assert.ok(absIdx > 0, 'inner sheet must declare position: absolute');
  const leftIdx = src.indexOf('left: 0', absIdx);
  assert.ok(leftIdx > absIdx, 'inner sheet must declare left: 0 right after position: absolute');
  const region = src.slice(absIdx, leftIdx);
  assert.doesNotMatch(
    region,
    /\bbottom:\s*0\s*,/,
    'inner sheet must NOT use bottom: 0 — that was the pre-fix placement clipped by BottomNavigation',
  );
});
