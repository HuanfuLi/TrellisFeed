// Provider chokepoint + prompt-call-site privacy structural assertion.
//
// Engagement state (likes/saves/dismissals) is a local study signal and must
// not be interpolated into outbound LLM payloads. This is a source-read guard:
// it never imports app modules, it only checks that provider chokepoints and
// prompt-building services do not read engagement state except for the feed's
// dismissed-anchor ID filter.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(resolve(here, '../../src', rel), 'utf-8');
}

const CHOKEPOINTS = [
  'providers/llm/index.ts',
  'providers/llm/locale-directive.ts',
  'providers/llm/user-content-bracketing.ts',
];

const PROMPT_CALL_SITES = [
  'state/useQuestions.ts',
  'services/post-essay.service.ts',
  'services/post-context-qa.service.ts',
  'services/canonical-knowledge.service.ts',
];

describe('PRIVACY-01 — provider chokepoints do not import engagement state', () => {
  for (const rel of CHOKEPOINTS) {
    it(`${rel} does NOT import engagement.service`, () => {
      const src = readSrc(rel);
      assert.ok(
        !/engagement\.service/.test(src),
        `${rel} must not import engagement.service; provider chokepoints must not see local study signals.`,
      );
    });
  }
});

describe('PRIVACY-01 — prompt call-sites do not read engagement state', () => {
  for (const rel of PROMPT_CALL_SITES) {
    it(`${rel} does NOT read engagement.service`, () => {
      const src = readSrc(rel);
      assert.ok(
        !/engagement\.service/.test(src),
        `${rel} must not read engagement.service; saved/liked/dismissed data must not reach prompts.`,
      );
    });
  }

  it('concept-feed.service.ts uses only dismissed-anchor IDs, not liked/saved content', () => {
    const src = readSrc('services/concept-feed.service.ts');
    assert.ok(
      /getDismissedAnchorIds/.test(src),
      'concept-feed.service.ts may use dismissed anchor IDs to filter feed candidates.',
    );
    assert.ok(
      !/getLikedPosts|getSavedPosts|likedPosts|savedPosts/.test(src),
      'concept-feed.service.ts must not read liked/saved post content for prompt construction.',
    );
  });
});
