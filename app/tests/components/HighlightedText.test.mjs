// Phase 50 Plan 50-02 — Wave 0 RED scaffold for HighlightedText component.
//
// Covers T-50-XSS-HL threat mitigation: matched-run substrings inside search
// hit rows must be wrapped in <mark> JSX nodes (React escapes by default) —
// NEVER spliced via dangerouslySetInnerHTML. The component
// `src/components/HighlightedText.tsx` does NOT yet exist; plan 50-06 creates
// it. Until then, readFileSync throws and every assertion fails RED.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const TURNED_GREEN_BY = 'plan 50-06 (HighlightedText implementation)';

function readSrc(rel) {
  return readFileSync(path.join(appRoot, rel), 'utf8');
}

test(`HL-01: HighlightedText file exists and exports a default React component [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/HighlightedText.tsx');
    assert.match(src, /export\s+(default\s+)?function\s+HighlightedText|export\s+default\s+HighlightedText/, 'HighlightedText must export a React component named HighlightedText');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`HL-02: HighlightedText wraps matched runs in <mark> JSX (NOT dangerouslySetInnerHTML) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/HighlightedText.tsx');
    assert.match(src, /<mark[\s>]/, 'Matched runs must wrap text in <mark> JSX element');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`HL-XSS: NO dangerouslySetInnerHTML anywhere (T-50-XSS-HL mitigation) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/HighlightedText.tsx');
    const dangerCount = (src.match(/dangerouslySetInnerHTML/g) || []).length;
    assert.strictEqual(dangerCount, 0, `T-50-XSS-HL: HighlightedText must not use dangerouslySetInnerHTML; found ${dangerCount}.`);
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`HL-03: HighlightedText splits by indices (offset-based, NOT regex.replace string splice) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/HighlightedText.tsx');
    // Heuristic: the component should consume `indices`, `matches`, or similar
    // numeric ranges and use String.slice / substring to split. A pure
    // string-replace approach would be a smell because user-provided query
    // text could collide with HTML-like substrings if naively spliced.
    assert.match(src, /\.slice\(|substring\(/, 'HighlightedText must split source text by numeric indices via slice/substring');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});
