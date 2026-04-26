import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style';
import type { MindElixirData, MindElixirInstance, NodeObj } from 'mind-elixir';
import { RefreshCw, GitBranch, X, ChevronRight, FoldVertical, UnfoldVertical } from 'lucide-react';
import i18n from '../locales';
import type { Question } from '../types';
import { graphService } from '../services/graph.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { buildAnchorReflectionTree, reorganizeMindmap, isReorgInProgress } from '../services/canonical-knowledge.service';
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
}

function setAllExpanded(node: NodeObj, expanded: boolean): void {
  node.expanded = expanded;
  if (node.children) {
    for (const child of node.children) {
      setAllExpanded(child, expanded);
    }
  }
}

function MasterMap({ nodes, edges, onNodeClick, isVisible }: MasterMapProps & { isVisible: boolean }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MindElixirInstance | null>(null);
  const initCompletedRef = useRef(false);
  const [allExpanded, setAllExpandedState] = useState(true);

  // Keep a stable ref to the callback so the effect doesn't re-run when it changes
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

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
      window.clearTimeout(initTimeoutId);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
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
      <div ref={containerRef} data-no-swipe-nav="true" style={{ width: '100%', height: '100%' }} />
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
  const { t } = useTranslation();
  // With the swipe strip, GraphScreen is always mounted at full width —
  // keeping it visible prevents it from disappearing during horizontal swiping.
  const isVisible = true;
  const [nodes, setNodes] = useState<Question[]>(cachedNodes ?? []);
  const [edges, setEdges] = useState<GraphEdge[]>(cachedEdges ?? []);
  const [selectedNode, setSelectedNode] = useState<Question | null>(null);
  const [reorganizing, setReorganizing] = useState(isReorgInProgress);
  const [showReorgConfirm, setShowReorgConfirm] = useState(false);

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

  const containerRef = useRef<HTMLDivElement>(null);

  const hasQaNodes = nodes.some((n) => !n.isAnchorNode && !n.isClusterNode && n.flagged !== true);

  return (
    <div ref={containerRef} style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Reorganize confirmation dialog */}
      {showReorgConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: 'var(--shadow-3)' }}>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>{t('graph.reorganizeModal.title')}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '16px', lineHeight: 1.5 }}>
              {t('graph.reorganizeModal.description')}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowReorgConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                {t('graph.reorganizeModal.cancel')}
              </button>
              <button onClick={handleReorganize} style={{ flex: 1, padding: '10px', borderRadius: '100px', backgroundColor: 'var(--primary-40)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
                {t('graph.reorganizeModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <MasterMap nodes={nodes} edges={edges} onNodeClick={setSelectedNode} isVisible={isVisible} />

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
