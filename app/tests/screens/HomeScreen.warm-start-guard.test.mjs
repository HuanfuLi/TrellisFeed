// Phase 36 GAP-A regression guard: ensures HomeScreen.tsx preserves warm-start posts
// on a new-day cold start instead of unconditionally overwriting them with [].
// See .planning/debug/cold-start-empty-feed.md for the full diagnosis.
//
// Source-reading test (no React render harness needed) — same pattern as
// app/tests/components/ChatInput.flex-shrink.test.mjs (CLAUDE.md ChatInput rule).
//
// Pattern note: the fix uses a useRef-snapshot pattern (NOT a functional updater)
// for Strict Mode purity. React.StrictMode double-invokes state updater functions
// in dev, so calling setGenerationError(true) inside a setDailyPosts((prev) => ...)
// updater would fire the side-effect twice. useRef captures warm-start presence
// once at mount; the .then handler reads it directly — pure top-level setters.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_SCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_SCREEN_PATH, 'utf-8');

describe('HomeScreen warm-start guard (Phase 36 GAP-A)', () => {
  it('declares warmStartHadPostsRef snapshot to capture warm-start presence at mount', () => {
    assert.ok(
      source.includes('warmStartHadPostsRef'),
      'HomeScreen.tsx must declare a `warmStartHadPostsRef` useRef so the .then handler can read warm-start presence without violating React updater purity. See .planning/debug/cold-start-empty-feed.md.',
    );
    assert.ok(
      source.includes('useRef(dailyPosts.length > 0)'),
      'warmStartHadPostsRef must be initialized from `dailyPosts.length > 0` to snapshot warm-start presence at mount, BEFORE the async getDailyPosts call resolves.',
    );
  });

  it('only fires generationError when ref says no warm-start was seeded', () => {
    assert.ok(
      source.includes('!warmStartHadPostsRef.current'),
      'HomeScreen.tsx must gate setGenerationError(true) on `!warmStartHadPostsRef.current` — otherwise the misleading "Check your API keys" toast fires every new-day cold start when warm-start posts are showing. The original 6cda914e error-gate intent (genuinely broken API keys) is preserved by the no-warm-start case.',
    );
  });

  it('does NOT contain an unconditional setDailyPosts(posts) at top level (must be guarded by if posts.length > 0)', () => {
    // The fixed code wraps the posts setter in `if (posts.length > 0) { setDailyPosts(posts); }`.
    // Assert that the file contains the guarding conditional. (We do NOT assert absence of the
    // bare line because the conditional form `if (posts.length > 0) { setDailyPosts(posts); }`
    // contains `setDailyPosts(posts);` on its own indented line — that's correct.)
    assert.ok(
      source.includes('if (posts.length > 0)'),
      'HomeScreen.tsx must guard the posts setter with `if (posts.length > 0)` — the GAP-A bug was the unconditional `setDailyPosts(posts);` overwriting warm-start. The guard MUST be present.',
    );
  });

  it('uses pure top-level setters (no nested setState inside another updater)', () => {
    // Negative assertion: the .then handler should NOT contain a setState callback
    // that calls another setState. We check for the specific anti-pattern where
    // setGenerationError or any setter appears inside a `setDailyPosts((prev) => ...)`
    // updater function body.
    const nestedPattern = /setDailyPosts\(\s*\(\s*prev[\s\S]{0,200}?setGenerationError/;
    assert.ok(
      !nestedPattern.test(source),
      'HomeScreen.tsx must NOT call setGenerationError inside a setDailyPosts((prev) => ...) updater. React updater functions must be pure (Strict Mode double-invokes them in dev). Use the warmStartHadPostsRef pattern for top-level setters instead.',
    );
  });
});
