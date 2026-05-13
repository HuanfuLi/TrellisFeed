---
phase: 38-v1-4-carry-over-cleanup
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/index.ts
  - app/src/services/youtube.service.ts
  - app/src/services/concept-feed.service.ts
  - app/src/services/style-assignment.ts
  - app/src/components/InfoFlow.tsx
  - app/src/screens/PostDetailScreen.tsx
  - app/src/services/post-essay.service.ts
  - app/src/locales/en.json
  - app/src/locales/zh.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/tests/components/InfoFlow.video-tap-emit.test.mjs
  - app/tests/services/youtube-no-short-classification.test.mjs
  - app/tests/services/style-assignment.test.mjs
  - app/tests/services/style-assignment-stratified.test.mjs
  - app/tests/services/refill-queue-integration.test.mjs
  - app/tests/concept-quota.test.mjs
  - app/tests/services/post-essay.service.test.mjs
  - CLAUDE.md
autonomous: true
requirements: [TECHDEBT-06]

scope_note: "8 tasks and 19 files modified, but tasks 2-8 are mechanically sequential cleanups downstream of Task 1's atomic type-union edit (the only complex task; CI-stable strategy C requires types + immediate consumers in one commit per RESEARCH.md INV-8). Task 1 is the only large-context task (~30%); tasks 2-8 are each <1-page diffs to non-overlapping files (i18n bundles / post-essay / 4 test files / CLAUDE.md / new test) — each grep-verifiable in <30s. Splitting at task 1 | 2-8 with a wave dependency would add coordination overhead for zero bisection gain (the natural bisection unit is already the per-task commit). Total context ~50%, on-target for the upper bound."

plan_notes: |
  COMMIT ORDER STRATEGY (locked):
    Per RESEARCH.md INV-8 + Pitfall 1: type-union edits trigger TS errors at every '=== "short"' narrowing site. Two viable strategies:
      (A) types-first → all usage sites in one big commit (1 monster commit; bad for bisection)
      (B) usage-sites-first → types-last (multiple atomic commits; tsc red between commits — bad for CI)
      (C) types AND immediate consumers in commit 1 → remaining cleanup commits don't touch unions (preferred — atomic per-file but CI green between commits)
    Picked Strategy C. Commit 1 = 6 files: types/index.ts, youtube.service.ts, concept-feed.service.ts, style-assignment.ts, InfoFlow.tsx, PostDetailScreen.tsx (types/index.ts + ALL files that contain '=== "short"' or 'short:' or 'sourceType: "short"' literals).
    Commits 2+ = i18n bundle deletions, post-essay cleanup, test updates, CLAUDE.md amendment, new invariant test.
    This makes commit 1 large but CI-stable; subsequent commits are small + bisection-friendly for any logic regressions.

  D-02b INFOFLOW MERGE PROTOCOL:
    GAP-C emit lines (currently at InfoFlow.tsx:423-551 inside `{isShortPost && post.videoMeta?.videoId && (...)}` block) MOVE INTO the existing video-card thumbnail onClick handler at InfoFlow.tsx:373-377. The full short-card render block is DELETED. Card-level onClick that handles `handleActivate` (navigate to PostDetailScreen) splits — thumbnail area uses inline-play emit, title/teaser area uses handleActivate.
    Update console.warn tag from `'[InfoFlow] short tap-to-play emit failed:'` → `'[InfoFlow] video tap-to-play emit failed:'`.
    Preserve `e.stopPropagation()` on the thumbnail onClick (Pitfall 2 in RESEARCH.md — prevents double-fire from card-level bubble).

  STYLE_WEIGHTS REBALANCE:
    Per RESEARCH.md Pitfall 3: `short: 0.10` removed must redistribute to keep sum=1.0. Default per CONTEXT.md Claude's discretion: add 0.10 to `video` → `video: 0.20`. The new invariant test asserts `Math.abs(sum - 1) < 1e-9`.

  TEST BASELINE PRESERVATION:
    Phase 37 baseline = test:main 558/555/3 + test:actions 16/14/2 (5 fails total, all pre-existing).
    Plan 38-02 expected delta:
      - DELETE: post-essay.service.test.mjs:20 assertion (-1 pass)
      - RENAME+UPDATE: InfoFlow.short-tap-emit.test.mjs → InfoFlow.video-tap-emit.test.mjs (net 0)
      - UPDATE: style-assignment.test.mjs / style-assignment-stratified.test.mjs / refill-queue-integration.test.mjs / concept-quota.test.mjs (net 0; same assertion count)
      - ADD: youtube-no-short-classification.test.mjs (4 new pass cases, +4)
    Net pass delta: ~+3. Acceptance gate: ≤3 fails in test:main, ≤2 fails in test:actions, AND no failure messages contain 'ERR_IMPORT_ATTRIBUTE_MISSING' (Phase 37 closed those) OR 'short' (regression sentinel).

must_haves:
  truths:
    - "PresentationStyle and PostSnapshot.sourceType union types in app/src/types/index.ts no longer contain 'short' as a member."
    - "probePortrait function deleted from app/src/services/youtube.service.ts; no isPortrait branching; videoType is unconditionally 'video'."
    - "concept-feed.service.ts has no shortAssignments filter, no for-loop constructing short posts, no SHORT_QUERY_MODIFIERS array, no 'short' in VALID_SOURCE_TYPES; trellis_short_posts localStorage key is no longer read or written."
    - "STYLE_WEIGHTS in app/src/services/style-assignment.ts has no 'short' key; weights still sum to 1.0 (video absorbed +0.10 → video: 0.20)."
    - "InfoFlow.tsx has no isShortPost variable; the short tap-to-play emit (Phase 36 GAP-C) merged into video thumbnail onClick (still calls markExplored + emits CONCEPT_EXPLORED exactly once); thumbnail tap = inline play, title/teaser tap = navigate to PostDetailScreen."
    - "PostDetailScreen.tsx no longer guards on `post.sourceType === 'short'`; Detector D postMessage logic untouched."
    - "All 4 i18n bundles (en/zh/es/ja) have the `infoFlow.shortTag` key removed; bundle-parity test passes."
    - "post-essay.service.ts no longer references trellis_short_posts (cache patch removed); paired test assertion at post-essay.service.test.mjs:20 deleted."
    - "tsc -b --noEmit exits 0 after every commit; full test suite shows ≤3 fails in test:main and ≤2 in test:actions (Phase 37 baseline preserved); no NEW failures contain 'short' or 'ERR_IMPORT_ATTRIBUTE_MISSING'."
    - "CLAUDE.md 'Video & short post completion signals (Phase 36 GAP-C)' section retitled, detector inventory row for 'Short tap-to-play emit' deleted, rule 3 rewritten to forbid double-emit (not duplicate-emit) since the only emit now lives in the video thumbnail onClick, brief Phase 38 transition note added."
  artifacts:
    - path: "app/src/types/index.ts"
      provides: "PresentationStyle and PostSnapshot.sourceType unions without 'short'"
      pattern: "PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'news' | 'suggestion'"
    - path: "app/src/services/youtube.service.ts"
      provides: "Single-type YouTube fetch with no portrait probing"
      contains: "videoType = 'video'"
    - path: "app/src/services/style-assignment.ts"
      provides: "STYLE_WEIGHTS summing to 1.0 with no short key; video weight = 0.20"
      contains: "video: 0.20"
    - path: "app/src/components/InfoFlow.tsx"
      provides: "Video card with hybrid thumbnail-tap/title-tap interaction; GAP-C emit on thumbnail onClick"
      contains: "[InfoFlow] video tap-to-play emit failed"
    - path: "app/src/screens/PostDetailScreen.tsx"
      provides: "No short-type guard on essay streaming; Detector D unchanged"
    - path: "app/tests/services/youtube-no-short-classification.test.mjs"
      provides: "Source-reading invariant test (4 assertions: probePortrait absent / sourceType 'short' absent in concept-feed / presentationStyle 'short' absent in concept-feed / STYLE_WEIGHTS.short absent + sum=1.0)"
      min_lines: 50
    - path: "app/tests/components/InfoFlow.video-tap-emit.test.mjs"
      provides: "Renamed + updated GAP-C tap-emit test for the video card"
      contains: "video tap-to-play emit"
    - path: "CLAUDE.md"
      provides: "Updated Phase 36 GAP-C section reflecting Phase 38 type unification"
      contains: "Phase 38 dropped the short type entirely"
  key_links:
    - from: "app/src/components/InfoFlow.tsx (video card thumbnail onClick)"
      to: "dailyReadService.markExplored + eventBus.emit({type: 'CONCEPT_EXPLORED', ...})"
      via: "GAP-C emit migrated from short-card branch into video-card thumbnail handler"
      pattern: "markExplored.*\\n.*CONCEPT_EXPLORED"
    - from: "app/src/components/InfoFlow.tsx (title/teaser onClick)"
      to: "handleActivate / onOpen → PostDetailScreen"
      via: "D-02b hybrid interaction split"
      pattern: "onClick.*handleActivate"
    - from: "app/src/services/style-assignment.ts STYLE_WEIGHTS"
      to: "Sum = 1.0 invariant"
      via: "video: 0.20 absorbs short: 0.10"
      pattern: "video:\\s*0\\.20"
---

<objective>
Eliminate the YouTube short post-type entirely (TECHDEBT-06). All YouTube content becomes `sourceType: 'video' + presentationStyle: 'video'`. The `short` classifier (image-probe-based, Phase 31 era) is deleted; no replacement classifier is added. Video card layout uses `aspect-ratio: auto` driven by thumbnail natural dimensions (D-02a). Hybrid feed interaction (D-02b): thumbnail tap → inline tap-to-play with the Phase 36 GAP-C `markExplored` + `CONCEPT_EXPLORED` emit; title/teaser tap → navigate to PostDetailScreen (preserving Detector A/B/C/D for deep engagement).

Purpose: Closes the "landscape video listed as short" bug class structurally — there is no classifier to be wrong. Removes ~200 lines of fragile thumbnail-probe code + parallel short-construction loop. Forward-aligns with Phase 42 MASONRY-01 (variable-height tiles). Preserves Phase 36 GAP-C completion-signal semantics for inline-play engagement.

Output: 7 source files modified, 4 i18n bundles trimmed, 6 test files updated/renamed, 1 NEW invariant test, CLAUDE.md GAP-C section amended. tsc -b --noEmit exits 0; full test suite preserves Phase 37 baseline (≤3 fails in test:main, ≤2 in test:actions).
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
@.planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-RESEARCH.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-VALIDATION.md
@CLAUDE.md
</context>

<interfaces>
<!-- Key contracts the executor will encounter. Pulled from current codebase 2026-05-09. -->

From app/src/types/index.ts (BEFORE Plan 38-02):
```typescript
export type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'short' | 'news' | 'suggestion';

export interface PostSnapshot {
  // ... other fields ...
  sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video' | 'short' | 'text-art' | 'news' | 'suggestion';
  // ... other fields ...
}
```

From app/src/services/style-assignment.ts (BEFORE):
```typescript
export const STYLE_WEIGHTS: Record<PresentationStyle, number> = {
  'image': 0.20,
  'text-art': 0.40,
  'image-less': 0.00,  // not used in walker
  'video': 0.10,
  'short': 0.10,
  'news': 0.10,
  'suggestion': 0.10,
};
// Sum: 1.00
```

From app/src/services/style-assignment.ts (AFTER Plan 38-02):
```typescript
export const STYLE_WEIGHTS: Record<PresentationStyle, number> = {
  'image': 0.20,
  'text-art': 0.40,
  'image-less': 0.00,
  'video': 0.20,
  'news': 0.10,
  'suggestion': 0.10,
};
// Sum: 1.00 (video absorbs short's 0.10)
```

From app/src/services/concept-feed.service.ts (current — line 85):
```typescript
const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed', 'connection', 'video', 'short', 'text-art', 'news', 'suggestion']);
```

From app/src/components/InfoFlow.tsx (current GAP-C emit pattern, lines 423-551 inside short branch — to MIGRATE to video thumbnail onClick):
```tsx
onClick={(e) => {
  if (videoPlaying !== post.id) {
    e.stopPropagation();
    setVideoPlaying(post.id);
    try {
      const allQ = questionService.getAll({ includeFlagged: true });
      const byId = new Map(allQ.map(q => [q.id, q]));
      const anchorId = getAnchorIdForPost(post, byId);
      if (anchorId && !dailyReadService.isExplored(anchorId)) {
        dailyReadService.markExplored(anchorId);
        eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
      }
    } catch (err) {
      console.warn('[InfoFlow] short tap-to-play emit failed:', err);
      // ⮕ AFTER PLAN 38-02: '[InfoFlow] video tap-to-play emit failed:'
    }
  }
}}
```

From app/src/components/InfoFlow.tsx (current video thumbnail onClick, lines 373-377 — RECEIVES the migration):
```tsx
onClick={(e) => {
  e.stopPropagation();
  setVideoPlaying(post.id);
}}
```

From app/src/services/dailyRead.service.ts (re-used as-is):
```typescript
export const dailyReadService: {
  markExplored(anchorId: string): void;
  isExplored(anchorId: string): boolean;
  getExploredAnchors(): string[];
  reset(): void;
};
```

From app/src/lib/event-bus.ts (re-used as-is):
```typescript
type AppEvent =
  | { type: 'CONCEPT_EXPLORED'; payload: { anchorId: string } }
  | { type: 'GRAPH_UPDATED'; payload: ... }
  | ... ;
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Remove 'short' from type unions + delete all '=== short' narrowing sites + delete short-construction loop (one atomic commit; CI-stable)</name>
  <files>app/src/types/index.ts, app/src/services/youtube.service.ts, app/src/services/concept-feed.service.ts, app/src/services/style-assignment.ts, app/src/components/InfoFlow.tsx, app/src/screens/PostDetailScreen.tsx</files>
  <behavior>
    - tsc -b --noEmit exits 0 (no type errors after this commit)
    - Grep `'short'` against all 6 files returns zero hits in code (only in comments / removed-block residue if any)
    - probePortrait function does not exist anywhere in app/src/services/
    - STYLE_WEIGHTS sum equals 1.0 with `video: 0.20` and no `short` key
    - InfoFlow.tsx video thumbnail onClick contains the full GAP-C emit chain (markExplored + CONCEPT_EXPLORED emit) with `'[InfoFlow] video tap-to-play emit failed:'` as the catch-block warn tag
    - InfoFlow.tsx no longer has `isShortPost` declaration or any branch keyed off it
    - PostDetailScreen.tsx no longer has the `if (post.sourceType === 'short') return;` guard
  </behavior>
  <read_first>
    1. `app/src/types/index.ts` (full file or at least lines 470-500 covering both unions).
    2. `app/src/services/youtube.service.ts` (lines 90-150 covering probePortrait, lines 500-560 covering fetchVideosForConceptBatch).
    3. `app/src/services/concept-feed.service.ts` (lines 80-100 covering VALID_SOURCE_TYPES; lines 760-830 covering SHORT_QUERY_MODIFIERS + buildYoutubeQuery + assignment grouping; lines 1000-1115 covering video and short construction loops; lines 1280-1320 covering pre-validation pass; lines 1500-1540 covering trellis_short_posts cache reads).
    4. `app/src/services/style-assignment.ts` (full file — only ~140 lines).
    5. `app/src/components/InfoFlow.tsx` (lines 60-180 covering isShortPost / interactive / wouldRenderVisual; lines 290-340 covering interactive declaration + outer-div style branches; lines 360-420 covering video card thumbnail onClick; lines 420-560 covering the entire short-card render block to be deleted; lines 590-620 covering the video render branch + minHeight rule; line ~961 covering the feed item wrapper minHeight).
    6. `app/src/screens/PostDetailScreen.tsx` (lines 285-300 covering the short-guard).
    7. RESEARCH.md § INV-1a through INV-1f (complete blast-radius map).
    8. RESEARCH.md § INV-8 (TypeScript compilation cascade — all sites that MUST be deleted in the same commit).
    9. CLAUDE.md "Video & short post completion signals (Phase 36 GAP-C — load-bearing)" section (lines 107-132) — context for the GAP-C emit migration semantics. (CLAUDE.md text edit happens in Task 8, not here — but executor needs to understand the load-bearing rules being preserved.)
    10. plan_notes "COMMIT ORDER STRATEGY" + "D-02b INFOFLOW MERGE PROTOCOL" + "STYLE_WEIGHTS REBALANCE" sections at the top of this PLAN.

    NOTE on test ordering: The youtube-no-short-classification.test.mjs in Task 6 is a POST-HOC regression guard against re-introduction of the short classifier; it does NOT precede this task as a red TDD test. (Reason: the invariant test asserts ABSENCE of classifier code — it can only meaningfully exist after Task 1 deletes that code. A pre-Task-1 invariant test would assert "absence" against present code and fail, then pass after Task 1 deletes — same end state, but the red→green flip is mechanical and bisection-uninteresting compared to running tsc red→green between commits. See plan_notes COMMIT ORDER STRATEGY for why CI-stability of tsc is the more useful gate.)
  </read_first>
  <action>
    This is the LARGE atomic commit. All 6 files edited together so tsc stays green between commits. Edits:

    **A. app/src/types/index.ts**

    Line 474 BEFORE: `export type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'short' | 'news' | 'suggestion';`
    Line 474 AFTER: `export type PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'news' | 'suggestion';`

    Line 492 BEFORE (inline union on `sourceType` field of `PostSnapshot`): `sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video' | 'short' | 'text-art' | 'news' | 'suggestion';`
    Line 492 AFTER: `sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video' | 'text-art' | 'news' | 'suggestion';`

    **B. app/src/services/youtube.service.ts**

    DELETE lines 121-135 entirely (the `probePortrait(videoId, fallbackUrl): Promise<boolean>` function). No callers remain after the next edit.

    Lines 508-510 BEFORE:
    ```typescript
    const isPortrait = await probePortrait(result.videoId, result.thumbnailUrl);
    const videoType = isPortrait ? 'short' : 'video';
    ```
    Lines 508-510 AFTER (delete both lines; inline `'video'` directly at the assignment site):
    ```typescript
    // (probePortrait removed in Phase 38; YouTube content is uniformly 'video')
    ```

    Then at the assignment site (~lines 543-549) where `sourceType: videoType, presentationStyle: videoType` was constructed: replace `videoType` references with literal `'video'`. Final shape:
    ```typescript
    sourceType: 'video',
    presentationStyle: 'video',
    ```

    **C. app/src/services/concept-feed.service.ts**

    Line 85 BEFORE: `const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed', 'connection', 'video', 'short', 'text-art', 'news', 'suggestion']);`
    Line 85 AFTER: `const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed', 'connection', 'video', 'text-art', 'news', 'suggestion']);`

    Lines 766-784: DELETE the `SHORT_QUERY_MODIFIERS` array entirely. Update `buildYoutubeQuery(conceptName: string, cycleNumber: number, isShort: boolean)` signature to drop the `isShort` parameter: `buildYoutubeQuery(conceptName: string, cycleNumber: number)`. Inside the function body, delete any branch using `isShort` to pick from `SHORT_QUERY_MODIFIERS` — keep only the non-short query construction.

    Update all 3 call sites:
    - Line ~1037: `buildYoutubeQuery(conceptName, cycleNumber, false)` → `buildYoutubeQuery(conceptName, cycleNumber)` (drop the third arg)
    - Line ~1082 and surrounding loop: this is INSIDE the shortAssignments loop being deleted (next edit) — N/A.
    - Line ~1308: `buildYoutubeQuery(conceptName, validationCycle, a.style === 'short')` → `buildYoutubeQuery(conceptName, validationCycle)` (drop the third arg).

    Lines 820-826 BEFORE (assignment grouping):
    ```typescript
    const videoAssignments = assignments.filter(a => a.style === 'video');
    const shortAssignments = assignments.filter(a => a.style === 'short');
    ```
    Lines 820-826 AFTER (single line):
    ```typescript
    const videoAssignments = assignments.filter(a => a.style === 'video');
    ```

    Lines 1060-1113: DELETE the entire `for (const a of shortAssignments)` loop body. The pre-existing video construction loop (lines ~1020-1060, `for (const a of videoAssignments)`) handles all YouTube content — no merge needed; just delete the parallel loop.

    Lines 1288/1308 (pre-validation pass): `a.style === 'video' || a.style === 'short'` → `a.style === 'video'`. Cache key comment at line ~793 (`key: '${conceptId}:${style}' where style is 'video'|'short'`) → update to `key: '${conceptId}:${style}' where style is 'video'`.

    Line ~1520 (trellis_short_posts cache read): DELETE the `localStorage.getItem('trellis_short_posts')` read entirely + any associated parsing/merging into the dailyPosts array. The cache is dead after the short type is removed; reading stale data into the live posts array would type-error against the new union. NOTE: legacy cleanup (clearing the localStorage key on next boot) is OPTIONAL and OUT OF SCOPE for this commit — see plan_notes; just stop reading the key here. Do NOT extend legacy-migration.service.ts in this task (Bucket C call deferred per CONTEXT.md).

    **D. app/src/services/style-assignment.ts**

    Lines 18-25 BEFORE (STYLE_WEIGHTS):
    ```typescript
    export const STYLE_WEIGHTS: Record<PresentationStyle, number> = {
      'image': 0.20,
      'text-art': 0.40,
      'image-less': 0.00,
      'video': 0.10,
      'short': 0.10,
      'news': 0.10,
      'suggestion': 0.10,
    };
    ```
    Lines 18-25 AFTER (per plan_notes STYLE_WEIGHTS REBALANCE — add 0.10 to `video`):
    ```typescript
    export const STYLE_WEIGHTS: Record<PresentationStyle, number> = {
      'image': 0.20,
      'text-art': 0.40,
      'image-less': 0.00,
      'video': 0.20,  // Phase 38: absorbed short's 0.10 (short type removed)
      'news': 0.10,
      'suggestion': 0.10,
    };
    ```

    Lines 50-53 (`if (!availability.hasYoutubeKey)` block referencing `weights.short`): DELETE the `weights.short = 0` line and any `+ weights.short` arithmetic in the redistribution. After short is gone from STYLE_WEIGHTS, `weights.short` is undefined and these lines TS-error. Resulting block should only zero out `weights.video` and redistribute `weights.video` (now 0.20) into the remaining styles per the existing pattern.

    Line 130 (`reassignFailures`): `a.style === 'video' || a.style === 'short' || a.style === 'news'` → `a.style === 'video' || a.style === 'news'` (drop the `|| a.style === 'short'` arm).

    **E. app/src/components/InfoFlow.tsx**

    The largest single-file edit. Per plan_notes "D-02b INFOFLOW MERGE PROTOCOL":

    Line 80: DELETE `const isShortPost = post.sourceType === 'short';`

    Lines 89-96 (imageResolved initializer): Delete `|| isShortPost` and `|| presentationStyle === 'short'` from the disjunction. Keep all other branches unchanged.

    Line 108: `if (isSuggestion || isVideoPost || isShortPost || isNewsPost) return;` → `if (isSuggestion || isVideoPost || isNewsPost) return;`

    Line 136: dependency array `[..., isShortPost, ...]` → drop `isShortPost`.

    Lines 156-164 (`wouldRenderVisual` block): Delete `isShortPost` from the condition.

    Lines 298-329 (interactive / handleActivate / outer-div style block): `const interactive = !isShortPost;` → `const interactive = !isSuggestion;` (preserve the existing "non-suggestion is interactive" semantic; shorts no longer exist).

    Lines 318-328 (multiple `isShortPost ? ... : ...` ternaries in inline styles for padding, background, cursor): Replace each ternary with the non-short branch only. E.g., `padding: isShortPost ? 0 : 16` → `padding: 16`. `background: isShortPost ? 'black' : 'var(--surface)'` → `background: 'var(--surface)'`. `cursor: isShortPost ? 'auto' : 'pointer'` → `cursor: 'pointer'`. Apply this transformation to ALL ternaries on these lines that key off `isShortPost`.

    Lines 423-551: DELETE the entire `{isShortPost && post.videoMeta?.videoId && ( ... )}` block.

    BUT FIRST — extract the GAP-C emit logic from inside that block's onClick handler (the chain reproduced in `<interfaces>` above) and MIGRATE it into the video card's thumbnail onClick at lines 373-377. The video card thumbnail onClick BEFORE:
    ```tsx
    onClick={(e) => {
      e.stopPropagation();
      setVideoPlaying(post.id);
    }}
    ```
    AFTER (insert the GAP-C emit chain, change the warn tag):
    ```tsx
    onClick={(e) => {
      if (videoPlaying !== post.id) {
        e.stopPropagation();
        setVideoPlaying(post.id);
        // Phase 36 GAP-C: emit CONCEPT_EXPLORED so the lazy-skip walker (Phase 36 GAP-2)
        // sees this video tap as concept exploration. Generalized in Phase 38 — formerly
        // gated on sourceType === 'short'; now applies to all video posts since the
        // short type was removed (TECHDEBT-06). Detector D in PostDetailScreen still
        // handles deep-engagement completion for users who tap title/teaser → navigate.
        try {
          const allQ = questionService.getAll({ includeFlagged: true });
          const byId = new Map(allQ.map(q => [q.id, q]));
          const anchorId = getAnchorIdForPost(post, byId);
          if (anchorId && !dailyReadService.isExplored(anchorId)) {
            dailyReadService.markExplored(anchorId);
            eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
          }
        } catch (err) {
          console.warn('[InfoFlow] video tap-to-play emit failed:', err);
        }
      }
    }}
    ```

    NOTE: The existing imports at the top of InfoFlow.tsx already include `questionService`, `dailyReadService`, `getAnchorIdForPost`, and `eventBus` (added in Phase 36 GAP-C for the short branch). DO NOT remove them — they're now consumed by the video thumbnail handler. Verify imports still match (test 4 of the new invariant test will catch missing imports).

    **D-02b TITLE/TEASER NAVIGATE** — The card-level outer div currently has an onClick that calls `handleActivate` (navigate to PostDetailScreen). Under D-02b, the card-level onClick is preserved BUT the thumbnail onClick uses `e.stopPropagation()` to prevent the navigate from firing on thumbnail tap. This is the HYBRID interaction: card click goes to detail, thumbnail click plays inline. The existing card-level `onClick={handleActivate}` and `role="button"` patterns at lines 298-329 should be preserved (with `interactive = !isSuggestion;`); the `stopPropagation()` on the thumbnail handler does the work of dispatching the two intents. NO need to add a separate explicit "title onClick" — the card-level handler already covers any non-thumbnail tap (title, teaser, hook, channel attribution). This is simpler than RESEARCH.md's "split into two click handlers" suggestion and matches existing structure.

    Line 596: `{!isVideoPost && !isShortPost && image && ...}` → `{!isVideoPost && image && ...}`

    Line 603 (`{!isShortPost && ( ... )}` hook/channel/preview section): Replace with simply rendering this section unconditionally (delete the wrapper `{!isShortPost && ( ... )}`). This section was previously hidden for shorts; now that shorts don't exist, no gate is needed.

    Line 961 (feed item wrapper `minHeight`): `minHeight: item.post.presentationStyle === 'video' || item.post.presentationStyle === 'short' ? '320px' : 'auto'` → `minHeight: item.post.presentationStyle === 'video' ? '320px' : 'auto'`

    **D-02a `aspect-ratio: auto` for video card** — the video card iframe container currently uses `aspectRatio: '16 / 9'` (line ~336). Per CONTEXT.md D-02a, change to `aspect-ratio: auto` driven by thumbnail natural dimensions. RECOMMENDED CSS-ONLY APPROACH (per RESEARCH.md INV-1e Recommendation):

    Replace the iframe container style:
    BEFORE: `aspectRatio: '16 / 9'`
    AFTER: `aspectRatio: 'auto 16 / 9'`  (CSS `aspect-ratio: auto` falls back to 16/9 if the embedded media doesn't expose intrinsic size; the `<img>` thumbnail provides intrinsic size when shown)

    NOTE: If during execution the simulator shows the iframe collapsing (no intrinsic size), use the JS state alternative documented in RESEARCH.md INV-1e (read `naturalWidth`/`naturalHeight` from thumbnail img onLoad, store in a `[thumbRatio, setThumbRatio]` state, use `aspectRatio: thumbRatio ? \`${thumbRatio}\` : '16 / 9'` as fallback). Only fall back to JS approach if pure CSS fails on the simulator — verify by tapping a known-portrait short YouTube video and confirming the card sizes correctly without letterboxing.

    **F. app/src/screens/PostDetailScreen.tsx**

    Line 289 BEFORE: `if (post.sourceType === 'short') return;`
    Line 289 AFTER: DELETE this line entirely.

    Detector D logic at lines 589-601 STAYS UNCHANGED per D-02b. Do NOT touch the YouTube IFrame postMessage listener.

    **VERIFICATION GATE before committing:**
    Run `cd app && npx tsc -b --noEmit`. Must exit 0. If ANY type error remains, search for residual `'short'` references with `grep -rn "'short'" app/src/ --include="*.ts" --include="*.tsx"` and fix before committing.

    Run `cd app && grep -rn "isShortPost" src/` → expect 0 hits.
    Run `cd app && grep -rn "probePortrait" src/` → expect 0 hits.

    Then commit as a SINGLE atomic commit:
    ```
    git add app/src/types/index.ts app/src/services/youtube.service.ts app/src/services/concept-feed.service.ts app/src/services/style-assignment.ts app/src/components/InfoFlow.tsx app/src/screens/PostDetailScreen.tsx
    git commit -m "refactor(38-02): drop short post type — TECHDEBT-06

    - Remove 'short' from PresentationStyle and PostSnapshot.sourceType unions
    - Delete probePortrait function in youtube.service.ts
    - Delete shortAssignments loop in concept-feed.service.ts
    - Rebalance STYLE_WEIGHTS (video: 0.10 → 0.20 absorbs short's 0.10)
    - InfoFlow: delete short card; migrate Phase 36 GAP-C tap-emit into video thumbnail onClick (D-02b hybrid interaction)
    - InfoFlow: aspect-ratio: auto for video card (D-02a)
    - PostDetailScreen: drop short-type guard
    - tsc -b --noEmit exit 0"
    ```
  </action>
  <verify>
    <automated>cd app && npx tsc -b --noEmit && grep -rn "'short'" src/types/index.ts src/services/youtube.service.ts src/services/concept-feed.service.ts src/services/style-assignment.ts src/components/InfoFlow.tsx src/screens/PostDetailScreen.tsx 2>&1 | grep -v "comment\|TODO" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && npx tsc -b --noEmit` exits 0 (no TS errors)
    - `grep -c "PresentationStyle = 'image' | 'text-art' | 'image-less' | 'video' | 'news' | 'suggestion'" app/src/types/index.ts` returns 1 (new union shape)
    - `grep -c "| 'short'" app/src/types/index.ts` returns 0 (short removed from both unions)
    - `grep -c "probePortrait" app/src/services/youtube.service.ts` returns 0
    - `grep -c "videoType = 'video'" app/src/services/youtube.service.ts` returns at least 1 OR `grep -c "sourceType: 'video'" app/src/services/youtube.service.ts` returns at least 1 (unconditional 'video' assignment)
    - `grep -c "shortAssignments" app/src/services/concept-feed.service.ts` returns 0
    - `grep -c "SHORT_QUERY_MODIFIERS" app/src/services/concept-feed.service.ts` returns 0
    - `grep -c "trellis_short_posts" app/src/services/concept-feed.service.ts` returns 0 (cache read deleted)
    - `grep -c "video: 0.20" app/src/services/style-assignment.ts` returns 1
    - `grep -c "short: 0" app/src/services/style-assignment.ts` returns 0 (no `short:` key in STYLE_WEIGHTS)
    - `grep -c "isShortPost" app/src/components/InfoFlow.tsx` returns 0
    - `grep -c "\\[InfoFlow\\] video tap-to-play emit failed" app/src/components/InfoFlow.tsx` returns 1 (renamed warn tag confirms migration)
    - `grep -c "dailyReadService.markExplored" app/src/components/InfoFlow.tsx` returns exactly 1 (single emit site, now in video thumbnail onClick)
    - `grep -c "type: 'CONCEPT_EXPLORED'" app/src/components/InfoFlow.tsx` returns exactly 1 (single emit, idempotent semantic preserved)
    - `grep -c "post.sourceType === 'short'" app/src/screens/PostDetailScreen.tsx` returns 0 (guard deleted)
    - `grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx app/src/components/InfoFlow.tsx` returns at least 3 (Detector D / IFrame API channel still active per CLAUDE.md GAP-C rule 1)
    - Single git commit with all 6 files in one snapshot (`git log -1 --stat | head -15` shows all 6 file paths)
  </acceptance_criteria>
  <done>tsc clean; all 6 source files updated in one atomic commit; short type and probePortrait classifier eliminated; GAP-C emit successfully migrated into video thumbnail onClick; STYLE_WEIGHTS sum preserved at 1.0 with video: 0.20.</done>
</task>

<task type="auto">
  <name>Task 2: Delete infoFlow.shortTag from all 4 i18n bundles + verify bundle parity</name>
  <files>app/src/locales/en.json, app/src/locales/zh.json, app/src/locales/es.json, app/src/locales/ja.json</files>
  <read_first>
    1. All 4 bundle files at `app/src/locales/{en,zh,es,ja}.json` — at minimum the `infoFlow` section containing `"shortTag"`.
    2. RESEARCH.md § INV-1g (i18n bundles section).
    3. CLAUDE.md "i18n Workflow (Phase 27+)" section — bundle parity rule + the bundle-parity test that enforces 4-way key sets.
    4. The bundle-parity test at `app/tests/locales/bundle-parity.test.mjs` to understand what it asserts.
  </read_first>
  <action>
    In each of the 4 bundle files, locate the `"infoFlow"` section. Within it, find and DELETE the `"shortTag": "..."` key-value pair. Be careful with JSON syntax — if `shortTag` is not the last key in `infoFlow`, simply delete that line; if it IS the last key, also remove the trailing comma from the previous key.

    Specific deletion targets:
    - `app/src/locales/en.json` — find `"shortTag": "Short"` (or similar — exact value may vary) and delete the line.
    - `app/src/locales/zh.json` — find `"shortTag": "短视频"` (or similar) and delete the line.
    - `app/src/locales/es.json` — find `"shortTag": "Corto"` (or similar) and delete the line.
    - `app/src/locales/ja.json` — find `"shortTag": "ショート"` (or similar) and delete the line.

    Per CLAUDE.md "i18n Workflow":
    - All 4 bundles MUST have identical key sets (bundle-parity.test.mjs enforces).
    - This is a DELETE across all 4 simultaneously — do not skip any locale.

    After editing all 4 files, run:
    ```bash
    cd app && node --test tests/locales/bundle-parity.test.mjs
    cd app && grep -c "shortTag" src/components/InfoFlow.tsx  # should be 0 — Task 1 deleted the call site
    ```

    Bundle parity test must pass. If it reports key-set divergence, check that the deletion was applied to all 4 files (the test will tell you which file has the mismatched key).

    Commit as separate atomic commit (per Phase 37 D-03 atomic commit pattern):
    ```
    git add app/src/locales/en.json app/src/locales/zh.json app/src/locales/es.json app/src/locales/ja.json
    git commit -m "i18n(38-02): remove infoFlow.shortTag from all 4 bundles

    Short post type removed in Plan 38-02 Task 1; the t('infoFlow.shortTag')
    call site no longer exists. Bundle parity preserved across en/zh/es/ja."
    ```
  </action>
  <verify>
    <automated>cd app && node --test tests/locales/bundle-parity.test.mjs 2>&1 | tail -3 && ! grep -q "shortTag" src/locales/en.json src/locales/zh.json src/locales/es.json src/locales/ja.json</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "shortTag" app/src/locales/en.json` returns 0
    - `grep -c "shortTag" app/src/locales/zh.json` returns 0
    - `grep -c "shortTag" app/src/locales/es.json` returns 0
    - `grep -c "shortTag" app/src/locales/ja.json` returns 0
    - `cd app && node --test tests/locales/bundle-parity.test.mjs` exits 0 with all assertions passing (4-way key set parity preserved)
    - All 4 JSON bundles still parse as valid JSON (`cd app && node -e "['en','zh','es','ja'].forEach(l => JSON.parse(require('fs').readFileSync('src/locales/' + l + '.json', 'utf8')))"` exits 0)
    - Single git commit with all 4 bundle files
  </acceptance_criteria>
  <done>infoFlow.shortTag deleted from all 4 locale bundles; bundle-parity test passes; no JSON parse errors.</done>
</task>

<task type="auto">
  <name>Task 3: Remove trellis_short_posts cache patch from post-essay.service.ts + delete paired test assertion</name>
  <files>app/src/services/post-essay.service.ts, app/tests/services/post-essay.service.test.mjs</files>
  <read_first>
    1. `app/src/services/post-essay.service.ts` — full file or at minimum search for `trellis_short_posts` to find the patch call (likely a localStorage write inside an essay-generation success branch that mirrors a result back into the short-posts cache).
    2. `app/tests/services/post-essay.service.test.mjs` lines 15-25 area — the assertion at line 20: `assert.ok(source.includes('trellis_short_posts'), ...)`.
    3. RESEARCH.md § INV-5 Bucket C (post-essay row) + § Pitfall 7.
    4. RESEARCH.md § INV-1c (the trellis_short_posts cache discussion).
  </read_first>
  <action>
    **A. app/src/services/post-essay.service.ts**

    Find the patch call to `trellis_short_posts`. It's likely shaped like one of:
    - `localStorage.setItem('trellis_short_posts', JSON.stringify(...))` inside a success branch
    - A `cache.patch('trellis_short_posts', ...)` call wrapping the same
    - A side-effect inside `generateNewsEssay` or a similar essay-generation function

    DELETE the entire patch call (the line + any wrapping if-block that exists ONLY for the short-cache patch). If the cache patch was inside a try/catch, preserve the surrounding try/catch structure if other operations still need it; if the try/catch existed solely to wrap the short-cache patch, delete the entire try/catch.

    Verify: `grep -c "trellis_short_posts" app/src/services/post-essay.service.ts` should return 0 after this edit.

    **B. app/tests/services/post-essay.service.test.mjs**

    Find the assertion at approximately line 20:
    ```javascript
    assert.ok(source.includes('trellis_short_posts'), 'post-essay.service.ts must patch trellis_short_posts on essay completion');
    ```
    (Or similar — exact wording may vary. The signal is `source.includes('trellis_short_posts')`.)

    DELETE this assertion entirely (just the `assert.ok(...)` line — preserve the surrounding `it(...)` block structure if there are other assertions in it; if this assertion is the entire body of an `it(...)` block, delete the entire `it(...)` block to keep the test file structure clean).

    If the deleted assertion leaves an empty `it(...)` block, delete the empty `it(...)` too. If it leaves an empty `describe(...)` block, delete that too.

    **C. Run the test:**

    ```bash
    cd app && node --test tests/services/post-essay.service.test.mjs
    ```

    Test should still pass (with the assertion removed; reduced assertion count). No new failures.

    **D. Commit as a single atomic commit:**
    ```
    git add app/src/services/post-essay.service.ts app/tests/services/post-essay.service.test.mjs
    git commit -m "refactor(38-02): remove trellis_short_posts cache patch (dead after short type removal)

    Short post type removed in Plan 38-02 Task 1; the trellis_short_posts
    localStorage cache is no longer read or written by the live code path.
    Removes the post-essay.service.ts patch + paired test assertion.

    Stale data in user localStorage is intentionally NOT cleaned up by this
    commit (Bucket C deferred per CONTEXT.md); legacy data is harmless once
    the read site is gone."
    ```
  </action>
  <verify>
    <automated>cd app && ! grep -q "trellis_short_posts" src/services/post-essay.service.ts && ! grep -q "trellis_short_posts" tests/services/post-essay.service.test.mjs && node --test tests/services/post-essay.service.test.mjs 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "trellis_short_posts" app/src/services/post-essay.service.ts` returns 0
    - `grep -c "trellis_short_posts" app/tests/services/post-essay.service.test.mjs` returns 0
    - `cd app && node --test tests/services/post-essay.service.test.mjs` exits 0 with all REMAINING assertions passing
    - `cd app && npx tsc -b --noEmit` still exits 0 (no new TS errors introduced)
    - Single git commit with both files
  </acceptance_criteria>
  <done>trellis_short_posts cache patch + paired test assertion removed atomically; post-essay tests pass.</done>
</task>

<task type="auto">
  <name>Task 4: Rename and update InfoFlow.short-tap-emit.test.mjs → InfoFlow.video-tap-emit.test.mjs</name>
  <files>app/tests/components/InfoFlow.short-tap-emit.test.mjs, app/tests/components/InfoFlow.video-tap-emit.test.mjs</files>
  <read_first>
    1. `app/tests/components/InfoFlow.short-tap-emit.test.mjs` (full file — ~60 lines, 4 assertions).
    2. `app/src/components/InfoFlow.tsx` — confirm the post-Task-1 state has the GAP-C emit chain in the video thumbnail onClick with the `'[InfoFlow] video tap-to-play emit failed:'` warn tag.
    3. RESEARCH.md § INV-1h test 1 — the test rename + assertion update specification.
  </read_first>
  <action>
    Rename the file using `git mv` to preserve git blame:
    ```bash
    git mv app/tests/components/InfoFlow.short-tap-emit.test.mjs app/tests/components/InfoFlow.video-tap-emit.test.mjs
    ```

    Then EDIT the contents of the renamed file. The 4 assertions need updating:

    **Assertion 1 — Phase 36 GAP-C comment presence:**
    BEFORE:
    ```javascript
    it('contains Phase 36 GAP-C comment in the short tap branch', () => {
      assert.ok(
        source.includes('Phase 36 GAP-C'),
        'InfoFlow.tsx must reference Phase 36 GAP-C in the short tap-to-play handler comment.',
      );
    });
    ```
    AFTER:
    ```javascript
    it('contains Phase 36 GAP-C comment in the video thumbnail tap branch', () => {
      assert.ok(
        source.includes('Phase 36 GAP-C'),
        'InfoFlow.tsx must reference Phase 36 GAP-C in the video thumbnail tap-to-play handler comment (generalized in Phase 38).',
      );
    });
    ```

    **Assertion 2 — markExplored called exactly once:**
    BEFORE:
    ```javascript
    it('fires markExplored exactly once (only in the short branch, not the video branch)', () => {
      const matches = source.match(/dailyReadService\.markExplored/g) || [];
      assert.equal(
        matches.length,
        1,
        `InfoFlow.tsx must call dailyReadService.markExplored exactly once — in the short tap branch. ` +
        `Found ${matches.length} occurrences. Video posts route via onOpen → PostDetailScreen → Detector D, ` +
        `so they should NOT have a duplicate emit here (would double-fire).`,
      );
    });
    ```
    AFTER (semantic shift — single emit from video thumbnail onClick; preserve double-fire prohibition):
    ```javascript
    it('fires markExplored exactly once (in the video thumbnail tap branch — no double-emit)', () => {
      const matches = source.match(/dailyReadService\.markExplored/g) || [];
      assert.equal(
        matches.length,
        1,
        `InfoFlow.tsx must call dailyReadService.markExplored exactly once — in the video thumbnail tap-to-play handler. ` +
        `Found ${matches.length} occurrences. Adding a second emit at the card-level onClick (which navigates to PostDetailScreen) ` +
        `would double-fire (idempotent via dailyReadService.isExplored, but unnecessary work + confusing semantics). ` +
        `Phase 38 generalization preserved single-emit semantic from Phase 36 GAP-C.`,
      );
    });
    ```

    **Assertion 3 — CONCEPT_EXPLORED emitted exactly once:**
    BEFORE:
    ```javascript
    it("emits CONCEPT_EXPLORED event exactly once via eventBus", () => {
      const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
      assert.equal(
        matches.length,
        1,
        'InfoFlow.tsx must emit CONCEPT_EXPLORED exactly once (in the short tap-to-play handler). ' +
        'Reuse the existing event type — do NOT introduce a new event (CLAUDE.md best practice rule 6).',
      );
    });
    ```
    AFTER:
    ```javascript
    it("emits CONCEPT_EXPLORED event exactly once via eventBus", () => {
      const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
      assert.equal(
        matches.length,
        1,
        'InfoFlow.tsx must emit CONCEPT_EXPLORED exactly once (in the video thumbnail tap-to-play handler). ' +
        'Reuse the existing event type — do NOT introduce a new event (CLAUDE.md best practice rule 6).',
      );
    });
    ```

    **Assertion 4 — Required imports present:**
    No semantic change needed (same imports remain consumed — just by the video thumbnail handler now instead of the short branch). Update the describe block name only.

    **Top-level describe block:**
    BEFORE: `describe('InfoFlow short tap-to-play emit (Phase 36 GAP-C)', () => {`
    AFTER: `describe('InfoFlow video tap-to-play emit (Phase 36 GAP-C, generalized in Phase 38)', () => {`

    **Top-of-file comment:**
    BEFORE:
    ```javascript
    // Phase 36 GAP-C regression guard: ensures InfoFlow.tsx fires CONCEPT_EXPLORED
    // on short tap-to-play. Shorts never navigate to PostDetailScreen (interactive=false
    // at line 295), so the existing detectors A/B/C/D never run for them.
    // See .planning/debug/video-completion-signal-missing.md.
    ```
    AFTER:
    ```javascript
    // Phase 36 GAP-C regression guard: ensures InfoFlow.tsx fires CONCEPT_EXPLORED
    // on video thumbnail tap-to-play (inline play). Phase 38 (TECHDEBT-06) removed the
    // 'short' post type entirely; the GAP-C emit migrated from the short-card onClick
    // into the video-card thumbnail onClick. Hybrid interaction (D-02b): thumbnail tap
    // = inline play + emit; title/teaser tap = navigate to PostDetailScreen (Detectors
    // A/B/C/D still cover deep engagement after navigation).
    // See .planning/debug/video-completion-signal-missing.md
    // and .planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md (D-02b).
    ```

    Run the test:
    ```bash
    cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs
    ```

    All 4 assertions must pass against the post-Task-1 InfoFlow.tsx state.

    Commit:
    ```
    git add app/tests/components/InfoFlow.video-tap-emit.test.mjs
    git commit -m "test(38-02): rename short-tap-emit → video-tap-emit; preserve single-emit semantic

    Short post type removed (Plan 38-02 Task 1); the Phase 36 GAP-C tap-emit
    migrated into the video thumbnail onClick. Test renamed via git mv to
    preserve blame; 4 assertions updated to reflect the video-card target
    while preserving the no-double-emit invariant."
    ```
  </action>
  <verify>
    <automated>cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs 2>&1 | tail -5; ls tests/components/InfoFlow.short-tap-emit.test.mjs 2>&1; ls tests/components/InfoFlow.video-tap-emit.test.mjs 2>&1</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/components/InfoFlow.short-tap-emit.test.mjs` does NOT exist (`ls` returns "No such file or directory")
    - File `app/tests/components/InfoFlow.video-tap-emit.test.mjs` exists
    - `cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs` exits 0 with 4 passing assertions
    - `grep -c "video tap-to-play emit" app/tests/components/InfoFlow.video-tap-emit.test.mjs` returns at least 2 (describe block + at least one assertion message updated)
    - `grep -c "Phase 38" app/tests/components/InfoFlow.video-tap-emit.test.mjs` returns at least 1 (Phase 38 generalization noted in test)
    - Git history shows the file renamed (not deleted + recreated): `git log --diff-filter=R --summary -- app/tests/components/` mentions the rename
  </acceptance_criteria>
  <done>Test file renamed via git mv (blame preserved); 4 assertions updated to target the video-card thumbnail; all assertions pass against post-Task-1 InfoFlow.tsx.</done>
</task>

<task type="auto">
  <name>Task 5: Update style-assignment + style-assignment-stratified + refill-queue-integration + concept-quota tests (drop 'short' references)</name>
  <files>app/tests/services/style-assignment.test.mjs, app/tests/services/style-assignment-stratified.test.mjs, app/tests/services/refill-queue-integration.test.mjs, app/tests/concept-quota.test.mjs</files>
  <read_first>
    1. All 4 test files. Each has scattered `'short'` references that must be removed without breaking the test logic.
    2. RESEARCH.md § INV-1h tests 2-5 (specific lines and update guidance for each test file).
    3. The post-Task-1 state of style-assignment.ts (`STYLE_WEIGHTS` with `video: 0.20` and no `short` key) and concept-feed.service.ts (`VALID_SOURCE_TYPES` without `'short'`).
  </read_first>
  <action>
    Edit each file. Run each test after editing to confirm it still passes. Per RESEARCH.md INV-1h:

    **A. app/tests/services/style-assignment.test.mjs**

    - Line 20 — `validStyles` set: remove `'short'`. BEFORE: `const validStyles = new Set(['image', 'text-art', 'video', 'short', 'news', 'suggestion']);` AFTER: `const validStyles = new Set(['image', 'text-art', 'video', 'news', 'suggestion']);`

    - Lines 67-74 — "no video/short" test (likely titled "when youtube key absent, no video or short posts"): retitle and simplify to "when youtube key absent, no video posts". The assertion that previously checked `count.video === 0 && count.short === 0` becomes `count.video === 0`. Update test name + assertion accordingly.

    - Line 70 (or wherever the comment lives) — comment about "0.10+0.15 = 0.25 extra" arithmetic: rewrite to reflect new state. After Plan 38-02, `video: 0.20` (no short). When YouTube key is absent, `weights.video` (0.20) redistributes to remaining styles. New arithmetic: `0.20 extra` (just video). Update comment to: `// When hasYoutubeKey=false: video weight (0.20) redistributes to image/text-art/news/suggestion.` (Tune to actual file structure.)

    - Lines 100, 110 — `reassignFailures` test fixture using `{ conceptId: 'd', style: 'short' }`: change `style: 'short'` to `style: 'video'` (or another valid style). Verify the test still meaningfully exercises `reassignFailures` after the change.

    - Line 116 — `STYLE_WEIGHTS sum to 1.0` assertion: SHOULD STILL PASS WITHOUT EDIT after Task 1's STYLE_WEIGHTS rebalance. Verify by running the test.

    Run: `cd app && node --test tests/services/style-assignment.test.mjs`

    **B. app/tests/services/style-assignment-stratified.test.mjs**

    - Line 11 — counter object includes `short: 0`: remove the `short: 0` line (and the trailing comma if needed).
    - Line 58 — `valid` set includes `'short'`: remove.
    - Lines 74, 77 — assertions about "video+short count is 0" when `hasYoutubeKey=false`: simplify to "video count is 0" (single style).

    Run: `cd app && node --test tests/services/style-assignment-stratified.test.mjs`

    **C. app/tests/services/refill-queue-integration.test.mjs**

    - Line 120 — fixture: `makePost('b4', ['B'], 'short')` → change `'short'` to `'video'` (or `'text-art'`). This is just a test fixture with no behavioral assertion about short — substituting any valid style preserves the test's intent.

    Run: `cd app && node --test tests/services/refill-queue-integration.test.mjs`

    **D. app/tests/concept-quota.test.mjs**

    - Lines 48-52 — `for (const sourceType of ['video', 'short', 'news'])`: remove `'short'` from the array. BEFORE: `for (const sourceType of ['video', 'short', 'news']) { ... }` AFTER: `for (const sourceType of ['video', 'news']) { ... }`

    Run: `cd app && node --test tests/concept-quota.test.mjs`

    Commit each file as a separate atomic commit (per Phase 37 D-03 atomic commit pattern). 4 commits total:
    ```
    # Commit 1: style-assignment.test.mjs
    git add app/tests/services/style-assignment.test.mjs
    git commit -m "test(38-02): drop 'short' from style-assignment tests"

    # Commit 2: style-assignment-stratified.test.mjs
    git add app/tests/services/style-assignment-stratified.test.mjs
    git commit -m "test(38-02): drop 'short' from style-assignment-stratified tests"

    # Commit 3: refill-queue-integration.test.mjs
    git add app/tests/services/refill-queue-integration.test.mjs
    git commit -m "test(38-02): swap 'short' fixture for 'video' in refill-queue integration"

    # Commit 4: concept-quota.test.mjs
    git add app/tests/concept-quota.test.mjs
    git commit -m "test(38-02): drop 'short' from concept-quota sourceType iteration"
    ```
  </action>
  <verify>
    <automated>cd app && node --test tests/services/style-assignment.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/refill-queue-integration.test.mjs tests/concept-quota.test.mjs 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "'short'" app/tests/services/style-assignment.test.mjs` returns 0
    - `grep -c "'short'" app/tests/services/style-assignment-stratified.test.mjs` returns 0
    - `grep -c "'short'" app/tests/services/refill-queue-integration.test.mjs` returns 0
    - `grep -c "'short'" app/tests/concept-quota.test.mjs` returns 0
    - All 4 tests pass: `cd app && node --test tests/services/style-assignment.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/refill-queue-integration.test.mjs tests/concept-quota.test.mjs` exits 0
    - Test pass count for `style-assignment.test.mjs` matches pre-edit count (assertions updated, not deleted; `STYLE_WEIGHTS sum to 1.0` still passes)
    - 4 separate git commits (`git log --oneline -4` shows 4 commits with `test(38-02): ...drop 'short'...` messages)
  </acceptance_criteria>
  <done>4 test files updated; all assertions pass; 4 atomic commits land per file.</done>
</task>

<task type="auto">
  <name>Task 6: Add NEW invariant test youtube-no-short-classification.test.mjs (4 source-reading assertions)</name>
  <files>app/tests/services/youtube-no-short-classification.test.mjs</files>
  <behavior>
    - Test 1: probePortrait function does not appear in app/src/services/youtube.service.ts (function deleted)
    - Test 2: literal `sourceType: 'short'` does not appear in app/src/services/concept-feed.service.ts (assignment site removed)
    - Test 3: literal `presentationStyle: 'short'` does not appear in app/src/services/concept-feed.service.ts (assignment site removed)
    - Test 4a: STYLE_WEIGHTS in app/src/services/style-assignment.ts does not contain a `short:` key
    - Test 4b: STYLE_WEIGHTS values still sum to 1.0 (within float tolerance 1e-9)

    Behavioral framing: Source-reading invariant test (matches Phase 27 web-search-no-locale + Phase 37 leaf-imports patterns). Each assertion guards against drift — if a future agent reintroduces a `'short'` classifier, this test fires immediately.
  </behavior>
  <read_first>
    1. `app/tests/services/leaf-imports.test.mjs` — Phase 37's source-reading invariant test as the canonical pattern to follow (4 assertions on file-content regex matches; uses `readFileSync` + path resolution).
    2. `app/tests/services/web-search-no-locale.test.mjs` — Phase 27's invariant test (older pattern; pick whichever is closer to your target shape).
    3. RESEARCH.md § INV-1h "NEW test to add" subsection (the 4 assertions specified by name).
    4. RESEARCH.md § Wave 0 Gaps in VALIDATION.md.
    5. The post-Task-1 state of all 3 source files (types/index.ts, youtube.service.ts, concept-feed.service.ts, style-assignment.ts) to verify the test will pass against the new state.
  </read_first>
  <action>
    Create the file `app/tests/services/youtube-no-short-classification.test.mjs` with 4 source-reading assertions. Use the Phase 37 `leaf-imports.test.mjs` pattern (readFileSync + regex matching).

    Full file content (write to disk verbatim):

    ```javascript
    // Phase 38 (TECHDEBT-06) regression guard: ensures the YouTube short post type
    // and its classifier (probePortrait + sourceType 'short') stay deleted.
    //
    // Why this exists: per .planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md
    // D-02, the short/video classification was DROPPED entirely (not improved). The
    // honest reasoning: thumbnail aspect ratio is uncorrelated with video orientation,
    // and YouTube API quota is too tight for videos.list?part=contentDetails calls.
    // The "landscape video listed as short" bug (TECHDEBT-06) was eliminated by
    // removing the classifier — there is no classifier to be wrong.
    //
    // Future agents may be tempted to re-introduce a classifier (image-probe heuristic,
    // shorts-tag query, or any other detection mechanism). This test fires if any of
    // them do.
    //
    // See also:
    //   - .planning/phases/38-v1-4-carry-over-cleanup/38-RESEARCH.md § INV-1
    //   - CLAUDE.md "Video & short post completion signals (Phase 38)" section.

    import assert from 'node:assert/strict';
    import { describe, it } from 'node:test';
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const YOUTUBE_PATH = resolve(__dirname, '../../src/services/youtube.service.ts');
    const CONCEPT_FEED_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
    const STYLE_ASSIGNMENT_PATH = resolve(__dirname, '../../src/services/style-assignment.ts');

    const youtubeSource = readFileSync(YOUTUBE_PATH, 'utf-8');
    const conceptFeedSource = readFileSync(CONCEPT_FEED_PATH, 'utf-8');
    const styleAssignmentSource = readFileSync(STYLE_ASSIGNMENT_PATH, 'utf-8');

    describe('YouTube no-short classification invariant (Phase 38 / TECHDEBT-06)', () => {
      it('probePortrait function is deleted from youtube.service.ts (no classifier)', () => {
        assert.ok(
          !youtubeSource.includes('probePortrait'),
          `youtube.service.ts must NOT contain probePortrait — the short classifier was removed in Phase 38 (TECHDEBT-06). ` +
          `If you need to detect portrait videos, that decision was explicitly rejected in 38-CONTEXT.md D-02 ` +
          `(YouTube API quota too tight; thumbnail aspect ratio uncorrelated with video orientation).`
        );
      });

      it("sourceType: 'short' literal is absent from concept-feed.service.ts (no short post construction)", () => {
        // Match the shape: `sourceType: 'short'` with optional whitespace; also matches `sourceType: "short"`.
        const matches = conceptFeedSource.match(/sourceType:\s*['"]short['"]/g) || [];
        assert.equal(
          matches.length,
          0,
          `concept-feed.service.ts must NOT assign sourceType: 'short' anywhere — the short post type was removed in Phase 38. ` +
          `Found ${matches.length} occurrences. All YouTube content uses sourceType: 'video'.`
        );
      });

      it("presentationStyle: 'short' literal is absent from concept-feed.service.ts (no short presentation style)", () => {
        const matches = conceptFeedSource.match(/presentationStyle:\s*['"]short['"]/g) || [];
        assert.equal(
          matches.length,
          0,
          `concept-feed.service.ts must NOT assign presentationStyle: 'short' anywhere — the short presentation style was removed in Phase 38. ` +
          `Found ${matches.length} occurrences.`
        );
      });

      it("STYLE_WEIGHTS in style-assignment.ts has no 'short' key AND values sum to 1.0", () => {
        // Match a key like:    'short': 0.10    or    short: 0.10
        // (inside the STYLE_WEIGHTS object literal — best-effort regex; broad enough to catch reintroduction)
        const shortKeyMatches = styleAssignmentSource.match(/['"]?short['"]?\s*:\s*\d+(\.\d+)?/g) || [];
        assert.equal(
          shortKeyMatches.length,
          0,
          `style-assignment.ts must NOT contain a 'short' key in STYLE_WEIGHTS or anywhere with a numeric value. ` +
          `Found ${shortKeyMatches.length} occurrences. Phase 38 removed short and absorbed its 0.10 weight into video (now video: 0.20).`
        );

        // Sum check — extract numeric values from the STYLE_WEIGHTS block and verify sum = 1.0.
        // Find the STYLE_WEIGHTS object literal: from `STYLE_WEIGHTS` keyword to the closing `};`.
        const blockMatch = styleAssignmentSource.match(/STYLE_WEIGHTS[\s\S]*?\};/);
        assert.ok(blockMatch, 'STYLE_WEIGHTS object literal must be findable in style-assignment.ts.');
        const block = blockMatch[0];
        // Extract all numeric literals from the block.
        const numericMatches = block.match(/\d+\.\d+/g) || [];
        const numbers = numericMatches.map(Number);
        const sum = numbers.reduce((a, b) => a + b, 0);
        assert.ok(
          Math.abs(sum - 1.0) < 1e-9,
          `STYLE_WEIGHTS values must sum to 1.0 (within 1e-9 float tolerance). Found sum = ${sum}. ` +
          `If you removed or added a weight, redistribute to keep sum=1.0 (per CLAUDE.md "Concept Feed Generation Pipeline" stratification math).`
        );
      });
    });
    ```

    Run the test:
    ```bash
    cd app && node --test tests/services/youtube-no-short-classification.test.mjs
    ```

    All 4 assertions must pass against the post-Task-1 state.

    Commit:
    ```
    git add app/tests/services/youtube-no-short-classification.test.mjs
    git commit -m "test(38-02): add youtube-no-short-classification invariant guard

    Source-reading invariant test (4 assertions) preventing reintroduction of
    the short classifier. Guards probePortrait absence, sourceType/presentationStyle
    'short' literals absence, and STYLE_WEIGHTS shape (no 'short' key + sum=1.0).

    Pattern follows Phase 37's leaf-imports.test.mjs and Phase 27's
    web-search-no-locale.test.mjs."
    ```
  </action>
  <verify>
    <automated>cd app && node --test tests/services/youtube-no-short-classification.test.mjs 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/services/youtube-no-short-classification.test.mjs` exists
    - `cd app && node --test tests/services/youtube-no-short-classification.test.mjs` exits 0 with 4 passing assertions
    - File contains the 4 expected assertions (grep `it\(` returns 4 hits)
    - Test imports use the Phase 37 `readFileSync + path resolution` pattern (grep for `readFileSync` returns at least 1)
    - Test references the canonical project files (grep for `youtube.service.ts` and `concept-feed.service.ts` and `style-assignment.ts` each return at least 1)
    - Test file has at least 50 lines (substantive — not a stub)
  </acceptance_criteria>
  <done>NEW invariant test file lands; all 4 source-reading assertions pass; pattern matches Phase 37 canon.</done>
</task>

<task type="auto">
  <name>Task 7: Amend CLAUDE.md "Video & short post completion signals (Phase 36 GAP-C)" section to reflect Phase 38</name>
  <files>CLAUDE.md</files>
  <read_first>
    1. CLAUDE.md lines 107-132 (the "Video & short post completion signals (Phase 36 GAP-C — load-bearing)" section). This is the section being amended.
    2. CONTEXT.md D-02b (the hybrid interaction decision).
    3. RESEARCH.md § INV-6 (the "CLAUDE.md GAP-C section" subsection — exact amendment guidance).
    4. The post-Task-1 state of `app/src/components/InfoFlow.tsx` to confirm the migrated emit lives in the video thumbnail onClick (so the rule prose accurately describes the live code).
  </read_first>
  <action>
    Edit ONLY the section at lines 107-132 of CLAUDE.md (the GAP-C section). Do NOT touch any other section. Do NOT touch the brand-history paragraph at line 5. Do NOT touch the Phase 33 UAT-4 sections. Do NOT touch the Concept Feed Pipeline section.

    Make the following targeted changes within the GAP-C section:

    **Change 1 — Section title (line 107):**
    BEFORE: `## Video & short post completion signals (Phase 36 GAP-C — load-bearing)`
    AFTER: `## Video post completion signals (Phase 36 GAP-C, generalized in Phase 38 — load-bearing)`

    **Change 2 — Opening paragraph (line 109):**
    BEFORE: `Video and short posts have explicit completion-signal detectors so the lazy-skip walker (Phase 36 GAP-2) sees \`CONCEPT_EXPLORED\` events for video-only engagement. Without these detectors, watching a video for a concept never increments vine progress and the walker keeps re-suggesting the same concept on subsequent refills.`
    AFTER: `Video posts have explicit completion-signal detectors so the lazy-skip walker (Phase 36 GAP-2) sees \`CONCEPT_EXPLORED\` events for video-only engagement. Without these detectors, watching a video for a concept never increments vine progress and the walker keeps re-suggesting the same concept on subsequent refills. Phase 38 (TECHDEBT-06) dropped the \`short\` post type entirely; all YouTube content is \`sourceType: 'video'\` and the thumbnail-tap inline-play emit (formerly the "Short tap-to-play" detector) generalized to fire on any video card thumbnail tap.`

    **Change 3 — Detector inventory table (lines 113-119):**

    BEFORE:
    ```
    ### Detector inventory (PostDetailScreen.tsx + InfoFlow.tsx)

    | Detector | Where | Trigger | Post types covered |
    |----------|-------|---------|---------------------|
    | A — scroll 70% sentinel | `PostDetailScreen.tsx:124-137` | IntersectionObserver fires on essay sentinel | text/image/news (sentinel below essay body) |
    | B — 30s dwell timer | `PostDetailScreen.tsx:139-149` | setTimeout(30_000) on resolvedAnchorId | all post types reaching detail screen |
    | C — Q&A follow-up | `PostDetailScreen.tsx:406-411` | handleAsk on user submit | all post types reaching detail screen |
    | **D — YouTube IFrame API postMessage** | `PostDetailScreen.tsx` (after Detector B) | window 'message' event: `onStateChange info=0` (ENDED) OR `infoDelivery currentTime/duration >= 0.8` | video (sourceType='video') |
    | **Short tap-to-play emit** | `InfoFlow.tsx` (short card onClick) | setVideoPlaying invoked on short post | short (sourceType='short') — never reaches detail screen |
    ```

    AFTER (delete the "Short tap-to-play emit" row entirely; rename Detector D's coverage label since 'video' is now the only YouTube type; ADD a new row labeled "Video thumbnail-tap inline-play emit" covering the migrated GAP-C semantic):
    ```
    ### Detector inventory (PostDetailScreen.tsx + InfoFlow.tsx)

    | Detector | Where | Trigger | Post types covered |
    |----------|-------|---------|---------------------|
    | A — scroll 70% sentinel | `PostDetailScreen.tsx:124-137` | IntersectionObserver fires on essay sentinel | text/image/news (sentinel below essay body) |
    | B — 30s dwell timer | `PostDetailScreen.tsx:139-149` | setTimeout(30_000) on resolvedAnchorId | all post types reaching detail screen |
    | C — Q&A follow-up | `PostDetailScreen.tsx:406-411` | handleAsk on user submit | all post types reaching detail screen |
    | **D — YouTube IFrame API postMessage** | `PostDetailScreen.tsx` (after Detector B) | window 'message' event: `onStateChange info=0` (ENDED) OR `infoDelivery currentTime/duration >= 0.8` | video (sourceType='video') — engagement after navigate |
    | **Video thumbnail-tap inline-play emit** | `InfoFlow.tsx` (video card thumbnail onClick) | setVideoPlaying invoked on video post via thumbnail tap | video (sourceType='video') — engagement WITHOUT navigate (D-02b hybrid interaction; formerly the "Short tap-to-play emit") |
    ```

    **Change 4 — "Why both Detector D AND the short tap emit exist" subsection (lines 121-124):**

    BEFORE:
    ```
    ### Why both Detector D AND the short tap emit exist

    - Video posts (`sourceType === 'video'`) navigate to PostDetailScreen via `onOpen`. Detector D listens on the parent window for postMessage events from the YouTube iframe (which now includes `enablejsapi=1` — required to activate the API channel).
    - Short posts (`sourceType === 'short'`) have `interactive=false` at `InfoFlow.tsx:295` and play inline in the feed without navigating. Detectors A/B/C/D never run. Tap-to-play (5-15s clips) is the strongest implicit signal available — `setVideoPlaying(post.id)` fires `dailyReadService.markExplored` + `eventBus.emit({type: 'CONCEPT_EXPLORED', ...})` directly.
    ```

    AFTER:
    ```
    ### Why both Detector D AND the thumbnail-tap inline-play emit exist (D-02b hybrid interaction)

    - Video posts in the feed have a HYBRID interaction (Phase 38 D-02b): tapping the **thumbnail/iframe area** plays inline (no navigation) — the inline-play emit at `InfoFlow.tsx` video card thumbnail `onClick` fires `dailyReadService.markExplored` + `eventBus.emit({type: 'CONCEPT_EXPLORED', ...})` directly. Tapping the **title/teaser/hook/channel attribution area** navigates to PostDetailScreen via `onOpen`/`handleActivate` — Detector D then listens on the parent window for postMessage events from the YouTube iframe (which includes `enablejsapi=1` — required to activate the API channel).
    - Both paths now exist for ALL video posts. Phase 38 generalized the formerly short-only inline-play emit because dropping the `short` type meant ALL videos otherwise would have been forced through tap-and-navigate (losing the low-friction inline preview that Phase 36 GAP-C established for shorts).
    ```

    **Change 5 — Rule 1 (line 128):**
    BEFORE: `1. **Don't remove \`enablejsapi=1\` from YouTubeEmbed.tsx or InfoFlow.tsx iframe srcs.** Without it, YouTube's IFrame Player API postMessage channel is closed and Detector D receives nothing. Tests at \`app/tests/screens/PostDetailScreen.video-detector.test.mjs\` enforce Detector D's structure but cannot detect a missing query param at compile time — the iframe-src tests at \`app/tests/components/InfoFlow.short-tap-emit.test.mjs\` do not directly assert this either, but \`grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx app/src/components/InfoFlow.tsx\` is the source-of-truth check (must return ≥3).`
    AFTER (update the test file reference — `InfoFlow.short-tap-emit.test.mjs` was renamed to `InfoFlow.video-tap-emit.test.mjs` in Plan 38-02 Task 4):
    `1. **Don't remove \`enablejsapi=1\` from YouTubeEmbed.tsx or InfoFlow.tsx iframe srcs.** Without it, YouTube's IFrame Player API postMessage channel is closed and Detector D receives nothing. Tests at \`app/tests/screens/PostDetailScreen.video-detector.test.mjs\` enforce Detector D's structure but cannot detect a missing query param at compile time — the iframe-src tests at \`app/tests/components/InfoFlow.video-tap-emit.test.mjs\` do not directly assert this either, but \`grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx app/src/components/InfoFlow.tsx\` is the source-of-truth check (must return ≥3).`

    **Change 6 — Rule 3 (line 130) — REWRITE per critical_design_constraint #4:**

    BEFORE: `3. **Don't add a duplicate emit in the InfoFlow video card onClick** (line ~368-371). Video posts route through PostDetailScreen → Detector D; adding an emit at the feed-tap point would double-fire (idempotent via \`hasEmittedRef\`/markExplored, but still unnecessary work + confusing semantics). Test \`InfoFlow.short-tap-emit.test.mjs\` enforces \`markExplored\` is called exactly once in InfoFlow.tsx.`

    AFTER (the rule semantic CHANGED in Phase 38 — the emit now LIVES in the thumbnail onClick by design; the new prohibition is on DOUBLE-emit i.e. adding a second emit at the card-level onClick):
    `3. **Don't add a SECOND emit at the InfoFlow video card-level onClick.** The Phase 36 GAP-C emit already lives in the video card's THUMBNAIL onClick (where setVideoPlaying fires). Adding a second emit at the card-level onClick (which navigates to PostDetailScreen via handleActivate) would double-fire on every card tap — once from thumbnail bubble, once from card. The thumbnail onClick uses \`e.stopPropagation()\` to prevent bubble; preserve this. The single emit is enforced by \`InfoFlow.video-tap-emit.test.mjs\` which asserts \`dailyReadService.markExplored\` and \`CONCEPT_EXPLORED\` each appear EXACTLY ONCE in InfoFlow.tsx.`

    **Change 7 — Rule 4 (line 131):**
    BEFORE: `4. **Don't introduce new event types** for video/short completion. Reuse \`CONCEPT_EXPLORED\` (CLAUDE.md best practice rule 6 — one signal per semantic event). The walker subscribes to a single event; multiple events would fragment the lazy-skip flow.`
    AFTER: `4. **Don't introduce new event types** for video completion. Reuse \`CONCEPT_EXPLORED\` (CLAUDE.md best practice rule 6 — one signal per semantic event). The walker subscribes to a single event; multiple events would fragment the lazy-skip flow.`

    **Change 8 — Rule 5 (line 132):** Unchanged. (Detector D rendering rule still applies.)

    Commit:
    ```
    git add CLAUDE.md
    git commit -m "docs(38-02): amend CLAUDE.md GAP-C section for Phase 38 short type removal

    Section retitled: 'Video post completion signals (Phase 36 GAP-C, generalized in Phase 38)'.
    - Detector inventory: 'Short tap-to-play emit' row replaced with 'Video thumbnail-tap inline-play emit' (covers hybrid D-02b interaction)
    - Why-both subsection rewritten to describe hybrid interaction (thumbnail = inline, title/teaser = navigate)
    - Rule 1: test file reference updated (short-tap-emit → video-tap-emit)
    - Rule 3: rewrote — the emit NOW LIVES in the thumbnail onClick by design; the new prohibition is on adding a SECOND emit at the card-level
    - Rule 4: dropped 'short' from event-type prohibition wording
    - Rule 5: unchanged"
    ```
  </action>
  <verify>
    <automated>grep -c "Phase 36 GAP-C, generalized in Phase 38" CLAUDE.md && grep -c "Video thumbnail-tap inline-play emit" CLAUDE.md && grep -c "InfoFlow.video-tap-emit.test.mjs" CLAUDE.md && ! grep -q "Short tap-to-play emit" CLAUDE.md && grep -c "D-02b hybrid interaction" CLAUDE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## Video post completion signals (Phase 36 GAP-C, generalized in Phase 38" CLAUDE.md` returns 1 (section title updated)
    - `grep -c "Short tap-to-play emit" CLAUDE.md` returns 0 (old detector row deleted)
    - `grep -c "Video thumbnail-tap inline-play emit" CLAUDE.md` returns at least 1 (new detector row added)
    - `grep -c "InfoFlow.video-tap-emit.test.mjs" CLAUDE.md` returns at least 1 (test file reference updated in Rule 1 + Rule 3)
    - `grep -c "InfoFlow.short-tap-emit.test.mjs" CLAUDE.md` returns 0 (old test reference replaced)
    - `grep -c "D-02b hybrid interaction" CLAUDE.md` returns at least 1 (hybrid interaction documented)
    - `grep -c "Phase 38 dropped the .short. post type" CLAUDE.md` returns at least 1 OR `grep -c "Phase 38 (TECHDEBT-06) dropped the .short. post type" CLAUDE.md` returns at least 1 (Phase 38 transition note)
    - `grep -c "## Header positioning" CLAUDE.md` returns 1 (other sections untouched — Header section still exists)
    - `grep -c "Brand history" CLAUDE.md` returns at least 1 (brand-history paragraph untouched)
  </acceptance_criteria>
  <done>CLAUDE.md GAP-C section retitled and amended; detector inventory updated; rules 1, 3, 4 rewritten; other CLAUDE.md sections untouched.</done>
</task>

<task type="auto">
  <name>Task 8: Full-suite verification — tsc + npm test + Phase 37 baseline preservation</name>
  <files>(no files modified — verification gate only)</files>
  <read_first>
    1. plan_notes "TEST BASELINE PRESERVATION" section at the top of this PLAN.
    2. STATE.md "Test baseline (post-Plan-37-03)" line — Phase 37 close baseline = test:main 558/555/3 + test:actions 16/14/2.
    3. RESEARCH.md § Validation Architecture — sampling rate gate.
  </read_first>
  <action>
    Run the full verification gate from the project root:

    ```bash
    # 1. TypeScript clean
    cd app && npx tsc -b --noEmit
    echo "tsc exit: $?"

    # 2. Full test suite — main
    cd app && npm run test:main 2>&1 | tail -20
    # Expected: ≤3 failures (Phase 37 baseline preserved). Net pass count
    # may shift up by ~3 (new invariant test +4, post-essay assertion -1).

    # 3. Full test suite — actions (separate runner per CLAUDE.md test architecture)
    cd app && npm run test:actions 2>&1 | tail -20
    # Expected: ≤2 failures (Phase 37 baseline preserved).

    # 4. Source sweep — confirm no residual 'short' references in production code
    grep -rn "isShortPost\|probePortrait\|sourceType:\s*['\"]short['\"]\|presentationStyle:\s*['\"]short['\"]" app/src/ --include="*.ts" --include="*.tsx" | wc -l
    # Expected: 0

    # 5. New invariant test must be green
    cd app && node --test tests/services/youtube-no-short-classification.test.mjs 2>&1 | tail -3

    # 6. Renamed test must be green
    cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs 2>&1 | tail -3
    ```

    **ACCEPTANCE GATE:**
    - tsc exits 0
    - test:main shows ≤3 failures AND none of the failure messages contain `'short'` OR `ERR_IMPORT_ATTRIBUTE_MISSING`
    - test:actions shows ≤2 failures AND none of the failure messages contain `'short'` OR `ERR_IMPORT_ATTRIBUTE_MISSING`
    - The grep sweep for residual short references returns 0
    - Invariant test (4 assertions) passes
    - Renamed video-tap-emit test (4 assertions) passes

    If ANY of these fail, debug + fix in a follow-up commit before declaring the plan complete. The most likely failure modes:
    - TS error from a missed `=== 'short'` site → grep + delete the missed site → re-run tsc
    - InfoFlow.video-tap-emit test fails because the GAP-C migration shifted the markExplored or CONCEPT_EXPLORED count → check that exactly ONE emit lives in InfoFlow.tsx (in the video thumbnail onClick) and the short-card block was fully deleted
    - Bundle parity test fails → one of the 4 i18n bundles still has shortTag → grep + delete

    Record the final test counts (passed/failed/total for both runners) for inclusion in the SUMMARY.

    Do NOT commit anything in this task — it is a verification gate only.
  </action>
  <verify>
    <automated>cd app && npx tsc -b --noEmit && npm run test:main 2>&1 | tail -5 && npm run test:actions 2>&1 | tail -5 && node --test tests/services/youtube-no-short-classification.test.mjs tests/components/InfoFlow.video-tap-emit.test.mjs 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && npx tsc -b --noEmit` exits 0
    - `cd app && npm run test:main` shows tests pass count ≥ 555 AND fail count ≤ 3 (Phase 37 baseline 558/555/3 preserved)
    - `cd app && npm run test:actions` shows tests pass count ≥ 14 AND fail count ≤ 2 (Phase 37 baseline 16/14/2 preserved)
    - Failure messages from test:main and test:actions do NOT contain `ERR_IMPORT_ATTRIBUTE_MISSING` (Phase 37 fixes preserved)
    - Failure messages do NOT contain `probePortrait` or `'short'` regression sentinels
    - `grep -rn "isShortPost\|probePortrait" app/src/ --include="*.ts" --include="*.tsx" | wc -l` returns 0
    - `cd app && node --test tests/services/youtube-no-short-classification.test.mjs` exits 0 with 4 passing
    - `cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs` exits 0 with 4 passing
    - Final test counts recorded for SUMMARY.md
  </acceptance_criteria>
  <done>tsc clean; full suite preserves Phase 37 baseline (≤3 main fails, ≤2 actions fails); no regression sentinels in failure messages; new invariant test + renamed video-tap-emit test green.</done>
</task>

</tasks>

<verification>
After all 8 tasks complete, the phase boundary check:

```bash
# Sanity: short type fully gone from source
grep -rn "isShortPost\|probePortrait\|sourceType:\s*['\"]short['\"]\|presentationStyle:\s*['\"]short['\"]" app/src/ --include="*.ts" --include="*.tsx" | wc -l  # expect 0

# Sanity: STYLE_WEIGHTS arithmetic
grep "video: 0.20" app/src/services/style-assignment.ts  # expect 1 hit
grep "short:" app/src/services/style-assignment.ts | grep -v "//" | wc -l  # expect 0 (no live key)

# Sanity: GAP-C emit migrated correctly
grep -c "dailyReadService.markExplored" app/src/components/InfoFlow.tsx  # expect 1
grep -c "type: 'CONCEPT_EXPLORED'" app/src/components/InfoFlow.tsx  # expect 1
grep -c "\\[InfoFlow\\] video tap-to-play emit failed" app/src/components/InfoFlow.tsx  # expect 1

# Sanity: i18n parity preserved
cd app && node --test tests/locales/bundle-parity.test.mjs 2>&1 | tail -3

# Sanity: invariant + renamed tests green
cd app && node --test tests/services/youtube-no-short-classification.test.mjs tests/components/InfoFlow.video-tap-emit.test.mjs 2>&1 | tail -5

# Sanity: full suite preserves Phase 37 baseline
cd app && npm test 2>&1 | tail -10  # expect main ≤3 fails, actions ≤2 fails

# Sanity: CLAUDE.md amendment landed
grep -c "Phase 36 GAP-C, generalized in Phase 38" CLAUDE.md  # expect 1
grep -c "Short tap-to-play emit" CLAUDE.md  # expect 0
```

Then write `38-02-SUMMARY.md` with:
- Per-task summary (file paths + commits + test counts)
- Final test baseline tally vs Phase 37 baseline
- Confirmation that the InfoFlow.video-tap-emit test confirms the single-emit semantic (Phase 36 GAP-C invariant preserved across the migration)
- Note on the deferred legacy data cleanup (`trellis_short_posts` localStorage key — stale data harmless after read site removed; a one-time delete in legacy-migration.service.ts is OPTIONAL and was deferred per CONTEXT.md Bucket C decision)
</verification>

<success_criteria>
- TECHDEBT-06 closed: short post type eliminated from type unions, code, tests, i18n bundles, and CLAUDE.md.
- tsc -b --noEmit exits 0; full test suite preserves Phase 37 baseline (≤3 fails in test:main, ≤2 in test:actions); no regression sentinels in failure messages.
- New `youtube-no-short-classification.test.mjs` invariant test + renamed `InfoFlow.video-tap-emit.test.mjs` both green.
- Phase 36 GAP-C completion-signal semantic preserved through the migration (single emit on video thumbnail tap; Detector D unchanged for navigate path).
- D-02a aspect-ratio: auto + D-02b hybrid interaction landed in InfoFlow.tsx video card.
- All 8 tasks commit as atomic units (~10 commits total — 1 large + 7 small atomic per Plan 37 D-03 pattern).
- 38-02-SUMMARY.md exists with full audit trail.
</success_criteria>

<output>
After completion, create `.planning/phases/38-v1-4-carry-over-cleanup/38-02-SUMMARY.md` with:
- Per-task summary (commits, test counts, file paths)
- Final test counts vs Phase 37 baseline (test:main + test:actions)
- Confirmation of single-emit semantic preserved
- The 1 deferred item (`trellis_short_posts` legacy localStorage cleanup) explicitly noted as Bucket C / out-of-scope
- Verification command outputs reproduced inline
</output>
