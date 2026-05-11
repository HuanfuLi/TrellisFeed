---
status: resolved
trigger: "deep-dive-toggle-below-essay-body — operator wants Deep Dive button + Standard|Deep segmented toggle ABOVE essay body (not between body and takeaway)"
created: 2026-05-11T00:00:00Z
updated: 2026-05-11T13:40:00Z
---

## Current Focus

hypothesis: The `{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}` invocation sits AFTER the essay-body `<div>` and BEFORE the takeaway block inside `<article>`. Moving the invocation to BEFORE the essay-body `<div>` (and BEFORE the scroll sentinel) relocates BOTH the DeepDiveButton AND the segmented toggle "above the essay body" as requested.
test: Static source read — placement is purely declarative JSX position; no runtime reproduction needed.
expecting: A single JSX block relocation inside `PostDetailScreen.tsx` `<article>`, plus a positional-assertion update in `tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` (DD-01).
next_action: Return ROOT CAUSE FOUND.

## Symptoms

expected: |
  Deep Dive button (pre-stream) AND Standard | Deep segmented toggle (post-stream) render
  ABOVE the essay body on PostDetailScreen. Takeaway remains at the bottom. Nothing
  between essay body and takeaway.
actual: |
  Both the Deep Dive button AND the segmented toggle render BETWEEN the essay body
  and the takeaway section.
errors: None — placement-decision update only.
reproduction: Test 7 in 43-UAT.md (open any PostDetailScreen).
started: Operator-decision update on 2026-05-11 (original Phase 43-05 CONTEXT specified "below body / above takeaway").

## Eliminated

(none — straightforward diagnosis)

## Evidence

- timestamp: 2026-05-11
  checked: PostDetailScreen.tsx line 957-1063 (the <article> render block)
  found: |
    Vertical order inside <article>:
      969-971  : context label paragraph ("CATEGORY · narrativeMode")
      972      : <h1> title
      973-975  : whyCare paragraph
      976-985  : video AI summary heading (video posts only)
      986-1039 : essay body slot (<div style="minHeight: 200px"> containing onEnterError /
                 isStreamingOnEnter / isStreamingDeep / activeVariant==='deep' /
                 post.bodyMarkdown branches)
      1040-1041: scroll-70% sentinel <div ref={scrollSentinelRef}>
      1042-1046: deep-dive controls slot invocation
                 ({!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()})
      1047-1062: takeaway block
  implication: The deep-dive controls invocation sits between sentinel + takeaway, after the essay body div. Both the DeepDiveButton (default branch in renderDeepDiveControls) and the segmented Standard|Deep toggle (deepCached branch) are rendered through this single invocation point — moving the invocation moves both.

- timestamp: 2026-05-11
  checked: renderDeepDiveControls function (line 595-702)
  found: |
    Single function returns three possible JSX trees based on state:
      - isStreamingDeep         → Restore Standard link
      - post.bodyMarkdownDeep   → Standard|Deep segmented control (line 624-671)
      - default                 → DeepDiveButton (line 674-701)
    All three are rendered at the SAME invocation site (line 1046). One placement
    change moves all three.
  implication: This is a single-point JSX move — no need to thread the invocation through multiple sites.

- timestamp: 2026-05-11
  checked: tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs (DD-01 test, lines 28-45)
  found: |
    DD-01 test asserts THREE positional constraints:
      1. renderDeepDiveControls() invocation index > scroll-sentinel JSX index
      2. renderDeepDiveControls() invocation index < takeaway block index
      3. (implicit) sentinel JSX exists in source
    If the controls move ABOVE the essay body, both constraints (1) and (2) flip:
    invocation will be BEFORE the sentinel AND BEFORE the takeaway block.
  implication: DD-01 test MUST be updated. Two assertions need to invert:
    - assert.ok(sentinelJsxIdx < invocationIdx, ...) → REMOVE or invert (sentinelJsxIdx > invocationIdx)
    - assert.ok(invocationIdx < takeawayIdx, ...) → still true (passes naturally; controls above body ⇒ still before takeaway, so this assertion remains valid)
    Recommended new framing for the relocated test: assert that the controls invocation appears BEFORE the essay-body container div (e.g., before the `minHeight: '200px'` style declaration or before the onEnterError ternary).

- timestamp: 2026-05-11
  checked: tests/screens/PostDetailScreen.segmented-toggle.test.mjs
  found: |
    DD-04 tests assert internal structure of the segmented control (gate, role,
    onChange handler, active-segment styling, i18n keys, minHeight 44px). NONE of
    them assert positional anchors relative to essay body, scroll sentinel, or
    takeaway. Safe — no update needed.
  implication: Only deep-dive-trigger.test.mjs DD-01 needs an update.

- timestamp: 2026-05-11
  checked: tests/screens/PostDetailScreen.abort-contract.test.mjs (referenced but not read in this session)
  found: |
    Phase 43-05 SUMMARY describes this file as guarding the 16 pre-call abort guards
    + 6 signal-arg passes + cache-write guard. None of those are positional JSX
    invariants relative to essay body. Per the symptoms guardrails, the abort
    contract must remain untouched anyway. Moving the JSX invocation does NOT
    touch handleStartDeepDive / handleRestoreStandard internals.
  implication: No update expected to abort-contract.test.mjs. Verify quickly during the fix patch as a regression check.

- timestamp: 2026-05-11
  checked: Inline-style marginTop values inside renderDeepDiveControls (line 599, 635, 682)
  found: |
    All three render branches use marginTop: '20px' or '8px' and marginBottom:
    '16px' or '8px'. After relocation ABOVE the essay body, the marginBottom-16px
    will now serve as the gap to the essay body (currently it served as the gap
    to the takeaway). marginTop is the gap to the whyCare paragraph above. Both
    values look fine for the new placement; minor visual tuning may be a follow-up
    polish but not a correctness issue.
  implication: Cosmetic margins likely OK as-is; flag for visual UAT after the move.

## Resolution

root_cause: |
  In `app/src/screens/PostDetailScreen.tsx`, the deep-dive controls invocation
  `{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}`
  is placed at line 1046 — inside `<article>`, AFTER the essay-body container div
  (lines 986-1039) and AFTER the scroll-70% sentinel (lines 1040-1041), BEFORE the
  takeaway block (lines 1047-1062). This matches the original Phase 43-05 CONTEXT
  placement ("below body / above takeaway"). Operator's updated preference is
  "above essay body" — so the invocation must move to BEFORE the essay-body
  container div.

  Because `renderDeepDiveControls()` is a single function that returns one of
  three JSX trees (Restore Standard link / segmented Standard|Deep toggle /
  DeepDiveButton CTA) depending on state, ONE invocation move relocates all
  three surfaces. The gate
  `!isStreamingOnEnter && (post.bodyMarkdown || streamingBody)`
  still works at the new position — it does not depend on JSX order, only on
  state. The isStreamingOnEnter gate ensures the controls don't appear during
  the initial body warm-up, which the operator's "see depth-control affordance
  before reading" intent fully supports (no controls before there is content
  to deepen).

fix: |
  Move line 1046 (the `{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody)
  && renderDeepDiveControls()}` invocation) from its current position (after
  scroll sentinel, before takeaway) to a position BEFORE the essay-body `<div
  style={{ minHeight: '200px', marginBottom: '20px' }}>` opener at line 987.
  Suggested target: immediately after the video AI-summary heading block (ends
  at line 985) and before line 987.

  The scroll sentinel (line 1041) should stay where it is — it is unrelated to
  the deep-dive controls and is required by Detector A (Phase 30 D-04) at the
  70% scroll mark, which is structurally tied to "essay body has been scrolled
  past."

  Tests to update:
    - tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs DD-01 (lines 28-45):
      remove or invert the `sentinelJsxIdx < invocationIdx` assertion; replace
      with an assertion that the invocation appears BEFORE the essay-body
      container (e.g., before `minHeight: '200px'` style declaration or before
      the first onEnterError check).
    - tests/screens/PostDetailScreen.segmented-toggle.test.mjs: no changes needed.
    - tests/screens/PostDetailScreen.abort-contract.test.mjs: no changes expected
      (does not assert JSX position).

verification: pending — operator UAT re-test of Test 7 after fix.
files_changed: []
