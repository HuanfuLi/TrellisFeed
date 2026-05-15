# Roadmap: Milestone v1.6 - Control, Graph Trust, Retrieval, and Ethical Engagement

**Starting phase:** 47 (continuing from v1.5, which ended at Phase 46)
**Granularity:** Standard (default; `.planning/config.json` has no explicit granularity key)
**Total requirements:** 30
**Target phases:** 8

## Overview

v1.6 turns Trellis from a compelling learning feed into a more trustworthy learner-controlled system. The milestone first protects local data, event semantics, migration safety, provider privacy boundaries, and structural prompt-injection prevention, then sharpens the existing off-topic classifier so chat stays natural while small talk and app meta cannot pollute durable knowledge. With a reliable ingestion gate in place, graph corrections move through a tested command service before GraphScreen exposes correction controls. Retrieval and library capabilities follow stable graph identity, then podcast controls build on trustworthy concept identity and retrieval context. Ethical engagement ships last so goals, stop cues, prompts, and metrics can consume mature local learning signals instead of save/like/dismiss engagement signals.

## Phases

**Phase Numbering:**
- Integer phases (47, 48, 49): Planned milestone work
- Decimal phases (47.1, 47.2): Urgent insertions, if needed

- [ ] **Phase 47: Data, Events, Migration, and Privacy Foundation** - Establish explicit v1.6 schemas, migrations, on-topic event propagation, provider payload boundaries, and structural prompt-injection bracketing at the LLM/TTS provider boundary.
- [ ] **Phase 48: Off-Topic Classifier Robustness** - Make the existing binary off-topic classifier reliable on small-talk false-negatives and LLM/security false-positives, with a versioned eval set and a per-question override path.
- [ ] **Phase 49: Graph Command Service and Trust Invariants** - Add validated graph correction commands, undo metadata, manual locks, and stale-write protection.
- [ ] **Phase 50: Graph Correction UI** - Expose selected-node correction controls in GraphScreen without making MindElixir the source of truth.
- [ ] **Phase 51: Retrieval and Library Foundation** - Add bounded archive search plus local-first tags/bookmarks backed by retrieval/library services.
- [ ] **Phase 52: Concept Dashboard and Recovery Surfaces** - Give each concept a bounded dashboard that joins Q&A, archive, review, podcast, tag, and weak/due signals.
- [ ] **Phase 53: Podcast Quality Defaults and Learner Controls** - Add educational podcast defaults, bounded length/style controls, option identity, and TTS safety checks.
- [ ] **Phase 54: Ethical Engagement and Learning Guardrails** - Add goals, stop cues, sparse reflection/retrieval prompts, separate learning metrics, and cue controls.

## Phase Details

### Phase 47: Data, Events, Migration, and Privacy Foundation
**Goal**: v1.6 state can be represented, loaded, reset, and protected without overloading old fields, without leaking private local context to providers, and without exposing the LLM/TTS provider boundary to prompt-injection from user content.
**Depends on**: Phase 46
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. Existing v1.5 localStorage and SQLite data loads into v1.6 without crashing screens or services.
  2. Every ask event carries the binary `flagged` (off-topic) bit so graph, retrieval, podcast, review, and learning-metric consumers can filter durable-learning events from off-topic chat without re-running the classifier.
  3. New graph-trust, podcast-option, retrieval/library, and learning-engagement metadata exists without reusing `Question.flagged` as a catch-all state. Ingestion stays on the existing `flagged` bit — no new ingestion-state enum.
  4. Provider-bound LLM and TTS payload tests show goals, tags, saved/liked history, graph correction logs, and reflections are excluded by default.
  5. User-supplied content reaching LLM (and prompt-bearing TTS/embedding) providers is structurally bracketed/delimited at the provider boundary; goldens cover representative injection-style inputs and verify system instructions cannot be overridden by content embedded in user input.
**Plans**: TBD

### Phase 48: Off-Topic Classifier Robustness
**Goal**: Improve the existing binary off-topic classifier on its two surfaced failure modes — small-talk false-negatives and LLM/security false-positives — without introducing a richer ingestion-state machine. Prompt-injection prevention is FOUND-05's structural concern, not a classifier responsibility.
**Depends on**: Phase 47
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04
**Success Criteria** (what must be TRUE):
  1. Greetings, jokes, thanks, small talk (e.g., "How are you doing?"), and app-meta chatter remain answerable in chat but are reliably caught by the off-topic classifier and never enter graph, review, feed, podcast, retrieval, or learning metrics.
  2. Legitimate learning questions about LLM/security/safety (e.g., "What is a system prompt?", "What is prompt injection?", "How does jailbreaking work?") pass the classifier and reach durable knowledge surfaces. The classifier does not inspect intent verbs.
  3. A held-out eval set with at least one labeled example per failure mode is checked into the repo and runs in the test suite; thresholds and prompts cannot regress on those examples without a documented waiver.
  4. User can override the off-topic flag on any individual exchange through the existing per-question `flagged` toggle; the override persists across reloads and propagates via the FOUND-03 event payload.
**Plans**: TBD
**UI hint**: minimal — uses existing flagged-override surface; no new triage queue or four-state UI.

### Phase 49: Graph Command Service and Trust Invariants
**Goal**: Graph corrections are validated transactions over canonical `Question` records, with undo and stale-write protection before any correction UI ships.
**Depends on**: Phase 48
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04
**Success Criteria** (what must be TRUE):
  1. Rename, move, merge, detach, prune/delete, and undo commands run through one graph command service boundary.
  2. Corrected graph records preserve parent IDs, labels, cluster IDs, counts, summaries, review links, source Q&A content, and retrieval identity.
  3. User-visible graph state survives app reload after a command commits.
  4. In-flight classification or global reorganization results cannot overwrite protected manual corrections.
**Plans**: TBD

### Phase 50: Graph Correction UI
**Goal**: Users can inspect and correct selected mind-map nodes through clear local controls backed by the graph command service.
**Depends on**: Phase 49
**Requirements**: GRAPHUI-01, GRAPHUI-02, GRAPHUI-03
**Success Criteria** (what must be TRUE):
  1. User can select a graph node and open local correction controls for that node.
  2. User can inspect why a node was placed where it is before deciding whether to correct it.
  3. User can preview and confirm high-impact graph actions such as merge, prune/delete, and undo.
  4. User sees the corrected graph after navigation away, navigation back, or app reload.
**Plans**: TBD
**UI hint**: yes

### Phase 51: Retrieval and Library Foundation
**Goal**: Users can recover prior posts through bounded local search and apply local-first tags/bookmarks that persist across days.
**Depends on**: Phase 50
**Requirements**: RETRIEVE-01, RETRIEVE-02
**Success Criteria** (what must be TRUE):
  1. User can search Saved, Liked, and History items by title, body, concept, source, and date.
  2. User can reopen the original post from a search result without losing its concept/source context.
  3. User can tag or bookmark posts and concepts with local metadata that persists after reload.
  4. User can filter retrieval results by saved, liked, history, tag, bookmark, concept, source, and date without entering an infinite recommendation flow.
**Plans**: TBD
**UI hint**: yes

### Phase 52: Concept Dashboard and Recovery Surfaces
**Goal**: Users can open a concept-level home that joins local learning artifacts and routes them toward recovery, review, and retrieval.
**Depends on**: Phase 51
**Requirements**: RETRIEVE-03, RETRIEVE-04
**Success Criteria** (what must be TRUE):
  1. User can open a concept dashboard from concept-linked surfaces.
  2. User can see the concept's Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals in one bounded view.
  3. User can jump from the dashboard to the original post, Q&A, review action, podcast mention, or tag-filtered retrieval result.
  4. Dashboard and retrieval surfaces prioritize search, filters, dashboard navigation, and review actions instead of endless scrolling.
**Plans**: TBD
**UI hint**: yes

### Phase 53: Podcast Quality Defaults and Learner Controls
**Goal**: Users can generate higher-quality educational podcasts with bounded controls that preserve concept coverage and cache identity.
**Depends on**: Phase 52
**Requirements**: PODCAST-01, PODCAST-02, PODCAST-03, PODCAST-04, PODCAST-05
**Success Criteria** (what must be TRUE):
  1. Default podcast generation includes recap, connections, misconception checks, retrieval questions, and a next action.
  2. User can choose bounded podcast length and style before generation.
  3. Regenerated or cached podcasts honor the chosen options, concept IDs, locale, and options hash.
  4. Podcast output preserves required concept coverage across length/style settings or clearly explains what was omitted.
  5. TTS model, voice, and speed changes have provider-safe fallback behavior and device UAT evidence before defaults change.
**Plans**: TBD
**UI hint**: yes

### Phase 54: Ethical Engagement and Learning Guardrails
**Goal**: Users can shape feed progress around learning outcomes, receive sparse recovery-oriented cues, and control those cues without pressure loops.
**Depends on**: Phase 53
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05
**Success Criteria** (what must be TRUE):
  1. User can set or accept a lightweight daily learning goal based on concepts learned, reviewed, reflected on, or corrected.
  2. User sees a stop cue after a meaningful threshold, with routes to review, reflection, podcast, planner, or closing the app.
  3. User receives sparse retrieval/reflection prompts after meaningful engagement clusters without being interrupted on every post.
  4. Learning metrics remain separate from save/like/dismiss engagement signals and emphasize recall, review, graph corrections, concept coverage, and reflections.
  5. User can snooze or disable ethical cues, and Trellis does not add public likes, leaderboards, streak pressure, or engagement-maximizing loops.
**Plans**: TBD
**UI hint**: yes

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| FOUND-01 | Phase 47 |
| FOUND-02 | Phase 47 |
| FOUND-03 | Phase 47 |
| FOUND-04 | Phase 47 |
| FOUND-05 | Phase 47 |
| INGEST-01 | Phase 48 |
| INGEST-02 | Phase 48 |
| INGEST-03 | Phase 48 |
| INGEST-04 | Phase 48 |
| GRAPH-01 | Phase 49 |
| GRAPH-02 | Phase 49 |
| GRAPH-03 | Phase 49 |
| GRAPH-04 | Phase 49 |
| GRAPHUI-01 | Phase 50 |
| GRAPHUI-02 | Phase 50 |
| GRAPHUI-03 | Phase 50 |
| RETRIEVE-01 | Phase 51 |
| RETRIEVE-02 | Phase 51 |
| RETRIEVE-03 | Phase 52 |
| RETRIEVE-04 | Phase 52 |
| PODCAST-01 | Phase 53 |
| PODCAST-02 | Phase 53 |
| PODCAST-03 | Phase 53 |
| PODCAST-04 | Phase 53 |
| PODCAST-05 | Phase 53 |
| LEARN-01 | Phase 54 |
| LEARN-02 | Phase 54 |
| LEARN-03 | Phase 54 |
| LEARN-04 | Phase 54 |
| LEARN-05 | Phase 54 |

**Coverage:** 30 / 30 active v1.6 requirements mapped. No orphaned requirements. No duplicate mappings.

## Progress

**Execution Order:**
Phases execute in numeric order: 47 -> 48 -> 49 -> 50 -> 51 -> 52 -> 53 -> 54

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 47. Data, Events, Migration, and Privacy Foundation | TBD | Not started | - |
| 48. Off-Topic Classifier Robustness | TBD | Not started | - |
| 49. Graph Command Service and Trust Invariants | TBD | Not started | - |
| 50. Graph Correction UI | TBD | Not started | - |
| 51. Retrieval and Library Foundation | TBD | Not started | - |
| 52. Concept Dashboard and Recovery Surfaces | TBD | Not started | - |
| 53. Podcast Quality Defaults and Learner Controls | TBD | Not started | - |
| 54. Ethical Engagement and Learning Guardrails | TBD | Not started | - |

---
*Roadmap created: 2026-05-13*
*Last updated: 2026-05-15 — Phase 47 (FOUND-05 added: structural prompt-injection bracketing) and Phase 48 (renamed to Off-Topic Classifier Robustness; INGEST-01..04 reframed around classifier reliability + override, removing the four-state triage UI). Phase 47 discussion was paused on 2026-05-15 to apply this correction; resume with `/gsd-discuss-phase 47`.*
