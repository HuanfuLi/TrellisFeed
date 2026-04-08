---
phase: 22
slug: swipe-navigation-between-first-level-screens
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-07
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — run via `node --test tests/**/*.test.mjs` |
| **Quick run command** | `cd /Users/Code/EchoLearn && node --test tests/components/swipe-tab-logic.test.mjs` |
| **Full suite command** | `cd /Users/Code/EchoLearn && node --test tests/**/*.test.mjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `node --test tests/components/swipe-tab-logic.test.mjs`
- **After every plan wave:** `node --test tests/**/*.test.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-T1 | 22-01 | 1 | SWIPE-01, SWIPE-02, SWIPE-03, SWIPE-04, SWIPE-05 | unit (TDD) | `cd /Users/Code/EchoLearn && node --test tests/components/swipe-tab-logic.test.mjs` | tests/components/swipe-tab-logic.test.mjs | ⬜ pending |
| 22-01-T2 | 22-01 | 1 | SWIPE-01, SWIPE-02, SWIPE-03, SWIPE-04, SWIPE-05 | typecheck | `cd /Users/Code/EchoLearn/app && npx tsc --noEmit src/components/SwipeTabContainer.tsx src/lib/swipe-tab-context.ts 2>&1 \| head -20` | app/src/components/SwipeTabContainer.tsx | ⬜ pending |
| 22-02-T1 | 22-02 | 2 | SWIPE-06, SWIPE-07 | typecheck | `cd /Users/Code/EchoLearn/app && npx tsc --noEmit 2>&1 \| head -30` | app/src/App.tsx | ⬜ pending |
| 22-02-T2 | 22-02 | 2 | SWIPE-08, SWIPE-09, SWIPE-10 | typecheck | `cd /Users/Code/EchoLearn/app && npx tsc --noEmit 2>&1 \| head -30` | app/src/components/BottomNavigation.tsx | ⬜ pending |
| 22-02-T3 | 22-02 | 2 | SWIPE-06 through SWIPE-10 | manual | `cd /Users/Code/EchoLearn/app && npx tsc --noEmit 2>&1 \| head -5` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing test infrastructure covers phase requirements — no new framework installs needed
- [x] `tests/components/swipe-tab-logic.test.mjs` created as part of 22-01-T1 (TDD task — test file is created first, before implementation)

Wave 0 is satisfied by Plan 22-01, Task 1 which is a `tdd="true"` task: the test file `tests/components/swipe-tab-logic.test.mjs` is written before the implementation in `app/src/lib/swipe-tab-logic.ts`. No separate Wave 0 setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swipe gesture feel (rubber-band, live peek) | D-06, D-13 | Visual/haptic UX quality | Swipe left/right on each screen, verify smooth animation and adjacent screen peek |
| Axis lock conflict with vertical scroll | D-07 | Gesture interaction quality | Scroll vertically on Home feed, then try diagonal swipe — verify axis locks correctly |
| Real-time bottom nav tracking | D-03 | Visual animation synchronization | Slowly drag horizontally, verify nav highlight follows finger position proportionally |
| MindElixir gesture conflict | D-10 | Canvas drag interaction | Pan the knowledge graph, verify nav swipe doesn't interfere |
| Keyboard-open swipe suppression | D-09 | Keyboard state interaction | Focus Ask input, try swiping — verify swipe is blocked |
| Non-adjacent tab slide | D-05 | Animation visual quality | Tap Home from Settings — verify direct slide without intermediate screens |
| Graph screen 0-width bug | D-12, Pitfall 4 | Layout/rendering | Navigate to Graph for first time via swipe — verify mind-elixir renders at full width |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
