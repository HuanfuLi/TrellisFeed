---
phase: 42-masonry-feed-layout
plan: 05
subsystem: tests
tags: [node-test, source-reading, invariant-guard, regression-prevention]

# Dependency graph
requires:
  - phase: 42-01-masonry-feed-skeleton
    provides: "MasonryFeed.tsx skeleton with columnHeightsRef + tileColumnAssignmentsRef + motion.div leaf-tile wrappers"
  - phase: 42-02-homescreen-swap
    provides: "HomeScreen.tsx with MasonryFeed wired, InlineInfoFlow import + JSX dropped, noMorePosts toast call deleted, allExplored useMemo computed locally"
  - phase: 42-03-card-slide-in-removal
    provides: "card-slide-in keyframe deleted from app/src/index.css; 3 callsites in InfoFlow.tsx removed"
  - phase: 42-04-vine-bloom-card-and-i18n
    provides: "VineBloomCard fully implemented (replaces 42-01 placeholder); MotionConfig reducedMotion='user' wrapper; useTrellisData consumption; navigate('/planner') wiring; 88x88 SVG with motion.circle"
provides:
  - "tests/components/MasonryFeed.layout.test.mjs (8 it blocks) — locks UI-SPEC #1/#2/#3/#6 + RESEARCH.md Pitfall 1 (MotionConfig) + Pitfall 4 (no parallel GAP-C emit)"
  - "tests/components/MasonryFeed.celebration.test.mjs (7 it blocks) — locks UI-SPEC #5 + RESEARCH.md § 1 path b (no new trellisActionsService surface)"
  - "tests/screens/HomeScreen.no-more-posts-toast.test.mjs (4 it blocks) — locks UI-SPEC #4 (D-11 toast deletion) + RESEARCH.md Pitfall 2 (allExplored is local)"
  - "tests/lib/no-card-slide-in.test.mjs (4 it blocks) — locks UI-SPEC #7 / Pitfall 7 cross-tree negative grep against card-slide-in re-introduction anywhere under app/src/"
affects: [42-07-phase-close-out]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern A (single-file source-reading): assert.ok(/regex/.test(source), '...'). Mirrors tests/components/InfoFlow.video-tap-emit.test.mjs canonical shape — used in MasonryFeed.layout, MasonryFeed.celebration, HomeScreen.no-more-posts-toast."
    - "Pattern B (cross-tree walker): readdirSync recursion with file-extension filter, then per-file readFileSync + regex test, accumulating offenders array. Mirrors tests/services/engagement-anti-wire.test.mjs — used in no-card-slide-in."
    - "Counterweight assertions: every source-reading test includes ≥1 positive presence check (e.g. 'columnHeightsRef present', 'walker reaches >=50 files', 'walker scan list includes index.css') so a false-pass from a path/regex bug is structurally impossible."

key-files:
  created:
    - "app/tests/components/MasonryFeed.layout.test.mjs (131 lines, 8 it blocks)"
    - "app/tests/components/MasonryFeed.celebration.test.mjs (111 lines, 7 it blocks)"
    - "app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs (63 lines, 4 it blocks)"
    - "app/tests/lib/no-card-slide-in.test.mjs (84 lines, 4 it blocks)"
  modified: []
  unchanged:
    - "app/src/components/MasonryFeed.tsx — tests assert against current state"
    - "app/src/screens/HomeScreen.tsx — tests assert against current state"
    - "app/src/services/trellis-actions.service.ts — tests assert against current state (counterweight + negative)"
    - "app/src/index.css — covered by cross-tree negative grep"

key-decisions:
  - "Relaxed the InlineInfoFlow assertion from broad string-match to import-line + JSX-element-match (deviation Rule 1 — auto-fix). Plan 42-05 PLAN.md spec used `!/InlineInfoFlow/.test(source)` which is too strict: a historical comment 'replaces InlineInfoFlow' was preserved in HomeScreen.tsx line 834 per the plan 42-02 close note ('InlineInfoFlow named import dropped, but type InfoFlowItem import preserved'). Refined assertion: `!/import\\s+\\{[^}]*\\bInlineInfoFlow\\b[^}]*\\}\\s+from/.test(source)` AND `!/<\\s*InlineInfoFlow\\b/.test(source)`. The plan's intent ('no live reference') is preserved while honoring the operator-confirmed comment retention."
  - "All 4 test files use the project's existing canonical patterns verbatim (Pattern A from InfoFlow.video-tap-emit + Pattern B from engagement-anti-wire). Zero new infra introduced; tests run under standard `node --test` with no loader."
  - "Each test file is self-documenting: top-of-file block comment names the UI-SPEC invariant + RESEARCH.md pitfall it locks, the load-bearing decision (D-XX) it derives from, and the canonical pattern it mirrors. This is the audit trail a future verifier reads to confirm the test still maps to its source-of-truth contract."
  - "Counterweight assertions land in EVERY test (not just the cross-tree walker). Even single-file Pattern A tests open with a counterweight (e.g. 'columnHeightsRef declaration present', 'function VineBloomCard declared', 'MasonryFeed wiring present'). Without these, a path/regex regression could silently pass."
  - "Atomic per-task commits land cleanly without file-staging races (no parallel siblings in Wave 3 — sole executor). Used standard `git commit -m '...'` per `<solo_execution>` instruction in execution prompt; pre-commit hooks ran normally."

requirements-completed: []  # MASONRY-01 + MASONRY-02 already marked complete by Plans 42-02/42-04; this plan is pure invariant-lock test infra

# Metrics
duration: 3m 26s
completed: 2026-05-10
---

# Phase 42 Plan 05: Source-Reading Invariant Tests Summary

**Four new node-test source-reading test files lock all 8 UI-SPEC structural invariants plus 2 NEW invariants from RESEARCH.md (Pitfall 1 framer-motion v12 reduced-motion opt-in; Pitfall 4 GAP-C single-emit) — 23 assertions total, all green against the current MasonryFeed.tsx + HomeScreen.tsx + trellis-actions.service.ts + cross-tree app/src/.**

## Performance

- **Duration:** 3m 26s
- **Started:** 2026-05-10T01:38:08Z
- **Completed:** 2026-05-10T01:41:34Z
- **Tasks:** 4 (all completed atomically)
- **Files created:** 4 (all under app/tests/)
- **Source files modified:** 0 (pure test-add plan)

## Accomplishments

- **8 UI-SPEC invariants + 2 NEW RESEARCH.md pitfalls locked** as source-reading tests under `node --test`. Pure-static; no DOM render; <2s aggregate runtime.
- **Cross-tree negative grep guards `card-slide-in` re-introduction** under all of app/src/ (.ts/.tsx/.css/.mjs scan).
- **Counterweight assertions in every test file** — false-pass from a path or regex regression is structurally impossible.
- **Existing GAP-C single-emit invariant test (`InfoFlow.video-tap-emit.test.mjs`) still green** — preserved across the InlineInfoFlow → MasonryFeed cutover (sibling counterweight at the InfoFlow boundary).
- **Existing i18n bundle parity test (`tests/locales/bundle-parity.test.mjs`) still green** — UI-SPEC invariant #8 covered by pre-existing infra; no new test needed per plan.
- **Zero source files mutated** — Plan 42-05 is pure additive test infra; the source-of-truth files (MasonryFeed.tsx, HomeScreen.tsx, trellis-actions.service.ts, index.css) were last touched by Plans 42-01..42-04.

## Task Commits

| Task | Name                                                                                | Commit     | Files                                                       |
| ---- | ----------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| 1    | Create MasonryFeed.layout.test.mjs (UI-SPEC #1, #2, #3, #6 + Pitfall 1 + Pitfall 4) | `11873bed` | `app/tests/components/MasonryFeed.layout.test.mjs`          |
| 2    | Create MasonryFeed.celebration.test.mjs (UI-SPEC #5 + RESEARCH § 1 path b)          | `4eed64df` | `app/tests/components/MasonryFeed.celebration.test.mjs`     |
| 3    | Create HomeScreen.no-more-posts-toast.test.mjs (UI-SPEC #4 + Pitfall 2)             | `6ab93747` | `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs` |
| 4    | Create no-card-slide-in.test.mjs (UI-SPEC #7 / Pitfall 7 cross-tree)                | `43414dd7` | `app/tests/lib/no-card-slide-in.test.mjs`                   |

## Test Result Snapshot

**4 new tests — all 23 it blocks pass:**

```
▶ MasonryFeed layout invariants (Phase 42)
  ✔ contains the columnHeightsRef state declaration (counterweight)
  ✔ does NOT use CSS column-count or break-inside (D-02)
  ✔ does NOT use will-change / perspective on root or column wrappers (Header positioning rule)
  ✔ contains at least one motion.div leaf-tile wrapper (D-03)
  ✔ motion.div NOT used in HomeScreen.tsx (D-03)
  ✔ contains MotionConfig with reducedMotion="user" wrapper (RESEARCH.md Pitfall 1)
  ✔ column assignment is gated by tileColumnAssignmentsRef.current.has() check (D-02)
  ✔ does NOT add a parallel CONCEPT_EXPLORED emit (Pitfall 4)
✔ 8/8 pass

▶ MasonryFeed VineBloomCard celebration invariants (Phase 42 MASONRY-02)
  ✔ contains the VineBloomCard function declaration (counterweight)
  ✔ VineBloomCard placeholder is gone (real implementation lands per plan 42-04)
  ✔ imports useTrellisData from state hook (RESEARCH.md § 1 path b)
  ✔ VineBloomCard uses leafState filter (mirrors PlannerScreen.tsx:46-47 pattern)
  ✔ trellisActionsService still exposes ONLY heal/replant/prune/unpruneQuestion/hardDelete (no new getCelebrationSuggestions method)
  ✔ VineBloomCard wires Open Planner CTA to navigate('/planner')
  ✔ VineBloomCard inline SVG matches UI-SPEC § Vine SVG Specification (88x88 viewBox)
✔ 7/7 pass

▶ HomeScreen no-more-posts toast removal (Phase 42 D-11)
  ✔ contains MasonryFeed wiring (counterweight)
  ✔ does NOT import or render InlineInfoFlow (plan 42-02 swapped to MasonryFeed)
  ✔ does NOT contain the noMorePosts toast key reference (D-11)
  ✔ passes allExplored prop to MasonryFeed (RESEARCH.md Pitfall 2)
✔ 4/4 pass

▶ card-slide-in keyframe deleted (Phase 42 D-06)
  ✔ walker reaches at least 50 files under app/src (counterweight)
  ✔ walker scan list includes app/src/index.css (counterweight)
  ✔ walker scan list includes app/src/components/InfoFlow.tsx (counterweight)
  ✔ zero source files contain `card-slide-in`
✔ 4/4 pass

ℹ tests 23  ℹ suites 4  ℹ pass 23  ℹ fail 0
```

**Counterweight tests still green (pre-existing, preserved across Phase 42 cutover):**

```
✔ tests/components/InfoFlow.video-tap-emit.test.mjs — 4/4 pass (GAP-C single-emit invariant)
✔ tests/locales/bundle-parity.test.mjs — 6/6 pass (i18n parity = UI-SPEC invariant #8)
```

## UI-SPEC Invariant → Test File Map

For verifier audit:

| UI-SPEC # | Description                                                          | Locked by                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1        | `<motion.div>` only on leaf tiles in MasonryFeed (not in HomeScreen) | `MasonryFeed.layout.test.mjs` — `motion.div` present in MasonryFeed AND absent in HomeScreen                                                                                    |
| #2        | NO `column-count` / `break-inside` CSS in MasonryFeed                | `MasonryFeed.layout.test.mjs` — 4 negative greps (column-count, columnCount, break-inside, breakInside)                                                                         |
| #3        | NO `will-change` / `perspective` (Header positioning rule)           | `MasonryFeed.layout.test.mjs` — 3 negative greps (will-change, willChange, perspective:)                                                                                        |
| #4        | `home.toast.noMorePosts` reference deleted (D-11)                    | `HomeScreen.no-more-posts-toast.test.mjs` — both `home.toast.noMorePosts` AND broad `noMorePosts` substring negative greps                                                      |
| #5        | VineBloomCard renders when allExplored && layout.nodes.length > 0    | `MasonryFeed.celebration.test.mjs` — VineBloomCard function present + useTrellisData import + leafState filters + navigate('/planner') + 88x88 SVG + no new service surface     |
| #6        | Tile column assignment is immutable across re-renders (D-02)         | `MasonryFeed.layout.test.mjs` — source-reading proxy: `tileColumnAssignmentsRef.current.has(itemId)) continue` skip-gate present                                                |
| #7        | `card-slide-in` keyframe + 3 callsites removed (D-06)                | `no-card-slide-in.test.mjs` — cross-tree walker; zero offenders under app/src/.{ts,tsx,css,mjs}                                                                                 |
| #8        | i18n bundle parity preserved                                         | Pre-existing `tests/locales/bundle-parity.test.mjs` (per plan — no new test needed; verified still green)                                                                       |
| **NEW**   | RESEARCH Pitfall 1 — MotionConfig reducedMotion="user" wrapper       | `MasonryFeed.layout.test.mjs` — both `MotionConfig` presence + `reducedMotion="user"` regex                                                                                     |
| **NEW**   | RESEARCH Pitfall 4 — no parallel GAP-C emit in MasonryFeed wrapper   | `MasonryFeed.layout.test.mjs` — both `dailyReadService.markExplored` AND `type: 'CONCEPT_EXPLORED'` negative greps                                                              |
| **NEW**   | RESEARCH Pitfall 2 — allExplored is local to HomeScreen, not service | `HomeScreen.no-more-posts-toast.test.mjs` — `allExplored` reference present in HomeScreen.tsx                                                                                   |
| **NEW**   | RESEARCH § 1 path b — no new trellisActionsService method            | `MasonryFeed.celebration.test.mjs` — heal/replant counterweights present + `getCelebrationSuggestions`/`getDailyActions`/`getSuggestedMoves` negative greps                     |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Relaxed `InlineInfoFlow` assertion in HomeScreen.no-more-posts-toast.test.mjs**

- **Found during:** Task 3 (first run failed)
- **Issue:** Plan 42-05 PLAN.md prescribed `assert.ok(!/InlineInfoFlow/.test(source))` — a broad string-substring negative grep. This failed against the current HomeScreen.tsx because line 834 contains the historical comment `{/* Phase 42 MASONRY-01: Pinterest-style 2-column masonry feed (replaces InlineInfoFlow). */}`. The plan-42-02 close note explicitly preserved this comment ("InlineInfoFlow named import dropped, but type InfoFlowItem import preserved").
- **Fix:** Refined the assertion into two narrower checks: `!/import\s+\{[^}]*\bInlineInfoFlow\b[^}]*\}\s+from/.test(source)` (no live import line) AND `!/<\s*InlineInfoFlow\b/.test(source)` (no JSX element). Both pass. The plan's stated intent ("InlineInfoFlow is de-wired") is preserved; the historical comment is correctly tolerated.
- **Files modified:** `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs`
- **Commit:** `6ab93747` (the as-written test was caught by the verify step before commit; the relaxed assertion is what landed)

No other deviations. All 4 files created on first attempt; Tasks 1, 2, 4 passed verify on first run.

### Auth Gates

None.

## Verification

```bash
# All 4 new tests
node --test \
  tests/components/MasonryFeed.layout.test.mjs \
  tests/components/MasonryFeed.celebration.test.mjs \
  tests/screens/HomeScreen.no-more-posts-toast.test.mjs \
  tests/lib/no-card-slide-in.test.mjs
# → 23 pass, 0 fail, 0 skipped, ~64ms duration

# Counterweight (pre-existing) — preserved across Phase 42 cutover
node --test \
  tests/components/InfoFlow.video-tap-emit.test.mjs \
  tests/locales/bundle-parity.test.mjs
# → 10 pass, 0 fail
```

## Self-Check: PASSED

- [x] `app/tests/components/MasonryFeed.layout.test.mjs` exists (131 lines, 8 it blocks)
- [x] `app/tests/components/MasonryFeed.celebration.test.mjs` exists (111 lines, 7 it blocks)
- [x] `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs` exists (63 lines, 4 it blocks)
- [x] `app/tests/lib/no-card-slide-in.test.mjs` exists (84 lines, 4 it blocks)
- [x] Commit `11873bed` (test 42-05 layout) reachable in `git log`
- [x] Commit `4eed64df` (test 42-05 celebration) reachable in `git log`
- [x] Commit `6ab93747` (test 42-05 no-more-posts-toast) reachable in `git log`
- [x] Commit `43414dd7` (test 42-05 no-card-slide-in) reachable in `git log`
- [x] All 4 new tests run with `node --test` exit 0 (23/23 it blocks pass)
- [x] Pre-existing counterweight tests (`InfoFlow.video-tap-emit.test.mjs`, `bundle-parity.test.mjs`) still green
