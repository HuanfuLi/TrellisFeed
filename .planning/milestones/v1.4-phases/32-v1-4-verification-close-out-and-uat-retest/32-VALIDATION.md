---
phase: 32
slug: v1-4-verification-close-out-and-uat-retest
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
absorbed: true
absorbed_by: Phase 34
note: "Phase 32 never executed. UAT retest intent absorbed by Phase 32.1 (5/5 truths verified). VERIFICATION write-up intent absorbed by Phase 34 (plans 34-03 / 34-04 / 34-05). See 32-CLOSURE.md for Intent Map and Decision Disposition."
---

> **Status note (2026-04-25 / Phase 34 close-out):** This phase was planned but never executed. See `32-CLOSURE.md` in this directory for absorption details. The validation strategy below is preserved as a planning artifact but does not represent executed work.

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (Phase 27 pattern) |
| **Config file** | `app/package.json` scripts section |
| **Quick run command** | `cd app && node --test tests/locales/bundle-parity.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~15 seconds (most of Phase 32 is docs — no new test files; only the dropdown fix may add a style-assertion test) |

---

## Sampling Rate

- **After every task commit:** Run quick command — locale parity must stay green (prevents i18n regressions if the dropdown fix touches locale bundles)
- **After every plan wave:** Full suite
- **Before `/gsd:verify-work`:** Full suite must be green (same tolerance as v1.3: pre-existing Node-25 trellis failures carry over)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | D-04/D-05 (retest) | manual + grep | `grep -c '^retest:' .planning/phases/31-*/31-UAT.md` (expect 8) | ✅ | ⬜ pending |
| 32-01-02 | 01 | 1 | D-07/D-08/D-09 (dropdown) | manual + grep | Device repro screenshot + `grep -n 'transform\|isolation' app/src/App.tsx` after patch | ✅ | ⬜ pending |
| 32-02-01 | 02 | 2 | D-01/D-03 | grep | `test -f .planning/phases/30-*/30-VERIFICATION.md && grep -c '^| D-' <file>` (expect 22) | ❌ W0 → created | ⬜ pending |
| 32-02-02 | 02 | 2 | D-02/D-03 | grep | `test -f .planning/phases/31-*/31-VERIFICATION.md && grep -c '^| D-' <file>` (expect 47) | ❌ W0 → created | ⬜ pending |
| 32-03-01 | 03 | 3 | D-10 | grep | `grep -c '^status: validated' .planning/phases/28-*/28-VALIDATION.md .planning/phases/29-*/29-VALIDATION.md` (expect 2) | ✅ | ⬜ pending |
| 32-03-02 | 03 | 3 | D-11 | grep | `grep -c '^status: validated' .planning/phases/30-*/30-VALIDATION.md` (expect 1, gated on 32-02-01 passing) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test infrastructure required — the bundle-parity, concept-quota, starter-posts, daily-generation-cap, and concept-batch-filter suites already cover the regression surface
- [ ] If 32-01-02 dropdown fix adds a style assertion, a new `tests/components/SelectInput.positioning.test.mjs` may be created; otherwise skip

*Primary output of Phase 32 is DOCUMENTATION (VERIFICATION.md files, UAT retest rows, VALIDATION flips) plus one tiny CSS patch. Wave 0 is effectively a no-op.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase 31 UAT test 5 (video stops on swipe-away) | D-04 retest | Requires device + 2 videos + swipe gesture | Open /home, start landscape video, swipe to /planner, swipe back → video is stopped; repeat for portrait short. Record in retest row. |
| Phase 31 UAT test 7 (queue cycles through all concepts) | D-04 retest | Requires exploring all concepts in a day | Open each concept post in sequence, verify vine fills + celebration fires + +1 credit toast. Record in retest row. |
| UAT-31-11 (dropdown anchor) | D-07/D-08 | Native `<select>` popover positioning is iOS/Capacitor-specific | Open Settings > Data & Privacy on device, tap Post Retention dropdown, confirm popover anchors directly below the row (not off-screen). Screenshot before/after fix. |
| Phase 28 6 human-UAT items | D-06 opportunistic | Capacitor haptic bridge, Framer Motion spring animations, scroll events — none testable in Node | Run through 28-VERIFICATION.md "Human Verification Required" section if device is present. Skip otherwise. |

---

## Validation Sign-Off

- [ ] All tasks have grep-verifiable or manual-UAT acceptance criteria
- [ ] Sampling continuity: UAT retest row count (`grep -c '^retest:'`) samples after each of the 8 test retests
- [ ] Wave 0 no-op confirmed — no new test infrastructure needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s for automated checks
- [ ] `nyquist_compliant: true` set in frontmatter after all tasks green

**Approval:** pending
