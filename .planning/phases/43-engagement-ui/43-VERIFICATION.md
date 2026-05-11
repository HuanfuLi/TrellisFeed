---
phase: 43-engagement-ui
verified: 2026-05-11T13:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed:
    - "UAT Test 2 (major): BottomSheet Dismiss row clipped behind BottomNavigation"
    - "UAT Test 3 (cosmetic): Saved/Liked corner icons blend into tile backgrounds"
    - "UAT Test 5 (minor): Bookmark icon fixed to viewport, overlaps VineProgress on scroll"
    - "UAT Test 7 (minor): Deep Dive controls positioned below essay body instead of above"
    - "UAT Test 9 (major): Force-New-Day wiped Saved + Liked archives (should preserve them)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Long-press feel on Android WebView (all 4 tile types)"
    expected: "Menu opens at 480ms, native text-selection menu does NOT appear"
    why_human: "jsdom cannot simulate touch + native context menu interaction"
  - test: "Bottom-sheet slide-in animation consistency"
    expected: "Slide-in curve matches existing modal vocabulary"
    why_human: "Motion quality not testable in headless"
  - test: "Deep-dive stream replace-in-place is visually smooth"
    expected: "No jarring content jump or scroll-position drift during chunk arrival"
    why_human: "Scroll-position quality not testable in headless"
  - test: "Spanish dismiss-toast width on narrow Android screens"
    expected: "Toast fits ToastContainer without awkward line-wrapping"
    why_human: "Physical device screen width required"
  - test: "4-locale UI render after locale switch"
    expected: "Long-press menu labels, /saved screen + empty states, deep-dive labels render natively in each locale"
    why_human: "Visual confirmation; missing-key.test.mjs confirms key absence but not rendering quality"
---

# Phase 43: Engagement UI Verification Report

**Phase Goal:** Surface the Phase 39 engagement service in the UI — long-press action rows on tiles, /saved archive view, deep-dive essay button on PostDetailScreen, ANCHOR_DISMISSED resync, and Force-New-Day engagement reset.
**Verified:** 2026-05-11T13:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure plans 43-09 through 43-13

---

## Gap-Closure Re-Verification Summary

The initial Phase 43 verification (43-01..43-08) passed 6/6 truths. UAT revealed 5 gaps subsequently closed by gap-closure plans 43-09..43-13. This report is the re-verification that all 5 gaps are resolved.

| Gap | UAT Test | Severity | Closed By | Status |
| --- | -------- | -------- | --------- | ------ |
| BottomSheet Dismiss row clipped by BottomNavigation | T2 | major | 43-09 | Closed |
| Corner icons blend into tile backgrounds (no chip backdrop) | T3 | cosmetic | 43-10 | Closed |
| Bookmark icon viewport-fixed, overlaps VineProgress on scroll | T5 | minor | 43-11 | Closed |
| Deep Dive controls positioned below essay body (should be above) | T7 | minor | 43-12 | Closed |
| Force-New-Day wiped Saved + Liked archives | T9 | major | 43-13 | Closed |

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Long-press on a feed tile opens a contextual menu with Like / Save / Not interested; the Dismiss row is fully visible above the BottomNavigation (not clipped) | ✓ VERIFIED | `BottomSheet.tsx` uses `createPortal(overlay, document.body)` + `bottom: calc(80px + var(--safe-area-bottom))`; 6/6 BottomSheet.portal tests pass |
| 2  | Saved/Liked corner icons have a theme-aware chip backdrop, legible against busy thumbnails in both light and dark themes | ✓ VERIFIED | `MasonryFeed.tsx` cornerOverlay wraps each icon in 26x26 chip span with `var(--corner-chip-bg)`; index.css declares all three vars in both `:root` and `.dark`; 6/6 corner-chip tests pass |
| 3  | HomeScreen Bookmark icon is inline with the greeting row and scrolls away naturally; no overlap with compact VineProgress bar slide-in | ✓ VERIFIED | Fixed-position block deleted from HomeScreen.tsx; greeting wrapped in flex row (`justifyContent: space-between`); `zIndex: 195` absent; 6/6 bookmark-inline-greeting tests pass |
| 4  | PostDetailScreen Deep Dive button AND Standard/Deep segmented toggle are positioned ABOVE the essay body | ✓ VERIFIED | `renderDeepDiveControls()` invocation at char 42614 is before essay body container at char 42733 (`minHeight: '200px'`) and before takeaway at 47321; scroll-sentinel still at 46709; 19/19 PostDetailScreen deep-dive tests pass |
| 5  | Force-New-Day resets ONLY the dismissed-anchors list; Saved and Liked archives are preserved | ✓ VERIFIED | `engagementService.resetDismissedOnly()` added (idempotent, mutates only `state.dismissed`, emits `ENGAGEMENT_CHANGED { kind: 'undismiss', id: '*' }`); `SettingsDataScreen.handleForceNewDay` calls `resetDismissedOnly()`; 5/5 SC-6 test + 6/6 engagement-service-reset-dismissed-only tests pass |
| 6  | (Prior truths 1-6 from initial verification still satisfied — long-press menu wired, /saved route, deep-dive stream, ANCHOR_DISMISSED resync, original Force-New-Day engagement wiring) | ✓ VERIFIED | All prior source-reading tests still green (LongPressMenu 7/7, SavedScreen 7/7, HomeScreen engagement-resync 11/11, PostDetailScreen abort-contract 7/7, segmented-toggle 7/7, InfoFlow no-tag 4/4, bundle-parity 2/2) |

**Score:** 11/11 truths verified (6 original + 5 gap-closure)

---

### Required Artifacts (Gap-Closure Plans)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/ui/BottomSheet.tsx` | `createPortal(overlay, document.body)` + SSR guard + bottom clearance | ✓ VERIFIED | 99 LOC; `import { createPortal } from 'react-dom'`; `typeof document === 'undefined'` guard; `bottom: 'calc(80px + var(--safe-area-bottom))'`; `position: 'absolute'` on inner sheet |
| `app/tests/components/BottomSheet.portal.test.mjs` | Source-reading regression test (6 assertions) | ✓ VERIFIED | 92 LOC; 6/6 pass: createPortal import, invocation, SSR guard, bottom clearance, absolute position, no-regression-to-bottom-0 |
| `app/src/index.css` | `--corner-chip-bg`, `--corner-chip-fg-saved`, `--corner-chip-fg-liked` in both `:root` and `.dark` | ✓ VERIFIED | Lines 85-87 (`:root`) and 248-250 (`.dark`) confirmed; each var appears exactly twice |
| `app/src/components/MasonryFeed.tsx` cornerOverlay | 26x26 chip spans with `var(--corner-chip-bg)` backdrop; Heart uses `--corner-chip-fg-liked` not `--node-salmon` | ✓ VERIFIED | Lines 387-450; `var(--node-salmon)` absent from cornerOverlay region; `filter: drop-shadow` absent from cornerOverlay region |
| `app/tests/components/MasonryFeed.corner-chip.test.mjs` | Source-reading regression test (6 assertions) | ✓ VERIFIED | 6/6 pass: chip backdrop, fg tokens, no node-salmon, 26x26 dimensions, CSS vars in both themes, no drop-shadow |
| `app/src/screens/HomeScreen.tsx` (greeting row) | Inline Bookmark button in flex row; `zIndex: 195` absent; single `navigate('/saved')` | ✓ VERIFIED | Line 702: flex row with `justifyContent: 'space-between'`; line 716: `navigate('/saved')`; grep for `zIndex: 195` returns 0 hits |
| `app/tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs` | Source-reading regression test (6 assertions) | ✓ VERIFIED | 6/6 pass: no zIndex 195, no fixed-position anchor, flex greeting row, single navigate('/saved'), WCAG tap floor, compact bar at zIndex 190 preserved |
| `app/src/screens/PostDetailScreen.tsx` (DD controls above essay) | `renderDeepDiveControls()` invocation before essay body container; scroll-sentinel untouched | ✓ VERIFIED | invocationIdx (42614) < essayBodyIdx (42733) < sentinelJsxIdx (46709) < takeawayIdx (47321); `ref={scrollSentinelRef}` JSX at line 1048 |
| `.planning/phases/43-engagement-ui/43-CONTEXT.md` DS-02 entry | Documents operator placement update with UAT quote and cross-reference | ✓ VERIFIED | DS-02 at line 82; mentions "43-12", "above essay body", UAT Test 7 quote |
| `app/src/services/engagement.service.ts` `resetDismissedOnly()` | Idempotent partial reset; mutates only `state.dismissed`; emits `ENGAGEMENT_CHANGED { kind: 'undismiss', id: '*' }`; `reset()` unchanged | ✓ VERIFIED | Lines 230-236; early-return when `dismissed.length === 0`; `state.saved` and `state.liked` untouched; `reset()` still at lines 207-209 |
| `app/src/screens/settings/SettingsDataScreen.tsx` | `resetDismissedOnly()` at Force-New-Day call site; `reset()` absent from `handleForceNewDay` body | ✓ VERIFIED | Line 142: `engagementService.resetDismissedOnly()`; grep for `engagementService.reset()` in function body returns 0 hits |
| `app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` | 5 assertions (incl. negative invariant against `reset()`) | ✓ VERIFIED | 5/5 pass: ordering, resetDismissedOnly present, negative guard against reset() |
| `app/tests/services/engagement.service.reset-dismissed-only.test.mjs` | 6 service-level assertions | ✓ VERIFIED | 6/6 pass: method shape, dismissed-only mutation, archive-non-mutation, idempotence, ENGAGEMENT_CHANGED payload, reset() preservation |

---

### Key Link Verification (Gap-Closure)

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `BottomSheet.tsx` | `document.body` | `createPortal(overlay, document.body)` | ✓ WIRED | Escapes SwipeTabContainer per-slot `translateZ(0)` containing block; Phase 32.1 pattern applied |
| `BottomSheet.tsx` inner sheet | viewport (above BottomNavigation) | `bottom: 'calc(80px + var(--safe-area-bottom))'` | ✓ WIRED | Defense-in-depth geometric clearance; 80px = BottomNavigation row footprint |
| `MasonryFeed.tsx` cornerOverlay | theme-aware chip colors | `var(--corner-chip-bg)` / `var(--corner-chip-fg-saved)` / `var(--corner-chip-fg-liked)` | ✓ WIRED | CSS vars declared in both `:root` and `.dark` in index.css |
| `HomeScreen.tsx` greeting row | `/saved` navigation | `onClick={() => navigate('/saved')}` in inline Bookmark button | ✓ WIRED | Single occurrence; zIndex 195 removed |
| `PostDetailScreen.tsx` JSX | `renderDeepDiveControls()` above essay body | Invocation placed before `<div style={{ minHeight: '200px' }}>` | ✓ WIRED | char 42614 < char 42733; `scrollSentinelRef` (Detector A) undisturbed at char 46709 |
| `handleForceNewDay` | `engagementService.resetDismissedOnly()` | Direct call at SettingsDataScreen.tsx:142 | ✓ WIRED | `reset()` (wholesale) no longer in force-new-day path |
| `resetDismissedOnly()` | `ENGAGEMENT_CHANGED` event | `eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'undismiss', id: '*' } })` | ✓ WIRED | Sentinel id `'*'` signals bulk reset; HomeScreen Effect B re-reads `getDismissedAnchorIds()` |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| BottomSheet portal tests (6 assertions) | `node --test tests/components/BottomSheet.portal.test.mjs` | 6/6 pass | ✓ PASS |
| MasonryFeed corner-chip tests (6 assertions) | `node --test tests/components/MasonryFeed.corner-chip.test.mjs` | 6/6 pass | ✓ PASS |
| HomeScreen bookmark-inline-greeting tests (6 assertions) | `node --test tests/screens/HomeScreen.bookmark-inline-greeting.test.mjs` | 6/6 pass | ✓ PASS |
| PostDetailScreen deep-dive tests (all 3 files, 19 assertions) | `node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs` | 19/19 pass | ✓ PASS |
| Engagement reset-dismissed-only service tests (6 assertions) | `node --test tests/services/engagement.service.reset-dismissed-only.test.mjs` | 6/6 pass | ✓ PASS |
| SettingsDataScreen force-new-day test (5 assertions) | `node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` | 5/5 pass | ✓ PASS |
| `renderDeepDiveControls()` char position < essay body container | `node -e` index probe | 42614 < 42733 | ✓ PASS |
| `scrollSentinelRef` JSX still present (Detector A) | `grep -n "ref={scrollSentinelRef}"` | line 1048 found | ✓ PASS |
| `zIndex: 195` absent from HomeScreen.tsx | `grep "zIndex: 195" HomeScreen.tsx` | 0 hits | ✓ PASS |
| `engagementService.reset()` absent from `handleForceNewDay` body | negative grep on SettingsDataScreen.tsx | 0 hits in function body | ✓ PASS |
| `createPortal` in BottomSheet.tsx | `grep -c "createPortal" BottomSheet.tsx` | 4 (import + invocation + 2 doc refs) | ✓ PASS |
| `var(--node-salmon)` absent from cornerOverlay region | region-scoped grep | 0 hits in cornerOverlay JSX | ✓ PASS |
| `filter: drop-shadow` absent from cornerOverlay region | region-scoped grep | 0 hits in cornerOverlay JSX | ✓ PASS |
| Walker `maxSteps = Math.max(count * 2, len)` intact | `grep "Math.max(count \* 2" post-queue.service.ts` | line 383 found | ✓ PASS |
| Header portal-vs-in-tree pattern intact | `grep "createPortal" Header.tsx` | import + conditional createPortal at line 155 | ✓ PASS |
| `enablejsapi=1` in YouTubeEmbed.tsx | `grep -c "enablejsapi=1" YouTubeEmbed.tsx` | 2 | ✓ PASS |
| Ask-chat byte-stable system prompt | `node --test tests/state/useQuestions-system-prompt-stability.test.mjs` | 6/6 pass | ✓ PASS |
| All 48 gap-closure tests combined | combined run | 48/48 pass | ✓ PASS |

---

### Pre-Existing Test Failures (NOT Phase 43 Gaps)

The following 5 test failures exist in `npm run test:main` and are confirmed pre-existing from prior phases. They are NOT introduced or worsened by Phase 43 gap-closure plans 43-09..43-13. Confirmed via `git stash` + re-run by the 43-10 executor.

| Test | File | Failure Reason | Phase Origin |
| ---- | ---- | -------------- | ------------ |
| `concept-feed.service.ts contains walkDerivedList(16, exploredIds, dismissedIds)` | `tests/concept-feed.test.mjs` | Assertion expects OLD `16` walker batch size; CLAUDE.md documents canonical value as **24** post-2026-05-10 | Phase 37/42 numeric drift |
| `needsRefill returns true when size < 16, false when >= 16 (Phase 36-12)` | `tests/services/post-queue.test.mjs` | Assertion expects OLD `16` refill threshold; CLAUDE.md documents **24** post-2026-05-10 | Phase 37/42 numeric drift |
| `counterweight: Phase 39 walker wire untouched at concept-feed.service.ts:~1212` | `tests/concept-feed.test.mjs` | Stale line number | Phase 39 carry-over |
| `concept-feed.service hasImageGenKey gate` | `tests/concept-feed.test.mjs` | Stale assertion | Pre-Phase-43 |
| `getVineColor returns one of the 5 --node-* variables` | `tests/concept-feed.test.mjs` | Date-dependent test | Pre-Phase-43 |

These are candidates for a future hygiene phase. They do not affect any Phase 43 deliverable.

---

### CLAUDE.md Load-Bearing Invariant Preservation

| Pattern | Rule | Status |
| ------- | ---- | ------ |
| Header portal-vs-in-tree pattern (Phase 32.1) | `Header.tsx` unchanged; no `transform`/`will-change` on Header ancestors | ✓ Confirmed — `createPortal` in Header.tsx line 155; portal-vs-in-tree logic intact |
| BottomSheet now follows same portal pattern | Overlays inside SwipeTabContext must escape per-slot `translateZ(0)` | ✓ New: `BottomSheet.tsx` uses `createPortal(overlay, document.body)` (43-09) |
| Phase 36 walker `maxSteps = Math.max(count * 2, len)` | Do not regress to `len * 2` | ✓ `post-queue.service.ts` line 383 unchanged |
| Phase 35 ask-chat byte-stable system prompt | `formatCandidateContextPack` in assistant role, not system | ✓ `useQuestions.ts` unchanged; 6/6 system-prompt-stability tests pass |
| Detector D `enablejsapi=1` on YouTube iframes | `YouTubeEmbed.tsx` must have ≥1 occurrence | ✓ 2 occurrences confirmed |
| Phase 43 Detector A scroll-70% sentinel (`scrollSentinelRef`) | Must stay in place; only `renderDeepDiveControls()` invocation moved | ✓ Sentinel still at char 46709, AFTER new invocation at 42614 |
| AbortController contract: 16 pre-call guards, 6 signal-arg passes, cache-write guard | DD-05; Phase 41-02 D-08 | ✓ `grep -c "signal.aborted.*return"` returns 16; cache-write guard `if (ctrl.signal.aborted) return` before `patchPostEssayInCache` |
| `reset()` preserved for Clear-All-Data paths | D-08 wholesale wipe intact | ✓ `engagement.service.ts:207-209` unchanged; existing `reset() clears all three collections AND emits NOTHING (D-08)` test still passes |
| `ENGAGEMENT_CHANGED` (not a new event type) for resetDismissedOnly emit | Phase 39 D-06 one-signal-per-semantic-event | ✓ Sentinel `id: '*'` on existing `ENGAGEMENT_CHANGED` event shape |
| `html, body { overflow: hidden }` (Phase 33 UAT-4) | Do not remove | ✓ Confirmed at index.css:293 |

---

### Human Verification Required

1. **Long-press feel on Android WebView (all 4 tile types)**
   - **Test:** On Android device, long-press each feed tile type (image, text-art, video, news) for ~480ms
   - **Expected:** Bottom-sheet opens at ~480ms; all 3 rows (Like, Save, Not interested) are visible above the BottomNavigation; native text-selection menu does NOT appear
   - **Why human:** jsdom cannot simulate touch + native context menu interaction; this UAT test was the root of gap T2

2. **UAT Test 4 re-test (Dismiss fades ALL same-anchor tiles)**
   - **Test:** Find an anchor with multiple tiles in the feed; long-press any one → Not interested
   - **Expected:** All tiles sharing that anchor fade out simultaneously; masonry reflows without visible gap
   - **Why human:** Blocked during initial UAT by gap T2; now unblocked after 43-09 fix; requires live device with multiple same-anchor tiles visible

3. **Bottom-sheet slide-in animation consistency**
   - **Test:** Open long-press menu; compare animation curve with other BottomSheet usages
   - **Expected:** Slide-in curve matches existing modal vocabulary
   - **Why human:** Motion quality not testable in headless

4. **HomeScreen Bookmark inline scroll behavior**
   - **Test:** Open HomeScreen → scroll down → observe that Bookmark icon scrolls away with the greeting; compact VineProgress bar slides in at top WITHOUT Bookmark overlap
   - **Expected:** No overlap; Bookmark participates in normal scroll flow
   - **Why human:** Layout + scroll behavior not verifiable in headless

5. **Force-New-Day saves/liked persistence (manual re-test of UAT T9)**
   - **Test:** Save and Like several posts; Force New Day; navigate to /saved
   - **Expected:** Saved and Liked tabs still list the previously-saved/liked posts; dismissed anchors reappear in feed
   - **Why human:** End-to-end UX confirmation; automated tests verify source-level invariants only

6. **Deep Dive controls above essay — visual confirmation (UAT T7)**
   - **Test:** Open a post detail screen; verify Deep Dive button / Standard|Deep toggle appears ABOVE the essay body text
   - **Expected:** User sees depth-control affordance before reading the essay
   - **Why human:** Visual position relative to rendered essay body not verifiable in headless

7. **4-locale UI render after locale switch**
   - **Test:** Cycle through en/zh/es/ja; verify long-press menu labels, /saved screen, deep-dive button + segmented control labels render natively
   - **Expected:** No missing-key fallbacks visible in any locale
   - **Why human:** Visual confirmation; `missing-key.test.mjs` confirms key absence but not rendering quality

---

### Gaps Summary

No gaps found. All 5 UAT gaps from the initial Phase 43 verification have been closed by plans 43-09 through 43-13. Every gap-closure artifact exists, is substantive, is wired, and has passing source-reading regression tests. Load-bearing invariants from CLAUDE.md are preserved. Pre-existing test failures are confirmed pre-existing and not attributable to Phase 43.

Phase 43 is structurally complete. Remaining items are device-only UAT re-tests and human verification listed above.

---

*Verified: 2026-05-11T13:30:00Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — after gap-closure plans 43-09..43-13*
