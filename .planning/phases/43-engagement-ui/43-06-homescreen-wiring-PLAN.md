---
phase: 43-engagement-ui
plan: 06
type: execute
wave: 2
depends_on: [43-01, 43-03, 43-04]
files_modified:
  - app/src/screens/HomeScreen.tsx
  - app/tests/screens/HomeScreen.engagement-resync.test.mjs
autonomous: true
requirements: [ENGAGE-01, ENGAGE-02, ENGAGE-03]
must_haves:
  truths:
    - "HomeScreen renders a Bookmark icon button (top-right, fixed) that navigates to /saved on tap"
    - "HomeScreen hosts the LongPressMenu instance with { menuOpen, menuPostId, menuAnchorId } state"
    - "MasonryFeed receives onLongPress callback that sets menu state + engagementVersion that bumps on ENGAGEMENT_CHANGED"
    - "Effect A (stable listener, deps []): an ANCHOR_DISMISSED event subscription filters dailyPosts in-place by sourceQuestionIds[0] !== anchorId so the user gets immediate fade-out while on /home (LP-05 fast path)"
    - "Effect B (canonical resync, deps [location.pathname]): on navigation to /home, re-reads engagementService.getDismissedAnchors() and filters dailyPosts in-place — satisfies CONTEXT.md 'Always-mounted screen re-sync principle' + CLAUDE.md Phase 36-14 sibling-effects rule"
    - "An ENGAGEMENT_CHANGED event subscription bumps engagementVersion so MasonryFeed corner icons re-render"
    - "Both dismiss paths (Effect A + Effect B) filter in-place; neither calls conceptFeedService.getDailyPosts() (in-place only, never refetch)"
  artifacts:
    - path: "app/src/screens/HomeScreen.tsx"
      provides: "Header bookmark icon entry to /saved + LongPressMenu host + ANCHOR_DISMISSED stable-listener effect + [location.pathname] resync effect + ENGAGEMENT_CHANGED resync wiring"
    - path: "app/tests/screens/HomeScreen.engagement-resync.test.mjs"
      provides: "Source-reading assertions for the dual-effect dismiss resync (stable listener + [location.pathname]) + LongPressMenu host + Phase 32.1/36-14 invariants"
  key_links:
    - from: "app/src/screens/HomeScreen.tsx"
      to: "app/src/components/LongPressMenu.tsx"
      via: "import + render <LongPressMenu open={menuOpen} onClose={...} postId={...} anchorId={...} />"
      pattern: "<LongPressMenu"
    - from: "app/src/screens/HomeScreen.tsx"
      to: "app/src/components/MasonryFeed.tsx"
      via: "<MasonryFeed onLongPress={(postId, anchorId) => setMenuOpen + setMenuPostId + setMenuAnchorId} engagementVersion={engagementVersion} ... />"
      pattern: "onLongPress=\\{"
    - from: "app/src/screens/HomeScreen.tsx"
      to: "app/src/lib/event-bus.ts"
      via: "eventBus.subscribe('ANCHOR_DISMISSED', ...) and eventBus.subscribe('ENGAGEMENT_CHANGED', ...)"
      pattern: "eventBus\\.subscribe\\(['\"]ANCHOR_DISMISSED['\"]"
    - from: "app/src/screens/HomeScreen.tsx"
      to: "app/src/services/engagement.service.ts"
      via: "engagementService.getDismissedAnchors() re-read inside [location.pathname] effect"
      pattern: "engagementService\\.getDismissedAnchors"
---

<objective>
Wave-2 plan that wires everything together at HomeScreen. Depends on:
- 43-01: useLongPress hook + locale keys
- 43-03: LongPressMenu component + MasonryFeed long-press wrapper + AnimatePresence
- 43-04: SavedScreen route (navigation target for the Bookmark icon)

Five distinct edits to app/src/screens/HomeScreen.tsx:

1. SV-02 — Bookmark icon entry point. Per RESEARCH §13: HomeScreen has NO `<Header>` component (renders an inline h1 greeting). Place a `position: fixed` Bookmark button at top-right inside the HomeScreen slot (SwipeTabContainer scopes `position: fixed` to the slot's translateZ(0)). Tap → `navigate('/saved')`. Icon: muted-foreground rest; hits 44×44 floor.

2. LP-01..LP-04 — Host LongPressMenu state. HomeScreen owns `{ menuOpen: boolean, menuPostId: string | null, menuAnchorId: string | null }`. Pass an `onLongPress(postId, anchorId)` callback into MasonryFeed that sets all three. Render `<LongPressMenu>` once at the screen level (not per-tile).

3. LP-03 — engagementVersion bump on ENGAGEMENT_CHANGED. HomeScreen subscribes to ENGAGEMENT_CHANGED in a useEffect; on emit, `setEngagementVersion(v => v + 1)`. Pass `engagementVersion` to MasonryFeed so its tile corner-icon useMemo dep arrays re-run.

4. LP-05 — ANCHOR_DISMISSED in-place filter, **DUAL-EFFECT canonical pattern** (revised 2026-05-11 per plan-checker Blocker 3). The fast path AND the resync path coexist as two sibling effects (this is the canonical Phase 36-14 shape — see HomeScreen.exploredAnchors-resync.test.mjs precedent). HomeScreen subscribes to ANCHOR_DISMISSED:
   - **Effect A — stable event listener (deps `[]`):** fires immediately on dismiss so the user gets the fade-out without waiting for navigation. Filters dailyPosts in-place: `setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId))`. This handles "user dismisses from /home then keeps scrolling".
   - **Effect B — navigation re-read (deps `[location.pathname]`):** on every navigation to /home, re-reads `engagementService.getDismissedAnchors()` and filters dailyPosts in-place by that list. This handles "user dismissed from PostDetail/SavedScreen, now navigating back" plus serves as the canonical resync per CLAUDE.md "Always-mounted screens must explicitly re-read service state on navigation". Both effects mutate the SAME dailyPosts state via in-place filter — never refetch from conceptFeedService.getDailyPosts().

   The MasonryFeed's AnimatePresence (from 43-03) provides the 200ms fade-out automatically for both paths.

5. Effect B doubles as the [location.pathname] resync for engagement state. The existing effects neighborhood (HomeScreen.tsx lines ~155-203) already has explored-anchors + warm-start fallback resync effects. Effect B JOINS this neighborhood as a NEW sibling — same `[location.pathname]` deps shape, same in-place filter pattern, same Phase 36-14 contract.

Purpose: Final wiring plan; depends on Wave-1 plans 43-03 and 43-04. After this, all engagement UI is reachable and functional.
Output: HomeScreen.tsx delta (~90 LOC of new state + 3 subscription effects (ANCHOR_DISMISSED stable + [location.pathname] resync + ENGAGEMENT_CHANGED stable) + Bookmark button + LongPressMenu render + MasonryFeed prop wiring), 1 test file filled in.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-RESEARCH.md
@.planning/phases/43-engagement-ui/43-UI-SPEC.md

# Reference implementations to read first
@app/src/screens/HomeScreen.tsx
@app/src/components/MasonryFeed.tsx
@app/src/components/LongPressMenu.tsx
@app/src/lib/event-bus.ts
@app/src/services/engagement.service.ts
@app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs

<interfaces>
From app/src/components/MasonryFeed.tsx (post-43-03):
```typescript
interface MasonryFeedProps {
  items: InfoFlowItem[];
  onOpenConnection: (idA: string, idB: string) => void;
  showConnectionScores?: boolean;
  onOpenPost: (postId: string, post: DailyPost) => void;
  allExplored: boolean;
  onLongPress?: (postId: string, anchorId: string) => void;  // NEW (43-03)
  engagementVersion?: number;                                  // NEW (43-03)
}
```

From app/src/components/LongPressMenu.tsx (post-43-03):
```typescript
interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
}
export function LongPressMenu({ ... }: LongPressMenuProps): JSX.Element;
```

From app/src/lib/event-bus.ts (AppEvent union — Phase 39 D-05):
- ANCHOR_DISMISSED { type: 'ANCHOR_DISMISSED'; payload: { anchorId: string } }
- ENGAGEMENT_CHANGED { type: 'ENGAGEMENT_CHANGED'; payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss'; id: string } }

From app/src/services/engagement.service.ts:
- engagementService.getDismissedAnchors(): string[]  // returns the array of dismissed anchorIds; consumed by Effect B re-read path

From app/src/screens/HomeScreen.tsx (existing patterns to preserve):
- Lines 182-202: [location.pathname] resync neighborhood (warm-start fallback + explored-anchors resync) — Effect B joins as sibling here
- HomeScreen is inside SwipeTabContext (HomeScreen is a swipe-tab slot)
- HomeScreen does NOT use <Header> — renders inline h1 greeting
- Existing inline cards / VineProgress bar at zIndex 190 (compact bar)

From app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs (canonical sibling-effects precedent):
- That test already asserts the dual-effect pattern: REVIEW_COMPLETED listener (deps []) + dailyReadService re-read on [location.pathname]. The Phase 43 ANCHOR_DISMISSED + engagement resync mirrors this shape exactly.

CONTEXT.md decisions to honor:
- SV-02: Bookmark icon entry — at top-right of HomeScreen, fixed-position inside the SwipeTabContext slot
- LP-05: in-place filter, not refetch — operator-locked
- Phase 36-14 [location.pathname] effect pattern — canonical re-sync model; per the revision 2026-05-11, this is BOTH a stable-listener pattern AND a navigation-resync pattern in SIBLING effects (not either-or)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add Bookmark icon, LongPressMenu host state, engagementVersion + dual-effect ANCHOR_DISMISSED + ENGAGEMENT_CHANGED resync to HomeScreen.tsx</name>
  <files>app/src/screens/HomeScreen.tsx</files>
  <read_first>
    - app/src/screens/HomeScreen.tsx (read FULL file — focus on top-of-file imports, state declarations near line 30-100, [location.pathname] effects at 182-202, MasonryFeed invocation site likely around line 820-832 per Phase 42-02 SUMMARY)
    - app/src/components/MasonryFeed.tsx (post-43-03 — confirm new onLongPress + engagementVersion props)
    - app/src/components/LongPressMenu.tsx (post-43-03 — confirm props shape)
    - app/src/lib/event-bus.ts (subscribe API)
    - app/src/services/engagement.service.ts (verify getDismissedAnchors() returns string[])
    - app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs (CANONICAL sibling-effects precedent — Effect A = stable REVIEW_COMPLETED listener; Effect B = [location.pathname] re-read. Phase 43 mirrors exactly with ANCHOR_DISMISSED + engagementService.getDismissedAnchors())
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (SV-02 entry-point placement + LP-05 in-place filter)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "5. HomeScreen bookmark icon (SV-02 entry point)" lines 343-366 — VERBATIM visual contract)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 8 lines 333-368 — ANCHOR_DISMISSED handler; Section 13 lines 543-575 — Bookmark icon placement; Pitfall 4 — position: fixed scoping)
    - CLAUDE.md "Always-mounted screens must explicitly re-read service state on navigation" — [location.pathname] effect pattern; this rule applies to Effect B specifically
    - CLAUDE.md "Header positioning" — no transform/will-change/filter on HomeScreen ancestors beyond SwipeTabContainer's translateZ(0)
  </read_first>
  <behavior>
    - Test 1: HomeScreen.tsx imports Bookmark from 'lucide-react' (if not already)
    - Test 2: HomeScreen.tsx imports LongPressMenu from '../components/LongPressMenu'
    - Test 3: HomeScreen.tsx imports engagementService from '../services/engagement.service'
    - Test 4: HomeScreen.tsx adds state: menuOpen (boolean), menuPostId (string | null), menuAnchorId (string | null), engagementVersion (number)
    - Test 5: A handleLongPress callback exists that sets menuOpen=true + menuPostId=postId + menuAnchorId=anchorId
    - Test 6: A closeMenu callback exists that sets menuOpen=false
    - Test 7: <MasonryFeed> invocation receives onLongPress={handleLongPress} + engagementVersion={engagementVersion}
    - Test 8: <LongPressMenu> is rendered once at the screen level (outside MasonryFeed JSX) with open={menuOpen} onClose={closeMenu} postId={menuPostId} anchorId={menuAnchorId}
    - Test 9: A fixed-position Bookmark button is rendered with: position fixed; top calc(var(--safe-area-top) + 8px); right 16px; zIndex 195; size 22; aria-label t('saved.title'); onClick navigate('/saved'); minWidth/minHeight 44px (WCAG floor)
    - Test 10 (Effect A — stable listener): An eventBus.subscribe('ANCHOR_DISMISSED', ...) inside a useEffect with EMPTY deps array []; handler filters dailyPosts in-place: setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== event.payload.anchorId)); cleanup returns unsub
    - Test 11 (Effect B — [location.pathname] resync): A separate useEffect with deps [location.pathname]; gates on location.pathname === '/home'; calls engagementService.getDismissedAnchors() to fetch the current dismissed-anchor list; filters dailyPosts in-place by !dismissed.includes(p.sourceQuestionIds?.[0]); ALSO bumps setEngagementVersion(v => v + 1) (or equivalent) so MasonryFeed corner icons resync on navigation
    - Test 12: An eventBus.subscribe('ENGAGEMENT_CHANGED', ...) inside a useEffect with empty deps; handler bumps engagementVersion: setEngagementVersion(v => v + 1); cleanup returns unsub
    - Test 13: Neither Effect A nor Effect B nor the ENGAGEMENT_CHANGED effect calls conceptFeedService.getDailyPosts (in-place filter only — per CONTEXT specifics line 229)
    - Test 14: NEGATIVE: source does NOT add transform/will-change/filter/contain/perspective to any HomeScreen ancestor (Phase 32.1 invariant)
    - Test 15: NEGATIVE: existing [location.pathname] resync effects (explored-anchors + warm-start fallback) UNTOUCHED (no regression to Phase 36-14)
    - Test 16: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Modify app/src/screens/HomeScreen.tsx with these additive edits. Do NOT modify any existing effect logic; ADD sibling effects + new state.

    1. Add imports at top (if not already present):
       ```typescript
       import { Bookmark } from 'lucide-react';
       import { LongPressMenu } from '../components/LongPressMenu';
       import { engagementService } from '../services/engagement.service';
       ```

    2. Add state declarations near the existing state region (find the existing `useState` cluster near the top of the function body):
       ```typescript
       const [menuOpen, setMenuOpen] = useState(false);
       const [menuPostId, setMenuPostId] = useState<string | null>(null);
       const [menuAnchorId, setMenuAnchorId] = useState<string | null>(null);
       const [engagementVersion, setEngagementVersion] = useState(0);
       ```

    3. Add handlers (place after state declarations, before existing effects):
       ```typescript
       const handleLongPress = useCallback((postId: string, anchorId: string) => {
         setMenuPostId(postId);
         setMenuAnchorId(anchorId);
         setMenuOpen(true);
       }, []);
       const closeMenu = useCallback(() => {
         setMenuOpen(false);
       }, []);
       ```

    4. Add Effect A — ANCHOR_DISMISSED stable event listener (empty deps; canonical sibling-effects pattern per HomeScreen.exploredAnchors-resync.test.mjs precedent):
       ```typescript
       // Effect A — LP-05 fast path: when engagementService.dismissAnchor fires from
       // ANYWHERE (LongPressMenu on /home, future surfaces), remove ALL same-anchor
       // tiles from dailyPosts immediately so the user sees the fade-out without
       // waiting for a navigation event. AnimatePresence in MasonryFeed (43-03)
       // provides the 200ms fade-out automatically. Do NOT refetch
       // conceptFeedService.getDailyPosts() — operator decision LP-05.
       useEffect(() => {
         const unsub = eventBus.subscribe('ANCHOR_DISMISSED', (event) => {
           const { anchorId } = event.payload;
           setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId));
           setEngagementVersion(v => v + 1);
         });
         return unsub;
       }, []);
       ```

    5. Add Effect B — [location.pathname] canonical resync (joins the existing Phase 36-14 effect neighborhood):
       ```typescript
       // Effect B — Phase 36-14 canonical resync: when user navigates back to /home
       // after dismissing from another surface (PostDetail, SavedScreen, future),
       // re-read engagementService.getDismissedAnchors() and filter dailyPosts in
       // place. Satisfies CLAUDE.md "Always-mounted screens must explicitly re-read
       // service state on navigation". Also bumps engagementVersion so MasonryFeed
       // corner icons resync on navigation.
       useEffect(() => {
         if (location.pathname !== '/home') return;
         const dismissed = engagementService.getDismissedAnchors();
         if (dismissed.length > 0) {
           setDailyPosts(prev => prev.filter(p => !dismissed.includes(p.sourceQuestionIds?.[0] ?? '')));
         }
         setEngagementVersion(v => v + 1);
       }, [location.pathname]);
       ```

       Place Effect B in the existing [location.pathname] effects neighborhood (HomeScreen.tsx lines ~182-202 per Phase 36-14) as a sibling — same shape as the explored-anchors + warm-start fallback effects.

    6. Add Effect C — ENGAGEMENT_CHANGED stable event listener (corner-icon bump; empty deps):
       ```typescript
       // Effect C — LP-03: when engagement state mutates from anywhere (LongPressMenu,
       // PostDetailScreen, SavedScreen un-save/un-like, dev surfaces), bump
       // engagementVersion so MasonryFeed's tile corner-icon useMemo dep arrays
       // re-run and re-read isSaved/isLiked.
       useEffect(() => {
         const unsub = eventBus.subscribe('ENGAGEMENT_CHANGED', () => {
           setEngagementVersion(v => v + 1);
         });
         return unsub;
       }, []);
       ```

    7. Add the Bookmark icon button in the JSX. Place it just inside the outermost HomeScreen container, alongside the existing fixed-position elements (compact VineProgress bar). The icon is rendered as a top-level JSX sibling (not nested inside the scroll container) so it's pinned to the viewport-scoped slot:
       ```jsx
       <button
         type="button"
         aria-label={t('saved.title')}
         onClick={() => navigate('/saved')}
         style={{
           position: 'fixed',
           top: 'calc(var(--safe-area-top) + 8px)',
           right: '16px',
           zIndex: 195,
           background: 'none',
           border: 'none',
           cursor: 'pointer',
           padding: '8px',
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
       ```
       Place it BEFORE the scroll container's opening tag so it doesn't get clipped by overflow.

    8. Update the MasonryFeed invocation site (HomeScreen.tsx around line 820-832 per Phase 42-02; verify by reading existing usage). Add two new props alongside existing ones:
       ```jsx
       <MasonryFeed
         items={...existing...}
         onOpenConnection={...existing...}
         showConnectionScores={...existing...}
         onOpenPost={...existing...}
         allExplored={...existing...}
         onLongPress={handleLongPress}      // NEW (43-06)
         engagementVersion={engagementVersion} // NEW (43-06)
       />
       ```

    9. Add the LongPressMenu render at the bottom of HomeScreen's JSX, OUTSIDE any scroll container but inside the screen-root div. It uses BottomSheet which portals to document.body via position: fixed at zIndex 500 — so its visual placement in JSX matters only for component lifecycle:
       ```jsx
       <LongPressMenu
         open={menuOpen}
         onClose={closeMenu}
         postId={menuPostId}
         anchorId={menuAnchorId}
       />
       ```

    INVARIANTS:
    - Do NOT add transform/will-change/filter/contain/perspective to any HomeScreen JSX ancestor (Phase 32.1 — Header portal positioning load-bearing rule; per CONTEXT.md canonical_refs)
    - Do NOT call conceptFeedService.getDailyPosts inside ANY of the three new effects — in-place filter only
    - PRESERVE the existing [location.pathname] effect chain at lines 182-202 verbatim (Phase 36-14 — exploredAnchors + warm-start fallback resync MUST NOT regress); Effect B joins as a NEW sibling but does not modify existing siblings
    - Do NOT add CONCEPT_EXPLORED emit from HomeScreen (single-emit invariant per CLAUDE.md Phase 36 GAP-C)
    - The Bookmark icon does NOT need to disappear when navigating to /saved (icon is HomeScreen-scoped; SavedScreen renders on top via Outlet)
    - Effect A AND Effect B BOTH mutate the same dailyPosts state — Effect A handles the in-the-moment dismiss; Effect B handles the navigation-back resync. This is the canonical sibling-effects pattern (see HomeScreen.exploredAnchors-resync.test.mjs precedent).

    Atomic commit message: feat(43): HomeScreen wiring — Bookmark icon + LongPressMenu host + dual-effect ANCHOR_DISMISSED (stable listener + [location.pathname] resync) + ENGAGEMENT_CHANGED bump (SV-02 + LP-03 + LP-05)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "import { Bookmark" src/screens/HomeScreen.tsx && grep -q "import { LongPressMenu" src/screens/HomeScreen.tsx && grep -q "import { engagementService" src/screens/HomeScreen.tsx && grep -q "menuOpen" src/screens/HomeScreen.tsx && grep -q "menuPostId" src/screens/HomeScreen.tsx && grep -q "menuAnchorId" src/screens/HomeScreen.tsx && grep -q "engagementVersion" src/screens/HomeScreen.tsx && grep -q "handleLongPress" src/screens/HomeScreen.tsx && grep -q "ANCHOR_DISMISSED" src/screens/HomeScreen.tsx && grep -q "ENGAGEMENT_CHANGED" src/screens/HomeScreen.tsx && grep -q "engagementService.getDismissedAnchors" src/screens/HomeScreen.tsx && grep -q "navigate('/saved')" src/screens/HomeScreen.tsx && grep -q "<LongPressMenu" src/screens/HomeScreen.tsx && grep -q "onLongPress={handleLongPress}" src/screens/HomeScreen.tsx && [ "$(grep -c 'transform: translateZ\\|will-change:' src/screens/HomeScreen.tsx)" = "0" ] && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "import { Bookmark" app/src/screens/HomeScreen.tsx returns at least 1
    - grep -c "import { LongPressMenu" app/src/screens/HomeScreen.tsx returns 1
    - grep -c "import { engagementService" app/src/screens/HomeScreen.tsx returns 1
    - grep -c "menuOpen" app/src/screens/HomeScreen.tsx returns at least 4 (state + setter + open + props)
    - grep -c "menuPostId" app/src/screens/HomeScreen.tsx returns at least 3
    - grep -c "menuAnchorId" app/src/screens/HomeScreen.tsx returns at least 3
    - grep -c "engagementVersion" app/src/screens/HomeScreen.tsx returns at least 3 (state + bump in subscriber + prop pass to MasonryFeed)
    - grep -c "handleLongPress" app/src/screens/HomeScreen.tsx returns at least 2 (declaration + prop pass)
    - grep -c "closeMenu" app/src/screens/HomeScreen.tsx returns at least 2
    - grep -c "eventBus.subscribe(['\"]ANCHOR_DISMISSED" app/src/screens/HomeScreen.tsx returns 1 (Effect A stable listener)
    - grep -c "eventBus.subscribe(['\"]ENGAGEMENT_CHANGED" app/src/screens/HomeScreen.tsx returns 1 (Effect C stable listener)
    - grep -c "engagementService.getDismissedAnchors" app/src/screens/HomeScreen.tsx returns at least 1 (Effect B re-read inside [location.pathname] deps)
    - grep -c "navigate('/saved')" app/src/screens/HomeScreen.tsx returns 1
    - grep -c "<LongPressMenu" app/src/screens/HomeScreen.tsx returns 1
    - grep -c "<Bookmark" app/src/screens/HomeScreen.tsx returns at least 1 (icon render)
    - grep -c "saved.title" app/src/screens/HomeScreen.tsx returns at least 1 (aria-label)
    - grep -c "minWidth: '44px'" app/src/screens/HomeScreen.tsx returns at least 1
    - grep -c "p.sourceQuestionIds?.\\[0\\] !== anchorId\\|sourceQuestionIds\\?\\.\\[0\\]\\s*!==\\s*anchorId" app/src/screens/HomeScreen.tsx returns 1 (Effect A in-place filter pattern)
    - grep -c "dismissed.includes\\|!dismissed.includes" app/src/screens/HomeScreen.tsx returns at least 1 (Effect B re-read filter pattern)
    - grep -c "conceptFeedService.getDailyPosts" inside any of the three new effect blocks returns 0 (in-place filter, NOT refetch — CONTEXT specifics line 229)
    - grep -c "transform: translateZ\\|will-change:" app/src/screens/HomeScreen.tsx returns 0 (no new translateZ/will-change added)
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>HomeScreen fully wires the engagement layer with dual-effect dismiss resync; ENGAGE-01/02/03 reachable from /home.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill assertions in tests/screens/HomeScreen.engagement-resync.test.mjs scaffold</name>
  <files>app/tests/screens/HomeScreen.engagement-resync.test.mjs</files>
  <read_first>
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs (43-01 Task 4 scaffold)
    - app/src/screens/HomeScreen.tsx (post-Task 1)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 51 — expected assertions)
    - app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs (existing test from Phase 36-14 — CANONICAL precedent for source-reading sibling-effects tests; this Phase 43 test mirrors its shape exactly)
  </read_first>
  <action>
    Replace scaffold with real source-reading assertions. The DUAL-EFFECT pattern is enforced via three distinct assertions: (a) ANCHOR_DISMISSED subscribe inside a useEffect (deps array MAY be `[]` — fast path), (b) engagementService.getDismissedAnchors() appears inside a useEffect with `[location.pathname]` deps (canonical resync), (c) both effects exist (assert via separate matches).

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/screens/HomeScreen.tsx'), 'utf8');

    test('43-06 Effect A: ANCHOR_DISMISSED stable event listener (deps [], canonical fast-path)', () => {
      // Effect A pattern: useEffect(() => { eventBus.subscribe('ANCHOR_DISMISSED', ...); return unsub }, [])
      assert.match(src, /eventBus\.subscribe\(\s*['"]ANCHOR_DISMISSED['"]/);
      // The subscribe call must live inside a useEffect (matching Phase 36-14 sibling-effects rule).
      // Source-reading: find the subscribe location and assert there's a useEffect opener in the preceding ~200 chars.
      const subIdx = src.indexOf("subscribe('ANCHOR_DISMISSED'");
      assert.ok(subIdx > 0, 'ANCHOR_DISMISSED subscribe must exist');
      const preceding = src.slice(Math.max(0, subIdx - 300), subIdx);
      assert.match(preceding, /useEffect\(/, 'ANCHOR_DISMISSED subscribe must be inside a useEffect');
      // In-place filter pattern
      assert.match(src, /setDailyPosts\(\s*prev\s*=>\s*prev\.filter/);
      assert.match(src, /sourceQuestionIds\??\.\??\[0\]\s*!==\s*anchorId/);
    });

    test('43-06 Effect B: engagementService.getDismissedAnchors() inside a [location.pathname] resync effect (canonical Phase 36-14 pattern)', () => {
      // Effect B pattern: useEffect(() => { if (location.pathname !== '/home') return; const dismissed = engagementService.getDismissedAnchors(); ...filter... }, [location.pathname])
      assert.match(src, /engagementService\.getDismissedAnchors\(\)/);
      // The getDismissedAnchors() call must be inside a useEffect whose deps array is [location.pathname]
      const dismissCallIdx = src.indexOf('engagementService.getDismissedAnchors()');
      assert.ok(dismissCallIdx > 0, 'engagementService.getDismissedAnchors() must be referenced');
      // Find the next "}, [...])" closing deps array after the call site
      const trailing = src.slice(dismissCallIdx, dismissCallIdx + 800);
      assert.match(trailing, /\}\s*,\s*\[location\.pathname\]\s*\)/, 'engagementService.getDismissedAnchors() must appear inside a useEffect with [location.pathname] deps');
      // Effect B also filters in-place (no refetch)
      assert.match(src, /dismissed\.includes|!dismissed\.includes/);
    });

    test('43-06 dual-effect: BOTH Effect A and Effect B exist (sibling-effects pattern per HomeScreen.exploredAnchors-resync precedent)', () => {
      // Effect A indicator: ANCHOR_DISMISSED subscribe
      assert.match(src, /eventBus\.subscribe\(\s*['"]ANCHOR_DISMISSED['"]/);
      // Effect B indicator: getDismissedAnchors inside [location.pathname]
      assert.match(src, /engagementService\.getDismissedAnchors/);
      // [location.pathname] deps array appears at least 3 times in HomeScreen.tsx:
      //   - existing Phase 36-14 explored-anchors effect
      //   - existing Phase 36-14 warm-start fallback effect
      //   - new Effect B engagement resync
      const locPathnameMatches = (src.match(/\[location\.pathname\]/g) || []).length;
      assert.ok(locPathnameMatches >= 3, `Expected at least 3 [location.pathname] resync effects (2 Phase 36-14 canonical + 1 new Effect B), found ${locPathnameMatches}`);
    });

    test('43-06 in-place filter only: neither effect calls conceptFeedService.getDailyPosts (LP-05 operator decision)', () => {
      // Slice the source around each effect site and confirm no getDailyPosts call inside
      const subStart = src.indexOf("subscribe('ANCHOR_DISMISSED'");
      const handlerRegion = src.slice(subStart, subStart + 600);
      assert.doesNotMatch(handlerRegion, /conceptFeedService\.getDailyPosts/);

      const dismissCallIdx = src.indexOf('engagementService.getDismissedAnchors()');
      const effectBRegion = src.slice(Math.max(0, dismissCallIdx - 200), dismissCallIdx + 400);
      assert.doesNotMatch(effectBRegion, /conceptFeedService\.getDailyPosts/);
    });

    test('43-06 Effect C: ENGAGEMENT_CHANGED subscription bumps engagementVersion (LP-03)', () => {
      assert.match(src, /eventBus\.subscribe\(\s*['"]ENGAGEMENT_CHANGED['"]/);
      assert.match(src, /setEngagementVersion\(\s*\w+\s*=>\s*\w+\s*\+\s*1\s*\)/);
    });

    test('43-06: LongPressMenu hosted at HomeScreen level with all four props', () => {
      assert.match(src, /<LongPressMenu/);
      assert.match(src, /open=\{menuOpen\}/);
      assert.match(src, /onClose=\{closeMenu\}/);
      assert.match(src, /postId=\{menuPostId\}/);
      assert.match(src, /anchorId=\{menuAnchorId\}/);
    });

    test('43-06: MasonryFeed receives onLongPress + engagementVersion props', () => {
      assert.match(src, /<MasonryFeed[\s\S]*?onLongPress=\{handleLongPress\}/);
      assert.match(src, /<MasonryFeed[\s\S]*?engagementVersion=\{engagementVersion\}/);
    });

    test('SV-02: Bookmark icon entry button navigates to /saved', () => {
      assert.match(src, /import \{[^}]*Bookmark[^}]*\}\s+from\s+['"]lucide-react['"]/);
      assert.match(src, /<Bookmark\s+size=\{22\}/);
      assert.match(src, /navigate\(['"]\/saved['"]\)/);
      assert.match(src, /aria-label=\{t\(['"]saved\.title['"]\)\}/);
      // WCAG floor enforced
      assert.match(src, /minWidth:\s*['"]44px['"]/);
      assert.match(src, /minHeight:\s*['"]44px['"]/);
    });

    test('SV-02 layering: fixed position + zIndex 195 (above compact VineProgress bar at 190)', () => {
      // Bookmark button block should have position: fixed and zIndex: 195
      const bookmarkBlock = src.indexOf('aria-label={t(\'saved.title\')}');
      assert.ok(bookmarkBlock > 0);
      const region = src.slice(bookmarkBlock - 500, bookmarkBlock + 300);
      assert.match(region, /position:\s*['"]fixed['"]/);
      assert.match(region, /zIndex:\s*195/);
    });

    test('Phase 32.1 invariant preserved: no new transform/will-change/filter/contain/perspective on HomeScreen ancestors', () => {
      assert.strictEqual((src.match(/transform:\s*translateZ/g) || []).length, 0, 'No translateZ added to HomeScreen ancestor');
      assert.strictEqual((src.match(/will-change:|willChange:/g) || []).length, 0, 'No will-change added');
      assert.strictEqual((src.match(/perspective:/g) || []).length, 0, 'No perspective added');
    });

    test('Phase 36-14 invariant preserved: existing [location.pathname] resync effects untouched (3+ total after Effect B joins as sibling)', () => {
      // After Effect B, [location.pathname] should appear at least 3 times:
      //   - explored-anchors resync (Phase 36-14 existing)
      //   - warm-start fallback (Phase 36-14 existing)
      //   - Effect B engagement resync (Phase 43 new)
      const locPathnameMatches = (src.match(/\[location\.pathname\]/g) || []).length;
      assert.ok(locPathnameMatches >= 3, `Expected at least 3 [location.pathname] resync effects after Phase 43 Effect B joins, found ${locPathnameMatches}`);
    });
    ```

    Atomic commit message: test(43): fill HomeScreen dual-effect engagement-resync (Effect A stable + Effect B [location.pathname]) + SV-02 + Phase 32.1/36-14 invariants
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 11 (revised from 9 — dual-effect pattern adds Effect A + Effect B + dual-effect existence + in-place-only assertions)
    - cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs exits 0
  </acceptance_criteria>
  <done>HomeScreen dual-effect engagement-resync + SV-02 entry + Phase 32.1/36-14 invariant tests locked.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/screens/HomeScreen.engagement-resync.test.mjs exits 0
- cd app && node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs exits 0 (Phase 36-14 counterweight — must NOT regress; this is also the canonical precedent for the dual-effect pattern this plan introduces)
- cd app && node --test tests/screens/HomeScreen.warm-start-refallback.test.mjs exits 0 (existing — must NOT regress)
- cd app && npm test full suite passes
- cd app && npm run build exits 0
</verification>

<success_criteria>
- Bookmark icon visible top-right on /home, navigates to /saved on tap, hits 44×44 WCAG floor
- Long-press on a feed tile opens the LongPressMenu bottom-sheet hosted by HomeScreen
- Tapping a save/like/dismiss row commits via engagementService → corresponding event fires → HomeScreen re-syncs
- Effect A (stable ANCHOR_DISMISSED listener with []) fires immediately on dismiss for fast in-the-moment UX
- Effect B ([location.pathname] resync re-reads engagementService.getDismissedAnchors()) ensures navigation back to /home reflects any cross-screen dismisses (canonical Phase 36-14 pattern; mirrors HomeScreen.exploredAnchors-resync.test.mjs precedent)
- BOTH effects mutate dailyPosts via in-place filter; neither refetches from conceptFeedService.getDailyPosts() (LP-05 operator decision)
- ENGAGEMENT_CHANGED → corner icons update across visible tiles via engagementVersion bump
- Phase 32.1 + 36-14 invariants preserved — counterweight tests still green
- 2 atomic commits (HomeScreen source, test fill-in)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-06-SUMMARY.md documenting:
- HomeScreen.tsx LOC delta
- All new state vars + handler names
- Confirmation: Effect A (stable []) + Effect B ([location.pathname]) + Effect C (ENGAGEMENT_CHANGED stable []) all present as sibling effects
- Confirmation: neither effect calls conceptFeedService.getDailyPosts (in-place filter only)
- Confirmation: [location.pathname] effect count increased by 1 (Effect B joins existing 2 Phase 36-14 effects)
- Bookmark button at zIndex 195, fixed position, scoped to HomeScreen slot via SwipeTabContainer's translateZ(0)
- Counterweight tests still green (exploredAnchors-resync + warm-start-refallback)
- 2 atomic commit hashes
</output>
