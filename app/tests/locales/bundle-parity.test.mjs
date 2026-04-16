import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(resolve(here, '../../src/locales', f), 'utf8'));

function flatten(o, p = '') {
  return Object.entries(o).flatMap(([k, v]) => {
    const path = p ? `${p}.${k}` : k;
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? flatten(v, path) : [path];
  });
}

test('en/zh/es/ja bundles have identical flattened key sets', () => {
  const en = new Set(flatten(read('en.json')));
  for (const locale of ['zh', 'es', 'ja']) {
    const b = new Set(flatten(read(`${locale}.json`)));
    const missing = [...en].filter((k) => !b.has(k));
    const extra = [...b].filter((k) => !en.has(k));
    assert.deepEqual(missing, [], `${locale}.json missing keys: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `${locale}.json has extra keys not in en.json: ${extra.join(', ')}`);
  }
});

// ── Phase 28 D-14 — graph.headerTitle value parity per locale ──────────────
//
// Value-level assertion on the renamed Mind Map → Knowledge Graph key.
// Starts RED before Task 3 swaps the values; flips GREEN once the 4 locale
// bundles carry the locked UI-SPEC Copywriting Contract strings.

test('graph.headerTitle values match expected per locale (D-14)', () => {
  const expected = {
    en: 'Knowledge Graph',
    zh: '知识图谱',
    es: 'Grafo de conocimiento',
    ja: 'ナレッジグラフ',
  };
  for (const [locale, expectedValue] of Object.entries(expected)) {
    const bundle = read(`${locale}.json`);
    const actual = bundle?.graph?.headerTitle;
    assert.equal(
      actual,
      expectedValue,
      `${locale}.graph.headerTitle should be "${expectedValue}" but was "${actual}"`,
    );
  }
});
