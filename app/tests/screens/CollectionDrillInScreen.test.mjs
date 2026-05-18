// Phase 50 Plan 50-02 — Wave 0 RED scaffold for CollectionDrillInScreen (UI-SPEC §6).
//
// Covers RETRIEVE-02 (drill-in route renders posts in a collection, supports
// rename/delete/remove-from-collection actions, navigates to /saved on
// collection deletion). Turned GREEN by plan 50-08.
//
// `src/screens/CollectionDrillInScreen.tsx` does NOT yet exist — readFileSync
// throws ENOENT until 50-08 creates it; every it() fails RED until then.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const TURNED_GREEN_BY = 'plan 50-08 (CollectionDrillInScreen implementation)';

const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

test(`CDI-01: CollectionDrillInScreen exists and exports default component [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/screens/CollectionDrillInScreen.tsx');
    assert.match(src, /export\s+default\s+function\s+CollectionDrillInScreen|export\s+default\s+CollectionDrillInScreen/, 'Must export default CollectionDrillInScreen');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CDI-02: imports Header from ui and uses backTo="/saved" [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/screens/CollectionDrillInScreen.tsx');
    assert.match(src, /from\s+['"][^'"]*components\/ui\/Header['"]/, 'Must import Header from components/ui/Header');
    assert.match(src, /backTo=['"]\/saved['"]/, 'Header must use backTo="/saved"');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CDI-03: subscribes to COLLECTIONS_CHANGED to refresh state [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/screens/CollectionDrillInScreen.tsx');
    assert.match(src, /COLLECTIONS_CHANGED/, 'Must reference COLLECTIONS_CHANGED');
    assert.match(src, /eventBus\.subscribe/, 'Must subscribe via eventBus.subscribe');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CDI-04: navigates to /saved when the open collection is deleted [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/screens/CollectionDrillInScreen.tsx');
    // Heuristic: code routes back to /saved when the deletion kind is observed.
    assert.match(src, /navigate\(['"]\/saved['"]\)/, 'Must call navigate("/saved") when open collection is deleted');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CDI-05: renders SavedRow-equivalent row layout for member posts [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/screens/CollectionDrillInScreen.tsx');
    // Heuristic: drill-in re-uses the SavedRow component (UI-SPEC §6 says
    // the drill-in list is visually identical to a SavedScreen tab list).
    assert.match(src, /SavedRow/, 'Must render SavedRow (or equivalent reused row component) for posts');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CDI-06: renders library.collections.notFound copy when route id resolves to no collection [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/screens/CollectionDrillInScreen.tsx');
    assert.match(src, /library\.collections\.notFound/, 'Must reference t("library.collections.notFound") when collection is missing (key owned by plan 50-02)');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});
