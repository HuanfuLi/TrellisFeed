---
phase: 23
slug: incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none (invoked via `npm test`) |
| **Quick run command** | `npm test` (from `app/`) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

Note: The test runner currently has a pre-existing module resolution error. New tests should use `.test.mjs` pattern.

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
| 23-01-01 | 01 | 1 | — | unit | `npm test` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | — | unit | `npm test` | ❌ W0 | ⬜ pending |
| 23-02-01 | 02 | 2 | — | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/canonical-knowledge-pipeline.test.mjs` — stubs for pipeline parsing, short-circuit, retry, fallback
- [ ] `tests/services/ask-rate-limiter.test.mjs` — stubs for rate limit status, reset, increment, unlimited mode

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
