# QuestionTrace

## What This Is

QuestionTrace is a local-first mobile research prototype (React 19 + TypeScript 5.9 + Vite 7 + Capacitor 8, IndexedDB, user-supplied LLM/embedding keys) for studying post-centered graph-memory feed orchestration. Participants browse a frozen pool of curated real multimedia posts and ask contextual questions under each post; those questions become structured learner traces. In the experimental condition, traces drive future feed orchestration; the control condition gets a strong non-personal feed. It is evaluated as a research instrument via a multi-day field study with oral-explanation outcomes — not as a polished consumer app.

## Current State

**v1.0 (Research Instrument) shipped 2026-07-20.** The prototype is a complete, IRB-ready study instrument: both study conditions render the frozen 77-post `pilot-graph-20260718` pool with post-scoped Ask, the control ranker (non-personal, §11.7) and experimental graph-memory ranker (§11.3–11.4, 5 orchestration strategies) produce different-but-comparable feeds with interpretable reasons, and every required interaction/recommendation/Q&A event flows through a consent-gated outbox to a live Cloudflare Worker + D1 backend with a four-file researcher export (`docs/pilot_protocol.md`). The live backend transport was verified end-to-end on 2026-07-20 with a real Android device (fresh API 36 WebView, seeded account 1001, 19 real events delivered).

**What's left before the actual field study:** the genuine 3–5-person internal pilot (STUDY-05) — real human participants completing onboarding, browsing, asking questions, and oral pre/post tests per `docs/pilot_protocol.md`. This is participant/operator work a code phase cannot perform. iOS runtime UAT (visual consent-screen check across 4 locales + seeded-account bind on a physical device) is also deferred — it requires Xcode/macOS, unavailable during v1.0 development; Android UAT covers the same contract and passed the full N-01–N-12 acceptance matrix.

## Core Value

The two study conditions must produce **different but comparable feeds with interpretable recommendation reasons on a frozen content pool, with complete interaction logging** — so the study can argue post-level questions are useful learner traces for feed orchestration. If everything else fails, this must work.

**Status: validated.** Phase 3 (`RANK-01`..`RANK-06`) proved this with executable algorithm-verification tests (§12.3): control never touches question history, experimental reasons carry resolvable trace IDs, diversity/strategy selection is deterministic. This remains the ONE thing to protect in any future milestone.

## Business Context

<!-- Research instrument, not monetized. -->

- **Customer**: Research participants (24–36 in the main study; 3–5 in the internal pilot) and the researchers analyzing their traces.
- **Success metric**: Design doc §21 / SCOPE.md success criteria — a study-ready prototype where both conditions produce different-but-comparable feeds with interpretable reasons on a frozen pool, with complete interaction logging; validated by an internal pilot. **Instrument-side criteria met 2026-07-20; the pilot-validation half of this metric is the sole remaining open item.**

## Requirements

### Validated

- ✓ Phase 1 — Rebrand + research shell hardening (rebrand, storage rename, condition config, interaction logging) — v1.0
- ✓ Phase 2 — Content pool + feed/post UI on frozen data (schemas, curation pipeline, frozen pool, feed/post UI, suggested questions, post-scoped Ask) — v1.0. 77-post immutable pool, Android API 36.1 emulator N-01–N-12, 6/6 requirements; physical iOS UAT deferred (see Current State).
- ✓ Phase 3 — Graph-memory + recommendation engine (content graph, graph-memory, extraction, control + experimental rankers, strategies, diversity rerank, reasons, verification) — v1.0. Exact nine-artifact immutable graph pool, production package/native cutover, 4/4 roadmap truths, 10/10 requirements.
- ✓ Phase 4 — Study infrastructure + pilot instrument (onboarding, condition assignment, data export, oral-test support, live backend transport) — v1.0. STUDY-01/02/03/04 and RQ-03 satisfied and re-verified live 2026-07-20 after closing a deployment-boundary CORS gap.

### Active (next milestone)

- [ ] STUDY-05 — Run the actual 3–5-person internal pilot per `docs/pilot_protocol.md`; fix any issues found; close out IRB-readiness sign-off. Infrastructure precondition fully verified — this is participant/operator execution, not code.
- [ ] iOS runtime UAT — visual 4-locale consent-screen check + seeded-account bind on a physical device via Xcode (deferred tech debt from v1.0, needs macOS access).

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

- **Fork lineage**: Forked from the Trellis product (`/Users/Code/EchoLearn`); the fork is independent and never merged back. Trellis-era milestones/phase numbering are historical only (archive: `docs/planning_history/trellis`).
- **Prior work reused (Phase 0 prune, done 2026-07-09)**: kept services `db`, `question`, `canonical-knowledge`, `question-filter`, `session` (post-scoped threaded Q&A), `post-history`, `post-queue`, `daily-read`, `settings`, event bus, i18n bundles (en/zh/es/ja), imageGeneration. Routes kept: `/home`, `/posts/:id`, `/saved`, `/settings`, `/onboarding`. See `docs/prune_report.md`.
- **Authoritative design**: `docs/research_system_design.md` (canonical v2.0 SPEC) governs; `docs/SCOPE.md` is the locked scope contract.
- **Study shape**: 5–7 day mobile field study using one server-bound study topic from the existing frozen pool (D-01/D-03); participants make no topic choice. Oral-explanation pretest/post-test outcomes are normalized by a verbal baseline.
- **No-refresh assumption**: Capacitor app — users cannot refresh; UI must reactively re-read service state via the event bus on every mutation.
- **Codebase scale at v1.0**: 40 plans across 4 executed phases, ~295 files touched, 611 app tests / 49 backend tests, live Cloudflare Worker + D1 backend deployed and verified.
- **Live infrastructure**: Worker `question-trace-research-collector` at `question-trace-research-collector.question-trace.workers.dev`, D1 `question_trace`; secrets in git-ignored `research-backend/.dev.vars`. Packaged content pool `pilot-graph-20260718` (77 posts, typed exporter).
- **Known tech debt**: seeded accounts 1001/1002 carry pre-pilot test rows (decide whether to clear before real enrollment); bundle size warning (2.66 MB minified, acceptable for research build).

## Constraints

- **Tech stack**: React 19 + TypeScript 5.9 + Vite 7 + Capacitor 8; IndexedDB persistence; user-supplied LLM/embedding API keys; primary target iOS.
- **Frozen pool only**: No live web/news/YouTube fetch in the participant app (CON-no-live-fetch). Content collection is offline in `tools/content_pipeline/`; frozen export versioned + immutable.
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
| **DEC-scope-boundary** — Build surface fixed to SCOPE.md "In scope"; out-of-scope never built | Keeps the research instrument focused and unconfounded | ✓ Good — held through all 4 phases |
| **DEC-pruned-features-frozen** — §15.3 pruned features never resurrected | Avoids scope creep + experimental confounds | ✓ Good |
| **DEC-both-conditions-ask** — Post-scoped Ask available to BOTH conditions with identical answer quality | Prevents confounding AI Q&A access with the graph-memory treatment | ✓ Good |
| **DEC-control-no-question-history** — Control ranker never uses question history, question-derived concept weights, unresolved tracking, echo, or graph continuation/contrast/bridge | Isolates the single experimental variable | ✓ Good — enforced by algorithm-verification test + live grep gate, never regressed |
| **DEC-framing-rules** — Constrained user-facing framing vocabulary | Keeps the research framing honest and non-overclaiming | ✓ Good |
| **DEC-phase-structure** — Five coarse phases (0–4) adopted verbatim; no finer breakdown | GSD workflow overhead is per-phase | ✓ Good — completed in 10 days (2026-07-10 → 2026-07-20) |
| **D-13** — The 3–5-person pilot (STUDY-05) is participant/operator execution; no code phase can satisfy it | A verifier can't recruit humans | ✓ Good — kept verification honest; STUDY-05 correctly stayed `human_needed` through milestone close |

</decisions>

Proposed design decisions (rationale-backed in the canonical SPEC §18; not independently locked but several reinforce the locks above): real curated content not AI-generated posts; post-centered Q&A not global chat; no full knowledge graph exposed; the locked single-topic instrument uses the existing frozen pool (D-01); oral-explanation assessment; pretest verbal baseline.

---
*Last updated: 2026-07-20 after v1.0 milestone completion*
