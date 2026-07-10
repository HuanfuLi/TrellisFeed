---
phase: 54
slug: code-quality-bugs-tech-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader (see `app/tests/canonical-knowledge.test.mjs` pattern) |
| **Config file** | none — runner invoked via npm script |
| **Quick run command** | `cd app && node --test tests/<area>/<file>.test.mjs` (single file) |
| **Full suite command** | `cd app && npm test` |
| **Typecheck command** | `cd app && tsc -b --noEmit` |
| **Estimated runtime** | full suite ~ tens of seconds (1,620 tests baseline green) |

---

## Sampling Rate

- **After every task commit:** Run the targeted `node --test` file(s) touched by the task.
- **After every plan wave:** Run `npm test` + `tsc -b --noEmit`.
- **Before `/gsd:verify-work`:** Full suite + typecheck must be green (Success Criterion 4).
- **Max feedback latency:** < 60 seconds for targeted runs.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | QUALITY-01 / QUALITY-02 / QUALITY-03 / TECHDEBT-13 / TECHDEBT-14 | — | N/A (no security-sensitive surface) | unit | `cd app && npm test` | ✅ existing | ⬜ pending |

*Populated by the planner / Nyquist auditor once tasks exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — the suite is already green (1,620 tests) and `tsc` is clean. No new framework or stub scaffolding needed. New regression tests are added alongside the bug fixes they cover (Success Criterion 5).*

---

## Validation notes per requirement (from RESEARCH.md "Validation Architecture")

- **QUALITY-01 (bug audit):** each confirmed bug fix must ship a regression test that *observes the corrected behavior at runtime* (not just source presence). Prefer a `node --test` assertion over a grep-for-string test — per the CLAUDE.md "tests must guard the LIVE code path" lesson.
- **QUALITY-02 (debug sessions):** prove the two fixes already work via the existing regression tests (`HomeScreen.exploredAnchors-resync` / force-new-day tests), then move the stale writeups to `.planning/debug/resolved/`. Proof = passing test that exercises the resync, not file movement.
- **QUALITY-03 (podcast):** device-verified by operator (2026-05-20) — recorded as a Manual-Only verification below; no automated gate.
- **TECHDEBT-13 (inventory):** completeness proof = the scored inventory document enumerates the RESEARCH.md candidates (usePlanner, ConnectionPostScreen, recordFeedView, lint warnings, Phase 45 deferred symbols) with a severity × reach score and a fix/re-accept disposition each; top-tier resolutions verified by suite-green + dead symbol no longer referenced (`grep -r` returns only the definition or nothing).
- **TECHDEBT-14 (deferred tests):** proof = `npm test` exits 0 and `tsc -b --noEmit` exits 0; any intentionally-re-accepted gap has a rationale comment in the test file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-gen podcast generates + plays on a real device | QUALITY-03 | Device-only (TTS synth + audio blob lifecycle behave differently on Android WebView than web) | Already performed by operator 2026-05-20 — confirmed working. No re-test required this phase. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are recorded as Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — none)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
