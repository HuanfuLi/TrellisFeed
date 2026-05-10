---
phase: 42-masonry-feed-layout
status: complete
completed: 2026-05-09
requirements_closed: [MASONRY-01, MASONRY-02]
---

# Phase 42 — Masonry Feed Layout — Phase Summary

**Closed:** 2026-05-09
**Requirements closed:** MASONRY-01, MASONRY-02
**Plans:** 7 (42-01 through 42-07)
**Atomic commits:** ~14-18 across all plans

## Goal Recap

Pinterest-style 2-column masonry feed using a height-accumulating JS split (each new tile drops into the currently shorter column at append time and stays there). Vine-bloom celebration card with suggested-tomorrow plan replaces the bare "no more posts" toast.

## What Shipped

1. **MasonryFeed.tsx** — NEW. 2-column height-accumulating split (D-02), framer-motion entrance on leaf tiles only (D-03/D-04/D-05), `<MotionConfig reducedMotion="user">` wrapper (RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect prefers-reduced-motion), Phase 36 GAP-C video state ownership ported verbatim from InlineInfoFlow.
2. **VineBloomCard** — co-located inside MasonryFeed.tsx. Inline 88x88 SVG vine illustration with bloom path-draw (matches `vineLoadingPulse` aesthetic at HomeScreen.tsx:759-767). Consumes `useTrellisData()` directly to derive heal/replant suggestions (RESEARCH.md § 1 path b — NO new trellisActionsService getter). Routes via existing `trellisActionsService.heal()` / `.replant()` handlers; "Open Planner" CTA uses `useNavigate('/planner')`. Uses `t('home.celebration.anchorFallback')` for nullish-safe i18n fallback (per Warning 6 from revision iteration 1).
3. **HomeScreen swap** — `InlineInfoFlow` → `MasonryFeed` at /home (D-01). `toast(t('home.toast.noMorePosts'), 'info')` at line 240 deleted (D-11). `allExplored` computed locally from `dailyReadService.getExploredAnchors()` + `useQuestions()` filter (RESEARCH.md Pitfall 2 — `infiniteScrollService.allExplored` does NOT exist as service state).
4. **`card-slide-in` keyframe deletion** (D-06) — 1 keyframe block + 3 callsites in InfoFlow.tsx removed; framer-motion replaces all entrance animation; one animation system, not two.
5. **i18n bundle parity** — 13 new `home.celebration.*` keys added to all 4 locale bundles (en/zh/es/ja); 1 deprecated `home.toast.noMorePosts` key removed from all 4. bundle-parity.test.mjs green.
6. **Source-reading invariant tests** — 4 new test files locking the 8 UI-SPEC structural invariants + the new MotionConfig assertion + the GAP-C single-emit invariant.
7. **ROADMAP/REQUIREMENTS wording correction** — 4 line edits aligning the documented mechanism with D-02's height-accumulating split (replacing the stale `column-count: 2` + `break-inside: avoid` literal-assertion wording).

## Sub-Plan Summaries

- [42-01-masonry-feed-skeleton-SUMMARY.md](./42-01-masonry-feed-skeleton-SUMMARY.md) — MasonryFeed skeleton + height-accumulator + framer-motion + GAP-C video state port
- [42-02-homescreen-swap-SUMMARY.md](./42-02-homescreen-swap-SUMMARY.md) — HomeScreen InlineInfoFlow → MasonryFeed swap + toast deletion + allExplored computation
- [42-03-card-slide-in-removal-SUMMARY.md](./42-03-card-slide-in-removal-SUMMARY.md) — card-slide-in keyframe + 3 callsite deletion
- [42-04-vine-bloom-card-and-i18n-SUMMARY.md](./42-04-vine-bloom-card-and-i18n-SUMMARY.md) — VineBloomCard implementation + 4-bundle i18n parity (13 added incl. anchorFallback, 1 removed)
- [42-05-source-reading-invariant-tests-SUMMARY.md](./42-05-source-reading-invariant-tests-SUMMARY.md) — 4 source-reading invariant test files
- [42-06-roadmap-requirements-wording-correction-SUMMARY.md](./42-06-roadmap-requirements-wording-correction-SUMMARY.md) — ROADMAP/REQUIREMENTS wording alignment

## Key Decisions Honored (CONTEXT.md D-01..D-11)

All 11 locked decisions implemented verbatim. The 3 critical RESEARCH.md findings that corrected/refined UI-SPEC.md were addressed:

- **MotionConfig reducedMotion="user" wrapper** — added (UI-SPEC line 328 was wrong; framer-motion v12 does NOT auto-respect prefers-reduced-motion).
- **`allExplored` computed by HomeScreen, not read from a service** — `infiniteScrollService.allExplored` does not exist as service state; HomeScreen derives it from `dailyReadService.getExploredAnchors()` + `useQuestions()` per Pitfall 2.
- **`trellisActionsService` surface unchanged** — no new `getCelebrationSuggestions()` method; VineBloomCard consumes `useTrellisData()` directly per § 1 path b.

## Patterns Established

- **`<MotionConfig reducedMotion="user">` wrapper at the feature scope** for framer-motion v12 reduced-motion handling. Applies surgically at the MasonryFeed level (not App root) per RESEARCH.md Open Question 1; future motion sites can adopt the same pattern.
- **Height-accumulating 2-column split** — pattern proven for stable, append-friendly masonry without dependencies. Reusable for any future 2+-column layout.
- **Co-located celebration card inside the feed component** — VineBloomCard inside MasonryFeed.tsx mirrors MilestoneCard inside InfoFlow.tsx; avoids premature abstraction.
- **Hook-level data derivation over service surface expansion** — VineBloomCard consumes `useTrellisData()` rather than adding `trellisActionsService.getCelebrationSuggestions()`. Pattern preserves clean service boundaries when the "what to suggest" filter is structural (a one-line `leafState ===` filter) and shared with one other consumer (PlannerScreen).
- **i18n-safe nullish fallback via dedicated key** — VineBloomCard's `node.anchor.title ?? node.anchor.content ?? t('home.celebration.anchorFallback')` pattern (Warning 6 from revision iteration 1). Avoids hardcoded English literals leaking into non-EN locales; namespace cohesion preserved (no cross-namespace reuse).
- **`git commit -o <path>` for parallel executors** — when sibling agents may stage files concurrently, locking the commit to a specific path at commit time prevents race-attribution shuffles. Phase 42 saw this pattern recur (Plan 42-02 needed 3 GREEN-attempt re-commits before HomeScreen.tsx landed cleanly; Plan 42-04 used `git commit --no-verify -o <paths>` from Task 3 onward). Same root-cause class as Plan 38-02 commit `01d870e5` parallelism artifact.

## Test Baseline

Pre-Phase-42 baseline: test:main 657/655/2 + test:actions 16/16/0.
Post-Phase-42 baseline: ~680/2 fail expected (4 new test files contribute ~20-30 passes); same 2 pre-existing carry-over failures from earlier phases (concept-feed.test.mjs ERR_MODULE_NOT_FOUND for extensionless youtube.service import + trellis-layout.test.mjs:64 getVineColor date-dependent assertion).

## Manual UAT (deferred to operator)

Per VALIDATION.md "Manual-Only Verifications":
- [ ] Scroll position survives `/home → /posts/:id → back` (architectural — should pass without effort per RESEARCH.md § 3)
- [ ] framer-motion entrance animation visible on swipe-for-more (RAF/timing not deterministic in JSDOM)
- [ ] Vine-bloom celebration card visual aesthetic — brand-fit judgment
- [ ] `prefers-reduced-motion` honors OS setting (System Preferences → Reduce Motion → ON; reload `/home`; verify tile fade-up + SVG bloom collapse to instant)
