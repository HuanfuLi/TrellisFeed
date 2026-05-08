---
phase: 31
slug: curiosity-feed-redesign-post-lifecycle-and-display
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
validated: 2026-04-18
re_audited: 2026-04-18
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | `app/package.json` (test script) |
| **Quick run command** | `cd app && node --test tests/locales/bundle-parity.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd app && node --test tests/locales/bundle-parity.test.mjs`
- **After every plan wave:** Run `cd app && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1.1 | 31-01 | 0 | D-10 queue | unit | `node --test tests/services/post-queue.test.mjs` | ✅ | ✅ green |
| 1.2 | 31-01 | 0 | D-33 retention | unit | `node --test tests/services/post-history.test.mjs` | ✅ | ✅ green |
| 3.1 | 31-03 | 2 | D-17 style ratios | unit | `node --test tests/services/style-assignment.test.mjs` | ✅ | ✅ green |
| — | — | — | D-12 SM-2 quota | unit | `node --test tests/concept-quota.test.mjs` | ✅ | ✅ green |
| — | — | — | D-46 daily read | unit | `node --test tests/services/daily-read.service.test.mjs` | ✅ | ✅ green |
| — | — | — | i18n parity | parity | `node --test tests/locales/bundle-parity.test.mjs` | ✅ | ✅ green |
| — | — | — | D-13 concept batch filter | unit | `node --test tests/services/concept-batch-filter.test.mjs` | ✅ | ✅ green |
| — | — | — | D-38 daily gen cap | unit | `node --test tests/services/daily-generation-cap.test.mjs` | ✅ | ✅ green |
| — | — | — | D-43 starter posts | unit | `node --test tests/services/starter-posts.test.mjs` | ✅ | ✅ green |
| — | — | — | D-30 yesterday queue peek | unit | `node --test tests/services/post-queue.test.mjs` | ✅ | ✅ green |
| — | — | — | D-39 bonus post cap | unit | `node --test tests/services/bonus-post-cap.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/services/post-queue.test.mjs` — FIFO buffer push/pop, auto-refill threshold, daily reset (8/8 pass)
- [x] `tests/services/post-history.test.mjs` — rolling window purge, "keep all" mode, day grouping (6/6 pass)
- [x] `tests/services/style-assignment.test.mjs` — weighted ratio constraints, fallback to text-art (7/7 pass)
- [x] `tests/concept-quota.test.mjs` — SM-2 anchor-driven quota, video/news count as concept posts (8/8 pass)
- [x] `tests/services/daily-read.service.test.mjs` — exploration tracking, daily reset (7/7 pass)
- [x] `tests/services/concept-batch-filter.test.mjs` — D-13 pending/explored exclusion, importance doubling (8/8 pass)
- [x] `tests/services/daily-generation-cap.test.mjs` — D-38 cap formula, accumulation, reset (11/11 pass)
- [x] `tests/services/starter-posts.test.mjs` — D-43 structure, sourceType, presentationStyle (9/9 pass)
- [x] `tests/services/post-queue.test.mjs` — D-30 getYesterdayQueue empty/same-day/stale/malformed paths (5/5 pass, added 2026-04-18)
- [x] `tests/services/bonus-post-cap.test.mjs` — D-39 bonus cap boundary, all-explored gate, default=8 (9/9 pass, added 2026-04-18)

*Existing `bundle-parity.test.mjs` covers i18n key parity (2/2 pass).*

**Total automated tests: 80 across 10 test files. All green.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vine grows visually on explore | D-01, D-06 | CSS/SVG animation | Open Home, explore a concept post, return to Home, verify vine extends |
| Compact header slide-in | D-02 | Scroll interaction | Scroll past inline vine, verify compact header appears with vine |
| Tap-to-expand checklist | D-03 | Touch interaction | Tap vine → checklist expands, tap outside → collapses |
| Concept tap scrolls to post | D-04 | DOM scroll | Expand checklist, tap concept name, verify feed scrolls to matching post |
| Landscape video inline play | D-28 | iframe/media | Tap play on landscape video in feed, verify plays inline |
| Video stops on swipe | D-29 | Gesture interaction | Play video inline, swipe to another screen, verify video stops |
| Scroll-to-top FAB appears | D-40 | Scroll threshold | Scroll down 400px+, verify FAB appears at bottom-right |
| Feedback opens email | D-41 | mailto: link | Trigger empty queue state, tap "Posts not interesting?", verify email client opens |
| Warm start next day | D-30 | Date-dependent | Change device date, reopen app, verify yesterday's queue posts appear |
| Suggestion card tap → Ask | D-25 | Navigation | Tap topic on suggestion card, verify navigates to Ask with topic pre-filled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-04-18

---

## Validation Audit 2026-04-18

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

Tests added: `concept-batch-filter.test.mjs` (D-13), `daily-generation-cap.test.mjs` (D-38), `starter-posts.test.mjs` (D-43). Updated `concept-quota.test.mjs` to reflect SM-2-driven quota (D-12) replacing post-derived quota.

## Validation Audit 2026-04-18 (re-audit)

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

Second pass surfaced two service-level logic paths not yet covered: D-30 `postQueueService.getYesterdayQueue()` (4 branches — empty, same-day, stale-date, malformed JSON) and D-39 bonus-post cap when all anchors explored (cap formula `totalServed >= totalGenerated + bonusCap`). Tests added: 5 cases appended to `post-queue.test.mjs`, new file `bonus-post-cap.test.mjs` (9 cases) using the inline-algorithm pattern from `concept-feed-strategy.test.mjs` to avoid DOM/Capacitor deps. Phase 31 total: 80 automated tests across 10 files, all green.
