/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20): HomeScreen handleLoad must
 * pre-generate images only for posts whose presentationStyle is 'image'.
 *
 * Before the fix, every swipe-for-more awaited Promise.allSettled over
 * generateImage for ALL 4 new posts regardless of style. With a real
 * Gemini/NanoBanana key each call hit the provider for seconds; only the
 * image-style post used the result. The wait-then-discard was the "Loading
 * more posts" stall users observed.
 *
 * Source-reading test — cheaper than rendering HomeScreen in a DOM mock
 * and covers the regression dimension we care about (filtering by style).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/screens/HomeScreen.tsx', import.meta.url),
  'utf-8',
);

describe('HomeScreen image-pregen filter', () => {
  it('handleLoad filters newPosts by presentationStyle === "image" before awaiting generateImage', () => {
    // Find the handleLoad body.
    const fnStart = source.indexOf('const handleLoad = useCallback');
    assert.ok(fnStart !== -1, 'HomeScreen.tsx should contain handleLoad useCallback');
    const fnBody = source.slice(fnStart, fnStart + 2500);

    // Must filter to image-style posts.
    assert.ok(
      /newPosts\.filter\(\([^)]*\)\s*=>\s*[^.]*\.presentationStyle\s*===\s*['"]image['"]\)/.test(fnBody),
      'handleLoad must narrow newPosts to presentationStyle === "image" before pre-generating images',
    );

    // The Promise.allSettled must operate on the filtered subset, not the raw newPosts.
    // We assert the filtered variable name is used as the iterable.
    assert.ok(
      /Promise\.allSettled\(\s*imagePosts\.map/.test(fnBody),
      'Promise.allSettled must iterate the filtered imagePosts, not raw newPosts — otherwise the style filter is dead',
    );

    // And the filter must gate the generateImage block (early-out when imagePosts is empty),
    // so users with no image assignments do not even import the providers.
    assert.ok(
      /if\s*\(\s*imagePosts\.length\s*>\s*0\s*\)/.test(fnBody),
      'handleLoad must guard the generateImage block on imagePosts.length > 0 — no image posts means no provider call',
    );
  });
});
