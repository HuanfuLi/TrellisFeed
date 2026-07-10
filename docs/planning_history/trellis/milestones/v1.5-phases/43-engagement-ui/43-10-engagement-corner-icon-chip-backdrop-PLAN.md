---
phase: 43-engagement-ui
plan: 10
plan_id: 43-10
slug: engagement-corner-icon-chip-backdrop
type: execute
wave: 4
depends_on: []
files_modified:
  - app/src/index.css
  - app/src/components/MasonryFeed.tsx
  - app/tests/components/MasonryFeed.corner-chip.test.mjs
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 2-3
requirements: [ENGAGE-01, ENGAGE-03]
must_haves:
  truths:
    - "Saved/liked corner icons remain legible against busy image/video/news thumbnails in BOTH light and dark themes (via a circular chip backdrop)"
    - "Heart icon does NOT disappear in dark mode (no longer uses var(--node-salmon) which inverts to near-black in .dark)"
    - "CSS vars --corner-chip-bg / --corner-chip-fg-saved / --corner-chip-fg-liked are declared in :root AND .dark and consumed by MasonryFeed corner overlay"
    - "Source-reading test enforces chip wrapping + CSS var usage and absence of --node-salmon on Heart"
  artifacts:
    - path: "app/src/index.css"
      provides: ":root + .dark CSS vars for corner chip backdrop and per-state fg colors"
    - path: "app/src/components/MasonryFeed.tsx"
      provides: "TileWrapper cornerOverlay rewritten to wrap each icon in a 26x26px circular chip span with var(--corner-chip-bg) + var(--shadow-1)"
    - path: "app/tests/components/MasonryFeed.corner-chip.test.mjs"
      provides: "Source-reading invariant locking chip structure + CSS var usage + Heart fg color migration"
  key_links:
    - from: "app/src/components/MasonryFeed.tsx"
      to: "app/src/index.css CSS variables"
      via: "var(--corner-chip-bg) + var(--corner-chip-fg-saved/liked) consumed in cornerOverlay inline styles"
      pattern: "var\\(--corner-chip-(bg|fg-saved|fg-liked)\\)"
---

<objective>
Gap-closure plan for UAT Test 3 (severity: cosmetic).

Root cause (from `.planning/debug/engagement-corner-icon-no-background.md`): in `MasonryFeed.tsx` lines 387-419 the `cornerOverlay` renders bare lucide-react `<Bookmark>` and `<Heart>` icons inside an absolutely-positioned `<div>` with no background, padding, or border-radius — only a faint per-icon drop-shadow filter, which is insufficient against busy image/video thumbnails. A SECOND bug stacks on top: `Heart fill="var(--node-salmon)"` inverts to near-black in dark mode (`.dark { --node-salmon: #1E2326 }`) because that token is repurposed as a dark-mode block tint. Heart disappears entirely in dark theme regardless of backdrop.

Fix: (a) declare three new CSS vars in `index.css` (`--corner-chip-bg`, `--corner-chip-fg-saved`, `--corner-chip-fg-liked`) in both `:root` and `.dark`; (b) wrap EACH icon in a circular chip `<span>` (26x26px, borderRadius 999px, var(--corner-chip-bg) + var(--shadow-1)); (c) swap Heart fill/color from `var(--node-salmon)` to `var(--corner-chip-fg-liked)`; (d) drop the per-icon `filter: drop-shadow(...)` (chip box-shadow replaces it).

Purpose: Restore legibility of saved/liked state signals on busy tile backgrounds in both themes.
Output: index.css :root + .dark additive var declarations + MasonryFeed.tsx cornerOverlay rewrite + new source-reading regression test.

**Parallel-safety note:** This plan touches MasonryFeed.tsx ONLY in the `cornerOverlay` block (lines ~387-419) and adds non-overlapping CSS var declarations in index.css. No other plan in this wave (43-09/11/12/13) touches MasonryFeed.tsx or index.css. Fully parallel-safe.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/43-engagement-ui/43-UAT.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
@.planning/debug/engagement-corner-icon-no-background.md

# CLAUDE.md (inline styles convention + dark mode .dark class selector)
@CLAUDE.md

# Source-of-truth files
@app/src/components/MasonryFeed.tsx
@app/src/index.css

<interfaces>
From app/src/components/MasonryFeed.tsx (current cornerOverlay, lines 387-419):
```jsx
const cornerOverlay =
  isConcept && (isSaved || isLiked) ? (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        pointerEvents: 'none',
      }}
    >
      {isSaved && (
        <Bookmark
          size={14}
          fill="var(--primary-40)"
          color="var(--primary-40)"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
        />
      )}
      {isLiked && (
        <Heart
          size={14}
          fill="var(--node-salmon)"
          color="var(--node-salmon)"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
        />
      )}
    </div>
  ) : null;
```

From app/src/index.css :root (lines ~5-130):
- --surface, --surface-variant, --primary-40, --node-salmon (#FFAB91 light), --shadow-1, --shadow-2, --radius-xl declared
- Existing 4-space indentation, ALL CAPS hex color values

From app/src/index.css .dark (lines ~155-240):
- --node-salmon redefined to #1E2326 (used as dark-mode block tint) — root cause of Heart disappearance
- --primary-40 redefined to #4CAF50 (still vibrant — Bookmark stays fine)
- --shadow-1 redefined for dark-mode tonal contrast

From CLAUDE.md "Style Convention":
- Inline styles with CSS variables (NOT Tailwind classes for most UI)
- Dark mode toggle: app/src/lib/theme.ts:13 -> document.documentElement.classList.toggle('dark', ...) — uses '.dark' class, NOT [data-theme="dark"]
- Key CSS vars: --primary-40, --surface, --surface-variant, --muted-foreground, --radius-xl, --shadow-1/2/3
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add corner-chip CSS vars to :root and .dark in index.css</name>
  <files>app/src/index.css</files>
  <read_first>
    - app/src/index.css :root block (lines ~5-130, locate near other color vars)
    - app/src/index.css .dark block (lines ~155-240, locate near --node-salmon redefinition)
    - .planning/debug/engagement-corner-icon-no-background.md "Resolution" section — operator-confirmed CSS var values
  </read_first>
  <action>
    Two additive edits to app/src/index.css (single file, single commit).

    Edit 1 — Inside the `:root { ... }` block, add three new vars near the other surface/color tokens (group them with a comment so future readers know what they're for):

    ```css
      /* Phase 43 (gap closure 43-10): saved/liked corner-icon chip vocabulary.
         Backdrop is a semi-transparent dark scrim (light theme); fg colors are
         operator-tuned to remain legible on light + dark tile thumbnails. */
      --corner-chip-bg: rgba(0, 0, 0, 0.55);
      --corner-chip-fg-saved: #FFFFFF;
      --corner-chip-fg-liked: #E57373;
    ```

    Place this block immediately AFTER the existing `--shadow-*` declarations (around line 78-85) so it groups with the visual tokens. If the executor prefers a different anchor (e.g., near `--node-salmon`), that is fine — anchor by readability, not byte-precision.

    Edit 2 — Inside the `.dark { ... }` block, add the dark-mode counterparts AFTER the existing `--node-salmon: #1E2326;` (around line 233):

    ```css
      /* Phase 43 (gap closure 43-10): corner-chip backdrop flips to a light
         scrim in dark theme so the icons read against dark-tinted thumbnails.
         fg-liked uses a brighter pink (#FF8A80) for dark-mode contrast. */
      --corner-chip-bg: rgba(255, 255, 255, 0.20);
      --corner-chip-fg-saved: #FFFFFF;
      --corner-chip-fg-liked: #FF8A80;
    ```

    Key details:
    - Both blocks must define ALL THREE vars (no fallback gymnastics — explicit declarations in both themes match the existing pattern).
    - DO NOT alter `--node-salmon` semantics — it stays as the dark-mode block tint (load-bearing for other consumers like `--bento-review-bg`).
    - DO NOT introduce a new `[data-theme="dark"]` selector. Dark mode uses `.dark` class per `theme.ts:13` (see CLAUDE.md).
    - DO NOT remove any existing vars; this is purely additive.

    Atomic commit message: feat(43-10): add --corner-chip-* CSS vars to :root and .dark
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -c "\-\-corner-chip-bg" src/index.css | grep -qE "^[2-9]" && grep -c "\-\-corner-chip-fg-saved" src/index.css | grep -qE "^[2-9]" && grep -c "\-\-corner-chip-fg-liked" src/index.css | grep -qE "^[2-9]"</automated>
  </verify>
  <acceptance_criteria>
    - --corner-chip-bg appears at least 2 times in index.css (once in :root, once in .dark)
    - --corner-chip-fg-saved appears at least 2 times
    - --corner-chip-fg-liked appears at least 2 times
    - No regression to existing --node-salmon definitions (grep count unchanged)
  </acceptance_criteria>
  <done>CSS chip vocabulary available for MasonryFeed consumption in Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite MasonryFeed cornerOverlay to wrap each icon in a chip span</name>
  <files>app/src/components/MasonryFeed.tsx</files>
  <read_first>
    - app/src/components/MasonryFeed.tsx lines 380-425 (cornerOverlay block + surrounding TileWrapper context)
    - app/src/index.css post-Task-1 to verify all three vars are declared in :root AND .dark
    - .planning/debug/engagement-corner-icon-no-background.md "Resolution" section — chip dimensions + fg color rationale
  </read_first>
  <action>
    Single edit to app/src/components/MasonryFeed.tsx — replace the `cornerOverlay` block at lines ~387-419 with a chip-wrapped version.

    NEW block:

    ```jsx
      // Phase 43 (gap closure 43-10): wrap each engagement-state icon in a
      // circular chip so saved/liked signals stay legible against busy image,
      // video, and news-thumbnail tile backgrounds. Heart's fill/color
      // migrates from var(--node-salmon) (which inverts to near-black in dark
      // mode) to var(--corner-chip-fg-liked). Chip box-shadow replaces the
      // previous per-icon drop-shadow filter. See
      // .planning/debug/engagement-corner-icon-no-background.md.
      const cornerOverlay =
        isConcept && (isSaved || isLiked) ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              pointerEvents: 'none',
            }}
          >
            {isSaved && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--corner-chip-bg)',
                  boxShadow: 'var(--shadow-1)',
                }}
              >
                <Bookmark
                  size={14}
                  fill="var(--corner-chip-fg-saved)"
                  color="var(--corner-chip-fg-saved)"
                />
              </span>
            )}
            {isLiked && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--corner-chip-bg)',
                  boxShadow: 'var(--shadow-1)',
                }}
              >
                <Heart
                  size={14}
                  fill="var(--corner-chip-fg-liked)"
                  color="var(--corner-chip-fg-liked)"
                />
              </span>
            )}
          </div>
        ) : null;
    ```

    Key details:
    - Each icon now sits inside its own 26x26 circular chip — 6px gap between chips when both states are active (slightly increased from the previous 4px to compensate for chip diameter).
    - `borderRadius: '999px'` makes the chip circular regardless of square pixel dimensions.
    - `boxShadow: 'var(--shadow-1)'` lifts each chip off the thumbnail; this is the chip-level visual lift that replaces the per-icon `filter: drop-shadow(...)`.
    - Bookmark fill swaps from `var(--primary-40)` to `var(--corner-chip-fg-saved)` (white in both themes) for chip-consistent contrast.
    - Heart fill swaps from `var(--node-salmon)` to `var(--corner-chip-fg-liked)` — this is the SECOND bug fix (Heart visible in dark mode).
    - `pointerEvents: 'none'` preserved on the parent (corner icons remain read-only per LP-03 spec).
    - DO NOT add any new framer-motion animation to the chip (Phase 42 D-03 motion vocabulary already covers the tile entrance; chip is a passive read-only signal).
    - DO NOT alter the `isConcept && (isSaved || isLiked)` gate (preserves tile-type targeting from 43-03).

    Atomic commit message: fix(43-10): wrap engagement corner icons in CSS-var chip backdrop (legible in both themes)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "var(--corner-chip-bg)" src/components/MasonryFeed.tsx && grep -q "var(--corner-chip-fg-saved)" src/components/MasonryFeed.tsx && grep -q "var(--corner-chip-fg-liked)" src/components/MasonryFeed.tsx && ! grep -q "var(--node-salmon)" src/components/MasonryFeed.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep "var(--corner-chip-bg)" returns at least 2 (one per icon's chip span)
    - grep "var(--corner-chip-fg-saved)" returns at least 2 (fill + color on Bookmark)
    - grep "var(--corner-chip-fg-liked)" returns at least 2 (fill + color on Heart)
    - grep "var(--node-salmon)" in MasonryFeed.tsx returns 0 (Heart no longer uses the inverted token)
    - grep "filter: 'drop-shadow" inside the cornerOverlay block returns 0 (replaced by chip shadow)
    - cd app && npx tsc -b --noEmit exits 0
    - cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs exits 0 (no Phase 42 invariant regression)
  </acceptance_criteria>
  <done>Corner icons render against chip backdrop; Heart visible in dark mode.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add MasonryFeed.corner-chip.test.mjs source-reading regression test</name>
  <files>app/tests/components/MasonryFeed.corner-chip.test.mjs</files>
  <read_first>
    - app/src/components/MasonryFeed.tsx (post-Task 2 final cornerOverlay shape)
    - app/src/index.css (post-Task 1 — confirm three vars in :root AND .dark)
    - app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs (pattern reference — region-scoped indexOf assertions against MasonryFeed)
  </read_first>
  <behavior>
    - Test 1: MasonryFeed.tsx cornerOverlay references var(--corner-chip-bg) for chip background
    - Test 2: MasonryFeed.tsx references var(--corner-chip-fg-saved) AND var(--corner-chip-fg-liked) for icon fg colors
    - Test 3: MasonryFeed.tsx Heart fill/color does NOT reference var(--node-salmon) (regression guard)
    - Test 4: Each icon is wrapped in a span with width/height '26px' AND borderRadius '999px'
    - Test 5: index.css declares all three --corner-chip-* vars in BOTH :root and .dark blocks
    - Test 6: cornerOverlay block has NO `filter: 'drop-shadow` (chip box-shadow replaces it)
  </behavior>
  <action>
    Create new file `app/tests/components/MasonryFeed.corner-chip.test.mjs`.

    File contents:

    ```js
    // Phase 43 Plan 43-10 — source-reading regression for UAT Test 3 fix.
    //
    // Asserts that the engagement corner-icon overlay in MasonryFeed.tsx:
    //   (a) wraps each icon in a 26x26 circular chip span using the
    //       --corner-chip-bg + --corner-chip-fg-saved/liked CSS vars
    //   (b) Heart fg/color does NOT reference --node-salmon (which inverts in
    //       dark mode to #1E2326 and makes the heart disappear)
    //   (c) chip wrapping replaces the per-icon drop-shadow filter
    //
    // Also asserts that index.css declares the three new CSS vars in both
    // :root and .dark blocks so the inline-style consumption resolves in
    // both themes.
    //
    // Pattern: pure regex + indexOf against the live source — no React render,
    // no jsdom. Follows the Phase 39/40/41/42/43 source-reading discipline.
    //
    // See .planning/debug/engagement-corner-icon-no-background.md.

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const feedSrc = readFileSync(path.join(appRoot, 'src/components/MasonryFeed.tsx'), 'utf8');
    const cssSrc = readFileSync(path.join(appRoot, 'src/index.css'), 'utf8');

    // Scope all MasonryFeed assertions to the cornerOverlay region to avoid
    // cross-region false-positives. Anchor on `const cornerOverlay =`.
    function cornerOverlayRegion(): string {
      const start = feedSrc.indexOf('const cornerOverlay');
      assert.ok(start > 0, 'MasonryFeed.tsx must declare const cornerOverlay');
      // Region ends at the next top-level identifier in TileWrapper. We use the
      // close of the ternary (`) : null;`) as a generous-but-safe upper bound.
      const end = feedSrc.indexOf(') : null;', start);
      assert.ok(end > start, 'cornerOverlay ternary must close with `) : null;`');
      return feedSrc.slice(start, end + 'P) : null;'.length);
    }

    test('43-10: cornerOverlay chips use var(--corner-chip-bg) for backdrop', () => {
      const region = cornerOverlayRegion();
      const matches = region.match(/var\(--corner-chip-bg\)/g) || [];
      assert.ok(
        matches.length >= 2,
        'each chip span must use backgroundColor: var(--corner-chip-bg) — expected at least 2 occurrences (one per icon chip)',
      );
    });

    test('43-10: cornerOverlay Bookmark + Heart use --corner-chip-fg-* color tokens', () => {
      const region = cornerOverlayRegion();
      const savedHits = (region.match(/var\(--corner-chip-fg-saved\)/g) || []).length;
      const likedHits = (region.match(/var\(--corner-chip-fg-liked\)/g) || []).length;
      assert.ok(
        savedHits >= 2,
        'Bookmark must use --corner-chip-fg-saved on both fill and color — expected ≥ 2',
      );
      assert.ok(
        likedHits >= 2,
        'Heart must use --corner-chip-fg-liked on both fill and color — expected ≥ 2',
      );
    });

    test('43-10: cornerOverlay no longer references --node-salmon (Heart legible in dark mode)', () => {
      const region = cornerOverlayRegion();
      assert.doesNotMatch(
        region,
        /var\(--node-salmon\)/,
        'Heart fill/color must NOT reference --node-salmon — that token is repurposed as a dark-mode block tint and inverts to near-black',
      );
    });

    test('43-10: each icon is wrapped in a 26x26 circular chip span', () => {
      const region = cornerOverlayRegion();
      // Chip dimensions — both width and height must be the 26px chip size,
      // each appearing twice (once per icon span).
      const widthHits = (region.match(/width:\s*['"]26px['"]/g) || []).length;
      const heightHits = (region.match(/height:\s*['"]26px['"]/g) || []).length;
      assert.ok(widthHits >= 2, 'expected ≥ 2 width: 26px declarations (one per chip span)');
      assert.ok(heightHits >= 2, 'expected ≥ 2 height: 26px declarations (one per chip span)');
      const radiusHits = (region.match(/borderRadius:\s*['"]999px['"]/g) || []).length;
      assert.ok(radiusHits >= 2, 'expected ≥ 2 borderRadius: 999px declarations (circular chips)');
    });

    test('43-10: index.css declares --corner-chip-* vars in :root AND .dark', () => {
      // :root block — split at the .dark selector to scope.
      const darkIdx = cssSrc.indexOf('.dark {');
      assert.ok(darkIdx > 0, 'index.css must declare a .dark { ... } block');
      const rootRegion = cssSrc.slice(0, darkIdx);
      const darkRegion = cssSrc.slice(darkIdx);

      for (const v of ['--corner-chip-bg', '--corner-chip-fg-saved', '--corner-chip-fg-liked']) {
        assert.match(rootRegion, new RegExp(v + ':'), `:root must declare ${v}`);
        assert.match(darkRegion, new RegExp(v + ':'), `.dark must declare ${v}`);
      }
    });

    test('43-10: cornerOverlay no longer uses per-icon drop-shadow filter (chip box-shadow replaces it)', () => {
      const region = cornerOverlayRegion();
      assert.doesNotMatch(
        region,
        /filter:\s*['"]drop-shadow/,
        'cornerOverlay must not retain the per-icon drop-shadow filter — chip box-shadow replaces it',
      );
    });
    ```

    NOTE: the function-return-type annotation `: string` works in `.mjs` only if the file is run via tsx loader. If pure node `--test` rejects it, drop the annotation (executor: cd app && node --test tests/components/MasonryFeed.corner-chip.test.mjs — if errors mention syntax, remove the `: string` annotation and re-run). The existing `tests/components/MasonryFeed.dismiss-fade-all.test.mjs` shows the project's preferred mjs syntax — match its style exactly when in doubt.

    Atomic commit message: test(43-10): source-reading regression for corner-icon chip backdrop + CSS vars
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/components/MasonryFeed.corner-chip.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/components/MasonryFeed.corner-chip.test.mjs
    - Test count is at least 6
    - cd app && node --test tests/components/MasonryFeed.corner-chip.test.mjs exits 0
    - cd app && node --test tests/components/ exits 0 (no Phase 42 invariant regression incl. MasonryFeed.dismiss-fade-all.test.mjs)
  </acceptance_criteria>
  <done>Regression test locks chip wrapping + CSS var usage + dark-mode-safe Heart color.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/components/ tests/screens/ exits 0
- cd app && npm run build exits 0
- Manual UAT (post-merge):
  - Save and Like multiple tiles with image / video / news thumbnails
  - Toggle light theme → bookmark + heart chips legible against thumbnails
  - Toggle dark theme → bookmark + heart chips legible; Heart visible (not absorbed into background)
  - Verify chips do NOT block tap targets (pointer-events: none preserved)
</verification>

<success_criteria>
- index.css declares --corner-chip-bg / --corner-chip-fg-saved / --corner-chip-fg-liked in :root AND .dark
- MasonryFeed cornerOverlay wraps each icon in a 26x26 circular chip using the new vars
- Heart no longer uses --node-salmon (regression-locked in test)
- Drop-shadow filter removed from corner icons (replaced by chip box-shadow)
- New source-reading test passes (MasonryFeed.corner-chip.test.mjs)
- Total 3 atomic commits (index.css, MasonryFeed source, new test file)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-10-engagement-corner-icon-chip-backdrop-SUMMARY.md documenting:
- :root + .dark line ranges where --corner-chip-* vars were added
- MasonryFeed.tsx cornerOverlay block line range and chip dimensions
- Confirmation: --node-salmon no longer referenced in MasonryFeed.tsx
- Confirmation: drop-shadow filter removed from corner icons
- 3 atomic commit hashes
- Phase 43 UAT Test 3 status: cosmetic gap resolved (chip backdrop + dark-mode-safe Heart)
</output>
