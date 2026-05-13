# Phase 44 Dependency Sweep Evidence

Source of truth: 44-RESEARCH.md

## Updated declarations

| Package | Section | Phase 44 range |
|---------|---------|----------------|
| `@capacitor/core` | dependencies | `^8.3.3` |
| `@capacitor/cli` | dependencies | `^8.3.3` |
| `@capacitor/android` | dependencies | `^8.3.3` |
| `i18next` | dependencies | `^26.1.0` |
| `react-i18next` | dependencies | `^17.0.7` |
| `react-router-dom` | dependencies | `^7.15.0` |
| `react` | dependencies | `^19.2.6` |
| `react-dom` | dependencies | `^19.2.6` |
| `@tailwindcss/vite` | dependencies | `^4.3.0` |
| `tailwindcss` | dependencies | `^4.3.0` |
| `@types/react` | devDependencies | `^19.2.14` |
| `typescript-eslint` | devDependencies | `^8.59.3` |
| `eslint-plugin-react-hooks` | devDependencies | `^7.1.1` |
| `eslint-plugin-react-refresh` | devDependencies | `^0.5.2` |

## Held-back majors

- Vite 8: held because Phase 44 is limited to safe in-major updates; `vite` remains `^7.3.1`.
- TypeScript 6.0: held because `typescript-eslint@8.59.3` peers `typescript >=4.8.4 <6.0.0`; `typescript` remains `~5.9.3`.
- ESLint 10: held because this phase keeps ESLint on the current 9.x line; `eslint` and `@eslint/js` remain `^9.39.1`.
- lucide-react 1.x: held because the roadmap excludes the 1.x major; `lucide-react` remains `^0.575.0`.
- framer-motion to motion: held because the package rename is out of scope; `framer-motion` remains `^12.38.0`.
- @vitejs/plugin-react 6: held with Vite 8; `@vitejs/plugin-react` remains `^5.1.1`.
- @types/node 25: held because the project Node baseline has not moved; `@types/node` remains `^24.10.1`.
- globals 17: held because ESLint config retesting for that major is out of scope; `globals` remains `^16.5.0`.

## Install evidence

Command:

```bash
npm install @capacitor/core@^8.3.3 @capacitor/cli@^8.3.3 @capacitor/android@^8.3.3 i18next@^26.1.0 react-i18next@^17.0.7 react-router-dom@^7.15.0 react@^19.2.6 react-dom@^19.2.6 @types/react@^19.2.14 typescript-eslint@^8.59.3 eslint-plugin-react-hooks@^7.1.1 eslint-plugin-react-refresh@^0.5.2 @tailwindcss/vite@^4.3.0 tailwindcss@^4.3.0
```

Exit code: 0

peer dependency warnings: none observed

npm output summary:

```text
removed 1 package, changed 35 packages, and audited 439 packages in 6s
10 vulnerabilities (5 moderate, 5 high)
```

## Audit evidence

Command:

```bash
npm audit --audit-level=high
```

Exit code: 1

Post-install result: 10 vulnerabilities (5 moderate, 5 high, 0 critical).

Pre-Phase-44 baseline check: the same command run against the pre-install `app/package.json` and `app/package-lock.json` from commit `a09ce3f6^` also exited 1 with 10 vulnerabilities (5 moderate, 5 high, 0 critical).

new high/critical vulnerabilities: 0

High-severity advisories reported post-install:

- `@xmldom/xmldom <=0.8.12`
- `flatted <=3.4.1`
- `picomatch 4.0.0 - 4.0.3`
- `tar <=7.5.10`
- `vite 7.0.0 - 7.3.1`
