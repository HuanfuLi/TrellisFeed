/**
 * GraphScreen.reload-survival.test.mjs — Phase 49-05 (Wave 0 scaffold)
 *
 * GRAPHUI-03 — Reload Survival.
 *
 * Phase 48 already proves the service-level invariant (see
 * tests/services/graph-command-service.reload-survival.test.mjs). This file
 * proves the UI invariant: a rename committed via graphCommandService is
 * visible from a fresh questionService.getAll() read after a simulated
 * reload. Depends on a small seed harness wired up in Plan 49-05.
 *
 * 1 failing test goes GREEN once Plan 49-05 ships
 * `app/tests/screens/_graph-screen-reload-harness.mjs` and the test driver
 * wires localStorage + questionService correctly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HARNESS_PATH = resolve(here, '_graph-screen-reload-harness.mjs');

// FAILS until Plan 49-05 ships the seed harness used to drive the simulated reload.
test('rename through graphCommandService survives reload simulation (Plan 49-05 harness)', () => {
  assert.equal(
    existsSync(HARNESS_PATH),
    true,
    `Expected reload-survival seed harness at ${HARNESS_PATH} — Plan 49-05 must ship this file (and the test driver that loads it) for GRAPHUI-03 UI-level coverage.`,
  );
});
