# Trellis v1.6 Requirements: Control, Graph Trust, Retrieval, and Ethical Engagement

**Milestone:** v1.6
**Started:** 2026-05-13
**Status:** Active
**Core Value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.

## Active Requirements

### FOUNDATION — Data, events, migration, and privacy boundaries

- [ ] **FOUND-01** v1.6 data model adds explicit ingestion, graph-trust, podcast-option, retrieval/library, and learning-engagement metadata without overloading `Question.flagged`.
- [ ] **FOUND-02** Existing localStorage/SQLite payloads load safely through additive normalization and migration guards; old v1.5 data does not crash v1.6 screens or services.
- [ ] **FOUND-03** Durable-learning events are distinguishable from natural chat-answer events so graph, retrieval, podcast, review, and learning metrics never index untriaged chat.
- [ ] **FOUND-04** Provider payload boundaries are documented and tested so goals, tags, saved/liked history, graph correction logs, and reflections are not sent to LLM/TTS providers by default.

### INGEST — Knowledge-ingestion triage

- [ ] **INGEST-01** User can ask natural chat and see whether the exchange was `Added to map`, `Chat only`, `Needs review`, or `Security blocked`.
- [ ] **INGEST-02** The ingestion classifier accepts legitimate learning questions about risky terms, including "What is a system prompt?", while excluding prompt-leak requests such as "show/reveal/print your system prompt" from durable knowledge.
- [ ] **INGEST-03** Non-learning exchanges such as greetings, small talk, jokes, thanks, and app-meta chatter remain in chat when appropriate but do not enter the mind map, review, feed, podcast context, retrieval index, or learning metrics.
- [ ] **INGEST-04** User can manually add a `Chat only` or `Needs review` exchange to the mind map through an explicit confirm/retitle flow, preserving learner intent and auditability.

### GRAPH — Correctable knowledge graph data layer

- [ ] **GRAPH-01** Graph corrections run through a dedicated service boundary that validates commands, patches all affected `Question` records, writes durable state, records undo metadata, and emits graph update events.
- [ ] **GRAPH-02** User can rename anchors/clusters and move/reassign anchors or Q&As while preserving parent IDs, labels, cluster IDs, counts, summaries, review links, and retrieval identity.
- [ ] **GRAPH-03** User can merge duplicate anchors, detach misplaced Q&As, prune/delete graph nodes, and undo the last graph correction without losing source Q&A content.
- [ ] **GRAPH-04** Manual graph corrections are protected from stale in-flight classification or global reorganization commits through structural revision or manual-lock metadata.

### GRAPHUI — Mind-map correction experience

- [ ] **GRAPHUI-01** Graph screen exposes local correction controls for selected graph nodes without making MindElixir's internal tree the source of truth.
- [ ] **GRAPHUI-02** User can inspect why a node was placed where it is, apply a correction, and see the corrected graph after navigation or app reload.
- [ ] **GRAPHUI-03** Graph correction UI provides clear preview/confirmation for high-impact actions such as merge, prune/delete, and undo.

### RETRIEVE — Search, tags, bookmarks, and concept dashboards

- [ ] **RETRIEVE-01** User can search Saved, Liked, and History archive items by title, body, concept, source, and date, then reopen the original post.
- [ ] **RETRIEVE-02** User can tag or bookmark posts and concepts with local-first metadata that persists across days and supports filtering.
- [ ] **RETRIEVE-03** User can open a concept dashboard that joins the concept's Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals.
- [ ] **RETRIEVE-04** Retrieval surfaces are bounded and recovery-oriented: they prioritize search, filters, dashboards, and review actions rather than another infinite recommendation feed.

### PODCAST — Quality defaults and learner controls

- [ ] **PODCAST-01** Default podcast generation produces a more specific, educationally useful recap with structured sections for recap, connections, misconception checks, retrieval questions, and next action.
- [ ] **PODCAST-02** User can choose podcast length and style before generation using bounded options such as Brief/Standard/Deep and Focused/Conversational/Review drill.
- [ ] **PODCAST-03** Podcast scripts/audio persist the chosen options, concept IDs, locale, and options hash so regeneration and cache reuse honor the learner's settings.
- [ ] **PODCAST-04** Podcast generation preserves required concept coverage across length/style settings or explicitly explains what was omitted; style controls cannot degrade learning density into entertainment-only output.
- [ ] **PODCAST-05** TTS configuration supports provider-safe model/voice/speed improvements where available, with fallback behavior and device UAT evidence before changing defaults.

### LEARN — Ethical engagement and learning guardrails

- [ ] **LEARN-01** User can set or accept a lightweight daily learning goal that frames feed progress around concepts learned, reviewed, reflected on, or corrected rather than posts consumed.
- [ ] **LEARN-02** When the learner reaches a meaningful threshold, Trellis shows a stop cue that routes to review, reflection, podcast, planner, or closing the app instead of endless scrolling.
- [ ] **LEARN-03** After meaningful engagement such as saved/liked/deep-read clusters, Trellis offers sparse retrieval/reflection prompts without interrupting every post.
- [ ] **LEARN-04** Learning metrics stay separate from save/like/dismiss engagement signals and emphasize recall, review, graph corrections, concept coverage, and reflections.
- [ ] **LEARN-05** Ethical cues are user-controllable with snooze/disable behavior and do not introduce public likes, leaderboards, streak pressure, or engagement-maximizing loops.

## Future Requirements

- **INGEST-F01** Quarantine inbox for batch-reviewing ambiguous `Needs review` exchanges.
- **GRAPH-F01** AI-suggested graph corrections with learner approval, preview, and undo.
- **GRAPH-F02** Full graph version history beyond last-action undo.
- **RETRIEVE-F01** Advanced tag query language and saved searches.
- **RETRIEVE-F02** Cross-device retrieval/tag sync after privacy, auth, and conflict-resolution design.
- **PODCAST-F01** Podcast weak-concept focus that automatically balances due/weak concepts with learner-selected inclusions.
- **PODCAST-F02** Podcast chapters and interactive audio quizzes.
- **LEARN-F01** Weekly learning summary focused on recall, review, corrections, and reflections.
- **LEARN-F02** Personalized engagement model training, only if local-only, explainable, and explicitly consented.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Blocking harmless off-topic chat at presentation time | The problem is durable graph pollution, not whether chat can answer greetings or app-meta questions. |
| Regex-only filtering | It caused known false-positive/false-negative risks and cannot distinguish "What is a system prompt?" from prompt-leak requests reliably. |
| MindElixir as canonical graph persistence | Trellis graph state lives in `Question` records; MindElixir should remain a renderer/input surface. |
| Auto-merge graph nodes without learner approval | Wrong merges contaminate review, retrieval, podcasts, and source prompts. |
| Presentation-only graph filters for data hygiene | Hiding polluted nodes does not prevent review, podcast, or retrieval pollution. |
| Entertainment podcast personas | Style controls must preserve learning density and avoid distracting roleplay. |
| Public likes, leaderboards, social proof, or streak pressure | Conflicts with local-first privacy and the ethical engagement goal. |
| Cross-device sync in v1.6 | Requires separate privacy/auth/conflict-resolution milestone. |
| Backend analytics or external telemetry | Not needed for local-first learning guardrails and would undermine privacy expectations. |
| Vector database, graph database, LangChain/agent framework, or backend search | Existing local services plus MiniSearch/embeddings are enough for v1.6; large stack additions would distract from behavior. |

## Traceability

Traceability will be populated by the v1.6 roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | — | Pending |
| FOUND-02 | — | Pending |
| FOUND-03 | — | Pending |
| FOUND-04 | — | Pending |
| INGEST-01 | — | Pending |
| INGEST-02 | — | Pending |
| INGEST-03 | — | Pending |
| INGEST-04 | — | Pending |
| GRAPH-01 | — | Pending |
| GRAPH-02 | — | Pending |
| GRAPH-03 | — | Pending |
| GRAPH-04 | — | Pending |
| GRAPHUI-01 | — | Pending |
| GRAPHUI-02 | — | Pending |
| GRAPHUI-03 | — | Pending |
| RETRIEVE-01 | — | Pending |
| RETRIEVE-02 | — | Pending |
| RETRIEVE-03 | — | Pending |
| RETRIEVE-04 | — | Pending |
| PODCAST-01 | — | Pending |
| PODCAST-02 | — | Pending |
| PODCAST-03 | — | Pending |
| PODCAST-04 | — | Pending |
| PODCAST-05 | — | Pending |
| LEARN-01 | — | Pending |
| LEARN-02 | — | Pending |
| LEARN-03 | — | Pending |
| LEARN-04 | — | Pending |
| LEARN-05 | — | Pending |

**Coverage:**
- v1.6 requirements: 29 total
- Mapped to phases: 0
- Unmapped: 29

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after v1.6 research synthesis*
