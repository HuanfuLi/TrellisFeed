---
phase: 53
slug: engagement-guardrails-provider-privacy
status: draft
nyquist_compliant: false
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
| TBD | TBD | 0 | — | — | in-memory localStorage shim for goldens (leaf-safe) | helper | n/a (support file) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PRIVACY-01 | T-53-01 | TTS payload (`input`) excludes tags/saved/liked/journal sentinels | golden (fetch-stub) | `node --test tests/providers/privacy-payload-tts.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PRIVACY-01 | T-53-01 | LLM payload (`messages[].content`) excludes private sentinels across openAI/claude/gemini | golden (fetch-stub) | `node --test tests/providers/privacy-payload-llm.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PRIVACY-01 | T-53-02 | provider chokepoints + prompt call-sites do not read private svcs; reorg = documented scoped exception | structural source-read | `node --test tests/providers/privacy-callsite-structural.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | LEARN-04 | T-53-03 | no streak/leaderboard/stop-cue/mandated-goal/public-like construct in `src/`; hidden `liked` signal allowed | negative-invariant source-read | `node --test tests/learn-04-no-pushy-mechanics.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] `tests/providers/privacy-payload-tts.test.mjs` — TTS golden (PRIVACY-01)
- [ ] `tests/providers/privacy-payload-llm.test.mjs` — LLM golden, 3 cloud providers (PRIVACY-01)
- [ ] `tests/providers/privacy-callsite-structural.test.mjs` — structural assertion incl. the reorg scoped exception (PRIVACY-01)
- [ ] `tests/learn-04-no-pushy-mechanics.test.mjs` — negative-invariant guard (LEARN-04)
- [ ] Tiny in-memory `Map`-backed `localStorage` shim for goldens (private services call `localStorage`; `node --test` has no DOM). Reuse an existing test helper if present; keep leaf-safe.
- Framework install: none needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | This phase is fully test-driven with no UI | All phase behaviors have automated verification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
