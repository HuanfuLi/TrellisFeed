---
phase: 43-engagement-ui
plan: 11
plan_id: 43-11
slug: homescreen-bookmark-inline-with-greeting
type: execute
wave: 4
depends_on: []
files_modified:
  - app/src/screens/HomeScreen.tsx
  - app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 2-3
requirements: [ENGAGE-01]
must_haves:
  truths:
    - "HomeScreen Bookmark icon is INLINE in the greeting row inside the scroll container (scrolls away naturally when content scrolls)"
    - "Bookmark icon does NOT overlap or interfere with the compact VineProgress bar (which slides in at viewport top when content scrolls past the inline VineProgress card)"
    - "Tap target preserves WCAG 44x44 floor; tap navigates to /saved (entry point preserved)"
    - "Source-reading test enforces absence of position: fixed on the bookmark element AND presence of the inline flex-row wrapper around the greeting"
  artifacts:
    - path: "app/src/screens/HomeScreen.tsx"
      provides: "Deleted fixed-position Bookmark button block (~lines 651-679); wrapped greeting <h1> at ~lines 727-729 in flex row with inline Bookmark button"
    - path: "app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs"
      provides: "Source-reading invariant: no fixed-position bookmark; inline flex row exists; navigate('/saved') still wired"
  key_links:
    - from: "app/src/screens/HomeScreen.tsx greeting flex row"
      to: "/saved route"
      via: "inline Bookmark <button onClick={() => navigate('/saved')}>"
      pattern: "navigate\\(['\"]\\/saved['\"]\\)"
---

<objective>
Gap-closure plan for UAT Test 5 (severity: minor).

Root cause (from `.planning/debug/bookmark-icon-viewport-fixed.md`): the HomeScreen Bookmark icon at `HomeScreen.tsx:657-679` is rendered as a standalone `<button>` with explicit `position: 'fixed', top: 'calc(var(--safe-area-top) + 8px)', right: '16px', zIndex: 195`. Placed OUTSIDE the scroll container (`containerRef` at line 706), as a sibling of the compact VineProgress bar (lines 681-705, also `position: 'fixed', top: 'var(--safe-area-top)', zIndex: 190`). The fixed bookmark never scrolls away with content, AND it visually overlaps the compact VineProgress bar when that bar slides in (both fixed at the same viewport top region). Both are intentional designs in isolation, but the bookmark fixedness conflicts with operator expectation ("scroll away with page; not overlap progress bar").

Fix: DELETE the entire fixed-position bookmark block at lines 651-679 (button + 6-line preceding comment). WRAP the existing inline greeting `<h1>` at lines 727-729 in a flex row (`justify-content: space-between`, gap 12px) containing BOTH the greeting and a new inline Bookmark button.

Inline button preserves the WCAG 44x44 tap floor, uses `marginRight: -8px` for optical alignment with the 16px container padding, color `var(--muted-foreground)`, Bookmark size 22 (matches the prior fixed button).

Purpose: Restore expected scroll-aware behavior of the Bookmark icon; remove visual interference with the compact VineProgress bar.
Output: HomeScreen.tsx — delete fixed-position block + wrap greeting `<h1>` in flex-row with inline Bookmark + new source-reading regression test.

**Parallel-safety note:** This plan touches HomeScreen.tsx at lines ~651-679 (delete) and ~727-729 (wrap). Plan 43-09 touches HomeScreen.tsx at lines ~952-963 (LongPressMenu host comment update — comment-only). Regions are >250 lines apart with zero overlap; both plans are parallel-safe. After both land, executors should verify the file compiles via `tsc -b --noEmit` and the existing `HomeScreen.engagement-resync.test.mjs` still passes.
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
@.planning/debug/bookmark-icon-viewport-fixed.md

# CLAUDE.md (style convention + always-mounted screen rules)
@CLAUDE.md

# Source-of-truth files
@app/src/screens/HomeScreen.tsx

<interfaces>
From app/src/screens/HomeScreen.tsx existing structure:
- Lines 651-679: fixed-position Bookmark <button> block (Phase 43-06 SV-02) — TO DELETE.
- Lines 651-656: 6-line preceding block comment explaining the fixed-position intent — TO DELETE alongside the button.
- Lines 681-705: compact VineProgress bar (fixed-position at top, slides in when content scrolls past inline VineProgress) — PRESERVED.
- Line 706: containerRef <div overflowY: auto> — scroll container; everything INSIDE it scrolls with content.
- Lines 727-729: existing greeting <h1>{getGreeting()}</h1> — TO WRAP in a flex row containing the greeting AND a new inline Bookmark button.
- Existing imports: Bookmark from 'lucide-react' (already imported for the fixed block — preserve), useNavigate from 'react-router-dom' (already imported), useTranslation from 'react-i18next' (already imported via existing `t` usage).

Tap target conventions (CLAUDE.md):
- WCAG 44x44 minimum; preserve via minWidth/minHeight 44px on the new inline button.
- marginRight: -8px on a button with 8px internal padding optically aligns the icon glyph to the 16px container padding (matches Header.tsx back-button trick).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete fixed-position Bookmark block AND wrap greeting in inline flex row</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx lines 640-740 (full surrounding context — delete site + wrap site)
    - .planning/debug/bookmark-icon-viewport-fixed.md "Resolution" section for the operator-confirmed wrap pattern
    - app/src/components/ui/Header.tsx (back-button marginLeft: -8px optical alignment precedent)
  </read_first>
  <action>
    Two coordinated edits within HomeScreen.tsx. Land as a single atomic commit (the deletion + wrap together form one semantic change — "move Bookmark from fixed to inline").

    Edit 1 — DELETE lines 651-679 (the entire fixed-position Bookmark block, including the 6-line preceding comment block).

    Current block to remove (verify exact bytes before deleting — line numbers may shift slightly):
    ```jsx
          {/* Phase 43-06 SV-02: Bookmark icon entry to /saved. Position fixed scoped
              to the HomeScreen swipe slot via SwipeTabContainer's translateZ(0)
              containing block (CLAUDE.md "Header positioning"). Placed BEFORE the
              scroll container so overflow:auto cannot clip it. zIndex 195 sits
              above the compact VineProgress bar (zIndex 190) and below any modal
              surface. WCAG 44×44 floor enforced via minWidth/minHeight. */}
          <button
            type="button"
            aria-label={t('saved.title')}
            onClick={() => navigate('/saved')}
            style={{
              position: 'fixed',
              top: 'calc(var(--safe-area-top) + 8px)',
              right: '16px',
              zIndex: 195,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-foreground)',
            }}
          >
            <Bookmark size={22} />
          </button>
    ```

    Delete the entire block — leave NO empty comment, NO stub button. The compact VineProgress bar at lines 681-705 stays.

    Edit 2 — REPLACE the existing greeting `<h1>` at lines 727-729:

    ```jsx
            {/* Inline greeting — scrolls away naturally */}
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {getGreeting()}
            </h1>
    ```

    With a flex-row wrapper containing BOTH the greeting AND the inline Bookmark button:

    ```jsx
            {/* Inline greeting row — scrolls away naturally. Bookmark
                relocated here from a fixed-position viewport-anchored button
                per 43-11 gap closure (UAT Test 5). The icon now participates
                in normal scroll flow and disappears when scrolled past, so it
                no longer overlaps the compact VineProgress bar slide-in. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                {getGreeting()}
              </h1>
              <button
                type="button"
                aria-label={t('saved.title')}
                onClick={() => navigate('/saved')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  marginRight: '-8px',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted-foreground)',
                }}
              >
                <Bookmark size={22} />
              </button>
            </div>
    ```

    Key details:
    - Added `margin: 0` to the `<h1>` to neutralize any UA-default vertical margin inside the flex row (prevents row height jitter).
    - `marginRight: -8px` on the button optically aligns the Bookmark glyph to the 16px container padding-right (same trick Header.tsx uses for `marginLeft: -8px` on the back button).
    - WCAG 44x44 minimum tap floor preserved via `minWidth: 44px, minHeight: 44px`.
    - `position: 'fixed'`, `top`, `right`, `zIndex` are ALL gone from the new button — icon participates in normal scroll flow now.
    - Bookmark `size={22}` matches the prior fixed button (no size change).
    - `aria-label={t('saved.title')}` preserved (a11y unchanged).
    - `onClick={() => navigate('/saved')}` preserved (entry point unchanged).
    - DO NOT touch the compact VineProgress bar block at lines 681-705. DO NOT touch any other code on HomeScreen.

    Atomic commit message: fix(43-11): move HomeScreen Bookmark from fixed-position to inline greeting row
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && ! grep -q "zIndex: 195" src/screens/HomeScreen.tsx && grep -q "justifyContent: 'space-between'" src/screens/HomeScreen.tsx && grep -q "marginRight: '-8px'" src/screens/HomeScreen.tsx && grep -q "navigate('/saved')" src/screens/HomeScreen.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep "zIndex: 195" returns 0 in HomeScreen.tsx (fixed-position block deleted)
    - grep "position: 'fixed'" in HomeScreen.tsx is unchanged for the VineProgress bar but ZERO references remain for the Bookmark block (compare counts before vs. after: bookmark block was the only `position: 'fixed'` near a Bookmark icon)
    - grep "navigate('/saved')" returns 1 (single inline Bookmark button preserves the navigation)
    - grep "marginRight: '-8px'" returns at least 1 (optical alignment preserved)
    - grep "justifyContent: 'space-between'" returns at least 1 (flex row introduced)
    - grep "minWidth: '44px'" + "minHeight: '44px'" still present near the new inline button (tap-floor preserved)
    - cd app && npx tsc -b --noEmit exits 0
    - cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs exits 0 (Phase 43-06 dual-effect resync invariants preserved)
  </acceptance_criteria>
  <done>Bookmark icon now scrolls with content; no overlap with compact VineProgress bar.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add HomeScreen.bookmark-inline-greeting.test.mjs source-reading regression test</name>
  <files>app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx (post-Task 1 — verify final greeting flex-row + button shape)
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs (pattern reference for HomeScreen source-reading tests)
  </read_first>
  <behavior>
    - Test 1: HomeScreen.tsx does NOT contain the previous fixed-position Bookmark button signature (no `zIndex: 195` literal and no `top: 'calc(var(--safe-area-top) + 8px)'` literal)
    - Test 2: HomeScreen.tsx contains an inline flex row with `justifyContent: 'space-between'` near `getGreeting()`
    - Test 3: HomeScreen.tsx contains exactly one `navigate('/saved')` call (the inline Bookmark button)
    - Test 4: The inline Bookmark button preserves WCAG 44x44 tap floor (minWidth 44px + minHeight 44px)
    - Test 5: The inline Bookmark button uses `marginRight: '-8px'` for optical alignment
    - Test 6: The compact VineProgress bar (zIndex 190) is preserved (NOT accidentally deleted alongside the Bookmark)
  </behavior>
  <action>
    Create new file `app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs`.

    File contents:

    ```js
    // Phase 43 Plan 43-11 — source-reading regression for UAT Test 5 fix.
    //
    // Asserts that the HomeScreen Bookmark icon is INLINE in the greeting row
    // inside the scroll container, NOT a fixed-position viewport-anchored
    // sibling of the compact VineProgress bar.
    //
    // Guards against regression to the original Phase 43-06 SV-02 fixed-position
    // implementation, which overlapped the compact VineProgress bar slide-in
    // and never scrolled away with page content.
    //
    // Pattern: pure regex + indexOf against the live source — no React render,
    // no jsdom. Follows the Phase 39/40/41/42/43 source-reading discipline.
    //
    // See .planning/debug/bookmark-icon-viewport-fixed.md.

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/screens/HomeScreen.tsx'), 'utf8');

    test('43-11: HomeScreen no longer renders a fixed-position Bookmark button (zIndex 195 + safe-area-top offset deleted)', () => {
      assert.doesNotMatch(
        src,
        /zIndex:\s*195/,
        'HomeScreen.tsx must not contain zIndex: 195 — that was the deleted fixed-position Bookmark block',
      );
      assert.doesNotMatch(
        src,
        /top:\s*['"]calc\(var\(--safe-area-top\) \+ 8px\)['"]/,
        'HomeScreen.tsx must not retain the fixed-position Bookmark `top: calc(var(--safe-area-top) + 8px)` offset',
      );
    });

    test('43-11: HomeScreen wraps greeting in an inline flex row with space-between', () => {
      // The flex row wrapper must exist near the `getGreeting()` call site so
      // the greeting <h1> AND the new inline Bookmark button are siblings.
      const greetingIdx = src.indexOf('{getGreeting()}');
      assert.ok(greetingIdx > 0, 'HomeScreen.tsx must call getGreeting() in the inline greeting row');
      // Look BACKWARD from the greeting for the wrapper. Scope a ~600-char
      // pre-window to keep the search precise.
      const preWindow = src.slice(Math.max(0, greetingIdx - 600), greetingIdx);
      assert.match(
        preWindow,
        /justifyContent:\s*['"]space-between['"]/,
        'HomeScreen.tsx must wrap the greeting in a flex row using justifyContent: space-between',
      );
    });

    test('43-11: HomeScreen contains exactly one navigate("/saved") call (the inline Bookmark)', () => {
      const calls = (src.match(/navigate\(['"]\/saved['"]\)/g) || []).length;
      assert.strictEqual(
        calls,
        1,
        'HomeScreen.tsx must contain exactly one navigate("/saved") call — the inline Bookmark in the greeting row',
      );
    });

    test('43-11: inline Bookmark button preserves WCAG 44x44 tap floor', () => {
      const greetingIdx = src.indexOf('{getGreeting()}');
      const postWindow = src.slice(greetingIdx, greetingIdx + 1200);
      assert.match(
        postWindow,
        /minWidth:\s*['"]44px['"]/,
        'inline Bookmark button must declare minWidth: 44px (WCAG tap floor)',
      );
      assert.match(
        postWindow,
        /minHeight:\s*['"]44px['"]/,
        'inline Bookmark button must declare minHeight: 44px (WCAG tap floor)',
      );
    });

    test('43-11: inline Bookmark button uses marginRight: "-8px" optical alignment', () => {
      const greetingIdx = src.indexOf('{getGreeting()}');
      const postWindow = src.slice(greetingIdx, greetingIdx + 1200);
      assert.match(
        postWindow,
        /marginRight:\s*['"]-8px['"]/,
        'inline Bookmark button must use marginRight: -8px so its glyph optically aligns with the 16px container padding-right',
      );
    });

    test('43-11: compact VineProgress bar at zIndex 190 is preserved (not accidentally deleted)', () => {
      // The compact bar was a sibling of the deleted Bookmark; ensure the
      // deletion did NOT take the compact bar with it.
      assert.match(
        src,
        /zIndex:\s*190/,
        'compact VineProgress bar (zIndex 190) must be preserved — only the Bookmark fixed-position block was deleted',
      );
    });
    ```

    Atomic commit message: test(43-11): source-reading regression for inline Bookmark + compact bar preservation
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs
    - Test count is at least 6
    - cd app && node --test tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs exits 0
    - cd app && node --test tests/screens/ exits 0 (no HomeScreen.engagement-resync.test.mjs regression)
  </acceptance_criteria>
  <done>Regression test locks inline Bookmark placement + compact bar preservation.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/screens/ exits 0
- cd app && npm run build exits 0
- Manual UAT (post-merge):
  - Open HomeScreen; greeting "Good Morning"/"Good Afternoon"/etc. visible with Bookmark icon on the right of the same row
  - Scroll down — Bookmark icon scrolls out of view naturally
  - Continue scrolling — compact VineProgress bar slides in at top WITHOUT any Bookmark overlap
  - Tap inline Bookmark — navigates to /saved (entry point preserved)
</verification>

<success_criteria>
- Fixed-position Bookmark block deleted (no zIndex: 195, no top: calc(var(--safe-area-top) + 8px))
- Greeting wrapped in flex row with inline Bookmark button (justifyContent: space-between)
- Single navigate('/saved') call preserved
- WCAG 44x44 tap floor + marginRight: -8px optical alignment preserved
- Compact VineProgress bar (zIndex 190) intact
- New source-reading test passes (HomeScreen.bookmark-inline-greeting.test.mjs)
- Total 2 atomic commits (HomeScreen source change, new test file)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-11-homescreen-bookmark-inline-with-greeting-SUMMARY.md documenting:
- HomeScreen.tsx line ranges deleted (~651-679) and replaced/wrapped (~727-729)
- Confirmation: zIndex: 195 no longer in source
- Confirmation: single navigate('/saved') preserved
- 2 atomic commit hashes
- Phase 43 UAT Test 5 status: positioning gap resolved (inline + scroll-aware)
</output>
