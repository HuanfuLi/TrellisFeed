---
phase: 53
slug: engagement-guardrails-provider-privacy
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` + esbuild tsx loader |
| **Config file** | none — runner invoked via npm scripts (`test:main` / `test:actions`); new files live in `test:main` |
| **Quick run command** | `node --test tests/<new-file>.test.mjs` (from `app/`) |
| **Full suite command** | `npm test` (runs `test:main` then `test:actions`) |
| **Estimated runtime** | ~ a few seconds per file; full suite dominated by existing tests |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/<the-file-touched>.test.mjs`
- **After every plan wave:** Run `npm run test:main`
- **Before `/gsd:verify-work`:** `npm test` must be green
- **Max feedback latency:** < 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-T1 | 53-01 | 1 | PRIVACY-01 | T-53-01 | in-memory localStorage shim for goldens (leaf-safe) | helper | n/a (support file; `node -e` roundtrip) | ❌ pending | ⬜ pending |
| 53-03-T1 | 53-03 | 1 | PRIVACY-01 | T-53-02 | provider chokepoints + prompt call-sites do not read private svcs; reorg = documented scoped exception | structural source-read | `node --test tests/providers/privacy-callsite-structural.test.mjs` | ❌ pending | ⬜ pending |
| 53-03-T2 | 53-03 | 1 | LEARN-04 | T-53-03 | no streak/leaderboard/stop-cue/mandated-goal/public-like construct in `src/`; hidden `liked` signal allowed | negative-invariant source-read | `node --test tests/learn-04-no-pushy-mechanics.test.mjs` | ❌ pending | ⬜ pending |
| 53-02-T1 | 53-02 | 2 | PRIVACY-01 | T-53-01 | TTS payload (`input`) excludes tags/saved/liked/journal sentinels | golden (fetch-stub) | `node --test tests/providers/privacy-payload-tts.test.mjs` | ❌ pending | ⬜ pending |
| 53-02-T2 | 53-02 | 2 | PRIVACY-01 | T-53-01 | LLM payload (`messages[].content`) excludes private sentinels across openAI/claude/gemini | golden (fetch-stub) | `node --test tests/providers/privacy-payload-llm.test.mjs` | ❌ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Wave 1: 53-01 (shim) + 53-03 (source-read guards, no runtime dependency) run together. Wave 2: 53-02 goldens depend on the 53-01 shim.*

---

## Wave 0 Requirements

- [ ] `app/tests/helpers/memory-localstorage.mjs` — leaf-safe Map-backed localStorage shim (Plan 53-01)
- [ ] `tests/providers/privacy-payload-tts.test.mjs` — TTS golden (PRIVACY-01) (Plan 53-02)
- [ ] `tests/providers/privacy-payload-llm.test.mjs` — LLM golden, 3 cloud providers (PRIVACY-01) (Plan 53-02)
- [ ] `tests/providers/privacy-callsite-structural.test.mjs` — structural assertion incl. the reorg scoped exception (PRIVACY-01) (Plan 53-03)
- [ ] `tests/learn-04-no-pushy-mechanics.test.mjs` — negative-invariant guard (LEARN-04) (Plan 53-03)
- Framework install: none needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | This phase is fully test-driven with no UI | All phase behaviors have automated verification. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned
