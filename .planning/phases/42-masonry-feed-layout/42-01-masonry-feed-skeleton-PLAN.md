---
phase: 42-masonry-feed-layout
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/MasonryFeed.tsx
autonomous: true
requirements: [MASONRY-01]
must_haves:
  truths:
    - "MasonryFeed.tsx exists and exports a MasonryFeed React component"
    - "Each tile is permanently assigned to one of two columns (height-accumulating split, NOT CSS column-count)"
    - "Tiles never move between columns once rendered (immutability invariant — D-02)"
    - "Newly-appended tiles render as motion.div with framer-motion fade-up; pre-existing tiles render as plain div"
    - "MotionConfig with reducedMotion='user' wraps the motion subtree (Pitfall 1 fix from RESEARCH.md)"
    - "Video state ownership (videoPlaying/setVideoPlaying + 3 useEffect handlers) ports verbatim from InlineInfoFlow at InfoFlow.tsx:742-797"
  artifacts:
    - path: "app/src/components/MasonryFeed.tsx"
      provides: "2-column masonry layout with framer-motion entrance + GAP-C video state"
      min_lines: 200
      contains: "columnHeightsRef"
  key_links:
    - from: "app/src/components/MasonryFeed.tsx"
      to: "app/src/components/InfoFlow.tsx exports"
      via: "import { MemoizedConceptCard, ConnectionCard, MilestoneCard, type InfoFlowItem }"
      pattern: "import.*from\\s+['\"]\\./InfoFlow['\"]"
    - from: "app/src/components/MasonryFeed.tsx"
      to: "framer-motion"
      via: "import { MotionConfig, motion, type Variants }"
      pattern: "from\\s+['\"]framer-motion['\"]"
---

<objective>
Create a NEW `app/src/components/MasonryFeed.tsx` component implementing a 2-column masonry layout via height-accumulating JS split (D-02 from CONTEXT.md), with framer-motion entrance animations on newly-appended leaf tiles only (D-03/D-04/D-05), wrapped in `<MotionConfig reducedMotion="user">` to honor `prefers-reduced-motion` (RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect this).

The component reuses `MemoizedConceptCard`, `ConnectionCard`, `MilestoneCard` verbatim from `InfoFlow.tsx` (zero changes to leaf cards). It ports the video state ownership pattern (3 `useEffect` handlers + `videoPlaying`/`setVideoPlaying`) verbatim from `InlineInfoFlow` at `InfoFlow.tsx:742-797` so Phase 36 GAP-C tap detector behavior is preserved end-to-end.

Purpose: Foundation layout component for Phase 42's MASONRY-01 requirement. Replaces InlineInfoFlow at /home in a downstream plan (42-02); this plan builds the component in isolation so 42-02 can swap the JSX import cleanly.

Output: New file `app/src/components/MasonryFeed.tsx` (~250 LOC). VineBloomCard render gate is included as a placeholder import (`{allExplored && <VineBloomCard />}` block); the actual VineBloomCard component lands in plan 42-04.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md
@.planning/phases/42-masonry-feed-layout/42-UI-SPEC.md

# Reference implementations to read first
@app/src/components/InfoFlow.tsx
@app/src/screens/HomeScreen.tsx

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from app/src/components/InfoFlow.tsx -->

From `app/src/components/InfoFlow.tsx`:
```typescript
// Line 51 — InfoFlowItem union (consumed by MasonryFeed)
export type InfoFlowItem =
  | { kind: 'concept'; post: DailyPost }
  | { kind: 'connection'; questionA: Question; questionB: Question; conceptNounA: string; conceptNounB: string; bridgeInsight: string; cosineSimilarity: number }
  | { kind: 'milestone'; item: BlindboxItem };

// Line 573 — MemoizedConceptCard (CURRENTLY NOT EXPORTED — Plan 42-01 Task 1 adds the export keyword)
const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual);
// Line 610 — ConnectionCard (CURRENTLY NOT EXPORTED — Plan 42-01 Task 1 adds the export keyword)
function ConnectionCard({ ...props }: ConnectionCardProps) { ... }
// Line 700 — MilestoneCard (CURRENTLY NOT EXPORTED — Plan 42-01 Task 1 adds the export keyword)
function MilestoneCard({ item, isActive }: { item: BlindboxItem; isActive: boolean }) { ... }
// NOTE: All three symbols (MemoizedConceptCard at line 573, ConnectionCard at line 610, MilestoneCard at line 700) are NOT exported today.
//       Plan 42-01 Task 1 adds the `export` keyword to all THREE (single-line additive edits per site; pure additive, no behavior change).

// Line 731 — InlineInfoFlowProps (MasonryFeed accepts the SAME prop shape minus onLoadMore/isLoadingMore)
interface InlineInfoFlowProps {
  items: InfoFlowItem[];
  onOpenConnection: (idA: string, idB: string) => void;
  showConnectionScores?: boolean;
  onOpenPost: (postId: string, post: DailyPost) => void;
  onLoadMore?: () => void;       // NOT used by MasonryFeed (HomeScreen owns swipe-for-more separately)
  isLoadingMore?: boolean;       // NOT used by MasonryFeed
}

// Line 740-797 — Video state ownership (THIS BLOCK PORTS VERBATIM into MasonryFeed)
const [videoPlaying, setVideoPlaying] = useState<string | null>(null);
const swipeCtx = useContext(SwipeTabContext);
useEffect(() => { /* visibilitychange + swipeProgress 'change' handlers */ }, [swipeCtx]);
useEffect(() => { if (location.pathname !== '/home') setVideoPlaying(null); }, [location.pathname]);
useEffect(() => { /* IntersectionObserver per active video */ }, [videoPlaying]);
```

From `app/src/services/trellis-actions.service.ts`:
```typescript
export interface ActionNavigationResult {
  navigateTo: string;
  state?: AnchorReviewNavState | DiscoverPostNavState;
}
```

From `framer-motion@12.38.0`:
```typescript
import { MotionConfig, motion, type Variants } from 'framer-motion';
// MotionConfig reducedMotion="user" — disables transform + layout animations when prefers-reduced-motion is on; preserves opacity/color animations
// motion.div — leaf wrapper accepting variants={...}, initial="hidden", animate="visible", transition={{ duration, ease, delay }}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Export MemoizedConceptCard, ConnectionCard, and MilestoneCard from InfoFlow.tsx (additive — pure export keyword addition)</name>
  <files>app/src/components/InfoFlow.tsx</files>
  <read_first>
    - app/src/components/InfoFlow.tsx (read lines 565-580 to confirm the MemoizedConceptCard signature at line 573, lines 600-620 for ConnectionCard at line 610, and lines 695-715 for MilestoneCard at line 700)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ 1 + Example 1, lines 490-635 for the consumption pattern)
  </read_first>
  <behavior>
    - Test 1: After edit, `grep -n "^export const MemoizedConceptCard\|^export function ConnectionCard\|^export function MilestoneCard" app/src/components/InfoFlow.tsx` returns ALL THREE lines
    - Test 2: tsc -b --noEmit exits 0 (no breakage from making previously-internal symbols exported)
    - Test 3: All other lines in InfoFlow.tsx unchanged (no behavior change to existing component renderers)
  </behavior>
  <action>
    Add the `export` keyword to THREE symbols in `app/src/components/InfoFlow.tsx`:

    1. Line 573: `const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual);`
       → `export const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual);`
    2. Line 610: `function ConnectionCard({ ... }: ConnectionCardProps) {`
       → `export function ConnectionCard({ ... }: ConnectionCardProps) {`
    3. Line 700: `function MilestoneCard({ item, isActive }: { item: BlindboxItem; isActive: boolean }) {`
       → `export function MilestoneCard({ item, isActive }: { item: BlindboxItem; isActive: boolean }) {`

    Pure additive change — these symbols stay in the same file at the same line numbers; only the `export` keyword is added so MasonryFeed.tsx can `import { MemoizedConceptCard, ConnectionCard, MilestoneCard }`.

    Do NOT modify any other line in this file. The 3 `card-slide-in` callsites at lines 197, 329, 858 are removed in plan 42-03 (separate atomic commit).

    Atomic commit message: `feat(42): export MemoizedConceptCard + ConnectionCard + MilestoneCard from InfoFlow for MasonryFeed reuse`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; grep -c "^export const MemoizedConceptCard\|^export function ConnectionCard\|^export function MilestoneCard" src/components/InfoFlow.tsx | grep -q "^3$" &amp;&amp; npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^export const MemoizedConceptCard" app/src/components/InfoFlow.tsx` returns `1`
    - `grep -c "^export function ConnectionCard" app/src/components/InfoFlow.tsx` returns `1`
    - `grep -c "^export function MilestoneCard" app/src/components/InfoFlow.tsx` returns `1`
    - `cd app && npx tsc -b --noEmit` exits 0
    - `git diff app/src/components/InfoFlow.tsx` shows ONLY the `export` keyword addition on 3 lines (no other changes)
  </acceptance_criteria>
  <done>MemoizedConceptCard, ConnectionCard, and MilestoneCard are all exported from InfoFlow.tsx; tsc clean; ready for MasonryFeed import.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create MasonryFeed.tsx with height-accumulating algorithm + framer-motion entrance + MotionConfig wrapper + video state port</name>
  <files>app/src/components/MasonryFeed.tsx</files>
  <read_first>
    - app/src/components/InfoFlow.tsx (lines 740-925 — InlineInfoFlow as the source-of-truth for items.map shape, newPostIds Set pattern, video state useEffects, data-feed-id/data-concept-id attribute pattern)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ Animation Contract, § Layout Algorithm — VERBATIM source for tileEnterVariants + columnHeightsRef algorithm)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ Example 1 lines 490-635 — full skeleton with MotionConfig fix; § Pitfall 1 — reduced-motion gotcha; § 2 — GAP-C preservation requirements)
    - app/src/screens/HomeScreen.tsx (lines 820-832 to see how InlineInfoFlow is currently invoked — match prop signature)
  </read_first>
  <behavior>
    - Test 1: File exists at `app/src/components/MasonryFeed.tsx`
    - Test 2: Source contains `columnHeightsRef` and `tileColumnAssignmentsRef` declarations (height-accumulator state)
    - Test 3: Source contains `MotionConfig` import and `<MotionConfig reducedMotion="user">` wrapper
    - Test 4: Source contains at least one `<motion.div` (D-03 leaf-tile entrance)
    - Test 5: Source does NOT contain `column-count`, `columnCount`, `break-inside`, `breakInside` (D-02 — height-accumulating split chosen)
    - Test 6: Source does NOT contain `will-change`, `willChange`, `perspective:` (CLAUDE.md Header positioning rule)
    - Test 7: Source contains `'visibilitychange'` AND `swipeProgress.on('change'` AND `IntersectionObserver` (3 video state useEffects ported)
    - Test 8: Source does NOT contain `dailyReadService.markExplored` or `type: 'CONCEPT_EXPLORED'` (GAP-C emit lives in MemoizedConceptCard, NOT in MasonryFeed — Pitfall 4 from RESEARCH.md)
    - Test 9: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Create new file `app/src/components/MasonryFeed.tsx` implementing the verbatim contract from UI-SPEC.md § Layout Algorithm + § Animation Contract + RESEARCH.md § Example 1 (lines 490-635), with the Pitfall 1 reduced-motion fix.

    EXACT REQUIRED STRUCTURE (executor implements precisely; no creative drift):

    ```tsx
    import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
    import { useLocation } from 'react-router-dom';
    import { MotionConfig, motion, type Variants } from 'framer-motion';
    import {
      MemoizedConceptCard,
      ConnectionCard,
      MilestoneCard,
      type InfoFlowItem,
    } from './InfoFlow';
    import { SwipeTabContext } from './SwipeTabContainer';
    import type { DailyPost } from '../types';

    // VineBloomCard placeholder — actual implementation lands in plan 42-04.
    // For 42-01, render a stub that the celebration test can assert exists at this position.
    // Plan 42-04 replaces the stub with the real VineBloomCard.
    function VineBloomCard() {
      return null; // placeholder — replaced in plan 42-04
    }

    // D-05 verbatim from UI-SPEC.md § Animation Contract
    const tileEnterVariants: Variants = {
      hidden: { opacity: 0, y: 8 },
      visible: { opacity: 1, y: 0 },
    };

    interface MasonryFeedProps {
      items: InfoFlowItem[];
      onOpenConnection: (idA: string, idB: string) => void;
      showConnectionScores?: boolean;
      onOpenPost: (postId: string, post: DailyPost) => void;
      allExplored: boolean; // computed by HomeScreen from dailyReadService + useQuestions (RESEARCH.md Pitfall 2)
    }

    function getId(item: InfoFlowItem): string {
      if (item.kind === 'concept') return item.post.id;
      if (item.kind === 'connection') return `conn-${item.questionA.id}-${item.questionB.id}`;
      if (item.kind === 'milestone') return item.item.id;
      return '';
    }

    export function MasonryFeed({
      items,
      onOpenConnection,
      showConnectionScores = false,
      onOpenPost,
      allExplored,
    }: MasonryFeedProps) {
      // Height-accumulator state (D-02 verbatim from UI-SPEC.md § Layout Algorithm)
      const columnHeightsRef = useRef<[number, number]>([0, 0]);
      const tileColumnAssignmentsRef = useRef<Map<string, 0 | 1>>(new Map());
      const tileRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());

      // ===== VIDEO STATE OWNERSHIP — PORTED VERBATIM FROM InlineInfoFlow (InfoFlow.tsx:742-797) =====
      // Phase 36 GAP-C tap detector preservation requires these 3 useEffects to live at the wrapper level.
      // Do NOT modify the logic; copy each block byte-for-byte from InfoFlow.tsx 742-797.

      const [videoPlaying, setVideoPlaying] = useState<string | null>(null);
      const swipeCtx = useContext(SwipeTabContext);

      // (1) visibilitychange + swipeProgress (verbatim from InfoFlow.tsx:746-768)
      useEffect(() => {
        const onVisChange = () => {
          if (document.hidden) setVideoPlaying(null);
        };
        document.addEventListener('visibilitychange', onVisChange);
        let unsub: (() => void) | undefined;
        if (swipeCtx) {
          unsub = swipeCtx.swipeProgress.on('change', (v) => {
            if (Math.round(v) !== 0) setVideoPlaying(null);
          });
        }
        return () => {
          document.removeEventListener('visibilitychange', onVisChange);
          unsub?.();
        };
      }, [swipeCtx]);

      // (2) intra-app navigation away from /home (verbatim from InfoFlow.tsx:776-779)
      const location = useLocation();
      useEffect(() => {
        if (location.pathname !== '/home') setVideoPlaying(null);
      }, [location.pathname]);

      // (3) IntersectionObserver scroll-out cleanup (verbatim from InfoFlow.tsx:786-797)
      useEffect(() => {
        if (!videoPlaying) return;
        const card = document.querySelector<HTMLElement>(`[data-feed-id="${videoPlaying}"]`);
        if (!card) return;
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) return;
            if (document.fullscreenElement) return;
            setVideoPlaying(null);
          },
          { threshold: 0.3 },
        );
        observer.observe(card);
        return () => observer.disconnect();
      }, [videoPlaying]);

      // ===== END VIDEO STATE PORT =====

      // newPostIds Set — same pattern as InfoFlow.tsx:800-820
      const seenPostIdsRef = useRef(new Set<string>());
      const [newPostIds] = useState<Set<string>>(() => {
        const seen = seenPostIdsRef.current;
        const incoming = new Set<string>();
        for (const item of items) {
          const id = getId(item);
          if (id && !seen.has(id)) incoming.add(id);
          if (id) seen.add(id);
        }
        return incoming;
      });

      // Update seen set on items growth
      useEffect(() => {
        for (const item of items) {
          const id = getId(item);
          if (id) seenPostIdsRef.current.add(id);
        }
      }, [items]);

      // Height-accumulator algorithm (D-02 verbatim from UI-SPEC.md § Layout Algorithm)
      useLayoutEffect(() => {
        // Append-only assignment for new items (immutability invariant)
        for (const item of items) {
          const itemId = getId(item);
          if (!itemId) continue;
          if (tileColumnAssignmentsRef.current.has(itemId)) continue;
          const heights = columnHeightsRef.current;
          const col: 0 | 1 = heights[0] <= heights[1] ? 0 : 1; // tie-breaker: column 0
          tileColumnAssignmentsRef.current.set(itemId, col);
        }
        // Re-measure from DOM (RESEARCH.md § 5 mitigation 1 — robust against async height growth)
        columnHeightsRef.current = [0, 0];
        for (const [id, el] of tileRefsMap.current) {
          if (!el) continue;
          const col = tileColumnAssignmentsRef.current.get(id);
          if (col === undefined) continue;
          columnHeightsRef.current[col] += el.clientHeight + 12;
        }
      }, [items]);

      // Render a single tile — leaf card stays unchanged from InlineInfoFlow shape
      const renderTile = (item: InfoFlowItem, indexInColumn: number) => {
        const itemId = getId(item);
        const shouldAnimate = newPostIds.has(itemId);

        const tileBody =
          item.kind === 'concept' ? (
            <MemoizedConceptCard
              post={item.post}
              feedIndex={items.indexOf(item)}
              isActive={shouldAnimate}
              onOpen={onOpenPost}
              videoPlaying={videoPlaying}
              setVideoPlaying={setVideoPlaying}
            />
          ) : item.kind === 'connection' ? (
            <ConnectionCard
              questionA={item.questionA}
              questionB={item.questionB}
              conceptNounA={item.conceptNounA}
              conceptNounB={item.conceptNounB}
              bridgeInsight={item.bridgeInsight}
              cosineSimilarity={item.cosineSimilarity}
              showScore={showConnectionScores}
              onOpenConnection={onOpenConnection}
            />
          ) : (
            <MilestoneCard item={item.item} isActive={shouldAnimate} />
          );

        const refCallback = (el: HTMLDivElement | null) => {
          tileRefsMap.current.set(itemId, el);
        };

        const conceptId =
          item.kind === 'concept' ? item.post.sourceQuestionIds?.[0] ?? '' : undefined;

        if (shouldAnimate) {
          return (
            <motion.div
              key={itemId}
              ref={refCallback}
              data-feed-id={itemId}
              data-concept-id={conceptId}
              variants={tileEnterVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.25,                   // D-05: 250ms
                ease: [0.25, 0.1, 0.25, 1],       // ease-out cubic-bezier (Material standard)
                delay: indexInColumn * 0.04,      // D-05: 40ms stagger (per-tile delay over staggerChildren cascade — RESEARCH.md Open Question 5)
              }}
              style={{ position: 'relative' }}
            >
              {tileBody}
            </motion.div>
          );
        }
        return (
          <div
            key={itemId}
            ref={refCallback}
            data-feed-id={itemId}
            data-concept-id={conceptId}
            style={{ position: 'relative' }}
          >
            {tileBody}
          </div>
        );
      };

      const colATiles = items.filter((i) => tileColumnAssignmentsRef.current.get(getId(i)) === 0);
      const colBTiles = items.filter((i) => tileColumnAssignmentsRef.current.get(getId(i)) === 1);

      return (
        // Pitfall 1 fix from RESEARCH.md: framer-motion does NOT auto-respect prefers-reduced-motion.
        // <MotionConfig reducedMotion="user"> opts in to OS-level Reduce Motion honoring for all motion descendants.
        <MotionConfig reducedMotion="user">
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {colATiles.map((item, idx) => renderTile(item, idx))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {colBTiles.map((item, idx) => renderTile(item, idx))}
            </div>
          </div>
          {allExplored && (
            <div style={{ marginTop: '24px' }}>
              <VineBloomCard />
            </div>
          )}
        </MotionConfig>
      );
    }
    ```

    KEY INVARIANTS (load-bearing):
    - `<MotionConfig reducedMotion="user">` MUST wrap the entire return JSX (RESEARCH.md Pitfall 1 — framer-motion v12 does NOT auto-respect prefers-reduced-motion)
    - NO `column-count` / `columnCount` / `break-inside` / `breakInside` strings anywhere in this file (D-02)
    - NO `transform:` / `will-change` / `willChange` / `filter:` / `contain:` / `perspective:` on the MasonryFeed root or column wrappers (CLAUDE.md Header positioning load-bearing rule)
    - NO `position: 'fixed'` on column wrappers (CLAUDE.md Phase 32.1 lesson 3)
    - NO `dailyReadService.markExplored` call and NO `type: 'CONCEPT_EXPLORED'` literal in MasonryFeed.tsx (the canonical emit lives inside MemoizedConceptCard's thumbnail onClick — adding a sibling here breaks InfoFlow.video-tap-emit.test.mjs per RESEARCH.md Pitfall 4)
    - The 3 video useEffects MUST be byte-for-byte ports of InfoFlow.tsx:746-797 (Phase 36 GAP-C preservation per CLAUDE.md "Video post completion signals")

    Atomic commit message: `feat(42): add MasonryFeed.tsx with height-accumulating split + framer-motion entrance + MotionConfig reduced-motion gate`

    Note: VineBloomCard at this stage is a `function VineBloomCard() { return null; }` placeholder. Plan 42-04 replaces this stub with the real implementation (either inline in this file or extracted to a sibling file at planner discretion).
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; test -f src/components/MasonryFeed.tsx &amp;&amp; ! grep -qE "column-count|columnCount|break-inside|breakInside" src/components/MasonryFeed.tsx &amp;&amp; ! grep -qE "will-change|willChange|perspective:" src/components/MasonryFeed.tsx &amp;&amp; ! grep -q "dailyReadService.markExplored" src/components/MasonryFeed.tsx &amp;&amp; ! grep -q "type: 'CONCEPT_EXPLORED'" src/components/MasonryFeed.tsx &amp;&amp; grep -q "MotionConfig" src/components/MasonryFeed.tsx &amp;&amp; grep -q "columnHeightsRef" src/components/MasonryFeed.tsx &amp;&amp; grep -q "motion.div" src/components/MasonryFeed.tsx &amp;&amp; grep -q "visibilitychange" src/components/MasonryFeed.tsx &amp;&amp; grep -q "IntersectionObserver" src/components/MasonryFeed.tsx &amp;&amp; npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `app/src/components/MasonryFeed.tsx` exists
    - File contains string `columnHeightsRef` (height-accumulator state present)
    - File contains string `tileColumnAssignmentsRef` (assignment Map present)
    - File contains string `<MotionConfig reducedMotion="user">` (Pitfall 1 fix)
    - File contains string `motion.div` at least once (D-03 leaf-tile entrance)
    - File contains string `'visibilitychange'` (video state useEffect 1 ported)
    - File contains string `swipeProgress.on('change'` (video state useEffect 1 ported)
    - File contains string `IntersectionObserver` (video state useEffect 3 ported)
    - File does NOT contain any of: `column-count`, `columnCount`, `break-inside`, `breakInside` (D-02)
    - File does NOT contain any of: `will-change`, `willChange`, `perspective:` (Header positioning rule)
    - File does NOT contain `position: 'fixed'` or `position:fixed` (Phase 32.1 lesson 3)
    - File does NOT contain `dailyReadService.markExplored` (GAP-C single-emit invariant per Pitfall 4)
    - File does NOT contain `type: 'CONCEPT_EXPLORED'` (same — single-emit invariant)
    - File contains import `from 'framer-motion'` and import `from './InfoFlow'`
    - File line count ≥ 200 (full implementation per spec)
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>MasonryFeed.tsx compiles cleanly, satisfies all source-reading invariants from UI-SPEC § Source-Reading Invariant Tests #1, #2, #3, #4, ready for HomeScreen swap in plan 42-02 and VineBloomCard upgrade in plan 42-04.</done>
</task>

</tasks>

<verification>
- `cd app && npx tsc -b --noEmit` exits 0
- All source-reading assertions in Task 2's `<acceptance_criteria>` pass
- The existing `tests/components/InfoFlow.video-tap-emit.test.mjs` still passes (counterweight — proves the GAP-C emit at MemoizedConceptCard is undisturbed)
- `cd app && npm test` baseline does not regress (new MasonryFeed.tsx is not yet wired into any consumer, so no behavioral test should fail)
</verification>

<success_criteria>
- File `app/src/components/MasonryFeed.tsx` exists and exports `MasonryFeed` React component
- All 13 acceptance criteria of Task 2 verified via grep + tsc
- MemoizedConceptCard, ConnectionCard, and MilestoneCard exported from InfoFlow.tsx (additive — no behavior change)
- Zero new dependencies introduced (framer-motion + lucide-react already installed)
- Phase 36 GAP-C single-emit invariant preserved (no new emit added in MasonryFeed.tsx)
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-01-SUMMARY.md` documenting:
- Final MasonryFeed.tsx LOC count
- Confirmation that all source-reading invariants pass
- Atomic commit hashes for the 2 tasks
- Note that VineBloomCard is a placeholder (`return null`) and gets its real implementation in plan 42-04
</output>
</content>
</invoke>