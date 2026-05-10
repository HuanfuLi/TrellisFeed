// Phase 42 UAT-11 round 2 (2026-05-10) — FeedPostImage must NOT apply its own
// borderRadius. Operator instruction:
//   "we should not add this corner crop for images in post faces, just let
//    the post face container crop it like the way thumbnail in video post
//    is cropped"
//
// The parent ConceptCard owns the corner shape (`overflow: hidden` +
// `borderRadius: 8px` after Phase 42 UAT-1A chrome tightening). Same
// pattern as the video thumbnail wrapper.
//
// Round 1 (`dec6241c`) tried `replace_all: true` on the borderRadius line
// but only caught one of two AspectBox branches. The aspectPadding branch
// (used by `<FeedPostImage aspectPadding="100%" />` for image posts) still
// had `borderRadius: 'var(--radius-xl)'` — operator's round-2 retest showed
// the round-corner mismatch was unresolved. This test locks BOTH branches.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FPI_PATH = resolve(__dirname, '../../src/components/FeedPostImage.tsx');
const source = readFileSync(FPI_PATH, 'utf-8');

describe('FeedPostImage no-self-radius (Phase 42 UAT-11)', () => {
  it('does NOT contain any borderRadius declaration', () => {
    assert.ok(
      !/borderRadius:/.test(source),
      'FeedPostImage.tsx must NOT contain any `borderRadius:` declaration. ' +
      'The parent ConceptCard owns the card corner shape (overflow: hidden + ' +
      'borderRadius: 8px). A self-applied radius double-rounds inside the card\'s ' +
      'tighter 8px corner and shows visible card-background gradient between the ' +
      'two curves (operator screenshot 2026-05-10 round 2 retest).',
    );
  });

  it('keeps overflow: hidden on both AspectBox branches (defense-in-depth clipping)', () => {
    const matches = source.match(/overflow:\s*['"]hidden['"]/g) || [];
    assert.ok(
      matches.length >= 2,
      `FeedPostImage.tsx must keep \`overflow: hidden\` on BOTH AspectBox branches ` +
      `(aspectPadding + minHeight). Found ${matches.length} occurrence(s). Even though ` +
      `the parent card clips visually, the local overflow: hidden prevents the absolute-` +
      `positioned <img> from escaping its layout box during measurement.`,
    );
  });
});
