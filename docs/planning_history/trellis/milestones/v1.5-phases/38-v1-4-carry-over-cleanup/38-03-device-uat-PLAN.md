---
phase: 38-v1-4-carry-over-cleanup
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md
autonomous: false
requirements: [TECHDEBT-04]

plan_notes: |
  WHY autonomous false:
    The plan creates the 38-HUMAN-UAT.md scaffold (autonomous Claude work), but the test results MUST be filled in by the operator after physical-device deployment + tapping. /gsd:verify-work 38 will block until both `result: pass` lines exist. Operator owns the device-test execution and the result lines; Claude owns the scaffold creation only.

  PARALLEL-SAFE WITH PLAN 38-02:
    The scaffold creation does NOT depend on Plan 38-02 landing first. The two Phase 33 device tests (touch-target feel + React.memo behavioral correctness) verify behaviors that exist in main BEFORE Plan 38-02 lands; Plan 38-02's YouTube changes do not invalidate either test (touch targets are PlannerScreen + ChatInput buttons; React.memo behavioral correctness covers feed render mechanics that work for video posts the same way pre-and-post 38-02).
    However, OPERATOR EXECUTION of the device tests SHOULD wait until Plan 38-02 has landed so the device APK includes the latest YouTube changes — otherwise operator might encounter visual regressions from Plan 38-02 work mid-test and confuse them with a Phase 33 regression. This is a sequencing recommendation for the operator at test time, NOT a planning-graph dependency. The plans run in parallel; operator coordinates the device-test timing.

  TEMPLATE FIDELITY:
    Per CONTEXT.md D-03: file shape mirrors `.planning/phases/37-i18n-leaf-module-refactor/37-HUMAN-UAT.md` exactly. Same frontmatter fields (status, phase, source, started, updated). Same body structure (Current Test → Tests → Summary → Gaps). Single test entry per behavior. Per D-03c: single result line per test (sub-checkpoints described in expected block, NOT split into multiple YAML entries).

  INITIAL STATUS:
    `status: pending` (NOT `complete`). `started: null`. `updated: 2026-05-09T00:00:00Z` (creation date stamp). The operator updates `started:` when device testing begins and `status: complete` when both tests have `result: pass`.

  PER-TEST OS MATRIX:
    Per CONTEXT.md D-03b: iOS + Android both required. Each test's `expected:` block names both platforms; the single `result:` line records pass/fail with optional per-platform note in the failure case. Test design assumes operator will tap through on both devices and only mark `result: pass` if BOTH platforms passed.

  DEVICE-ACCESS FALLBACK:
    If physical-device access is unavailable when /gsd:verify-work 38 runs (e.g., operator on the road, no iOS device handy, Android emulator only), marking TECHDEBT-04 as `in-progress` rather than `complete` is an acceptable scoped exception. Rationale: the device-only behaviors being verified (touch-target feel + React.memo behavioral correctness) are NOT regressions introduced by Phase 38 — they are carry-over Phase 33 deferrals. Phase 38's deliverable for TECHDEBT-04 is the SCAFFOLD itself (38-HUMAN-UAT.md with status: pending and 2 well-formed test entries). Operator may close TECHDEBT-04 to in-progress and ship Phase 38, then run the device tests at next physical-device session and update result lines + status:complete in a follow-up commit. This is the operator's call at /gsd:verify-work time — NOT a planning-time decision. (If the deferral itself becomes a perpetual carry-over, surface it for explicit re-planning rather than letting it drift indefinitely.)

must_haves:
  truths:
    - "38-HUMAN-UAT.md file exists in .planning/phases/38-v1-4-carry-over-cleanup/ with the canonical Phase 37 frontmatter shape (status, phase, source, started, updated)."
    - "File contains exactly 2 test entries (Test 1: touch-target feel; Test 2: React.memo behavioral correctness) with verbatim test specs from 33-VERIFICATION.md human_verification section."
    - "Each test has a single result: field (pending/pass/fail) — sub-checkpoints documented in expected: block per D-03c."
    - "Each test's expected: block explicitly references both iOS + Android per D-03b."
    - "File is created with status: pending (operator-fillable; /gsd:verify-work 38 blocks until status: complete + 2x result: pass)."
    - "File registers correctly with gsd-tools uat machinery (mirrors Phase 37's structure that gsd-tools recognized for /gsd:verify-work 37)."
  artifacts:
    - path: ".planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md"
      provides: "Human-UAT scaffold for the 2 deferred Phase 33 device tests; operator-fillable result lines"
      contains: "33-HUMAN-UAT-1"
      min_lines: 30
  key_links:
    - from: ".planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md"
      to: "/gsd:verify-work 38"
      via: "Filename pattern matches gsd-tools UAT discovery (38-HUMAN-UAT.md in phase dir)"
      pattern: "38-HUMAN-UAT.md"
    - from: "38-HUMAN-UAT.md test specs"
      to: ".planning/milestones/v1.4-phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md human_verification section"
      via: "Verbatim copy of test + expected fields"
      pattern: "33-HUMAN-UAT"
---

<objective>
Create the device-UAT scaffold for the 2 Phase 33 deferrals (touch-target feel + React.memo behavioral correctness) so /gsd:verify-work 38 has a structured input for operator-driven verification (TECHDEBT-04). The scaffold mirrors Phase 37's `37-HUMAN-UAT.md` shape exactly. Test specs are verbatim from `33-VERIFICATION.md`. OS matrix is iOS + Android both per CONTEXT.md D-03b.

Purpose: TECHDEBT-04's two Phase 33 deferrals were carried explicitly to v1.5 because device-only QA cannot be automated (touch hit-area "feel" and React.memo behavioral correctness under real Capacitor WebView rendering). The scaffold ensures the verification gate has the right shape; operator owns execution.

Output: One file (`38-HUMAN-UAT.md`) with `status: pending`, 2 test entries, ready for operator to fill in `result:` lines after physical-device testing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-RESEARCH.md
@.planning/phases/38-v1-4-carry-over-cleanup/38-VALIDATION.md
@.planning/phases/37-i18n-leaf-module-refactor/37-HUMAN-UAT.md
@.planning/milestones/v1.4-phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create 38-HUMAN-UAT.md scaffold (mirrors Phase 37 shape; status: pending; 2 test entries from 33-VERIFICATION.md)</name>
  <files>.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md</files>
  <read_first>
    1. `.planning/phases/37-i18n-leaf-module-refactor/37-HUMAN-UAT.md` — full file. This is the canonical shape template (mandated by CONTEXT.md D-03 and reaffirmed by RESEARCH.md INV-4). Read it before writing the new file.
    2. `.planning/milestones/v1.4-phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md` — find the `human_verification:` section (typically in the frontmatter, may be lines 8-14 area). Extract the verbatim `test:` and `expected:` and `why_human:` strings for both 33-HUMAN-UAT-1 (touch-target feel) and 33-HUMAN-UAT-2 (React.memo behavioral correctness).
    3. RESEARCH.md § INV-4 — confirms the 2 test specs and the canonical 38-HUMAN-UAT.md shape.
    4. CONTEXT.md D-03 (file location, OS matrix, granularity).
    5. CLAUDE.md "Project Overview" section — to understand where PlannerScreen, ChatInput, mic/globe buttons, VineProgress live (so the operator knows what to look at on device).
  </read_first>
  <action>
    Create the file `.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` with the following EXACT content (write to disk verbatim):

    ```markdown
    ---
    status: pending
    phase: 38-v1-4-carry-over-cleanup
    source: [33-VERIFICATION.md, 38-CONTEXT.md]
    started: null
    updated: 2026-05-09T00:00:00Z
    ---

    ## Current Test

    [pending operator start]

    ## Tests

    ### 1. Touch-target feel on iOS + Android (33-HUMAN-UAT-1 carry-over)

    test: "On-device APK smoke-test for cosmetic touch-target changes from Phase 33 (PlannerScreen refresh button + ChatInput mic + ChatInput globe button at 44x44 hit area; AskScreen bottom-nav clearance unaffected by ChatInput height increase ~10px)"

    expected: |
      Deploy current main APK to BOTH iOS and Android devices.

      iOS test sequence (Capacitor iOS WebView):
      1. Boot app, navigate Planner tab.
      2. Tap the refresh button in the PlannerScreen header. Expect: button registers tap reliably; hit area feels comfortable (not cramped); no missed taps across 5 attempts.
      3. Navigate Ask tab. Open ChatInput.
      4. Tap the mic button (left side of input row). Expect: 44x44 hit area registers reliably; no missed taps across 5 attempts.
      5. Tap the globe button (web-search toggle, also left side). Expect: same — 44x44 reliable taps.
      6. Confirm AskScreen bottom-nav clearance: the BottomNavigation bar is fully visible BELOW the ChatInput; ChatInput height increase from Phase 33 (~10px) does not push BottomNavigation off-screen or cause overlap.

      Android test sequence (Capacitor Android Chromium WebView):
      Identical sequence to iOS. Pay extra attention to:
      - Android's slightly different touch-event timing (some buttons that "feel fine" on iOS may feel laggy on Android Chromium WebView).
      - The mic + globe buttons specifically — Phase 33's UAT-3 commit `47d81049` bumped them 34→44px and the operator should re-confirm the bump still feels right on a real Android device.

      Pass criteria: ALL buttons register reliably (no missed taps in any 5-tap sequence) on BOTH iOS AND Android. Comfort feel is operator-judged; mark fail if either platform feels noticeably cramped or if the bottom-nav clearance is violated.

    why_human: "Visual + interaction quality cannot be verified from grep/tsc/jsdom; Capacitor APK deploy + physical hand testing required. Per Phase 32.1 best-practice rule 7 (no hypothesis-only device fixes) — comfort assessments are operator-only."

    result: pending

    ### 2. React.memo behavioral correctness on iOS + Android (33-HUMAN-UAT-2 carry-over)

    test: "Perf memoization behavioral correctness on live feed — Phase 33's React.memo + custom equality comparator changes verified under real Capacitor WebView rendering (NOT jsdom)"

    expected: |
      Deploy current main APK (post Plan 38-02 if YouTube changes have landed; sequencing recommendation only — see plan_notes).

      Test sequence (run on BOTH iOS and Android):

      Sub-checkpoint 1 — 8-card initial render:
      - Boot app to Home (cold start). Wait for feed to populate.
      - Confirm: the feed renders 8 cards correctly. No missing cards, no blank slots, no layout collapse.
      - Confirm: each card's content (title, hook, image/video/text-art) is visible and not stuck on a placeholder.

      Sub-checkpoint 2 — Swipe-for-more pops 4 new posts:
      - Scroll to the bottom of the visible 8 cards.
      - Trigger swipe-for-more (long pull at bottom).
      - Confirm: 4 new posts appear (not 1, not 8). The queue serves exactly 4 per swipe-for-more event per CLAUDE.md "Concept Feed Generation Pipeline" section.
      - Repeat 2-3 times to confirm consistency.

      Sub-checkpoint 3 — Image-gen toggle still respected for NEW card mounts:
      - Navigate Settings → AI → toggle the image-generation provider OFF (e.g., disable Nano Banana / Gemini).
      - Return to Home. Trigger another swipe-for-more.
      - Confirm: NEW cards mounted after the toggle change render WITHOUT generated images (text/text-art only). Existing cards from before the toggle change can keep their images.
      - Toggle image-gen back ON. Repeat swipe-for-more. Confirm new cards now have images again.

      Sub-checkpoint 4 — VineProgress spans full container width:
      - Look at the top of HomeScreen (above the feed). VineProgress chip should span the full available container width with no truncation, no overflow, no double-row wrap.
      - Pay attention on Android Chromium WebView specifically — Phase 33's React.memo wrapper around VineProgress is the most likely surface for memo-equality regression on this platform.

      Pass criteria: ALL 4 sub-checkpoints behave correctly on BOTH iOS AND Android. If any sub-checkpoint fails on either platform, mark result: fail and describe which sub-checkpoint + which OS in the failure note.

    why_human: "React.memo with custom equality comparator — correctness for animation paths, internal state changes, and queue-pop event flow requires runtime verification under real Capacitor WebView. Jsdom (used by automated tests) does not reproduce Android Chromium's render timing or memo-equality short-circuit behavior. Per Phase 32.1 best-practice rule 3 (position:fixed + overflow:auto + Android Chromium WebView is a recurring bug class) and rule 7 (no hypothesis-only device fixes), these behaviors are operator-verifiable only."

    result: pending

    ## Summary

    total: 2
    passed: 0
    issues: 0
    pending: 2
    skipped: 0
    blocked: 0

    ## Gaps

    [none yet — populated by operator if any sub-checkpoint fails]
    ```

    Then commit:
    ```
    git add .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md
    git commit -m "docs(38-03): create 38-HUMAN-UAT.md scaffold for TECHDEBT-04 device retest

    Mirrors Phase 37's 37-HUMAN-UAT.md shape (per CONTEXT.md D-03).
    2 test entries — both carry-overs from 33-VERIFICATION.md human_verification:
      Test 1 — touch-target feel (PlannerScreen refresh, ChatInput mic + globe at 44x44)
      Test 2 — React.memo behavioral correctness (8-card render, swipe-for-more pops 4,
              image-gen toggle for new mounts, VineProgress full-width)

    OS matrix per D-03b: iOS + Android both. Per D-03c: single result line per test;
    sub-checkpoints described in expected block, not split.

    status: pending — operator updates after physical-device testing.
    /gsd:verify-work 38 will block until status: complete + 2x result: pass."
    ```

    Per CONTEXT.md D-03: do NOT fill in `result:` lines. Do NOT update `status:` to anything other than `pending`. Do NOT set `started:` to a real timestamp. The operator owns those fields.

    Per Pitfall 6 in RESEARCH.md: this scaffold MUST land with `status: pending` (not `complete`); creating it as `complete` would let /gsd:verify-work 38 falsely pass without operator testing.
  </action>
  <verify>
    <automated>test -f .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md && grep -c "^status: pending$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md && grep -c "^### " .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md && grep -c "^result: pending$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` exists
    - `grep -c "^status: pending$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns 1 (initial state per Pitfall 6)
    - `grep -c "^### " .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns 2 (exactly 2 test sections)
    - `grep -c "^result: pending$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns 2 (both tests pending operator fill-in)
    - `grep -c "33-HUMAN-UAT-1" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns at least 1 (Test 1 cross-references the carry-over source)
    - `grep -c "33-HUMAN-UAT-2" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns at least 1 (Test 2 cross-references the carry-over source)
    - `grep -c "iOS" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns at least 2 (D-03b OS matrix referenced in both tests)
    - `grep -c "Android" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns at least 2 (D-03b OS matrix referenced in both tests)
    - `grep -c "Sub-checkpoint" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns at least 4 (Test 2 sub-checkpoints described in expected: block per D-03c)
    - File line count is at least 30 (substantive scaffold, not a stub)
    - Frontmatter `phase:` field equals `38-v1-4-carry-over-cleanup`
    - File committed to git: `git log --oneline -1 -- .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns 1 commit
  </acceptance_criteria>
  <done>38-HUMAN-UAT.md scaffold created at the canonical location with status: pending, 2 test entries (touch-target feel + React.memo behavioral correctness) verbatim from 33-VERIFICATION.md, OS matrix references for both tests, sub-checkpoints in expected: block per D-03c, file committed atomically.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Hand off device UAT to operator (operator runs tests on iOS + Android, fills in result lines)</name>
  <files>.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md</files>
  <what-built>
    Plan 38-03 Task 1 created `.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` with the canonical Phase 37 shape, status: pending, 2 test entries (touch-target feel + React.memo behavioral correctness), and OS matrix references for iOS + Android per CONTEXT.md D-03b.

    Plan 38-02 (YouTube short type removal) should have landed BEFORE running these device tests so the APK includes Phase 38's latest changes — see Plan 38-03 plan_notes "PARALLEL-SAFE WITH PLAN 38-02".

    All 4 sub-checkpoints of Test 2 + the touch-target sequence of Test 1 are documented in the file's `expected:` blocks.
  </what-built>
  <how-to-verify>
    OPERATOR-DRIVEN device UAT (Claude pauses, awaits results):

    Step 1 — Confirm prerequisites:
    - Plan 38-02 has landed and main test suite passes (`cd app && npm test` → ≤3 main fails, ≤2 actions fails per Phase 37 baseline).
    - Capacitor build available for both iOS and Android (`cd app && npx cap sync` recently run; iOS Xcode project + Android Studio project both buildable).

    Step 2 — Build + deploy APK to BOTH devices:
    - iOS: open ios/App/App.xcworkspace in Xcode, select the physical device, Cmd+R to build + deploy.
    - Android: `cd app && npx cap run android --target=<your-physical-device-id>` (or open in Android Studio and Run on device).

    Step 3 — Open `.planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md`. Update:
    - `started:` from `null` to the current ISO timestamp (e.g., `2026-05-10T14:30:00Z`).
    - `updated:` to the same timestamp.

    Step 4 — Run Test 1 (Touch-target feel) on iOS following the `expected:` sequence. Then on Android.
    - If both platforms pass all sub-steps: change `result: pending` → `result: pass` for Test 1.
    - If either platform fails any sub-step: change to `result: fail` and add a brief failure note (which platform, which sub-step, what observed).

    Step 5 — Run Test 2 (React.memo behavioral correctness) on iOS following the `expected:` sequence (4 sub-checkpoints). Then on Android.
    - If both platforms pass all 4 sub-checkpoints: change `result: pending` → `result: pass` for Test 2.
    - If either platform fails any sub-checkpoint: change to `result: fail` and add a brief failure note (which platform, which sub-checkpoint, what observed).

    Step 6 — Update file frontmatter:
    - If both tests resulted in `pass`: change `status: pending` → `status: complete`. Update Summary section: `passed: 2, pending: 0`.
    - If any test resulted in `fail`: keep `status: pending`. Update Summary section. Add a Gap entry under `## Gaps` describing the fail. (Failure path: a follow-up plan or `/gsd:plan-phase 38 --gaps` will address.)

    Step 7 — Commit operator updates:
    ```
    git add .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md
    git commit -m "uat(38-03): record device UAT results — iOS+Android

    Test 1 (touch-target feel): {pass/fail with note}
    Test 2 (React.memo behavioral correctness): {pass/fail with note}"
    ```

    Step 8 — Type "approved" in the resume signal (or describe issues if any test failed).
  </how-to-verify>
  <action>
    Operator-driven. The Claude executor of Plan 38-03 should pause here and surface the device UAT instructions to the operator (verbatim from the `<how-to-verify>` block above). Wait for operator to:
    1. Build + deploy APK to both iOS and Android physical devices.
    2. Run both tests on both platforms following the `expected:` blocks in `38-HUMAN-UAT.md`.
    3. Edit `38-HUMAN-UAT.md` to fill in `result: pass` (or `result: fail` with note) for both tests; update `status: pending` → `status: complete` if all pass; update Summary counts; commit.
    4. Type "approved" in the resume signal (or describe failures).

    The Claude executor does NOT modify the file in this task — only the operator does. Claude's job is to surface the instructions, wait, and verify the post-condition before declaring this task done.
  </action>
  <verify>
    <automated>grep -c "^status: complete$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md && [ "$(grep -c "^result: pass$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md)" = "2" ]</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^status: complete$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns 1 (operator marked complete after both tests passed)
    - `grep -c "^result: pass$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns exactly 2 (both tests passed on both platforms)
    - `grep -c "^result: pending$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` returns 0 (no remaining pending results)
    - The Summary section shows `passed: 2`, `pending: 0`
    - `started:` is no longer `null` (operator filled in a real ISO timestamp)
    - Operator commit landed: `git log --oneline -1 -- .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md` shows a `uat(38-03):` commit AFTER the Task 1 `docs(38-03):` scaffold-creation commit
    - FAILURE PATH: if either test was `result: fail`, this task is NOT done — surfaces a Gap entry in `## Gaps` for the operator to drive a `/gsd:plan-phase 38 --gaps` follow-up
  </acceptance_criteria>
  <done>Operator has run both tests on both iOS + Android, filled in 2x `result: pass`, marked `status: complete`, and committed the update. /gsd:verify-work 38 will now find the file in the expected post-condition state.</done>
  <resume-signal>Type "approved" if both tests pass on both platforms (status: complete + 2x result: pass landed in the file), OR describe failures if any test failed on any platform (a follow-up gap-closure plan will be needed).</resume-signal>
</task>

</tasks>

<verification>
After Task 1 lands the scaffold (Claude-side) and Task 2 completes (operator-side):

```bash
# Scaffold exists with correct shape
test -f .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md
grep -c "^### " .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md  # expect 2

# After operator fill-in (Task 2):
grep "^status: complete$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md  # expect 1 hit
grep -c "^result: pass$" .planning/phases/38-v1-4-carry-over-cleanup/38-HUMAN-UAT.md  # expect 2 hits
```

Then write `38-03-SUMMARY.md` with:
- Confirmation of file creation (Task 1)
- Operator-recorded device UAT results (Task 2 — both Test 1 and Test 2 outcomes)
- Per-platform notes if any failures
- Acknowledgment that any failures route to a follow-up `/gsd:plan-phase 38 --gaps` invocation
</verification>

<success_criteria>
- TECHDEBT-04 scaffold landed: `38-HUMAN-UAT.md` exists at the canonical location, mirrors Phase 37 shape, status: pending, 2 test entries with verbatim Phase 33 carry-over specs.
- Operator records both device tests on both iOS + Android.
- File arrives at status: complete + 2x result: pass before /gsd:verify-work 38 runs.
- 38-03-SUMMARY.md exists.
</success_criteria>

<output>
After completion, create `.planning/phases/38-v1-4-carry-over-cleanup/38-03-SUMMARY.md` with:
- Task 1: scaffold creation confirmation, commit SHA, file path
- Task 2: operator-recorded results for both tests on both platforms
- Per-platform pass/fail breakdown
- Any Gap entries surfaced by operator (and the follow-up plan recommendation if needed)
- Confirmation that the file is in the state /gsd:verify-work 38 expects (status: complete, 2x result: pass)
</output>
