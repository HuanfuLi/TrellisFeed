---
phase: 45-code-quality-sweep
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
  - .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
  - .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
  - .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
autonomous: true
requirements:
  - TECHDEBT-07
  - TECHDEBT-10
  - TECHDEBT-11
  - TECHDEBT-12
must_haves:
  truths:
    - "The phase starts with audit artifacts before code edits."
    - "Current TypeScript, lint, TODO, suppression, operator-note, and performance baselines are recorded."
    - "Every known operator note/debug file has an initial Phase 45 disposition."
  artifacts:
    - path: ".planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md"
      provides: "TECHDEBT-07 compiler, strictness, lint, and suppression baseline"
      contains: "strict: true"
    - path: ".planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md"
      provides: "TECHDEBT-11 TODO/FIXME/HACK/XXX and suppression catalogue"
      contains: "Suppression Inventory"
    - path: ".planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md"
      provides: "TECHDEBT-12 operator-note and debug-file disposition table"
      contains: "2026-05-09-graphscreen-drag-lag-android.md"
    - path: ".planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md"
      provides: "TECHDEBT-10 profiling baseline and required target sections"
      contains: "GraphScreen Android drag lag"
  key_links:
    - from: ".planning/phases/45-code-quality-sweep/45-CONTEXT.md"
      to: ".planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md"
      via: "D-01/D-04 evidence-first strictness audit"
      pattern: "D-04"
    - from: ".planning/phases/45-code-quality-sweep/45-CONTEXT.md"
      to: ".planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md"
      via: "D-13 suppression and TODO catalogue"
      pattern: "D-13"
    - from: ".planning/phases/45-code-quality-sweep/45-CONTEXT.md"
      to: ".planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md"
      via: "D-15 through D-18 note/debug triage"
      pattern: "D-15"
---

<objective>
Create the Phase 45 evidence inventory before any source-code cleanup.

Purpose: Satisfy the locked audit-first order from `45-CONTEXT.md` D-01 and give later executors concrete findings to close.
Output: `45-TSC-AUDIT.md`, `45-TODO-TRIAGE.md`, `45-OPERATOR-NOTES.md`, and an initialized `45-PERF-AUDIT.md`.
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
@.planning/phases/45-code-quality-sweep/45-CONTEXT.md
@.planning/phases/45-code-quality-sweep/45-RESEARCH.md
@.planning/phases/45-code-quality-sweep/45-VALIDATION.md
@AGENTS.md
@CLAUDE.md
@app/package.json
@app/tsconfig.json
@app/tsconfig.app.json
@app/eslint.config.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create strictness and lint suppression audit</name>
  <files>.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
    .planning/phases/45-code-quality-sweep/45-CONTEXT.md
    .planning/phases/45-code-quality-sweep/45-RESEARCH.md
    .planning/phases/45-code-quality-sweep/45-VALIDATION.md
    app/tsconfig.json
    app/tsconfig.app.json
    app/eslint.config.js
    app/package.json
  </read_first>
  <action>
    Create `.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` with these exact top-level sections: `# Phase 45 TSC Audit`, `## Commands`, `## Current Strictness State`, `## Strict-Adjacent Flags`, `## Lint Suppression Findings`, `## In-Scope Fixes`, and `## Deferred With Rationale`.

    From `app/`, run and record the command, exit code, and concise result for each command:

    ```bash
    npx tsc -b --noEmit --pretty false
    npx tsc --showConfig -p tsconfig.app.json
    npm run lint
    npm run lint -- --report-unused-disable-directives
    ```

    Record these current config facts exactly in `## Current Strictness State`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, and `noUncheckedSideEffectImports: true`.

    In `## Strict-Adjacent Flags`, classify `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` as `audit-only in Phase 45 unless command output proves a genuinely small diff`; do not enable either flag in this task per D-04.

    In `## Lint Suppression Findings`, include rows for these known stale-disable candidates from research: `app/src/components/SwipeTabContainer.tsx:169`, `app/src/screens/HomeScreen.tsx:502`, and `app/src/state/useTrellisData.ts:24`. Include the command `npm run lint -- --report-unused-disable-directives` as the evidence source.
  </action>
  <verify>
    <automated>test -f .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md &amp;&amp; rg -n "strict: true|noUncheckedSideEffectImports: true|npm run lint -- --report-unused-disable-directives|SwipeTabContainer.tsx:169|HomeScreen.tsx:502|useTrellisData.ts:24|exactOptionalPropertyTypes|noUncheckedIndexedAccess" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "strict: true" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` returns at least 1 match.
    - `rg -n "noUncheckedSideEffectImports: true" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` returns at least 1 match.
    - `rg -n "npm run lint -- --report-unused-disable-directives" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` returns at least 1 match.
    - `rg -n "SwipeTabContainer.tsx:169|HomeScreen.tsx:502|useTrellisData.ts:24" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` returns exactly 3 matching lines.
    - `app/tsconfig.app.json` is not modified by this task.
  </acceptance_criteria>
  <done>TECHDEBT-07 has a durable baseline artifact and concrete strictness/lint findings for later closure.</done>
</task>

<task type="auto">
  <name>Task 2: Catalogue TODOs, suppressions, and operator/debug notes</name>
  <files>.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md, .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
    .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
    .planning/phases/45-code-quality-sweep/45-CONTEXT.md
    .planning/phases/45-code-quality-sweep/45-RESEARCH.md
    .planning/notes/2026-05-08-fix-youtube-landscape-video.md
    .planning/notes/2026-05-09-graphscreen-drag-lag-android.md
    .planning/debug/feed-not-auto-populating-after-force-new-day.md
    .planning/debug/vine-chip-not-clearing-after-force-new-day.md
    .planning/phases/38-v1-4-carry-over-cleanup/38-02-youtube-short-removal-SUMMARY.md
    .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
  </read_first>
  <action>
    Create `.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md` with sections `# Phase 45 TODO Triage`, `## Commands`, `## TODO/FIXME/HACK/XXX Inventory`, `## Suppression Inventory`, `## In-Scope Closures`, and `## Deferred Items`.

    Run these commands from the repo root and record each command plus exit code:

    ```bash
    rg -n "TODO|FIXME|HACK|XXX" app/src app/tests .planning/notes .planning/debug
    rg -n "eslint-disable|@ts-ignore|@ts-expect-error|no-explicit-any|\\bas any\\b|: any\\b" app/src app/tests
    ```

    Classify the Spanish locale string `app/src/locales/es.json` containing `TODOS` as `not-a-TODO user-facing Spanish copy`. Classify every `eslint-disable`, `@ts-ignore`, and explicit `any` row using exactly one of these labels from D-14: `justified permanent guard`, `narrowable local typing issue`, `stale workaround`, or `future-work note`.

    Create `.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md` with sections `# Phase 45 Operator Notes`, `## Files Reviewed`, `## Dispositions`, and `## Follow-Up Links`. Include one row for each of these exact inputs:

    - `.planning/notes/2026-05-08-fix-youtube-landscape-video.md` — disposition `closed-by-phase-38`, evidence `38-02-youtube-short-removal-SUMMARY.md`.
    - `.planning/notes/2026-05-09-graphscreen-drag-lag-android.md` — disposition `feeds-performance-audit`, evidence `45-PERF-AUDIT.md`.
    - `.planning/debug/feed-not-auto-populating-after-force-new-day.md` — disposition `check-supersession-before-code`, evidence `43-15-force-new-day-dedup` from `43-PHASE-SUMMARY.md`.
    - `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` — disposition `check-supersession-before-code`, evidence `43-PHASE-SUMMARY.md` HomeScreen `[location.pathname]` resync.
    - `.planning/debug/dismiss-not-propagating-to-same-anchor-tiles.md` — disposition `not-present-on-disk`, evidence `find .planning/debug -maxdepth 1 -type f -print`.
    - `.planning/debug/duplicate-post-keys-after-force-new-day.md` — disposition `not-present-on-disk`, evidence `find .planning/debug -maxdepth 1 -type f -print`.
  </action>
  <verify>
    <automated>test -f .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md &amp;&amp; test -f .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md &amp;&amp; rg -n "not-a-TODO user-facing Spanish copy|Suppression Inventory|justified permanent guard|narrowable local typing issue|stale workaround|future-work note" .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md &amp;&amp; rg -n "closed-by-phase-38|feeds-performance-audit|check-supersession-before-code|not-present-on-disk|2026-05-09-graphscreen-drag-lag-android.md" .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-TODO-TRIAGE.md` contains the literal command `rg -n "TODO|FIXME|HACK|XXX" app/src app/tests .planning/notes .planning/debug`.
    - `45-TODO-TRIAGE.md` contains the literal label `not-a-TODO user-facing Spanish copy`.
    - `45-TODO-TRIAGE.md` contains all four labels: `justified permanent guard`, `narrowable local typing issue`, `stale workaround`, and `future-work note`.
    - `45-OPERATOR-NOTES.md` contains all six listed note/debug paths from the action text.
    - `rg -n "closed-by-phase-38|feeds-performance-audit|not-present-on-disk" .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md` returns at least 4 lines.
  </acceptance_criteria>
  <done>TECHDEBT-11 and TECHDEBT-12 have complete inventories with explicit dispositions for later closure.</done>
</task>

<task type="auto">
  <name>Task 3: Initialize performance audit target matrix</name>
  <files>.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
    .planning/phases/45-code-quality-sweep/45-CONTEXT.md
    .planning/phases/45-code-quality-sweep/45-RESEARCH.md
    .planning/notes/2026-05-09-graphscreen-drag-lag-android.md
    app/src/screens/HomeScreen.tsx
    app/src/components/MasonryFeed.tsx
    app/src/services/concept-feed.service.ts
    app/src/services/post-queue.service.ts
    app/src/screens/GraphScreen.tsx
  </read_first>
  <action>
    Create `.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` with these exact sections: `# Phase 45 Performance Audit`, `## Required Targets`, `## Baseline Commands`, `## Findings`, `## P0/P1 Closure Decisions`, and `## Manual Android Evidence`.

    Run `cd app && npm run build` and record the exit code plus any Vite chunk-size or asset-size warnings under `## Baseline Commands`.

    Under `## Required Targets`, create a table with exactly these four rows and initial status `pending-profile`: `first paint`, `queue refill`, `masonry scroll`, and `GraphScreen Android drag lag`.

    Under `## Manual Android Evidence`, copy the symptom summary from `.planning/notes/2026-05-09-graphscreen-drag-lag-android.md`: Android only, perceptible but usable, most noticeable at drag start, stabilizes after warm-up. Do not implement a performance fix in this task.
  </action>
  <verify>
    <automated>test -f .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md &amp;&amp; rg -n "first paint|queue refill|masonry scroll|GraphScreen Android drag lag|pending-profile|P0/P1 Closure Decisions|Manual Android Evidence|npm run build" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "first paint|queue refill|masonry scroll|GraphScreen Android drag lag" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` returns exactly 4 lines in the required-targets table.
    - `45-PERF-AUDIT.md` contains the exact status string `pending-profile` at least 4 times.
    - `45-PERF-AUDIT.md` contains `P0/P1 Closure Decisions`.
    - `45-PERF-AUDIT.md` contains `Manual Android Evidence`.
  </acceptance_criteria>
  <done>TECHDEBT-10 has a required-target matrix before profiling or fixes begin.</done>
</task>

</tasks>

<verification>
After all tasks, run:

```bash
test -f .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
test -f .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
test -f .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
test -f .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
```
</verification>

<success_criteria>
Phase 45 has concrete inventory artifacts before source-code cleanup, and every locked decision D-01, D-04, D-10, D-13, D-15, D-16, D-17, and D-18 is represented in an artifact.
</success_criteria>

<output>
After completion, create `.planning/phases/45-code-quality-sweep/45-01-audit-inventory-SUMMARY.md`.
</output>
