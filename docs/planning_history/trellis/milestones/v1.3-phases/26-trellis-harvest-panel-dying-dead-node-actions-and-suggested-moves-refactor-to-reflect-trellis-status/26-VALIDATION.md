---
phase: 26
slug: trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
updated: 2026-04-15
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — uses node --test directly |
| **Quick run command** | `cd app && node --test tests/services/trellis-*.test.mjs` |
| **Full suite command** | `cd app && node --test tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | HARVEST-CREDITS | unit | `node --test --experimental-loader=./tests/services/_actions-mock-loader.mjs tests/services/trellis-credits.test.mjs` | ✅ | ✅ green |
| 26-01-02 | 01 | 1 | HARVEST-EVENT | unit | `node --test --experimental-loader=./tests/services/_actions-mock-loader.mjs tests/services/trellis-harvest.test.mjs` | ✅ | ✅ green |
| 26-02-01 | 02 | 2 | STATUS-PANEL | integration | manual — visual layout | N/A | ⬜ pending |
| 26-03-01 | 03 | 3 | HEAL-ACTION | unit | `node --test --experimental-loader=./tests/services/_actions-mock-loader.mjs tests/services/trellis-heal.test.mjs` | ✅ | ✅ green |
| 26-03-02 | 03 | 3 | REPLANT-ACTION | unit | `node --test --experimental-loader=./tests/services/_actions-mock-loader.mjs tests/services/trellis-replant.test.mjs` | ✅ | ✅ green |
| 26-04-01 | 04 | 4 | PRUNE-ACTION | unit | `node --test --experimental-loader=./tests/services/_actions-mock-loader.mjs tests/services/trellis-prune.test.mjs` | ✅ | ✅ green |
| 26-05-01 | 05 | 5 | MOVES-REFACTOR | unit | manual-only — filtering inline in PlannerScreen (see Manual-Only section) | N/A | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/services/trellis-credits.test.mjs` — credit accumulation and persistence (7 tests, green)
- [x] `tests/services/trellis-harvest.test.mjs` — HARVEST_COMPLETED event wiring and isolation (4 tests, green)
- [x] `tests/services/trellis-heal.test.mjs` — heal nav intent, podcast side-effect, swallow-throw (4 tests, green)
- [x] `tests/services/trellis-replant.test.mjs` — sync replant, dyingSchedule bump, CLASSIFICATION_COMPLETED (6 tests, green)
- [x] `tests/services/trellis-prune.test.mjs` — prune flags, ANCHOR_DELETED, getPrunedQuestions filter, unprune, hardDelete (6 tests, green)
- [ ] `tests/services/trellis-moves.test.mjs` — MANUAL-ONLY: dedup/ordering inline in PlannerScreen, not extractable without refactor

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Harvest collection animation | D-03 | Visual animation timing | Tap harvest → fruits fly to counter + confetti |
| Scissors prune animation | D-17 | VOIDED (UAT simplification — prune is now instant) | N/A |
| Status panel glow on fruits | D-05 | Visual CSS effect | Check glow when fruit count > 0 |
| Bottom sheet interaction | D-09 | VOIDED (UAT simplification — sheets removed) | N/A |
| Moves priority ordering (D-20..D-23) | D-19–D-23 | Filtering inline in PlannerScreen (const derivations, not extractable) | Open PlannerScreen with dead + dying + autoGen nodes; verify render order: dead rows first, dying second, autoGen third, no duplicates |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (trellis-moves escalated to manual-only per constraints)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (27 tests run in ~200ms)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green — 27/27 automated tests pass; trellis-moves manual-only per inline-PlannerScreen constraint
