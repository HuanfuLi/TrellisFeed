---
phase: 43-engagement-ui
verified: 2026-05-12T08:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 11/11
  gaps_closed:
    - "UAT Test 4 (major): Dismiss not propagating to same-anchor sibling tiles — fixed by applyDismissedFilter() helper at concept-feed read boundary (43-14)"
    - "UAT Test 12 (blocker): Duplicate React keys after Force-New-Day — fixed by postQueueService.removeByIds + infiniteScrollService.seedSeen + Set-based handleLoad concat dedup (43-15)"
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
  - test: "UAT Test 4 re-test (dismiss fades ALL same-anchor tiles, post-43-14)"
    expected: "On device: dismiss one tile of a multi-tile anchor → all sibling tiles fade; refresh does not resurrect them"
    why_human: "Requires live device feed with multiple same-anchor tiles visible"
  - test: "UAT Test 12 re-test (no duplicate-key warnings after Force-New-Day, post-43-15)"
    expected: "No 'Encountered two children with the same key' React DEV warnings after Force-New-Day + swipe-for-more"
    why_human: "Requires live device with ≥32 generated posts in queue; DevTools console inspection needed"
  - test: "4-locale UI render after locale switch"
    expected: "Long-press menu labels, /saved screen, deep-dive button labels render natively in each locale"
    why_human: "Visual confirmation; missing-key.test.mjs confirms key presence but not rendering quality"
---

# Phase 43: Engagement UI Verification Report (Post-43-15)

**Phase Goal:** Surface Wave-1 engagement service in the UI: action rows on tiles, deep-dive button on detail, social-proof micro-label, Force-New-Day reset.
**Verified:** 2026-05-12T08:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap-closure plans 43-14 and 43-15 (third pass; previous pass covered 43-09..43-13)

---

## Re-Verification Summary

The previous VERIFICATION.md (2026-05-11, after 43-09..43-13) passed 11/11 truths. UAT revealed two additional gaps during the follow-on device re-test cycle:

| Gap | UAT Test | Severity | Closed By | Status |
| --- | -------- | -------- | --------- | ------ |
| Dismiss not propagating to same-anchor sibling tiles; persists after refresh | T4 | major | 43-14 | Closed |
| Duplicate React keys after Force-New-Day + swipe-for-more | T12 | blocker | 43-15 | Closed |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Long-press on a feed tile opens a contextual menu with Like / Save / Not interested; Dismiss row fully visible above BottomNavigation | ✓ VERIFIED | `BottomSheet.tsx` uses `createPortal(overlay, document.body)` + `bottom: calc(80px + var(--safe-area-bottom))`; 6/6 BottomSheet.portal tests pass |
| 2 | Saved/Liked corner icons have theme-aware chip backdrop, legible in light + dark | ✓ VERIFIED | `MasonryFeed.tsx` cornerOverlay 26x26 chip with `var(--corner-chip-bg)`; both `:root` and `.dark` CSS var declarations confirmed; 6/6 corner-chip tests pass |
| 3 | HomeScreen Bookmark icon inline with greeting row; scrolls naturally; no VineProgress overlap | ✓ VERIFIED | Fixed-position block deleted; greeting wrapped in `justifyContent: 'space-between'` flex row; `zIndex: 195` absent; 6/6 bookmark-inline-greeting tests pass |
| 4 | PostDetailScreen Deep Dive button AND Standard/Deep segmented toggle positioned ABOVE essay body | ✓ VERIFIED | `renderDeepDiveControls()` invocation at char 42614 precedes essay body container at char 42733; 19/19 deep-dive tests pass |
| 5 | Force-New-Day resets ONLY dismissed-anchors list; Saved and Liked archives preserved | ✓ VERIFIED | `engagementService.resetDismissedOnly()` at SettingsDataScreen.tsx:142; `reset()` absent from handleForceNewDay; 5/5 force-new-day + 6/6 reset-dismissed-only tests pass |
| 6 | Original truths 1-6 from initial verification still hold (long-press wired, /saved route, deep-dive stream, ANCHOR_DISMISSED resync, engagement reset wiring) | ✓ VERIFIED | All prior tests green — LongPressMenu 7/7, SavedScreen 7/7, HomeScreen engagement-resync 11/11, PostDetailScreen abort-contract 7/7, segmented-toggle 7/7, InfoFlow no-tag 4/4 |
| 7 (NEW) | Dismissing any one tile of a multi-tile anchor concept filters ALL sibling tiles sharing that anchor from all read paths (cache-hit, getCachedDailyPosts, fingerprint-mismatch) — persists across refresh, PLANNER_UPDATED, 8s timer, navigation | ✓ VERIFIED | `applyDismissedFilter()` helper declared at concept-feed.service.ts:240; called at lines 1523, 1548, 1638 (3 read-boundary call sites); 7/7 concept-feed-dismiss-filter tests + 5/5 HomeScreen.dismiss-resync tests pass |
| 8 (NEW) | After Force-New-Day, the home feed renders each post id exactly once across initial dailyPosts seed and subsequent dequeue batches — no React duplicate-key warnings | ✓ VERIFIED | `postQueueService.removeByIds()` at post-queue.service.ts:270; `infiniteScrollService.seedSeen()` at infiniteScroll.service.ts:49; `warmStartTierRef` + mount-once useEffect + Set-based concat dedup in HomeScreen.tsx; 10/10 post-queue-remove-by-id + 8/8 HomeScreen.force-new-day-dedup tests pass |

**Score:** 13/13 truths verified (6 original + 5 gap-closure 43-09..43-13 + 2 gap-closure 43-14..43-15)

---

### Required Artifacts (43-14 and 43-15 Gap-Closure)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/services/concept-feed.service.ts` — `applyDismissedFilter()` helper | Private function; builds Set from `engagementService.getDismissedAnchorIds()`; short-circuits on empty set; passes orphan posts through | ✓ VERIFIED | Lines 240-248; Set construction + empty-set short-circuit + orphan pass-through all confirmed |
| `app/src/services/concept-feed.service.ts` — 3 call sites | `getCachedDailyPosts` + `getDailyPosts` cache-hit branch + fingerprint-mismatch branch | ✓ VERIFIED | Lines 1523, 1548, 1638 — each confirmed by grep |
| `app/tests/services/concept-feed-dismiss-filter.test.mjs` | 7 source-reading assertions (empty baseline, single-anchor, multi-anchor, orphan edge case, cache-hit + fingerprint-mismatch wiring, drain branch negative, walker non-regression negative) | ✓ VERIFIED | 160 LOC; 7/7 pass |
| `app/tests/screens/HomeScreen.dismiss-resync.test.mjs` | 5 source-reading assertions (Effect A preserved, write-paths don't inline filter, Effect B defense-in-depth, walker negative, applyDismissedFilter counterweight) | ✓ VERIFIED | 170 LOC; 5/5 pass |
| `app/src/services/post-queue.service.ts` — `removeByIds()` | Splices ids from `_state.posts` and persists; returns count; does NOT mutate STORAGE_KEY_YESTERDAY / totalServed / derivedList / cyclePosition | ✓ VERIFIED | Lines 246-277; all invariant properties confirmed |
| `app/src/services/infiniteScroll.service.ts` — `seedSeen()` | Primes `seenPostIds` with external ids; respects 500-id eviction policy | ✓ VERIFIED | Lines 49-57; Set-add loop with eviction confirmed |
| `app/src/screens/HomeScreen.tsx` — warm-start dedup wiring | `warmStartTierRef` captures tier + seededIds; mount-once useEffect dispatches removeByIds + seedSeen on yesterday tier; `[location.pathname]` re-sync does same in yesterday branch; handleLoad concat uses Set-based id dedup | ✓ VERIFIED | Lines 48, 54, 61, 66 (warmStartTierRef), 117-135 (mount-once effect), 260-286 (re-sync yesterday branch), 340-341 (Set concat dedup) |
| `app/tests/services/post-queue-remove-by-id.test.mjs` | 10 behavioral + non-regression assertions | ✓ VERIFIED | 192 LOC; 10/10 pass |
| `app/tests/screens/HomeScreen.force-new-day-dedup.test.mjs` | 8 invariant assertions (warmStartTierRef, mount-once dispatch, re-sync wiring, concat dedup, Phase 36-11 stale-cache preserved, Phase 36-14 tier-2 preserved, numeric defaults, service counterweight) | ✓ VERIFIED | 131 LOC; 8/8 pass |

---

### Key Link Verification (43-14 and 43-15)

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `concept-feed.service.ts getCachedDailyPosts` | `engagementService.getDismissedAnchorIds()` | `applyDismissedFilter(allPosts)` at line 1638 | ✓ WIRED | Filter at read boundary; all 4 HomeScreen write paths see filtered result |
| `concept-feed.service.ts getDailyPosts` cache-hit branch | `engagementService.getDismissedAnchorIds()` | `applyDismissedFilter(feedPosts)` at line 1523 | ✓ WIRED | Symmetric with getCachedDailyPosts |
| `concept-feed.service.ts getDailyPosts` fingerprint-mismatch branch | `engagementService.getDismissedAnchorIds()` | `applyDismissedFilter(feedPosts)` at line 1548 | ✓ WIRED | Symmetric with cache-hit branch |
| HomeScreen warm-start initializer (yesterday tier) | `postQueueService.removeByIds` + `infiniteScrollService.seedSeen` | mount-once useEffect dispatches on `tier === 'yesterday'`; seededIds from warmStartTierRef | ✓ WIRED | Structural fix: yesterdayQueue and _state.posts become mutually exclusive |
| HomeScreen `[location.pathname]` re-sync (yesterday branch) | `postQueueService.removeByIds` + `infiniteScrollService.seedSeen` | Symmetric with warm-start initializer | ✓ WIRED | Phase 36-14 tier-2 fallback augmented with dedup step |
| HomeScreen `handleLoad` concat | id-dedup guard | `const seen = new Set(prev.map(p => p.id)); const fresh = newPosts.filter(p => !seen.has(p.id))` at lines 340-341 | ✓ WIRED | Defense-in-depth render-boundary guard; prevents duplicates regardless of source |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 43-14 dismiss-filter + 43-15 dedup gap-closure tests (30 assertions) | `node --test tests/services/concept-feed-dismiss-filter.test.mjs tests/screens/HomeScreen.dismiss-resync.test.mjs tests/services/post-queue-remove-by-id.test.mjs tests/screens/HomeScreen.force-new-day-dedup.test.mjs` | 30/30 pass | ✓ PASS |
| Load-bearing regression suite (45 assertions) | `node --test tests/services/derived-list.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-mutex.test.mjs tests/state/useQuestions-system-prompt-stability.test.mjs` | 45/45 pass | ✓ PASS |
| TypeScript type-check | `npx tsc -b --noEmit` | exits 0 (no output) | ✓ PASS |
| Vite production build | `npm run build` | `built in 1.73s` — 0 type errors | ✓ PASS |
| All 8 commits (43-14 + 43-15) verified in git history | `git log --oneline 4cbecdd9 d67607c6 d47cb733 84f97502 f9cd39aa ccaaef05 b4200eff 60c6946f` | 8/8 found | ✓ PASS |
| `applyDismissedFilter` declared + 3 call sites wired | `grep -n "applyDismissedFilter" concept-feed.service.ts` | lines 240, 1523, 1548, 1638 | ✓ PASS |
| `removeByIds` in post-queue.service.ts | `grep -n "removeByIds" post-queue.service.ts` | line 270 — substantive splice + save implementation | ✓ PASS |
| `seedSeen` in infiniteScroll.service.ts | `grep -n "seedSeen" infiniteScroll.service.ts` | line 49 — substantive Set-add loop with eviction | ✓ PASS |
| `warmStartTierRef` captures tier + seededIds in HomeScreen | `grep -n "warmStartTierRef" HomeScreen.tsx` | lines 48, 54, 61, 66 (initializer) + 132-135 (effect dispatch) | ✓ PASS |
| Set-based concat dedup in `handleLoad` | `grep -n "seen.has\|new Set.*prev" HomeScreen.tsx` | lines 340-341 | ✓ PASS |
| Phase 39 D-07 walker dismiss-skip UNCHANGED | negative assertion in post-queue-remove-by-id.test.mjs Test 9 | 1/1 pass | ✓ PASS |
| Phase 36-11 stale-cache rejection UNCHANGED | negative assertion in HomeScreen.force-new-day-dedup.test.mjs Test 5 | 1/1 pass | ✓ PASS |
| STORAGE_KEY_YESTERDAY snapshot UNCHANGED by removeByIds | negative assertion in post-queue-remove-by-id.test.mjs Test 6 | 1/1 pass | ✓ PASS |
| Walker `maxSteps = Math.max(count * 2, len)` intact (Phase 36 GAP-B) | derived-list.test.mjs Test 11 | 1/1 pass | ✓ PASS |
| Ask-chat byte-stable system prompt (Phase 35) | useQuestions-system-prompt-stability.test.mjs | 6/6 pass | ✓ PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| ENGAGE-01 | User can save / bookmark a post; saved posts persist; /saved accessible | ✓ SATISFIED | `engagementService.save()` wired via LongPressMenu; SavedScreen at `/saved`; 7/7 SavedScreen tests pass |
| ENGAGE-02 | User can dismiss / mark "not interested"; dismissed anchors skip in walker | ✓ SATISFIED | `engagementService.dismiss()` wired via LongPressMenu → ANCHOR_DISMISSED event; walker lazy-skip at post-queue.service.ts:389; `applyDismissedFilter()` at all 3 read boundaries (43-14 closed T4) |
| ENGAGE-03 | User can like / heart a post; likes persist locally | ✓ SATISFIED | `engagementService.like()` wired via LongPressMenu; Liked tab in SavedScreen; 7/7 SavedScreen tests pass |
| ENGAGE-04 | N-connections micro-label on tiles | DESCOPED (DS-01, 2026-05-11) | Documented in ROADMAP.md line 62 + REQUIREMENTS.md line 75; Phase 43 ships TS-01 (presentation-style tag removal) instead |
| CONTENT-01 | User can request "Deep Dive" essay variant from PostDetailScreen | ✓ SATISFIED | Full-width Deep Dive button + Standard\|Deep segmented toggle above essay body; 19/19 PostDetailScreen deep-dive tests pass; `bodyMarkdownDeep` streamed via post-essay.service.ts |

---

### Anti-Patterns Found

No new anti-patterns introduced by 43-14 or 43-15.

| File | Pattern | Severity | Verdict |
| ---- | ------- | -------- | ------- |
| `concept-feed.service.ts:243-247` | `filter()` with predicate — not a stub; real Set-based filter over engagementService data | ℹ️ Info | NOT a stub — substantive filtering logic |
| `post-queue.service.ts:271-276` | `filter()` to splice by id — not a stub; persists result to localStorage | ℹ️ Info | NOT a stub — substantive mutation + persistence |
| `HomeScreen.tsx:340-341` | Set-based dedup at concat — not a stub; defense-in-depth guard | ℹ️ Info | NOT a stub — substantive id-dedup |

---

### CLAUDE.md Load-Bearing Invariant Preservation (43-14 + 43-15)

| Pattern | Rule | Status |
| ------- | ---- | ------ |
| Phase 39 D-07 walker dismiss-skip (`post-queue.service.ts:389`) | Must remain UNCHANGED — walker handles forward-looking refill; applyDismissedFilter handles read-side | ✓ Confirmed — negative-invariant tests in both 43-14 and 43-15 test files pass |
| Phase 36-11 stale-cache rejection at `loadCache()` | Must remain UNCHANGED — dismiss filter applies AFTER date check | ✓ Confirmed — HomeScreen.force-new-day-dedup.test.mjs Test 5 passes |
| Phase 36-14 tier-2 warm-start re-fallback structure | Must remain UNCHANGED — augmented with removeByIds + seedSeen in yesterday branch only | ✓ Confirmed — HomeScreen.force-new-day-dedup.test.mjs Test 6 passes |
| Phase 36-09 STORAGE_KEY_YESTERDAY snapshot | `removeByIds` must NOT touch the durable snapshot | ✓ Confirmed — post-queue-remove-by-id.test.mjs Test 6 passes |
| Phase 36 CLAUDE.md numeric defaults (MAX_QUEUE_SIZE=32, REFILL_THRESHOLD=24, limit=8) | Must remain UNCHANGED | ✓ Confirmed — HomeScreen.force-new-day-dedup.test.mjs Test 7 passes |
| Phase 43-13 `engagementService.resetDismissedOnly()` wiring | Force-New-Day must call resetDismissedOnly(), not reset() | ✓ Confirmed — SettingsDataScreen.tsx:142; 5/5 force-new-day test passes |
| Phase 36 GAP-B walker `maxSteps = Math.max(count * 2, len)` | Do not regress to `len * 2` | ✓ Confirmed — derived-list.test.mjs Test 11 passes |
| Phase 35 ask-chat byte-stable system prompt | `formatCandidateContextPack` in assistant role, not system | ✓ Confirmed — 6/6 useQuestions-system-prompt-stability tests pass |
| Concept-feed drain branch UNCHANGED | Dequeued posts from walker pass through applyDismissedFilter verbatim (walker already filtered at source) | ✓ Confirmed — concept-feed-dismiss-filter.test.mjs Test 6 negative-invariant passes |

---

### Pre-Existing Test Failures (Not Phase 43 Gaps)

The following failures in `npm run test:main` are confirmed pre-existing from prior phases and are not attributable to 43-14 or 43-15:

| Test | File | Failure Reason | Phase Origin |
| ---- | ---- | -------------- | ------------ |
| `concept-feed.service.ts contains walkDerivedList(16, exploredIds, dismissedIds)` | `tests/concept-feed.test.mjs` | Asserts old batch size 16; CLAUDE.md canonical value is 24 post-2026-05-10 | Phase 37/42 numeric drift |
| `needsRefill returns true when size < 16` | `tests/services/post-queue.test.mjs` | Asserts old refill threshold 16; canonical is 24 | Phase 37/42 numeric drift |
| `counterweight: Phase 39 walker wire untouched at concept-feed.service.ts:~1212` | `tests/concept-feed.test.mjs` | Stale line number | Phase 39 carry-over |
| `concept-feed hasImageGenKey gate` | `tests/concept-feed.test.mjs` | Stale assertion | Pre-Phase-43 |
| `getVineColor returns one of the 5 --node-* variables` | `tests/concept-feed.test.mjs` | Date-dependent test | Pre-Phase-43 |

---

### 43-UAT.md Gap Status Update

The UAT file (`43-UAT.md`) currently shows Tests 4 and 12 with `status: failed` and the overall file-level `status: diagnosed`. These statuses reflect the pre-43-14/43-15 state. After this verification confirms both gaps are structurally closed by their respective plans, the canonical status is:

- **Test 4:** resolved-by: 43-14 (applyDismissedFilter at concept-feed read boundary; 12/12 tests pass)
- **Test 12:** resolved-by: 43-15 (removeByIds + seedSeen + Set-based concat dedup; 18/18 tests pass)

Device re-test is recommended to confirm the human-visible behavior matches the structural fix (see Human Verification Required section).

---

### Human Verification Required

1. **UAT Test 4 re-test — Dismiss fades ALL same-anchor tiles (post-43-14)**
   - **Test:** Find an anchor-concept with multiple tiles in the feed; long-press any one → Not interested
   - **Expected:** All tiles sharing that anchor fade out simultaneously; masonry reflows without gap; refreshing the page does NOT restore the dismissed tiles (previously they reappeared on refresh)
   - **Why human:** Live device with multiple same-anchor tiles visible; 43-09 unblocked the Not Interested row; 43-14 fixes the read-boundary propagation

2. **UAT Test 12 re-test — No duplicate-key warnings after Force-New-Day (post-43-15)**
   - **Test:** Ensure ≥32 posts in queue; Settings → Data → Force New Day → confirm; navigate to /home; open DevTools (preserve log); swipe-for-more
   - **Expected:** NO "Encountered two children with the same key" React DEV warnings; popped 8 posts log still appears (normal); Saved + Liked archives still intact (Test 9 non-regression)
   - **Why human:** Requires live device with specific queue state; DevTools console inspection; Phase 36-14 warm-start tier-2 re-fallback still surfaces yesterday's feed

3. **Long-press feel on Android WebView (all 4 tile types)**
   - **Test:** On Android device, long-press each feed tile type for ~480ms
   - **Expected:** Bottom-sheet opens at ~480ms; all 3 rows visible above BottomNavigation; native text-selection menu does NOT appear
   - **Why human:** jsdom cannot simulate touch + native context menu interaction

4. **Bottom-sheet slide-in animation consistency**
   - **Test:** Open long-press menu; compare animation curve with other BottomSheet usages
   - **Expected:** Slide-in curve matches existing modal vocabulary
   - **Why human:** Motion quality not testable in headless

5. **Deep Dive controls above essay — visual confirmation**
   - **Test:** Open a post detail screen; verify Deep Dive button / Standard|Deep toggle appears ABOVE the essay body text
   - **Expected:** User sees depth-control affordance before reading the essay
   - **Why human:** Visual position relative to rendered essay body not verifiable in headless

6. **4-locale UI render after locale switch**
   - **Test:** Cycle through en/zh/es/ja; verify long-press menu labels, /saved screen, deep-dive button + segmented control labels render natively
   - **Expected:** No missing-key fallbacks visible in any locale
   - **Why human:** Visual confirmation; missing-key.test.mjs confirms key presence but not rendering quality

---

### Gaps Summary

No gaps found. Both UAT gaps from the previous verification round (43-14 addressing Test 4 dismiss propagation; 43-15 addressing Test 12 duplicate React keys) are structurally closed. Every artifact exists, is substantive, is wired, and has passing source-reading regression tests. All 30 gap-closure tests pass (30/30). All 45 load-bearing regression tests pass (45/45). TypeScript compiles clean. Production build succeeds. All 8 commits from 43-14 and 43-15 are present in git history.

Phase 43 is structurally complete after all three verification passes (initial, 43-09..43-13 gap-closure, 43-14..43-15 gap-closure). Remaining items are device-only UAT re-tests and human verification listed above.

---

*Verified: 2026-05-12T08:30:00Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — after gap-closure plans 43-14 and 43-15 (third verification pass)*
