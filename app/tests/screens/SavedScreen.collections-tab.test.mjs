// Phase 50 Plan 50-02 — Wave 0 RED scaffold for SavedScreen Collections tab.
//
// Covers RETRIEVE-02 / UI-SPEC §2 (4th tab + sticky search bar + minWidth:0
// input rule per CLAUDE.md §ChatInput). Turned GREEN by plan 50-09.
//
// SavedScreen exists today (Phase 43-04) with 3 tabs; plan 50-09 extends it
// with the 4th 'collections' tab + COLLECTIONS_CHANGED subscription. Until
// then, assertions on the source text fail RED.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const TURNED_GREEN_BY = 'plan 50-09 (SavedScreen Collections tab integration)';

const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

test(`SC-01: SavedScreen tab union includes 'collections' literal [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  // The tab type today is something like 'saved' | 'liked' | 'history'. After
  // 50-09 it must also include 'collections'.
  assert.match(src, /['"]collections['"]/, `Wave 0 RED — SavedScreen must include 'collections' tab literal (turned GREEN by ${TURNED_GREEN_BY}).`);
});

test(`SC-02: SavedScreen renders saved.tabs.collections i18n key [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /saved\.tabs\.collections/, `Wave 0 RED — SavedScreen must reference t('saved.tabs.collections') (turned GREEN by ${TURNED_GREEN_BY}).`);
});

test(`SC-03: SavedScreen subscribes to COLLECTIONS_CHANGED event [${TURNED_GREEN_BY}]`, () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /COLLECTIONS_CHANGED/, `Wave 0 RED — SavedScreen must subscribe to COLLECTIONS_CHANGED via eventBus.subscribe (turned GREEN by ${TURNED_GREEN_BY}).`);
  assert.match(src, /eventBus\.subscribe/, `Wave 0 RED — SavedScreen must use eventBus.subscribe pattern (turned GREEN by ${TURNED_GREEN_BY}).`);
});
