/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20): `hasImageGenKey` in
 * concept-feed.service.ts must be true when EITHER `nanoBananaApiKey` OR
 * `geminiApiKey` is configured. Previously only `nanoBananaApiKey` counted,
 * so users who configured only a Gemini image key got zero image posts
 * (assignStyles redistributed all image weight to text-art).
 *
 * The image-gen bootstrap treats both keys as sufficient — the concept-feed
 * availability check had drifted and this test pins them back in sync.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/concept-feed.service.ts', import.meta.url),
  'utf-8',
);

describe('concept-feed.service hasImageGenKey gate', () => {
  it('refillQueue availability honors geminiApiKey (not just nanoBananaApiKey)', () => {
    // Locate the refillQueue availability check block.
    const refillIdx = source.indexOf('export async function refillQueue');
    assert.ok(refillIdx !== -1, 'concept-feed.service.ts should contain refillQueue');

    // Search forward for the first hasImageGenKey assignment after refillQueue start.
    const window = source.slice(refillIdx, refillIdx + 6000);
    assert.ok(
      /geminiImageKeyPresent|geminiApiKey/.test(window),
      'refillQueue availability block must reference the gemini image key so assignStyles sees hasImageGenKey: true when only gemini is configured',
    );
    // After the 2026-04-21 enabled-toggle alignment, the RHS now has
    // `imageGenEnabled && (…||…)`. Accept either form (bare OR / enabled-gated).
    assert.ok(
      /hasImageGenKey:\s*(?:[^,\n]*imageGenEnabled[^,\n]*&&[^,\n]*)?(?:nanoBananaKeyPresent\s*\|\|\s*geminiImageKeyPresent|[^,\n]*nanoBananaApiKey[^,\n]*\|\|[^,\n]*geminiApiKey)/.test(window),
      'refillQueue availability must set hasImageGenKey = (enabled &&) nanoBanana OR gemini',
    );
  });

  it('session-post availability also honors geminiApiKey', () => {
    // The session-post path (around line 1560) also constructs an ApiAvailability.
    // Both key paths must check both keys — otherwise session posts regress.
    const sessionIdx = source.indexOf('sessionAssignments');
    assert.ok(sessionIdx !== -1, 'concept-feed.service.ts should contain sessionAssignments');

    // Walk backwards to find the nearest hasImageGenKey line. The 2026-04-21
    // edit wrapped the key check with an `enabled !== false` gate, so the
    // geminiApiKey reference may now be on a continuation line — widen the
    // window slightly so the regex sees the full assignment.
    const preSession = source.slice(Math.max(0, sessionIdx - 1200), sessionIdx);
    assert.ok(
      /hasImageGenKey[\s\S]*?geminiApiKey/.test(preSession),
      'session-post availability must include geminiApiKey in the hasImageGenKey check',
    );
  });
});
