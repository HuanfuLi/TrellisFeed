// Phase 47 FILTER-03 / D-13 — TTS + Embedding bracketing exemptions.
//
// Negative-invariant source-reading tests: TTS and embedding wrappers must
// NOT import or call `applyUserContentBracketing`. The exemption rationale
// is documented in code comments at the top of each provider; this test
// asserts both the absence of the import AND the presence of the comment
// block so a future maintainer cannot silently "consistency-fix" the
// missing bracketing without explicit code review.
//
// Mirrors the negative-invariant pattern in
// app/tests/components/InfoFlow.video-tap-emit.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TTS_PATH = resolve(here, '../../src/providers/tts/index.ts');
const EMB_PATH = resolve(here, '../../src/providers/embedding/index.ts');
const ttsSource = readFileSync(TTS_PATH, 'utf-8');
const embSource = readFileSync(EMB_PATH, 'utf-8');

describe('TTS wrapper — D-13 bracketing exemption (Phase 47)', () => {
  it('does NOT import applyUserContentBracketing', () => {
    const matches = ttsSource.match(/applyUserContentBracketing/g) || [];
    assert.equal(
      matches.length,
      0,
      `providers/tts/index.ts must NOT import or call applyUserContentBracketing — TTS has no instruction-following surface and wrapping would corrupt phonetic output. Found ${matches.length} occurrence(s). See 47-RESEARCH.md §"TTS wrapper bracketing" (lines 845-851).`,
    );
  });

  it('documents the bracketing exemption in a comment', () => {
    assert.match(
      ttsSource,
      /FILTER-03|D-13/,
      'providers/tts/index.ts must contain a comment block referencing FILTER-03 or D-13 explaining the bracketing exemption — this prevents a future maintainer from "consistency-fixing" the missing bracketing.',
    );
    assert.match(
      ttsSource,
      /EXEMPT/,
      'providers/tts/index.ts must contain the word EXEMPT in the bracketing-exemption comment block so the rationale is unambiguous.',
    );
  });
});

describe('Embedding wrapper — D-13 bracketing exemption (Phase 47)', () => {
  it('does NOT import applyUserContentBracketing', () => {
    const matches = embSource.match(/applyUserContentBracketing/g) || [];
    assert.equal(
      matches.length,
      0,
      `providers/embedding/index.ts must NOT import or call applyUserContentBracketing — embedding endpoints project text to vectors and do not interpret it as instructions. Wrapping would corrupt cosine math. Found ${matches.length} occurrence(s). See 47-RESEARCH.md §"Embedding wrapper bracketing decision" (lines 853-859).`,
    );
  });

  it('documents the bracketing exemption in a comment', () => {
    assert.match(
      embSource,
      /FILTER-03|D-13/,
      'providers/embedding/index.ts must contain a comment block referencing FILTER-03 or D-13 explaining the bracketing exemption.',
    );
    assert.match(
      embSource,
      /EXEMPT/,
      'providers/embedding/index.ts must contain the word EXEMPT in the bracketing-exemption comment block so the rationale is unambiguous.',
    );
  });
});
