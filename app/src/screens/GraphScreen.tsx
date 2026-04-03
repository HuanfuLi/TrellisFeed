import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style';
import type { MindElixirData, MindElixirInstance, NodeObj } from 'mind-elixir';
import { ArrowLeft, RefreshCw, GitBranch, Plus, X, ChevronRight, Undo2, FoldVertical, UnfoldVertical } from 'lucide-react';
import type { Question } from '../types';
import { graphService } from '../services/graph.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { buildAnchorReflectionTree, reorganizeMindmap, revertReorganization, hasReorgBackup, isReorgInProgress } from '../services/canonical-knowledge.service';
import { settingsService } from '../services/settings.service';
import { eventBus } from '../lib/event-bus';

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
    topic: 'Knowledge',
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

// ─── EchoLearn theme for mind-elixir ─────────────────────────────────────────

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
    name: 'EchoLearn',
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
}

function setAllExpanded(node: NodeObj, expanded: boolean): void {
  node.expanded = expanded;
  if (node.children) {
    for (const child of node.children) {
      setAllExpanded(child, expanded);
    }
  }
}

function MasterMap({ nodes, edges, onNodeClick }: MasterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MindElixirInstance | null>(null);
  const [allExpanded, setAllExpandedState] = useState(true);

  // Keep a stable ref to the callback so the effect doesn't re-run when it changes
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Node lookup ref — populated synchronously inside the main effect
  const nodeMapRef = useRef<Record<string, Question>>({});

  useEffect(() => {
    if (!containerRef.current) return;

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
    containerRef.current.style.visibility = 'hidden';

    mei.init(buildMindElixirData(nodes));

    // Zoom to 50%, centre, then nudge left so the right-expanding tree
    // uses more of the portrait viewport instead of leaving the left half empty.
    setTimeout(() => {
      mei.scale(0.5);
      mei.toCenter();
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      if (containerWidth > 0) {
        mei.move(-containerWidth * 0.25, 0);
      }
      if (containerRef.current) containerRef.current.style.visibility = 'visible';
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
      if (q) onNodeClickRef.current(q);
    };
    containerRef.current.addEventListener('click', handleClick);

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
      container.removeEventListener('click', handleClick);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [nodes, edges]);

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
        <p style={{ fontWeight: 600 }}>Your knowledge reflection map is empty.</p>
        <p style={{ fontSize: '0.875rem' }}>Ask questions and review ideas to let the structure emerge.</p>
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
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <button
        onClick={handleToggleExpand}
        title={allExpanded ? 'Collapse all' : 'Expand all'}
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

const NODE_COLORS = [
  'var(--node-mint)',
  'var(--node-salmon)',
  'var(--node-lilac)',
  'var(--node-peach)',
  'var(--node-sky)',
];

interface CardStackInboxProps {
  unlinked: Question[];
  allNodes: Question[];
  onLink: (sourceId: string, targetId: string) => Promise<void>;
  onCreateDomain: (sourceId: string) => void;
  onClose: () => void;
}

function CardStackInbox({ unlinked, allNodes, onLink, onCreateDomain, onClose }: CardStackInboxProps) {
  const [stackIndex, setStackIndex] = useState(0);
  const [recommended, setRecommended] = useState<Question[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Hierarchical drill-down
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<Array<string | null>>([]);
  // New branch modal
  const [branchModalSourceId, setBranchModalSourceId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const dropZoneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // 800 ms hover-to-drill timer
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredRef = useRef<string | null>(null);

  const activeNode = unlinked[stackIndex] ?? null;

  const currentParentName = currentParentId
    ? (allNodes.find((n) => n.id === currentParentId)?.title ?? allNodes.find((n) => n.id === currentParentId)?.content ?? 'Parent')
    : null;

  // Build bucket list: children of currentParent padded with similar nodes to reach 4
  useEffect(() => {
    if (!activeNode) return;
    const children = graphService.getChildren(currentParentId).filter((n) => n.id !== activeNode.id);
    if (children.length >= 4) {
      setRecommended(children.slice(0, 4));
      return;
    }
    const similar = graphService.getSimilarNodes(activeNode.id, 4)
      .filter((n) => !children.find((c) => c.id === n.id));
    setRecommended([...children, ...similar].slice(0, 4));
  }, [activeNode, allNodes, currentParentId]);

  const refreshRecommendations = () => {
    if (!activeNode) return;
    const children = graphService.getChildren(currentParentId).filter((n) => n.id !== activeNode.id);
    const allSimilar = graphService.getSimilarNodes(activeNode.id, allNodes.length)
      .filter((n) => !children.find((c) => c.id === n.id));
    const shuffled = [...allSimilar].sort(() => Math.random() - 0.5);
    setRecommended([...children, ...shuffled].slice(0, 4));
  };

  const drillInto = (nodeId: string) => {
    setNavHistory((h) => [...h, currentParentId]);
    setCurrentParentId(nodeId);
  };

  const drillBack = () => {
    const prev = navHistory[navHistory.length - 1] ?? null;
    setNavHistory((h) => h.slice(0, -1));
    setCurrentParentId(prev);
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragPos({ x: 0, y: 0 });
    setDropTarget(null);
    lastHoveredRef.current = null;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    let found: string | null = null;
    for (const [key, el] of Object.entries(dropZoneRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        found = key;
        break;
      }
    }
    setDropTarget(found);

    // 800 ms hover-to-drill: if hovering a node bucket (not special zones), drill into it
    if (found !== lastHoveredRef.current) {
      if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
      lastHoveredRef.current = found;
      if (found && found !== 'new-domain' && found !== 'back') {
        hoverTimerRef.current = setTimeout(() => { drillInto(found); }, 800);
      }
    }
  };

  const handleDragEnd = async () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    if (!dragging || !activeNode) return;
    setDragging(false);
    setDragPos({ x: 0, y: 0 });
    const target = dropTarget;
    setDropTarget(null);
    lastHoveredRef.current = null;

    if (target === 'new-domain') {
      setBranchModalSourceId(activeNode.id);
      setBranchName(activeNode.title ?? activeNode.content.slice(0, 40));
    } else if (target === 'back') {
      drillBack();
    } else if (target) {
      graphService.moveToParent(activeNode.id, target);
      await onLink(activeNode.id, target);
      advanceStack();
    }
  };

  const handleBranchConfirm = () => {
    if (!branchModalSourceId) return;
    const trimmed = branchName.trim();
    if (trimmed) graphService.moveToParent(branchModalSourceId, currentParentId);
    onCreateDomain(branchModalSourceId);
    setBranchModalSourceId(null);
    setBranchName('');
    advanceStack();
  };

  const advanceStack = () => setStackIndex((i) => i + 1);

  if (!activeNode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '32px', textAlign: 'center' }}>
        <p style={{ fontSize: '2rem' }}>✅</p>
        <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>All nodes linked!</p>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Your knowledge graph is fully connected.</p>
        <button onClick={onClose} style={{ marginTop: '12px', padding: '10px 28px', borderRadius: '100px', backgroundColor: 'var(--primary-40)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          Back to Graph
        </button>
      </div>
    );
  }

  const remaining = unlinked.length - stackIndex;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 0 16px' }}>
      {/* New branch name modal */}
      {branchModalSourceId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: 'var(--shadow-3)' }}>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>Create New Domain</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>Name this root concept. It will anchor a new branch in your knowledge graph.</p>
            <input
              autoFocus
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBranchConfirm(); }}
              placeholder="e.g. Machine Learning, Physics…"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)', fontSize: '0.95rem', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setBranchModalSourceId(null); setBranchName(''); }} style={{ flex: 1, padding: '10px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleBranchConfirm} style={{ flex: 1, padding: '10px', borderRadius: '100px', backgroundColor: 'var(--primary-40)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <button onClick={refreshRecommendations} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)', fontSize: '0.8rem', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Shuffle
        </button>
      </div>
      <div>
        <p style={{ fontWeight: 700, fontSize: '1rem' }}>Repair Structure</p>
        {currentParentName ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--primary-40)', fontWeight: 600 }}>
            Inside: {currentParentName}
          </p>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{remaining} nodes still need placement repair</p>
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div
          ref={cardRef}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--surface)',
            border: `2px solid ${dropTarget ? 'var(--primary-40)' : 'var(--border)'}`,
            boxShadow: dragging ? 'var(--shadow-3)' : 'var(--shadow-2)',
            cursor: dragging ? 'grabbing' : 'grab',
            transform: dragging ? `translate(${dragPos.x}px, ${dragPos.y}px) rotate(${dragPos.x * 0.02}deg) scale(1.04)` : 'none',
            transition: dragging ? 'none' : 'transform 0.25s, box-shadow 0.25s',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '8px', letterSpacing: '0.08em' }}>REPAIR PLACEMENT</p>
          <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px', color: 'var(--foreground)' }}>{activeNode.title ?? activeNode.content}</p>
          {activeNode.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {activeNode.keywords.slice(0, 4).map((k) => (
                <span key={k} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '100px', backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{k}</span>
              ))}
            </div>
          )}
        </div>
        {remaining > 1 && (
          <div style={{ position: 'absolute', top: '6px', left: '8px', right: '8px', height: '100%', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--surface-variant)', border: '1px solid var(--border)', zIndex: -1, opacity: 0.6 }} />
        )}
        {remaining > 2 && (
          <div style={{ position: 'absolute', top: '12px', left: '16px', right: '16px', height: '100%', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--surface-variant)', border: '1px solid var(--border)', zIndex: -2, opacity: 0.35 }} />
        )}
      </div>

      {/* Breadcrumb "Back" drop-zone — visible when drilled into a node */}
      {navHistory.length > 0 && (
        <div
          ref={(el) => { dropZoneRefs.current['back'] = el; }}
          onClick={drillBack}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-xl)',
            border: `2px solid ${dropTarget === 'back' ? 'var(--primary-40)' : 'var(--border)'}`,
            backgroundColor: dropTarget === 'back' ? 'color-mix(in srgb, var(--primary-40) 12%, var(--surface))' : 'var(--surface-variant)',
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', transition: 'all 0.15s',
            transform: dropTarget === 'back' ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>↖</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
            Back to {navHistory.length === 1 ? 'Root' : (allNodes.find((n) => n.id === navHistory[navHistory.length - 1])?.title ?? 'Parent')}
          </span>
        </div>
      )}

      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '8px' }}>Drop onto an existing concept to link:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {recommended.map((node, idx) => {
            const isTarget = dropTarget === node.id;
            return (
              <div
                key={node.id}
                ref={(el) => { dropZoneRefs.current[node.id] = el; }}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: isTarget ? 'color-mix(in srgb, var(--primary-40) 20%, var(--surface-variant))' : 'var(--surface-variant)',
                  border: `2px solid ${isTarget ? 'var(--primary-40)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                  transform: isTarget ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: isTarget ? '0 0 0 3px color-mix(in srgb, var(--primary-40) 25%, transparent)' : 'none',
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: NODE_COLORS[idx % NODE_COLORS.length], marginBottom: '6px' }} />
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                  {(node.title ?? node.content).length > 40 ? (node.title ?? node.content).slice(0, 37) + '…' : node.title ?? node.content}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={(el) => { dropZoneRefs.current['new-domain'] = el; }}
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-xl)',
          border: `2px dashed ${dropTarget === 'new-domain' ? 'var(--primary-40)' : 'var(--border)'}`,
          backgroundColor: dropTarget === 'new-domain' ? 'color-mix(in srgb, var(--primary-40) 10%, var(--surface))' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.15s',
          transform: dropTarget === 'new-domain' ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <Plus size={20} color="var(--muted-foreground)" />
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)' }}>New Domain / Category</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Drop here to create a root node</p>
        </div>
      </div>

      <button onClick={advanceStack} style={{ width: '100%', padding: '10px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
        Skip for now
      </button>
    </div>
  );
}

// ─── Module-level cache (survives unmount, no flicker on re-visit) ───────────

let cachedNodes: Question[] | null = null;
let cachedEdges: GraphEdge[] | null = null;

// ─── Graph Screen ─────────────────────────────────────────────────────────────

export function GraphScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<'map' | 'inbox'>('map');
  const [nodes, setNodes] = useState<Question[]>(cachedNodes ?? []);
  const [edges, setEdges] = useState<GraphEdge[]>(cachedEdges ?? []);
  const [unlinked, setUnlinked] = useState<Question[]>([]);
  const [selectedNode, setSelectedNode] = useState<Question | null>(null);
  const [reorganizing, setReorganizing] = useState(isReorgInProgress);
  const [showReorgConfirm, setShowReorgConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [canRevert, setCanRevert] = useState(hasReorgBackup);

  const reload = useCallback(() => {
    void graphService.getGraph().then(({ nodes: n, edges: e }) => {
      cachedNodes = n;
      cachedEdges = e;
      setNodes(n);
      setEdges(e);
      setUnlinked(graphService.getUnlinkedNodes());
      setCanRevert(hasReorgBackup());
      setReorganizing(isReorgInProgress());
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Subscribe to reorganization events so state updates even if user navigated away and back
  useEffect(() => {
    const unsub1 = eventBus.subscribe('REORG_COMPLETED', (event) => {
      setReorganizing(false);
      setSelectedNode(null);
      toast(`Map reorganized: ${event.payload.clusterCount} clusters, ${event.payload.anchorCount} concepts`, 'success');
      reload();
    });
    const unsub2 = eventBus.subscribe('REORG_FAILED', (event) => {
      setReorganizing(false);
      toast(event.payload.error || 'Reorganization failed', 'error');
      setCanRevert(hasReorgBackup());
    });
    const unsub3 = eventBus.subscribe('REORG_STARTED', () => {
      setReorganizing(true);
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [reload]);

  const handleLink = useCallback(
    async (sourceId: string, targetId: string) => {
      await graphService.linkNodes(sourceId, targetId);
      reload();
      toast('Nodes linked!', 'success');
    },
    [reload],
  );

  const handleCreateDomain = useCallback(
    (sourceId: string) => {
      toast(`"${nodes.find((n) => n.id === sourceId)?.title ?? 'Node'}" set as root.`, 'success');
      reload();
    },
    [nodes, reload],
  );

  const handleReorganize = useCallback(() => {
    setShowReorgConfirm(false);
    toast('Reorganizing your knowledge map...', 'info');

    const settings = settingsService.getSync();
    // Fire-and-forget — events handle state updates across navigation
    void reorganizeMindmap(settings.llm);
  }, []);

  const handleRevert = useCallback(() => {
    setShowRevertConfirm(false);
    const result = revertReorganization();
    if (result.success) {
      toast('Map reverted to previous structure', 'success');
      setSelectedNode(null);
      reload();
    } else {
      toast(result.error?.message || 'Revert failed', 'error');
    }
  }, [reload]);

  // Scroll to top whenever the view switches so Repair doesn't inherit
  // the map's scroll position and vice-versa.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    containerRef.current?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  const hasQaNodes = nodes.some((n) => !n.isAnchorNode && !n.isClusterNode && n.flagged !== true);

  return (
    <div ref={containerRef} style={{ padding: `${HEADER_HEIGHT + 8}px 16px 16px`, maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Reorganize confirmation dialog */}
      {showReorgConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: 'var(--shadow-3)' }}>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>Reorganize Map</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
              This will reorganize your entire knowledge map using AI. Your Q&As, review schedules, and flashcards will be preserved — only the hierarchy structure will change.
              {'\n\n'}You can revert to the current structure afterwards if needed.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowReorgConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReorganize} style={{ flex: 1, padding: '10px', borderRadius: '100px', backgroundColor: 'var(--primary-40)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                Reorganize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert confirmation dialog */}
      {showRevertConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: 'var(--shadow-3)' }}>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>Revert Map</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
              Revert to the previous map structure? This will undo the last reorganization.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRevertConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleRevert} style={{ flex: 1, padding: '10px', borderRadius: '100px', backgroundColor: 'var(--primary-40)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                Revert
              </button>
            </div>
          </div>
        </div>
      )}

      <Header
        title="Mind Map"
        right={
          view === 'map' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {canRevert && (
                <button
                  onClick={() => setShowRevertConfirm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 12px',
                    borderRadius: '100px',
                    backgroundColor: 'transparent',
                    color: 'var(--muted-foreground)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Undo2 size={14} />
                  Revert
                </button>
              )}
              {hasQaNodes && (
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
                  {reorganizing ? 'Reorganizing...' : 'Reorganize'}
                  {reorganizing && <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>}
                </button>
              )}
              {unlinked.length > 0 && (
                <button
                  onClick={() => setView('inbox')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '100px',
                    backgroundColor: 'var(--primary-40)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-1)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={14} />
                  Repair {unlinked.length}
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {view === 'map' ? (
        <>
          <MasterMap nodes={nodes} edges={edges} onNodeClick={setSelectedNode} />

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
                  KNOWLEDGE CLUSTER — {(() => {
                    const childAnchorCount = nodes.filter(
                      n => n.isAnchorNode === true && n.clusterNodeId === selectedNode.id
                    ).length;
                    return `${childAnchorCount} concepts, ${selectedNode.qaCount || 0} Q&As`;
                  })()}
                </p>
              )}
              {selectedNode.isAnchorNode && (
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary-40)', marginBottom: '4px' }}>
                  CONCEPT ANCHOR — {selectedNode.qaCount || 0} Q&As
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
                  const suffix = childAnchors.length > 4 ? ` +${childAnchors.length - 4} more` : '';
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
                  {selectedNode.relatedQuestionIds.length} connections
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary-40)', fontWeight: 600 }}>
                  <span>View details</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <CardStackInbox
          unlinked={unlinked}
          allNodes={nodes}
          onLink={handleLink}
          onCreateDomain={handleCreateDomain}
          onClose={() => setView('map')}
        />
      )}
    </div>
  );
}
