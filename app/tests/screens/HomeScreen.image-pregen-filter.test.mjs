/**
 * Guards the Phase 33 WIP architecture shift (2026-04-21): image pre-generation
 * was moved from the HomeScreen swipe-load callback into
 * concept-feed.service.ts:refillQueue for cycle-aware pre-gen. This test
 * asserts the live call site (refillQueue), not the now-dead HomeScreen.tsx
 * call site.
 *
 * SEAM-12 fix (Phase 34 Plan 34-02 / 2026-04-25). Lands atomically with the
 * production move in Wave 5 Commit 2.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const feedSource = fs.readFileSync(
  new URL('../../src/services/concept-feed.service.ts', import.meta.url),
  'utf-8',
);

describe('HomeScreen image pre-gen filter (post-Phase 33 architecture, lives in concept-feed.service.ts)', () => {
  it('refillQueue in concept-feed.service.ts filters posts by presentationStyle === "image" before pre-generating', () => {
    // Find the refillQueue body.
    const fnStart = feedSource.indexOf('export async function refillQueue(');
    assert.ok(fnStart !== -1, 'concept-feed.service.ts should export refillQueue function');
    // refillQueue is ~10kB — the image-pregen block lives ~9kB into the body.
    // Slice generously so all three assertions can find their targets.
    const fnBody = feedSource.slice(fnStart, fnStart + 12000);

    // Must filter posts to image-style only and assign to an `imagePosts` binding.
    // Live shape: `const imagePosts = posts.filter((p) => p.presentationStyle === 'image');`
    assert.ok(
      /const\s+imagePosts\s*=\s*[A-Za-z_$][\w$]*\.filter\(\([^)]*\)\s*=>\s*[^.]*\.presentationStyle\s*===\s*['"]image['"]\)/.test(
        fnBody,
      ),
      'refillQueue must filter posts by presentationStyle === "image" (look for imagePosts.filter call)',
    );

    // The Promise.allSettled must operate on the filtered subset, not the raw posts.
    assert.ok(
      /Promise\.allSettled\(\s*imagePosts\.map/.test(fnBody),
      'Promise.allSettled must iterate imagePosts in refillQueue',
    );

    // And the filter must gate the generateImage block (early-out when imagePosts is empty),
    // so users with no image assignments do not even import the providers.
    assert.ok(
      /if\s*\(\s*imagePosts\.length\s*>\s*0\s*\)/.test(fnBody),
      'refillQueue must guard the generateImage block on imagePosts.length > 0',
    );
  });
});
