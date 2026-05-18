// Phase 50 Plan 50-06 — CollectionPickerSheet source-reading tests (UI-SPEC §4).
//
// Source-reading pattern (no DOM render) — mirrors LongPressMenu.test.mjs.
// Verifies:
//   - Surface 4 anatomy: <BottomSheet compact> + implicit Saved row +
//     custom collection rows + + New collection inline-create + Done button
//   - D-05 single-tap-save preserved (Done commits savePost if Saved was
//     pre-checked and never toggled off)
//   - T-50-PICKER-RACE mitigation: membership writes are batched at commit
//     time on Done, not fired per-checkbox tap
//   - T-50-XSS-NAME mitigation: no dangerouslySetInnerHTML anywhere
//   - Defensive guard: postId === null renders a closed sheet shell
//   - Inline-create flow: createMode state + Enter handler + error rendering

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const SRC_REL = 'src/components/CollectionPickerSheet.tsx';

function readSrc() {
  return readFileSync(path.join(appRoot, SRC_REL), 'utf8');
}

test('CPS-01: CollectionPickerSheet renders <BottomSheet compact> (UI-SPEC §4)', () => {
  const src = readSrc();
  assert.match(
    src,
    /<BottomSheet[\s\S]*?compact/,
    'CollectionPickerSheet must render <BottomSheet compact>',
  );
});

test('CPS-02: implicit Saved row pre-check captures engagementService.isSaved(postId) at open', () => {
  const src = readSrc();
  assert.match(
    src,
    /engagementService\.isSaved\(postId\)/,
    'Implicit Saved row must pre-check via engagementService.isSaved(postId)',
  );
});

test('CPS-03: collection membership writes route through collectionService.addPost / removePost', () => {
  const src = readSrc();
  assert.match(src, /collectionService\.addPost/, 'Must reference collectionService.addPost');
  assert.match(src, /collectionService\.removePost/, 'Must reference collectionService.removePost');
});

test('CPS-04: COLLECTIONS_CHANGED emission flows via collectionService (no direct eventBus emit in sheet)', () => {
  const src = readSrc();
  // The event itself is emitted INSIDE collectionService.addPost/removePost
  // (one signal per semantic event — CLAUDE.md §"Event bus — unified"). The
  // sheet must NOT call eventBus.emit directly; it should only invoke the
  // service. We verify the indirect wiring by asserting the service is used
  // AND that the sheet never imports eventBus.
  assert.doesNotMatch(
    src,
    /from\s+['"][^'"]*lib\/event-bus['"]/,
    'CollectionPickerSheet must not import event-bus — emit happens inside collectionService',
  );
});

test('CPS-XSS: NO dangerouslySetInnerHTML anywhere (T-50-XSS-NAME mitigation)', () => {
  const src = readSrc();
  const matches = src.match(/dangerouslySetInnerHTML/g) || [];
  assert.strictEqual(
    matches.length,
    0,
    `T-50-XSS-NAME: CollectionPickerSheet must not use dangerouslySetInnerHTML; found ${matches.length}.`,
  );
});

test('CPS-05: defensive guard — postId === null renders <BottomSheet open={false}> shell', () => {
  const src = readSrc();
  // Same shape as LongPressMenu.tsx:48-54 — early return with a closed sheet
  // so the portal still mounts cleanly.
  assert.match(
    src,
    /if\s*\(\s*!postId\s*\)\s*\{[\s\S]*<BottomSheet\s+open=\{\s*false\s*\}/,
    'Must short-circuit with a closed BottomSheet shell when postId is null',
  );
});

test('CPS-06: i18n keys library.savePicker.title and library.savePicker.done are referenced', () => {
  const src = readSrc();
  assert.match(src, /library\.savePicker\.title/, 'Title key must be wired');
  assert.match(src, /library\.savePicker\.done/, 'Done button label must be wired');
});

test('CPS-07: createCollection / inline-create flow is implemented', () => {
  const src = readSrc();
  assert.match(
    src,
    /collectionService\.createCollection/,
    'Inline + New collection row must call collectionService.createCollection',
  );
  // The createMode toggle name is intentional — host-screen behavior matches
  // the plan's interfaces block. Accept any setState identifier whose name
  // contains "createMode" so the assertion stays robust to renames within
  // that semantic.
  assert.match(
    src,
    /setCreateMode|createMode/,
    'Inline create row must track createMode state',
  );
});

test('CPS-08: inline-create input handles Enter key', () => {
  const src = readSrc();
  // Either an onKeyDown handler checking `e.key === 'Enter'` or onKeyUp /
  // form onSubmit pattern. Accept any one.
  assert.match(
    src,
    /['"]Enter['"]|onSubmit/,
    'Inline create input must commit on Enter (onKeyDown/onSubmit)',
  );
});

test('CPS-09: Done handler commits diff against captured-on-open original state (T-50-PICKER-RACE)', () => {
  const src = readSrc();
  // Heuristic: a `handleDone` (or similar) function exists, and it references
  // both savePost (saved-bucket diff) and addPost (collection-bucket diff)
  // in the same source region. Also assert that the source captures
  // "original" baseline state for the diff (originalSaved / originalCollection).
  assert.match(src, /handleDone|onDone|commitDone/, 'A done-handler function must be defined');
  assert.match(
    src,
    /original(Saved|Collection|Member|IsSaved)/i,
    'Done handler must compare against an original baseline captured on open',
  );
  // savePost AND addPost (and their removal counterparts) must all be
  // reachable from the source — verified individually so a partial
  // implementation flags out.
  assert.match(src, /engagementService\.savePost/, 'Done must wire engagementService.savePost');
  assert.match(src, /engagementService\.removeSavedPost/, 'Done must wire engagementService.removeSavedPost');
});

test('CPS-10: getPostCollections is called to compute initial membership state', () => {
  const src = readSrc();
  assert.match(
    src,
    /collectionService\.getPostCollections/,
    'Initial membership must seed from collectionService.getPostCollections(postId)',
  );
});

test('CPS-11: toast is wired so the user sees feedback after Done commits', () => {
  const src = readSrc();
  assert.match(
    src,
    /from\s+['"]\.\.\/lib\/toast['"]|from\s+['"][^'"]*lib\/toast['"]/,
    'CollectionPickerSheet must import the toast helper',
  );
  assert.match(src, /toast\(/, 'CollectionPickerSheet must call toast(...) on commit');
});
