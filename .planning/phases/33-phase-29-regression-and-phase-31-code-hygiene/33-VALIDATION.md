---
phase: 33
slug: phase-29-regression-and-phase-31-code-hygiene
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-19
updated: 2026-04-19
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

---

## Wave Ordering (recomputed per RESEARCH.md recommendation)

- **Wave 0** — Plan 33-00 (WIP flush). Prerequisite for everything; must land first per D-19.
- **Wave 1** — Plan 33-01 (TD-05 delete) + Plan 33-02 (TD-04 supersession). Parallelizable — different files, no overlap.
- **Wave 2** — Plan 33-03 (TD-06 rename). Atomic commit per D-15; touches 8 files (TrellisTooltip.tsx explicitly out of scope — absent from working tree, deferred to v1.5). Depends on both Wave 1 plans.
- **Wave 3** — Plan 33-04 (closure + verification). Depends on Wave 2.

---

## Validation Sign-Off

- [x] All tasks have `<acceptance_criteria>` with grep-verifiable conditions
- [x] Sampling continuity: after every rename task, both `npm test` + `tsc` run
- [x] Wave 0 covers all MISSING references (NONE — no new infra needed)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter — this VALIDATION.md flipped post-planning once 4 PLANs landed with complete verification commands.

**Approval:** approved 2026-04-19 by planner; executor-verified 2026-04-19 (all 13 rows in the Per-Task Verification Map are now ✅ green via Plan 33-04)
