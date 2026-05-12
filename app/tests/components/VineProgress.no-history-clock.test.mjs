// 2026-05-12 — Archive consolidation: the post-history affordance moved into
// SavedScreen as a third tab (Saved | Liked | History). The Clock icon button
// on the VineProgress right edge and the `onHistoryTap` callback prop were
// removed; the /history route + PostHistoryScreen.tsx were deleted in the
// same pass. The bookmark icon in the HomeScreen greeting row is the sole
// archive entry from /home.
//
// This file pins the consolidation: any future regression that re-adds either
// the Clock affordance or a duplicate /history route would fire here before
// shipping.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

test('VineProgress: no Clock import from lucide-react (icon removed)', () => {
  const src = readSrc('src/components/VineProgress.tsx');
  // Single-line import-list grep — keeps the check scoped to the import
  // statement so explanatory comments that mention the word "Clock" don't
  // false-positive.
  assert.doesNotMatch(
    src,
    /^\s*import\s*\{[^}]*\bClock\b[^}]*\}\s*from\s*['"]lucide-react['"]/m,
    'lucide-react import statement must not contain Clock',
  );
});

test('VineProgress: no onHistoryTap prop, no Clock button JSX, no React.memo comparator field', () => {
  const src = readSrc('src/components/VineProgress.tsx');
  assert.doesNotMatch(
    src,
    /onHistoryTap/,
    'VineProgress must not declare or reference onHistoryTap anywhere',
  );
  assert.doesNotMatch(
    src,
    /<Clock\s/,
    'VineProgress must not render a <Clock /> icon',
  );
  assert.doesNotMatch(
    src,
    /home\.history\.iconLabel/,
    'home.history.iconLabel must not be referenced from VineProgress',
  );
});

test('HomeScreen: VineProgress call site does not pass onHistoryTap', () => {
  const src = readSrc('src/screens/HomeScreen.tsx');
  assert.doesNotMatch(
    src,
    /onHistoryTap/,
    'HomeScreen must not pass onHistoryTap to VineProgress',
  );
  assert.doesNotMatch(
    src,
    /navigate\(\s*['"`]\/history['"`]\s*\)/,
    'HomeScreen must not navigate to /history — that route was deleted',
  );
});

test('App.tsx: /history route deleted; no PostHistoryScreen import', () => {
  const src = readSrc('src/App.tsx');
  assert.doesNotMatch(
    src,
    /PostHistoryScreen/,
    'App.tsx must not import or render PostHistoryScreen',
  );
  assert.doesNotMatch(
    src,
    /path:\s*['"]history['"]/,
    "App.tsx router config must not register path: 'history'",
  );
});

test('PostHistoryScreen.tsx file deleted', () => {
  assert.equal(
    existsSync(path.join(appRoot, 'src/screens/PostHistoryScreen.tsx')),
    false,
    'src/screens/PostHistoryScreen.tsx must be deleted — superseded by SavedScreen History tab',
  );
});
