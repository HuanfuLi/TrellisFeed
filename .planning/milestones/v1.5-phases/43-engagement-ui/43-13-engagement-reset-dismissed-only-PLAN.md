---
phase: 43-engagement-ui
plan: 13
plan_id: 43-13
slug: engagement-reset-dismissed-only
type: execute
wave: 4
depends_on: []
files_modified:
  - app/src/services/engagement.service.ts
  - app/src/screens/settings/SettingsDataScreen.tsx
  - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs
  - app/tests/services/engagement.service.reset-dismissed-only.test.mjs
autonomous: true
gap_closure: true
parallel_safe: true
estimated_commits: 3-4
requirements: [ENGAGE-02, ENGAGE-03]
must_haves:
  truths:
    - "Force-New-Day resets ONLY the dismissed list — saved + liked archives are persistent across days"
    - "engagementService.resetDismissedOnly() exists, mutates state.dismissed = [] (and ONLY that array), emits ENGAGEMENT_CHANGED with kind: 'undismiss' + id: '*'"
    - "engagementService.reset() unchanged — still wipes all three lists for Clear-All-Data + settingsService.reset() callers"
    - "SettingsDataScreen.handleForceNewDay calls resetDismissedOnly() instead of reset()"
    - "SC-6 test renamed to track resetDismissedOnly() with negative-invariant guarding against regression to reset()"
    - "New source-reading test against engagement.service.ts proves resetDismissedOnly only touches dismissed"
  artifacts:
    - path: "app/src/services/engagement.service.ts"
      provides: "New resetDismissedOnly() method coexisting with reset(); idempotent early-return when dismissed.length === 0; emits ENGAGEMENT_CHANGED { kind: 'undismiss', id: '*' }"
    - path: "app/src/screens/settings/SettingsDataScreen.tsx"
      provides: "handleForceNewDay calls engagementService.resetDismissedOnly() instead of reset(); inline comment rewritten to reflect persistent-archives semantics"
    - path: "app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs"
      provides: "SC-6 tests 2/3/4 updated to track resetDismissedOnly(); new negative-invariant test guards against regression to reset()"
    - path: "app/tests/services/engagement.service.reset-dismissed-only.test.mjs"
      provides: "Source-reading test proving resetDismissedOnly() exists in engagement.service.ts, mutates state.dismissed (not saved/liked), and emits ENGAGEMENT_CHANGED with kind 'undismiss'"
  key_links:
    - from: "app/src/screens/settings/SettingsDataScreen.tsx handleForceNewDay"
      to: "app/src/services/engagement.service.ts resetDismissedOnly()"
      via: "function call inside handleForceNewDay body"
      pattern: "engagementService\\.resetDismissedOnly\\(\\)"
---

<objective>
Gap-closure plan for UAT Test 9 (severity: major).

Root cause (from `.planning/debug/force-new-day-wipes-saved-liked.md`): Phase 43-07 wired the wholesale `engagementService.reset()` (Phase 39 D-08 — wipes saved + liked + dismissed) into `SettingsDataScreen.handleForceNewDay`. Operator design intent (clarified during UAT): Force-New-Day should reset ONLY the dismissed list so previously-hidden tiles return tomorrow, while saved + liked are persistent user archives. Phase 43 SUMMARY's "Deferred Polish" list already names the needed fix: `resetDismissedOnly()` partial-reset API. This gap promotes that polish to a load-bearing requirement for correct UX.

Fix:
1. Add `engagementService.resetDismissedOnly()` to `engagement.service.ts`. Idempotent (early-return when `dismissed.length === 0`). Mutates ONLY `state.dismissed`. Emits `ENGAGEMENT_CHANGED` with `kind: 'undismiss'` and sentinel `id: '*'` so HomeScreen Effect B re-reads `getDismissedAnchorIds()` and dismissed tiles reappear.
2. Update `SettingsDataScreen.handleForceNewDay` to call `resetDismissedOnly()` instead of `reset()`. Rewrite the inline comment at lines 135-137 to reflect persistent-archives semantics.
3. Update the SC-6 test: rename `engagementService.reset()` → `engagementService.resetDismissedOnly()` in tests 2/3/4. Add a negative-invariant test asserting `engagementService.reset()` does NOT appear in `handleForceNewDay`'s body.
4. Add a new source-reading test against `engagement.service.ts` asserting `resetDismissedOnly()` exists, mutates `state.dismissed = []`, does NOT touch `state.saved` or `state.liked`, and emits `ENGAGEMENT_CHANGED` with `kind: 'undismiss'`.
5. Keep `reset()` method unchanged — still needed for Clear-All-Data and `settingsService.reset()` (production wipe).

Purpose: Restore the operator-intended persistence model — saved + liked are user archives across days; only dismissed is dev-affordance-resettable.
Output: 4-file change set; 3-4 atomic commits.

**Parallel-safety note:** This plan touches engagement.service.ts (additive method), SettingsDataScreen.tsx (one-line call swap + comment rewrite), the existing SC-6 test, and a new service-level test. No other plan in this wave touches these files. Fully parallel-safe.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/43-engagement-ui/43-UAT.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md
@.planning/debug/force-new-day-wipes-saved-liked.md

# CLAUDE.md (event-bus rules, source-reading test discipline)
@CLAUDE.md

# Source-of-truth files
@app/src/services/engagement.service.ts
@app/src/screens/settings/SettingsDataScreen.tsx
@app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs

<interfaces>
From app/src/services/engagement.service.ts (current API surface, Phase 39):
- savePost(postId) / removeSavedPost(postId) / isSaved(postId) / getSavedPostIds() / getSavedPosts()
- likePost(postId) / unlikePost(postId) / isLiked(postId) / getLikedPostIds() / getLikedPosts()
- dismissAnchor(anchorId) / undismissAnchor(anchorId) / isDismissed(anchorId) / getDismissedAnchorIds()
- getPinnedIds(): Set<string> — used by postHistoryService.purgeExpired
- reset(): void — wholesale wipe via saveState(freshState()); emits NOTHING (Phase 39 D-08)

Event-bus invariants (engagement.service.ts header lines 14-23, D-05 + D-06):
- Engagement events use kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss' (string-typed in ENGAGEMENT_CHANGED payload)
- ANCHOR_DISMISSED is a separate event for the walker; resetDismissedOnly() must NOT emit ANCHOR_DISMISSED (it's the inverse direction)
- undismissAnchor (lines 170-176) already uses `{ kind: 'undismiss', id: anchorId }` — resetDismissedOnly piggybacks on the same kind with sentinel id '*' (bulk signal)

From app/src/screens/settings/SettingsDataScreen.tsx (current handleForceNewDay, lines 77-145):
- Line 134: dailyReadService.reset()
- Lines 135-137: comment block (rewrite target)
- Line 138: engagementService.reset()  ← target to swap
- Line 139: success toast
- Line 140: navigate('/home')

From app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs (current, 64 lines):
- Test 1: import assertion — unchanged
- Test 2: 'engagementService.reset() called inside handleForceNewDay' — RENAME to resetDismissedOnly
- Test 3: 'engagementService.reset() ordering' — RENAME target + indexOf substring + assertion message
- Test 4: 'engagementService.reset() called exactly once' — RENAME target

Source-reading test pattern (from existing SC-6 file lines 1-64): regex + indexOf against the live source, function-body scoping anchored on `const handleForceNewDay` declaration through the next `  };` closing brace, no jsdom.

The HomeScreen ENGAGEMENT_CHANGED subscriber (Phase 43-06 Effect B) is keyed off `[location.pathname]` — it re-reads `engagementService.getDismissedAnchorIds()` on every transition into /home AND on every ENGAGEMENT_CHANGED event. The new `{ kind: 'undismiss', id: '*' }` emit therefore correctly causes Effect B to refresh dismissed-anchor tiles in the feed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add resetDismissedOnly() method to engagement.service.ts</name>
  <files>app/src/services/engagement.service.ts</files>
  <read_first>
    - app/src/services/engagement.service.ts (full file — locate reset() at lines 207-209 and undismissAnchor() at lines 170-176 for pattern reference)
    - .planning/debug/force-new-day-wipes-saved-liked.md "Resolution" section for the operator-confirmed method shape
    - .planning/phases/43-engagement-ui/43-PHASE-SUMMARY.md "Deferred Polish" section — `resetDismissedOnly()` partial-reset API was already named
  </read_first>
  <action>
    Single additive edit to app/src/services/engagement.service.ts.

    Add a new method `resetDismissedOnly()` IMMEDIATELY AFTER `reset()` (around lines 207-209). Place inside the `// ─── Test/dev affordance (D-08) ───` section so both reset variants live together.

    Insert after the existing `reset()`:

    ```ts
      /**
       * Wipe ONLY the dismissed-anchor list (saved + liked are user archives —
       * persist across days per operator intent confirmed during Phase 43 UAT).
       * Phase 43 (gap-closure 43-13) wires this into Force-New-Day in
       * SettingsDataScreen so the dev affordance produces the intended
       * "previously-hidden tiles return tomorrow" UX without nuking the user's
       * saved/liked archives.
       *
       * Idempotent: no-op + no event when dismissed.length === 0.
       *
       * Emits EXACTLY ONE ENGAGEMENT_CHANGED with kind: 'undismiss' and sentinel
       * id: '*' to signal "bulk reset" to subscribers. HomeScreen Effect B
       * (Phase 43-06 dual-effect canonical shape) re-reads
       * getDismissedAnchorIds() on this emit and refills dismissed-anchor tiles
       * in the feed.
       *
       * `reset()` (above) stays as the wholesale wipe for Clear-All-Data /
       * settingsService.reset() — that path still wants saved + liked cleared.
       */
      resetDismissedOnly(): void {
        const state = loadState();
        if (state.dismissed.length === 0) return; // idempotent — no-op + no event
        state.dismissed = [];
        saveState(state);
        eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: '*' } });
      },
    ```

    Key details:
    - Place INSIDE the exported `engagementService` object (between `reset()` and the closing `};` of the export const).
    - Use the SAME indentation as adjacent methods (2 spaces).
    - DO NOT modify `reset()`. DO NOT modify `undismissAnchor`. DO NOT modify any other method.
    - DO NOT add new event types — reuse `ENGAGEMENT_CHANGED` with existing `kind: 'undismiss'` (matches the per-id undismissAnchor emit).
    - The sentinel `id: '*'` is a string literal chosen so HomeScreen subscribers can detect "bulk reset" if they want to differentiate (current consumers re-read `getDismissedAnchorIds()` regardless of id payload, so the sentinel is forward-compatible without breaking existing consumers).
    - DO NOT emit `ANCHOR_DISMISSED` (that event is per-id from `dismissAnchor`; the reverse direction uses `ENGAGEMENT_CHANGED` per D-06 anti-wire invariant).

    Atomic commit message: feat(43-13): add engagementService.resetDismissedOnly() partial-reset API
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "resetDismissedOnly(): void" src/services/engagement.service.ts && grep -q "kind: 'undismiss', id: '\*'" src/services/engagement.service.ts && grep -q "reset(): void" src/services/engagement.service.ts && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep "resetDismissedOnly" in engagement.service.ts returns at least 1 (the method declaration)
    - grep "kind: 'undismiss', id: '*'" returns 1 (sentinel emit)
    - grep "reset(): void" still returns 1 (original wholesale reset preserved)
    - grep -c "dismissed = \[\]" in engagement.service.ts returns at least 1 (the mutation)
    - cd app && npx tsc -b --noEmit exits 0
    - cd app && npm run build exits 0
  </acceptance_criteria>
  <done>resetDismissedOnly() available as a non-destructive partial-reset for dev-affordance callers.</done>
</task>

<task type="auto">
  <name>Task 2: Swap reset() → resetDismissedOnly() in SettingsDataScreen.handleForceNewDay + rewrite comment</name>
  <files>app/src/screens/settings/SettingsDataScreen.tsx</files>
  <read_first>
    - app/src/screens/settings/SettingsDataScreen.tsx lines 130-145 (current handleForceNewDay reset + toast region)
    - .planning/debug/force-new-day-wipes-saved-liked.md "Resolution" step 2 — operator-confirmed comment text
  </read_first>
  <action>
    Single edit at lines 135-138 of app/src/screens/settings/SettingsDataScreen.tsx.

    REPLACE the existing block:

    ```ts
          dailyReadService.reset();
          // Phase 43 SC-6: also wipe engagement state (saves + likes + dismisses) so
          // Force-New-Day produces a fully cold-start cohort. Granularity per Phase 39 D-08
          // is full-reset — saves + likes + dismisses all clear in one call.
          engagementService.reset();
          toast('Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.', 'success');
    ```

    With:

    ```ts
          dailyReadService.reset();
          // Phase 43 gap-closure (43-13 / UAT Test 9): reset ONLY the dismissed-
          // anchor list so previously-hidden tiles reappear in tomorrow's feed.
          // Saved + liked are persistent user archives — they MUST survive
          // Force-New-Day per operator intent confirmed during UAT. Wholesale
          // engagementService.reset() is reserved for Clear-All-Data /
          // settingsService.reset() paths. See
          // .planning/debug/force-new-day-wipes-saved-liked.md.
          engagementService.resetDismissedOnly();
          toast('Queue + daily-posts cache rolled back; vine progress reset. Navigating to /home.', 'success');
    ```

    Key details:
    - Existing import `engagementService` at the top of the file is preserved as-is — `resetDismissedOnly()` is a new method on the same singleton, no import change needed.
    - DO NOT touch `dailyReadService.reset()` (line ~134) — that wipes vine-progress state and is correct for Force-New-Day.
    - DO NOT touch the success toast copy. The toast says "vine progress reset" which remains accurate; saying nothing about engagement is intentional (saved/liked are NOT being reset, so silence is more accurate than mentioning them).
    - DO NOT modify `reset()` callers elsewhere in the file (currently none, but verify with grep before committing — if a future Clear-All-Data path lives in this file, that one stays on `reset()`).

    Atomic commit message: fix(43-13): handleForceNewDay calls resetDismissedOnly (saved/liked persistent across days)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "engagementService.resetDismissedOnly()" src/screens/settings/SettingsDataScreen.tsx && ! grep -q "engagementService.reset()" src/screens/settings/SettingsDataScreen.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep "engagementService.resetDismissedOnly()" returns exactly 1
    - grep "engagementService.reset()" returns 0 (regression-locked — no wholesale wipe in this file post-fix)
    - Inline comment references 43-13 / UAT Test 9 + the debug file path
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>Force-New-Day now wipes ONLY dismissed; saved + liked persist across days.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Update SC-6 test to track resetDismissedOnly + add negative-invariant guard</name>
  <files>app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs</files>
  <read_first>
    - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs (current file lines 1-64)
    - app/src/screens/settings/SettingsDataScreen.tsx post-Task 2 (verify exact resetDismissedOnly call site)
    - .planning/debug/force-new-day-wipes-saved-liked.md "Resolution" step 3 — operator-confirmed test changes (5 + 6)
  </read_first>
  <action>
    Update the existing test file. Rename the assertions in tests 2/3/4 to track `resetDismissedOnly()` instead of `reset()`, and add a 5th negative-invariant test guarding against regression to wholesale wipe.

    REPLACE the existing test file body (lines 31-64) with:

    ```js
    test('SC-6: engagementService imported at module top', () => {
      assert.match(src, /import\s+\{\s*engagementService\s*\}\s+from\s+['"][^'"]*engagement\.service['"]/);
    });

    test('SC-6: engagementService.resetDismissedOnly() called inside handleForceNewDay', () => {
      const fnStart = src.indexOf('const handleForceNewDay');
      assert.ok(fnStart > 0, 'handleForceNewDay function must exist');
      const fnEnd = src.indexOf('  };', fnStart);
      assert.ok(fnEnd > fnStart, 'handleForceNewDay function body must terminate with closing brace');
      const fnBody = src.slice(fnStart, fnEnd);
      assert.match(
        fnBody,
        /engagementService\.resetDismissedOnly\(\)/,
        'engagementService.resetDismissedOnly() must be called inside handleForceNewDay (gap-closure 43-13 — saved/liked persistent across days)',
      );
    });

    test('SC-6: resetDismissedOnly() ordering — after dailyReadService.reset(), before success toast', () => {
      const fnStart = src.indexOf('const handleForceNewDay');
      const fnEnd = src.indexOf('  };', fnStart);
      const fnBody = src.slice(fnStart, fnEnd);

      const dailyResetIdx = fnBody.indexOf('dailyReadService.reset()');
      const partialResetIdx = fnBody.indexOf('engagementService.resetDismissedOnly()');
      const successToastIdx = fnBody.indexOf("toast('Queue + daily-posts");

      assert.ok(dailyResetIdx > 0, 'dailyReadService.reset() must exist in handleForceNewDay');
      assert.ok(partialResetIdx > 0, 'engagementService.resetDismissedOnly() must exist in handleForceNewDay');
      assert.ok(successToastIdx > 0, 'success toast must exist in handleForceNewDay');

      assert.ok(partialResetIdx > dailyResetIdx, 'engagementService.resetDismissedOnly() must come AFTER dailyReadService.reset()');
      assert.ok(partialResetIdx < successToastIdx, 'engagementService.resetDismissedOnly() must come BEFORE the success toast');
    });

    test('SC-6: resetDismissedOnly() called exactly once (no duplicate accumulation)', () => {
      const calls = (src.match(/engagementService\.resetDismissedOnly\(\)/g) || []).length;
      assert.strictEqual(calls, 1);
    });

    test('SC-6: engagementService.reset() does NOT appear in handleForceNewDay body (43-13 negative invariant)', () => {
      // Gap-closure 43-13 negative invariant: regression guard against re-introducing
      // the wholesale wipe inside Force-New-Day. reset() is reserved for
      // Clear-All-Data and settingsService.reset() — those paths still legitimately
      // want saved + liked wiped. handleForceNewDay must NEVER call reset() again.
      const fnStart = src.indexOf('const handleForceNewDay');
      assert.ok(fnStart > 0, 'handleForceNewDay must exist');
      const fnEnd = src.indexOf('  };', fnStart);
      assert.ok(fnEnd > fnStart, 'handleForceNewDay must terminate');
      const fnBody = src.slice(fnStart, fnEnd);
      // The body must NOT contain `engagementService.reset()` as a standalone
      // call. The substring `resetDismissedOnly()` correctly does NOT match this
      // pattern (different identifier).
      assert.doesNotMatch(
        fnBody,
        /engagementService\.reset\(\)/,
        'engagementService.reset() must NOT appear inside handleForceNewDay — it would re-introduce the wholesale wipe regression',
      );
    });
    ```

    Keep the existing top-of-file imports and file-header comment block (lines 1-29) intact, but UPDATE the file-header comment to reflect the new contract — change lines 1-18 to:

    ```js
    // Phase 43 Plan 43-07 + gap-closure 43-13 — source-reading invariants for SC-6.
    //
    // Asserts that SettingsDataScreen.handleForceNewDay wires
    // engagementService.resetDismissedOnly() into the Force-New-Day dev affordance:
    //   (a) engagementService is imported at the module top
    //   (b) the resetDismissedOnly() call lives INSIDE handleForceNewDay's body
    //   (c) ordering: dailyReadService.reset() → resetDismissedOnly() → success toast
    //   (d) the call appears exactly once (no duplicate accumulation)
    //   (e) NEGATIVE: engagementService.reset() does NOT appear in handleForceNewDay
    //       body (43-13 — regression guard against wholesale wipe)
    //
    // Saved + liked posts are persistent user archives across days per operator
    // intent confirmed during Phase 43 UAT. Wholesale reset() is reserved for
    // Clear-All-Data / settingsService.reset() paths.
    //
    // Pattern follows Phase 39/40/41/42/43-04/43-05/43-06 source-reading invariant
    // test discipline: pure regex + indexOf comparisons against the live source file,
    // no React render, no jsdom, no node_modules side effects.
    ```

    Atomic commit message: test(43-13): SC-6 tracks resetDismissedOnly + negative-invariant guarding against reset() regression
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test count is 5 (4 existing renamed + 1 new negative-invariant)
    - grep "resetDismissedOnly" in the test file returns at least 5 occurrences (4 assertions + header)
    - grep "engagementService.reset()" in the test file returns at least 1 (the negative-invariant uses the literal in its assertion message + regex)
    - cd app && node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs exits 0
  </acceptance_criteria>
  <done>SC-6 invariants tracked on resetDismissedOnly() + regression guarded against reset().</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add engagement.service.reset-dismissed-only.test.mjs source-reading test</name>
  <files>app/tests/services/engagement.service.reset-dismissed-only.test.mjs</files>
  <read_first>
    - app/src/services/engagement.service.ts post-Task 1 (verify exact method shape)
    - app/tests/services/ — list existing tests to match file-naming + pattern (engagement.service.test.mjs if it exists for pattern reference; otherwise mirror tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs)
  </read_first>
  <behavior>
    - Test 1: engagement.service.ts exports a resetDismissedOnly method on the engagementService singleton
    - Test 2: resetDismissedOnly body sets state.dismissed = [] (regex on the assignment)
    - Test 3: resetDismissedOnly body does NOT mutate state.saved or state.liked (negative regex on `state.saved =` and `state.liked =` inside the method body)
    - Test 4: resetDismissedOnly body has an idempotent early-return guard on dismissed.length === 0
    - Test 5: resetDismissedOnly emits ENGAGEMENT_CHANGED with kind: 'undismiss' and id: '*'
    - Test 6: engagement.service.ts still exports the original reset() method (regression guard — full-reset path preserved for Clear-All-Data)
  </behavior>
  <action>
    Create new file `app/tests/services/engagement.service.reset-dismissed-only.test.mjs`. If `app/tests/services/` does not exist as a directory, create it. (Check first: `ls app/tests/services/` — if empty/missing, the test runner config `cd app && node --test tests/services` from VALIDATION.md confirms the directory IS expected.)

    File contents:

    ```js
    // Phase 43 Plan 43-13 — source-reading invariants for resetDismissedOnly().
    //
    // Asserts that engagement.service.ts:
    //   (a) declares resetDismissedOnly(): void on the engagementService export
    //   (b) the method body mutates state.dismissed = [] (the dismissed array
    //       being explicitly wiped)
    //   (c) the method body does NOT touch state.saved or state.liked (the
    //       persistence-across-days invariant operator intent)
    //   (d) the method is idempotent — early-return when dismissed.length === 0
    //   (e) emits ENGAGEMENT_CHANGED with kind: 'undismiss' and sentinel id: '*'
    //   (f) the original reset() method is preserved for Clear-All-Data /
    //       settingsService.reset() paths
    //
    // Pattern: pure regex + indexOf against the live source — no React render,
    // no jsdom. Follows the Phase 39/40/41/42/43 source-reading discipline.
    //
    // See .planning/debug/force-new-day-wipes-saved-liked.md.

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/services/engagement.service.ts'), 'utf8');

    // Scope assertions to the resetDismissedOnly method body to prevent
    // cross-method false-positives. Anchor on the method declaration.
    function methodBody() {
      const start = src.indexOf('resetDismissedOnly(): void');
      assert.ok(start > 0, 'engagementService must declare resetDismissedOnly(): void');
      // Method body ends at the first standalone closing brace `},` at the
      // method's outer level. We use a generous slice and then narrow.
      const closeIdx = src.indexOf('  },', start);
      assert.ok(closeIdx > start, 'resetDismissedOnly method body must terminate');
      return src.slice(start, closeIdx + 4);
    }

    test('43-13: engagementService declares resetDismissedOnly(): void', () => {
      assert.match(src, /resetDismissedOnly\(\):\s*void/, 'engagementService must expose resetDismissedOnly(): void');
    });

    test('43-13: resetDismissedOnly mutates state.dismissed = []', () => {
      const body = methodBody();
      assert.match(
        body,
        /state\.dismissed\s*=\s*\[\]/,
        'resetDismissedOnly must explicitly set state.dismissed = []',
      );
    });

    test('43-13: resetDismissedOnly does NOT mutate state.saved or state.liked (archives persistent)', () => {
      const body = methodBody();
      assert.doesNotMatch(
        body,
        /state\.saved\s*=/,
        'resetDismissedOnly must NOT mutate state.saved (saved archive is persistent across days)',
      );
      assert.doesNotMatch(
        body,
        /state\.liked\s*=/,
        'resetDismissedOnly must NOT mutate state.liked (liked archive is persistent across days)',
      );
    });

    test('43-13: resetDismissedOnly is idempotent (early-return when dismissed.length === 0)', () => {
      const body = methodBody();
      assert.match(
        body,
        /state\.dismissed\.length\s*===\s*0/,
        'resetDismissedOnly must check `state.dismissed.length === 0` for idempotence',
      );
      // The early-return must precede the mutation to actually skip work.
      const guardIdx = body.search(/state\.dismissed\.length\s*===\s*0/);
      const returnIdx = body.indexOf('return', guardIdx);
      const mutationIdx = body.search(/state\.dismissed\s*=\s*\[\]/);
      assert.ok(
        returnIdx > guardIdx && returnIdx < mutationIdx,
        'early-return must occur AFTER the length check and BEFORE the mutation',
      );
    });

    test('43-13: resetDismissedOnly emits ENGAGEMENT_CHANGED with kind: undismiss + id: *', () => {
      const body = methodBody();
      assert.match(
        body,
        /eventBus\.emit\(\s*\{[\s\S]*type:\s*['"]ENGAGEMENT_CHANGED['"]/,
        'resetDismissedOnly must emit an ENGAGEMENT_CHANGED event',
      );
      assert.match(
        body,
        /kind:\s*['"]undismiss['"]/,
        'emit payload must use kind: undismiss (same kind as per-id undismissAnchor)',
      );
      assert.match(
        body,
        /id:\s*['"]\*['"]/,
        'emit payload must use sentinel id: "*" to signal bulk reset to subscribers',
      );
    });

    test('43-13: engagementService.reset() (wholesale wipe) is preserved for Clear-All-Data paths', () => {
      // Regression guard — Clear-All-Data + settingsService.reset() still need
      // the wholesale reset() method. It must NOT be deleted alongside the
      // partial-reset introduction.
      assert.match(
        src,
        /\breset\(\):\s*void/,
        'engagementService.reset(): void must be preserved as the wholesale wipe for Clear-All-Data callers',
      );
      assert.match(
        src,
        /saveState\(freshState\(\)\)/,
        'reset() body must still call saveState(freshState()) — wholesale wipe shape preserved',
      );
    });
    ```

    NOTE: if `app/tests/services/` does not yet exist as a directory, the executor must create it (`mkdir -p app/tests/services`) before writing the test file. The VALIDATION.md test command `cd app && node --test tests/services tests/components tests/screens tests/state tests/locales tests/layout` confirms `tests/services` is an expected directory.

    Atomic commit message: test(43-13): source-reading invariants for engagementService.resetDismissedOnly
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/services/engagement.service.reset-dismissed-only.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists at app/tests/services/engagement.service.reset-dismissed-only.test.mjs
    - Test count is at least 6
    - cd app && node --test tests/services/engagement.service.reset-dismissed-only.test.mjs exits 0
    - cd app && node --test tests/services tests/screens exits 0 (no regression elsewhere)
  </acceptance_criteria>
  <done>Service-level invariants locked: partial-reset shape + persistence-of-archives + reset() preservation.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/services tests/screens tests/components tests/state tests/locales tests/layout exits 0
- cd app && npm run build exits 0
- Manual UAT (post-merge):
  - Save and Like several posts; dismiss several anchors
  - Settings → Data → Force New Day
  - Navigate to /saved — Saved tab still lists previously-saved posts; Liked tab still lists previously-liked posts (both archives intact)
  - Return to /home — previously-dismissed anchors reappear in feed (dismissed list cleared)
  - Corner-icon overlays on still-saved / still-liked tiles remain visible (state preserved per the chip backdrop fix from 43-10)
</verification>

<success_criteria>
- engagementService.resetDismissedOnly() exists and mutates only state.dismissed
- engagementService.reset() preserved for Clear-All-Data callers
- SettingsDataScreen.handleForceNewDay calls resetDismissedOnly() instead of reset()
- SC-6 test renamed to track resetDismissedOnly() with negative-invariant against reset() regression
- New source-reading test asserts resetDismissedOnly shape + persistence-of-archives + reset() preservation
- Total 4 atomic commits (service method, settings call swap, SC-6 test update, new service test)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-13-engagement-reset-dismissed-only-SUMMARY.md documenting:
- engagement.service.ts line range where resetDismissedOnly() was inserted (relative to existing reset())
- SettingsDataScreen.tsx line range of the call swap (resetDismissedOnly replaces reset)
- Confirmation: comment block at lines 135-137 rewritten to reflect persistent-archives semantics
- SC-6 test new structure (4 renamed assertions + 1 negative-invariant)
- New service test file path + test count
- 4 atomic commit hashes
- Phase 43 UAT Test 9 status: design gap resolved (saved/liked persistent; dismissed reset)
</output>
