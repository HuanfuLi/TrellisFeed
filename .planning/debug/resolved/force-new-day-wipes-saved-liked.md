---
status: resolved
trigger: "force-new-day-wipes-saved-liked"
created: 2026-05-11T10:06:55Z
updated: 2026-05-11T13:40:00Z
---

## Current Focus

hypothesis: Phase 43-07 wired the full-reset engagementService.reset() (D-08 wholesale wipe) into handleForceNewDay, which clears saved + liked + dismissed — but the operator's design intent is that Force-New-Day reset ONLY the dismissed list so previously-hidden tiles return tomorrow, while saved + liked archives persist across days.
test: Read engagement.service.ts reset() implementation + SettingsDataScreen.handleForceNewDay call site + existing SC-6 source-reading test.
expecting: Confirmation that (1) reset() writes freshState() = { saved: [], liked: [], dismissed: [] }, (2) handleForceNewDay calls reset() unconditionally, (3) no resetDismissedOnly() exists yet.
next_action: Diagnose-only mode — return root cause + fix direction; do not implement.

## Symptoms

expected: |
  Force-New-Day resets ONLY the dismissed-anchors list. Saved + Liked persist as cross-day archives. After Force-New-Day: /saved Saved tab still lists saved posts, /saved Liked tab still lists liked posts, but previously-dismissed anchors reappear in HomeScreen feed.
actual: |
  Phase 43-07 implementation: SettingsDataScreen.handleForceNewDay calls engagementService.reset() which wipes saved + liked + dismissed via saveState(freshState()).
errors: None — functional behavior matches current implementation; the implementation is the design issue.
reproduction: |
  Settings → Data → Force New Day → /saved → both Saved and Liked tabs empty.
started: 2026-05-11 (Phase 43-07).

## Eliminated

(none — root cause confirmed on first pass)

## Evidence

- timestamp: 2026-05-11T10:06:55Z
  checked: app/src/services/engagement.service.ts:207-209
  found: |
    reset() implementation is:
      reset(): void {
        saveState(freshState());
      },
    where freshState() returns { saved: [], liked: [], dismissed: [] }.
    Per the file header comment (line 22): "reset(): emits NOTHING (D-08 — wholesale wipe, UI consumers should re-read)."
  implication: reset() is intentionally a wholesale wipe with no per-collection granularity. No resetDismissedOnly() method exists.

- timestamp: 2026-05-11T10:06:55Z
  checked: app/src/screens/settings/SettingsDataScreen.tsx:135-138
  found: |
    handleForceNewDay calls engagementService.reset() unconditionally on line 138, after dailyReadService.reset() (line 134) and before the success toast (line 139). Inline comment at line 135-137:
      // Phase 43 SC-6: also wipe engagement state (saves + likes + dismisses) so
      // Force-New-Day produces a fully cold-start cohort. Granularity per Phase 39 D-08
      // is full-reset — saves + likes + dismisses all clear in one call.
  implication: Phase 43-07 deliberately chose full-reset because D-08 didn't provide a partial-reset API. The comment acknowledges the granularity coupling — the fix is to add resetDismissedOnly() and switch the call site.

- timestamp: 2026-05-11T10:06:55Z
  checked: app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs
  found: |
    SC-6 source-reading test asserts:
      (1) engagementService imported
      (2) engagementService.reset() called inside handleForceNewDay
      (3) ordering: dailyReadService.reset() → engagementService.reset() → success toast
      (4) reset() called exactly once
    All four assertions are pinned to the OLD reset() name and must be updated to track resetDismissedOnly().
  implication: Test must be updated alongside the code; otherwise switching to resetDismissedOnly() will fail test (2)+(3)+(4).

- timestamp: 2026-05-11T10:06:55Z
  checked: app/src/services/engagement.service.ts header (lines 22-24) + reset() doc (lines 200-206)
  found: |
    File header rules:
      - "reset(): emits NOTHING (D-08 — wholesale wipe, UI consumers should re-read)."
    The full-reset reset() needs to stay for "Clear All Data" / settingsService.reset() / production wipes that DO want everything gone. Only Force-New-Day (a dev affordance) wants the partial wipe.
  implication: Add resetDismissedOnly() alongside reset(); do NOT modify reset() semantics. Two methods coexist; callers pick.

## Resolution

root_cause: |
  Phase 43-07 wired engagementService.reset() into SettingsDataScreen.handleForceNewDay (line 138) because Phase 39 D-08 only defined a wholesale full-reset API. reset() writes freshState() = { saved: [], liked: [], dismissed: [] } — wiping all three lists. This satisfies the dismissed-list reset (correct UX requirement) but also nukes saved + liked posts (incorrect — they should persist cross-day as user archives per operator intent).

  The design mismatch is not a defect in either piece in isolation — it is in the coupling: Force-New-Day needs a per-collection-granular reset that didn't exist in the engagement service surface area when Phase 43-07 landed. Phase 43 SUMMARY's "Deferred Polish" list already names the fix: resetDismissedOnly() partial-reset API.

fix: |
  Three-part change (all in Phase 43 follow-up plan):

  1. app/src/services/engagement.service.ts — add resetDismissedOnly():
     ```ts
     resetDismissedOnly(): void {
       const state = loadState();
       if (state.dismissed.length === 0) return; // idempotent — no-op + no event
       state.dismissed = [];
       saveState(state);
       eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: '*' } });
     }
     ```
     Wipes ONLY the dismissed array. Leaves saved + liked untouched.
     Emits ENGAGEMENT_CHANGED so HomeScreen Effect B re-reads getDismissedAnchorIds() and dismissed tiles reappear (the `kind: 'undismiss'` event already exists per line 175 of the service; the `id: '*'` sentinel signals "bulk reset" to subscribers that care to differentiate).
     reset() stays as-is for Clear-All-Data / settingsService.reset() (production wipe).

  2. app/src/screens/settings/SettingsDataScreen.tsx line 138 — change:
       engagementService.reset();
     to:
       engagementService.resetDismissedOnly();
     Update inline comment (lines 135-137) to explain the rationale:
       // Phase 43 follow-up: reset ONLY the dismissed list so previously-hidden
       // tiles reappear in tomorrow's feed. Saved + liked are user archives —
       // persist across days. See .planning/debug/force-new-day-wipes-saved-liked.md.

  3. app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs — rename throughout:
     - Test 2: regex `/engagementService\.resetDismissedOnly\(\)/`
     - Test 3: same indexOf substring + ordering assertion
     - Test 4: same count guard on the new method name
     - Add a 5th test asserting the OLD method `engagementService.reset()` does NOT appear in handleForceNewDay's body (a NEGATIVE invariant guarding against regression to wholesale wipe).
     - Add a 6th source-reading test against app/src/services/engagement.service.ts asserting that resetDismissedOnly() exists, wipes ONLY state.dismissed (regex on the body), and does NOT touch state.saved or state.liked.

verification: |
  diagnose-only mode — no fix applied yet. Verification will run after the follow-up plan implements the three changes.

files_changed: []
