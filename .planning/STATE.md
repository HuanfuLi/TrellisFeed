---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Control, Graph Trust, Retrieval, and Ethical Engagement
status: phase_48_in_progress
stopped_at: Phase 48 Waves 1+2+3a complete (Plans 48-01 foundation + 48-02 rename/move/delete + 48-03 merge/detach/prune with Blocker #2/#4 + Warning #2/#4 fixes). 32 new Plan 48-03 tests pass; full suite 1078/1082 modulo the same 4 pre-existing failures. Wave 3b next (Plan 48-04 undo + integration).
last_updated: "2026-05-17"
last_activity: 2026-05-17
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 10
  completed_plans: 9
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

Phase: 49 of 53 — **CONTEXT GATHERED** (1 of 7 in v1.6 complete + 1 plan-ready + 1 context-ready) — Graph Correction UI
Next: /gsd:plan-phase 49 (after /gsd:execute-phase 48 lands the service layer)
Last activity: 2026-05-17 — Phase 49 discuss-phase produced 49-CONTEXT.md (D-01..D-17) + 49-DISCUSSION-LOG.md. Locked iOS-style gesture model (tap=inspect, long-press-release=correction-menu, long-press-drag=relocate with ghost+origin-line+halo). Undo at viewport corner next to expand/collapse. Drop-on-cluster=Move, drop-on-anchor=Merge (dragged=LOSER). Operator counter-proposed both the gesture split (rejecting all 4 preset surface options) and the corner-Undo placement.
Prior: Phase 48 plan-phase produced 48-RESEARCH.md, 48-VALIDATION.md, and 4 PLAN files; passed plan-checker on iteration 3/3 (5 blockers → 1 blocker → 0). Awaiting /gsd:execute-phase 48.

Progress: 1 / 7 phases complete

```
[#######-------------------------------------------] 14%
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

Last session: 2026-05-17
Stopped at: Phase 48 plan-phase complete. 4 plans written across 3 waves (48-01 foundation in Wave 1; 48-02 rename/move/delete in Wave 2; 48-03 merge/detach/prune + 48-04 undo+integration in Wave 3, sequenced so 48-04 follows 48-03 to avoid concurrent edits of graph-command.service.ts). Plan-checker iterated 3 times: iter 1 flagged 5 blockers (missing VALIDATION.md, questionService.delete signature mismatch, synthetic `cmd:'undo'` contradicting RESEARCH.md's inverse-verb strategy, embeddingVector cleared-before-re-embed breaking retrieval identity, no service-level reload-survival test); orchestrator created 48-VALIDATION.md directly + planner revision fixed Blockers #2-5 and Warnings #1-2/#4-6; iter 2 flagged a Dimension-11 doc-hygiene blocker (RESEARCH.md `## Open Questions` lacked `(RESOLVED)` markers) which orchestrator fixed inline; iter 3 PASS.

Key Phase 48 artifacts:
- 48-CONTEXT.md (D-01..D-20, 20 decisions)
- 48-DISCUSSION-LOG.md (operator reasoning audit)
- 48-RESEARCH.md (R1-R11 + Files Inventory + Validation Architecture; Open Questions RESOLVED inline)
- 48-VALIDATION.md (Nyquist contract: 11 new test files, per-task verify map, 60s full-suite budget)
- 4 PLAN files: 48-01-PLAN.md..48-04-PLAN.md

Critical inversion from naive design: undo writes an inverse journal entry with the SAME cmd and swapped before/after — never introduces a `cmd:'undo'` literal. This keeps the journal-as-reorg-prompt-constraint surface coherent (LLM sees "user renamed X→Y, then renamed Y→X" rather than an opaque "undid the previous edit"). Source-reading negative invariant in Plan 04 enforces it.

Resume file: `.planning/phases/48-graph-command-service-and-trust-invariants/48-01-PLAN.md`. Next action is `/gsd:execute-phase 48`.

Key Phase 47 artifacts:
- 6 plan summaries: `47-0{1..6}-SUMMARY.md`
- Verification: `47-VERIFICATION.md`
- Load-bearing CLAUDE.md sections added: "Question filter — dual-vector scoring (Phase 47 UAT-5)"
- Critical commits: 47-04 wire-through (`79efe98f`), 47-06 D-06 re-fire (`067cde0a`), UAT-5 dual-vector fix (`122cda59`)
