# Synthesis Summary

Entry point for `gsd-roadmapper`. Produced by doc-synthesizer from 4 classified docs (MODE: new, fresh bootstrap). This synthesizer does NOT write PROJECT.md / REQUIREMENTS.md / ROADMAP.md — those are produced downstream from this intel.

## Docs synthesized (4)

- SPEC — docs/research_system_design.md (precedence 0, canonical v2.0 design)
- ADR (LOCKED) — docs/SCOPE.md (precedence 1)
- PRD — ROADMAP.md (precedence 2, five coarse phases; Phase 0 complete 2026-07-09)
- DOC — docs/prune_report.md (precedence 3, Phase 0/1 prune inventory)

By type: 1 SPEC, 1 ADR, 1 PRD, 1 DOC. All high-confidence, all manifest-typed. No UNKNOWN/low-confidence docs.

## Decisions

- LOCKED: 6 — DEC-scope-boundary, DEC-pruned-features-frozen, DEC-both-conditions-ask, DEC-control-no-question-history, DEC-framing-rules, DEC-phase-structure
  (source: docs/SCOPE.md + four operator-supplied locks; reinforced by research_system_design.md §6.6, §11.7, §15.3, §22)
- Proposed design decisions: 7 — from research_system_design.md §18 (real curated content, post-centered Q&A, no full graph, three topics, 200–400 posts/topic, oral assessment, verbal baseline)
- Detail: intel/decisions.md

## Requirements

- Extracted: 28 total (REQ-*), all traceable to ROADMAP.md phases and/or research_system_design.md.
  - Phase 1: 4 (rebrand-shell, storage-rename, condition-config, interaction-logging)
  - Phase 2: 6 (content-schemas, content-pipeline, frozen-pool-export, feed-post-ui, suggested-questions, post-scoped-ask)
  - Phase 3: 9 (global-content-graph, personal-graph-memory, question-extraction, control-ranker, experimental-ranker, orchestration-strategies, diversity-reranking, recommendation-reasons, algorithm-verification)
  - Phase 4: 5 (study-onboarding, condition-assignment, data-export, oral-test-support, internal-pilot)
  - Research-outcome (cross-cutting): 3 (rq-reengagement, rq-question-traces, rq-oral-quality)
  - Phase 0 is complete (prune) — no open requirements.
- No competing acceptance variants (single PRD).
- Detail: intel/requirements.md

## Constraints

- Extracted: 15 (CON-*). Type breakdown: schema 1 (all §9 TS shapes), scoring/nfr 2 (experimental + control ranker formulas), protocol 6 (graph edges, concept-weight update, diversity rerank, orchestration strategies, logging events, consent, oral assessment), nfr 4 (privacy do-not-collect, algorithm-verification, no-live-fetch, graph-visibility cap), copy 1 (framing).
- Detail: intel/constraints.md

## Context

- Topics captured: 10 — positioning, naming, study shape, build sequencing, repo structure, prune baseline (removed), prune baseline (survived/judgment calls), leftover dead context, open questions, success criteria.
- Detail: intel/context.md

## Conflicts

- 0 blockers, 0 competing-variants, 3 auto-resolved (INFO): precedence inversion (SPEC>ADR by explicit integers), phase-granularity consolidation (SPEC 8 phases -> PRD 5, ROADMAP wins per operator lock), and a benign non-blocking cross-ref cycle (ROADMAP <-> prune_report).
- Cross-ref cycle detection run; the one detected loop is documentation cross-linking, resolved by strict precedence ordering — synthesis proceeded on all 4 docs.
- Detail: /Users/Code/QuestionTrace_Research/.planning/INGEST-CONFLICTS.md

## Downstream notes for roadmapper

- The five-phase structure in ROADMAP.md is LOCKED (adopt verbatim; do not refine). Phase 0 done.
- Framing vocabulary is LOCKED (CON-framing-copy) — apply to all generated user-facing copy.
- Both conditions share post-scoped Ask; the ONLY isolated variable is graph-memory orchestration; control ranker must never consume question history (enforce via CON-algorithm-verification test).
- §15.3 pruned features must never be resurrected.
