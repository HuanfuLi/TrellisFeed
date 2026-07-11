# Requirements: QuestionTrace

**Defined:** 2026-07-10
**Core Value:** Two study conditions produce different-but-comparable feeds with interpretable recommendation reasons on a frozen content pool, with complete interaction logging.

> Milestone: **v0.1 (research instrument)**. Phase 0 (rename/scope/prune) is complete (2026-07-09) and has no open requirements. Requirement IDs below trace to the five locked coarse phases in ROADMAP.md. Every REQ carries its `research_system_design.md` (RSD) section anchors.

## v1 Requirements

### Shell & Logging (Phase 1)

- [ ] **SHELL-01**: In-app rebrand Trellis → QuestionTrace across all user-facing surfaces (display name, `index.html` title, `capacitor.config.ts` appName, iOS/Android display names, Settings/About, onboarding + starter-post copy, all 4 locale bundles). Native bundle identifiers unchanged. No user-facing "Trellis" strings remain.
- [ ] **SHELL-02**: Storage key rename with no migration — `IDB_NAME 'trellis'` → `'questiontrace'`, live `trellis_*` localStorage keys → `questiontrace_*`; old keys orphaned; tests updated; no migration framework added.
- [ ] **SHELL-03**: Condition config scaffolding — a `"control" | "experimental"` value is assignable and readable app-wide, and downstream services can branch on it (RSD §6.5).
- [ ] **SHELL-04**: Remaining dead-code sweep — remove code, exports, and assets orphaned by the Phase 0 prune that the prune pass missed; no unreferenced §15.3-feature remnants in `app/src`; all gates stay green.
- [ ] **LOG-01**: Interaction logging infrastructure — `UserInteractionEvent` covering all §14.1 event types (app_open, feed_impression, post_open, post_close, time-on-post, source_click, video_progress if available, question_suggestion_click, question_submit, ai_answer_view, save_post, not_interested, recommendation_reason_view, notification_received/open, session_end). Each event records userId, condition, topicId, timestamp (+ optional postId/questionId/recommendationId/durationMs/payload). Logging exists before personalization (RSD §9.8, §14.1, §23). Excludes all §14.2 do-not-collect categories.

### Content & Feed (Phase 2)

- [x] **CONT-01**: Domain schemas — Topic, Post, Concept, Claim, SuggestedQuestion (+ UserQuestion, AIAnswer, Recommendation, UserConceptState) match RSD §9 field-for-field.
- [x] **CONT-02**: Content curation pipeline in `tools/content_pipeline/` — collectors, AI preprocessing (summary, concept tags, claims, stance, difficulty, suggested questions), dedupe, quality scoring, human-review gate, exporters. Ingests 400–800 raw candidates per topic → human-approved posts (RSD §8, §17.1).
- [ ] **CONT-03**: Frozen pool export to `data/content_pool_v1/` — one pilot topic (~50 approved posts) before scaling to 200–400; versioned (`contentPoolVersion`) and immutable once frozen (RSD §8.8).
- [ ] **FEED-01**: Feed card + post detail rendering the frozen pool, replacing the temporary AI-generated feed shell entirely — feed card (§7.2), post detail with AI wrapper (hook, summary, concept tags) + original source embed/link (§7.3, §7.4). No live fetch in the participant app.
- [ ] **FEED-02**: Pre-generated suggested questions on post detail carrying type, target concepts/claims, and generic flag per the SuggestedQuestion schema (§7.5, §9.5).
- [ ] **ASK-01**: Post-scoped Ask (both conditions) — contextual AI Q&A scoped to the current post (no global chat), identical quality for control and experimental; UserQuestion + AIAnswer persisted (§6.6, §7.6).

### Graph-Memory & Recommendation Engine (Phase 3)

- [ ] **GRAPH-01**: Global content graph (posts, concepts, claims, sources, suggested questions) with the §10.4 global edge types (explains, mentions, supports, challenges, about, contrasts_with, related_to, prerequisite_of, targets).
- [ ] **GRAPH-02**: Personal graph-memory + `UserConceptState` — personal edges per §10.4; interestWeight/uncertaintyWeight/familiarityEstimate update per the §10.6 rules.
- [ ] **GRAPH-03**: Question → concept/claim extraction — populate `UserQuestion.extractedConceptIds/extractedClaimIds/questionType/unresolved` (§17.2).
- [ ] **RANK-01**: Control ranker (non-personal) scoring per the §11.7 `ControlScore` formula; never uses question history, question-derived concept weights, unresolved tracking, echo, or graph continuation/contrast/bridge (enforces DEC-control-no-question-history).
- [ ] **RANK-02**: Experimental graph-memory ranker scoring per the §11.3 formula with the seven §11.4 components; component weights configurable.
- [ ] **RANK-03**: Orchestration strategies — each experimental item labeled with exactly one of {continue, deepen, contrast, bridge, echo}; Echo requires prior questions older than a threshold (§11.5).
- [ ] **RANK-04**: Diversity reranking — ≤2 same-source per session, ≤2 same-primary-concept in a row, ≥1 contrast/bridge after sufficient history, mixed formats (§11.6).
- [ ] **RANK-05**: Interpretable recommendation reasons — `Recommendation.reasonText` populated; contributing question/concept/post IDs attached for experimental; control uses non-personal labels only ("Related to X", "Popular explanation", "Different viewpoint") (§17.4, §7.7).
- [ ] **RANK-06**: Algorithm verification unit tests (§12.3) — QuestionRelevance rises for shared-concept posts; contrast candidates include opposing claims; redundancy penalty suppresses near-duplicates; echo requires aged prior questions; control never uses question history; experimental reasons include contributing trace IDs.

### Study Infrastructure (Phase 4)

- [ ] **STUDY-01**: Study onboarding + topic selection — welcome, language, consent (covers §14.3 items), LLM setup; participant chooses one of three topics (§7.1, §13).
- [ ] **STUDY-02**: Condition assignment — topic-stratified randomization; persisted; drives ranker + logging `condition` field (§6.5).
- [ ] **STUDY-03**: Data export / researcher data dump — all required event logs, user questions, AI answers, and recommendations; excludes §14.2 categories (§14).
- [ ] **STUDY-04**: Pre/post oral-test support — pretest (verbal + domain baseline) and post-test oral explanation capture; audio recorded/transcribed; scoring dimensions (§13.4) and normalization (§13.5) supported by exported data (§13).
- [ ] **STUDY-05**: Internal pilot (3–5 users) — validate content quality, logs, recommendation reasons, and oral-assessment flow; fix issues found; system IRB-ready (RSD §16 Phase 7).

### Research-Outcome (cross-cutting — measurement, not UI features)

- [ ] **RQ-01**: RQ1 re-engagement measurable — logs support sessions, return days, session length, posts opened, questions asked, suggestion clicks, notification open rate, voluntary revisits (RSD §3 RQ1). *(Satisfied by Phase 1 logging.)*
- [ ] **RQ-02**: RQ2 question traces measurable — data supports counts/depth/types of questions, concepts-per-question, unresolved counts, repeated concepts across sessions (RSD §3 RQ2). *(Schemas in Phase 2; fully satisfied once extraction lands in Phase 3.)*
- [ ] **RQ-03**: RQ3 oral-explanation quality measurable — post-test data supports duration, word count, concept coverage/relationships, stance comparison, examples, counterargument awareness, transfer, clarity, rubric score, normalized improvement (RSD §3 RQ3, §13.4). *(Satisfied by Phase 4 oral-test support.)*

## Out of Scope

Explicitly excluded (design doc §15.3 / SCOPE.md). Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Global free-form AI chat | All Q&A is post-scoped; keeps questions mappable into the content graph |
| AI-generated posts as primary content | Primary feed is real curated content; AI only preprocesses |
| Flashcards / SRS / quizzes | Outcome measured by oral explanation, not drills |
| Visible/editable knowledge-graph / mind-map UI | Confounds orchestration with graph-visualization; chip list is the max (§7.7) |
| Gamification (credits, harvest, streaks, daily goals, leaderboards) | No pushy engagement mechanics |
| Podcast, social/comments/community, token-analytics dashboards | Out of research scope |
| Live web/news/YouTube fetch in participant app | App runs on the frozen pool; collection is offline |
| Product polish beyond study needs | Judged as a research instrument, not a consumer app |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Pending |
| SHELL-02 | Phase 1 | Pending |
| SHELL-03 | Phase 1 | Pending |
| SHELL-04 | Phase 1 | Pending |
| LOG-01 | Phase 1 | Pending |
| RQ-01 | Phase 1 | Pending |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| CONT-03 | Phase 2 | Pending |
| FEED-01 | Phase 2 | Pending |
| FEED-02 | Phase 2 | Pending |
| ASK-01 | Phase 2 | Pending |
| GRAPH-01 | Phase 3 | Pending |
| GRAPH-02 | Phase 3 | Pending |
| GRAPH-03 | Phase 3 | Pending |
| RANK-01 | Phase 3 | Pending |
| RANK-02 | Phase 3 | Pending |
| RANK-03 | Phase 3 | Pending |
| RANK-04 | Phase 3 | Pending |
| RANK-05 | Phase 3 | Pending |
| RANK-06 | Phase 3 | Pending |
| RQ-02 | Phase 3 | Pending |
| STUDY-01 | Phase 4 | Pending |
| STUDY-02 | Phase 4 | Pending |
| STUDY-03 | Phase 4 | Pending |
| STUDY-04 | Phase 4 | Pending |
| RQ-03 | Phase 4 | Pending |
| STUDY-05 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-10 after new-project ingest bootstrap*
