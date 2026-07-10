---
phase: 44
slug: dependency-version-sweep
status: complete
created: 2026-05-12
---

# Phase 44: Dependency Version Sweep - Research

## Research Complete

Phase 44 is a bounded dependency maintenance phase. The implementation should update safe in-major packages, intentionally hold known major jumps, regenerate the lockfile, and prove there are no runtime, type, lint, test, build, or native-sync regressions.

## Inputs Read

- `.planning/ROADMAP.md` - Phase 44 goal, success criteria, and held-back major list.
- `.planning/REQUIREMENTS.md` - TECHDEBT-08 ownership.
- `.planning/STATE.md` - Phase 43 close-out baseline and remaining v1.5 context.
- `.planning/codebase/STACK.md` - current stack baseline.
- `app/package.json` - current dependency ranges and scripts.
- `app/package-lock.json` - current lockfile graph and peer ranges.
- Live npm metadata from `npm view` on 2026-05-12.

## Phase Requirement

TECHDEBT-08: Dependency version sweep for v1.5 Wave 4.

## Current Declared Baseline

Relevant declarations in `app/package.json` before Phase 44:

| Package | Current range |
|---------|---------------|
| `@capacitor/android` | `^8.1.0` |
| `@capacitor/cli` | `^8.1.0` |
| `@capacitor/core` | `^8.1.0` |
| `@capacitor/ios` | not declared |
| `i18next` | `^26.0.5` |
| `react-i18next` | `^17.0.3` |
| `react-router-dom` | `^7.13.1` |
| `react` | `^19.2.0` |
| `react-dom` | `^19.2.0` |
| `eslint` | `^9.39.1` |
| `@eslint/js` | `^9.39.1` |
| `typescript-eslint` | `^8.48.0` |
| `typescript` | `~5.9.3` |
| `vite` | `^7.3.1` |
| `@vitejs/plugin-react` | `^5.1.1` |
| `lucide-react` | `^0.575.0` |
| `framer-motion` | `^12.38.0` |

Project scripts:

| Purpose | Command |
|---------|---------|
| Full tests | `npm test` |
| Main tests | `npm run test:main` |
| Action tests | `npm run test:actions` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Native sync | `npx cap sync` |

## Live Version Targets

Live npm metadata collected on 2026-05-12:

| Package | Latest | Phase 44 decision |
|---------|--------|-------------------|
| `@capacitor/core` | `8.3.3` | Update to `^8.3.3` |
| `@capacitor/cli` | `8.3.3` | Update to `^8.3.3` |
| `@capacitor/android` | `8.3.3` | Update to `^8.3.3` |
| `@capacitor/ios` | `8.3.3` | Do not add unless the project already needs an iOS native platform package in `package.json` |
| `@capacitor/app` | `8.1.0` | Optional safe patch/minor if npm install resolves it; current range `^8.0.1` already admits it |
| `@capacitor/device` | `8.0.2` | No declaration change needed |
| `@capacitor/haptics` | `8.0.2` | No declaration change needed |
| `@capacitor/local-notifications` | `8.1.0` | Optional safe patch/minor if npm install resolves it; current range `^8.0.2` already admits it |
| `@capacitor-community/sqlite` | `8.1.0` | Optional safe patch/minor if npm install resolves it; current range `^8.0.1` already admits it |
| `i18next` | `26.1.0` | Update to `^26.1.0`, satisfying roadmap minimum `^26.0.10` |
| `react-i18next` | `17.0.7` | Update to `^17.0.7` as compatible i18next companion |
| `react-router-dom` | `7.15.0` | Update to `^7.15.0` |
| `react` | `19.2.6` | Update to `^19.2.6` |
| `react-dom` | `19.2.6` | Update to `^19.2.6` |
| `eslint` | `10.3.0` | Hold major 10; keep ESLint 9.x unless `npm view eslint@9 version` identifies a newer 9.x patch |
| `@eslint/js` | follows ESLint | Keep matched to ESLint 9.x |
| `typescript-eslint` | `8.59.3` | Update to `^8.59.3`; peer supports TypeScript `<6.0.0` |
| `@typescript-eslint/parser` | `8.59.3` | Not declared directly; lockfile follows `typescript-eslint` |
| `typescript` | `6.0.3` | Hold major 6; keep `~5.9.3` because `typescript-eslint@8.59.3` peers `>=4.8.4 <6.0.0` |
| `vite` | `8.0.12` | Hold major 8; keep Vite 7.x unless a newer 7.x patch exists |
| `@vitejs/plugin-react` | `6.0.1` | Hold major 6 because it tracks newer Vite major expectations; keep 5.x unless a newer 5.x patch exists |
| `lucide-react` | `1.14.0` | Hold major 1; current 0.x range should not cross to 1.x |
| `framer-motion` | `12.38.0` | No change; package rename to `motion` is held back |
| `@tailwindcss/vite` | `4.3.0` | Safe minor if lockfile updates; current range `^4.2.1` admits it |
| `tailwindcss` | `4.3.0` | Safe minor if lockfile updates; current range `^4.2.1` admits it |
| `@types/react` | `19.2.14` | Update to `^19.2.14` |
| `@types/react-dom` | `19.2.3` | Current `^19.2.3` is already latest |
| `@types/node` | `25.7.0` | Hold major 25 unless project Node baseline explicitly moves; current `^24.10.1` is adequate |
| `globals` | `17.6.0` | Hold major 17 unless ESLint config is intentionally retested; current major 16 is adequate |
| `eslint-plugin-react-hooks` | `7.1.1` | Update to `^7.1.1` if no lint fallout |
| `eslint-plugin-react-refresh` | `0.5.2` | Update to `^0.5.2` if no lint fallout |
| `katex` | `0.16.45` | Optional patch update if lockfile resolves it |
| `mind-elixir` | `5.11.0` | Optional minor update only if no graph regressions; Phase 45 owns graph performance triage |

## Recommended Package Update Set

Use explicit installs from `app/` so `package.json` and `package-lock.json` move together:

```bash
npm install \
  @capacitor/core@^8.3.3 \
  @capacitor/cli@^8.3.3 \
  @capacitor/android@^8.3.3 \
  i18next@^26.1.0 \
  react-i18next@^17.0.7 \
  react-router-dom@^7.15.0 \
  react@^19.2.6 \
  react-dom@^19.2.6 \
  @types/react@^19.2.14 \
  typescript-eslint@^8.59.3 \
  eslint-plugin-react-hooks@^7.1.1 \
  eslint-plugin-react-refresh@^0.5.2 \
  @tailwindcss/vite@^4.3.0 \
  tailwindcss@^4.3.0
```

Then run `npm install` once more only if peer warnings or lockfile drift remain.

Do not install `typescript@^6`, `vite@^8`, `eslint@^10`, `lucide-react@^1`, or `motion` in this phase.

## Risk Notes

### Capacitor 8.1 to 8.3

Keep all first-party Capacitor packages on the same 8.3.x family where declared. After updating, `npx cap sync` is required because native Android output may change. Do not treat Android generated-file changes as accidental if `cap sync` writes them, but review them separately from app dependency edits.

### React 19.2 patch

React and React DOM must move together. Phase 44 exists specifically to absorb React 19.x timing differences outside feature work. Test and smoke coverage must include Ask streaming, queue refill, and feed navigation because StrictMode-sensitive effects have been touched in recent phases.

### React Router 7.15

The project uses routed screen components and navigation wiring. This should be a minor update, but build/type checks plus at least one manual navigation smoke should cover `/home`, `/saved`, and a post detail route because Phase 43 added saved and deep-dive routes.

### i18next and react-i18next

Move `i18next` beyond the roadmap minimum (`^26.0.10`) to the latest 26.x (`^26.1.0`) and move `react-i18next` to `^17.0.7`. Manual smoke must include locale switching because Phase 37 split locale modules and later phases added keys.

### ESLint and TypeScript Tooling

`typescript-eslint@8.59.3` still peers `typescript >=4.8.4 <6.0.0`, so TypeScript 6 must remain held back. ESLint 10 is the live latest but is a major jump outside roadmap scope; keep ESLint 9.x and document the hold-back. If no newer ESLint 9 patch exists beyond `9.39.1`, no package edit is needed for ESLint itself.

### Vite and Plugin React

Vite 8 and `@vitejs/plugin-react` 6 are held-back majors. Tailwind 4.3 and the Tailwind Vite plugin 4.3 are safe in-major candidates because the current ranges are 4.x and Vite remains 7.x.

### Lucide and Framer Motion

`lucide-react` latest is 1.x but the roadmap explicitly holds back lucide 1.x. `framer-motion` is unchanged at 12.38.0; the package rename to `motion` is deferred.

## Planning Implications

Recommended plan shape:

1. One dependency-update plan that edits `app/package.json` and `app/package-lock.json`, runs `npm install`, records peer/audit output, and documents held-back majors.
2. One automated verification plan that runs lint, tests, type/build, and native sync, then updates planning docs with the exact baseline and any known pre-existing failures.
3. One manual smoke/UAT plan if the executor cannot complete device or browser smoke in the automated plan. The smoke must cover locale switch, Ask streaming, queue refill, saved route navigation, and Android Capacitor sync sanity.
4. One close-out plan that updates `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and `44-VALIDATION.md`.

Keep Phase 44 parallel-safe with Phase 45 by avoiding source hygiene edits, dead-code removal, TODO triage, graph performance tuning, and unrelated Android asset churn.

## Validation Architecture

### Automated Commands

Run from `app/`:

| Check | Command | Expected result |
|-------|---------|-----------------|
| Install | `npm install` | exits 0 and emits no peer-dependency warnings |
| Audit | `npm audit --audit-level=high` | exits 0 or reports no new high/critical vulnerabilities compared with pre-Phase-44 baseline |
| Main tests | `npm run test:main` | pass count equals or improves the post-Phase-43 baseline; known pre-existing failures must not increase |
| Action tests | `npm run test:actions` | exits 0 |
| Full tests | `npm test` | aggregate baseline equals or improves post-Phase-43 |
| Lint | `npm run lint` | exits 0 |
| Type/build | `npm run build` | `tsc -b` and `vite build` exit 0 |
| Native sync | `npx cap sync` | exits 0 |

### Source and Lockfile Assertions

Use grep/read checks to prove:

- `app/package.json` contains `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` with `^8.3.3`.
- `app/package.json` contains `i18next` with `^26.1.0` or a later 26.x range.
- `app/package.json` contains `react-router-dom` with `^7.15.0`.
- `app/package.json` contains `react` and `react-dom` with matching `^19.2.6`.
- `app/package.json` still contains `typescript` as `~5.9.3` or another `<6.0.0` range.
- `app/package.json` does not contain `vite` `^8`, `eslint` `^10`, `lucide-react` `^1`, or `motion`.
- `app/package-lock.json` contains resolved versions matching the declared dependency family.

### Manual Smoke

Manual smoke should be captured in `44-UAT.md` or a plan summary:

- Locale switch changes visible UI strings without console/runtime failure.
- Ask streaming starts, streams content, and can be aborted or completed.
- Queue refill produces feed content and does not regress daily posts.
- Saved route navigation still opens and returns.
- Android sync/build sanity is checked after `npx cap sync` if native files changed.

### Nyquist Coverage

Every plan task should include an automated command or explicit manual smoke row. No three consecutive dependency tasks should be accepted without at least one of `npm install`, `npm audit`, `npm run lint`, `npm run build`, `npm run test:main`, `npm run test:actions`, or `npx cap sync`.

## Open Questions

- Whether to update optional in-major packages not named in the roadmap (`@tailwindcss/vite`, `tailwindcss`, `react-i18next`, React type packages, React lint plugins) should be decided by the planner as long as the phase remains bounded and all held-back majors are documented.
- Whether native Android generated files should be committed depends on the actual `npx cap sync` diff. If only dependency metadata changes, do not manufacture native edits.

## RESEARCH COMPLETE
