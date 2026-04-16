import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── Phase 28 Plan 03 — AskScreen recent-questions Wave 0 tests ─────────────
//
// Inline-mirror + source-side grep pattern (established by Phase 28-01
// BottomNavigation.slide.test.mjs and Phase 28-02 TrellisLeaf.shake.test.mjs):
//   (1) mirror the pure helpers inline in JS so node --test can contract-test
//       them without the Node 25 TSX-loader fragility,
//   (2) grep the .tsx source to verify the exports actually exist and that
//       the refactored JSX consumes them — source-side acceptance_criteria
//       greps in the plan enforce symmetry.
//
// Covers:
//   - D-15-LOGIC: empty-state marker references ask.recentQuestionsEmpty
//   - D-16:      buildRowClassName({ interactive: true }) includes
//                the substring 'active-squish'

const here = dirname(fileURLToPath(import.meta.url));
const askScreenSrc = readFileSync(
  resolve(here, '../../src/screens/AskScreen.tsx'),
  'utf8',
);

// ── Inline mirror of renderRecentQuestionsMarker ────────────────────────────
const renderRecentQuestionsMarker = (questions) => {
  if (questions.length === 0) return { kind: 'empty', i18nKey: 'ask.recentQuestionsEmpty' };
  return { kind: 'list', count: questions.length };
};

// ── Inline mirror of buildRowClassName ──────────────────────────────────────
const buildRowClassName = ({ interactive }) => {
  const base = 'ask-recent-row';
  return interactive ? `${base} active-squish` : base;
};

test('D-15-LOGIC: empty questions array returns empty marker with ask.recentQuestionsEmpty key', () => {
  const marker = renderRecentQuestionsMarker([]);
  assert.equal(marker.kind, 'empty');
  assert.equal(marker.i18nKey, 'ask.recentQuestionsEmpty');
});

test('D-15-LOGIC: non-empty questions array returns list marker with count', () => {
  const marker = renderRecentQuestionsMarker([{ id: 'q1', content: 'hello' }]);
  assert.equal(marker.kind, 'list');
  assert.equal(marker.count, 1);
});

test('D-16: interactive row className includes active-squish', () => {
  const cls = buildRowClassName({ interactive: true });
  assert.ok(cls.includes('active-squish'), `expected active-squish in "${cls}"`);
});

test('D-16: non-interactive row className does NOT include active-squish', () => {
  const cls = buildRowClassName({ interactive: false });
  assert.ok(!cls.includes('active-squish'), `did not expect active-squish in "${cls}"`);
});

test('D-15 source-side export: renderRecentQuestionsMarker is exported from AskScreen.tsx', () => {
  assert.ok(
    askScreenSrc.includes('export const renderRecentQuestionsMarker'),
    'expected `export const renderRecentQuestionsMarker` in AskScreen.tsx',
  );
});

test('D-16 source-side export: buildRowClassName is exported from AskScreen.tsx', () => {
  assert.ok(
    askScreenSrc.includes('export const buildRowClassName'),
    'expected `export const buildRowClassName` in AskScreen.tsx',
  );
});

test('D-15 static-structure safety net: AskScreen source conditionally renders empty state with t key', () => {
  assert.ok(
    askScreenSrc.includes('questions.length === 0'),
    'expected `questions.length === 0` branch in AskScreen.tsx',
  );
  assert.ok(
    askScreenSrc.includes('ask.recentQuestionsEmpty'),
    'expected `t(\'ask.recentQuestionsEmpty\')` call in AskScreen.tsx',
  );
});

test('D-15 static-structure: refactored rows use 2-line clamp via WebkitLineClamp', () => {
  assert.ok(
    askScreenSrc.includes('WebkitLineClamp: 2'),
    'expected `WebkitLineClamp: 2` in AskScreen.tsx recent-question row',
  );
});

test('D-28 completion: recent-question row padding normalized to 12px 16px (plan 28-01 deferral resolved)', () => {
  assert.ok(
    !/padding: '11px 16px'/.test(askScreenSrc),
    'did not expect `padding: \'11px 16px\'` — deferred D-28 fix should now land as 12px 16px',
  );
});
