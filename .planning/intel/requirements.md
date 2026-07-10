# Requirements Intel

Extracted from the PRD-class source (ROADMAP.md, precedence 2) and PRD-like study requirements in the canonical SPEC (research_system_design.md §3, §6, §12.3, §13, §14). Each requirement carries `source:`, target `phase:` (per the locked five-phase ROADMAP), and acceptance criteria.

No competing acceptance variants were found (single PRD in the ingest set).

---

## Phase 1 — Rebrand + research shell hardening

### REQ-rebrand-shell — In-app rebrand Trellis → QuestionTrace
- source: ROADMAP.md Phase 1
- phase: 1
- description: Rename all user-facing surfaces from Trellis to QuestionTrace: display name, index.html title, capacitor.config.ts appName, iOS/Android display names, Settings/About, onboarding + starter-post copy, all 4 locale bundles.
- acceptance:
  - No user-facing "Trellis" strings remain in active screens or the 4 locale bundles.
  - Native bundle identifiers are unchanged (signing/data constraints — see CLAUDE.md).

### REQ-storage-rename — Storage key rename, no migration
- source: ROADMAP.md Phase 1
- phase: 1
- description: Rename IDB_NAME 'trellis' → 'questiontrace' and live trellis_* localStorage keys → questiontrace_*. No migration; old keys are orphaned.
- acceptance:
  - IDB and localStorage use the questiontrace_* namespace.
  - Tests referencing old key names are updated.
  - No migration framework is added (nothing in storage is worth preserving).

### REQ-condition-config — Condition config scaffolding (control/experimental)
- source: ROADMAP.md Phase 1; research_system_design.md §6.5
- phase: 1
- description: Introduce control/experimental condition configuration plumbing.
- acceptance:
  - A condition value ("control" | "experimental") is assignable and readable app-wide.
  - Downstream services can branch on condition.

### REQ-interaction-logging — Interaction logging infrastructure
- source: ROADMAP.md Phase 1; research_system_design.md §9.8, §14.1
- phase: 1
- description: Implement UserInteractionEvent logging covering all required event types.
- acceptance:
  - Logs app_open, feed_impression, post_open, post_close, time-on-post, source_click, video_progress (if available), question_suggestion_click, question_submit, ai_answer_view, save_post, not_interested, recommendation_reason_view, notification_open/received, session_end.
  - Each event records userId, condition, topicId, timestamp; optional postId/questionId/recommendationId/durationMs/payload.
  - Logging exists before personalization is built (§23 sequencing).
  - Excludes all §14.2 do-not-collect categories.

### REQ-dead-code-sweep — Remaining dead-code sweep
- source: ROADMAP.md Phase 1
- phase: 1
- description: Sweep and remove any dead code left behind by the Phase 0 prune (orphaned helpers, unused types/assets/comments referencing pruned features) that the prune pass missed.
- acceptance:
  - No unreferenced modules, exports, or assets tied to §15.3 pruned features remain in app/src.
  - Gates stay green after the sweep (tsc, tests, lint, build).

---

## Phase 2 — Content pool + feed/post UI on frozen data

### REQ-content-schemas — Domain schemas
- source: ROADMAP.md Phase 2; research_system_design.md §9
- phase: 2
- description: Implement Topic, Post, Concept, Claim, SuggestedQuestion schemas (see constraints.md for exact TS shapes).
- acceptance: Types match the canonical schemas in research_system_design.md §9 field-for-field.

### REQ-content-pipeline — Content curation pipeline
- source: ROADMAP.md Phase 2; research_system_design.md §8, §17.1
- phase: 2
- description: Build tools/content_pipeline/ — collectors, AI preprocessing, dedupe, quality scoring, human-review workflow, exporters.
- acceptance:
  - Pipeline ingests 400–800 raw candidates per topic and produces human-approved posts.
  - AI preprocessing populates summary, concept tags, claims, stance, difficulty, suggested questions.
  - Human review gate precedes freezing.

### REQ-frozen-pool-export — Frozen pool export
- source: ROADMAP.md Phase 2; research_system_design.md §8.8
- phase: 2
- description: Export a frozen content pool to data/content_pool_v1/.
- acceptance:
  - One pilot topic with ~50 approved posts first, before scaling to 200–400.
  - Pool is versioned (contentPoolVersion) and immutable once frozen.

### REQ-feed-post-ui — Feed card + post detail on frozen data
- source: ROADMAP.md Phase 2; research_system_design.md §7.2, §7.3, §7.4
- phase: 2
- description: Feed home and post-detail page rendering the frozen pool, replacing the temporary AI-generated feed shell entirely.
- acceptance:
  - Feed card renders curated posts (§7.2).
  - Post detail shows AI wrapper (hook, summary, concept tags) plus original source embed/link (§7.3, §7.4).
  - No live search/news/YouTube fetch in the participant app.

### REQ-suggested-questions — Pre-generated suggested questions
- source: ROADMAP.md Phase 2; research_system_design.md §7.5, §9.5
- phase: 2
- description: Display pre-generated suggested questions on post detail.
- acceptance: Suggested questions carry type, target concepts/claims, and generic flag per the SuggestedQuestion schema.

### REQ-post-scoped-ask — Post-scoped Ask (both conditions)
- source: ROADMAP.md Phase 2; research_system_design.md §6.6, §7.6
- phase: 2
- description: Contextual post-scoped AI Q&A available to BOTH conditions.
- acceptance:
  - Ask is scoped to the current post (no global chat).
  - Available and identical in quality for control and experimental (enforces DEC-both-conditions-ask).
  - UserQuestion + AIAnswer are persisted per the schemas.

---

## Phase 3 — Graph-memory + recommendation engine

### REQ-global-content-graph — Global content graph import
- source: ROADMAP.md Phase 3; research_system_design.md §10.1–10.4
- phase: 3
- description: Build the global content graph (posts, concepts, claims, sources, suggested questions) with the defined global edge types.
- acceptance: Global edges match §10.4 (explains, mentions, supports, challenges, about, contrasts_with, related_to, prerequisite_of, targets).

### REQ-personal-graph-memory — Personal graph-memory + concept state
- source: ROADMAP.md Phase 3; research_system_design.md §10.3, §10.5, §10.6
- phase: 3
- description: Per-user graph-memory with UserConceptState and concept-weight updates.
- acceptance:
  - Personal edges match §10.4; UserConceptState matches §10.5.
  - interestWeight/uncertaintyWeight/familiarityEstimate update per §10.6 rules.

### REQ-question-extraction — Question → concept/claim extraction
- source: ROADMAP.md Phase 3; research_system_design.md §17.2
- phase: 3
- description: Extract concepts/claims and question type from user questions; flag unresolved.
- acceptance: UserQuestion.extractedConceptIds/extractedClaimIds/questionType/unresolved are populated.

### REQ-control-ranker — Control ranker (non-personal)
- source: ROADMAP.md Phase 3; research_system_design.md §11.7
- phase: 3
- description: Strong non-personal ranker for the control condition.
- acceptance:
  - Scores per the §11.7 ControlScore formula (see constraints.md).
  - Never uses question history, question-derived concept weights, unresolved tracking, echo, or graph continuation/contrast/bridge (enforces DEC-control-no-question-history).

### REQ-experimental-ranker — Experimental graph-memory ranker
- source: ROADMAP.md Phase 3; research_system_design.md §11.3–11.4
- phase: 3
- description: Personalized ranker using the graph-memory scoring components.
- acceptance:
  - Scores per the §11.3 formula with the seven §11.4 components (see constraints.md).
  - Component weights are configurable.

### REQ-orchestration-strategies — Continue/Deepen/Contrast/Bridge/Echo
- source: ROADMAP.md Phase 3; research_system_design.md §11.5
- phase: 3
- description: Label each experimental recommendation with one orchestration strategy.
- acceptance: Strategy ∈ {continue, deepen, contrast, bridge, echo}; Echo requires prior questions older than a threshold.

### REQ-diversity-reranking — Diversity reranking
- source: ROADMAP.md Phase 3; research_system_design.md §11.6
- phase: 3
- description: Rerank scored candidates to avoid monotony.
- acceptance: Enforces §11.6 constraints (≤2 same-source per session, ≤2 same-primary-concept in a row, ≥1 contrast/bridge after sufficient history, mixed formats).

### REQ-recommendation-reasons — Interpretable recommendation reasons
- source: ROADMAP.md Phase 3; research_system_design.md §17.4, §7.7
- phase: 3
- description: Generate a human-readable rationale per experimental recommendation; non-personal labels for control.
- acceptance:
  - Recommendation.reasonText populated; contributingQuestionIds/ConceptIds/PostIds attached for experimental.
  - Control uses non-personal labels only ("Related to X", "Popular explanation", "Different viewpoint").

### REQ-algorithm-verification — Algorithm verification tests
- source: ROADMAP.md Phase 3; research_system_design.md §12.3
- phase: 3
- description: Unit tests proving ranker behavior and condition isolation.
- acceptance: Tests cover — QuestionRelevance rises for shared-concept posts; contrast candidates include opposing claims; redundancy penalty suppresses near-duplicates; echo requires aged prior questions; control never uses question history; experimental reasons include contributing trace IDs.

---

## Phase 4 — Study infrastructure + pilot

### REQ-study-onboarding — Onboarding + topic selection
- source: ROADMAP.md Phase 4; research_system_design.md §7.1, §13
- phase: 4
- description: Study onboarding (welcome, language, consent, LLM setup) and topic selection.
- acceptance: Consent language covers §14.3 items; participant chooses one of three topics.

### REQ-condition-assignment — Condition assignment
- source: ROADMAP.md Phase 4; research_system_design.md §6.5
- phase: 4
- description: Assign control/experimental (topic-stratified randomization).
- acceptance: Assignment is persisted and drives ranker + logging condition field.

### REQ-data-export — Logging export / researcher data dump
- source: ROADMAP.md Phase 4; research_system_design.md §14
- phase: 4
- description: Export analyzable logs for researchers.
- acceptance: Export includes all required event logs, user questions, AI answers, and recommendations; excludes §14.2 categories.

### REQ-oral-test-support — Pre/post oral-test support
- source: ROADMAP.md Phase 4; research_system_design.md §13
- phase: 4
- description: In-app support for pretest (verbal + domain baseline) and post-test oral explanation capture.
- acceptance: Audio responses recorded/transcribed; scoring dimensions (§13.4) and normalization (§13.5) supported by exported data.

### REQ-internal-pilot — Internal pilot (3–5 users)
- source: ROADMAP.md Phase 4; research_system_design.md §16 Phase 7 (Pilot)
- phase: 4
- description: Run an internal pilot validating content quality, logs, recommendation reasons, oral-assessment flow.
- acceptance: Issues found in pilot are fixed; system is IRB-ready.

---

## Research-outcome requirements (from research_system_design.md §3)

These frame study measurement and must be supported by logging/schemas rather than built as UI features.

### REQ-rq-reengagement — RQ1 re-engagement measurable
- source: research_system_design.md §3 RQ1
- phase: cross-cutting (logging in Phase 1)
- acceptance: Logs support sessions, return days, session length, posts opened, questions asked, suggestion clicks, notification open rate, voluntary revisits.

### REQ-rq-question-traces — RQ2 question traces measurable
- source: research_system_design.md §3 RQ2
- phase: cross-cutting (schemas Phase 2, extraction Phase 3)
- acceptance: Data supports counts/depth/types of questions, concepts-per-question, unresolved counts, repeated concepts across sessions.

### REQ-rq-oral-quality — RQ3 oral explanation quality measurable
- source: research_system_design.md §3 RQ3, §13.4
- phase: 4
- acceptance: Post-test data supports duration, word count, concept coverage/relationships, stance comparison, examples, counterargument awareness, transfer, clarity, rubric score, normalized improvement.
