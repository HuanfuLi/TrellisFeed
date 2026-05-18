// Phase 50 Plan 50-06 — HighlightedText component source-reading tests.
//
// HighlightedText is a UI-pure primitive that wraps Fuse.js match indices
// in <mark> JSX nodes. Threat T-50-XSS-HL: every assertion below is a
// negative invariant against `dangerouslySetInnerHTML` so matched runs are
// always React-escaped text nodes, never an HTML-string splice.
//
// Source-reading pattern (no DOM render) — same shape as
// `tests/components/LongPressMenu.test.mjs`. The canonical path is
// `src/components/ui/HighlightedText.tsx` (matches plan 50-09's import:
// `import HighlightedText from '../components/ui/HighlightedText'`).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const SRC_REL = 'src/components/ui/HighlightedText.tsx';

function readSrc() {
  return readFileSync(path.join(appRoot, SRC_REL), 'utf8');
}

test('HL-01: HighlightedText file exists and exports a default React component', () => {
  const src = readSrc();
  // Accept either `export default function HighlightedText` or
  // `export default HighlightedText` (declared separately).
  assert.match(
    src,
    /export\s+default\s+(function\s+HighlightedText|HighlightedText)/,
    'HighlightedText must be the default export',
  );
});

test('HL-02: HighlightedText wraps matched runs in <mark> JSX (NOT dangerouslySetInnerHTML)', () => {
  const src = readSrc();
  assert.match(src, /<mark[\s>]/, 'Matched runs must wrap text in a <mark> JSX element');
});

test('HL-XSS: NO dangerouslySetInnerHTML anywhere (T-50-XSS-HL mitigation)', () => {
  const src = readSrc();
  const dangerCount = (src.match(/dangerouslySetInnerHTML/g) || []).length;
  assert.strictEqual(
    dangerCount,
    0,
    `T-50-XSS-HL: HighlightedText must not use dangerouslySetInnerHTML; found ${dangerCount}.`,
  );
});

test('HL-03: HighlightedText splits by numeric indices via slice/substring (offset-based)', () => {
  const src = readSrc();
  // A pure string-replace approach would be a smell because user-provided
  // query text could collide with HTML-like substrings if naively spliced.
  // Require the source to use `.slice(` or `.substring(` to split text.
  assert.match(
    src,
    /\.slice\(|substring\(/,
    'HighlightedText must split source text by numeric indices via slice/substring',
  );
});

test('HL-04: <mark> inline style references --primary-40 background and #fff text', () => {
  const src = readSrc();
  // The component MUST style the <mark> element via inline styles with CSS
  // variables (project convention — NOT Tailwind classes). UI-SPEC Surface 7
  // pins background to var(--primary-40) and color to #fff for contrast.
  assert.match(src, /var\(--primary-40\)/, '<mark> background must use var(--primary-40)');
  assert.match(src, /['"]#fff['"]|['"]#FFF['"]/, '<mark> text color must be #fff');
});

test('HL-05: empty/undefined indices → text renders as plain fragment (no <mark>)', () => {
  const src = readSrc();
  // The component MUST early-return a plain text fragment when there are no
  // matches. Either an explicit length-zero check or an `!indices` truthy
  // check qualifies; the production implementation pairs both.
  assert.match(
    src,
    /indices(\.length\s*===?\s*0|\?\s*\.\s*length|\s*\|\|\s*indices\.length\s*===?\s*0|\.length\s*<\s*1)|!indices/,
    'Must early-return for empty/undefined indices',
  );
});

test('HL-06: HighlightedText is pure UI — imports NO services', () => {
  const src = readSrc();
  // Pure UI primitive: must not pull engagementService / collectionService /
  // postHistoryService / questionService / dailyRead.service / any provider.
  // Importing a service from a pure highlight component is a smell.
  assert.doesNotMatch(
    src,
    /from\s+['"][^'"]*services\/[^'"]+['"]/,
    'HighlightedText must not import any service module',
  );
  assert.doesNotMatch(
    src,
    /from\s+['"][^'"]*providers\/[^'"]+['"]/,
    'HighlightedText must not import any provider module',
  );
});
