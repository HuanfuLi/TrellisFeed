---
phase: 1
slug: rebrand-research-shell-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` |
| **Config file** | none — `app/package.json` scripts |
| **Quick run command** | `node --test tests/<area>/<file>.test.mjs` (from `app/`) |
| **Full suite command** | `npm test` (from `app/`); gates also include `npm run lint` and `npm run build` (`tsc -b`) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted `node --test` file(s) for the touched area
- **After every plan wave:** Run `npm test` from `app/`
- **Before `/gsd-verify-work`:** Full suite + `npm run lint` + `npm run build` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Populated by the planner from PLAN.md tasks — see RESEARCH.md § Validation Architecture.)*

---

## Wave 0 Requirements

- [ ] {tests for storage-namespace rename, condition plumbing, interaction logging — planner fills from RESEARCH.md Validation Architecture}

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*Note: persistence/platform changes need in-browser UAT — the Node suite has shipped false-greens on this area before (see CLAUDE.md).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
