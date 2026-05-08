---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 08
subsystem: ui
tags: [youtube, iframe-api, postmessage, video, shorts, concept-explored, event-bus]

# Dependency graph
requires:
  - phase: 36-06
    provides: GAP-A cold-start warm-start guard (parallel Wave 1 plan; orthogonal file)
  - phase: 36-07
    provides: GAP-B walker termination guard (parallel Wave 1 plan; orthogonal file)
  - phase: 36-03
    provides: persistent derivedList + lazy-skip walker (consumed by Detector D / short tap emit downstream)
provides:
  - "Detector D YouTube IFrame API postMessage listener for full-length video posts in PostDetailScreen"
  - "InfoFlow short tap-to-play CONCEPT_EXPLORED emit (closes complete blind-spot for short posts)"
  - "enablejsapi=1 query param on YouTubeEmbed.tsx + InfoFlow.tsx video iframe + short iframe (3 sites)"
  - "Source-reading regression tests: PostDetailScreen.video-detector.test.mjs (6) + InfoFlow.short-tap-emit.test.mjs (4)"
  - "CLAUDE.md Video & short post completion signals load-bearing rule section (Detector inventory + 5 rules)"
  - "36-UAT-RETEST.md Test 3 (GAP-C) + optional Test 2 (GAP-B) recipes"
affects: [phase-37+, walker-driven-vine-progress, future-video-presentationStyle-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "YouTube IFrame Player API postMessage listener (window 'message' event) with origin allowlist"
    - "Source-reading regression tests for inline event-emit branches (no React render harness)"
    - "Defensive try/catch wrap around signal-emit code to never break tap UX"

key-files:
  created:
    - "app/tests/screens/PostDetailScreen.video-detector.test.mjs (74 lines, 6 tests)"
    - "app/tests/components/InfoFlow.short-tap-emit.test.mjs (59 lines, 4 tests)"
  modified:
    - "app/src/components/YouTubeEmbed.tsx (+enablejsapi=1 + comment block)"
    - "app/src/components/InfoFlow.tsx (3 imports + 2 iframe srcs + short tap emit branch)"
    - "app/src/screens/PostDetailScreen.tsx (Detector D useEffect, +51 lines)"
    - "CLAUDE.md (+30 lines: new Video & short post completion signals section)"
    - ".planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md (+59 lines: Test 2 + Test 3)"

key-decisions:
  - "Detector D fires emitExplored on TWO conditions: ENDED state (info=0) OR heartbeat currentTime/duration ≥ 0.8 — covers both watch-to-completion and watch-substantially-then-leave"
  - "Origin allowlist accepts BOTH https://www.youtube.com AND https://www.youtube-nocookie.com (privacy mirror used by some Capacitor configs) — strict whitelist, no wildcards"
  - "Defensive JSON.parse + typeof guards on event.data — extensions and other postMessage emitters may push non-string or non-object payloads; silently ignore malformed messages"
  - "NO emit added at the InfoFlow video card onClick (line ~368-371) — videos route through PostDetailScreen → Detector D; double-emit at feed-tap would be redundant and confusing"
  - "Short tap-to-play emit wrapped in try/catch — signal failure must never break tap UX (the play action takes precedence)"
  - "Reused existing CONCEPT_EXPLORED event type — no new event types introduced (CLAUDE.md best-practice rule 6: one signal per semantic event)"
  - "Video posts STILL get Detector A/B/C alongside D — D is additive, not replacement; if YouTube blocks postMessage in some webview config, A/B/C still cover dwell/scroll/Q&A paths"
  - "Comment in InfoFlow short branch rephrased from 'Idempotent via dailyReadService.markExplored' to 'Idempotent via the markExplored call below' — keeps grep -c 'dailyReadService.markExplored' = 1 (test invariant)"

patterns-established:
  - "Pattern: postMessage event detector for embedded third-party iframes — origin allowlist, defensive JSON parse, typed payload narrowing, addEventListener + cleanup removeEventListener in useEffect"
  - "Pattern: implicit completion signal on user tap-to-play for short-form content (no detail screen navigation path)"
  - "Pattern: source-reading test asserts both the presence of the new code AND the preservation of related code (Detectors A/B regression-guarded inline)"

requirements-completed: [GAP-C]

# Metrics
duration: 7min
completed: 2026-05-06
---

# Phase 36 Plan 08: Video Completion Signal (GAP-C) Summary

**YouTube IFrame API postMessage Detector D for full-length video posts + short tap-to-play CONCEPT_EXPLORED emit — closes the complete blind-spot for video/short engagement signals**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-06T17:28:42Z
- **Completed:** 2026-05-06T17:35:48Z
- **Tasks:** 6
- **Files modified:** 7 (5 source + 2 docs; 2 of the 5 are new test files)

## Accomplishments
- Detector D wired in PostDetailScreen.tsx — listens for YouTube IFrame API `onStateChange info=0` (ENDED) and `infoDelivery currentTime/duration ≥ 0.8` (heartbeat) postMessage events from the embedded YouTube iframe; restricts origin to `https://www.youtube.com` + `https://www.youtube-nocookie.com`; emits CONCEPT_EXPLORED via the existing `emitExplored` helper (idempotent via `hasEmittedRef`).
- Short tap-to-play emit wired in InfoFlow.tsx — short cards have `interactive=false` so they never reach PostDetailScreen; the `setVideoPlaying(post.id)` onClick now also fires `dailyReadService.markExplored(anchorId)` + `eventBus.emit({type: 'CONCEPT_EXPLORED', payload: { anchorId } })` directly, defensively wrapped in try/catch so signal failure can never break tap UX.
- `enablejsapi=1` query param added to all 3 YouTube iframe srcs (YouTubeEmbed.tsx + InfoFlow video iframe + InfoFlow short iframe) — required to activate YouTube's postMessage protocol.
- 10 GREEN regression tests across 2 new files: 6 in PostDetailScreen.video-detector.test.mjs (Detector D structure + Detectors A/B preservation regression guard) + 4 in InfoFlow.short-tap-emit.test.mjs (markExplored exactly once, CONCEPT_EXPLORED exactly once, required imports).
- CLAUDE.md "Video & short post completion signals" load-bearing rule section added (between Concept Feed Pipeline and Header positioning), with detector inventory table + 5 rules guarding against regression.
- 36-UAT-RETEST.md gained Test 3 (GAP-C — Detector D + short tap-to-play recipes) and optional Test 2 (GAP-B manual spot-check, primary verification automated).

## Task Commits

Each task was committed atomically (all `--no-verify` per parallel-execution coordination convention used by Wave 1 plans 36-06/36-07):

1. **Task 1: enablejsapi=1 in 3 iframe srcs** — `0754b609` (feat)
2. **Task 2: Detector D postMessage listener** — `b5e17e1b` (feat)
3. **Task 3: Short tap-to-play emit** — `012d0640` (feat)
4. **Task 4: Source-reading tests (10 GREEN)** — `50d70667` (test)
5. **Task 5: CLAUDE.md docs** — `95152978` (docs)
6. **Task 6: 36-UAT-RETEST.md docs** — `b47a2dea` (docs)

## Files Created/Modified

- `app/src/components/YouTubeEmbed.tsx` — added `enablejsapi=1` to iframe src + Phase 36 GAP-C comment block (Task 1, +5/-1 lines)
- `app/src/components/InfoFlow.tsx` — 3 new imports (dailyReadService/getAnchorIdForPost, questionService, eventBus); enablejsapi=1 added to 2 iframe srcs (video + short) with Phase 36 GAP-C comment blocks; short tap-to-play onClick branch fires markExplored + eventBus.emit CONCEPT_EXPLORED inside try/catch (Tasks 1+3, +29/-3 lines net)
- `app/src/screens/PostDetailScreen.tsx` — Detector D useEffect block inserted after Detector B; deps `[post?.id, post?.sourceType, resolvedAnchorId, emitExplored]`; reuses existing `emitExplored` helper unchanged; cleanup function removes listener (Task 2, +51/-0 lines)
- `app/tests/screens/PostDetailScreen.video-detector.test.mjs` — NEW; 6 source-reading tests (Detector D comment, origin allowlist, ENDED parsing, heartbeat ≥0.8, addEventListener+removeEventListener, Detectors A/B preserved) (Task 4, 74 lines)
- `app/tests/components/InfoFlow.short-tap-emit.test.mjs` — NEW; 4 source-reading tests (Phase 36 GAP-C comment, markExplored exactly once, CONCEPT_EXPLORED exactly once, required imports) (Task 4, 59 lines)
- `CLAUDE.md` — new "Video & short post completion signals" load-bearing rule section after "When in doubt" / before "Header positioning"; Detector inventory table + Why-both-exist subsection + 5 rules (Task 5, +30/-1 lines)
- `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md` — appended Test 3 (GAP-C: Detector D walkthrough + short tap-to-play sub-recipe) and optional Test 2 (GAP-B manual spot-check); Test 1 (GAP-A from 36-06) preserved byte-for-byte (Task 6, +59/-0 lines)

## Decisions Made

- **Detector D dual-trigger** (ENDED OR ≥80% heartbeat): YouTube's IFrame API delivers ~250ms heartbeat events while the player is playing AND a single `onStateChange info=0` event when the player reaches ENDED. Using both means short-form videos that complete fast (heartbeat may not fire enough times before ENDED) AND long-form videos where the user leaves before ENDED (heartbeat catches them at ≥80%) are both covered. Single-trigger (ENDED only) would miss "watched 90% then closed app"; single-trigger (heartbeat only) would miss "watched short to ENDED" if duration is under the heartbeat granularity.
- **Origin allowlist**: BOTH `https://www.youtube.com` AND `https://www.youtube-nocookie.com` — the privacy-mirror domain used by some Capacitor configs and EU-compliant deploys. No wildcard, no `*` prefix matching — strict equality only. Untrusted iframes (ads, extension overlays, embedded sandboxes) cannot spoof CONCEPT_EXPLORED.
- **Defensive JSON parse + type guards**: the YouTube IFrame API sends JSON-encoded strings, but other extensions and emitter sources may push non-string objects or malformed payloads. Silent return on parse failure or non-object data — no console warnings (would spam from extensions).
- **Reuse `emitExplored` helper unchanged**: the existing `emitExplored` (PostDetailScreen.tsx:116-122) is already idempotent via `hasEmittedRef.current`, already calls `dailyReadService.markExplored`, and already emits the correct event shape. Detector D doesn't need its own emit logic — just call `emitExplored(resolvedAnchorId)` and let the helper handle dedup.
- **NO emit added at InfoFlow video card onClick**: full-length video posts in the feed have `interactive=true` (line 295: `interactive = !isShortPost`), so tapping the card calls `onOpen(post.id, post)` which navigates to PostDetailScreen → Detector D activates there. Adding a duplicate emit at the feed-tap point would be redundant (idempotent via hasEmittedRef would no-op the second one, but still unnecessary work) and would cause confusion when reading the code. The video iframe in the feed is the inline preview only.
- **Short tap-to-play emit must NOT break the tap**: wrapped the emit in try/catch with console.warn fallback. If `questionService.getAll` throws or `getAnchorIdForPost` blows up unexpectedly, the user can still tap-to-play and watch the video; only the signal is lost.
- **One CONCEPT_EXPLORED event type — not two**: Plan explicitly forbade introducing a new event type (e.g., `VIDEO_COMPLETED` or `SHORT_PLAYED`). The walker subscribes to a single event; multiple events would fragment the lazy-skip flow. Reused the existing `CONCEPT_EXPLORED` payload shape `{ type: 'CONCEPT_EXPLORED', payload: { anchorId } }` from PostDetailScreen line 121 verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text caused test invariant violation**
- **Found during:** Task 3 (Wire short tap-to-play emit)
- **Issue:** Plan §<action> EDIT 2 specified the comment block to include "Idempotent via dailyReadService.markExplored (no-op if already set)." This made the literal `dailyReadService.markExplored` appear TWICE in InfoFlow.tsx — once in the comment, once in the actual call. Task 4's test invariant `assert.equal(matches.length, 1, ...)` for `/dailyReadService\.markExplored/g` would FAIL with 2 matches.
- **Fix:** Rephrased the comment from "Idempotent via dailyReadService.markExplored (no-op if already set)." to "Idempotent via the markExplored call below (no-op if already set)." — preserves the comment intent while keeping the literal symbol count at 1.
- **Files modified:** app/src/components/InfoFlow.tsx (one comment line)
- **Verification:** `grep -c "dailyReadService\.markExplored" app/src/components/InfoFlow.tsx` returns 1 (down from 2). Task 4 test "fires markExplored exactly once" GREEN.
- **Committed in:** 012d0640 (Task 3 commit; the rephrase happened during Task 3 execution before commit, captured in the same atomic commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan-prescribed comment causing test invariant violation)
**Impact on plan:** Cosmetic comment-text adjustment to make test invariant satisfiable. Zero behavioral change. Plan logic intact.

## Issues Encountered

- None. The two-paragraph "Note on dependencies" + "Note on dailyReadService import" in Task 2's `<action>` correctly anticipated the existing import at line 14 — no new import was needed in PostDetailScreen.tsx.
- Pre-existing 26 test failures (`ERR_IMPORT_ATTRIBUTE_MISSING` for en.json from i18n chain) are unchanged; this plan touches no files in that chain.

## Next Phase Readiness

- Phase 36 is now 9/9 plans complete (00 RED + 01 GAP-3 + 02 GAP-4 + 03 GAP-1+GAP-2 + 04 integration + 05 GAP-6 doc-sync + 06 GAP-A + 07 GAP-B + 08 GAP-C). Branch `gsd/phase-33-hygiene-and-polish` ready for `/gsd:verify 36` final pass.
- All three Wave 2 gap-closure plans (06/07/08) shipped without conflict — disjoint files, parallel-safe.
- Future regression risk: if a future change adds a new YouTube embed entry point (e.g., a featured-video carousel), `enablejsapi=1` must be added to that iframe src too AND a corresponding detector or tap-emit added. CLAUDE.md rule 1 is the source-of-truth check via `grep -c "enablejsapi=1"` returning ≥3.
- Future enhancement candidate: heartbeat-driven progress tracking (e.g., "user watched 30% of this video — surface a follow-up question") would be enabled by the same postMessage path. Out of scope for Phase 36.

## Self-Check: PASSED

**File existence:**
- FOUND: app/src/components/YouTubeEmbed.tsx
- FOUND: app/src/components/InfoFlow.tsx
- FOUND: app/src/screens/PostDetailScreen.tsx
- FOUND: app/tests/screens/PostDetailScreen.video-detector.test.mjs
- FOUND: app/tests/components/InfoFlow.short-tap-emit.test.mjs
- FOUND: CLAUDE.md
- FOUND: .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md

**Commits:**
- FOUND: 0754b609 (Task 1)
- FOUND: b5e17e1b (Task 2)
- FOUND: 012d0640 (Task 3)
- FOUND: 50d70667 (Task 4)
- FOUND: 95152978 (Task 5)
- FOUND: b47a2dea (Task 6)

**Verification greps (from plan §<verification>):**
- enablejsapi=1 in YouTubeEmbed.tsx: 2 (≥1 required) — comment + src line
- enablejsapi=1 in InfoFlow.tsx: 4 (≥2 required) — 2 comments + 2 src lines
- Detector D in PostDetailScreen.tsx: 1 (≥1 required)
- addEventListener('message' in PostDetailScreen.tsx: 1 (≥1 required)
- removeEventListener('message' in PostDetailScreen.tsx: 1 (≥1 required)
- dailyReadService.markExplored in InfoFlow.tsx: 1 (exactly 1 required) — only in short branch
- type: 'CONCEPT_EXPLORED' in InfoFlow.tsx: 1 (exactly 1 required)
- Detector A: Scroll 70% preserved: 1
- Detector B: 30s dwell preserved: 1
- CLAUDE.md "Video & short post completion signals": 1
- CLAUDE.md byte-stable: html/body overflow=3, minWidth: 0=2, USER_ACK_BEFORE_GRAPH_CONTEXT=2, ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD=1

**Tests:**
- node --test PostDetailScreen.video-detector + InfoFlow.short-tap-emit: tests 10 / pass 10 / fail 0 GREEN
- npm test: 465 tests / 439 pass / 26 fail (Phase 36 baseline 422/26 preserved; +17 from cumulative Wave 1+2 plans, including +10 from this plan)
- npx tsc -b --noEmit: exit 0

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Plan: 08-video-completion-signal*
*Completed: 2026-05-06*
