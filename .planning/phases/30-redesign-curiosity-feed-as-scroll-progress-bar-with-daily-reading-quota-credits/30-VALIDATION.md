---
phase: 30
slug: redesign-curiosity-feed-as-scroll-progress-bar-with-daily-reading-quota-credits
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 30 — Validation Strategy

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
| 30-01-01 | 01 | 1 | D-07/D-08 | unit | `cd app && node --test tests/services/daily-read.service.test.mjs` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | D-15/D-16 | unit | `cd app && node --test tests/locales/bundle-parity.test.mjs` | ✅ | ⬜ pending |
| 30-02-01 | 02 | 1 | D-01/D-02 | manual | Browser: sticky header visible on scroll | N/A | ⬜ pending |
| 30-02-02 | 02 | 1 | D-09/D-10 | manual | Browser: bar fills, color shift + confetti on completion | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/tests/services/daily-read.service.test.mjs` — stubs for reading detection + localStorage persistence
- [ ] Verify `bundle-parity.test.mjs` passes with new `home.feed.*` keys across 4 locales

*Existing test infrastructure covers locale bundle parity.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky progress bar visible while scrolling | D-02/D-03 | Visual layout verification | Scroll HomeScreen, confirm bar stays fixed at top |
| Confetti + color shift on quota completion | D-10 | Animation rendering | Read all posts, verify celebration fires once |
| Bento card shows concept topics | D-12 | Visual content verification | Check bento grid has "Today's Feed" card with concept names |
| Hidden bar when no posts (0/0 guard) | D-13/D-14 | Conditional rendering | Clear post cache, reload, verify no progress bar and no "0 of 0" text. D-14 has no automated test — coverage is manual-only because the guard is a JSX conditional (`dailyPosts.length > 0`) best verified visually in-browser. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
