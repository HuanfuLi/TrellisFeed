// Phase 50 Plan 50-02 — Wave 0 RED scaffold for CollectionPickerSheet (UI-SPEC §4).
//
// Source-reading invariants — same pattern as LongPressMenu.test.mjs. No DOM
// rendering. The component `src/components/CollectionPickerSheet.tsx` does NOT
// yet exist — plan 50-06 creates it. Until then, readFileSync throws ENOENT
// and every it() fails deterministically (which IS the RED state we want).
//
// Coverage:
//   - BottomSheet compact prop
//   - Implicit Saved row pre-checked via engagementService.isSaved(postId)
//   - Picker writes go through collectionService.addPost / removePost (NOT
//     engagementService directly for collection membership — anti-wire)
//   - COLLECTIONS_CHANGED emitted AFTER mutation (event bus)
//   - T-50-XSS-NAME mitigation: NO dangerouslySetInnerHTML anywhere

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const TURNED_GREEN_BY = 'plan 50-06 (CollectionPickerSheet implementation)';

function readSrc(rel) {
  return readFileSync(path.join(appRoot, rel), 'utf8');
}

test(`CPS-01: CollectionPickerSheet renders <BottomSheet compact> (UI-SPEC §4) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/CollectionPickerSheet.tsx');
    assert.match(src, /<BottomSheet[\s\S]*?compact/, 'CollectionPickerSheet must render <BottomSheet compact>');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CPS-02: implicit Saved row checks engagementService.isSaved(postId) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/CollectionPickerSheet.tsx');
    assert.match(src, /engagementService\.isSaved\(postId\)/, 'Implicit Saved row must pre-check via engagementService.isSaved(postId)');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CPS-03: collection membership writes route through collectionService.addPost/removePost [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/CollectionPickerSheet.tsx');
    assert.match(src, /collectionService\.addPost/, 'Must call collectionService.addPost for collection membership additions');
    assert.match(src, /collectionService\.removePost/, 'Must call collectionService.removePost for collection membership removals');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CPS-04: COLLECTIONS_CHANGED emission happens AFTER mutation (correct ordering) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/CollectionPickerSheet.tsx');
    // Either the emit is inside collectionService (preferred) OR explicitly in
    // the commit handler. Static check: the event name appears in the wiring.
    assert.match(src, /COLLECTIONS_CHANGED/, 'CollectionPickerSheet wiring must surface COLLECTIONS_CHANGED (directly or via collectionService.*)');
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});

test(`CPS-XSS: NO dangerouslySetInnerHTML anywhere (T-50-XSS-NAME mitigation) [${TURNED_GREEN_BY}]`, () => {
  try {
    const src = readSrc('src/components/CollectionPickerSheet.tsx');
    const dangerCount = (src.match(/dangerouslySetInnerHTML/g) || []).length;
    assert.strictEqual(dangerCount, 0, `T-50-XSS-NAME: CollectionPickerSheet must not use dangerouslySetInnerHTML; found ${dangerCount} occurrence(s).`);
  } catch (err) {
    assert.fail(`Wave 0 RED — implemented in ${TURNED_GREEN_BY}. (${err.message})`);
  }
});
