---
phase: 45-code-quality-sweep
plan: 05
type: execute
wave: 5
depends_on:
  - 45-04
files_modified:
  - .planning/phases/45-code-quality-sweep/45-VERIFY.md
  - .planning/phases/45-code-quality-sweep/45-VALIDATION.md
  - .planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
autonomous: true
requirements:
  - TECHDEBT-07
  - TECHDEBT-09
  - TECHDEBT-10
  - TECHDEBT-11
  - TECHDEBT-12
must_haves:
  truths:
    - "All Phase 45 audit artifacts exist and contain final dispositions."
    - "TECHDEBT-10 is not marked complete unless GraphScreen Android manual/device evidence is present."
    - "Full verification evidence is recorded before marking requirements complete."
    - "Roadmap, requirements, validation, state, and phase summary agree that Phase 45 is complete."
  artifacts:
    - path: ".planning/phases/45-code-quality-sweep/45-VERIFY.md"
      provides: "Final command evidence"
      contains: "npm run test:main"
    - path: ".planning/phases/45-code-quality-sweep/45-VALIDATION.md"
      provides: "Nyquist sign-off"
      contains: "nyquist_compliant: true"
    - path: ".planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md"
      provides: "Phase 45 rollup"
      contains: "TECHDEBT-07"
    - path: ".planning/REQUIREMENTS.md"
      provides: "Requirement completion state"
      contains: "[x] **TECHDEBT-07**"
  key_links:
    - from: ".planning/phases/45-code-quality-sweep/45-VERIFY.md"
      to: ".planning/phases/45-code-quality-sweep/45-VALIDATION.md"
      via: "final verification evidence supports sign-off"
      pattern: "45-CLOSE-01"
---

<objective>
Close Phase 45 with final verification evidence and documentation state updates.

Purpose: Mark TECHDEBT-07, TECHDEBT-09, TECHDEBT-10, TECHDEBT-11, and TECHDEBT-12 complete only after artifacts and verification are present.
Output: `45-VERIFY.md`, validated `45-VALIDATION.md`, `45-PHASE-SUMMARY.md`, and roadmap/state/requirements updates.
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
@.planning/phases/45-code-quality-sweep/45-VALIDATION.md
@.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
@.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
@.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
@.planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md
@.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
@AGENTS.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Record final automated verification evidence</name>
  <files>.planning/phases/45-code-quality-sweep/45-VERIFY.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-VERIFY.md
    .planning/phases/45-code-quality-sweep/45-VALIDATION.md
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
    .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
    .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
    .planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md
    .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
    app/package.json
  </read_first>
  <action>
    Create `.planning/phases/45-code-quality-sweep/45-VERIFY.md` with sections `# Phase 45 Verification`, `## Artifact Presence`, `## Command Evidence`, `## Remaining Failures`, and `## Requirement Evidence`.

    Run and record command, exit code, and concise result for:

    ```bash
    cd app && npx tsc -b --noEmit --pretty false
    cd app && npm run lint
    cd app && npm run build
    cd app && npm run test:main
    cd app && npm run test:actions
    ```

    In `## Artifact Presence`, list these exact files and mark each `present`: `45-TSC-AUDIT.md`, `45-TODO-TRIAGE.md`, `45-OPERATOR-NOTES.md`, `45-DEAD-CODE-SWEEP.md`, and `45-PERF-AUDIT.md`.

    In `## Requirement Evidence`, add a TECHDEBT-10 gate row that quotes the exact `45-PERF-AUDIT.md` marker `GraphScreen Android manual evidence: present`. If `45-PERF-AUDIT.md` is missing that marker, or contains `blocked-device-evidence-required` or `TECHDEBT-10 completion blocked`, classify TECHDEBT-10 as `pending-device-evidence`, add that status to `## Remaining Failures`, and stop before Task 2. Do not mark the phase complete with TECHDEBT-10 pending.

    In `## Remaining Failures`, if any command exits non-zero, list each failing test file or command with a status of `known-deferred`, `new-regression`, or `fixed-in-phase-45`. Do not mark the phase complete if any row is `new-regression`.
  </action>
  <verify>
    <automated>test -f .planning/phases/45-code-quality-sweep/45-VERIFY.md &amp;&amp; rg -n "45-TSC-AUDIT.md.*present|45-TODO-TRIAGE.md.*present|45-OPERATOR-NOTES.md.*present|45-DEAD-CODE-SWEEP.md.*present|45-PERF-AUDIT.md.*present|GraphScreen Android manual evidence: present|npm run test:main|npm run test:actions|Requirement Evidence" .planning/phases/45-code-quality-sweep/45-VERIFY.md &amp;&amp; ! rg -n "pending-device-evidence|blocked-device-evidence-required|TECHDEBT-10 completion blocked" .planning/phases/45-code-quality-sweep/45-VERIFY.md .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-VERIFY.md` contains all five artifact names with status `present`.
    - `45-VERIFY.md` contains `GraphScreen Android manual evidence: present` copied from `45-PERF-AUDIT.md`.
    - `45-VERIFY.md` and `45-PERF-AUDIT.md` contain no `pending-device-evidence`, `blocked-device-evidence-required`, or `TECHDEBT-10 completion blocked` before proceeding to Task 2.
    - `45-VERIFY.md` contains command rows for `npx tsc -b --noEmit --pretty false`, `npm run lint`, `npm run build`, `npm run test:main`, and `npm run test:actions`.
    - `rg -n "new-regression" .planning/phases/45-code-quality-sweep/45-VERIFY.md` returns zero matches before proceeding to Task 2.
  </acceptance_criteria>
  <done>Final verification evidence is recorded and contains no new regression marker.</done>
</task>

<task type="auto">
  <name>Task 2: Sign off validation and requirement state</name>
  <files>.planning/phases/45-code-quality-sweep/45-VALIDATION.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-VALIDATION.md
    .planning/phases/45-code-quality-sweep/45-VERIFY.md
    .planning/REQUIREMENTS.md
    .planning/ROADMAP.md
  </read_first>
  <action>
    Update `.planning/phases/45-code-quality-sweep/45-VALIDATION.md` frontmatter to `status: validated`, `nyquist_compliant: true`, and `wave_0_complete: true`.

    In the validation table, replace `TBD` plan values with these exact plan names:

    - `45-W0-01` -> `45-01-audit-inventory-PLAN.md`
    - `45-W0-02` -> `45-01-audit-inventory-PLAN.md`
    - `45-W0-03` -> `45-01-audit-inventory-PLAN.md`
    - `45-W0-04` -> `45-01-audit-inventory-PLAN.md`
    - `45-FIX-01` -> `45-02-test-lint-strictness-PLAN.md`
    - `45-FIX-02` -> `45-04-performance-profiling-PLAN.md`
    - `45-CLOSE-01` -> `45-05-phase-close-out-PLAN.md`

    Mark validation sign-off checkboxes `[x]` only if `45-VERIFY.md` has no `new-regression` and contains the exact TECHDEBT-10 evidence marker `GraphScreen Android manual evidence: present`.

    In `.planning/REQUIREMENTS.md`, mark these five active requirement checkboxes `[x]`: `TECHDEBT-07`, `TECHDEBT-09`, `TECHDEBT-10`, `TECHDEBT-11`, and `TECHDEBT-12`. Do not mark `TECHDEBT-10` checked unless `45-PERF-AUDIT.md` and `45-VERIFY.md` both contain `GraphScreen Android manual evidence: present` and neither file contains `blocked-device-evidence-required` or `TECHDEBT-10 completion blocked`.

    In `.planning/ROADMAP.md`, update Phase 45 `**Plans:**` to `5 plans`, add five checked plan bullets matching the plan file names, and update the progress table row to `45. Code Quality Sweep | 5/5 | Complete | 2026-05-13 |`.
  </action>
  <verify>
    <automated>rg -n "GraphScreen Android manual evidence: present" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md .planning/phases/45-code-quality-sweep/45-VERIFY.md &amp;&amp; ! rg -n "blocked-device-evidence-required|TECHDEBT-10 completion blocked|pending-device-evidence" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md .planning/phases/45-code-quality-sweep/45-VERIFY.md &amp;&amp; rg -n "status: validated|nyquist_compliant: true|wave_0_complete: true|45-01-audit-inventory-PLAN.md|45-05-phase-close-out-PLAN.md" .planning/phases/45-code-quality-sweep/45-VALIDATION.md &amp;&amp; rg -n "\\[x\\] \\*\\*TECHDEBT-07\\*\\*|\\[x\\] \\*\\*TECHDEBT-09\\*\\*|\\[x\\] \\*\\*TECHDEBT-10\\*\\*|\\[x\\] \\*\\*TECHDEBT-11\\*\\*|\\[x\\] \\*\\*TECHDEBT-12\\*\\*" .planning/REQUIREMENTS.md &amp;&amp; rg -n "45\\. Code Quality Sweep \\| 5/5 \\| Complete \\| 2026-05-13 \\|" .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-VALIDATION.md` frontmatter contains `status: validated`, `nyquist_compliant: true`, and `wave_0_complete: true`.
    - `45-VALIDATION.md` contains no `TBD`.
    - `45-PERF-AUDIT.md` and `45-VERIFY.md` both contain `GraphScreen Android manual evidence: present`.
    - `REQUIREMENTS.md` contains checked rows for all five Phase 45 TECHDEBT IDs.
    - `ROADMAP.md` contains all five Phase 45 plan file names as checked bullets.
    - `ROADMAP.md` progress table contains `45. Code Quality Sweep | 5/5 | Complete | 2026-05-13 |`.
  </acceptance_criteria>
  <done>Validation, requirements, and roadmap state agree that Phase 45 is complete.</done>
</task>

<task type="auto">
  <name>Task 3: Create phase summary and update project state</name>
  <files>.planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md, .planning/STATE.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md
    .planning/phases/45-code-quality-sweep/45-VERIFY.md
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
    .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
    .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
    .planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md
    .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
    .planning/STATE.md
  </read_first>
  <action>
    Create `.planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md` with frontmatter `phase: 45-code-quality-sweep`, `status: complete`, `completed: 2026-05-13`, and `requirements_closed: [TECHDEBT-07, TECHDEBT-09, TECHDEBT-10, TECHDEBT-11, TECHDEBT-12]`.

    Include sections `# Phase 45 - Code Quality Sweep Summary`, `## Requirements Closed`, `## Artifacts`, `## Fixes Landed`, `## Performance Decisions`, `## Remaining Deferred Items`, and `## Verification Evidence`.

    Update `.planning/STATE.md` current position to say Phase 45 complete and milestone v1.5 ready for verification/close-out. Add a last-decisions entry naming the five closed TECHDEBT IDs and linking `45-PHASE-SUMMARY.md`.
  </action>
  <verify>
    <automated>test -f .planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md &amp;&amp; rg -n "requirements_closed: \\[TECHDEBT-07, TECHDEBT-09, TECHDEBT-10, TECHDEBT-11, TECHDEBT-12\\]|Requirements Closed|Performance Decisions|Verification Evidence" .planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md &amp;&amp; rg -n "Phase 45 complete|45-PHASE-SUMMARY.md|TECHDEBT-07.*TECHDEBT-09.*TECHDEBT-10.*TECHDEBT-11.*TECHDEBT-12" .planning/STATE.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-PHASE-SUMMARY.md` frontmatter contains the exact requirements_closed list from the action text.
    - `45-PHASE-SUMMARY.md` contains sections for requirements, artifacts, fixes, performance decisions, deferred items, and verification evidence.
    - `STATE.md` contains `Phase 45 complete`.
    - `STATE.md` contains `45-PHASE-SUMMARY.md`.
  </acceptance_criteria>
  <done>Phase 45 close-out documentation is complete and discoverable from project state.</done>
</task>

</tasks>

<verification>
Run:

```bash
test -f .planning/phases/45-code-quality-sweep/45-VERIFY.md
test -f .planning/phases/45-code-quality-sweep/45-PHASE-SUMMARY.md
rg -n "45. Code Quality Sweep | 5/5 | Complete | 2026-05-13 |" .planning/ROADMAP.md
```
</verification>

<success_criteria>
All five Phase 45 requirements are marked complete only after final verification and phase-summary evidence exist.
</success_criteria>

<output>
After completion, create `.planning/phases/45-code-quality-sweep/45-05-phase-close-out-SUMMARY.md`.
</output>
