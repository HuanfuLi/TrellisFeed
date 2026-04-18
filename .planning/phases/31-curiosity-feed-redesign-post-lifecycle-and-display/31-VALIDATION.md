---
phase: 31
slug: curiosity-feed-redesign-post-lifecycle-and-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
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
| TBD | TBD | TBD | D-10 queue | unit | `node --test tests/services/post-queue.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-33 retention | unit | `node --test tests/services/post-history.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-17 style ratios | unit | `node --test tests/services/style-assignment.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-21 i18n | parity | `node --test tests/locales/bundle-parity.test.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/post-queue.test.mjs` — FIFO buffer push/pop, auto-refill threshold, daily reset
- [ ] `tests/services/post-history.test.mjs` — rolling window purge, "keep all" mode, day grouping
- [ ] `tests/services/style-assignment.test.mjs` — weighted ratio constraints, fallback to text-art

*Existing `bundle-parity.test.mjs` covers i18n key parity.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vine grows visually on explore | D-01, D-06 | CSS/SVG animation | Open Home, explore a concept post, return to Home, verify vine extends |
| Compact header slide-in | D-02 | Scroll interaction | Scroll past inline vine, verify compact header appears with vine |
| Tap-to-expand checklist | D-03 | Touch interaction | Tap vine → checklist expands, tap outside → collapses |
| Landscape video inline play | D-28 | iframe/media | Tap play on landscape video in feed, verify plays inline |
| Video stops on swipe | D-29 | Gesture interaction | Play video inline, swipe to another screen, verify video stops |
| Scroll-to-top FAB appears | D-40 | Scroll threshold | Scroll down 400px+, verify FAB appears at bottom-right |
| Feedback opens email | D-41 | mailto: link | Trigger empty queue state, tap "Posts not interesting?", verify email client opens |
| Warm start next day | D-30 | Date-dependent | Change device date, reopen app, verify yesterday's queue posts appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
