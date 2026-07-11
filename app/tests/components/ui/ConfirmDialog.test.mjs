/**
 * ConfirmDialog.test.mjs — Phase 49-03
 *
 * 6 tests covering the reusable confirm modal extracted from GraphScreen's
 * inherited inline confirmation pattern.
 * Source-reading approach (matches the rest of the Phase 49 suite) — no jsdom
 * dependency, no TSX loader required.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/ui/ConfirmDialog.tsx');

// Test 1 — render: open: false → null. open: true → modal at zIndex 300 with backdrop rgba(0,0,0,0.5).
test('Test 1 — render: open=false returns null; open=true renders zIndex 300 + rgba backdrop', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `ConfirmDialog.tsx must exist after Plan 49-03 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /if\s*\(\s*!\s*open\s*\)\s*return\s+null/,
    'must early-return null when open=false',
  );
  assert.match(
    src,
    /zIndex:\s*300/,
    'modal backdrop must use zIndex: 300',
  );
  assert.match(
    src,
    /backgroundColor:\s*['"]rgba\(0,0,0,0\.5\)['"]/,
    'backdrop must use rgba(0,0,0,0.5) — semi-transparent dim',
  );
});

// Test 2 — buttons: Cancel + Confirm; Cancel invokes onCancel; Confirm invokes onConfirm.
test('Test 2 — renders Cancel + Confirm buttons wired to onCancel + onConfirm', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // cancelLabel and confirmLabel must render in buttons.
  assert.match(
    src,
    /\{cancelLabel\}/,
    'must render the cancelLabel inside a button element',
  );
  assert.match(
    src,
    /\{confirmLabel\}/,
    'must render the confirmLabel inside a button element',
  );
  // Each button must have an onClick wired to the respective handler.
  assert.match(
    src,
    /onClick=\{onCancel\}/,
    'cancel button must wire onClick={onCancel}',
  );
  assert.match(
    src,
    /onClick=\{onConfirm\}/,
    'confirm button must wire onClick={onConfirm}',
  );
});

// Test 3 — destructive: false → --primary-40; true → --danger.
test('Test 3 — destructive variant swaps confirm button color to var(--danger)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /destructive\s*\?\s*['"]var\(--danger\)['"]\s*:\s*['"]var\(--primary-40\)['"]/,
    'must declare ternary: destructive ? "var(--danger)" : "var(--primary-40)"',
  );
});

// Test 4 — children slot: renders between body and buttons; body omitted when children present.
test('Test 4 — children slot renders between body and button row', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // body, children, then onConfirm — in that source ORDER (already covered partially
  // by the scaffold test below, kept here as an explicit Test 4 for plan completeness).
  const bodyMatch = src.search(/\{body\s*&&/);
  const childrenMatch = src.search(/\{children\s*&&/);
  const confirmBtnMatch = src.search(/onClick=\{onConfirm\}/);
  assert.ok(bodyMatch > -1, 'must reference {body && ...} conditionally render body');
  assert.ok(childrenMatch > -1, 'must reference {children && ...} conditionally render children slot');
  assert.ok(confirmBtnMatch > -1, 'must reference the confirm button onClick');
  assert.ok(
    bodyMatch < childrenMatch && childrenMatch < confirmBtnMatch,
    `source order must be body → children → confirm button (got body@${bodyMatch}, children@${childrenMatch}, confirm@${confirmBtnMatch})`,
  );
});

// Test 5 — backdrop click cancels; inner card stopPropagation prevents cancel.
test('Test 5 — backdrop onClick=onCancel; inner card onClick stops propagation', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Outer wrapper (the backdrop) must have onClick={onCancel}.
  assert.match(
    src,
    /<div\s+onClick=\{onCancel\}/,
    'outer backdrop div must wire onClick={onCancel}',
  );
  // Inner card must stop propagation so clicks inside don't bubble up and trigger onCancel.
  assert.match(
    src,
    /onClick=\{\s*\(\s*e\s*\)\s*=>\s*e\.stopPropagation\(\)\s*\}/,
    'inner card div must stop propagation on click',
  );
});

// Test 6 — source: no Tailwind classes; CSS variables only; zIndex 300.
test('Test 6 — CSS variables only, no Tailwind classes', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // No className= attribute (Tailwind usage). Inline styles only.
  assert.equal(
    /className=/.test(src),
    false,
    'must not use className= attribute (CSS variables / inline styles only per CLAUDE.md style convention)',
  );
  // Must reference CSS variable tokens.
  assert.match(src, /var\(--surface\)/, 'must reference var(--surface)');
  assert.match(src, /var\(--radius-xl\)/, 'must reference var(--radius-xl)');
  assert.match(src, /var\(--shadow-3\)/, 'must reference var(--shadow-3)');
  assert.match(src, /var\(--border\)/, 'must reference var(--border)');
  assert.match(src, /var\(--muted-foreground\)/, 'must reference var(--muted-foreground)');
});
