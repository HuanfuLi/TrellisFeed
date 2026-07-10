# Decisions Intel

Extracted from ADR-class and decision-bearing sources during doc ingest (MODE: new).
Precedence for this set (manifest, lower = higher authority): research_system_design.md=0, SCOPE.md=1, ROADMAP.md=2, prune_report.md=3.

LOCKED decisions cannot be auto-overridden by any source. In this ingest the LOCKED source is `docs/SCOPE.md` (manifest-declared ADR, `locked: true`), reinforced by four operator-locked constraints supplied in the ingest directive.

---

## LOCKED decisions

### DEC-scope-boundary — In/out-of-scope contract is fixed
- source: docs/SCOPE.md (locked ADR)
- status: locked
- scope: whole product surface
- decision: The QuestionTrace build surface is fixed to the SCOPE.md "In scope" list (curated frozen-pool feed, post-detail AI wrapper, post-scoped Q&A, question traces, graph-memory learner model [experimental only], feed orchestration strategies, control ranker, study infrastructure, content curation pipeline). The "Out of scope" list must not be built or resurrected.

### DEC-pruned-features-frozen — §15.3 pruned features never resurrected
- source: docs/SCOPE.md; docs/research_system_design.md §15.3; operator lock
- status: locked
- scope: feature set
- decision: Podcast, flashcards/SRS/quizzes, visible/editable knowledge-graph or mind-map UI, planner/trellis gamification (credits, harvest, streaks, daily goals, leaderboards), global free-form chat, social/comments/community, live web search / live news / live YouTube inside the participant app, collections, token-analytics dashboards, and AI-generated posts as primary content are permanently removed. A small "exploration path" chip list (§7.7) is the maximum graph visibility allowed.

### DEC-both-conditions-ask — Both study conditions get post-scoped Ask
- source: docs/research_system_design.md §6.6, §18 Decision 3; docs/SCOPE.md; operator lock
- status: locked
- scope: experimental design / feature gating
- decision: Contextual post-level "Ask about this post" is available to BOTH control and experimental conditions with identical answer quality. The only isolated experimental variable is whether question history feeds graph-memory feed orchestration. Rationale: prevents confounding AI Q&A access with the graph-memory treatment.

### DEC-control-no-question-history — Control ranker never consumes question history
- source: docs/research_system_design.md §11.7, §12.3; docs/SCOPE.md; operator lock
- status: locked
- scope: ranking / condition isolation
- decision: The control ranker must never use prior user questions, concept weights derived from questions, unresolved-question tracking, memory-echo logic, or graph-based continuation/counterpoint/bridge logic. Enforced by an algorithm-verification unit test ("control condition does not use user question history").

### DEC-framing-rules — User-facing framing vocabulary is constrained
- source: docs/research_system_design.md §22; docs/SCOPE.md; operator lock
- status: locked
- scope: all user-facing copy, code comments, docs
- decision: Never say "AI learning feed" (use "post-centered graph-memory feed orchestration"), "AI tutor" (use "contextual post-level Q&A as learner trace collection"), "knowledge graph recommendation" (use "graph-memory orchestration from curiosity question traces"), or "mind map" (use "latent learner memory graph").

### DEC-phase-structure — Five coarse phases adopted verbatim
- source: ROADMAP.md; operator lock
- status: locked
- scope: implementation roadmap
- decision: The five coarse phases in ROADMAP.md (Phase 0–4) are adopted verbatim; Phase 0 is complete (2026-07-09). Do NOT propose a finer phase breakdown. RSD §16's eight granular phases (0–7) fold into these five (see auto-resolved note in INGEST-CONFLICTS.md).

---

## Design decisions (proposed — from research_system_design.md §18)

These are rationale-backed design decisions in the canonical SPEC. Not independently marked `locked`, but several are reinforced by the locked decisions above (noted inline).

### DEC-real-curated-content — Use real curated content, not AI-generated posts
- source: docs/research_system_design.md §18 Decision 1
- status: proposed (reinforced by DEC-pruned-features-frozen)
- scope: content
- decision: Primary feed content is a fixed, human-reviewed pool of real multimedia posts. AI is used only for preprocessing, summarization, tagging, and linking — not for generating primary posts. Temporary AI-generated feed shell is replaced entirely in Phase 2.

### DEC-post-centered-qa — Post-centered Q&A, not global chat
- source: docs/research_system_design.md §18 Decision 2
- status: proposed (reinforced by DEC-scope-boundary, DEC-pruned-features-frozen)
- scope: Q&A surface
- decision: All AI Q&A is scoped to the current post. Keeps questions on-topic, prevents unrelated homework questions, makes questions mappable into the content graph, and keeps the app feeling like content exploration rather than a generic chatbot.

### DEC-no-full-graph — Do not show the full knowledge graph
- source: docs/research_system_design.md §18 Decision 4, §7.7
- status: proposed (reinforced by DEC-pruned-features-frozen)
- scope: UI / experimental validity
- decision: The full knowledge graph is not exposed in the first main study. Avoids confounding feed orchestration with graph-visualization effects and naming collision with MindTrellis/ConceptScape. Max visibility = a small "Your current exploration path" chip list plus short recommendation rationales.

### DEC-three-topics — Use three semi-open topics
- source: docs/research_system_design.md §18 Decision 5, §6.3
- status: proposed
- scope: study design
- decision: Three semi-open topics; each participant chooses one. Preserves curiosity, keeps content pools/rubrics manageable, enables topic-stratified randomization. Final three topics are an open question (§20).

### DEC-pool-size — 200–400 curated posts per topic
- source: docs/research_system_design.md §18 Decision 6, §6.4
- status: proposed
- scope: content pool
- decision: 200–400 human-approved posts per topic (600–1200 total across 3 topics), collected from 400–800 raw candidates via AI preprocessing + human review. Build one pilot topic with ~50 approved posts before scaling.

### DEC-oral-assessment — Use oral explanation assessment
- source: docs/research_system_design.md §18 Decision 7, §13
- status: proposed
- scope: evaluation
- decision: Learning outcome is measured by oral explanation (pretest/post-test), not quizzes. Better aligned with conceptual understanding; captures explanation richness, comparison, and transfer; reduces test-like pressure.

### DEC-verbal-baseline — Use a pretest verbal baseline
- source: docs/research_system_design.md §18 Decision 8, §13.2
- status: proposed
- scope: evaluation / normalization
- decision: Collect a general verbal baseline (Pretest A) plus a domain baseline (Pretest B) so oral-explanation length/richness can be normalized against how much each participant naturally talks.
