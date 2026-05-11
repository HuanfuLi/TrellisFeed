---
status: resolved
phase: 43-engagement-ui
source: [43-01-shared-infra-and-locales-SUMMARY.md, 43-02-trim-presentation-style-tag-SUMMARY.md, 43-03-longpress-menu-and-masonry-integration-SUMMARY.md, 43-04-saved-screen-and-route-SUMMARY.md, 43-05-postdetail-deep-dive-trigger-SUMMARY.md, 43-06-homescreen-wiring-SUMMARY.md, 43-07-force-new-day-engagement-reset-SUMMARY.md]
started: 2026-05-11T09:35:43Z
updated: 2026-05-11T13:35:00Z
---

## Current Test

[testing paused — 1 blocked item (Test 4) outstanding; re-test after gap #1 fix]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Vite dev server. Clear ephemeral state if desired (rm -rf app/node_modules/.vite app/dist). Start the app fresh (cd app && npm run dev). Server boots without errors. Open http://localhost:5173/ → HomeScreen renders masonry feed, no blank screen, no console errors.
result: pass

### 2. Long-Press Menu Opens With State-Aware Labels
expected: On HomeScreen, press and hold any feed tile for ~480ms (don't drag). A bottom-sheet menu opens with 3 rows: Like, Save, Not interested. If the tile is already saved/liked, the corresponding row label flips to "Unsave" / "Unlike". Tapping outside or pressing back dismisses the menu without action.
result: issue
reported: "Only showed Like and Save, did not show \"Not interested\". Possibly blocked by bottom navigation bar"
severity: major

### 3. Save & Like Confirmation Toast + Corner-Icon Overlay
expected: Open the long-press menu on a tile, tap Save. Toast appears confirming "Saved". A small bookmark icon overlays the tile's corner (read-only — not a tap target). Long-press the same tile → row now reads "Unsave". Repeat with Like → toast "Liked" + heart corner icon. Re-tap Unsave/Unlike from the menu → toast confirms removal + corner icon disappears.
result: pass
note: "User reported a cosmetic enhancement (logged as separate gap): saved/liked corner icons blend into image/thumbnail backgrounds; needs a small round-shaped background that matches light/dark theme."

### 4. Dismiss Fades ALL Same-Anchor Tiles
expected: Find an anchor-concept that has multiple tiles in the feed (text + image + video sharing the same anchor). Long-press any one → Not interested → toast confirms "Got it — you won't see this again". ALL tiles sharing that anchor fade out with a smooth exit transition (not just the tapped tile). The masonry layout reflows without a visible gap.
result: blocked
blocked_by: prior-phase
reason: "Blocked by issue #1 (Test 2 gap — Not Interested row clipped by bottom navigation bar). Cannot see or tap the Dismiss action; re-test after gap #1 is fixed."

### 5. Bookmark Icon → /saved Screen → Saved | Liked Tabs
expected: HomeScreen header (top-right) shows a Bookmark icon. Tap it → navigates to /saved. Screen header reads "Saved", back-arrow returns to /home. Two tabs at top: Saved | Liked. Saved tab lists all posts you've saved (compact card layout). Liked tab lists all posts you've liked. Empty tab shows empty-state copy. Tapping a row opens that post's detail screen.
result: pass
note: "User reported a positioning bug (logged as separate gap): Bookmark icon is fixed to viewport instead of HomeScreen header row, overlaps + interferes with TrellisProgressBar on scroll. Should be inline with 'Good Morning' greeting."

### 6. Deep Dive Button Streams Deeper Essay
expected: Open any post detail screen (tap a feed tile). Below the essay body and above the takeaway, a full-width "Deep Dive" button is visible (subtle styling, not loud). Tap it → essay re-streams in-place with a longer, more detailed version (350–600 words vs. the standard 150–250). No visual jump, no scroll drift. After streaming finishes, the button is replaced by a segmented Standard | Deep toggle.
result: pass

### 7. Standard | Deep Segmented Toggle (No Re-Stream)
expected: On a post where Deep Dive has already streamed (previous test), the segmented Standard | Deep toggle is visible above the essay. Tapping Standard instantly shows the original 150–250w essay. Tapping Deep instantly shows the cached 350–600w deep version. No re-stream, no network call, no loading spinner — toggle is purely client-side.
result: issue
reported: "Partial: the toggle appeared below essay instead of above essay. It appeared between essay body and takeaway section. You are right to design it above essay, I guess the prior decision was confusing."
severity: minor

### 8. ANCHOR_DISMISSED Resync On Return To Home
expected: On HomeScreen, note an anchor-concept tile. Tap it to open detail. Inside PostDetail (or via /saved), trigger a dismiss on that anchor via the long-press menu (or any other dismiss surface). Navigate back to /home. The dismissed anchor's tiles are gone from the feed (no need to swipe-for-more or pull-to-refresh).
result: skipped
reason: "Test design error: dismiss is only available via HomeScreen feed-tile long-press menu — there is no dismiss surface on PostDetail or /saved. The plan-summary anticipated cross-screen dismiss (Effect B `[location.pathname]` re-read pathway), but no such surface ships in Phase 43, so Effect B has no exercisable user path to validate via UAT. HomeScreen-internal dismiss + immediate fade is covered by Test 4 (currently blocked behind gap #1 — Dismiss row clipping)."

### 9. Force-New-Day Resets Engagement State
expected: Settings → Data → tap "Force New Day" (dev affordance). Confirmation prompt appears, confirm it. Toast confirms success. Navigate to /saved → both Saved and Liked tabs are empty. Return to /home → previously dismissed anchors reappear in the feed. Corner-icon overlays on tiles (bookmark / heart) are all gone.
result: issue
reported: "Wait. Why should new day reset this? Saved/Liked should be persistent so that user can look back at their saved/liked posts I think? There may be a decision mistake"
severity: major

### 10. NEWS Chip Removed From News Tiles
expected: Scroll the masonry feed until you find a news-style tile (sourced via Tavily web-search, has a small "via {publisher}" attribution). The tile no longer shows a "NEWS" presentation-style chip/badge in its header. Other tile types (image, text-art, video, suggestion) similarly have no presentation-style chip. Source attribution + question chips remain intact.
result: pass

## Summary

total: 10
passed: 5
issues: 5
pending: 0
skipped: 1
blocked: 1

## Gaps

- truth: "Long-press menu shows 3 rows: Like, Save, Not interested (the third Dismiss row is visible and tappable, not clipped by the bottom navigation bar)"
  status: resolved
  reason: "User reported: Only showed Like and Save, did not show \"Not interested\". Possibly blocked by bottom navigation bar"
  severity: major
  test: 2
  root_cause: "BottomSheet (app/src/components/ui/BottomSheet.tsx) renders in-tree without React Portal. It mounts inside HomeScreen, which lives inside a SwipeTabContainer slot whose transform: translateZ(0) creates a containing block that captures the sheet's position: fixed. The sheet anchors to the SLOT bottom (a separate stacking context from the viewport). BottomNavigation (position: fixed, bottom: 0, zIndex: 100, ~80-110px tall) is rendered OUTSIDE the strip and correctly anchors to the viewport. Because the two layers are in different stacking contexts, the BottomSheet's zIndex: 500 does NOT win against the nav's zIndex: 100. Sheet height ~244px (3 rows) but Row 3 (Dismiss) occupies viewport-bottom 0-96px which is fully behind the nav. Same bug class as Phase 32.1 Header positioning."
  artifacts:
    - path: "app/src/components/ui/BottomSheet.tsx"
      issue: "Missing createPortal(node, document.body) wrap; missing nav-clearance padding"
    - path: "app/src/screens/HomeScreen.tsx (lines 952-963)"
      issue: "Misleading comment claims 'portals to document.body' (aspirational, not implemented)"
  missing:
    - "Wrap BottomSheet inner JSX in createPortal(<div>...</div>, document.body) with SSR-safe typeof document === 'undefined' guard"
    - "Add bottom-clearance: either paddingBottom: 'calc(40px + 80px + var(--safe-area-bottom))' on inner sheet OR bottom: 'calc(80px + var(--safe-area-bottom))' so sheet sits above nav"
    - "Update HomeScreen.tsx:952-957 comment to be accurate after fix"
    - "Add regression test app/tests/components/BottomSheet.portal.test.mjs asserting createPortal in source"
  debug_session: ".planning/debug/dismiss-row-clipped-by-bottom-nav.md"

- truth: "Saved/liked corner icons on feed tiles have sufficient contrast against image/thumbnail backgrounds in both light and dark themes"
  status: resolved
  reason: "User reported (alongside Test 3 pass): the liked/saved signs have no background and blends with image/thumbnail behind. Can add a small round shaped background (remember to match light/dark theme)"
  severity: cosmetic
  test: 3
  root_cause: "In app/src/components/MasonryFeed.tsx lines 387-419 (TileWrapper's cornerOverlay), saved/liked icons render as bare lucide-react Bookmark/Heart SVGs inside an absolute-positioned div with NO background, NO padding, NO border-radius — only a faint per-icon drop-shadow(0 1px 2px rgba(0,0,0,0.25)) which is insufficient against busy image/video thumbnails. Secondary bug: Heart uses fill='var(--node-salmon)' which in .dark mode (index.css:233) becomes near-black tint — heart icon disappears entirely in dark theme. Dark mode uses .dark class selector (not [data-theme='dark'])."
  artifacts:
    - path: "app/src/components/MasonryFeed.tsx (lines 387-419)"
      issue: "cornerOverlay div has no chip backdrop; Heart uses --node-salmon which inverts in dark theme"
    - path: "app/src/index.css (:root + .dark blocks)"
      issue: "No CSS vars defined for corner-chip backdrop / fg colors"
  missing:
    - "Add CSS vars to index.css :root + .dark: --corner-chip-bg (rgba(0,0,0,0.55) light / rgba(255,255,255,0.20) dark), --corner-chip-fg-saved (#FFFFFF both), --corner-chip-fg-liked (#E57373 light / #FF8A80 dark)"
    - "Wrap each icon in a circular chip <span> (26x26px, borderRadius 999px, backgroundColor var(--corner-chip-bg), boxShadow var(--shadow-1))"
    - "Remove fill='var(--node-salmon)' on Heart; use --corner-chip-fg-liked instead"
    - "Drop per-icon drop-shadow filter (chip box-shadow replaces it)"
  debug_session: ".planning/debug/engagement-corner-icon-no-background.md"

- truth: "HomeScreen Bookmark icon is anchored to the page header (inline with the 'Good Morning' greeting row) and scrolls with the page like a normal element — does not overlap or interfere with the TrellisProgressBar on scroll"
  status: resolved
  reason: "User reported (alongside Test 5 pass): the bookmark icon is wrongly fixed on screen position (canvas?) instead of page, and it does not move when user scroll just like a normal element (like post tiles). When user scroll down and trellis progress bar show up, the bookmark icon overlaps and interferes with progress bar. Should fix the bookmark icon in the same line of 'Good Morning'"
  severity: minor
  test: 5
  root_cause: "Bookmark icon is rendered at app/src/screens/HomeScreen.tsx:657-679 as a standalone <button> with explicit position: 'fixed', top: 'calc(var(--safe-area-top) + 8px)', right: '16px', zIndex: 195. Placed OUTSIDE the scroll container (containerRef on line 706), as sibling of the compact VineProgress bar (lines 681-705, also position: 'fixed', top: 'var(--safe-area-top)', zIndex: 190). The block comment on lines 651-656 explicitly calls out Phase 43-06 SV-02 intent — implementation matches its own design, but the design itself conflicts with operator expectation. Overlap is unavoidable while both are viewport-fixed. HomeScreen.tsx:727-729 already has an inline greeting <h1> inside the scroll container — the ideal anchor point for the bookmark. Header.tsx is NOT involved (HomeScreen uses bespoke fixed button, not Header right slot)."
  artifacts:
    - path: "app/src/screens/HomeScreen.tsx:651-679"
      issue: "Fixed-position Bookmark button block (to be deleted)"
    - path: "app/src/screens/HomeScreen.tsx:727-729"
      issue: "Existing inline greeting <h1> (new wrapper site)"
  missing:
    - "DELETE the entire fixed-position bookmark block at HomeScreen.tsx:651-679 (button + preceding 6-line comment)"
    - "WRAP existing greeting <h1> at lines 727-729 in flex row (justifyContent: space-between, gap: 12px) containing both greeting and inline Bookmark button"
    - "Inline button uses 44x44px minimum tap floor, marginRight: -8px optical alignment, color: var(--muted-foreground), Bookmark size 22"
    - "Remove zIndex: 195 — no longer needed once icon is in flow"
  debug_session: ".planning/debug/bookmark-icon-viewport-fixed.md"

- truth: "PostDetailScreen Deep Dive button AND Standard | Deep segmented toggle are positioned ABOVE the essay body (so users see the depth-control affordance BEFORE reading), not between essay body and takeaway"
  status: resolved
  reason: "User reported (alongside Test 7 issue): the toggle appeared below essay instead of above essay. It appeared between essay body and takeaway section. You are right to design it above essay, I guess the prior decision was confusing. -- This is an operator-decision update: original Phase 43-05 CONTEXT placement was 'below body / above takeaway'; updated preference is 'above essay body'. Applies to BOTH the Deep Dive button (pre-stream) and the segmented Standard | Deep toggle (post-stream / cached state)."
  severity: minor
  test: 7
  root_cause: "In PostDetailScreen.tsx, the renderDeepDiveControls() invocation is placed at line 1046, inside <article>, immediately after the scroll-70% sentinel (line 1041) and BEFORE the takeaway block (lines 1047-1062). Matches original Phase 43-05 CONTEXT ('below body / above takeaway'). renderDeepDiveControls() is a single function (lines 595-702) returning one of three JSX trees (Restore Standard / Standard|Deep segmented / DeepDiveButton CTA). ONE invocation move relocates ALL surfaces. Essay body container is at lines 986-1039 with minHeight: '200px'. Scroll-70% sentinel at line 1040-1041 is Detector A (CONCEPT_EXPLORED emit) — must stay in place. handleStartDeepDive / handleRestoreStandard internals (16 abort guards + 6 signal-arg passes + cache-write guard) are unaffected."
  artifacts:
    - path: "app/src/screens/PostDetailScreen.tsx:1046"
      issue: "renderDeepDiveControls() invocation positioned after essay body, before takeaway"
    - path: "app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs (lines 28-45 DD-01 test)"
      issue: "Positional assertion sentinelJsxIdx < invocationIdx will fail after move"
  missing:
    - "Single JSX block move: relocate line 1042-1046 (renderDeepDiveControls invocation) to a position BETWEEN line 985 (video AI-summary heading end) and line 987 (essay body container opener)"
    - "Leave scroll-sentinel <div ref={scrollSentinelRef}> at line 1041 in place (Detector A)"
    - "No changes to handleStartDeepDive / handleRestoreStandard / renderDeepDiveControls internals"
    - "Update DD-01 test in PostDetailScreen.deep-dive-trigger.test.mjs: replace sentinelJsxIdx < invocationIdx with invocationIdx < essayBodyContainerIdx (use minHeight: '200px' as anchor); keep invocationIdx < takeawayIdx (naturally satisfied)"
    - "segmented-toggle.test.mjs and abort-contract.test.mjs need no positional updates"
  debug_session: ".planning/debug/deep-dive-toggle-below-essay-body.md"

- truth: "Force-New-Day resets ONLY the dismissed-anchors list (so previously hidden tiles return tomorrow); it does NOT wipe the user's Saved or Liked archives, which are persistent across days"
  status: resolved
  reason: "User flagged a design mistake: Saved/Liked should be persistent so that user can look back at their saved/liked posts. The current Phase 43-07 implementation calls engagementService.reset() inside SettingsDataScreen.handleForceNewDay, which wipes ALL three lists (saved + liked + dismissed). Phase 43 SUMMARY already lists 'resetDismissedOnly() partial-reset API' under 'Deferred Polish' — that polish is now load-bearing for correct UX. Fix: add engagementService.resetDismissedOnly() method (only wipes the dismissed array; leaves saved + liked intact) and update SettingsDataScreen.handleForceNewDay to call it instead of reset(). Update the SC-6 test (tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs) to assert resetDismissedOnly() call + non-wipe of saved/liked."
  severity: major
  test: 9
  root_cause: "Phase 43-07 wired engagementService.reset() into SettingsDataScreen.handleForceNewDay at line 138. reset() is Phase 39 D-08's wholesale wipe — saveState(freshState()) where freshState() = { saved: [], liked: [], dismissed: [] } (engagement.service.ts:38-40, 207-209). Clears all three collections in one call. No partial-reset API exists. The dismissed-list wipe is correct UX (previously-hidden tiles return tomorrow), but the saved + liked wipes violate operator's 'saved/liked are persistent user archives' intent. The inline comment at SettingsDataScreen.tsx:135-137 even acknowledges: 'Granularity per Phase 39 D-08 is full-reset — saves + likes + dismisses all clear in one call.' Full reset() must remain for Clear-All-Data / settingsService.reset() paths."
  artifacts:
    - path: "app/src/services/engagement.service.ts:207-209"
      issue: "reset() is wholesale wipe via saveState(freshState()); no per-collection granularity"
    - path: "app/src/screens/settings/SettingsDataScreen.tsx:138"
      issue: "Calls engagementService.reset() (over-resets saved + liked)"
    - path: "app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs"
      issue: "All four SC-6 assertions pinned to old reset() name"
  missing:
    - "Add engagementService.resetDismissedOnly() in engagement.service.ts: load state, early-return if dismissed.length === 0 (idempotent), set state.dismissed = [], saveState(state), emit ENGAGEMENT_CHANGED with kind: 'undismiss' and sentinel id: '*'. Leaves state.saved and state.liked untouched."
    - "Update SettingsDataScreen.tsx:138 to call engagementService.resetDismissedOnly() instead of reset()"
    - "Rewrite SettingsDataScreen.tsx:135-137 comment to reflect new semantics (saved/liked persistent across days)"
    - "Update SC-6 test: rename regex/indexOf targets from engagementService.reset() to engagementService.resetDismissedOnly() in tests 2/3/4"
    - "Add negative-invariant test: engagementService.reset() does NOT appear in handleForceNewDay body"
    - "Add source-reading test against engagement.service.ts asserting resetDismissedOnly() exists, mutates state.dismissed = [], does NOT touch state.saved or state.liked, emits ENGAGEMENT_CHANGED with kind 'undismiss'"
    - "Keep reset() method unchanged — still useful for Clear-All-Data refactors and settingsService.reset()"
  debug_session: ".planning/debug/force-new-day-wipes-saved-liked.md"
