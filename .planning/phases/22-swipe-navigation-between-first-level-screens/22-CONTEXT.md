# Phase 22: Swipe Navigation Between First-Level Screens - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable horizontal swipe gestures to switch between the 5 top-level tabs (Home, Planner, Ask, Graph, Settings). Includes real-time bottom nav tracking, slide animations, gesture conflict resolution, and mounting strategy changes. Sub-screens (Review, Podcast, PostDetail, etc.) are not part of the swipe sequence.

</domain>

<decisions>
## Implementation Decisions

### Screen Order & Scope
- **D-01:** All 5 screens participate in the swipe sequence: Home → Planner → Ask → Graph → Settings (matches bottom nav layout 1:1)
- **D-02:** Swipe navigation is disabled on sub-screens (Review, Podcast, PostDetail, AnchorDetail, ClusterDetail, QuestionDetail). User must be on a top-level screen to swipe.
- **D-03:** Bottom nav highlight tracks the swipe gesture in real-time (proportional to drag position), not just snapping after completion.
- **D-04:** Tapping a bottom nav tab triggers the same slide animation as swiping (not instant navigation).
- **D-05:** When tapping a non-adjacent tab (e.g., Home → Settings), slide directly from current to target — do not animate through intermediate screens.
- **D-06:** During a swipe drag, both the current screen and the adjacent screen are visible simultaneously (live peek / side-by-side sliding).

### Gesture Conflicts
- **D-07:** Axis lock after ~10px of movement. Whichever axis dominates (horizontal or vertical) wins; the other is ignored until touch ends. Standard mobile axis-locking pattern.
- **D-08:** Nav swipe is suppressed when touch starts inside a horizontal-draggable element (PostCarousel, mind-elixir graph canvas). Inner element handles its own drag.
- **D-09:** Swipe navigation is disabled when the soft keyboard is open (input focused on Ask screen). Prevents accidental screen switches mid-typing.
- **D-10:** On GraphScreen, swipe is disabled inside the mind-elixir container (graph panning takes priority). Swiping from outside the graph container (e.g., any chrome/header area) still navigates.

### Mounting Strategy
- **D-11:** All 5 top-level screens are always-mounted with `display:none` toggling (extending the existing Home/Ask pattern to Planner, Graph, Settings). Enables instant live peek and preserves scroll positions.
- **D-12:** GraphScreen is no longer lazy-loaded. Remove `React.lazy` — eager-load all 5 screens on app start to avoid loading flash during swipe.

### Transition & Edge Behavior
- **D-13:** Rubber-band effect at edges (swiping right on Home, left on Settings). Screen resists and bounces back — standard iOS behavior.
- **D-14:** Swipe threshold is ~20% of screen width (~75px on 375px phone). Below threshold, swipe cancels and screen snaps back.
- **D-15:** No haptic feedback on swipe commit. Silent transitions.
- **D-16:** Slide animation duration is ~250ms with spring easing. Matches the snappy feel of existing 200ms PageTransition.

### Claude's Discretion
- Spring curve parameters (stiffness, damping) — tune for best feel
- Exact axis-lock threshold (suggested ~10px but can adjust)
- How to detect keyboard-open state (focus events, visual viewport API, or Capacitor keyboard plugin)
- Implementation approach for suppressing nav swipe inside nested draggable elements (event delegation, data attributes, or context)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Key source files
- `app/src/App.tsx` — RootLayout with always-mounted Home/Ask pattern, route definitions, Outlet
- `app/src/components/BottomNavigation.tsx` — 5-tab nav with left/right items + center Ask FAB
- `app/src/components/PageTransition.tsx` — Framer Motion fade transition (will be replaced/augmented)
- `app/src/components/PostCarousel.tsx` — Existing Framer Motion horizontal drag pattern (50px threshold)
- `app/src/screens/GraphScreen.tsx` — mind-elixir canvas with its own drag/pan gestures

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Framer Motion v12** (`framer-motion`): Already used for PageTransition and PostCarousel drag. Can use `motion.div` with `drag="x"` for swipe container.
- **PostCarousel drag pattern**: 50px threshold, `touchAction: 'pan-y'`, AnimatePresence — reference for axis conflict handling.
- **hapticImpactLight()** in `src/lib/haptics.ts`: Available but NOT used for this feature (user chose no haptics).
- **`useNavigate` + `useLocation`**: Already used in BottomNavigation for route-based navigation.

### Established Patterns
- **Always-mounted screens**: Home & Ask use `display:none` toggling in RootLayout — extend this to all 5.
- **Inline styles with CSS variables**: App uses inline styles, not Tailwind classes. Swipe container should follow this convention.
- **Route-based navigation**: `react-router-dom` v7 with `createBrowserRouter`. Swipe should update the URL to match the active screen.

### Integration Points
- **RootLayout in App.tsx**: Central integration point. Currently renders Home/Ask always-mounted + Outlet. Must be restructured to mount all 5 screens in a swipe container.
- **BottomNavigation**: Must be enhanced with real-time position tracking (receive swipe progress as prop or via context).
- **PageTransition**: Currently wraps Outlet children with fade. Swipe replaces this for top-level screens (PageTransition may still be used for sub-screen navigation).
- **Route definitions**: Sub-screen routes (PostDetail, Review, etc.) need a way to signal "swipe disabled" to the swipe container.

</code_context>

<specifics>
## Specific Ideas

- The swipe should feel like native iOS tab switching — smooth, responsive, with live peek of adjacent screens
- Real-time bottom nav tracking is a premium touch the user specifically chose over simple snap behavior
- The 5-screen always-mounted approach is a deliberate trade-off: higher memory usage for better UX (instant transitions, preserved scroll)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-swipe-navigation-between-first-level-screens*
*Context gathered: 2026-04-07*
