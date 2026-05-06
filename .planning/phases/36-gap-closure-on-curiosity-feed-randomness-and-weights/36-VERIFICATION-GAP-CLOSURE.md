---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
verification_scope: gap-closure (plans 36-06, 36-07, 36-08)
verified: 2026-05-06T18:00:00Z
status: passed
score: 14/14 must-haves verified (across 3 gap-closure plans)
re_verification: false
parent_verification: 36-VERIFICATION.md
parent_status: passed (13/13)
---

# Phase 36 Gap Closure Verification Report

**Phase Goal (gap-closure scope):** Close the 3 gaps surfaced during UAT round 1 (cold-start empty feed, style mix imbalance, video completion signal absent), without regressing the 13 must-haves from the original Phase 36 verification.

**Verified:** 2026-05-06T18:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification of the gap-closure addition (36-06, 36-07, 36-08).
**Parent report:** `36-VERIFICATION.md` (13/13 must-haves passed for the original Wave 0..05 work)

This report covers ONLY the three gap-closure plans (36-06, 36-07, 36-08). The original Phase 36 must-haves are re-confirmed at the end via Phase 33 sentinel greps + Phase 36 wiring greps.

---

## Goal Achievement

### Observable Truths — Plan 36-06 (Cold-start warm-start guard, GAP-A)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | On a cold start of a new day, the feed shows yesterday's leftover posts immediately (warm-start state from getYesterdayQueue is preserved) | VERIFIED | `HomeScreen.tsx:122` wraps `setDailyPosts(posts)` in `if (posts.length > 0)` — empty getDailyPosts() return no longer overwrites the warm-start initializer at lines 38-47 |
| 2 | The "error generating post, please check your settings" UI does NOT fire when getDailyPosts returns [] but a warm-start fallback is already on screen | VERIFIED | `HomeScreen.tsx:134` — error gate now reads `posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current`; ref captured pre-fetch at line 63 |
| 3 | When BOTH the warm-start fallback AND today's getDailyPosts are empty AND questions exist, the genuine error UI still fires | VERIFIED | Same condition at line 134 — `!warmStartHadPostsRef.current` is true when no warm-start was seeded; the original 6cda914e error-gate intent (genuinely broken API keys) is preserved |

**Score (36-06):** 3/3 truths verified

### Observable Truths — Plan 36-07 (Walker termination guard, GAP-B)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 4 | walkDerivedList(N, exploredIds) returns up to N entries regardless of len; the count argument is fully respected | VERIFIED | `post-queue.service.ts:314` — `const maxSteps = Math.max(count * 2, len)`; the buggy `len * 2` cap is gone (grep `const maxSteps = len \* 2;` returns 0) |
| 5 | Specifically: walkDerivedList(16, new Set()) on a 4-entry derivedList returns 16 entries (4 wraps × 4 = 16) | VERIFIED | `derived-list.test.mjs` Test 11 GREEN — asserts `out.length === 16` and exact ordering `[a,b,c,d]×4`; cyclePosition wraps to 0 |
| 6 | text-art count satisfies floor(N×0.55)=8 across 16 entries | VERIFIED | `refill-queue-integration.test.mjs` Test 7 GREEN — asserts `counts['text-art'] >= Math.floor(16 * STYLE_WEIGHTS['text-art'])` (= 8) on a single-anchor derivedList |
| 7 | Termination semantics preserved: returns [] when all explored, no infinite loop | VERIFIED | `derived-list.test.mjs` Test 9 (all-explored → []) + Test 12 (skip 'a' multi-wrap, no infinite loop, returns 8 non-'a' entries) — both GREEN; `Math.max(count * 2, len)` only RAISES the floor, never lowers vs. `len * 2` |

**Score (36-07):** 4/4 truths verified

### Observable Truths — Plan 36-08 (Video completion signal, GAP-C)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 8 | Video posts in PostDetailScreen fire CONCEPT_EXPLORED via YouTube postMessage detector (ENDED OR ≥80%) | VERIFIED | `PostDetailScreen.tsx:151` Detector D useEffect; line 183 parses `data.event === 'onStateChange' && data.info === 0` (ENDED); line 191 parses `info.currentTime / info.duration >= 0.8` (heartbeat threshold) |
| 9 | Short posts in feed fire CONCEPT_EXPLORED on tap-to-play | VERIFIED | `InfoFlow.tsx:441-442` — `dailyReadService.markExplored(anchorId)` + `eventBus.emit({type: 'CONCEPT_EXPLORED', payload: {anchorId}})` inside short-card onClick at line 426 |
| 10 | Idempotent (no double-fire on rapid replay) | VERIFIED | Three layers: (1) `PostDetailScreen.tsx:117` — `if (hasEmittedRef.current) return;`; (2) `PostDetailScreen.tsx:118` — `dailyReadService.isExplored` early return; (3) `InfoFlow.tsx:440` — `if (anchorId && !dailyReadService.isExplored(anchorId))` guard before emit; outer `videoPlaying !== post.id` at line 427 also blocks re-fire on rapid replay |
| 11 | Origin allowlist prevents foreign frame spoofing | VERIFIED | `PostDetailScreen.tsx:169` — `if (event.origin !== 'https://www.youtube.com' && event.origin !== 'https://www.youtube-nocookie.com') return;` |
| 12 | YouTubeEmbed iframe src includes enablejsapi=1 | VERIFIED | `YouTubeEmbed.tsx:24` — `?playsinline=1&rel=0&enablejsapi=1`; InfoFlow video iframe at `InfoFlow.tsx:344` and short iframe at `InfoFlow.tsx:467` also include `enablejsapi=1` |
| 13 | Existing Detectors A/B/C unchanged | VERIFIED | `PostDetailScreen.tsx:124` — `Detector A: Scroll 70% sentinel (IntersectionObserver)`; `PostDetailScreen.tsx:139` — `Detector B: 30s dwell timer`; both byte-stable |
| 14 | No new event types introduced (CONCEPT_EXPLORED reused) | VERIFIED | InfoFlow emits `type: 'CONCEPT_EXPLORED'` (same shape as PostDetailScreen.tsx:121); test `InfoFlow.short-tap-emit.test.mjs` Test 3 enforces exactly 1 occurrence in InfoFlow.tsx |

**Score (36-08):** 7/7 truths verified

**Combined Score:** 14/14 gap-closure truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/screens/HomeScreen.tsx` | Warm-start guard (useRef snapshot + branched setters) | VERIFIED | `useRef(dailyPosts.length > 0)` at line 63; `if (posts.length > 0)` at line 122; `!warmStartHadPostsRef.current` at line 134; comments reference Phase 36 GAP-A at lines 116, 126 |
| `app/src/services/post-queue.service.ts` | walkDerivedList termination guard `Math.max(count * 2, len)` + updated docstring | VERIFIED | Line 314 `const maxSteps = Math.max(count * 2, len)`; line 305 inline comment "Phase 36 GAP-B fix"; old `const maxSteps = len * 2;` line confirmed absent |
| `app/src/components/YouTubeEmbed.tsx` | iframe src with enablejsapi=1 | VERIFIED | Line 24 — `enablejsapi=1` confirmed in src |
| `app/src/components/InfoFlow.tsx` | Short tap-to-play emit + enablejsapi=1 in feed iframes + new imports | VERIFIED | Imports at lines 12-14; short tap branch at lines 426-449 fires markExplored + CONCEPT_EXPLORED inside `try/catch`; both feed iframes include enablejsapi=1 (lines 344 + 467) |
| `app/src/screens/PostDetailScreen.tsx` | Detector D — YouTube postMessage listener | VERIFIED | Lines 151-200 contain Detector D useEffect with origin allowlist, ENDED parse, heartbeat parse, listener cleanup; Detectors A/B byte-unchanged |
| `app/tests/screens/HomeScreen.warm-start-guard.test.mjs` | Source-reading regression test | VERIFIED | 4/4 GREEN |
| `app/tests/services/derived-list.test.mjs` | Tests 11+12 added for GAP-B | VERIFIED | 12/12 GREEN (was 10/10 in original Phase 36 verification) |
| `app/tests/services/refill-queue-integration.test.mjs` | Test 7 added for GAP-B floor invariant | VERIFIED | 7/7 GREEN (was 6/6) |
| `app/tests/screens/PostDetailScreen.video-detector.test.mjs` | Source-reading test for Detector D | VERIFIED | 6/6 GREEN |
| `app/tests/components/InfoFlow.short-tap-emit.test.mjs` | Source-reading test for short tap emit | VERIFIED | 4/4 GREEN |
| `CLAUDE.md` | Walker termination guard bullet (36-07) + "Video & short post completion signals" section (36-08) | VERIFIED | Walker bullet at line 73; "Video & short post completion signals" section header confirmed via grep; "Phase 36 GAP-B" + "Phase 36 GAP-C" annotations both present |
| `36-UAT-RETEST.md` | Three retest recipes (Test 1 GAP-A, Test 2 GAP-B optional, Test 3 GAP-C) | VERIFIED | All three sections present per the gap-closure plans' acceptance criteria |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `HomeScreen.tsx:63` (warmStartHadPostsRef declared) | `HomeScreen.tsx:134` (read in error gate) | shared useRef snapshot | WIRED | Ref captured at mount; .then handler reads it without nested setState — Strict Mode safe |
| `HomeScreen.tsx` useState initializer (lines 38-47) | `HomeScreen.tsx:122` posts setter | `if (posts.length > 0)` guard preserves warm-start when fetch returns [] | WIRED | Conditional setter present; warm-start now survives empty cold-start fetches |
| `concept-feed.service.ts:1218` (walkDerivedList(16, exploredIds)) | `post-queue.service.ts:314` (maxSteps termination) | Math.max(count * 2, len) | WIRED | Walker honors count=16 even when len=4 (no truncation); style assignment receives N=16 |
| `assignStylesStratified` (style-assignment.ts) | walkDerivedList output | conceptIds → assignments at concept-feed.service.ts | WIRED | Test 7 in refill-queue-integration.test.mjs proves text-art count >= floor(16 × 0.55) = 8 with single-anchor input |
| `YouTubeEmbed.tsx:24` (iframe src with enablejsapi=1) | `PostDetailScreen.tsx:198` (window.addEventListener('message', handleMessage)) | YouTube IFrame API postMessage protocol | WIRED | enablejsapi=1 activates the channel; Detector D listens for the messages; origin restricted to youtube.com domains |
| `InfoFlow.tsx:429` (setVideoPlaying(post.id) for short tap) | `daily-read.service.ts:markExplored` + `event-bus.ts:eventBus.emit` | Direct call inside onClick at lines 437-442 | WIRED | Resolved anchor via getAnchorIdForPost(post, byId); isExplored check guards idempotency |
| `concept-feed.service.ts:733` (Phase 33 dueAnchors filter) | exploredIds gate | `dueAnchors = anchors.filter(a => !exploredIds.has(a.id))` | WIRED | Byte-unchanged (gap closure did not touch buildConceptBatch) |
| `concept-feed.service.ts:1202` (Phase 33 allExplored cap-gate) | maxPosts gate | `allExplored && postQueueService.getTotalGenerated() >= maxPosts` | WIRED | Byte-unchanged |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| HomeScreen warm-start render | `dailyPosts` | useState initializer reads `postQueueService.getYesterdayQueue()` | Yes — yesterday's persisted posts from localStorage | FLOWING |
| walkDerivedList output | `result` array (cyclic walker) | `_state.derivedList` populated by appendToDerivedList from buildConceptBatch (live anchor questions) | Yes | FLOWING |
| Detector D anchor ID | `resolvedAnchorId` (in PostDetailScreen) | `getAnchorIdForPost(post, byId)` resolved on post load | Yes — derives from real questionService data | FLOWING |
| Short tap-to-play anchor ID | `anchorId` (computed inline in InfoFlow) | `getAnchorIdForPost(post, new Map(allQ.map(q => [q.id, q])))` from `questionService.getAll({includeFlagged: true})` | Yes — live questions store | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Warm-start guard test passes | `node --test tests/screens/HomeScreen.warm-start-guard.test.mjs` | tests=4, pass=4, fail=0 | PASS |
| Walker termination test passes (regressions Tests 11+12) | `node --test tests/services/derived-list.test.mjs` | tests=12, pass=12, fail=0 | PASS |
| Style mix integration test passes (regression Test 7) | `node --test tests/services/refill-queue-integration.test.mjs` | tests=7, pass=7, fail=0 | PASS |
| Detector D source-read test passes | `node --test tests/screens/PostDetailScreen.video-detector.test.mjs` | tests=6, pass=6, fail=0 | PASS |
| Short tap emit source-read test passes | `node --test tests/components/InfoFlow.short-tap-emit.test.mjs` | tests=4, pass=4, fail=0 | PASS |
| Original Phase 36 quick suite still GREEN | `node --test tests/services/derived-list tests/services/style-assignment-stratified tests/services/spread-by-concept tests/services/refill-queue-integration tests/services/style-assignment tests/services/post-queue tests/screens/HomeScreen.warm-start-guard tests/screens/PostDetailScreen.video-detector tests/components/InfoFlow.short-tap-emit` | tests=70, pass=70, fail=0 | PASS |
| TypeScript clean | `npx tsc -b --noEmit` | exit code 0, no output | PASS |

---

### Requirements Coverage

| GAP ID | Plan | Description | Status | Evidence |
|--------|------|-------------|--------|---------|
| GAP-A | 36-06 | Cold-start empty feed: empty getDailyPosts() overwrites warm-start state and triggers misleading error UI on every new-day cold start | CLOSED | useRef snapshot + branched setters in HomeScreen.tsx; 4/4 source-reading tests GREEN; UAT-RETEST recipe drafted |
| GAP-B | 36-07 | Walker termination guard `len * 2` silently caps walkDerivedList(16,...) at 8 for single-anchor users → text-art floor-pinned at 50% instead of design-target 56% | CLOSED | `Math.max(count * 2, len)` replacement; 12/12 derived-list + 7/7 refill-queue-integration GREEN; CLAUDE.md walker contract documented |
| GAP-C | 36-08 | Video posts have no completion signal (iframe lacks enablejsapi=1, no postMessage detector); short posts in feed never reach PostDetailScreen so detectors A/B/C never run | CLOSED | enablejsapi=1 added to YouTubeEmbed + both InfoFlow feed iframes; Detector D postMessage listener in PostDetailScreen with origin allowlist + ENDED + 80% heartbeat parsing; InfoFlow short tap-to-play emits CONCEPT_EXPLORED via dailyReadService.markExplored + eventBus; 6+4 source-reading tests GREEN; CLAUDE.md detector inventory documented |

---

### Original Phase 36 Must-Have Regression Check

The original `36-VERIFICATION.md` passed 13/13 must-haves. Sentinel greps for the most critical regression-prone invariants:

| Original Must-Have | Sentinel | Result | Status |
|--------------------|----------|--------|--------|
| Phase 33: dueAnchors explored-filter at buildConceptBatch | `grep -n "dueAnchors" app/src/services/concept-feed.service.ts` | Lines 733 + 736 present | NO REGRESSION |
| Phase 33: allExplored cap-gate at refillQueue | `grep -n "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts` | Line 1202 present | NO REGRESSION |
| Phase 36 GAP-1+2: appendToDerivedList + walkDerivedList wired into refillQueue | `grep -n "appendToDerivedList\|walkDerivedList" app/src/services/concept-feed.service.ts` | Lines 1215 + 1218 present | NO REGRESSION |
| Phase 36 GAP-4: spreadByConcept BEFORE spreadByStyle in mixer | `grep -n "spreadByConcept(combined)\|spreadByStyle(combined)" app/src/services/concept-feed.service.ts` | Lines 1389 + 1390 present, in correct order | NO REGRESSION |
| All 33 Phase 36 Wave 0..04 tests still GREEN | derived-list (now 12/12 — was 10/10), style-assignment-stratified (10/10), spread-by-concept (7/7), refill-queue-integration (now 7/7 — was 6/6) | All GREEN; gap-closure ADDS coverage (+2 derived-list + 1 refill-integration) | NO REGRESSION (additive only) |
| Original 70-test quick suite GREEN | `node --test [9 test files from prompt]` | tests=70, pass=70, fail=0 | NO REGRESSION |

All 13 original must-haves remain VERIFIED. Gap-closure additions are strictly additive — they extend existing test files (Tests 11+12 in derived-list, Test 7 in refill-queue-integration) and add three new test files (HomeScreen.warm-start-guard, PostDetailScreen.video-detector, InfoFlow.short-tap-emit).

---

### Anti-Patterns Scan

Files modified across the three gap-closure plans (per SUMMARY frontmatter aggregation):

| File | TODO/FIXME/STUB | Empty implementations | Hardcoded empty data | Status |
|------|-----------------|------------------------|----------------------|--------|
| `app/src/screens/HomeScreen.tsx` | None in modified region | None | `setDailyPosts(posts)` is now guarded — initial empty state from useState initializer is intentional warm-start | CLEAN |
| `app/src/services/post-queue.service.ts` | None | None | Returning `[]` from walkDerivedList when len=0 is intentional early-return | CLEAN |
| `app/src/components/YouTubeEmbed.tsx` | None | None | None | CLEAN |
| `app/src/components/InfoFlow.tsx` | None | None | `markExplored` call only fires when `anchorId && !dailyReadService.isExplored(anchorId)` — proper guard | CLEAN |
| `app/src/screens/PostDetailScreen.tsx` | None in Detector D | None | Detector D's `data` parsed defensively; early returns on shape mismatches; no static returns | CLEAN |
| `app/tests/*` (5 new/extended test files) | None | None | All tests assert on real source content via fs.readFileSync | CLEAN |
| `CLAUDE.md` (walker bullet + "Video & short post completion signals" section) | None | None | None | CLEAN |
| `36-UAT-RETEST.md` | None | None | None | CLEAN |

No anti-patterns detected. The `try/catch` in InfoFlow short tap-to-play onClick is a defensive guard with a `console.warn` — not a stub; the tap-to-play state change still happens via `setVideoPlaying(post.id)` outside the catch. emit-failure should not break video playback (correct error-handling pattern).

---

### Human Verification Required

| Test | What To Do | Expected | Why Human |
|------|-----------|----------|-----------|
| GAP-A retest (cold-start) | Per `36-UAT-RETEST.md` Test 1 — edit localStorage `echolearn_post_queue.date` to yesterday, reload home | Yesterday's posts appear immediately; no flicker; no "Check your API keys" toast; ~8s later replaced by today's freshly-generated posts | Visual flicker + toast UI is human-perceptible only |
| GAP-C Detector D (full-length video) | Per `36-UAT-RETEST.md` Test 3 — open a video post, watch ≥80% or to ENDED, observe `localStorage.echolearn_daily_read.exploredAnchors` and VineProgress chip | exploredAnchors gains the video's anchor ID; VineProgress chip increments by 1; subsequent refills do not re-suggest | Requires real YouTube iframe + real device webview to send postMessage events; cannot run headlessly |
| GAP-C short tap-to-play | Per `36-UAT-RETEST.md` Test 3 second sub-recipe — tap a short post in the feed | exploredAnchors gains the short's anchor ID immediately; VineProgress chip increments by 1 on next render | Requires real feed render with short posts present |
| GAP-B optional manual cross-check | Per `36-UAT-RETEST.md` Test 2 — single-anchor setup, swipe through ~16 posts, count text-art presentation styles | text-art count ≥ 8 out of 16 (= floor(16 × 0.55)); pre-fix: ~4 | Optional, visual count; primary verification is automated via Test 7 in refill-queue-integration.test.mjs |

These items do not block phase goal — all automated invariants are GREEN. The retest recipes exist on disk in `36-UAT-RETEST.md` for operator walk-through after merge.

---

### Gaps Summary

No gaps. All 14 gap-closure must-haves verified GREEN across plans 36-06, 36-07, and 36-08. Phase goal (close UAT round 1's three gaps without regressing original Phase 36 invariants) is achieved.

Summary of code changes:
- **GAP-A (36-06):** HomeScreen.tsx warm-start guard — useRef snapshot at mount + branched setters in cold-start useEffect; preserves the original 6cda914e error-gate intent (genuine API-key failure) by reading the ref's negation in the error condition.
- **GAP-B (36-07):** post-queue.service.ts walker termination — single-line replacement of `len * 2` with `Math.max(count * 2, len)`. Preserves all 10 original derived-list tests; adds 2 regression tests covering the truncation case + multi-wrap explored-skip.
- **GAP-C (36-08):** YouTubeEmbed.tsx + InfoFlow.tsx (3 iframe srcs gain `enablejsapi=1`); PostDetailScreen.tsx adds Detector D (window 'message' listener parsing YouTube IFrame API events with origin allowlist + ENDED + 80% heartbeat thresholds); InfoFlow.tsx short card onClick fires `dailyReadService.markExplored` + `eventBus.emit` directly (since shorts never reach PostDetailScreen).

Phase 33 regression-safety preserved: `dueAnchors.filter` at `concept-feed.service.ts:733` and `allExplored && getTotalGenerated() >= maxPosts` at line 1202 are both byte-unchanged. Phase 36 Wave 0..04 wiring (appendToDerivedList + walkDerivedList + spreadByConcept-before-spreadByStyle) is byte-unchanged. Original Phase 36 verification's 13/13 must-haves remain VERIFIED.

Test count delta: +17 new gap-closure tests (4 + 2 + 1 + 6 + 4) all GREEN; quick suite expands from 53 to 70 passing tests.

---

_Verified: 2026-05-06T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
