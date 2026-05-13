---
status: complete
phase: 38-v1-4-carry-over-cleanup
source: [33-VERIFICATION.md, 38-CONTEXT.md]
started: 2026-05-09T01:00:00Z
updated: 2026-05-09T01:30:00Z
---

## Current Test

[all complete]

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

result: pass

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

result: pass

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet — populated by operator if any sub-checkpoint fails]
