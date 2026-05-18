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
updated: 2026-05-18T00:00:00Z
---

## Current Test

[testing complete]

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
result: issue
reported: |
  "Fail: 1. Saved collection is NOT pre-checked as expected. 2. In the inline
  collection creation process, after user clicked the 'Save name' button, no
  new collection was displayed until user refresh the page. This refresh issue
  has happened dozens of times during this project implementation, please take
  it into your memory and keep in mind: Mobile app users do not have the refresh
  option!"
severity: major

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
result: issue
reported: |
  "Partial: Would work but has false positives sometimes. Screenshot: searched
  '3D printing' on Liked tab, top hit is a Kanji video. Body snippet has many
  scattered single-char/2-char highlights ('i R', 'di', 'T', 'nd', 'ti', 'n',
  'R', 'R', 'eco', 'gniti'). User asks if this is a plugin (Fuse.js) issue or
  app issue."
severity: major
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
result: issue
reported: |
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
passed: 3
issues: 4
pending: 0
skipped: 1
blocked: 0

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
  status: failed
  reason: "User reported: tapping a chip is registered as a blur on the search bar, the chip-row collapses, and the chip's own tap handler never fires. Chips are non-interactive in practice."
  severity: blocker
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Filter chips (Concept · Source · Date) have uniform visual padding so the pill widths feel rhythmic regardless of text length."
  status: failed
  reason: "User reported: visible padding around the chip labels is inconsistent across the three chips (see UAT Test 5 screenshot)."
  severity: cosmetic
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Chip-row blur-collapse race only applies when search bar is empty; when query is non-empty the latch keeps chips mounted and chip taps reach FilterPickerSheet."
  status: failed
  reason: "Operator clarification 2026-05-18: chip-tap-collapses only happens when search bar is empty. When search bar has text, the drawer can expand. Refines the blur-race gap above to the empty-query path specifically."
  severity: blocker
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "FilterPickerSheet drawer has rigid scroll boundaries — fast-scroll near top/bottom does NOT show flicker, end-of-page, or content overshoot outside the drawer's rounded mask."
  status: failed
  reason: "Operator reported 2026-05-18: drawer not optimized for scrolling — no safe area above/below viewable area, user sees flicker or end of page when scrolled too fast at boundary. Suggests rigid boundary instead of flexible. Screenshot: FilterPickerSheet open from /saved with 'System' query, showing Few-Shot Learning / Transformer Architecture / Prompt Engineering / SSDs vs RAM / Feynman Technique. Fix candidates: overscroll-behavior:contain on inner scroll container; clip mask on outer + overflow:auto on inner; fixed-height clip wrapper."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
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
