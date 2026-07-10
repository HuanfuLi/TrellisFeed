// Phase 42 plan 42-05 — HomeScreen post-cutover invariants.
//
// Locks UI-SPEC invariant #4 (D-11: noMorePosts toast deleted) and the
// plan 42-02 cutover state (InlineInfoFlow → MasonryFeed at /home).
//
// Pattern A (positive presence + negative grep on a single source file).
// Mirrors tests/components/InfoFlow.video-tap-emit.test.mjs.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOMESCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOMESCREEN_PATH, 'utf-8');

describe('HomeScreen no-more-posts toast removal (Phase 42 D-11)', () => {
  // Counterweight — confirm HomeScreen still has its main feed JSX (file is intact).
  it('contains MasonryFeed wiring (counterweight — proves test reads the right file post-cutover)', () => {
    assert.ok(
      /MasonryFeed/.test(source),
      'HomeScreen.tsx must reference MasonryFeed — plan 42-02 swapped InlineInfoFlow for MasonryFeed.',
    );
  });

  it('does NOT import or render InlineInfoFlow (plan 42-02 swapped to MasonryFeed)', () => {
    // The named import line `import { InlineInfoFlow } from '...'` must be gone.
    // The component-usage form `<InlineInfoFlow ...>` must be gone.
    // (A comment phrasing the historical fact "replaces InlineInfoFlow" is fine —
    // plan 42-02 close noted only the live import + JSX site were dropped while the
    // type InfoFlowItem import was preserved.)
    assert.ok(
      !/import\s+\{[^}]*\bInlineInfoFlow\b[^}]*\}\s+from/.test(source),
      'HomeScreen.tsx must NOT import InlineInfoFlow — plan 42-02 swapped to MasonryFeed at /home; InlineInfoFlow is de-wired (still exported from InfoFlow.tsx for future surfaces).',
    );
    assert.ok(
      !/<\s*InlineInfoFlow\b/.test(source),
      'HomeScreen.tsx must NOT render <InlineInfoFlow ...> — plan 42-02 replaced it with <MasonryFeed ...> at /home.',
    );
  });

  // UI-SPEC invariant #4 — D-11 toast removal.
  it('does NOT contain the noMorePosts toast key reference (D-11 — celebration card replaces it)', () => {
    assert.ok(
      !/home\.toast\.noMorePosts/.test(source),
      'HomeScreen.tsx must NOT reference home.toast.noMorePosts — D-11 deletes the toast call; vine-bloom celebration card replaces it.',
    );
    assert.ok(
      !/noMorePosts/.test(source),
      'HomeScreen.tsx must NOT contain `noMorePosts` substring — D-11 deletes all references.',
    );
  });

});
