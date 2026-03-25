import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style';
import type { MindElixirData, MindElixirInstance, NodeObj } from 'mind-elixir';
import { RefreshCw, GitBranch, Plus, X, ChevronRight } from 'lucide-react';
import type { Question } from '../types';
import { graphService } from '../services/graph.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { buildReflectionTree } from '../services/canonical-knowledge.service';

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
    topic: 'Knowledge Reflection',
    children: [],
    expanded: true,
  };

  if (nodes.length === 0) return { nodeData: rootObj };
  const reflection = buildReflectionTree(nodes);

  const children: NodeObj[] = [];
  for (const root of reflection) {
    if (root.rootLabel === 'Knowledge') {
      // Promote the fallback "Knowledge" root's branches directly under the main root
      // to avoid a near-duplicate of "Knowledge Reflection" → "Knowledge".
      for (const branch of root.branches) {
        children.push({
          id: `branch-${root.rootLabel}-${branch.branchLabel}`,
          topic: branch.branchLabel,
          expanded: true,
          children: branch.clusters.map((cluster) => ({
            id: `cluster-${root.rootLabel}-${branch.branchLabel}-${cluster.clusterLabel}`,
            topic: cluster.clusterLabel,
            expanded: true,
            children: cluster.nodes.map((node) => ({
              id: node.id,
              topic: truncate(node.title, 60),
              children: [],
            })),
          })),
        });
      }
    } else {
      children.push({
        id: `root-${root.rootLabel}`,
        topic: root.rootLabel,
        expanded: true,
        children: root.branches.map((branch) => ({
          id: `branch-${root.rootLabel}-${branch.branchLabel}`,
          topic: branch.branchLabel,
          expanded: true,
          children: branch.clusters.map((cluster) => ({
            id: `cluster-${root.rootLabel}-${branch.branchLabel}-${cluster.clusterLabel}`,
            topic: cluster.clusterLabel,
            expanded: true,
            children: cluster.nodes.map((node) => ({
              id: node.id,
              topic: truncate(node.title, 60),
              children: [],
            })),
          })),
        })),
      });
    }
  }
  rootObj.children = children;

  return { nodeData: rootObj };
}

// ─── EchoLearn theme for mind-elixir ─────────────────────────────────────────

function buildTheme() {
  const isDark = document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return {
    name: 'EchoLearn',
    type: (isDark ? 'dark' : 'light') as 'dark' | 'light',
    // Branch colours map to EchoLearn's node palette
    palette: ['#66BB6A', '#FF7043', '#AB47BC', '#FFA726', '#42A5F5'],
    cssVar: {
      '--node-gap-x': '20px',
      '--node-gap-y': '10px',
      '--main-gap-x': '52px',
      '--main-gap-y': '14px',
      '--main-color': '#ffffff',
      '--main-bgcolor': '#4CAF50',
      '--main-bgcolor-transparent': 'rgba(76,175,80,0)',
      '--color': isDark ? '#e0e0e0' : '#1a1a1a',
      '--bgcolor': isDark ? '#2e2e2e' : '#ffffff',
      '--selected': '#4CAF50',
      '--accent-color': '#4CAF50',
      '--root-color': '#ffffff',
      '--root-bgcolor': '#388E3C',
      '--root-border-color': 'transparent',
      '--root-radius': '12px',
      '--main-radius': '8px',
      '--topic-padding': '7px 14px',
      '--panel-color': isDark ? '#e0e0e0' : '#1a1a1a',
      '--panel-bgcolor': isDark ? '#2e2e2e' : '#ffffff',
      '--panel-border-color': isDark ? '#444444' : '#e0e0e0',
      '--map-padding': '40px',
    },
  };
}

// ─── Master Map (mind-elixir) ─────────────────────────────────────────────────

interface MasterMapProps {
  nodes: Question[];
  edges: GraphEdge[];
  onNodeClick: (q: Question) => void;
}

function MasterMap({ nodes, edges, onNodeClick }: MasterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MindElixirInstance | null>(null);

  // Keep a stable ref to the callback so the effect doesn't re-run when it changes
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Node lookup ref — populated synchronously inside the main effect
  const nodeMapRef = useRef<Record<string, Question>>({});

  useEffect(() => {
    if (!containerRef.current) return;

    // Populate nodeMap synchronously before creating listeners
    nodeMapRef.current = Object.fromEntries(nodes.map((n) => [n.id, n]));

    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    const mei = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      editable: false,
      draggable: true,
      contextMenu: false,
      toolBar: false,
      keypress: false,
      theme: buildTheme(),
    });

    mei.init(buildMindElixirData(nodes));

    // Zoom to 50% and centre after the layout has been painted
    setTimeout(() => {
      mei.scale(0.5);
      mei.toCenter();
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

    instanceRef.current = mei;
    const container = containerRef.current;

    return () => {
      container.removeEventListener('click', handleClick);
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

  return (
    <div
      style={{
        height: '460px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        backgroundColor: 'var(--surface-variant)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={refreshRecommendations} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '100px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)', fontSize: '0.8rem', cursor: 'pointer' }}>
            <RefreshCw size={14} /> Shuffle
          </button>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
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

// ─── Graph Screen ─────────────────────────────────────────────────────────────

export function GraphScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<'map' | 'inbox'>('map');
  const [nodes, setNodes] = useState<Question[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [unlinked, setUnlinked] = useState<Question[]>([]);
  const [selectedNode, setSelectedNode] = useState<Question | null>(null);

  const reload = useCallback(() => {
    void graphService.getGraph().then(({ nodes: n, edges: e }) => {
      setNodes(n);
      setEdges(e);
      setUnlinked(graphService.getUnlinkedNodes());
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

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

  return (
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 16px`, maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)', gap: '16px' }}>
      <Header
        title="Knowledge Graph"
        right={
          unlinked.length > 0 && view === 'map' ? (
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
          ) : undefined
        }
      />

      {view === 'map' ? (
        <>
          <MasterMap nodes={nodes} edges={edges} onNodeClick={setSelectedNode} />

          {selectedNode && (
            <div
              onClick={() => navigate(`/ask/${selectedNode.id}`)}
              style={{ padding: '16px', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--surface-variant)', border: '1px solid var(--border)', animation: 'fade-in 0.2s ease', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onPointerEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)', flex: 1 }}>
                  {selectedNode.title ?? selectedNode.content}
                </p>
                <button onClick={(e) => { e.stopPropagation(); setSelectedNode(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '0 0 0 8px' }}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{selectedNode.summary}</p>
              {selectedNode.placementReason && (
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
