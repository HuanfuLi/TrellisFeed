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
    // CR-01 fix: setFilterConcept(state.conceptFilterTitle) must be deferred
    // via queueMicrotask so the `[activeTab]` reset effect (which
    // unconditionally clears filterConcept) runs FIRST and does not wipe
    // the route-state value. Bare `setFilterConcept(state.conceptFilterTitle)`
    // in the same tick as `setActiveTab(...)` regresses CR-01 — the filter
    // chip vanishes on every Collections deep-link.
    assert.match(
      source,
      /queueMicrotask\(\(\)\s*=>\s*setFilterConcept\(/,
      'SavedScreen.tsx must defer setFilterConcept via queueMicrotask so the [activeTab] reset cannot wipe it (CR-01).',
    );
    // The value must still come from state.conceptFilterTitle (or a closure
    // capture of it). Reject any code path that just calls setFilterConcept
    // with a literal or null inside the deferral.
    assert.match(
      source,
      /(?:const|let)\s+pendingFilter\s*=\s*state\.conceptFilterTitle[\s\S]{0,200}queueMicrotask\(\(\)\s*=>\s*setFilterConcept\(pendingFilter\)\)/,
      'SavedScreen.tsx must capture state.conceptFilterTitle into a const and pass it to the deferred setFilterConcept call so the value survives the tab-change reset (CR-01).',
    );
  });

  it('CR-01 fix: filter VALUE survives the [activeTab] reset effect — not just that the setter was called', () => {
    // The original test ("setFilterConcept(state.conceptFilterTitle)" matched
    // anywhere) failed to catch the regression where the value was wiped by
    // the next tick's reset effect. The structural guard for the fix is:
    //   1. The [activeTab] reset effect with setFilterConcept(null) MUST
    //      still exist (it serves the user-driven tab-tap case).
    //   2. The mount effect must NOT call setFilterConcept(state.conceptFilterTitle)
    //      synchronously — it must be inside a queueMicrotask callback.
    //   3. The mount effect's queueMicrotask deferral runs AFTER React has
    //      flushed the activeTab change AND the [activeTab] reset effect, so
    //      the filterConcept value persists into the render that the user
    //      sees.
    // Together, these three guards make the regression visible at the source
    // level: any future refactor that re-introduces a synchronous
    // setFilterConcept(state.conceptFilterTitle) call will fail (1) the
    // earlier test's queueMicrotask match.
    assert.match(
      source,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?setFilterConcept\(null\)[\s\S]*?\},\s*\[activeTab\]\)/,
      'SavedScreen.tsx must keep the [activeTab] reset effect with setFilterConcept(null) (user-driven tab-tap case).',
    );
    // The mount effect (empty deps) must NOT contain a bare synchronous
    // setFilterConcept(state.conceptFilterTitle) call. Look for the
    // setFilterConcept call in the mount effect — it must appear inside a
    // queueMicrotask callback, not at the top level of the effect body.
    const mountEffectMatch = source.match(/\/\/ Phase 51-01: accept \{ conceptFilterTitle[\s\S]*?\},\s*\[\]\);/);
    assert.ok(mountEffectMatch, 'SavedScreen.tsx must keep the route-state mount effect with empty deps.');
    const mountEffect = mountEffectMatch[0];
    // The bare synchronous form is the regression. Require it to NOT match.
    assert.ok(
      !/^\s*setFilterConcept\(state\.conceptFilterTitle\)/m.test(mountEffect),
      'SavedScreen.tsx mount effect must NOT contain a synchronous setFilterConcept(state.conceptFilterTitle) — that gets wiped by the [activeTab] reset effect (CR-01).',
    );
    assert.match(
      mountEffect,
      /queueMicrotask\(\(\)\s*=>\s*setFilterConcept\(/,
      'SavedScreen.tsx mount effect must call setFilterConcept inside queueMicrotask so the value persists past the [activeTab] reset.',
    );
  });

  it('accepts every valid Tab value when openTab is supplied', () => {
    // The validation guard must list all four tabs.
    assert.match(
      source,
      /state\.openTab\s*===\s*['"]saved['"][\s\S]{0,200}state\.openTab\s*===\s*['"]liked['"][\s\S]{0,200}state\.openTab\s*===\s*['"]history['"][\s\S]{0,200}state\.openTab\s*===\s*['"]collections['"]/,
      'SavedScreen.tsx must validate state.openTab against all four Tab values.',
    );
    // CR-01 fix changed the call to setActiveTab(nextTab) where nextTab is
    // narrowed from state.openTab via a Tab-typed local. Accept either
    // shape (direct or via narrowed local) so the test stays correct under
    // the post-fix structure.
    assert.match(
      source,
      /setActiveTab\((?:state\.openTab|nextTab)\)/,
      'SavedScreen.tsx must call setActiveTab(state.openTab) or setActiveTab(nextTab) after validating.',
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
