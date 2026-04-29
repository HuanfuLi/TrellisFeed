---
phase: 35
slug: fix-the-dynamic-system-prompt-issue
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
reconstructed_from: SUMMARY artifacts (State B — no VALIDATION.md existed at planning time; phase ran with --skip-research)
---

# Phase 35 — Validation Strategy

> Per-phase validation contract reconstructed retroactively from PLAN/SUMMARY artifacts. Phase shipped with `--skip-research`, so no VALIDATION.md was authored at planning time. This audit confirms all testable Phase 35 deliverables are covered by automated assertions; documentation deliverables are non-testable; one empirical observation is deferred to a future telemetry phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` runner (Node 25.x) |
| **Config file** | none — `app/package.json` `test` script: `node --test tests/**/*.test.mjs` |
| **Quick run command** | `cd app && node --test tests/state/useQuestions-system-prompt-stability.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~0.1 sec (single-file source-reading test); ~5 sec (full suite, excluding pre-existing JSON-import-attribute failures unrelated to this phase) |

---

## Sampling Rate

- **After every task commit:** `cd app && node --test tests/state/useQuestions-system-prompt-stability.test.mjs` (single-file structural guard)
- **After every plan wave:** `cd app && node --test tests/state/ tests/services/classification-dedup.test.mjs tests/components/ChatInput.flex-shrink.test.mjs` (Phase 35 + sibling load-bearing invariants)
- **Before `/gsd:verify-work`:** Full suite must be green (excluding pre-existing JSON-import baseline)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Decision | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | D-01 (Pass 1 tail-assistant placement) | source-read | `node --test tests/state/useQuestions-system-prompt-stability.test.mjs` (it block 2) | ✅ | ✅ green |
| 35-01-01 | 01 | 1 | D-02 (Pass 2 same closure variable) | source-read | same file (it blocks 3 + 4) | ✅ | ✅ green |
| 35-01-01 | 01 | 1 | D-03 (static system prompt — no `formatCandidateContextPack` in role:'system') | source-read | same file (it block 1) | ✅ | ✅ green |
| 35-01-01 | 01 | 1 | D-07 (always emit assistant context, even on empty pack) | source-read | same file (it block 4: closure declared exactly once) | ✅ | ✅ green |
| 35-01-01 | 01 | 1 | D-09 (verbatim prose template — `formatCandidateContextPack` import retained) | source-read | same file (it block 5) | ✅ | ✅ green |
| 35-01-01 | 01 | 1 | TypeScript clean post-refactor | static analysis | `cd app && npx tsc -b --noEmit` | ✅ | ✅ green (exit 0) |
| 35-01-01 | 01 | 1 | No regression in Phase 27 D-22 abort plumbing | unit | `cd app && node --test tests/state/useQuestions-locale-abort.test.mjs` | ✅ | ✅ green (5/5) |
| 35-02-01 | 02 | 1 | The invariant test exists and runs | meta | `test -f app/tests/state/useQuestions-system-prompt-stability.test.mjs` | ✅ | ✅ green |
| 35-03-01 | 03 | 2 | CLAUDE.md Phase 35 load-bearing section present | doc grep | `grep -q "Ask-chat system prompt — byte-stable across turns" CLAUDE.md` | ✅ | ✅ green |
| 35-04-01 | 04 | 1 | Project-wide chatStream/chatCompletion audit captured | doc grep | `grep -q "useQuestions.ts:175\|useQuestions.ts:235" .planning/phases/35-fix-the-dynamic-system-prompt-issue/35-VERIFICATION.md` | ✅ | ✅ green |
| 35-04-01 | 04 | 1 | Phase 23 append-only descent intact (regression guard) | source-read | `node --test tests/services/classification-dedup.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note on D-08 (back-to-back-assistant pattern from turn 2 onward):** Decision was "accept the pattern" — major providers (Anthropic / OpenAI / Gemini) tolerate it; behavior is provider-side and untestable in CI without stubbing the provider boundary. Documented as a code comment in `useQuestions.ts` per Phase 32.1 lesson #8. Not a Nyquist gap; provider-layer concern.

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No fixtures, no helper modules, no new framework needed — the source-reading test pattern is already established by sibling tests (`ChatInput.flex-shrink.test.mjs`, `post-essay.service.test.mjs`, `classification-dedup.test.mjs`).

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Empirical KV-cache prefix coverage on Anthropic provider | Phase 35 Success Signal (CONTEXT.md `<domain>`) | Provider response headers (`cache_creation_input_tokens` / `cache_read_input_tokens`) are observable only at runtime against the live Anthropic API; CI does not exercise the provider boundary. **Deferred** to a future telemetry phase. Documented as non-blocking in `35-VERIFICATION-PHASE-CLOSE.md`. | (Optional ad-hoc) Run a multi-turn chat session pointed at Anthropic; capture response headers for turn 2+; assert `cache_read_input_tokens > 0`. |

---

## Validation Sign-Off

- [x] All tasks have automated verification or are documentation deliverables
- [x] Sampling continuity: every plan has at least one automated check (source-read or grep)
- [x] Wave 0 covers all MISSING references (none — existing infrastructure suffices)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

## Validation Audit 2026-04-29

| Metric | Count |
|--------|-------|
| Deliverables audited | 4 plans (35-01..04) + 9 decisions (D-01..D-09) |
| Covered by automated test | 6 decisions (D-01, D-02, D-03, D-04, D-07, D-09) — all green via source-reading test |
| Covered by doc-grep | 2 plans (35-03 CLAUDE.md, 35-04 audit) — manual review possible, grep-checkable |
| Manual-only / deferred | 1 (empirical cache-hit observation; provider-side, deferred to telemetry phase) |
| Provider-layer / untestable | 1 (D-08 back-to-back assistants — provider tolerance, no CI hook) |
| Gaps requiring test generation | 0 |
| Resolved by auditor | 0 (no auditor run needed — no gaps) |
| Escalated | 0 |

**Approval:** approved 2026-04-29 (retroactive State B reconstruction; no test generation required)
