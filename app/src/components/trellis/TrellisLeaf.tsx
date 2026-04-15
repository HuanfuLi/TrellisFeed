import { motion } from 'framer-motion';
import type { LeafState } from '../../services/trellis-state.service.ts';
import { LEAF_HIT_TARGET_PX } from './types.ts';

export const LEAF_STATE_COLOR: Record<LeafState, string> = {
  bud: 'var(--primary-80)',
  green: 'var(--node-mint)',
  yellow: 'var(--secondary-40)',
  falling: 'var(--node-peach)',
  fallen: 'var(--node-salmon)',
  blossom: 'var(--accent-lavender)',
  fruit: 'var(--accent-coral)',
};

export const LEAF_STATE_FILTER: Partial<Record<LeafState, string>> = {
  fallen: 'saturate(0.7)',
};

export interface TrellisLeafProps {
  anchorId: string;
  anchorName: string;
  x: number;
  y: number;
  state: LeafState;
  qaCount: number;
  onTap: (anchorId: string, centerClientX: number, centerClientY: number) => void;
  ambientSway?: boolean;
  animationDelay?: number;
}

// Leaf visual: rounded ellipse shape (~24x16) with subtle stem. Pure SVG, no filters on mobile.
export function TrellisLeaf(props: TrellisLeafProps) {
  const { anchorId, anchorName, x, y, state, qaCount, onTap, ambientSway, animationDelay = 0 } = props;
  const color = LEAF_STATE_COLOR[state];
  const filter = LEAF_STATE_FILTER[state];
  const half = LEAF_HIT_TARGET_PX / 2;

  const handleTap = (e: React.PointerEvent<SVGGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onTap(anchorId, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  // Blossom = 5-petal shape; Fruit = circle; Bud = small circle; others = leaf ellipse.
  let shape: React.ReactNode;
  if (state === 'blossom') {
    shape = (
      <g>
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} cx={0} cy={-8} rx={5} ry={8} fill={color} transform={`rotate(${angle})`} />
        ))}
        <circle cx={0} cy={0} r={3} fill="var(--primary-40)" />
      </g>
    );
  } else if (state === 'fruit') {
    shape = <circle cx={0} cy={0} r={8} fill={color} />;
  } else if (state === 'bud') {
    shape = <circle cx={0} cy={0} r={5} fill={color} />;
  } else {
    // leaf ellipse with stem
    shape = (
      <g>
        <ellipse cx={0} cy={0} rx={12} ry={7} fill={color} style={filter ? { filter } : undefined} />
        <line x1={-10} y1={4} x2={-16} y2={10} stroke="var(--node-salmon)" strokeWidth={1.2} opacity={0.6} />
      </g>
    );
  }

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${anchorName} — ${state} health, ${qaCount} Q&A${qaCount === 1 ? '' : 's'}`}
      transform={`translate(${x}, ${y})`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: ambientSway ? [0, 2, -2, 0] : 0 }}
      transition={ambientSway
        ? { scale: { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }, opacity: { duration: 0.3, delay: animationDelay }, rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
        : { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }}
      onPointerDown={handleTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(e as unknown as React.PointerEvent<SVGGElement>); }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {/* 44x44 invisible hit target centered on leaf (WCAG 2.5.5) */}
      <rect x={-half} y={-half} width={LEAF_HIT_TARGET_PX} height={LEAF_HIT_TARGET_PX} fill="transparent" style={{ pointerEvents: 'all' }} />
      {shape}
    </motion.g>
  );
}
