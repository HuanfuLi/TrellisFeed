---
phase: 44-dependency-version-sweep
plan: 02
type: execute
wave: 2
depends_on:
  - 44-01
files_modified:
  - .planning/phases/44-dependency-version-sweep/44-VERIFY.md
  - app/android/
autonomous: true
requirements:
  - TECHDEBT-08
must_haves:
  truths:
    - "The updated dependency graph passes the project's automated checks or preserves only documented pre-existing failures."
    - "TypeScript, Vite build, lint, audit, and Capacitor sync evidence are captured after the dependency update."
    - "Native Android generated-file changes, if any, are attributable to `npx cap sync`."
  artifacts:
    - path: ".planning/phases/44-dependency-version-sweep/44-VERIFY.md"
      provides: "Automated verification and native-sync evidence"
      contains: "npm run build"
    - path: "app/android/"
      provides: "Capacitor Android generated output, only if `npx cap sync` changes it"
      contains: "Capacitor"
  key_links:
    - from: "app/package-lock.json"
      to: ".planning/phases/44-dependency-version-sweep/44-VERIFY.md"
      via: "post-install verification commands"
      pattern: "npm test"
    - from: "npx cap sync"
      to: "app/android/"
      via: "Capacitor native sync"
      pattern: "cap sync"
---

<objective>
Run and record automated verification for the updated dependency graph.

Purpose: Prove the dependency sweep does not introduce regressions in tests, lint, type/build, audit, or native sync.
Output: `44-VERIFY.md` with command evidence and any Capacitor-generated Android changes from `npx cap sync`.
</objective>

<execution_context>
@/Users/Code/EchoLearn/.codex/get-shit-done/workflows/execute-plan.md
@/Users/Code/EchoLearn/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/44-dependency-version-sweep/44-RESEARCH.md
@.planning/phases/44-dependency-version-sweep/44-VALIDATION.md
@.planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md
@.planning/phases/43-engagement-ui/43-15-force-new-day-dedup-SUMMARY.md
@app/package.json
@app/package-lock.json
@app/capacitor.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run test baselines and record results</name>
  <files>.planning/phases/44-dependency-version-sweep/44-VERIFY.md</files>
  <read_first>
    .planning/phases/44-dependency-version-sweep/44-VERIFY.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md
    .planning/STATE.md
    .planning/phases/43-engagement-ui/43-15-force-new-day-dedup-SUMMARY.md
    app/package.json
  </read_first>
  <action>
    Create or update `.planning/phases/44-dependency-version-sweep/44-VERIFY.md` with section `## Test Evidence`. From `app/`, run these exact commands and record each command, exit code, and summary output:

    ```bash
    npm run test:main
    npm run test:actions
    npm test
    ```

    The post-Phase-43 source-of-truth baseline from `.planning/STATE.md` and `43-15-force-new-day-dedup-SUMMARY.md` is: `npm run test:actions` exits 0; `npm run test:main` may include known pre-existing failure signatures involving `concept-feed.test.mjs`, `concept-feed-source-diversity-wiring`, `image-gen-key-gate`, `post-queue.test.mjs`, and `trellis-layout.test.mjs`. Treat any additional failing test file name as a Phase 44 regression and stop to fix or document the blocker.
  </action>
  <verify>
    <automated>rg -n "npm run test:main|npm run test:actions|npm test|exit code|concept-feed.test.mjs|all tests passed|Phase 44 regression" .planning/phases/44-dependency-version-sweep/44-VERIFY.md</automated>
  </verify>
  <acceptance_criteria>
    - `44-VERIFY.md` contains `## Test Evidence`.
    - `44-VERIFY.md` contains the literal commands `npm run test:main`, `npm run test:actions`, and `npm test`.
    - `44-VERIFY.md` contains an `exit code:` line for each test command.
    - If tests fail, every failing test file name in `44-VERIFY.md` is one of these known signatures: `concept-feed.test.mjs`, `concept-feed-source-diversity-wiring`, `image-gen-key-gate`, `post-queue.test.mjs`, `trellis-layout.test.mjs`.
    - If any other failing test file appears, `44-VERIFY.md` contains `Phase 44 regression:` followed by the failing file name and the plan is not marked complete.
  </acceptance_criteria>
  <done>Test evidence is captured with no new failure signatures beyond the documented post-Phase-43 baseline.</done>
</task>

<task type="auto">
  <name>Task 2: Run lint, build, and high-severity audit checks</name>
  <files>.planning/phases/44-dependency-version-sweep/44-VERIFY.md</files>
  <read_first>
    .planning/phases/44-dependency-version-sweep/44-VERIFY.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md
    app/package.json
    app/eslint.config.js
    app/tsconfig.json
    app/vite.config.ts
  </read_first>
  <action>
    Append section `## Lint Type Build Audit Evidence` to `44-VERIFY.md`. From `app/`, run these exact commands and record each command, exit code, and summary output:

    ```bash
    npm run lint
    npm run build
    npm audit --audit-level=high
    ```

    `npm run build` already runs `tsc -b` before `vite build`; record both the TypeScript and Vite success lines if present. If `npm audit --audit-level=high` exits nonzero, document whether the vulnerability is new relative to `44-DEPENDENCY-SWEEP.md`; new high/critical vulnerabilities are not acceptable for TECHDEBT-08.
  </action>
  <verify>
    <automated>rg -n "npm run lint|npm run build|npm audit --audit-level=high|tsc -b|vite build|new high/critical vulnerabilities: 0|exit code: 0" .planning/phases/44-dependency-version-sweep/44-VERIFY.md</automated>
  </verify>
  <acceptance_criteria>
    - `44-VERIFY.md` contains `## Lint Type Build Audit Evidence`.
    - `44-VERIFY.md` contains `npm run lint` with `exit code: 0`.
    - `44-VERIFY.md` contains `npm run build` with `exit code: 0`.
    - `44-VERIFY.md` contains `npm audit --audit-level=high`.
    - `44-VERIFY.md` contains `new high/critical vulnerabilities: 0` unless a documented pre-existing audit baseline proves otherwise.
  </acceptance_criteria>
  <done>Lint, type/build, and audit evidence is captured with successful exits or explicitly documented pre-existing audit state.</done>
</task>

<task type="auto">
  <name>Task 3: Run Capacitor native sync and record generated diff</name>
  <files>.planning/phases/44-dependency-version-sweep/44-VERIFY.md, app/android/</files>
  <read_first>
    .planning/phases/44-dependency-version-sweep/44-VERIFY.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    app/package.json
    app/package-lock.json
    app/capacitor.config.ts
    app/android/
  </read_first>
  <action>
    From `app/`, run:

    ```bash
    npx cap sync
    ```

    Append section `## Native Sync Evidence` to `44-VERIFY.md` containing the command, exit code, and whether `git diff -- app/android` shows changes. If `app/android/` changes, keep only files written by `npx cap sync` and record the changed path list under `Android files changed:`. If it does not change, record `Android files changed: none`.
  </action>
  <verify>
    <automated>rg -n "## Native Sync Evidence|npx cap sync|exit code: 0|Android files changed:" .planning/phases/44-dependency-version-sweep/44-VERIFY.md</automated>
  </verify>
  <acceptance_criteria>
    - `44-VERIFY.md` contains `## Native Sync Evidence`.
    - `44-VERIFY.md` contains `npx cap sync` with `exit code: 0`.
    - `44-VERIFY.md` contains exactly one `Android files changed:` line.
    - If native files changed, every listed path starts with `app/android/`.
  </acceptance_criteria>
  <done>Capacitor sync has run against the updated dependency graph and native changes are recorded.</done>
</task>

</tasks>

<verification>
Run `rg -n "exit code: 0|Phase 44 regression|Android files changed" .planning/phases/44-dependency-version-sweep/44-VERIFY.md` and inspect `git diff -- app/android .planning/phases/44-dependency-version-sweep/44-VERIFY.md`.
</verification>

<success_criteria>
Plan 44-02 is complete when automated test, lint, build, audit, and native-sync evidence exists and no new Phase 44 regression is accepted.
</success_criteria>

<output>
After completion, create `.planning/phases/44-dependency-version-sweep/44-02-automated-verification-native-sync-SUMMARY.md`.
</output>
