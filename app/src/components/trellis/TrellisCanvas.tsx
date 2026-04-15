import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TrellisLayout } from '../../services/trellis-state.service.ts';
import { TRELLIS_VIEWBOX_W, TRELLIS_VIEWBOX_H } from '../../services/trellis-layout.service.ts';
import { TrellisLeaf } from './TrellisLeaf.tsx';

export interface TrellisCanvasProps {
  layout: TrellisLayout;
  onLeafTap: (anchorId: string, clientX: number, clientY: number) => void;
  heroRef: React.RefObject<HTMLDivElement | null>;
  ambientEnabled: boolean;
}

// D-55 threshold lowered from 50 to 20 per RESEARCH Open Question #4 + phase_structure_guidance.
const AMBIENT_SWAY_THRESHOLD = 20;

export function TrellisCanvas({ layout, onLeafTap, ambientEnabled }: TrellisCanvasProps) {
  const { vines, nodes } = layout;
  const leafCount = nodes.length;
  const swayEnabled = leafCount <= AMBIENT_SWAY_THRESHOLD;
  // If > threshold, sway only 1 in 3 leaves (deterministic by index)
  const leafSwayMask = useMemo(() => {
    if (swayEnabled) return (_: number) => true;
    return (i: number) => i % 3 === 0;
  }, [swayEnabled]);
  // Route-aware gate: fully disable sway when Planner is not the active route (D-53)
  const effectiveSway = ambientEnabled ? leafSwayMask : (_: number) => false;

  return (
    <svg
      viewBox={`0 0 ${TRELLIS_VIEWBOX_W} ${TRELLIS_VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', display: 'block' }}
      role="img"
      aria-label="Knowledge garden — your review health visualization"
    >
      {/* Vines — D-46 draw-on per-branch staggered 200ms */}
      <g style={{ pointerEvents: 'none' }}>
        {vines.map((v, i) => (
          <motion.path
            key={v.branchId}
            d={v.spec.d}
            stroke={v.color}
            strokeWidth={3}
            fill="none"
            opacity={0.8}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </g>
      {/* Branch lines connecting vine to leaf */}
      <g style={{ pointerEvents: 'none' }}>
        {nodes.map((n) => (
          <line
            key={`stem-${n.anchor.id}`}
            x1={n.vineAttach.x} y1={n.vineAttach.y}
            x2={n.layoutPosition.x} y2={n.layoutPosition.y}
            stroke={vines.find((v) => v.branchId === n.branchId)?.color ?? '#6B8E5A'}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.6}
          />
        ))}
      </g>
      {/* Leaves */}
      <g style={{ pointerEvents: 'auto' }}>
        {nodes.map((n, i) => (
          <TrellisLeaf
            key={n.anchor.id}
            anchorId={n.anchor.id}
            anchorName={n.anchor.title ?? n.anchor.content ?? 'anchor'}
            x={n.layoutPosition.x}
            y={n.layoutPosition.y}
            stemAngle={n.stemAngle}
            state={n.leafState}
            qaCount={n.qaChildren.length}
            onTap={onLeafTap}
            ambientSway={effectiveSway(i)}
            animationDelay={0.8 + i * 0.05} // leaves pop after vines finish drawing
          />
        ))}
      </g>
    </svg>
  );
}
