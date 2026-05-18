/**
 * ConfirmDialog.test.mjs — Phase 49-03 (Wave 0 scaffold)
 *
 * 2 failing tests that go GREEN when Plan 49-03 ships
 * `app/src/components/ui/ConfirmDialog.tsx`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/ui/ConfirmDialog.tsx');

// FAILS until Plan 49-03 ships app/src/components/ui/ConfirmDialog.tsx
test('ConfirmDialog exports component with destructive prop using --danger CSS var', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `ConfirmDialog.tsx must exist after Plan 49-03 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /export\s+function\s+ConfirmDialog\s*\(/,
    'must export `ConfirmDialog` component',
  );
  assert.match(
    src,
    /destructive\s*\?/,
    'props interface must declare optional `destructive?` flag (D-09 hard-delete destructive CTA)',
  );
  assert.match(
    src,
    /var\(--danger\)/,
    'destructive variant must use `var(--danger)` background for confirm button',
  );
});

// FAILS until Plan 49-03 ships ConfirmDialog with children slot between body and buttons
test('ConfirmDialog children slot renders between body and buttons (Merge preview host)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Children slot must be referenced; structural order body → children → buttons
  assert.match(
    src,
    /children/,
    'must declare a `children` prop slot',
  );
  // Body, children, then a button row — assert ordering via string positions.
  const bodyIdx = src.search(/\bbody\b/);
  const childrenIdx = src.search(/\bchildren\b/);
  const buttonIdx = src.search(/onConfirm/);
  assert.ok(
    bodyIdx > -1 && childrenIdx > -1 && buttonIdx > -1,
    'must include body, children, and onConfirm references',
  );
  assert.ok(
    childrenIdx < buttonIdx,
    `children slot must render BEFORE confirm button row (childrenIdx=${childrenIdx} buttonIdx=${buttonIdx})`,
  );
});
