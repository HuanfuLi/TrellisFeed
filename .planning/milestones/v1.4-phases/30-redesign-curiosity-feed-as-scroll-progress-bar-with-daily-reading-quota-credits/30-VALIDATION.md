---
phase: 30
slug: redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-17
validated: 2026-04-25
re_audited: 2026-04-25
---

# Phase 30 — Validation Strategy (v2)

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | `app/package.json` scripts section |
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
| TBD | TBD | TBD | D-01/D-02/D-19 | unit | `cd app && node --test tests/services/daily-read.service.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-21/D-22 | unit | `cd app && node --test tests/locales/bundle-parity.test.mjs` | ✅ | ⬜ pending |
| TBD | TBD | TBD | D-07-D-11 | manual | Browser: card-to-bar transition on scroll | N/A | ⬜ pending |
| TBD | TBD | TBD | D-04/D-05 | manual | Browser: open post, scroll 70% or wait 30s, verify concept explored | N/A | ⬜ pending |
| TBD | TBD | TBD | D-14/D-15 | manual | Browser: complete all concepts, verify celebration | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/services/daily-read.service.test.mjs` — stubs for concept tracking + daily reset + credit idempotency

*Existing test infrastructure covers locale bundle parity.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card-to-bar CSS sticky transition | D-07-D-11 | Visual animation, scroll-driven | Scroll HomeScreen, confirm card sticks + compresses |
| PostDetailScreen scroll 70% detection | D-04 | Requires scrolling in-browser | Open concept post, scroll past 70%, verify progress updates |
| PostDetailScreen 30s dwell detection | D-04 | Timer-based, needs real time | Open concept post, wait 30s, verify progress updates |
| Follow-up question detection | D-04 | Requires chat interaction | Open concept post, ask follow-up, verify progress updates |
| Confetti + gold bar celebration | D-14/D-15 | Visual animation rendering | Complete all concepts, verify celebration fires once |
| Hidden card when no concept posts | D-17/D-18 | Conditional rendering | Clear post cache, reload, verify no progress card |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
