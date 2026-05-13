---
phase: 45-code-quality-sweep
plan: 03
type: execute
wave: 3
depends_on:
  - 45-02
files_modified:
  - .planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md
  - .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
  - .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
  - .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
autonomous: true
requirements:
  - TECHDEBT-09
  - TECHDEBT-11
  - TECHDEBT-12
must_haves:
  truths:
    - "Removed-feature residue is checked against the Phase 38/42/43 deleted surfaces."
    - "TODO/suppression triage has final close/defer/justified statuses."
    - "Operator-note bugs are either closed as superseded, folded into perf, or documented as absent from disk."
  artifacts:
    - path: ".planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md"
      provides: "TECHDEBT-09 dead-code and removed-feature residue evidence"
      contains: "Orphan Export Inventory"
    - path: ".planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md"
      provides: "TECHDEBT-11 final TODO/suppression dispositions"
      contains: "Final Disposition"
    - path: ".planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md"
      provides: "TECHDEBT-12 final note/debug dispositions"
      contains: "Final Disposition"
  key_links:
    - from: ".planning/phases/38-v1-4-carry-over-cleanup/38-02-youtube-short-removal-SUMMARY.md"
      to: ".planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md"
      via: "YouTube short residue negative checks"
      pattern: "probePortrait"
    - from: ".planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md"
      to: ".planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md"
      via: "Force-New-Day/debug supersession check"
      pattern: "43-15-force-new-day-dedup"
---

<objective>
Finish the mechanical dead-code, suppression, TODO, and operator-note sweep after correctness fixes land.

Purpose: Close TECHDEBT-09, TECHDEBT-11, and the non-performance parts of TECHDEBT-12 without broad aesthetic refactors.
Output: `45-DEAD-CODE-SWEEP.md` plus finalized triage/operator artifacts.
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
@.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
@.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
@.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-02-youtube-short-removal-SUMMARY.md
@.planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md
@.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
@AGENTS.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Record dead-code and removed-feature residue sweep</name>
  <files>.planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md
    .planning/phases/45-code-quality-sweep/45-CONTEXT.md
    .planning/phases/45-code-quality-sweep/45-RESEARCH.md
    .planning/phases/38-v1-4-carry-over-cleanup/38-02-youtube-short-removal-SUMMARY.md
    .planning/phases/42-masonry-feed-layout/42-PHASE-SUMMARY.md
    .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
    app/src/services/concept-feed.service.ts
    app/src/components/InfoFlow.tsx
    app/src/screens/HomeScreen.tsx
    app/src/components/MasonryFeed.tsx
    app/src/locales/en.json
    app/src/locales/zh.json
    app/src/locales/es.json
    app/src/locales/ja.json
  </read_first>
  <action>
    Create `.planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md` with sections `# Phase 45 Dead-Code Sweep`, `## Commands`, `## Removed Feature Residue`, `## Orphan Export Inventory`, `## Unreachable Helper Inventory`, `## Stale I18n Key Inventory`, `## Compatibility Residue Preserved`, and `## Final Disposition`.

    Run and record these commands and exit codes:

    ```bash
    rg -n "sourceType: 'short'|presentationStyle: 'short'|probePortrait|trellis_short_posts|infoFlow.shortTag" app/src app/tests
    rg -n "home.toast.noMorePosts|card-slide-in|infoFlow.newsTag" app/src app/tests app/src/locales
    rg -n "InlineInfoFlow" app/src/screens/HomeScreen.tsx app/src/components app/tests
    rg -n "export (async function|function|const|class|interface|type|enum) [A-Za-z0-9_]+" app/src
    rg -n "^(const|function) [A-Za-z0-9_]+|const [A-Za-z0-9_]+ = (async )?\\(" app/src
    rg -n "\"[A-Za-z0-9_.-]+\"\\s*:" app/src/locales/en.json app/src/locales/zh.json app/src/locales/es.json app/src/locales/ja.json
    rg -n "t\\(['\"][A-Za-z0-9_.-]+['\"]\\)|i18nKey=['\"][A-Za-z0-9_.-]+['\"]" app/src app/tests
    cd app && npm run lint
    cd app && npx tsc -b --noEmit --pretty false
    cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs tests/screens/HomeScreen.no-more-posts-toast.test.mjs tests/lib/no-card-slide-in.test.mjs tests/components/InfoFlow.no-presentation-style-tag.test.mjs
    ```

    In `## Removed Feature Residue`, include one row each for `short post classifier`, `trellis_short_posts`, `home.toast.noMorePosts`, `card-slide-in`, `infoFlow.newsTag`, and `InlineInfoFlow live HomeScreen wiring`. Use status `absent`, `historical-comment-only`, or `needs-fix`.

    Add a short disposition legend before the inventory tables listing all disposition labels used by this task.

    In `## Orphan Export Inventory`, inventory exported symbols from the `rg -n "export ..."` command. For each candidate that looks unused, run a targeted source-reading check of the exact symbol name across both runtime and tests:

    ```bash
    rg -n "\\bSYMBOL_NAME\\b" app/src app/tests
    ```

    Give every candidate one of these dispositions: `used-by-runtime`, `used-by-tests-contract`, `public-compatibility-export-preserved`, `true-orphan-removed`, or `deferred-needs-domain-review`. Remove an export only when the targeted `rg` evidence shows no runtime use, no test-contract use, and no compatibility reason from `CLAUDE.md` or `45-CONTEXT.md` D-09. When removing a true orphan export, delete the smallest safe surface: remove the export keyword if the helper is locally used, or delete the declaration/import if it has zero references.

    In `## Unreachable Helper Inventory`, use the helper command plus `npm run lint` and `npx tsc -b --noEmit --pretty false` as the primary evidence for unused locals/imports. For each suspected helper or import, run a targeted `rg -n "\\bHELPER_NAME\\b" app/src app/tests` check before editing. Give every row one of these dispositions: `reachable-runtime-path`, `used-by-tests-contract`, `true-unreachable-removed`, or `deferred-needs-domain-review`. Remove only true unreachable helpers/imports; do not inline or reshape reachable helpers for aesthetics.

    In `## Stale I18n Key Inventory`, compare locale keys across `en`, `zh`, `es`, and `ja`, then compare keys against source/test usage from `t('...')` and `i18nKey="..."` evidence. Give every key one of these dispositions: `used-by-runtime`, `locale-parity-key-preserved`, `true-stale-key-removed`, or `deferred-needs-domain-review`. Remove only keys that are present in all locale bundles but have no runtime/test usage and are not documented compatibility residue. If a key is removed from one locale, remove the same key from all four locale files and run the relevant i18n/source-reading tests if present.

    In `## Compatibility Residue Preserved`, explicitly preserve these strings unless a later requirement says otherwise: `EchoLearn on-disk path`, `SQLite connection name 'echolearn'`, and legacy localStorage migration behavior. Cite `CLAUDE.md` brand history and `45-CONTEXT.md` D-09.

    If any row is `needs-fix`, `true-orphan-removed`, `true-unreachable-removed`, or `true-stale-key-removed`, delete only the live code/import/key residue for that row, run the matching source-reading test from the command list plus `cd app && npx tsc -b --noEmit --pretty false`, and document the exact deleted file path in `## Final Disposition`. Keep scope conservative per D-07/D-09: remove true orphan exports/imports/helpers/residue only, avoid aesthetic refactors, and preserve EchoLearn compatibility.
  </action>
  <verify>
    <automated>test -f .planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md &amp;&amp; rg -n "short post classifier|trellis_short_posts|home.toast.noMorePosts|card-slide-in|infoFlow.newsTag|InlineInfoFlow live HomeScreen wiring|Orphan Export Inventory|Unreachable Helper Inventory|Stale I18n Key Inventory|true-orphan-removed|true-unreachable-removed|true-stale-key-removed|EchoLearn on-disk path|SQLite connection name 'echolearn'|Final Disposition" .planning/phases/45-code-quality-sweep/45-DEAD-CODE-SWEEP.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-DEAD-CODE-SWEEP.md` contains all six residue row labels from the action text.
    - Every residue row in `45-DEAD-CODE-SWEEP.md` contains one of these exact statuses: `absent`, `historical-comment-only`, or `needs-fix`.
    - `45-DEAD-CODE-SWEEP.md` contains the sections `Orphan Export Inventory`, `Unreachable Helper Inventory`, and `Stale I18n Key Inventory`.
    - Every orphan export row in `45-DEAD-CODE-SWEEP.md` uses one of these exact dispositions: `used-by-runtime`, `used-by-tests-contract`, `public-compatibility-export-preserved`, `true-orphan-removed`, or `deferred-needs-domain-review`.
    - Every unreachable helper/import row in `45-DEAD-CODE-SWEEP.md` uses one of these exact dispositions: `reachable-runtime-path`, `used-by-tests-contract`, `true-unreachable-removed`, or `deferred-needs-domain-review`.
    - Every stale i18n row in `45-DEAD-CODE-SWEEP.md` uses one of these exact dispositions: `used-by-runtime`, `locale-parity-key-preserved`, `true-stale-key-removed`, or `deferred-needs-domain-review`.
    - `45-DEAD-CODE-SWEEP.md` contains `EchoLearn on-disk path`, `SQLite connection name 'echolearn'`, and `legacy localStorage migration behavior`.
    - `45-DEAD-CODE-SWEEP.md` contains the exact command `cd app && npm run lint`.
    - `45-DEAD-CODE-SWEEP.md` contains the exact command `cd app && npx tsc -b --noEmit --pretty false`.
  </acceptance_criteria>
  <done>TECHDEBT-09 has explicit orphan-export, unused-import/helper, stale-i18n, and removed-feature residue evidence; true dead code is removed conservatively or deferred with rationale.</done>
</task>

<task type="auto">
  <name>Task 2: Finalize suppression and TODO dispositions</name>
  <files>.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md, .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md
    .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md
    app/src/main.tsx
    app/src/services/settings.service.ts
    app/src/providers/llm/index.ts
    app/src/components/trellis/TrellisLeaf.tsx
    app/src/components/InfoFlow.tsx
    app/src/components/MasonryFeed.tsx
    app/src/screens/PostDetailScreen.tsx
    app/src/screens/ConnectionPostScreen.tsx
    app/src/screens/PodcastScreen.tsx
    app/src/screens/AskScreen.tsx
    app/src/screens/HomeScreen.tsx
    app/src/state/useDailyRefresh.ts
  </read_first>
  <action>
    Update `.planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md` so every inventory row has both a D-14 `Classification` and a separate `Final Disposition`. The `Final Disposition` value must use exactly one of these labels: `closed-in-phase-45`, `deferred-v1.6`, `in-scope-v1.5-closed`, `justified-permanent-guard`, `not-a-todo`, or `future-work-note`.

    For the known explicit-`any` sites, use these concrete dispositions unless the source has changed:

    - `app/src/main.tsx` `bindI18nLeaf(i18n.t.bind(i18n) as any, ...)` -> `justified-permanent-guard` with reason `i18next t overload bridge`.
    - `app/src/services/settings.service.ts` `(result as any)[key]` -> classification `narrowable local typing issue`; use Final Disposition `in-scope-v1.5-closed` if a local typed helper avoids `any` without changing merge behavior, otherwise use Final Disposition `deferred-v1.6` with a rationale. Do not put `narrowable local typing issue` in the Final Disposition column.
    - `app/src/providers/llm/index.ts` JSON parse/extract `any` -> `justified-permanent-guard` with reason `provider JSON payload boundary`.
    - `app/src/components/trellis/TrellisLeaf.tsx` `shakeControls` any -> `justified-permanent-guard` with reason `framer-motion control shape accepts variant objects`.

    Update `.planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md` with a `Plan 45-03 Task 2 suppression disposition` section linking back to `45-TODO-TRIAGE.md`.
  </action>
  <verify>
    <automated>rg -n "Final Disposition|closed-in-phase-45|deferred-v1.6|in-scope-v1.5-closed|justified-permanent-guard|not-a-todo|future-work-note|i18next t overload bridge|provider JSON payload boundary|framer-motion control shape" .planning/phases/45-code-quality-sweep/45-TODO-TRIAGE.md &amp;&amp; rg -n "Plan 45-03 Task 2 suppression disposition" .planning/phases/45-code-quality-sweep/45-TSC-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-TODO-TRIAGE.md` contains the exact header `Final Disposition`.
    - `45-TODO-TRIAGE.md` contains `i18next t overload bridge`, `provider JSON payload boundary`, and `framer-motion control shape`.
    - `45-TODO-TRIAGE.md` contains no literal `TBD`.
    - `45-TSC-AUDIT.md` contains `Plan 45-03 Task 2 suppression disposition`.
  </acceptance_criteria>
  <done>TECHDEBT-11 has final dispositions for TODO-like comments and suppressions.</done>
</task>

<task type="auto">
  <name>Task 3: Finalize operator-note supersession decisions</name>
  <files>.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md</files>
  <read_first>
    .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md
    .planning/notes/2026-05-08-fix-youtube-landscape-video.md
    .planning/notes/2026-05-09-graphscreen-drag-lag-android.md
    .planning/debug/feed-not-auto-populating-after-force-new-day.md
    .planning/debug/vine-chip-not-clearing-after-force-new-day.md
    .planning/phases/38-v1-4-carry-over-cleanup/38-02-youtube-short-removal-SUMMARY.md
    .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
    app/tests/services/youtube-no-short-classification.test.mjs
    app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs
    app/tests/screens/HomeScreen.engagement-resync.test.mjs
  </read_first>
  <action>
    Update `.planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md` so every row has a `Final Disposition` value:

    - YouTube landscape note -> `closed` with evidence `node --test tests/services/youtube-no-short-classification.test.mjs`.
    - GraphScreen drag-lag note -> `carried-to-45-PERF-AUDIT` with evidence `45-PERF-AUDIT.md`.
    - `feed-not-auto-populating-after-force-new-day.md` -> `superseded-by-43-15` if `HomeScreen.force-new-day-dedup.test.mjs` passes; otherwise `reopen-needed`.
    - `vine-chip-not-clearing-after-force-new-day.md` -> `superseded-by-43-06` if `HomeScreen.engagement-resync.test.mjs` passes; otherwise `reopen-needed`.
    - missing `dismiss-not-propagating-to-same-anchor-tiles.md` and `duplicate-post-keys-after-force-new-day.md` -> `not-present-on-disk`.

    Run these targeted tests and record pass/fail status:

    ```bash
    cd app && node --test tests/services/youtube-no-short-classification.test.mjs tests/screens/HomeScreen.force-new-day-dedup.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs
    ```
  </action>
  <verify>
    <automated>rg -n "closed|carried-to-45-PERF-AUDIT|superseded-by-43-15|superseded-by-43-06|not-present-on-disk|youtube-no-short-classification.test.mjs|HomeScreen.force-new-day-dedup.test.mjs|HomeScreen.engagement-resync.test.mjs" .planning/phases/45-code-quality-sweep/45-OPERATOR-NOTES.md</automated>
  </verify>
  <acceptance_criteria>
    - `45-OPERATOR-NOTES.md` contains `Final Disposition`.
    - `45-OPERATOR-NOTES.md` contains `closed`, `carried-to-45-PERF-AUDIT`, `superseded-by-43-15`, `superseded-by-43-06`, and `not-present-on-disk`.
    - `45-OPERATOR-NOTES.md` contains the targeted test command from the action text.
    - `45-OPERATOR-NOTES.md` contains no literal `TBD`.
  </acceptance_criteria>
  <done>TECHDEBT-12 is closed for all non-performance operator notes, with GraphScreen intentionally carried into the perf plan.</done>
</task>

</tasks>

<verification>
Run:

```bash
cd app && npm run lint
cd app && node --test tests/services/youtube-no-short-classification.test.mjs tests/screens/HomeScreen.force-new-day-dedup.test.mjs tests/screens/HomeScreen.engagement-resync.test.mjs
```
</verification>

<success_criteria>
Dead-code/residue findings and TODO/operator notes have concrete final dispositions, and no deferred item lacks a rationale or destination.
</success_criteria>

<output>
After completion, create `.planning/phases/45-code-quality-sweep/45-03-dead-code-operator-note-sweep-SUMMARY.md`.
</output>
