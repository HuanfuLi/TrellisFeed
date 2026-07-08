// Phase 43 plan 43-04 — source-reading invariants for SavedScreen (SV-01..SV-04).
// 2026-05-12 — consolidation: SavedScreen absorbed the standalone post-history
// surface. The legacy PostHistoryScreen.tsx + /history route were deleted; their
// row layout was preserved verbatim in the new History tab.
// Side feature (2026-05-20): the Liked tab was removed (likes are now a hidden
// recommendation signal, not a user-facing list). Tabs are now Saved | History |
// Collections, and the Saved tab also surfaces bookmarked podcasts.
//
// Filled in from the Wave-0 scaffold (Plan 43-01) per the established
// Phase 39/40/41/42/43 anti-wire / structural-invariant test discipline:
// no React rendering — pure source-reading assertions against the live code
// path. Forbidden patterns are negative-grepped; required patterns are
// positive-grepped with counterweight presence checks.

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

test('SV-03/04: SavedScreen exports default + reads saved posts + saved podcasts from engagementService', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /export default function SavedScreen/, 'default export present');
  assert.match(
    src,
    /engagementService\.getSavedPosts\(\)/,
    'Saved tab data source: engagementService.getSavedPosts()',
  );
  assert.match(
    src,
    /engagementService\.getSavedPodcastIds\(\)/,
    'Saved tab also surfaces saved podcasts via engagementService.getSavedPodcastIds()',
  );
});

test('Side feature: Liked tab removed — likes are now a hidden recommendation signal', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  // The user-facing Liked list is gone. The Tab union must not contain 'liked'
  // and the screen must not read getLikedPosts() for display.
  assert.doesNotMatch(
    src,
    /type Tab = [^\n]*'liked'/,
    "Tab union must not include 'liked' (Liked tab removed)",
  );
  assert.doesNotMatch(
    src,
    /engagementService\.getLikedPosts\(\)/,
    'SavedScreen must not read getLikedPosts() — likes are no longer displayed',
  );
});

test('Archive consolidation 2026-05-12: History tab reads postHistoryService.getPostsByDay', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /postHistoryService\.getPostsByDay\(\)/,
    'History tab data source: postHistoryService.getPostsByDay() — day-grouped Map',
  );
  assert.match(
    src,
    /saved\.tabs\.history/,
    'i18n key saved.tabs.history referenced (new third tab)',
  );
});

test("SV-04: tabs use local useState (not route param) + saved/history empty-state i18n keys", () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /useState<Tab>/,
    'Tab state via useState<Tab> (local component state, not route param)',
  );
  assert.match(src, /saved\.tabs\.saved/, 'i18n key saved.tabs.saved referenced');
  assert.match(src, /saved\.empty\.savedTitle/, 'i18n key saved.empty.savedTitle referenced');
  assert.match(src, /saved\.empty\.savedBody/, 'i18n key saved.empty.savedBody referenced');
});

test('Side feature: saved podcasts render in the Saved tab (heading + unsave wiring)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /saved\.podcastsHeading/, 'i18n key saved.podcastsHeading referenced for the podcast section');
  assert.match(
    src,
    /engagementService\.removeSavedPodcast\(/,
    'podcast row exposes an unsave affordance via removeSavedPodcast()',
  );
  assert.match(
    src,
    /navigate\(\s*['"`]\/podcast['"`]\s*\)/,
    'tapping a saved podcast navigates to /podcast',
  );
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

test('SV: Header back affordance pops history (Phase 56 navigation parity)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(
    src,
    /<Header[\s\S]*?centered[\s\S]*?left=\{[\s\S]*?onClick=\{\(\) => navigate\(-1\)\}[\s\S]*?<ArrowLeft/,
    'centered Header renders an ArrowLeft affordance that pops browser history',
  );
  assert.doesNotMatch(
    src,
    /backTo=["']\/home["']/,
    'SavedScreen must not force a named /home route when history has a real parent',
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
