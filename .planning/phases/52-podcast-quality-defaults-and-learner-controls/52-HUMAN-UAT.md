---
status: partial
phase: 52-podcast-quality-defaults-and-learner-controls
source: [52-VERIFICATION.md, 52-UAT.md]
started: 2026-05-20T03:45:00Z
updated: 2026-05-20T03:45:00Z
---

## Current Test

[awaiting human testing on device]

## Context

Code-level verification is 5/5 PASS — all five UAT gaps (GAP-1..GAP-5) are closed
and confirmed against the codebase, with automated tests green (podcast 74/74,
provider-key 7/7, locale parity green, tsc clean). The items below are the
subjective / device-only checks that cannot be unit-tested. Two of them
(Tests 1 + 2 here) re-confirm the original UAT blockers that GAP-4 just fixed.

## Tests

### 1. Playback works on a freshly generated podcast (re-confirm GAP-4)
expected: Generate a podcast (any Length × Style). Tap play — the progress bar advances, a duration shows, and audio is audible. This was the Test 3 blocker in the original UAT; GAP-4's select-on-generate + reconciled isDirty hash should close it.
result: pending

### 2. Playback-rate cycle audibly changes speed (re-confirm Test 6)
expected: While a podcast plays, the speed button cycles 1x → 1.5x → 2x → 1x and the audio speed changes audibly each tap with no pitch distortion. Was unverifiable in the original UAT because playback was dead. Test on iOS + Android WebView.
result: pending

### 3. Player vs empty-state never both render (re-confirm GAP-3)
expected: With no podcast generated today but an older podcast in history, the screen shows the generate prompt + chips (reach old podcasts via History) — NOT the stale player and "No podcast for today" simultaneously.
result: pending

### 4. Collapsible config panel — default collapsed + position (GAP-2)
expected: The Length × Style config section is collapsed by default, sits BELOW the player / "No podcast yet" panel and ABOVE the Knowledge Today panel, and expands/collapses on tap (chevron affordance).
result: pending

### 5. 3-length chip labels fit on a narrow phone in zh / es / ja (GAP-1)
expected: With Brief removed (Standard / Deep / Extended) and "Review Drill" renamed to "Review", chip labels fit within the chips without wrapping in all four locales on a narrow phone.
result: pending

### 6. API key survives provider switch and switch-back (interactive, GAP-5)
expected: Enter an API key for provider A, switch to provider B (A's key is remembered, B shows its own/empty), switch back to A — A's key is restored without reconfiguration. TTS provider key behavior unchanged.
result: pending

### 7. tts-1-hd audio quality on device (PODCAST-05, original manual item)
expected: Switch TTS model to tts-1-hd, generate a podcast on iOS + Android, compare to tts-1 baseline. Confirm acceptable quality; append findings to 52-VERIFICATION.md.
result: pending

## Summary

total: 7
passed: 0
pending: 7
