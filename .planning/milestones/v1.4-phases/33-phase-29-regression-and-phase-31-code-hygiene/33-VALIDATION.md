---
phase: 33
slug: phase-29-regression-and-phase-31-code-hygiene
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-19
updated: 2026-04-19
audit_trail:
  - date: 2026-04-19
    trigger: /gsd:validate-phase 33
    gaps_found: 8
    resolved: 8
    escalated: 0
    summary: Per-Task Verification Map extended with 8 rows for v2 plans 33-05/33-06/33-07 (WAVE-4-WIP, PERF-MEMO, COSMETIC-POLISH). All automated commands re-verified green; no behavior gaps.
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` + tsx loader (see `app/tests/canonical-knowledge.test.mjs` pattern) |
| **Config file** | `app/package.json` (`scripts.test`) |
| **Quick run command** | `cd app && node --test tests/<specific>.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~45 seconds (full) / ~2 seconds (single test) |

---

## Sampling Rate

- **After every task commit:** Run the targeted test for the files touched (e.g., `node --test tests/services/trellis-state.test.mjs` after TD-06 rename task).
- **After every plan wave:** Run `cd app && npm test` + `cd app && npx tsc -b --noEmit`.
- **Before `/gsd:verify-work`:** Full suite must show ZERO v1.4-specific regressions vs. the pre-rename baseline captured in Plan 33-03 Task 3.5 Step 3 (`/tmp/phase-33-pre-rename-baseline.log` + `/tmp/phase-33-baseline-signatures.txt`). Post-suite fail count ≤ baseline fail count AND post-suite signature set ⊆ baseline signature set. `tsc -b --noEmit` must be exit 0.
- **Max feedback latency:** 45 seconds.

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md. Every task gets one row.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 0.1 | 33-00 | 0 | WIP-FLUSH | targeted tests | `cd app && node --test tests/services/concept-batch-filter.test.mjs tests/services/daily-generation-cap.test.mjs tests/services/starter-posts.test.mjs tests/concept-quota.test.mjs` | ✅ all 4 | ✅ green |
| 0.2 | 33-00 | 0 | WIP-FLUSH | git-state | `cd /Users/Code/EchoLearn && git status --porcelain \| wc -l \| tr -d ' '` must equal `0` | n/a — git | ✅ green |
| 1.1 | 33-01 | 1 | TD-05 | bundle-parity + file-absence | `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` — fail 0; `test ! -f src/components/ConceptProgressCard.tsx` exit 0 | ✅ | ✅ green |
| 1.1b | 33-01 | 1 | TD-05 | grep orphan sweep | `grep -rn "home\.feed\.\(title\|complete\|progress\|progressCompact\)" app/src/ app/tests/` returns 0 hits | n/a — grep | ✅ green |
| 2.1 | 33-02 | 1 | TD-04 | targeted test + file-absence | `cd app && node --test tests/services/orchestration-strategy.test.mjs` fail 0; `test ! -f tests/services/concept-feed-strategy.test.mjs` exit 0 | ✅ | ✅ green |
| 2.2 | 33-02 | 1 | TD-04 | grep doc status | `grep -c "SUPERSEDED-BY-PHASE-31" .planning/phases/29-final-polishment/29-VERIFICATION.md` ≥ 1; `grep -c "TD-01 SUPERSEDED" .planning/phases/29-final-polishment/29-UAT-LOG.md` ≥ 1 | n/a — grep | ✅ green |
| 3.1 | 33-03 | 2 | TD-06 | grep LeafState type | `grep -c "'yellow'\|'fallen'" app/src/services/trellis-state.service.ts` == 0; `grep -c "'dying'\|'dead'" app/src/services/trellis-state.service.ts` ≥ 5 | n/a — grep | ✅ green |
| 3.2 | 33-03 | 2 | TD-06 | grep comparisons | `grep -c "'yellow'\|'fallen'" app/src/services/concept-feed.service.ts app/src/screens/PlannerScreen.tsx` == 0 | n/a — grep | ✅ green |
| 3.3 | 33-03 | 2 | TD-06 | grep trellis components (scope: 5 existing trellis files — `TrellisStatusPanel`, `TrellisLeaf`, `TrellisCanvas`, `TrellisHero`, `TrellisEmptyState`, `PrunedSection`; `TrellisTooltip.tsx` absent per Plan 33-03 Scope boundary) | `grep -rn "'yellow'\|'fallen'" app/src/components/trellis/ \| wc -l` == 0 | n/a — grep | ✅ green |
| 3.4 | 33-03 | 2 | TD-06 | grep test fixtures | `grep -rn "'yellow'\|'fallen'" app/tests/ \| wc -l` == 0 | n/a — grep | ✅ green |
| 3.5 | 33-03 | 2 | TD-06 | tsc + build + baseline-relative test diff | `cd app && npx tsc -b --noEmit` exit 0; `cd app && npx vite build` exit 0; post-rename `npm test` fail count ≤ pre-rename baseline AND post-rename signature set ⊆ baseline signature set (captured at `/tmp/phase-33-pre-rename-baseline.log` / `/tmp/phase-33-baseline-signatures.txt`) | n/a — tooling | ✅ green |
| 4.1 | 33-04 | 3 | TSC-HYGIENE | full success-criteria sweep (baseline-relative) | `cd app && npx tsc -b --noEmit`; `cd app && npx vite build`; `cd app && npm test` with closure fail count ≤ baseline AND closure signatures ⊆ baseline; `cd /Users/Code/EchoLearn && git status --porcelain` all pass | n/a — tooling | ✅ green |
| 4.2 | 33-04 | 3 | TSC-HYGIENE | file-presence + frontmatter | `test -f .planning/phases/33-phase-29-regression-and-phase-31-code-hygiene/33-CLOSURE.md`; `grep "nyquist_compliant: true" .planning/phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VALIDATION.md` | n/a — file check | ✅ green |
| 5.1 | 33-05 | 0 | WAVE-4-WIP | git-state (supersession path) | `cd /Users/Code/EchoLearn && git status --porcelain \| wc -l \| tr -d ' '` == `0`; supersession evidence in `33-05-SUMMARY.md` (SATISFIED-BY commit `6066c709`) | n/a — git | ✅ green |
| 5.2 | 33-05 | 0 | WAVE-4-WIP | targeted tests + tsc | `cd app && node --test tests/canonical-knowledge.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs tests/services/post-essay.service.test.mjs tests/locales/bundle-parity.test.mjs` fail 0; `cd app && npx tsc -b --noEmit` exit 0 | ✅ all 4 | ✅ green |
| 6.1 | 33-06 | 2 | PERF-MEMO | grep D-22a + guardrail | `grep -c "useState(() => settingsService.getSync()" app/src/components/InfoFlow.tsx` ≥ 1; `grep -c "wouldRenderVisual" app/src/components/InfoFlow.tsx` ≥ 3; `grep -c "const imageEnabled = settingsService" app/src/components/InfoFlow.tsx` == 0 | n/a — grep | ✅ green |
| 6.2 | 33-06 | 2 | PERF-MEMO | grep D-22b | `grep -cE "showConnectionScores=\{settingsService.getSync" app/src/screens/HomeScreen.tsx` == 0 | n/a — grep | ✅ green |
| 6.3 | 33-06 | 2 | PERF-MEMO | grep D-23 + TrellisLeaf out-of-scope + tsc + baseline-relative test diff | `grep -c "React.memo" app/src/components/InfoFlow.tsx` ≥ 1; `grep -c "React.memo" app/src/components/VineProgress.tsx` ≥ 1; `grep -c "React.memo" app/src/components/trellis/TrellisLeaf.tsx` == 0; `grep -c "<ConceptCard" app/src/components/InfoFlow.tsx` == 0; `cd app && npx tsc -b --noEmit` exit 0; `cd app && npm test` fail count ≤ 33-06 pre-task baseline | n/a — grep + tooling | ✅ green |
| 7.1 | 33-07 | 2 | COSMETIC-POLISH | grep D-24a + D-25a + D-25b (PlannerScreen) | `grep -c "width: '44px', height: '44px'" app/src/screens/PlannerScreen.tsx` ≥ 1; `grep -c "padding: 'var(--space-md) var(--space-lg)'" app/src/screens/PlannerScreen.tsx` ≥ 1; `grep -c "padding: 'var(--space-sm) var(--space-lg)'" app/src/screens/PlannerScreen.tsx` ≥ 2; `grep -c "width: '28px', height: '28px'" app/src/screens/PlannerScreen.tsx` == 0; `grep -c "padding: '14px 16px'" app/src/screens/PlannerScreen.tsx` == 0; `grep -c "padding: '10px 16px'" app/src/screens/PlannerScreen.tsx` == 0 | n/a — grep | ✅ green |
| 7.2 | 33-07 | 2 | COSMETIC-POLISH | grep D-24b + D-24c + D-25c (ChatInput) + D-26 no-new-packages | `grep -c "width: '44px'" app/src/components/ChatInput.tsx` ≥ 2; `grep -c "boxShadow: 'var(--shadow-2)'" app/src/components/ChatInput.tsx` ≥ 1; `grep -c "width: '34px'" app/src/components/ChatInput.tsx` == 0; `grep -c "boxShadow: '0 4px 12px rgba(0,0,0,0.1)'" app/src/components/ChatInput.tsx` == 0; `git diff HEAD~2 -- app/package.json \| wc -l` == 0 | n/a — grep + git | ✅ green |

*Status legend: pending (`☐`) · green (`✅`) · red (`❌`) · flaky (`⚠️`)*

---

## Wave 0 Requirements

- [x] No new test infrastructure needed — existing `node --test` + tsx loader covers every Phase 33 task.
- [x] 3 untracked test files already validated by researcher (all pass locally): `concept-batch-filter.test.mjs`, `daily-generation-cap.test.mjs`, `starter-posts.test.mjs`. These land as part of the WIP flush in Plan 33-00 (not a new Wave 0 scaffold).
- [x] No framework install — `node --test` is built-in to Node 22+.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `29-VERIFICATION.md` TD-01 row correctly reads `SUPERSEDED-BY-PHASE-31` with evidence pointer | D-04 | Doc content, not code | Read the file after edit, confirm row cites `31-CONTEXT.md` D-14. |
| `29-UAT-LOG.md` has appended SUPERSEDED entry (original row preserved) | D-05 | Doc content, not code | Read the file, confirm both the original SATISFIED row AND the new SUPERSEDED row exist. |
| WIP diffs contain no debug logs / secrets / half-implementations | D-20 | Human judgment | Researcher already audited; re-confirm before commit. |
| 33-CLOSURE.md captured output placeholders replaced with real command output | Plan 4.2 | Text substitution review | Grep for `{PASTE` placeholders should return zero hits in the final file. |

---

## Phase 33 Success Criteria → Tests

| Criterion (from ROADMAP) | Test |
|--------------------------|------|
| `npm test` shows zero v1.4-specific regressions vs. pre-rename baseline | `cd app && npm test` — compare `FAIL_COUNT_CLOSURE` ≤ `FAIL_COUNT_BASELINE` AND closure signature set ⊆ `/tmp/phase-33-baseline-signatures.txt`. Pre-existing failure kinds carried from v1.3/1.4 (`ERR_IMPORT_ATTRIBUTE_MISSING`, `ERR_MODULE_NOT_FOUND`, `ERR_UNKNOWN_FILE_EXTENSION`, `ERR_ASSERTION`) all expected; no new kinds permitted. |
| `npx tsc -b --noEmit` shows only the 4 pre-existing errors documented in 29-03-SUMMARY | `cd app && npx tsc -b --noEmit` — researcher found exit 0 is achievable (760fa4f8 already cleared them, including the 4 "pre-existing" ones) |
| `git status` is clean (or WIP carried with explicit commit) | `git status --porcelain` returns empty string after WIP flush commit (Plan 33-00) |
| `29-VERIFICATION.md` is no longer stale w.r.t. TD-01 | grep `SUPERSEDED-BY-PHASE-31` in `29-VERIFICATION.md` returns a hit (after Plan 33-02) |
| Bundle parity holds after locale key removal (D-09) | `cd app && node --test tests/locales/bundle-parity.test.mjs` — exit 0 (after Plan 33-01) |
| LeafState rename did not break state derivation | `cd app && node --test tests/services/trellis-state.test.mjs` — assertions for `'dying'`/`'dead'` pass structurally; the test file continues to surface the pre-existing `ERR_IMPORT_ATTRIBUTE_MISSING` signature at module load (baseline carry-through, NOT a rename regression — Pitfall #4). |
| `concept-feed.service.ts` LeafState predicate clears TS2367 after rename | `cd app && npx tsc -b --noEmit` — exit 0 (after Plan 33-03) |
| WAVE-4-WIP flushed (D-29..D-31) | `git status --porcelain \| wc -l` == 0; supersession evidence documented in `33-05-SUMMARY.md` (SATISFIED-BY-6066c709) |
| PERF-MEMO landed with `wouldRenderVisual` guardrail intact (D-22/D-23) | `grep -c "React.memo" app/src/components/InfoFlow.tsx` ≥ 1; `grep -c "React.memo" app/src/components/VineProgress.tsx` ≥ 1; `grep -c "React.memo" app/src/components/trellis/TrellisLeaf.tsx` == 0; `grep -c "wouldRenderVisual" app/src/components/InfoFlow.tsx` ≥ 3; `npm test` fail count ≤ 33-06 pre-task baseline (26) |
| COSMETIC-POLISH landed with no new packages (D-24/D-25/D-26) | `grep -c "width: '44px', height: '44px'" app/src/screens/PlannerScreen.tsx` ≥ 1; `grep -c "width: '44px'" app/src/components/ChatInput.tsx` ≥ 2; `grep -c "boxShadow: 'var(--shadow-2)'" app/src/components/ChatInput.tsx` ≥ 1; `grep -c "padding: 'var(--space-md) var(--space-lg)'" app/src/screens/PlannerScreen.tsx` ≥ 1; `grep -c "padding: 'var(--space-sm) var(--space-lg)'" app/src/screens/PlannerScreen.tsx` ≥ 2; `git diff HEAD~2 -- app/package.json \| wc -l` == 0 |

---

## Wave Ordering (recomputed per RESEARCH.md recommendation + v2 additions)

- **Wave 0** — Plan 33-00 (WIP flush) + Plan 33-05 (Wave 4 WIP re-flush; SATISFIED-BY-6066c709). Prerequisite for everything; must land first per D-19/D-29.
- **Wave 1** — Plan 33-01 (TD-05 delete) + Plan 33-02 (TD-04 supersession). Parallelizable — different files, no overlap.
- **Wave 2** — Plan 33-03 (TD-06 rename) + Plan 33-06 (perf memoization, D-22/D-23) + Plan 33-07 (cosmetic polish, D-24/D-25/D-26). 33-03 atomic commit per D-15; 33-06 touches InfoFlow/VineProgress/HomeScreen; 33-07 touches PlannerScreen/ChatInput. No file overlap between 33-03 / 33-06 / 33-07. TrellisLeaf explicitly out of scope (D-23).
- **Wave 3** — Plan 33-04 (closure + verification). Depends on Wave 2.

---

## Validation Sign-Off

- [x] All tasks have `<acceptance_criteria>` with grep-verifiable conditions
- [x] Sampling continuity: after every rename task, both `npm test` + `tsc` run
- [x] Wave 0 covers all MISSING references (NONE — no new infra needed)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter — this VALIDATION.md flipped post-planning once 4 PLANs landed with complete verification commands.

**Approval:** approved 2026-04-19 by planner; executor-verified 2026-04-19 (all 13 original rows green via Plan 33-04); re-validated 2026-04-19 with 8 new rows for v2 plans 33-05/33-06/33-07 — all ✅ green.

---

## Validation Audit 2026-04-19 (v2 — post-execution reconciliation)

Retroactive audit triggered by `/gsd:validate-phase 33`. The Per-Task Verification Map was authored before the v2 scope additions (Plans 33-05 / 33-06 / 33-07 — Wave 4 WIP reflush, perf memoization, cosmetic polish) landed on 2026-04-19. All three plans executed successfully per their SUMMARY files; this audit reconciles the map.

| Metric | Count |
|--------|-------|
| Gaps found (rows missing from Per-Task Verification Map) | 8 |
| Resolved (rows added, automated commands re-verified green) | 8 |
| Escalated to manual-only | 0 |

**Per-plan verification re-run on 2026-04-19:**

- Plan 33-05 (WAVE-4-WIP — SATISFIED-BY-6066c709): `git status --porcelain` → 0 lines; targeted test gate green at supersession-detect time per `33-05-SUMMARY.md`.
- Plan 33-06 (PERF-MEMO): grep assertions all green — `useState(() => settingsService.getSync()` = 1 hit in InfoFlow, `wouldRenderVisual` = 4 hits (≥ 3 required), `React.memo` = 3 in InfoFlow, 1 in VineProgress, 0 in TrellisLeaf (out-of-scope honored), `showConnectionScores={settingsService.getSync` = 0 hits in HomeScreen.
- Plan 33-07 (COSMETIC-POLISH): grep assertions all green — `width: '44px', height: '44px'` = 1 in PlannerScreen, `padding: 'var(--space-md) var(--space-lg)'` = 1, `padding: 'var(--space-sm) var(--space-lg)'` = 2, `width: '44px'` = 2 in ChatInput, `boxShadow: 'var(--shadow-2)'` = 1. Negative checks all 0.

All 21 rows in the Per-Task Verification Map now ✅ green. `nyquist_compliant: true` retained.
