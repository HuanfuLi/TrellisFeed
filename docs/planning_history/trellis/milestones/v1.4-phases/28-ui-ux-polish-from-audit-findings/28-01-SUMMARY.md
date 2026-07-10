---
phase: 28-ui-ux-polish-from-audit-findings
plan: 01
subsystem: ui
tags: [ui-polish, a11y, spacing-tokens, framer-motion, css-variables, responsive, swipe-navigation, touch-targets, wcag-2.5.8]

# Dependency graph
requires:
  - phase: 22-swipe-navigation-between-first-level-screens
    provides: "SwipeTabContainer + SPRING constant + activeIndexRef/stripX motion plumbing reused for D-05 fix"
  - phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
    provides: "Suggested Moves layout (dead/dying rows, scissors prune button) targeted by D-04/D-28/D-29/D-30"
  - phase: 27-add-i18n-l10n-support
    provides: "useTranslation + t() keys (no new user-visible strings added this plan, just styling)"
provides:
  - "9 CSS custom properties on :root: spacing scale (--space-xs..3xl), --bottom-nav-safe, --section-gap"
  - "SwipeTabContainer resize/visualViewport listeners + dev drift invariant (D-05 desync fix)"
  - "BottomNavigation slide-down animation (y:'100%' on sub-screens, y:0 on top-level)"
  - "Header scroll-aware shadow via HeaderScrollContext published from App.tsx Outlet onScroll"
  - "Badge.tsx conditional 44×44 touch target when onClick present"
  - "10 sub-screens unified on var(--bottom-nav-safe) paddingBottom"
  - "Header left/right slots minWidth/minHeight 44×44 (back-button WCAG fix benefits all consumer screens)"
  - "Pure helpers exported: computeTargetX(index,width) in swipe-tab-logic.ts; getNavYTarget(isTop) in BottomNavigation.tsx"
affects: ["28-02", "28-03", "future polish phases", "any new sub-screen"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scroll-aware header shadow via React Context (HeaderScrollContext) — published by scroll container, consumed by fixed Header"
    - "Pure-function testability: helpers like computeTargetX / getNavYTarget exposed for node --test without DOM"
    - "Dev-only invariant warnings (import.meta.env.DEV) — production builds strip the branch via Vite dead-code elimination"
    - "CSS custom properties as canonical design tokens for spacing — --bottom-nav-safe, --section-gap, --space-* scale"

key-files:
  created:
    - "app/src/lib/header-scroll-context.ts"
    - "app/tests/lib/swipe-tab-logic.test.mjs"
    - "app/tests/components/BottomNavigation.slide.test.mjs"
  modified:
    - "app/src/index.css"
    - "app/src/App.tsx"
    - "app/src/components/BottomNavigation.tsx"
    - "app/src/components/SwipeTabContainer.tsx"
    - "app/src/components/ui/Header.tsx"
    - "app/src/components/ui/Badge.tsx"
    - "app/src/lib/swipe-tab-logic.ts"
    - "app/src/screens/HomeScreen.tsx"
    - "app/src/screens/PlannerScreen.tsx"
    - "app/src/screens/SettingsScreen.tsx"
    - "app/src/screens/GraphScreen.tsx"
    - "app/src/screens/AskScreen.tsx"
    - "app/src/screens/PostDetailScreen.tsx"
    - "app/src/screens/AnchorDetailScreen.tsx"
    - "app/src/screens/ClusterDetailScreen.tsx"
    - "app/src/screens/ReviewScreen.tsx"
    - "app/src/screens/PodcastScreen.tsx"
    - "app/src/screens/QuestionDetailScreen.tsx"

key-decisions:
  - "D-04 landed: PlannerScreen Suggested Moves h2 now 1rem/600/letterSpacing-0.01em/foreground with marginTop var(--section-gap) — visually prominent heading"
  - "D-05 landed: SwipeTabContainer desync fix via window.resize + window.visualViewport.resize listeners + hardened useLayoutEffect (refresh screenWidthRef BEFORE read) + dev invariant warning when |stripX - expected| > 2px"
  - "D-06 landed: BottomNavigation motion.nav animates y:0 ↔ '100%' via SLIDE_SPRING {stiffness 300, damping 30, mass 0.8} matching SwipeTabContainer SPRING; initial={{y:0}} prevents first-mount flash"
  - "D-07 landed: Header scrolled prop + HeaderScrollContext consumer; paints var(--shadow-1) with 150ms ease-out transition; 4px scroll threshold gives natural hysteresis"
  - "D-08 verified: BottomNavigation borderTop '1px solid var(--border)' retained (was already present; no-op fix)"
  - "D-26 landed: 9 CSS custom properties on :root — --space-xs/sm/md/lg/xl/2xl/3xl (4-grid scale) + --bottom-nav-safe (calc(80px + var(--safe-area-bottom))) + --section-gap (24px)"
  - "D-27 landed: 10 sub-screens migrated to var(--bottom-nav-safe); HomeScreen fixed an incorrect --safe-area-top-in-bottom-padding arithmetic; GraphScreen 16px bug fixed (content previously scrolled under nav)"
  - "D-28 landed: 7 off-grid values normalized — PlannerScreen dead+dying rows 11→12, AskScreen suggested-prompt 11→12, PostDetailScreen card 32×28→32×24, ReviewScreen flashcard Q+A asymmetric→uniform 16"
  - "D-29 landed: 4 touch targets to WCAG 44×44 — Header left/right slots (component-level, benefits all consumers), PlannerScreen scissors (2 sites), AskScreen flag, Badge (conditional on onClick)"
  - "D-30 landed: PlannerScreen TrellisHero↔StatusPanel symmetric var(--section-gap); StatusPanel↔Suggested Moves symmetric var(--section-gap) on outer / 12px intra-section title→content preserved"

patterns-established:
  - "Testable pure helpers: computeTargetX(index,width) and getNavYTarget(isTop) — any derivation used by React components can be extracted for node --test coverage"
  - "Context-based header/chrome reactivity: App.tsx computes state from DOM events (onScroll), publishes via React Context, fixed-position child components consume via useContext"
  - "Design tokens over hardcoded pixels: paddingBottom: 'var(--bottom-nav-safe)' replaces 96px / 104px / 16px scatter across sub-screens"
  - "Slot-level touch-target enforcement: wrap Header left/right slots with minWidth/minHeight 44×44 rather than retrofit every consumer back-button inline"

requirements-completed: []

# Metrics
duration: 11min
completed: 2026-04-16
---

# Phase 28 Plan 01: UI/UX Polish Foundation Summary

**Shipped D-04/D-05/D-06/D-07/D-08 + D-26/D-27/D-28/D-29/D-30 — 9 CSS spacing tokens, SwipeTabContainer desync fix (resize/visualViewport listeners + dev invariant), BottomNavigation slide-down animation, Header scroll-shadow via HeaderScrollContext, 10-screen paddingBottom unification on var(--bottom-nav-safe), 7 off-grid pixel normalizations, 4 touch targets to WCAG 44×44, PlannerScreen Suggested Moves section-header polish + section rhythm lockdown.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-16T20:29:38Z
- **Completed:** 2026-04-16T20:40:31Z
- **Tasks:** 3 (all autonomous, zero checkpoints)
- **Files modified:** 16 (2 new test files, 1 new context module, 13 screen/component edits)

## Accomplishments

- **Swipe desync bug eliminated** — SwipeTabContainer now re-syncs stripX on `window.resize` AND `window.visualViewport.resize`, refreshes `screenWidthRef` before the route-sync useLayoutEffect reads it, and warns in dev when position drifts more than 2px. This closes the repro in the audit (navigate to /planner → keyboard open/close → URL says /planner but strip points nowhere valid).
- **Sub-screen chrome polished** — BottomNavigation slides down off-screen when the user visits PostDetail / AnchorDetail / ClusterDetail / QuestionDetail / Review / Podcast, and slides back up on return. Header gains a subtle `var(--shadow-1)` once the sub-screen scrolls past 4px, transitions at 150ms ease-out.
- **Foundation spacing tokens introduced** — `--space-xs..3xl` (4-grid scale), `--bottom-nav-safe`, `--section-gap` live on `:root` in `index.css`. Downstream plans 28-02 / 28-03 consume these.
- **10 sub-screens' paddingBottom unified** on `var(--bottom-nav-safe)` — eliminates the GraphScreen 16px bug (content scrolled under nav), the PostDetailScreen dual-padding (104px main + 24px loading/not-found), and HomeScreen's `--safe-area-top`-in-bottom-padding arithmetic error.
- **4-grid and WCAG 2.5.8 fixes shipped** — 7 off-grid pixel values normalized (11→12 on Planner + Ask rows, 32×28→32×24 on PostDetail card, Review flashcard Q/A asymmetry to uniform 16), 4 touch targets lifted to 44×44 (Header slots at component level so all consumer back buttons benefit, Planner scissors, Ask flag, Badge conditionally).
- **PlannerScreen Suggested Moves visual identity** — h2 styled 1rem / 600 weight / -0.01em letter-spacing, top-margin `var(--section-gap)`; section boundaries locked to symmetric 24px rhythm. Addresses the audit's "invisible heading" finding.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-26 tokens + D-05 desync fix + Wave 0 tests** — `38e64309` (feat)
2. **Task 2: D-06 nav slide-down + D-07 scroll shadow + D-04 heading polish** — `efbb2f7f` (feat)
3. **Task 3: D-27 padding unification + D-28 off-grid + D-29 touch targets + D-30 rhythm** — `58cfec24` (feat)

## Files Created/Modified

### Created
- `app/src/lib/header-scroll-context.ts` — React Context published by App.tsx Outlet onScroll handler, consumed by Header. Single-purpose module to avoid Header↔App circular import.
- `app/tests/lib/swipe-tab-logic.test.mjs` — 14 test cases covering resolveAxisLock / computeDragOffset / resolveCommitIndex / shouldBlockGesture + the new computeTargetX helper (5 viewport/index combinations).
- `app/tests/components/BottomNavigation.slide.test.mjs` — 3 test cases asserting getNavYTarget pure-function contract (0 when top-level, '100%' when sub-screen, Framer-compatible types).

### Modified
- `app/src/index.css` — Added 9 CSS custom properties (D-26).
- `app/src/App.tsx` — headerScrolled state, onScroll handler on Outlet wrapper (4px threshold), HeaderScrollContext.Provider wrap, isTopLevelScreen={isTopLevelScreen} passed to BottomNavigation.
- `app/src/components/BottomNavigation.tsx` — `<nav>` → `<motion.nav>`, added SLIDE_SPRING, isTopLevelScreen prop, exported getNavYTarget helper; existing borderTop retained.
- `app/src/components/SwipeTabContainer.tsx` — Resize + visualViewport listener with stripX re-sync, hardened useLayoutEffect (refresh width before read), dev invariant warn, imports computeTargetX.
- `app/src/components/ui/Header.tsx` — `scrolled` prop + HeaderScrollContext consumer, boxShadow + transition, slot wrappers enforce 44×44 (both centered and non-centered code paths).
- `app/src/components/ui/Badge.tsx` — onClick + style props added, conditional 44×44 touch styles when interactive.
- `app/src/lib/swipe-tab-logic.ts` — Exported computeTargetX(index, width) pure helper.
- `app/src/screens/{Home,Planner,Settings,Graph,PostDetail,AnchorDetail,ClusterDetail,Review,Podcast,QuestionDetail}.tsx` — paddingBottom migrated to `var(--bottom-nav-safe)`; PlannerScreen additionally applies D-04 heading styling, D-28 row-padding normalizations, D-29 44×44 scissors touch targets, D-30 section rhythm; AskScreen applies D-28 suggested-prompt padding + D-29 flag button touch target + TODO marker on line 607 for Plan 28-03 D-15; ReviewScreen applies D-28 flashcard Q/A uniform 16px; PostDetailScreen applies D-28 32×24 card padding.

## Decisions Made

- **HeaderScrollContext location** — extracted to `app/src/lib/header-scroll-context.ts` (single-purpose module) rather than defining in App.tsx. Header.tsx needs to import the context object, and importing from App.tsx would create a circular dep (App → Header → App). This is an infrastructure helper, not a new component — consistent with D-20 "no new components".
- **Badge onClick signature** — added `onClick?: MouseEventHandler<HTMLSpanElement>` (not `HTMLButtonElement`) because Badge renders a `<span>`. Also added optional `style?: CSSProperties` prop so downstream consumers can override without losing the base color / radius / pill shape.
- **AskScreen line 607 deferred** — the plan explicitly defers the recent-question row's `padding: '11px 16px'` to Plan 28-03 D-15 where the row becomes a proper `<button>`. Left a TODO marker in-place so grep surfaces the pending work.
- **PostDetailScreen loading + not-found fallback containers migrated** — the plan says "IF one of the `24px` values is actually an inner card/content padding, leave it." I judged the loading ('calc(24px + HEADER_HEIGHT)px 16px 24px') and not-found variants to be screen containers (full-height page shells) and unified them with `var(--bottom-nav-safe)`. The card-level `paddingBottom: '12px'` on the news sources attribution (line 484) is strictly inner and was left untouched.
- **Header slot 44×44 enforcement** — instead of retrofitting every consumer screen's back button (`padding: '12px', marginLeft: '-12px'`) with explicit minWidth/minHeight, I wrapped the `{left}` and `{right}` slots in 44×44 flex containers at the Header component level. Both the centered and non-centered code paths got the fix. This satisfies D-29 "fix at component level so all Header consumers benefit" and keeps the existing back-button inline styles untouched.
- **Node 25 `-0` quirk** — `computeTargetX(0, 375)` returns `-0` in JavaScript. Node 25's `assert.equal` (Object.is semantics) distinguishes `-0` from `0`, so the test normalizes the zero case via `Math.abs` rather than changing the helper (callers don't care about sign of zero — negative-zero and zero both translate to `translate(0px)`).
- **Spacing tokens kept unconditional** — placed inside the primary `:root {}` block, not scoped to a media query. Future phases may scale token values via `data-locale` or responsive overrides (the precedent exists with `--font-sans`), but for this phase they're unconditional globals as the plan specified.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] HomeScreen paddingBottom expression included `--safe-area-top`**
- **Found during:** Task 3 (D-27 migration)
- **Issue:** HomeScreen's original `paddingBottom: 'calc(96px + var(--safe-area-top) + var(--safe-area-bottom))'` incorrectly added `--safe-area-top` into the BOTTOM padding, pushing content up below the nav by the status-bar inset. The plan's D-27 guidance called it out: "drop `--safe-area-top` — that belongs in paddingTop."
- **Fix:** Split the padding shorthand into explicit properties; paddingBottom now resolves to `var(--bottom-nav-safe)` which correctly factors only `--safe-area-bottom`. The existing `paddingTop: 'var(--safe-area-top)'` on the outer `<div key="home">` wrapper in `App.tsx` continues to own the top safe-area.
- **Files modified:** `app/src/screens/HomeScreen.tsx`
- **Verification:** grep confirms `var(--bottom-nav-safe)` present; grep confirms `safe-area-top` no longer appears in a paddingBottom expression.
- **Committed in:** `58cfec24` (Task 3 commit)

**2. [Rule 3 - Blocking] Node 25 `-0` vs `0` assert equality**
- **Found during:** Task 1 (Wave 0 tests — initial RED cycle)
- **Issue:** Node 25's `node:assert` uses `Object.is` semantics for `.equal`; `computeTargetX(0, 375)` returns `-0` which fails `assert.equal(-0, 0)`. This is a blocking test failure that would have shown an apparent Wave 0 regression.
- **Fix:** Normalized the zero-input test via `assert.equal(Math.abs(computeTargetX(0, 375)), 0)` — preserves the helper's pure semantics (callers don't care about negative zero in a CSS translate context).
- **Files modified:** `app/tests/lib/swipe-tab-logic.test.mjs`
- **Verification:** 14/14 tests pass; the other 4 non-zero input rows kept strict equality.
- **Committed in:** `38e64309` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were within scope and necessary for correctness. Neither expanded scope nor altered any decision. HomeScreen bug was actually flagged by the plan's D-27 text and resolved inline.

## Issues Encountered

- **gsd-tools `verify key-links` YAML escape quirk** — the verifier's naive YAML kvMatch regex captures `"isTopLevelScreen=\\{isTopLevelScreen\\}"` (YAML double-quoted with `\\{`) as `isTopLevelScreen=\\{isTopLevelScreen\\}` (literal backslash in the regex source), producing a pattern that matches a literal backslash before the brace. As a result, all 4 key-links report `verified: false` despite the actual source code containing every pattern. Manually verified each link via `grep` (all present); documenting here so future executors aren't blocked by the false negative. Tool issue, not a plan issue.
- **Pre-existing 8 tsc errors remain** — GraphScreen `ArrowLeft` unused import + `GRAPH_UPDATED` event type; canonical-knowledge.service `GRAPH_UPDATED` + `COVERAGE_ERROR`; review.service `Question.anchorId`; trellis-state.service unused imports + Question conversion. Carry-forward per `.planning/milestones/v1.3-phases/27-*/deferred-items.md`. Zero new tsc errors introduced by this plan.

## Deferred Issues

None specific to this plan. Items deferred by design:
- AskScreen line 607 recent-question row padding (`'11px 16px'`) — marked with TODO, handled in Plan 28-03 D-15 `<button>` refactor.
- Broader a11y sweep (ARIA labels, focus rings, contrast audit) — explicitly out of scope per CONTEXT D-29; future phase.

## User Setup Required

None — no external service configuration changes.

## Next Phase Readiness

- **Plan 28-02 and 28-03 are unblocked.** They consume `--space-*` / `--bottom-nav-safe` / `--section-gap` tokens as foundations for Wave C (trellis interactions) and Wave D (recent-questions polish, residual P2 items).
- **`isTopLevelScreen` plumbing is live** — any future sub-screen added to the router automatically gets the nav slide-down behavior (RootLayout computes isTopLevelScreen from `SCREEN_ROUTES.some(r => location.pathname === r)`).
- **HeaderScrollContext is infrastructure** — future screens using `<Header />` inside the Outlet get the scroll-aware shadow for free; no per-screen wiring needed.
- **Test scaffolds** for `computeTargetX` and `getNavYTarget` are pure-function templates; future chrome behaviors that need verification can follow the same pattern (extract pure helper → test with node --test).

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: `app/src/lib/header-scroll-context.ts`
- FOUND: `app/tests/lib/swipe-tab-logic.test.mjs`
- FOUND: `app/tests/components/BottomNavigation.slide.test.mjs`

**Commits verified in git history:**
- FOUND: `38e64309` (feat(28-01): D-26 spacing tokens + D-05 SwipeTabContainer desync fix + Wave 0 tests)
- FOUND: `efbb2f7f` (feat(28-01): D-06 nav slide-down + D-07 header scroll shadow + D-04 Suggested Moves heading)
- FOUND: `58cfec24` (feat(28-01): D-27 sub-screen padding unification + D-28 off-grid fixes + D-29 touch targets + D-30 section rhythm)

**All 11 must_haves truths verified via grep** (see execution log: 9 spacing tokens on :root; 10 screens with `var(--bottom-nav-safe)`; 44×44 touch targets in Header/Planner/Ask/Badge; motion.nav + initial={{y:0}}; box-shadow 150ms ease-out; visualViewport listeners; h2 1rem/600; borderTop retained; 12px 0 row padding; 32px 24px card padding; Review uniform 16px).

**Phase-wide verification gates:**
- 19/19 Wave 0 + locale tests green (`node --test tests/lib/swipe-tab-logic.test.mjs tests/components/BottomNavigation.slide.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs`)
- vite build green in 3.03s
- Zero new tsc errors in touched files (8 pre-existing errors unchanged)

---
*Phase: 28-ui-ux-polish-from-audit-findings*
*Completed: 2026-04-16*
