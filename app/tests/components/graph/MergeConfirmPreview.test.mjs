/**
 * MergeConfirmPreview.test.mjs — Phase 49-03
 *
 * 6 tests on the side-by-side loser/survivor preview rendered as <ConfirmDialog>
 * children for the merge flow (D-07). Source-reading approach (no jsdom).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/MergeConfirmPreview.tsx');

// Test 1 — layout: two children in flex row (display:flex, gap:12px); each child flex:1.
test('Test 1 — renders two cards in a flex row with gap:12px and each card flex:1', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `MergeConfirmPreview.tsx must exist after Plan 49-03 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /display:\s*['"]flex['"]/,
    'must render a flex container for the side-by-side cards',
  );
  assert.match(
    src,
    /gap:\s*['"]12px['"]/,
    'must use gap:12px between loser and survivor cards',
  );
  assert.match(
    src,
    /flex:\s*1/,
    'each card must use flex:1 so they share width equally',
  );
});

// Test 2 — LOSER styling: --surface-variant bg, opacity 0.6, badge in --danger with willBeRemoved label.
test('Test 2 — LOSER card uses --surface-variant bg, opacity 0.6, badge in --danger', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /backgroundColor:\s*['"]var\(--surface-variant\)['"]/,
    'LOSER card must use backgroundColor: var(--surface-variant)',
  );
  assert.match(
    src,
    /opacity:\s*0\.6/,
    'LOSER card must use opacity: 0.6 to visually deprioritize',
  );
  assert.match(
    src,
    /backgroundColor:\s*['"]var\(--danger\)['"]/,
    'LOSER badge must use backgroundColor: var(--danger)',
  );
  assert.match(
    src,
    /graph\.correction\.merge\.willBeRemoved/,
    'LOSER badge must render t("graph.correction.merge.willBeRemoved")',
  );
});

// Test 3 — SURVIVOR styling: --surface bg (normal), badge in --primary-40 with willKeep label.
test('Test 3 — SURVIVOR card uses --surface bg (normal opacity), badge in --primary-40', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // The survivor card uses --surface — must appear as a backgroundColor reference.
  assert.match(
    src,
    /backgroundColor:\s*['"]var\(--surface\)['"]/,
    'SURVIVOR card must use backgroundColor: var(--surface)',
  );
  assert.match(
    src,
    /backgroundColor:\s*['"]var\(--primary-40\)['"]/,
    'SURVIVOR badge must use backgroundColor: var(--primary-40)',
  );
  assert.match(
    src,
    /graph\.correction\.merge\.willKeep/,
    'SURVIVOR badge must render t("graph.correction.merge.willKeep")',
  );
});

// Test 4 — content: each card body renders node title + OWN Q&A count + cluster title.
//                  B-3: counts come from props, NOT internal derivation.
test('Test 4 — each card renders title + own qaCount + cluster title (counts from props)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Both loserQaCount and survivorQaCount must be referenced in the JSX.
  assert.match(
    src,
    /count:\s*loserQaCount/,
    'must interpolate loserQaCount into the LOSER card via i18n t("graph.anchor.qaCount", { count: loserQaCount })',
  );
  assert.match(
    src,
    /count:\s*survivorQaCount/,
    'must interpolate survivorQaCount into the SURVIVOR card via i18n t("graph.anchor.qaCount", { count: survivorQaCount })',
  );
  // Both titles rendered.
  assert.match(src, /loser\.title/, 'must render loser.title');
  assert.match(src, /survivor\.title/, 'must render survivor.title');
  // Cluster titles rendered.
  assert.match(src, /loserClusterTitle/, 'must render loserClusterTitle');
  assert.match(src, /survivorClusterTitle/, 'must render survivorClusterTitle');
  // B-3 — must NOT derive counts internally via questionService.getAll.
  assert.equal(
    /questionService\.getAll/.test(src),
    false,
    'MergeConfirmPreview must NOT call questionService.getAll internally (B-3 — counts arrive as props)',
  );
});

// Test 5 — body line: interpolates {{n}}, {{survivorTitle}}, {{loserTitle}} via merge.body.
test('Test 5 — body line interpolates n + survivorTitle + loserTitle via graph.correction.merge.body', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /graph\.correction\.merge\.body/,
    'must render t("graph.correction.merge.body", ...)',
  );
  // All three interpolation keys must appear in the t() call options object.
  assert.match(src, /\bn:\s*loserQaCount\b/, 'must pass n: loserQaCount to the body interpolation');
  assert.match(src, /survivorTitle:/, 'must pass survivorTitle to the body interpolation');
  assert.match(src, /loserTitle:/, 'must pass loserTitle to the body interpolation');
});

// Test 6 — props: component signature accepts BOTH loserQaCount AND survivorQaCount as required.
test('Test 6 — MergeConfirmPreviewProps requires BOTH loserQaCount AND survivorQaCount (B-3)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Required (no `?:`) — must match `loserQaCount: number` and `survivorQaCount: number`.
  assert.match(
    src,
    /loserQaCount:\s*number/,
    'props interface must declare loserQaCount: number (required, NOT optional)',
  );
  assert.match(
    src,
    /survivorQaCount:\s*number/,
    'props interface must declare survivorQaCount: number (required, NOT optional)',
  );
  // Sanity: both are explicitly destructured in the function signature.
  assert.match(
    src,
    /loserQaCount[\s,\n}]/,
    'function signature must destructure loserQaCount',
  );
  assert.match(
    src,
    /survivorQaCount[\s,\n}]/,
    'function signature must destructure survivorQaCount',
  );
});
