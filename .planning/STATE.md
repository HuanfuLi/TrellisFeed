---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Awaiting next milestone
stopped_at: Completed 03-11-PLAN.md
last_updated: "2026-07-21T01:15:46.247Z"
last_activity: 2026-07-20
last_activity_desc: Milestone v1.0 completed and archived
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 40
  completed_plans: 40
current_phase: 04
current_phase_name: Study infrastructure + pilot
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-10)

**Core value:** Two study conditions produce different-but-comparable feeds with interpretable recommendation reasons on a frozen content pool, with complete interaction logging.
**Current focus:** Phase 03 — graph-memory-recommendation-engine

## Current Position

Phase: Milestone v1.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-20 — Milestone v1.0 completed and archived

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 0. Rename/scope/prune | - | Complete 2026-07-09 | - |
| 02 | 9 | - | - |
| 03 | 11 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02 P01 | 9m | 3 tasks | 39 files |
| Phase 02 P02 | 10min | 3 tasks | 16 files |
| Phase 02 P05 | 14min | 3 tasks | 5 files |
| Phase 01 P12 | 11min | 3 tasks | 11 files |
| Phase 02 P03 | 2h 2m | 3 tasks | 22 files |
| Phase 02 P06 | 16min | 2 tasks | 10 files |
| Phase 02 P08 | 19min | 3 tasks | 20 files |
| Phase 02 P07 | 14min | 3 tasks | 34 files |
| Phase 02 P09 | 155min | 3 tasks | 124 files |
| Phase 03 P01 | 16min | 2 tasks | 8 files |
| Phase 03 P02 | 17min | 3 tasks | 9 files |
| Phase 03 P03 | 13min | 2 tasks | 3 files |
| Phase 03 P04 | 16min | 3 tasks | 6 files |
| Phase 03 P05 | 22min | 3 tasks | 16 files |
| Phase 03 P06 | 17min | 3 tasks | 3 files |
| Phase 03 P07 | 25min | 2 tasks | 11 files |
| Phase 03 P08 | 13min | 3 tasks | 10 files |
| Phase 03 P09 | 5min | 2 tasks | 96 files |
| Phase 03 P10 | 7min | 2 tasks | 16 files |
| Phase 03 P11 | 9min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Six LOCKED decisions constrain all downstream work:

- DEC-phase-structure: Five coarse phases (0–4) adopted verbatim; no finer breakdown (GSD overhead is per-phase).
- DEC-both-conditions-ask: Post-scoped Ask in BOTH conditions; the ONLY isolated variable is graph-memory orchestration.
- DEC-control-no-question-history: Control ranker never consumes question history (enforced by an algorithm-verification test).
- DEC-pruned-features-frozen: §15.3 features never resurrected; DEC-framing-rules: constrained user-facing vocabulary; DEC-scope-boundary: SCOPE.md is the fixed build surface.
- [Phase 02]: Canonical RSD records keep source assets and manifest metadata at the transport boundary. — Prevents pipeline convenience fields from drifting into participant domain records.
- [Phase 02]: Frozen artifacts use fixed filenames and exactly one owned source asset and feed-order entry per post. — Closes path injection and incomplete-bundle boundaries before import.
- [Phase 02]: Collection is operator-authored URL-list only with public destination revalidation at every redirect. — Prevents search/discovery scope creep and closes the SSRF boundary.
- [Phase 02]: Extraction emits full normalized inert text through configured article/transcript adapters. — Preserves later provenance and grounding while excluding active markup and implicit subprocess acquisition.
- [Phase 02]: Dedupe and mechanical quality gates preserve evidence and never approve content. — Final acceptance remains an explicit human-review decision.
- [Phase 02]: Frozen-pool runtime exposure requires fixed packaged filenames, version-qualified staged rows, and a final ready marker; production packaging remains unbound until Plan 09. — This prevents remote acquisition, partial cross-store visibility, ready-version mutation, and accidental coupling to the not-yet-frozen artifact.
- [Phase 02]: Permanent wrapper preprocessing retains strict local schema authority across provider projections. — Provider-native structured formats cannot weaken validation of frozen content.
- [Phase 02]: Codex review remains content-hash-bound and advisory-only. — Only the later operator gate can approve content for freeze.
- [Phase 02]: AI evaluation is fixture-only; tracing is opt-in, loopback-only, exporter-free, and metadata-allowlisted. — Prevents live-provider use and participant-data egress during CI or local observation.
- [Phase 02]: Frozen feed ordering and selectors remain condition- and question-history-blind; dismissed post IDs filter without re-ranking. — Preserves the Phase 2 experimental-isolation boundary and Phase 3 insertion point.
- [Phase 02]: Frozen saved and history state stores IDs and timestamps only; immutable records resolve from frozenFeedService. — Prevents mutable stores from duplicating canonical frozen content.
- [Phase 02]: Generated-feed history compatibility remains isolated until Plan 02-07 removes transitional consumers. — Preserves load-bearing generated-body durability and a green build between execution waves.
- [Phase 02]: Study condition is recorded only at canonical persistence boundaries; Ask behavior is condition-neutral. — Preserves the single-variable study design.
- [Phase 02]: Canonical Q&A rows are the durable UI source and uploads are derived only afterward. — Prevents transport and session caches from replacing exact RSD records.
- [Phase 03]: Source nodes remain outside the nine-type edge table and link through ranking feature sourceId metadata only. — Preserves the exact RSD 10.4 type set and the plan prohibition against inventing a source edge.
- [Phase 03]: Prerequisite labels compile from the prerequisite concept to the dependent concept. — Matches prerequisite_of edge semantics while retaining reviewed label resolution.
- [Phase 03]: The three frozen graph artifacts are mandatory runtime bundle members; the legacy pilot projection remains invalid until an operator re-freezes it.
- [Phase 03]: Ranking features persist per post while the artifact embedding fingerprint stays in ready-version metadata.
- [Phase 03]: Global graph queries remain unavailable until a successful ready-version dbQuery load and return cloned read-only results.
- [Phase 03]: UserConceptState is rebuilt from stable durable contributions rather than updated arithmetically in place.
- [Phase 03]: Graph-memory mutations serialize in-process while replay and repair converge from the canonical research event log.
- [Phase 03]: Interaction logging invokes graph memory only after persistence through an error-isolated lazy hook.
- [Phase 03]: Control ranking remains structurally isolated through an exact-key non-personal input type. — Preserves DEC-control-no-question-history by construction.
- [Phase 03]: Experimental semantic scoring requires an exact embedding fingerprint match and renormalizes unavailable vector legs. — Prevents cross-model cosine comparisons and invalid scores.
- [Phase 03]: Diversity persists only source and recent-concept counters; sufficient-history question count is transient input. — Keeps nextCounters compatible with RecommendationBatch.diversityCounters.
- [Phase 03]: Extraction accepts only same-topic IDs from the single ready frozen pool; label or alias fallback requires one unique match.
- [Phase 03]: Persisted extraction fields are revalidated and reused across retries so LLM drift cannot fork graph contributions.
- [Phase 03]: RQ-02 extends the closed client/backend contract with exactly extractedConceptIds, extractedClaimIds, questionType, and unresolved.
- [Phase 03]: Recommendation payloads keep only RSD 9.9 fields while session sequence, status, and diversity counters live in recommendation_batches.
- [Phase 03]: Personal graph and question readers resolve only inside experimental materialization; control uses frozen pool and session-ledger data.
- [Phase 03]: Experimental trace IDs attach before prose generation; invalid reason prose retries once then uses a deterministic strategy fallback.
- [Phase 03]: Home retains one recommendation session ID and re-reads persisted items without re-ranking served batches. — Preserves the always-mounted Home invariant and stable participant exposure history.
- [Phase 03]: Recommendation reasons use one shared FeedCard shape and log views only on expansion. — Keeps condition shape neutral while producing an intentional reason-view signal.
- [Phase 03]: MasonryFeed carries recommendation, immutable post, and concept labels together. — Keeps reason provenance aligned with the exact persisted recommendation order.
- [Phase 03]: Destructive store retirement requires current caller greps and dbQuery retention proof for every survivor. — Prevents irreversible deletion of live participant data.
- [Phase 03]: IndexedDB v7 and the fallback delete only posts, the generated queue, and generated sessions. — Keeps research, Q&A, history, engagement, frozen-pool, and Phase 3 data intact.
- [Phase 03]: Runtime artifactHashes remains an exact nine-file participant contract while bundleFileHashes covers the broader immutable audit inventory. — Prevents the offline verifier and strict app importer from silently accepting different runtime projections.
- [Phase 03]: The approved review run is promoted only as pilot-graph-20260718 in a new immutable destination. — Preserves the frozen-content boundary and leaves data/content_pool_v1 untouched.
- [Phase 03]: Checksum-bound frozen pool files disable Git text conversion. — Preserves manifest hash validity across Windows checkouts with core.autocrlf enabled.
- [Phase 03]: Production pool selection is tracked configuration constrained to repository data; packaging derives the manifest version and enforces an exact ten-file participant projection. — Prevents legacy version pins, path escape, stale graph assets, and operator-only material from entering participant builds.
- [Phase 03]: Global graph loading is explicit inside the content-pool boot barrier, and failures use POOL_STORED_CORRUPT recovery. — Prevents participant routes and ranking from observing unloaded graph indexes without weakening requireLoaded().
- [Phase 03]: Fresh-pool cutover coverage uses a twelve-post synthetic approved run and real persistence seams for both conditions. — Pins the production boundary offline while proving control isolation, reason policy, trace IDs, and batch completion.

### Pending Todos

None yet.

### Blockers/Concerns

- Open design questions (RSD §20) to resolve before/within later phases: final three study topics, participant language/country, source embed vs click-out, notification cadence, whether experimental personalizes suggested questions, exploration-path UI inclusion, human-review staffing, IRB requirements.
- Phase 1 closeout completed the active-surface dead-code/residue sweep; historical comments and inherited planning artifacts remain non-runtime context only.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-07-21:

| Category | Item | Status |
|----------|------|--------|
| verification_gap | Phase 04: 04-VERIFICATION.md | human_needed — STUDY-05 (3-5-person internal pilot) is participant/operator work a code phase cannot perform (D-13); infrastructure preconditions are fully verified |
| tech_debt | iOS runtime UAT never executed | Waived by research owner after Android emulator matrix passed; deferred until Xcode/macOS access is available |

## Session Continuity

Last session: 2026-07-19T10:19:09.682Z
Stopped at: Completed 03-11-PLAN.md
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
