---
phase: 33
slug: phase-29-regression-and-phase-31-code-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
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
- **Before `/gsd:verify-work`:** Full suite must show only the 24 pre-existing Node-25 trellis failures (zero new failures) AND `tsc -b --noEmit` must be exit 0.
- **Max feedback latency:** 45 seconds.

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md. Every task gets one row.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TD-04/05/06 | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test infrastructure needed — existing `node --test` + tsx loader covers every Phase 33 task.
- [ ] 3 untracked test files already validated by researcher (all pass locally): `concept-batch-filter.test.mjs`, `daily-generation-cap.test.mjs`, `starter-posts.test.mjs`.
- [ ] No framework install — `node --test` is built-in to Node 22+.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `29-VERIFICATION.md` TD-01 row correctly reads `SUPERSEDED-BY-PHASE-31` with evidence pointer | D-04 | Doc content, not code | Read the file after edit, confirm row cites `31-CONTEXT.md` D-14. |
| `29-UAT-LOG.md` has appended SUPERSEDED entry (original row preserved) | D-05 | Doc content, not code | Read the file, confirm both the original SATISFIED row AND the new SUPERSEDED row exist. |
| WIP diffs contain no debug logs / secrets / half-implementations | D-20 | Human judgment | Researcher already audited; re-confirm before commit. |

---

## Phase 33 Success Criteria → Tests

| Criterion (from ROADMAP) | Test |
|--------------------------|------|
| `npm test` shows only pre-existing Node-25 trellis failures — zero v1.4-specific failures | `cd app && npm test` — diff against 24-failure baseline |
| `npx tsc -b --noEmit` shows only the 4 pre-existing errors documented in 29-03-SUMMARY | `cd app && npx tsc -b --noEmit` — researcher found exit 0 is achievable (760fa4f8 already cleared them) |
| `git status` is clean (or WIP carried with explicit commit) | `git status --porcelain` returns empty string after WIP flush commit |
| `29-VERIFICATION.md` is no longer stale w.r.t. TD-01 | grep `SUPERSEDED-BY-PHASE-31` in `29-VERIFICATION.md` returns a hit |
| Bundle parity holds after locale key removal (D-09) | `cd app && node --test tests/locales/bundle-parity.test.mjs` — exit 0 |
| LeafState rename did not break state derivation | `cd app && node --test tests/services/trellis-state.test.mjs` — assertions for `'dying'`/`'dead'` pass |
| `concept-feed.service.ts:745` clears TS2367 after rename | `cd app && npx tsc -b --noEmit` — grep output for TS2367, must be zero |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` with grep-verifiable conditions
- [ ] Sampling continuity: after every rename task, both `npm test` + `tsc` run
- [ ] Wave 0 covers all MISSING references (NONE — no new infra needed)
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills the verification map

**Approval:** pending
