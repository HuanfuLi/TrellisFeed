/**
 * GraphScreen.prune-undo.test.mjs — Phase 49-04 (Wave 0 scaffold)
 *
 * 2 failing tests on the soft-prune handler (D-10).
 * Go GREEN when Plan 49-04 wires `handlePrune` calling graphCommandService.prune
 * and the Snackbar-with-Undo toast (extended toast signature from Plan 49-03).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

// FAILS until Plan 49-04 wires handlePrune calling graphCommandService.prune
test('handlePrune calls graphCommandService.prune', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /graphCommandService\.prune\(/,
    'GraphScreen.tsx must call `graphCommandService.prune(...)` in the prune handler (Plan 49-04)',
  );
});

// FAILS until Plan 49-04 wires the Snackbar-with-Undo toast (D-10)
test('prune toast includes Undo action invoking graphCommandService.undo', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Toast 3rd-arg with action label + onAction (extended signature from Plan 49-03).
  assert.match(
    src,
    /\{\s*action:\s*\{\s*label:/,
    'prune handler must pass `{ action: { label: ... } }` as toast 3rd arg (Snackbar-with-Undo per D-10)',
  );
  assert.match(
    src,
    /graphCommandService\.undo\(\)/,
    'prune toast Undo action must invoke `graphCommandService.undo()` (D-10)',
  );
});
