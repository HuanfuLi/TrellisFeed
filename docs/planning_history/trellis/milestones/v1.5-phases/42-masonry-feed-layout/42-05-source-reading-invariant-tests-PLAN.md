---
phase: 42-masonry-feed-layout
plan: 05
type: execute
wave: 3
depends_on: ["42-01", "42-02", "42-03", "42-04"]
files_modified:
  - app/tests/components/MasonryFeed.layout.test.mjs
  - app/tests/components/MasonryFeed.celebration.test.mjs
  - app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs
  - app/tests/lib/no-card-slide-in.test.mjs
autonomous: true
requirements: [MASONRY-01, MASONRY-02]
must_haves:
  truths:
    - "tests/components/MasonryFeed.layout.test.mjs exists and asserts: (a) columnHeightsRef counterweight, (b) NO column-count/columnCount/break-inside/breakInside, (c) NO will-change/willChange/perspective:, (d) at least one motion.div, (e) MotionConfig with reducedMotion='user' wrapper, (f) NO dailyReadService.markExplored / NO type: 'CONCEPT_EXPLORED' (Pitfall 4)"
    - "tests/components/MasonryFeed.celebration.test.mjs exists and asserts: (a) VineBloomCard imports useTrellisData, (b) VineBloomCard contains leafState filter, (c) NO new method on trellisActionsService surface (no edits to that file)"
    - "tests/screens/HomeScreen.no-more-posts-toast.test.mjs exists and asserts: (a) MasonryFeed import present, (b) InlineInfoFlow import gone, (c) noMorePosts string gone (negative grep)"
    - "tests/lib/no-card-slide-in.test.mjs exists and asserts: cross-tree negative grep on 'card-slide-in' across all .ts/.tsx/.css under app/src/ returns zero offenders"
    - "All 4 new tests pass: cd app && node --test tests/components/MasonryFeed.layout.test.mjs tests/components/MasonryFeed.celebration.test.mjs tests/screens/HomeScreen.no-more-posts-toast.test.mjs tests/lib/no-card-slide-in.test.mjs"
    - "Existing InfoFlow.video-tap-emit.test.mjs still passes (counterweight — confirms GAP-C single-emit invariant preserved)"
  artifacts:
    - path: "app/tests/components/MasonryFeed.layout.test.mjs"
      provides: "Source-reading + behavioral invariants 1, 2, 3, 6 from UI-SPEC § Source-Reading Invariant Tests"
      min_lines: 100
    - path: "app/tests/components/MasonryFeed.celebration.test.mjs"
      provides: "Source-reading invariant 5 (useTrellisData consumption) + counterweight (no service surface change)"
      min_lines: 50
    - path: "app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs"
      provides: "Source-reading invariant 4 (toast removed; MasonryFeed wired)"
      min_lines: 30
    - path: "app/tests/lib/no-card-slide-in.test.mjs"
      provides: "Source-reading invariant 7 (cross-tree negative grep)"
      min_lines: 40
  key_links: []
---

<objective>
Add 4 new source-reading invariant test files that lock the structural contracts from UI-SPEC § Source-Reading Invariant Tests + RESEARCH.md § 7 canonical patterns. These tests run under `node --test` and use the project's standard pattern (read source via fs, assert presence/absence of strings/regexes).

Tests cover all 8 invariants enumerated in UI-SPEC + the new MotionConfig assertion from RESEARCH.md Pitfall 1:

1. `<motion.div>` only on leaf tiles in MasonryFeed.tsx (positive count + negative grep on HomeScreen)
2. NO `column-count` / `break-inside` CSS in MasonryFeed.tsx (D-02 negative grep)
3. NO `transform` / `will-change` / `filter` / `contain` / `perspective` on root or column wrappers (Header positioning rule)
4. `toast(...noMorePosts...)` call gone from HomeScreen.tsx (D-11 negative grep)
5. VineBloomCard renders when `allExplored && layout.nodes.length > 0` (source-reading: VineBloomCard imports useTrellisData)
6. Tile column assignment is immutable across re-renders (covered structurally by `tileColumnAssignmentsRef.current.has(itemId)) continue;` source-reading assertion — behavioral DOM render test deferred since the project's behavioral test infra is heavier and the source-reading guard is sufficient for v1)
7. `card-slide-in` keyframe + 3 callsites removed (cross-tree negative grep)
8. i18n bundle parity preserved (existing `tests/locales/bundle-parity.test.mjs` already enforces — no new test)
9. NEW: `<MotionConfig reducedMotion="user">` wrapper present in MasonryFeed.tsx (RESEARCH.md Pitfall 1 fix — framer-motion v12 does NOT auto-respect prefers-reduced-motion)

Purpose: Lock the structural contracts so future refactors cannot silently regress them. All 4 tests run in <2 seconds (pure source-read assertions; no DOM render).

Output: 4 new test files using the canonical Phase 39/40/41 source-reading pattern.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md
@.planning/phases/42-masonry-feed-layout/42-UI-SPEC.md
@.planning/phases/42-masonry-feed-layout/42-VALIDATION.md

# Canonical test patterns (read these first for the exact shape)
@app/tests/components/InfoFlow.video-tap-emit.test.mjs
@app/tests/services/engagement-anti-wire.test.mjs
@app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs

# Files under test
@app/src/components/MasonryFeed.tsx
@app/src/screens/HomeScreen.tsx

<interfaces>
**Pattern A (positive presence + negative grep in same file)** — from `tests/components/InfoFlow.video-tap-emit.test.mjs`:
```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(__dirname, '../../src/path/to/File.tsx');
const source = readFileSync(SOURCE_PATH, 'utf-8');
describe('Phase XX invariants', () => {
  it('counterweight — proves the test reaches the file', () => {
    assert.ok(source.includes('loadBearingMarker'), '...');
  });
  it('exact-count match', () => {
    const matches = source.match(/regex/g) || [];
    assert.equal(matches.length, 1, 'must appear exactly once');
  });
});
```

**Pattern B (cross-tree negative grep)** — from `tests/services/engagement-anti-wire.test.mjs`:
```typescript
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css|mjs)$/.test(entry.name) && !entry.name.endsWith('.test.mjs')) out.push(full);
  }
  return out;
}
const ALL_SRC = walk(SRC_ROOT);
test('counterweight: target file IS in scan list', () => {
  assert.ok(ALL_SRC.includes(TARGET_FILE), '...');
});
test('no source file contains forbidden pattern', () => {
  const offenders = [];
  for (const file of ALL_SRC) {
    const source = readFileSync(file, 'utf8');
    if (FORBIDDEN_RE.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `${offenders.length} offender(s)`);
});
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create tests/components/MasonryFeed.layout.test.mjs (invariants 1, 2, 3, 9 + immutability source-reading)</name>
  <files>app/tests/components/MasonryFeed.layout.test.mjs</files>
  <read_first>
    - app/tests/components/InfoFlow.video-tap-emit.test.mjs (canonical Pattern A — exact-count matches; required reading for the test shape)
    - app/src/components/MasonryFeed.tsx (the file under test — confirm the load-bearing markers exist before asserting them)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ Example 3 lines 794-839 — sketched test for "no column-count" pattern; § Pitfall 1 — MotionConfig reducedMotion="user" assertion)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ Source-Reading Invariant Tests lines 462-475 — the 8 invariants enumerated)
  </read_first>
  <action>
    Create `app/tests/components/MasonryFeed.layout.test.mjs` using Pattern A. Implement these test groups:

    ```javascript
    import assert from 'node:assert/strict';
    import { describe, it } from 'node:test';
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const MASONRY_PATH = resolve(__dirname, '../../src/components/MasonryFeed.tsx');
    const HOMESCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');

    const masonrySource = readFileSync(MASONRY_PATH, 'utf-8');
    const homeSource = readFileSync(HOMESCREEN_PATH, 'utf-8');

    describe('MasonryFeed layout invariants (Phase 42)', () => {
      // Counterweight — proves the test reaches the file and the load-bearing
      // structures exist (D-02 height-accumulator)
      it('contains the columnHeightsRef state declaration (counterweight)', () => {
        assert.ok(
          masonrySource.includes('columnHeightsRef'),
          'MasonryFeed.tsx must declare columnHeightsRef — D-02 height-accumulating split.'
        );
        assert.ok(
          masonrySource.includes('tileColumnAssignmentsRef'),
          'MasonryFeed.tsx must declare tileColumnAssignmentsRef — D-02 immutability invariant Map.'
        );
      });

      // UI-SPEC invariant #2 — D-02 negative grep
      it('does NOT use CSS column-count or break-inside (D-02 height-accumulating split chosen over CSS column-count)', () => {
        assert.ok(
          !/column-count/i.test(masonrySource),
          'MasonryFeed.tsx must NOT contain `column-count` CSS — D-02 selected height-accumulating JS split (CSS column-count shuffles tiles between columns on append).'
        );
        assert.ok(
          !/columnCount/.test(masonrySource),
          'MasonryFeed.tsx must NOT contain `columnCount` JSX style — same reason.'
        );
        assert.ok(
          !/break-inside/i.test(masonrySource),
          'MasonryFeed.tsx must NOT contain `break-inside` CSS — D-02 selected height-accumulating JS split.'
        );
        assert.ok(
          !/breakInside/.test(masonrySource),
          'MasonryFeed.tsx must NOT contain `breakInside` JSX style — same reason.'
        );
      });

      // UI-SPEC invariant #3 — Header positioning rule
      it('does NOT use will-change / perspective on root or column wrappers (CLAUDE.md Header positioning load-bearing rule)', () => {
        assert.ok(
          !/will-change/i.test(masonrySource),
          'MasonryFeed.tsx must NOT use will-change — Header positioning rule (any ancestor of <Header> with these properties creates a containing block, breaking portal-vs-in-tree shape).'
        );
        assert.ok(
          !/willChange/.test(masonrySource),
          'MasonryFeed.tsx must NOT use willChange — Header positioning rule.'
        );
        assert.ok(
          !/perspective:/.test(masonrySource),
          'MasonryFeed.tsx must NOT use perspective — Header positioning rule.'
        );
      });

      // UI-SPEC invariant #1 — leaf-tile only motion.div
      it('contains at least one motion.div leaf-tile wrapper (D-03 leaf-tile entrance animation)', () => {
        assert.ok(
          /motion\.div/.test(masonrySource),
          'MasonryFeed.tsx must contain at least one <motion.div> wrapper — D-03 leaf-tile entrance animation.'
        );
      });

      // UI-SPEC invariant #1 (cross-file) — motion.div absent from HomeScreen
      it('motion.div NOT used in HomeScreen.tsx (D-03 — wrapper-level animation forbidden)', () => {
        assert.ok(
          !/motion\.div/.test(homeSource),
          'HomeScreen.tsx must NOT contain <motion.div> — D-03 says framer-motion entrance is on leaf tiles inside MasonryFeed only, not at HomeScreen scroll-container level.'
        );
      });

      // NEW invariant from RESEARCH.md Pitfall 1 — framer-motion v12 reduced-motion opt-in
      it('contains MotionConfig with reducedMotion="user" wrapper (RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect prefers-reduced-motion)', () => {
        assert.ok(
          /MotionConfig/.test(masonrySource),
          'MasonryFeed.tsx must import + use MotionConfig — framer-motion v12 does NOT auto-respect prefers-reduced-motion (verified motion.dev/docs/react-accessibility 2026-05-09).'
        );
        assert.ok(
          /reducedMotion=["']user["']/.test(masonrySource),
          'MasonryFeed.tsx MotionConfig must set reducedMotion="user" — opts in to OS-level Reduce Motion honoring for all motion descendants.'
        );
      });

      // UI-SPEC invariant #6 (source-reading proxy) — column assignment immutability
      it('column assignment is gated by tileColumnAssignmentsRef.current.has() check (D-02 immutability invariant)', () => {
        assert.ok(
          /tileColumnAssignmentsRef\.current\.has\([^)]+\)\)\s*continue/.test(masonrySource) ||
            /if\s*\(tileColumnAssignmentsRef\.current\.has/.test(masonrySource),
          'MasonryFeed.tsx assignment loop must skip already-assigned tiles via tileColumnAssignmentsRef.current.has(itemId) — D-02 immutability invariant.'
        );
      });

      // RESEARCH.md Pitfall 4 — GAP-C single-emit (no parallel emit in MasonryFeed)
      it('does NOT add a parallel CONCEPT_EXPLORED emit (Pitfall 4 — GAP-C emit lives in MemoizedConceptCard)', () => {
        assert.ok(
          !/dailyReadService\.markExplored/.test(masonrySource),
          'MasonryFeed.tsx must NOT contain dailyReadService.markExplored call — GAP-C single-emit invariant; the canonical emit lives inside MemoizedConceptCard.'
        );
        assert.ok(
          !/type:\s*['"]CONCEPT_EXPLORED['"]/.test(masonrySource),
          'MasonryFeed.tsx must NOT emit CONCEPT_EXPLORED — Pitfall 4 from RESEARCH.md; the canonical emit lives inside MemoizedConceptCard.'
        );
      });
    });
    ```

    Atomic commit message: `test(42): add MasonryFeed.layout source-reading invariants (UI-SPEC #1/#2/#3/#6 + Pitfall 1 + Pitfall 4)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; node --test tests/components/MasonryFeed.layout.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/components/MasonryFeed.layout.test.mjs` exists
    - `cd app && node --test tests/components/MasonryFeed.layout.test.mjs` exits 0 (all assertions pass against the live MasonryFeed.tsx from plans 42-01 + 42-04)
    - Test file contains all 7 `it(...)` blocks listed above (counterweight, no column-count, no will-change, motion.div present, motion.div absent in HomeScreen, MotionConfig reducedMotion="user", immutability check, no parallel GAP-C emit)
    - Test file imports follow Pattern A from InfoFlow.video-tap-emit.test.mjs
  </acceptance_criteria>
  <done>MasonryFeed.layout.test.mjs locks the 6 structural invariants for D-02/D-03 + Pitfall 1 + Pitfall 4. Test green.</done>
</task>

<task type="auto">
  <name>Task 2: Create tests/components/MasonryFeed.celebration.test.mjs (invariant 5 — VineBloomCard consumes useTrellisData)</name>
  <files>app/tests/components/MasonryFeed.celebration.test.mjs</files>
  <read_first>
    - app/tests/components/InfoFlow.video-tap-emit.test.mjs (Pattern A reference)
    - app/src/components/MasonryFeed.tsx (post-plan-42-04 — confirm VineBloomCard structure)
    - app/src/services/trellis-actions.service.ts (confirm current method list — assertion proves no new method was added)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ 1 lines 971-1008 — path b rationale)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ Source-Reading Invariant Tests #5)
  </read_first>
  <action>
    Create `app/tests/components/MasonryFeed.celebration.test.mjs` using Pattern A:

    ```javascript
    import assert from 'node:assert/strict';
    import { describe, it } from 'node:test';
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const MASONRY_PATH = resolve(__dirname, '../../src/components/MasonryFeed.tsx');
    const TRELLIS_ACTIONS_PATH = resolve(__dirname, '../../src/services/trellis-actions.service.ts');

    const masonrySource = readFileSync(MASONRY_PATH, 'utf-8');
    const trellisActionsSource = readFileSync(TRELLIS_ACTIONS_PATH, 'utf-8');

    describe('MasonryFeed VineBloomCard celebration invariants (Phase 42 MASONRY-02)', () => {
      // Counterweight — proves the test reaches MasonryFeed.tsx and VineBloomCard exists
      it('contains the VineBloomCard function declaration (counterweight)', () => {
        assert.ok(
          /function\s+VineBloomCard\s*\(/.test(masonrySource),
          'MasonryFeed.tsx must declare a function VineBloomCard — replaces plan 42-01 placeholder per plan 42-04.'
        );
      });

      it('VineBloomCard placeholder is gone (real implementation lands per plan 42-04)', () => {
        assert.ok(
          !/function\s+VineBloomCard\(\)\s*\{\s*return\s+null;?\s*\}/.test(masonrySource),
          'MasonryFeed.tsx must NOT contain the placeholder body `function VineBloomCard() { return null; }` — plan 42-04 replaces it with real implementation.'
        );
      });

      // RESEARCH.md § 1 path b — useTrellisData consumption (NOT a new service surface)
      it('imports useTrellisData from state hook (RESEARCH.md § 1 path b — hook-level consumption over service surface change)', () => {
        assert.ok(
          /import\s+\{[^}]*useTrellisData[^}]*\}\s+from\s+['"]\.\.\/state\/useTrellisData['"]/.test(masonrySource),
          'MasonryFeed.tsx must import useTrellisData from ../state/useTrellisData — VineBloomCard derives suggestions inline rather than via a new trellisActionsService method.'
        );
      });

      it('VineBloomCard uses leafState filter (mirrors PlannerScreen.tsx:46-47 pattern)', () => {
        assert.ok(
          /leafState\s*===\s*['"]dead['"]/.test(masonrySource),
          'MasonryFeed.tsx must contain `leafState === \'dead\'` filter — RESEARCH.md § 1 path b.'
        );
        assert.ok(
          /leafState\s*===\s*['"]dying['"]/.test(masonrySource),
          'MasonryFeed.tsx must contain `leafState === \'dying\'` filter — RESEARCH.md § 1 path b.'
        );
      });

      // RESEARCH.md § 1 — no new trellisActionsService method
      it('trellisActionsService still exposes ONLY heal/replant/prune/unpruneQuestion/hardDelete (no new getCelebrationSuggestions method — RESEARCH.md § 1 path b)', () => {
        // Counterweight: confirm the existing methods are still there
        assert.ok(/heal\s*\(/.test(trellisActionsSource), 'trellis-actions.service.ts must still export heal() — counterweight.');
        assert.ok(/replant\s*\(/.test(trellisActionsSource), 'trellis-actions.service.ts must still export replant() — counterweight.');

        // The negative: no new getter added
        assert.ok(
          !/getCelebrationSuggestions/.test(trellisActionsSource),
          'trellis-actions.service.ts must NOT expose getCelebrationSuggestions — RESEARCH.md § 1 path b: VineBloomCard owns its own data read via useTrellisData.'
        );
        assert.ok(
          !/getDailyActions/.test(trellisActionsSource),
          'trellis-actions.service.ts must NOT expose getDailyActions — same reason.'
        );
        assert.ok(
          !/getSuggestedMoves/.test(trellisActionsSource),
          'trellis-actions.service.ts must NOT expose getSuggestedMoves — same reason.'
        );
      });

      it('VineBloomCard wires Open Planner CTA to navigate(\'/planner\') (UI-SPEC § VineBloomCard internal layout step 5)', () => {
        assert.ok(
          /navigate\(['"]\/planner['"]\)/.test(masonrySource),
          'MasonryFeed.tsx VineBloomCard must call navigate(\'/planner\') for Open Planner CTA.'
        );
      });

      it('VineBloomCard inline SVG matches UI-SPEC § Vine SVG Specification (88x88 viewBox)', () => {
        assert.ok(
          /viewBox=["']0\s+0\s+88\s+88["']/.test(masonrySource),
          'MasonryFeed.tsx VineBloomCard must contain the 88x88 vine SVG (UI-SPEC § Vine SVG Specification).'
        );
        assert.ok(
          /motion\.circle/.test(masonrySource),
          'MasonryFeed.tsx VineBloomCard must contain motion.circle for the bloom path-draw animation.'
        );
      });
    });
    ```

    Atomic commit message: `test(42): add MasonryFeed.celebration source-reading invariants (UI-SPEC #5 + RESEARCH § 1 path b)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; node --test tests/components/MasonryFeed.celebration.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/components/MasonryFeed.celebration.test.mjs` exists
    - `cd app && node --test tests/components/MasonryFeed.celebration.test.mjs` exits 0
    - Test file contains all 7 `it(...)` blocks (counterweight, no placeholder, useTrellisData import, leafState filters, no new service surface, navigate(/planner), 88x88 SVG)
  </acceptance_criteria>
  <done>VineBloomCard service-surface invariant locked. Test green.</done>
</task>

<task type="auto">
  <name>Task 3: Create tests/screens/HomeScreen.no-more-posts-toast.test.mjs (invariant 4 — toast removed)</name>
  <files>app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs</files>
  <read_first>
    - app/tests/components/InfoFlow.video-tap-emit.test.mjs (Pattern A reference)
    - app/src/screens/HomeScreen.tsx (post-plan-42-02 — confirm InlineInfoFlow gone, MasonryFeed wired, noMorePosts gone, allExplored present)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ Source-Reading Invariant Tests #4)
  </read_first>
  <action>
    Create `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs`:

    ```javascript
    import assert from 'node:assert/strict';
    import { describe, it } from 'node:test';
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const HOMESCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
    const source = readFileSync(HOMESCREEN_PATH, 'utf-8');

    describe('HomeScreen no-more-posts toast removal (Phase 42 D-11)', () => {
      // Counterweight — confirm HomeScreen still has its main feed JSX (file is intact)
      it('contains MasonryFeed wiring (counterweight — proves test reads the right file post-cutover)', () => {
        assert.ok(
          /MasonryFeed/.test(source),
          'HomeScreen.tsx must reference MasonryFeed — plan 42-02 swapped InlineInfoFlow for MasonryFeed.'
        );
      });

      it('does NOT import InlineInfoFlow (plan 42-02 swapped to MasonryFeed)', () => {
        assert.ok(
          !/InlineInfoFlow/.test(source),
          'HomeScreen.tsx must NOT reference InlineInfoFlow — plan 42-02 swapped to MasonryFeed at /home; InlineInfoFlow is de-wired (still exported from InfoFlow.tsx for future surfaces).'
        );
      });

      // UI-SPEC invariant #4 — D-11 toast removal
      it('does NOT contain the noMorePosts toast key reference (D-11 — celebration card replaces it)', () => {
        assert.ok(
          !/home\.toast\.noMorePosts/.test(source),
          'HomeScreen.tsx must NOT reference home.toast.noMorePosts — D-11 deletes the toast call; vine-bloom celebration card replaces it.'
        );
        assert.ok(
          !/noMorePosts/.test(source),
          'HomeScreen.tsx must NOT contain `noMorePosts` substring — D-11 deletes all references.'
        );
      });

      it('passes allExplored prop to MasonryFeed (RESEARCH.md Pitfall 2 — allExplored is computed locally, NOT a service property)', () => {
        assert.ok(
          /allExplored/.test(source),
          'HomeScreen.tsx must declare/pass allExplored — RESEARCH.md Pitfall 2: infiniteScrollService.allExplored does NOT exist; HomeScreen computes it locally.'
        );
      });
    });
    ```

    Atomic commit message: `test(42): add HomeScreen no-more-posts-toast invariant (UI-SPEC #4 + Pitfall 2)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; node --test tests/screens/HomeScreen.no-more-posts-toast.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs` exists
    - `cd app && node --test tests/screens/HomeScreen.no-more-posts-toast.test.mjs` exits 0
    - Test contains 4 `it(...)` blocks (counterweight MasonryFeed, NO InlineInfoFlow, NO noMorePosts, allExplored present)
  </acceptance_criteria>
  <done>HomeScreen toast deletion invariant locked. Test green.</done>
</task>

<task type="auto">
  <name>Task 4: Create tests/lib/no-card-slide-in.test.mjs (invariant 7 — cross-tree negative grep)</name>
  <files>app/tests/lib/no-card-slide-in.test.mjs</files>
  <read_first>
    - app/tests/services/engagement-anti-wire.test.mjs (canonical Pattern B — cross-tree walker)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (Pitfall 7 lines 473-486 — explicit enumeration of the 3 callsites + 1 keyframe)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ Source-Reading Invariant Tests #7)
  </read_first>
  <action>
    Create `app/tests/lib/no-card-slide-in.test.mjs` using Pattern B (cross-tree walker):

    ```javascript
    import assert from 'node:assert/strict';
    import { describe, it } from 'node:test';
    import { readFileSync, readdirSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const SRC_ROOT = resolve(__dirname, '../../src');

    function walk(dir) {
      const out = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...walk(full));
        } else if (/\.(ts|tsx|css|mjs)$/.test(entry.name)) {
          out.push(full);
        }
      }
      return out;
    }

    const ALL_SRC_FILES = walk(SRC_ROOT);

    describe('card-slide-in keyframe deleted (Phase 42 D-06)', () => {
      // Counterweight — confirm the walker is reaching files (catches scan-list regressions)
      it('walker reaches at least 50 files under app/src (counterweight)', () => {
        assert.ok(
          ALL_SRC_FILES.length >= 50,
          `walker must reach app/src files; found ${ALL_SRC_FILES.length} (expected ≥ 50). Check walk() / SRC_ROOT path.`
        );
      });

      // Counterweight — confirm at least one critical file is in the scan list
      it('walker scan list includes app/src/index.css (counterweight)', () => {
        const indexCss = ALL_SRC_FILES.find((f) => f.endsWith('/src/index.css'));
        assert.ok(indexCss, 'app/src/index.css must be in the scan list — counterweight to catch path regressions.');
      });

      it('walker scan list includes app/src/components/InfoFlow.tsx (counterweight)', () => {
        const infoFlow = ALL_SRC_FILES.find((f) => f.endsWith('/src/components/InfoFlow.tsx'));
        assert.ok(infoFlow, 'app/src/components/InfoFlow.tsx must be in the scan list — counterweight.');
      });

      // UI-SPEC invariant #7 — cross-tree negative grep
      it('zero source files contain `card-slide-in` (D-06 — framer-motion replaces CSS entrance animation)', () => {
        const offenders = [];
        for (const file of ALL_SRC_FILES) {
          const source = readFileSync(file, 'utf8');
          if (/card-slide-in/.test(source)) {
            offenders.push(file);
          }
        }
        assert.deepEqual(
          offenders,
          [],
          `${offenders.length} file(s) still contain card-slide-in (D-06 deletes the keyframe + 3 callsites; framer-motion replaces it):\n${offenders.join('\n')}`
        );
      });
    });
    ```

    Atomic commit message: `test(42): add cross-tree no-card-slide-in negative grep (UI-SPEC #7 + Pitfall 7)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; node --test tests/lib/no-card-slide-in.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/lib/no-card-slide-in.test.mjs` exists
    - `cd app && node --test tests/lib/no-card-slide-in.test.mjs` exits 0
    - Test contains 4 `it(...)` blocks (file count counterweight, index.css counterweight, InfoFlow.tsx counterweight, zero offenders)
    - The walker scans .ts, .tsx, .css, .mjs files under app/src/
  </acceptance_criteria>
  <done>Cross-tree negative grep locks D-06 / Pitfall 7. Test green.</done>
</task>

</tasks>

<verification>
- `cd app && node --test tests/components/MasonryFeed.layout.test.mjs tests/components/MasonryFeed.celebration.test.mjs tests/screens/HomeScreen.no-more-posts-toast.test.mjs tests/lib/no-card-slide-in.test.mjs` all exit 0
- `cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs` still passes (counterweight — confirms GAP-C single-emit invariant preserved across the InlineInfoFlow → MasonryFeed swap)
- `cd app && node --test tests/locales/bundle-parity.test.mjs` still passes (i18n parity from plan 42-04)
- `cd app && npm test` baseline does not regress (all new tests are pure source-reading; no DOM render; no flake)
</verification>

<success_criteria>
- 4 new test files created at correct paths
- All 4 tests green when run with `node --test`
- Together they enforce all 8 UI-SPEC invariants + 1 NEW Pitfall 1 invariant + 1 NEW Pitfall 4 invariant
- Existing InfoFlow.video-tap-emit.test.mjs and bundle-parity.test.mjs continue to pass (counterweights for the GAP-C and i18n contracts respectively)
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-05-SUMMARY.md` documenting:
- 4 atomic commit hashes
- Test result snapshot (all 4 new tests + the 2 counterweight tests showing pass count)
- Map of UI-SPEC invariant # → test file (so verifier can audit coverage)
</output>
