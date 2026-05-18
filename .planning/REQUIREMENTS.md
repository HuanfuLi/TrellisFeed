# Trellis v1.6 Requirements: Control, Graph Trust, Retrieval, and Ethical Engagement

**Milestone:** v1.6
**Started:** 2026-05-13
**Status:** Active (overhauled 2026-05-15)
**Core Value:** Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition — all while maintaining complete local-first privacy.

## Origin

v1.6 is driven by 5 questions a professor asked after seeing a Trellis demo. Two of the questions get **private answers** (writeup / conversation, not product changes); three are **product features**.

| # | Question | Type | Coverage |
|---|----------|------|----------|
| Q1 | "How is the mind-map generated (inputs + grouping logic), and can users edit/correct it?" | Mixed | Generation explanation = **private** (writeup-only, see Out of Scope). Edit/correct = product → GRAPH + GRAPHUI. |
| Q2 | "What's the intended filtering logic and what's blocking it from working reliably during presentation?" | Mixed | Diagnosis = **private** (regex library is brittle). Fix = product → FILTER. |
| Q3 | "Can users control podcast length/style, and how do you keep quality consistent?" | Product | PODCAST. |
| Q4 | "Using 'dark' patterns: how do you balance engagement vs learning (stop cues, goals, reflection)?" | Product | LEARN. |
| Q5 | "Scroll is great for discovery — what supports retrieval later (search, bookmarks, tags, history, dashboards)?" | Product | RETRIEVE. |

## Active Requirements

### FILTER — Off-topic and malicious-prompt filtering (Phase 47)

The current `app/src/services/question-filter.service.ts` is a regex pattern library. It's the answer to professor Q2's "what's blocking reliability" — too brittle, false-positives on legitimate LLM/security questions, false-negatives on small talk that doesn't match the regex. v1.6 **replaces the approach**, not the thresholds.

- [ ] **FILTER-01** Replace the regex-based off-topic classifier with a more robust strategy. Candidate directions to evaluate during the phase: (a) LLM-only classifier (single prompt, structured output) running on every ask; (b) embedding-similarity to a curated bad-prompt corpus; (c) hybrid where regex stays as a much narrower fast-path for unambiguous cases (greetings, single-token spam) and LLM/embedding handles the rest. Final strategy chosen during the phase research/spike step, not pre-locked.
- [ ] **FILTER-02** Pre-LLM gate: classify the user prompt **before** sending it to the answer LLM. If the prompt is classified malicious/prompt-injection, the answer call is **not made** (the user sees a clear in-app message, no provider tokens spent). If classified off-topic, the answer is generated but the exchange does not enter mind map, review, feed, podcast context, retrieval index, or learning surfaces. If classified on-topic, the answer is generated and the exchange enters durable knowledge.
- [ ] **FILTER-03** Defense in depth — structural prompt-injection bracketing at the LLM/TTS provider boundary. User-supplied content sent to LLM (and any prompt-bearing TTS/embedding) providers is structurally bracketed/delimited at the provider wrapper so injection attempts in user content cannot override system instructions. Bracketing is enforced in the provider wrapper, not in individual call sites; goldens cover representative injection-style inputs.
- [ ] **FILTER-04** Held-out eval set with at least one labeled example per surfaced failure mode (small-talk false-negative such as "How are you doing?", legitimate-LLM-question false-positive such as "What is a system prompt?"). Eval set lives under version control and runs in the test suite; classifier strategy and prompts cannot regress on these examples without a documented waiver.
- [ ] **FILTER-05** User can override the off-topic flag on any individual exchange (existing per-question `flagged` toggle generalizes) so misclassifications are recoverable; the override persists across reloads and propagates to durable-knowledge consumers (graph, retrieval, podcast, review).

### GRAPH — Correctable knowledge graph data layer (Phase 48)

- [x] **GRAPH-01** Graph corrections run through a dedicated service boundary that validates commands, patches all affected `Question` records, writes durable state, records undo metadata, and emits graph update events.
- [x] **GRAPH-02** User can rename anchors/clusters and move/reassign anchors or Q&As while preserving parent IDs, labels, cluster IDs, counts, summaries, review links, and retrieval identity.
- [x] **GRAPH-03** User can merge duplicate anchors, detach misplaced Q&As, prune/delete graph nodes, and undo the last graph correction without losing source Q&A content.
- [x] **GRAPH-04** Manual graph corrections are protected from stale in-flight classification or global reorganization commits through structural revision or manual-lock metadata.

### GRAPHUI — Mind-map correction experience (Phase 49)

- [ ] **GRAPHUI-01** Graph screen exposes local correction controls for selected graph nodes (rename, move, merge, detach, prune/delete) without making MindElixir's internal tree the source of truth.
- [ ] **GRAPHUI-02** Graph correction UI provides clear preview/confirmation for high-impact actions such as merge, prune/delete, and undo.
- [ ] **GRAPHUI-03** User sees the corrected graph after navigation away, navigation back, or app reload.

### RETRIEVE — Search, tags, bookmarks, and concept dashboards (Phases 50–51)

- [ ] **RETRIEVE-01** User can search Saved, Liked, and History archive items by title, body, concept, source, and date, then reopen the original post.
- [ ] **RETRIEVE-02** User can tag or bookmark posts and concepts with local-first metadata that persists across days and supports filtering.
- [ ] **RETRIEVE-03** User can open a concept dashboard that joins the concept's Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals.
- [ ] **RETRIEVE-04** Retrieval surfaces are bounded and recovery-oriented: they prioritize search, filters, dashboards, and review actions rather than another infinite recommendation feed.

### PODCAST — Quality defaults and learner controls (Phase 52)

- [ ] **PODCAST-01** Default podcast generation produces a more specific, educationally useful recap with structured sections for recap, connections, misconception checks, retrieval questions, and next action.
- [ ] **PODCAST-02** User can choose podcast length and style before generation using bounded options such as Brief/Standard/Deep and Focused/Conversational/Review drill.
- [ ] **PODCAST-03** Podcast scripts/audio persist the chosen options, concept IDs, locale, and options hash so regeneration and cache reuse honor the learner's settings.
- [ ] **PODCAST-04** Podcast generation preserves required concept coverage across length/style settings; style controls cannot degrade learning density into entertainment-only output.
- [ ] **PODCAST-05** TTS configuration supports provider-safe model/voice/speed improvements where available, with fallback behavior and device UAT evidence before changing defaults.

### LEARN — Ethical engagement guardrails (Phase 53)

- [ ] **LEARN-01** User can set or accept a lightweight daily learning goal that frames feed progress around concepts learned, reviewed, reflected on, or corrected rather than posts consumed.
- [ ] **LEARN-02** When the learner reaches a meaningful threshold, Trellis shows a stop cue that routes to review, reflection, podcast, planner, or closing the app instead of endless scrolling.
- [ ] **LEARN-03** After meaningful engagement such as saved/liked/deep-read clusters, Trellis offers sparse retrieval/reflection prompts without interrupting every post.
- [ ] **LEARN-04** Ethical cues are user-controllable with snooze/disable behavior and Trellis does not introduce public likes, leaderboards, streak pressure, or engagement-maximizing loops.

### PRIVACY — Provider payload boundary (Phase 53)

- [ ] **PRIVACY-01** Provider-bound LLM and TTS payload tests confirm goals, reflection responses, tags, saved/liked/history, and graph correction logs are excluded from outbound provider requests by default. Goldens ship in the same phase as the LEARN fields they protect (no upfront sanitizer for fields that don't exist yet).

## Future Requirements

- **GRAPH-F01** AI-suggested graph corrections with learner approval, preview, and undo.
- **GRAPH-F02** Full graph version history beyond last-action undo.
- **RETRIEVE-F01** Advanced tag query language and saved searches.
- **RETRIEVE-F02** Cross-device retrieval/tag sync after privacy, auth, and conflict-resolution design.
- **PODCAST-F01** Podcast weak-concept focus that automatically balances due/weak concepts with learner-selected inclusions.
- **PODCAST-F02** Podcast chapters and interactive audio quizzes.
- **LEARN-F01** Weekly learning summary focused on recall, review, corrections, and reflections.
- **LEARN-F02** Personalized engagement model training, only if local-only, explainable, and explicitly consented.

## Out of Scope (v1.6)

| Feature | Reason |
|---------|--------|
| User-facing mind-map generation transparency (per-node "why was this placed here" panel, pipeline visualizer) | Professor Q1 generation half is a private answer (writeup/conversation). Users don't need this view; the prior agent over-translated the question into a product feature. |
| User-facing filter diagnosis surface (showing why a prompt was flagged) | Professor Q2 diagnosis half is a private answer. Users see results (rejected / answered / flagged), not the classifier's internal scoring. |
| Four-state ingestion triage UI (`Added to map` / `Chat only` / `Needs review` / `Security blocked`) | The two failure modes are precision/recall problems on the existing classifier, not missing categories. A richer state machine would multiply the same misclassifications across more buckets. |
| Prompt-leak intent classifier (verb-detector for "show/reveal/print system prompt") | Intent classification on safe verbs misclassifies legitimate learning questions about LLMs. Injection prevention is structural (FILTER-03 bracketing) plus the pre-LLM gate (FILTER-02), not behavioral. |
| Foundation phase with cross-cutting schema/migration/event/payload-boundary scaffolding | Optional `?:` fields don't need a migration framework; events already carry needed payloads; sanitizer ships with the fields it protects (PRIVACY-01 in Phase 53). Each feature phase adds its own optional fields. |
| Separate "learning metrics" tracking system distinct from engagement signals | Professor Q4 asked about balancing engagement vs learning (stop cues, goals, reflection) — not about a separate metrics dashboard. The prior agent's LEARN-04 ("metrics stay separate") was inferred, not requested. |
| Regex tuning of the existing question-filter pattern library | Operator: the current regex approach is "TOO reliant on regex" and "very ineffective." v1.6 replaces the approach (FILTER-01), not its thresholds. |
| Blocking harmless off-topic chat at presentation time | The problem is durable graph pollution, not whether chat can answer greetings or app-meta questions. |
| MindElixir as canonical graph persistence | Trellis graph state lives in `Question` records; MindElixir should remain a renderer/input surface. |
| Auto-merge graph nodes without learner approval | Wrong merges contaminate review, retrieval, podcasts, and source prompts. |
| Presentation-only graph filters for data hygiene | Hiding polluted nodes does not prevent review, podcast, or retrieval pollution. |
| Entertainment podcast personas | Style controls must preserve learning density and avoid distracting roleplay. |
| Public likes, leaderboards, social proof, or streak pressure | Conflicts with local-first privacy and the ethical engagement goal. |
| Cross-device sync in v1.6 | Requires separate privacy/auth/conflict-resolution milestone. |
| Backend analytics or external telemetry | Not needed for local-first learning guardrails and would undermine privacy expectations. |
| Vector database, graph database, LangChain/agent framework, or backend search | Existing local services plus MiniSearch/embeddings are enough for v1.6; large stack additions would distract from behavior. |

## Private Answers (writeup, not product)

Operator-managed memo for the professor; not tracked as requirements:

- **Q1a — Mind-map generation pipeline:** how questions flow through embedding → cluster classification → branch assignment → anchor attachment; deterministic vs LLM-driven steps; what happens when classification is uncertain. Lives in `.planning/notes/` if/when written.
- **Q2a — Filter failure diagnosis:** the existing regex pattern library bundles legitimate "what is a system prompt?" with leak attempts under one over-broad pattern (confidence 0.92); LLM fallback only runs for low-confidence cases. Diagnosis is the *motivation* for FILTER-01..05, but the diagnosis itself is not a product surface.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILTER-01 | Phase 47 | Pending |
| FILTER-02 | Phase 47 | Pending |
| FILTER-03 | Phase 47 | Pending |
| FILTER-04 | Phase 47 | Pending |
| FILTER-05 | Phase 47 | Pending |
| GRAPH-01 | Phase 48 | Validated (2026-05-17) |
| GRAPH-02 | Phase 48 | Validated (2026-05-17) |
| GRAPH-03 | Phase 48 | Validated (2026-05-17) |
| GRAPH-04 | Phase 48 | Validated (2026-05-17) |
| GRAPHUI-01 | Phase 49 | Pending |
| GRAPHUI-02 | Phase 49 | Pending |
| GRAPHUI-03 | Phase 49 | Pending |
| RETRIEVE-01 | Phase 50 | Pending |
| RETRIEVE-02 | Phase 50 | Pending |
| RETRIEVE-03 | Phase 51 | Pending |
| RETRIEVE-04 | Phase 51 | Pending |
| PODCAST-01 | Phase 52 | Pending |
| PODCAST-02 | Phase 52 | Pending |
| PODCAST-03 | Phase 52 | Pending |
| PODCAST-04 | Phase 52 | Pending |
| PODCAST-05 | Phase 52 | Pending |
| LEARN-01 | Phase 53 | Pending |
| LEARN-02 | Phase 53 | Pending |
| LEARN-03 | Phase 53 | Pending |
| LEARN-04 | Phase 53 | Pending |
| PRIVACY-01 | Phase 53 | Pending |

**Coverage:**
- v1.6 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-05-13*
*Overhauled: 2026-05-15 — dropped invented FOUNDATION phase (FOUND-01..05 dissolved); replaced INGEST-01..04 (regex-tuning framing) with FILTER-01..05 (replace-the-approach + pre-LLM gate + structural bracketing); dropped LEARN-04 (separate-metrics, invented); renumbered LEARN-05 → LEARN-04; added PRIVACY-01 (sanitizer ships with fields it protects). Mind-map generation transparency moved to Out of Scope (private answer). Total requirements: 30 → 26. Phase count: 8 → 7.*
