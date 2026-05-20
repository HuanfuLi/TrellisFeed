// Phase 52-01 Task 2 — Source-reading + behavioral invariants for
// app/src/services/podcast-prompt.ts.
//
// Source-reading scaffold copied from
// app/tests/services/reorg-prompt-journal-injection.test.mjs:25-32.
//
// Asserts:
// 1. podcast-prompt.ts is a TRUE leaf module — no imports from ../locales,
//    ../lib/date, or react-i18next (the chain that breaks bundle-parity
//    under node --test).
// 2. buildPodcastPrompt assembles a system prompt with all five section
//    names (RECAP / CONNECTIONS / MISCONCEPTION / RETRIEVAL QUESTIONS /
//    NEXT ACTION) AND the coverage constraint, for every combination of
//    3 lengths × 3 styles (9 cases).
// 3. Each length's LENGTH_MAP entry surfaces the expected word-count
//    target so prompt size can be visually verified.
// 4. The user prompt half includes every concept name fed in (coverage
//    substring eval per PODCAST-04).
//
// All assertions in this file are green at end of Wave 0. The cross-plan
// invariants targeting podcast.service.ts live in podcast-options.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/podcast-prompt.ts', import.meta.url),
  'utf-8',
);

describe('podcast-prompt.ts leaf-module rule (Phase 52 i18n leaf invariant)', () => {
  it('does NOT import from ../locales/index', () => {
    assert.ok(
      !/from\s*['"]\.\.\/locales/.test(source),
      'podcast-prompt.ts must not import from ../locales — would break bundle-parity test chain under node --test',
    );
  });

  it('does NOT import from ../lib/date', () => {
    assert.ok(
      !/from\s*['"]\.\.\/lib\/date/.test(source),
      'podcast-prompt.ts must not import from ../lib/date — leaf-module rule',
    );
  });

  it('does NOT import from react-i18next', () => {
    assert.ok(
      !/from\s*['"]react-i18next/.test(source),
      'podcast-prompt.ts must not import from react-i18next — leaf-module rule',
    );
  });

  it('exports buildPodcastPrompt and computeOptionsHash', () => {
    assert.match(source, /^export function buildPodcastPrompt/m);
    assert.match(source, /^export function computeOptionsHash/m);
  });
});

describe('buildPodcastPrompt assembles five-section + coverage prompt', () => {
  const LENGTHS = ['standard', 'deep', 'extended'];
  const STYLES = ['focused', 'conversational', 'review'];
  const lines =
    '- Concept Alpha: short summary\n- Concept Beta: short summary\n- Concept Gamma: short summary';

  for (const length of LENGTHS) {
    for (const style of STYLES) {
      it(`buildPodcastPrompt(${length}, ${style}) contains all five sections + coverage constraint`, async () => {
        const { buildPodcastPrompt } = await import('../../src/services/podcast-prompt.ts');
        const { system } = buildPodcastPrompt(lines, { length, style });
        assert.match(system, /RECAP/, 'system must mention RECAP section');
        assert.match(system, /CONNECTIONS/, 'system must mention CONNECTIONS section');
        assert.match(system, /MISCONCEPTION/, 'system must mention MISCONCEPTION CHECK section');
        assert.match(system, /RETRIEVAL QUESTIONS/, 'system must mention RETRIEVAL QUESTIONS section');
        assert.match(system, /NEXT ACTION/, 'system must mention NEXT ACTION section');
        assert.match(
          system,
          /MUST mention every concept/i,
          'system must contain the coverage constraint substring',
        );
      });
    }
  }
});

describe('buildPodcastPrompt LENGTH_MAP surfaces target word counts', () => {
  const lines = '- X: y';

  it('standard contains 225 words target', async () => {
    const { buildPodcastPrompt } = await import('../../src/services/podcast-prompt.ts');
    const { system } = buildPodcastPrompt(lines, { length: 'standard', style: 'conversational' });
    assert.match(system, /225 words/);
  });

  it('deep contains 450 words target', async () => {
    const { buildPodcastPrompt } = await import('../../src/services/podcast-prompt.ts');
    const { system } = buildPodcastPrompt(lines, { length: 'deep', style: 'review' });
    assert.match(system, /450 words/);
  });

  it('extended contains 750 words target', async () => {
    const { buildPodcastPrompt } = await import('../../src/services/podcast-prompt.ts');
    const { system } = buildPodcastPrompt(lines, { length: 'extended', style: 'focused' });
    assert.match(system, /750 words/);
  });
});

describe('buildPodcastPrompt user prompt surfaces every concept (PODCAST-04 coverage)', () => {
  it('every concept name appears in the user half as a substring', async () => {
    const { buildPodcastPrompt } = await import('../../src/services/podcast-prompt.ts');
    const names = ['Concept Alpha', 'Concept Beta', 'Concept Gamma'];
    const lines = names.map((c) => `- ${c}: summary`).join('\n');
    const { user } = buildPodcastPrompt(lines, { length: 'standard', style: 'review' });
    for (const name of names) {
      assert.ok(user.includes(name), `user prompt must include "${name}"`);
    }
  });
});
