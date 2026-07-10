---
phase: 56
slug: ui-polish-documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` with esbuild tsx loader |
| **Config file** | `app/package.json` `scripts.test` |
| **Quick run command** | `cd app && node --test tests/layout/root-horizontal-clip.test.mjs tests/components/ChatInput.flex-shrink.test.mjs tests/components/SwipeTabContainer.resize-guard.test.mjs` |
| **Full suite command** | `cd app && npm test` (215 test files) |
| **Estimated runtime** | ~3s (quick) / ~90s (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd app && node --test tests/layout/root-horizontal-clip.test.mjs tests/components/ChatInput.flex-shrink.test.mjs tests/components/SwipeTabContainer.resize-guard.test.mjs`
- **After every plan wave:** Run `cd app && npm test && tsc -b --noEmit`
- **Before `/gsd:verify-work`:** Full suite + `tsc` must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-audit | 01 | 0 | POLISH-01/02/03 | — | Findings list produced; load-bearing guards stay green | manual + source-reading | `cd app && node --test tests/layout/root-horizontal-clip.test.mjs` | ✅ | ⬜ pending |
| 56-polish-fix | — | 2+ | POLISH-01 | — | Spacing/alignment fixes do not regress layout guards | source assertion + manual | `cd app && node --test tests/layout/root-horizontal-clip.test.mjs` | ✅ | ⬜ pending |
| 56-anim-fix | — | 2+ | POLISH-02 | — | Animation uses transform/opacity only; Header-ancestor invariant held | source-reading | `cd app && node --test tests/layout/root-horizontal-clip.test.mjs` | ✅ | ⬜ pending |
| 56-nav-fix | — | 2+ | POLISH-03 | — | Back-button visual `backTo` matches hardware/gesture destination | source-reading + manual | `cd app && node --test tests/components/SwipeTabContainer.resize-guard.test.mjs` | ✅ | ⬜ pending |
| 56-docs | — | 2+ | DOCS-01 | — | Stale docs moved to Legacy/, none deleted | file-system check | `ls Documents/Legacy/` | N/A | ⬜ pending |
| 56-claude-drift | — | 2+ | DOCS-02 | — | CLAUDE.md drift report produced; operator-approved corrections applied | source-reading + grep | drift verification grep table (see RESEARCH.md) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Load-bearing test guards (must stay green throughout every wave):**
- `tests/layout/root-horizontal-clip.test.mjs` — overflow:hidden both axes + App root overflowX + onFocusOut scrollLeft reset
- `tests/components/ChatInput.flex-shrink.test.mjs` — `minWidth: 0` on ChatInput input
- `tests/components/SwipeTabContainer.resize-guard.test.mjs` — width-change early return in `resync()`
- `tests/components/InfoFlow.video-tap-emit.test.mjs` — negative invariants for inline-play (must stay passing)

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* This phase produces findings lists, source-reading reports, doc-file operations, and operator-gated fixes — not new product code. No new test files are expected in Wave 0. Fix waves (Wave 2+) may add source-guard tests for specific animation-property or back-button corrections if a fix touches a load-bearing invariant.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 6-pillar visual audit findings | POLISH-01 | Visual hierarchy/spacing/alignment judgment cannot be unit-tested | Agent visual audit produces scored findings list; operator triages |
| Animation smoothness on Android WebView | POLISH-02 | Frame-rate/jank is device-perceptual | Run on mid-tier Android device; observe glow-pulse/aha-pulse/status-glow under load |
| Back-button feel across screens | POLISH-03 | Hardware/gesture back is a device interaction | Walk each route on device; confirm hardware back matches `backTo` visual destination |
| Doc archival correctness | DOCS-01 | Operator judgment on which docs are stale | Confirm Documents/Legacy/ contents; nothing deleted |
| CLAUDE.md drift resolution direction | DOCS-02 | D-09: operator approves each correction (code-regression vs stale-doc) | Present drift report (DR-01, DR-02, candidates); operator approves direction per item |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify, manual-verify entry, or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (load-bearing guards run per-commit)
- [ ] Wave 0 covers all MISSING references (none — existing infra sufficient)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
