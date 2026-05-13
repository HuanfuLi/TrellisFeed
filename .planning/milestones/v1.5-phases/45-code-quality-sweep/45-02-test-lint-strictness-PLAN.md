---
phase: 45-code-quality-sweep
plan: 02
type: execute
wave: 2
depends_on:
  - 45-01
files_modified:
  - app/src/components/SwipeTabContainer.tsx
  - app/src/screens/HomeScreen.tsx
  - app/src/state/useTrellisData.ts
  - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
  - app/tests/services/post-queue.test.mjs
  - app/tests/services/image-gen-key-gate.test.mjs
  - app/tests/services/trellis-layout.test.mjs
  - app/src/services/concept-feed.service.ts
  - .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
autonomous: true
requirements:
  - TECHDEBT-07
  - TECHDEBT-09
must_haves:
  truths:
    - "Stale lint-disable directives no longer fail the unused-disable lint gate."
    - "Known stale Phase 42/43 source-reading tests assert current canonical constants and contracts."
    - "The concept-feed test no longer fails on the direct extensionless `youtube.service` import."
  artifacts:
    - path: "app/src/components/SwipeTabContainer.tsx"
      provides: "Stale no-console suppression removal"
      contains: "console.warn('[SwipeTabContainer] stripX drift'"
    - path: "app/tests/services/post-queue.test.mjs"
      provides: "REFILL_THRESHOLD=24 test expectation"
      contains: "size < 24"
    - path: "app/tests/services/concept-feed-source-diversity-wiring.test.mjs"
      provides: "walkDerivedList(24, exploredIds, dismissedIds) source-reading expectation"
      contains: "walkDerivedList(24, exploredIds, dismissedIds)"
    - path: "app/src/services/concept-feed.service.ts"
      provides: "Node-test-compatible local import suffixes for concept-feed direct deps"
      contains: "from './youtube.service.ts'"
  key_links:
    - from: ".planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md"
      to: "app/src/components/SwipeTabContainer.tsx"
      via: "stale disable directive finding"
      pattern: "SwipeTabContainer.tsx:169"
    - from: "CLAUDE.md"
      to: "app/tests/services/post-queue.test.mjs"
      via: "canonical REFILL_THRESHOLD=24"
      pattern: "REFILL_THRESHOLD.*24"
---

<objective>
Close the first correctness blockers from the Phase 45 audit: stale lint suppressions, stale source-reading tests, and the direct concept-feed Node import failure.

Purpose: Keep TypeScript/lint/test correctness ahead of broader cleanup per `45-CONTEXT.md` D-02 and D-06.
Output: Updated lint/test/source files and updated audit notes.
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
@.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
@AGENTS.md
@CLAUDE.md
@app/eslint.config.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove stale no-console lint disables only</name>
  <files>app/src/components/SwipeTabContainer.tsx, app/src/screens/HomeScreen.tsx, app/src/state/useTrellisData.ts, .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</files>
  <read_first>
    app/src/components/SwipeTabContainer.tsx
    app/src/screens/HomeScreen.tsx
    app/src/state/useTrellisData.ts
    app/eslint.config.js
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
    .planning/phases/45-code-quality-sweep/45-CONTEXT.md
  </read_first>
  <action>
    Remove only these three stale no-console disable comments because `app/eslint.config.js` allows `console.warn` and `console.error`:

    - `app/src/components/SwipeTabContainer.tsx`: remove the line `// eslint-disable-next-line no-console` immediately before `console.warn('[SwipeTabContainer] stripX drift', { actual: stripX.get(), expected });`.
    - `app/src/screens/HomeScreen.tsx`: remove the trailing `// eslint-disable-line react-hooks/exhaustive-deps -- containerRef and refs are stable after mount` only if `npm run lint -- --report-unused-disable-directives` reports it as unused in the current checkout; do not change the effect body.
    - `app/src/state/useTrellisData.ts`: remove the line `// eslint-disable-next-line no-console` immediately before `console.warn('[useTrellisData] recompute failed', err);`.

    Update `.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` by adding a `Plan 45-02 Task 1 closure` row for each removed directive with status `closed`.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npm run lint -- --report-unused-disable-directives</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "eslint-disable-next-line no-console" app/src/components/SwipeTabContainer.tsx app/src/state/useTrellisData.ts` returns zero matches.
    - `rg -n "Plan 45-02 Task 1 closure" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` returns at least 3 matches if all three stale directives were removed.
    - `cd app && npm run lint -- --report-unused-disable-directives` exits 0.
  </acceptance_criteria>
  <done>The unused-disable lint gate is clean without changing runtime logic.</done>
</task>

<task type="auto">
  <name>Task 2: Update stale source-reading tests to current canonical values</name>
  <files>app/tests/services/concept-feed-source-diversity-wiring.test.mjs, app/tests/services/post-queue.test.mjs, app/tests/services/image-gen-key-gate.test.mjs, app/tests/services/trellis-layout.test.mjs, .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</files>
  <read_first>
    app/tests/services/concept-feed-source-diversity-wiring.test.mjs
    app/tests/services/post-queue.test.mjs
    app/tests/services/image-gen-key-gate.test.mjs
    app/tests/services/trellis-layout.test.mjs
    app/src/services/concept-feed.service.ts
    app/src/services/post-queue.service.ts
    app/src/services/trellis-layout.service.ts
    CLAUDE.md
    .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
  </read_first>
  <action>
    Make these exact test updates:

    - In `app/tests/services/concept-feed-source-diversity-wiring.test.mjs`, change the counterweight test name and regex/assertion from `walkDerivedList(16, exploredIds, dismissedIds)` to `walkDerivedList(24, exploredIds, dismissedIds)`. Keep the `dismissedIds is built from engagementService.getDismissedAnchorIds()` assertion unchanged.
    - In `app/tests/services/post-queue.test.mjs`, change the `needsRefill` test title to `needsRefill returns true when size < 24, false when >= 24 (Phase 42 masonry threshold)`, create 24 posts instead of 16, and assert false after enqueueing 24 posts.
    - In `app/tests/services/image-gen-key-gate.test.mjs`, replace the brittle single-line regex for the refillQueue block with exact checks for `const imageGenEnabled = settings.imageGeneration?.enabled !== false;` and `hasImageGenKey: imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent)`. Keep the session-post test, but allow the line break before `&& (!!(settings2.imageGeneration?.nanoBananaApiKey) || !!(settings2.imageGeneration?.geminiApiKey))`.
    - In `app/tests/services/trellis-layout.test.mjs`, import `VINE_COLOR_VARS` from `../../src/services/trellis-layout.service.ts`, rename the final test to `getVineColor returns one of VINE_COLOR_VARS`, and assert `VINE_COLOR_VARS.includes(color)` instead of a hard-coded `var(--node-*)` list.

    Add a `Plan 45-02 Task 2 closure` subsection to `45-TSC-AUDIT.md` listing these four files and the exact canonical values `24`, `imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent)`, and `VINE_COLOR_VARS`.
  </action>
  <verify>
    <automated>cd app &amp;&amp; node --test tests/services/concept-feed-source-diversity-wiring.test.mjs tests/services/post-queue.test.mjs tests/services/image-gen-key-gate.test.mjs tests/services/trellis-layout.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "walkDerivedList\\(24, exploredIds, dismissedIds\\)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns exactly 1 match.
    - `rg -n "size < 24|Array.from\\(\\{ length: 24 \\}" app/tests/services/post-queue.test.mjs` returns at least 2 matches.
    - `rg -n "imageGenEnabled && \\(nanoBananaKeyPresent \\|\\| geminiImageKeyPresent\\)" app/tests/services/image-gen-key-gate.test.mjs` returns at least 1 match.
    - `rg -n "VINE_COLOR_VARS" app/tests/services/trellis-layout.test.mjs` returns at least 2 matches.
    - The targeted `node --test` command exits 0.
  </acceptance_criteria>
  <done>The known stale constant/source-reading tests pass against the current Phase 42/43 source of truth.</done>
</task>

<task type="auto">
  <name>Task 3: Fix direct concept-feed extensionless local imports for node:test</name>
  <files>app/src/services/concept-feed.service.ts, app/tests/concept-feed.test.mjs, .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</files>
  <read_first>
    app/src/services/concept-feed.service.ts
    app/tests/concept-feed.test.mjs
    app/tsconfig.app.json
    .planning/phases/37-i18n-leaf-module-refactor/37-03-SUMMARY.md
    .planning/phases/45-code-quality-sweep/45-CONTEXT.md
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
  </read_first>
  <action>
    In `app/src/services/concept-feed.service.ts`, add `.ts` suffixes to these direct same-directory local imports exactly:

    - `./youtube.service` -> `./youtube.service.ts`
    - `./web-search.service` -> `./web-search.service.ts`
    - `./question.service` -> `./question.service.ts`
    - `./post-queue.service` -> `./post-queue.service.ts`
    - `./post-history.service` -> `./post-history.service.ts`
    - `./daily-read.service` -> `./daily-read.service.ts`
    - `./style-assignment` -> `./style-assignment.ts`
    - `./trellis-state.service` -> `./trellis-state.service.ts`
    - `./concept-feed-dedup` -> `./concept-feed-dedup.ts`
    - `./starter-posts-decay` -> `./starter-posts-decay.ts`
    - `./api-availability` -> `./api-availability.ts`
    - `./feed-spread` -> `./feed-spread.ts`
    - `./refill-mutex` -> `./refill-mutex.ts`

    Do not change imports that already end in `.ts`. Do not weaken `app/tests/concept-feed.test.mjs`.

    Run `cd app && node --test tests/concept-feed.test.mjs`. If another direct extensionless local import in the same file is reported, fix it using the same `.ts` suffix rule. If the failure moves into a different source file, update `45-TSC-AUDIT.md` with a `Plan 45-02 Task 3 follow-up` row naming the new file and stop after `npx tsc -b --noEmit --pretty false` passes.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc -b --noEmit --pretty false &amp;&amp; node --test tests/concept-feed.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "from './youtube.service.ts'|from './web-search.service.ts'|from './post-queue.service.ts'|from './feed-spread.ts'" app/src/services/concept-feed.service.ts` returns at least 4 matches.
    - `rg -n "from './(youtube.service|web-search.service|question.service|post-queue.service|post-history.service|daily-read.service|style-assignment|trellis-state.service|concept-feed-dedup|starter-posts-decay|api-availability|feed-spread|refill-mutex)'" app/src/services/concept-feed.service.ts` returns zero matches.
    - `cd app && npx tsc -b --noEmit --pretty false` exits 0.
    - Either `cd app && node --test tests/concept-feed.test.mjs` exits 0, or `45-TSC-AUDIT.md` contains a `Plan 45-02 Task 3 follow-up` row with an exact failing file path from the new Node ESM failure.
  </acceptance_criteria>
  <done>The direct `concept-feed.service.ts` import failure is closed locally or narrowed to a documented follow-up file without masking the test.</done>
</task>

</tasks>

<verification>
Run the per-task commands, then:

```bash
cd app && npx tsc -b --noEmit --pretty false
cd app && npm run lint -- --report-unused-disable-directives
```
</verification>

<success_criteria>
Known stale strictness/test blockers are fixed or narrowed with documented evidence, and no source assertion is weakened away from its canonical behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/45-code-quality-sweep/45-02-test-lint-strictness-SUMMARY.md`.
</output>
