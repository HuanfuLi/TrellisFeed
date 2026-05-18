/**
 * Toast.action.test.mjs — Phase 49-03 (Wave 0 scaffold)
 *
 * 2 failing tests that go GREEN when Plan 49-03 extends `toast()` signature
 * with an optional 3rd-arg `{ action: { label, onAction } }` and Toast.tsx
 * renders a trailing action button.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TOAST_LIB_PATH = resolve(here, '../../src/lib/toast.ts');
const TOAST_TSX_PATH = resolve(here, '../../src/components/ui/Toast.tsx');

// FAILS until Plan 49-03 extends toast() to accept an optional 3rd arg with an action.
test('toast helper accepts optional 3rd arg with action { label, onAction }', async () => {
  const mod = await import('../../src/lib/toast.ts');
  // Should not throw with a third-arg call passing action.
  assert.doesNotThrow(() => {
    mod.toast('msg', 'info', { action: { label: 'Undo', onAction: () => {} } });
  }, 'toast() must accept 3rd arg `{ action: { label, onAction } }` without throwing');

  // Source-reading: signature must accept a 3rd parameter.
  const src = readFileSync(TOAST_LIB_PATH, 'utf-8');
  assert.match(
    src,
    /action\s*[?:]\s*\{[^}]*label[^}]*onAction/,
    'toast.ts must declare `action?: { label; onAction }` in its signature/types',
  );
});

// FAILS until Plan 49-03 extends Toast.tsx to render a trailing action button when action set.
test('Toast.tsx renders trailing action button when action set', () => {
  const src = readFileSync(TOAST_TSX_PATH, 'utf-8');
  assert.match(
    src,
    /action\s*[?:]\s*\{[^}]*label[^}]*onAction/,
    'ToastMessage interface must include optional `action?: { label; onAction }` field',
  );
  // Action branch must invoke onAction on click.
  assert.match(
    src,
    /onAction\(\)/,
    'Toast.tsx must invoke action.onAction() on click in the trailing button branch',
  );
});
