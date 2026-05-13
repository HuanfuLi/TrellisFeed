---
phase: 44-dependency-version-sweep
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/package.json
  - app/package-lock.json
  - .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md
autonomous: true
requirements:
  - TECHDEBT-08
must_haves:
  truths:
    - "The declared dependency ranges move to the Phase 44 safe in-major target set."
    - "The lockfile is regenerated from npm, not edited by hand."
    - "Held-back majors are explicitly documented for future phases."
  artifacts:
    - path: "app/package.json"
      provides: "Dependency declarations for the app workspace"
      contains: "\"@capacitor/core\": \"^8.3.3\""
    - path: "app/package-lock.json"
      provides: "Resolved npm graph for the updated dependency set"
      contains: "\"node_modules/@capacitor/core\""
    - path: ".planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md"
      provides: "Install, audit, updated-package, and held-back-major evidence"
      contains: "Held-back majors"
  key_links:
    - from: "app/package.json"
      to: "app/package-lock.json"
      via: "npm install from app/"
      pattern: "\"@capacitor/core\": \"\\^8\\.3\\.3\""
    - from: ".planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md"
      to: ".planning/phases/44-dependency-version-sweep/44-RESEARCH.md"
      via: "target-set citation"
      pattern: "44-RESEARCH.md"
---

<objective>
Apply the Phase 44 dependency target set and regenerate npm metadata.

Purpose: Move all approved in-major package versions together, including React 19.x patch/minor consolidation, while keeping known major jumps out of scope.
Output: Updated `app/package.json`, updated `app/package-lock.json`, and dependency sweep evidence.
</objective>

<execution_context>
@/Users/Code/EchoLearn/.codex/get-shit-done/workflows/execute-plan.md
@/Users/Code/EchoLearn/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/44-dependency-version-sweep/44-RESEARCH.md
@.planning/phases/44-dependency-version-sweep/44-VALIDATION.md
@AGENTS.md
@CLAUDE.md
@app/package.json
@app/package-lock.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install the approved Phase 44 dependency set</name>
  <files>app/package.json, app/package-lock.json</files>
  <read_first>
    app/package.json
    app/package-lock.json
    .planning/phases/44-dependency-version-sweep/44-RESEARCH.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    AGENTS.md
  </read_first>
  <action>
    From `app/`, run this exact install command so `package.json` and `package-lock.json` move together:

    ```bash
    npm install @capacitor/core@^8.3.3 @capacitor/cli@^8.3.3 @capacitor/android@^8.3.3 i18next@^26.1.0 react-i18next@^17.0.7 react-router-dom@^7.15.0 react@^19.2.6 react-dom@^19.2.6 @types/react@^19.2.14 typescript-eslint@^8.59.3 eslint-plugin-react-hooks@^7.1.1 eslint-plugin-react-refresh@^0.5.2 @tailwindcss/vite@^4.3.0 tailwindcss@^4.3.0
    ```

    Preserve these held-back declarations exactly unless npm rewrites ordering only: `typescript` remains `~5.9.3`, `vite` remains `^7.3.1`, `@vitejs/plugin-react` remains `^5.1.1`, `eslint` remains `^9.39.1`, `@eslint/js` remains `^9.39.1`, `lucide-react` remains `^0.575.0`, and `framer-motion` remains `^12.38.0`. Do not add `@capacitor/ios`. Do not install `typescript@^6`, `vite@^8`, `@vitejs/plugin-react@^6`, `eslint@^10`, `@eslint/js@^10`, `lucide-react@^1`, or `motion`.
  </action>
  <verify>
    <automated>cd app &amp;&amp; node -e "const p=require('./package.json'); const expect={dependencies:{'@capacitor/core':'^8.3.3','@capacitor/cli':'^8.3.3','@capacitor/android':'^8.3.3','i18next':'^26.1.0','react-i18next':'^17.0.7','react-router-dom':'^7.15.0','react':'^19.2.6','react-dom':'^19.2.6','@tailwindcss/vite':'^4.3.0','tailwindcss':'^4.3.0'},devDependencies:{'@types/react':'^19.2.14','typescript-eslint':'^8.59.3','eslint-plugin-react-hooks':'^7.1.1','eslint-plugin-react-refresh':'^0.5.2','typescript':'~5.9.3','vite':'^7.3.1','@vitejs/plugin-react':'^5.1.1','eslint':'^9.39.1','@eslint/js':'^9.39.1'}}; for (const [section, pairs] of Object.entries(expect)) for (const [name, version] of Object.entries(pairs)) { if (p[section]?.[name] !== version) throw new Error(section + ' ' + name + ' expected ' + version + ' got ' + p[section]?.[name]); } const all={...p.dependencies,...p.devDependencies}; if (all['@capacitor/ios'] || all.motion) throw new Error('forbidden package added');"</automated>
  </verify>
  <acceptance_criteria>
    - `app/package.json` contains `"@capacitor/core": "^8.3.3"`, `"@capacitor/cli": "^8.3.3"`, and `"@capacitor/android": "^8.3.3"`.
    - `app/package.json` contains `"i18next": "^26.1.0"`, `"react-i18next": "^17.0.7"`, and `"react-router-dom": "^7.15.0"`.
    - `app/package.json` contains matching `"react": "^19.2.6"` and `"react-dom": "^19.2.6"`.
    - `app/package.json` contains `"typescript-eslint": "^8.59.3"` and still contains `"typescript": "~5.9.3"`.
    - `app/package.json` does not contain `"@capacitor/ios"`, `"motion"`, `"vite": "^8`, `"eslint": "^10`, or `"lucide-react": "^1`.
    - `app/package-lock.json` contains `node_modules/@capacitor/core`, `node_modules/react`, and `node_modules/react-router-dom` entries.
  </acceptance_criteria>
  <done>Package metadata reflects the Phase 44 target set and excludes all held-back majors.</done>
</task>

<task type="auto">
  <name>Task 2: Record dependency sweep and audit evidence</name>
  <files>.planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md</files>
  <read_first>
    .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md
    .planning/phases/44-dependency-version-sweep/44-RESEARCH.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    app/package.json
    app/package-lock.json
  </read_first>
  <action>
    Create `.planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md` with these sections and exact strings:

    - `# Phase 44 Dependency Sweep Evidence`
    - `Source of truth: 44-RESEARCH.md`
    - `Updated declarations` table listing the exact ranges installed in Task 1.
    - `Held-back majors` list with these exact package decisions: `Vite 8`, `TypeScript 6.0`, `ESLint 10`, `lucide-react 1.x`, `framer-motion to motion`, `@vitejs/plugin-react 6`, `@types/node 25`, and `globals 17`.
    - `Install evidence` containing the full Task 1 `npm install ...` command and a `peer dependency warnings:` line whose value is either `none observed` or the exact warnings copied from npm output.
    - `Audit evidence` containing the command `npm audit --audit-level=high` and its exit code.

    From `app/`, run `npm audit --audit-level=high`. If npm reports high or critical vulnerabilities, compare against the pre-Phase-44 baseline from `44-RESEARCH.md`; do not hide or reclassify them. Record `new high/critical vulnerabilities: 0` only when the command output supports it.
  </action>
  <verify>
    <automated>rg -n "Source of truth: 44-RESEARCH.md|Held-back majors|Vite 8|TypeScript 6.0|ESLint 10|lucide-react 1.x|framer-motion to motion|npm audit --audit-level=high|new high/critical vulnerabilities:" .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md</automated>
  </verify>
  <acceptance_criteria>
    - `44-DEPENDENCY-SWEEP.md` contains `Source of truth: 44-RESEARCH.md`.
    - `44-DEPENDENCY-SWEEP.md` contains all eight held-back strings: `Vite 8`, `TypeScript 6.0`, `ESLint 10`, `lucide-react 1.x`, `framer-motion to motion`, `@vitejs/plugin-react 6`, `@types/node 25`, and `globals 17`.
    - `44-DEPENDENCY-SWEEP.md` contains the literal command `npm audit --audit-level=high`.
    - `44-DEPENDENCY-SWEEP.md` contains either `peer dependency warnings: none observed` or copied npm peer-warning lines.
    - `44-DEPENDENCY-SWEEP.md` contains `new high/critical vulnerabilities: 0` unless the audit command proves a pre-existing high/critical baseline that must be documented instead.
  </acceptance_criteria>
  <done>Dependency update evidence exists with held-back majors and audit results documented.</done>
</task>

</tasks>

<verification>
Run the two task verification commands. Then run `git diff -- app/package.json app/package-lock.json .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md` and confirm the diff is limited to dependency metadata, lockfile resolution, and evidence documentation.
</verification>

<success_criteria>
Plan 44-01 is complete when the Phase 44 package target set is declared, the lockfile is regenerated, npm audit evidence is captured, and held-back majors are documented.
</success_criteria>

<output>
After completion, create `.planning/phases/44-dependency-version-sweep/44-01-dependency-metadata-lockfile-SUMMARY.md`.
</output>
