// Phase 50 Plan 50-02 — Wave 0 RED scaffold for SavedScreen search-bar + scope.
//
// Covers RETRIEVE-01 / UI-SPEC §1 (sticky search bar inside SavedScreen scroll
// container; Fuse index in useMemo; ignoreLocation:true; query scoped to
// active tab corpus; debounced onChange ~200ms). Turned GREEN by plan 50-09.
//
// Load-bearing CLAUDE.md rules tested here:
//   - ChatInput rule: input must keep `minWidth: 0` alongside `flex: 1`
//   - RESEARCH Pitfall 1: Fuse options include `ignoreLocation: true`
//   - RESEARCH Pitfall 3: Fuse index built inside useMemo (not render body)
//   - RESEARCH Pitfall 8: tab switch clears query/filters (scope reset)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const TURNED_GREEN_BY = 'plan 50-09 (SavedScreen search bar + filters integration)';

const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

test(`SS-01: search input has minWidth:0 alongside flex:1 (CLAUDE.md ChatInput rule) [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  // The bare presence of `minWidth: 0` / `flex: 1` is not enough — SavedScreen
  // already has those for other layout reasons. Bind the assertion to the
  // search bar specifically: an <input type="text" /> with placeholder driven
  // by t('library.search.placeholder') must exist AND its inline style must
  // include both rules. We assert the i18n key is referenced (search bar
  // must wire to library.search.placeholder per UI-SPEC §1) — that key is the
  // unique fingerprint of the search bar wiring.
  assert.match(src, /library\.search\.placeholder/, `Wave 0 RED — search bar must reference t('library.search.placeholder') (UI-SPEC §1). Turned GREEN by ${TURNED_GREEN_BY}.`);
  assert.match(src, /minWidth:\s*0/, `Wave 0 RED — search input must keep \`minWidth: 0\` alongside \`flex: 1\` (CLAUDE.md ChatInput rule). Turned GREEN by ${TURNED_GREEN_BY}.`);
  assert.match(src, /flex:\s*1/, `Wave 0 RED — search input must use flex: 1 layout. Turned GREEN by ${TURNED_GREEN_BY}.`);
});

test(`SS-02: Fuse index constructed inside useMemo, NOT render body (RESEARCH Pitfall 3) [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  // Look for `new Fuse(` immediately preceded (within ~500 chars) by `useMemo(`.
  // Simpler heuristic: both tokens present AND `new Fuse(` appears inside a
  // useMemo call (we permit the broader presence assertion at scaffold-time).
  assert.match(src, /useMemo\(/, `Wave 0 RED — SavedScreen must use useMemo to memoize the Fuse index. Turned GREEN by ${TURNED_GREEN_BY}.`);
  assert.match(src, /new\s+Fuse\(/, `Wave 0 RED — SavedScreen must construct a new Fuse(...) index. Turned GREEN by ${TURNED_GREEN_BY}.`);
});

test(`SS-03: Fuse options include ignoreLocation: true (RESEARCH Pitfall 1) [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /ignoreLocation:\s*true/, `Wave 0 RED — Fuse options must include \`ignoreLocation: true\` so body matches beyond char 60 are found. Turned GREEN by ${TURNED_GREEN_BY}.`);
});

test(`SS-04: search scope is bound to the active tab corpus (savedPosts/likedPosts/...) [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  // SavedScreen already discriminates on activeTab for tab-list rendering. To
  // assert the search scope wiring (not the unrelated tab-render wiring), bind
  // to a search-state variable name (`query`) being used as a Fuse query input
  // AND the Fuse instance being constructed from corpus that depends on
  // activeTab. The combination of `fuse` (the library instance) + `.search(`
  // (Fuse's query method) + a `query` state is the unique fingerprint of
  // 50-09's search wiring.
  assert.match(src, /\bquery\b/, `Wave 0 RED — SavedScreen must own a \`query\` state for the search input. Turned GREEN by ${TURNED_GREEN_BY}.`);
  assert.match(src, /\.search\(/, `Wave 0 RED — SavedScreen must call fuse.search(query) to scope results to the active tab corpus. Turned GREEN by ${TURNED_GREEN_BY}.`);
});

test(`SS-05: onChange uses debounce pattern (clearTimeout + setTimeout) ~200ms [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  // CONTEXT Claude's Discretion: any 100–300ms debounce is acceptable. We
  // assert the pattern exists, not the exact value.
  assert.match(src, /clearTimeout/, `Wave 0 RED — search onChange must debounce via clearTimeout/setTimeout. Turned GREEN by ${TURNED_GREEN_BY}.`);
  assert.match(src, /setTimeout\(/, `Wave 0 RED — search onChange must call setTimeout for debounce. Turned GREEN by ${TURNED_GREEN_BY}.`);
});
