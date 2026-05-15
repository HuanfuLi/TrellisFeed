// Phase 47 Plan 02 Task 3 — FILTER-04 held-out eval-set runner.
//
// Loops over every row in `filter-corpus.eval.json` and asserts the classifier
// returns the labeled `expected` value. Rows tagged with `waived_known_limit`
// emit a diagnostic instead of failing — they document classifier limits the
// bracketing safety net (FILTER-03 / Plan 03) covers.
//
// Mirrors `app/tests/locales/bundle-parity.test.mjs` JSON-fixture loop pattern
// per 47-PATTERNS.md §"app/tests/services/filter-classifier.eval.test.mjs".
//
// Test isolation:
//   - Inline-registers the filter mock loader so question-filter.service.ts's
//     transitive `../providers/embedding` + `./settings.service.ts` imports
//     are stubbed deterministically.
//   - localStorage shim for the corpus cache.
//   - The deterministic FNV-1a embedText mock means cosine outputs are
//     reproducible across CI runs without any network dependency. Real
//     semantic accuracy of the classifier is validated by hand-spot-checking
//     eval rows against staging embeddings on a developer machine, NOT in CI.
//
// Per D-15: a non-waived row that fails MUST fail CI.
// Per D-16 + RESEARCH §"Encoded Payloads — Documented Limit": waived rows
//   warn (via t.diagnostic) but do not fail.

import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// CRITICAL: register the loader BEFORE the first dynamic import below.
register('./_filter-classifier-mock-loader.mjs', import.meta.url);

// localStorage shim — filter-corpus.service.ts uses it for the cache.
const _store = new Map();
globalThis.localStorage = {
  getItem(k) {
    return _store.has(k) ? _store.get(k) : null;
  },
  setItem(k, v) {
    _store.set(k, String(v));
  },
  removeItem(k) {
    _store.delete(k);
  },
  clear() {
    _store.clear();
  },
};

const { evaluateQuestion } = await import('../../src/services/question-filter.service.ts');

const fixture = JSON.parse(
  readFileSync(new URL('./filter-corpus.eval.json', import.meta.url), 'utf-8'),
);

// ─── Meta-test: D-16 category coverage ───────────────────────────────────────
// Asserts the fixture contains every required v1.6 seed category before
// running the per-row loop. Catches accidental fixture deletions.

test('FILTER-04 fixture meta — required D-16 categories are present', () => {
  assert.ok(
    fixture.rows.find((r) => r.id === 'anchor-001' && r.expected === 'off-topic'),
    "Fixture must contain anchor-001 (\"How are you doing?\" → off-topic) — surfaced false-negative seed",
  );
  assert.ok(
    fixture.rows.find((r) => r.id === 'anchor-002' && r.expected === 'on-topic'),
    "Fixture must contain anchor-002 (\"What is a system prompt?\" → on-topic) — surfaced false-positive seed",
  );
  assert.ok(
    fixture.rows.find((r) => r.id.startsWith('inj-zh-') && r.expected === 'malicious'),
    'Fixture must contain a zh-locale injection row (D-16 foreign-language coverage)',
  );
  assert.ok(
    fixture.rows.find((r) => r.id.startsWith('inj-es-') && r.expected === 'malicious'),
    'Fixture must contain an es-locale injection row (D-16 foreign-language coverage)',
  );
  assert.ok(
    fixture.rows.find((r) => r.id.startsWith('inj-ja-') && r.expected === 'malicious'),
    'Fixture must contain a ja-locale injection row (D-16 foreign-language coverage)',
  );
  assert.ok(
    fixture.rows.find((r) => r.id.startsWith('follow-up-') && r.context && r.context.priorAnswer),
    'Fixture must contain a follow-up row with context.priorAnswer (D-11 context plumbing coverage)',
  );
  assert.ok(
    fixture.rows.find((r) => typeof r.waived_known_limit === 'string'),
    'Fixture must contain at least one waived_known_limit row (RESEARCH §"Encoded Payloads")',
  );
});

// ─── Per-row eval ────────────────────────────────────────────────────────────
// One node:test per fixture row, so failures surface individually with
// rationale + bestMatch in the assertion message.

for (const row of fixture.rows) {
  const isWaived = typeof row.waived_known_limit === 'string';
  const labelTag = isWaived ? ' [WAIVED]' : '';
  const inputPreview = row.input.length > 40 ? `${row.input.slice(0, 40)}…` : row.input;

  test(`eval ${row.id}${labelTag}: "${inputPreview}" → ${row.expected}`, async (t) => {
    const result = await evaluateQuestion(row.input, row.context);

    if (isWaived) {
      // Documented-limit row: log outcome but do not fail CI (D-15 default
      // mode). Bracketing (Plan 03) is the safety net.
      if (result.label !== row.expected) {
        t.diagnostic(
          `[WAIVED] ${row.id}: expected ${row.expected}, got ${result.label}. ` +
            `Known limit: ${row.waived_known_limit}`,
        );
      }
      return;
    }

    assert.equal(
      result.label,
      row.expected,
      `${row.id} (${row.rationale}) — got ${result.label}, expected ${row.expected}. ` +
        `bestMatch=${JSON.stringify(result.bestMatch)}`,
    );
  });
}
