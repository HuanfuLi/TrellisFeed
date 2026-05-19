---
status: partial
phase: 50-retrieval-and-library-foundation
source:
  - 50-01-SUMMARY.md
  - 50-02-SUMMARY.md
  - 50-03-SUMMARY.md
  - 50-04-SUMMARY.md
  - 50-05-SUMMARY.md
  - 50-06-SUMMARY.md
  - 50-07-SUMMARY.md
  - 50-08-SUMMARY.md
  - 50-09-SUMMARY.md
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T11:30:00Z
---

## Current Test

number: 6
name: Tab switch preserves query but rescopes results
expected: |
  On /saved Saved tab, type a query in the search bar. Results filter to Saved
  matches. Tap the "Liked" tab in the strip. The query text stays in the search
  bar. Results recompute against the Liked corpus (different rows).

  RE-UAT after fixes (50-12):
  - G6: SavedScreen tab-change effect dropped setQuery('')/setInputDraft('').
    Still keeps the debounce-timer flush + filter-chip clear so stale results
    don't show during the rescope.
phase: re-uat
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running Vite dev server. Start `npm run dev` from app/. App boots
  without console errors. /home loads with the feed visible. No red SOS overlay,
  no blank white screen, no "Failed to compile" banner.
result: pass

### 2. Long-press feed tile → Save to... opens CollectionPickerSheet
expected: |
  Long-press a feed tile on /home (480ms hold). LongPressMenu opens with
  Save · Like · Not Interested rows. Tap "Save to..." (Save row). Picker sheet
  slides in from the bottom. "Saved" row is pre-checked. List shows any existing
  custom collections with empty checkboxes. "Create new collection" row is visible
  at the top or bottom of the list.
result: pass
note: |
  Original 2026-05-18: "Fail: 1. Saved collection is NOT pre-checked as expected. 2. In
  the inline collection creation process, after user clicked the 'Save name' button, no
  new collection was displayed until user refresh the page. This refresh issue has happened
  dozens of times during this project implementation, please take it into your memory and
  keep in mind: Mobile app users do not have the refresh option!"

  Re-UAT 2026-05-18 after gap-closure plans 50-10 (G1+G3) + commit b9165f98 (G8 dep-loop fix):
  All 7 sub-conditions PASS. Saved is pre-checked, inline-create renders immediately,
  no refresh required, no render-loop crash.

  3 NEW findings during re-UAT (logged as G9/G10/G11):
  - G9 (cosmetic): bookmark icon on the implicit Saved row turns dark when checked,
    mismatches user-created collections whose folder icons don't darken.
  - G10 (major): no "Saved" folder appears in /saved → Collections tab. Implicit Saved
    is a real collection from the user's POV — they expect to retrieve it from the
    Collections tab.
  - G11 (minor/design): Liked tab in /saved is redundant with Save (overlap UX).
    Operator suggests dropping the Liked tab; keep Like as a pure recommendation signal
    only.

### 3. Create new collection inline + add post in one flow
expected: |
  In the open picker sheet, tap "Create new collection". Inline text input
  appears. Type a name (e.g. "Memory"). Confirm (Enter or Save). The new
  collection appears as a checked row in the picker. Tap Done. Sheet closes.
  Toast or visual confirmation that the post is saved to both "Saved" and
  "Memory".
result: pass
note: "End-to-end persistence verified — new collection persists, posts saved to it stay checked across re-open. Test 2 still owns the no-refresh issue."

### 4. Search highlight on /saved
expected: |
  Open /saved. Tap the search bar (sticky top). Type a substring matching a
  known saved post title or body. Matched substrings render visually distinct
  (bg-tinted highlight using --primary-40). Body snippet renders ~120 chars
  centered on the first match. No raw HTML, no escape artifacts.
result: pass
note: |
  Re-UAT 2026-05-18 pass after the following fixes shipped during the re-walk:
  - 50-11 Fuse tuning (G4): threshold 0.4→0.3, minMatchCharLength 2→3
  - G13 long-press regression (b77b0f85): 8px movement threshold restored
  - G13 haptic follow-up (17ac2dda): explicit hapticImpactLight in timer
  - G12 keyboard side-effect (17ac2dda): autoFocus deferred behind sheet-open
  - G9 cosmetic (17ac2dda): bookmark stays outlined in active state
prior_blocked_by: long-press-broken-on-touch-device
reported: |
  Original 2026-05-18: "Partial: Would work but has false positives sometimes.
  Searched '3D printing' on Liked tab, top hit is a Kanji video. Body snippet
  has scattered single-char/2-char highlights." — addressed by 50-11 Fuse tuning,
  needs re-verification.

  Re-UAT 2026-05-18 device: "On device issue found: When user clicked the
  bookmark icon in the top right corner, the system keyboard was invoked
  although user did not click the search bar and the search bar is not focused.
  Also, the long-press on post face tiles does not work on phones (not responding
  to long-press event), and it actually works in a weird way in browser (mouse
  scroll disabled after long-press). I do feel the haptics though. This blocked
  the test because I cannot save a post in this way."

  Logged as two new gaps:
  - G12 (keyboard-on-bookmark, major): needs device localization
  - G13 (long-press fails on touch device, blocker): root cause confirmed
    — useLongPress.ts:57 cancels timer on ANY pointermove. Touch jitter fires
    pointermove constantly, so timer never reaches 480ms on real hardware.
    Mouse-driven browser works (no jitter); user feels OS-native long-press
    haptic but JS recognizer never fires.

  G13 is the blocker for completing Test 4 — without long-press the user
  cannot reach CollectionPickerSheet to save posts, so /saved has no corpus
  to search against.
severity: blocker
analysis: |
  Both. Fuse.js's Bitap algorithm fuzzy-matches by default. With FUSE_OPTIONS
  threshold=0.6 (the Fuse default) and minMatchCharLength unset (defaults to 1),
  it returns single-character matches and a much wider set of "near-matches" than
  intended for a substring-search-feeling library tool. The 'eco'/'gniti' fragments
  are sub-runs of 'printing' permitted by the fuzzy threshold; the kanji video
  matched at all because its body has enough character overlap with '3D printing'.
  Fix is in library-search.service.ts FUSE_OPTIONS: lower threshold (~0.3-0.4) and
  set minMatchCharLength >= 3 (or to query.length when query is short). Also
  consider switching to a stricter mode when query.length <= 4 to avoid
  noise-floor matches on short queries.

### 5. Filter chips appear on focus, disappear on blur
expected: |
  On /saved, tap the search bar (focus). Three filter chips slide in below the
  bar: Concept · Source · Date. Tap outside the search bar (blur with empty
  input and no active filter). Chips collapse and disappear. If query OR any
  filter is active, chips stay visible after blur.
result: pass
note: |
  Re-UAT 2026-05-18 pass after the following fixes shipped during re-walk:
  - G2 (50-12): onPointerDown preventDefault on chip wrapper — chip tap no longer
    blurs the search input before chip handler runs (empty-query path)
  - G5 (50-13): BottomSheet overscroll-behavior contain — drawer hits rigid hard-stop
  - G7 (50-12 + re-UAT follow-up): chips now use padding-driven sizing (10px/14px),
    fixed `height: 32px` was the actual culprit clipping vertical breathing room

  Operator clarification: "Vertical padding was bad, not horizontal padding issue."
  Original G7 framed it as horizontal — re-UAT confirmed it was the fixed 32px
  height clipping the chip regardless of padding values. Final fix drops the
  fixed height and lets padding drive intrinsic chip size.

  New finding during this test → G14 logged separately (saved/liked stubs
  invisible on /saved until opened).
prior_reported: |
  "Fail: 1. Inconsistent padding for chips (screenshot — Concept/Source/Date pills
  have uneven horizontal padding around text). 2. Tapping a chip is recognized as
  tapping outside the search bar → chips disappear before the chip's tap handler
  fires → chips are non-interactive. Blocked."

  Clarification (2026-05-18): chip-tap-collapses race ONLY happens when search bar
  is empty. When search bar has text, the drawer can expand (chip handler fires).
  But drawer has additional UI flaws: not optimized for scrolling — no safe area
  above/below viewable area, causing flicker / end-of-page visible when scrolled
  too fast at boundary. Operator suggests rigid boundary instead of flexible.
severity: blocker
analysis: |
  Two separate gaps. The blur-race is blocker (chips are core to the filter UX
  and currently unusable). Standard fix patterns: (a) onPointerDown e.preventDefault()
  on chip wrapper to prevent input blur, (b) move chip-visibility flag off the
  input-focus boolean and onto a sibling focus-within container, (c) latch the
  chip-row open while query OR any filter is active. The padding issue is
  cosmetic — uniform inline padding (e.g. padding: '6px 12px' fixed) makes the
  three chips visually consistent independent of text length.

  Refined diagnosis from operator clarification: the latch (fix pattern c) is
  partially live — when query is non-empty, chip-row stays mounted and chip taps
  reach their handlers, opening the FilterPickerSheet. The remaining bug is the
  empty-query path: chip-row collapses on blur before the chip's pointer event
  promotes to a click. Fix patterns (a) or (b) still apply for the empty-query
  case.

  New finding — FilterPickerSheet scroll boundary: the picker drawer body lacks
  rigid overscroll containment. On Android WebView fast-scroll near the top/bottom
  triggers visible overshoot (rubberband or content seen outside the drawer's
  rounded mask). Fix candidates: `overscroll-behavior: contain` on the drawer's
  inner scroll container; ensure the drawer's clip mask covers the full scroll
  region (border-radius on the OUTER container, overflow: auto on the inner one);
  or add a fixed-height clip wrapper so the scroll cannot visually leak.

### 6. Tab switch preserves query but rescopes results
expected: |
  On /saved Saved tab, type a query in the search bar. Results filter to Saved
  matches. Tap the "Liked" tab in the strip. The query text stays in the search
  bar. Results recompute against the Liked corpus (different rows).
result: issue
reported: "Fail: Switching tab in Saved tab clears the search bar."
severity: major
analysis: |
  Direct contradiction between the validation contract and the executed plan:
  - 50-VALIDATION.md row 4 expects: "Query string persists, results rescope to Liked"
  - 50-09-SUMMARY.md states: "Tab-change reset effect clearing query + filters
    + pending debounce timer (Pitfall 8)"
  The planner cited "Pitfall 8" as motivation but Pitfall 8 in RESEARCH.md is about
  flushing the pending debounce timer to avoid stale results, NOT about clearing
  the query string. The query-clear is a misinterpretation. Fix: in
  SavedScreen.tsx's tab-change effect, drop `setQuery('')` and `setInputDraft('')`
  while KEEPING the debounce-timer flush + filter-chip clear. The Fuse index already
  rebuilds on `[activeTab, corpus]` change (50-09 pattern), so rescoping is
  automatic once the query is retained.

### 7. Collection drill-in + Remove from collection
expected: |
  On /saved, switch to the Collections tab. Tap a custom collection (one with
  saved posts). Navigate to /collections/:id (URL changes). Drill-in shows
  collection name as Header title and the saved post rows. Long-press a post
  row (480ms). LongPressMenu opens with a "Remove from {collectionName}" row
  in addition to standard rows. Tap it. Post disappears from this drill-in
  list. The collection still exists at /saved → Collections.
result: pass

### 8. Collection membership pins post against 7-day purge
expected: |
  Save a post into a custom (non-Saved) collection. If a "Force New Day" dev
  affordance exists in /settings → Data, invoke it 8+ times to simulate >7 days.
  Open /saved → History. The post is still listed (collection membership keeps
  it pinned past the rolling 7-day purge window). Reopen the post via tap;
  /posts/:id loads normally.
result: skipped
reason: "Operator does not wish to time-travel now. Defer to a follow-up UAT session after the open gaps are closed; D-09 pin extension is already covered by tests/services/post-history.purge.test.mjs at the service layer."

## Summary

total: 8
passed: 6
issues: 1
pending: 0
skipped: 1
blocked: 0
gaps: 15 total — fixed in-session: G1, G2, G3, G4, G5, G7, G8, G9, G12, G13, G14; deferred: G10 (Saved-as-real-folder, major), G11 (drop Liked tab, design); awaiting re-UAT: G6 (Test 6 — tab-preserves-query)

## Gaps

- truth: "CollectionPickerSheet opens with 'Saved' row pre-checked when long-press → Save to... fires on a feed tile that isn't yet saved (D-04, T-50-PICKER-RACE mitigation)."
  status: failed
  reason: "User reported: Saved collection is NOT pre-checked as expected."
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "After inline-create commit ('Save name'), the new collection renders immediately in the picker list as a checked row WITHOUT requiring page refresh. Mobile app users have no refresh affordance."
  status: failed
  reason: "User reported: after clicking 'Save name', no new collection was displayed until page refresh. Mobile app users do not have the refresh option."
  severity: blocker
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Search on /saved returns relevance-ordered results matching the user-typed substring; highlights mark substring matches, not single-char fuzzy hits. Short queries (≤4 chars) do not surface unrelated posts."
  status: failed
  reason: "User reported: typing '3D printing' on Liked tab surfaces an unrelated Kanji video with scattered single-char/2-char highlights ('i R', 'di', 'T', 'nd', 'ti', 'n', 'R', 'R', 'eco', 'gniti'). Bitap fuzzy threshold too permissive + minMatchCharLength too low."
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Tapping a filter chip (Concept · Source · Date) opens its FilterPickerSheet. Chip taps do not collapse the chip row before the tap handler runs."
  status: fixed
  reason: "User reported: tapping a chip is registered as a blur on the search bar, the chip-row collapses, and the chip's own tap handler never fires. Chips are non-interactive in practice. Closed by 50-12 (onPointerDown preventDefault on chip wrapper); re-UAT Test 5 confirmed chip taps fire FilterPickerSheet from the empty-query path."
  severity: blocker
  test: 5
  root_cause: "input blur fired on chip pointerdown before chip onClick promoted from the synthetic pointerup → blur collapsed the chip-row mount."
  artifacts: ["app/src/screens/SavedScreen.tsx:374-375 (onPointerDown + onMouseDown preventDefault on FilterChip wrapper)"]
  missing: []
  debug_session: ""
- truth: "Filter chips (Concept · Source · Date) have uniform visual padding so the pill widths feel rhythmic regardless of text length AND vertical breathing room is consistent (no clipped top/bottom)."
  status: fixed
  reason: "User reported original: visible padding around the chip labels is inconsistent across the three chips. Re-UAT clarification 2026-05-18: 'Vertical padding was bad, not horizontal padding issue.' Root cause: fixed `height: '32px'` on FilterChip clipped vertical pad regardless of value. Fix: drop fixed height, use padding-driven sizing (10px vert / 14px horiz)."
  severity: cosmetic
  test: 5
  root_cause: "fixed height: 32px constrained chip; vertical padding values were silently truncated by the height ceiling."
  artifacts: ["app/src/screens/SavedScreen.tsx:FilterChip style (height removed, padding 10px/14px)"]
  missing: []
  debug_session: ""
- truth: "Chip-row blur-collapse race only applies when search bar is empty; when query is non-empty the latch keeps chips mounted and chip taps reach FilterPickerSheet."
  status: fixed
  reason: "Operator clarification 2026-05-18: chip-tap-collapses only happens when search bar is empty. Refined the blur-race gap to the empty-query path specifically. Closed by the same 50-12 onPointerDown preventDefault that closed the parent G2 — both query-empty and query-nonempty paths now reach the chip onClick handler."
  severity: blocker
  test: 5
  root_cause: ""
  artifacts: ["app/src/screens/SavedScreen.tsx:374-375"]
  missing: []
  debug_session: ""
- truth: "FilterPickerSheet drawer has rigid scroll boundaries — fast-scroll near top/bottom does NOT show flicker, end-of-page, or content overshoot outside the drawer's rounded mask."
  status: fixed
  reason: "Operator reported 2026-05-18: drawer not optimized for scrolling — no safe area above/below viewable area, user sees flicker or end of page when scrolled too fast at boundary. Closed by 50-13 — overscroll-behavior: contain + WebkitOverflowScrolling: 'touch' added to BottomSheet inner scroll container (same element as overflowY: auto). Re-UAT Test 5 confirmed hard-stop at drawer mask."
  severity: major
  test: 5
  root_cause: "BottomSheet inner scroll container lacked overscroll-behavior; rubberband + scroll-chaining leaked content past the rounded mask on Android WebView + iOS WKWebView."
  artifacts: ["app/src/components/ui/BottomSheet.tsx (overscrollBehavior + WebkitOverflowScrolling on same element as overflowY)"]
  missing: []
  debug_session: ""
- truth: "Tab switch on /saved (Saved → Liked/History/Collections) preserves the search-bar query and rescopes results against the new tab's corpus. Only filters + pending debounce timer reset; query persists. Per 50-VALIDATION.md row 4."
  status: failed
  reason: "User reported: switching tabs in /saved clears the search bar. Contradicts 50-VALIDATION.md row 4 and CONTEXT D-11 (query persists, rescope). The 50-09 plan misread Pitfall 8 — should flush debounce timer, not clear query."
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Opening CollectionPickerSheet (long-press → Save to...) mounts cleanly. No 'Maximum update depth exceeded' React error in console. Device deployment is not aborted by a render-loop crash."
  status: fixed
  reason: "Regression of the 50-10 G1 fix. The reseed useEffect at CollectionPickerSheet.tsx:157-169 had originalMemberIds (a Set state it also wrote) in its dep array. Each new Set() is a fresh reference, so the effect re-fired every render, flooding the console with 'Maximum update depth exceeded' and breaking device deployment. Surfaced when operator started Test 2 re-UAT."
  severity: blocker
  test: 2
  root_cause: "useEffect dep on a Set state the same effect setOriginalMemberIds(new Set(...)) writes to. Identity-by-reference dep + reference-changing setter = unbounded re-fire loop."
  artifacts: ["app/src/components/CollectionPickerSheet.tsx:157-176", "app/tests/components/CollectionPickerSheet.no-refresh.test.mjs:NR-09"]
  missing: ["The original 50-10 source-reading regression test (NR-01..08) did not mount the component or simulate the runtime render loop. The new NR-09 parses the effect's dep array and asserts deps are exactly [postId]."]
  debug_session: ""
  fix: |
    1. Compute nextMembers Set once per effect run, share identity between setDraftMemberIds and setOriginalMemberIds.
    2. Drop actualSavedAtOpen and originalMemberIds from deps; keep [postId] only — postId is the actual baseline-change signal.
    3. Inlined originalSaved as (postId ? true : false) at the setDraftSavedChecked call site.
    4. NR-09 source-reading regression test parses the reseed useEffect and asserts deps === ['postId'].
    Verification: 9/9 no-refresh tests pass; 12/12 CollectionPickerSheet base tests pass; tsc -b --noEmit clean.
- truth: "Bookmark icon on the implicit Saved row in CollectionPickerSheet visually matches user-created collection rows when checked — same fill behavior, no jarring color shift unique to the implicit row. Long-press menu Save/Unsave row honors the same rule."
  status: fixed
  reason: "Operator reported during Test 2 re-UAT 2026-05-18: when the Saved row is checked, its bookmark icon turns dark (filled var(--primary-40) via fill='currentColor'), looking ugly and mismatching user-created collection rows whose Folder icons stay neutral on check. Re-UAT Test 4 Image #5 confirmed the SAME pattern in LongPressMenu's Save/Unsave row. Both sites used `fill={isSaved ? 'currentColor' : 'none'}` plus `color={isSaved ? 'var(--primary-40)' : 'var(--foreground)'}`."
  severity: cosmetic
  test: 2
  root_cause: "Two render sites (CollectionPickerSheet.tsx:299-303 and LongPressMenu.tsx:200-204) overloaded BOTH fill and color on isSaved. Color alone is sufficient for active-state signaling and matches the user-created folder rows that stay outlined."
  artifacts: ["app/src/components/CollectionPickerSheet.tsx (drop fill prop)", "app/src/components/LongPressMenu.tsx (drop fill prop)"]
  missing: []
  debug_session: ""
  fix: |
    Dropped `fill={isSaved ? 'currentColor' : 'none'}` from both Bookmark render sites. Color-only state signaling stays
    (color shifts to var(--primary-40) when saved/checked). Heart in LongPressMenu still uses fill on liked state — operator
    did not flag Heart, leaving that intact.
- truth: "User-saved posts (saved via the implicit Saved row of the picker) are retrievable as a 'Saved' folder in /saved → Collections tab. The implicit Saved bucket behaves as a real collection from the user's POV."
  status: failed
  reason: "Operator reported during Test 2 re-UAT 2026-05-18: 'There should be a default collection named Saved that will be checked by default when user save a post, and if user saved to that collection they can retrieve the posts in Saved collection in the saved path. Currently, there is no Saved collection in saved path, which is weird because user saved to Saved but cannot see a saved folder in that tab.' Currently the implicit Saved row is plumbed through engagementService.savePost (the global Saved bucket) and surfaces only in the Saved tab — not as a row in the Collections tab. Fix candidates: (a) auto-create a real Collection named 'Saved' on first install + treat its postIds as the canonical engagement.savedPosts bucket, dropping the special-case branch; (b) keep the implicit/explicit split but render a synthetic 'Saved' card at the top of the Collections tab that links to /saved (Saved tab). Choice is a design call — operator likely prefers (a) for consistency."
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "/saved tab structure reflects only the engagement signals the user wants to surface. Liked posts are NOT surfaced as a top-level tab if Save covers the same retrieval use case."
  status: deferred
  reason: "Operator design feedback during Test 2 re-UAT 2026-05-18: 'we probably don't need a Liked tab to display what user liked, but just use the hint to optimize recommendation system, since it overlapped with Save feature?' Suggested fix: remove the Liked tab from SavedScreen tab strip; keep Like as a pure recommendation signal (engagement-only, no /saved surface). This is a design decision, not a strict UAT bug — log as deferred for /gsd:discuss-phase or /gsd:plan-phase. Touches SavedScreen.tsx tab list + the recommendation pipeline (engagement.service consumers of Like signal)."
  severity: minor
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Tapping a bookmark icon (visual save-state badge) on /saved does NOT invoke the system keyboard. The keyboard appears only when the user explicitly taps a focusable input."
  status: fixed
  reason: "Operator reported during Test 4 re-UAT 2026-05-18 on physical device: 'When user clicked the bookmark icon in the top right corner, the system keyboard was invoked although user did not click the search bar and the search bar is not focused.' Image #6 localized the tap target: top-right Bookmark <button> on HomeScreen.tsx:813 that navigates to /saved via navigate('/saved'). Root cause: SavedScreen.tsx:1119 and CollectionDrillInScreen.tsx:539 both declared bare `autoFocus` on their rename inputs inside BottomSheet shells. BottomSheet always renders its children (translateY animation, not conditional mount), so the autoFocus fired on screen mount — focusing a hidden input and popping the keyboard."
  severity: major
  test: 4
  root_cause: "BottomSheet renders children unconditionally; bare autoFocus on hidden inputs fires on host-screen mount. Pattern is general — any future input-inside-BottomSheet must defer focus to a deliberate user gesture."
  artifacts: ["app/src/screens/SavedScreen.tsx:1117-1130 (ref + useEffect)", "app/src/screens/CollectionDrillInScreen.tsx:537-540 (ref + useEffect)", "app/tests/components/bottom-sheet-no-bare-autofocus.test.mjs (regression guard)"]
  missing: ["Project-wide invariant: no bare autoFocus on input descendants of BottomSheet. Enforced by a new source-reading test that scans every BottomSheet consumer."]
  debug_session: ""
  fix: |
    1. Replace bare autoFocus with ref + useEffect that fires only when the sheet's `open` state flips to true.
       Pattern: const ref = useRef<HTMLInputElement | null>(null);
                useEffect(() => { if (sheetOpen) requestAnimationFrame(() => ref.current?.focus()); }, [sheetOpen]);
    2. New regression test app/tests/components/bottom-sheet-no-bare-autofocus.test.mjs scans every BottomSheet consumer and asserts no bare autoFocus on input descendants. Catches the exact regression shape.
    Verification: 12/12 useLongPress tests pass, 34/34 picker + LongPressMenu tests pass, tsc clean.
- truth: "Posts saved or liked from a feed tile surface on /saved (Saved + Liked tabs) regardless of whether their body has been generated yet. Stub posts — only metadata + empty bodyMarkdown — are not silently dropped on the read path."
  status: fixed
  reason: "Operator reported during Test 5 re-UAT 2026-05-18: 'When user like or save a un-opened post (only has stub, does not have body), the post is not displayed in saved page. After this is checked, user go back to Home and click into the post to generate the body and return to saved page, the post is then displayed. This is an error, the post should be displayed in saved page no matter whether it has been opened and has body.' Root cause: engagementService.getSavedPosts and getLikedPosts both call resolvePostsByIds → postHistoryService.getPosts(). Stubs only enter postHistory when their body is generated on-open. Before that, the engagement id is stored but resolvePostsByIds silently drops it. Same root cause for collection memberships — collectionService.getCollectionPosts uses the same resolver."
  severity: major
  test: 5
  root_cause: "Single resolution path through postHistoryService. Stubs live only in the feed queue / video / news / connection caches at save time, not yet in history. resolvePostsByIds silently drops unresolvable ids (T-50-ORPHAN / D-04 graceful degradation pattern)."
  artifacts: ["app/src/services/engagement.service.ts:savePost+likePost (optional snapshot param)", "app/src/services/collection.service.ts:addPost (optional snapshot param)", "app/src/components/LongPressMenu.tsx (snapshot lookup via conceptFeedService.getPostById)", "app/src/components/CollectionPickerSheet.tsx (snapshot lookup once per handleDone)", "app/tests/services/engagement.service.test.mjs (G14 regression coverage: snapshot persists; back-compat without snapshot; idempotency)"]
  missing: []
  debug_session: ""
  fix: |
    1. engagementService.savePost(postId, snapshot?) and likePost(postId, snapshot?) — optional DailyPost parameter. When provided, calls postHistoryService.addPost(snapshot) BEFORE emitting ENGAGEMENT_CHANGED.
    2. collectionService.addPost(collectionId, postId, snapshot?) — same pattern for collection membership.
    3. LongPressMenu.tsx imports conceptFeedService and resolves snapshot via getPostById(postId) before calling save/like. Avoids circular dependency at the service layer (engagement → concept-feed cycle would form if we resolved inside engagement.service).
    4. CollectionPickerSheet.tsx resolves the snapshot once at the top of handleDone and passes it to both savePost and every collectionService.addPost call.
    5. New tests G14 in engagement.service.test.mjs: snapshot path surfaces stub on getSavedPosts/getLikedPosts; no-snapshot path leaves history untouched (back-compat); idempotency preserved (postHistoryService.addPost dedups by id; original snapshot wins).
    Verification: 17/17 engagement tests pass, 36/36 collection tests pass, 34/34 picker tests pass, tsc -b --noEmit clean.
- truth: "Long-press (480ms hold) on feed tiles fires the recognition callback on real touch hardware AND a haptic impact. LongPressMenu / CollectionPickerSheet open as expected. Sub-pixel finger jitter does not cancel the timer."
  status: fixed
  reason: "Operator reported during Test 4 re-UAT 2026-05-18 on physical device: 'the long-press on post face tiles does not work on phones (not responding to long-press event), and it actually works in a weird way in browser (mouse scroll disabled after long-press). I do feel the haptics though. This blocked the test because I cannot save a post in this way.' Root cause: useLongPress.ts:57 binds onPointerMove: cancel. On real touch hardware, sub-pixel finger jitter fires pointermove events constantly during a held press, so the 480ms timer never elapses. Mouse-driven browser works because mouse pointermove only fires on actual pixel movement. The OS-native long-press still fires haptic (Android/iOS WebView system level), which is why the user 'feels haptics' even though the JS recognizer never fires. Initial fix (b77b0f85) added the 8px threshold but did NOT call haptic — operator reported Test 4 re-UAT: 'Haptic in long-press is gone.' Follow-up: added `void hapticImpactLight()` inside the timer callback to match the sibling useLongPressOrDrag.ts:120 pattern."
  severity: blocker
  test: 4
  root_cause: "useLongPress.ts:57 cancels timer on any pointermove. Touch jitter = constant pointermoves = timer never elapses. Sibling useLongPressOrDrag.ts already implements the 8px threshold correctly. Haptic was free from OS-native long-press; with JS owning the path end-to-end the hook must fire it explicitly."
  artifacts: ["b77b0f85 (8px threshold)", "app/src/hooks/useLongPress.ts:hapticImpactLight call (haptic restore)", "app/tests/hooks/useLongPress.test.mjs (G13 regression tests)"]
  missing: ["Hook lacked movement-threshold logic AND haptic invocation. Both gaps surfaced in sequence — first the regression, then the haptic loss on the fix."]
  debug_session: ""
