---
phase: 18-feed-redesign-short-videos-text-art-posts
plan: 01
subsystem: ui
tags: [typescript, react, feed, presentation-styles, image-generation, settings]

requires:
  - phase: 17-auto-fetch-online-videos-for-posts
    provides: videoMeta, video sourceType, interleaveVideoPosts
provides:
  - PresentationStyle type system ('image' | 'text-art' | 'image-less' | 'video' | 'short')
  - assignPresentationStyles weighted random mix function
  - ImageGenerationSettings.enabled toggle
  - ConceptCard presentationStyle-aware image gating
affects: [18-02, 18-03, feed-rendering, image-generation]

tech-stack:
  added: []
  patterns:
    - "Weighted random mix via Fisher-Yates shuffle for feed presentation diversity"
    - "presentationStyle field on DailyPost controls rendering pipeline"

key-files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/services/concept-feed.service.ts
    - app/src/services/settings.service.ts
    - app/src/screens/SettingsScreen.tsx
    - app/src/components/InfoFlow.tsx

key-decisions:
  - "Non-video weights 40/33/27 (image/text-art/image-less) normalized from overall 30/25/20/25 target"
  - "When image generation disabled, redistribute to 55/45 text-art/image-less (no image API calls)"
  - "Used existing MaterialSwitch and SettingRow for toggle consistency"
  - "interleaveVideoPosts kept as deprecated function for backward compat"

patterns-established:
  - "presentationStyle on DailyPost drives rendering branch selection"
  - "settingsService.getSync().imageGeneration.enabled gates all image API calls"

requirements-completed: [MIX-01, MIX-02]

duration: 5min
completed: 2026-04-03
---

# Phase 18 Plan 01: Type Extensions & Weighted Mix Summary

**PresentationStyle type system with weighted random feed mix and image generation toggle for cost control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-03T22:55:17Z
- **Completed:** 2026-04-03T22:59:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PresentationStyle type and extended sourceType union enable new card rendering paths
- Weighted random mix assigns ~40% image, ~33% text-art, ~27% image-less to non-video posts
- Image generation toggle in Settings lets users disable API calls (redistributes to text-art/image-less)
- ConceptCard skips image generation for non-image presentationStyles, rendering immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Type extensions and weighted mix function** - `40e11cb8` (feat)
2. **Task 2: Settings toggle UI and ConceptCard imageResolved gating** - `e82fe7d8` (feat)

## Files Created/Modified
- `app/src/types/index.ts` - PresentationStyle type, extended sourceType, textArtContent/presentationStyle on DailyPost, enabled on ImageGenerationSettings
- `app/src/services/concept-feed.service.ts` - shuffleArray utility, assignPresentationStyles export, replaced interleaveVideoPosts at all call sites
- `app/src/services/settings.service.ts` - enabled: true default in imageGeneration
- `app/src/screens/SettingsScreen.tsx` - MaterialSwitch toggle for image generation
- `app/src/components/InfoFlow.tsx` - presentationStyle-aware imageResolved gating, settingsService import, extended CONCEPT_BADGE_META

## Decisions Made
- Non-video weights (0.40/0.33/0.27) normalize the overall 30/25/20/25 target excluding the video slot
- When image generation is off, image weight is 0 and redistributes to text-art (0.55) and image-less (0.45)
- Used existing MaterialSwitch component and SettingRow pattern for the toggle UI
- Kept interleaveVideoPosts as deprecated function rather than removing it outright

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan referenced non-existent settingsService.update() method**
- **Found during:** Task 2 (Settings toggle)
- **Issue:** Plan's action code used `settingsService.update(updated)` which does not exist
- **Fix:** Used `settingsService.set('imageGeneration', next)` via `saveImageGen(next)` following existing SettingsScreen pattern
- **Files modified:** app/src/screens/SettingsScreen.tsx
- **Verification:** TypeScript compiles, toggle follows same pattern as other settings
- **Committed in:** e82fe7d8

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correction for working toggle. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PresentationStyle type system in place for Plan 02 (text-art card rendering, image-less card variant)
- assignPresentationStyles feeds styled posts to InfoFlow
- Image generation toggle wired and functional

---
*Phase: 18-feed-redesign-short-videos-text-art-posts*
*Completed: 2026-04-03*
