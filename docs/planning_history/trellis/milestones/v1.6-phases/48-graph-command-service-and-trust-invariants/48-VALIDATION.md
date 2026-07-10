---
phase: 48
slug: graph-command-service-and-trust-invariants
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-17
validated: 2026-05-18
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `48-RESEARCH.md` §Validation Architecture (lines 1329–1410).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (Node 20+) with esbuild tsx loader |
| **Config file** | `app/package.json` scripts `test`, `test:main`, `test:actions` |
| **Leaf quick run command** | `cd app && node --test tests/services/graph-edit-journal.test.mjs tests/services/reorg-prompt-journal-injection.test.mjs` |
| **Command-service quick run command** | `cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.<verb>.test.mjs` |
| **Phase 48 full command** | `cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.rename.test.mjs tests/services/graph-command-service.move.test.mjs tests/services/graph-command-service.delete.test.mjs tests/services/graph-command-service.merge.test.mjs tests/services/graph-command-service.detach.test.mjs tests/services/graph-command-service.prune.test.mjs tests/services/graph-command-service.undo.test.mjs tests/services/graph-command-service.integration.test.mjs tests/services/graph-command-service.reload-survival.test.mjs tests/services/graph-command-service.concurrency.test.mjs` |
| **Project full suite command** | `cd app && npm test` |
| **Mock loader for command-service tests** | `--import ./tests/services/_actions-mock-loader.mjs` |
| **Estimated runtime** | <1s for Phase 48 targeted suites; ~30–60s for project full suite |

---

## Sampling Rate

- **After every task commit:** Run the affected leaf or verb-specific file — <2s
- **After every plan wave:** Run all Phase 48 target files, plus `cd app && npm test` for regression awareness
- **Before `/gsd:verify-work`:** Phase 48 targeted suites must be green; project full suite deltas must be reconciled against `deferred-items.md`
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01 | 1 | GRAPH-04 | T-48-01 (journal tamper) | `isValidPreImage` rejects malformed `before`/`after` shapes | unit | `node --test tests/services/graph-edit-journal.test.mjs` | ✅ | ✅ green |
| 48-01 | 1 | GRAPH-04 | T-48-03 (quota) | `append` honors N=10 cap with FIFO eviction; QuotaExceededError caught | unit | `node --test tests/services/graph-edit-journal.test.mjs` | ✅ | ✅ green |
| 48-01 | 1 | GRAPH-04 | — | Reorg prompt includes `Manual corrections to preserve:` block when journal non-empty; byte-stable when journal unchanged | source-reading + behavioral | `node --test tests/services/reorg-prompt-journal-injection.test.mjs` | ✅ | ✅ green |
| 48-02 | 2 | GRAPH-02 | — | Rename: title patched; embedding strategy preserves retrieval identity on failure (Blocker #4 fix); 100-char cap; empty rejected; bypass `normalizeAnchorName` | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.rename.test.mjs` | ✅ | ✅ green |
| 48-02 | 2 | GRAPH-02 | — | Move: parentId/branchLabel/clusterLabel/clusterNodeId updated; qaCount recomputed on both old + new parent; nodeSummary updated | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.move.test.mjs` | ✅ | ✅ green |
| 48-02 | 2 | GRAPH-03 | — | Delete: full record snapshot in journal; cascade children re-parent to cluster; emit handled (single `GRAPH_UPDATED`) | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.delete.test.mjs` | ✅ | ✅ green |
| 48-02 | 2 | GRAPH-01 | — | Per-command invariant: ONE journal entry + ONE `GRAPH_UPDATED` (or one delegated emit) on success; ZERO on failure | unit | included in per-verb files | ✅ | ✅ green |
| 48-03 | 2 | GRAPH-03 | — | Merge: children reparent; loser hard-deleted; survivor `qaCount` + `embeddingVector` recomputed with graceful degradation; full loser snapshot in journal | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.merge.test.mjs` | ✅ | ✅ green |
| 48-03 | 2 | GRAPH-03 | — | Detach: placement fields cleared; `classifyAndAnchorIncremental` fires fire-and-forget; AbortSignal threaded; LOCALE_CHANGED cancels mid-flight (D-19) | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.detach.test.mjs` | ✅ | ✅ green |
| 48-03 | 2 | GRAPH-03 | — | Prune: delegates to `trellisActionsService.prune`; journal entry; emit; PrunedSection subscriber chain preserved | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.prune.test.mjs` | ✅ | ✅ green |
| 48-04 | 3 | GRAPH-03 + GRAPH-04 | T-48-01 (validate before applying) | Undo: validates newest entry; correctly inverts each cmd type via swapped-snapshots; append-only; empty journal returns NOT_FOUND | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.undo.test.mjs` | ✅ | ✅ green |
| 48-04 | 3 | GRAPH-01 | — | End-to-end integration: rename → move → merge composition, undo of merge, and event-kind assertions | integration | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.integration.test.mjs` | ✅ | ✅ green |
| 48-04 | 3 | GRAPH-01 (success criterion 3) | — | Reload survival: after a command commits and storage rehydrates, `questionService.getAll()` returns post-command state | integration | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.reload-survival.test.mjs` | ✅ | ✅ green |
| 48-04 | 3 | GRAPH-01 | — | Concurrency: per-process mutex behavior is covered for concurrent dedupe and sequential chaining | unit | `node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.concurrency.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All 12 Phase 48 test files exist and passed targeted audit on 2026-05-18.

- [x] `app/tests/services/graph-edit-journal.test.mjs` — GRAPH-04 (journal mechanics + tamper validation + quota)
- [x] `app/tests/services/reorg-prompt-journal-injection.test.mjs` — GRAPH-04 (reorg prompt)
- [x] `app/tests/services/graph-command-service.rename.test.mjs` — GRAPH-02 (rename + retrieval-identity preservation)
- [x] `app/tests/services/graph-command-service.move.test.mjs` — GRAPH-02 (move)
- [x] `app/tests/services/graph-command-service.merge.test.mjs` — GRAPH-03 (merge)
- [x] `app/tests/services/graph-command-service.detach.test.mjs` — GRAPH-03 (detach + LOCALE_CHANGED cancellation)
- [x] `app/tests/services/graph-command-service.prune.test.mjs` — GRAPH-03 (prune delegation)
- [x] `app/tests/services/graph-command-service.delete.test.mjs` — GRAPH-03 (delete)
- [x] `app/tests/services/graph-command-service.undo.test.mjs` — GRAPH-03 (undo) + GRAPH-04 (N=10 cap)
- [x] `app/tests/services/graph-command-service.integration.test.mjs` — GRAPH-01 (boundary end-to-end)
- [x] `app/tests/services/graph-command-service.reload-survival.test.mjs` — GRAPH-01 success criterion 3
- [x] `app/tests/services/graph-command-service.concurrency.test.mjs` — GRAPH-01 command-boundary mutex behavior
- [x] `app/package.json` — `test:actions` includes the graph-command-service files via `_actions-mock-loader.mjs` register hook

**Framework install:** None — already in place. `node --test` is built-in (Node 20+).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reorg prompt LLM compliance — does Claude/GPT actually respect the `Manual corrections to preserve:` block? | GRAPH-04 | Requires a live LLM call; cost + nondeterminism unsuited to unit tests | Phase 49 dogfooding: after building the UI, manually (a) rename an anchor, (b) trigger `reorganizeMindmap`, (c) confirm the renamed anchor's title survives. Log a /planning todo if the LLM ignores the constraint. |
| Cross-screen UX re-read — does GraphScreen's selected-node card update after a command? | success criterion 3 (in-flight) | Requires running the app | **Deferred to Phase 49** per Blocker #5 resolution — the SERVICE guarantees post-command state via `questionService.getAll()` re-read; UI subscription is a Phase 49 GRAPHUI-* concern. |

---

## Validation Sign-Off

- [x] All tasks have `<acceptance_criteria>` with automated verify references OR Wave 0 dependency on the corresponding test file
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all 12 Phase 48 test files
- [x] No watch-mode flags (`--watch`, `node --test --watch`, etc.)
- [x] Feedback latency <60s (full suite) / <2s (per-file)
- [x] `nyquist_compliant: true` set in frontmatter only after all checkboxes above are ticked

**Approval:** approved 2026-05-18 (Nyquist audit; no automated gaps found)

---

## Validation Audit 2026-05-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Automated map rows covered | 14 |
| Phase 48 test files verified | 12 |
| Manual-only verifications retained | 2 |

**Commands run:**

- `cd app && node --test tests/services/graph-edit-journal.test.mjs tests/services/reorg-prompt-journal-injection.test.mjs` — ✅ 29/29 pass
- `cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.rename.test.mjs tests/services/graph-command-service.move.test.mjs tests/services/graph-command-service.delete.test.mjs tests/services/graph-command-service.merge.test.mjs tests/services/graph-command-service.detach.test.mjs tests/services/graph-command-service.prune.test.mjs tests/services/graph-command-service.undo.test.mjs tests/services/graph-command-service.integration.test.mjs tests/services/graph-command-service.reload-survival.test.mjs tests/services/graph-command-service.concurrency.test.mjs` — ✅ 117/117 pass
- `cd app && npm test` — ❌ expected red: 981/983 `test:main` and 131/133 `test:actions`; 4 failures match `deferred-items.md`

**Residual risk:** `cd app && npm test` is known to include 4 unrelated pre-existing failures documented in `deferred-items.md`; none touch graph-command service, journal, or reorg prompt paths.
