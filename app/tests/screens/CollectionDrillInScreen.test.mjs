// Phase 50 Plan 50-08 — GREEN source-reading tests for CollectionDrillInScreen.
//
// Source-reading discipline (matches CollectionPickerSheet.test.mjs +
// LongPressMenu.test.mjs). The Wave 0 scaffold from 50-02 has been replaced
// per plan 50-08 §action 4 with the full GREEN contract: route registration,
// header backTo, COLLECTIONS_CHANGED wiring + navigate-on-delete, LongPress
// collectionContext prop, Rename + Delete sheet i18n keys, and Phase 32.1
// Header-portal-ancestor invariants (no transform/willChange/contain/filter
// on the outer container).
//
// These tests do NOT exercise React rendering — the worktree has no
// node_modules. The contract is enforced by reading the source files and
// matching against the locked patterns. The orchestrator's main checkout
// (with `npm install` + DOM testing-library) is the canonical location for
// runtime behavior coverage; source-reading is sufficient here because every
// load-bearing wire IS visible at the source level.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');
const screenSrc = () => readSrc('src/screens/CollectionDrillInScreen.tsx');
const appSrc = () => readSrc('src/App.tsx');

test('CDI-01: CollectionDrillInScreen file exists and exports the component', () => {
  const src = screenSrc();
  assert.match(
    src,
    /export\s+function\s+CollectionDrillInScreen\b/,
    'Must export named function CollectionDrillInScreen (matches AnchorDetailScreen analog)',
  );
});

test('CDI-02: imports Header from components/ui/Header and uses backTo="/saved"', () => {
  const src = screenSrc();
  assert.match(
    src,
    /from\s+['"][^'"]*components\/ui\/Header['"]/,
    'Must import Header from components/ui/Header',
  );
  assert.match(src, /backTo=["']\/saved["']/, 'Header must use backTo="/saved"');
});

test('CDI-03: subscribes to COLLECTIONS_CHANGED via eventBus.subscribe', () => {
  const src = screenSrc();
  assert.match(
    src,
    /eventBus\.subscribe\(\s*['"]COLLECTIONS_CHANGED['"]/,
    'Must subscribe to COLLECTIONS_CHANGED via eventBus.subscribe',
  );
});

test('CDI-04: navigates to /saved when the open collection no longer exists', () => {
  const src = screenSrc();
  // The COLLECTIONS_CHANGED handler must navigate('/saved') when the
  // collection lookup returns undefined (delete from any path).
  assert.match(
    src,
    /navigate\(['"]\/saved['"]\)/,
    'Must call navigate("/saved") when the collection is gone',
  );
});

test('CDI-05: passes collectionContext={ collectionId, collectionName } to LongPressMenu', () => {
  const src = screenSrc();
  // Match the prop name on LongPressMenu — collectionContext is the wire
  // that surfaces the Remove-from-collection row in the long-press menu.
  assert.match(
    src,
    /collectionContext=\{/,
    'Must pass collectionContext prop to LongPressMenu',
  );
  assert.match(
    src,
    /collectionId:\s*id!?/,
    'collectionContext.collectionId must come from useParams id',
  );
  assert.match(
    src,
    /collectionName:\s*collection\.name/,
    'collectionContext.collectionName must come from collection.name',
  );
});

test('CDI-06: renders library.collections.notFound copy on missing collection', () => {
  const src = screenSrc();
  assert.match(
    src,
    /library\.collections\.notFound/,
    'Must reference t("library.collections.notFound") in the not-found guard (key owned by plan 50-02)',
  );
});

test('CDI-07: renders Rename sheet i18n keys (rename + saveName)', () => {
  const src = screenSrc();
  assert.match(
    src,
    /library\.collections\.rename\b/,
    'Must reference library.collections.rename for the Rename sheet/chooser row',
  );
  assert.match(
    src,
    /library\.collections\.saveName\b/,
    'Must reference library.collections.saveName for the Rename submit button',
  );
});

test('CDI-08: renders Delete confirmation sheet i18n keys (deleteConfirm + keepCollection + delete)', () => {
  const src = screenSrc();
  assert.match(
    src,
    /library\.collections\.deleteConfirm\b/,
    'Must reference library.collections.deleteConfirm for the destructive-action heading',
  );
  assert.match(
    src,
    /library\.collections\.keepCollection\b/,
    'Must reference library.collections.keepCollection for the cancel button',
  );
  assert.match(
    src,
    /library\.collections\.delete\b/,
    'Must reference library.collections.delete for the destructive button',
  );
});

test('CDI-09: never uses the React HTML-injection escape hatch (T-50-XSS-NAME mitigation)', () => {
  const src = screenSrc();
  // Look for the actual JSX prop usage `dangerouslySetInnerHTML={...}` — the
  // assertion deliberately matches the JSX-attribute form so the comment-block
  // reminder above this test (which names the prop) does not self-trigger.
  assert.equal(
    /dangerouslySetInnerHTML\s*=\s*\{/.test(src),
    false,
    'CollectionDrillInScreen must not use the dangerouslySetInnerHTML JSX prop — collection.name renders via React text nodes only',
  );
});

test('CDI-10: no containing-block-creating INLINE styles on Header ancestors (T-50-HEADER-PORTAL invariant)', () => {
  const src = screenSrc();
  // Header portal rule (CLAUDE.md §"Header positioning" rule 1): NO
  // containing-block-creating styles on ANY ancestor of the Header.
  //
  // The assertion matches JSX inline-style values (string literals or
  // template literals — quoted right-hand side after the property colon).
  // CSS keyframe declarations like `transform: translateY(8px);` are NOT
  // matched (the keyframe applies to a descendant element during animation,
  // never to a Header ancestor; and the Header itself is portaled to
  // document.body so ancestor containing blocks are irrelevant).
  const inlineStyleProp = (prop) =>
    new RegExp(`\\b${prop}:\\s*['\`]`).test(src);

  assert.equal(
    inlineStyleProp('transform'),
    false,
    'Must not declare a "transform:" inline style on a Header ancestor (Header portal rule)',
  );
  assert.equal(
    inlineStyleProp('willChange'),
    false,
    'Must not declare a "willChange:" inline style on a Header ancestor (Header portal rule)',
  );
  assert.equal(
    inlineStyleProp('filter'),
    false,
    'Must not declare a "filter:" inline style on a Header ancestor (Header portal rule)',
  );
  assert.equal(
    inlineStyleProp('contain'),
    false,
    'Must not declare a "contain:" inline style on a Header ancestor (Header portal rule)',
  );
  assert.equal(
    inlineStyleProp('perspective'),
    false,
    'Must not declare a "perspective:" inline style on a Header ancestor (Header portal rule)',
  );
});

test('CDI-11: route /collections/:id is registered in App.tsx alongside anchor/:id and cluster/:id', () => {
  const src = appSrc();
  assert.match(
    src,
    /collections\/:id/,
    'App.tsx must register a route at collections/:id',
  );
  assert.match(
    src,
    /import\s+\{\s*CollectionDrillInScreen\s*\}\s+from\s+['"]\.\/screens\/CollectionDrillInScreen['"]/,
    'App.tsx must import CollectionDrillInScreen as a named export from the new screen file',
  );
});
