---
phase: 25
slug: anime-knowledge-tree-for-planner-page-motivational-review-visualization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated during planning by the planner agent from the Validation Architecture section of 25-RESEARCH.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (TBD — Wave 0 must verify `app/package.json`) |
| **Config file** | `app/vitest.config.ts` (TBD — Wave 0 installs if missing) |
| **Quick run command** | `npm --prefix app test -- --run <pattern>` |
| **Full suite command** | `npm --prefix app test -- --run` |
| **Estimated runtime** | ~30s (target) |

---

## Sampling Rate

- **After every task commit:** Run relevant unit test file with `--run <pattern>`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Planner populates this table during `/gsd:plan-phase 25`. Each row maps a plan task → automated command (or Wave 0 reference).*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PHASE-25 | unit/integration | TBD | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Planner must define Wave 0 tasks covering:

- [ ] **Verify/install Vitest** — check `app/package.json` for `vitest`; if missing, add and create `app/vitest.config.ts`
- [ ] **Event type additions** — add `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, `ANCHOR_DELETED` to `app/src/types/index.ts` `AppEvent` union (resolves research gap #1)
- [ ] **Blossom-date storage** — add `trellis_blossom_dates` localStorage key + service accessor (resolves research gap #2)
- [ ] **Asset directory + placeholder files** — create `app/src/assets/planner-trellis/` with placeholder `.gitkeep` + stub exports so Vite builds succeed before real AI assets arrive (resolves research gap #3)
- [ ] **Test stubs** — create initial test files for: seeded PRNG (`mulberry32`), vine layout algorithm, state aggregation (worst-child-wins rule), blossom-date gating

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ghibli visual aesthetic match | D-04 | Subjective visual judgment | Review mockups 1-3 + side-by-side variant comparison on device |
| Gentle drift fall animation feel | D-39 | Subjective animation tuning | Trigger overdue threshold on test anchor, observe 3-4s fall; adjust spring values if "off" |
| Variant V video on real device | D-54 | Performance/battery | Run app on iOS Capacitor build, leave Planner tab for 10 min with Variant V active, verify no decode drain when tab hidden |
| Tooltip positioning at canvas edges | UI-SPEC §Tooltip | Visual edge cases | Create test anchor near each canvas corner, verify tooltip never overflows viewport |
| Empty state copy clarity | D-50/51/52 | UX judgment | Fresh user with 0 anchors, observe CTA discoverability |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Vitest, event types, blossom storage, asset stubs)
- [ ] No watch-mode flags (all test commands use `--run`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates per-task map

**Approval:** pending
