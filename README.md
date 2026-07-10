# QuestionTrace

**QuestionTrace** is a mobile research prototype for studying **post-centered graph-memory learning feeds**. It is not a consumer product: it exists to support a multi-day HCI/learning field study.

> QuestionTrace is a research prototype for studying post-centered graph-memory learning feeds. It uses a fixed curated pool of real multimedia posts. Users ask AI questions under posts; those questions become structured learner traces. In the experimental condition, these traces drive future feed orchestration through continuation, deepening, contrast, bridging, and memory echo strategies. The system is evaluated through a multi-day field study comparing it to a matched multimedia feed without graph-memory orchestration.

**Canonical design document:** [`docs/research_system_design.md`](docs/research_system_design.md) — the implementation guide for all code agents and contributors. Scope boundaries live in [`docs/SCOPE.md`](docs/SCOPE.md).

## Research questions

- **RQ1 — Re-engagement:** Does graph-memory feed orchestration increase voluntary re-engagement over several days compared with a standard multimedia topic feed?
- **RQ2 — Question traces:** How do learners' post-level questions function as traces for modeling curiosity, conceptual focus, and unresolved understanding?
- **RQ3 — Oral explanation:** Does graph-memory orchestration help learners produce richer oral explanations after several days of exploration?

## Study design (summary)

Two conditions in a 5–7 day mobile field study (24–36 participants, 3 semi-open topics, 200–400 human-reviewed posts per topic):

| | Control | Experimental |
|---|---|---|
| Curated real-content feed | ✓ | ✓ |
| AI hook / summary / suggested questions | ✓ | ✓ |
| "Ask about this post" contextual Q&A | ✓ | ✓ |
| Questions stored as graph-memory traces | — | ✓ |
| Feed orchestration (Continue / Deepen / Contrast / Bridge / Echo) | — | ✓ |
| Recommendation rationales from prior questions | — | ✓ |

Both groups get contextual Q&A — the only isolated variable is whether question history drives future feed orchestration.

## What this repo is (and is not)

**Is:** a research prototype; a curated real-content feed; a post-centered contextual Q&A interface; a graph-memory learner model; a feed orchestration mechanism; a study data-collection platform.

**Is not:** a general chat app, an AI-generated content feed, a flashcard/SRS app, a mind-map editor, a social platform, or a product launch. Those features existed in the ancestor product (Trellis) and have been pruned — see `docs/prune_report.md`.

## Lineage

Forked from **Trellis** (formerly EchoLearn), an AI learning product prototype (React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Capacitor 8, local-first, multi-provider LLM). The fork is independent and never merges back. The former working title **TrellisFeed** was dropped for novelty/naming-collision reasons (see design doc §1, §5).

## Repository layout

- `app/` — the mobile app (Capacitor + React). All build/test commands run from here.
- `docs/` — research system design, scope, prune report.
- `tools/content_pipeline/` — (planned) content curation pipeline: collectors, AI preprocessing, dedupe, quality filter, human review, exporters.
- `data/content_pool_v1/` — (planned) frozen curated content pool consumed by the app.
- `Documents/`, `openspec/` — inherited planning history from the ancestor repo.

## Development

```bash
cd app
npm install
npm run dev      # Vite dev server
npm run build    # typecheck + production build
npm run lint     # ESLint
npm test         # node:test suites in app/tests
npx cap sync     # sync web build into native platforms
```

Requires Node.js 18+. LLM/embedding providers (OpenAI, Claude, Gemini, or local endpoints such as LM Studio) are configured in-app under Settings; users supply their own keys.

## Implementation roadmap

See [`ROADMAP.md`](ROADMAP.md) — five coarse phases. **Phase 0 (rename, scope, prune) is done.** Next: Phase 1 (in-app rebrand + condition/logging scaffolding), then the content pool + frozen-data feed UI, then graph-memory + the two rankers, then study infrastructure and pilot.

Note: in-app branding and storage keys still say "Trellis" until Phase 1 lands; the native bundle identifiers keep their legacy values permanently (signing/data constraints).

## License

[MIT](LICENSE)
