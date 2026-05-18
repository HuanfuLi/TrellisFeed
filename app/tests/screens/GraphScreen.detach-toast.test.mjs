/**
 * GraphScreen.detach-toast.test.mjs — Phase 49-04 (Wave 0 scaffold)
 *
 * 2 failing tests on the detach handler with B-1 two-emit GRAPH_UPDATED
 * correlation pattern (D-12 + R7 from Phase 48).
 *
 * Go GREEN when Plan 49-04 wires the detach handler in GraphScreen.tsx.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

// FAILS until Plan 49-04 wires detach handler calling graphCommandService.detach
test('handleDetach calls graphCommandService.detach', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /graphCommandService\.detach\(/,
    'GraphScreen.tsx must call `graphCommandService.detach(qaId)` in the detach handler (Plan 49-04)',
  );
});

// FAILS until Plan 49-04 wires the B-1 two-emit GRAPH_UPDATED correlation
test('detach handler correlates two GRAPH_UPDATED events for re-anchor toast', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // B-1 fix landmark: explicit comment marker so the load-bearing pattern is greppable.
  assert.match(
    src,
    /Two-emit correlation/,
    'must include the `// Two-emit correlation` comment marker (B-1 fix landmark — Plan 49-04)',
  );
  assert.match(
    src,
    /detachedNewAnchor/,
    'must reference toast key `detachedNewAnchor` (re-anchored variant — D-12)',
  );
  assert.match(
    src,
    /detachedSameAnchor/,
    'must reference toast key `detachedSameAnchor` (no-op variant — D-12)',
  );
});
