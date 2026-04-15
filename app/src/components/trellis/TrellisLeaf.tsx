import { motion } from 'framer-motion';
import type { LeafState } from '../../services/trellis-state.service.ts';
import { LEAF_HIT_TARGET_PX } from './types.ts';

// Ghibli-palette: richer, painterly tones that sit well on watercolor backgrounds
export const LEAF_STATE_COLOR: Record<LeafState, string> = {
  bud: '#7CB342',      // young sprout green
  green: '#388E3C',    // deep forest green
  yellow: '#F9A825',   // warm golden amber
  falling: '#E65100',  // burnt orange
  fallen: '#8D6E63',   // earthy brown (withered)
  blossom: '#CE93D8',  // soft sakura pink-lavender
  fruit: '#C62828',    // deep apple red
};

// Darker accent for veins / outlines per state
const LEAF_VEIN_COLOR: Record<LeafState, string> = {
  bud: '#558B2F',
  green: '#1B5E20',
  yellow: '#F57F17',
  falling: '#BF360C',
  fallen: '#5D4037',
  blossom: '#7B1FA2',
  fruit: '#B71C1C',
};

export interface TrellisLeafProps {
  anchorId: string;
  anchorName: string;
  x: number;
  y: number;
  stemAngle: number; // degrees — direction from leaf center toward vine
  state: LeafState;
  qaCount: number;
  onTap: (anchorId: string, centerClientX: number, centerClientY: number) => void;
  ambientSway?: boolean;
  animationDelay?: number;
}

// ── SVG shape builders per lifecycle state ────────────────────────────────
// All shapes are drawn centered on (0,0) in a ~30x30 bounding box.

// Bud: small teardrop sprout with a tiny stem
function BudShape({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <line x1={0} y1={6} x2={0} y2={12} stroke={vein} strokeWidth={1.5} strokeLinecap="round" />
      <path
        d="M 0,-8 C 6,-6 7,0 5,5 C 3,8 -3,8 -5,5 C -7,0 -6,-6 0,-8 Z"
        fill={color} stroke={vein} strokeWidth={0.8}
      />
      <line x1={0} y1={-6} x2={0} y2={4} stroke={vein} strokeWidth={0.6} opacity={0.5} />
    </g>
  );
}

// Full pointed leaf with central vein + two side veins
function FullLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      {/* stem */}
      <line x1={0} y1={8} x2={2} y2={14} stroke={vein} strokeWidth={1.5} strokeLinecap="round" />
      {/* leaf body — pointed tip at top, rounded base */}
      <path
        d="M 0,-12 C 8,-8 12,-2 10,4 C 8,8 3,10 0,8 C -3,10 -8,8 -10,4 C -12,-2 -8,-8 0,-12 Z"
        fill={color} stroke={vein} strokeWidth={0.8}
      />
      {/* central vein */}
      <line x1={0} y1={-10} x2={0} y2={7} stroke={vein} strokeWidth={0.7} opacity={0.6} />
      {/* side veins */}
      <line x1={0} y1={-4} x2={6} y2={0} stroke={vein} strokeWidth={0.5} opacity={0.4} />
      <line x1={0} y1={-4} x2={-6} y2={0} stroke={vein} strokeWidth={0.5} opacity={0.4} />
      <line x1={0} y1={1} x2={5} y2={4} stroke={vein} strokeWidth={0.5} opacity={0.3} />
      <line x1={0} y1={1} x2={-5} y2={4} stroke={vein} strokeWidth={0.5} opacity={0.3} />
    </g>
  );
}

// Curling leaf — one edge folds, asymmetric (yellow / warning)
function CurlingLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <line x1={0} y1={8} x2={2} y2={14} stroke={vein} strokeWidth={1.5} strokeLinecap="round" />
      <path
        d="M 0,-12 C 8,-8 12,-2 10,4 C 8,8 3,10 0,8 C -3,10 -8,8 -10,4 C -12,-2 -8,-8 0,-12 Z"
        fill={color} stroke={vein} strokeWidth={0.8}
      />
      {/* curling tip — a fold line on one side */}
      <path
        d="M 6,-4 C 9,-6 11,-3 8,-1"
        fill="none" stroke={vein} strokeWidth={0.7} opacity={0.5}
      />
      <line x1={0} y1={-10} x2={0} y2={7} stroke={vein} strokeWidth={0.7} opacity={0.5} />
    </g>
  );
}

// Falling leaf — tilted, edge folded more aggressively
function FallingLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g transform="rotate(25)">
      <line x1={0} y1={8} x2={1} y2={13} stroke={vein} strokeWidth={1.3} strokeLinecap="round" />
      <path
        d="M 0,-11 C 7,-7 10,-1 8,4 C 6,7 2,9 0,7 C -2,9 -7,7 -9,3 C -10,-1 -7,-7 0,-11 Z"
        fill={color} stroke={vein} strokeWidth={0.8}
      />
      {/* fold crease */}
      <path d="M -3,-5 C -1,0 2,3 5,5" fill="none" stroke={vein} strokeWidth={0.6} opacity={0.4} />
    </g>
  );
}

// Fallen/wilted — small, crumpled silhouette
function WiltedLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g transform="rotate(-15)">
      <path
        d="M 0,-8 C 5,-5 7,0 5,4 C 3,6 0,7 -2,5 C -5,6 -7,3 -6,0 C -7,-4 -4,-7 0,-8 Z"
        fill={color} stroke={vein} strokeWidth={0.8} opacity={0.8}
      />
      {/* broken vein */}
      <line x1={0} y1={-5} x2={-1} y2={3} stroke={vein} strokeWidth={0.6} opacity={0.3} strokeDasharray="2 1.5" />
    </g>
  );
}

// Sakura blossom — 5 rounded petals with center pistil
function SakuraShape({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((angle) => (
        <path
          key={angle}
          d="M 0,0 C -3,-4 -3,-9 0,-12 C 3,-9 3,-4 0,0 Z"
          fill={color} stroke={vein} strokeWidth={0.5}
          transform={`rotate(${angle})`} opacity={0.85}
        />
      ))}
      {/* pistil cluster */}
      <circle cx={0} cy={0} r={3} fill="#FFF9C4" />
      <circle cx={-1} cy={-1} r={1} fill="#FFEB3B" opacity={0.8} />
      <circle cx={1} cy={0} r={0.8} fill="#FFEB3B" opacity={0.6} />
    </g>
  );
}

// Fruit — apple with stem, tiny highlight
function FruitShape({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      {/* stem */}
      <line x1={0} y1={-10} x2={1} y2={-14} stroke="#5D4037" strokeWidth={1.5} strokeLinecap="round" />
      {/* tiny leaf on stem */}
      <path d="M 1,-13 C 4,-15 6,-13 4,-11" fill="#66BB6A" stroke="none" />
      {/* apple body — two lobes */}
      <path
        d="M 0,-9 C 6,-9 10,-4 9,1 C 8,6 4,10 0,10 C -4,10 -8,6 -9,1 C -10,-4 -6,-9 0,-9 Z"
        fill={color} stroke={vein} strokeWidth={0.8}
      />
      {/* highlight */}
      <ellipse cx={-3} cy={-4} rx={2.5} ry={3} fill="white" opacity={0.25} />
    </g>
  );
}

// Scale factor: shapes are authored in a ~30px bounding box, need ~54px for 800×400 viewBox
const LEAF_SCALE = 1.8;

export function TrellisLeaf(props: TrellisLeafProps) {
  const { anchorId, anchorName, x, y, stemAngle, state, qaCount, onTap, ambientSway, animationDelay = 0 } = props;
  const color = LEAF_STATE_COLOR[state];
  const vein = LEAF_VEIN_COLOR[state];
  const half = LEAF_HIT_TARGET_PX / 2;

  const handleTap = (e: React.MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onTap(anchorId, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  let shape: React.ReactNode;
  switch (state) {
    case 'bud':     shape = <BudShape color={color} vein={vein} />; break;
    case 'green':   shape = <FullLeaf color={color} vein={vein} />; break;
    case 'yellow':  shape = <CurlingLeaf color={color} vein={vein} />; break;
    case 'falling': shape = <FallingLeaf color={color} vein={vein} />; break;
    case 'fallen':  shape = <WiltedLeaf color={color} vein={vein} />; break;
    case 'blossom': shape = <SakuraShape color={color} vein={vein} />; break;
    case 'fruit':   shape = <FruitShape color={color} vein={vein} />; break;
  }

  // Stems in local coords point toward +y (down = 90°).
  // Rotate so stem faces the vine attachment point.
  const stemRotation = stemAngle - 90;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${anchorName} — ${state} health, ${qaCount} Q&A${qaCount === 1 ? '' : 's'}`}
      transform={`translate(${x}, ${y})`}
      onClick={handleTap}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(e as unknown as React.MouseEvent<SVGGElement>); }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {/* 44x44 invisible hit target centered on leaf (WCAG 2.5.5) */}
      <rect x={-half} y={-half} width={LEAF_HIT_TARGET_PX} height={LEAF_HIT_TARGET_PX} fill="transparent" style={{ pointerEvents: 'all' }} />
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: LEAF_SCALE, opacity: 1, rotate: ambientSway ? [stemRotation, stemRotation + 3, stemRotation - 3, stemRotation] : stemRotation }}
        transition={ambientSway
          ? { scale: { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }, opacity: { duration: 0.3, delay: animationDelay }, rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
          : { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }}
        style={{ transformOrigin: '0 0', transformBox: 'fill-box' }}
      >
        {shape}
      </motion.g>
    </g>
  );
}
