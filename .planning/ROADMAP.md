# Roadmap: QuestionTrace

## Overview

QuestionTrace goes from a pruned research shell (Phase 0, done) to a study-ready prototype through four coarse phases: harden and rebrand the shell with logging + condition plumbing (Phase 1), stand up the frozen curated content pool and the feed/post/Ask UI on top of it (Phase 2), build the two-layer graph-memory model and the control + experimental rankers that produce different-but-comparable feeds with interpretable reasons (Phase 3), then add study infrastructure and run an internal pilot that proves the instrument is IRB-ready (Phase 4). Phases are deliberately large — GSD workflow overhead is per-phase, and the operator has locked this five-phase structure verbatim.

## Phases

**Phase Numbering:**

- Phase 0 is complete (rename/scope/prune, done 2026-07-09).
- The five coarse phases (0–4) are LOCKED (DEC-phase-structure) — adopted verbatim from root `ROADMAP.md`. Do not split into finer phases.

- [x] **Phase 0: Rename, scope, and prune** - Fork adopted QuestionTrace; product features pruned per §15.3; all gates green (done 2026-07-09)
- [ ] **Phase 1: Rebrand + research shell hardening** - Branded shell with condition config + interaction logging plumbing
- [ ] **Phase 2: Content pool + feed/post UI on frozen data** - Real curated frozen pool browsable, with post-scoped Ask
- [ ] **Phase 3: Graph-memory + recommendation engine** - Two conditions produce different-but-comparable feeds with interpretable reasons
- [ ] **Phase 4: Study infrastructure + pilot** - Onboarding, condition assignment, data export, oral-test support; internal pilot; IRB-ready

## Phase Details

### Phase 0: Rename, scope, and prune

**Goal**: Reduce the Trellis product prototype to a clean QuestionTrace research shell.
**Depends on**: Nothing (first phase)
**Requirements**: (none — completed before requirement tracking began)
**Success Criteria** (what must be TRUE):

  1. Repo/product adopts the QuestionTrace name; canonical design docs + SCOPE + CLAUDE/AGENTS rewritten.
  2. All §15.3 product features pruned (podcast, SRS, graph/mindmap UI, gamification, global chat, collections, token analytics, live fetch).
  3. All gates green: `tsc -b`, `npm test`, `npm run lint` (0 errors), `npm run build`; browser smoke test passed.

**Plans**: Complete (see `docs/prune_report.md`)
**Status**: Complete (2026-07-09)

### Phase 1: Rebrand + research shell hardening

**Goal**: A stable, branded research app shell with interaction logging and condition-assignment plumbing in place before any personalization is built.
**Depends on**: Phase 0
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, LOG-01, RQ-01
**Success Criteria** (what must be TRUE):

  1. No user-facing "Trellis" strings remain in active screens or the 4 locale bundles; native bundle identifiers are unchanged.
  2. IndexedDB and localStorage use the `questiontrace_*` namespace (no migration framework; old keys orphaned) and the test suite passes against the new names.
  3. A `"control" | "experimental"` condition value is assignable and readable app-wide, and downstream services can branch on it.
  4. `UserInteractionEvent` logging records every §14.1 event type with userId/condition/topicId/timestamp, excludes all §14.2 do-not-collect categories, and exists before any personalization.
  5. No unreferenced code, exports, or assets tied to §15.3 pruned features remain in `app/src`; all gates stay green after the sweep.

**Plans**: 10 plans (5 waves)
**Wave 1**

- [ ] 01-01-PLAN.md — Rebrand display/native/locale surfaces; preserve bundle IDs (SHELL-01)
- [ ] 01-02-PLAN.md — Storage namespace rename to `questiontrace` + research-store schema; remove legacy migration (SHELL-02)
- [ ] 01-03-PLAN.md — Backend: Cloudflare Worker + D1 ingest/resolve + validation (idempotent, field-allowlisted) (LOG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-04-PLAN.md — Research types + immutable study-context (condition plumbing) + App hydration gate (SHELL-03)
- [ ] 01-05-PLAN.md — Backend: password-protected admin page + CSV/ZIP export + deploy checkpoint (LOG-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-06-PLAN.md — Durable upload queue + retry + upload-health metadata (LOG-01)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-07-PLAN.md — Interaction-log service: whitelisted events + revisioned Q/A records (LOG-01)
- [ ] 01-09-PLAN.md — Participant surface reduction + PIN-gated researcher diagnostics + recovery export (SHELL-04, LOG-01)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-08-PLAN.md — Instrumentation wiring at call sites + RQ-01 coverage (LOG-01, RQ-01)
- [ ] 01-10-PLAN.md — Dead-code sweep: pruned residue removed, load-bearing infra preserved (SHELL-04)

**UI hint**: no

### Phase 2: Content pool + feed/post UI on frozen data

**Goal**: Participants can browse real curated content from a frozen pool and ask questions against it — the temporary AI-generated feed shell is fully replaced.
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, FEED-01, FEED-02, ASK-01
**Success Criteria** (what must be TRUE):

  1. Domain schemas (Topic, Post, Concept, Claim, SuggestedQuestion, UserQuestion, AIAnswer, Recommendation, UserConceptState) match RSD §9 field-for-field.
  2. The offline `tools/content_pipeline/` produces human-approved posts from raw candidates, and one pilot topic (~50 approved posts) is exported to an immutable, versioned `data/content_pool_v1/`.
  3. Feed home + post detail render the frozen pool with AI wrapper (hook, summary, concept tags) and original source embed/link — with no live fetch in the participant app.
  4. Pre-generated suggested questions appear on post detail, and post-scoped Ask works identically for both conditions with UserQuestion + AIAnswer persisted.

**Plans**: 5/9 plans executed

- [x] 02-01-PLAN.md
- [x] 02-02-PLAN.md
- [x] 02-03-PLAN.md
- [ ] 02-04-PLAN.md
- [x] 02-05-PLAN.md
- [x] 02-06-PLAN.md
- [ ] 02-07-PLAN.md
- [ ] 02-08-PLAN.md
- [ ] 02-09-PLAN.md

**UI hint**: yes

### Phase 3: Graph-memory + recommendation engine

**Goal**: The two conditions produce different but comparable feeds — a strong non-personal control feed and a graph-memory-orchestrated experimental feed with interpretable reasons.
**Depends on**: Phase 2
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, RANK-06, RQ-02
**Success Criteria** (what must be TRUE):

  1. A two-layer graph exists — global content edges (§10.4) plus per-user personal edges and `UserConceptState` that update per the §10.6 rules from question/interaction traces.
  2. The control ranker scores per §11.7 and provably never consumes question history (algorithm-verification test passes), while the experimental ranker scores per §11.3–11.4 with configurable weights.
  3. Each experimental recommendation carries exactly one orchestration strategy (continue/deepen/contrast/bridge/echo), the feed is diversity-reranked (§11.6), and reasons are interpretable — experimental attaches contributing trace IDs; control uses non-personal labels only.
  4. All §12.3 algorithm-verification unit tests pass (question relevance, contrast, redundancy, aged echo, control isolation, experimental reason trace IDs).

**Plans**: TBD
**UI hint**: yes

### Phase 4: Study infrastructure + pilot

**Goal**: The prototype is a runnable, IRB-ready study instrument validated by an internal pilot.
**Depends on**: Phase 3
**Requirements**: STUDY-01, STUDY-02, STUDY-03, STUDY-04, RQ-03, STUDY-05
**Success Criteria** (what must be TRUE):

  1. A participant can complete onboarding (welcome, language, consent covering §14.3, LLM setup) and pick one of three topics; condition is assigned via topic-stratified randomization, persisted, and drives ranker + logging.
  2. Researchers can export analyzable logs, user questions, AI answers, and recommendations, with all §14.2 categories excluded.
  3. Pre/post oral explanations (verbal + domain baseline, post-test) are captured and transcribed, and the exported data supports the §13.4 scoring dimensions and §13.5 normalization.
  4. An internal pilot (3–5 users) runs end-to-end, surfaced issues are fixed, and the system is IRB-ready.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Rename, scope, and prune | - | Complete | 2026-07-09 |
| 1. Rebrand + research shell hardening | 0/10 | Planned | - |
| 2. Content pool + feed/post UI on frozen data | 5/9 | In Progress|  |
| 3. Graph-memory + recommendation engine | 0/TBD | Not started | - |
| 4. Study infrastructure + pilot | 0/TBD | Not started | - |
