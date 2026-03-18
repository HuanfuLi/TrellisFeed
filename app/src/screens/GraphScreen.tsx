import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, GitBranch, Plus, X } from 'lucide-react';
import type { Question } from '../types';
import { graphService } from '../services/graph.service';
import { toast } from '../lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

// ─── Mindmap tree layout ──────────────────────────────────────────────────────
//
// Root = most-connected node. A BFS spanning tree is built from the root,
// then each subtree is assigned a proportional angular sector so branches
// radiate outward like a classic mindmap spider diagram.

function mindmapLayout(
  nodes: Question[],
  edges: GraphEdge[],
  width: number,
  height: number,
): NodePosition[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ id: nodes[0].id, x: width / 2, y: height / 2 }];

  const cx = width / 2;
  const cy = height / 2;

  // Build undirected adjacency set
  const adj: Record<string, Set<string>> = {};
  for (const n of nodes) adj[n.id] = new Set<string>();
  for (const e of edges) {
    adj[e.source]?.add(e.target);
    adj[e.target]?.add(e.source);
  }

  // Root = highest-degree node (most edges); ties broken by array order
  const rootId = nodes.reduce(
    (best, n) => ((adj[n.id]?.size ?? 0) > (adj[best]?.size ?? 0) ? n.id : best),
    nodes[0].id,
  );

  // BFS to build a spanning tree (each node gets exactly one parent)
  const treeChildren: Record<string, string[]> = {};
  for (const n of nodes) treeChildren[n.id] = [];
  const visited = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const nb of (adj[curr] ?? [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        treeChildren[curr].push(nb);
        queue.push(nb);
      }
    }
  }

  // Count leaf nodes in a subtree (used for proportional angle allocation)
  function leafCount(id: string): number {
    const kids = treeChildren[id];
    return kids.length === 0 ? 1 : kids.reduce((s, c) => s + leafCount(c), 0);
  }

  // Radii (distance from parent to child) per depth level
  const RADII = [145, 125, 105, 90];

  const positions: Record<string, NodePosition> = {
    [rootId]: { id: rootId, x: cx, y: cy },
  };

  // Recursively place a node's children within an angular sector [startA, endA]
  function place(
    id: string,
    parentX: number,
    parentY: number,
    startA: number,
    endA: number,
    depth: number,
  ): void {
    const r = RADII[Math.min(depth - 1, RADII.length - 1)];
    const mid = (startA + endA) / 2;
    positions[id] = { id, x: parentX + r * Math.cos(mid), y: parentY + r * Math.sin(mid) };

    const kids = treeChildren[id];
    if (kids.length === 0) return;
    const total = kids.reduce((s, c) => s + leafCount(c), 0);
    let a = startA;
    for (const kid of kids) {
      const span = (endA - startA) * (leafCount(kid) / total);
      place(kid, positions[id].x, positions[id].y, a, a + span, depth + 1);
      a += span;
    }
  }

  // Spread root's direct children across the full 360°, starting at the top
  const rootKids = treeChildren[rootId];
  if (rootKids.length > 0) {
    const total = rootKids.reduce((s, c) => s + leafCount(c), 0);
    let a = -Math.PI / 2;
    for (const kid of rootKids) {
      const span = (2 * Math.PI) * (leafCount(kid) / total);
      place(kid, cx, cy, a, a + span, 1);
      a += span;
    }
  }

  // Disconnected nodes (no edges at all) placed on an outer ring
  const disconnected = nodes.filter((n) => !visited.has(n.id));
  disconnected.forEach((n, i) => {
    const a = (2 * Math.PI * i) / Math.max(disconnected.length, 1) - Math.PI / 2;
    positions[n.id] = { id: n.id, x: cx + 230 * Math.cos(a), y: cy + 230 * Math.sin(a) };
  });

  return nodes.map((n) => positions[n.id] ?? { id: n.id, x: cx, y: cy });
}

// ─── Master Map (View 1) ──────────────────────────────────────────────────────

interface MasterMapProps {
  nodes: Question[];
  edges: GraphEdge[];
  onNodeClick: (q: Question) => void;
}

const NODE_COLORS = [
  'var(--node-mint)',
  'var(--node-salmon)',
  'var(--node-lilac)',
  'var(--node-peach)',
  'var(--node-sky)',
];

// Rounded-rectangle node dimensions
const NODE_W = 160;
const NODE_H = 50;
const ROOT_W = 184;
const ROOT_H = 56;

// Logical canvas — matches the fixed container height so coordinates map 1:1 to pixels.
// Width is set larger than the container so deep branches can extend off-screen (user pans).
const W = 420;
const H = 460;

function MasterMap({ nodes, edges, onNodeClick }: MasterMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dragging state (pan canvas)
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Dragging a node
  const draggingNodeId = useRef<string | null>(null);
  const nodeStart = useRef({ x: 0, y: 0 });

  // Recompute layout whenever nodes OR edges change (edges determine the tree structure)
  useEffect(() => {
    setPositions(mindmapLayout(nodes, edges, W, H));
  }, [nodes, edges]);

  // Node color by index + identify root (most-connected node)
  const { colorMap, rootId } = useMemo(() => {
    const m: Record<string, string> = {};
    const degree: Record<string, number> = {};
    for (const n of nodes) degree[n.id] = 0;
    for (const e of edges) {
      degree[e.source] = (degree[e.source] ?? 0) + 1;
      degree[e.target] = (degree[e.target] ?? 0) + 1;
    }
    let root = nodes[0]?.id ?? null;
    nodes.forEach((n, i) => {
      m[n.id] = NODE_COLORS[i % NODE_COLORS.length];
      if (root !== null && (degree[n.id] ?? 0) > (degree[root] ?? 0)) root = n.id;
    });
    return { colorMap: m, rootId: root };
  }, [nodes, edges]);

  const posMap = useMemo(() => {
    const m: Record<string, NodePosition> = {};
    positions.forEach((p) => (m[p.id] = p));
    return m;
  }, [positions]);

  // ── Wheel to zoom ──────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  // ── Pointer events for pan / node-drag ────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id');

      if (nodeId) {
        draggingNodeId.current = nodeId;
        nodeStart.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture(e.pointerId);
      } else {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOrigin.current = { ...pan };
        (e.target as Element).setPointerCapture(e.pointerId);
      }
    },
    [pan],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (draggingNodeId.current) {
        const dx = (e.clientX - nodeStart.current.x) / zoom;
        const dy = (e.clientY - nodeStart.current.y) / zoom;
        nodeStart.current = { x: e.clientX, y: e.clientY };
        setPositions((prev) =>
          prev.map((p) =>
            p.id === draggingNodeId.current ? { ...p, x: p.x + dx, y: p.y + dy } : p,
          ),
        );
      } else if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
      }
    },
    [zoom],
  );

  const handlePointerUp = useCallback(() => {
    draggingNodeId.current = null;
    isPanning.current = false;
  }, []);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, q: Question) => {
      e.stopPropagation();
      setSelectedId((prev) => (prev === q.id ? null : q.id));
      onNodeClick(q);
    },
    [onNodeClick],
  );

  if (nodes.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--muted-foreground)',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <GitBranch size={48} style={{ opacity: 0.3 }} />
        <p style={{ fontWeight: 600 }}>Your knowledge graph is empty.</p>
        <p style={{ fontSize: '0.875rem' }}>Ask questions to start building connections.</p>
      </div>
    );
  }

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  // Zoom origin fixed at canvas centre so zoom/unzoom stays centred on the mindmap
  const transformOrigin = `${W / 2}px ${H / 2}px`;

  return (
    // Fix #3: explicit fixed height so the grey background and SVG always match exactly
    <div
      style={{
        height: '460px',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface-variant)',
        position: 'relative',
        cursor: 'grab',
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <g style={{ transform, transformOrigin, transition: 'none' }}>
          {/* Edges — rendered first so node rects overlay the line ends cleanly */}
          {edges.map((edge) => {
            const src = posMap[edge.source];
            const tgt = posMap[edge.target];
            if (!src || !tgt) return null;
            const thickness = 1 + Math.min(edge.weight, 5) * 0.5;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="var(--muted-foreground)"
                strokeWidth={thickness}
                strokeOpacity={0.3}
              />
            );
          })}

          {/* Nodes — Fix #2: rounded rectangles instead of circles */}
          {nodes.map((node) => {
            const pos = posMap[node.id];
            if (!pos) return null;
            const color = colorMap[node.id];
            const isSelected = selectedId === node.id;
            const isRoot = node.id === rootId;
            const nw = isRoot ? ROOT_W : NODE_W;
            const nh = isRoot ? ROOT_H : NODE_H;
            // Truncate to keep text within ~2 lines inside the rect
            const rawLabel = node.title ?? node.content;
            const label = rawLabel.length > 62 ? rawLabel.slice(0, 59) + '…' : rawLabel;

            return (
              <g
                key={node.id}
                data-node-id={node.id}
                onClick={(e) => handleNodeClick(e, node)}
                style={{ cursor: 'pointer' }}
              >
                {/* Selection / root glow ring */}
                {(isSelected || isRoot) && (
                  <rect
                    x={pos.x - nw / 2 - 5}
                    y={pos.y - nh / 2 - 5}
                    width={nw + 10}
                    height={nh + 10}
                    rx={14}
                    fill={color}
                    fillOpacity={isSelected ? 0.28 : 0.18}
                  />
                )}
                {/* Node body */}
                <rect
                  x={pos.x - nw / 2}
                  y={pos.y - nh / 2}
                  width={nw}
                  height={nh}
                  rx={10}
                  fill={color}
                  fillOpacity={isRoot ? 1 : 0.88}
                  stroke={isSelected ? 'white' : isRoot ? 'rgba(255,255,255,0.6)' : 'none'}
                  strokeWidth={isSelected ? 2.5 : isRoot ? 1.5 : 0}
                />
                {/* Label inside the rect */}
                <foreignObject
                  x={pos.x - nw / 2}
                  y={pos.y - nh / 2}
                  width={nw}
                  height={nh}
                  style={{ pointerEvents: 'none' }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 10px',
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: isRoot ? '0.72rem' : '0.65rem',
                        fontWeight: 700,
                        color: 'white',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        maxHeight: `${nh - 10}px`,
                        wordBreak: 'break-word',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {[
          { label: '+', delta: 1.2 },
          { label: '−', delta: 0.8 },
        ].map(({ label, delta }) => (
          <button
            key={label}
            onClick={() => setZoom((z) => Math.max(0.3, Math.min(3, z * delta)))}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--foreground)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Card Stack Inbox (View 2) ────────────────────────────────────────────────

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
  const [dropTarget, setDropTarget] = useState<string | null>(null); // node id or 'new-domain'
  const cardRef = useRef<HTMLDivElement>(null);
  const dropZoneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeNode = unlinked[stackIndex] ?? null;

  // Refresh recommendations when active node changes
  useEffect(() => {
    if (!activeNode) return;
    const recs = graphService.getSimilarNodes(activeNode.id, 4);
    // If not enough, pad with random unrelated nodes
    if (recs.length < 3) {
      const extras = allNodes
        .filter((n) => n.id !== activeNode.id && !recs.find((r) => r.id === n.id))
        .slice(0, 4 - recs.length);
      setRecommended([...recs, ...extras]);
    } else {
      setRecommended(recs.slice(0, 4));
    }
  }, [activeNode, allNodes]);

  const refreshRecommendations = () => {
    if (!activeNode) return;
    const allRecs = graphService.getSimilarNodes(activeNode.id, allNodes.length);
    const shuffled = [...allRecs].sort(() => Math.random() - 0.5);
    setRecommended(shuffled.slice(0, 4));
  };

  // ── Drag handling ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragPos({ x: 0, y: 0 });
    setDropTarget(null);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragPos({ x: dx, y: dy });

    // Check overlap with drop targets
    let found: string | null = null;
    for (const [key, el] of Object.entries(dropZoneRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        found = key;
        break;
      }
    }
    setDropTarget(found);
  };

  const handleDragEnd = async () => {
    if (!dragging || !activeNode) return;
    setDragging(false);
    setDragPos({ x: 0, y: 0 });

    if (dropTarget === 'new-domain') {
      onCreateDomain(activeNode.id);
      advanceStack();
    } else if (dropTarget) {
      await onLink(activeNode.id, dropTarget);
      advanceStack();
    }
    setDropTarget(null);
  };

  const advanceStack = () => {
    setStackIndex((i) => i + 1);
  };

  if (!activeNode) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '2rem' }}>✅</p>
        <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>All nodes linked!</p>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Your knowledge graph is fully connected.
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: '12px',
            padding: '10px 28px',
            borderRadius: '100px',
            backgroundColor: 'var(--primary-40)',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Back to Graph
        </button>
      </div>
    );
  }

  const remaining = unlinked.length - stackIndex;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>Classify Nodes</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
            {remaining} unlinked remaining
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={refreshRecommendations}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '100px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--foreground)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            Shuffle
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Active node card (draggable) */}
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
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '8px', letterSpacing: '0.08em' }}>
            DRAG TO LINK
          </p>
          <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px', color: 'var(--foreground)' }}>
            {activeNode.title ?? activeNode.content}
          </p>
          {activeNode.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {activeNode.keywords.slice(0, 4).map((k) => (
                <span
                  key={k}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    backgroundColor: 'var(--surface-variant)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stack shadow cards */}
        {remaining > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              left: '8px',
              right: '8px',
              height: '100%',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--surface-variant)',
              border: '1px solid var(--border)',
              zIndex: -1,
              opacity: 0.6,
            }}
          />
        )}
        {remaining > 2 && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '16px',
              right: '16px',
              height: '100%',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--surface-variant)',
              border: '1px solid var(--border)',
              zIndex: -2,
              opacity: 0.35,
            }}
          />
        )}
      </div>

      {/* Recommended nodes grid (drop targets) */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '8px' }}>
          Drop onto an existing concept to link:
        </p>
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
                  backgroundColor: isTarget
                    ? 'color-mix(in srgb, var(--primary-40) 20%, var(--surface-variant))'
                    : 'var(--surface-variant)',
                  border: `2px solid ${isTarget ? 'var(--primary-40)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                  transform: isTarget ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: NODE_COLORS[idx % NODE_COLORS.length],
                    marginBottom: '6px',
                  }}
                />
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                  {(node.title ?? node.content).length > 40
                    ? (node.title ?? node.content).slice(0, 37) + '…'
                    : node.title ?? node.content}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Domain drop zone */}
      <div
        ref={(el) => { dropZoneRefs.current['new-domain'] = el; }}
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-xl)',
          border: `2px dashed ${dropTarget === 'new-domain' ? 'var(--primary-40)' : 'var(--border)'}`,
          backgroundColor:
            dropTarget === 'new-domain'
              ? 'color-mix(in srgb, var(--primary-40) 10%, var(--surface))'
              : 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.15s',
          transform: dropTarget === 'new-domain' ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <Plus size={20} color="var(--muted-foreground)" />
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)' }}>
            New Domain / Category
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            Drop here to create a root node
          </p>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={advanceStack}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '100px',
          border: '1px solid var(--border)',
          backgroundColor: 'transparent',
          color: 'var(--muted-foreground)',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        Skip for now
      </button>
    </div>
  );
}

// ─── Graph Screen ─────────────────────────────────────────────────────────────

export function GraphScreen() {
  const [view, setView] = useState<'map' | 'inbox'>('map');
  const [nodes, setNodes] = useState<Question[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [unlinked, setUnlinked] = useState<Question[]>([]);
  const [selectedNode, setSelectedNode] = useState<Question | null>(null);

  const reload = useCallback(() => {
    void graphService.getGraph().then(({ nodes: n, edges: e }) => {
      setNodes(n);
      setEdges(e);
      // Bug #5: getUnlinkedNodes must run after getGraph resolves to see updated edges
      setUnlinked(graphService.getUnlinkedNodes());
    });
  }, []);

  useEffect(() => {
    reload();
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
      // Mark it as a root node by giving it an empty categoryIds placeholder
      toast(`"${nodes.find((n) => n.id === sourceId)?.title ?? 'Node'}" set as root.`, 'success');
      reload();
    },
    [nodes, reload],
  );

  return (
    <div
      style={{
        padding: '24px 16px 16px',
        maxWidth: '448px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 80px)',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: '2px' }}>Knowledge Graph</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {nodes.length} nodes · {edges.length} connections
          </p>
        </div>

        {unlinked.length > 0 && view === 'map' && (
          <button
            onClick={() => setView('inbox')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '100px',
              backgroundColor: 'var(--primary-40)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.8rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <Plus size={14} />
            {unlinked.length} Unlinked
          </button>
        )}
      </div>

      {view === 'map' ? (
        <>
          <MasterMap nodes={nodes} edges={edges} onNodeClick={setSelectedNode} />

          {/* Selected node detail */}
          {selectedNode && (
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--surface-variant)',
                border: '1px solid var(--border)',
                animation: 'fade-in 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                  {selectedNode.title ?? selectedNode.content}
                </p>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted-foreground)',
                    padding: '0 0 0 8px',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                {selectedNode.summary}
              </p>
              {selectedNode.keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                  {selectedNode.keywords.map((k) => (
                    <span
                      key={k}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--muted-foreground)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '8px' }}>
                {selectedNode.relatedQuestionIds.length} connections
              </p>
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
