// Phase 51 Nyquist validation: PostDetailScreen concept navigation.
//
// Source-reading tests match the screen-test pattern already used for
// heavyweight React screens in this repo. The behavior under guard is the
// Phase 51 contract: post-level concept chips and connection pills resolve
// Q&A nodes to anchors, then route to /anchor/:id only when resolution works.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_DETAIL_PATH = resolve(__dirname, '../../src/screens/PostDetailScreen.tsx');
const source = readFileSync(POST_DETAIL_PATH, 'utf-8');

describe('PostDetailScreen concept chip navigation (Phase 51)', () => {
  it('uses the shared resolveAnchorId helper for concept navigation targets', () => {
    assert.match(
      source,
      /import\s+\{\s*resolveAnchorId\s*\}\s+from\s+['"]\.\.\/lib\/anchor-resolution['"]/,
      'PostDetailScreen.tsx must import resolveAnchorId from ../lib/anchor-resolution.',
    );
  });

  it('resolves the post concept chip from sourceQuestionIds with a title fallback', () => {
    assert.match(
      source,
      /for\s*\(const\s+qId\s+of\s+post\.sourceQuestionIds\s*\?\?\s*\[\]\)\s*\{[\s\S]{0,180}resolveAnchorId\(qId\)[\s\S]{0,220}strictId\s*=\s*r/,
      'PostDetailScreen.tsx must walk post.sourceQuestionIds through resolveAnchorId before enabling the concept chip.',
    );
    assert.match(
      source,
      /fallbackTitle[\s\S]{0,400}allQ\.find\(q\s*=>[\s\S]{0,220}q\.isAnchorNode[\s\S]{0,420}strictId\s*=\s*matched\?\.id\s*\?\?\s*null/,
      'PostDetailScreen.tsx must fall back to matching an anchor title/content when sourceQuestionIds cannot resolve.',
    );
    assert.match(
      source,
      /setChipAnchorId\(strictId\)/,
      'PostDetailScreen.tsx must store only the strict resolved anchor id for chip navigation.',
    );
  });

  it('routes concept chip taps to /anchor/:id with the mobile-safe pointer pattern', () => {
    assert.match(
      source,
      /const\s+fireAnchorChipTap\s*=\s*useCallback\(\(anchorId:\s*string\)\s*=>\s*\{[\s\S]{0,500}document\.addEventListener\(['"]click['"],\s*swallowClick,\s*\{\s*capture:\s*true,\s*once:\s*true\s*\}\)[\s\S]{0,260}navigate\(`\/anchor\/\$\{anchorId\}`\)/,
      'PostDetailScreen.tsx must route concept-chip activation to /anchor/:id and swallow the synthesized click.',
    );
    assert.match(
      source,
      /chipAnchorId\s*\?\s*\([\s\S]{0,500}role=['"]button['"][\s\S]{0,240}data-no-swipe-nav=['"]true['"][\s\S]{0,240}onPointerUp=\{\(e\)\s*=>\s*\{[\s\S]{0,120}e\.stopPropagation\(\)[\s\S]{0,120}fireAnchorChipTap\(chipAnchorId\)/,
      'PostDetailScreen.tsx must render the resolved concept chip as a pointer-safe button-like control.',
    );
  });

  it('supports keyboard activation for the concept chip', () => {
    assert.match(
      source,
      /onKeyDown=\{\(e\)\s*=>\s*\{[\s\S]{0,160}e\.key\s*===\s*['"]Enter['"][\s\S]{0,120}e\.key\s*===\s*['"] ['"][\s\S]{0,180}fireAnchorChipTap\(chipAnchorId\)/,
      'PostDetailScreen.tsx concept chip must support Enter and Space activation.',
    );
  });

  it('keeps unresolved concept labels static instead of routing to a Q&A leaf', () => {
    assert.match(
      source,
      /chipAnchorId\s*\?\s*\([\s\S]*?\)\s*:\s*\([\s\S]{0,180}<span[\s\S]{0,500}\{resolvedAnchorName\}[\s\S]{0,180}<\/span>/,
      'PostDetailScreen.tsx must render a static span when the concept chip cannot resolve to an anchor.',
    );
  });
});

describe('PostDetailScreen connection pill navigation (Phase 51)', () => {
  it('resolves both connection concepts through resolveAnchorId', () => {
    assert.match(
      source,
      /const\s+connectionAnchorIds\s*=\s*useMemo<\[string\s*\|\s*null,\s*string\s*\|\s*null\]>\(\(\)\s*=>\s*\{[\s\S]{0,220}resolveAnchorId\(connectionMeta\.questionA\.id\)[\s\S]{0,120}resolveAnchorId\(connectionMeta\.questionB\.id\)/,
      'PostDetailScreen.tsx must resolve both connection Q&A ids through resolveAnchorId.',
    );
  });

  it('turns resolved connection pills into /anchor/:id links', () => {
    assert.match(
      source,
      /const\s+anchorId\s*=\s*connectionAnchorIds\[i\][\s\S]{0,650}role=\{anchorId\s*\?\s*['"]button['"]\s*:\s*undefined\}[\s\S]{0,180}tabIndex=\{anchorId\s*\?\s*0\s*:\s*undefined\}[\s\S]{0,220}onClick=\{anchorId\s*\?\s*\(\)\s*=>\s*navigate\(`\/anchor\/\$\{anchorId\}`\)\s*:\s*undefined\}/,
      'PostDetailScreen.tsx connection pills must be clickable only when an anchor id resolves.',
    );
  });

  it('supports keyboard navigation for resolved connection pills', () => {
    assert.match(
      source,
      /onKeyDown=\{anchorId\s*\?\s*\(e\)\s*=>\s*\{[\s\S]{0,170}e\.key\s*===\s*['"]Enter['"][\s\S]{0,120}e\.key\s*===\s*['"] ['"][\s\S]{0,180}navigate\(`\/anchor\/\$\{anchorId\}`\)/,
      'PostDetailScreen.tsx connection pills must support Enter and Space navigation.',
    );
  });
});
