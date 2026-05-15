---
phase: 47
slug: filter-redesign-off-topic-malicious-prompt-prevention
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> Detailed Validation Architecture lives in `47-RESEARCH.md` §"Validation Architecture" (line 1186). This file is the executor-facing per-task contract that the planner fills in during plan creation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | none — tests are standalone `.test.mjs` files (per CLAUDE.md) |
| **Quick run command** | `cd app && node --test tests/services/filter-classifier.unit.test.mjs tests/services/filter-cache.test.mjs tests/providers/llm-bracketing.test.mjs tests/state/useQuestions-pre-gate.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~3 s (quick) / per-suite (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 s per task / per-suite at wave merge

---

## Per-Task Verification Map

> Filled in by the planner from PLAN.md task IDs. Each row maps a task to its automated check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(populated by planner)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

See `47-RESEARCH.md` §"Validation Architecture > Phase Requirements → Test Map" for the requirement-to-test mapping the planner uses to derive per-task rows.

---

## Wave 0 Requirements

Per `47-RESEARCH.md` §"Wave 0 Gaps":

- [ ] `app/src/data/filter-corpus.json` — initial corpus exemplars (~100 entries across 4 locales)
- [ ] `app/tests/services/filter-corpus.eval.json` — held-out eval fixture (~30-50 rows)
- [ ] `app/tests/services/filter-classifier.unit.test.mjs` — Layer 1 + Layer 2 + branching
- [ ] `app/tests/services/filter-classifier.eval.test.mjs` — runs the held-out fixture (FILTER-04)
- [ ] `app/tests/services/filter-cache.test.mjs` — cache invalidation on (provider, model) change
- [ ] `app/tests/providers/llm-bracketing.test.mjs` — bracketing goldens + Phase 35 byte-stability regression
- [ ] `app/tests/providers/tts-bracketing-exempt.test.mjs` — assert no bracketing in TTS wrapper
- [ ] `app/tests/state/useQuestions-pre-gate.test.mjs` — pipeline inversion source-reading
- [ ] `app/tests/services/question-service-pre-gate.test.mjs` — same for `question.service.ask`
- [ ] `app/tests/screens/AskScreen-override-refire.test.mjs` — D-06 source-reading
- [ ] i18n bundles updated: malicious-block message in `en.json` (canonical) + Sonnet-translated `zh/es/ja.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Translated malicious-block copy reads naturally in zh/es/ja | FILTER-02 | i18n quality is human-judgment | After Sonnet subagent generates locale bundles, native-speaker review (or operator review) per CLAUDE.md i18n workflow |
| Inline malicious-block UI does not look like a generic chat error (visually distinguishable) | FILTER-02 | Visual/UX judgment | Manual smoke: paste a known-malicious test string into Ask, verify the inline message is visibly distinct from a normal Trellis reply |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3 s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
