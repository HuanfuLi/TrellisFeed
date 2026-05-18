/**
 * GraphScreen.reorg-gate.test.mjs — Phase 49-01 + 49-02 (Wave 0 scaffold)
 *
 * 2 failing tests on GraphScreen.tsx reorg-gate wiring (D-16).
 * Test 1 goes GREEN at end of Plan 49-01 (drag-start gate).
 * Test 2 goes GREEN when Plan 49-02 wires CorrectionCard with `isReorganizing` prop.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

// FAILS until Plan 49-01 Task 4 wires the isReorgInProgress gate in the new pointerdown handler
test('drag-start handler checks isReorgInProgress', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /isReorgInProgress\(\)/,
    'GraphScreen must call `isReorgInProgress()` in the drag-start handler (D-16 gate)',
  );
  // Also verify the reorg-in-progress toast is wired.
  assert.match(
    src,
    /graph\.correction\.toast\.reorgInProgress/,
    'must toast `graph.correction.toast.reorgInProgress` when drag attempted during reorg',
  );
});

// FAILS until Plan 49-02 wires CorrectionCard with isReorganizing prop
test('CorrectionCard receives isReorganizing prop from reorganizing state', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /isReorganizing=\{reorganizing\}/,
    'CorrectionCard must receive `isReorganizing={reorganizing}` (Plan 49-02 + D-16)',
  );
});
