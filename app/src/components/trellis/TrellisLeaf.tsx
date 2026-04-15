import { motion } from 'framer-motion';
import type { LeafState } from '../../services/trellis-state.service.ts';

// Ghibli-palette: richer, painterly tones that sit well on watercolor backgrounds
export const LEAF_STATE_COLOR: Record<LeafState, string> = {
  bud: '#7CB342',
  green: '#388E3C',
  yellow: '#F9A825',
  falling: '#E65100',
  fallen: '#8D6E63',
  blossom: '#CE93D8',
  fruit: '#C62828',
};

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
  x: number;
  y: number;
  tangentAngle: number; // vine direction at attachment (degrees)
  side: number;         // +1 or -1 (which side of vine)
  state: LeafState;
  shapeVariant: number; // 0-2 for visual variety
  ambientSway?: boolean;
  animationDelay?: number;
}

// ── Shape builders ─────────────────────────────────────────────────────────
// All shapes point "up" (tip at -y). The rotation logic will orient them
// perpendicular to the vine, growing outward from the attachment point.

function BudShape({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-8 C 6,-6 7,0 5,5 C 3,8 -3,8 -5,5 C -7,0 -6,-6 0,-8 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-6} x2={0} y2={4} stroke={vein} strokeWidth={0.6} opacity={0.5} />
    </g>
  );
}

function FullLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-14 C 9,-10 13,-3 11,4 C 9,9 3,12 0,10 C -3,12 -9,9 -11,4 C -13,-3 -9,-10 0,-14 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-12} x2={0} y2={9} stroke={vein} strokeWidth={0.7} opacity={0.5} />
      <line x1={0} y1={-5} x2={7} y2={-1} stroke={vein} strokeWidth={0.5} opacity={0.35} />
      <line x1={0} y1={-5} x2={-7} y2={-1} stroke={vein} strokeWidth={0.5} opacity={0.35} />
      <line x1={0} y1={1} x2={6} y2={5} stroke={vein} strokeWidth={0.5} opacity={0.25} />
      <line x1={0} y1={1} x2={-6} y2={5} stroke={vein} strokeWidth={0.5} opacity={0.25} />
    </g>
  );
}

function CurlingLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-14 C 9,-10 13,-3 11,4 C 9,9 3,12 0,10 C -3,12 -9,9 -11,4 C -13,-3 -9,-10 0,-14 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <path d="M 7,-5 C 10,-7 12,-4 9,-2" fill="none" stroke={vein} strokeWidth={0.7} opacity={0.5} />
      <line x1={0} y1={-12} x2={0} y2={9} stroke={vein} strokeWidth={0.6} opacity={0.4} />
    </g>
  );
}

function FallingLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g transform="rotate(20)">
      <path d="M 0,-12 C 8,-8 11,-2 9,4 C 7,8 2,10 0,8 C -2,10 -8,8 -10,3 C -11,-2 -8,-8 0,-12 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <path d="M -3,-6 C -1,0 2,3 5,6" fill="none" stroke={vein} strokeWidth={0.6} opacity={0.4} />
    </g>
  );
}

function WiltedLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g transform="rotate(-15)">
      <path d="M 0,-8 C 5,-5 7,0 5,4 C 3,6 0,7 -2,5 C -5,6 -7,3 -6,0 C -7,-4 -4,-7 0,-8 Z"
        fill={color} stroke={vein} strokeWidth={0.8} opacity={0.8} />
      <line x1={0} y1={-5} x2={-1} y2={3} stroke={vein} strokeWidth={0.6} opacity={0.3} strokeDasharray="2 1.5" />
    </g>
  );
}

// ── 3 blossom varieties ────────────────────────────────────────────────────

function SakuraBlossom({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d="M 0,0 C -3,-4 -3,-10 0,-13 C 3,-10 3,-4 0,0 Z"
          fill={color} stroke={vein} strokeWidth={0.5} transform={`rotate(${a})`} opacity={0.85} />
      ))}
      <circle cx={0} cy={0} r={3} fill="#FFF9C4" />
      <circle cx={-1} cy={-1} r={1} fill="#FFEB3B" opacity={0.8} />
      <circle cx={1} cy={0.5} r={0.8} fill="#FFEB3B" opacity={0.6} />
    </g>
  );
}

function CamelliaBlossom({ color, vein }: { color: string; vein: string }) {
  // Round layered petals (6 petals, overlapping)
  return (
    <g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={0} cy={-8} rx={5.5} ry={9} fill={color} stroke={vein}
          strokeWidth={0.4} transform={`rotate(${a})`} opacity={0.8} />
      ))}
      <circle cx={0} cy={0} r={4} fill="#FFECB3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <circle key={a} cx={Math.cos(a * Math.PI / 180) * 2.5} cy={Math.sin(a * Math.PI / 180) * 2.5}
          r={0.7} fill="#FFD54F" />
      ))}
    </g>
  );
}

function PlumBlossom({ color, vein }: { color: string; vein: string }) {
  // 5 round petals with notch
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a}
          d="M 0,0 C -4,-3 -5,-8 -2,-12 C 0,-13 2,-13 4,-12 C 7,-8 6,-3 0,0 Z"
          fill={color} stroke={vein} strokeWidth={0.4} transform={`rotate(${a})`} opacity={0.85} />
      ))}
      <circle cx={0} cy={0} r={2.5} fill="#FFF9C4" />
      {[0, 72, 144, 216, 288].map((a) => (
        <line key={`s${a}`} x1={0} y1={0}
          x2={Math.cos((a - 90) * Math.PI / 180) * 4}
          y2={Math.sin((a - 90) * Math.PI / 180) * 4}
          stroke="#E65100" strokeWidth={0.5} opacity={0.6} />
      ))}
    </g>
  );
}

// ── 3 fruit varieties ──────────────────────────────────────────────────────

function AppleFruit({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <line x1={0} y1={-10} x2={1} y2={-14} stroke="#5D4037" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M 1,-13 C 4,-15 6,-13 4,-11" fill="#66BB6A" stroke="none" />
      <path d="M 0,-9 C 6,-9 10,-4 9,1 C 8,6 4,10 0,10 C -4,10 -8,6 -9,1 C -10,-4 -6,-9 0,-9 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <ellipse cx={-3} cy={-4} rx={2.5} ry={3} fill="white" opacity={0.25} />
    </g>
  );
}

function CherryFruit({ color, vein }: { color: string; vein: string }) {
  // Twin cherries on a forked stem
  return (
    <g>
      <path d="M 0,-14 C -2,-10 -6,-8 -7,-4" fill="none" stroke="#5D4037" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 0,-14 C 2,-10 6,-8 7,-4" fill="none" stroke="#5D4037" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M -1,-14 C 2,-16 4,-15 3,-13" fill="#66BB6A" stroke="none" />
      <circle cx={-7} cy={-1} r={6} fill={color} stroke={vein} strokeWidth={0.7} />
      <circle cx={7} cy={-1} r={6} fill={color} stroke={vein} strokeWidth={0.7} />
      <ellipse cx={-9} cy={-3} rx={1.8} ry={2.2} fill="white" opacity={0.2} />
      <ellipse cx={5} cy={-3} rx={1.8} ry={2.2} fill="white" opacity={0.2} />
    </g>
  );
}

function BerryCluster({ color, vein }: { color: string; vein: string }) {
  // Cluster of small berries
  return (
    <g>
      <line x1={0} y1={-6} x2={0} y2={-13} stroke="#5D4037" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 0,-12 C 3,-14 5,-13 3,-11" fill="#66BB6A" stroke="none" />
      <circle cx={0} cy={0} r={5} fill={color} stroke={vein} strokeWidth={0.6} />
      <circle cx={-5} cy={-3} r={4.5} fill={color} stroke={vein} strokeWidth={0.6} />
      <circle cx={5} cy={-3} r={4.5} fill={color} stroke={vein} strokeWidth={0.6} />
      <circle cx={-3} cy={-7} r={4} fill={color} stroke={vein} strokeWidth={0.6} />
      <circle cx={3} cy={-7} r={4} fill={color} stroke={vein} strokeWidth={0.6} />
      <ellipse cx={-2} cy={-2} rx={1.2} ry={1.5} fill="white" opacity={0.15} />
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const LEAF_SCALE = 1.8;

export function TrellisLeaf(props: TrellisLeafProps) {
  const { x, y, tangentAngle, side, state, shapeVariant, ambientSway, animationDelay = 0 } = props;
  const color = LEAF_STATE_COLOR[state];
  const vein = LEAF_VEIN_COLOR[state];

  let shape: React.ReactNode;
  switch (state) {
    case 'bud':     shape = <BudShape color={color} vein={vein} />; break;
    case 'green':   shape = <FullLeaf color={color} vein={vein} />; break;
    case 'yellow':  shape = <CurlingLeaf color={color} vein={vein} />; break;
    case 'falling': shape = <FallingLeaf color={color} vein={vein} />; break;
    case 'fallen':  shape = <WiltedLeaf color={color} vein={vein} />; break;
    case 'blossom':
      switch (shapeVariant) {
        case 0: shape = <SakuraBlossom color={color} vein={vein} />; break;
        case 1: shape = <CamelliaBlossom color={color} vein={vein} />; break;
        default: shape = <PlumBlossom color={color} vein={vein} />; break;
      }
      break;
    case 'fruit':
      switch (shapeVariant) {
        case 0: shape = <AppleFruit color={color} vein={vein} />; break;
        case 1: shape = <CherryFruit color={color} vein={vein} />; break;
        default: shape = <BerryCluster color={color} vein={vein} />; break;
      }
      break;
  }

  // Orientation: shapes grow "up" (-y). We want them to point away from the vine,
  // perpendicular to the vine direction, on the correct side.
  // Vine tangent is tangentAngle (degrees). Perpendicular outward = tangent + side*90.
  // Shape "up" is -90° in screen coords. So rotation = (tangent + side*90) - (-90) = tangent + side*90 + 90.
  const outwardAngle = tangentAngle + side * 90;
  const rotation = outwardAngle + 90;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: LEAF_SCALE,
          opacity: 1,
          rotate: ambientSway ? [rotation, rotation + 3, rotation - 3, rotation] : rotation,
        }}
        transition={ambientSway
          ? {
              scale: { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay },
              opacity: { duration: 0.3, delay: animationDelay },
              rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }
          : { type: 'spring', stiffness: 260, damping: 18, delay: animationDelay }}
        style={{ transformOrigin: '0 0', transformBox: 'fill-box' }}
      >
        {shape}
      </motion.g>
    </g>
  );
}
