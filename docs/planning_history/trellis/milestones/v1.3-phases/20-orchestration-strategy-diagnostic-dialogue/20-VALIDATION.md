---
phase: 20
slug: orchestration-strategy-diagnostic-dialogue
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js test runner (`node --test`) + TypeScript compiler (`tsc --noEmit`) |
| **Config file** | `app/tsconfig.json` |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && node --test tests/services/orchestration-strategy.test.mjs && node --test tests/services/diagnostic-dialogue.test.mjs && node --test tests/services/portal-card.test.mjs && node --test tests/services/suggestionScorer.test.mjs && node --test tests/services/concept-feed-strategy.test.mjs && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run task-specific `<automated>` command from plan
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | ORCH-01 | unit | `node --test tests/services/orchestration-strategy.test.mjs` | ✅ | ✅ green |
| 20-02-01 | 02 | 1 | DIAG-01,DIAG-03 | unit | `node --test tests/services/diagnostic-dialogue.test.mjs` | ✅ | ✅ green |
| 20-03-01 | 03 | 2 | ORCH-03 | unit | `node --test tests/services/suggestionScorer.test.mjs` | ✅ | ✅ green |
| 20-03-02 | 03 | 2 | ORCH-02,ORCH-03 | compile+unit | `npx tsc --noEmit && node --test tests/services/plannerAutoGen.test.mjs && node --test tests/services/suggestionScorer.test.mjs && node --test tests/services/concept-feed-strategy.test.mjs` | ✅ | ✅ green |
| 20-04-01 | 04 | 3 | PORTAL-02,PORTAL-03 | unit+compile | `node --test tests/services/portal-card.test.mjs && npx tsc --noEmit` | ✅ | ✅ green |
| 20-04-02 | 04 | 3 | DIAG-02 | compile | `npx tsc --noEmit` | ✅ | ✅ green |
| 20-04-03 | 04 | 3 | PORTAL-01,DIAG-02 | compile | `npx tsc --noEmit` | ✅ | ✅ green |
| 20-04-04 | 04 | 3 | PORTAL-01,PORTAL-02,PORTAL-03,DIAG-02 | visual | `npx tsc --noEmit` + manual | ✅ | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (Node.js test runner + TypeScript compilation).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Strategy hints bias feed toward weak areas | ORCH-02 | Content check | Add weak flashcards, verify feed posts prioritize those topics |
| Planner scoring adjusts for retrieval/discovery mode | ORCH-03 | Content check | Verify suggestions shift when review gap detected |
| Multi-turn check-in dialogue | DIAG-01 | Interaction check | Submit check-in, verify LLM asks follow-up, respond, verify updated signals |
| Conversation persists across navigation | DIAG-02 | Interaction check | Start check-in, navigate away, return, verify conversation intact |
| Signals update after each turn | DIAG-03 | Content check | Complete multi-turn check-in, verify extracted signals reflect all turns |
| Portal cards replace flat suggestions | PORTAL-01 | Visual check | Open Planner, verify portal cards instead of flat list |
| Portal card shows content counts | PORTAL-02 | Visual check | Verify card shows post/flashcard/question counts for topic |
| Portal card navigates to content | PORTAL-03 | Interaction check | Tap portal card links, verify navigation to correct screens |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** audited 2026-04-07

---

## Validation Audit 2026-04-07

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap resolved:** ORCH-02 — added `concept-feed-strategy.test.mjs` (11 tests) covering `applyStrategyBias` behavioral and structural verification.
