/**
 * MergeConfirmPreview.test.mjs — Phase 49-03 (Wave 0 scaffold)
 *
 * 1 failing test that goes GREEN when Plan 49-03 ships
 * `app/src/components/graph/MergeConfirmPreview.tsx`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/MergeConfirmPreview.tsx');

// FAILS until Plan 49-03 ships app/src/components/graph/MergeConfirmPreview.tsx
test('MergeConfirmPreview exports component and renders both loser and survivor titles', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `MergeConfirmPreview.tsx must exist after Plan 49-03 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /export\s+function\s+MergeConfirmPreview\s*\(/,
    'must export `MergeConfirmPreview` component',
  );
  assert.match(
    src,
    /loser\.title/,
    'must reference loser.title (D-07 side-by-side card pattern)',
  );
  assert.match(
    src,
    /survivor\.title/,
    'must reference survivor.title (D-07 side-by-side card pattern)',
  );
});
