---
status: resolved
trigger: "bookmark-icon-viewport-fixed — HomeScreen Bookmark icon overlaps TrellisProgressBar"
created: 2026-05-11T00:00:00Z
updated: 2026-05-11T13:40:00Z
---

## Current Focus

hypothesis: CONFIRMED — Bookmark icon is rendered as a standalone position:fixed <button> outside the scroll container (HomeScreen.tsx lines 651-679, Phase 43-06 SV-02). It does not scroll with content and visually overlaps the compact VineProgress bar (also fixed) that slides in at the same top region.
test: (no further test needed — direct source inspection confirmed)
expecting: (resolved)
next_action: Return ROOT CAUSE FOUND to caller (find_root_cause_only mode).

## Symptoms

expected: |
  HomeScreen Bookmark icon is positioned inline within the page header content (alongside "Good Morning" greeting row), scrolls with the page like a normal element. When user scrolls down and TrellisProgressBar appears at the top of the viewport, the Bookmark icon is already scrolled out of view — no overlap, no interference.
actual: |
  Bookmark icon is wrongly fixed on screen/canvas position. It does not move when scrolling. When TrellisProgressBar appears at top, bookmark icon overlaps and interferes with progress bar. Should be in the same line as 'Good Morning' greeting.
errors: None reported
reproduction: |
  Test 5 in .planning/phases/43-engagement-ui/43-UAT.md. Open HomeScreen, scroll down. Observe Bookmark icon does not scroll out of view, overlaps TrellisProgressBar when it slides in.
started: Phase 43 UAT on 2026-05-11

## Eliminated

(none — first hypothesis was correct)

## Evidence

- timestamp: 2026-05-11
  checked: HomeScreen.tsx lines 651-679 (Phase 43-06 SV-02 bookmark icon block)
  found: |
    The Bookmark icon is rendered as a top-level <button> with explicit
    position: 'fixed', top: 'calc(var(--safe-area-top) + 8px)', right: '16px',
    zIndex: 195. Placed OUTSIDE the scroll container (line 706 containerRef
    `<div overflowY: auto>`) as a sibling of the compact VineProgress bar.
  implication: |
    Because the button is position:fixed, it does not participate in the
    scroll container's flow. It stays pinned to the HomeScreen slot's
    containing block (the SwipeTabContainer slot's translateZ(0)) and never
    scrolls away with content. The block comment on lines 651-656 explicitly
    states this is intentional ("Position fixed scoped to the HomeScreen
    swipe slot") — implementation matches its own design comment.

- timestamp: 2026-05-11
  checked: HomeScreen.tsx lines 680-705 (compact VineProgress bar)
  found: |
    The compact progress bar is also position:fixed at top: var(--safe-area-top)
    with zIndex: 190. It slides in (translateY 0) when showCompactBar = true
    (i.e. when the inline VineProgress card has scrolled out of view).
  implication: |
    Both the bookmark (zIndex 195) and the compact progress bar (zIndex 190)
    occupy the same fixed top region of the viewport. The bookmark sits at
    safe-area-top + 8px and the progress bar at safe-area-top — they overlap
    visually. Bookmark renders ON TOP (higher zIndex) but visually interferes
    with the progress bar.

- timestamp: 2026-05-11
  checked: HomeScreen.tsx lines 717-729 (inline content layout)
  found: |
    Inside the scroll container, the first flex child is the inline greeting
    `<h1>{getGreeting()}</h1>` at lines 727-729 ("Inline greeting — scrolls
    away naturally"). The flex column has gap: 16px, padding: 16px, and is
    centered with maxWidth 448px.
  implication: |
    The "Good Morning" greeting is already an inline element inside the
    scroll container, sized to the same 448px max-width column as the rest
    of HomeScreen content. The operator's request "should fix the bookmark
    icon in the same line of 'Good Morning'" maps cleanly: wrap the <h1>
    and a new inline Bookmark <button> in a flex row (justify-content:
    space-between) and DELETE the fixed-position button block (lines 651-679).

- timestamp: 2026-05-11
  checked: components/ui/Header.tsx — auto-portal Header pattern
  found: |
    Header is fixed-positioned and is NOT used by HomeScreen for the
    bookmark icon. HomeScreen uses a bespoke fixed <button>, not Header's
    right slot. This confirms the issue is NOT a Header consumer pattern —
    it's an isolated fixed-position floating button.
  implication: |
    The fix is purely local to HomeScreen.tsx — no Header.tsx change needed.

## Resolution

root_cause: |
  HomeScreen.tsx lines 651-679 render the Bookmark icon as a standalone
  position:fixed <button> at top: calc(var(--safe-area-top) + 8px), right: 16px,
  zIndex: 195. This was an intentional Phase 43-06 SV-02 design ("scoped to
  HomeScreen swipe slot via SwipeTabContainer's translateZ(0)"), but it
  conflicts with two requirements that emerged at UAT:
    (1) operator wants the bookmark to scroll away with the page header
    (2) the compact VineProgress bar slides in at the same fixed top region
        (top: var(--safe-area-top), zIndex 190) when content scrolls, and
        the bookmark visually overlaps it.
  The fix is to move the bookmark from a fixed-position viewport-anchored
  button to an INLINE element inside the scroll container, on the same row
  as the existing greeting <h1>.

fix: (suggested — operator to confirm)
  1. DELETE lines 651-679 (the entire fixed-position Bookmark button block
     and its preceding comment).
  2. WRAP the existing greeting <h1> on lines 727-729 in a flex row that
     contains both the greeting and a new inline Bookmark <button>:

       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
         <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
           {getGreeting()}
         </h1>
         <button
           type="button"
           aria-label={t('saved.title')}
           onClick={() => navigate('/saved')}
           style={{
             background: 'none',
             border: 'none',
             cursor: 'pointer',
             padding: '8px',
             marginRight: '-8px',
             minWidth: '44px',
             minHeight: '44px',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             color: 'var(--muted-foreground)',
           }}
         >
           <Bookmark size={22} />
         </button>
       </div>

  Notes:
   - Keep the 44×44 WCAG tap floor (minWidth/minHeight).
   - marginRight: -8px optically aligns the icon glyph to the 16px container
     padding-right (since the button has 8px internal padding); matches the
     same trick used in Header.tsx for the back button (marginLeft: -8px).
   - Remove the explicit `margin: 0` if the existing <h1> doesn't have a
     UA-default margin issue inside the flex row (check rendering).
   - zIndex 195 is no longer needed — the icon participates in normal
     scroll flow and naturally disappears when scrolled past.

verification: (to be done in fix phase — not in scope for find_root_cause_only)
files_changed: []
