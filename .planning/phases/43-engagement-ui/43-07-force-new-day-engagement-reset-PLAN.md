---
phase: 43-engagement-ui
plan: 07
type: execute
wave: 2
depends_on: [43-01]
files_modified:
  - app/src/screens/settings/SettingsDataScreen.tsx
  - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs
autonomous: true
requirements: [ENGAGE-02]
must_haves:
  truths:
    - "SettingsDataScreen.handleForceNewDay calls engagementService.reset() inside its try block"
    - "The reset() call is placed AFTER dailyReadService.reset() and BEFORE the success toast"
    - "Source-reading invariant test enforces ordering"
  artifacts:
    - path: "app/src/screens/settings/SettingsDataScreen.tsx"
      provides: "handleForceNewDay extended to also wipe engagement state (saves + likes + dismisses) per Phase 39 D-08"
    - path: "app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs"
      provides: "Source-reading invariant: engagementService.reset() lives inside handleForceNewDay function scope and is ordered after dailyRead.reset() and before the success toast"
  key_links:
    - from: "app/src/screens/settings/SettingsDataScreen.tsx"
      to: "app/src/services/engagement.service.ts"
      via: "engagementService.reset() call inside handleForceNewDay"
      pattern: "engagementService\\.reset\\(\\)"
---

<objective>
Wave-2 plan covering ONE narrow operator-locked deliverable: SC-6 wiring (ENGAGE-02 reset path).

`handleForceNewDay` in SettingsDataScreen must call `engagementService.reset()` alongside the existing `dailyReadService.reset()` so the dev affordance for testing cold-start UX wipes saves + likes + dismisses (Phase 39 D-08 — full reset granularity is locked; no partial resetDismissedOnly API).

**Scope note:** DS-01 descope doc edits (ROADMAP.md SC-4 strike + REQUIREMENTS.md ENGAGE-04 move) were originally drafted into this plan as Tasks 3 and 4, but the plan-checker revision 2026-05-11 folded them into 43-01 Task 5 (Wave 0) so Wave-1 executors (43-02..43-05) read consistent ROADMAP/REQUIREMENTS state during their own work. This plan is now SettingsDataScreen-only.

Purpose: Wave-2 plan; parallel-safe with 43-06 (different file surfaces).
Output: SettingsDataScreen.tsx 2-line addition (import + reset call), 1 test file filled in.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-RESEARCH.md
@.planning/phases/43-engagement-ui/43-01-SUMMARY.md

# Reference implementations to read first
@app/src/screens/settings/SettingsDataScreen.tsx
@app/src/services/engagement.service.ts
@app/src/services/daily-read.service.ts

<interfaces>
From app/src/services/engagement.service.ts (Phase 39 D-08 — DO NOT TOUCH):
- engagementService.reset(): clears savedPostIds + likedPostIds + dismissedAnchorIds in one call. Emits ENGAGEMENT_CHANGED per Phase 39 spec — verify exact emit shape during implementation.

From app/src/screens/settings/SettingsDataScreen.tsx (existing handleForceNewDay structure — lines 77-140):
- 1) Roll back post-queue date (lines ~80-95)
- 2) Roll back daily-posts cache date (lines ~95-130)
- 3) dailyReadService.reset() at line ~133 — INSERT engagementService.reset() AFTER this
- 4) toast success
- 5) navigate('/home')
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add engagementService.reset() to handleForceNewDay in SettingsDataScreen.tsx</name>
  <files>app/src/screens/settings/SettingsDataScreen.tsx</files>
  <read_first>
    - app/src/screens/settings/SettingsDataScreen.tsx (read lines 1-50 for existing imports + lines 70-145 for handleForceNewDay full body — verify the dailyReadService.reset() callsite at ~line 133)
    - app/src/services/engagement.service.ts (verify engagementService.reset() exists with void return)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (Carried-Forward Decisions: engagementService.reset() clears all three collections per Phase 39 D-08. Force-New-Day wipes saves + likes + dismisses in one call. Granularity stays as-spec'd — no resetDismissedOnly() in Phase 43)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 9 lines 373-398 — insertion point + ordering: after dailyReadService.reset, before toast)
  </read_first>
  <action>
    Two narrow edits to app/src/screens/settings/SettingsDataScreen.tsx:

    Edit 1 — Add the engagementService import alongside the existing service imports near the top of the file:
    `import { engagementService } from '../../services/engagement.service';`

    Use the SAME relative path style as adjacent imports. Verify `../../services/` is correct for this file's depth (settings/ is a subdirectory of screens/, so 2 levels up to src/, then into services).

    Edit 2 — Inside handleForceNewDay (around line 133), add `engagementService.reset()` AFTER `dailyReadService.reset()` and BEFORE the toast call. Match the existing indentation. Recommended comment:

    ```
    dailyReadService.reset();
    // Phase 43 SC-6: also wipe engagement state (saves + likes + dismisses) so
    // Force-New-Day produces a fully cold-start cohort. Granularity per Phase 39 D-08
    // is full-reset — saves + likes + dismisses all clear in one call.
    engagementService.reset();
    toast('Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.', 'success');
    ```

    Do NOT modify any other line. Do NOT add a localStorage mutation step — engagementService.reset() handles storage clearing internally per Phase 39 D-08.

    Optional refinement (executor discretion): if the existing toast copy "vine progress reset" feels misleading given engagement is also wiped, the executor MAY extend the copy. Keep it minimal unless operator pushes back during UAT — keep this OUT of the test scope.

    Atomic commit message: feat(43): handleForceNewDay also calls engagementService.reset() (Phase 39 D-08 full granularity)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "import { engagementService" src/screens/settings/SettingsDataScreen.tsx && grep -q "engagementService.reset()" src/screens/settings/SettingsDataScreen.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "import { engagementService" app/src/screens/settings/SettingsDataScreen.tsx returns 1
    - grep -c "engagementService.reset()" app/src/screens/settings/SettingsDataScreen.tsx returns 1
    - engagementService.reset() appears AFTER dailyReadService.reset() AND BEFORE the success toast in source order
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>Force-New-Day wipes saves + likes + dismisses alongside vine progress; SC-6 closed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill assertions in tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs scaffold</name>
  <files>app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs</files>
  <read_first>
    - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs (43-01 Task 4 scaffold)
    - app/src/screens/settings/SettingsDataScreen.tsx (post-Task 1 — verify exact reset() call site)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 55 — expected assertions)
  </read_first>
  <action>
    Replace scaffold with real source-reading assertions. Use this structure:

    ```
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/screens/settings/SettingsDataScreen.tsx'), 'utf8');

    test('SC-6: engagementService imported at module top', () => {
      assert.match(src, /import\s+\{\s*engagementService\s*\}\s+from\s+['"][^'"]*engagement\.service['"]/);
    });

    test('SC-6: engagementService.reset() called inside handleForceNewDay', () => {
      const fnStart = src.indexOf('const handleForceNewDay');
      assert.ok(fnStart > 0, 'handleForceNewDay function must exist');
      const fnEnd = src.indexOf('  };', fnStart);
      assert.ok(fnEnd > fnStart, 'handleForceNewDay function body must terminate with closing brace');
      const fnBody = src.slice(fnStart, fnEnd);
      assert.match(fnBody, /engagementService\.reset\(\)/, 'engagementService.reset() must be called inside handleForceNewDay');
    });

    test('SC-6: engagementService.reset() ordering — after dailyReadService.reset(), before success toast', () => {
      const fnStart = src.indexOf('const handleForceNewDay');
      const fnEnd = src.indexOf('  };', fnStart);
      const fnBody = src.slice(fnStart, fnEnd);

      const dailyResetIdx = fnBody.indexOf('dailyReadService.reset()');
      const engagementResetIdx = fnBody.indexOf('engagementService.reset()');
      const successToastIdx = fnBody.indexOf("toast('Queue + daily-posts");

      assert.ok(dailyResetIdx > 0, 'dailyReadService.reset() must exist in handleForceNewDay');
      assert.ok(engagementResetIdx > 0, 'engagementService.reset() must exist in handleForceNewDay');
      assert.ok(successToastIdx > 0, 'success toast must exist in handleForceNewDay');

      assert.ok(engagementResetIdx > dailyResetIdx, 'engagementService.reset() must come AFTER dailyReadService.reset()');
      assert.ok(engagementResetIdx < successToastIdx, 'engagementService.reset() must come BEFORE the success toast');
    });

    test('SC-6: engagementService.reset() called exactly once (no duplicate accumulation)', () => {
      const calls = (src.match(/engagementService\.reset\(\)/g) || []).length;
      assert.strictEqual(calls, 1);
    });
    ```

    Atomic commit message: test(43): fill engagementService.reset() ordering + presence assertions
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 4
    - cd app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs exits 0
  </acceptance_criteria>
  <done>SC-6 source-reading invariant locked.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs exits 0
- DS-01 doc state already correct from 43-01 Task 5 (Wave 0); no doc edits in this plan
</verification>

<success_criteria>
- handleForceNewDay wipes engagement state alongside vine progress
- Source-reading invariant test enforces ordering: dailyReadService.reset → engagementService.reset → success toast
- 2 atomic commits (SettingsDataScreen source, test fill-in)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-07-SUMMARY.md documenting:
- Line numbers of the 2 SettingsDataScreen.tsx edits (import + reset call)
- Confirmation: engagementService.reset() ordering verified (after daily, before toast)
- 2 atomic commit hashes
- Note: DS-01 doc edits live in 43-01-SUMMARY.md (folded into Wave 0 per revision 2026-05-11)
</output>
