---
phase: 43-engagement-ui
plan: 09
plan_id: 43-09
slug: bottomsheet-portal-and-nav-clearance
type: execute
wave: 4
depends_on: []
files_modified:
  - app/src/components/ui/BottomSheet.tsx
  - app/src/screens/HomeScreen.tsx
  - app/tests/components/BottomSheet.portal.test.mjs
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 2-3
requirements: [ENGAGE-01, ENGAGE-02, ENGAGE-03]
must_haves:
  truths:
    - "Long-press menu's 3rd row (Not interested / Dismiss) is fully visible and tappable above the BottomNavigation bar — not clipped behind it"
    - "BottomSheet renders via createPortal into document.body, escaping any ancestor transform / containing block (matches Phase 32.1 Header sub-screen portal pattern)"
    - "Defense-in-depth bottom clearance (~80px + safe-area-bottom) keeps the sheet above the fixed BottomNavigation even if the portal target ever changes"
    - "Source-reading regression test enforces createPortal usage and SSR guard"
  artifacts:
    - path: "app/src/components/ui/BottomSheet.tsx"
      provides: "BottomSheet inner JSX wrapped in createPortal(node, document.body) with SSR-safe typeof document undefined guard + nav-clearance offset"
    - path: "app/src/screens/HomeScreen.tsx"
      provides: "Updated LongPressMenu host comment to accurately describe portal behavior (no aspirational language)"
    - path: "app/tests/components/BottomSheet.portal.test.mjs"
      provides: "Source-reading regression: createPortal import + invocation + document.body target + SSR guard + clearance offset all present"
  key_links:
    - from: "app/src/components/ui/BottomSheet.tsx"
      to: "react-dom createPortal + document.body"
      via: "createPortal(overlay, document.body) wrap of the outer overlay"
      pattern: "createPortal\\("
---

<objective>
Gap-closure plan for UAT Test 2 (severity: major).

Root cause (from `.planning/debug/dismiss-row-clipped-by-bottom-nav.md`): `BottomSheet.tsx` renders in-tree without React Portal. SwipeTabContainer slot's `transform: translateZ(0)` creates a per-slot containing block that captures the sheet's `position: fixed`, anchoring it to the SLOT bottom rather than the viewport. BottomNavigation (also fixed but rendered OUTSIDE the strip) correctly anchors to the viewport. Because the two are in different stacking contexts AND BottomSheet applies no offset for the nav's ~80-110px footprint, the bottom-most row (Dismiss) is fully eclipsed by the nav bar — matching the reported symptom "Only Like and Save shown, Not interested missing." Same bug class as Phase 32.1 Header.

Fix: wrap the BottomSheet's outer overlay JSX in `createPortal(overlay, document.body)` so the sheet escapes ancestor transforms (canonical Phase 32.1 portal fix). Add SSR-safe `typeof document === 'undefined'` guard. Add bottom clearance as defense-in-depth so even if a future containing block creeps back in, the sheet still clears the nav.

Purpose: Restore the third Dismiss row to a visible, tappable state on HomeScreen. Unblocks UAT Test 4 (currently blocked by this gap).
Output: BottomSheet.tsx portal wrap + clearance offset + HomeScreen.tsx comment update + new source-reading regression test.

**Parallel-safety note:** This plan touches `HomeScreen.tsx` at lines ~952-963 (the LongPressMenu host comment block — comment-only edit, no JSX behavior change). Plan 43-11 deletes lines 651-679 from the same file (the fixed-position Bookmark button) and wraps an `<h1>` at 727-729. Regions are >250 lines apart with zero overlap; executors can run these plans in parallel without merge conflict. If both plans run concurrently and the harness uses three-way merge, both edits should apply cleanly. Verify by running the suite after both plans land.
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
@.planning/debug/dismiss-row-clipped-by-bottom-nav.md

# CLAUDE.md load-bearing sections
@CLAUDE.md

# Source-of-truth files
@app/src/components/ui/BottomSheet.tsx
@app/src/screens/HomeScreen.tsx
@app/src/components/SwipeTabContainer.tsx
@app/src/components/BottomNavigation.tsx

<interfaces>
From app/src/components/ui/BottomSheet.tsx (existing, lines 1-76):
- export function BottomSheet({ open, onClose, title, children, compact }: BottomSheetProps)
- BottomSheetProps = { open: boolean; onClose: () => void; title?: string; children: ReactNode; compact?: boolean }
- Outer overlay: position:fixed inset:0 zIndex:500, backdrop with onClick={onClose}
- Inner sheet: position:absolute bottom:0 left:0 right:0, backgroundColor var(--surface), translateY animation
- compact mode (used by LongPressMenu): minHeight 'auto', maxHeight '50vh'

From react-dom (existing project dep, used throughout):
- import { createPortal } from 'react-dom';
- createPortal(children, container) — children render into container subtree, retaining React tree position for events/refs/context

From CLAUDE.md "Header positioning (Phase 32.1 — load-bearing)":
- "Outside SwipeTabContext (sub-screens via Outlet: PostDetail, settings sub-pages, Question/Anchor/Cluster detail) → renders via `createPortal(headerNode, document.body)`. Anchors to the viewport, immune to any ancestor's transform/overflow/will-change/filter/contain."
- BottomSheet sits inside SwipeTabContext (HomeScreen is a swipe-tab slot), so it ALSO needs the portal escape — exactly like sub-screen Headers do.

From app/src/components/BottomNavigation.tsx:167-178:
- motion.nav: position:fixed bottom:0, zIndex:100
- paddingBottom: calc(8px + var(--safe-area-bottom))
- Inner row height 64px -> total nav footprint ~80-110px

From app/src/components/SwipeTabContainer.tsx lines 252-280:
- Each slot div: { width:'100vw', flexShrink:0, height:'100dvh', overflow:'hidden', transform:'translateZ(0)' }
- The translateZ(0) is the containing block that captures BottomSheet's position:fixed today.
- BottomNavigation is rendered OUTSIDE the strip (as `children` of SwipeTabContainer) so it escapes the containing block.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrap BottomSheet outer overlay in createPortal + add nav clearance offset</name>
  <files>app/src/components/ui/BottomSheet.tsx</files>
  <read_first>
    - app/src/components/ui/BottomSheet.tsx (full 76 LOC — current in-tree render shape)
    - .planning/debug/dismiss-row-clipped-by-bottom-nav.md (full diagnosis incl. geometric math)
    - CLAUDE.md "Header positioning (Phase 32.1 — load-bearing)" section — portal-vs-in-tree split rationale
    - app/src/components/BottomNavigation.tsx lines 167-180 — confirm nav footprint math (8px top pad + 64px row + 8px bottom pad + safe-area-bottom ~80px + safe-area)
  </read_first>
  <action>
    Two edits to app/src/components/ui/BottomSheet.tsx (single file, single commit).

    Edit 1 — Import createPortal at the top of the file. Add to the existing import lines:
    ```ts
    import type { ReactNode, MouseEvent } from 'react';
    import { createPortal } from 'react-dom';
    ```

    Edit 2 — Restructure the component return to:
    (a) Build the overlay JSX as a local variable.
    (b) SSR-guard: if `typeof document === 'undefined'` return null (so server-rendering tests / future SSR contexts don't crash).
    (c) Return `createPortal(overlay, document.body)`.
    (d) Add bottom clearance to the INNER sheet so its bottom edge clears the BottomNavigation footprint as defense-in-depth.

    Replace the existing `return (...)` block with:

    ```tsx
    export function BottomSheet({ open, onClose, title, children, compact }: BottomSheetProps) {
      const stop = (e: MouseEvent) => e.stopPropagation();

      // SSR / non-browser guard — document is undefined in pre-hydration contexts.
      // Skipping the portal in that branch means the sheet simply doesn't render
      // (matches the previous in-tree behavior on the server: zero output).
      if (typeof document === 'undefined') return null;

      const overlay = (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            backgroundColor: open ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0)',
            pointerEvents: open ? 'auto' : 'none',
            transition: 'background-color 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <div
            onClick={stop}
            style={{
              position: 'absolute',
              // Phase 43 gap-closure (UAT Test 2): anchor sheet ABOVE the fixed
              // BottomNavigation (~80px row + safe-area-bottom). Combined with the
              // createPortal escape to document.body, this guarantees the bottom
              // row (Dismiss) is never clipped by the nav. See
              // .planning/debug/dismiss-row-clipped-by-bottom-nav.md.
              bottom: 'calc(80px + var(--safe-area-bottom))',
              left: 0,
              right: 0,
              backgroundColor: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px 24px',
              boxShadow: 'var(--shadow-3)',
              minHeight: compact ? 'auto' : '45vh',
              maxHeight: compact ? '50vh' : '75vh',
              overflowY: 'auto',
              transform: open ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {title !== undefined && (
              <>
                <div
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: 'var(--border)',
                    borderRadius: 2,
                    margin: '0 auto 16px',
                  }}
                />
                <h3
                  style={{
                    margin: 0,
                    marginBottom: 16,
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  {title}
                </h3>
              </>
            )}
            {children}
          </div>
        </div>
      );

      return createPortal(overlay, document.body);
    }
    ```

    Key details:
    - The inner sheet's `bottom` flips from `0` to `'calc(80px + var(--safe-area-bottom))'`. This lifts the sheet above the BottomNavigation (which sits at the viewport's bottom edge, ~80px tall + safe-area).
    - The inner sheet's `padding` bottom is trimmed from `40px` to `24px` because the `bottom:calc(...)` offset now provides the visual breathing room previously absorbed by the 40px pad.
    - Both the portal AND the clearance offset are kept — portal alone fixes the stacking-context problem; clearance alone fixes the overlap geometry. Keeping both is defense-in-depth (Phase 32.1 + CLAUDE.md "Best practices" rule on multi-layer defense).
    - The translateY animation uses 100% so the slide-in origin stays just below the sheet's lifted bottom. Visual feel is preserved.

    Do NOT touch the BottomSheetProps interface. Do NOT add framer-motion (existing CSS transitions are intentionally lightweight per Phase 39 D-09 conventions). Do NOT change zIndex (500 still wins against the nav's 100 once both live in document.body's stacking context).

    Atomic commit message: fix(43-09): portal BottomSheet to document.body + nav clearance — restore Dismiss row
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "import { createPortal } from 'react-dom'" src/components/ui/BottomSheet.tsx && grep -q "createPortal(overlay, document.body)" src/components/ui/BottomSheet.tsx && grep -q "typeof document === 'undefined'" src/components/ui/BottomSheet.tsx && grep -q "calc(80px + var(--safe-area-bottom))" src/components/ui/BottomSheet.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "createPortal" app/src/components/ui/BottomSheet.tsx returns at least 2 (import + invocation)
    - grep -c "document.body" app/src/components/ui/BottomSheet.tsx returns at least 1
    - grep -c "typeof document === 'undefined'" app/src/components/ui/BottomSheet.tsx returns 1
    - grep -c "calc(80px + var(--safe-area-bottom))" app/src/components/ui/BottomSheet.tsx returns 1
    - cd app && npx tsc -b --noEmit exits 0
    - cd app && npm run build exits 0 (no React 19 createPortal regression)
  </acceptance_criteria>
  <done>BottomSheet now portals to document.body AND sits above the BottomNavigation; UAT Test 2 Dismiss row visible.</done>
</task>

<task type="auto">
  <name>Task 2: Update HomeScreen LongPressMenu host comment to accurately describe portal behavior</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx lines 950-965 (the LongPressMenu host comment block)
    - .planning/debug/dismiss-row-clipped-by-bottom-nav.md "Evidence" timestamp 10:03:30Z — confirms the existing comment was aspirational, not implemented
  </read_first>
  <action>
    Single edit to app/src/screens/HomeScreen.tsx — rewrite the comment block at lines ~952-957 to match the post-Task-1 reality.

    Replace the existing comment block:
    ```
    {/* Phase 43-06 LP-01..LP-04: bottom-sheet contextual menu hosted at the
        HomeScreen level (NOT per-tile). MasonryFeed's onLongPress callback
        hydrates { menuPostId, menuAnchorId } and flips menuOpen on. The
        BottomSheet inside LongPressMenu portals to document.body via
        position:fixed at zIndex 500, so the JSX placement is purely
        lifecycle-scoped (mounts/unmounts with HomeScreen). */}
    ```

    With:
    ```
    {/* Phase 43-06 LP-01..LP-04 + 43-09 (gap closure): bottom-sheet contextual
        menu hosted at the HomeScreen level (NOT per-tile). MasonryFeed's
        onLongPress callback hydrates { menuPostId, menuAnchorId } and flips
        menuOpen on. The inner BottomSheet wraps its overlay in
        createPortal(overlay, document.body) (Phase 32.1 portal pattern + 43-09
        UAT Test 2 fix), escaping SwipeTabContainer's per-slot translateZ(0)
        containing block. Inner sheet bottom is offset by
        calc(80px + var(--safe-area-bottom)) so it clears the fixed
        BottomNavigation (~80px row + safe-area). JSX placement here remains
        lifecycle-scoped (mounts/unmounts with HomeScreen). */}
    ```

    Do NOT alter the `<LongPressMenu ... />` JSX itself. Do NOT touch any other comment or code on HomeScreen.

    Atomic commit message: docs(43-09): align HomeScreen LongPressMenu host comment with portal reality
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "createPortal(overlay, document.body)" src/screens/HomeScreen.tsx && grep -q "43-09" src/screens/HomeScreen.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - Comment block references createPortal AND 43-09 AND calc(80px clearance
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>HomeScreen comment now matches the implemented portal behavior — no aspirational language.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add BottomSheet.portal.test.mjs source-reading regression test</name>
  <files>app/tests/components/BottomSheet.portal.test.mjs</files>
  <read_first>
    - app/src/components/ui/BottomSheet.tsx (post-Task 1 — verify final shape)
    - app/tests/components/LongPressMenu.test.mjs (pattern reference for source-reading test against components)
    - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs (pattern reference for indexOf/regex assertion shape)
  </read_first>
  <behavior>
    - Test 1: BottomSheet.tsx imports createPortal from 'react-dom'
    - Test 2: BottomSheet.tsx invokes createPortal(overlay, document.body)
    - Test 3: BottomSheet.tsx has SSR guard `typeof document === 'undefined'` returning null
    - Test 4: Inner sheet has bottom clearance calc(80px + var(--safe-area-bottom))
    - Test 5: Inner sheet's `position: 'absolute'` + `bottom: '...'` lines are still adjacent in source (no regression to bottom: 0)
    - Test 6: Negative — file does NOT contain `bottom: 0,` on the inner sheet block (would indicate regression)
  </behavior>
  <action>
    Create new file `app/tests/components/BottomSheet.portal.test.mjs`. Follow the Node built-in test runner pattern from other source-reading tests (`tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs`).

    File contents:

    ```js
    // Phase 43 Plan 43-09 — source-reading regression for UAT Test 2 fix.
    //
    // Asserts that BottomSheet.tsx:
    //   (a) imports createPortal from 'react-dom'
    //   (b) invokes createPortal(overlay, document.body) so the sheet escapes
    //       the SwipeTabContainer slot's translateZ(0) containing block
    //       (Phase 32.1 portal pattern — same bug class as the Header fix)
    //   (c) has an SSR-safe `typeof document === 'undefined'` guard returning null
    //   (d) offsets the inner sheet by calc(80px + var(--safe-area-bottom)) so
    //       the third (Dismiss) row clears the fixed BottomNavigation
    //
    // Pattern: pure regex + indexOf against the live source file — no React
    // render, no jsdom. Follows the Phase 39/40/41/42/43 source-reading test
    // discipline.
    //
    // See .planning/debug/dismiss-row-clipped-by-bottom-nav.md for the geometric
    // proof of why the Dismiss row was clipped and the multi-layer fix rationale.

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/components/ui/BottomSheet.tsx'), 'utf8');

    test('43-09: BottomSheet imports createPortal from react-dom', () => {
      assert.match(
        src,
        /import\s+\{\s*createPortal\s*\}\s+from\s+['"]react-dom['"]/,
        'createPortal must be imported from react-dom at the top of BottomSheet.tsx',
      );
    });

    test('43-09: BottomSheet invokes createPortal with document.body target', () => {
      // Tolerate either `createPortal(overlay, document.body)` or whitespace
      // variants — but require the document.body target literally.
      assert.match(
        src,
        /createPortal\s*\([^,]+,\s*document\.body\s*\)/,
        'BottomSheet must return createPortal(node, document.body) so the sheet escapes the slot containing block',
      );
    });

    test('43-09: BottomSheet has SSR-safe document-undefined guard returning null', () => {
      assert.match(
        src,
        /typeof\s+document\s*===\s*['"]undefined['"]/,
        'SSR guard must check `typeof document === undefined` before reaching createPortal(..., document.body)',
      );
      // Ensure the guard returns null (vs. returning the overlay JSX, which
      // would crash if document is undefined).
      const guardIdx = src.search(/typeof\s+document\s*===\s*['"]undefined['"]/);
      const after = src.slice(guardIdx, guardIdx + 80);
      assert.match(after, /return\s+null/, 'document-undefined guard must `return null`');
    });

    test('43-09: inner sheet has nav-clearance offset above BottomNavigation', () => {
      assert.match(
        src,
        /bottom:\s*['"]calc\(80px\s*\+\s*var\(--safe-area-bottom\)\)['"]/,
        'inner sheet bottom must be calc(80px + var(--safe-area-bottom)) to clear the BottomNavigation footprint',
      );
    });

    test('43-09: inner sheet position is still absolute (no layout regression)', () => {
      assert.match(
        src,
        /position:\s*['"]absolute['"]/,
        'inner sheet must keep position: absolute (translateY animation depends on absolute positioning relative to the overlay)',
      );
    });

    test('43-09: inner sheet does NOT regress to bottom: 0 (the original clipped placement)', () => {
      // Negative invariant: the original `bottom: 0,` line (note the trailing
      // comma, not a hex color or rgba boundary) must not exist in the inner
      // sheet block. We anchor the search on the segment between
      // `position: 'absolute'` and `left: 0` to scope precisely.
      const absIdx = src.indexOf("position: 'absolute'");
      assert.ok(absIdx > 0, 'inner sheet must declare position: absolute');
      const leftIdx = src.indexOf('left: 0', absIdx);
      assert.ok(leftIdx > absIdx, 'inner sheet must declare left: 0 right after position: absolute');
      const region = src.slice(absIdx, leftIdx);
      assert.doesNotMatch(
        region,
        /\bbottom:\s*0\s*,/,
        'inner sheet must NOT use bottom: 0 — that was the pre-fix placement clipped by BottomNavigation',
      );
    });
    ```

    Atomic commit message: test(43-09): source-reading regression for BottomSheet portal + nav clearance
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/components/BottomSheet.portal.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/components/BottomSheet.portal.test.mjs
    - Test count is at least 6
    - cd app && node --test tests/components/BottomSheet.portal.test.mjs exits 0
    - cd app && node --test tests/components/ exits 0 (no sibling-test regression)
  </acceptance_criteria>
  <done>Regression test locks createPortal + SSR guard + nav clearance for the lifetime of the file.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/components/BottomSheet.portal.test.mjs exits 0
- cd app && node --test tests/components/ tests/screens/ exits 0 (no neighbor regressions)
- cd app && npm run build exits 0
- Manual UAT (post-merge): long-press a feed tile on HomeScreen — all 3 rows (Like, Save, Not interested) visible and tappable; Dismiss row not clipped by BottomNavigation; backdrop-tap and back-button dismiss work as before.
- UAT Test 4 (currently blocked by this gap) re-runnable.
</verification>

<success_criteria>
- BottomSheet portals to document.body via createPortal
- Inner sheet bottom offset by calc(80px + var(--safe-area-bottom)) (defense-in-depth)
- SSR-safe `typeof document === 'undefined'` guard returns null
- HomeScreen comment accurately describes implemented portal behavior
- New source-reading regression test passes (BottomSheet.portal.test.mjs)
- Total 3 atomic commits (BottomSheet source, HomeScreen comment, new test file)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-09-bottomsheet-portal-and-nav-clearance-SUMMARY.md documenting:
- File-level diff summary for BottomSheet.tsx (line counts + imports + render shape change)
- Confirmation that createPortal target is document.body
- Confirmation that nav clearance offset is calc(80px + var(--safe-area-bottom))
- HomeScreen.tsx comment block line range (~952-957) updated to reference 43-09
- 3 atomic commit hashes
- Phase 43 UAT Test 2 status: blocker resolved; Test 4 unblocked for re-test
</output>
