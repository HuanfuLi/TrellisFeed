---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Control, Graph Trust, Retrieval, and Ethical Engagement
status: roadmap_corrected
stopped_at: Phase 47 discussion paused for INGEST/FOUND reframing — resume with /gsd-discuss-phase 47
last_updated: "2026-05-15"
last_activity: 2026-05-15
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: v1.6 ROADMAP CORRECTED - 2026-05-15

## 2026-05-15 Correction

The v1.6 roadmap drafted on 2026-05-13 misread the operator's two ingestion failure modes ("How are you doing?" passing the off-topic filter; "What is a system prompt in LLM?" being flagged as malicious) as a request for richer ingestion semantics. The operator clarified the intent during /gsd-discuss-phase 47 on 2026-05-15:

1. Make the existing binary off-topic classifier MORE ROBUST AND RELIABLE on those two failure modes — not introduce a four-category triage (`Added to map / Chat only / Needs review / Security blocked`).
2. Add structural prompt-injection prevention at the LLM/TTS provider boundary (analogous to SQL-injection prevention via parameterized queries / brackets) — not a verb-detector classifier.

REQUIREMENTS.md and ROADMAP.md were rewritten on 2026-05-15 to reflect this:
- INGEST-01..04 reframed around classifier reliability + held-out evals + per-question override (no new state machine).
- FOUND-01 / FOUND-03 corrected to drop the new `ingestionState` schema; the existing `flagged` bit stays as the single ingestion gate.
- FOUND-05 added: structural bracketing/delimiting of user content at the provider boundary, with goldens covering injection-style inputs.
- Phase 48 renamed from "Knowledge-Ingestion Gate" to "Off-Topic Classifier Robustness".

The Phase 47 discussion was started but paused before any decisions were captured. Resume with `/gsd-discuss-phase 47` from the corrected foundation. Memory: `feedback_ingestion_filter_intent.md`.

---

# Project State: v1.6 ROADMAP CREATED - 2026-05-13

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-13 - milestone v1.6 started)

**Core value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition - all while maintaining complete local-first privacy.
**Current focus:** Phase 47 - Data, Events, Migration, and Privacy Foundation.

## Current Position

Phase: 47 of 54 (1 of 8 in v1.6) - Data, Events, Migration, and Privacy Foundation
Plan: Not planned yet
Status: Ready to discuss (foundation reframed 2026-05-15; resume with /gsd-discuss-phase 47)
Last activity: 2026-05-15 - REQUIREMENTS.md INGEST/FOUND corrected, ROADMAP.md Phase 47/48 rewritten, FOUND-05 added (structural prompt-injection prevention)

Progress: 0 / 8 phases complete

```
[--------------------------------------------------] 0%
```

## Milestone Shape

| Phase | Focus | Requirements |
|-------|-------|--------------|
| 47 | Data/events/migration/privacy foundation | FOUND-01..04 |
| 48 | Knowledge-ingestion gate | INGEST-01..04 |
| 49 | Graph command service and trust invariants | GRAPH-01..04 |
| 50 | Graph correction UI | GRAPHUI-01..03 |
| 51 | Retrieval and library foundation | RETRIEVE-01..02 |
| 52 | Concept dashboard and recovery surfaces | RETRIEVE-03..04 |
| 53 | Podcast defaults and learner controls | PODCAST-01..05 |
| 54 | Ethical engagement and learning guardrails | LEARN-01..05 |

## Requirement Coverage

30 / 30 active v1.6 requirements mapped.

| Category | Count | Phases |
|----------|-------|--------|
| FOUNDATION | 5 | Phase 47 |
| INGEST | 4 | Phase 48 |
| GRAPH | 4 | Phase 49 |
| GRAPHUI | 3 | Phase 50 |
| RETRIEVE | 4 | Phases 51-52 |
| PODCAST | 5 | Phase 53 |
| LEARN | 5 | Phase 54 |

## Accumulated Context

### Decisions

- v1.6 starts at Phase 47 because v1.5 completed through Phase 46.
- Data/events/migration/privacy foundation comes before every feature phase.
- Off-topic classifier robustness (the new Phase 48 framing) comes before graph, retrieval, podcast, and learning metrics consume durable knowledge.
- Graph command service comes before GraphScreen correction UI.
- Retrieval/library services precede concept dashboard and podcast controls; ethical engagement comes last over stable local learning signals.
- (2026-05-15) Ingestion is a binary problem on the existing `flagged` bit, not a four-state triage. Prompt-injection prevention is structural at the provider boundary (FOUND-05), not a verb-detector classifier.

### Pending Todos

None recorded for v1.6 yet.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-15
Stopped at: Phase 47 discussion paused after operator clarified ingestion intent — REQUIREMENTS.md and ROADMAP.md rewritten to drop four-state triage and add FOUND-05 (structural injection prevention). Next action is `/gsd-discuss-phase 47` from the corrected foundation.
Resume file: None (no Phase 47 CONTEXT.md was written; resume the discuss skill from scratch).
