# QuestionTrace Research Roadmap

**The live, canonical roadmap is [`.planning/ROADMAP.md`](.planning/ROADMAP.md)** — GSD-managed, with per-phase goals, requirements (see [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md)), and success criteria. This file is a human-readable summary; if they ever diverge, `.planning/ROADMAP.md` wins.

Five deliberately coarse phases (GSD workflow overhead is per-phase — the structure is locked; do not split finer). Derived from [`docs/research_system_design.md`](docs/research_system_design.md) §16.

- [x] **Phase 0: Rename, scope, and prune** — done 2026-07-09 (see `docs/prune_report.md`)
- [ ] **Phase 1: Rebrand + research shell hardening** — in-app rebrand + storage-key rename (no migration), condition config, interaction logging, dead-code sweep
- [ ] **Phase 2: Content pool + feed/post UI on frozen data** — schemas, `tools/content_pipeline/`, frozen pool export, feed/post/Ask UI replacing the AI-generated shell
- [ ] **Phase 3: Graph-memory + recommendation engine** — two-layer graph, control + experimental rankers, orchestration strategies, verification tests
- [ ] **Phase 4: Study infrastructure + pilot** — study onboarding, condition assignment, data export, oral-test support, internal pilot

Open design questions live in the design doc §20 and `.planning/STATE.md` (Blockers/Concerns).

The product-era Trellis planning history is archived at `docs/planning_history/trellis/`.
