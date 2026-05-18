// Phase 50 Plan 50-06 — FilterPickerSheet source-reading tests (UI-SPEC §2).
//
// Source-reading pattern (no DOM render) — mirrors LongPressMenu.test.mjs.
// FilterPickerSheet is the shared single-select picker reused by the
// Concept / Source / Date filter chips. Single-tap commits the filter and
// dismisses the sheet — no Done button.
//
// Verifies:
//   - <BottomSheet compact> shell
//   - Each row's onClick fires onSelect AND onClose in the same handler
//     (single-tap commits + dismisses)
//   - Leading Check icon for active row; transparent for inactive
//   - Empty-state branch when options.length === 0 and emptyTitle is provided
//   - No Done button (regex against the savePicker.done key + 'Done' literal)
//   - No dangerouslySetInnerHTML

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const SRC_REL = 'src/components/FilterPickerSheet.tsx';

function readSrc() {
  return readFileSync(path.join(appRoot, SRC_REL), 'utf8');
}

test('FPS-01: FilterPickerSheet renders <BottomSheet compact>', () => {
  const src = readSrc();
  assert.match(
    src,
    /<BottomSheet[\s\S]*?compact/,
    'FilterPickerSheet must render <BottomSheet compact>',
  );
});

test('FPS-02: row onClick fires onSelect(...) and onClose() together (single-tap-commits)', () => {
  const src = readSrc();
  // The plan-locked pattern is `onClick={() => { onSelect(option.value); onClose(); }}`.
  // Accept any handler shape where both calls appear in close proximity
  // (within ~120 chars) so a future refactor that splits them into a small
  // helper still passes the test.
  const regex = /onSelect\s*\([\s\S]{0,40}\)[\s\S]{0,120}onClose\s*\(\s*\)/;
  assert.match(src, regex, 'Row tap must commit via onSelect and dismiss via onClose in one handler');
});

test('FPS-03: Check icon renders with conditional color (selected vs transparent)', () => {
  const src = readSrc();
  // Active row carries a leading Check icon with var(--primary-40) color;
  // inactive rows render the icon with 'transparent' to preserve layout.
  assert.match(src, /from\s+['"]lucide-react['"]/, 'Must import from lucide-react');
  assert.match(src, /Check[\s,}]/, 'Must use the Check icon');
  assert.match(
    src,
    /['"]transparent['"]/,
    'Inactive Check icon color must be "transparent" so layout stays stable',
  );
  assert.match(
    src,
    /var\(--primary-40\)/,
    'Active Check icon color must be var(--primary-40)',
  );
});

test('FPS-04: empty-state branch — options.length === 0 + emptyTitle renders empty state', () => {
  const src = readSrc();
  // Empty-state branch shown when no anchors / no source labels exist.
  // Match by branch source — either `options.length === 0` or
  // `!options.length` paired with an emptyTitle reference.
  assert.match(
    src,
    /options\.length\s*===?\s*0|!options\.length|options\.length\s*<\s*1/,
    'Must check options.length to switch into empty-state branch',
  );
  assert.match(src, /emptyTitle/, 'Empty-state branch must reference emptyTitle prop');
});

test('FPS-05: NO Done button — single-tap commits without an explicit submit', () => {
  const src = readSrc();
  // Negative invariant: must NOT wire the same i18n key the save picker
  // uses for its Done button, and must NOT contain a plain string "Done"
  // as a button label.
  assert.doesNotMatch(src, /library\.savePicker\.done/, 'Must not reuse savePicker.done label');
  // Defensive scan against any literal "Done" / "done" inside JSX text
  // nodes — accept the substring inside identifiers but not inside JSX
  // children. We approximate by rejecting `>Done<` (JSX text children).
  assert.doesNotMatch(src, />\s*Done\s*</, 'Must not render a "Done" button label');
});

test('FPS-XSS: NO dangerouslySetInnerHTML anywhere', () => {
  const src = readSrc();
  const matches = src.match(/dangerouslySetInnerHTML/g) || [];
  assert.strictEqual(
    matches.length,
    0,
    `FilterPickerSheet must not use dangerouslySetInnerHTML; found ${matches.length}.`,
  );
});

test('FPS-06: FilterPickerSheet is pure UI — imports NO services', () => {
  const src = readSrc();
  // Pure UI primitive — data is provided via props by the caller. Importing
  // a service module would couple this shared picker to one consumer.
  assert.doesNotMatch(
    src,
    /from\s+['"][^'"]*services\/[^'"]+['"]/,
    'FilterPickerSheet must not import any service module',
  );
});
