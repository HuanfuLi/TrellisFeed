# Phase 3: Graph-memory + recommendation engine - Research

**Researched:** 2026-07-17
**Domain:** Local-first two-layer graph memory, condition-isolated ranking, persisted recommendation batches
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### the agent's Discretion

- **Personal graph-memory substrate structure** — whether §10.3/§10.4 personal nodes+edges (ActivatedConcept, MemoryEchoCandidate, InterestTrajectorySegment, etc.) land as fresh dedicated stores or extend the existing `canonical-knowledge` anchor/cluster infra. **Hard constraint:** the result must satisfy the locked §9/§10 schemas field-for-field and expose the named edges the §12.3 verification tests read. Reuse the existing embedding/classification machinery to populate whatever structure is chosen.
- **Extraction mechanism** — reuse the existing classification pipeline vs a dedicated §17.2 extraction call, and how concepts/claims are resolved. **Hard constraint:** `extractedConceptIds`/`extractedClaimIds` MUST resolve to real frozen-pool concept/claim IDs (orphan concepts with no pool edges are useless to QuestionRelevance/contrast scoring).
- **§7.7 exploration-path chip list** — whether to build it in Phase 3. Leaning **defer to the Phase 4 study-UI pass** (it's optional per §7.7, experimental-only, and unblocked by any RANK requirement); planner may fold it in if cheap alongside reasons.
- **Ranker weight configuration surface, candidate-generation/dedup internals, embedding reuse specifics, DifficultyFit/RedundancyPenalty thresholds, §12.2 human recommendation-validation scoping (Phase 3 vs Phase 4 pilot).**

### Deferred Ideas (OUT OF SCOPE)

- **Behavioral auto-clearing of `unresolved`** (clears when the user explores a resolving post / asks a deeper follow-up / saves related content) — a realistic open-loop model, but adds nondeterminism and audit complexity beyond pilot needs. Revisit post-pilot.
- **§7.7 exploration-path chip list** (experimental-only "AI agents → tool use → reliability" path) — optional per §7.7; leaning to the Phase 4 study-UI pass since it's an experimental-only between-condition UI affordance worth deciding deliberately.
- **§12.2 human recommendation validation** (synthetic/pilot histories reviewed for relevance/reason-correctness/strategy-fit) — the *automated* §12.3 tests are in Phase 3 (RANK-06); the human sanity-check may sit better in the Phase 4 pilot. Planner to scope.
- **Ranker weight tuning affordance** (researcher-facing config surface) — weights are configurable per §11.3; a tuning UI/harness beyond config defaults is not required for the pilot.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRAPH-01 | Global content graph with all §10.4 global edge types. | Add typed `sources.json`, `global_edges.json`, and frozen ranking features before the first immutable pool freeze; validate edge endpoints and expose type-indexed repository queries. [VERIFIED: `docs/research_system_design.md` §10.2–§10.4; `tools/content_pipeline/src/freeze/build.ts`] |
| GRAPH-02 | Personal graph-memory plus field-exact `UserConceptState` updates. | Use dedicated derived stores, an idempotent per-event contribution ledger, incremental affected-concept reduction, replay from `research_records`, and a serializable snapshot. [VERIFIED: `docs/research_system_design.md` §9.8, §10.3–§10.6] |
| GRAPH-03 | Populate question concept/claim IDs, type, and unresolved state. | Run a durable background §17.2 extraction job after completed Ask persistence; accept only real same-topic frozen IDs and patch the canonical `user_questions` row. [VERIFIED: `docs/research_system_design.md` §9.6, §17.2; `app/src/services/post-qa.service.ts`] |
| RANK-01 | Strong non-personal control formula with no question history. | Give the control branch a narrow dependency type containing static pool features plus allowed seen/dismissed session state; branch before any personal-store read and test with throwing spies and byte-equal outputs. [VERIFIED: `docs/research_system_design.md` §11.7] |
| RANK-02 | Experimental §11.3 score with seven §11.4 components and configurable weights. | Implement pure normalized component functions and inject one immutable code/build configuration object; no participant tuning UI is needed. [VERIFIED: `docs/research_system_design.md` §11.3–§11.4] |
| RANK-03 | Exactly one continue/deepen/contrast/bridge/echo strategy per experimental item. | Accumulate per-candidate strategy evidence, choose one by maximum affinity plus stable tie-break order, and persist the selected strategy with its evidence IDs. [VERIFIED: `docs/research_system_design.md` §11.5] |
| RANK-04 | §11.6 diversity constraints. | Use a deterministic greedy selector over score-sorted candidates, carrying per-session source counts and recent primary concepts across batches; reserve a contrast/bridge slot after sufficient history. [VERIFIED: `docs/research_system_design.md` §11.6] |
| RANK-05 | Persisted interpretable reasons and structured contributors. | Generate experimental reasons only after selection, validate one-sentence plain text, persist once, and render the same reason surface in both conditions; control labels never invoke the LLM. [VERIFIED: `docs/research_system_design.md` §7.7, §9.9, §17.4] |
| RANK-06 | Six §12.3 algorithm-verification tests. | Use executable fixtures and `dbQuery` assertions for persisted graph/recommendation records; remove source-reading tests that pin the retired shell. [VERIFIED: `docs/research_system_design.md` §12.3; `CLAUDE.md` “Heavy stores”] |
| RQ-02 | Question counts, depth/types, concepts, unresolved counts, and repeated concepts remain measurable. | Re-project the revised canonical question after extraction so local records—and the existing upload/wire contract when extended—carry extraction fields, while raw questions remain authoritative. [VERIFIED: `.planning/REQUIREMENTS.md`; `app/src/services/interaction-log.service.ts`] |
</phase_requirements>

## Summary

Phase 3 should not extend the old anchor/cluster graph as its storage substrate. That store models legacy `Question` containers, can create new mutable anchor IDs, and is persisted in the generic `questions` table; the RSD treatment instead needs frozen-pool concept/claim identities, explicit named personal edges, field-exact `UserConceptState` rows, deterministic replay, and recommendation snapshots. Reuse the existing provider, embedding/cosine, normalization, event bus, and `dbQuery` seams, but put the Phase 3 domain in fresh dedicated repositories. [VERIFIED: `app/src/types/index.ts`; `app/src/services/canonical-knowledge.service.ts`; `docs/research_system_design.md` §9–§10]

The first plan must close a Phase 2 prerequisite gap. `data/content_pool_v1/` is absent; the active run has 82 normalized/preprocessed/Codex-review files but no `review/decisions.jsonl`; the exporter currently writes only untyped `post_concept_edges.json` and `post_claim_edges.json` helper files, while the app bundle reader imports neither. It does not emit sources, `explains` versus `mentions`, `supports` versus `challenges`, claim contrasts, concept relations, or a stable primary-concept/format feature. Because a frozen pool is immutable, typed global graph and ranker-feature artifacts must land before the first approved freeze, not be patched into a frozen v1 afterward. [VERIFIED: `data/content_pool_v1/` absent; `tools/content_pipeline/runs/pilot-v1-20260716/`; `tools/content_pipeline/src/freeze/build.ts`; `app/src/data/content-pool-bundle.ts`]

The runtime should materialize stable batches, not maintain another queue. One recommendation service begins/recovers a session batch, branches on `studyContextService.getRequired().condition` before reading personal state, delegates to pure control or experimental rankers, diversity-selects, generates reasons only for selected experimental items, and persists field-exact `Recommendation` rows plus separate batch metadata. The current Home bottom-pull becomes “append next persisted recommendation batch.” Existing cards gain a shared reason surface and recommendation ID, while Post Detail keeps condition-neutral Ask quality. [VERIFIED: `.planning/phases/03-graph-memory-recommendation-engine/03-CONTEXT.md` D-06–D-11; `app/src/screens/HomeScreen.tsx`; `app/src/screens/PostDetailScreen.tsx`]

**Primary recommendation:** Plan four implementation waves: (1) frozen typed global graph/ranking features and importer, (2) durable extraction plus replayable personal graph, (3) pure rankers/strategies/diversity and persisted recommendation batches/reasons, then (4) Home wiring, algorithm-verification tests, and the guarded D-12 retirement sweep. [VERIFIED: locked D-01–D-12 and dependency analysis above]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Global graph compilation | Offline build tooling | Static artifact | It must be deterministic, reviewed, versioned, and identical for all installations. [VERIFIED: D-01; RSD §10.1] |
| Global graph/ranking-feature import | Database / Storage | Browser / Client | The packaged artifact is validated and imported into IndexedDB before participant routes render. [VERIFIED: `app/src/services/content-pool.repository.ts`] |
| Question extraction | Browser / Client service | External configured LLM/embedding provider | The client owns the canonical question and frozen ID allowlist; the provider only proposes a strict mapping. [VERIFIED: D-04; RSD §17.2] |
| Personal graph and concept state | Database / Storage | Browser / Client service | Derived state must persist, replay, serialize, and update immediately from durable events. [VERIFIED: D-02–D-03] |
| Control/experimental scoring | Browser / Client pure domain logic | Database / Storage | Ranking is local over the frozen pool and durable state; pure functions make isolation and formula tests executable. [VERIFIED: RSD §11] |
| Diversity and session batching | Browser / Client service | Database / Storage | Selection uses cumulative session constraints and persists the exact served snapshot. [VERIFIED: D-11; RSD §11.6] |
| Experimental reason generation | Browser / Client service | External configured LLM provider | Only selected items call §17.4; the client validates text and persists structured contributors. [VERIFIED: D-06–D-07] |
| Feed/reason rendering | Browser / Client UI | — | Home renders recommendation view models identically across conditions and logs reason views. [VERIFIED: D-10; RSD §7.7] |

## Project Constraints (from AGENTS.md)

- Treat `docs/research_system_design.md` as the canonical implementation guide, `docs/SCOPE.md` as the fixed scope boundary, and never reintroduce §15.3 product features. [VERIFIED: `AGENTS.md`]
- Read and preserve CLAUDE.md load-bearing rules around the feed pipeline, IndexedDB, question filter, navigation shell, and headers; Phase 3 specifically must use `dbQuery` persistence assertions and the unified `GRAPH_UPDATED` event. [VERIFIED: `AGENTS.md`; `CLAUDE.md`]
- Put app services in `app/src/services/`, domain utilities in `app/src/lib/` or focused domain modules, routed UI in `app/src/screens/`, and tests by area under `app/tests/`. [VERIFIED: `AGENTS.md`]
- Match existing TypeScript functional/service style, use inline CSS-variable styles for UI, keep one responsibility per service, and use PascalCase for components plus camel/kebab conventions already established. [VERIFIED: `AGENTS.md`]
- Use Node's built-in test runner and `assert/strict`; prefer executable code-path tests, mock all AI calls, and assert persistence through `dbQuery` rather than mirrors. [VERIFIED: `AGENTS.md`]
- Run `npm test`, `npm run lint`, and `npm run build` from `app/`; run the content-pipeline test/build gates when its artifacts change. [VERIFIED: `AGENTS.md`; `tools/content_pipeline/package.json`]
- Keep docs/roadmaps aligned with shipped behavior, but treat `openspec/` and inherited Trellis planning history as history rather than live state. The four project OpenSpec skills were inspected and add no Phase 3 implementation convention. [VERIFIED: `AGENTS.md`; `.claude/skills/*/SKILL.md`]

## Standard Stack

### Core

| Library / seam | Version | Purpose | Why Standard Here |
|----------------|---------|---------|-------------------|
| TypeScript | 5.9.3 | Field-exact domain types, discriminated edges, pure ranker functions | Already locked and installed in both app and pipeline; no new runtime abstraction is needed. [VERIFIED: `app/package.json`; `tools/content_pipeline/package-lock.json`] |
| React | 19.2.6 | Home feed and reason rendering | Existing Phase 2 UI seam; Phase 3 should pass recommendation view models into the existing component hierarchy. [VERIFIED: `app/package.json`; `app/src/components/MasonryFeed.tsx`] |
| IndexedDB via `dbExecute`/`dbQuery` | internal seam, IDB v5 today | Global graph, derived personal state, jobs, recommendations, and batch metadata | It is the single browser/Capacitor backend and has a Node fallback with the same SQL subset. [VERIFIED: `app/src/services/db.service.ts`] |
| Existing LLM provider facade | internal `chatCompletion` with `jsonMode` | §17.2 extraction and §17.4 reason generation | Supports all configured providers without a new SDK and already carries consent/config behavior. [VERIFIED: `app/src/providers/llm/index.ts`] |
| Existing embedding facade | internal `embedText`/`cosine` | Question vectors, frozen-vector comparison, similarity tests | Reuses per-session caching and provider configuration; frozen vectors must carry an exact model fingerprint. [VERIFIED: `app/src/providers/embedding/index.ts`] |

### Supporting

| Library / seam | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Node test runner | Node 22.19.0 | Pure algorithm, repository, and integration tests | Every task; targeted tests complete well below 30 seconds. [VERIFIED: environment probe; `app/scripts/run-tests.mjs`] |
| fake-indexeddb | 6.2.5 | Execute real IndexedDB persistence paths in Node | Repository durability, upgrade, replay, and `dbQuery` tests. [VERIFIED: `app/package.json`; targeted tests] |
| Ajv | 8.20.0, pipeline only | Frozen artifact/schema validation | Keep typed graph artifact validation in `tools/content_pipeline/`; do not add it to the app merely for two small LLM response parsers. [VERIFIED: `tools/content_pipeline/package.json`] |
| Event bus | internal | `GRAPH_UPDATED` re-read signal | Emit after committed extraction/personal-graph mutations; extend its payload kind rather than adding a parallel graph event. [VERIFIED: `CLAUDE.md`; `app/src/lib/event-bus.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated personal graph stores | Legacy canonical anchor/cluster store | Reuse appears cheaper, but it creates mutable non-pool anchor IDs and cannot expose RSD personal edge types or field-exact state without overloading legacy `Question` rows. Reject. [VERIFIED: `app/src/services/canonical-knowledge.service.ts`] |
| Typed edge arrays plus indexes | A client graph database/library | The pilot pool is small and the required traversals are one/two hops; another persistence/query stack would bypass the load-bearing DB seam and complicate replay/tests. Reject. [VERIFIED: RSD §8.8 target scale; `app/src/services/db.service.ts`] |
| Dedicated §17.2 extraction | `classifyAndAnchorIncremental` directly | The legacy function can create new anchors and persists legacy hierarchy metadata. Reuse its normalization/embedding primitives, not its storage-producing workflow. [VERIFIED: `app/src/services/canonical-knowledge.service.ts`] |
| Persisted recommendation batches | Reusing `postQueueService` | The queue is cyclic generated-feed machinery with refill/style/spread state and no Recommendation snapshot semantics. D-12 explicitly forbids reuse. [VERIFIED: D-11–D-12; `CLAUDE.md`] |

**Installation:** none. Phase 3 needs no new package.

**Version verification:** Existing exact versions were read from package manifests/locks and the local runtime was probed; no registry lookup or legitimacy gate is needed because no package is added. [VERIFIED: `app/package.json`; `tools/content_pipeline/package-lock.json`; environment probe]

## Package Legitimacy Audit

Not applicable. The recommended plan installs no external package. [VERIFIED: Standard Stack]

## Architecture Patterns

### System Architecture Diagram

~~~text
OFFLINE BUILD
reviewed Phase 2 candidates
        |
        v
typed graph/ranking-feature compiler
  |-- structural edges
  |-- cross-claim contrast/challenge edges
  |-- source nodes + primary concept + format
  '-- pinned-model ranking vectors
        |
        v
immutable content_pool_v1 artifacts + hashes
        |
        v
validated app import --> global graph repository (IndexedDB)

RUNTIME TRACE PATH
post-scoped Ask --> completed Q&A persisted --> extraction job row (durable)
                                              |
                                              v
                                   §17.2 strict JSON LLM call
                                              |
                                  frozen-ID allowlist validation
                                              |
                       patch UserQuestion + personal edges/contributions
                                              |
                                      GRAPH_UPDATED

UserInteractionEvent persisted --> idempotent contribution ledger
                                              |
                                              v
                              affected UserConceptState rows
                                              |
                                      GRAPH_UPDATED

SESSION / SWIPE-FOR-MORE
recommendationService reads study condition
        |
        +--> control: static pool + allowed seen/dismissed state only
        |
        '--> experimental: global graph + questions + personal state
                         |
                    pure component scores
                         |
                 one strategy per candidate
                         |
                 diversity rerank per session
                         |
             selected items only: reason generation
                         |
        persist Recommendation rows + batch ledger
                         |
                  Home renders stable batch
~~~

[VERIFIED: D-01–D-12; RSD §10–§12; current repository seams]

### Recommended Project Structure

The following are proposed Wave 0 paths; they do not exist yet and are listed as planner targets rather than citations to current files. [VERIFIED: filesystem audit]

~~~text
tools/content_pipeline/
├── schemas/global-edge.schema.json
├── schemas/ranking-features.schema.json
└── src/graph/build.ts

app/src/
├── domain/graph.types.ts
├── services/global-graph.repository.ts
├── services/graph-memory.service.ts
├── services/question-extraction.service.ts
├── services/recommendation-config.ts
├── services/ranking/control-ranker.ts
├── services/ranking/experimental-ranker.ts
├── services/ranking/diversity-reranker.ts
├── services/recommendation.repository.ts
└── services/recommendation.service.ts

app/tests/services/
├── global-graph.repository.test.mjs
├── graph-memory.service.test.mjs
├── question-extraction.service.test.mjs
├── ranking-components.test.mjs
├── diversity-reranker.test.mjs
└── recommendation.service.test.mjs
~~~

[VERIFIED: `AGENTS.md` structure; recommended decomposition from locked responsibilities]

### Pattern 1: Frozen typed graph as an extension of the pool contract

Add `sources.json`, `global_edges.json`, and `ranking_features.json` to the same fixed-filename/hash/count contract as existing artifacts. A minimal edge record should contain stable ID, topic ID, exact edge type, source node ID, and target node ID. Validators must enforce the legal endpoint kinds for every named §10.4 type and reject dangling/cross-topic references. [VERIFIED: RSD §10.2–§10.4; existing freeze validation pattern in `tools/content_pipeline/src/schema/validate.ts`]

The current preprocessing data can deterministically supply most edges: every post concept is at least `mentions`; every central source claim is `supports`; claim concept IDs become `about`; suggested-question targets and concept prerequisite/related labels become exact edges. Build opposing pro/con claims with shared concepts into symmetric `contrasts_with` pairs and emit `Post --challenges--> Claim` when a post's supported claim contrasts with another claim. Human review/fixtures must verify these inferred relations. The current exporter discards related concept labels and sorts post concept IDs, so it must also derive and freeze `primaryConceptId` rather than treating `conceptIds[0]` as semantic. [VERIFIED: `tools/content_pipeline/src/freeze/build.ts`; `tools/content_pipeline/src/ai/provider.ts`; RSD §10.4]

Do not invent an additional Source edge type: §10.2 requires Source nodes but §10.4 names no source relation. Freeze source nodes and link them through ranking-feature metadata/source indexes until the operator clarifies whether a new edge type is allowed. [VERIFIED: RSD §10.2–§10.4]

### Pattern 2: Dedicated derived graph with idempotent contribution rows

Persist field-exact domain records separately from internal nodes/edges. Recommended stores are `personal_graph_nodes`, `personal_graph_edges`, `user_concept_states`, and `graph_contributions`. A contribution key should be stable from event ID plus concept ID plus rule name; replay uses upsert, so a crash/retry cannot double-apply weight. Recompute only affected concept aggregates after each contribution write, then emit `GRAPH_UPDATED` after persistence succeeds. [VERIFIED: D-02–D-03; current DB has no multi-operation transaction support in `app/src/services/db.service.ts`]

This ledger is safer than “read state, add delta, write state” because IndexedDB operations behind `dbExecute` auto-commit separately and BEGIN/COMMIT are no-ops. The durable raw event remains source of truth; a boot repair can clear/rebuild derived rows or fill missing contribution keys. [VERIFIED: `app/src/services/db.service.ts`]

Interest uses the exact §10.6 deltas and clamps to [0,1]. The planner should encode deterministic configurable rules for the underspecified values: clarification/confusion/unresolved questions raise uncertainty; repeated views, deeper question types, and followed Echo recommendations raise familiarity; repeated not-interested events on the same concept increment `skippedPostCount` and apply the repeated-skip decrement after the first. [VERIFIED: RSD §10.5–§10.6; numeric uncertainty/familiarity deltas are planner discretion]

### Pattern 3: Durable extraction outbox and frozen-ID allowlist

`PostQaService` currently writes all current-post concepts/claims into `UserQuestion.extracted*`, which is not §17.2 extraction. Change initial completed questions to empty extraction arrays, persist them with the answer, enqueue a lightweight job referencing `questionId`, and return the answer. A background worker loads the canonical question, current post, same-topic frozen concepts/claims, and optional precomputed candidate similarities; it invokes `chatCompletion(..., { jsonMode: true })` and validates the result. [VERIFIED: `app/src/services/post-qa.service.ts` lines creating canonical records; D-04; RSD §17.2]

Prompt with IDs and labels, but accept only IDs present in repository maps for the bound topic. Resolve label/alias fallbacks only when normalization maps to exactly one frozen ID; reject ambiguous/unknown IDs rather than creating an anchor. Persist `questionType` and LLM-set `unresolved` once. On success, add personal `asks_about` edges and question contributions, then revise the Q&A projection so RQ-02 fields survive the wire/export path. [VERIFIED: GRAPH-03; D-05; `app/src/services/interaction-log.service.ts` revision behavior]

Both conditions run the same extraction for measurement, but only the experimental ranker receives that repository. Do not pass prior question traces into the experimental answer prompt: that would alter Ask quality and violate the locked single-variable design even though §17.3 lists traces as an optional input. [VERIFIED: `DEC-both-conditions-ask`; `app/tests/services/post-qa.condition-parity.test.mjs`]

### Pattern 4: Branch before dependency access

The single service should obtain identity, candidates, and allowed engagement state, then branch immediately:

~~~typescript
// Source: docs/research_system_design.md §11.7 and CONTEXT D-10.
const identity = studyContextService.getRequired();
if (identity.condition === 'control') {
  return materializeControlBatch(controlRankerInputOnly);
}
const memory = await graphMemoryRepository.readSnapshot(identity.userId);
const questions = await questionRepository.readExtracted(identity.userId);
return materializeExperimentalBatch({ memory, questions, globalGraph });
~~~

The control ranker constructor/input type must not contain a question repository, `UserConceptState`, unresolved status, echo evidence, or graph traversal API. This is stronger than remembering not to read those fields inside a shared mega-context. [VERIFIED: RSD §11.7; D-10]

### Pattern 5: Pure scoring plus evidence

Every component returns both a normalized value and contributor evidence. Keep §11.3 top-level weights exactly in one immutable `RecommendationConfig`; inject it into tests/builds, but do not add the deferred tuning UI. Clamp component and final scores to [0,1] because the existing Recommendation schema requires that range even though the formula subtracts a penalty. [VERIFIED: RSD §11.3; `tools/content_pipeline/schemas/recommendation.schema.json`]

Recommended deterministic component shapes:

| Component | Implementation shape |
|-----------|----------------------|
| QuestionRelevance | Maximum over prior questions of available semantic similarity, target-concept overlap, support/challenge relationship, and unresolved boost; renormalize subweights when a vector is unavailable. Return the winning question/concept/claim IDs. [VERIFIED: RSD §11.4] |
| ConceptInterestMatch | Weighted mean of post-concept interest plus one-hop related/prerequisite proximity; no mutable anchor IDs. [VERIFIED: RSD §11.4] |
| ContinuityWithRecentPosts | Direct shared concept, one-hop concept relation, claim relation, and stance/source transition over recent served/opened posts. [VERIFIED: RSD §11.4] |
| NoveltyOrContrast | Highest of opposing-claim edge, viewpoint change, and underexplored neighboring concept. [VERIFIED: RSD §11.4] |
| ContentQuality | Static weighted combination of `qualityScore`, `educationalValueScore`, and `interestingnessScore`; keep subweights in config. [VERIFIED: RSD §9.2, §11.4] |
| DifficultyFit | Similarity between frozen difficulty and a deterministic target derived from average familiarity; keep target curve/config injectable. [VERIFIED: RSD §11.4] |
| RedundancyPenalty | Maximum of pinned-model post-vector similarity, repeated claim, source repetition, and repeated format against viewed/served history. [VERIFIED: RSD §11.4] |

Freeze post/claim/concept vectors under one exact provider/model/dimension fingerprint and compute only question vectors at runtime with the matching configuration. Otherwise cosine comparisons across different embedding spaces are invalid. The repository currently has no ranking-vector artifact, so the plan needs a pre-freeze model-fingerprint checkpoint. [VERIFIED: `app/src/providers/embedding/index.ts` supports multiple models; frozen pool currently has no vectors]

### Pattern 6: Strategy affinity, diversity, then reason

Candidate generation should deduplicate by `postId` while unioning evidence from high quality, active concepts, questions, claim relations, bridge paths, and echo eligibility. Choose exactly one experimental strategy by maximum affinity with a stable tie-break. Continue requires a direct question link; Deepen uses repeated/high-weight concepts (and can be the cold-start global-core default); Contrast requires an opposing claim/view; Bridge requires two separately activated concepts; Echo requires a prior question older than configurable `echoMinAgeMs`. A 24-hour default is a reasonable pilot setting, but keep it explicit and fake-clock tested. [VERIFIED: RSD §11.2, §11.5; D-05/D-09]

Run diversity selection before reason calls. Greedily select score-sorted candidates while carrying session-wide source counts and the last two primary concepts across batches. If sufficient history exists, reserve one slot for the highest-scoring Contrast/Bridge candidate. If hard constraints make a full batch impossible, return a smaller batch instead of silently violating the stated caps; format mixing is a soft preference among otherwise legal candidates. [VERIFIED: RSD §11.6]

Batch reason generation can request all selected experimental items in one structured call, validate every item by recommendation/candidate ID, and retry only missing/invalid entries. Persist nothing as “served” until each selected item has its final reason and structured contributors. Control selection maps to `topic_baseline`, `quality_baseline`, or `diversity_baseline` and fixed non-personal text without any LLM call. [VERIFIED: D-06–D-08; RSD §9.9, §17.4]

### Pattern 7: Separate field-exact records from batch metadata

Keep `Recommendation` field-for-field. Store session ID, batch sequence, ordered recommendation IDs, generation status, and cumulative diversity counters in a separate `recommendation_batches` record. This avoids adding non-RSD fields to Recommendation while making session-start recovery and swipe-for-more idempotent. [VERIFIED: RSD §9.9; D-11]

Home should render `{ recommendation, post, conceptLabels }` view models. The current one-event-per-whole-feed `feed_impression` cannot identify concepts; log one impression per actually exposed recommendation/post (without display position), so §10.6 exposure updates can be replayed. Add a shared reason affordance to `FeedCard` and record `recommendation_reason_view` with post/recommendation IDs. [VERIFIED: `app/src/screens/HomeScreen.tsx`; `app/src/services/interaction-log.service.ts` event allowlist; RSD §9.8, §10.6]

### Anti-Patterns to Avoid

- **Mutable pool IDs from legacy anchors:** creates orphan learner traces with no global edges. Use frozen IDs only. [VERIFIED: GRAPH-03]
- **One shared ranker context:** makes accidental control leakage easy. Use separate narrow inputs and an early condition branch. [VERIFIED: RSD §11.7]
- **Ranking on every `GRAPH_UPDATED`:** reshuffles already served items and violates D-11 snapshot cadence. Mutations affect the next batch only. [VERIFIED: D-07/D-11]
- **Reason calls for every candidate:** wastes provider calls and may persist prose for items never served. Select first. [VERIFIED: D-07/D-11]
- **Testing LLM prose:** brittle and nondeterministic. Test structured contributor IDs and use a mocked reason generator. [VERIFIED: D-06; RSD §12.3]
- **Silently skipping unknown SQL:** both backends ignore unsupported statements. Keep new repositories within the documented INSERT/DELETE/SELECT subset or extend both backends together. [VERIFIED: `app/src/services/db.service.ts`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client graph database | A new query engine or generalized graph ORM | Typed edge records plus in-memory indexes loaded through existing repositories | Required queries are bounded one/two-hop traversals and persistence invariants already live in the DB seam. [VERIFIED: RSD §10–§11] |
| Persistence abstraction | Direct IndexedDB/localStorage code | `dbExecute`/`dbQuery` and matching backend tests | Direct access would recreate the false-green/parity failure class documented in CLAUDE.md. [VERIFIED: `CLAUDE.md`] |
| Graph event family | `PERSONAL_GRAPH_UPDATED` or extraction-specific duplicate event | Extend `GRAPH_UPDATED.payload.kind` | One signal per semantic graph mutation is load-bearing. [VERIFIED: `CLAUDE.md`] |
| Experimental reason templates | Deterministic personal prose generator | Existing LLM facade with §17.4 plus structural trace fields | D-06 locks LLM-generated experimental text and structured verifiability. [VERIFIED: D-06] |
| Another feed queue | Cyclic/refill/mutex adapter around recommendations | Persisted batch ledger | D-11 requires snapshots; D-12 requires queue removal. [VERIFIED: D-11–D-12] |
| New concept creation during extraction | Anchor creation or free-text IDs | Frozen concept/claim allowlist and unambiguous alias map | Orphans cannot participate in graph scoring. [VERIFIED: GRAPH-03] |

**Key insight:** The novel work is domain policy and auditability, not graph infrastructure. Keep the graph representation boring and make edge provenance, condition isolation, replay, and persisted batch evidence explicit. [VERIFIED: RSD §10–§12]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing IndexedDB stores include generated-feed `posts` and `post_queue`; `sessions` is tied to the dead generated post-session path. IndexedDB upgrades only create stores and never delete retired ones. `questiontrace_daily_read` remains live for PostDetail exploration dedup. [VERIFIED: `app/src/services/db.service.ts`; `app/src/services/daily-read.service.ts`] | Add new graph/recommendation stores, bump IDB version, and delete only verified-retired object stores during upgrade; retain `post_history`, `engagement`, canonical Q&A, and the daily exploration tracker. This is a schema/data cleanup, not merely source deletion. |
| Live service config | No external service configuration names the retired concept-feed/queue/style/spread/mutex modules; LLM/embedding configuration is generic. [VERIFIED: caller/config grep in `app/src`] | No external migration. Remove obsolete service imports/config fields only after caller replacement. |
| OS-registered state | No native registration references these service/module names. [VERIFIED: scoped grep across `app/android` and `app/ios`] | None. |
| Secrets/env vars | No secret or environment variable is named for the retired feed modules. [VERIFIED: scoped repository grep] | None. Do not add ranker secrets; reuse configured provider seams. |
| Build artifacts / installed packages | Existing `app/dist` and Capacitor-synced web assets can retain bundled retired code until rebuilt/synced; no package is dedicated to the retired queue. [VERIFIED: build structure and package manifest] | After source/test deletion, run build and `npx cap sync` before device UAT. No package uninstall. |

### D-12 Guarded Removal Sweep

The following is the complete scoped `rg` inventory across `app/src` and `app/tests`. Some matches are explanatory comments, but every listed file must be reviewed so comments/tests do not pin dead behavior. [VERIFIED: 2026-07-17 caller sweep]

| Retired surface | Source matches | Test matches |
|-----------------|----------------|--------------|
| concept-feed | `App.tsx`, `components/InfoFlow.tsx`, `services/concept-feed.service.ts`, `engagement.service.ts`, `feed-spread.ts`, `infiniteScroll.service.ts`, `post-essay.service.ts`, `refill-mutex.ts`, `session.service.ts`, `starter-posts-decay.ts`, `text-art-fragment.ts` | `concept-feed.test.mjs`; `phase1/rebrand-surfaces.test.mjs`; `providers/gemini-text-art-budget.test.mjs`; `providers/privacy-callsite-structural.test.mjs`; `screens/HomeScreen.frozen-feed.test.mjs`; `screens/HomeScreen.image-pregen-filter.test.mjs`; `screens/PostDetailScreen.frozen-content.test.mjs`; `services/bonus-post-cap.test.mjs`; `concept-batch-filter.test.mjs`; `concept-feed-bonus-cap.test.mjs`; `concept-feed-cache-date.test.mjs`; `concept-feed-dismiss-filter.test.mjs`; `daily-generation-cap.test.mjs`; `fast-model-routing.test.mjs`; `image-gen-key-gate.test.mjs`; `like-boost.test.mjs`; `post-essay.service.test.mjs`; `post-history-fallback.test.mjs`; `post-queue-dedup.test.mjs`; `refill-mutex.test.mjs`; `refill-queue-integration.test.mjs`; `refill-reliability.test.mjs`; `spread-by-concept.test.mjs`; `starter-posts.test.mjs`; `starter-posts-persist.test.mjs`; `storage-namespace.test.mjs`; `text-art-no-truncate-on-regen.test.mjs`; `text-art-tightener.test.mjs` |
| post-queue | `App.tsx`, `concept-feed.service.ts`, `infiniteScroll.service.ts`, `post-queue.service.ts` | `screens/HomeScreen.frozen-feed.test.mjs`; `bonus-post-cap.test.mjs`; `concept-batch-filter.test.mjs`; `concept-feed-bonus-cap.test.mjs`; `concept-feed-dismiss-filter.test.mjs`; `daily-generation-cap.test.mjs`; `derived-list.test.mjs`; `post-queue.test.mjs`; `post-queue-dedup.test.mjs`; `post-queue-rehydrate.test.mjs`; `post-queue-remove-by-id.test.mjs`; `post-queue-yesterday-snapshot.test.mjs`; `refill-mutex.test.mjs`; `refill-queue-integration.test.mjs`; `refill-reliability.test.mjs`; `walker-empty-derived-list.test.mjs` |
| style-assignment | `concept-feed.service.ts`, `post-queue.service.ts`, `style-assignment.ts` | `derived-list.test.mjs`; `image-gen-key-gate.test.mjs`; `like-boost.test.mjs`; `refill-queue-integration.test.mjs`; `style-assignment.test.mjs`; `style-assignment-stratified.test.mjs` |
| feed-spread | `concept-feed.service.ts`, `feed-spread.ts`, `post-queue.service.ts`, comment-only `state/keyboard-hysteresis.ts` | `components/BottomNavigation.slide.test.mjs`; `post-queue-rehydrate.test.mjs`; `post-queue-remove-by-id.test.mjs`; `refill-mutex.test.mjs`; `refill-queue-integration.test.mjs`; `spread-by-concept.test.mjs` |
| refill-mutex | `concept-feed.service.ts`, `refill-mutex.ts` | `concept-feed-dismiss-filter.test.mjs`; comment-only `filter-cache.test.mjs`; `refill-mutex.test.mjs` |
| daily-read | `lib/concept-target.ts`, live `screens/PostDetailScreen.tsx`, `concept-feed.service.ts`, `daily-read.service.ts`, comments in `engagement.service.ts` | `components/LongPressMenu.test.mjs`; `concept-quota.test.mjs`; `phase1/pruned-residue.test.mjs`; `bonus-post-cap.test.mjs`; `concept-batch-filter.test.mjs`; `concept-feed-bonus-cap.test.mjs`; `daily-read.service.test.mjs`; `engagement.service.test.mjs`; `storage-namespace.test.mjs` |

Guarded disposition:

- Delete the five retired leaf/core modules and generated-feed-only helpers after Home uses recommendation batches. [VERIFIED: D-12]
- Remove dead `infiniteScroll.service.ts`; remove generated-body `post-essay.service.ts`/legacy `session.service.ts` only after confirming no non-test caller (current production grep finds none beyond their own imports). Preserve frozen `post-history.service.ts`. [VERIFIED: production caller grep]
- Keep PostDetail's three `CONCEPT_EXPLORED` detectors and the small daily dedup state; remove only `getAnchorIdForPost`, `getConceptQuota`, and dead `lib/concept-target.ts` plus their tests. [VERIFIED: `CLAUDE.md`; caller grep]
- Update `phase1/rebrand-surfaces.test.mjs` and `storage-namespace.test.mjs`, which directly require concept-feed/session sources today; replace obsolete generated-feed source-reading assertions with executable recommendation-path tests. [VERIFIED: those test files]
- Remove generated `DailyPost`/style/session types only after a type/caller sweep; do not disturb field-exact frozen `Post`, Q&A, history, or engagement types. [VERIFIED: `app/src/types/index.ts`; `app/src/domain/content.types.ts`]

## Common Pitfalls

### Pitfall 1: Planning against a pool that does not exist
**What goes wrong:** Ranker tasks assume graph artifacts and real IDs are ready, but the app's default reader still throws `POOL_NOT_PACKAGED`.  
**Why it happens:** Requirements are checked complete while STATE still shows Phase 2 executing and the operator approval/freeze is unfinished.  
**How to avoid:** Make typed global graph/ranking features a Phase 2/Phase 3 seam task before freeze, then gate runtime work on a verified pool artifact.  
**Warning signs:** Any plan fixture substitutes arbitrary concept IDs without an importer test against the final pool. [VERIFIED: `.planning/STATE.md`; `app/src/data/content-pool-bundle.ts`]

### Pitfall 2: Treating helper edge files as §10.4 compliance
**What goes wrong:** Untyped post/concept and post/claim pairs cannot distinguish required semantics and are not packaged by the app.  
**How to avoid:** Emit one typed edge contract with endpoint validation and runtime indexes.  
**Warning signs:** Tests only assert files exist or only compare `post.conceptIds`. [VERIFIED: `tools/content_pipeline/src/freeze/build.ts` and `verify.ts`]

### Pitfall 3: Reusing mutable anchor IDs
**What goes wrong:** Extraction creates an anchor with no frozen-pool edge, so relevance/contrast traversal cannot reach posts.  
**How to avoid:** Dedicated extraction with frozen same-topic ID allowlists; reuse only low-level normalization/embedding helpers.  
**Warning signs:** A Phase 3 path calls `questionService.insertNode` or `classifyAndAnchorIncremental`. [VERIFIED: GRAPH-03; canonical service]

### Pitfall 4: Control leakage through shared preparation
**What goes wrong:** A “common” context reads questions or `UserConceptState` before the condition branch even if the control formula ignores them.  
**How to avoid:** Early branch and narrow control dependency type; throwing-spy isolation test.  
**Warning signs:** Control ranker accepts `UserMemoryContext` or reason generation gets personal traces. [VERIFIED: RSD §11.7]

### Pitfall 5: Lost or double-applied async extraction
**What goes wrong:** Fire-and-forget work dies on app backgrounding, or retries add §10.6 weight twice.  
**How to avoid:** Persist job references and stable contribution keys; boot resumes pending jobs.  
**Warning signs:** No job table, or state updates are arithmetic read/modify/write without event provenance. [VERIFIED: D-02/D-04; DB transaction limits]

### Pitfall 6: Feed impressions cannot be mapped to concepts
**What goes wrong:** Current Home logs one fieldless event per whole feed, so exposureCount and +0.05 concept deltas cannot be replayed.  
**How to avoid:** Log per exposed recommendation/post without position, and let the contribution builder resolve post concepts.  
**Warning signs:** `EVENT_FIELDS.feed_impression` remains empty or Home keeps a single batch-string sentinel. [VERIFIED: `app/src/screens/HomeScreen.tsx`; `interaction-log.service.ts`]

### Pitfall 7: Cross-model cosine
**What goes wrong:** Frozen post vectors and live question vectors come from different models/dimensions, making semantic scores meaningless or invalid.  
**How to avoid:** Freeze and validate a model fingerprint; reject/renormalize unavailable vector subcomponents.  
**Warning signs:** Ranking vectors lack provider/model/dimension metadata. [VERIFIED: existing multi-provider embedding facade]

### Pitfall 8: Source-reading false greens
**What goes wrong:** Tests assert old strings/functions remain and pass while the real IndexedDB path or ranker behavior is broken.  
**How to avoid:** Execute pure rankers and repositories; query stored rows through `dbQuery`/fake IndexedDB.  
**Warning signs:** New §12.3 tests call `readFileSync` on implementation source. [VERIFIED: `CLAUDE.md`; D-12 inventory]

### Pitfall 9: Diversity resets at every batch
**What goes wrong:** Each batch individually meets caps while the full session exceeds same-source or primary-concept constraints.  
**How to avoid:** Persist cumulative session counters in batch metadata and carry them to swipe-for-more.  
**Warning signs:** Reranker input contains only the new candidate list. [VERIFIED: RSD §11.6; D-11]

### Pitfall 10: Cold-start items have no valid strategy
**What goes wrong:** Experimental items use baseline strategy labels, violating RANK-03, or fake a prior question.  
**How to avoid:** Use global Deepen/Contrast/Bridge evidence at cold start; Continue/Echo remain unavailable until traces exist. Always attach real concept evidence and never fabricate IDs. [VERIFIED: D-09; RSD §11.5]

### Pitfall 11: Extraction never reaches research export
**What goes wrong:** `user_questions` is patched locally, but the already-uploaded Q&A projection and backend CSV remain unchanged.  
**How to avoid:** Add optional extraction fields to `QuestionAnswerRecord`, wire validation/backend columns, and enqueue a higher revision after extraction.  
**Warning signs:** RQ-02 analysis sees answer concept IDs but not question type/unresolved fields. [VERIFIED: `app/src/types/research.ts`; `research-backend/src/validation.ts`]

## Code Examples

### Field-exact scoring and clamping

~~~typescript
// Source: docs/research_system_design.md §11.3; Recommendation score range from
// tools/content_pipeline/schemas/recommendation.schema.json.
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function experimentalScore(c: ExperimentalComponents, w = DEFAULT_WEIGHTS) {
  return clamp01(
    w.questionRelevance * c.questionRelevance
    + w.conceptInterestMatch * c.conceptInterestMatch
    + w.continuityWithRecentPosts * c.continuityWithRecentPosts
    + w.noveltyOrContrast * c.noveltyOrContrast
    + w.contentQuality * c.contentQuality
    + w.difficultyFit * c.difficultyFit
    - w.redundancyPenalty * c.redundancyPenalty
  );
}
~~~

### Idempotent derived contribution

~~~typescript
// Source: D-02/D-03 and the existing dbQuery/dbExecute seam.
const contributionId = [event.id, conceptId, rule].join(':');
await dbExecute(
  'INSERT OR REPLACE INTO graph_contributions (id, user_id, concept_id, data) VALUES (?, ?, ?, ?)',
  [contributionId, event.userId, conceptId, JSON.stringify(contribution)],
);
await rebuildAffectedConceptState(event.userId, conceptId);
eventBus.emit({
  type: 'GRAPH_UPDATED',
  payload: { kind: 'interaction', affectedIds: [conceptId] },
});
~~~

### Frozen-ID validation after §17.2

~~~typescript
// Source: docs/research_system_design.md §17.2 and GRAPH-03.
const conceptIds = unique(parsed.conceptIds);
if (conceptIds.some((id) => !sameTopicConceptIds.has(id))) {
  throw new ExtractionValidationError('unknown concept id');
}
const claimIds = unique(parsed.claimIds ?? []);
if (claimIds.some((id) => !sameTopicClaimIds.has(id))) {
  throw new ExtractionValidationError('unknown claim id');
}
await postQaRepository.patchExtraction(questionId, {
  extractedConceptIds: conceptIds,
  extractedClaimIds: claimIds,
  questionType: parsed.questionType,
  unresolved: parsed.unresolved,
});
~~~

### Executable control-isolation test shape

~~~typescript
// Source: docs/research_system_design.md §12.3 and CLAUDE.md DB false-green warning.
const throwingPersonalStore = {
  readSnapshot() { throw new Error('control touched personal state'); },
};
const first = await service.createBatch({ condition: 'control', personalStore: throwingPersonalStore });
await seedDifferentQuestionHistoryThroughDbQuerySeam();
const second = await service.createBatch({ condition: 'control', personalStore: throwingPersonalStore });
assert.deepEqual(projectScoresAndLabels(first), projectScoresAndLabels(second));
const rows = await dbQuery('SELECT * FROM recommendations');
assert.ok(rows.length > 0);
~~~

## State of the Art

| Old Approach | Current Phase 3 Approach | When Changed | Impact |
|--------------|--------------------------|--------------|--------|
| AI-generated `DailyPost` plus cyclic queue/refill/style spreading | Frozen real posts selected into persisted Recommendation batches | Phase 3 D-10–D-12 | Removes transitional generation state and makes served treatment auditable. [VERIFIED: D-10–D-12] |
| Mutable anchor/cluster hierarchy as the only graph-like store | Frozen global graph plus dedicated per-user derived graph/state | Phase 3 | Aligns IDs and named edges with RSD §10. [VERIFIED: RSD §10] |
| Current-post concepts copied into `UserQuestion.extracted*` | Async strict §17.2 mapping to real pool concepts/claims | Phase 3 GRAPH-03 | Makes question depth/type/unresolved status measurable and usable for ranking. [VERIFIED: current `post-qa.service.ts` versus RSD §17.2] |
| Manifest order with dismiss filtering | Strong control formula or experimental graph-memory formula plus diversity | Phase 3 | Produces comparable but different conditions at one rendering seam. [VERIFIED: RSD §11.3–§11.7] |

**Deprecated/outdated:**
- The three-list generated concept-feed, cyclic post queue, style assignment, spread functions, and refill mutex are explicitly retired after recommendation wiring. [VERIFIED: D-12]
- The optional exploration-path chip list and human recommendation-review exercise remain deferred; do not make them Phase 3 gates unless the operator changes scope. [VERIFIED: Deferred Ideas]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations for discretionary thresholds/config are labeled as recommendations rather than factual claims. | — | — |

## Open Questions

1. **Which exact embedding provider/model/dimensions are frozen for ranker features?**
   - What we know: the app supports multiple embedding spaces; the current default is `text-embedding-3-small`, while the pool has no vectors or fingerprint. [VERIFIED: `app/src/services/settings.service.ts`; pool schema]
   - What's unclear: the study build's guaranteed provider/model credentials.
   - Recommendation: add a human checkpoint before the first freeze; write the selected fingerprint into the manifest and reject mismatches.

2. **How should Source nodes be related without inventing a non-§10.4 edge?**
   - What we know: §10.2 includes Source nodes, but §10.4's locked global edge list contains no post/source edge. [VERIFIED: RSD §10.2–§10.4]
   - What's unclear: whether metadata/index linkage is sufficient for GRAPH-01.
   - Recommendation: freeze Source nodes and a sourceId in ranking features; do not add an edge type without operator approval.

3. **What exact uncertainty/familiarity deltas and “sufficient history” threshold should the pilot use?**
   - What we know: interest deltas are numeric; uncertainty/familiarity triggers and diversity's sufficient-history phrase are qualitative. [VERIFIED: RSD §10.6, §11.6]
   - What's unclear: initial numerical calibration.
   - Recommendation: planner locks conservative values in injected config with fixture tests; expose no UI. Pilot/human validation may tune later without changing architecture.

4. **Does Phase 3 extend the central Q&A wire/backend now or leave only local canonical fields until Phase 4 export?**
   - What we know: RQ-02 is assigned to Phase 3, but current wire/backend records omit extracted question fields. [VERIFIED: `.planning/REQUIREMENTS.md`; `app/src/services/research-wire-contract.ts`; `research-backend/src/validation.ts`]
   - Recommendation: extend revisioned Q&A records and backend columns in Phase 3 so RQ-02 is actually analyzable; Phase 4 can add the broader researcher dump.

## Environment Availability

| Dependency | Required By | Available | Version / State | Fallback |
|------------|-------------|-----------|-----------------|----------|
| Node.js | app/pipeline tests | ✓ | 22.19.0 | — [VERIFIED: environment probe] |
| npm | build/test scripts | ✓ | 11.16.0 | — [VERIFIED: environment probe] |
| IndexedDB test environment | durability tests | ✓ | fake-indexeddb 6.2.5 | LocalStorage fallback also exercises the same seam. [VERIFIED: `app/package.json`; targeted tests] |
| Content pipeline | global graph compiler | ✓ | Existing TypeScript/Ajv project; freeze suite 8/8 passed | — [VERIFIED: targeted test run] |
| Frozen pool artifact | all Phase 3 runtime work | ✗ | `data/content_pool_v1/` absent; no operator decisions file | No compliant runtime fallback; prerequisite Wave 0. [VERIFIED: filesystem/run audit] |
| Runtime LLM/embedding credentials | extraction/reasons/vectors | not probed | User/build configured; secrets intentionally not inspected | Mock providers for tests; study-install checkpoint before UAT. [VERIFIED: project policy] |

**Missing dependencies with no fallback:**
- A verified immutable pool containing the typed global graph and ranking features. [VERIFIED: D-01 and filesystem audit]

**Missing dependencies with fallback:**
- Live provider credentials are not required for implementation/unit tests because network calls must be mocked, but they are required for pilot UAT. [VERIFIED: `AGENTS.md` testing rules]

## Validation Architecture

`workflow.nyquist_validation` is absent, so validation is enabled. [VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node `node:test` / `assert/strict` on Node 22.19.0 [VERIFIED: package/scripts/environment] |
| Config file | None; recursive discovery is `app/scripts/run-tests.mjs` [VERIFIED: file] |
| Quick run command | `node --test tests/services/recommendation.service.test.mjs` |
| Full suite command | `npm test` |

Targeted baseline evidence: 27 app assertions covering frozen feed, repository persistence, Q&A, and interaction logging passed; the pipeline freeze suite passed 8/8. [VERIFIED: 2026-07-17 targeted runs]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | Import/query every named global edge and reject bad endpoints | pipeline + repository integration | `node --test tests/services/global-graph.repository.test.mjs` | ❌ Wave 0 |
| GRAPH-02 | Apply/replay idempotent deltas and persist field-exact states/edges | repository integration | `node --test tests/services/graph-memory.service.test.mjs` | ❌ Wave 0 |
| GRAPH-03 | Strict async extraction maps only real frozen IDs and retries without blocking Ask | service integration | `node --test tests/services/question-extraction.service.test.mjs` | ❌ Wave 0 |
| RANK-01 | Exact control formula and zero personal/question reads | unit + integration | `node --test tests/services/recommendation.service.test.mjs --test-name-pattern="control"` | ❌ Wave 0 |
| RANK-02 | Seven normalized components and configurable §11.3 weights | unit | `node --test tests/services/ranking-components.test.mjs` | ❌ Wave 0 |
| RANK-03 | One valid strategy; Echo age gate | unit | `node --test tests/services/ranking-components.test.mjs --test-name-pattern="strategy|Echo"` | ❌ Wave 0 |
| RANK-04 | Session-wide source/concept caps and contrast/bridge inclusion | unit | `node --test tests/services/diversity-reranker.test.mjs` | ❌ Wave 0 |
| RANK-05 | Persist once; experimental contributor IDs; control fixed labels/no LLM | DB integration | `node --test tests/services/recommendation.service.test.mjs --test-name-pattern="reason"` | ❌ Wave 0 |
| RANK-06 | All six named §12.3 behaviors execute | unit/integration | `node --test tests/services/ranking-components.test.mjs tests/services/recommendation.service.test.mjs` | ❌ Wave 0 |
| RQ-02 | Revised Q&A record preserves extraction fields through local/wire/backend paths | integration | `node --test tests/services/interaction-log.service.test.mjs && npm test` | Existing file must be extended |

### §12.3 Test Assertions

1. QuestionRelevance: identical fixture except shared target concept; assert component and total score rise.
2. Contrast: typed opposing-claim edge fixture; assert candidate generation includes the opposing post with strategy Contrast.
3. Redundancy: high-similarity frozen vectors/shared claim; assert candidate rank/selection falls below a distinct post.
4. Echo: fake clock around `echoMinAgeMs`; assert no Echo before and valid Echo after threshold.
5. Control isolation: throwing personal repository plus two different persisted question histories; assert no throw and byte-equivalent scores/labels.
6. Experimental reason IDs: mock reason text, materialize batch, query `recommendations` through `dbQuery`, and assert valid contributing IDs from the fixture graph.

[VERIFIED: RSD §12.3; CLAUDE.md persistence guidance]

### Sampling Rate

- **Per task commit:** relevant single test file under 30 seconds.
- **Per wave merge:** `npm test`; if pipeline changed, also `npm test` and `npm run build` from `tools/content_pipeline/`.
- **Phase gate:** app `npm test`, `npm run lint`, `npm run build`; pipeline tests/build; in-browser IndexedDB hydration and one mocked/real-provider UAT; final `rg` confirms D-12 source/test residue is gone.

### Wave 0 Gaps

- [ ] Frozen global-edge/ranking-feature schemas, compiler, verifier fixtures, and importer tests.
- [ ] DB object stores and fake-IndexedDB durability/replay helpers.
- [ ] Strict extraction fixtures including unknown IDs, ambiguous aliases, retry, app background/restart, and both conditions.
- [ ] Pure ranker/component/strategy/diversity fixtures covering all §12.3 checks.
- [ ] Recommendation repository/batch/reason persistence fixtures.
- [ ] Q&A wire/backend extraction-field fixtures for RQ-02.

## Security Domain

Security enforcement is enabled because `security_enforcement` is absent from config. [VERIFIED: `.planning/config.json`; researcher role]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No new auth work | Keep researcher-bound identity resolution unchanged; rankers call `getRequired()` and never accept caller-supplied condition/user IDs. [VERIFIED: `study-context.service.ts`] |
| V3 Session Management | Limited | Recommendation sessions are local batching state, not authentication sessions; use random IDs and never treat them as authorization. [VERIFIED: D-11] |
| V4 Access Control | Yes, study isolation | Fail closed on bound identity/topic and make the control branch structurally unable to access personal traces. [VERIFIED: DEC-control-no-question-history] |
| V5 Validation, Sanitization, Encoding | Yes | Positive schema/allowlist validation for frozen artifacts and LLM JSON; semantic same-topic endpoint checks; render reason text as plain text. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html] |
| V6 Cryptography | No new cryptography | Reuse Web Crypto hashes already used for pool integrity; do not create custom cryptography. [VERIFIED: `app/src/data/content-pool-bundle.ts`] |

### Known Threat Patterns for React/IndexedDB/LLM Outputs

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection from question/frozen content | Tampering / Information disclosure | Fresh request delimiters, explicit untrusted-data instruction, no tool use, strict JSON parse, ID allowlist, no instruction-following from source text. [VERIFIED: existing pattern in `post-qa.service.ts`; role untrusted-input boundary] |
| LLM returns unknown/cross-topic IDs | Tampering | Validate syntactically and semantically against same-topic repository maps before persistence. [CITED: OWASP Input Validation Cheat Sheet] |
| Control branch reads personal state | Information disclosure / experiment contamination | Separate dependency types, early branch, throwing-spy isolation test. [VERIFIED: RSD §11.7] |
| Derived state double-applies after crash | Tampering | Stable contribution keys, replay tests, raw log as canonical source. [VERIFIED: D-02–D-03] |
| Reason text rendered as active markup | XSS | Render one-sentence reason as React text, not raw HTML/Markdown; cap length and reject control characters. [VERIFIED: existing React card pattern; OWASP input guidance] |
| Stale/mismatched pool graph | Tampering | Artifact hashes, version-pinned import, immutable-ready guard, edge endpoint validation. [VERIFIED: current pool repository/freeze verifier] |

## Sources

### Primary (HIGH confidence)

- `docs/research_system_design.md` §7.7, §9.2–§9.9, §10–§12, §17.2–§17.4, §22 — locked schemas, edges, formulas, strategies, validation, prompts, and framing.
- `.planning/phases/03-graph-memory-recommendation-engine/03-CONTEXT.md` — locked D-01–D-12, discretion, deferred scope.
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` — requirement mapping and actual phase state.
- `CLAUDE.md` and `AGENTS.md` — load-bearing persistence/event/filter/feed/test constraints.
- `tools/content_pipeline/src/freeze/build.ts`, `verify.ts`, schemas/tests, and `runs/pilot-v1-20260716/` — current frozen-pool seam and artifact status.
- `app/src/services/db.service.ts`, `content-pool.repository.ts`, `frozen-feed.service.ts`, `post-qa.service.ts`, `interaction-log.service.ts`, `study-context.service.ts`, `canonical-knowledge.service.ts` — current runtime seams.
- Scoped `rg` caller/test sweep and targeted Node test runs on 2026-07-17.

### Secondary (MEDIUM confidence)

- https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html — current OWASP guidance for early syntactic and semantic validation of untrusted structured data. The research seam classified cross-checked websearch confidence as MEDIUM.
- https://owasp.org/www-project-application-security-verification-standard/ — ASVS project/category reference.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new package; exact repository/runtime versions and seams were inspected.
- Architecture: HIGH — driven by locked RSD/CONTEXT contracts and verified current code boundaries.
- Pitfalls: HIGH — each is tied to a current file/state/caller or an explicit locked constraint.
- Numerical subweight calibration: MEDIUM — §11.3 top-level weights are locked, while §10.6 uncertainty/familiarity deltas and §11.4 subformulas remain intentionally discretionary.

**Research date:** 2026-07-17
**Valid until:** 2026-07-24 — Phase 2 is actively changing and the pool freeze status can invalidate the prerequisite findings sooner than the architecture findings.
