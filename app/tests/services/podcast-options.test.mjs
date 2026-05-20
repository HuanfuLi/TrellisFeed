// Phase 52-01 Task 2 — Options hash determinism + cross-plan source-reading
// invariants for podcast.service.ts.
//
// Source-reading scaffold copied from
// app/tests/services/classification-dedup.test.mjs:1-32.
//
// Hash-determinism assertions (Wave 0, green now):
// - computeOptionsHash is order-independent over conceptIds.
// - It distinguishes length / style / locale / conceptIds changes.
//
// Cross-plan source-read assertions (RED until Plan 52-02 wires
// podcast.service.ts):
// - generatePodcast signature accepts an optional third PodcastOptions arg.
// - Cache-skip compares existing.optionsHash === computeOptionsHash(...).
// - podcast.service imports buildPodcastPrompt + computeOptionsHash from
//   ./podcast-prompt.
// - Read-site fallback literals 'standard' AND 'conversational' present.
//
// The four RED cases are the explicit Wave-1 work signal per the plan's
// Nyquist contract.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const podcastServiceSrc = fs.readFileSync(
  new URL('../../src/services/podcast.service.ts', import.meta.url),
  'utf-8',
);

describe('computeOptionsHash determinism (Phase 52 PODCAST-03 cache key)', () => {
  it('is deterministic across conceptId order', async () => {
    const { computeOptionsHash } = await import('../../src/services/podcast-prompt.ts');
    const h1 = computeOptionsHash(['c1', 'c2', 'c3'], 'en', {
      length: 'standard',
      style: 'conversational',
    });
    const h2 = computeOptionsHash(['c3', 'c1', 'c2'], 'en', {
      length: 'standard',
      style: 'conversational',
    });
    assert.equal(h1, h2, 'conceptIds must be sorted before hashing');
  });

  it('changes when length changes', async () => {
    const { computeOptionsHash } = await import('../../src/services/podcast-prompt.ts');
    const a = computeOptionsHash([], 'en', { length: 'standard', style: 'focused' });
    const b = computeOptionsHash([], 'en', { length: 'deep', style: 'focused' });
    assert.notEqual(a, b);
  });

  it('changes when style changes', async () => {
    const { computeOptionsHash } = await import('../../src/services/podcast-prompt.ts');
    const a = computeOptionsHash(['c1'], 'en', { length: 'standard', style: 'focused' });
    const b = computeOptionsHash(['c1'], 'en', { length: 'standard', style: 'review' });
    assert.notEqual(a, b);
  });

  it('changes when locale changes', async () => {
    const { computeOptionsHash } = await import('../../src/services/podcast-prompt.ts');
    const a = computeOptionsHash(['c1'], 'en', { length: 'standard', style: 'conversational' });
    const b = computeOptionsHash(['c1'], 'zh', { length: 'standard', style: 'conversational' });
    assert.notEqual(a, b);
  });

  it('changes when conceptIds change', async () => {
    const { computeOptionsHash } = await import('../../src/services/podcast-prompt.ts');
    const a = computeOptionsHash(['c1'], 'en', { length: 'standard', style: 'conversational' });
    const b = computeOptionsHash(['c1', 'c2'], 'en', { length: 'standard', style: 'conversational' });
    assert.notEqual(a, b);
  });
});

describe('podcast.service.ts cross-plan invariants (RED until Plan 52-02)', () => {
  // RED until Plan 52-02
  it('generatePodcast signature accepts an optional third options param', () => {
    assert.match(
      podcastServiceSrc,
      /generatePodcast\(\s*date:\s*string,\s*conceptIds\?:\s*string\[\],\s*options\?:\s*PodcastOptions/,
      'podcast.service.ts:generatePodcast must accept (date, conceptIds?, options?: PodcastOptions) — Plan 52-02 work',
    );
  });

  // RED until Plan 52-02
  it('cache-skip includes optionsHash equality check', () => {
    assert.match(
      podcastServiceSrc,
      /existing\.optionsHash\s*===\s*computeOptionsHash\(/,
      'podcast.service.ts cache-skip must compare existing.optionsHash === computeOptionsHash(...) — Plan 52-02 work',
    );
  });

  // RED until Plan 52-02
  it('imports buildPodcastPrompt + computeOptionsHash from ./podcast-prompt', () => {
    assert.match(
      podcastServiceSrc,
      /import\s*\{[^}]*buildPodcastPrompt[^}]*computeOptionsHash[^}]*\}\s*from\s*['"]\.\/podcast-prompt['"]/,
      'podcast.service.ts must import the leaf prompt module — Plan 52-02 work',
    );
  });

  // RED until Plan 52-02
  it('contains read-site fallback literals "standard" and "conversational"', () => {
    assert.match(
      podcastServiceSrc,
      /['"]standard['"]/,
      'podcast.service.ts must contain the "standard" default literal at the read-site fallback — Plan 52-02 work',
    );
    assert.match(
      podcastServiceSrc,
      /['"]conversational['"]/,
      'podcast.service.ts must contain the "conversational" default literal at the read-site fallback — Plan 52-02 work',
    );
  });
});
