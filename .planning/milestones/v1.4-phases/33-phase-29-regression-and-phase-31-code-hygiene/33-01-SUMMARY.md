---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
plan: 01
subsystem: ui
tags: [i18n, react, dead-code, locale-bundles, refactor]

# Dependency graph
requires:
  - phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
    provides: VineProgress (SVG vine) replaced ConceptProgressCard (sticky card) per D-01
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: 33-05 working-tree clean prerequisite (SATISFIED-BY-6066c709)
provides:
  - ConceptProgressCard.tsx removed from disk (zero consumers)
  - 4 orphan home.feed.* i18n keys removed atomically across 4 locale bundles
  - bundle-parity invariant preserved at every commit boundary
affects: [v1.5-milestone-planning, post-store.service.ts, ImmersiveInfoFlow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic locale-bundle cleanup: delete keys across en/zh/es/ja in ONE commit per CLAUDE.md bundle-parity rule"
    - "Dead-code sweep precondition: grep-verify zero external consumers BEFORE deletion (component AND every i18n key it owned)"

key-files:
  created: []
  modified:
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
  deleted:
    - app/src/components/ConceptProgressCard.tsx

key-decisions:
  - "D-06 honored: deleted ConceptProgressCard.tsx entirely (both ConceptProgressCard + CompactProgressBar exports — zero consumers)"
  - "D-09 honored: removed 4 home.feed.* keys (title, complete, progress, progressCompact) only — verified ConceptProgressCard.tsx was the sole consumer of each before deletion"
  - "D-07/D-08 honored: post-store.service.ts and ImmersiveInfoFlow export retained, deferred to v1.5"
  - "Atomic single-commit deletion per CLAUDE.md i18n workflow (bundle-parity rule: 4 locales move together, never split)"

patterns-established:
  - "Bundle-parity-safe deletion: pre-grep both the symbol AND every i18n key it owned across app/src and app/tests; only then delete; bundle-parity test runs as the single validation gate"
  - "Locale-block surgical edit: when removing leading keys from a JSON sub-block, the kept first key (creditToast here) becomes the new opener — no trailing-comma surgery needed"

requirements-completed: [TD-05]

# Metrics
duration: ~6min
completed: 2026-04-19
---

# Phase 33 Plan 01: TD-05 partial orphan sweep Summary

**Deleted orphaned `ConceptProgressCard.tsx` (both exports — zero consumers post Phase 31 D-01) plus its 4 sole-consumer `home.feed.*` i18n keys from all 4 locale bundles in one atomic commit, preserving bundle-parity.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-19T23:34:30Z (approx)
- **Completed:** 2026-04-19T23:40:51Z (commit timestamp)
- **Tasks:** 1
- **Files modified:** 4 (en.json, zh.json, es.json, ja.json)
- **Files deleted:** 1 (ConceptProgressCard.tsx, 82 lines)

## Accomplishments

- Removed 82-line orphan component file `app/src/components/ConceptProgressCard.tsx` (both `ConceptProgressCard` and `CompactProgressBar` exports — Phase 31 D-01 replacement complete since `VineProgress.tsx` shipped)
- Removed 4 dead i18n keys from each of 4 locale bundles (16 key-value pairs total deleted): `home.feed.title`, `home.feed.complete`, `home.feed.progress`, `home.feed.progressCompact`
- All retained `home.feed.*` keys (vineComplete, vineProgress, allExplored, suggestionTitle, scrollToTop, creditToast, emptyTitle, emptyBody, loadingTitle, feedbackPrompt, generationErrorTitle, generationErrorBody, generationErrorRetry) preserved across all 4 locales
- bundle-parity.test.mjs continues to pass (3/3 tests green: identical key sets + graph.headerTitle value parity + missing-key fallback)
- `npx tsc -b --noEmit` exits 0 (no orphan imports left behind)

## Task Commits

Single atomic commit per D-15 (and CLAUDE.md i18n bundle-parity rule):

1. **Task 1.1: Delete ConceptProgressCard.tsx + remove 4 orphan i18n keys** — `e297a77a` (refactor)

## Files Created/Modified

- `app/src/components/ConceptProgressCard.tsx` — **DELETED** (-82 lines, 0 consumers)
- `app/src/locales/en.json` — removed 4 keys at lines 69-72 (title/progress/progressCompact/complete) (-4 lines)
- `app/src/locales/zh.json` — removed 4 keys at lines 69-72 (-4 lines)
- `app/src/locales/es.json` — removed 4 keys at lines 69-72 (-4 lines)
- `app/src/locales/ja.json` — removed 4 keys at lines 69-72 (-4 lines)

Total: **5 files changed, 98 deletions, 0 insertions.**

### Key diff (per locale)

| Locale | Removed key | Removed value |
| --- | --- | --- |
| en | `home.feed.title` | `Today's Concepts` |
| en | `home.feed.progress` | `{{explored}} of {{total}} explored` |
| en | `home.feed.progressCompact` | `{{explored}}/{{total}}` |
| en | `home.feed.complete` | `All caught up!` |
| zh | `home.feed.title` | `今日概念` |
| zh | `home.feed.progress` | `已探索 {{explored}}/{{total}}` |
| zh | `home.feed.progressCompact` | `{{explored}}/{{total}}` |
| zh | `home.feed.complete` | `全部看完了!` |
| es | `home.feed.title` | `Conceptos de hoy` |
| es | `home.feed.progress` | `{{explored}} de {{total}} explorados` |
| es | `home.feed.progressCompact` | `{{explored}}/{{total}}` |
| es | `home.feed.complete` | `Todo al dia!` |
| ja | `home.feed.title` | `今日のコンセプト` |
| ja | `home.feed.progress` | `{{explored}}/{{total}} 探索済み` |
| ja | `home.feed.progressCompact` | `{{explored}}/{{total}}` |
| ja | `home.feed.complete` | `すべて完了!` |

## Verification

### Pre-deletion grep gates (Step 1 + Step 2)

```
grep -rn "home\.feed\.(title|complete|progress|progressCompact)" app/src/ app/tests/
  → 5 matches, ALL inside app/src/components/ConceptProgressCard.tsx (lines 37, 42, 43, 71, 72)
  → 0 external consumers ✓

grep -rn "ConceptProgressCard|CompactProgressBar" app/src/ app/tests/
  → 4 matches, ALL inside ConceptProgressCard.tsx itself (interface + export declarations)
  → 0 external consumers ✓
```

Both gates passed; deletion authorized.

### Post-deletion verification

```
JSON parse (all 4 bundles):  en OK, zh OK, es OK, ja OK
node --test bundle-parity:   ✔ identical key sets, ✔ graph.headerTitle parity, ✔ missing-key handler — pass 3 / fail 0
npx tsc -b --noEmit:         exit 0 (no orphan imports)
grep home.feed.title|complete|progress|progressCompact: 0 hits anywhere
grep ConceptProgressCard|CompactProgressBar: 0 hits anywhere
git status --porcelain:      empty (working tree clean)
git log -1 --format=%s:      "refactor(feed): delete orphaned ConceptProgressCard.tsx + its 4 dead i18n keys (TD-05)"
```

### bundle-parity.test.mjs output (post-commit)

```
✔ en/zh/es/ja bundles have identical flattened key sets (7.479ms)
✔ graph.headerTitle values match expected per locale (D-14) (0.925ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

## Decisions Made

None new — followed plan as specified. All decisions are pre-locked in 33-CONTEXT.md (D-06, D-07, D-08, D-09, plus CLAUDE.md i18n bundle-parity workflow).

## Deviations from Plan

None — plan executed exactly as written. All 8 steps in Task 1.1 executed in order, all acceptance criteria met on first attempt, no auto-fix rules triggered.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 33-01 complete; partial orphan sweep CLOSED for v1.4.
- `post-store.service.ts` and `ImmersiveInfoFlow` export remain on disk per D-07/D-08 — revisit at v1.5 milestone planning kickoff.
- Plan 33-02 (TD-04 strategy-bias test cleanup) and Plan 33-03 (TD-06 LeafState rename) remain in the queue for this phase. Both are independent of this plan; either can execute next.
- Plans 33-06 (perf memoization) and 33-07 (cosmetic polish) gated by 33-05 only (already SATISFIED), so they are also unblocked from a working-tree-cleanliness perspective.

## Self-Check: PASSED

- `app/src/components/ConceptProgressCard.tsx`: confirmed ABSENT (`test ! -f` exits 0)
- Commit `e297a77a`: confirmed PRESENT (`git log --oneline | grep e297a77a` → match)
- All 4 locale files: confirmed parse as valid JSON
- bundle-parity.test.mjs: PASS (post-commit re-run)

---
*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Completed: 2026-04-19*
