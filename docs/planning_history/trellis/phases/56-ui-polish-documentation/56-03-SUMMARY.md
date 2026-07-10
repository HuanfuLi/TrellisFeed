---
phase: 56-ui-polish-documentation
plan: 03
subsystem: ui-polish
tags: [css-animation, reduced-motion, design-tokens, i18n]

requires:
  - phase: 56-ui-polish-documentation
    plan: 02
    provides: "Operator-approved visual and animation worklist"
provides:
  - "Compositor-safe approved ambient animations"
  - "Reduced-motion coverage for approved loops"
  - "Planner token alignment and localized Force-New-Day feedback"
affects: [phase-56, android-webview, settings]

tech-stack:
  added: []
  patterns:
    - "Ambient CSS animation frames use transform/opacity rather than animated shadow paint"
    - "Developer-only user feedback still uses locale bundles"

key-files:
  created: []
  modified:
    - app/src/index.css
    - app/src/components/trellis/TrellisStatusPanel.tsx
    - app/src/screens/PlannerScreen.tsx
    - app/src/screens/settings/SettingsDataScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json

key-decisions:
  - "Remove the status-glow loop while preserving its static fruit-button shadow."
  - "Leave glow-ring, InfoFlow amber dots, Flashcard semantic colors, and CollectionPicker white-on-color values unchanged because triage did not approve them."
  - "Treat approved Force-New-Day hardcoded toast copy as part of visual/copy polish and preserve locale bundle parity."

patterns-established:
  - "Phase 56 fix plans follow 56-TRIAGE.md over broader PLAN file candidate lists."

requirements-completed: [POLISH-01, POLISH-02]

duration: 12min
completed: 2026-07-08
---

# Phase 56 Plan 03: Visual and Animation Polish Summary

**Approved animation jank, reduced-motion, color-token, and development-toast fixes are implemented without expanding into deferred visual cleanup.**

## Accomplishments

- Rewrote `glow-pulse` and `aha-pulse` to animate only transform and opacity.
- Removed the animated `status-glow` loop while retaining the existing static shadow.
- Added a `prefers-reduced-motion: reduce` block for approved ambient loops.
- Replaced Planner dead/dying row icon hex colors with `var(--primary-40)`.
- Localized all three Force-New-Day toast paths in en/zh/es/ja.

## Commits

| Task | Commit | Description |
|---|---|---|
| Animation polish | `5047350f` | Simplify approved animations and add reduced-motion coverage |
| Visual/copy polish | `60f5ef1c` | Align Planner tokens and localize development toasts |

## Scope Boundaries

- `InfoFlow.tsx`, `Flashcard.tsx`, and `CollectionPickerSheet.tsx` were not changed because their candidate findings were cut or deferred in `56-TRIAGE.md`.
- `glow-ring`, `node-pop`, and `edge-draw` keyframes remain unchanged.
- No Header ancestor, new animation, feed metadata, or pushy engagement mechanic was added.

## Verification

- `node --test tests/layout/root-horizontal-clip.test.mjs tests/components/InfoFlow.video-tap-emit.test.mjs` — PASS (8/8).
- `node --test tests/components/ChatInput.flex-shrink.test.mjs tests/components/InfoFlow.video-tap-emit.test.mjs` — PASS (6/6).
- `node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs tests/services/settings-locale.test.mjs` — PASS (9/9).
- `npx tsc -b --noEmit` — PASS.
- Source scan confirms `status-glow` is absent and approved rewritten keyframes contain no animated shadow.

## Deviations from Plan

- The plan listed several candidate files, but the operator-approved triage explicitly excluded those findings; they were intentionally left untouched.
- `SettingsDataScreen.tsx` and locale bundles were added to the implementation surface for approved finding F-V02.

## Next Phase Readiness

Ready for `56-04`: apply only approved visual-back navigation parity fixes.

## Self-Check: PASSED

Both implementation commits exist, required checks pass, and only approved findings were changed.
