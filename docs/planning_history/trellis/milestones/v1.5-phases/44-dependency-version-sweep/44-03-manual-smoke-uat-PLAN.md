---
phase: 44-dependency-version-sweep
plan: 03
type: execute
wave: 3
depends_on:
  - 44-02
files_modified:
  - .planning/phases/44-dependency-version-sweep/44-UAT.md
autonomous: false
requirements:
  - TECHDEBT-08
must_haves:
  truths:
    - "A human has smoke-tested runtime surfaces affected by the dependency sweep."
    - "Locale switch, Ask streaming, queue refill, saved navigation, and Android sync sanity have recorded pass/fail rows."
    - "Manual smoke evidence is durable in the phase directory before close-out."
  artifacts:
    - path: ".planning/phases/44-dependency-version-sweep/44-UAT.md"
      provides: "Manual smoke/UAT evidence for dependency-risk surfaces"
      contains: "locale-switch"
  key_links:
    - from: ".planning/phases/44-dependency-version-sweep/44-UAT.md"
      to: ".planning/phases/44-dependency-version-sweep/44-VALIDATION.md"
      via: "manual smoke rows"
      pattern: "ask-streaming"
---

<objective>
Capture manual smoke evidence for dependency-risk runtime paths.

Purpose: Cover behavior that automated source/unit checks do not prove after React, router, i18next, and Capacitor updates.
Output: `44-UAT.md` with explicit pass/fail rows.
</objective>

<execution_context>
@/Users/Code/EchoLearn/.codex/get-shit-done/workflows/execute-plan.md
@/Users/Code/EchoLearn/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/44-dependency-version-sweep/44-RESEARCH.md
@.planning/phases/44-dependency-version-sweep/44-VALIDATION.md
@.planning/phases/44-dependency-version-sweep/44-VERIFY.md
@AGENTS.md
@CLAUDE.md
@app/package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create manual smoke scaffold</name>
  <files>.planning/phases/44-dependency-version-sweep/44-UAT.md</files>
  <read_first>
    .planning/phases/44-dependency-version-sweep/44-UAT.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    .planning/phases/44-dependency-version-sweep/44-VERIFY.md
    app/package.json
  </read_first>
  <action>
    Create `.planning/phases/44-dependency-version-sweep/44-UAT.md` with this exact top heading: `# Phase 44 Manual Smoke / UAT`.

    Include a table with columns `id`, `surface`, `steps`, `expected`, `status`, `evidence`, and `tester`. Add exactly these five row ids:

    - `locale-switch`
    - `ask-streaming`
    - `queue-refill`
    - `saved-route-navigation`
    - `android-sync-sanity`

    For setup, include the exact command `npm run dev -- --host 127.0.0.1` and note that commands run from `app/`. Before asking for human verification, run `npm run build` from `app/` and record `build precheck exit code: 0` in the UAT file.
  </action>
  <verify>
    <automated>rg -n "# Phase 44 Manual Smoke / UAT|locale-switch|ask-streaming|queue-refill|saved-route-navigation|android-sync-sanity|npm run dev -- --host 127.0.0.1|build precheck exit code: 0" .planning/phases/44-dependency-version-sweep/44-UAT.md</automated>
  </verify>
  <acceptance_criteria>
    - `44-UAT.md` contains `# Phase 44 Manual Smoke / UAT`.
    - `44-UAT.md` contains all five ids: `locale-switch`, `ask-streaming`, `queue-refill`, `saved-route-navigation`, and `android-sync-sanity`.
    - `44-UAT.md` contains the literal setup command `npm run dev -- --host 127.0.0.1`.
    - `44-UAT.md` contains `build precheck exit code: 0`.
  </acceptance_criteria>
  <done>Manual smoke scaffold exists and build precheck is recorded.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify dependency-risk runtime surfaces</name>
  <files>.planning/phases/44-dependency-version-sweep/44-UAT.md</files>
  <read_first>
    .planning/phases/44-dependency-version-sweep/44-UAT.md
    .planning/phases/44-dependency-version-sweep/44-VALIDATION.md
    .planning/phases/44-dependency-version-sweep/44-VERIFY.md
  </read_first>
  <action>
    Ask the human tester to use the updated app and record results in `44-UAT.md`.

    Required manual checks:
    1. `locale-switch`: switch English to Chinese to Spanish to Japanese in Settings; expected visible UI strings change and no runtime error appears.
    2. `ask-streaming`: start an Ask request; expected streaming text appears and the request completes or aborts without a stuck loading state.
    3. `queue-refill`: trigger Home feed refill or swipe-for-more; expected feed content appears and no duplicate React key warning appears.
    4. `saved-route-navigation`: open `/saved`, switch Saved and Liked tabs, then return to `/home`; expected route navigation works.
    5. `android-sync-sanity`: confirm Plan 44-02 recorded `npx cap sync` exit code 0; if native files changed, confirm the changed paths are under `app/android/`.

    For each row, update `status` to exactly `pass` or `fail`, fill `tester`, and add a one-sentence `evidence` value. If any row is `fail`, record `Phase 44 UAT blocker:` with the failing id and do not proceed to Plan 44-04.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const file='.planning/phases/44-dependency-version-sweep/44-UAT.md'; const text=fs.readFileSync(file,'utf8'); const lines=text.split(/\\r?\\n/).filter((line)=>line.trim().startsWith('|')); const header=lines.find((line)=>/\\|\\s*id\\s*\\|/.test(line) &amp;&amp; /\\|\\s*status\\s*\\|/.test(line)); if (!header) throw new Error('missing UAT table header'); const columns=header.split('|').map((cell)=>cell.trim()); const statusIndex=columns.indexOf('status'); if (statusIndex === -1) throw new Error('missing status column'); const ids=['locale-switch','ask-streaming','queue-refill','saved-route-navigation','android-sync-sanity']; for (const id of ids) { const rows=lines.filter((line)=>new RegExp('^\\\\|\\\\s*'+id+'\\\\s*\\\\|').test(line)); if (rows.length !== 1) throw new Error(id+' row count expected 1 got '+rows.length); const cells=rows[0].split('|').map((cell)=>cell.trim()); const status=cells[statusIndex]; if (status !== 'pass') throw new Error(id+' status expected pass got '+status); if (cells.filter((cell)=>cell === 'fail').length !== 0) throw new Error(id+' contains fail status'); }"</automated>
  </verify>
  <acceptance_criteria>
    - `44-UAT.md` has exactly one table row for each id: `locale-switch`, `ask-streaming`, `queue-refill`, `saved-route-navigation`, and `android-sync-sanity`.
    - Each required row status is exactly `pass` or `fail`.
    - If any row is `fail`, `44-UAT.md` contains `Phase 44 UAT blocker:` followed by the failing id.
    - Plan 44-04 may start only when all five row statuses are `pass`.
  </acceptance_criteria>
  <what-built>Phase 44 dependency update plus automated verification evidence from Plans 44-01 and 44-02.</what-built>
  <how-to-verify>Run the five checks listed in the action, update `44-UAT.md`, and respond `approved` only if all five rows pass.</how-to-verify>
  <resume-signal>Type `approved` after all five rows are marked `pass`, or describe the failing row id and observed issue.</resume-signal>
  <done>Manual smoke/UAT rows are complete and all dependency-risk surfaces pass.</done>
</task>

</tasks>

<verification>
Run the Task 1 and Task 2 `rg` commands against `44-UAT.md`. Confirm no `Phase 44 UAT blocker:` line exists before proceeding to close-out.
</verification>

<success_criteria>
Plan 44-03 is complete when all five manual smoke rows are recorded as `pass` in `44-UAT.md`.
</success_criteria>

<output>
After completion, create `.planning/phases/44-dependency-version-sweep/44-03-manual-smoke-uat-SUMMARY.md`.
</output>
