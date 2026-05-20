---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 52 podcast quality defaults complete (3/3 plans, 1406/1406 tests green, awaiting device UAT)
last_updated: "2026-05-20T03:17:04.937Z"
last_activity: 2026-05-20 -- Phase 52 execution started
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 36
  completed_plans: 33
  percent: 71
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

Phase: 52 (podcast-quality-defaults-and-learner-controls) — EXECUTING
Plan: 1 of 6
Next: /gsd:plan-phase 51
Last activity: 2026-05-20 -- Phase 52 execution started
Prior: Phase 50 (Retrieval + Library Foundation) CLOSED 2026-05-18. 13 plans executed (9 original + 4 gap closures from UAT). RETRIEVE-01..02 addressed. UAT 7/8 pass + 1 skipped + 12/15 gaps fixed (G10 + G11 deferred to Phase 51). secure-phase clean (threats_open: 0). validate-phase clean (score 4/4, status human_needed satisfied via on-device UAT).

Progress: 4 / 7 phases complete

```
[############################----------------------] 57%
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

Last session: 2026-05-19T18:19:45.778Z
Stopped at: Phase 52 podcast quality defaults complete (3/3 plans, 1406/1406 tests green, awaiting device UAT)
Earlier 2026-05-18T15:39:48Z — Completed 50-13-PLAN.md
Earlier 2026-05-17 — Phase 49 plan-phase complete. 5 plans written across 3 waves. Plan-checker iterated 2 times: iter 1 flagged 8 blockers (B-1 detach D-12 needs new anchorId but Phase 48 service returns void; B-2 questionService.getAll() shape mismatch x5 sites; B-3 merge/delete signature mismatches; B-4 useLocation not imported; B-5 UndoButton reads undoneCmd instead of summary; B-6 getActionsForNode edge cases; B-7 Wave 1 plans concurrently edit GraphScreen.tsx; B-8 Wave-0 scaffolds use describe.skip instead of failing tests) + 6 warnings. Planner revision applied all fixes; iter 2 PASS.

Key Phase 49 artifacts:

- 49-CONTEXT.md (D-01..D-17, iOS gesture model + corner Undo)
- 49-DISCUSSION-LOG.md (operator reasoning audit; verbatim quotes for gesture + Undo placement)
- 49-RESEARCH.md (R1..R19 + Files Inventory + Validation Architecture; Open Questions RESOLVED inline)
- 49-VALIDATION.md (Nyquist contract: 14 new test files, ~60-100 new tests, ~6-8s full-suite impact)
- 49-PATTERNS.md (existing-file analogs for 7 new production files)
- 5 PLAN files: 49-01-PLAN.md..49-05-PLAN.md

Critical resolution: detach D-12 (re-anchored vs no-op toast variants) implemented via TWO-EMIT GRAPH_UPDATED correlation in Plan 49-04 — captures originalParentId before detach, listens for the second GRAPH_UPDATED event (the classify-completion fire, Phase 48 R7), re-reads questionService.getAll({ includeFlagged: true }) to find newParentId, compares against original. 5s timeout silent fallback. NO Phase 48 service amendment needed.

Wave 1 ordering: 49-02 declares `depends_on: ["49-01"]` to serialize edits on GraphScreen.tsx within Wave 1. Executor sees Wave 1 = sequential [49-01 → 49-02].

Resume file: .planning/phases/52-podcast-quality-defaults-and-learner-controls/52-VERIFICATION.md

Prior — Phase 48 (Graph Command Service) COMPLETE on 2026-05-17. Verifier 16/16 must-haves verified. Service signatures: rename(id, newTitle), move(id, newParentId), merge(loserId, survivorId) → ServiceResult<{ reparentedCount, newSurvivorQaCount }>, detach(qaId) → ServiceResult<void>, prune(id), delete(id) → ServiceResult<{ cascadedChildIds: string[] }>, undo() → ServiceResult<{ undoneCmd, targetIds, summary }>. questionService.getAll(opts?: { includeFlagged?: boolean }) returns Question[] directly. Critical inversion preserved: undo writes inverse journal entry with SAME cmd, swapped before/after.

Key Phase 47 artifacts:

- 6 plan summaries: `47-0{1..6}-SUMMARY.md`
- Verification: `47-VERIFICATION.md`
- Load-bearing CLAUDE.md sections added: "Question filter — dual-vector scoring (Phase 47 UAT-5)"
- Critical commits: 47-04 wire-through (`79efe98f`), 47-06 D-06 re-fire (`067cde0a`), UAT-5 dual-vector fix (`122cda59`)
