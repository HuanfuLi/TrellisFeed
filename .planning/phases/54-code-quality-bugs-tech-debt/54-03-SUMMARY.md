---
phase: 54-code-quality-bugs-tech-debt
plan: 03
subsystem: planning-artifact
tags: [tech-debt, inventory, code-quality, planning]
requires:
  - 54-RESEARCH.md (§Tech Debt Inventory raw candidate list)
  - .planning/codebase/CONCERNS.md (D-03 candidates)
  - 45-DEAD-CODE-SWEEP.md (format analog + Phase 45 deferred symbols)
provides:
  - "Scored severity x reach tech-debt matrix (TECHDEBT-13, D-01/D-02 deliverable)"
  - "Top-tier FIX worklist consumed by Plan 54-04"
  - "Two DECISION-PENDING items routed to Plan 54-04 checkpoint:decision"
affects:
  - Plan 54-04 (resolution plan — its worklist is this inventory's FIX tier)
tech-stack:
  added: []
  patterns:
    - "severity (1-5) x reach (1-5) scoring matrix; Score = S x R; FIX>=12 / RE-ACCEPT 6-11 / NOTE-ONLY<=5"
    - "DECISION-PENDING disposition for operator-gated items (NOT pre-decided)"
key-files:
  created:
    - .planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md
  modified: []
decisions:
  - "A1 (hybrid SQLite/localStorage) scores exactly 12 but is RE-ACCEPTED — remediation is an architectural rewrite, not Phase 54 cleanup. The one deliberate FIX-boundary override, documented at the row."
  - "recordFeedView (B3/C6) and scheduler-log target (C1/C2) left DECISION-PENDING per RESEARCH OQ#1/OQ#2 — resolved by Plan 54-04 checkpoint:decision, not pre-decided."
  - "Trivial-cost unambiguous cleanups (usePlanner, ConnectionPostScreen, stale eslint-disable) flagged FIX despite low raw scores because cost-to-fix is near-zero."
metrics:
  duration: ~6m
  completed: 2026-05-20
  tasks: 1
  files: 1
---

# Phase 54 Plan 03: Tech-Debt Inventory Summary

Authored the TECHDEBT-13 deliverable — a scored severity × reach inventory of all accumulated v1.4–v1.6 tech debt, with a FIX / RE-ACCEPT / NOTE-ONLY / DECISION-PENDING disposition and written rationale per item, plus an unambiguous top-tier FIX worklist for Plan 54-04.

## What Was Built

A single planning artifact: `.planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md`.

- **Scoring rubric** (D-01, Claude's discretion): Severity 1–5 × Reach 1–5; tiers FIX ≥12 / RE-ACCEPT 6–11 / NOTE-ONLY ≤5, with DECISION-PENDING for operator-gated items.
- **25 scored items** across four groups:
  - **Group A** — CONCERNS.md / D-03 candidates (hybrid SQLite/localStorage, heavy mocking, CapacitorHttp streaming, theme-transition, SQLite serialization, localStorage quota, storage-key doc drift).
  - **Group B** — 13 Phase 45 deferred dead-code symbols (incl. `usePlanner`, `ConnectionPostScreen`, `recordFeedView`, `InlineInfoFlow`, and `hapticImpactMedium` flagged NOT-DEBT/live).
  - **Group C** — v1.6-introduced debt (scheduler `console.log` ×9, stale `eslint-disable`, 4.55 MB background image, 1.29 MB `index.js` chunk, incomplete trajectory analytics).
  - **Group D** — architecture/design debt (purgeExpired-on-mount, stateless dailyReadService, module-singleton queue, empty-swipe edge, plaintext API keys).
- **Tier summary + Top Tier (FIX) worklist** naming exactly the three items Plan 54-04 must resolve, plus two `checkpoint:decision` items carried forward.
- **Verification Log** recording the grep call-site counts that justify each FIX-delete vs re-accept call (confirmed live on 2026-05-20).

## Per-item dispositions

- **FIX (3):** B1 `usePlanner` delete · B2 `ConnectionPostScreen` delete · C3 stale `eslint-disable` removal.
- **DECISION-PENDING (2 distinct):** B3/C6 `recordFeedView` fate · C1/C2 scheduler-log conversion target. Both routed to Plan 54-04 `checkpoint:decision`; NOT pre-decided per plan instruction.
- **RE-ACCEPT (13):** each with a written rationale (architectural-rewrite scope, safety seams, compat exports, accepted local-first scope, etc.).
- **NOTE-ONLY (7):** acknowledged, no action, rationale documented.

## Verification

Plan automated check passed:

```
test -f 54-TECH-DEBT-INVENTORY.md && grep Severity && grep usePlanner
  && grep ConnectionPostScreen && grep recordFeedView && grep (console.log|scheduler)
  && grep SQLite && grep "localStorage quota" && grep DECISION-PENDING && grep "Top Tier"
=> INVENTORY_OK
```

All acceptance criteria met: scored table with Severity/Reach/Score/Decision columns; every RESEARCH.md candidate appears; every RE-ACCEPT has a rationale; Top Tier FIX worklist present; `recordFeedView` and the scheduler-log preference left DECISION-PENDING.

Call-site counts independently re-verified by grep before scoring (Verification Log section): `usePlanner`=1, `ConnectionPostScreen`=1 (0 in App.tsx), `recordFeedView`=1, scheduler.service `console.log`=7, scheduler.native `console.log`=2, stale `eslint-disable` present, `InlineInfoFlow`=21 (compat), `hapticImpactMedium`=4 (live), `trellis-bg-default.png`=4,554,991 bytes.

## Deviations from Plan

None — plan executed exactly as written. This plan writes a single planning markdown document; no code paths touched (consistent with the threat model: no trust boundary, accept disposition T-54-03).

## Self-Check: PASSED

- Created file exists: `.planning/phases/54-code-quality-bugs-tech-debt/54-TECH-DEBT-INVENTORY.md` — FOUND
- Task commit exists: `5e540f96` — recorded
