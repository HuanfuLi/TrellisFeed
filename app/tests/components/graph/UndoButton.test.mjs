/**
 * UndoButton.test.mjs — Phase 49-04 (Wave 0 scaffold)
 *
 * 2 failing tests that go GREEN when Plan 49-04 ships
 * `app/src/components/graph/UndoButton.tsx`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/UndoButton.tsx');

// FAILS until Plan 49-04 ships app/src/components/graph/UndoButton.tsx
test('UndoButton exports component', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `UndoButton.tsx must exist after Plan 49-04 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /export\s+function\s+UndoButton\s*\(/,
    'must export `UndoButton` component',
  );
});

// FAILS until Plan 49-04 ships UndoButton with GRAPH_UPDATED subscriber
test('UndoButton subscribes to GRAPH_UPDATED to recompute enabled state', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /eventBus\.subscribe\(\s*['"]GRAPH_UPDATED['"]/,
    'must subscribe to GRAPH_UPDATED (D-13 — recompute enabled state)',
  );
});
