# Repository Guidelines

## What this project is

**QuestionTrace** — a mobile research prototype for studying post-centered graph-memory learning feeds. The canonical implementation guide is [`docs/research_system_design.md`](docs/research_system_design.md); scope boundaries are in [`docs/SCOPE.md`](docs/SCOPE.md). This is a research fork of the Trellis product; the product features listed in design doc §15.3 were pruned on 2026-07-09 (see [`docs/prune_report.md`](docs/prune_report.md)) and must not be reintroduced. Load-bearing engineering invariants live in [`CLAUDE.md`](CLAUDE.md) — read its "load-bearing" sections before touching the feed pipeline, data layer, question filter, navigation shell, or headers.

## Project Structure & Module Organization

The app lives in `app/`. Main frontend code is in `app/src/`: `components/` for reusable UI, `screens/` for routed views (Home, PostDetail, Saved, Settings, Onboarding), `services/` for business logic, `providers/` for AI integrations, `state/` for shared hooks, and `lib/` for utilities. Tests live in `app/tests/` by area (`components`, `screens`, `services`, `providers`, `hooks`, `locales`, `layout`). Native platform output is under `app/android/` and `app/ios/`. Research docs are in `docs/`; inherited planning history in `Documents/` and `openspec/`. Planned (not yet built): `tools/content_pipeline/` and `data/content_pool_v1/`.

## Build, Test, and Development Commands

Run commands from `app/`:

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm run build     # type-check and produce a production build
npm run lint      # run ESLint on TS/TSX source
npm test          # run node:test suites in app/tests/**/*.test.mjs
npx cap sync      # sync the web build into Capacitor platforms
```

## Coding Style & Naming Conventions

TypeScript, React 19, Vite, Tailwind CSS 4 — but most UI uses **inline styles with CSS variables**, not Tailwind classes; match the surrounding file. Functional components, hooks for shared behavior, one responsibility per service module. `PascalCase` for components/screens, `camelCase` for utilities/hooks/services (`post-context-qa.service.ts`), `kebab-case` for spec change folders. ESLint config at `app/eslint.config.js`; `_`-prefixed unused variables are allowed.

## Testing Guidelines

Tests use Node's built-in `node:test` runner with `assert/strict`. Add unit tests beside the relevant area in `app/tests/` and name files `*.test.mjs`. Prefer tests that execute the code path over tests that read source text (source-reading tests can pin bugs in place). For persistence, assert through the `dbQuery` seam, not in-memory mirrors. Mock network calls; never hit live AI services in tests.

## Commit & Pull Request Guidelines

Conventional Commit style, scoped by phase where applicable (e.g. `feat(phase-2): add content pool importer`). Keep commits focused. PRs include: problem/solution summary, linked phase/spec, test evidence (`npm test`, `npm run lint`, build status), and screenshots for UI changes.

## Specs & Change Management

When behavior changes, keep `docs/` and `ROADMAP.md` aligned with shipped code. OpenSpec artifacts under `openspec/` are inherited history; new research-phase planning follows the design doc's Phase 0–7 roadmap.
