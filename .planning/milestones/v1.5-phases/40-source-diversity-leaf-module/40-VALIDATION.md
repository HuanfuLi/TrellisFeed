---
phase: 40
slug: source-diversity-leaf-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | None — invoked via `npm test` (see `app/package.json`) or `node --test` directly |
| **Quick run command** | `node --test tests/services/source-diversity.service.test.mjs tests/services/source-diversity-anti-wire.test.mjs` (from `app/`) |
| **Full suite command** | `npm test` (from `app/`) |
| **Estimated runtime** | ~1–2 seconds for the leaf pair; ~30 seconds for full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `npm test` (full suite from `app/`)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds (per-task), ~30 seconds (per-wave)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-* | 01 (source-diversity service) | 1 | CONTENT-02 (SC-1, SC-2, SC-3) | unit | `node --test tests/services/source-diversity.service.test.mjs` | ❌ W0 | ⬜ pending |
| 40-01-* | 01 (source-diversity service) | 1 | CONTENT-02 (SC-4) | source-reading | `node --test tests/services/source-diversity-anti-wire.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note:* The planner will assign concrete task IDs (`40-01-01`, `40-01-02`, …) when generating PLAN.md. Each task that creates or edits the service or its tests must list one of the two test commands above as its `<automated>` verify.

---

## Wave 0 Requirements

- [ ] `tests/services/source-diversity.service.test.mjs` — 15 behavioral cases covering CONTENT-02 SC-1, SC-2, SC-3
- [ ] `tests/services/source-diversity-anti-wire.test.mjs` — 4 source-reading assertions covering CONTENT-02 SC-4
- [ ] No new framework install — Node `--test` already in use across the repo

*Both files are new. No existing test infrastructure covers Phase 40.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | — | — |

*All phase behaviors have automated verification. Phase 40 is a pure leaf-module — no UI, no async, no integration seams (Phase 41 wires the seams).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
