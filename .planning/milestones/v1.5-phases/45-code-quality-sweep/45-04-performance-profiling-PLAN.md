---
phase: 45-code-quality-sweep
plan: 04
type: execute
wave: 4
depends_on:
  - 45-03
files_modified:
  - .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
  - app/src/screens/GraphScreen.tsx
  - app/tests/screens/GraphScreen.performance-layer.test.mjs
autonomous: true
requirements:
  - TECHDEBT-10
must_haves:
  truths:
    - "First paint, queue refill, masonry scroll, and GraphScreen Android drag lag have recorded evidence."
    - "GraphScreen Android drag lag has actual Android device/emulator manual evidence before TECHDEBT-10 can close."
    - "Every P0/P1 finding is either closed by a localized fix or deferred with a concrete rationale."
    - "No persistent product telemetry or user-visible diagnostics are added."
  artifacts:
    - path: ".planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md"
      provides: "TECHDEBT-10 final performance evidence and decisions"
      contains: "P0/P1 Closure Decisions"
    - path: "app/src/screens/GraphScreen.tsx"
      provides: "Optional localized Android drag layer mitigation if audit proves P1"
      contains: "data-no-swipe-nav=\"true\""
    - path: "app/tests/screens/GraphScreen.performance-layer.test.mjs"
      provides: "Source-reading guard for any shipped GraphScreen layer mitigation"
      contains: "GraphScreen performance layer"
  key_links:
    - from: ".planning/notes/2026-05-09-graphscreen-drag-lag-android.md"
      to: ".planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md"
      via: "Android warm-up lag evidence row"
      pattern: "warm-up"
---

<objective>
Complete the required performance audit and close only bounded P0/P1 findings.

Purpose: Satisfy TECHDEBT-10 without shipping telemetry, broad GraphScreen rewrites, speculative animation rewrites, or dependency changes.
Output: Final `45-PERF-AUDIT.md`; optional localized GraphScreen layer-promotion fix plus source-reading guard if evidence supports it.
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
@.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
@.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
@.planning/notes/2026-05-09-graphscreen-drag-lag-android.md
@AGENTS.md
@CLAUDE.md
@app/src/screens/HomeScreen.tsx
@app/src/components/MasonryFeed.tsx
@app/src/services/concept-feed.service.ts
@app/src/services/post-queue.service.ts
@app/src/screens/GraphScreen.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fill final performance evidence and severity decisions</name>
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
    Update `.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` so each required target row has `Evidence`, `Severity`, and `Action` values.

    Record these exact commands and outputs:

    ```bash
    cd app && npm run build
    cd app && node --test tests/services/refill-mutex.test.mjs tests/services/refill-queue-integration.test.mjs
    adb devices
    ```

    For `first paint`, use the production build output plus any Vite large-chunk/large-asset warning as evidence. If no browser trace is available, set severity to `P2-defer` and action to `defer broad code-splitting to v1.6 unless device trace proves P0/P1`.

    For `queue refill`, use the targeted queue/refill tests plus source inspection of `postQueueService.needsRefill()` and `refillQueue` mutex as evidence. If tests pass and no synchronous loop regression is found, set severity to `P3-no-code`.

    For `masonry scroll`, use source inspection of `MasonryFeed.tsx` height-accumulating split and existing reduced-motion wrapper as evidence. If no frame-drop trace is available, set severity to `P2-manual-follow-up` and action to `no speculative animation rewrite`.

    For `GraphScreen Android drag lag`, TECHDEBT-10 cannot be marked complete from `adb devices` output alone. Record `adb devices` output, then use an attached Android device or emulator to open the app on GraphScreen and manually exercise cold first drag plus warmed subsequent drag. Record the device/emulator identifier, Android/WebView version if available, reproduction steps, cold-drag observation, warmed-drag observation, and evidence source under a required line `GraphScreen Android manual evidence: present`.

    If no Android device/emulator is attached or manual drag evidence cannot be collected, set the GraphScreen row status to `blocked-device-evidence-required`, add `TECHDEBT-10 completion blocked: GraphScreen Android manual evidence missing`, do not write `GraphScreen Android manual evidence: present`, do not proceed to Task 2 or Task 3, and leave the plan/phase incomplete for executor follow-up. Do not use `P2-manual-device-needed` as a final severity because Phase 45 owns TECHDEBT-10 and must not close without this evidence.

    If a device is attached and the warm-up lag is reproduced, classify as `P1-local-fix-candidate` only if the evidence points to layer promotion or first-paint/layout warm-up, not a full MindElixir rewrite. If actual device/emulator evidence shows no P0/P1 issue, classify as `P3-no-code` with the manual evidence details retained.
  </action>
  <verify>
    <automated>rg -n "first paint|queue refill|masonry scroll|GraphScreen Android drag lag|GraphScreen Android manual evidence: present|P0/P1 Closure Decisions|P2-defer|P3-no-code|P2-manual-follow-up|P1-local-fix-candidate|adb devices" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md &amp;&amp; ! rg -n "P2-manual-device-needed|TECHDEBT-10 completion blocked|blocked-device-evidence-required" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-PERF-AUDIT.md` contains exactly one final evidence row for each target: `first paint`, `queue refill`, `masonry scroll`, and `GraphScreen Android drag lag`.
    - `45-PERF-AUDIT.md` contains the literal command `adb devices`.
    - `45-PERF-AUDIT.md` contains `GraphScreen Android manual evidence: present` with attached device/emulator details.
    - `45-PERF-AUDIT.md` does not contain `P2-manual-device-needed`, `blocked-device-evidence-required`, or `TECHDEBT-10 completion blocked` when Task 1 is considered complete.
    - `45-PERF-AUDIT.md` contains no `pending-profile` status.
    - `45-PERF-AUDIT.md` contains no `TBD`.
  </acceptance_criteria>
  <done>TECHDEBT-10 has final evidence and severity/action decisions for every required profiling area.</done>
</task>

<task type="auto">
  <name>Task 2: Apply localized GraphScreen layer mitigation only if classified P1</name>
  <files>app/src/screens/GraphScreen.tsx, app/tests/screens/GraphScreen.performance-layer.test.mjs, .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</files>
  <read_first>
    app/src/screens/GraphScreen.tsx
    app/tests/screens/GraphScreen.performance-layer.test.mjs
    .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
    .planning/notes/2026-05-09-graphscreen-drag-lag-android.md
    CLAUDE.md
  </read_first>
  <action>
    Inspect `45-PERF-AUDIT.md`.

    If the `GraphScreen Android drag lag` row has severity `P1-local-fix-candidate`, make this exact localized source change in `app/src/screens/GraphScreen.tsx`: on the MindElixir container `<div ref={containerRef} data-no-swipe-nav="true" style={{ width: '100%', height: '100%' }} />`, extend the style object to include `touchAction: 'none'`, `willChange: 'transform'`, and `transform: 'translateZ(0)'`. Do not add `transform`, `willChange`, `filter`, `contain`, or `perspective` to any Header ancestor or outer GraphScreen root.

    If the row is not `P1-local-fix-candidate`, first confirm `45-PERF-AUDIT.md` contains `GraphScreen Android manual evidence: present`. If that line is missing or the artifact contains `blocked-device-evidence-required`, stop without modifying code and leave TECHDEBT-10 pending. If actual Android evidence is present and no P1 local fix is warranted, do not modify `GraphScreen.tsx`; instead add `Plan 45-04 Task 2: no GraphScreen code change` to `45-PERF-AUDIT.md` with the reason from Task 1.

    If code changes, create `app/tests/screens/GraphScreen.performance-layer.test.mjs` as a source-reading test that:

    - Reads `../../src/screens/GraphScreen.tsx`.
    - Asserts the MindElixir container keeps `data-no-swipe-nav="true"`.
    - Asserts `touchAction: 'none'`, `willChange: 'transform'`, and `transform: 'translateZ(0)'` appear in the same source region as `ref={containerRef}`.
    - Asserts the outer GraphScreen root region containing `title={t('graph.headerTitle')}` does not contain `willChange: 'transform'`.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc -b --noEmit --pretty false &amp;&amp; rg -n "GraphScreen Android manual evidence: present" ../.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md &amp;&amp; ! rg -n "blocked-device-evidence-required|TECHDEBT-10 completion blocked" ../.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md &amp;&amp; if test -f tests/screens/GraphScreen.performance-layer.test.mjs; then node --test tests/screens/GraphScreen.performance-layer.test.mjs; else rg -n "Plan 45-04 Task 2: no GraphScreen code change" ../.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md; fi</automated>
  </verify>
  <acceptance_criteria>
    - If `45-PERF-AUDIT.md` contains `P1-local-fix-candidate`, then `rg -n "touchAction: 'none'|willChange: 'transform'|transform: 'translateZ\\(0\\)'" app/src/screens/GraphScreen.tsx` returns at least 3 matches.
    - If `45-PERF-AUDIT.md` contains `P1-local-fix-candidate`, then `app/tests/screens/GraphScreen.performance-layer.test.mjs` exists and the targeted `node --test` command exits 0.
    - If `45-PERF-AUDIT.md` does not contain `P1-local-fix-candidate`, then `rg -n "GraphScreen Android manual evidence: present" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` and `rg -n "Plan 45-04 Task 2: no GraphScreen code change" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md` each return at least 1 match.
    - `cd app && npx tsc -b --noEmit --pretty false` exits 0.
  </acceptance_criteria>
  <done>P0/P1 performance closure policy is honored: localized fix only with evidence, otherwise documented deferral.</done>
</task>

<task type="auto">
  <name>Task 3: Run performance plan verification and record final status</name>
  <files>.planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md
    app/package.json
    app/src/screens/GraphScreen.tsx
    app/tests/screens/GraphScreen.performance-layer.test.mjs
  </read_first>
  <action>
    Add a `## Plan 45-04 Verification` section to `45-PERF-AUDIT.md` with command, exit code, and result rows for:

    ```bash
    cd app && npm run build
    cd app && npx tsc -b --noEmit --pretty false
    cd app && npm run lint
    ```

    If `app/tests/screens/GraphScreen.performance-layer.test.mjs` exists, also record:

    ```bash
    cd app && node --test tests/screens/GraphScreen.performance-layer.test.mjs
    ```

    Confirm in the artifact that Phase 45 added no persistent telemetry by recording `persistent telemetry added: no`.

    Before adding final status, assert `45-PERF-AUDIT.md` contains `GraphScreen Android manual evidence: present` and does not contain `blocked-device-evidence-required` or `TECHDEBT-10 completion blocked`. If the manual evidence marker is missing, stop and leave TECHDEBT-10 pending; do not create a successful `45-04-performance-profiling-SUMMARY.md`.
  </action>
  <verify>
    <automated>rg -n "GraphScreen Android manual evidence: present|Plan 45-04 Verification|npm run build|npx tsc -b --noEmit --pretty false|npm run lint|persistent telemetry added: no" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md &amp;&amp; ! rg -n "blocked-device-evidence-required|TECHDEBT-10 completion blocked" .planning/phases/45-code-quality-sweep/45-PERF-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-PERF-AUDIT.md` contains `Plan 45-04 Verification`.
    - `45-PERF-AUDIT.md` contains `GraphScreen Android manual evidence: present`.
    - `45-PERF-AUDIT.md` does not contain `blocked-device-evidence-required` or `TECHDEBT-10 completion blocked`.
    - `45-PERF-AUDIT.md` contains `persistent telemetry added: no`.
    - `45-PERF-AUDIT.md` contains command rows for `npm run build`, `npx tsc -b --noEmit --pretty false`, and `npm run lint`.
  </acceptance_criteria>
  <done>Performance work is verified and ready for phase close-out.</done>
</task>

</tasks>

<verification>
Run:

```bash
cd app && npm run build
cd app && npm run lint
cd app && npx tsc -b --noEmit --pretty false
```
</verification>

<success_criteria>
TECHDEBT-10 is complete only when all required hot paths have evidence, GraphScreen Android drag lag has actual attached device/emulator manual evidence, all P0/P1 issues are closed or deferred with rationale, and no telemetry or broad rewrite entered the product. If GraphScreen Android manual evidence is unavailable, stop this plan and leave TECHDEBT-10 pending.
</success_criteria>

<output>
After completion, create `.planning/phases/45-code-quality-sweep/45-04-performance-profiling-SUMMARY.md`.
</output>
