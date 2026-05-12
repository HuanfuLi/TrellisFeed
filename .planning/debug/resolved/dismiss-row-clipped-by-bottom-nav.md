---
status: resolved
trigger: "Long-press menu third row (Not interested / Dismiss) invisible; operator suspects BottomNavigation bar clipping the bottom-sheet menu"
created: 2026-05-11T10:00:00Z
updated: 2026-05-12T00:00:00Z
followup_2026-05-12: |
  First-pass fix (commit d4d5b0f1, 2026-05-11) used `bottom: 'calc(80px + var(--safe-area-bottom))'`
  on the inner sheet. Operator screenshot 2026-05-12 showed the closed sheet now covered the
  BottomNavigation: with the bottom anchored 80px above viewport-bottom, transform: translateY(100%)
  only moved the sheet down by its OWN height — leaving a sheet-tail of height ~80px visible
  over the nav between (viewport-bottom - 80px) and viewport-bottom.
  Re-fix: anchor sheet to bottom: 0 so translateY(100%) fully hides it; move nav-clearance into
  paddingBottom: calc(24px + 80px + var(--safe-area-bottom)) on the inner sheet content. Test
  rewritten with the new invariant + negative invariant against the old bottom: calc(...) placement.
---

## Current Focus

hypothesis: |
  BottomSheet renders in-tree inside the SwipeTabContainer slot (transform: translateZ(0)
  containing block). Its position:fixed -> position:absolute bottom:0 anchors to the SLOT
  bottom = viewport bottom. The BottomNavigation (position:fixed, bottom:0, zIndex:100,
  ~80-110px tall) sits over the same region. Since BottomSheet has no bottom offset
  for BottomNavigation height and no portal, the sheet's bottom rows physically render
  BEHIND the nav bar. With 3 rows of ~56px each + 40px bottom padding ≈ 224px sheet,
  the Dismiss row (bottom-most ~96px) is fully eclipsed by the ~110px nav bar.
test: |
  Read BottomSheet.tsx for createPortal usage. Confirm no portal. Verify the parent
  slot containment block in SwipeTabContainer.tsx. Compute sheet height vs nav height.
expecting: |
  No createPortal => sheet in-tree => slot translateZ(0) is containing block =>
  sheet anchored to slot bottom => overlap with fixed nav => clipping.
next_action: confirm root cause and return diagnosis

## Symptoms

expected: |
  Long-press on any feed tile on HomeScreen opens a bottom-sheet menu with 3 rows
  visible and tappable: Like (or Unlike), Save (or Unsave), Not interested. All 3 rows
  render above the BottomNavigation bar without clipping.
actual: |
  Only Like and Save rows show. "Not interested" (Dismiss) is invisible — apparently
  hidden behind the BottomNavigation bar.
errors: None reported
reproduction: |
  Test 2 in .planning/phases/43-engagement-ui/43-UAT.md. Long-press a feed tile on
  HomeScreen for ~480ms. Observe the BottomSheet that appears.
started: 2026-05-11 — Phase 43 UAT (Phase 43 first to introduce LongPressMenu/BottomSheet on HomeScreen)

## Eliminated

- hypothesis: BottomSheet portals to document.body but z-index < BottomNavigation
  evidence: |
    BottomSheet.tsx contains no createPortal/ReactDOM import. The "portals to
    document.body" wording in HomeScreen.tsx:955 comment is ASPIRATIONAL, not
    implemented. zIndex 500 vs 100 ordering is irrelevant because the sheet
    never reaches document.body — it stays inside the slot's containing block.
  timestamp: 2026-05-11T10:04:00Z

## Evidence

- timestamp: 2026-05-11T10:01:00Z
  checked: app/src/components/ui/BottomSheet.tsx (entire 76-LOC file)
  found: |
    - Outer overlay: position:fixed inset:0 zIndex:500
    - Inner sheet: position:absolute bottom:0 left:0 right:0
    - compact mode: minHeight:'auto', maxHeight:'50vh'
    - padding:'20px 16px 40px' (40px bottom)
    - NO createPortal, NO ReactDOM.createPortal, NO portal mechanism at all
    - No bottom offset for BottomNavigation
    - No env(safe-area-inset-bottom) padding
  implication: |
    The "position:fixed" on the overlay is captured by the nearest ancestor
    with a transform — which is the SwipeTabContainer slot div with
    transform:translateZ(0). The sheet anchors to slot bottom, NOT viewport
    bottom. AND no offset is applied for the BottomNavigation's footprint.

- timestamp: 2026-05-11T10:02:00Z
  checked: app/src/components/SwipeTabContainer.tsx lines 252-280
  found: |
    Each of the 5 screen slots wraps screen content in a div with:
      style={{ width:'100vw', flexShrink:0, height:'100dvh',
               overflow:'hidden', transform:'translateZ(0)' }}
    Code comment line 273-275 explicitly says: "Creates a per-slot containing
    block so position:fixed elements (Header, modals) are scoped to their own
    screen, not the strip." BottomNavigation (children prop) renders OUTSIDE
    the strip (not in this map), so the nav escapes the containing block.
  implication: |
    Confirms the asymmetry: BottomNavigation uses fixed-positioning relative
    to the viewport; BottomSheet uses fixed-positioning relative to the slot
    (which equals viewport in size but is a separate containing block, so
    z-index between the two layers is in DIFFERENT stacking contexts — they
    DO NOT compare). This is the same bug class as Phase 32.1's Header
    positioning issue documented in CLAUDE.md.

- timestamp: 2026-05-11T10:02:30Z
  checked: app/src/components/BottomNavigation.tsx lines 167-178 + 188
  found: |
    motion.nav: position:fixed bottom:0, padding:8px,
                paddingBottom:'calc(8px + var(--safe-area-bottom))', zIndex:100.
    Inner row: height:64px.
    Total nav height: 8 + 64 + 8 + safe-area-bottom ≈ 80–110px.
  implication: |
    The nav occupies ~80–110px at the viewport bottom. Without ANY offset
    on the BottomSheet for this footprint, the bottom ~110px of the sheet
    sits behind the nav.

- timestamp: 2026-05-11T10:03:00Z
  checked: BottomSheet compact mode rendered height calculation
  found: |
    3 rows × 56px minHeight = 168px row content
    + flexbox gap 8px × 2 = 16px between rows
    + 20px top padding + 40px bottom padding = 60px
    Total: 168 + 16 + 60 = 244px from slot bottom (= viewport bottom).
    Row 3 (Dismiss) occupies the bottom-most ~56px + 40px padding zone =
    bottom 96px of the sheet. Nav footprint = bottom ~110px of viewport.
    Result: Row 3 is fully behind the nav. Row 2 (Save) bottom edge is at
    ~152px from viewport bottom — clears nav (>110px). Row 1 (Like) is at
    ~216px — clears nav. Matches reported symptom EXACTLY: "Only Like and
    Save shown, Not interested missing."
  implication: |
    Geometric proof of clipping. The Dismiss row is rendered but physically
    occluded by the BottomNavigation.

- timestamp: 2026-05-11T10:03:30Z
  checked: HomeScreen.tsx:952-963 LongPressMenu host comment
  found: |
    Comment claims: "BottomSheet inside LongPressMenu portals to
    document.body via position:fixed at zIndex 500" — this is FALSE.
    There is no portal in BottomSheet.tsx. The author wrote the comment
    intending to portal, then either omitted the createPortal call or
    referred to the wrong file. The actual rendering is in-tree.
  implication: |
    Confirms developer intent was to portal (per CLAUDE.md Header pattern
    for sub-screens). The bug is a missing implementation, not a design
    misunderstanding.

## Resolution

root_cause: |
  BottomSheet (app/src/components/ui/BottomSheet.tsx) renders in-tree without
  React Portal. It is mounted inside HomeScreen, which lives inside a
  SwipeTabContainer slot div whose `transform: translateZ(0)` creates a
  containing block that captures `position: fixed`. The sheet therefore
  anchors to the SLOT bottom (= viewport bottom in size, but a separate
  stacking context from the viewport). The BottomNavigation has
  `position: fixed` AND lives OUTSIDE the strip (rendered as `children` of
  SwipeTabContainer), so it correctly anchors to the viewport with z-index:100.

  Because the two are in different stacking contexts AND the BottomSheet
  applies no offset for the BottomNavigation's ~80–110px footprint, the
  bottom rows of the compact sheet (3 rows × 56px + 40px bottom padding
  ≈ 244px tall) get physically eclipsed by the nav. Geometric math shows
  the Dismiss row (row 3) sits at roughly y = viewport-bottom + 0–96px,
  fully inside the nav's ~110px footprint. Rows 1+2 clear the nav, which
  matches the reported symptom exactly.

  This is the same bug class as Phase 32.1's Header positioning issue,
  documented in CLAUDE.md ("Header positioning — load-bearing"). The fix
  pattern is also documented there: sub-screen modal-style overlays must
  use createPortal to document.body to escape ancestor transforms.

fix: empty
verification: empty
files_changed: []
