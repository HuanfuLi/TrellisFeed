---
phase: 43-engagement-ui
verified: 2026-05-11T12:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 43: Engagement UI Verification Report

**Phase Goal:** Surface Wave-1 engagement service in the UI: action rows on tiles, deep-dive button on detail, social-proof micro-label, Force-New-Day reset.
**Verified:** 2026-05-11
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                     | Status     | Evidence                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Long-press on a feed tile opens a contextual menu with Like / Save / Not interested; commits engagementService call | ✓ VERIFIED | `LongPressMenu.tsx` (141 LOC): 3 rows, handleSave/handleLike/handleDismiss wire to `engagementService.savePost/likePost/dismissAnchor`; test 36/36 pass |
| 2   | Saved posts accessible via `/saved` route; lists posts persisted across days                              | ✓ VERIFIED | `SavedScreen.tsx` (308 LOC): Saved + Liked tabs, `getSavedPosts()`/`getLikedPosts()`; `/saved` route in `App.tsx:315`; tests 7/7 pass |
| 3   | PostDetailScreen shows "Deep dive" button; tap streams `depth: 'deep'` 350-600w variant under AbortController contract | ✓ VERIFIED | `PostDetailScreen.tsx`: `handleStartDeepDive`, `deepAbortControllerRef`, `depth: 'deep'` signal pass, `patchPostEssayInCache` guard; 19/19 tests pass |
| 4   | ENGAGE-04 cleanly descoped — no orphan `[ ]` checkboxes                                                  | ✓ VERIFIED | ROADMAP.md SC-4 italicized as descope marker; REQUIREMENTS.md ENGAGE-04 moved to Out of Scope; traceability row = "Out of Scope (DS-01, 2026-05-11)" |
| 5   | HomeScreen Effect A (stable `[]`) subscribes `ANCHOR_DISMISSED` + Effect B `[location.pathname]` re-syncs via `getDismissedAnchorIds()`; neither calls `conceptFeedService.getDailyPosts()` | ✓ VERIFIED | `HomeScreen.tsx:567-591`: Effect A at lines 567-574 (deps `[]`), Effect B at lines 584-591 (deps `[location.pathname]`); test 11/11 pass |
| 6   | `handleForceNewDay` calls `engagementService.reset()` after `dailyReadService.reset()` and before toast  | ✓ VERIFIED | `SettingsDataScreen.tsx:134-139`: exact ordering confirmed; 4/4 tests pass                                    |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact                                                         | Expected                                              | Status     | Details                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `app/src/hooks/useLongPress.ts`                                  | 480ms timer hook with `{ didLongPress, bind }`        | ✓ VERIFIED | 61 LOC; pointer-event-only path; no `contextmenu` registration                  |
| `app/src/components/LongPressMenu.tsx`                           | 3-row bottom-sheet contextual menu                    | ✓ VERIFIED | 141 LOC; anti-wire: 0 occurrences of `CONCEPT_EXPLORED`/`eventBus.emit`/`dailyReadService.markExplored` |
| `app/src/components/MasonryFeed.tsx`                             | TileWrapper + AnimatePresence + corner-icon overlay   | ✓ VERIFIED | `onLongPress` + `engagementVersion` props; AnimatePresence per-column; Phase 42 invariants preserved (0 `column-count`, 0 `will-change`, 0 `CONCEPT_EXPLORED`) |
| `app/src/screens/SavedScreen.tsx`                                | Two-tab archive view                                  | ✓ VERIFIED | 308 LOC; `Header backTo="/home"`; ENGAGEMENT_CHANGED subscription; `navigate(/posts/:id)` row tap |
| `app/src/App.tsx` `/saved` route                                 | Route registered with PageTransition wrapper          | ✓ VERIFIED | Line 315: `{ path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> }` |
| `app/src/screens/PostDetailScreen.tsx` deep-dive extensions      | handleStartDeepDive + renderDeepDiveControls + segmented toggle | ✓ VERIFIED | `deepAbortControllerRef`, `handleStartDeepDive`, `handleRestoreStandard`, `renderDeepDiveControls`, `bodyMarkdownDeep`, `activeVariant` all present; cleanup cascade aborts both controllers |
| `app/src/screens/HomeScreen.tsx` engagement wiring               | Bookmark icon + LongPressMenu host + 3 sibling effects | ✓ VERIFIED | Bookmark button at `position: fixed, zIndex 195`; `<LongPressMenu>` mounted at screen level; Effects A/B/C present |
| `app/src/screens/settings/SettingsDataScreen.tsx`                | `engagementService.reset()` in `handleForceNewDay`    | ✓ VERIFIED | Line 138: `engagementService.reset()` — after `dailyReadService.reset()` (line 134), before toast (line 139) |
| `app/src/components/ui/BottomSheet.tsx`                          | `compact` prop added                                  | ✓ VERIFIED | Used by `LongPressMenu` (`compact={true}`); additive prop, no migration burden  |
| `app/src/locales/{en,zh,es,ja}.json`                             | 14 new i18n keys per locale                           | ✓ VERIFIED | `engagement.*`, `saved.*`, `posts.detail.deepDive.*`; bundle-parity test green  |
| `.planning/ROADMAP.md` Phase 43 section                          | DS-01 descope reflected, all 8 plan checkboxes filled | ✓ VERIFIED | SC-4 italicized; ENGAGE-04 descoped note; 8 `[x]` checkboxes                   |
| `.planning/REQUIREMENTS.md`                                      | ENGAGE-04 in Out of Scope with traceability row       | ✓ VERIFIED | ENGAGE-04 row = "Out of Scope (DS-01, 2026-05-11)"; active count = 21           |

---

### Key Link Verification

| From                    | To                                    | Via                                                | Status     | Details                                               |
| ----------------------- | ------------------------------------- | -------------------------------------------------- | ---------- | ----------------------------------------------------- |
| MasonryFeed TileWrapper | `onLongPress` callback                | `useLongPress` 480ms timer → `onLongPress(postId, anchorId)` | ✓ WIRED | Lines 355-357 in MasonryFeed; HomeScreen `handleLongPress` receives call |
| HomeScreen              | LongPressMenu                         | `menuOpen/menuPostId/menuAnchorId` state props     | ✓ WIRED   | `<LongPressMenu open={menuOpen} .../>` at HomeScreen:958-963 |
| LongPressMenu rows      | engagementService                     | `savePost/likePost/dismissAnchor` calls            | ✓ WIRED   | Lines 59-85 in LongPressMenu.tsx; `onClose()` called after each action |
| HomeScreen Effect A     | dailyPosts filter                     | `ANCHOR_DISMISSED` → `setDailyPosts(prev.filter(...))` | ✓ WIRED | HomeScreen:568-573; also bumps `engagementVersion` |
| HomeScreen Effect B     | engagementService.getDismissedAnchorIds | `[location.pathname]` → in-place filter           | ✓ WIRED   | HomeScreen:584-591; gates on `/home`; never calls `conceptFeedService.getDailyPosts()` |
| HomeScreen Effect C     | engagementVersion bump                | `ENGAGEMENT_CHANGED` → `setEngagementVersion(v+1)` | ✓ WIRED  | HomeScreen:597-602; drives MasonryFeed corner-icon re-render |
| HomeScreen Bookmark     | `/saved` navigation                   | `onClick → navigate('/saved')`                    | ✓ WIRED   | HomeScreen:660; `position: fixed, zIndex 195` |
| SavedScreen             | engagementService                     | `getSavedPosts()` / `getLikedPosts()` + ENGAGEMENT_CHANGED | ✓ WIRED | Lines 225-243; `return unsub` cleanup |
| PostDetailScreen        | deep-dive stream                      | `handleStartDeepDive` → `generatePostEssay(post, qs, { depth: 'deep', signal })` | ✓ WIRED | Lines 542-575; dedicated `deepAbortControllerRef` |
| PostDetailScreen        | segmented toggle                      | `post.bodyMarkdownDeep` length > 0 gate → `setActiveVariant(variant)` | ✓ WIRED | renderDeepDiveControls; pure state, no re-stream |
| handleForceNewDay       | engagementService.reset()             | After dailyReadService.reset(), before toast       | ✓ WIRED   | SettingsDataScreen.tsx:134-139 |

---

### Data-Flow Trace (Level 4)

| Artifact         | Data Variable   | Source                            | Produces Real Data | Status     |
| ---------------- | --------------- | --------------------------------- | ------------------ | ---------- |
| SavedScreen      | `savedPosts`    | `engagementService.getSavedPosts()` (localStorage `trellis_engagement_v1`) | Yes — reads persisted engagement store | ✓ FLOWING |
| SavedScreen      | `likedPosts`    | `engagementService.getLikedPosts()` | Yes | ✓ FLOWING |
| LongPressMenu    | `isSaved`/`isLiked` | `engagementService.isSaved(postId)` / `isLiked(postId)` at render time | Yes — synchronous read from store | ✓ FLOWING |
| PostDetailScreen | `streamingDeep` | `generatePostEssay(post, qs, { depth: 'deep' })` async generator | Yes — LLM stream chunks | ✓ FLOWING |
| HomeScreen       | `dailyPosts` (dismiss filter) | `engagementService.getDismissedAnchorIds()` on Effect B | Yes — reads persisted dismissed set | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                          | Command                                                                                                          | Result          | Status  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- | ------- |
| LongPressMenu anti-wire: 0 CONCEPT_EXPLORED tokens | `grep -c CONCEPT_EXPLORED app/src/components/LongPressMenu.tsx`                                                  | 0               | ✓ PASS  |
| MasonryFeed anti-wire: 0 CONCEPT_EXPLORED tokens  | `grep -c CONCEPT_EXPLORED app/src/components/MasonryFeed.tsx`                                                    | 0               | ✓ PASS  |
| `/saved` route registered                         | `grep saved app/src/App.tsx`                                                                                     | line 315 found  | ✓ PASS  |
| engagementService.reset() in handleForceNewDay    | `grep -n "engagementService.reset" app/src/screens/settings/SettingsDataScreen.tsx`                              | line 138 found  | ✓ PASS  |
| Effect A deps=[] (stable listener)                | Source read lines 567-574: `useEffect(() => { ... }, [])`                                                        | confirmed       | ✓ PASS  |
| Effect B deps=[location.pathname]                 | Source read lines 584-591: `useEffect(() => { ... }, [location.pathname])`                                       | confirmed       | ✓ PASS  |
| tsc -b --noEmit                                   | `npx tsc -b --noEmit`                                                                                            | exit 0          | ✓ PASS  |
| LongPressMenu test suite                          | `node --test tests/components/LongPressMenu.test.mjs`                                                            | 7/7 pass        | ✓ PASS  |
| MasonryFeed dismiss-fade tests                   | `node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs`                                             | 7/7 pass        | ✓ PASS  |
| SavedScreen tests                                 | `node --test tests/screens/SavedScreen.test.mjs`                                                                 | 7/7 pass        | ✓ PASS  |
| HomeScreen engagement-resync tests                | `node --test tests/screens/HomeScreen.engagement-resync.test.mjs`                                                | 11/11 pass      | ✓ PASS  |
| SettingsDataScreen force-new-day tests            | `node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs`                           | 4/4 pass        | ✓ PASS  |
| PostDetailScreen deep-dive tests (3 files)        | `node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs PostDetailScreen.segmented-toggle.test.mjs PostDetailScreen.abort-contract.test.mjs` | 19/19 pass | ✓ PASS |
| InfoFlow no-presentation-style-tag tests          | `node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs`                                       | 4/4 pass        | ✓ PASS  |
| Bundle parity                                     | `node --test tests/locales/bundle-parity.test.mjs`                                                               | 2/2 pass        | ✓ PASS  |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                  | Status      | Evidence                                                                                    |
| ----------- | ----------- | -------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| ENGAGE-01   | 43-03, 43-04, 43-06 | User can save / bookmark a post; saved posts persist; accessible view                 | ✓ SATISFIED | `LongPressMenu` save row → `engagementService.savePost`; `SavedScreen` at `/saved`          |
| ENGAGE-02   | 43-03, 43-06, 43-07 | User can dismiss / mark "not interested"; dismissed anchors skip in walker             | ✓ SATISFIED | `LongPressMenu` dismiss row → `engagementService.dismissAnchor`; HomeScreen dual-effect + `engagementService.reset()` in Force-New-Day |
| ENGAGE-03   | 43-03, 43-04 | User can like / heart a post; likes persist locally                                   | ✓ SATISFIED | `LongPressMenu` like row → `engagementService.likePost`; Liked tab in `SavedScreen`         |
| ENGAGE-04   | N/A (DS-01)  | N connections micro-label                                                              | Descoped    | ROADMAP SC-4 italicized descope marker; REQUIREMENTS.md Out of Scope section; no `[ ]` orphan |
| CONTENT-01  | 43-05        | "Deep dive" essay variant (350-600w) from PostDetailScreen; standard default           | ✓ SATISFIED | `handleStartDeepDive` → `generatePostEssay({ depth: 'deep' })`; segmented toggle; 19 tests |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None found | — | — | — | All phase-43-added files are substantive; no TODOs, no placeholder returns, no empty handlers |

Notable confirmed-clean items:
- `LongPressMenu.tsx`: 0 `TODO`, 0 `FIXME`, no `return null` or `return <></>` in main render path
- `SavedScreen.tsx`: real data from `engagementService.getSavedPosts()`/`getLikedPosts()`; empty states are intentional UI
- `SettingsDataScreen.tsx`: `engagementService.reset()` is a real call with ordering constraint
- `PostDetailScreen.tsx`: `handleStartDeepDive` is a fully implemented async streaming handler; `setDeepError` is captured but not yet surfaced to UI (documented as intentional deferral in SUMMARY)

One intentional deferral (not a stub):
- `deepError` state is captured in `handleStartDeepDive` but not rendered. The PHASE-SUMMARY documents this as "out of Phase 43 scope" — `deepError` state slot exists, error is logged but no inline retry UI. This is a planned follow-up, not a blocking gap.

---

### CLAUDE.md Load-Bearing Pattern Preservation

| Pattern | Rule | Status |
| ------- | ---- | ------ |
| `html, body { overflow: hidden }` (Phase 33 UAT-4) | Do not remove | ✓ Confirmed at index.css:293 |
| YouTubeEmbed `enablejsapi=1` | Must appear ≥1 time | ✓ Found 2 occurrences |
| `CONCEPT_EXPLORED` NOT in LongPressMenu or MasonryFeed | Anti-wire invariant | ✓ 0 occurrences in both files |
| Header portal-vs-in-tree pattern (Phase 32.1) | SavedScreen Header must use `backTo` for portal | ✓ `Header backTo="/home"` at SavedScreen:251 |
| Phase 36-14 dual-effect shape (sibling effects) | Effect A stable `[]` + Effect B `[location.pathname]` coexist | ✓ Lines 567-574 and 584-591; [location.pathname] effect count went from 2 → 3 |
| Always-mounted screens re-read service state on navigation | HomeScreen must explicitly re-read on navigate | ✓ Effect B re-reads `getDismissedAnchorIds()` on `[location.pathname]` |
| No getDailyPosts call in dismiss effects | LP-05 operator decision | ✓ Effects A and B use in-place `setDailyPosts(prev => prev.filter(...))` only |
| Dedicated AbortController per logical stream (Pitfall 3) | `deepAbortControllerRef` separate from `abortController` | ✓ `deepAbortControllerRef = useRef<AbortController | null>(null)` |
| Cache-write guard: `patchPostEssayInCache` only when `!signal.aborted` | DD-05 | ✓ Line 563: `if (ctrl.signal.aborted) return` before `patchPostEssayInCache` |
| Cleanup cascade aborts BOTH controllers | Multi-controller pattern | ✓ Lines 405+410: `abortController.abort()` then `deepAbortControllerRef.current?.abort()` |

---

### Human Verification Required

The following behaviors are device-only (not blockable for automated gates):

1. **Long-press feel on Android WebView**
   - **Test:** On Android device: 480ms hold on feed tile (all 4 types — image, text-art, video, news)
   - **Expected:** Bottom-sheet opens at 480ms; native text-selection menu does NOT appear; no contextmenu interference
   - **Why human:** jsdom cannot simulate touch + native context menu interaction

2. **Bottom-sheet slide-in animation consistency**
   - **Test:** Open long-press menu; compare animation curve with other BottomSheet usages in the app
   - **Expected:** Slide-in curve matches existing modal vocabulary
   - **Why human:** Motion quality not testable in headless

3. **Deep-dive stream replace-in-place is visually smooth**
   - **Test:** Open PostDetailScreen → tap "Deep dive" → watch body slot during streaming
   - **Expected:** No jarring content jump or scroll-position drift during chunk arrival
   - **Why human:** Scroll-position quality not testable in headless

4. **Spanish dismiss-toast width on narrow Android screens**
   - **Test:** Long-press → dismiss in Spanish locale; verify toast "Entendido — no volverás a ver esto" fits ToastContainer without awkward wrapping
   - **Expected:** Toast renders within viewport width; no line-wrap overflow
   - **Why human:** Physical device screen width required; jsdom has no layout engine

5. **4-locale UI render after locale switch**
   - **Test:** Cycle through en/zh/es/ja; verify long-press menu labels, /saved screen + empty states, deep-dive button + segmented control render natively
   - **Expected:** No missing-key fallbacks visible; all labels in native language
   - **Why human:** Visual confirmation; `missing-key.test.mjs` confirms key absence but not rendering quality

---

### Gaps Summary

No gaps found. All 6 observable truths are verified, all artifacts pass all three levels (exists, substantive, wired), data flows are real (not hardcoded), and all key links are confirmed wired in the actual source code.

The one intentional deferral (`deepError` not surfaced in UI) is documented as out-of-scope in the PHASE-SUMMARY and does not block the phase goal.

ENGAGE-04 descope is cleanly reflected in both ROADMAP.md (SC-4 italicized with descope date) and REQUIREMENTS.md (Out of Scope section with traceability row "Out of Scope (DS-01, 2026-05-11)"). No orphan `[ ]` checkboxes.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier)_
