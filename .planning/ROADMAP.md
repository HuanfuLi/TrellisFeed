# Roadmap: Milestone v1.6 — Control, Graph Trust, Retrieval, and Ethical Engagement

**Starting phase:** 47 (continuing from v1.5, which ended at Phase 46)
**Granularity:** Standard (default; `.planning/config.json` has no explicit granularity key)
**Total requirements:** 26
**Target phases:** 7

## Overview

v1.6 answers 5 professor questions asked after a Trellis demo. Three are product features (Q3 podcast controls, Q4 engagement vs learning, Q5 retrieval); two are mixed (Q1 mind-map generation has a private-answer half + a product-feature edit/correct half; Q2 filter has a private-answer diagnosis half + a product-feature redesign half). Mind-map generation transparency is intentionally NOT a product surface.

Phase 47 is the only urgent product fix carried over from the demo: the existing regex-based off-topic filter is brittle, false-flags legitimate "What is a system prompt?" questions, and lets small talk through. v1.6 replaces the classifier strategy entirely (LLM-only / embedding-similarity / hybrid with a much narrower regex fast-path), adds a pre-LLM gate that rejects malicious prompts before any provider call, and adds structural bracketing as defense in depth. Subsequent phases give the user manual graph-correction control, retrieval/library/dashboard recovery, podcast quality + length/style controls, and ethical engagement guardrails (with the provider payload sanitizer shipping alongside the goals/reflections fields it protects).

There is **no foundation phase**. The prior agent's FOUND-01..05 scaffolding (cross-cutting schema, migration normalization, event-payload contract, payload boundary, structural bracketing) was either invented (no real problem to solve) or coupled tightly to a specific feature phase that should own it.

## Phases

**Phase Numbering:**
- Integer phases (47, 48, …): Planned milestone work
- Decimal phases (47.1, 47.2): Urgent insertions, if needed

- [x] **Phase 47: Filter Redesign — Off-Topic + Malicious Prompt Prevention** — Replace regex-based classifier; pre-LLM gate (block malicious from request); structural injection bracketing at provider boundary; held-out eval set; per-question override.
- [x] **Phase 48: Graph Command Service and Trust Invariants** — Validated graph correction commands, undo metadata, manual locks, stale-write protection. (Completed 2026-05-17)
- [ ] **Phase 49: Graph Correction UI** — Selected-node correction controls in GraphScreen; preview/confirm for high-impact actions; durability across reload.
- [ ] **Phase 50: Retrieval and Library Foundation** — Bounded archive search; local-first tags/bookmarks.
- [ ] **Phase 51: Concept Dashboard and Recovery Surfaces** — Per-concept dashboard joining Q&A, archive, review, podcast, tag, weak/due signals.
- [ ] **Phase 52: Podcast Quality Defaults and Learner Controls** — Educational defaults; bounded length/style controls; option identity; TTS safety checks.
- [ ] **Phase 53: Engagement Guardrails + Provider Privacy** — Goals, stop cues, sparse reflection prompts, cue controls; provider payload sanitizer ships with the new fields it protects.

## Phase Details

### Phase 47: Filter Redesign — Off-Topic + Malicious Prompt Prevention
**Goal**: Replace the regex-based off-topic classifier with a fundamentally more robust strategy; block malicious prompts from the LLM request entirely; add structural bracketing as defense in depth so legitimate LLM/security questions reach the answer LLM safely.
**Depends on**: Phase 46
**Requirements**: FILTER-01, FILTER-02, FILTER-03, FILTER-04, FILTER-05
**Success Criteria** (what must be TRUE):
  1. The regex-only path in `app/src/services/question-filter.service.ts` is replaced (or relegated to a much narrower fast-path); a non-regex strategy (LLM-only / embedding-similarity / hybrid — chosen during phase research) makes the primary classification decision.
  2. User prompts classified as malicious/prompt-injection are NOT sent to the answer LLM; the user sees a clear in-app message and no provider tokens are spent on the malicious prompt.
  3. User prompts classified as off-topic are answered in chat but do not enter mind map, review, feed, podcast context, retrieval index, or learning surfaces.
  4. Legitimate learning questions about LLM/security/safety (e.g., "What is a system prompt?", "What is prompt injection?", "How does jailbreaking work?") pass the classifier and reach durable knowledge surfaces. The classifier does not inspect intent verbs.
  5. User-supplied content reaching LLM (and prompt-bearing TTS/embedding) providers is structurally bracketed/delimited at the provider wrapper; goldens cover representative injection-style inputs and verify system instructions cannot be overridden.
  6. A held-out eval set with at least one labeled example per surfaced failure mode (small-talk false-negative such as "How are you doing?", legitimate-LLM-question false-positive such as "What is a system prompt?") lives under version control and runs in the test suite.
  7. User can override the off-topic flag on any individual exchange; the override persists across reloads and propagates to durable-knowledge consumers.
**Plans**: 6 plans
- [x] 47-01-PLAN.md — Wave 0: corpus JSON + held-out eval fixture + deterministic embedding mock + i18n bundles (en/zh/es/ja)
- [x] 47-02-PLAN.md — Wave 1: filter-corpus.service.ts cache + question-filter.service.ts hybrid Layer 1 + Layer 2 rewrite + eval-set runner (FILTER-01, FILTER-04)
- [x] 47-03-PLAN.md — Wave 1: provider-wrapper bracketing (user-content-bracketing.ts) + TTS/embedding exemption tests (FILTER-03)
- [x] 47-04-PLAN.md — Wave 2: useQuestions.askStreaming pre-gate inversion + ChatMessage malicious-block render + SessionMessage.kind discriminator (FILTER-01, FILTER-02)
- [x] 47-05-PLAN.md — Wave 2: question.service.ask mirror inversion (FILTER-01, FILTER-02)
- [x] 47-06-PLAN.md — Wave 3: AskScreen.handleQuestionOverride D-06 re-fire + final integration sign-off (FILTER-05) — includes UAT-5 dual-vector fix at `122cda59`
**Spike/research expected**: choosing the classifier strategy is a within-phase decision (research step), not a pre-locked choice in CONTEXT.md.

### Phase 48: Graph Command Service and Trust Invariants
**Goal**: Graph corrections are validated transactions over canonical `Question` records, with undo and stale-write protection before any correction UI ships.
**Depends on**: Phase 47
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04
**Success Criteria** (what must be TRUE):
  1. Rename, move, merge, detach, prune/delete, and undo commands run through one graph command service boundary.
  2. Corrected graph records preserve parent IDs, labels, cluster IDs, counts, summaries, review links, source Q&A content, and retrieval identity.
  3. User-visible graph state survives app reload after a command commits.
  4. In-flight classification or global reorganization results cannot overwrite protected manual corrections.
**Plans**: 4 plans
**Wave 1**
- [x] 48-01-PLAN.md — Wave 1: graph-edit-journal.service + GraphEditLogEntry type + GRAPH_UPDATED payload extension + reorganizeMindmap prompt injection (GRAPH-04) — 2026-05-17

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 48-02-PLAN.md — Wave 2: graph-command.service skeleton + rename + move + delete (GRAPH-01, GRAPH-02, GRAPH-03) — 2026-05-17

**Wave 3** *(blocked on Wave 2 completion; Plan 48-04 sequenced after 48-03 to avoid concurrent edits of `graph-command.service.ts`)*
- [x] 48-03-PLAN.md — Wave 3: merge + detach + prune (GRAPH-03) — 2026-05-17
- [x] 48-04-PLAN.md — Wave 3: undo (inverse-verb with swapped snapshots) + integration + reload-survival + operator review (GRAPH-01, GRAPH-03, GRAPH-04) — 2026-05-17

**Cross-cutting constraints** (every plan's `must_haves.truths` includes these):
- All commands return `ServiceResult<T>` and route writes through `questionService.patchQuestion` / `questionService.delete` (no direct localStorage writes from `graph-command.service.ts`).
- Each successful command writes exactly ONE `GraphEditLogEntry` to `trellis_graph_edit_log`, capped at N=10 (append-only; FIFO eviction).
- Each successful command emits a typed `GRAPH_UPDATED` with `payload.kind` matching the command verb (delete/merge produce an additional untyped emit from `questionService.delete` — intentional and idempotent).
- Manual corrections appear in the next `reorganizeMindmap` LLM prompt as constraints (D-01, journal-as-prompt-constraint, not per-node lock).

### Phase 49: Graph Correction UI
**Goal**: Users can correct selected mind-map nodes through clear local controls backed by the graph command service.
**Depends on**: Phase 48
**Requirements**: GRAPHUI-01, GRAPHUI-02, GRAPHUI-03
**Success Criteria** (what must be TRUE):
  1. User can select a graph node and open local correction controls (rename, move, merge, detach, prune/delete) for that node.
  2. User can preview and confirm high-impact graph actions such as merge, prune/delete, and undo before committing.
  3. User sees the corrected graph after navigation away, navigation back, or app reload.
**Plans**: TBD
**UI hint**: yes
**Note on scope**: per-node "why was this placed here" inspection is **out of scope** (private answer to professor Q1, not a product feature).

### Phase 50: Retrieval and Library Foundation
**Goal**: Users can recover prior posts through bounded local search and apply local-first tags/bookmarks that persist across days.
**Depends on**: Phase 49
**Requirements**: RETRIEVE-01, RETRIEVE-02
**Success Criteria** (what must be TRUE):
  1. User can search Saved, Liked, and History items by title, body, concept, source, and date.
  2. User can reopen the original post from a search result without losing its concept/source context.
  3. User can tag or bookmark posts and concepts with local metadata that persists after reload.
  4. User can filter retrieval results by saved, liked, history, tag, bookmark, concept, source, and date without entering an infinite recommendation flow.
**Plans**: TBD
**UI hint**: yes

### Phase 51: Concept Dashboard and Recovery Surfaces
**Goal**: Users can open a concept-level home that joins local learning artifacts and routes them toward recovery, review, and retrieval.
**Depends on**: Phase 50
**Requirements**: RETRIEVE-03, RETRIEVE-04
**Success Criteria** (what must be TRUE):
  1. User can open a concept dashboard from concept-linked surfaces.
  2. User can see the concept's Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals in one bounded view.
  3. User can jump from the dashboard to the original post, Q&A, review action, podcast mention, or tag-filtered retrieval result.
  4. Dashboard and retrieval surfaces prioritize search, filters, dashboard navigation, and review actions instead of endless scrolling.
**Plans**: TBD
**UI hint**: yes

### Phase 52: Podcast Quality Defaults and Learner Controls
**Goal**: Users can generate higher-quality educational podcasts with bounded controls that preserve concept coverage and cache identity.
**Depends on**: Phase 51
**Requirements**: PODCAST-01, PODCAST-02, PODCAST-03, PODCAST-04, PODCAST-05
**Success Criteria** (what must be TRUE):
  1. Default podcast generation includes recap, connections, misconception checks, retrieval questions, and a next action.
  2. User can choose bounded podcast length and style before generation.
  3. Regenerated or cached podcasts honor the chosen options, concept IDs, locale, and options hash.
  4. Podcast output preserves required concept coverage across length/style settings; style controls cannot degrade learning density into entertainment-only output.
  5. TTS model, voice, and speed changes have provider-safe fallback behavior and device UAT evidence before defaults change.
**Plans**: TBD
**UI hint**: yes

### Phase 53: Engagement Guardrails + Provider Privacy
**Goal**: Users can shape feed progress around learning outcomes, receive sparse recovery-oriented cues, and control those cues without pressure loops; new private fields (goals, reflection responses) ship with provider payload sanitization.
**Depends on**: Phase 52
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, PRIVACY-01
**Success Criteria** (what must be TRUE):
  1. User can set or accept a lightweight daily learning goal based on concepts learned, reviewed, reflected on, or corrected.
  2. User sees a stop cue after a meaningful threshold, with routes to review, reflection, podcast, planner, or closing the app.
  3. User receives sparse retrieval/reflection prompts after meaningful engagement clusters without being interrupted on every post.
  4. User can snooze or disable ethical cues, and Trellis does not add public likes, leaderboards, streak pressure, or engagement-maximizing loops.
  5. Provider-bound LLM and TTS payload tests confirm the new private fields (goals, reflection responses, tags, saved/liked/history, graph correction logs) are excluded from outbound provider requests by default.
**Plans**: TBD
**UI hint**: yes

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| FILTER-01 | Phase 47 |
| FILTER-02 | Phase 47 |
| FILTER-03 | Phase 47 |
| FILTER-04 | Phase 47 |
| FILTER-05 | Phase 47 |
| GRAPH-01 | Phase 48 |
| GRAPH-02 | Phase 48 |
| GRAPH-03 | Phase 48 |
| GRAPH-04 | Phase 48 |
| GRAPHUI-01 | Phase 49 |
| GRAPHUI-02 | Phase 49 |
| GRAPHUI-03 | Phase 49 |
| RETRIEVE-01 | Phase 50 |
| RETRIEVE-02 | Phase 50 |
| RETRIEVE-03 | Phase 51 |
| RETRIEVE-04 | Phase 51 |
| PODCAST-01 | Phase 52 |
| PODCAST-02 | Phase 52 |
| PODCAST-03 | Phase 52 |
| PODCAST-04 | Phase 52 |
| PODCAST-05 | Phase 52 |
| LEARN-01 | Phase 53 |
| LEARN-02 | Phase 53 |
| LEARN-03 | Phase 53 |
| LEARN-04 | Phase 53 |
| PRIVACY-01 | Phase 53 |

**Coverage:** 26 / 26 active v1.6 requirements mapped. No orphaned requirements. No duplicate mappings.

## Progress

**Execution Order:**
Phases execute in numeric order: 47 → 48 → 49 → 50 → 51 → 52 → 53

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 47. Filter Redesign — Off-Topic + Malicious Prompt Prevention | 0/6 | Planned | - |
| 48. Graph Command Service and Trust Invariants | TBD | Not started | - |
| 49. Graph Correction UI | TBD | Not started | - |
| 50. Retrieval and Library Foundation | TBD | Not started | - |
| 51. Concept Dashboard and Recovery Surfaces | TBD | Not started | - |
| 52. Podcast Quality Defaults and Learner Controls | TBD | Not started | - |
| 53. Engagement Guardrails + Provider Privacy | TBD | Not started | - |

---
*Roadmap created: 2026-05-13*
*Overhauled: 2026-05-15 — dropped invented foundation phase (was Phase 47); collapsed FOUND-05 + INGEST-01..04 into new Phase 47 "Filter Redesign" (replace approach, not tune regex; pre-LLM gate; structural bracketing). Renumbered phases 49→48, 50→49, 51→50, 52→51, 53→52, 54→53. Dropped LEARN-04 (invented metrics req); folded provider privacy sanitizer (PRIVACY-01) into Phase 53 alongside the LEARN fields it protects. Mind-map generation transparency moved to Out of Scope (private professor answer, not product). 8 phases / 30 reqs → 7 phases / 26 reqs.*
