---
phase: 23
slug: incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` via `tsx` loader |
| **Config file** | none |
| **Quick run command** | `cd app && npx tsx --test tests/*.test.mjs` |
| **Full suite command** | `cd app && npx tsx --test tests/*.test.mjs` |
| **Estimated runtime** | ~5 seconds |

Note: Tests must be run via `npx tsx --test` because test files import directly from `.ts` source. `npm test` (which uses plain `node --test`) fails on imports of TypeScript modules — separate concern, not fixed here.

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-T1 | 01 | 1 | PIPE-01..07 | unit | `cd app && npx tsx --test tests/canonical-knowledge-pipeline.test.mjs` | app/tests/canonical-knowledge-pipeline.test.mjs | green |
| 23-01-T2 | 01 | 1 | PIPE-01..07 | unit | `cd app && npx tsx --test tests/canonical-knowledge-pipeline.test.mjs` | app/tests/canonical-knowledge-pipeline.test.mjs | green |
| 23-02-T1 | 02 | 1 | RATE-01..06 | unit | `cd app && npx tsx --test tests/ask-rate-limiter.test.mjs` | app/tests/ask-rate-limiter.test.mjs | green |
| 23-02-T2 | 02 | 1 | RATE-04 | tsc | `cd app && npx tsc --noEmit` | — | green |
| 23-03-T1 | 03 | 2 | PIPE-01,07,RATE-01,02 | tsc | `cd app && npx tsc --noEmit` | — | green |
| 23-03-T2 | 03 | 2 | RATE-04..06 | tsc | `cd app && npx tsc --noEmit` | — | green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/tests/canonical-knowledge-pipeline.test.mjs` — 15 tests, all passing (confirmed in 23-VERIFICATION.md)
- [x] `app/tests/ask-rate-limiter.test.mjs` — 8 tests, all passing (confirmed in 23-VERIFICATION.md)

*Existing infrastructure covers test runner. New test files needed for new services.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KV cache reuse across pipeline steps | D-05 | Requires observing actual API cache behavior | Ask a question, check token usage in console — step 2/3 should show fewer prompt tokens than step 1 |
| Inline banner appearance at 80%+ | D-15 | Visual/UX check | Set limit to 10, ask 8 questions, verify banner appears |
| Send button disabled at limit | D-16 | Visual/UX check | Set limit to 5, ask 5 questions, verify send button grayed out |
| Settings "Usage" section layout | D-14 | Visual layout check | Open Settings, verify Token Usage renamed to Usage with rate limit field |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-04-10)

---

## Validation Audit 2026-04-14

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Findings:**
- Documented `node --test` command failed for `canonical-knowledge-pipeline.test.mjs` (imports `.ts` source) — fixed to `npx tsx --test`.
- Wave 0 paths referenced non-existent `tests/services/` subdir — corrected to `app/tests/`.
- Re-verified: 23 tests pass (15 pipeline + 8 rate-limiter), `tsc --noEmit` clean.
