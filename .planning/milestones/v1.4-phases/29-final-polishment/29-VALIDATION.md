---
phase: 29
slug: final-polishment
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
validated: 2026-04-17
re_audited: 2026-04-25
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (same as Phase 27) |
| **Config file** | None — individual test files self-contained |
| **Quick run command** | `cd app && node --test tests/services/orchestration-strategy.test.mjs` (per-plan) |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | Full suite ~60s (matches Phase 27 baseline); quick runs <5s |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted test file (per-plan commands below)
- **After every plan wave:** Run the plan's full per-plan test matrix
- **Before `/gsd:verify-work`:** Full suite (`npm test`) must be green
- **Max feedback latency:** 60 seconds (full suite)

---

## Per-Task Verification Map

### Plan 29-01 (TD-01 curiosity signal wiring)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | TD-01 (ORCH-01) | static-grep | `cd app && node --test tests/services/orchestration-strategy.test.mjs` | ✅ existing | ⬜ pending |
| 29-01-02 | 01 | 1 | TD-01 (ORCH-03) | unit | `cd app && node --test tests/services/orchestration-strategy.test.mjs` | ✅ existing | ⬜ pending |

### Plan 29-02 (TD-02 + TD-03 AbortSignal plumbing)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-02-01 | 02 | 1 | TD-02 (POST-02) | static-grep + behavioral | `cd app && node --test tests/screens/post-detail-abort.test.mjs` | ❌ W0 | ⬜ pending |
| 29-02-02 | 02 | 1 | TD-02 | static-grep | `cd app && node --test tests/screens/post-detail-abort.test.mjs` | ❌ W0 | ⬜ pending |
| 29-02-03 | 02 | 1 | TD-03 (PIPE-01..07) | static-grep + behavioral | `cd app && node --test tests/canonical-knowledge-pipeline.test.mjs` | ✅ existing | ⬜ pending |
| 29-02-04 | 02 | 1 | TD-03 | static-grep | `cd app && node --test tests/state/useQuestions-locale-abort.test.mjs` | ✅ existing | ⬜ pending |

### Plan 29-03 (tsc + Node 25 cleanup)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-03-01 | 03 | 1 | tsc GraphScreen | tsc | `cd app && npx tsc --noEmit --project tsconfig.json` (target files clean) | ✅ existing | ⬜ pending |
| 29-03-02 | 03 | 1 | tsc canonical-knowledge + review + trellis-state | tsc | same | ✅ existing | ⬜ pending |
| 29-03-03 | 03 | 1 | Node 25: 5 failing tests pass | regression | `cd app && node --test tests/canonical-knowledge-pipeline.test.mjs tests/canonical-knowledge.test.mjs tests/services/concept-feed.test.mjs tests/reorg-json-parser.test.mjs tests/services/web-search.test.mjs` | ✅ existing (failing) | ⬜ pending |
| 29-03-04 | 03 | 1 | No new regressions | regression | `cd app && npm test` | ✅ existing | ⬜ pending |

### Plan 29-04 (UAT walkthrough)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-04-00 | 04 | 1 | UAT structure | manual | Create `.planning/phases/29-final-polishment/29-UAT-LOG.md` with 22 active rows + 3 SKIP rows | ❌ W0 | ⬜ pending |
| 29-04-01 | 04 | 1 | Phase 20 UAT (4 items) | manual | Operator walkthrough; Claude records in UAT-LOG.md | — | ⬜ pending |
| 29-04-02 | 04 | 1 | Phase 21 UAT (4 items — 1 marked N/A) | manual | same | — | ⬜ pending |
| 29-04-03 | 04 | 1 | Phase 22 UAT (7 items — items 4/5 SKIP) | manual | same | — | ⬜ pending |
| 29-04-04 | 04 | 1 | Phase 26 UAT (7 items) | manual | same | — | ⬜ pending |
| 29-04-05 | 04 | 1 | VERIFICATION.md frontmatter flip (phases 20/21/22/26) | static-grep | `grep -l "status: passed" .planning/milestones/v1.3-phases/{20,21,22,26}-*/*-VERIFICATION.md` returns all 4 | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/screens/post-detail-abort.test.mjs` — NEW file, stubs for TD-02 abort behavior. Pattern modeled on `app/tests/state/useQuestions-locale-abort.test.mjs`.
- [ ] `.planning/phases/29-final-polishment/29-UAT-LOG.md` — NEW file for Plan 29-04. Schema per D-09 (single flat file, source-phase grouping).
- [ ] No new test framework install needed — `node --test` already in use.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase 20 portal card layout + diagnostic chat | Phase 20 UAT | Visual + live LLM | See `.planning/milestones/v1.3-phases/20-*/20-VERIFICATION.md` human_verification block |
| Phase 21 on-enter streaming UX + cache behavior | Phase 21 UAT | Visual + network timing | See `.planning/milestones/v1.3-phases/21-*/21-VERIFICATION.md` |
| Phase 22 rubber-band + nested gestures + keyboard suppress | Phase 22 UAT | Physical gesture | See `.planning/milestones/v1.3-phases/22-*/22-VERIFICATION.md` (skip items 4, 5 per D-23) |
| Phase 26 harvest animation + fruit glow + heal/replant/prune | Phase 26 UAT | Visual animation | See `.planning/milestones/v1.3-phases/26-*/26-VERIFICATION.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies listed
- [ ] Sampling continuity: no 3 consecutive code tasks without automated verify (29-04 is manual by design — exempt)
- [ ] Wave 0 covers MISSING reference: `post-detail-abort.test.mjs` + `29-UAT-LOG.md`
- [ ] No watch-mode flags — all test commands are one-shot
- [ ] Feedback latency < 60s (full suite; per-file runs <5s)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 files land and planner confirms

**Approval:** pending
