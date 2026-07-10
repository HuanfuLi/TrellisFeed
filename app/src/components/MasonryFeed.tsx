import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'framer-motion';
import { Bookmark, Heart } from 'lucide-react';
import {
  MemoizedConceptCard,
  ConnectionCard,
  MilestoneCard,
  type InfoFlowItem,
} from './InfoFlow';
import { useLongPress } from '../hooks/useLongPress';
import { engagementService } from '../services/engagement.service';
import type { DailyPost } from '../types';

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
  // Phase 43 LP — bubbled up to HomeScreen (43-06 host owns the LongPressMenu
  // sheet state + postId/anchorId). When undefined, long-press is a no-op (the
  // hook still binds but its callback short-circuits) so the integration is
  // safe to ship before the host wires up.
  onLongPress?: (postId: string, anchorId: string) => void;
  // Phase 43 LP-03 — HomeScreen-bumped on ENGAGEMENT_CHANGED so corner state
  // icons re-render across mounted tiles without each tile subscribing to the
  // event bus individually. Wave-3 host (43-06) wires the subscription.
  engagementVersion?: number;
}

function getId(item: InfoFlowItem): string {
  if (item.kind === 'concept') return item.post.id;
  if (item.kind === 'connection') return `conn-${item.questionA.id}-${item.questionB.id}`;
  if (item.kind === 'milestone') return item.item.id;
  return '';
}

// Phase 42 UAT-12 (2026-05-10) — per-style height estimates for Pass 1
// comparator. Operator screenshot showed 130-200px column imbalance because
// a fixed 280px estimate ignores the 60-110px height differences between
// presentation styles at half-width. The comparator was effectively
// balancing COUNT, not HEIGHT — so a random clustering of tall tiles in
// one column persisted until the next refill. These numbers are calibrated
// against measured DOM heights of each card variant after the chrome
// tightening (commits afe42922 + dec6241c + b2626cd4). Pass 2's DOM
// re-measure still overrides for subsequent batches; this only governs
// the comparator decision DURING the first render of a new tile.
const STYLE_HEIGHT_ESTIMATES: Record<string, number> = {
  image: 280,       // 1:1 image (≈ column width) + hook + tag
  'text-art': 290,  // 1:1 text-art card + hook below + tag
  suggestion: 180,  // header + 4 short topic buttons (after b2626cd4 shrink)
  connection: 280,  // mid-size colored card with two concept names + bridge
  milestone: 240,   // emoji + headline + body + maxWidth 280 cap
  default: 260,     // safe middle estimate for unknown / future styles
};

function estimateHeightForItem(item: InfoFlowItem): number {
  if (item.kind === 'connection') return STYLE_HEIGHT_ESTIMATES.connection;
  if (item.kind === 'milestone') return STYLE_HEIGHT_ESTIMATES.milestone;
  if (item.kind === 'concept') {
    // Suggestion posts use sourceType, not presentationStyle.
    if (item.post.sourceType === 'suggestion') return STYLE_HEIGHT_ESTIMATES.suggestion;
    const ps = item.post.presentationStyle;
    if (ps === 'text-art') return STYLE_HEIGHT_ESTIMATES['text-art'];
    if (ps === 'image') return STYLE_HEIGHT_ESTIMATES.image;
    return STYLE_HEIGHT_ESTIMATES.default;
  }
  return STYLE_HEIGHT_ESTIMATES.default;
}

// Phase 43 LP-03 + LP-05 — per-tile wrapper that:
//   (a) binds the 480ms long-press hook to the tile's pointer surface and
//       suppresses the post-long-press tap via onClickCapture + didLongPress
//       ref (RESEARCH Pitfall 2 — click-after-long-press),
//   (b) renders the corner state icon overlay (filled Bookmark / Heart) per
//       UI-SPEC §2 when engagementService.isSaved / isLiked returns true; only
//       on concept tiles (connection + milestone tiles have no postId for the
//       service), and
//   (c) participates in the AnimatePresence column wrapper's 200ms fade-exit
//       so LP-05's "dismiss ALL same-anchor tiles in one frame" reads as a
//       coordinated cascade instead of a popped layout shift.
//
// The hook MUST be called at the top level of a component, so this wrapper
// exists to lift it out of MasonryFeed's renderTile loop (where calling a
// hook would violate the rules of hooks).
interface TileWrapperProps {
  itemId: string;
  conceptId: string | undefined;
  anchorId: string | undefined;
  isConcept: boolean;
  shouldAnimate: boolean;
  indexInColumn: number;
  onLongPress?: (postId: string, anchorId: string) => void;
  engagementVersion?: number;
  registerRef: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}

function TileWrapper({
  itemId,
  conceptId,
  anchorId,
  isConcept,
  shouldAnimate,
  indexInColumn,
  onLongPress,
  engagementVersion,
  registerRef,
  children,
}: TileWrapperProps) {
  // 480ms long-press timer — codebase convention (ChatMessage.tsx pattern + useLongPress hook).
  // Hook always binds; callback short-circuits when host hasn't wired up yet.
  const { didLongPress, bind } = useLongPress(480, () => {
    if (onLongPress && isConcept && itemId && anchorId) {
      onLongPress(itemId, anchorId);
    }
  });

  // Corner-icon visibility derived from engagementService (synchronous getter).
  // engagementVersion in the dep array forces re-read when HomeScreen bumps it
  // on ENGAGEMENT_CHANGED, so save/like state changes from other surfaces
  // (PostDetailScreen, /saved screen) reflect on feed tiles without a per-tile
  // event-bus subscription.
  const isSaved = useMemo(
    () => (isConcept && itemId ? engagementService.isSaved(itemId) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemId, isConcept, engagementVersion],
  );
  const isLiked = useMemo(
    () => (isConcept && itemId ? engagementService.isLiked(itemId) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemId, isConcept, engagementVersion],
  );

  // Suppress short-tap navigation after a long-press fires. didLongPress is
  // set to true by useLongPress when its timer elapses; we consume + reset it
  // here so the subsequent click() from the same pointer sequence is captured
  // before it reaches the leaf card's onClick (RESEARCH Pitfall 2).
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didLongPress.current) {
      didLongPress.current = false;
      e.stopPropagation();
    }
  };

  // Phase 43 (gap closure 43-10): wrap each engagement-state icon in a
  // circular chip so saved/liked signals stay legible against busy image
  // tile backgrounds. Heart's fill/color migrates
  // off the node-salmon token (which inverts to near-black in dark mode)
  // onto --corner-chip-fg-liked. Chip box-shadow replaces the previous
  // per-icon drop-shadow filter. See
  // .planning/debug/engagement-corner-icon-no-background.md.
  const cornerOverlay =
    isConcept && (isSaved || isLiked) ? (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          pointerEvents: 'none',
        }}
      >
        {isSaved && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '999px',
              backgroundColor: 'var(--corner-chip-bg)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <Bookmark
              size={14}
              fill="var(--corner-chip-fg-saved)"
              color="var(--corner-chip-fg-saved)"
            />
          </span>
        )}
        {isLiked && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '999px',
              backgroundColor: 'var(--corner-chip-bg)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <Heart
              size={14}
              fill="var(--corner-chip-fg-liked)"
              color="var(--corner-chip-fg-liked)"
            />
          </span>
        )}
      </div>
    ) : null;

  // LP-05 exit prop — 200ms fade + scale 0.96 (Phase 42 tile motion vocabulary).
  // Both branches (newly-appended + pre-existing) render as motion.div so
  // AnimatePresence detects the exit transition uniformly. The else-branch
  // intentionally omits variants/initial/animate so it doesn't re-enter on
  // layout shifts when AnimatePresence re-keys (per UI-SPEC §4).
  if (shouldAnimate) {
    return (
      <motion.div
        ref={registerRef}
        data-feed-id={itemId}
        data-concept-id={conceptId}
        variants={tileEnterVariants}
        initial="hidden"
        animate="visible"
        exit={{
          opacity: 0,
          scale: 0.96,
          transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
        }}
        transition={{
          duration: 0.25, // D-05: 250ms
          ease: [0.25, 0.1, 0.25, 1], // ease-out cubic-bezier (Material standard)
          delay: indexInColumn * 0.04, // D-05: 40ms stagger
        }}
        style={{ position: 'relative' }}
        onClickCapture={handleClickCapture}
        {...bind}
      >
        {children}
        {cornerOverlay}
      </motion.div>
    );
  }
  return (
    <motion.div
      ref={registerRef}
      data-feed-id={itemId}
      data-concept-id={conceptId}
      exit={{
        opacity: 0,
        scale: 0.96,
        transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
      }}
      style={{ position: 'relative' }}
      onClickCapture={handleClickCapture}
      {...bind}
    >
      {children}
      {cornerOverlay}
    </motion.div>
  );
}

export function MasonryFeed({
  items,
  onOpenConnection,
  showConnectionScores = false,
  onOpenPost,
  onLongPress,
  engagementVersion,
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
  // Pass 1: append-only assignment runs DURING render (not useLayoutEffect) so first-render
  // filters at the bottom of this function see populated assignments — refs don't trigger
  // re-renders, so a ref-only post-commit assignment would leave the first paint empty.
  // The has() check makes the loop idempotent under StrictMode double-invocation.
  // Per-style estimates (UAT-12) replace the prior fixed 280 default — the comparator
  // now zigzags based on EXPECTED tile heights, not just count, closing the 130-200px
  // column imbalance the operator reported when tall tiles clustered randomly.
  for (const item of items) {
    const itemId = getId(item);
    if (!itemId) continue;
    if (tileColumnAssignmentsRef.current.has(itemId)) continue;
    const heights = columnHeightsRef.current;
    const col: 0 | 1 = heights[0] <= heights[1] ? 0 : 1;
    tileColumnAssignmentsRef.current.set(itemId, col);
    const measured = tileRefsMap.current.get(itemId)?.clientHeight;
    columnHeightsRef.current[col] += (measured ?? estimateHeightForItem(item)) + 12;
  }

  // Pass 2: post-paint, re-measure all column heights from clientHeight to absorb async
  // growth (images decoding, carousel cells mounting). Refines the estimate that Pass 1
  // used for the NEXT batch of newly-appended tiles.
  useLayoutEffect(() => {
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
  // Wrapping happens in <TileWrapper> (above) so the useLongPress hook obeys
  // the rules-of-hooks (top-level component, not loop body).
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

    const isConcept = item.kind === 'concept';
    const conceptId = isConcept ? item.post.sourceQuestionIds?.[0] ?? '' : undefined;
    // anchorId mirrors conceptId for concept tiles — the dismiss action operates
    // on the concept anchor that owns this post (Phase 39 D-06 semantic).
    const anchorId = isConcept ? item.post.sourceQuestionIds?.[0] ?? '' : undefined;

    return (
      <TileWrapper
        key={itemId}
        itemId={itemId}
        conceptId={conceptId}
        anchorId={anchorId}
        isConcept={isConcept}
        shouldAnimate={shouldAnimate}
        indexInColumn={indexInColumn}
        onLongPress={onLongPress}
        engagementVersion={engagementVersion}
        registerRef={refCallback}
      >
        {tileBody}
      </TileWrapper>
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
      {/* width: '100%' is explicit so the flex container fills HomeScreen's 448px-cap content area.
          minWidth: 0 on each column is LOAD-BEARING — same gotcha as CLAUDE.md ChatInput rule.
          Without it, flex children with intrinsic content width (image-bearing cards)
          refuse to shrink below their natural size and the right column overflows the parent. */}
      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Phase 43 LP-05 — AnimatePresence wraps each column so the
              ANCHOR_DISMISSED handler (HomeScreen, 43-06) can filter all
              same-anchor tiles in one setState and they fade out together
              over 200ms instead of popping. initial={false} prevents the
              entrance variant from re-firing when AnimatePresence re-keys
              on layout shifts (UI-SPEC §4). */}
          <AnimatePresence initial={false}>
            {colATiles.map((item, idx) => renderTile(item, idx))}
          </AnimatePresence>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AnimatePresence initial={false}>
            {colBTiles.map((item, idx) => renderTile(item, idx))}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
