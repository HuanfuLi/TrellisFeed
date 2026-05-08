---
phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
plan: 02
subsystem: ui, settings, feed
tags: [settings, i18n, starter-posts, feed-config]

requires:
  - phase: 27-add-i18n-l10n-support
    provides: i18n infrastructure (i18next, 4 locale bundles)
provides:
  - Feed settings UI (post retention, generation cap, bonus cap)
  - Feedback email link in Settings
  - Post History entry point in Settings
  - App-tutorial starter posts replacing learning-science content
  - i18n keys for Phase 31 feed UI across all 4 locale bundles
affects: [31-03, 31-04, home-screen, settings-screen]

tech-stack:
  added: []
  patterns: [feed settings via settingsService.set('feed', ...) with local React state mirror]

key-files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/services/settings.service.ts
    - app/src/screens/settings/SettingsDataScreen.tsx
    - app/src/services/concept-feed.service.ts
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json

key-decisions:
  - "Added feed block to AppSettings interface with postRetentionDays (number|null), dailyGenerationCapMultiplier, bonusPostCap"
  - "Simplified makeStarterPost helper — removed whyCare/takeaway/quickAskPrompts params (starter posts are app-tutorial, not learning-science)"
  - "Feed settings rows placed in Developer section of Settings > Data, between trellis dev mode and Clear All Data"

patterns-established:
  - "Feed settings pattern: local state mirror + settingsService.set('feed', ...) for immediate UI update"

requirements-completed: [D-34, D-38, D-39, D-42, D-43]

duration: 3min
completed: 2026-04-18
---

# Phase 31 Plan 02: Feed Settings UI + Starter Posts Replacement Summary

**Feed configuration controls (retention, generation cap, bonus cap, feedback email) added to Settings > Data, and starter posts replaced with app-tutorial content across all 4 locale bundles.**

## What Was Done

### Task 1: Feed Settings UI + Defaults
- Added `feed` block to `AppSettings` interface (`postRetentionDays: number | null`, `dailyGenerationCapMultiplier: number`, `bonusPostCap: number`)
- Added feed defaults to `settings.service.ts` (7 days retention, 5x generation cap, 8 bonus cap)
- Added 5 new rows to Settings > Data > Developer section:
  1. Post retention (SelectInput: 7 days / Keep all)
  2. Daily generation cap (TextInput number, min 1)
  3. Bonus post limit (TextInput number, min 1)
  4. Send Feedback (mailto link to huanfuli4408@gmail.com)
  5. Post History (navigation button to /history)
- Commit: `30be4364`

### Task 2: Starter Posts + i18n Keys
- Replaced 3 learning-science starter posts with app-tutorial content:
  1. "Welcome to EchoLearn" (Getting Started)
  2. "How your knowledge grows" (How It Works)
  3. "Explore your daily feed" (Feed Guide)
- Simplified `makeStarterPost` helper signature (6 params instead of 7)
- Added i18n keys: `home.feed.*` (8 keys), `home.history.*` (6 keys), `settings.fields.*` (6 keys), `settings.descriptions.*` (2 keys)
- Translated all new keys to zh, es, ja bundles
- Bundle parity test passes, Vite build passes
- Commit: `8924bf11`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added feed block to AppSettings interface**
- **Found during:** Task 1
- **Issue:** Plan 01 (parallel) had not yet added the `feed` block to AppSettings in types/index.ts
- **Fix:** Added the interface block directly as the plan instructed for this contingency
- **Files modified:** app/src/types/index.ts

**2. [Rule 3 - Blocking] Settings service was settings.service.ts, not settings.mock.ts**
- **Found during:** Task 1
- **Issue:** Plan referenced `settings.mock.ts` but the project uses `settings.service.ts` directly
- **Fix:** Applied defaults to the correct file `settings.service.ts`
- **Files modified:** app/src/services/settings.service.ts

## Verification

- Bundle parity test: PASSED (all 4 locales have identical key sets)
- Vite build: PASSED (3.00s)
- Starter posts: "Welcome to EchoLearn" present, "Why do you forget" removed
- Settings: postRetention, generationCap, bonusCap, mailto, navigate('/history') all present

## Known Stubs

None - all settings rows are wired to settingsService persistence and all i18n keys have translations.

## Self-Check: PASSED
