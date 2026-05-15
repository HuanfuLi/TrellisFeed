---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Control, Graph Trust, Retrieval, and Ethical Engagement
status: phase_47_planned
stopped_at: Phase 47 planned — 6 plans across 4 waves; ready for /gsd:execute-phase 47
last_updated: "2026-05-15"
last_activity: 2026-05-15
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
---

# Project State: v1.6 ROADMAP OVERHAULED — 2026-05-15

## 2026-05-15 Overhaul (latest)

The v1.6 milestone (drafted 2026-05-13 by a prior agent) was overhauled after the operator surfaced four corrections during /gsd-discuss-phase 47:

1. **Some professor questions get private answers, not product features.** Q1 "how is the mind-map generated" is private (writeup/conversation), NOT a user-facing pipeline-transparency feature. Q2 "what's blocking filter reliability" diagnosis half is also private. The prior agent translated every professor question into product requirements, including pipeline-transparency surfaces the operator does not want built.
2. **The off-topic + malicious-prompt filter needs redesign, not regex tuning.** The current regex pattern library (`question-filter.service.ts`) is "TOO reliant on regex" and "very ineffective." v1.6 must replace the approach (LLM-only / embedding-similarity / hybrid with much narrower regex), not add evals on top of regex. Malicious prompts must be **kept out of the LLM request entirely**, not flagged after the response.
3. **No "learning metrics" topic was asked.** LEARN-04 ("metrics stay separate from engagement") was inferred by the prior agent. Professor Q4 asked about engagement-vs-learning *balance* (stop cues, goals, reflection), not a metrics tracking system. LEARN-04 dropped.
4. **No demo urgency.** Presentation already happened; the questions came after. Plan for correctness.

Plus the earlier 2026-05-15 corrections (during the same session, before the full overhaul):
- Operator rejected the four-state ingestion triage (`Added to map / Chat only / Needs review / Security blocked`) the prior agent had introduced under INGEST-01..04.
- Operator pushed back on the `normalizeQuestion()` migration framework I proposed under FOUND-02; for purely-additive optional fields, no normalize layer is needed.

### Resulting milestone shape

| Phase | Title | Reqs |
|---|---|---|
| 47 | Filter Redesign — Off-Topic + Malicious Prompt Prevention | FILTER-01..05 |
| 48 | Graph Command Service and Trust Invariants | GRAPH-01..04 |
| 49 | Graph Correction UI | GRAPHUI-01..03 |
| 50 | Retrieval and Library Foundation | RETRIEVE-01..02 |
| 51 | Concept Dashboard and Recovery Surfaces | RETRIEVE-03..04 |
| 52 | Podcast Quality Defaults and Learner Controls | PODCAST-01..05 |
| 53 | Engagement Guardrails + Provider Privacy | LEARN-01..04 + PRIVACY-01 |

**Net change:** 8 phases / 30 reqs → 7 phases / 26 reqs.

### What was dropped or reworked

- **Phase 47 (was: Data, Events, Migration, and Privacy Foundation)** — dissolved entirely. FOUND-01 (umbrella schema) folded into each consuming phase. FOUND-02 (migration normalization) dropped as not-a-thing. FOUND-03 (event payload contract) dropped as already true. FOUND-04 (privacy sanitizer) folded into Phase 53 (PRIVACY-01) where the protected fields actually exist. FOUND-05 (structural bracketing) folded into the new Phase 47 (FILTER-03) where it directly enables FILTER-02.
- **Phase 48 INGEST-01..04 (was: Off-Topic Classifier Robustness)** — replaced with FILTER-01..05 in the new Phase 47. Reframed from "tighten the regex thresholds" to "replace the classifier approach + add a pre-LLM gate."
- **LEARN-04 (separate metrics)** — dropped as invented. LEARN-05 (no dark patterns) renumbered to LEARN-04.
- **GRAPHUI-02 "inspect why a node was placed"** — partial drop; the inspection half is private-answer-only. The "see corrected graph after reload" half kept as new GRAPHUI-03.

### Memory captured

- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_ingestion_filter_intent.md`
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_no_normalize_for_optional_fields.md`
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_professor_qs_private_vs_product.md`
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_filter_redesign_not_tuning.md`

## Current Position

Phase: 47 of 53 (1 of 7 in v1.6) — Filter Redesign — Off-Topic + Malicious Prompt Prevention
Plan: 6 plans across 4 waves (47-01..47-06); plan-checker PASSED with 1 cosmetic warning
Status: Ready to execute — /gsd:execute-phase 47
Last activity: 2026-05-15 — Phase 47 plan-phase complete; RESEARCH.md + PATTERNS.md + VALIDATION.md + 6 PLAN.md files committed

Progress: 0 / 7 phases complete

```
[--------------------------------------------------] 0%
```

## Milestone Shape

| Phase | Focus | Requirements |
|-------|-------|--------------|
| 47 | Filter redesign (off-topic + malicious-prompt) | FILTER-01..05 |
| 48 | Graph command service + trust invariants | GRAPH-01..04 |
| 49 | Graph correction UI | GRAPHUI-01..03 |
| 50 | Retrieval + library foundation | RETRIEVE-01..02 |
| 51 | Concept dashboard + recovery surfaces | RETRIEVE-03..04 |
| 52 | Podcast defaults + learner controls | PODCAST-01..05 |
| 53 | Engagement guardrails + provider privacy | LEARN-01..04, PRIVACY-01 |

## Requirement Coverage

26 / 26 active v1.6 requirements mapped.

| Category | Count | Phases |
|----------|-------|--------|
| FILTER | 5 | Phase 47 |
| GRAPH | 4 | Phase 48 |
| GRAPHUI | 3 | Phase 49 |
| RETRIEVE | 4 | Phases 50–51 |
| PODCAST | 5 | Phase 52 |
| LEARN | 4 | Phase 53 |
| PRIVACY | 1 | Phase 53 |

## Accumulated Context

### Decisions

- v1.6 starts at Phase 47 because v1.5 completed through Phase 46.
- No foundation phase. Optional `?:` fields don't need migration scaffolding; events already carry needed payloads; sanitizer ships with the fields it protects.
- Phase 47 (filter redesign) replaces the regex approach entirely; pre-LLM gate blocks malicious prompts from the request itself; structural bracketing at provider boundary is defense in depth.
- Mind-map generation transparency is a private answer to the professor (writeup), NOT a user-facing product feature.
- "Learning metrics" was never a professor request and is not in scope.
- **Phase 47 strategy locked in CONTEXT.md (not deferred to research):** hybrid — narrow regex (Layer 1) + embedding-similarity (Layer 2). No LLM in classifier path. Today's "regex first, LLM fallback" had the LLM fallback dead in practice.
- **Phase 47 corpus design:** repo-only static JSON of text labels; embeddings runtime against user's configured embedding provider, cached with `(provider, model)` key, re-embedded on config change. Build-time embeddings rejected (model-incompatible with user's runtime config).
- **Phase 47 malicious classifier scope:** narrow — DoS spam, known jailbreak templates, disallowed-content requests only. No override path on malicious; bracketing handles legitimate-looking-scary questions.
- **Phase 47 override UI is already implemented** (`ChatMessage.tsx` + `AskScreen.tsx`); only gap to close is firing `classifyAndAnchorIncremental` when `flagged` flips true → false.

### Pending Todos

None recorded for v1.6 yet. The two pre-existing pending todos (cosine similarity threshold + auto-gen podcast device verification) remain in `.planning/todos/pending/` and are unrelated to v1.6 phase scope.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-15
Stopped at: Phase 47 plan-phase complete. 6 plans across 4 waves cover FILTER-01..05 and all 19 CONTEXT.md decisions. RESEARCH.md (94 KB), PATTERNS.md (52 KB), VALIDATION.md, and 6 PLAN.md files (47-01..47-06) committed. Plan-checker verified PASSED with one cosmetic warning (RESEARCH.md Open Questions formatting — non-blocking, all recommendations already adopted in plans).

Wave structure:
- Wave 0 (47-01): corpus + i18n + test mock fixtures
- Wave 1 (47-02 + 47-03 parallel): hybrid classifier + cache + eval runner; provider-wrapper bracketing
- Wave 2 (47-04 + 47-05 parallel): pipeline inversion in askStreaming + question.service.ask
- Wave 3 (47-06): AskScreen override re-fire (D-06) + UAT checkpoint

Resume file: `.planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-01-PLAN.md`. Next action is `/gsd:execute-phase 47`.
