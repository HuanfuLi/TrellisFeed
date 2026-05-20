---
phase: 47
slug: filter-redesign-off-topic-malicious-prompt-prevention
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-15
validated: 2026-05-18
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> Detailed Validation Architecture lives in `47-RESEARCH.md` §"Validation Architecture" (line 1186). This audit reconciles the original Wave 0 contract with the completed six-plan implementation and `47-VERIFICATION.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | `app/package.json` scripts `test`, `test:main`, `test:actions` |
| **Phase 47 quick run command** | `cd app && node --test tests/services/filter-classifier.unit.test.mjs tests/services/filter-classifier.eval.test.mjs tests/services/filter-cache.test.mjs tests/providers/llm-bracketing.test.mjs tests/providers/tts-bracketing-exempt.test.mjs tests/state/useQuestions-pre-gate.test.mjs tests/state/useQuestions-system-prompt-stability.test.mjs tests/services/question-service-pre-gate.test.mjs tests/screens/AskScreen-override-refire.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` |
| **Project full suite command** | `cd app && npm test` |
| **Estimated runtime** | <1s for Phase 47 targeted suite; ~60s for project full suite |

---

## Sampling Rate

- **After every task commit:** Run the affected file-specific command from the Per-Task Verification Map.
- **After every plan wave:** Run all Phase 47 target files, plus `cd app && npm test` for regression awareness.
- **Before `/gsd:verify-work`:** Phase 47 targeted suite must be green; project full-suite deltas must be reconciled against known unrelated failures.
- **Max feedback latency:** <1s targeted / ~60s project full suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 47-01 | 0 | FILTER-01, FILTER-04 | T-47-01, T-47-02 | Static corpus and held-out eval fixture exist with labels, locales, anchor seeds, foreign-language injections, follow-up rows, and documented waiver row | fixture + eval meta | `node --test tests/services/filter-classifier.eval.test.mjs` | ✅ | ✅ green |
| 47-01-02 | 47-01 | 0 | FILTER-02 | — | `chatMessage.maliciousBlocked.body` exists in en/zh/es/ja and locale bundles stay key-parity clean | locale regression | `node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` | ✅ | ✅ green |
| 47-02-01 | 47-02 | 1 | FILTER-01 | T-47-04 | Corpus embedding cache invalidates by provider, model, corpus version, and cache schema version; corrupted cache recovers safely | unit | `node --test tests/services/filter-cache.test.mjs` | ✅ | ✅ green |
| 47-02-02 | 47-02 | 1 | FILTER-01 | T-47-05 | Hybrid classifier exports three-label contract, narrow Layer 1 regex, no LLM fallback, Layer 2 thresholds, context-aware scoring, graceful degradation, and abort handling | unit + source-reading | `node --test tests/services/filter-classifier.unit.test.mjs` | ✅ | ✅ green |
| 47-02-03 | 47-02 | 1 | FILTER-04 | — | Held-out eval runner executes all fixture rows; required D-16 categories are present and non-waived rows are regression-blocking | eval | `node --test tests/services/filter-classifier.eval.test.mjs` | ✅ | ✅ green |
| 47-03-01 | 47-03 | 1 | FILTER-03 | T-47-06 | `applyUserContentBracketing` preserves system/assistant/history bytes, wraps only the last user turn, is idempotent, and escapes adversarial tags | unit | `node --test tests/providers/llm-bracketing.test.mjs` | ✅ | ✅ green |
| 47-03-02 | 47-03 | 1 | FILTER-03 | — | LLM wrapper applies locale directive before bracketing in both `chatCompletion` and `chatStream`; Phase 35 system-prompt stability still passes | source-reading + regression | `node --test tests/providers/llm-bracketing.test.mjs tests/state/useQuestions-system-prompt-stability.test.mjs` | ✅ | ✅ green |
| 47-03-03 | 47-03 | 1 | FILTER-03 | — | TTS and embedding wrappers explicitly remain bracketing-exempt and document the rationale | source-reading | `node --test tests/providers/tts-bracketing-exempt.test.mjs` | ✅ | ✅ green |
| 47-04-01 | 47-04 | 2 | FILTER-02 | — | `useQuestions.askStreaming` runs `filterQuestion` before `chatStream`, threads abort signal, blocks malicious without LLM/buildAndSave, and flags off-topic without classification | source-reading | `node --test tests/state/useQuestions-pre-gate.test.mjs` | ✅ | ✅ green |
| 47-04-02 | 47-04 | 2 | FILTER-02 | — | Malicious-block render signal uses `SessionMessage.kind = 'malicious-block'` and i18n key; visual distinctness remains manual-only | source-reading + locale regression | `node --test tests/state/useQuestions-pre-gate.test.mjs tests/locales/bundle-parity.test.mjs` | ✅ | ✅ green |
| 47-05-01 | 47-05 | 2 | FILTER-01, FILTER-02 | — | `question.service.ask` mirrors pre-gate ordering, avoids answer LLM and embedding precompute on malicious input, and keeps `patchQuestion` pure persistence | source-reading | `node --test tests/services/question-service-pre-gate.test.mjs` | ✅ | ✅ green |
| 47-06-01 | 47-06 | 3 | FILTER-05 | — | `AskScreen.handleQuestionOverride` flips flagged state then fire-and-forgets `classifyAndAnchorIncremental` behind config guard; no new event emit; persistence helper remains pure | source-reading | `node --test tests/screens/AskScreen-override-refire.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Phase 47 Wave 0 files exist and passed targeted audit on 2026-05-18.

- [x] `app/src/data/filter-corpus.json` — 104 corpus exemplars across 3 labels and 4 locales
- [x] `app/tests/services/filter-corpus.eval.json` — 30 held-out eval rows, including anchor seeds, zh/es/ja injection rows, follow-up rows, and waiver row
- [x] `app/tests/services/filter-classifier.unit.test.mjs` — Layer 1 + Layer 2 + branching + graceful degradation + abort coverage
- [x] `app/tests/services/filter-classifier.eval.test.mjs` — FILTER-04 held-out eval runner
- [x] `app/tests/services/filter-cache.test.mjs` — cache invalidation on provider/model/schema/corpus changes
- [x] `app/tests/providers/llm-bracketing.test.mjs` — bracketing goldens + Phase 35 byte-stability regression
- [x] `app/tests/providers/tts-bracketing-exempt.test.mjs` — TTS/embedding exemption guards
- [x] `app/tests/state/useQuestions-pre-gate.test.mjs` — `useQuestions` pipeline inversion source-reading
- [x] `app/tests/services/question-service-pre-gate.test.mjs` — `question.service.ask` pipeline inversion source-reading
- [x] `app/tests/screens/AskScreen-override-refire.test.mjs` — D-06 override re-fire source-reading
- [x] `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json` — `chatMessage.maliciousBlocked.body` present with bundle parity

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Translated malicious-block copy reads naturally in zh/es/ja | FILTER-02 | i18n quality is human-judgment | Native-speaker/operator review of `chatMessage.maliciousBlocked.body` in zh/es/ja. Automated bundle parity and missing-key tests cover presence, not prose quality. |
| Inline malicious-block UI does not look like a generic chat error | FILTER-02 | Visual/UX judgment | Manual smoke: paste a known-malicious test string into Ask, verify the inline message is visibly distinct from a normal Trellis reply and has no override button. `47-06-SUMMARY.md` records this UAT as cleared. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references from `47-RESEARCH.md`
- [x] No watch-mode flags
- [x] Feedback latency <1s for targeted run
- [x] `nyquist_compliant: true` set in frontmatter only after all checkboxes above are ticked

**Approval:** approved 2026-05-18 (Nyquist audit; no automated gaps found)

---

## Validation Audit 2026-05-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Automated map rows covered | 12 |
| Phase 47 target tests verified | 112 |
| Manual-only verifications retained | 2 |

**Commands run:**

- `cd app && node --test tests/services/filter-classifier.unit.test.mjs tests/services/filter-classifier.eval.test.mjs tests/services/filter-cache.test.mjs tests/providers/llm-bracketing.test.mjs tests/providers/tts-bracketing-exempt.test.mjs tests/state/useQuestions-pre-gate.test.mjs tests/state/useQuestions-system-prompt-stability.test.mjs tests/services/question-service-pre-gate.test.mjs tests/screens/AskScreen-override-refire.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` — ✅ 112/112 pass
- `cd app && npm test` — ❌ expected red: 981/983 `test:main` and 131/133 `test:actions`; 4 failures match known unrelated failures

**Residual risk:** `cd app && npm test` includes 4 unrelated pre-existing failures outside Phase 47 scope: `tests/concept-feed.test.mjs` import error, `tests/services/trellis-state.test.mjs:52`, and two hardcoded-date failures in `tests/services/trellis-replant.test.mjs`.
