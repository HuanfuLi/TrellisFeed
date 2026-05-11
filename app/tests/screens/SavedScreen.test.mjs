// Phase 43 plan 43-04 — source-reading invariants for SavedScreen (SV-01..SV-04).
//
// Filled in from the Wave-0 scaffold (Plan 43-01) per the established
// Phase 39/40/41/42/43 anti-wire / structural-invariant test discipline:
// no React rendering — pure source-reading assertions against the live code
// path. Forbidden patterns are negative-grepped; required patterns are
// positive-grepped with counterweight presence checks.
//
// Reference: CONTEXT.md SV-01..SV-04, UI-SPEC §6 /saved screen layout,
// app/src/screens/PostHistoryScreen.tsx (verbatim row layout source).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

test('SV-01: /saved route registered in App.tsx with PageTransition wrapper', () => {
  const app = readSrc('src/App.tsx');
  assert.match(app, /import SavedScreen/, 'default import for SavedScreen present');
  assert.match(app, /path:\s*['"]saved['"]/, "router child path: 'saved' present");
  assert.match(app, /<SavedScreen\s*\/>/, '<SavedScreen /> rendered in router child element');
  assert.match(
    app,
    /<PageTransition>\s*<SavedScreen/,
    'SavedScreen wrapped in PageTransition (matches existing sub-screen pattern)',
  );
});

test('SV-03/04: SavedScreen exports default + reads saved/liked from engagementService', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /export default function SavedScreen/, 'default export present');
  assert.match(
    src,
    /engagementService\.getSavedPosts\(\)/,
    'Saved tab data source: engagementService.getSavedPosts()',
  );
  assert.match(
    src,
    /engagementService\.getLikedPosts\(\)/,
    'Liked tab data source: engagementService.getLikedPosts()',
  );
});

test("SV-04: tabs use local useState (not route param) + 4 empty-state i18n keys", () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /useState<['"]?(Tab|saved\s*\|\s*liked)['"]?>/,
    'Tab state via useState<Tab> or equivalent local component state',
  );
  assert.match(src, /saved\.tabs\.saved/, 'i18n key saved.tabs.saved referenced');
  assert.match(src, /saved\.tabs\.liked/, 'i18n key saved.tabs.liked referenced');
  assert.match(src, /saved\.empty\.savedTitle/, 'i18n key saved.empty.savedTitle referenced');
  assert.match(src, /saved\.empty\.likedTitle/, 'i18n key saved.empty.likedTitle referenced');
  assert.match(src, /saved\.empty\.savedBody/, 'i18n key saved.empty.savedBody referenced');
  assert.match(src, /saved\.empty\.likedBody/, 'i18n key saved.empty.likedBody referenced');
});

test('SV: ENGAGEMENT_CHANGED subscription for in-place re-sync', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /eventBus\.subscribe\(['"]ENGAGEMENT_CHANGED['"]/,
    'subscribes to ENGAGEMENT_CHANGED on the event bus',
  );
  // Cleanup: either `return unsub` (direct return of the subscribe disposer)
  // or an explicit arrow `return () => ...`. Both are acceptable per Pitfall 7.
  assert.match(
    src,
    /return unsub|return\s*\(\)\s*=>/,
    'useEffect returns a cleanup function (unsubscribes on unmount)',
  );
});

test('SV: Header uses backTo="/home" (sub-screen portal pattern; Phase 32.1)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /<Header\s+backTo=["']\/home["']/,
    'Header passes backTo="/home" — portals to body since outside SwipeTabContext',
  );
});

test('Phase 32.1 invariant: no transform / will-change / filter / perspective on Header ancestors', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.strictEqual(
    (src.match(/transform:\s*translateZ/g) || []).length,
    0,
    'No translateZ — would create a containing block and re-introduce Phase 32.1 flicker class',
  );
  assert.strictEqual(
    (src.match(/will-change:|willChange:/g) || []).length,
    0,
    'No will-change — same containing-block hazard as transform',
  );
  assert.strictEqual(
    (src.match(/perspective:|perspective\s*:/g) || []).length,
    0,
    'No perspective — same containing-block hazard',
  );
  // Note: `filter:` is exempted because lucide-react drop-shadow filters live
  // inside leaf-icon nodes (not Header ancestors); CONTEXT.md UI-SPEC §2 also
  // permits filter: drop-shadow on the corner-icon overlay scope.
});

test('SV: row tap navigates to /posts/:id', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /navigate\(`\/posts\/\$\{post\.id\}`\)|navigate\(\s*['"`]\/posts\//,
    'list row onOpen navigates to /posts/:id',
  );
});
