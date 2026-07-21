# Phase 3: Graph-memory + recommendation engine - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the study's core treatment: the two-layer graph (global content graph §10.4 + personal graph-memory with `UserConceptState` §10.5), question→concept/claim extraction (GRAPH-03/§17.2), the non-personal control ranker (§11.7) and the experimental graph-memory ranker (§11.3 formula, seven §11.4 components, configurable weights), the five orchestration strategies (§11.5 continue/deepen/contrast/bridge/echo), diversity reranking (§11.6), interpretable recommendation reasons (RANK-05/§17.4/§7.7), and the §12.3 algorithm-verification tests. Domain schemas from Phase 2 are consumed as-is; the formulas, weights, edge types, and strategy set are locked field-for-field in RSD §10–§11 and are NOT re-decided here. No new pruned features, no ranking beyond §11, no live fetch. This phase replaces the transitional AI-generated feed ordering machinery entirely.

</domain>

<decisions>
## Implementation Decisions

### Graph-memory substrate
- **D-01:** The **global content-graph edges (§10.4)** are computed offline in `tools/content_pipeline/` and **frozen into the pool** (`data/content_pool_v1/`) — deterministic, identical for every participant, zero in-app graph/embedding compute. The app imports a ready-made global graph. *(Cross-phase seam: the Phase 2 exporter, or a Phase 3 addition to that pipeline, must emit the §10.4 global edges into the frozen pool. Flag this to Phase 2 planning if not already covered.)*
- **D-02:** The **personal §10.6 concept-weight / `UserConceptState` updates are event-driven and incremental** — each logged `UserInteractionEvent` (Phase 1) applies its §10.6 delta immediately and persists; feed refresh reads current state. Replayable/reconstructable from the durable interaction log. Fits the no-refresh/event-bus architecture.
- **D-03:** The **raw interaction log + questions remain the canonical exported data** (source of truth, Phase 4 STUDY-03), AND the personal graph-memory / `UserConceptState` is kept **serializable so a snapshot can also be dumped** for analysis (belt-and-suspenders for RQ2; captures what the ranker actually saw). Snapshot is derivable from the log.

### Question extraction (GRAPH-03)
- **D-04:** Extraction runs **async, immediately after the Ask answer streams** — the answer UX is unchanged (no added latency); extraction fires as a background job that updates the graph via the event bus. Extraction failure degrades gracefully (the question simply contributes no edges / retried); it never blocks or fails the answer.
- **D-05:** **`unresolved` is set once by the §17.2 extraction LLM and does NOT auto-clear** in Phase 3. Echo's aged-threshold (§11.5) gates reuse. Chosen for determinism and §12.3 verifiability. *(Behavioral auto-clearing is a deferred enhancement — see Deferred Ideas.)*

### Recommendation reasons (RANK-05)
- **D-06:** **Experimental `reasonText` is LLM-generated** via the §17.4 prompt. The **contributing question/concept/post trace IDs are attached structurally to the `Recommendation` record** — that structured attachment (not the prose) is what §12.3 "reasons include contributing trace IDs" verifies. The LLM is given the traces and must reference them; the record stores the IDs regardless of the prose.
- **D-07:** The reason is **generated once at recommendation creation and persisted** on the `Recommendation` record; re-renders read the stored text (no repeat LLM calls). Captures exactly what the participant saw (reproducible) and amortizes cost per batch.
- **D-08:** **Control reasons come from a small fixed non-personal label vocabulary, no LLM** ("Related to {topic-concept}", "Popular explanation", "Different viewpoint" — §7.7). Filled only from non-personal/topic-level data. This structurally guarantees `DEC-control-no-question-history`. Reason-quality asymmetry between conditions is correct and intended (reasons ARE part of the treatment; only *Ask* quality must match per `DEC-both-conditions-ask`).

### Cold-start & feed wiring
- **D-09:** The experimental feed **always runs the single §11.3 formula**; at cold start (no traces) QuestionRelevance/ConceptInterestMatch/Echo contribute ~0, so ContentQuality/DifficultyFit/Novelty dominate and the feed resembles control until traces accumulate. **No special-case fallback, no mode switch, no threshold** — the feed warms up organically (avoids a mid-study discontinuity confound).
- **D-10:** **A single recommendation/feed service is the sole source of feed items.** It reads the study-context condition and routes internally to the control ranker or the experimental ranker, emitting `Recommendation` records + reasons either way. The Phase 2 feed UI renders whatever it returns. One serving seam → easiest to test control isolation (§12.3) and keep both conditions rendering-identical.
- **D-11:** Ranking is **batched per session start and per swipe-for-more**: score candidates and materialize a batch of `Recommendation` records (strategy + reason) reading current graph-memory state. Mirrors the existing feed batching cadence, gives a stable persisted snapshot of what was served, amortizes LLM reason calls per batch.
- **D-12:** The transitional **concept-feed / post-queue / style-assignment / feed-spread / refill-mutex shell is REMOVED** once the recommendation service is wired and green — done as a guarded sweep (grep every caller/test first) within Phase 3. Nothing in Phase 3+ reuses the three-list/cyclic-queue machinery; leaving it dormant would be exactly the dead transitional residue the Phase 1 sweep exists to prevent, and its source-reading tests are a false-green risk.

### Claude's Discretion
- **Personal graph-memory substrate structure** — whether §10.3/§10.4 personal nodes+edges (ActivatedConcept, MemoryEchoCandidate, InterestTrajectorySegment, etc.) land as fresh dedicated stores or extend the existing `canonical-knowledge` anchor/cluster infra. **Hard constraint:** the result must satisfy the locked §9/§10 schemas field-for-field and expose the named edges the §12.3 verification tests read. Reuse the existing embedding/classification machinery to populate whatever structure is chosen.
- **Extraction mechanism** — reuse the existing classification pipeline vs a dedicated §17.2 extraction call, and how concepts/claims are resolved. **Hard constraint:** `extractedConceptIds`/`extractedClaimIds` MUST resolve to real frozen-pool concept/claim IDs (orphan concepts with no pool edges are useless to QuestionRelevance/contrast scoring).
- **§7.7 exploration-path chip list** — whether to build it in Phase 3. Leaning **defer to the Phase 4 study-UI pass** (it's optional per §7.7, experimental-only, and unblocked by any RANK requirement); planner may fold it in if cheap alongside reasons.
- **Ranker weight configuration surface, candidate-generation/dedup internals, embedding reuse specifics, DifficultyFit/RedundancyPenalty thresholds, §12.2 human recommendation-validation scoping (Phase 3 vs Phase 4 pilot).**

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Graph-memory, ranking, and verification (the locked spec surface)
- `docs/research_system_design.md` §10 (all) — two-layer graph, global/personal nodes, §10.4 edge types (verbatim), §10.5 `UserConceptState`, §10.6 weight-update rules.
- `docs/research_system_design.md` §11 (all) — §11.2 candidate generation, §11.3 experimental scoring formula + weights, §11.4 seven component definitions, §11.5 five orchestration strategies, §11.6 diversity reranking, §11.7 control formula + the explicit "control must NOT use" list.
- `docs/research_system_design.md` §12 (all) — §12.1/§12.2 human validation, §12.3 the six required algorithm-verification unit tests (RANK-06).
- `docs/research_system_design.md` §9.6–§9.8 — `UserQuestion` (incl. `extractedConceptIds/extractedClaimIds/questionType/unresolved`), `AIAnswer`, `UserInteractionEvent` (field-for-field).
- `docs/research_system_design.md` §17.2 (question extraction prompt), §17.3 (contextual answer prompt — note the "user prior question traces, if experimental" input line), §17.4 (recommendation reason prompt).
- `docs/research_system_design.md` §7.7 — knowledge-graph visibility ceiling: per-recommendation rationale + optional exploration-path chip; NO full/editable graph.
- **Note:** `Documents/QuestionTrace_Research_System_Design.md` is a **byte-identical duplicate** of the canonical `docs/research_system_design.md`. Per CLAUDE.md, `docs/research_system_design.md` is authoritative; the `Documents/` copy risks drift and should be treated as non-canonical (candidate for removal — flag to operator).

### Scope, framing, and locked decisions
- `docs/SCOPE.md` — locked scope contract; no pruned features, no live fetch.
- `.planning/PROJECT.md` — locked decisions: `DEC-control-no-question-history`, `DEC-both-conditions-ask`, `DEC-pruned-features-frozen`, `DEC-framing-rules` (never "knowledge graph recommendation" → "graph-memory orchestration from curiosity question traces").
- `.planning/REQUIREMENTS.md` — Phase 3 requirements GRAPH-01/02/03, RANK-01…06, RQ-02.
- `.planning/ROADMAP.md` — Phase 3 success criteria; five-coarse-phase lock.
- `CLAUDE.md` — load-bearing invariants: IndexedDB persistence seam (assert through `dbQuery`, false-green risk), event bus / `GRAPH_UPDATED` unification, PostDetail `CONCEPT_EXPLORED` detectors (interaction-log seed — extend, don't fork), concept-feed three-list pipeline (this phase removes it), no-refresh reactive re-read rule, classification dedup + anchor normalization.

### Phase carry-ins
- `.planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md` — condition plumbing (`study-context.service`), `UserInteractionEvent` logging (§14.1), upload queue — the personal graph-memory feeds off these events.
- `.planning/phases/02-content-pool-feed-post-ui-on-frozen-data/02-CONTEXT.md` — frozen pool + feed/post UI + persisted `UserQuestion`/`AIAnswer` this ranker consumes; the concept-feed shell retirement teed up here as discretion is now decided (D-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/services/canonical-knowledge.service.ts` — existing anchor/cluster classification with embedding vectors + `classifyAndAnchorIncremental` (O(N) cosine pre-check then LLM tree descent). Candidate substrate/populator for personal concepts and for question→concept extraction (D-04, and the substrate discretion item).
- `app/src/services/question.service.ts` — question node persistence (`insertNode`/`replaceAll` write-through to IndexedDB); `UserQuestion` extension surface.
- `app/src/services/question-filter.service.ts` — dual-vector embedding scoring already embeds question vectors; reusable for QuestionRelevance/redundancy cosine work.
- `app/src/services/interaction-log.service.ts` (Phase 1) — event source that drives D-02 incremental weight updates.
- `app/src/services/study-context.service.ts` (Phase 1) — condition value the single recommendation service branches on (D-10).
- `app/src/services/db.service.ts` — `dbQuery`/`dbExecute` seam; all new graph/state/Recommendation stores go through it; **tests must assert durability through `dbQuery`, not in-memory mirrors** (CLAUDE.md false-green warning).
- `app/src/lib/event-bus.ts` + `GRAPH_UPDATED` — reactive re-read; the async extraction (D-04) and incremental weight updates emit here so always-mounted feed re-reads.

### Established Patterns
- `ServiceResult<T>` for services; inline styles + CSS vars for any reason/chip UI; 4-locale parity for every visible string (reason UI labels localize; content stays English per Phase 1 D-06).
- One event per semantic moment — extend `GRAPH_UPDATED` with a payload field rather than adding a parallel event for graph-memory mutations.
- Capacitor no-refresh — every graph/feed mutation must be event-bus driven.

### Integration Points
- New single recommendation/feed service (D-10) replaces the post-queue walker as the feed's source; emits `Recommendation` records (D-07/D-11) that the Phase 2 feed UI renders.
- Personal graph-memory + `UserConceptState` stores + Recommendation store are new IndexedDB stores via the `db.service` seam.
- §12.3 algorithm-verification tests (RANK-06) are new `node --test` suites; the control-isolation test is load-bearing (enforces `DEC-control-no-question-history`).
- Guarded removal sweep (D-12) touches: `concept-feed.service`, `post-queue.service`, `style-assignment`, `feed-spread`, `refill-mutex`, `daily-read` (feed portions), and their tests — grep every caller first.

</code_context>

<specifics>
## Specific Ideas

- The isolated experimental variable is graph-memory orchestration ONLY — the single-service branch (D-10) and the fixed-label control reasons (D-08) are the two structural guards that keep control provably free of question history.
- §12.3's "experimental reasons include contributing trace IDs" is satisfied by the structured `Recommendation` trace-ID fields (D-06), so LLM prose nondeterminism does not threaten the test.
- Cold-start "warm-up" (D-09) is a feature to describe in the study writeup, not a bug — the experimental feed diverging from control *as questions accumulate* is the treatment taking effect.

</specifics>

<deferred>
## Deferred Ideas

- **Behavioral auto-clearing of `unresolved`** (clears when the user explores a resolving post / asks a deeper follow-up / saves related content) — a realistic open-loop model, but adds nondeterminism and audit complexity beyond pilot needs. Revisit post-pilot.
- **§7.7 exploration-path chip list** (experimental-only "AI agents → tool use → reliability" path) — optional per §7.7; leaning to the Phase 4 study-UI pass since it's an experimental-only between-condition UI affordance worth deciding deliberately.
- **§12.2 human recommendation validation** (synthetic/pilot histories reviewed for relevance/reason-correctness/strategy-fit) — the *automated* §12.3 tests are in Phase 3 (RANK-06); the human sanity-check may sit better in the Phase 4 pilot. Planner to scope.
- **Ranker weight tuning affordance** (researcher-facing config surface) — weights are configurable per §11.3; a tuning UI/harness beyond config defaults is not required for the pilot.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 3-Graph-memory + recommendation engine*
*Context gathered: 2026-07-11*
