// Phase 51-01 Task 8: AnchorDetailScreen recovery-surface invariants.
//
// Source-reading tests (same pattern as HomeScreen.exploredAnchors-resync,
// SettingsDataScreen.force-new-day, etc.). The i18n + react-router chain
// blocks importing the screen directly under node --test, and the
// recovery-surface invariants are about source structure ("Flashcards button
// has the recovery-mode bg/label branches", "Appears-in footer exists and
// uses the right route state shape") that source-reading guards catch as
// reliably as a full render would.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANCHOR_PATH = resolve(__dirname, '../../src/screens/AnchorDetailScreen.tsx');
const source = readFileSync(ANCHOR_PATH, 'utf-8');

describe('AnchorDetailScreen — LeafStateBadge placement (Phase 51-01)', () => {
  it('imports LeafStateBadge from components/concept', () => {
    assert.match(
      source,
      /import\s+\{\s*LeafStateBadge\s*\}\s+from\s+['"]\.\.\/components\/concept\/LeafStateBadge['"]/,
      'AnchorDetailScreen.tsx must import LeafStateBadge from ../components/concept/LeafStateBadge.',
    );
  });

  it('computes leafState via computeLeafState(anchor, qaChildren)', () => {
    assert.match(
      source,
      /computeLeafState\(\s*anchor\s*,\s*qaChildren\s*\)/,
      'AnchorDetailScreen.tsx must compute leafState by calling computeLeafState(anchor, qaChildren).',
    );
  });

  it('renders <LeafStateBadge leafState={leafState} /> when leafState is non-null', () => {
    // Guard the conditional render — the badge must be gated on leafState so
    // a fresh-mount with undefined doesn't render an empty pill.
    assert.match(
      source,
      /\{leafState\s*&&[\s\S]*?<LeafStateBadge\s+leafState=\{leafState\}/,
      'AnchorDetailScreen.tsx must render <LeafStateBadge leafState={leafState} /> inside a {leafState && (...)} guard.',
    );
  });
});

describe('AnchorDetailScreen — Flashcards button recovery-mode morph (Phase 51-01)', () => {
  it('declares recoveryActive based on dying/falling/dead leaf states', () => {
    assert.match(
      source,
      /recoveryActive\s*=\s*\n?\s*leafState\s*===\s*['"]dying['"][\s\S]{0,80}leafState\s*===\s*['"]falling['"][\s\S]{0,80}leafState\s*===\s*['"]dead['"]/,
      'AnchorDetailScreen.tsx must declare a `recoveryActive` flag computed from leafState ∈ {dying, falling, dead}.',
    );
  });

  it('flashcardsBg picks amber/red/muted by leafState when anchorCardCount > 0', () => {
    // Sanity: the three recovery colors should all appear in the bg picker.
    assert.match(
      source,
      /flashcardsBg[\s\S]*?leafState\s*===\s*['"]dying['"][\s\S]*?['"]#f59e0b['"]/,
      'AnchorDetailScreen.tsx must set flashcardsBg to amber #f59e0b for dying state.',
    );
    assert.match(
      source,
      /flashcardsBg[\s\S]*?leafState\s*===\s*['"]falling['"][\s\S]*?['"]#ef4444['"]/,
      'AnchorDetailScreen.tsx must set flashcardsBg to red #ef4444 for falling state.',
    );
    assert.match(
      source,
      /flashcardsBg[\s\S]*?leafState\s*===\s*['"]dead['"][\s\S]*?var\(--muted-foreground\)/,
      'AnchorDetailScreen.tsx must set flashcardsBg to var(--muted-foreground) for dead state.',
    );
  });

  it('flashcardsLabel uses graph.anchor.reviewNow when recoveryActive && anchorCardCount > 0', () => {
    assert.match(
      source,
      /flashcardsLabel[\s\S]{0,200}recoveryActive[\s\S]{0,80}anchorCardCount\s*>\s*0[\s\S]{0,80}t\(['"]graph\.anchor\.reviewNow['"]\)/,
      'AnchorDetailScreen.tsx must use t("graph.anchor.reviewNow") for the Flashcards button label when recoveryActive && anchorCardCount > 0.',
    );
  });

  it('Flashcards button uses the computed flashcardsBg and flashcardsLabel (not hardcoded primary-40 / flashcardsButton)', () => {
    // The actual button JSX must reference the variable, not literal values.
    assert.match(
      source,
      /backgroundColor:\s*flashcardsBg/,
      'AnchorDetailScreen.tsx Flashcards button must use backgroundColor: flashcardsBg (not a hardcoded color).',
    );
    assert.match(
      source,
      /<BookOpen[\s\S]{0,40}\{flashcardsLabel\}/,
      'AnchorDetailScreen.tsx Flashcards button must render {flashcardsLabel} (not t("graph.anchor.flashcardsButton") directly).',
    );
  });
});

describe('AnchorDetailScreen — Appears-in footer (Phase 51-01)', () => {
  it('imports the four data services used by the footer', () => {
    assert.match(source, /postHistoryService/, 'AnchorDetailScreen.tsx must import postHistoryService.');
    assert.match(source, /engagementService/, 'AnchorDetailScreen.tsx must import engagementService.');
    assert.match(source, /collectionService/, 'AnchorDetailScreen.tsx must import collectionService.');
    assert.match(source, /podcastService/, 'AnchorDetailScreen.tsx must import podcastService.');
  });

  it('computes savedCount + inCollectionsCount + podcastCount from concept-scoped posts', () => {
    // Both the variable and the data-source call must appear; assert each
    // independently. The chained method-call syntax across newlines breaks
    // a single combined regex, so we check identifier + method separately.
    assert.match(source, /\bsavedCount\b/, 'savedCount must be declared.');
    assert.match(source, /engagementService[\s\S]*?\.getSavedPosts\(\)/, 'engagementService.getSavedPosts() must be called.');
    assert.match(source, /\binCollectionsCount\b/, 'inCollectionsCount must be declared.');
    assert.match(source, /collectionService\.getPostCollections\(/, 'collectionService.getPostCollections must be called.');
    assert.match(source, /\bpodcastCount\b/, 'podcastCount must be declared.');
    assert.match(source, /podcastService[\s\S]*?\.getAll\(\)/, 'podcastService.getAll() must be called.');
  });

  it('renders the footer only when at least one count > 0', () => {
    // The footer's outer guard must sum the three counts so a fresh anchor
    // doesn't show an empty Appears-in row.
    assert.match(
      source,
      /savedCount\s*\+\s*inCollectionsCount\s*\+\s*podcastCount\s*>\s*0/,
      'AnchorDetailScreen.tsx footer must gate on (savedCount + inCollectionsCount + podcastCount > 0).',
    );
  });

  it('Saved link-out navigates to /saved with { conceptFilterTitle }', () => {
    assert.match(
      source,
      /navigate\(['"]\/saved['"][\s\S]{0,100}conceptFilterTitle:\s*conceptTitle/,
      'AnchorDetailScreen.tsx Saved link-out must navigate to /saved with { conceptFilterTitle: conceptTitle }.',
    );
  });

  it('Collections link-out also passes openTab: "collections"', () => {
    assert.match(
      source,
      /openTab:\s*['"]collections['"]/,
      'AnchorDetailScreen.tsx Collections link-out must include openTab: "collections" in the route state.',
    );
  });

  it('Podcasts link-out navigates to /podcast with { conceptFilterQaIds, conceptTitle }', () => {
    assert.match(
      source,
      /navigate\(['"]\/podcast['"][\s\S]{0,300}conceptFilterQaIds[\s\S]{0,200}conceptTitle/,
      'AnchorDetailScreen.tsx Podcasts link-out must navigate to /podcast with { conceptFilterQaIds, conceptTitle }.',
    );
  });
});

describe('AnchorDetailScreen — preserved identity (Phase 51-01)', () => {
  // Phase 51 is INTENTIONALLY a thin enrichment, not a rebuild. The
  // operator's "anchor screen identity" rule (auto-memory) is enforced
  // here: Flashcards + Learn as Post + Knowledge Summary + Q&A list
  // stay as today.
  it('keeps the Flashcards CTA button (not replaced by a tab structure)', () => {
    assert.match(source, /handleReviewCards/, 'handleReviewCards handler must survive — Flashcards CTA stays primary.');
    assert.match(source, /<BookOpen\s+size=\{16\}/, 'BookOpen icon must still render on the Flashcards button.');
  });

  it('keeps the Learn as Post CTA button', () => {
    assert.match(source, /handleGeneratePost/, 'handleGeneratePost handler must survive — Learn as Post CTA stays primary.');
    assert.match(source, /graph\.anchor\.learnAsPostButton/, 'graph.anchor.learnAsPostButton must still render.');
  });

  it('keeps the Knowledge Summary section', () => {
    assert.match(source, /summaryEntries/, 'summaryEntries logic must survive — Knowledge Summary stays.');
  });

  it('keeps the Q&A list section', () => {
    assert.match(source, /qaChildren\.map/, 'qaChildren.map JSX must survive — Q&A list stays.');
  });

  it('does NOT introduce a 4-tab restructure (Overview | Posts | Reviews | Podcasts)', () => {
    // Phase 51-01 plan explicitly rejects the research's tab-bar pattern.
    assert.ok(
      !/setActiveTab\(['"](?:overview|posts|reviews|podcasts)['"]\)/.test(source),
      'AnchorDetailScreen.tsx must NOT implement a 4-tab structure — Phase 51-01 is thin enrichment, not a rebuild.',
    );
  });

  it('does NOT depend on a useConceptDashboard hook', () => {
    assert.ok(
      !/useConceptDashboard/.test(source),
      'AnchorDetailScreen.tsx must NOT use a useConceptDashboard hook — the 51-01 plan explicitly rejects that aggregation pattern.',
    );
  });
});
