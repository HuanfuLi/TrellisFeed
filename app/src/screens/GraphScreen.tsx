import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style';
import type { MindElixirData, MindElixirInstance, NodeObj } from 'mind-elixir';
import { RefreshCw, GitBranch, X, ChevronRight, FoldVertical, UnfoldVertical } from 'lucide-react';
import i18n from '../locales';
import type { Question } from '../types';
import { graphService } from '../services/graph.service';
import { graphCommandService } from '../services/graph-command.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { buildAnchorReflectionTree, reorganizeMindmap, isReorgInProgress } from '../services/canonical-knowledge.service';
import { settingsService } from '../services/settings.service';
import { eventBus } from '../lib/event-bus';
import { createLongPressOrDragMachine } from '../hooks/useLongPressOrDrag';
import { DragOverlay, type DragState, type DropTargetSnapshot } from '../components/graph/DragOverlay';
import { CorrectionCard, getActionsForNode, type CorrectionAction } from '../components/graph/CorrectionCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { MergeConfirmPreview } from '../components/graph/MergeConfirmPreview';
import { UndoButton } from '../components/graph/UndoButton';
import { PickModeBanner } from '../components/graph/PickModeBanner';
import { questionService } from '../services/question.service';
import { hapticImpactMedium } from '../lib/haptics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

// ─── Graph → MindElixir categorised tree ─────────────────────────────────────
//
// Root = canonical root label. Branches and clusters come from the canonical
// reflection tree so the Graph screen reflects the knowledge structure the
// system is learning, instead of rebuilding ad hoc keyword buckets every time.

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function buildMindElixirData(nodes: Question[]): MindElixirData {
  const rootObj: NodeObj = {
    id: 'root-knowledge',
    topic: i18n.t('graph.rootLabel'),
    children: [],
    expanded: true,
  };

  if (nodes.length === 0) return { nodeData: rootObj };
  const reflection = buildAnchorReflectionTree(nodes);

  const children: NodeObj[] = [];
  for (const root of reflection) {
    const branchNodes: NodeObj[] = root.branches.map((branch) => ({
      id: `branch-${root.rootLabel}-${branch.branchLabel}`,
      topic: branch.branchLabel,
      expanded: true,
      children: branch.clusters.map((cluster) => ({
        id: cluster.clusterEntity?.id ?? `cluster-${root.rootLabel}-${branch.branchLabel}-${cluster.clusterLabel}`,
        topic: cluster.clusterLabel,
        expanded: true,
        children: [
          // Anchor nodes as leaves (with collapsed Q&A children)
          ...cluster.anchors.map(({ anchor, qaChildren }) => ({
            id: anchor.id,
            topic: truncate(anchor.title || anchor.content, 50),
            expanded: false,
            children: qaChildren.map((qa) => ({
              id: qa.id,
              topic: truncate(qa.title || qa.content, 60),
              children: [],
            })),
          })),
          // Legacy nodes (no anchor) shown directly as leaves
          ...cluster.legacyNodes.map((node) => ({
            id: node.id,
            topic: truncate(node.title || node.content, 60),
            children: [],
          })),
        ],
      })),
    }));

    if (root.rootLabel === 'Knowledge') {
      // Promote "Knowledge" root branches directly under main root
      children.push(...branchNodes);
    } else {
      children.push({
        id: `root-${root.rootLabel}`,
        topic: root.rootLabel,
        expanded: true,
        children: branchNodes,
      });
    }
  }
  rootObj.children = children;

  return { nodeData: rootObj };
}

// ─── Trellis theme for mind-elixir ─────────────────────────────────────────

/** CSS overrides injected once for sub-node rects and touch-friendly expand buttons */
let styleInjected = false;
function injectMindMapStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    /* ── Sub-node (cluster / leaf) enclosed in rounded rects ── */
    .map-container me-parent me-tpc {
      background-color: var(--bgcolor);
      border: 1.5px solid var(--panel-border-color);
      border-radius: 18px;
    }

    /* ── Expand / collapse: compact visual, large touch target ────────
       The visible dot is 20px with a subtle border. An invisible
       ::before pseudo-element extends the tap area to 44×44px
       (WCAG 2.5.8).  Both main-branch and sub-branch buttons are
       normalised to sit below the node so placement is consistent. */

    /* Reset the library's divergent positioning for main-branch epd */
    .map-container me-main > me-wrapper > me-parent > me-epd {
      top: 100%;
      transform: translateY(-50%);
    }

    .map-container me-parent me-epd {
      width: 28px;
      height: 28px;
      opacity: 1;
      border-radius: 50%;
      background-color: var(--panel-bgcolor);
      border: 1.5px solid var(--panel-border-color);
      background-size: 18px 18px;
      position: absolute;
      z-index: 9;
      pointer-events: all;
    }
    /* Invisible 44x44px touch target around the 28px dot (WCAG 2.5.8) */
    .map-container me-parent me-epd::before {
      content: '';
      position: absolute;
      inset: -8px;
      border-radius: 50%;
    }
    .map-container me-parent me-epd.minus {
      opacity: 0.7;
    }
    @media (hover: none) {
      .map-container me-parent me-epd.minus {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

function buildTheme() {
  const isDark = document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return {
    name: 'Trellis',
    type: (isDark ? 'dark' : 'light') as 'dark' | 'light',
    // Soft, distinct branch colours — 10 hues for clear visual separation
    palette: [
      '#ea76cb', '#dd7878', '#e64553', '#fe640b',
      '#df8e1d', '#40a02b', '#209fb5', '#1e66f5', '#7287fd',
    ],
    cssVar: {
      '--node-gap-x': '24px',
      '--node-gap-y': '12px',
      '--main-gap-x': '60px',
      '--main-gap-y': '18px',
      '--main-color': '#ffffff',
      '--main-bgcolor': isDark ? '#209fb5' : '#1e8da6',
      '--main-bgcolor-transparent': isDark ? 'rgba(32,159,181,0)' : 'rgba(30,141,166,0)',
      '--color': isDark ? '#cdd6f4' : '#333333',
      '--bgcolor': isDark ? '#1e1e2e' : '#f8f9fc',
      '--selected': '#209fb5',
      '--accent-color': '#209fb5',
      '--root-color': '#ffffff',
      '--root-bgcolor': isDark ? '#1a8a9e' : '#0d7d8f',
      '--root-border-color': 'transparent',
      '--root-radius': '24px',
      '--main-radius': '20px',
      // 44px min touch target height for mobile accessibility (WCAG 2.5.8)
      '--topic-padding': '10px 18px',
      '--panel-color': isDark ? '#cdd6f4' : '#333333',
      '--panel-bgcolor': isDark ? '#1e1e2e' : '#ffffff',
      '--panel-border-color': isDark ? '#45475a' : '#dde0e9',
      '--map-padding': '32px',
    },
  };
}

// ─── Master Map (mind-elixir) ─────────────────────────────────────────────────

interface MasterMapProps {
  nodes: Question[];
  edges: GraphEdge[];
  onNodeClick: (q: Question) => void;
  // Phase 49-01 — gesture engine callbacks (W-3 LOCKED — factory-driven delegated listener).
  // Phase 49-06 — fires INSIDE the 480ms timer (mid-press); CorrectionCard mounts
  // while the finger is still down (matches useLongPress.ts:42-45 convention).
  onLongPressRecognized: (
    node: Question | { kind: 'root' } | { kind: 'branch'; id: string },
    x: number,
    y: number,
  ) => void;
  onDragStart: (state: DragState, targets: DropTargetSnapshot[]) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (
    snappedTarget: DropTargetSnapshot | null,
    sourceNode: Question,
    nodeMap: Record<string, Question>,
  ) => void;
  // Phase 49-04 — propagated for the persistent UndoButton (D-16 disables tap during reorg).
  reorganizing: boolean;
  // Phase 49-04 — pick-mode tap interception. When the GraphScreen-owned
  // pickMode state is non-null, the delegated click listener forwards target
  // node taps to this callback INSTEAD of the standard inspector-card path.
  // Returns true if the tap was handled (commit or invalid-target toast), so
  // the listener can short-circuit. Returns false to fall through to the
  // standard onNodeClick path (only happens when pickMode is null at click
  // time — closure-vs-state racing).
  onPickModeTap: (target: Question) => boolean;
}

function setAllExpanded(node: NodeObj, expanded: boolean): void {
  node.expanded = expanded;
  if (node.children) {
    for (const child of node.children) {
      setAllExpanded(child, expanded);
    }
  }
}

function MasterMap({
  nodes,
  edges,
  onNodeClick,
  isVisible,
  onLongPressRecognized,
  onDragStart,
  onDragMove,
  onDragEnd,
  reorganizing,
  onPickModeTap,
}: MasterMapProps & { isVisible: boolean }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MindElixirInstance | null>(null);
  const initCompletedRef = useRef(false);
  const [allExpanded, setAllExpandedState] = useState(true);

  // Keep a stable ref to the callback so the effect doesn't re-run when it changes
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Phase 49-01 — gesture callbacks captured via refs so the delegated
  // listener closure always sees the latest GraphScreen state setters
  // without forcing a heavy MindElixir re-init on callback identity change.
  const onLongPressRecognizedRef = useRef(onLongPressRecognized);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  // Phase 49-04 — pick-mode tap interception ref (same callback-ref pattern).
  const onPickModeTapRef = useRef(onPickModeTap);
  useEffect(() => { onLongPressRecognizedRef.current = onLongPressRecognized; }, [onLongPressRecognized]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragMoveRef.current = onDragMove; }, [onDragMove]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onPickModeTapRef.current = onPickModeTap; }, [onPickModeTap]);
  // `t` lives in a ref too — same reason. Locale changes shouldn't tear down
  // MindElixir and rebuild the whole map.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // Node lookup ref — populated synchronously inside the main effect
  const nodeMapRef = useRef<Record<string, Question>>({});

  // Reset init tracking when nodes change so the map reinitializes with new data
  useEffect(() => {
    initCompletedRef.current = false;
  }, [nodes, edges]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Skip initialization when not visible (prevents 0-width MindElixir bug)
    if (!isVisible) return;

    // If already initialized with current data, just re-center/re-scale
    if (initCompletedRef.current && instanceRef.current) {
      const mei = instanceRef.current;
      mei.toCenter();
      const containerWidth = containerRef.current.offsetWidth;
      if (containerWidth > 0) {
        mei.move(-containerWidth * 0.25, 0);
      }
      return;
    }

    // Populate nodeMap synchronously before creating listeners
    nodeMapRef.current = Object.fromEntries(nodes.map((n) => [n.id, n]));

    injectMindMapStyles();

    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    const mei = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.RIGHT,
      editable: false,
      draggable: true,
      contextMenu: false,
      toolBar: false,
      keypress: false,
      theme: buildTheme(),
    });

    // Hide until scaled to prevent full-size "Knowledge" flash
    containerRef.current.style.opacity = '0';

    mei.init(buildMindElixirData(nodes));
    initCompletedRef.current = true;

    // Zoom to 50%, centre, then nudge left so the right-expanding tree
    // uses more of the portrait viewport instead of leaving the left half empty.
    // Cleared in cleanup so a rapid re-render (e.g. GRAPH_UPDATED firing between
    // init and the 0-ms tick) doesn't leave a stale closure calling scale() on
    // a destroyed instance — mind-elixir's scale() dereferences its internal map
    // DOM node, which is null after destroy(), and crashes with
    // "Cannot read properties of undefined (reading 'getBoundingClientRect')".
    const initTimeoutId = window.setTimeout(() => {
      if (mei !== instanceRef.current || !containerRef.current) return;
      mei.scale(0.5);
      mei.toCenter();
      const containerWidth = containerRef.current.offsetWidth;
      if (containerWidth > 0) {
        mei.move(-containerWidth * 0.25, 0);
      }
      containerRef.current.style.opacity = '1';
    }, 0);

    // mind-elixir does NOT fire a bus event for regular node clicks.
    // Instead, each <me-tpc> custom element carries a `.nodeObj` property on the
    // DOM node itself. We capture clicks at the container level and walk up.
    const handleClick = (e: MouseEvent) => {
      const tpc = (e.target as HTMLElement).closest('me-tpc') as (HTMLElement & { nodeObj?: NodeObj }) | null;
      if (!tpc?.nodeObj) return;
      const id = tpc.nodeObj.id;
      if (!id || id.startsWith('cat-') || id === 'root-knowledge') return;
      const q = nodeMapRef.current[id];
      if (!q) return;
      // Phase 49-04 — pick-mode tap interception. The GraphScreen-owned
      // pickMode state machine decides whether this tap commits move/merge.
      // If the callback returns true, the tap was consumed (commit or
      // invalid-target toast) — short-circuit the inspector-card path.
      if (onPickModeTapRef.current(q)) return;
      onNodeClickRef.current(q);
    };
    containerRef.current.addEventListener('click', handleClick);

    // ─── Phase 49-01 — gesture engine: delegated pointerdown listener ──────────
    //
    // Sibling to handleClick. Uses createLongPressOrDragMachine (W-3 LOCKED —
    // factory, not hook indirection) so the closure can see latest GraphScreen
    // state via callback refs.
    //
    // Critical invariants (RESEARCH §R1 + 49-06 gap closure + 49-06.1 fix):
    //  - Do NOT stopPropagation() on raw pointerdown — MindElixir's pan still
    //    needs the pointer until long-press is recognized.
    //  - DO stopPropagation() in a CAPTURE-PHASE pointermove listener AFTER
    //    recognition (480ms tick). Engages inside the factory's
    //    onLongPressRecognized callback; torn down on pointerup/pointercancel.
    //    This is the SOLE pan-suppression defense — do NOT add back
    //    dragMoveHelper.clear() / direct mousedown mutation / container
    //    setPointerCapture transfer. Those pre-empt MindElixir's pointerup
    //    cleanup of its pinch-zoom Map `s` (MindElixir.js:960): the pointerup
    //    handler at MindElixir.js:1082 is `t.mousedown && (y(f.target, ...),
    //    t.clear())`, so clearing mousedown at 480ms makes pointerup skip its
    //    own pointer-capture release, stranding a pointerId in `s`. Result:
    //    every long-press leaks one entry, and subsequent single-finger pans
    //    register as pinch-zoom because `s.size >= 2`.
    //  - touchAction: 'none' on the container (existing) + data-no-swipe-nav
    //    must remain untouched.
    let activeMachine: ReturnType<typeof createLongPressOrDragMachine> | null = null;
    let activeSourceNode: Question | null = null;
    let activeNode: Question | { kind: 'root' } | { kind: 'branch'; id: string } | null = null;
    let activeSnapshot: DropTargetSnapshot[] = [];
    let activePointerDownEvent: PointerEvent | null = null;
    // Phase 49-06 — capture-phase pan suppressor reference. Stored on a higher-scope
    // variable so handlePointerUp / handlePointerCancel can remove the same function
    // reference. null when no gesture is mid-flight.
    let activePanSuppressor: ((e: PointerEvent) => void) | null = null;

    const findNodeFromTarget = (
      target: EventTarget | null,
    ): Question | { kind: 'root' } | { kind: 'branch'; id: string } | null => {
      const tpc = (target as HTMLElement | null)?.closest('me-tpc') as
        | (HTMLElement & { nodeObj?: NodeObj })
        | null;
      if (!tpc?.nodeObj) return null;
      const id = tpc.nodeObj.id;
      if (id === 'root-knowledge') return { kind: 'root' };
      if (id.startsWith('branch-')) return { kind: 'branch', id };
      return nodeMapRef.current[id] ?? null;
    };

    const handlePointerDown = (pointerdownEvent: PointerEvent) => {
      // Reorg gate per D-16 — block gesture-start during reorganize.
      if (isReorgInProgress()) {
        toast(tRef.current('graph.correction.toast.reorgInProgress'), 'info');
        return;
      }

      const node = findNodeFromTarget(pointerdownEvent.target);
      if (!node) return;

      activeNode = node;
      activeSourceNode = ('kind' in node) ? null : node;
      activePointerDownEvent = pointerdownEvent;

      // Snapshot drop targets ONCE at gesture-start (T-49-02 mitigation —
      // later DOM mutations cannot change the target set mid-drag).
      const tpcs = Array.from(containerRef.current!.querySelectorAll('me-tpc'));
      activeSnapshot = tpcs
        .map((el) => {
          const obj = (el as HTMLElement & { nodeObj?: NodeObj }).nodeObj;
          if (!obj || obj.id === 'root-knowledge' || obj.id.startsWith('branch-')) return null;
          const q = nodeMapRef.current[obj.id];
          if (!q) return null;
          const kind: 'cluster' | 'anchor' | 'qa' = q.isClusterNode
            ? 'cluster'
            : q.isAnchorNode
              ? 'anchor'
              : 'qa';
          return { id: q.id, kind, rect: el.getBoundingClientRect() };
        })
        .filter((x): x is DropTargetSnapshot => x !== null);

      activeMachine = createLongPressOrDragMachine({
        longPressMs: 480,
        dragThresholdPx: 8,
        onLongPressRecognized: (x, y) => {
          if (activeNode === null) return;
          // Fire the GraphScreen-level recognition handler (mounts CorrectionCard).
          onLongPressRecognizedRef.current(activeNode, x, y);

          // ─── Phase 49-06.1 — MindElixir pan suppression + state-machine feed ──
          //
          // MindElixir's pointermove handler (MindElixir.js:1046-1075, registered
          // on this container at MindElixir.js:1098) pans the map on every touch
          // pointermove when editable:false. We attach a CAPTURE-PHASE listener
          // that BOTH drives our state machine AND stops propagation, so the
          // bubble-phase MindElixir handler never fires for the duration of the
          // gesture — no pan side-effect.
          //
          // 49-06.2 NOTE: driving activeMachine.onPointerMove inside the
          // capture-phase listener is load-bearing. stopPropagation prevents the
          // bubble-phase `handlePointerMove` (registered via addEventListener
          // below at the same container) from also firing — without the explicit
          // feed here, the state machine would never see post-recognition moves
          // and the 8px drag-threshold transition (long-press → drag) would
          // never trip. Operator UAT 2026-05-18: long-press worked, drag did not.
          //
          // Earlier iterations (tiers a/b + container setPointerCapture transfer)
          // pre-emptively cleared MindElixir's internal mousedown flag at 480ms.
          // That broke MindElixir's pointerup branch at line 1082, which gates
          // pointer-capture release + state clear on mousedown. Result: each
          // long-press stranded a pointerId in MindElixir's pinch-zoom Map `s`
          // (MindElixir.js:960), and the next single-finger pan tripped the
          // s.size >= 2 pinch branch at MindElixir.js:1052. Capture-phase
          // pointermove suppression is sufficient on its own.
          const capturePanSuppressor = (e: PointerEvent) => {
            // Feed the state machine FIRST so it can transition to drag at the
            // 8px threshold. Then stop propagation so MindElixir's bubble-phase
            // pan handler — AND our own bubble-phase handlePointerMove (now
            // redundant after recognition) — both stay silent for this event.
            activeMachine?.onPointerMove(e);
            e.stopPropagation();
          };
          activePanSuppressor = capturePanSuppressor;
          try {
            containerRef.current?.addEventListener('pointermove', capturePanSuppressor, { capture: true });
          } catch {
            /* ignore — non-DOM test environments */
          }
        },
        onDragStart: (x, y) => {
          if (!activeSourceNode) return; // root/branch can't drag
          const originRect = (pointerdownEvent.target as HTMLElement).getBoundingClientRect();
          const initialDragState: DragState = {
            sourceNode: activeSourceNode,
            originRect,
            ghostRect: { width: 200, height: 44 },
            pointerX: x,
            pointerY: y,
            snappedTargetId: null,
          };
          onDragStartRef.current(initialDragState, activeSnapshot);
        },
        onDragMove: (x, y) => {
          onDragMoveRef.current(x, y);
        },
        onDragEnd: (x, y) => {
          if (!activeSourceNode) return;
          // Recompute snap target at drop-time using the snapshot taken at
          // gesture-start. Mirrors DragOverlay's snap math (32px Euclidean).
          const SNAP_PX = 32;
          let snapped: DropTargetSnapshot | null = null;
          let bestDist = Number.POSITIVE_INFINITY;
          for (const tgt of activeSnapshot) {
            const cx = tgt.rect.x + tgt.rect.width / 2;
            const cy = tgt.rect.y + tgt.rect.height / 2;
            const d = Math.hypot(cx - x, cy - y);
            if (d <= SNAP_PX && d < bestDist) {
              snapped = tgt;
              bestDist = d;
            }
          }
          onDragEndRef.current(snapped, activeSourceNode, nodeMapRef.current);
        },
      });
      activeMachine.onPointerDown(pointerdownEvent);
    };

    const handlePointerMove = (e: PointerEvent) => activeMachine?.onPointerMove(e);
    const handlePointerUp = (e: PointerEvent) => {
      activeMachine?.onPointerUp(e);
      // Phase 49-06 — tear down capture-phase pan suppressor BEFORE the
      // null-outs so the same function reference is passed to removeEventListener.
      if (activePanSuppressor) {
        try {
          containerRef.current?.removeEventListener('pointermove', activePanSuppressor, { capture: true } as unknown as EventListenerOptions);
        } catch {
          /* ignore */
        }
        activePanSuppressor = null;
      }
      activeMachine = null;
      activeSourceNode = null;
      activeNode = null;
      activeSnapshot = [];
      activePointerDownEvent = null;
    };
    const handlePointerCancel = (e: PointerEvent) => {
      activeMachine?.onPointerCancel(e);
      // Phase 49-06 — tear down capture-phase pan suppressor BEFORE the null-outs.
      if (activePanSuppressor) {
        try {
          containerRef.current?.removeEventListener('pointermove', activePanSuppressor, { capture: true } as unknown as EventListenerOptions);
        } catch {
          /* ignore */
        }
        activePanSuppressor = null;
      }
      activeMachine = null;
      activeSourceNode = null;
      activeNode = null;
      activeSnapshot = [];
      activePointerDownEvent = null;
    };
    const handleClickCapture = (e: MouseEvent) => {
      // Click suppression after long-press — see useLongPressOrDrag.onClickCapture.
      activeMachine?.onClickCapture(e as unknown as PointerEvent);
    };

    containerRef.current.addEventListener('pointerdown', handlePointerDown);
    containerRef.current.addEventListener('pointermove', handlePointerMove);
    containerRef.current.addEventListener('pointerup', handlePointerUp);
    containerRef.current.addEventListener('pointercancel', handlePointerCancel);
    // Capture phase so suppression fires before MindElixir's bubbling handler.
    containerRef.current.addEventListener('click', handleClickCapture, true);
    void activePointerDownEvent; // referenced inside closures; tsc satisfied

    // Fix: On mobile, the library's drag detection sets `moved = true` on
    // ANY pointermove (even 1px), then the click handler bails early before
    // reaching the ME-EPD check. Touch screens nearly always produce micro-
    // movement, so expand/collapse never fires via click.
    //
    // We use touchstart/touchend directly — these fire independently of the
    // library's pointer capture and drag detection. If the touch started on
    // an me-epd and ended within a small radius, we treat it as a tap.
    let epdTouchTarget: HTMLElement | null = null;
    let epdTouchStartX = 0;
    let epdTouchStartY = 0;
    const TAP_THRESHOLD = 10; // px — allow small finger wobble

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'ME-EPD' || target.closest?.('me-epd')) {
        epdTouchTarget = target.tagName === 'ME-EPD' ? target : target.closest('me-epd') as HTMLElement;
        epdTouchStartX = e.touches[0].clientX;
        epdTouchStartY = e.touches[0].clientY;
      } else {
        epdTouchTarget = null;
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!epdTouchTarget) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - epdTouchStartX;
      const dy = touch.clientY - epdTouchStartY;
      if (dx * dx + dy * dy < TAP_THRESHOLD * TAP_THRESHOLD) {
        e.preventDefault(); // Prevent delayed click from also firing
        const tpc = epdTouchTarget.previousElementSibling;
        if (tpc) mei.expandNode(tpc as unknown as Parameters<typeof mei.expandNode>[0]);
      }
      epdTouchTarget = null;
    };
    containerRef.current.addEventListener('touchstart', handleTouchStart, { passive: true });
    containerRef.current.addEventListener('touchend', handleTouchEnd);

    instanceRef.current = mei;
    const container = containerRef.current;

    return () => {
      window.clearTimeout(initTimeoutId);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      // Phase 49-01 — gesture engine teardown
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerCancel);
      container.removeEventListener('click', handleClickCapture, true);
      activeMachine?.reset();
      activeMachine = null;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      initCompletedRef.current = false;
    };
  }, [nodes, edges, isVisible]);

  if (nodes.length === 0) {
    return (
      <div
        style={{
          height: '460px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--muted-foreground)',
          padding: '40px',
          textAlign: 'center',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface-variant)',
        }}
      >
        <GitBranch size={48} style={{ opacity: 0.3 }} />
        <p style={{ fontWeight: 600 }}>{t('graph.empty.heading')}</p>
        <p style={{ fontSize: '0.875rem' }}>{t('graph.empty.body')}</p>
      </div>
    );
  }

  const handleToggleExpand = () => {
    const mei = instanceRef.current;
    if (!mei) return;
    const next = !allExpanded;
    setAllExpanded(mei.nodeData, next);
    mei.refresh();
    setTimeout(() => {
      mei.toCenter();
      const w = containerRef.current?.offsetWidth ?? 0;
      if (w > 0) mei.move(-w * 0.25, 0);
    }, 0);
    setAllExpandedState(next);
  };

  return (
    <div
      style={{
        height: '460px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        backgroundColor: 'var(--surface-variant)',
        position: 'relative',
      }}
    >
      <div
        ref={containerRef}
        data-no-swipe-nav="true"
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
      {/* Phase 49-04 — persistent UndoButton at right: 56px (D-13). Anchored to
          the same containing block as the expand/collapse button below so the
          two appear as a coherent pair at the bottom-right corner. D-16 — the
          reorganizing prop disables the tap visually + functionally. */}
      <UndoButton reorganizing={reorganizing} />
      <button
        onClick={handleToggleExpand}
        title={allExpanded ? t('graph.toggleCollapseTitle') : t('graph.toggleExpandTitle')}
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          color: 'var(--foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-1)',
          fontSize: '15px',
          fontWeight: 700,
          zIndex: 10,
        }}
      >
        {allExpanded ? <FoldVertical size={18} /> : <UnfoldVertical size={18} />}
      </button>
    </div>
  );
}

// ─── Card Stack Inbox (View 2) ────────────────────────────────────────────────


// ─── Module-level cache (survives unmount, no flicker on re-visit) ───────────

let cachedNodes: Question[] | null = null;
let cachedEdges: GraphEdge[] | null = null;

// ─── Graph Screen ─────────────────────────────────────────────────────────────

export function GraphScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  // With the swipe strip, GraphScreen is always mounted at full width —
  // keeping it visible prevents it from disappearing during horizontal swiping.
  const isVisible = true;
  const [nodes, setNodes] = useState<Question[]>(cachedNodes ?? []);
  const [edges, setEdges] = useState<GraphEdge[]>(cachedEdges ?? []);
  const [selectedNode, setSelectedNode] = useState<Question | null>(null);
  const [reorganizing, setReorganizing] = useState(isReorgInProgress);
  const [showReorgConfirm, setShowReorgConfirm] = useState(false);

  // Phase 49-01 — drag-overlay state.
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargets, setDropTargets] = useState<DropTargetSnapshot[]>([]);
  // Phase 49-01 — mergeConfirm state (Plan 49-03 now mounts MergeConfirmPreview).
  const [mergeConfirm, setMergeConfirm] = useState<{ loser: Question; survivor: Question } | null>(null);
  // Phase 49-03 — delete confirm state. Anchor-targeted; cluster delete is out of scope per D-09.
  const [deleteConfirm, setDeleteConfirm] = useState<{ node: Question } | null>(null);
  // Phase 49-02 — captured long-press release coordinates feed CorrectionCard placement.
  const [correctionNode, setCorrectionNode] = useState<{ node: Question; anchorX: number; anchorY: number } | null>(null);
  // Phase 49-04 — pickMode state for menu-driven Move/Merge (D-06). W-2:
  // originalAnchorX/Y captured at entry so Cancel restores the CorrectionCard
  // at the EXACT release coords the user saw, not a window-center fallback.
  const [pickMode, setPickMode] = useState<{
    kind: 'move' | 'merge';
    sourceNode: Question;
    originalAnchorX: number;
    originalAnchorY: number;
  } | null>(null);
  // Latest-state ref so the delegated click listener (which closes over the
  // pickModeRef at attachment time) sees up-to-date pickMode without forcing
  // a MindElixir re-init. Mirrors the existing callback-ref pattern.
  const pickModeRef = useRef(pickMode);
  useEffect(() => { pickModeRef.current = pickMode; }, [pickMode]);

  // Keep dragState accessible from the gesture handler closure (which lives
  // in MasterMap's useEffect). The handler reads via this ref to decide
  // whether a drop is still valid.
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

  const reload = useCallback(() => {
    void graphService.getGraph().then(({ nodes: n, edges: e }) => {
      cachedNodes = n;
      cachedEdges = e;
      setNodes(n);
      setEdges(e);
      setReorganizing(isReorgInProgress());
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Subscribe to reorganization events so state updates even if user navigated away and back
  useEffect(() => {
    const unsub1 = eventBus.subscribe('REORG_COMPLETED', (event) => {
      setReorganizing(false);
      setSelectedNode(null);
      toast(t('graph.toast.reorganized', { clusterCount: event.payload.clusterCount, anchorCount: event.payload.anchorCount }), 'success');
      reload();
    });
    const unsub2 = eventBus.subscribe('REORG_FAILED', (event) => {
      setReorganizing(false);
      toast(event.payload.error || t('graph.toast.reorganizeFailed'), 'error');
    });
    const unsub3 = eventBus.subscribe('REORG_STARTED', () => {
      setReorganizing(true);
    });
    // Reload graph when classification completes (new/updated nodes in the tree)
    const unsub4 = eventBus.subscribe('GRAPH_UPDATED', () => {
      reload();
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [reload, t]);

  const handleReorganize = useCallback(() => {
    setShowReorgConfirm(false);
    toast(t('graph.toast.reorganizing'), 'info');

    const settings = settingsService.getSync();
    // Fire-and-forget — events handle state updates across navigation
    void reorganizeMindmap(settings.llm);
  }, [t]);

  // ─── Phase 49-01 — gesture callbacks fed to MasterMap ────────────────────────

  const handleLongPressRecognized = useCallback(
    (
      node: Question | { kind: 'root' } | { kind: 'branch'; id: string },
      x: number,
      y: number,
    ) => {
      // Root + Branch toast paths per D-15.
      if ('kind' in node && node.kind === 'root') {
        toast(t('graph.correction.toast.rootNotEditable'), 'info');
        return;
      }
      if ('kind' in node && node.kind === 'branch') {
        toast(t('graph.correction.toast.branchNotEditable'), 'info');
        return;
      }
      // B-6 guard: orphan / flagged / malformed nodes return [] from the
      // matrix — silent return (no empty card per Plan 49-02 plan-checker B-6).
      const sourceNode = node as Question;
      const actions = getActionsForNode(sourceNode);
      if (actions.length === 0) {
        return;
      }
      // Anchor / Cluster / QA-leaf — dismiss inspector (D-03 coexistence rule)
      // and open the CorrectionCard at the release point.
      setSelectedNode(null);
      setCorrectionNode({ node: sourceNode, anchorX: x, anchorY: y });
    },
    [t],
  );

  // Phase 49-04 — soft-prune handler (D-10 / D-14 / W-6). No modal — commits
  // immediately via graphCommandService.prune. The follow-up toast carries an
  // inline [Undo] action button that re-invokes graphCommandService.undo.
  //
  // W-6: prune toast type stays 'info' (acceptable per codebase convention;
  // flag for operator UAT review). Plan 49-PATTERNS notes this is the
  // pragmatic call — destructive-colored toasts feel alarmist for a
  // recoverable soft-delete that already shows a clear "Undo" affordance.
  //
  // B-5: the follow-up toast inside the Undo callback uses
  // undoResult.data.summary — NEVER undoResult.data.undoneCmd (which is the
  // verb literal intended for log telemetry only).
  const handlePrune = useCallback(
    async (node: Question) => {
      const result = await graphCommandService.prune(node.id);
      if (!result.success) {
        toast(result.error?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
        return;
      }
      toast(
        t('graph.correction.toast.pruned', { title: node.title ?? node.content }),
        'info',
        {
          action: {
            label: t('graph.correction.actions.undo'),
            onAction: async () => {
              const undoResult = await graphCommandService.undo();
              if (undoResult.success) {
                // B-5: summary, NOT undoneCmd.
                toast(
                  t('graph.correction.toast.undone', {
                    summary: undoResult.data?.summary ?? '',
                  }),
                  'success',
                );
              } else {
                toast(
                  undoResult.error?.message ?? t('graph.correction.toast.nothingToUndo'),
                  'error',
                );
              }
            },
          },
        },
      );
    },
    [t],
  );

  // Phase 49-04 — detach handler with B-1 Two-emit correlation pattern.
  //
  // Phase 48's graphCommandService.detach returns ServiceResult<void> (NOT
  // { anchorId }). It emits a FIRST GRAPH_UPDATED for the detach commit, then
  // fire-and-forget classifyAndAnchorIncremental emits a SECOND GRAPH_UPDATED
  // when classify completes. We subscribe AFTER the await resolves and read
  // the new parentId from questionService on the next GRAPH_UPDATED — that's
  // the classify-completion signal. 5s timeout fallback silently exits.
  //
  // Two-emit correlation pattern (B-1 load-bearing — do not refactor away):
  //   1. Capture originalParentId from node.parentId BEFORE detach call.
  //   2. Await graphCommandService.detach (which emits its own GRAPH_UPDATED).
  //   3. Subscribe to the NEXT GRAPH_UPDATED (the classify-completion emit).
  //   4. On that emit OR after 5s timeout: re-read questionService and
  //      determine newParentId. If different from originalParentId → toast
  //      'detachedNewAnchor' (success). If same → toast 'detachedSameAnchor'
  //      (info — best-match no-op).
  //   5. Timeout fallback silently exits: the first GRAPH_UPDATED already
  //      updated the visible graph; the user sees the result regardless.
  const handleDetach = useCallback(
    async (node: Question) => {
      // B-1: capture original parent BEFORE detach.
      const originalParentId = node.parentId;
      const qaTitle = node.title ?? node.content;

      // B-1: Phase 48 detach returns ServiceResult<void> — no data payload.
      const result = await graphCommandService.detach(node.id);
      if (!result.success) {
        toast(result.error?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
        return;
      }

      // Two-emit correlation — set up the post-classify variant chooser.
      let fired = false;
      const fireVariantToast = () => {
        if (fired) return;
        fired = true;
        // B-2: questionService.getAll returns Question[] directly.
        const all = questionService.getAll({ includeFlagged: true });
        const updatedQ = all.find((q) => q.id === node.id);
        const newParentId = updatedQ?.parentId ?? originalParentId;
        if (newParentId !== originalParentId) {
          const newAnchor = all.find((q) => q.id === newParentId);
          const newAnchorTitle = newAnchor?.title ?? newAnchor?.content ?? '?';
          toast(
            t('graph.correction.toast.detachedNewAnchor', { qaTitle, newAnchorTitle }),
            'success',
          );
        } else {
          const sameAnchor = all.find((q) => q.id === originalParentId);
          const anchorTitle = sameAnchor?.title ?? sameAnchor?.content ?? '?';
          toast(
            t('graph.correction.toast.detachedSameAnchor', { qaTitle, anchorTitle }),
            'info',
          );
        }
      };

      // The detach commit's GRAPH_UPDATED has already fired before we get
      // here (it fires synchronously inside the mutex'd detach call before
      // await resolves). Subscribe NOW; the first emit we observe is the
      // classify-completion signal.
      const unsub = eventBus.subscribe('GRAPH_UPDATED', () => {
        unsub();
        clearTimeout(timeoutHandle);
        fireVariantToast();
      });

      // Timeout fallback: classify took >5s; toast already shown from detach
      // commit. Skip the post-classify variant. This is the documented
      // fallback per the B-1 resolution.
      const timeoutHandle = setTimeout(() => {
        unsub();
        // Silent: don't re-toast. The first GRAPH_UPDATED already updated the
        // visible graph; the user sees the result either way.
      }, 5000);
    },
    [t],
  );

  // Plan 49-02/03/04 — dispatch CorrectionCard action selections. Rename is
  // owned by the card itself (inline graphCommandService.rename). Plan 49-03
  // wired delete via ConfirmDialog. Plan 49-04 wires move/merge via pickMode,
  // and prune/detach via handlers above.
  const handleCorrectionAction = useCallback(
    (action: CorrectionAction) => {
      if (!correctionNode) return;
      const node = correctionNode.node;
      // W-2 — capture release coords BEFORE clearing correctionNode so pick-
      // mode entry preserves where the user's finger was.
      const { anchorX, anchorY } = correctionNode;
      switch (action.kind) {
        case 'rename':
          // Inline rename — CorrectionCard already committed via graphCommandService.rename
          // and called onClose. Nothing to do here.
          return;
        case 'delete':
          // Phase 49-03 — open the destructive ConfirmDialog. Always cascades
          // (no boolean param per Phase 48 D-07 + Phase 49 D-09).
          setDeleteConfirm({ node });
          setCorrectionNode(null);
          return;
        case 'move':
          // Phase 49-04 — enter pickMode 'move'. W-2: originalAnchorX/Y
          // captured here so Cancel returns to this exact card position.
          setPickMode({ kind: 'move', sourceNode: node, originalAnchorX: anchorX, originalAnchorY: anchorY });
          setCorrectionNode(null);
          return;
        case 'merge':
          // Phase 49-04 — enter pickMode 'merge'. W-2 same as move.
          setPickMode({ kind: 'merge', sourceNode: node, originalAnchorX: anchorX, originalAnchorY: anchorY });
          setCorrectionNode(null);
          return;
        case 'prune':
          // Phase 49-04 — soft-prune via graphCommandService.prune (D-10).
          // No modal — immediate commit + Snackbar-with-Undo toast.
          void handlePrune(node);
          setCorrectionNode(null);
          return;
        case 'detach':
          // Phase 49-04 — detach via graphCommandService.detach (D-12 / B-1).
          // Two-emit GRAPH_UPDATED correlation determines re-anchored vs
          // same-anchor toast variant. Handler defined above.
          void handleDetach(node);
          setCorrectionNode(null);
          return;
      }
    },
    [correctionNode, handlePrune, handleDetach],
  );

  // Plan 49-02 — B-4 + CLAUDE.md always-mounted-screen invariant.
  // Reset surfaces when the user navigates away from /graph so re-entering
  // the tab does not show stale UI captured before navigation. Plan 49-04
  // adds setPickMode(null) so any in-progress menu-driven Move/Merge cancels.
  useEffect(() => {
    if (location.pathname !== '/graph') {
      setCorrectionNode(null);
      setDragState(null);
      setPickMode(null);
    }
  }, [location.pathname]);

  // Phase 49-04 — pick-mode tap handler. The MasterMap delegated click
  // listener invokes this on every node tap; if pickMode is non-null we
  // commit (move) or open the merge confirm modal (merge) and return true
  // to short-circuit the inspector-card path. Returns false otherwise.
  const handlePickModeTap = useCallback(
    (target: Question): boolean => {
      const mode = pickModeRef.current;
      if (!mode) return false;
      const validTarget =
        mode.kind === 'move'
          ? target.isClusterNode === true
          : target.isAnchorNode === true;
      if (!validTarget) {
        toast(t('graph.correction.pickMode.invalidTarget'), 'info');
        return true;
      }
      if (mode.kind === 'move') {
        void (async () => {
          const result = await graphCommandService.move(mode.sourceNode.id, target.id);
          if (result.success) {
            toast(
              t('graph.correction.toast.moved', {
                title: mode.sourceNode.title ?? mode.sourceNode.content,
                target: target.title ?? target.content,
              }),
              'success',
            );
          } else {
            toast(result.error?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
          }
        })();
      } else {
        // merge: hand off to Plan 49-03's <ConfirmDialog> via mergeConfirm state.
        setMergeConfirm({ loser: mode.sourceNode, survivor: target });
      }
      setPickMode(null);
      return true;
    },
    [t],
  );

  // Phase 49-04 — Cancel handler. W-2: restore CorrectionCard at the ORIGINAL
  // release coords captured at pickMode entry, NOT a window-center fallback.
  const handlePickModeCancel = useCallback(() => {
    if (pickMode) {
      setCorrectionNode({
        node: pickMode.sourceNode,
        anchorX: pickMode.originalAnchorX,
        anchorY: pickMode.originalAnchorY,
      });
    }
    setPickMode(null);
  }, [pickMode]);

  const handleDragStart = useCallback(
    (state: DragState, targets: DropTargetSnapshot[]) => {
      // Phase 49-06 / D-01 — long-press-release and long-press-drag are mutually
      // exclusive outcomes (49-CONTEXT.md). When the gesture transitions past the
      // 8px threshold the CorrectionCard mounted at recognition must dismiss.
      // This MUST be the first statement so the dismiss happens before any
      // observable side-effects from the drag state.
      setCorrectionNode(null);
      setDropTargets(targets);
      setDragState(state);
    },
    [],
  );

  const handleDragMove = useCallback((x: number, y: number) => {
    setDragState((prev) => (prev ? { ...prev, pointerX: x, pointerY: y } : prev));
  }, []);

  const handleDragEnd = useCallback(
    async (
      snapped: DropTargetSnapshot | null,
      sourceNode: Question,
      nodeMap: Record<string, Question>,
    ) => {
      if (!snapped) {
        toast(t('graph.correction.toast.dropInvalid'), 'info');
        setDragState(null);
        return;
      }
      if (snapped.kind === 'cluster' && sourceNode.isAnchorNode) {
        void hapticImpactMedium();
        const result = await graphCommandService.move(sourceNode.id, snapped.id);
        if (result.success) {
          toast(
            t('graph.correction.toast.moved', {
              title: sourceNode.title ?? sourceNode.content,
              target: nodeMap[snapped.id]?.title ?? '?',
            }),
            'success',
          );
        } else {
          toast(result.error?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
        }
        setDragState(null);
        return;
      }
      if (snapped.kind === 'anchor' && sourceNode.isAnchorNode) {
        void hapticImpactMedium();
        const survivor = nodeMap[snapped.id];
        if (survivor) setMergeConfirm({ loser: sourceNode, survivor });
        setDragState(null);
        return;
      }
      // QA-target or other invalid combo.
      toast(t('graph.correction.toast.dropInvalid'), 'info');
      setDragState(null);
    },
    [t],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const hasQaNodes = nodes.some((n) => !n.isAnchorNode && !n.isClusterNode && n.flagged !== true);

  return (
    <div ref={containerRef} style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Reorganize confirmation dialog — Phase 49-03 migrated from inline modal to <ConfirmDialog>. */}
      <ConfirmDialog
        open={showReorgConfirm}
        title={t('graph.reorganizeModal.title')}
        body={t('graph.reorganizeModal.description')}
        confirmLabel={t('graph.reorganizeModal.confirm')}
        cancelLabel={t('graph.reorganizeModal.cancel')}
        onConfirm={handleReorganize}
        onCancel={() => setShowReorgConfirm(false)}
      />

      {/* Phase 49-03 — Merge confirm (drag-driven path; menu-driven entry lands in Plan 49-04).
          B-2 + B-3: pre-derive BOTH counts via questionService.getAll({ includeFlagged: true })
          BEFORE rendering the modal so the preview shows accurate snapshots. */}
      {mergeConfirm && (() => {
        const all = questionService.getAll({ includeFlagged: true });
        const loserQaCount = all.filter((q) => q.parentId === mergeConfirm.loser.id).length;
        const survivorQaCount = all.filter((q) => q.parentId === mergeConfirm.survivor.id).length;
        const loserCluster = all.find((q) => q.id === mergeConfirm.loser.parentId);
        const survivorCluster = all.find((q) => q.id === mergeConfirm.survivor.parentId);
        return (
          <ConfirmDialog
            open={true}
            title={t('graph.correction.merge.title')}
            confirmLabel={t('graph.correction.merge.confirm')}
            cancelLabel={t('graph.correction.merge.cancel')}
            destructive={false}
            onConfirm={async () => {
              const result = await graphCommandService.merge(mergeConfirm.loser.id, mergeConfirm.survivor.id);
              if (result.success) {
                toast(
                  t('graph.correction.toast.merged', {
                    loserTitle: mergeConfirm.loser.title ?? mergeConfirm.loser.content,
                    survivorTitle: mergeConfirm.survivor.title ?? mergeConfirm.survivor.content,
                    // B-3 — use service-reported count for post-merge accuracy (may differ
                    // from the UI-derived loserQaCount if a concurrent edit slipped through).
                    // result.data is guaranteed non-null on the success branch but typed
                    // as optional (ServiceResult is not a discriminated union); fall back
                    // to loserQaCount which matches the pre-merge derivation.
                    reparentedCount: result.data?.reparentedCount ?? loserQaCount,
                  }),
                  'success',
                );
                setMergeConfirm(null);
              } else {
                toast(result.error?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
                // Keep modal open so the user can cancel or retry.
              }
            }}
            onCancel={() => setMergeConfirm(null)}
          >
            <MergeConfirmPreview
              loser={mergeConfirm.loser}
              survivor={mergeConfirm.survivor}
              loserQaCount={loserQaCount}
              survivorQaCount={survivorQaCount}
              loserClusterTitle={loserCluster?.title ?? loserCluster?.content ?? t('graph.anchor.clusterFallback')}
              survivorClusterTitle={survivorCluster?.title ?? survivorCluster?.content ?? t('graph.anchor.clusterFallback')}
            />
          </ConfirmDialog>
        );
      })()}

      {/* Phase 49-03 — Delete confirm. B-2: questionService.getAll({ includeFlagged: true })
          returns Question[] directly (no ServiceResult unwrap). B-3: ALWAYS cascades — no
          boolean param. Modal only EXPLAINS cascade per D-09 — no cascade-choice radio. */}
      {deleteConfirm && (() => {
        const all = questionService.getAll({ includeFlagged: true });
        const qaChildCount = all.filter((q) => q.parentId === deleteConfirm.node.id).length;
        const parentCluster = all.find((q) => q.id === deleteConfirm.node.parentId);
        const parentClusterTitle =
          parentCluster?.title ?? parentCluster?.content ?? t('graph.anchor.clusterFallback');
        const body =
          qaChildCount > 0
            ? t('graph.correction.delete.bodyWithChildren', {
                count: qaChildCount,
                parentCluster: parentClusterTitle,
              })
            : t('graph.correction.delete.bodyEmpty');
        return (
          <ConfirmDialog
            open={true}
            title={t('graph.correction.delete.title', {
              title: deleteConfirm.node.title ?? deleteConfirm.node.content,
            })}
            body={body}
            confirmLabel={t('graph.correction.delete.confirm')}
            cancelLabel={t('graph.correction.delete.cancel')}
            destructive={true}
            onConfirm={async () => {
              // B-3 — graphCommandService.delete takes NO boolean param. Always cascades.
              const result = await graphCommandService.delete(deleteConfirm.node.id);
              if (result.success) {
                toast(
                  t('graph.correction.toast.deleted', {
                    title: deleteConfirm.node.title ?? deleteConfirm.node.content,
                  }),
                  'success',
                );
                setDeleteConfirm(null);
              } else {
                toast(result.error?.message ?? t('graph.correction.toast.dropInvalid'), 'error');
              }
            }}
            onCancel={() => setDeleteConfirm(null)}
          />
        );
      })()}

      <Header
        title={t('graph.headerTitle')}
        right={
          hasQaNodes ? (
            <button
              onClick={() => !reorganizing && setShowReorgConfirm(true)}
              disabled={reorganizing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: '100px',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--foreground)',
                fontWeight: 600,
                fontSize: '0.8rem',
                border: '1px solid var(--border)',
                cursor: reorganizing ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: reorganizing ? 0.6 : 1,
              }}
            >
              <RefreshCw size={14} style={reorganizing ? { animation: 'spin 1.5s linear infinite' } : undefined} />
              {reorganizing ? t('graph.reorganizingButton') : t('graph.reorganizeButton')}
              {reorganizing && <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>}
            </button>
          ) : undefined
        }
      />

      {/* Phase 49-04 — PickModeBanner renders in-tree below the Header when
          pickMode !== null. NOT portaled — see R19 + CLAUDE.md Header rule. */}
      {pickMode && (
        <PickModeBanner pickMode={pickMode} onCancel={handlePickModeCancel} />
      )}

      <MasterMap
        nodes={nodes}
        edges={edges}
        onNodeClick={setSelectedNode}
        isVisible={isVisible}
        onLongPressRecognized={handleLongPressRecognized}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        reorganizing={reorganizing}
        onPickModeTap={handlePickModeTap}
      />

      {/* Phase 49-01 — portaled drag overlay (ghost + origin-line + halo). */}
      <DragOverlay dragState={dragState} targets={dropTargets} />

      {/* Phase 49-02 — CorrectionCard + tap-outside backdrop. */}
      {correctionNode && (
        <>
          <div
            onClick={() => setCorrectionNode(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 249,
              backgroundColor: 'transparent',
              pointerEvents: 'auto',
            }}
          />
          <CorrectionCard
            node={correctionNode.node}
            anchorX={correctionNode.anchorX}
            anchorY={correctionNode.anchorY}
            isReorganizing={reorganizing}
            onClose={() => setCorrectionNode(null)}
            onActionSelected={handleCorrectionAction}
          />
        </>
      )}

          {selectedNode && (
            <div
              onClick={() => {
                if (selectedNode.isClusterNode) {
                  navigate(`/cluster/${selectedNode.id}`);
                } else if (selectedNode.isAnchorNode) {
                  navigate(`/anchor/${selectedNode.id}`);
                } else {
                  navigate(`/ask/${selectedNode.id}`);
                }
              }}
              style={{ padding: '16px', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--surface-variant)', border: '1px solid var(--border)', animation: 'fade-in 0.2s ease', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onPointerEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {selectedNode.isClusterNode && (
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary-40)', marginBottom: '4px' }}>
                  {(() => {
                    const childAnchorCount = nodes.filter(
                      n => n.isAnchorNode === true && n.clusterNodeId === selectedNode.id
                    ).length;
                    return t('graph.selected.clusterBadge', { anchorCount: childAnchorCount, qaCount: selectedNode.qaCount || 0 });
                  })()}
                </p>
              )}
              {selectedNode.isAnchorNode && (
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary-40)', marginBottom: '4px' }}>
                  {t('graph.selected.anchorBadge', { count: selectedNode.qaCount || 0 })}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)', flex: 1 }}>
                  {selectedNode.title ?? selectedNode.content}
                </p>
                <button onClick={(e) => { e.stopPropagation(); setSelectedNode(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '0 0 0 8px' }}>
                  <X size={16} />
                </button>
              </div>
              {selectedNode.isClusterNode ? (() => {
                const childAnchors = nodes.filter(
                  n => n.isAnchorNode === true && n.clusterNodeId === selectedNode.id
                );
                if (childAnchors.length > 0) {
                  const anchorNames = childAnchors.slice(0, 4).map(a => a.title || a.content).join(', ');
                  const suffix = childAnchors.length > 4 ? t('graph.selected.anchorMoreSuffix', { count: childAnchors.length - 4 }) : '';
                  return (
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                      {anchorNames}{suffix}
                    </p>
                  );
                }
                return null;
              })() : (
                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{selectedNode.summary}</p>
              )}
              {!selectedNode.isClusterNode && selectedNode.placementReason && (
                <p style={{ fontSize: '0.75rem', color: 'var(--primary-40)', lineHeight: 1.45, marginTop: '8px' }}>
                  {selectedNode.placementReason}
                </p>
              )}
              {selectedNode.keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                  {selectedNode.keywords.map((k) => (
                    <span key={k} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '100px', backgroundColor: 'var(--surface)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{k}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                  {t('graph.selected.connectionsCount', { count: selectedNode.relatedQuestionIds.length })}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary-40)', fontWeight: 600 }}>
                  <span>{t('graph.selected.viewDetails')}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
