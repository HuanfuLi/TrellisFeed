---
phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization
plan: "04"
subsystem: trellis-hero
tags: [video-background, lifecycle-guard, intersection-observer, variant-v]
dependency_graph:
  requires: [25-02]
  provides: [TrellisBackgroundV, useVideoPauseGuard, shouldPauseVideo]
  affects: [TrellisHero.tsx]
tech_stack:
  added: []
  patterns: [IntersectionObserver + visibilitychange dual guard, video poster fallback, pure decision function testing]
key_files:
  created:
    - app/src/state/useVideoPauseGuard.ts
    - app/src/components/trellis/variants/TrellisBackgroundV.tsx
    - app/tests/hooks/useVideoPauseGuard.test.mjs
  modified:
    - app/src/components/trellis/TrellisHero.tsx
decisions:
  - "Used .png poster (trellis-bg-default.png) instead of .webp since only PNG exists on disk"
  - "RefObject<HTMLVideoElement | null> for React 19 nullable ref compatibility"
  - "Pure shouldPauseVideo function exported for testable decision logic without React/DOM"
metrics:
  duration: "164s"
  completed: "2026-04-15T01:40:37Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 25 Plan 04: Variant V (Video Loop Background) Summary

Video background variant with IntersectionObserver + visibilitychange lifecycle guard for automatic pause/resume.

## What Was Built

### useVideoPauseGuard Hook
- Combined dual-guard: IntersectionObserver (off-screen detection) + document.visibilitychange (tab backgrounding)
- Pauses video when EITHER condition is true; resumes only when BOTH visible AND intersecting
- `video.play()` wrapped in `.catch()` per Pitfall 5 (iOS autoplay DOMException)
- canplay event listener for deferred playback after readyState
- Pure `shouldPauseVideo(intersectionRatio, documentHidden)` exported for unit testing

### TrellisBackgroundV Component
- `<video muted playsInline loop preload="metadata">` with WebM + MP4 sources
- `onError` fallback to poster image with gradient (graceful degradation when video assets absent)
- useVideoPauseGuard wired with `enabled` flag tied to `!videoFailed`
- Poster uses existing `trellis-bg-default.png` asset

### TrellisHero Integration
- Import + conditional render: `{variant === 'V' && <TrellisBackgroundV />}`
- Dev picker already supports 'V' from 25-02

## Hook Export Surface

| Export | Type | Purpose |
|--------|------|---------|
| `useVideoPauseGuard` | React hook | Lifecycle guard for video elements |
| `shouldPauseVideo` | Pure function | Testable decision: (ratio, hidden) -> pause/play/noop |

## Asset Presence at Execution Time

- `trellis-bg-default.png` -- EXISTS (used as poster)
- `trellis-bg-default.webp` -- ABSENT (plan referenced; used .png instead)
- `trellis-loop.mp4` -- ABSENT (video fallback path exercised)
- `trellis-loop.webm` -- ABSENT (video fallback path exercised)

Build succeeds regardless of video asset presence due to onError fallback.

## Integration Test Gaps

DOM-free `node --test` cannot exercise the full React hook (IntersectionObserver + useEffect wiring). The 4 pure-function tests verify decision logic. Full runtime behavior to be verified in 25-05 manual QA on device.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3db8ebb5 | useVideoPauseGuard hook + shouldPauseVideo tests (TDD) |
| 2 | 0fdd56d6 | TrellisBackgroundV component + TrellisHero wire-up |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Poster asset is .png not .webp**
- **Found during:** Task 2
- **Issue:** Plan referenced `trellis-bg-default.webp` but only `.png` exists on disk
- **Fix:** Used `.png` path in POSTER_URL constant
- **Files modified:** app/src/components/trellis/variants/TrellisBackgroundV.tsx

**2. [Rule 1 - Bug] React 19 RefObject nullable type**
- **Found during:** Task 2
- **Issue:** `useRef<HTMLVideoElement>(null)` produces `RefObject<HTMLVideoElement | null>` in React 19, incompatible with `RefObject<HTMLVideoElement>`
- **Fix:** Updated hook signature to accept `RefObject<HTMLVideoElement | null>`
- **Files modified:** app/src/state/useVideoPauseGuard.ts
- **Commit:** 0fdd56d6

## Known Stubs

None -- all functionality is wired. Video fallback path is intentional graceful degradation, not a stub.

## Self-Check: PASSED
