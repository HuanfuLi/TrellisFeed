---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
type: closure
created: 2026-04-19
verdict: passed
---

# Phase 33 Closure — Phase 29 regression + Phase 31 code hygiene

Phase 33 executed in 4 waves (Wave 0 WIP flush, Wave 1 TD-04/TD-05, Wave 2 TD-06 rename, Wave 3 closure + v2 perf/cosmetic). This document records the final verification state against the 4 ROADMAP success criteria plus the SATISFIED-BY-760fa4f8 evidence for D-16/D-17/D-18.

## Summary

| Success Criterion (ROADMAP Phase 33) | Status | Evidence |
|---|---|---|
| 1. `npm test` shows zero v1.4 regressions vs. pre-rename baseline | PASSED | See Check 3 below — `FAIL_COUNT_CLOSURE=27` ≤ `FAIL_COUNT_BASELINE=27`; signatures identical |
| 2. `npx tsc -b --noEmit` exit 0 | PASSED | See Check 1 below — empty output, exit 0 |
| 3. `git status` clean | PASSED | See Check 4 below — `git status --porcelain --untracked-files=all` returns empty |
| 4. `29-VERIFICATION.md` no longer stale w.r.t. TD-01 | PASSED | See Check 5 below — `SUPERSEDED-BY-PHASE-31` marker present (1 hit) |

## D-16 / D-17 / D-18 Status: SATISFIED-BY-760fa4f8

Per RESEARCH.md Finding #3, commit `760fa4f8` ("chore(types): clear 10 stale tsc errors blocking device build", 2026-04-18 23:34) — landed ONE DAY BEFORE Phase 33 CONTEXT.md was authored — already:

- **D-16 (VineProgress 3 unused props): SATISFIED-BY-760fa4f8.** Dropped `explored`, `total`, `isComplete` from VineProgressProps and caller sites in HomeScreen.tsx. Verified at `app/src/components/VineProgress.tsx:5-10` (current prop interface is `mode/concepts/onConceptTap/onHistoryTap` only).
- **D-17 (4 unused helpers in concept-feed.service.ts): SATISFIED-BY-760fa4f8.** Removed `generateDailyPostsWithLLM`, `_backgroundGenerateVideos`, `shuffleArray`, `_backgroundGenerateNews` + orphaned `graphService` / `newsService` imports.
- **D-18 (tsc clean after fixes): SATISFIED-BY-760fa4f8.** `npx tsc -b --noEmit` exits 0; the 4 "pre-existing" errors listed in 29-03-SUMMARY.md (AskScreen, PlannerScreen, SettingsFeaturesScreen, SettingsScreen) were also cleared by 760fa4f8. Re-verified during this closure (Check 1 below).

Phase 33 itself introduced no additional tsc fixes for D-16/D-17/D-18. All verification is grep + test-run, no code delta. Plan 33-04 documents this rather than redoing the work.

## Check 1 — npx tsc -b --noEmit

Captured at `/tmp/33-closure-tsc.txt`:

```
TSC_EXIT=0
```

Exit code: 0. Empty output (no error messages). Clean.

## Check 2 — npx vite build

Captured at `/tmp/33-closure-vite.txt`:

```
dist/assets/vendor-markdown-DuCjYyzI.js                 157.40 kB │ gzip:  47.56 kB
dist/assets/index-CJ6YGqjn.js                         1,249.34 kB │ gzip: 367.68 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.95s
VITE_EXIT=0
```

Exit code: 0. Built in 2.95s. The chunk-size warning is informational (Vite default 500kB advisory) and out-of-scope per CONTEXT "Out of scope" — bundle splitting / lazy routes deferred to v1.5 architecture review.

## Check 3 — npm test (baseline-relative comparison)

Pre-rename baseline (captured in Plan 33-03 Task 3.5 Step 3, file `/tmp/phase-33-pre-rename-baseline.log`):

- `FAIL_COUNT_BASELINE` = **27**
- Baseline signatures (`/tmp/phase-33-baseline-signatures.txt`):

```
AssertionError [ERR_ASSERTION]
code: 'ERR_ASSERTION'
code: 'ERR_IMPORT_ATTRIBUTE_MISSING'
code: 'ERR_MODULE_NOT_FOUND'
code: 'ERR_UNKNOWN_FILE_EXTENSION'
```

Closure run (this task, captured at `/tmp/33-closure-tests.txt` and `/tmp/33-closure-signatures.txt`):

- `FAIL_COUNT_CLOSURE` = **27**
- Closure signatures:

```
AssertionError [ERR_ASSERTION]
code: 'ERR_ASSERTION'
code: 'ERR_IMPORT_ATTRIBUTE_MISSING'
code: 'ERR_MODULE_NOT_FOUND'
code: 'ERR_UNKNOWN_FILE_EXTENSION'
```

New signatures (`comm -23 /tmp/33-closure-signatures.txt /tmp/phase-33-baseline-signatures.txt`):

```
(empty — no new signatures)
```

**Verdict:** `FAIL_COUNT_CLOSURE (27) ≤ FAIL_COUNT_BASELINE (27)` AND closure signature set ⊆ baseline signature set (identical sets, 5 elements each). **PASSED.**

Failure breakdown (pre-existing from v1.3/1.4 WIP state, NOT Phase 33 regressions):

- `ERR_IMPORT_ATTRIBUTE_MISSING` — Node-25 JSON import attribute requirement (en.json, zh.json, es.json, ja.json imports in trellis test files).
- `ERR_MODULE_NOT_FOUND` — absent `app/src/components/trellis/TrellisTooltip.tsx` (deferred to v1.5 per Plan 33-03 Scope boundary); absent `app/src/services/podcast.service` import from `trellis-actions.service.ts` (pre-existing defect documented in STATE.md).
- `ERR_UNKNOWN_FILE_EXTENSION` — direct `.tsx` imports (TrellisLeaf.tsx) that the tsx loader rejects — pre-existing.
- `ERR_ASSERTION` / `AssertionError [ERR_ASSERTION]` — feed-strategy test assertions (e.g., `applyStrategyBias` function enumeration) — pre-existing from earlier phase; supersession of TD-04 (Plan 33-02) deleted `concept-feed-strategy.test.mjs` itself but assertion-class signatures appear in other tests as well.

Zero v1.4-specific regressions. All four failure kinds carry through from the baseline.

## Check 4 — git status

Captured at `/tmp/33-closure-git.txt`:

```
(empty — working tree clean)
```

Working tree clean.

## Check 5 — 29-VERIFICATION.md no longer stale

```
$ grep -c "SUPERSEDED-BY-PHASE-31" .planning/phases/29-final-polishment/29-VERIFICATION.md
1

$ grep -c "TD-01 SUPERSEDED" .planning/phases/29-final-polishment/29-UAT-LOG.md
1
```

Both ≥ 1. The TD-01 row in 29-VERIFICATION.md now reads `SUPERSEDED-BY-PHASE-31` and 29-UAT-LOG.md has the appended SUPERSEDED entry. See Plan 33-02 (`refactor(29): supersede TD-01 — Phase 31 D-14 generation-time prioritization subsumes runtime sort bias`, commit `e6ca3d35` + SHA backfill commit `69389d45`) for the full edit trail.

## Check 6 — TD-05 deletion state (cross-check with Plan 33-01)

```
$ test ! -f app/src/components/ConceptProgressCard.tsx && echo "DELETED"
DELETED

$ cd app && node --test tests/locales/bundle-parity.test.mjs
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
```

ConceptProgressCard.tsx DELETED. Bundle parity test green (4 dead i18n keys removed in lockstep).

## Check 7 — TD-06 rename state (cross-check with Plan 33-03)

```
$ grep -c "'yellow'" app/src/services/trellis-state.service.ts
0
$ grep -c "'fallen'" app/src/services/trellis-state.service.ts
0
$ grep -c "'dying'" app/src/services/trellis-state.service.ts
5
$ grep -c "'dead'" app/src/services/trellis-state.service.ts
3
$ grep -c "'falling'" app/src/services/trellis-state.service.ts
4
```

Expected `0, 0, ≥3, ≥2, ≥2` — actual `0, 0, 5, 3, 4`. Match. `'yellow'` and `'fallen'` literals fully eliminated; `'dying'`, `'dead'` present per type union + computeLeafState + dev-mode seeds; `'falling'` retained per D-12 (internal-only gradation).

## Commit trail (Phase 33)

```
$ git log --oneline | head -10
a1ab892d docs(33-07): complete cosmetic polish plan (D-24 + D-25 + D-26)
47d81049 style(ChatInput): touch targets + shadow token (D-24, D-25)
616c761f style(PlannerScreen): touch targets + spacing tokens (D-24, D-25)
51b0724d docs(33-06): complete perf memoization plan (D-22 + D-23)
9b9eeb01 perf(InfoFlow,VineProgress): wrap heavy cards in React.memo (D-23)
59bb0a8d perf(HomeScreen): memoize settings reads (D-22)
5542f78f perf(InfoFlow): memoize imageGeneration settings read at ConceptCard (D-22)
e2b875fb docs(33-03): complete TD-06 LeafState rename plan
c8177c72 refactor(trellis): rename LeafState literals yellow->dying, fallen->dead per design vocabulary (TD-06)
8be07a3e docs(33-02): complete TD-04 supersession plan
```

Phase 33 commits (in reverse chronological order — pulled from git log over the full Phase 33 commit window):

1. `(THIS COMMIT)` docs(33): record Phase 33 closure + SATISFIED-BY-760fa4f8 evidence (Plan 33-04)
2. `a1ab892d` docs(33-07): complete cosmetic polish plan (D-24 + D-25 + D-26) (Plan 33-07)
3. `47d81049` style(ChatInput): touch targets + shadow token (D-24, D-25) (Plan 33-07)
4. `616c761f` style(PlannerScreen): touch targets + spacing tokens (D-24, D-25) (Plan 33-07)
5. `51b0724d` docs(33-06): complete perf memoization plan (D-22 + D-23) (Plan 33-06)
6. `9b9eeb01` perf(InfoFlow,VineProgress): wrap heavy cards in React.memo (D-23) (Plan 33-06)
7. `59bb0a8d` perf(HomeScreen): memoize settings reads (D-22) (Plan 33-06)
8. `5542f78f` perf(InfoFlow): memoize imageGeneration settings read at ConceptCard (D-22) (Plan 33-06)
9. `e2b875fb` docs(33-03): complete TD-06 LeafState rename plan (Plan 33-03)
10. `c8177c72` refactor(trellis): rename LeafState literals yellow->dying, fallen->dead per design vocabulary (TD-06) (Plan 33-03)
11. `8be07a3e` docs(33-02): complete TD-04 supersession plan (Plan 33-02)
12. `69389d45` docs(29): record TD-04 closure commit SHA in UAT-LOG supersession entry (Plan 33-02 amendment)
13. `e6ca3d35` refactor(29): supersede TD-01 — Phase 31 D-14 generation-time prioritization subsumes runtime sort bias (TD-04) (Plan 33-02)
14. `579c4fc5` docs(33-01): complete TD-05 partial orphan sweep plan (Plan 33-01)
15. `e297a77a` refactor(feed): delete orphaned ConceptProgressCard.tsx + its 4 dead i18n keys (TD-05) (Plan 33-01)
16. `80e42204` docs(33-05): mark Plan 33-05 SATISFIED-BY-6066c709 (operator pre-committed WIP) (Plan 33-05)
17. `fe4a2387` chore(v1.4): flush WIP — quota refactor, i18n polish, starter-posts-decay helper (Plan 33-00)

Pre-Phase-33 relevant commits (referenced from this closure):

- `760fa4f8` chore(types): clear 10 stale tsc errors blocking device build — **SATISFIES D-16/D-17/D-18**.
- `9486799a` test(32.1-02): commit existing concept-batch + daily-generation-cap + starter-posts tests — pre-Phase-33 test checkpoint (these 3 test files landed before Phase 33 and were NOT part of the 33-00 WIP flush).
- `6066c709` (referenced in `80e42204`) — operator pre-committed Wave 4 WIP (subsequently RECORDED as SATISFIED-BY in Plan 33-05's docs commit).

## Deferred (per D-07, D-08, D-12, Phase 33 Scope boundary)

- `post-store.service.ts` deletion — revisit at start of v1.5 milestone planning (D-07).
- `ImmersiveInfoFlow` export deletion in InfoFlow.tsx — revisit at v1.5 (D-08).
- Rename `'falling'` LeafState literal — not worth the churn; UI never exposes it (D-12).
- Restore `app/src/components/trellis/TrellisTooltip.tsx` OR re-point `trellis-tooltip-copy.test.mjs` — out of scope for Phase 33 (Plan 33-03 objective Scope boundary); `ERR_MODULE_NOT_FOUND` failure carries through from baseline.
- Resolve absent `podcast.service` import in `trellis-actions.service.ts` — out of scope; pre-existing defect carrying through baseline.
- Question-filter LLM threshold tuning, combined LLM call refactor in canonical-knowledge new-branch path, text-art prompt batching, useTrellisData event-bus debounce, TrellisLeaf React.memo, IntersectionObserver for trellis perf-mask, bundle splitting, i18n string-overflow audit — all v1.5 carry-overs per CONTEXT "Deferred Ideas".

## Sign-off

Phase 33 passed. All 26 decisions (D-01..D-26 + D-29..D-31) satisfied or explicitly deferred:

| Decision | Disposition | Plan |
|---|---|---|
| D-01..D-05 (TD-04 supersession) | SATISFIED | 33-02 |
| D-06 (ConceptProgressCard delete) | SATISFIED | 33-01 |
| D-07 (post-store.service.ts retain) | DEFERRED-TO-V1.5 | — |
| D-08 (ImmersiveInfoFlow retain) | DEFERRED-TO-V1.5 | — |
| D-09 (orphan i18n keys removed) | SATISFIED | 33-01 |
| D-10, D-11, D-13, D-14 (LeafState rename) | SATISFIED | 33-03 |
| D-12 (keep 'falling') | SATISFIED | 33-03 |
| D-15 (atomic rename commit) | SATISFIED | 33-03 |
| D-16, D-17, D-18 (tsc hygiene) | **SATISFIED-BY-760fa4f8** | — (recorded in this closure) |
| D-19 (WIP flush commit) | SATISFIED | 33-00 |
| D-20 (review policy) | SATISFIED | 33-00 |
| D-21 (3 untracked tests green) | SATISFIED-BY-9486799a | — (tests landed pre-33 via commit 9486799a) |
| D-22 (settings memoization) | SATISFIED | 33-06 |
| D-23 (React.memo on ConceptCard + VineProgress) | SATISFIED | 33-06 |
| D-24 (touch-target compliance) | SATISFIED | 33-07 |
| D-25 (spacing & shadow tokens) | SATISFIED | 33-07 |
| D-26 (no Tailwind / no new packages / no translation changes) | SATISFIED | 33-07 |
| D-29 (Wave 4 WIP re-flush commit) | SATISFIED-BY-6066c709 | 33-05 (recorded) |
| D-30 (per-file diff review) | SATISFIED-BY-6066c709 | 33-05 (recorded) |
| D-31 (targeted tests green at flush) | SATISFIED-BY-6066c709 | 33-05 (recorded) |

Ready for milestone v1.4 re-audit.
