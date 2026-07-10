---
phase: 43-engagement-ui
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - app/src/hooks/useLongPress.ts
  - app/src/components/ui/BottomSheet.tsx
  - app/src/locales/en.json
  - app/src/locales/zh.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/src/locales/i18n.d.ts
  - app/tests/hooks/useLongPress.test.mjs
  - app/tests/components/LongPressMenu.test.mjs
  - app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs
  - app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs
  - app/tests/screens/SavedScreen.test.mjs
  - app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs
  - app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs
  - app/tests/screens/PostDetailScreen.abort-contract.test.mjs
  - app/tests/screens/HomeScreen.engagement-resync.test.mjs
  - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [ENGAGE-01, ENGAGE-02, ENGAGE-03, ENGAGE-04, CONTENT-01]
must_haves:
  truths:
    - "useLongPress hook exists at app/src/hooks/useLongPress.ts exposing 480ms timer + didLongPress ref pattern"
    - "BottomSheet accepts compact?: boolean prop that overrides minHeight to 'auto' and maxHeight to '50vh'"
    - "All 14 new i18n keys exist in all 4 locale bundles (en/zh/es/ja) — bundle-parity.test.mjs exits 0"
    - "All 9 Wave-0 test scaffold files exist under app/tests/ and exit 0 (skip-style stubs accepted)"
    - "ROADMAP.md Phase 43 Requirements line lists ENGAGE-01..03 + CONTENT-01 active + ENGAGE-04 descoped note (DS-01)"
    - "ROADMAP.md Phase 43 SC-4 (N-connections micro-label) replaced with a descope marker per DS-01"
    - "REQUIREMENTS.md ENGAGE-04 row moved from Active to Out of Scope; traceability matrix row updated; active-requirement count rebalanced"
  artifacts:
    - path: "app/src/hooks/useLongPress.ts"
      provides: "Shared 480ms long-press hook with pointer event handlers + didLongPress ref"
      contains: "didLongPress"
    - path: "app/src/components/ui/BottomSheet.tsx"
      provides: "Existing sheet + new compact prop for the 3-row engagement menu"
      contains: "compact"
    - path: "app/src/locales/en.json"
      provides: "Canonical EN bundle with engagement.*, saved.*, posts.detail.deepDive.* namespaces"
      contains: "engagement"
    - path: "app/tests/hooks/useLongPress.test.mjs"
      provides: "480ms timer + cancel-on-move behavioral test"
    - path: ".planning/ROADMAP.md"
      provides: "Phase 43 Requirements line aligned with active reqs; SC-4 struck per DS-01"
    - path: ".planning/REQUIREMENTS.md"
      provides: "ENGAGE-04 moved to Out of Scope; traceability matrix updated"
  key_links:
    - from: "app/src/hooks/useLongPress.ts"
      to: "consumers (MasonryFeed long-press wrapper in 43-03)"
      via: "named export { useLongPress }"
      pattern: "export function useLongPress"
    - from: "app/src/locales/en.json"
      to: "app/src/locales/{zh,es,ja}.json"
      via: "bundle-parity gate"
      pattern: "engagement"
    - from: ".planning/ROADMAP.md Phase 43 Requirements line"
      to: ".planning/REQUIREMENTS.md Out of Scope section"
      via: "consistent ENGAGE-04 descope reflected in both surfaces"
      pattern: "ENGAGE-04 descoped 2026-05-11"
---

<objective>
Wave-0 foundation plan for Phase 43. Lands the shared infrastructure that all other Phase 43 plans consume, so 43-02..43-07 can execute in parallel against stable contracts.

Five deliverables, each independently committable:

1. useLongPress(ms, callback) hook at app/src/hooks/useLongPress.ts — extracts the 480ms timer + didLongPress ref pattern from ChatMessage.tsx:119-140 into a reusable hook. Three Phase-43 consumers (MasonryFeed tile wrapper in 43-03, future surfaces) justify extraction. ChatMessage.tsx migration is OUT of scope.
2. BottomSheet.tsx compact prop — additive 2-line patch adding compact?: boolean that overrides minHeight to 'auto' and maxHeight to '50vh'.
3. i18n bundle keys — 14 new EN keys + 4-locale translations for engagement.menu.*, engagement.toast.*, saved.*, posts.detail.deepDive.* namespaces. Removes nothing (TS-01 newsTag removal lives in 43-02).
4. 9 test scaffold files — skip-style stubs that exit 0; downstream plans (43-02..43-07) fill in real assertions when their implementation lands.
5. ROADMAP.md + REQUIREMENTS.md doc edits for DS-01 descope — fold the source-of-truth doc updates into Wave 0 so Wave-1 executors read consistent ROADMAP/REQUIREMENTS state (the previous draft had this in 43-07 Wave 2, which left Wave-1 executors reading a stale "Requirements: ENGAGE-04" line during execution).

Purpose: Plans 43-02..43-07 are parallel-safe because they all depend only on Wave-0 artifacts AND consistent doc state. Output: 1 new hook file, 1 modified existing component, 5 modified locale files, 9 new test stub files, 2 doc edits. Zero new dependencies.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-RESEARCH.md
@.planning/phases/43-engagement-ui/43-UI-SPEC.md
@.planning/phases/43-engagement-ui/43-VALIDATION.md

# Reference implementations to read first
@app/src/components/ChatMessage.tsx
@app/src/components/ui/BottomSheet.tsx
@app/src/locales/en.json
@app/src/locales/i18n.d.ts

<interfaces>
Canonical 480ms long-press pattern (ChatMessage.tsx:119-140):
- useRef setTimeout + didLongPress ref
- onPointerDown starts timer; onPointerUp/Leave/Move cancels
- Timer firing sets didLongPress.current=true so consumer onClick can suppress

BottomSheet existing props (app/src/components/ui/BottomSheet.tsx):
- open: boolean
- onClose: () => void
- title?: string
- children: ReactNode
- NEW THIS PLAN: compact?: boolean — overrides minHeight/maxHeight

en.json structure to extend:
- existing top-level keys: common, home, planner, ask, review, graph, podcast, posts, settings, onboarding, questionDetail, infoFlow, ...
- ADD top-level: engagement, saved
- EXTEND nested: posts.detail.deepDive (under existing posts.detail at line 598)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create useLongPress hook at app/src/hooks/useLongPress.ts</name>
  <files>app/src/hooks/useLongPress.ts, app/tests/hooks/useLongPress.test.mjs</files>
  <read_first>
    - app/src/components/ChatMessage.tsx (read lines 115-145 — verbatim source pattern; useRef + setTimeout + pointer event handlers)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 1 "Long-press timing + cross-platform feel" lines 91-126 — extraction rationale + cross-platform gotchas)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Accessibility / Interaction Details — Long-press timer 480ms + Pointer event policy lines 612-625)
    - app/src/hooks/useInfiniteScroll.ts (existing hook pattern — naming + cleanup convention)
    - app/tests/hooks/useInfiniteScroll.test.mjs (existing test pattern for hooks; template for useLongPress.test.mjs)
    - app/tests/canonical-knowledge.test.mjs (canonical pure-logic test pattern; use this style if React render in tests is impractical)
  </read_first>
  <behavior>
    - Test 1: app/src/hooks/useLongPress.ts exists and exports useLongPress
    - Test 2: Hook signature accepts (ms: number, onLongPress: () => void)
    - Test 3: Hook return type: { didLongPress: React.MutableRefObject<boolean>; bind: { onPointerDown, onPointerUp, onPointerLeave, onPointerMove: () => void } }
    - Test 4: Source contains setTimeout (timer impl)
    - Test 5: Source does NOT contain 'contextmenu' or 'onContextMenu' (Android WebView native menu must not surface — RESEARCH Section 1)
    - Test 6: Source contains all 4 pointer-handler keys (onPointerDown, onPointerUp, onPointerLeave, onPointerMove)
    - Test 7: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Create app/src/hooks/useLongPress.ts with the following exact structure:

    ```typescript
    import { useRef, useEffect, useCallback } from 'react';

    /**
     * 480ms long-press hook — codebase-wide convention (see CLAUDE.md "Best practices",
     * RESEARCH.md Section 1, original pattern at ChatMessage.tsx:119-140).
     *
     * Returns:
     * - didLongPress: ref consumers check in their onClick handler to suppress the
     *   short-tap action after a long-press fires. Set to true when the timer
     *   elapses; reset to false on each pointerdown.
     * - bind: pointer event handlers to spread onto the target element.
     *
     * Pointer-event policy (do NOT change to touch events / contextmenu):
     * - onContextMenu is intentionally NOT registered — Android WebView surfaces the
     *   native text-selection menu on long-press if contextmenu is unhandled. The
     *   timer-only path avoids this (verified by the live ChatMessage.tsx pattern).
     * - onPointerMove cancels the timer so vertical scrolling never accidentally
     *   triggers a long-press.
     */
    export function useLongPress(ms: number, onLongPress: () => void) {
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const didLongPress = useRef(false);
      const callbackRef = useRef(onLongPress);

      // Keep latest callback in a ref so the timer always invokes the freshest closure
      useEffect(() => {
        callbackRef.current = onLongPress;
      }, [onLongPress]);

      const cancel = useCallback(() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }, []);

      const start = useCallback(() => {
        didLongPress.current = false;
        cancel();
        timerRef.current = setTimeout(() => {
          didLongPress.current = true;
          callbackRef.current();
        }, ms);
      }, [ms, cancel]);

      // Cleanup on unmount
      useEffect(() => {
        return () => cancel();
      }, [cancel]);

      const bind = {
        onPointerDown: start,
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerMove: cancel,
      };

      return { didLongPress, bind };
    }
    ```

    Also create app/tests/hooks/useLongPress.test.mjs as a source-reading + structural test (project convention; React render testing is not the project's standard pattern). Mirror the canonical-knowledge.test.mjs style:

    Required assertions in the test file:
    - File path exists at expected location
    - Source contains "export function useLongPress"
    - Source contains "didLongPress" at least twice
    - Source contains all four pointer-handler names
    - Source does NOT contain "contextmenu" or "onContextMenu"
    - Source contains "setTimeout"
    - File line count is at least 30

    Atomic commit message: feat(43): add useLongPress hook + test (480ms timer extracted from ChatMessage pattern)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && test -f src/hooks/useLongPress.ts && test -f tests/hooks/useLongPress.test.mjs && grep -q "export function useLongPress" src/hooks/useLongPress.ts && node --test tests/hooks/useLongPress.test.mjs && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File app/src/hooks/useLongPress.ts exists with at least 30 lines
    - grep -c "^export function useLongPress" app/src/hooks/useLongPress.ts returns 1
    - grep -c "didLongPress" app/src/hooks/useLongPress.ts returns at least 2
    - grep -E -c "onPointerDown|onPointerUp|onPointerLeave|onPointerMove" app/src/hooks/useLongPress.ts returns at least 4
    - grep -E -c "contextmenu|onContextMenu" app/src/hooks/useLongPress.ts returns 0
    - grep -c "setTimeout" app/src/hooks/useLongPress.ts returns at least 1
    - File app/tests/hooks/useLongPress.test.mjs exists
    - cd app && node --test tests/hooks/useLongPress.test.mjs exits 0
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>useLongPress hook + test ship as atomic commit; 43-03 can consume the hook.</done>
</task>

<task type="auto">
  <name>Task 2: Add compact prop to BottomSheet.tsx</name>
  <files>app/src/components/ui/BottomSheet.tsx</files>
  <read_first>
    - app/src/components/ui/BottomSheet.tsx (read full file — 76 lines; understand the existing inner sheet div at lines 29-72)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 2 "Bottom sheet implementation" lines 130-153 — patch rationale + 2-line spec)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "Component Specs §1 Long-press bottom-sheet menu" lines 182-198 — compact behavior: minHeight 'auto', maxHeight '50vh')
  </read_first>
  <action>
    Modify app/src/components/ui/BottomSheet.tsx with these three minimal edits:

    1. Update the BottomSheetProps interface (lines 7-12) to add compact?: boolean as the last property:
       compact?: boolean;  // when true, overrides minHeight to 'auto' and maxHeight to '50vh' (per Phase 43 LP-01 — 3-row engagement menu should not show 45vh empty space)

    2. Update function signature destructure (line 14) to include compact:
       export function BottomSheet({ open, onClose, title, children, compact }: BottomSheetProps) {

    3. Replace the existing minHeight: '45vh' and maxHeight: '75vh' literals (lines 40-41) with conditional ternaries:
       minHeight: compact ? 'auto' : '45vh',
       maxHeight: compact ? '50vh' : '75vh',

    Do NOT modify any other line. The transform animation, padding, border-radius, transition timing, title pill rendering — all unchanged.

    Before committing, run grep -rn "<BottomSheet" app/src/ to find existing consumers; confirm none pass a conflicting prop. (As of 2026-05-11, BottomSheet appears to have zero in-tree consumers, but verify.)

    Atomic commit message: feat(43): add BottomSheet compact prop for 3-row engagement menu
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "compact?: boolean" src/components/ui/BottomSheet.tsx && grep -q "compact ? 'auto' : '45vh'" src/components/ui/BottomSheet.tsx && grep -q "compact ? '50vh' : '75vh'" src/components/ui/BottomSheet.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "compact?: boolean" app/src/components/ui/BottomSheet.tsx returns 1
    - grep -c "compact ? 'auto' : '45vh'" app/src/components/ui/BottomSheet.tsx returns 1
    - grep -c "compact ? '50vh' : '75vh'" app/src/components/ui/BottomSheet.tsx returns 1
    - grep -c "compact" app/src/components/ui/BottomSheet.tsx returns at least 4 (interface + destructure + 2 ternary refs)
    - git diff app/src/components/ui/BottomSheet.tsx shows ONLY: prop interface addition, signature destructure addition, and 2 ternary literals replacing 2 fixed values. No other changes.
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>BottomSheet supports compact mode; LongPressMenu in 43-03 can render without a 45vh empty body.</done>
</task>

<task type="auto">
  <name>Task 3: Add 14 new i18n keys to all 4 locale bundles + update i18n.d.ts</name>
  <files>app/src/locales/en.json, app/src/locales/zh.json, app/src/locales/es.json, app/src/locales/ja.json, app/src/locales/i18n.d.ts</files>
  <read_first>
    - app/src/locales/en.json (read lines 590-770 — locate the existing posts.detail namespace at line 598; locate infoFlow.newsTag at line 743 to confirm what 43-02 will remove later)
    - app/src/locales/zh.json, es.json, ja.json (read same line range — confirm parallel structure)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "i18n Bundle Contract" lines 626-690 — VERBATIM key contract)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 11 "i18n bundle work" lines 446-509 — translation workflow + Sonnet subagent note)
    - app/scripts/translate-locales.md (Sonnet subagent prompt for non-EN translations)
    - app/src/locales/i18n.d.ts (existing module-augmentation type declarations)
    - CLAUDE.md "i18n Workflow (Phase 27+)" section — bundle-parity gate
  </read_first>
  <action>
    Add 14 EN-canonical keys to app/src/locales/en.json under these exact paths (VERBATIM from UI-SPEC § Copywriting Contract):

    NEW top-level namespace "engagement" (insert alphabetically — between "common" and "home", or wherever the file's existing alphabetical convention places it):
    {
      "menu": {
        "like": "Like",
        "unlike": "Unlike",
        "save": "Save",
        "unsave": "Unsave",
        "dismiss": "Not interested"
      },
      "toast": {
        "saved": "Saved",
        "unsaved": "Removed from saved",
        "liked": "Liked",
        "unliked": "Like removed",
        "dismissed": "Got it — you won't see this again"
      }
    }

    NEW top-level namespace "saved":
    {
      "title": "Saved",
      "tabs": {
        "saved": "Saved",
        "liked": "Liked"
      },
      "empty": {
        "savedTitle": "Nothing saved yet",
        "savedBody": "Long-press any tile to save a post",
        "likedTitle": "No liked posts yet",
        "likedBody": "Long-press any tile to like a post"
      }
    }

    EXTEND existing posts.detail namespace (en.json line 598) by adding a "deepDive" sub-object:
    "deepDive": {
      "cta": "Deep dive into this concept",
      "restoreStandard": "Restore standard",
      "toggleStandard": "Standard",
      "toggleDeep": "Deep",
      "streamingLabel": "Streaming deeper version…"
    }

    For zh.json, es.json, ja.json: run the Sonnet subagent at app/scripts/translate-locales.md per CLAUDE.md i18n workflow. The subagent receives the new EN keys and produces translated values for each non-EN locale. Human-review proper nouns (no Trellis-brand strings to translate here; all keys are generic UI copy). Spanish runs ~20% longer — note "Got it — you won't see this again" expansion for the dismiss toast.

    DO NOT REMOVE infoFlow.newsTag in this task — that removal lives in 43-02 (TS-01) as a separate atomic commit. Keep it intact across all 4 bundles for now.

    Update app/src/locales/i18n.d.ts module augmentation so tsc -b --noEmit recognizes the new keys. The exact mechanism (Resources typed interface, key-by-key declarations, etc.) follows the existing convention in that file. New top-level namespaces (engagement, saved) and the new nested posts.detail.deepDive subtree must all be typed so calling t('engagement.menu.save') etc. compiles cleanly across the 43-03..43-07 implementations.

    Atomic commit message: i18n(43): add engagement.*, saved.*, posts.detail.deepDive.* across 4 locales + type augmentation
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && for f in en zh es ja; do grep -q "\"engagement\":" "src/locales/$f.json" && grep -q "\"saved\":" "src/locales/$f.json" && grep -q "\"deepDive\":" "src/locales/$f.json" || exit 1; done && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - All 4 bundles contain "engagement": top-level key (grep "\"engagement\":" returns 1 per file)
    - All 4 bundles contain "saved": top-level key (grep "\"saved\":" returns 1 per file)
    - All 4 bundles contain "deepDive": key (grep "\"deepDive\":" returns 1 per file)
    - All 4 bundles contain "menu" + "toast" sub-keys inside engagement namespace
    - All 4 bundles contain "tabs" + "empty" sub-keys inside saved namespace
    - infoFlow.newsTag REMAINS in all 4 bundles (intact; TS-01 in 43-02 removes it)
    - cd app && node --test tests/locales/bundle-parity.test.mjs exits 0
    - cd app && node --test tests/locales/missing-key.test.mjs exits 0
    - cd app && npx tsc -b --noEmit exits 0
    - app/src/locales/i18n.d.ts contains type declarations for the new namespaces (grep "engagement\\|saved\\|deepDive" returns at least 3)
  </acceptance_criteria>
  <done>14 new keys present across all 4 locales; bundle-parity green; type augmentation prevents typo'd t() calls in 43-03..43-07.</done>
</task>

<task type="auto">
  <name>Task 4: Create 9 Wave-0 test scaffold files (skip-style stubs exiting 0)</name>
  <files>app/tests/components/LongPressMenu.test.mjs, app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs, app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs, app/tests/screens/SavedScreen.test.mjs, app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs, app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs, app/tests/screens/PostDetailScreen.abort-contract.test.mjs, app/tests/screens/HomeScreen.engagement-resync.test.mjs, app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs</files>
  <read_first>
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (lines 45-58 — full Expected Test Surfaces enumeration + Wave 0 Requirements list at lines 64-77)
    - app/tests/canonical-knowledge.test.mjs (canonical structural test pattern — copy the skeleton: import test from 'node:test'; import assert; one or two skipped test() blocks)
    - app/tests/components/InfoFlow.video-tap-emit.test.mjs (canonical source-reading invariant test pattern with grep + readFileSync)
    - app/tests/locales/bundle-parity.test.mjs (existing infrastructure — does NOT need a new stub; already gates from 43-01 Task 3)
  </read_first>
  <action>
    Create 9 stub test files. Each file:
    - imports node:test and node:assert
    - contains at least one test() block currently using { skip: true } OR a trivial assertion (e.g., assert.ok(true, 'scaffold')) so the file exits 0 when run
    - includes a top-of-file comment block listing the assertions the consumer plan (43-02 through 43-07) will fill in
    - file lives at the path listed in <files>

    File-by-file scaffold contract:

    1. app/tests/components/LongPressMenu.test.mjs (filled by 43-03):
       - TODO: opens on 480ms hold via useLongPress
       - TODO: dismisses on backdrop tap (BottomSheet onClose called)
       - TODO: calls engagementService.savePost / likePost / dismissAnchor on respective row tap
       - TODO: row labels flip Save→Unsave / Like→Unlike when isSaved/isLiked is true (LP-04)
       - NEGATIVE invariant: grep -c "CONCEPT_EXPLORED" app/src/components/LongPressMenu.tsx returns 0 (anti-wire from CONTEXT canonical_refs)

    2. app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs (filled by 43-03):
       - TODO: AnimatePresence wraps tile lists in both columns
       - TODO: ANCHOR_DISMISSED handler in HomeScreen filters ALL tiles with matching sourceQuestionIds[0] (LP-05 — not just the tapped tile)
       - TODO: motion.div exit prop is { opacity: 0, scale: 0.96 } with 200ms duration

    3. app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs (filled by 43-02):
       - TODO: grep -c "infoFlow.newsTag" app/src/components/InfoFlow.tsx returns 0 (TS-01 — element removed)
       - TODO: grep -c "newsTag" app/src/locales/en.json returns 0 (TS-01 — locale key removed across 4 bundles)

    4. app/tests/screens/SavedScreen.test.mjs (filled by 43-04):
       - TODO: lists posts from engagementService.getSavedPosts() on Saved tab
       - TODO: lists posts from engagementService.getLikedPosts() on Liked tab
       - TODO: renders empty state when active tab's list is empty
       - TODO: subscribes to ENGAGEMENT_CHANGED for in-place re-sync
       - TODO: Header renders with backTo='/home'
       - TODO: NOT-grep: position fixed Header ancestor with transform/will-change/filter (Phase 32.1 invariant)

    5. app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs (filled by 43-05):
       - TODO: source contains posts.detail.deepDive.cta key reference in the button slot region (lines 838-840)
       - TODO: DeepDiveButton rendered only when !isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && !post.bodyMarkdownDeep && !isStreamingDeep
       - TODO: Restore standard link rendered during isStreamingDeep && abortController.abort() called on tap
       - TODO: streaming-deep body slot conditional renders streamingDeep while isStreamingDeep
       - NOTE: segmented-control assertions live in a dedicated file (segmented-toggle.test.mjs, scaffold 6 below) per DD-04 / VALIDATION line 53

    6. app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs (filled by 43-05):
       - TODO (DD-04): segmented control rendered when typeof post.bodyMarkdownDeep === 'string' && length > 0 (post Deep-dive completion)
       - TODO (DD-04): tapping Standard segment displays standard bodyMarkdown without re-streaming (no generatePostEssay call inside onChange)
       - TODO (DD-04): tapping Deep segment displays cached bodyMarkdownDeep without re-streaming
       - TODO (DD-04): active-segment indicator visual matches UI-SPEC.md (var(--primary-40) background, white text, role="tab", aria-selected on active)
       - TODO: i18n keys posts.detail.deepDive.toggleStandard + posts.detail.deepDive.toggleDeep both referenced inside the segmented-control render branch

    7. app/tests/screens/PostDetailScreen.abort-contract.test.mjs (filled by 43-05):
       - TODO: source contains 3 (or 4) instances of "if (abortController.signal.aborted) return" pre-call guard (existing 3 from Phase 41 + new pre-deep-stream guard — count flexes during plan; assert minimum 3)
       - TODO: source contains 5 instances of "{ signal: abortController.signal }" or equivalent signal-arg pass (existing 4 from Phase 41 + new generatePostEssay({ depth: 'deep', signal }) call)
       - TODO: source contains "patchPostEssayInCache" + guarded by "!abortController.signal.aborted" (DD-05 invariant)
       - TODO: source does NOT call abortController.abort() outside the documented cleanup paths (back-nav cleanup, Restore Standard tap, postId change)

    8. app/tests/screens/HomeScreen.engagement-resync.test.mjs (filled by 43-06):
       - TODO: HomeScreen subscribes to ANCHOR_DISMISSED inside a useEffect (deps array MAY be empty `[]` for the stable event-listener pattern, per CLAUDE.md Phase 36-14 sibling-effects rule)
       - TODO: HomeScreen ALSO re-reads engagementService.getDismissedAnchors() inside a sibling useEffect whose deps array IS `[location.pathname]` (canonical resync pattern; satisfies CONTEXT.md "Always-mounted screen re-sync principle")
       - TODO: subscriber filters dailyPosts by p.sourceQuestionIds?.[0] !== anchorId (in-place; not refetch)
       - TODO: subscribes to ENGAGEMENT_CHANGED for corner-icon resync

    9. app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs (filled by 43-07):
       - TODO: source-reading: handleForceNewDay function body contains "engagementService.reset()" call
       - TODO: the call appears AFTER dailyReadService.reset() and BEFORE the success toast
       - TODO: grep -c "engagementService.reset" app/src/screens/settings/SettingsDataScreen.tsx returns at least 1

    Example file template (use for all 9):
    ```javascript
    // Wave-0 scaffold — assertions filled in by Phase 43 Plan 43-NN (see TODOs below).
    //
    // TODO from 43-NN:
    // - <assertion 1>
    // - <assertion 2>
    // - <assertion 3>

    import test from 'node:test';
    import assert from 'node:assert/strict';

    test('Phase 43 scaffold — pending implementation in 43-NN', { skip: 'Wave 0 stub; implementation lands in 43-NN' }, () => {
      assert.ok(true);
    });
    ```

    Each stub MUST exit 0 when run via node --test so sampling continuity holds. Atomic commit message: test(43): add 9 Wave-0 test scaffolds for engagement/saved/deep-dive/segmented-toggle/anti-wire
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && for f in tests/components/LongPressMenu.test.mjs tests/components/MasonryFeed.dismiss-fade-all.test.mjs tests/components/InfoFlow.no-presentation-style-tag.test.mjs tests/screens/SavedScreen.test.mjs tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs; do test -f "$f" || exit 1; done && node --test tests/components/LongPressMenu.test.mjs tests/components/MasonryFeed.dismiss-fade-all.test.mjs tests/components/InfoFlow.no-presentation-style-tag.test.mjs tests/screens/SavedScreen.test.mjs tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - All 9 test files exist at the paths listed in <files>
    - Each file contains "import test from 'node:test'" import
    - Each file contains at least one test() block
    - Each file contains a top-of-file comment block listing TODO assertions for the consumer plan (43-02..43-07)
    - cd app && node --test tests/components/LongPressMenu.test.mjs tests/components/MasonryFeed.dismiss-fade-all.test.mjs tests/components/InfoFlow.no-presentation-style-tag.test.mjs tests/screens/SavedScreen.test.mjs tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs exits 0
  </acceptance_criteria>
  <done>All 9 Wave-0 scaffolds in place; sampling continuity maintained; downstream plans grow assertions into them.</done>
</task>

<task type="auto">
  <name>Task 5: ROADMAP.md + REQUIREMENTS.md doc edits for DS-01 descope (moved here from 43-07 to keep Wave-1 executors on consistent doc state)</name>
  <files>.planning/ROADMAP.md, .planning/REQUIREMENTS.md</files>
  <read_first>
    - .planning/ROADMAP.md (read lines 1160-1175 — Phase 43 entry: Goal, Depends on, Requirements line, 6 Success Criteria items including SC-4 N-connections, Plans: TBD)
    - .planning/REQUIREMENTS.md (read lines 14-25 ENGAGE section + lines 54-62 Out of Scope + lines 68-92 traceability matrix + lines 95-103 phase ownership summary)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (DS-01 mechanical edits — lines 76-82; exact required mutations)
  </read_first>
  <action>
    These doc edits live in Wave 0 (NOT Wave 2 as originally drafted) so all Wave-1 executors (43-02..43-05) read consistent ROADMAP/REQUIREMENTS state during execution. Plan-checker BLOCKER 1 fix.

    ROADMAP.md edits (3 edits at Phase 43 entry near line 1161):

    Edit 1 — Requirements line (currently line 1164: "**Requirements**: ENGAGE-04"). Replace with:
    ```
    **Requirements**: ENGAGE-01, ENGAGE-02, ENGAGE-03, CONTENT-01 (UI wiring); ENGAGE-04 descoped 2026-05-11 (DS-01)
    <!-- ENGAGE-04 descoped 2026-05-11; see .planning/phases/43-engagement-ui/43-CONTEXT.md DS-01 -->
    ```

    Edit 2 — Phase 43 SC-4 (currently line 1169 reads "4. Each tile shows a 'N connections in your graph' micro-label computed from `candidatePack` at queue-fill time (no per-render graph traversal)"). Replace with:
    ```
      4. _(Descoped 2026-05-11 per DS-01: "N connections in your graph" micro-label dropped — operator framing "tiles already too rich". See `.planning/phases/43-engagement-ui/43-CONTEXT.md` DS-01.)_
    ```
    Leave SC-1, SC-2, SC-3, SC-5, SC-6 intact (the surrounding 5 success criteria).

    REQUIREMENTS.md edits (4 edits):

    Edit 1 — Remove ENGAGE-04 active row at line 19. The row currently reads:
    ```
    - [ ] **ENGAGE-04** Tile shows graph-derived social proof: "N connections in your graph" micro-label computed from `candidatePack` at queue-fill time
    ```
    Delete this single line. ENGAGE-01..03 rows (lines 16-18) remain intact.

    Edit 2 — Add ENGAGE-04 to "Out of Scope (explicit exclusions)" section (insert as a new bullet at the bottom of that section near line 62, after the "React 19.x minor bump mid-feature" bullet):
    ```
    - **ENGAGE-04 (N connections in your graph micro-label)** — descoped 2026-05-11 by operator framing "tiles already too rich; should simplify instead." Phase 43 ships TS-01 trim (presentation-style tag removal) instead. The `candidatePack`-derived connection count remains computable via `canonical-knowledge.service.ts:222` if a future cycle reverses this decision; reopen by adding a `connectionCount?: number` field to `DailyPost` and a populate site in `refillQueue`.
    ```

    Edit 3 — Update traceability matrix row for ENGAGE-04 at line 75. Currently:
    ```
    | ENGAGE-04   | Phase 43 | Wave 3 | Pending |
    ```
    Change to:
    ```
    | ENGAGE-04   | Phase 43 | Wave 3 | Out of Scope (DS-01, 2026-05-11) |
    ```

    Edit 4 — Update active-requirements header at line 66 (currently "22 / 22 requirements mapped — 100% coverage, no orphans."). Change to:
    ```
    21 / 21 active requirements mapped to phases (ENGAGE-04 descoped 2026-05-11 per DS-01 — see Out of Scope section).
    ```

    Edit 5 — Update Phase ownership summary line at line 101 (currently "- **Phase 43** (Wave 3): ENGAGE-04 (1 req)"). Change to:
    ```
    - **Phase 43** (Wave 3): 0 active reqs (engagement UI wiring; ENGAGE-04 descoped per DS-01)
    ```

    All five edits in one atomic commit. Do NOT touch any other line in either doc.

    Atomic commit message: docs(43): apply DS-01 descope to ROADMAP + REQUIREMENTS (Wave 0; consistent doc state for Wave-1 executors)
  </action>
  <verify>
    <automated>grep -q "Descoped 2026-05-11 per DS-01" /Users/Code/EchoLearn/.planning/ROADMAP.md && grep -q "ENGAGE-04 descoped 2026-05-11 (DS-01)" /Users/Code/EchoLearn/.planning/ROADMAP.md && ! grep -q "N connections in your graph\" micro-label computed" /Users/Code/EchoLearn/.planning/ROADMAP.md && grep -q "ENGAGE-04 (N connections in your graph micro-label)" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md && grep -q "Out of Scope (DS-01" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md && ! grep -q "ENGAGE-04 .* Tile shows graph-derived social proof" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md && grep -q "21 / 21 active requirements" /Users/Code/EchoLearn/.planning/REQUIREMENTS.md</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "Descoped 2026-05-11 per DS-01" .planning/ROADMAP.md returns at least 1
    - grep -c "ENGAGE-04 descoped 2026-05-11 (DS-01)" .planning/ROADMAP.md returns at least 1
    - grep -c "N connections in your graph\" micro-label computed" .planning/ROADMAP.md returns 0 (active SC-4 text removed; substring may persist inside the descope note text — that's fine, the active SC item is gone)
    - The 5 other SC items for Phase 43 (SC-1, SC-2, SC-3, SC-5, SC-6) remain intact
    - grep -c "ENGAGE-04 (N connections in your graph micro-label)" .planning/REQUIREMENTS.md returns 1 (Out of Scope bullet)
    - grep -c "descoped 2026-05-11" .planning/REQUIREMENTS.md returns at least 1
    - grep -c "Out of Scope (DS-01" .planning/REQUIREMENTS.md returns 1 (traceability matrix row)
    - grep -c "ENGAGE-04.*Tile shows graph-derived social proof" .planning/REQUIREMENTS.md returns 0 (active ENGAGE row removed)
    - grep -c "21 / 21 active requirements" .planning/REQUIREMENTS.md returns 1 (active count rebalanced)
    - ENGAGE-01, ENGAGE-02, ENGAGE-03 active rows remain intact (grep each returns at least 1)
  </acceptance_criteria>
  <done>ROADMAP + REQUIREMENTS reflect DS-01 from Wave 0; Wave-1 executors read consistent doc state.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0 (compiles cleanly with new hook + extended BottomSheet + new locale keys + type augmentation)
- cd app && node --test tests/hooks/useLongPress.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs exits 0
- cd app && node --test on each of the 9 new scaffold files exits 0 (skip-marked tests count as pass)
- grep -c "\"engagement\":" returns 1 in each of the 4 locale bundles
- grep -c "infoFlow.newsTag" still returns 1 in each of the 4 locale bundles (TS-01 in 43-02 removes it; Wave-0 must not pre-empt)
- ROADMAP.md Phase 43 Requirements line lists ENGAGE-01..03 + CONTENT-01 + ENGAGE-04 descoped note
- REQUIREMENTS.md ENGAGE-04 in Out of Scope; traceability matrix row updated; active-count rebalanced
</verification>

<success_criteria>
- useLongPress hook shipped with 480ms timer, didLongPress ref, 4 pointer-event handlers, no contextmenu handler
- BottomSheet.tsx now accepts compact?: boolean and overrides minHeight/maxHeight when true
- 14 new keys live in en/zh/es/ja with bundle-parity green
- i18n.d.ts type augmentation covers new keys so tsc blocks typos
- 9 Wave-0 test scaffolds exist (added PostDetailScreen.segmented-toggle.test.mjs to the original 8 — DD-04 dedicated scaffold per VALIDATION line 53); each exits 0 under node --test
- ROADMAP + REQUIREMENTS reflect DS-01 descope from Wave 0 so Wave-1 plans (43-02..43-05) read consistent doc state
- Zero new dependencies introduced
- Atomic per-task commits: 5 commits total (one per task; paired src+test where applicable)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-01-SUMMARY.md documenting:
- useLongPress.ts line count + test outcome
- BottomSheet.tsx diff (3-line patch confirmation)
- Locale-bundle key count delta per locale (en.json should grow by 14 keys; zh/es/ja parity)
- Confirmation that bundle-parity.test.mjs is green
- Confirmation that infoFlow.newsTag is INTACT in all 4 bundles (will be removed in 43-02)
- 9 Wave-0 scaffold files listed with their target consumer plans
- ROADMAP.md + REQUIREMENTS.md DS-01 diff confirmation
- 5 atomic commit hashes
</output>
