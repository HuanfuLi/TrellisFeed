---
phase: 43-engagement-ui
plan: 12
plan_id: 43-12
slug: deep-dive-controls-above-essay-body
type: execute
wave: 4
depends_on: []
files_modified:
  - app/src/screens/PostDetailScreen.tsx
  - app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs
  - .planning/phases/43-engagement-ui/43-CONTEXT.md
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 2-3
requirements: [CONTENT-01]
must_haves:
  truths:
    - "Deep Dive button (pre-stream) AND Standard | Deep segmented toggle (post-stream/cached) render ABOVE the essay body container"
    - "Scroll-70% sentinel (Detector A — CONCEPT_EXPLORED emit) stays in its current position immediately after the essay body, NOT moved"
    - "renderDeepDiveControls() internals (16 abort guards + 6 signal-arg passes + cache-write guard + abort cascades) are NOT touched"
    - "DD-01 positional test updated to assert invocation BEFORE essay-body container (anchored on minHeight: 200px); invocation BEFORE takeaway assertion preserved (naturally satisfied)"
    - "43-CONTEXT.md updated to document the DD-01 placement decision change (DS-02 — operator update on 2026-05-11)"
  artifacts:
    - path: "app/src/screens/PostDetailScreen.tsx"
      provides: "Single JSX block move: renderDeepDiveControls() invocation relocated from after essay-body (line ~1046) to above essay-body (between video AI-summary heading and essay body container at ~line 985-987)"
    - path: "app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs"
      provides: "DD-01 positional assertion updated: sentinelJsxIdx < invocationIdx replaced with invocationIdx < essayBodyContainerIdx (anchored on minHeight: '200px'); invocationIdx < takeawayIdx preserved"
    - path: ".planning/phases/43-engagement-ui/43-CONTEXT.md"
      provides: "DS-02 decision-change note documenting placement update (below body → above body) per operator UAT feedback 2026-05-11"
  key_links:
    - from: "PostDetailScreen.tsx renderDeepDiveControls() invocation"
      to: "essay body container (minHeight: 200px)"
      via: "JSX sibling order — invocation now precedes the essay body container"
      pattern: "renderDeepDiveControls\\(\\)"
---

<objective>
Gap-closure plan for UAT Test 7 (severity: minor).

NOT a bug — operator updated the Phase 43-05 placement decision. Original CONTEXT specified DD-01 button "below essay body, above takeaway". Operator UAT feedback: "the toggle appeared below essay instead of above essay... You are right to design it above essay, I guess the prior decision was confusing."

Root cause (from `.planning/debug/deep-dive-toggle-below-essay-body.md`): in PostDetailScreen.tsx, `renderDeepDiveControls()` invocation sits at line 1046 — inside `<article>`, AFTER the essay-body container `<div style={{ minHeight: '200px' ...}}>` (lines 986-1039) and AFTER the scroll-70% sentinel (lines 1040-1041), BEFORE the takeaway block (lines 1047-1062). Single function returns three JSX trees (Restore Standard / segmented Standard|Deep / DeepDiveButton CTA) — ONE invocation move relocates ALL three surfaces.

Fix: relocate the single invocation line 1042-1046 (the entire `{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}` gate + invocation, plus its 4-line comment) to BETWEEN the video AI-summary heading end (line 985, closing `)}`) and the essay body container opener (line 987, `<div style={{ minHeight: '200px', marginBottom: '20px' }}>`). Leave the scroll-sentinel at line 1041 in place — Detector A is structurally bound to "essay body has been scrolled past".

Update the DD-01 test (`tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` lines 28-45): replace `sentinelJsxIdx < invocationIdx` with `invocationIdx < essayBodyContainerIdx` (anchored on `minHeight: '200px'`). Keep `invocationIdx < takeawayIdx` (naturally satisfied — invocation moves earlier in source order, takeaway stays where it is).

Document the placement decision change in 43-CONTEXT.md as DS-02 ("Deep-dive controls placement updated 2026-05-11 — UAT feedback").

Purpose: align Deep Dive button + Standard|Deep segmented toggle placement with operator's updated preference. NO behavior change to renderDeepDiveControls internals (DD-02 visual styling, DD-03 streaming state, DD-04 segmented toggle handler, DD-05 abort contract all preserved byte-for-byte).
Output: single JSX block relocation in PostDetailScreen.tsx + DD-01 test assertion update + CONTEXT.md DS-02 note.

**Parallel-safety note:** This plan touches PostDetailScreen.tsx only inside the `<article>` block at lines ~985-1046, and only updates the DD-01 test (DD-02/DD-03 left alone). The other tests in the deep-dive triad (segmented-toggle.test.mjs, abort-contract.test.mjs) are NOT touched per diagnosis — those tests assert internal structure (segments, handlers, abort cascades) without positional anchors relative to essay body. No other plan in this wave touches PostDetailScreen.tsx. Fully parallel-safe.
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
@.planning/debug/deep-dive-toggle-below-essay-body.md

# CLAUDE.md (no specific section directly relevant — placement update is a JSX-only move)
@CLAUDE.md

# Source-of-truth files
@app/src/screens/PostDetailScreen.tsx
@app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs
@app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs
@app/tests/screens/PostDetailScreen.abort-contract.test.mjs

<interfaces>
From app/src/screens/PostDetailScreen.tsx current <article> structure (lines 957-1063):
- ~969-971: context label paragraph (CATEGORY · narrativeMode)
- ~972: <h1> title
- ~973-975: whyCare paragraph
- ~976-985: video AI-summary heading (video posts only) — closes with `)}`
- ~986: comment `{/* Essay body — shell always rendered, content streams in */}`
- ~987: essay body container opens — `<div style={{ minHeight: '200px', marginBottom: '20px' }}>`
- ~988-1038: branches (onEnterError / isStreamingOnEnter / isStreamingDeep / activeVariant === 'deep' / post.bodyMarkdown / null)
- ~1039: essay body container close `</div>`
- ~1040: comment `{/* Scroll 70% sentinel — placed between essay body and takeaway (D-04) */}`
- ~1041: <div ref={scrollSentinelRef} style={{ height: '1px' }} /> — Detector A (CONCEPT_EXPLORED emit) — STAYS IN PLACE
- ~1042-1045: comment `{/* Phase 43 DD-01 — deep-dive controls slot. ... */}`
- ~1046: `{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}` — TARGET TO MOVE
- ~1047-1062: takeaway block
- ~1063: </article>

renderDeepDiveControls() function declaration at lines 595-702 — NOT touched in this plan. Returns one of three JSX trees:
- isStreamingDeep → Restore Standard link (line ~599)
- post.bodyMarkdownDeep → segmented Standard|Deep control (line ~624-671)
- default → DeepDiveButton CTA (line ~674-701)

Test DD-01 (tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs lines 28-45):
- Currently asserts: sentinelJsxIdx < invocationIdx AND invocationIdx < takeawayIdx
- After move: invocation moves BEFORE the essay body, so sentinelJsxIdx > invocationIdx (sentinel is after essay body which is after invocation). Need to INVERT or REPLACE the sentinel assertion.
- Recommended replacement: invocationIdx < essayBodyContainerIdx where essayBodyContainerIdx anchors on the first `minHeight: '200px'` literal in the file (unique to the essay body shell).
- invocationIdx < takeawayIdx: still true naturally (invocation moves earlier, takeaway stays); keep the assertion.

Tests NOT touched in this plan:
- tests/screens/PostDetailScreen.segmented-toggle.test.mjs (DD-04 internals — no positional anchors)
- tests/screens/PostDetailScreen.abort-contract.test.mjs (DD-05 abort cascade — no positional anchors)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Relocate renderDeepDiveControls() invocation from after-body to above-body</name>
  <files>app/src/screens/PostDetailScreen.tsx</files>
  <read_first>
    - app/src/screens/PostDetailScreen.tsx lines 960-1070 (full <article> block — source + target context)
    - .planning/debug/deep-dive-toggle-below-essay-body.md "Resolution" section — single-point JSX move rationale
    - renderDeepDiveControls function lines 595-702 — confirm internals are NOT touched
  </read_first>
  <action>
    Single JSX block move within app/src/screens/PostDetailScreen.tsx.

    Step 1 — REMOVE the existing block at lines ~1042-1046:

    ```jsx
            {/* Phase 43 DD-01 — deep-dive controls slot. Renders DeepDiveButton OR
                Restore Standard link OR Standard|Deep segmented control based on state.
                Gated by !isStreamingOnEnter && (post.bodyMarkdown || streamingBody) so it
                never shows during the initial essay-stream warm-up. */}
            {!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}
    ```

    Step 2 — INSERT the same block (with an updated comment) BETWEEN the video AI-summary heading end (line ~985, closing `)}`) and the essay body container open (line ~987, the `{/* Essay body — shell always rendered ... */}` comment):

    ```jsx
            {/* Phase 43 DD-01 (placement updated 2026-05-11 per UAT Test 7 / 43-12):
                deep-dive controls slot positioned ABOVE the essay body so users see
                the depth-control affordance BEFORE reading. Renders DeepDiveButton OR
                Restore Standard link OR Standard|Deep segmented control based on state.
                Gated by !isStreamingOnEnter && (post.bodyMarkdown || streamingBody) so
                it never shows during the initial essay-stream warm-up. */}
            {!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}
    ```

    Step 3 — Verify scroll-sentinel comment + ref STAYS at lines ~1040-1041 (Detector A — CONCEPT_EXPLORED emit). DO NOT move the sentinel. The comment may now read slightly differently relative to the controls slot — that is fine. Optionally adjust the sentinel comment to remove the "placed between essay body and takeaway" copy if confusing, but this is not required.

    Step 4 — Confirm no other JSX block was perturbed. Specifically:
    - Essay body container (`<div style={{ minHeight: '200px', marginBottom: '20px' }}>`) at ~line 987 — unchanged.
    - Takeaway block (~lines 1047-1062) — unchanged.
    - renderDeepDiveControls function declaration (~lines 595-702) — unchanged.
    - handleStartDeepDive / handleRestoreStandard / deepAbortControllerRef internals — unchanged.

    Key details:
    - Single contiguous block (~5 lines including comment) is being moved. No internal change. The gate expression `!isStreamingOnEnter && (post.bodyMarkdown || streamingBody)` is preserved verbatim — it doesn't depend on JSX order, only on state.
    - DO NOT touch renderDeepDiveControls's internal marginTop / marginBottom values (currently marginTop: '20px' or '8px', marginBottom: '16px' or '8px'). These continue to work for the new placement (marginBottom-16px is now the gap to the essay body; marginTop-20px is the gap to the whyCare paragraph or video AI-summary heading above). Visual fine-tuning is out of scope for this gap closure.
    - DO NOT add a new wrapper div around the controls block. Sibling-of-essay-body placement is the operator's request.

    Atomic commit message: fix(43-12): move Deep Dive controls above essay body (operator placement update)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node -e "const fs=require('fs');const s=fs.readFileSync('src/screens/PostDetailScreen.tsx','utf8');const inv=s.lastIndexOf('renderDeepDiveControls()');const body=s.indexOf('minHeight: \\'200px\\'');const take=s.indexOf('takeawayHeading');if(inv<=0||body<=0||take<=0)process.exit(1);if(inv>=body){console.error('invocation must be BEFORE essay body container');process.exit(2);}if(inv>=take){console.error('invocation must be BEFORE takeaway block');process.exit(3);}console.log('placement OK');" && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - renderDeepDiveControls() invocation index in PostDetailScreen.tsx is BEFORE the first `minHeight: '200px'` literal (essay body container anchor)
    - renderDeepDiveControls() invocation index is BEFORE the `takeawayHeading` reference (preserved naturally)
    - Scroll-sentinel `ref={scrollSentinelRef}` is still present in source (Detector A preserved)
    - renderDeepDiveControls function declaration (lines 595-702 range) unchanged in line count
    - handleStartDeepDive / handleRestoreStandard / deepAbortControllerRef declarations unchanged
    - cd app && npx tsc -b --noEmit exits 0
    - cd app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs exits 0 (DD-04 + DD-05 unaffected)
  </acceptance_criteria>
  <done>Deep Dive button + segmented toggle now render above essay body; sentinel + abort contract intact.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update DD-01 test positional assertion to lock above-body placement</name>
  <files>app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs</files>
  <read_first>
    - app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs lines 1-75 (full file, focus on DD-01 test at lines 28-45)
    - app/src/screens/PostDetailScreen.tsx post-Task 1 (verify invocation index relative to essay-body anchor)
    - .planning/debug/deep-dive-toggle-below-essay-body.md "Resolution" section — recommended new assertion shape
  </read_first>
  <action>
    Update the DD-01 test in `tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs`. Single test rewrite; do NOT touch DD-02 / DD-03 / DD-03-handler tests.

    REPLACE the existing DD-01 test (lines 28-45) entirely:

    ```js
    test('DD-01: deep-dive controls slot rendered between scroll sentinel and takeaway', () => {
      const sentinelIdx = src.indexOf('scrollSentinelRef');
      const renderIdx = src.indexOf('renderDeepDiveControls');
      const takeawayIdx = src.indexOf('takeawayHeading');
      assert.ok(sentinelIdx > 0, 'scrollSentinelRef must exist in source');
      assert.ok(renderIdx > 0, 'renderDeepDiveControls must be declared');
      assert.ok(takeawayIdx > 0, 'takeawayHeading i18n key must be referenced');
      // The renderDeepDiveControls INVOCATION must appear after the sentinel JSX and
      // before the takeaway block. Find the *invocation* (last occurrence) — the
      // function declaration comes earlier in the file.
      const invocationIdx = src.lastIndexOf('renderDeepDiveControls()');
      assert.ok(invocationIdx > 0, 'renderDeepDiveControls() must be invoked in the render tree');
      // Locate the scroll-sentinel JSX line (different from the ref declaration above).
      const sentinelJsxIdx = src.indexOf('ref={scrollSentinelRef}');
      assert.ok(sentinelJsxIdx > 0, 'scrollSentinelRef must be attached to a JSX element');
      assert.ok(sentinelJsxIdx < invocationIdx, 'renderDeepDiveControls() must render AFTER the scroll-sentinel JSX');
      assert.ok(invocationIdx < takeawayIdx, 'renderDeepDiveControls() must render BEFORE the takeaway block');
    });
    ```

    With the updated above-body placement assertion:

    ```js
    test('DD-01: deep-dive controls slot rendered ABOVE the essay body (operator placement update 2026-05-11)', () => {
      // Placement decision change per UAT Test 7 (gap-closure plan 43-12): the
      // Deep Dive button + Standard|Deep segmented toggle now render ABOVE the
      // essay body so users see the depth-control affordance BEFORE reading.
      // Originally Phase 43-05 placed the invocation between the scroll-sentinel
      // and the takeaway; UAT Test 7 confirmed operator's updated preference is
      // "above essay body". See .planning/debug/deep-dive-toggle-below-essay-body.md.

      const renderIdx = src.indexOf('renderDeepDiveControls');
      const takeawayIdx = src.indexOf('takeawayHeading');
      assert.ok(renderIdx > 0, 'renderDeepDiveControls must be declared');
      assert.ok(takeawayIdx > 0, 'takeawayHeading i18n key must be referenced');

      // The renderDeepDiveControls INVOCATION (last occurrence — function
      // declaration comes earlier).
      const invocationIdx = src.lastIndexOf('renderDeepDiveControls()');
      assert.ok(invocationIdx > 0, 'renderDeepDiveControls() must be invoked in the render tree');

      // Essay body container anchor: the first `minHeight: '200px'` literal in
      // the file is the essay-body shell's inline style. This anchor is unique
      // to the essay body container and stable across other placement edits.
      const essayBodyIdx = src.indexOf("minHeight: '200px'");
      assert.ok(essayBodyIdx > 0, 'essay body container with minHeight: 200px must exist');

      // New placement contract: invocation appears BEFORE the essay body container
      // AND BEFORE the takeaway block. The scroll sentinel (Detector A) stays in
      // its current position immediately after the essay body and is NOT part of
      // the placement contract anymore.
      assert.ok(
        invocationIdx < essayBodyIdx,
        'renderDeepDiveControls() must render BEFORE the essay body container (minHeight: 200px anchor)',
      );
      assert.ok(
        invocationIdx < takeawayIdx,
        'renderDeepDiveControls() must render BEFORE the takeaway block (naturally satisfied by above-body placement)',
      );

      // Verify Detector A scroll-sentinel is still present (placement move did
      // NOT regress the sentinel — DD-A invariant from Phase 30 D-04 preserved).
      const sentinelJsxIdx = src.indexOf('ref={scrollSentinelRef}');
      assert.ok(
        sentinelJsxIdx > 0,
        'scrollSentinelRef JSX must still be present — Detector A (CONCEPT_EXPLORED emit) is unrelated to the controls placement',
      );
    });
    ```

    DO NOT touch:
    - DD-02 test (Sparkles + primary-40 + i18n key) — unchanged.
    - DD-03 test (streamingDeep + handleRestoreStandard) — unchanged.
    - DD-03 handler test (deep controller abort + activeVariant reset) — unchanged.

    Atomic commit message: test(43-12): update DD-01 positional assertion for above-body placement
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - DD-01 test references "ABOVE the essay body" and asserts invocationIdx < essayBodyIdx
    - DD-01 test still asserts invocationIdx < takeawayIdx (preserved)
    - DD-01 test still asserts scrollSentinelRef JSX is present (Detector A preserved)
    - DD-02 + DD-03 + DD-03-handler tests unchanged
    - cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs exits 0
    - cd app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs exits 0
  </acceptance_criteria>
  <done>DD-01 invariant locks above-body placement.</done>
</task>

<task type="auto">
  <name>Task 3: Document the DD-01 placement decision change in 43-CONTEXT.md as DS-02</name>
  <files>.planning/phases/43-engagement-ui/43-CONTEXT.md</files>
  <read_first>
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (focus on the DD-* section + Descopes section to see DS-01 pattern)
  </read_first>
  <action>
    Single additive edit to .planning/phases/43-engagement-ui/43-CONTEXT.md.

    Locate the existing `### Descopes (DS-*)` section (currently contains DS-01 ENGAGE-04 descope). Add a new DS-02 entry immediately after DS-01:

    ```markdown
    - **DS-02:** **DD-01 placement decision UPDATED 2026-05-11 (UAT Test 7).** Original Phase 43-05 CONTEXT specified Deep Dive button + Standard|Deep segmented toggle placement as "below essay body, above takeaway" (between the scroll-70% sentinel and the takeaway block). Operator UAT feedback: "the toggle appeared below essay instead of above essay. You are right to design it above essay, I guess the prior decision was confusing." Updated placement: **deep-dive controls render ABOVE the essay body** so users see the depth-control affordance BEFORE reading. The scroll-70% sentinel (Detector A — CONCEPT_EXPLORED emit) stays in place; only the `renderDeepDiveControls()` invocation moves. **No changes to handleStartDeepDive / handleRestoreStandard internals (DD-03 streaming) or to the segmented toggle handler (DD-04) or to the AbortController contract (DD-05).** Closed by gap-closure plan 43-12. See `.planning/debug/deep-dive-toggle-below-essay-body.md` for full diagnosis.
    ```

    Indent + bullet style must match the existing DS-01 entry. Use the same `- **DS-XX:**` prefix and bolded title cadence.

    Atomic commit message: docs(43-12): add DS-02 to CONTEXT — DD-01 placement updated above essay body
  </action>
  <verify>
    <automated>grep -q "DS-02" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-CONTEXT.md && grep -q "above essay body" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-CONTEXT.md && grep -q "43-12" /Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-CONTEXT.md</automated>
  </verify>
  <acceptance_criteria>
    - grep "DS-02" returns at least 1
    - grep "above essay body" returns at least 1 (the new decision text)
    - grep "43-12" returns at least 1 (this gap-closure plan referenced)
  </acceptance_criteria>
  <done>Decision-change documented; DS-01 + DS-02 now both visible in CONTEXT.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs exits 0 (all three deep-dive test surfaces green)
- cd app && node --test tests/screens/ exits 0
- cd app && npm run build exits 0
- Manual UAT (post-merge): open any post detail with cached bodyMarkdownDeep — Standard|Deep segmented toggle visible ABOVE essay body (between video AI-summary heading and essay body); tap Standard → standard variant renders below; tap Deep → deep variant renders below; no re-stream, no scroll drift.
</verification>

<success_criteria>
- renderDeepDiveControls() invocation index < essay body container index (minHeight: '200px' anchor)
- renderDeepDiveControls() invocation index < takeawayHeading index (preserved naturally)
- Scroll-sentinel ref={scrollSentinelRef} still in source (Detector A preserved)
- DD-01 test updated; DD-02 / DD-03 / DD-04 / DD-05 tests untouched
- 43-CONTEXT.md contains DS-02 entry documenting the placement decision change
- Total 3 atomic commits (PostDetail source, DD-01 test update, CONTEXT.md DS-02)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-12-deep-dive-controls-above-essay-body-SUMMARY.md documenting:
- PostDetailScreen.tsx invocation line range before/after the move (approximate)
- Confirmation: invocation < essay body container AND < takeaway block
- Confirmation: scroll-sentinel + renderDeepDiveControls internals untouched
- DD-01 test new assertion shape
- CONTEXT.md DS-02 entry text
- 3 atomic commit hashes
- Phase 43 UAT Test 7 status: placement gap resolved (above-body)
</output>
