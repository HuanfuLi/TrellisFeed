# Phase 3: Graph-memory + recommendation engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 3-Graph-memory + recommendation engine
**Areas discussed:** Graph-memory substrate, Question extraction, Recommendation reasons, Cold-start & feed wiring

---

## Graph-memory substrate

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh §10 stores, reuse embeddings | Dedicated §10.3/§10.4 personal node+edge stores mapping cleanly to spec; reuse embedding/classification machinery | |
| Extend anchor/cluster infra | Alias §10 vocab onto existing anchor/cluster structures; less code, drift risk | |
| You decide | Planner chooses substrate | ✓ |

**User's choice:** You decide
**Notes:** Discretion, but hard-constrained: must satisfy locked §9/§10 field-for-field and expose the named edges §12.3 tests read; reuse existing embedding/classification machinery to populate.

| Option | Description | Selected |
|--------|-------------|----------|
| In the pipeline, frozen into pool | Pipeline computes §10.4 global edges, baked into data/content_pool_v1/; deterministic, no in-app compute | ✓ |
| In-app at import | Derive global edges on-device at first launch; nondeterministic, added latency | |
| You decide | Planner picks | |

**User's choice:** In the pipeline, frozen into pool
**Notes:** Cross-phase seam — Phase 2 exporter (or a Phase 3 pipeline addition) must emit §10.4 global edges.

| Option | Description | Selected |
|--------|-------------|----------|
| Event-driven, incremental | Each logged interaction applies its §10.6 delta immediately; replayable from log | ✓ |
| Recompute on feed refresh | Rescan history each refresh; heavier, redundant with the log | |
| You decide | Planner picks | |

**User's choice:** Event-driven, incremental

| Option | Description | Selected |
|--------|-------------|----------|
| Log is source of truth; snapshot too | Raw log canonical; keep graph-memory serializable for an optional snapshot dump | ✓ |
| Log only; graph is ephemeral runtime | Graph purely runtime; reconstruct offline from log | |
| You decide | Defer to Phase 4 | |

**User's choice:** Log is source of truth; snapshot too

---

## Question extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Map onto frozen-pool concepts/claims | Resolve question against current post + pool concept/claim set; extracted IDs are real pool IDs | |
| Open extraction, then reconcile | LLM extracts free-form, then reconcile to pool IDs; risks orphan concepts | |
| You decide | Planner picks mechanism | ✓ |

**User's choice:** You decide
**Notes:** Hard constraint recorded — extracted IDs MUST resolve to real frozen-pool concept/claim IDs (no orphans).

| Option | Description | Selected |
|--------|-------------|----------|
| Async, right after the answer | Answer streams unchanged; extraction fires as background job, event-bus update, graceful degradation | ✓ |
| Inline, before the answer returns | Extract as part of the Q&A turn; simpler ordering, adds latency, couples answer to extraction | |
| You decide | Planner picks | |

**User's choice:** Async, right after the answer

| Option | Description | Selected |
|--------|-------------|----------|
| Set at extraction, no auto-clear | §17.2 LLM sets `unresolved` once; Echo age-threshold gates reuse; deterministic/verifiable | ✓ |
| Set at extraction + behavioral clear | Clears via explore-resolving-post / deeper-follow-up / save; richer but nondeterministic | |
| You decide | Planner picks | |

**User's choice:** Set at extraction, no auto-clear (Recommended)
**Notes:** User initially asked for clarification of what `unresolved` does (asked me to read the design doc). Explained its role in Echo (§11.5), QuestionRelevance (§11.4), and RQ2 metric (§3), and that §17.2 task 5 sets it. Recommended set-once/no-auto-clear for determinism + §12.3 verifiability; user accepted.

---

## Recommendation reasons

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic templates per strategy | Fixed per-strategy templates filled from trace slots; no serve-time LLM, reproducible | |
| LLM-generated per recommendation | §17.4 prompt at serve time; natural prose, nondeterministic, cost/latency, needs trace guard | ✓ |
| You decide | Planner picks | |

**User's choice:** LLM-generated per recommendation
**Notes:** Compatibility preserved — trace IDs attached structurally to the Recommendation record are what §12.3 verifies, not the prose. §17.4 ships an explicit reason prompt.

| Option | Description | Selected |
|--------|-------------|----------|
| Generate once at rec creation, persist | Generate reasonText once + persist on Recommendation record; re-renders read stored text | ✓ |
| Generate lazily on reason view | Call only when participant expands the reason; saves calls, adds view latency | |
| You decide | Planner picks | |

**User's choice:** Generate once at rec creation, persist

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed non-personal label set, no LLM | Small fixed vocabulary from non-personal data; enforces DEC-control-no-question-history | ✓ |
| LLM-generated from non-personal inputs | LLM prose from non-personal signals only; leak risk, cost, no research benefit | |
| You decide | Planner picks | |

**User's choice:** Fixed non-personal label set, no LLM

| Option | Description | Selected |
|--------|-------------|----------|
| Reasons only in Phase 3; defer chip | Ship per-recommendation reasons now; defer §7.7 exploration-path chip to Phase 4 | |
| Build chip now (experimental only) | Add exploration-path chip in Phase 3; experimental-only UI difference | |
| You decide | Planner picks whether to fold in the chip | ✓ |

**User's choice:** You decide
**Notes:** Leaning defer-to-Phase-4 (optional per §7.7, experimental-only, unblocked by any RANK req); planner may fold in if cheap.

---

## Cold-start & feed wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Same formula; empty components → 0 | Always run §11.3; empty QuestionRelevance/ConceptInterest/Echo → ~0; warms up organically | ✓ |
| Explicit control-like fallback until threshold | Control-style feed until N questions, then switch; adds mode switch + mid-study discontinuity | |
| You decide | Planner picks | |

**User's choice:** Same formula; empty components → 0

| Option | Description | Selected |
|--------|-------------|----------|
| One recommendation service, branch by condition | Single feed source reads condition, routes to control/experimental ranker; one serving seam | ✓ |
| Two separate feed paths | Distinct paths selected higher up; duplicates wiring, drift risk | |
| You decide | Planner picks | |

**User's choice:** One recommendation service, branch by condition

| Option | Description | Selected |
|--------|-------------|----------|
| Remove once recommendation service lands | Delete concept-feed/post-queue/style-assignment/feed-spread/refill-mutex + tests via guarded sweep | ✓ |
| Keep dormant | Leave the unused shell in the tree | |
| You decide | Planner decides removal vs dormancy | |

**User's choice:** Remove once recommendation service lands

| Option | Description | Selected |
|--------|-------------|----------|
| Batch per refresh/swipe-for-more | Materialize a batch of Recommendation records on session start + each swipe; stable snapshot | ✓ |
| Rank the whole remaining pool each refresh | Rescore entire pool each refresh; heavier, little gain | |
| You decide | Planner picks | |

**User's choice:** Batch per refresh/swipe-for-more

---

## Claude's Discretion

- Personal graph-memory substrate structure (fresh §10 stores vs extend anchor/cluster infra) — constrained by locked §9/§10 field-for-field + §12.3 named edges.
- Question extraction mechanism — constrained to resolve extracted IDs to real frozen-pool concept/claim IDs.
- Whether the §7.7 exploration-path chip is built in Phase 3 (leaning defer to Phase 4).
- Ranker weight-config surface, candidate-gen/dedup internals, DifficultyFit/RedundancyPenalty thresholds, §12.2 human-validation scoping.

## Deferred Ideas

- Behavioral auto-clearing of `unresolved` — future enhancement, not pilot.
- §7.7 exploration-path chip list (experimental-only) — leaning Phase 4 study UI.
- §12.2 human recommendation validation (synthetic/pilot histories) — may sit in Phase 4 pilot; §12.3 automated tests stay in Phase 3.
- Researcher-facing ranker weight-tuning affordance beyond config defaults.
