// Phase 41 Plan 41-02 — Markdown.tsx citation overrides source-reading assertions.
//
// Covers SC-5(b) (Markdown.tsx has components={{ sup, a, section }} overrides) and
// SC-5(c) (sanitize schema attributes.sup spreads defaultSchema — RESEARCH Pitfall 4
// regression guard).
//
// Strategy: source-reading per VALIDATION.md (no jsdom in test env; visual rendering
// deferred to operator UAT). Counterweight verifies existing tagNames sup + dataCite +
// span/div spread preserved.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../../src/components/Markdown.tsx', import.meta.url), 'utf8');

// ─── SC-5(b) ────────────────────────────────────────────────────────────────

test('SC-5(b): Markdown.tsx imports Components type from react-markdown', () => {
  assert.match(SRC, /import ReactMarkdown,\s*\{\s*type Components\s*\}\s*from 'react-markdown'/);
});

test('SC-5(b): Markdown.tsx defines components object with sup, a, section keys', () => {
  // Components: Components = { sup: ..., a: ..., section: ... }
  assert.match(SRC, /:\s*Components\s*=\s*\{/);
  // Each key as a property of the components object
  const compsBlock = SRC.slice(SRC.indexOf(': Components ='));
  assert.match(compsBlock, /sup:\s*\(/);
  assert.match(compsBlock, /a:\s*\(/);
  assert.match(compsBlock, /section:\s*\(/);
});

test('SC-5(b): ReactMarkdown JSX has components prop wired', () => {
  assert.match(SRC, /<ReactMarkdown[\s\S]*?components=\{/);
});

test('SC-5(b): footnote discriminators (data-footnote-ref / data-footnote-backref) consumed in <a> override', () => {
  assert.match(SRC, /data-footnote-ref/);
  assert.match(SRC, /data-footnote-backref/);
});

test('SC-5(b): section override discriminates by className.includes("footnotes")', () => {
  assert.match(SRC, /className\?\.includes\('footnotes'\)/);
});

// ─── SC-5(c) Pitfall 4 regression guard ─────────────────────────────────────

test("SC-5(c): sanitizeSchema attributes.sup spreads defaultSchema.attributes?.['sup']", () => {
  assert.match(
    SRC,
    /sup:\s*\[\s*\.\.\.\(defaultSchema\.attributes\?\.\['sup'\]\s*\?\?\s*\[\]\)/,
  );
});

// ─── Counterweight ──────────────────────────────────────────────────────────

test('counterweight: existing tagNames sup + dataCite + span/div spread preserved', () => {
  assert.match(SRC, /tagNames:\s*\[\.\.\.\(defaultSchema\.tagNames\s*\?\?\s*\[\]\),\s*'sup'\]/);
  assert.match(SRC, /'dataCite'/);
  assert.match(SRC, /span:\s*\[\.\.\.\(defaultSchema\.attributes\?\.\['span'\]/);
  assert.match(SRC, /div:\s*\[\.\.\.\(defaultSchema\.attributes\?\.\['div'\]/);
});

test('counterweight: existing remark-gfm + remark-math + rehype-katex + rehype-raw + rehype-sanitize chain preserved', () => {
  assert.match(SRC, /remarkPlugins=\{\[remarkGfm, remarkMath\]\}/);
  assert.match(SRC, /rehypePlugins=\{\[rehypeRaw, \[rehypeSanitize, sanitizeSchema\], rehypeKatex\]\}/);
});
