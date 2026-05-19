// Phase 51-01 Task 8: InfoFlow concept-badge navigation invariants.
//
// Source-reading tests (same pattern as InfoFlow.video-tap-emit). The
// invariants we're guarding are about the structural shape of the tappable
// concept badges — they exist, they call resolveAnchorId, they navigate to
// /anchor/:id with stopPropagation, and they render a binary amber dot for
// dying/falling/dead. Full React render under node --test is heavyweight
// and the InfoFlow chain is locked to browser APIs; structural source
// guards catch every regression we care about.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFOFLOW_PATH = resolve(__dirname, '../../src/components/InfoFlow.tsx');
const source = readFileSync(INFOFLOW_PATH, 'utf-8');

describe('InfoFlow — tappable concept badges (Phase 51-01)', () => {
  it('imports resolveAnchorId from ../lib/anchor-resolution', () => {
    assert.match(
      source,
      /import\s+\{\s*resolveAnchorId\s*\}\s+from\s+['"]\.\.\/lib\/anchor-resolution['"]/,
      'InfoFlow.tsx must import resolveAnchorId from ../lib/anchor-resolution.',
    );
  });

  it('imports computeLeafState + questionService for the binary amber-dot signal', () => {
    assert.match(source, /import\s+\{\s*computeLeafState\s*\}/, 'InfoFlow.tsx must import computeLeafState.');
    assert.match(source, /import\s+\{\s*questionService\s*\}/, 'InfoFlow.tsx must import questionService.');
  });

  it('declares a getBadgeLeafSignal helper returning "attention" or "normal"', () => {
    assert.match(source, /function\s+getBadgeLeafSignal/, 'InfoFlow.tsx must declare getBadgeLeafSignal helper.');
    // Must return 'attention' only for dying/falling/dead.
    assert.match(
      source,
      /['"]dying['"][\s\S]{0,80}['"]falling['"][\s\S]{0,80}['"]dead['"][\s\S]{0,80}['"]attention['"]/,
      'getBadgeLeafSignal must check leafState ∈ {dying, falling, dead} and return "attention" for those.',
    );
  });

  it('uses useNavigate() inside ConceptCard (badges navigate to /anchor/:id)', () => {
    assert.match(
      source,
      /function\s+ConceptCard[\s\S]*?const\s+navigate\s*=\s*useNavigate\(\)/,
      'ConceptCard must declare `const navigate = useNavigate()` so badges can navigate.',
    );
  });

  it('badge onClick calls e.stopPropagation() before navigate(`/anchor/${anchorId}`)', () => {
    // Two badge spots (news + concept). Both must stopPropagation to keep
    // the tile-level open-post handler from also firing.
    const stopPropMatches = source.match(/e\.stopPropagation\(\)[\s\S]{0,80}navigate\(`\/anchor\/\$\{anchorId\}`\)/g) || [];
    assert.ok(
      stopPropMatches.length >= 2,
      `InfoFlow.tsx must wire e.stopPropagation() + navigate(\`/anchor/\${anchorId}\`) in BOTH the news card and concept card badge handlers. Found ${stopPropMatches.length}; need ≥2.`,
    );
  });

  it('binary amber dot renders ONLY when leafSignal === "attention" (no 3-color palette)', () => {
    // The dot color must be amber (#f59e0b) — operator-locked single signal.
    // Red (#ef4444) is the recovery-button color in AnchorDetailScreen, not
    // a tile-level signal. If a future commit adds tile-level red, this
    // assertion fails and the operator preference is re-checked.
    assert.match(
      source,
      /leafSignal\s*===\s*['"]attention['"][\s\S]{0,500}['"]#f59e0b['"]/,
      'InfoFlow.tsx badge dot must use amber #f59e0b when leafSignal === "attention".',
    );
    // Defense-in-depth: no tile-level red or muted dot colors.
    const redInBadge = source.match(/leafSignal[\s\S]{0,200}['"]#ef4444['"]/g) || [];
    assert.equal(
      redInBadge.length,
      0,
      'InfoFlow.tsx tile badge must NOT use red (#ef4444) for leaf-state signaling — operator locked tiles to a single amber attention dot.',
    );
  });

  it('badge becomes disabled (no onClick) when resolveAnchorId returns null', () => {
    // Orphan badges (unresolvable) must NOT call navigate. The disabled
    // attribute + conditional onClick are the guards.
    assert.match(
      source,
      /disabled=\{!anchorId\}/,
      'InfoFlow.tsx badges must be disabled={!anchorId} so orphan badges are not navigable.',
    );
    assert.match(
      source,
      /onClick=\{anchorId\s*\?\s*\(e\)/,
      'InfoFlow.tsx badges must conditionally bind onClick — only when anchorId resolves.',
    );
  });

  it('hit target padding bumped from 3×8 to 6×10 (≥32px touch area)', () => {
    // Phase 51-01 plan calls for ≥32px touch targets on mobile. The
    // previous 3×8 padding produced ~24px tall pills.
    const oldPadding = source.match(/padding:\s*['"]3px 8px['"]/g) || [];
    // Note: there may still be ONE legacy reference in commented-out code
    // or other contexts — fail only if ALL badge-style blocks regress.
    const newPadding = source.match(/padding:\s*['"]6px 10px['"]/g) || [];
    assert.ok(
      newPadding.length >= 2,
      `InfoFlow.tsx must use padding: '6px 10px' on BOTH badge variants (news + concept) for ≥32px touch targets. Found ${newPadding.length}; need ≥2. Old 3×8 found: ${oldPadding.length}.`,
    );
  });

  it('CR-02 fix: sourceQuestionIds lookup uses the pre-filter ("original") index — not the post-filter index', () => {
    // The bug being guarded against:
    //   .filter(t => !isLikelyInternalId(t)).map((title, idx) => …)
    // produces a post-filter idx. With input
    //   titles = ['anchor-x', 'Spaced Repetition'],
    //   ids    = ['qa-malformed', 'qa-real']
    // the filter drops 'anchor-x' (an internal ID leak from upstream), so the
    // map runs once with idx=0, and post.sourceQuestionIds[0] = 'qa-malformed'
    // — the WRONG qa. Tapping "Spaced Repetition" then either navigates to
    // the wrong anchor or no-ops because the orphan path returns null.
    //
    // The fix: map BEFORE filtering so the original index is carried across
    // the filter as a struct field { title, originalIdx }, and the
    // post.sourceQuestionIds lookup uses originalIdx (parallel to the
    // unfiltered titles array).
    //
    // Source-level guards that catch the regression:
    //   1. The post-filter pattern `.filter(...).map((title, idx) =>` MUST
    //      NOT appear (it's the regression shape).
    //   2. The fixed pattern `.map((title, originalIdx) => ({ title, originalIdx })).filter(`
    //      MUST appear in BOTH badge blocks (news + concept).
    //   3. The sourceQuestionIds lookup MUST use originalIdx, not idx.

    // Guard 1: no post-filter index destructuring inside sourceQuestionTitles chain.
    const postFilterRegression = source.match(
      /sourceQuestionTitles\?\.slice\([^)]*\)\.filter\([^)]*\)\.map\(\(title,\s*idx\)/g,
    ) || [];
    assert.equal(
      postFilterRegression.length,
      0,
      `InfoFlow.tsx must NOT use the post-filter index pattern .filter(...).map((title, idx) => ...) on sourceQuestionTitles — the bug from CR-02. Found ${postFilterRegression.length} occurrence(s).`,
    );

    // Guard 2: the fixed pattern appears in BOTH badge blocks (news slice(0,1) and concept slice(0,2)).
    const fixedPattern = source.match(
      /sourceQuestionTitles\?\.slice\([^)]*\)\.map\(\(title,\s*originalIdx\)\s*=>\s*\(\{\s*title,\s*originalIdx\s*\}\)\)\.filter\(/g,
    ) || [];
    assert.ok(
      fixedPattern.length >= 2,
      `InfoFlow.tsx must use the pre-filter index pattern .map((title, originalIdx) => ({ title, originalIdx })).filter(...) on BOTH badge blocks (news + concept). Found ${fixedPattern.length}; need ≥2.`,
    );

    // Guard 3: the sourceQuestionIds lookup uses originalIdx (not idx).
    const correctLookups = source.match(/post\.sourceQuestionIds\?\.\[originalIdx\]/g) || [];
    assert.ok(
      correctLookups.length >= 2,
      `InfoFlow.tsx must look up post.sourceQuestionIds with [originalIdx] (parallel to the unfiltered titles array). Found ${correctLookups.length}; need ≥2 (one per badge block).`,
    );
    // Defense in depth: no post.sourceQuestionIds?.[idx] lookups in the badge
    // blocks (the regressed form).
    const regressedLookups = source.match(/post\.sourceQuestionIds\?\.\[idx\]/g) || [];
    assert.equal(
      regressedLookups.length,
      0,
      `InfoFlow.tsx must NOT use post.sourceQuestionIds?.[idx] — the post-filter index drift from CR-02. Found ${regressedLookups.length} occurrence(s).`,
    );
  });

  it('CR-02 fix: internal-ID-leaks-into-titles[0] case — surviving badge resolves the SECOND qaId, not the first', () => {
    // Worked example from the CR-02 finding:
    //   sourceQuestionTitles = ['anchor-abc', 'Spaced Repetition']
    //   sourceQuestionIds    = ['qa-malformed', 'qa-real']
    // After .filter(!isLikelyInternalId) only 'Spaced Repetition' survives.
    // The CORRECT lookup is sourceQuestionIds[1] = 'qa-real' (originalIdx=1).
    // The BUG lookup would be sourceQuestionIds[0] = 'qa-malformed' (post-filter idx=0).
    //
    // Structural source-level enforcement: the map callback's first argument
    // must destructure `{ title, originalIdx }`, and the qaId assignment must
    // pull from `post.sourceQuestionIds?.[originalIdx]`. Together, this means
    // when 'anchor-abc' is dropped, originalIdx=1 is preserved across the
    // filter — so qaId = 'qa-real' and anchorId resolves to the correct anchor.
    //
    // We assert the structural shape rather than running the full render
    // chain (i18next + react-router + browser APIs block direct screen
    // import under node --test).

    // The .filter callback must NOT shadow originalIdx — it must only
    // examine the title. Look for the filter callback shape.
    const filterShape = source.match(/\.filter\(\(\{\s*title\s*\}\)\s*=>\s*!isLikelyInternalId\(title\)\)/g) || [];
    assert.ok(
      filterShape.length >= 2,
      `InfoFlow.tsx filter callback must destructure only { title } from the { title, originalIdx } pair (so originalIdx is carried through unchanged). Found ${filterShape.length}; need ≥2.`,
    );

    // The map-after-filter callback must use the carried originalIdx for the qaId lookup.
    // The {0,800} window covers the explanatory comment block that lives between
    // the map's opening brace and the const qaId assignment.
    const mapAfterFilter = source.match(
      /\.filter\(\(\{\s*title\s*\}\)\s*=>\s*!isLikelyInternalId\(title\)\)\.map\(\(\{\s*title,\s*originalIdx\s*\}\)\s*=>\s*\{[\s\S]{0,800}post\.sourceQuestionIds\?\.\[originalIdx\]/g,
    ) || [];
    assert.ok(
      mapAfterFilter.length >= 2,
      `InfoFlow.tsx post-filter map must use { title, originalIdx } destructuring and look up post.sourceQuestionIds[originalIdx]. Found ${mapAfterFilter.length}; need ≥2. This is what makes the 'internal-ID-leaks-into-titles[0]' case resolve the SECOND qaId, not the first (CR-02).`,
    );

    // The button key must also use originalIdx so React's reconciler
    // distinguishes badges correctly across renders when the leaked entry
    // toggles in/out of the upstream titles array.
    const keyOriginalIdx = source.match(/key=\{originalIdx\}/g) || [];
    assert.ok(
      keyOriginalIdx.length >= 2,
      `InfoFlow.tsx badge <button> must use key={originalIdx} (NOT key={idx}) so React reconciles stably across upstream leak toggles. Found ${keyOriginalIdx.length}; need ≥2.`,
    );
  });
});

describe('InfoFlow — preserved invariants (Phase 51-01 + Phase 42 UAT-7+8)', () => {
  // Belt-and-suspenders alongside InfoFlow.video-tap-emit.test.mjs.
  // Phase 51-01 added tappable badges; the video Detector D / no-inline-play
  // rules from Phase 42 must still hold.
  it('does NOT re-introduce CONCEPT_EXPLORED emit in feed cards', () => {
    const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
    assert.equal(matches.length, 0, 'InfoFlow.tsx must NOT emit CONCEPT_EXPLORED — Phase 42 invariant.');
  });

  it('does NOT render an inline YouTube iframe in feed cards', () => {
    assert.ok(
      !/youtube\.com\/embed\//.test(source),
      'InfoFlow.tsx must NOT render an inline YouTube iframe — Phase 42 invariant.',
    );
  });
});
