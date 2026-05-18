/**
 * GraphScreen.delete-confirm.test.mjs — Phase 49-03 (Wave 0 scaffold)
 *
 * 2 failing tests on the delete-confirm wiring (D-09).
 * Go GREEN when Plan 49-03 wires the ConfirmDialog with destructive prop and
 * derives qaChildCount from questionService.getAll().
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

// FAILS until Plan 49-03 wires destructive ConfirmDialog on delete
test('delete confirm uses destructive ConfirmDialog', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /destructive=\{true\}/,
    'delete ConfirmDialog must pass `destructive={true}` (D-09 — destructive red CTA)',
  );
});

// FAILS until Plan 49-03 wires qaChildCount derivation via questionService.getAll
test('delete confirm derives qaChildCount from questionService.getAll({ includeFlagged: true })', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /questionService\.getAll\(\s*\{\s*includeFlagged:\s*true\s*\}\s*\)/,
    'must call `questionService.getAll({ includeFlagged: true })` near the delete confirm block (D-09 child count)',
  );
});
