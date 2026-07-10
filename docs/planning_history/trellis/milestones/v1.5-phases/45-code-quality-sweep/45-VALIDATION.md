---
phase: 45
slug: code-quality-sweep
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` on Node 25.9.0 |
| **Config file** | none; scripts in `app/package.json` |
| **Quick run command** | `cd app && npx tsc -b --noEmit --pretty false && npm run lint` |
| **Full suite command** | `cd app && npm run build && npm run test:main && npm run test:actions` |
| **Estimated runtime** | ~60-180 seconds depending on `test:main` failures and build cache |

---

## Sampling Rate

- **After every task commit:** Run the targeted test or command for the touched area plus `cd app && npx tsc -b --noEmit --pretty false`.
- **After every plan wave:** Run `cd app && npm run lint && npm run test:actions`, plus relevant `test:main` subsets.
- **Before `$gsd-verify-work`:** Run `cd app && npm run build && npm run lint && npm run test:main && npm run test:actions`.
- **Max feedback latency:** 180 seconds for automated checks, excluding manual Android profiling.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 45-W0-01 | 45-01-audit-inventory-PLAN.md | 0 | TECHDEBT-07 | compiler + lint | `cd app && npx tsc -b --noEmit --pretty false && npm run lint -- --report-unused-disable-directives` | Yes | green |
| 45-W0-02 | 45-01-audit-inventory-PLAN.md | 0 | TECHDEBT-11 | source inventory | `rg -n "TODO\|FIXME\|HACK\|XXX" app/src app/tests .planning/notes .planning/debug` | Yes | green |
| 45-W0-03 | 45-01-audit-inventory-PLAN.md | 0 | TECHDEBT-10 | build + manual artifact | `cd app && npm run build` | Yes | green |
| 45-W0-04 | 45-01-audit-inventory-PLAN.md | 0 | TECHDEBT-12 | doc triage + targeted tests | `find .planning/notes .planning/debug -maxdepth 1 -type f -print` | Yes | green |
| 45-FIX-01 | 45-02-test-lint-strictness-PLAN.md | 1 | TECHDEBT-07/09 | targeted regression | `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs tests/services/post-queue.test.mjs tests/services/image-gen-key-gate.test.mjs tests/services/trellis-layout.test.mjs` | Yes | green |
| 45-FIX-02 | 45-04-performance-profiling-PLAN.md | 4 | TECHDEBT-10 | targeted perf evidence | `cd app && node --test tests/screens/GraphScreen.performance-layer.test.mjs` | Yes | green |
| 45-CLOSE-01 | 45-05-phase-close-out-PLAN.md | final | all | full suite | `cd app && npm run build && npm run lint && npm run test:main && npm run test:actions` | Yes | green |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [x] `.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` — captures `tsc`, strict-adjacent flags, lint suppressions, and TECHDEBT-07 decisions.
- [x] `.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md` — captures TODO/FIXME/HACK/XXX and suppression inventory for TECHDEBT-11.
- [x] `.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` — captures first paint, queue refill, masonry scroll, and GraphScreen Android drag-lag evidence for TECHDEBT-10.
- [x] `.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md` or a dedicated section inside a triage artifact — gives every `.planning/notes/*` and `.planning/debug/*` item a final disposition for TECHDEBT-12.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GraphScreen Android drag lag | TECHDEBT-10 | Reported Android WebView warm-up/drag feel requires device or emulator observation | Open GraphScreen on Android, record cold first drag and warmed drag behavior, document trace/manual notes in `45-PERF-AUDIT.md`; fix only if cause is clear and bounded. |
| First paint perceived cost | TECHDEBT-10 | Build chunk size alone does not prove user-visible startup impact | Capture DevTools/Android observation or document why unavailable; record whether large chunks/assets are P0/P1 or deferred. |
| Masonry scroll feel | TECHDEBT-10 | Scroll smoothness and frame drops are visual/perceptual unless instrumented | Observe Home masonry scroll under populated feed, record evidence, and pair any code fix with targeted test or source-reading invariant. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or documented manual-only verify.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 artifacts cover TECHDEBT-07, TECHDEBT-10, TECHDEBT-11, and TECHDEBT-12 before code cleanup waves.
- [x] Dead-code/residue removals have source-reading or behavioral guards where they touch load-bearing history.
- [x] No watch-mode flags.
- [x] Feedback latency < 180s for automated checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated 2026-05-13 with `45-VERIFY.md` final evidence and `GraphScreen Android manual evidence: present` in `45-PERF-AUDIT.md`.
