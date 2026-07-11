// Phase 50 plan 50-13 gap G5 — BottomSheet overscroll-boundary regression.
//
// Operator-reported 2026-05-18: fast-scroll near top/bottom of the picker
// drawer leaked content past the BottomSheet's rounded mask on Android WebView.
// Fix: overscroll-behavior: contain + WebkitOverflowScrolling: 'touch' added
// to the SAME inline-style object that already owns overflowY: 'auto' (CSS
// overscroll-behavior only applies to scrolling elements, so co-location is
// load-bearing). This test guards against silent removal of either style key
// OR a refactor that moves them off the scroll-owning element.
//
// Source-reading only — no DOM render. Separate file from
// BottomSheet.portal.test.mjs to keep portal/clearance assertions (Phase 43)
// distinct from scroll-boundary assertions (Phase 50).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/components/ui/BottomSheet.tsx'), 'utf8');

test('BS-OS-01: BottomSheet source contains overscrollBehavior: contain', () => {
  assert.match(
    src,
    /overscrollBehavior:\s*['"]contain['"]/,
    "BottomSheet must declare overscrollBehavior: 'contain' on the inner scroll container",
  );
});

test('BS-OS-02: BottomSheet source contains WebkitOverflowScrolling: touch', () => {
  assert.match(
    src,
    /WebkitOverflowScrolling:\s*['"]touch['"]/,
    "BottomSheet must declare WebkitOverflowScrolling: 'touch' for iOS momentum-scroll preservation",
  );
});

test('BS-OS-03: overscrollBehavior lives on the SAME element as overflowY (co-location)', () => {
  const overflowIdx = src.search(/^\s*overflowY:\s*['"]auto['"],/m);
  assert.ok(overflowIdx >= 0, "BottomSheet must declare overflowY: 'auto'");
  const styleStart = src.lastIndexOf('style={{', overflowIdx);
  const styleEnd = src.indexOf('}}', overflowIdx);
  assert.ok(styleStart >= 0 && styleEnd > overflowIdx, 'overflowY must live inside an inline style object');
  const scrollStyle = src.slice(styleStart, styleEnd);
  assert.match(
    scrollStyle,
    /overscrollBehavior:\s*['"]contain['"]/,
    "overscrollBehavior must live in the same inline-style object as overflowY:'auto'",
  );
});

test('BS-OS-04: BottomSheet source references G5 / 50-13 gap-closure provenance', () => {
  assert.match(
    src,
    /50-13/,
    'BottomSheet must contain a comment referencing plan 50-13 for gap-closure provenance',
  );
});

test('BS-OS-05: Phase 43 portal/anchor contracts preserved after Task 1 edit', () => {
  // Regression sentry — the overscroll edit must not accidentally refactor
  // away the Phase 43 load-bearing anchors.
  assert.match(
    src,
    /createPortal\s*\(/,
    'createPortal invocation must still be present (Phase 43 portal contract)',
  );
  assert.match(
    src,
    /bottom:\s*0/,
    'inner sheet bottom: 0 must still be present (Phase 43 anchor contract)',
  );
  assert.match(
    src,
    /borderRadius:\s*['"]20px 20px 0 0['"]/,
    'inner sheet borderRadius 20px 20px 0 0 must still be present (Phase 43 rounded-mask contract)',
  );
});
