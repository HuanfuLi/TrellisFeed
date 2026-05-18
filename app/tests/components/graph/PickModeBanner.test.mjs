/**
 * PickModeBanner.test.mjs — Phase 49-04 (Wave 0 scaffold)
 *
 * 1 failing test that goes GREEN when Plan 49-04 ships
 * `app/src/components/graph/PickModeBanner.tsx`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/PickModeBanner.tsx');

// FAILS until Plan 49-04 ships app/src/components/graph/PickModeBanner.tsx
test('PickModeBanner exports component with onCancel + pickMode props', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `PickModeBanner.tsx must exist after Plan 49-04 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /export\s+function\s+PickModeBanner\s*\(/,
    'must export `PickModeBanner` component',
  );
  assert.match(
    src,
    /onCancel/,
    'props interface must include onCancel handler',
  );
  assert.match(
    src,
    /pickMode/,
    'props interface must reference pickMode state shape',
  );
});
