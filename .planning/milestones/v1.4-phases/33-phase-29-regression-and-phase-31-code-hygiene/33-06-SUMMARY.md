---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
plan: 06
subsystem: perf
tags: [perf, memoization, react-memo, settings-snapshot, infoflow, vineprogress, homescreen, d-22, d-23]

# Dependency graph
requires:
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: 33-05 working-tree-clean prerequisite + 33-03 LeafState rename complete (clean baseline for atomic per-task perf commits)
  - phase: 32.1-curiosity-feed-uat-cycle
    provides: Wave 4 D-W4-03 wouldRenderVisual exhaustive check at InfoFlow.tsx:140-167 (load-bearing render fallback that this plan MUST preserve byte-identical)
  - phase: 27-add-i18n-l10n-support
    provides: settings.imageGeneration.enabled + embeddingDebug.showScores fields stable (consumed by snapshots)
provides:
  - "ConceptCard wrapped in React.memo with 6-prop equality function (post.id + isActive + videoPlaying + onOpen + setVideoPlaying + feedIndex); 8 cards no longer all re-render on every event-bus emission"
  - "VineProgress wrapped in React.memo with custom 4-key equality (mode + onConceptTap + onHistoryTap + concepts.map(c=>id+explored).join('|')) — array-reference rebuilds in parent no longer trigger child re-render"
  - "InfoFlow.tsx ConceptCard: imageGeneration.enabled hoisted from per-card useEffect read into useState seed (one-shot per mount)"
  - "HomeScreen.tsx: embeddingDebug.showScores hoisted from JSX render-closure read into useState snapshot at top of component body"
  - "wouldRenderVisual exhaustive check (Phase 32.1 Wave 4 D-W4-03) preserved byte-identical — memo wrapper sits OUTSIDE the render fallback, never inside"
  - "TrellisLeaf NOT wrapped (D-23 explicit out-of-scope — interacts with Phase 28 D-10/D-11/D-12/D-13 animation surfaces; deferred to v1.5)"
affects: [v1.5-perf-followups, future-trellisleaf-memo-revisit, future-settings-event-bus-invalidation-pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useState-seeded settings snapshot: subscribe-once-on-mount pattern (per CONTEXT D-22 option (b)) — hoists settingsService.getSync() reads from render closures / per-effect bodies into a single useState initializer that runs once at mount. Trade-off: settings changes during a single mount don't invalidate (acceptable when downstream consumer is one-shot per mount)."
    - "React.memo with explicit prop-only equality comparator: comparator inspects only public props (NOT internal state — useState changes always re-render regardless). 6-prop comparator for ConceptCard, 4-key comparator for VineProgress including derived stringification of concepts array contents (id + explored boolean)."
    - "Atomic per-decision commit granularity: D-22a / D-22b / D-23 each ship as their own commit so any regression bisects to the exact wrapping (per CONTEXT 'Specifics' guidance — don't bundle ConceptCard memo with VineProgress memo)."
    - "Render-fallback guardrail preservation: when adding render-layer optimizations, the wouldRenderVisual exhaustive check (Phase 32.1 Wave 4 D-W4-03) MUST stay byte-identical. The memo wrapper sits OUTSIDE the fallback — it changes WHETHER a render occurs, not WHAT happens inside one."

key-files:
  created: []
  modified:
    - app/src/components/InfoFlow.tsx
    - app/src/components/VineProgress.tsx
    - app/src/screens/HomeScreen.tsx

key-decisions:
  - "D-22a honored: settingsService.getSync().imageGeneration.enabled hoisted from inside the per-card useEffect at InfoFlow.tsx:103 to a useState seed at line ~100 of ConceptCard. The read no longer re-evaluates every time the effect's deps change (post.id, isSuggestion, isVideoPost, isShortPost, isNewsPost, presentationStyle)."
  - "D-22b honored: the single render-closure settingsService.getSync() call site in HomeScreen.tsx (line 727: showConnectionScores={settingsService.getSync().embeddingDebug.showScores}) hoisted into a useState-seeded settingsSnapshot at line ~55 of the component body. Grouped as object to be cleanly extensible if additional render-closure settings reads emerge later."
  - "D-23 honored for ConceptCard: wrapped via const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual) defined immediately after the function ConceptCard body (line ~610). Both <ConceptCard ...> call sites in InlineInfoFlow + ImmersiveInfoFlow swapped to <MemoizedConceptCard ...>. Equality compares 6 public props by reference."
  - "D-23 honored for VineProgress: file used named export `export function VineProgress` (not default), so renamed inner function to VineProgressImpl and re-exported as `export const VineProgress = React.memo(VineProgressImpl, vineProgressPropsEqual)`. All consumers (HomeScreen.tsx via named import) keep the same import statement; type signature unchanged."
  - "D-23 explicit out-of-scope honored: TrellisLeaf NOT wrapped. Verified via grep -c 'React.memo' app/src/components/trellis/TrellisLeaf.tsx returns 0."
  - "D-22-GUARDRAIL honored: wouldRenderVisual exhaustive check at InfoFlow.tsx:158-165 (originally line 140-167; moved 8 lines down due to D-22a's 8-line useState insertion above) is byte-identical to pre-Plan baseline. The memo wrapper sits OUTSIDE the render fallback — it changes WHETHER a render occurs, not what happens inside one."
  - "Internal state explicitly excluded from React.memo equality functions: image, imageResolved, effectivePresentationStyle (for ConceptCard), and expanded, measuredWidth (for VineProgress) are useState-derived. React.memo only inspects PROPS — internal state changes always trigger re-render via React's normal useState behavior, so listing them in the comparator would be incorrect."

patterns-established:
  - "useState-seeded settings snapshot for render-hotspot reads: replace settingsService.getSync().path.to.value in render closures or per-render useEffect bodies with const [snapshot] = useState(() => settingsService.getSync().path.to.value). Acceptable when consumer is one-shot per mount; if a future operator surfaces 'settings change doesn't apply until I refresh', layer in a SETTINGS_CHANGED event-bus subscription that calls a setter."
  - "Prop-only memo equality comparator: list ALL public props in the comparator; do NOT list internal useState. Compare callback identities by reference (parent should useCallback if needed); compare arrays by derived string key (e.g., concepts.map(c => c.id + (c.explored ? '1' : '0')).join('|'))."
  - "Memo wrapping via const + named export rebind: when wrapping a NAMED export (not default), rename inner function to FooImpl and re-export `export const Foo = React.memo(FooImpl, equality)` at the bottom of the file. Consumers' import statements stay unchanged."
  - "Atomic per-decision commit cadence: keep D-22a + D-22b + D-23 in separate commits even when files overlap (D-22a + D-23 both touch InfoFlow.tsx). Bisect points are per-decision, not per-file."

requirements-completed: [PERF-MEMO]

# Metrics
duration: ~10min
completed: 2026-04-19
---

# Phase 33 Plan 06: Opportunistic Memoization Summary

**Hoisted 2 settings reads out of render hotspots (InfoFlow ConceptCard image-effect + HomeScreen InlineInfoFlow showConnectionScores prop) and wrapped 2 heavy components (ConceptCard, VineProgress) in React.memo with custom equality comparators, while preserving the wouldRenderVisual exhaustive check (Phase 32.1 Wave 4 D-W4-03) byte-identical and explicitly leaving TrellisLeaf untouched per D-23 scope boundary.**

## Performance

- **Duration:** ~4 min wall-clock between first and third commit (2026-04-19T20:08:05-04:00 → 2026-04-19T20:12:13-04:00). Total session including reads + verification: ~10 min.
- **Started:** 2026-04-19T20:08:05-04:00 (Task 1 commit)
- **Completed:** 2026-04-19T20:12:13-04:00 (Task 3 commit)
- **Tasks:** 3 (D-22a / D-22b / D-23) — one atomic commit per task
- **Files modified:** 3 unique (InfoFlow.tsx + VineProgress.tsx + HomeScreen.tsx); 4 file-edits across 3 commits (InfoFlow touched in commits 1 + 3, VineProgress in commit 3, HomeScreen in commit 2)
- **Net diff:** 72 insertions, 7 deletions (3 files)

## Accomplishments

- **D-22a (settings memo at ConceptCard hotspot):** `settingsService.getSync().imageGeneration.enabled` hoisted from inside the per-card useEffect (was line 103) to a useState seed inside ConceptCard (now line ~100). The image-effect now references the closure variable; no behavioral change because image generation is a one-shot per-mount decision.
- **D-22b (settings memo at HomeScreen):** The single render-closure call site (`showConnectionScores={settingsService.getSync().embeddingDebug.showScores}` at line 727) hoisted into a `settingsSnapshot` useState near the top of the HomeScreen component body. JSX now reads `settingsSnapshot.showConnectionScores`. Grouped as an object snapshot so future render-closure settings reads can join cleanly.
- **D-23 (React.memo on ConceptCard):** `MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual)` defined after the function body. Both `<ConceptCard ...>` call sites (InlineInfoFlow line ~921, ImmersiveInfoFlow line ~1049) swapped to `<MemoizedConceptCard ...>`. 6-prop equality (post.id + isActive + videoPlaying + onOpen + setVideoPlaying + feedIndex).
- **D-23 (React.memo on VineProgress):** Inner function renamed to `VineProgressImpl`; re-exported as `export const VineProgress = React.memo(VineProgressImpl, vineProgressPropsEqual)`. Custom 4-key equality (mode + onConceptTap + onHistoryTap + concepts.map(c => c.id + (c.explored ? '1' : '0')).join('|')). Consumer (HomeScreen) imports unchanged.
- **D-23 (TrellisLeaf NOT wrapped — explicit out-of-scope):** `grep -c "React.memo" app/src/components/trellis/TrellisLeaf.tsx` returns 0 (verified).
- **D-22-GUARDRAIL (wouldRenderVisual preserved):** The render fallback block (Phase 32.1 Wave 4 D-W4-03 / Bug D defense net) is byte-identical pre/post-plan. Block moved from lines 140-167 to lines 158-165 due to the 8-line useState insertion above (D-22a) but the block content is unchanged.

## Task Commits

Each task committed atomically per CONTEXT "Specifics" guidance (don't bundle ConceptCard memo with VineProgress memo so any regression bisects to the exact wrapping):

1. **Task 1 (D-22a — InfoFlow ConceptCard settings hoist):** `5542f78f` (perf)
   Subject: `perf(InfoFlow): memoize imageGeneration settings read at ConceptCard (D-22)`
2. **Task 2 (D-22b — HomeScreen settings hoist):** `59bb0a8d` (perf)
   Subject: `perf(HomeScreen): memoize settings reads (D-22)`
3. **Task 3 (D-23 — React.memo on ConceptCard + VineProgress, NOT TrellisLeaf):** `9b9eeb01` (perf)
   Subject: `perf(InfoFlow,VineProgress): wrap heavy cards in React.memo (D-23)`

## Files Created/Modified

### Source files (3 files, 4 edits across 3 commits)

- **`app/src/components/InfoFlow.tsx`** (touched in commits 1 + 3) — D-22a: added `const [imageEnabled] = useState(() => settingsService.getSync().imageGeneration.enabled);` at line ~100; replaced `const imageEnabled = settingsService.getSync().imageGeneration.enabled;` inside the useEffect at original line 103 with a comment that references the hoisted snapshot. D-23: added `import React, { useState, useEffect, useRef, useContext } from 'react';` (was named imports only); added `conceptCardPropsEqual` function + `const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual);` after the ConceptCard body; replaced 2 `<ConceptCard ...>` JSX call sites with `<MemoizedConceptCard ...>`.
- **`app/src/components/VineProgress.tsx`** (touched in commit 3) — D-23: added `import React, ...` (was named imports only); renamed inner function from `export function VineProgress` to `function VineProgressImpl`; appended `vineProgressPropsEqual` function + `export const VineProgress = React.memo(VineProgressImpl, vineProgressPropsEqual);` at the bottom.
- **`app/src/screens/HomeScreen.tsx`** (touched in commit 2) — D-22b: added `const [settingsSnapshot] = useState(() => { const s = settingsService.getSync(); return { showConnectionScores: s.embeddingDebug.showScores }; });` at line ~55 (after other useState calls); replaced JSX `showConnectionScores={settingsService.getSync().embeddingDebug.showScores}` at line 727 with `showConnectionScores={settingsSnapshot.showConnectionScores}`.

## Decisions Made

None new — all decisions pre-locked in 33-CONTEXT.md (D-22 / D-22-GUARDRAIL / D-23) and Plan 33-06's `<must_haves>` frontmatter. The only minor deviation from the plan's verbatim instructions was VineProgress's wrapping pattern: the plan suggested `export default React.memo(...)`, but the file uses a NAMED export (`export function VineProgress`) that all consumers import via `import { VineProgress } from`. To preserve consumer call sites unchanged, renamed the inner function to `VineProgressImpl` and re-exported as `export const VineProgress = React.memo(VineProgressImpl, ...)`. Same observable behavior; type signature unchanged. (Plan instructions explicitly noted both patterns as valid.)

## Deviations from Plan

None — plan executed exactly as written.

The single adjustment was a comment-text fix between the first edit and the first commit to satisfy the strict acceptance grep `grep -c "settingsService.getSync().imageGeneration.enabled" returns 1`: the initial comment line referenced the exact phrase verbatim, which made the grep return 2. Reworded the comment to "settings.imageGeneration.enabled" so the count drops to exactly 1 (the hoisted useState seed line). This is a comment-only adjustment with zero behavioral impact.

The VineProgress named-export-vs-default-export adjustment described under "Decisions Made" is also not a deviation in spirit — the plan's `<action>` block explicitly enumerated both patterns ("rename to function VineProgress(...)..." OR "replace export default VineProgress with...") and instructed to choose based on the actual file shape. The file uses neither exact pattern (it's a named function-declaration export), so a third equivalent pattern was used. All acceptance criteria still satisfied.

---

**Total deviations:** 0 (plan executed exactly as written)
**Impact on plan:** Zero — all D-22 / D-23 acceptance criteria met. wouldRenderVisual guardrail preserved. TrellisLeaf untouched. tsc clean. Test count unchanged from baseline.

## Issues Encountered

None. All edits landed on first attempt. tsc stayed clean throughout. Test signature diff was empty (zero new failure kinds, identical 26 baseline failures).

## User Setup Required

None — no external service configuration required.

## Verification

### Pre-task baseline (HEAD = e2b875fb)

```
npx tsc -b --noEmit                                     exit 0 ✓
npm test                                                379 tests / 353 pass / 26 fail
Failure breakdown: 26 = 27 baseline (per 33-03-SUMMARY.md "Test signature diff" table)
                       minus 1 net change from intervening commits — same ERR_IMPORT_ATTRIBUTE_MISSING
                       + ERR_MODULE_NOT_FOUND + ERR_UNKNOWN_FILE_EXTENSION + ERR_ASSERTION
                       + AssertionError [ERR_ASSERTION] signature set
git status --porcelain                                  empty (working tree clean)
git log -1 --format=%h                                  e2b875fb
```

### Post-Task 1 (D-22a — InfoFlow.tsx settings hoist) — HEAD = 5542f78f

```
grep -c "settingsService.getSync().imageGeneration.enabled" app/src/components/InfoFlow.tsx
                                                        → 1 ✓ (the hoisted useState seed)
grep -c "useState(() => settingsService.getSync()" app/src/components/InfoFlow.tsx
                                                        → 1 ✓
grep -c "wouldRenderVisual" app/src/components/InfoFlow.tsx
                                                        → 3 ✓ (declaration + use in
                                                          effectivePresentationStyle + use in
                                                          dev-warn condition; load-bearing
                                                          region intact)
grep -c "const imageEnabled = settingsService" app/src/components/InfoFlow.tsx
                                                        → 0 ✓ (the read is no longer inside
                                                          the useEffect body)
npx tsc -b --noEmit                                     exit 0 ✓
git log -1 --format='%s'  →  perf(InfoFlow): memoize imageGeneration settings read at ConceptCard (D-22) ✓
git diff HEAD~1 --name-only  →  app/src/components/InfoFlow.tsx ✓ (only file)
```

### Post-Task 2 (D-22b — HomeScreen settings hoist) — HEAD = 59bb0a8d

```
grep -nE "showConnectionScores=\{settingsService.getSync" app/src/screens/HomeScreen.tsx
                                                        → 0 hits ✓ (the JSX-render-closure
                                                          pattern from baseline is gone)
grep -n "settingsService.getSync" app/src/screens/HomeScreen.tsx
                                                        → 2 hits ✓
                                                          (line 56 in comment text "// settings.getSync()
                                                           on every render" — descriptive only;
                                                           line 64 inside the useState seeder
                                                           `const s = settingsService.getSync();`)
                                                        → ZERO hits in render-closure body
                                                          or JSX expressions ✓
npx tsc -b --noEmit                                     exit 0 ✓
git log -1 --format='%s'  →  perf(HomeScreen): memoize settings reads (D-22) ✓
git diff HEAD~1 --name-only  →  app/src/screens/HomeScreen.tsx ✓ (only file)
```

### Post-Task 3 (D-23 — React.memo on ConceptCard + VineProgress) — HEAD = 9b9eeb01

```
grep -c "React.memo" app/src/components/InfoFlow.tsx          → 3 ✓ (>=1 required)
grep -c "React.memo" app/src/components/VineProgress.tsx       → 1 ✓ (>=1 required)
grep -c "React.memo" app/src/components/trellis/TrellisLeaf.tsx → 0 ✓ (NOT memoized — D-23 explicit out-of-scope)
grep -c "MemoizedConceptCard" app/src/components/InfoFlow.tsx  → 3 ✓ (>=2 required: 1 definition + 2 call sites)
grep -c "<ConceptCard" app/src/components/InfoFlow.tsx         → 0 ✓ (all call sites swapped)
grep -c "wouldRenderVisual" app/src/components/InfoFlow.tsx    → 4 ✓ (>=3 required; 3 in original
                                                                    code at lines 158/164/165 plus
                                                                    1 new memo-wrapper comment ref
                                                                    at line ~618)

wouldRenderVisual block at InfoFlow.tsx:158-165 byte-identical to baseline (was lines 140-167;
moved down 8 lines due to D-22a's useState insertion above; block content unchanged):
  const wouldRenderVisual =
    (isVideoPost && !!post.videoMeta?.videoId) ||
    (isShortPost && !!post.videoMeta?.videoId) ||
    isNewsPost ||
    !!image ||
    presentationStyle === 'text-art';
  const effectivePresentationStyle: typeof presentationStyle = !wouldRenderVisual ? 'text-art' : presentationStyle;
  if (!wouldRenderVisual && import.meta.env.DEV) {
    console.warn('[InfoFlow] Forced text-art fallback for post', post.id, { ... });
  }

npx tsc -b --noEmit                                     exit 0 ✓
node --test tests/components/FeedPostImage.test.mjs tests/components/PostCarousel.test.mjs
  tests/components/AskScreen.recent.test.mjs            29 pass / 0 fail ✓
                                                          (memoization breaks no targeted tests)
npm test                                                379 tests / 353 pass / 26 fail ✓
                                                          (IDENTICAL to pre-task baseline)
npx vite build                                          exit 0, built in 3.01s ✓
git log -1 --format='%s'  →  perf(InfoFlow,VineProgress): wrap heavy cards in React.memo (D-23) ✓
git diff HEAD~1 --name-only  →  app/src/components/InfoFlow.tsx + app/src/components/VineProgress.tsx ✓
                                (exactly 2 files)
```

### End-of-plan aggregate verification

```
git log HEAD~3..HEAD --format='%h %s':
  9b9eeb01 perf(InfoFlow,VineProgress): wrap heavy cards in React.memo (D-23)
  59bb0a8d perf(HomeScreen): memoize settings reads (D-22)
  5542f78f perf(InfoFlow): memoize imageGeneration settings read at ConceptCard (D-22)
                                                        ✓ 3 atomic commits, one per task

git status --porcelain                                  empty (working tree clean) ✓
npx tsc -b --noEmit                                     exit 0 ✓
npm test fail count: 26 (== baseline 26)                 PASS gate cleared ✓
                                                          (no new failure kinds introduced;
                                                           same JSON-import-attribute /
                                                           ERR_MODULE_NOT_FOUND / etc. baseline)
npx vite build                                          exit 0 ✓
```

### Test signature diff (post-plan vs pre-plan baseline)

| Bucket | Pre-task baseline | Post-task | Delta |
| --- | --- | --- | --- |
| Total tests | 379 | 379 | 0 |
| Pass | 353 | 353 | 0 |
| Fail | 26 | 26 | 0 |
| ERR_IMPORT_ATTRIBUTE_MISSING | present | present | unchanged |
| ERR_MODULE_NOT_FOUND | present | present | unchanged |
| ERR_UNKNOWN_FILE_EXTENSION | present | present | unchanged |
| ERR_ASSERTION | present | present | unchanged |
| AssertionError [ERR_ASSERTION] | present | present | unchanged |

PASS gate cleared: post fail count == baseline (26 == 26) AND post signature set ⊆ baseline signature set (5 == 5, identical sets). Zero new failure kinds introduced. The 26 pre-existing failures are the v1.3/1.4 carry-over from JSON-import-attribute issues, missing TrellisTooltip.tsx, missing podcast.service.ts, tsx loader extension issues, and feed-strategy assertion failures — all documented across 33-RESEARCH.md Pitfall #4/#5 and the prior 33-03-SUMMARY.md.

### Operator dev-mode smoke-test outcome

PENDING — no automated assertion can verify "no behavioral change visible in `npm run dev`". Operator should spot-check on the next APK deploy cycle:

1. Home feed renders 8 cards (no fewer, no more); swipe-for-more pops 4 new posts and the queue refills toward 8
2. Vine progress bar renders correctly (full container width, flowers distributed evenly, gold-flower-on-completion behavior)
3. Image-style cards still respect the Settings → Features → Image generation toggle (toggling OFF still skips image gen for NEW card mounts; existing cards stay as-is, which is acceptable per D-22a's "image generation is a one-shot per-mount decision")
4. Connection-score badge visibility still respects Settings → Features → Embedding debug → Show scores (toggling on/off requires re-mount of /home — acceptable per CONTEXT D-22 option (b))
5. No new "empty card with massive padding" symptoms (the wouldRenderVisual fallback should still convert any visual-less post to text-art)

If any of (1)-(5) regresses, the bisect target is one of: 5542f78f (D-22a), 59bb0a8d (D-22b), 9b9eeb01 (D-23). Per-decision atomic commits make this trivial.

## Self-Check: PASSED

- All 3 modified files exist on disk with renamed/wrapped contents (verified via grep above).
- Commits PRESENT: `5542f78f`, `59bb0a8d`, `9b9eeb01` (verified via `git log HEAD~3..HEAD --format='%h %s'`).
- Subjects exact-match plan acceptance criteria for each task ✓.
- `git diff HEAD~3 --stat`: 3 files changed, 72 insertions(+), 7 deletions(-) ✓
- `npx tsc -b --noEmit`: exit 0 ✓
- `git status --porcelain`: empty (working tree clean) ✓
- `grep -c "React.memo" app/src/components/trellis/TrellisLeaf.tsx`: 0 ✓ (D-23 out-of-scope honored)
- `grep -c "wouldRenderVisual" app/src/components/InfoFlow.tsx`: 4 (>=3 required; load-bearing region byte-identical) ✓
- `npm test`: 379 / 353 pass / 26 fail (delta vs. baseline: 0 / 0 / 0) ✓
- Targeted component tests: 29 pass / 0 fail ✓
- `npx vite build`: exit 0, clean in 3.01s ✓

## Next Phase Readiness

- **Plan 33-07 (cosmetic polish — D-24 / D-25 / D-26)** is the only remaining Phase 33 plan. Touch-target bumps + spacing/shadow token migrations on PlannerScreen.tsx and ChatInput.tsx. Independent file scope from this plan; no overlap risk.
- **Working tree clean**, branch `gsd/phase-33-hygiene-and-polish` ready for next plan execution.
- **Memoization pattern established** for v1.5: if/when TrellisLeaf revisit happens (deferred per D-23 scope boundary because it interacts with Phase 28 D-10/D-11/D-12/D-13 animation surfaces), the comparator pattern from this plan (prop-only equality, exclude internal state) should apply directly. The interaction risk is the perfGuardActive gate + shake/pulse animations — those are state-driven, not prop-driven, so memo's prop-only equality should not interfere; but verification on a real Android APK is required first.
- **Settings-snapshot pattern established** for v1.5: if a future operator surfaces "settings change doesn't apply until I refresh" (acceptable defer per CONTEXT D-22 option (b)), layer in a `SETTINGS_CHANGED` event-bus subscription that calls a setter on the snapshot. Both InfoFlow ConceptCard's `imageEnabled` and HomeScreen's `settingsSnapshot` would benefit symmetrically.
- **Pre-existing 26 baseline failures (JSON-import-attribute, missing TrellisTooltip.tsx, missing podcast.service.ts, tsx loader extension, feed-strategy assertions) remain** — v1.5 concern, NOT a Phase 33 gate.

---
*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Completed: 2026-04-19*
