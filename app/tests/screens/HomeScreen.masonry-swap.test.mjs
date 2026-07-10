// Phase 42 MASONRY-01 + MASONRY-02 (Plan 42-02) source-reading guard:
// asserts that HomeScreen.tsx wires <MasonryFeed> instead of <InlineInfoFlow>
// at the feed slot and deletes the noMorePosts toast (D-11).
//
// Source-reading test (no React render harness needed) — same pattern as
// app/tests/screens/HomeScreen.warm-start-guard.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_SCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_SCREEN_PATH, 'utf-8');

describe('HomeScreen MasonryFeed swap (Phase 42 Plan 42-02)', () => {
  it('does NOT import InlineInfoFlow anymore', () => {
    // The InlineInfoFlow named import must be removed from any import statement
    // sourced from '../components/InfoFlow'. Type-only `InfoFlowItem` import stays.
    const importLine = /import\s*\{[^}]*\bInlineInfoFlow\b[^}]*\}\s*from\s*['"][^'"]*InfoFlow['"]/;
    assert.ok(
      !importLine.test(source),
      'HomeScreen.tsx must NOT import `InlineInfoFlow` from ../components/InfoFlow. Plan 42-02 swaps the feed slot to <MasonryFeed>; InlineInfoFlow remains EXPORTED from InfoFlow.tsx (D-01) but is no longer wired at /home.',
    );
  });

  it('imports MasonryFeed from ../components/MasonryFeed', () => {
    const importLine = /import\s*\{[^}]*\bMasonryFeed\b[^}]*\}\s*from\s*['"]\.\.\/components\/MasonryFeed['"]/;
    assert.ok(
      importLine.test(source),
      'HomeScreen.tsx must import `MasonryFeed` from ../components/MasonryFeed (per plan 42-02 EDIT 1).',
    );
  });

  it('preserves the type-only InfoFlowItem import (still needed for infoFlowItems typing)', () => {
    assert.ok(
      /\btype\s+InfoFlowItem\b/.test(source),
      'HomeScreen.tsx must still import `type InfoFlowItem` from ../components/InfoFlow — the infoFlowItems useMemo declares its return type as InfoFlowItem[].',
    );
  });

  it('does NOT use <InlineInfoFlow ... /> in JSX', () => {
    assert.ok(
      !source.includes('<InlineInfoFlow'),
      'HomeScreen.tsx must not render <InlineInfoFlow>. Plan 42-02 swaps the JSX site to <MasonryFeed>.',
    );
  });

  it('renders <MasonryFeed ... /> in JSX', () => {
    assert.ok(
      source.includes('<MasonryFeed'),
      'HomeScreen.tsx must render <MasonryFeed> at the feed slot (plan 42-02 EDIT 4).',
    );
  });

  it('deletes the noMorePosts toast call (D-11)', () => {
    // The literal `home.toast.noMorePosts` translation key must NOT appear.
    assert.ok(
      !source.includes('home.toast.noMorePosts'),
      'HomeScreen.tsx must NOT call `toast(t(\'home.toast.noMorePosts\'), \'info\')` anymore (D-11). The vine-bloom celebration card (plan 42-04) replaces this surface.',
    );
    assert.ok(
      !source.includes('noMorePosts'),
      'HomeScreen.tsx must NOT contain any `noMorePosts` reference at all — the toast deletion must be complete.',
    );
  });

});
