# QuestionTrace

## What This Is

QuestionTrace is a local-first mobile research prototype (React 19 + TypeScript 5.9 + Vite 7 + Capacitor 8, IndexedDB, user-supplied LLM/embedding keys) for studying post-centered graph-memory feed orchestration. Participants browse a frozen pool of curated real multimedia posts and ask contextual questions under each post; those questions become structured learner traces. In the experimental condition, traces drive future feed orchestration; the control condition gets a strong non-personal feed. It is evaluated as a research instrument via a multi-day field study with oral-explanation outcomes — not as a polished consumer app.

## Core Value

The two study conditions must produce **different but comparable feeds with interpretable recommendation reasons on a frozen content pool, with complete interaction logging** — so the study can argue post-level questions are useful learner traces for feed orchestration. If everything else fails, this must work.

## Business Context

<!-- Research instrument, not monetized. -->

- **Customer**: Research participants (24–36 in the main study; 3–5 in the internal pilot) and the researchers analyzing their traces.
- **Success metric**: Design doc §21 / SCOPE.md success criteria — a study-ready prototype where both conditions produce different-but-comparable feeds with interpretable reasons on a frozen pool, with complete interaction logging; validated by an internal pilot (Phase 4 deliverable).

## Requirements

### Active

Building toward the v0.1 research-instrument milestone. Full checkable list in `.planning/REQUIREMENTS.md`.

- [ ] Phase 1 — Rebrand + research shell hardening (rebrand, storage rename, condition config, interaction logging)
- [ ] Phase 2 — Content pool + feed/post UI on frozen data (schemas, curation pipeline, frozen pool, feed/post UI, suggested questions, post-scoped Ask)
- [ ] Phase 3 — Graph-memory + recommendation engine (content graph, graph-memory, extraction, control + experimental rankers, strategies, diversity rerank, reasons, verification)
- [ ] Phase 4 — Study infrastructure + pilot (onboarding, condition assignment, data export, oral-test support, internal pilot)

### Out of Scope

Permanently removed per design doc §15.3 and SCOPE.md — do not build, do not resurrect:

- Global free-form AI chat — all Q&A is post-scoped; keeps questions mappable into the content graph.
- AI-generated posts as primary content — primary feed is real curated content; AI only preprocesses/summarizes/tags/links.
- Flashcards / spaced repetition / quizzes — outcome is measured by oral explanation, not test-like drills.
- Visible or editable knowledge-graph / mind-map UI — max visibility is a small "exploration path" chip list (§7.7); avoids confounding orchestration with graph-visualization effects.
- Gamification (credits, harvest, streaks, daily goals, leaderboards) — no pushy engagement mechanics.
- Podcast generation, social/comments/community, token-analytics dashboards.
- Live web search / live news / live YouTube inside the participant app — the app runs entirely on the frozen pool; collection is offline in `tools/content_pipeline/`.
- Product polish beyond what the study needs.

## Context

- **Fork lineage**: Forked from the Trellis product (`/Users/Code/EchoLearn`); the fork is independent and never merged back. Trellis-era milestones/phase numbering are historical only (archive: `docs/planning_history/trellis`). This project starts a fresh milestone (v0.1).
- **Prior work reused (Phase 0 prune, done 2026-07-09)**: kept services `db`, `question`, `canonical-knowledge`, `question-filter`, `session` (post-scoped threaded Q&A), `post-history`, `post-queue`, `daily-read`, `settings`, event bus, i18n bundles (en/zh/es/ja), imageGeneration. Routes kept: `/home`, `/posts/:id`, `/saved`, `/settings`, `/onboarding`. All gates green (`tsc -b`, `npm test`, lint, build). See `docs/prune_report.md`.
- **Authoritative design**: `docs/research_system_design.md` (canonical v2.0 SPEC) governs; `docs/SCOPE.md` is the locked scope contract.
- **Study shape**: 5–7 day mobile field study; three semi-open topics (participant picks one); 200–400 approved posts per topic (build one pilot topic of ~50 first). Oral-explanation pretest/post-test outcomes normalized by a verbal baseline.
- **No-refresh assumption**: Capacitor app — users cannot refresh; UI must reactively re-read service state via the event bus on every mutation.

## Constraints

- **Tech stack**: React 19 + TypeScript 5.9 + Vite 7 + Capacitor 8; IndexedDB persistence; user-supplied LLM/embedding API keys; primary target iOS.
- **Frozen pool only**: No live web/news/YouTube fetch in the participant app (CON-no-live-fetch). Content collection is offline in `tools/content_pipeline/`; frozen export to `data/content_pool_v1/`, versioned + immutable.
- **Condition isolation**: The ONLY isolated experimental variable is whether question history feeds graph-memory orchestration. Control ranker must never consume question history (enforced by an algorithm-verification test).
- **Schemas verbatim**: Domain types (Topic, Post, Concept, Claim, SuggestedQuestion, UserQuestion, AIAnswer, UserInteractionEvent, Recommendation, UserConceptState) match `research_system_design.md` §9 field-for-field.
- **Privacy**: Do NOT collect §14.2 categories (screen recordings, out-of-app usage, geolocation, contacts, other app names, clipboard, raw keystroke timing unless approved).
- **Framing (locked copy)**: Never "AI learning feed" (→ "post-centered graph-memory feed orchestration"), "AI tutor" (→ "contextual post-level Q&A as learner trace collection"), "knowledge graph recommendation" (→ "graph-memory orchestration from curiosity question traces"), "mind map" (→ "latent learner memory graph"). Applies to all user-facing copy, code comments, and docs.
- **Native identifiers unchanged**: Rebrand does not change native bundle identifiers (signing/data constraints).
- **Milestone hygiene**: Do not reference or continue Trellis-era milestones/phase numbering.

## Key Decisions

Locked decisions (from `docs/SCOPE.md` LOCKED ADR + operator locks + `research_system_design.md`). These cannot be auto-overridden by any downstream source.

<decisions>

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **DEC-scope-boundary** — Build surface fixed to SCOPE.md "In scope"; out-of-scope never built | Keeps the research instrument focused and unconfounded | 🔒 Locked |
| **DEC-pruned-features-frozen** — §15.3 pruned features never resurrected (podcast, SRS, graph/mindmap UI, gamification, global chat, social, live fetch, token analytics, AI-generated primary posts) | Avoids scope creep + experimental confounds; "exploration path" chip list is the max graph visibility | 🔒 Locked |
| **DEC-both-conditions-ask** — Post-scoped Ask available to BOTH conditions with identical answer quality | Prevents confounding AI Q&A access with the graph-memory treatment | 🔒 Locked |
| **DEC-control-no-question-history** — Control ranker never uses question history, question-derived concept weights, unresolved tracking, echo, or graph continuation/contrast/bridge | Isolates the single experimental variable; enforced by an algorithm-verification unit test | 🔒 Locked |
| **DEC-framing-rules** — Constrained user-facing framing vocabulary (see Constraints) | Keeps the research framing honest and non-overclaiming | 🔒 Locked |
| **DEC-phase-structure** — Five coarse phases (0–4) adopted verbatim; Phase 0 complete; no finer breakdown | GSD workflow overhead is per-phase; operator wants phases as coarse as possible | 🔒 Locked |

</decisions>

Proposed design decisions (rationale-backed in the canonical SPEC §18; not independently locked but several reinforce the locks above): real curated content not AI-generated posts; post-centered Q&A not global chat; no full knowledge graph exposed; three semi-open topics; 200–400 posts/topic; oral-explanation assessment; pretest verbal baseline.

---
*Last updated: 2026-07-10 after new-project ingest bootstrap (Phase 0 already complete)*
