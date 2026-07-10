---
phase: 21
slug: review-cap-fix-generate-on-enter-posts
status: audited
nyquist_compliant: true
wave_0_complete: true
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
| **Full suite command** | `cd app && node --test tests/services/review.service.test.mjs && node --test tests/services/post-essay.service.test.mjs` |
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
| 21-01-01 | 01 | 1 | REVIEW-01 | unit | `node --test tests/services/review.service.test.mjs` | ✅ | ✅ green |
| 21-01-02 | 01 | 1 | REVIEW-02 | unit | `node --test tests/services/review.service.test.mjs` | ✅ | ✅ green |
| 21-01-03 | 01 | 1 | REVIEW-05 | unit | `node --test tests/services/review.service.test.mjs` | ✅ | ✅ green |
| 21-02-01 | 02 | 1 | POST-01 | unit | `node --test tests/services/post-essay.service.test.mjs` | ✅ | ✅ green |
| 21-02-02 | 02 | 1 | POST-04 | unit | `node --test tests/services/post-essay.service.test.mjs` | ✅ | ✅ green |
| 21-02-03 | 02 | 2 | POST-02 | unit | `node --test tests/services/post-essay.service.test.mjs` | ✅ | ✅ green |
| 21-02-04 | 02 | 1 | POST-05 | unit | `node --test tests/services/post-essay.service.test.mjs` | ✅ | ✅ green |
| 21-02-05 | 02 | 1 | POST-06 | unit | `node --test tests/services/post-essay.service.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/tests/services/review.service.test.mjs` — REVIEW-01, REVIEW-02, REVIEW-05 (4 tests)
- [x] `app/tests/services/post-essay.service.test.mjs` — POST-01, POST-02, POST-04, POST-05, POST-06 (6 tests)

*All testable requirements covered. UI/streaming requirements verified via UAT (21-UAT.md).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI shell renders before streaming | POST-03 | Visual layout verification | Open post detail, verify heading/body/follow-up containers render before LLM content appears |
| No layout shift during streaming | POST-03 | Visual behavior | Open post, observe streaming — no jumps, no container resizing |
| Daily goal progress bar | REVIEW-03 | DESCOPED | Intentionally removed by user |
| Daily Goal setting label | REVIEW-04 | DESCOPED | Intentionally removed by user |
| Error state with retry | POST-08 | Requires LLM failure simulation | Disconnect network, open post, verify error + retry button |
| Text-art detail page vivid essay | POST-07 | Content quality check | Open text-art post, verify story/conversation tone |

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
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |

**Gaps resolved:**
- REVIEW-02 — structural test confirming getTodayReviewCount delegates without separate cap
- POST-02 — structural test confirming PostDetailScreen imports/uses generatePostEssay
- POST-05 — structural test confirming youtube.service defers summarizeTranscript
- POST-06 — structural test confirming news.service defers chatCompletion

**Noted:** REVIEW-03 and REVIEW-04 intentionally descoped by user (daily goal feature removed).
