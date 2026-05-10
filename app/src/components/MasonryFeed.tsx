import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig, motion, type Variants } from 'framer-motion';
import {
  MemoizedConceptCard,
  ConnectionCard,
  MilestoneCard,
  type InfoFlowItem,
} from './InfoFlow';
// Plan 42-01 deviation (Rule 3): SwipeTabContext lives in '../lib/swipe-tab-context'
// (verified by `grep "import.*SwipeTabContext" app/src/components/InfoFlow.tsx` →
// the InfoFlow source-of-truth file imports it from that path). The plan stub
// referenced './SwipeTabContainer' as the import source which is the consumer,
// not the declarer; corrected here so tsc -b --noEmit stays green.
import { SwipeTabContext } from '../lib/swipe-tab-context';
import type { DailyPost } from '../types';

// VineBloomCard placeholder — actual implementation lands in plan 42-04.
// For 42-01, this stub renders nothing; Plan 42-04 replaces it with the real
// celebration card so the celebration test can assert it appears at this position
// when allExplored becomes true. The render gate (`{allExplored && <VineBloomCard />}`)
// IS wired here so Plan 42-04 only swaps the function body.
function VineBloomCard() {
  return null; // placeholder — replaced in plan 42-04
}

// D-05 verbatim from UI-SPEC.md § Animation Contract.
// Two states (hidden + visible) keep the entrance focused on opacity + small Y-offset
// so reduced-motion (via the wrapping <MotionConfig reducedMotion="user">) collapses
// transform animations cleanly while preserving the opacity fade.
const tileEnterVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

interface MasonryFeedProps {
  items: InfoFlowItem[];
  onOpenConnection: (idA: string, idB: string) => void;
  showConnectionScores?: boolean;
  onOpenPost: (postId: string, post: DailyPost) => void;
  // Computed by HomeScreen from dailyReadService + useQuestions per RESEARCH.md
  // Pitfall 2. When all anchors are explored, the VineBloomCard renders below
  // the masonry as the celebration affordance.
  allExplored: boolean;
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
  // ===== Height-accumulator state (D-02 verbatim from UI-SPEC.md § Layout Algorithm) =====
  // columnHeightsRef: live total pixel height of each column AFTER each layout pass.
  // tileColumnAssignmentsRef: tile-id → column index (0 or 1). Append-only Map preserves
  // the immutability invariant — once a tile is assigned a column, it never moves.
  // tileRefsMap: tile-id → DOM element ref, used by the layout pass to re-measure
  // accumulated heights from clientHeight (RESEARCH.md § 5 mitigation 1 — robust
  // against async height growth such as image lazy-load + carousel mount).
  const columnHeightsRef = useRef<[number, number]>([0, 0]);
  const tileColumnAssignmentsRef = useRef<Map<string, 0 | 1>>(new Map());
  const tileRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // ===== VIDEO STATE OWNERSHIP — PORTED VERBATIM FROM InlineInfoFlow (InfoFlow.tsx:742-797) =====
  // Phase 36 GAP-C tap detector preservation requires these 3 useEffects to live at the wrapper level.
  // Do NOT modify the logic; each block is byte-for-byte from InfoFlow.tsx 746-797.
  // The single emit (markExplored + CONCEPT_EXPLORED) lives inside MemoizedConceptCard's thumbnail
  // onClick — adding a sibling here would break the InfoFlow.video-tap-emit single-emit invariant
  // per RESEARCH.md Pitfall 4.

  const [videoPlaying, setVideoPlaying] = useState<string | null>(null);
  const swipeCtx = useContext(SwipeTabContext);

  // (1) visibilitychange + swipeProgress (verbatim from InfoFlow.tsx:746-768)
  // Stop all videos when tab loses visibility (browser tab switch) AND when
  // user swipes away from Home tab (index 0) so two iframes never play together.
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

  // (2) intra-app navigation away from /home (verbatim from InfoFlow.tsx:773-776)
  // The swipeProgress handler above only fires on horizontal tab-to-tab; this
  // covers Outlet overlays (PostDetail, settings sub-pages) that keep Home
  // technically "active" under the overlay.
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/home') setVideoPlaying(null);
  }, [location.pathname]);

  // (3) IntersectionObserver scroll-out cleanup (verbatim from InfoFlow.tsx:782-797)
  // Stop video when the currently-playing card is scrolled out of viewport.
  // Observer only activates while a video is playing → zero perf overhead in the
  // common case. Fullscreen guard prevents stop when YouTube takes over the viewport.
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

  // newPostIds Set — same pattern as InfoFlow.tsx:798-820.
  // On first render, mark all current items as "already seen" so they don't animate.
  // Only items added AFTER mount enter via the framer-motion variants.
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

  // Mark any items that arrive after mount as seen so subsequent items continue to
  // animate only when newly appended (matches the InlineInfoFlow shape at line 814).
  useEffect(() => {
    for (const item of items) {
      const id = getId(item);
      if (id) seenPostIdsRef.current.add(id);
    }
  }, [items]);

  // ===== Height-accumulator algorithm (D-02 verbatim from UI-SPEC.md § Layout Algorithm) =====
  // Pass 1: append-only assignment for new items — once an id has a column, it stays.
  // Tie-breaker: column 0 wins when heights are equal (deterministic for SSR/hydration).
  // Pass 2: re-measure all column heights from clientHeight to absorb async growth
  // (images decoding, carousel cells mounting, etc.).
  useLayoutEffect(() => {
    for (const item of items) {
      const itemId = getId(item);
      if (!itemId) continue;
      if (tileColumnAssignmentsRef.current.has(itemId)) continue;
      const heights = columnHeightsRef.current;
      const col: 0 | 1 = heights[0] <= heights[1] ? 0 : 1;
      tileColumnAssignmentsRef.current.set(itemId, col);
    }
    columnHeightsRef.current = [0, 0];
    for (const [id, el] of tileRefsMap.current) {
      if (!el) continue;
      const col = tileColumnAssignmentsRef.current.get(id);
      if (col === undefined) continue;
      columnHeightsRef.current[col] += el.clientHeight + 12;
    }
  }, [items]);

  // Render a single tile — leaf cards stay unchanged (MemoizedConceptCard /
  // ConnectionCard / MilestoneCard are imported verbatim from InfoFlow).
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
            duration: 0.25, // D-05: 250ms
            ease: [0.25, 0.1, 0.25, 1], // ease-out cubic-bezier (Material standard)
            delay: indexInColumn * 0.04, // D-05: 40ms stagger (per-tile delay over staggerChildren cascade — RESEARCH.md Open Question 5)
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
    // Pitfall 1 fix from RESEARCH.md: framer-motion v12 does NOT auto-respect
    // prefers-reduced-motion. <MotionConfig reducedMotion="user"> opts in to
    // OS-level Reduce Motion honoring for all motion descendants — disables
    // transform + layout animations while preserving opacity/color animations.
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
