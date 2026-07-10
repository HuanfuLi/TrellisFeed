---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
plan: 03
subsystem: refactor
tags: [refactor, rename, leafstate, trellis, vocabulary-unification, td-06, type-system]

# Dependency graph
requires:
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: 33-00 working-tree-clean prerequisite + 33-01 partial-orphan sweep + 33-02 TD-04 supersession (clean baseline for atomic rename commit)
  - phase: 27-add-i18n-l10n-support
    provides: planner.trellis.dying / planner.trellis.dead locale keys (D-14 — pre-existing in all 4 bundles, no bundle edits needed)
provides:
  - LeafState type union renamed at the type-system source (`'yellow'` -> `'dying'`, `'fallen'` -> `'dead'`)
  - 'falling' literal retained as internal-only 7-13d gradation per D-12 (UI never exposes it)
  - All 6 LeafState consumers updated atomically (computeLeafState, concept-feed weak-concept predicate, PlannerScreen filters, TrellisStatusPanel filters, TrellisLeaf STATE_COLOR/STATE_VEIN/withDecay)
  - Test fixtures aligned with renamed vocabulary (3 test files)
  - TD-06 closed — concept-feed.service.ts:671 dead-branch TS2367 error becomes valid automatically once 'dying' enters the type union
affects: [v1.5-milestone-planning, future-trellis-refactors, future-leafstate-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic rename commit for vocabulary unification: single commit covering type union + all consumers + all tests, so git log --follow traces cleanly across the boundary (D-15)"
    - "Pre-rename baseline capture via git stash + npm test, then post-rename diff comparison: subset-of-baseline signature gate + fail-count-not-increased gate. Catches missed callsites + new failure kinds without blocking on pre-existing JSON-import-attribute baseline noise"
    - "Scope-bounded rename: literal `'yellow'` and `'fallen'` only renamed in LeafState contexts. Badge.tsx CSS color palette + PodcastScreen.tsx UI status color (both unrelated to LeafState) preserved untouched per D-13"
    - "Comments-aligned-with-code rule: when renaming type literals, also update comments referencing the old vocabulary (TrellisLeaf decay-modifier comments) to prevent future grep confusion"

key-files:
  created: []
  modified:
    - app/src/services/trellis-state.service.ts
    - app/src/services/concept-feed.service.ts
    - app/src/screens/PlannerScreen.tsx
    - app/src/components/trellis/TrellisStatusPanel.tsx
    - app/src/components/trellis/TrellisLeaf.tsx
    - app/tests/services/trellis-state.test.mjs
    - app/tests/components/trellis-tooltip-copy.test.mjs
    - app/tests/services/concept-batch-filter.test.mjs

key-decisions:
  - "D-10 honored: 'yellow' renamed to 'dying' across LeafState contexts (5 hits in trellis-state.service.ts including type union + computeLeafState return + 3 dev-seed entries; 1 in concept-feed.service.ts; 1 in PlannerScreen.tsx; 1 in TrellisStatusPanel.tsx; 2 in TrellisLeaf.tsx STATE_COLOR/STATE_VEIN keys + 1 withDecay signature literal + 1 comment; 2 test fixtures)"
  - "D-11 honored: 'fallen' renamed to 'dead' across LeafState contexts (3 hits in trellis-state.service.ts; 1 in concept-feed.service.ts; 1 in PlannerScreen.tsx; 1 in TrellisStatusPanel.tsx; 2 in TrellisLeaf.tsx STATE_COLOR/STATE_VEIN keys + 3 in withDecay signature/conditionals + 1 comment; 2 test fixtures + 1 comment)"
  - "D-12 honored: 'falling' literal retained as internal-only 7-13d gradation. 13 occurrences across app/src + app/tests preserved unchanged. UI never exposes it (TrellisStatusPanel collapses 'dying' + 'falling' into the user-facing 'Dying' bucket)"
  - "D-13 scope boundaries honored: Badge.tsx 'yellow' (CSS color palette `type BadgeColor`, line 3) and PodcastScreen.tsx:220 'yellow' (UI status color from statusColor() helper) explicitly NOT renamed. Both verified absent from any LeafState context"
  - "D-14 confirmed: locale bundles untouched. planner.trellis.dying / planner.trellis.dead keys already exist with correct copy (Phase 27 i18n shipped them); the rename only had to align the internal type literal with the existing user-facing labels"
  - "D-15 honored: ONE atomic commit (c8177c72) covers all 8 files. git log --follow traces cleanly across the rename boundary"
  - "Plan SKIP branch executed correctly: TrellisTooltip.tsx absent from working tree (filesystem-verified via `ls`), the rename does not create the file. Pinned test trellis-tooltip-copy.test.mjs continues to fail with ERR_MODULE_NOT_FOUND signature (pre-existing baseline, NOT a rename regression — file restoration deferred to v1.5)"

patterns-established:
  - "Atomic-rename gate protocol: stash → run baseline → unstash → run post-rename → diff signatures. PASS only if (a) post fail count ≤ baseline AND (b) post signature set ⊆ baseline signature set. Detects both missed callsites (new signatures) and aggregate test regressions (fail-count rise) without false-positive HALTs on pre-existing failures"
  - "Scope-bounded literal rename: `grep -rn \"'yellow'\\|'fallen'\" app/` defines the universe; manual per-hit inspection separates LeafState contexts (rename) from CSS color names + UI status colors (preserve). Sed/replace-all-with-confidence is structurally unsafe across mixed-meaning literals"
  - "Pre-existing failure baseline acceptance: when a phase touches code in a file whose pinned tests have orthogonal pre-existing failures (e.g., Node-25 JSON import-attribute, missing TrellisTooltip.tsx), the gate must be relative-to-baseline, not absolute pass/fail. Plan 33-03 codifies the signature-subset + fail-count-non-increase pattern"

requirements-completed: [TD-06]

# Metrics
duration: ~5min
completed: 2026-04-19
---

# Phase 33 Plan 03: TD-06 LeafState rename Summary

**Renamed LeafState type literals `'yellow'` -> `'dying'` and `'fallen'` -> `'dead'` across the entire codebase in a single atomic commit, unifying internal type vocabulary with the user-facing design labels (TrellisStatusPanel had been displaying "Dying" / "Dead" since Phase 26 — the type members lagged). `'falling'` retained as internal-only gradation. tsc clean, vite clean, test signature set unchanged from pre-rename baseline.**

## Performance

- **Duration:** ~5 min (318 s)
- **Started:** 2026-04-19T23:53:37Z
- **Completed:** 2026-04-19T23:58:55Z
- **Tasks:** 5 (3.1 trellis-state.service.ts; 3.2 concept-feed + PlannerScreen; 3.3 TrellisStatusPanel + TrellisLeaf [TrellisTooltip.tsx SKIP-if-absent branch]; 3.4 three test files; 3.5 atomic commit)
- **Files modified:** 8 (5 source + 3 test) — all in single atomic commit per D-15
- **Commits:** 1 (refactor commit `c8177c72`)

## Accomplishments

- **Renamed `'yellow'` -> `'dying'`** across 6 source-side hits and 2 test-side hits in LeafState contexts.
- **Renamed `'fallen'` -> `'dead'`** across 6 source-side hits and 2 test-side hits in LeafState contexts.
- **Retained `'falling'`** unchanged at 13 occurrences across `app/src/` + `app/tests/` (per D-12 — internal-only 7-13d gradation, UI never exposes it).
- **Type union updated** in `trellis-state.service.ts:9` to `'bud' | 'green' | 'dying' | 'falling' | 'dead' | 'blossom' | 'fruit'`. Cascades through all `LeafState` references via TypeScript structural typing.
- **TD-06 closed automatically:** `concept-feed.service.ts:671` previously contained a dead `'dying'` branch (renamed from `'yellow'` in commit 760fa4f8 ahead of the type rename). Post-rename, the literal is now valid in the type union — no separate fix needed.
- **Locale bundles untouched** (D-14): `planner.trellis.dying` / `planner.trellis.dead` already shipped in all 4 bundles via Phase 27 i18n. The rename only had to align the internal type with the existing user-facing copy.
- **Atomic commit per D-15** preserves git-history traceability — `git log --follow` on any of the 8 renamed files crosses the boundary in a single hop.
- **Test signature set unchanged** vs pre-rename baseline: 27 fail = 27 fail; same 5 baseline signatures (ERR_IMPORT_ATTRIBUTE_MISSING, ERR_MODULE_NOT_FOUND, ERR_UNKNOWN_FILE_EXTENSION, ERR_ASSERTION, AssertionError [ERR_ASSERTION]); zero new signatures introduced.

## Task Commits

Single atomic commit per D-15:

1. **Task 3.1 + 3.2 + 3.3 + 3.4 + 3.5 (atomic rename + commit):** `c8177c72` (refactor) — renames LeafState literals across 8 files: trellis-state.service.ts, concept-feed.service.ts, PlannerScreen.tsx, TrellisStatusPanel.tsx, TrellisLeaf.tsx, trellis-state.test.mjs, trellis-tooltip-copy.test.mjs, concept-batch-filter.test.mjs.
   Subject: `refactor(trellis): rename LeafState literals yellow->dying, fallen->dead per design vocabulary (TD-06)`

## Files Created/Modified

### Source files (5)

- `app/src/services/trellis-state.service.ts` — LeafState type union (line 9): `'yellow'` -> `'dying'`, `'fallen'` -> `'dead'`. computeLeafState return values (lines 88, 90): `'fallen'` -> `'dead'`, `'yellow'` -> `'dying'`. Dev-mode seed entries (lines 117, 119, 121): 3× `'yellow'` -> `'dying'` and 1× `'fallen'` -> `'dead'`. Net: 8 literal substitutions.
- `app/src/services/concept-feed.service.ts` — Weak-concept predicate (line 671): `leaf === 'yellow' || leaf === 'falling' || leaf === 'fallen'` -> `leaf === 'dying' || leaf === 'falling' || leaf === 'dead'`. This was the TD-06 site (pre-renamed to `'yellow'` in 760fa4f8 ahead of the type rename); the new literal is now valid.
- `app/src/screens/PlannerScreen.tsx` — Two filter predicates (lines 46-47): `n.leafState === 'fallen'` -> `'dead'`; `n.leafState === 'yellow' || n.leafState === 'falling'` -> `'dying' || 'falling'`.
- `app/src/components/trellis/TrellisStatusPanel.tsx` — Two filter predicates (lines 44-45): same pattern as PlannerScreen.
- `app/src/components/trellis/TrellisLeaf.tsx` — STATE_COLOR Record keys (lines 73, 75): `yellow:` -> `dying:`, `fallen:` -> `dead:`. STATE_VEIN Record keys (lines 83, 85): same. withDecay function signature (line 516): `'yellow' | 'falling' | 'fallen'` -> `'dying' | 'falling' | 'dead'`. withDecay conditionals (lines 517, 518, 525): 3× `'fallen'` -> `'dead'`. Comment alignment (line 514, 570): "Yellow/falling/fallen" -> "Dying/falling/dead"; "green, yellow, falling, fallen" -> "green, dying, falling, dead".

### Test files (3)

- `app/tests/services/trellis-state.test.mjs` — Test name (line 44): "returns yellow" -> "returns dying". Assertion values (lines 49, 58): `'yellow'` -> `'dying'`, `'fallen'` -> `'dead'`.
- `app/tests/components/trellis-tooltip-copy.test.mjs` — `resolveHealthCopy` first arguments (lines 15, 17): `'yellow'` -> `'dying'`, `'fallen'` -> `'dead'`. LeafState enumeration (line 25): `['bud', 'green', 'yellow', 'falling', 'fallen', ...]` -> `['bud', 'green', 'dying', 'falling', 'dead', ...]`.
- `app/tests/services/concept-batch-filter.test.mjs` — Comment-only alignment (line 15): "ease < 1.5 or dying/falling/fallen" -> "ease < 1.5 or dying/falling/dead".

Total: **8 files changed, 28 insertions(+), 28 deletions(-)** (one commit, byte-symmetric per literal substitution).

## Decisions Made

None new — followed plan as specified. All decisions are pre-locked in 33-CONTEXT.md (D-10/D-11/D-12/D-13/D-14/D-15) and Plan 33-03's Scope Boundaries section (TrellisTooltip.tsx absent → SKIP).

## Deviations from Plan

None — plan executed exactly as written.

The only branch decision was the SKIP-if-absent path for `TrellisTooltip.tsx`. Per the plan's Scope Boundaries section, the file's absence at execute-time was the EXPECTED case (filesystem-verified at planning time on 2026-04-19; file restoration deferred to v1.5). The `ls` check at Task 3.3 Step 3 returned `No such file or directory`, the SKIP branch was taken (no edits, no commit-list addition, no error). Recorded SKIP note in commit message body per plan instruction.

---

**Total deviations:** 0 (plan executed exactly as written)
**Impact on plan:** Zero — all D-10..D-15 acceptance criteria met. Plan executed exactly as written for all code/test edits + the SKIP-if-absent branch for TrellisTooltip.tsx (the expected execute-time path).

## Issues Encountered

None. All edits landed on first attempt. tsc stayed clean throughout. No retries, no rollbacks. Test signature diff was empty (zero new failure kinds).

## User Setup Required

None — no external service configuration required.

## Verification

### Pre-rename baseline (HEAD = 8be07a3e + stash applied)

```
npm test:                                     27 failures total
Failure signatures (5 unique):
  - AssertionError [ERR_ASSERTION]
  - code: 'ERR_ASSERTION'
  - code: 'ERR_IMPORT_ATTRIBUTE_MISSING'  (pre-existing Node-25 JSON-import-attribute issue, v1.3 baseline)
  - code: 'ERR_MODULE_NOT_FOUND'           (pre-existing — TrellisTooltip.tsx + podcast.service absent)
  - code: 'ERR_UNKNOWN_FILE_EXTENSION'     (pre-existing — tsx loader extension issue)
```

### Post-rename verification (HEAD = c8177c72)

```
git status --porcelain:                                empty (working tree clean) ✓
grep -c "'yellow'" app/src/services/trellis-state.service.ts:  0 ✓
grep -c "'fallen'" app/src/services/trellis-state.service.ts:  0 ✓
grep -c "'dying'"  app/src/services/trellis-state.service.ts:  5 ✓ (>=3 required)
grep -c "'dead'"   app/src/services/trellis-state.service.ts:  3 ✓ (>=2 required)
grep -c "'falling'" app/src/services/trellis-state.service.ts: 4 ✓ (>=2 required, retained per D-12)

Type union exact line:  export type LeafState = 'bud' | 'green' | 'dying' | 'falling' | 'dead' | 'blossom' | 'fruit'; ✓

Global grep "'yellow'" across app/src/ + app/tests/:
  - app/src/screens/PodcastScreen.tsx:220  ← intentional (UI status color, not LeafState; D-13 scope boundary)
  - app/src/components/ui/Badge.tsx:3       ← intentional (CSS color palette type BadgeColor; D-13 scope boundary)
  - 0 hits in any LeafState context ✓

Global grep "'fallen'" across app/src/ + app/tests/:
  - 0 hits anywhere ✓

Global grep "'falling'" across app/src/ + app/tests/:
  - 13 hits ✓ (retained per D-12)

npx tsc -b --noEmit:                                   exit 0 ✓
npx vite build:                                        clean in 3.13s, exit 0 ✓
npm test:                                              27 failures (delta: 0 vs baseline) ✓

Signature diff (post-rename - baseline):              empty (no new signatures introduced) ✓
Fail count comparison:  27 == 27  → PASS gate cleared ✓

git log -1 --format=%s:    refactor(trellis): rename LeafState literals yellow->dying, fallen->dead per design vocabulary (TD-06) ✓
git log -1 --stat | grep -c "app/":  8  (8 files in single commit) ✓
```

### Test signature diff (post-rename vs pre-rename baseline)

| Bucket | Pre-rename baseline | Post-rename | Delta |
| --- | --- | --- | --- |
| Total failures | 27 | 27 | 0 |
| ERR_IMPORT_ATTRIBUTE_MISSING | present | present | unchanged |
| ERR_MODULE_NOT_FOUND | present | present | unchanged |
| ERR_UNKNOWN_FILE_EXTENSION | present | present | unchanged |
| ERR_ASSERTION | present | present | unchanged |
| AssertionError [ERR_ASSERTION] | present | present | unchanged |

PASS gate cleared: post fail count ≤ baseline (27 == 27) AND post signature set ⊆ baseline signature set (5 == 5, identical sets). Zero new failure kinds introduced. The pre-existing 27 failures are the v1.3/1.4 carry-over from JSON-import-attribute issues, missing TrellisTooltip.tsx, missing podcast.service.ts, tsx loader extension issues, and feed-strategy assertion failures — all documented in 33-RESEARCH.md Pitfall #4/#5.

## Next Phase Readiness

- TD-06 closed for v1.4. The dead `'dying'` branch in `concept-feed.service.ts:671` (originally a TD-06 TS2367 site) is now a valid type-checked branch.
- Trellis vocabulary is now coherent across the type system, the UI, and the user-facing copy. No future contributor will be confused by `'yellow'`-meaning-"dying" or `'fallen'`-meaning-"dead".
- Plan 33-04 (5 Phase 31 tsc errors) is SATISFIED-BY-PRE-EXISTING per CONTEXT.md D-16/D-17/D-18 (`tsc -b --noEmit` exit 0 already verified). Plan 33-04 verification step is OPTIONAL.
- Plans 33-06 (perf memoization) and 33-07 (cosmetic polish) gated only by 33-05 (already complete) — both unblocked from a working-tree-cleanliness perspective.
- Plan 33-07 will modify PlannerScreen.tsx (refresh button size + EmptySectionHint padding). The two filter predicates updated by 33-03 (lines 46-47) are unaffected by 33-07's edits (different lines, no overlap).
- Pre-existing 27 baseline failures (JSON-import-attribute, missing TrellisTooltip.tsx, missing podcast.service.ts, tsx loader extension, feed-strategy assertions) remain — v1.5 concern, NOT a Phase 33 gate.

## Self-Check: PASSED

- All 8 renamed files exist on disk and contain renamed literals (verified via grep above).
- Commit `c8177c72`: confirmed PRESENT (`git log --oneline | grep c8177c72` → match; subject `refactor(trellis): rename LeafState literals yellow->dying, fallen->dead per design vocabulary (TD-06)`).
- `git log -1 --stat`: shows all 8 files in single commit, 28 insertions, 28 deletions.
- `npx tsc -b --noEmit`: exit 0 ✓
- `git status --porcelain`: empty (working tree clean) ✓
- `grep -c "'yellow'\|'fallen'"` in LeafState contexts (app/src/services/trellis-state.service.ts, app/src/services/concept-feed.service.ts, app/src/screens/PlannerScreen.tsx, app/src/components/trellis/*): 0 ✓
- `grep -c "'falling'"` (retained per D-12): 13 across app/src/ + app/tests/ ✓
- Pre-existing intentional `'yellow'` hits preserved in Badge.tsx + PodcastScreen.tsx ✓ (D-13 scope honored)

---
*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Completed: 2026-04-19*
