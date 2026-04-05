---
phase: 21
slug: review-cap-fix-generate-on-enter-posts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `cd app && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd app && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd app && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | REVIEW-01 | unit | `cd app && npx vitest run src/services/review.service.test.mjs` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | REVIEW-05 | unit | `cd app && npx vitest run src/services/settings.service.test.mjs` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | POST-01 | unit | `cd app && npx vitest run src/services/concept-feed.service.test.mjs` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | POST-04 | unit | `cd app && npx vitest run src/services/essay-cache.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/services/review.service.test.mjs` — stubs for REVIEW-01, REVIEW-02
- [ ] `app/src/services/concept-feed.service.test.mjs` — stubs for POST-01 (card-face-only generation)

*Existing infrastructure covers remaining requirements (UI/streaming verified manually).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI shell renders before streaming | POST-03 | Visual layout verification | Open post detail, verify heading/body/follow-up containers render before LLM content appears |
| No layout shift during streaming | POST-03 | Visual behavior | Open post, observe streaming — no jumps, no container resizing |
| Daily goal progress bar | REVIEW-03 | UI component rendering | Review 3 cards, verify progress bar shows "3/50 reviewed today" |
| Error state with retry | POST-08 | Requires LLM failure simulation | Disconnect network, open post, verify error + retry button |
| Text-art detail page vivid essay | POST-07 | Content quality check | Open text-art post, verify story/conversation tone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
