# QuestionTrace Research Roadmap

Follows [`docs/research_system_design.md`](docs/research_system_design.md) §16, consolidated into coarse phases (one GSD phase each — the workflow overhead is per-phase, so phases are deliberately big). The product-era Trellis roadmap no longer governs this fork.

- [x] **Phase 0: Rename, scope, and prune** — done 2026-07-09.
  - Adopted QuestionTrace; renamed repo directory to `QuestionTrace_Research`.
  - Research README, `docs/research_system_design.md`, `docs/SCOPE.md`, rewritten `CLAUDE.md`/`AGENTS.md`.
  - Pruned product features per design doc §15.3 (podcast, flashcards/SRS, mindmap/graph UI, planner/trellis gamification, global chat, collections, token analytics, live news/YouTube/web search). All gates green + browser smoke test. See `docs/prune_report.md`.

- [ ] **Phase 1: Rebrand + research shell hardening**
  - In-app rebrand Trellis → QuestionTrace: display name, `index.html` title, `capacitor.config.ts` appName, iOS/Android display names, Settings/About, onboarding + starter-post copy, all 4 locale bundles. Keep native bundle identifiers unchanged (signing/data constraints — see CLAUDE.md).
  - Storage rename: `IDB_NAME 'trellis'` → `'questiontrace'`, live `trellis_*` localStorage keys → `questiontrace_*`. **No migration** — nothing in storage worth preserving; old keys are simply orphaned. Update tests that reference old names.
  - Condition config scaffolding (`control` / `experimental`) + interaction logging infrastructure (`UserInteractionEvent`, design doc §9.8, §14).
  - Remaining dead-code sweep.
  - Deliverable: stable, branded research app shell with logging and condition assignment plumbing.

- [ ] **Phase 2: Content pool + feed/post UI on frozen data**
  - Schemas: Topic, Post, Concept, Claim, SuggestedQuestion (§9).
  - `tools/content_pipeline/`: collectors, AI preprocessing (§17.1), dedupe, quality scoring, human review workflow, exporters; frozen pool export to `data/content_pool_v1/` (§8) — one pilot topic, ~50 approved posts before scaling to 200–400.
  - App import of the frozen pool; feed card (§7.2), post detail (§7.3) with original source embed/link, suggested questions (§7.5), post-scoped Ask (§7.6) — replacing the temporary AI-generated feed shell entirely.
  - Deliverable: participants can browse real curated content and ask questions against it.

- [ ] **Phase 3: Graph-memory + recommendation engine**
  - Global content-graph import; personal user graph-memory; question → concept/claim extraction (§17.2); `UserConceptState` updates (§10).
  - Control ranker (§11.7) and experimental ranker (§11.3–11.4); strategies Continue / Deepen / Contrast / Bridge / Echo (§11.5); diversity reranking (§11.6); recommendation reasons (§17.4).
  - Algorithm verification unit tests (§12.3) — incl. "control never consumes question history".
  - Deliverable: two conditions produce different but comparable feeds, with interpretable reasons.

- [ ] **Phase 4: Study infrastructure + pilot**
  - Study onboarding, topic selection, condition assignment, logging export, researcher data dump, pre/post oral-test support (§13).
  - Internal pilot (3–5 users): validate content quality, logs, recommendation reasons, oral assessment flow; fix issues.
  - Deliverable: ready for IRB / formal study.

## Open questions (design doc §20)

Final study topics (pick 3), participant language/country, embed vs click-out for sources, notification cadence, whether the experimental condition personalizes suggested questions, exploration-path UI, review staffing, IRB requirements.
