// Phase 51-01 Task 8: SavedScreen route-state concept filter invariants.
//
// Source-reading tests. The plan's behavior contract is:
//   1. Mount with location.state = { conceptFilterTitle: 'X' } →
//      setFilterConcept('X')
//   2. Mount with { openTab: 'collections' } → setActiveTab('collections')
//   3. Empty state → no filter applied (default behavior)
//   4. Route state cleared after consumption (navigate replace with null)
//
// Full React render under node --test is heavyweight; source guards are
// the established pattern (see HomeScreen.exploredAnchors-resync). The
// invariants are about the STRUCTURE of the consume-and-clear effect,
// which is what regresses if a future refactor accidentally drops it.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAVED_PATH = resolve(__dirname, '../../src/screens/SavedScreen.tsx');
const source = readFileSync(SAVED_PATH, 'utf-8');

describe('SavedScreen — route-state concept filter consume + clear (Phase 51-01)', () => {
  it('imports useLocation from react-router-dom', () => {
    assert.match(
      source,
      /import\s+\{[^}]*useLocation[^}]*\}\s+from\s+['"]react-router-dom['"]/,
      'SavedScreen.tsx must import useLocation from react-router-dom.',
    );
  });

  it('declares `const location = useLocation()` inside the component body', () => {
    assert.match(
      source,
      /const\s+location\s*=\s*useLocation\(\)/,
      'SavedScreen.tsx must call useLocation() inside the component.',
    );
  });

  it('reads { conceptFilterTitle, openTab } from location.state and pre-applies them', () => {
    // Both fields must be referenced as the consumed shape.
    assert.match(source, /conceptFilterTitle\?\s*:\s*string/, 'SavedScreen.tsx must type-narrow conceptFilterTitle as string.');
    assert.match(source, /openTab\?\s*:\s*string/, 'SavedScreen.tsx must type-narrow openTab as string.');
    assert.match(
      source,
      /setFilterConcept\(state\.conceptFilterTitle\)/,
      'SavedScreen.tsx must call setFilterConcept(state.conceptFilterTitle) when present.',
    );
  });

  it('accepts every valid Tab value when openTab is supplied', () => {
    // The validation guard must list all four tabs.
    assert.match(
      source,
      /state\.openTab\s*===\s*['"]saved['"][\s\S]{0,200}state\.openTab\s*===\s*['"]liked['"][\s\S]{0,200}state\.openTab\s*===\s*['"]history['"][\s\S]{0,200}state\.openTab\s*===\s*['"]collections['"]/,
      'SavedScreen.tsx must validate state.openTab against all four Tab values.',
    );
    assert.match(
      source,
      /setActiveTab\(state\.openTab\)/,
      'SavedScreen.tsx must call setActiveTab(state.openTab) after validating.',
    );
  });

  it('clears the route state after consumption via navigate(replace)', () => {
    // The clear is what prevents back-navigation re-applying. Pattern:
    // navigate(location.pathname, { replace: true, state: null }).
    assert.match(
      source,
      /navigate\(location\.pathname,\s*\{\s*replace:\s*true,\s*state:\s*null\s*\}\)/,
      'SavedScreen.tsx must clear route state via navigate(location.pathname, { replace: true, state: null }).',
    );
  });

  it('the consume-and-clear effect runs ONCE on mount (empty deps)', () => {
    // The plan calls for an empty dep array — the route-state consume is a
    // one-shot per mount. Otherwise navigate(replace) would re-fire and
    // potentially loop.
    const sliceStart = source.indexOf('Phase 51-01: accept');
    const sliceEnd = source.indexOf('}, []);', sliceStart);
    assert.ok(
      sliceStart !== -1 && sliceEnd !== -1,
      'SavedScreen.tsx route-state effect must be wrapped in a useEffect(..., []) (one-shot per mount).',
    );
  });
});

describe('SavedScreen — preserved existing behavior (Phase 51-01)', () => {
  it('keeps the existing setFilterConcept(null) tab-change reset', () => {
    // When the user switches tabs, the existing UX clears the chip — that
    // reset must survive the Phase 51-01 changes.
    assert.match(
      source,
      /setFilterConcept\(null\)/,
      'SavedScreen.tsx must keep at least one setFilterConcept(null) call (tab-change reset / Clear-X handler).',
    );
  });

  it('the concept filter chip remains user-controllable (Clear handler intact)', () => {
    // Looking for onClear handlers tied to filterConcept — Phase 51-01 is
    // a thin enrichment, the chip cannot become read-only.
    assert.match(
      source,
      /onClear=\{\(\)\s*=>\s*setFilterConcept\(null\)\}/,
      'SavedScreen.tsx must keep the chip onClear handler that clears filterConcept.',
    );
  });
});
