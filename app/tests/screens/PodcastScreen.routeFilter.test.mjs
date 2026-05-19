// Phase 51 Nyquist validation: PodcastScreen route-state concept filter.
//
// AnchorDetailScreen's "Appears in" footer routes users to /podcast with
// { conceptFilterQaIds, conceptTitle }. These source guards verify the
// receiving screen consumes that state, narrows the podcast list, and exposes
// a Clear control without clobbering unrelated route state.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PODCAST_PATH = resolve(__dirname, '../../src/screens/PodcastScreen.tsx');
const source = readFileSync(PODCAST_PATH, 'utf-8');

describe('PodcastScreen route-state concept filter (Phase 51)', () => {
  it('reads route state via useLocation and stores the concept filter as qa ids + title', () => {
    assert.match(
      source,
      /import\s+\{[^}]*useLocation[^}]*\}\s+from\s+['"]react-router-dom['"]/,
      'PodcastScreen.tsx must import useLocation from react-router-dom.',
    );
    assert.match(
      source,
      /const\s+location\s*=\s*useLocation\(\)/,
      'PodcastScreen.tsx must call useLocation() inside the component.',
    );
    assert.match(
      source,
      /const\s+\[conceptFilter,\s*setConceptFilter\]\s*=\s*useState<\{\s*qaIds:\s*Set<string>;\s*title:\s*string\s*\}\s*\|\s*null>\(null\)/,
      'PodcastScreen.tsx must keep conceptFilter as { qaIds: Set<string>; title: string } | null.',
    );
  });

  it('consumes { conceptFilterQaIds, conceptTitle } and opens the All Podcasts view', () => {
    assert.match(
      source,
      /const\s+state\s*=\s*location\.state\s+as\s+\{\s*conceptFilterQaIds\?:\s*string\[\];\s*conceptTitle\?:\s*string\s*\}\s*\|\s*null/,
      'PodcastScreen.tsx must type-narrow the Phase 51 route-state shape.',
    );
    assert.match(
      source,
      /if\s*\(state\?\.conceptFilterQaIds\s*&&\s*state\?\.conceptTitle\)\s*\{[\s\S]{0,220}setConceptFilter\(\{\s*qaIds:\s*new\s+Set\(state\.conceptFilterQaIds\),\s*title:\s*state\.conceptTitle\s*\}\)[\s\S]{0,420}setShowAllPodcasts\(true\)/,
      'PodcastScreen.tsx must create the concept filter and auto-open the All Podcasts view.',
    );
  });

  it('clears only the concept-filter route fields and preserves unrelated state', () => {
    assert.match(
      source,
      /const\s+\{\s*conceptFilterQaIds:\s*_qa,\s*conceptTitle:\s*_ct,\s*\.\.\.rest\s*\}\s*=\s*state/,
      'PodcastScreen.tsx must strip only conceptFilterQaIds and conceptTitle from route state.',
    );
    assert.match(
      source,
      /navigate\(location\.pathname,\s*\{\s*replace:\s*true,\s*state:\s*Object\.keys\(rest\)\.length\s*>\s*0\s*\?\s*rest\s*:\s*null\s*\}\)/,
      'PodcastScreen.tsx must preserve unrelated route state when clearing the concept filter fields.',
    );
  });

  it('filters the podcast list by questionIds intersecting the concept qa id set', () => {
    assert.match(
      source,
      /const\s+visiblePodcasts\s*=\s*useMemo\(\(\)\s*=>\s*\{[\s\S]{0,100}if\s*\(!conceptFilter\)\s*return\s+podcasts[\s\S]{0,180}podcasts\.filter\(\(p\)\s*=>\s*p\.questionIds\.some\(\(id\)\s*=>\s*conceptFilter\.qaIds\.has\(id\)\)\)/,
      'PodcastScreen.tsx must derive visiblePodcasts from the intersection of podcast.questionIds and conceptFilter.qaIds.',
    );
    assert.match(
      source,
      /\},\s*\[podcasts,\s*conceptFilter\]\)/,
      'PodcastScreen.tsx visiblePodcasts must depend on podcasts and conceptFilter.',
    );
    assert.match(
      source,
      /visiblePodcasts\.map\(\(pod\)\s*=>/,
      'PodcastScreen.tsx must render the All Podcasts list from visiblePodcasts, not podcasts.',
    );
  });

  it('shows a concept filter banner with a Clear button', () => {
    assert.match(
      source,
      /\{conceptFilter\s*&&\s*\([\s\S]{0,650}t\(['"]podcast\.filteredBy['"],\s*\{\s*concept:\s*conceptFilter\.title\s*\}\)/,
      'PodcastScreen.tsx must show a filtered-by banner using conceptFilter.title.',
    );
    assert.match(
      source,
      /onClick=\{\(\)\s*=>\s*setConceptFilter\(null\)\}[\s\S]{0,900}t\(['"]common\.clear['"]\)/,
      'PodcastScreen.tsx must provide a Clear button that resets conceptFilter.',
    );
  });
});
