---
phase: 3
slug: graph-memory-recommendation-engine
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` across `app/`, `tools/content_pipeline/`, and `research-backend/` |
| **Config file** | none — package scripts invoke executable `*.test.mjs` suites |
| **Quick run command** | `node --test tests/services/<touched-suite>.test.mjs` (from `app/`) |
| **Full suite command** | `cd app && npm test && npm run lint && npm run build` plus `npm test && npm run build` from `tools/content_pipeline/` and `npm test` from `research-backend/` |
| **Estimated runtime** | ~60 seconds for all three packages; ~18 seconds for the app suite alone |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/services/<touched-suite>.test.mjs`
- **After every plan wave:** Run `npm test` (from `app/`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | GRAPH-01 | T-03-02 | No fabricated IDs from label resolution | pipeline unit | `cd tools/content_pipeline && npm test -- --test-name-pattern="graph"` | ✅ yes | ✅ green |
| 03-01-T2 | 03-01 | 1 | GRAPH-01 | T-03-01 | Hash-bound typed artifacts; endpoint-kind validation | pipeline integration | `cd tools/content_pipeline && npm test && npm run build` | ✅ yes | ✅ green |
| 03-02-T1 | 03-02 | 2 | GRAPH-01 | — | Single GRAPH_UPDATED event extended, no parallel event | typecheck | `cd app && npx tsc -b --noEmit` | ✅ existing gate | ✅ green |
| 03-02-T2 | 03-02 | 2 | GRAPH-01 | T-03-04 | Import-boundary referential validation (POOL_INVALID) | repository integration | `cd app && node --test tests/services/content-pool.repository.test.mjs` | ✅ yes | ✅ green |
| 03-02-T3 | 03-02 | 2 | GRAPH-01 | T-03-04 | dbQuery-durable type-indexed graph queries | repository integration | `cd app && node --test tests/services/global-graph.repository.test.mjs` | ✅ yes | ✅ green |
| 03-03-T1 | 03-03 | 3 | GRAPH-02 | T-03-07 | Idempotent ledger; no double-apply after crash/retry | repository integration | `cd app && node --test tests/services/graph-memory.service.test.mjs` | ✅ yes | ✅ green |
| 03-03-T2 | 03-03 | 3 | GRAPH-02 | T-03-09 | Log-canonical replay/repair convergence; logging isolation | service integration | `cd app && node --test tests/services/graph-memory.service.test.mjs tests/services/interaction-log.service.test.mjs` | ✅ yes | ✅ green |
| 03-04-T1 | 03-04 | 3 | RANK-01 | T-03-10 | Narrow non-personal ControlRankerInput; exact §11.7 | unit | `cd app && node --test tests/services/ranking-components.test.mjs --test-name-pattern="control"` | ✅ yes | ✅ green |
| 03-04-T2 | 03-04 | 3 | RANK-02, RANK-03, RANK-06 | T-03-11 | §12.3 tests 1–4; fingerprint-gated cosine | unit | `cd app && node --test tests/services/ranking-components.test.mjs` | ✅ yes | ✅ green |
| 03-04-T3 | 03-04 | 3 | RANK-04 | — | Cross-batch caps; smaller-batch over violation | unit | `cd app && node --test tests/services/diversity-reranker.test.mjs` | ✅ yes | ✅ green |
| 03-05-T1 | 03-05 | 4 | GRAPH-03 | T-03-13, T-03-14 | Bracketing + frozen-ID allowlist; no anchor creation | service integration | `cd app && node --test tests/services/question-extraction.service.test.mjs` | ✅ yes | ✅ green |
| 03-05-T2 | 03-05 | 4 | GRAPH-03 | T-03-15 | Answer UX isolation; restart-durable jobs; parity intact | service integration | `cd app && node --test tests/services/question-extraction.service.test.mjs tests/services/post-qa.condition-parity.test.mjs` | ✅ yes | ✅ green |
| 03-05-T3 | 03-05 | 4 | RQ-02 | T-03-16 | Closed field-allowlist wire/backend extension | integration | `cd app && node --test tests/services/interaction-log.service.test.mjs && cd ../research-backend && npm test` | ✅ yes | ✅ green |
| 03-06-T1 | 03-06 | 4 | RANK-05 | T-03-20 | Field-exact §9.9 rows; ledger separation | repository integration | `cd app && node --test tests/services/recommendation.service.test.mjs --test-name-pattern="repository"` | ✅ yes | ✅ green |
| 03-06-T2 | 03-06 | 4 | RANK-01, RANK-06 | T-03-17 | §12.3 #5 throwing-spy control isolation, byte-equal outputs | DB integration | `cd app && node --test tests/services/recommendation.service.test.mjs --test-name-pattern="control\|session\|batch"` | ✅ yes | ✅ green |
| 03-06-T3 | 03-06 | 4 | RANK-05, RANK-06 | T-03-18, T-03-19 | §12.3 #6 trace IDs via dbQuery; zero control-path LLM calls | DB integration | `cd app && node --test tests/services/recommendation.service.test.mjs` | ✅ yes | ✅ green |
| 03-07-T1 | 03-07 | 5 | RANK-05 | T-03-23 | Per-recommendation deduped impressions; no served reshuffle | screen test | `cd app && node --test tests/screens/HomeScreen.recommendation-feed.test.mjs` | ✅ yes | ✅ green |
| 03-07-T2 | 03-07 | 5 | RANK-05 | T-03-21 | Plain-text reason render; 4-locale parity | screen + locale | `cd app && node --test tests/screens/HomeScreen.recommendation-feed.test.mjs tests/locales/bundle-parity.test.mjs` | ✅ yes | ✅ green |
| 03-08-T1 | 03-08 | 6 | RANK-06 | — | Guarded per-module caller grep before deletion | typecheck + rg | `cd app && npx tsc -b --noEmit` | ✅ existing gate | ✅ green |
| 03-08-T2 | 03-08 | 6 | RANK-06 | T-03-25 | No source-reading test pins removed shell | full suite | `cd app && npm test` | ✅ yes | ✅ green |
| 03-08-T3 | 03-08 | 6 | RANK-06 | T-03-24 | v6→v7 upgrade retains survivor stores | full gates | `cd app && npm test && npm run lint && npm run build` | ✅ yes | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] §12.3 algorithm-verification suites (RANK-06): question relevance, contrast, redundancy, aged echo, control isolation, experimental reason trace IDs — executable `node --test` suites under `app/tests/`
- [x] Durability assertions go through the `dbQuery` seam, not in-memory mirrors (CLAUDE.md false-green warning)

*Existing `node --test` infrastructure covers execution; the six §12.3 suites are new files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Feed renders Recommendation records + reasons in-app | RANK-05 | Node suite cannot exercise WebView rendering; persistence/platform changes need in-browser UAT per CLAUDE.md | Load feed in browser/device, confirm reasons render per condition (experimental: trace-backed prose; control: fixed labels) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or completed Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all formerly MISSING references
- [x] No watch-mode flags
- [x] Feedback latency ≤ 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-18

---

## Validation Audit 2026-07-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

### Executable Evidence

| Gate | Result |
|------|--------|
| Phase-focused app suites | 109 passed, 0 failed |
| Full app suite | 588 passed, 0 failed |
| App lint | 0 errors, 7 pre-existing warnings |
| App production build | green |
| Content-pipeline suite | 82 passed, 0 failed |
| Content-pipeline TypeScript build | green |
| Research-backend suite | 30 passed, 0 failed |

All ten phase requirements have automated live-path verification. The WebView feed-render check remains a supplemental platform UAT item and does not represent an automated coverage gap.
