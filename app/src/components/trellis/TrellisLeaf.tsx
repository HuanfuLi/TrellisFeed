import { useCallback, useEffect, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { LeafState } from '../../services/trellis-state.service.ts';
import { hapticImpactLight } from '../../lib/haptics.ts';

// ── Phase 28 D-10/D-11 — shake-on-tap constants ────────────────────────────
// Exported at module scope so Wave 0 tests can import without DOM/render.

/** Rotate keyframes for tap-to-shake animation (degrees). */
export const SHAKE_KEYFRAMES: readonly [number, number, number, number, number] = [0, 12, -10, 5, 0];

/** Duration of the shake animation in milliseconds. */
export const SHAKE_DURATION_MS = 300;

/**
 * Dependencies for `onLeafTap` — pure-logic helper split out so the D-11
 * haptic Nyquist requirement can be asserted via mocked injection.
 *
 * `shakeControls` is typed loosely (`start: (arg: any) => any`) to accept
 * BOTH framer-motion's real `AnimationControls.start` AND a minimal test spy
 * without the caller needing a cast. The contract only requires that a
 * single call with an animation definition is made.
 */
export interface OnLeafTapDeps {
  perfGuardActive: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shakeControls: { start: (animate: any) => any };
  haptic: () => void | Promise<void>;
}

/**
 * Phase 28 D-10/D-11 — shake on tap + haptic.
 *
 * Pure helper: no DOM access, no React hooks. Safe to call from a
 * `useCallback` wrapper inside the component AND from a node:test runner
 * with an injected haptic spy.
 *
 * Contract:
 *   - perfGuardActive=true → no-op (D-13: off-screen leaves on large canvases)
 *   - otherwise: fire haptic exactly once + queue shake animation on shakeControls
 */
export const onLeafTap = ({ perfGuardActive, shakeControls, haptic }: OnLeafTapDeps): void => {
  if (perfGuardActive) return;
  void haptic();
  void shakeControls.start({
    rotate: SHAKE_KEYFRAMES,
    transition: { duration: SHAKE_DURATION_MS / 1000, ease: 'easeInOut' },
  });
};

// ── Botanical categories ───────────────────────────────────────────────────
// Each node is assigned one category. The leaf→blossom→fruit progression
// follows that category so the plant "grows" coherently.

export const BOTANICAL_CATEGORIES = [
  'cherry',      // 0 — sakura blossom → twin cherries
  'apple',       // 1 — camellia blossom → apple
  'grape',       // 2 — lobed vine leaf → clustered flowers → grape bunch
  'kiwi',        // 3 — round leaf → white star flower → fuzzy kiwi
  'passionfruit', // 4 — heart leaf → corona flower → passionfruit
  'bittermelon', // 5 — palmate leaf → yellow flower → bumpy gourd
  'greenbean',   // 6 — oval leaf → pea flower → bean pod
  'cucumber',    // 7 — angular leaf → yellow star → cucumber
] as const;

export type BotanicalCategory = typeof BOTANICAL_CATEGORIES[number];

// ── State-based colors ─────────────────────────────────────────────────────

const STATE_COLOR: Record<LeafState, string> = {
  bud: '#7CB342',
  green: '#388E3C',
  dying: '#F9A825',
  falling: '#E65100',
  dead: '#8D6E63',
  blossom: '#CE93D8', // default, overridden per category
  fruit: '#C62828',   // default, overridden per category
};

const STATE_VEIN: Record<LeafState, string> = {
  bud: '#558B2F',
  green: '#1B5E20',
  dying: '#F57F17',
  falling: '#BF360C',
  dead: '#5D4037',
  blossom: '#7B1FA2',
  fruit: '#B71C1C',
};

// Per-category blossom and fruit colors
const BLOSSOM_COLORS: Record<BotanicalCategory, [string, string]> = {
  cherry:       ['#F8BBD0', '#C2185B'], // pink sakura
  apple:        ['#F48FB1', '#AD1457'], // deep pink
  grape:        ['#CE93D8', '#7B1FA2'], // lavender
  kiwi:         ['#FFFFFF', '#9E9E9E'], // white
  passionfruit: ['#B39DDB', '#4527A0'], // purple
  bittermelon:  ['#FFF176', '#F9A825'], // yellow
  greenbean:    ['#F8BBD0', '#C2185B'], // pink pea
  cucumber:     ['#FFEE58', '#F9A825'], // yellow star
};

const FRUIT_COLORS: Record<BotanicalCategory, [string, string]> = {
  cherry:       ['#E53935', '#B71C1C'], // red
  apple:        ['#C62828', '#8E0000'], // deep red
  grape:        ['#7B1FA2', '#4A148C'], // purple
  kiwi:         ['#8D6E63', '#5D4037'], // brown fuzzy
  passionfruit: ['#6A1B9A', '#4A148C'], // dark purple
  bittermelon:  ['#689F38', '#33691E'], // green
  greenbean:    ['#558B2F', '#33691E'], // green
  cucumber:     ['#7CB342', '#558B2F'], // green
};

// ── Props ──────────────────────────────────────────────────────────────────

export interface TrellisLeafProps {
  x: number;
  y: number;
  tangentAngle: number;
  side: number;
  state: LeafState;
  botanicalCategory: number; // index into BOTANICAL_CATEGORIES
  ambientSway?: boolean;
  animationDelay?: number;
  anchorId?: string; // Phase 28 D-12 — identifies the leaf for focus matching + pulse key
  focused?: boolean; // Phase 28 D-12 — true when Suggested Moves row for this anchor was pressed
  perfGuardActive?: boolean; // Phase 28 D-13 — true when layout.nodes.length > 30 AND leaf is off-screen
}

// ── Bud (universal) ────────────────────────────────────────────────────────

function Bud({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-8 C 6,-6 7,0 5,5 C 3,8 -3,8 -5,5 C -7,0 -6,-6 0,-8 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-6} x2={0} y2={4} stroke={vein} strokeWidth={0.6} opacity={0.5} />
    </g>
  );
}

// ── Leaf shapes per category ───────────────────────────────────────────────
// Each returns the base leaf. Decay states apply visual mods externally.

// Cherry: pointed, serrated-edge leaf
function CherryLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-14 C 7,-11 12,-5 10,2 C 8,7 4,11 0,9 C -4,11 -8,7 -10,2 C -12,-5 -7,-11 0,-14 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-12} x2={0} y2={8} stroke={vein} strokeWidth={0.6} opacity={0.5} />
      <line x1={0} y1={-5} x2={6} y2={-1} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-5} x2={-6} y2={-1} stroke={vein} strokeWidth={0.4} opacity={0.3} />
    </g>
  );
}

// Apple: broad oval leaf
function AppleLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-13 C 9,-9 14,-2 12,5 C 10,10 4,13 0,11 C -4,13 -10,10 -12,5 C -14,-2 -9,-9 0,-13 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-11} x2={0} y2={10} stroke={vein} strokeWidth={0.7} opacity={0.5} />
      <line x1={0} y1={-3} x2={8} y2={2} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-3} x2={-8} y2={2} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={3} x2={6} y2={7} stroke={vein} strokeWidth={0.4} opacity={0.25} />
      <line x1={0} y1={3} x2={-6} y2={7} stroke={vein} strokeWidth={0.4} opacity={0.25} />
    </g>
  );
}

// Grape: 3-lobed vine leaf
function GrapeLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-13 C 5,-12 10,-8 12,-3 C 14,1 11,5 8,7 C 5,9 3,11 0,10 C -3,11 -5,9 -8,7 C -11,5 -14,1 -12,-3 C -10,-8 -5,-12 0,-13 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      {/* 3-lobe notches */}
      <path d="M 0,-13 L 0,-8" stroke={vein} strokeWidth={0.5} opacity={0.4} />
      <path d="M -8,7 C -5,4 -2,6 0,10" fill="none" stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <path d="M 8,7 C 5,4 2,6 0,10" fill="none" stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-11} x2={0} y2={9} stroke={vein} strokeWidth={0.6} opacity={0.4} />
      <line x1={0} y1={-4} x2={9} y2={1} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-4} x2={-9} y2={1} stroke={vein} strokeWidth={0.4} opacity={0.3} />
    </g>
  );
}

// Kiwi: round, almost circular leaf
function KiwiLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <ellipse cx={0} cy={-1} rx={11} ry={12} fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-12} x2={0} y2={10} stroke={vein} strokeWidth={0.6} opacity={0.45} />
      <line x1={0} y1={-4} x2={8} y2={0} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-4} x2={-8} y2={0} stroke={vein} strokeWidth={0.4} opacity={0.3} />
    </g>
  );
}

// Passionfruit: heart-shaped leaf
function PassionfruitLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-4 C -4,-12 -14,-10 -12,-2 C -10,5 -3,11 0,13 C 3,11 10,5 12,-2 C 14,-10 4,-12 0,-4 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-3} x2={0} y2={12} stroke={vein} strokeWidth={0.6} opacity={0.45} />
      <line x1={0} y1={3} x2={-7} y2={-1} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={3} x2={7} y2={-1} stroke={vein} strokeWidth={0.4} opacity={0.3} />
    </g>
  );
}

// Bitter melon: palmate 5-fingered leaf
function BittermelonLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-14 C 3,-12 8,-10 10,-5 C 12,-1 10,3 7,6 C 4,8 2,10 0,9 C -2,10 -4,8 -7,6 C -10,3 -12,-1 -10,-5 C -8,-10 -3,-12 0,-14 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      {/* palmate veins */}
      <line x1={0} y1={-12} x2={0} y2={8} stroke={vein} strokeWidth={0.6} opacity={0.45} />
      <line x1={0} y1={-6} x2={8} y2={-2} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-6} x2={-8} y2={-2} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-2} x2={6} y2={4} stroke={vein} strokeWidth={0.4} opacity={0.25} />
      <line x1={0} y1={-2} x2={-6} y2={4} stroke={vein} strokeWidth={0.4} opacity={0.25} />
    </g>
  );
}

// Green bean: small oval leaf
function GreenbeanLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <ellipse cx={0} cy={-1} rx={8} ry={11} fill={color} stroke={vein} strokeWidth={0.8} />
      <line x1={0} y1={-10} x2={0} y2={9} stroke={vein} strokeWidth={0.5} opacity={0.45} />
      <line x1={0} y1={-3} x2={5} y2={0} stroke={vein} strokeWidth={0.35} opacity={0.3} />
      <line x1={0} y1={-3} x2={-5} y2={0} stroke={vein} strokeWidth={0.35} opacity={0.3} />
    </g>
  );
}

// Cucumber: broad angular leaf
function CucumberLeaf({ color, vein }: { color: string; vein: string }) {
  return (
    <g>
      <path d="M 0,-12 C 8,-10 14,-4 12,3 C 10,8 5,12 0,11 C -5,12 -10,8 -12,3 C -14,-4 -8,-10 0,-12 Z"
        fill={color} stroke={vein} strokeWidth={0.8} />
      {/* angular veins radiating */}
      <line x1={0} y1={-10} x2={0} y2={10} stroke={vein} strokeWidth={0.6} opacity={0.45} />
      <line x1={0} y1={-5} x2={10} y2={0} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={-5} x2={-10} y2={0} stroke={vein} strokeWidth={0.4} opacity={0.3} />
      <line x1={0} y1={2} x2={7} y2={7} stroke={vein} strokeWidth={0.4} opacity={0.25} />
      <line x1={0} y1={2} x2={-7} y2={7} stroke={vein} strokeWidth={0.4} opacity={0.25} />
    </g>
  );
}

const LEAF_SHAPES: Record<BotanicalCategory, (p: { color: string; vein: string }) => React.ReactNode> = {
  cherry: CherryLeaf, apple: AppleLeaf, grape: GrapeLeaf, kiwi: KiwiLeaf,
  passionfruit: PassionfruitLeaf, bittermelon: BittermelonLeaf, greenbean: GreenbeanLeaf, cucumber: CucumberLeaf,
};

// ── Blossom shapes per category ────────────────────────────────────────────

function SakuraBlossom({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d="M 0,0 C -3,-4 -3,-10 0,-13 C 3,-10 3,-4 0,0 Z"
          fill={fill} stroke={stroke} strokeWidth={0.5} transform={`rotate(${a})`} opacity={0.85} />
      ))}
      <circle cx={0} cy={0} r={3} fill="#FFF9C4" />
      <circle cx={-1} cy={-1} r={1} fill="#FFEB3B" opacity={0.8} />
    </g>
  );
}

function CamelliaBlossom({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={0} cy={-8} rx={5.5} ry={9} fill={fill} stroke={stroke}
          strokeWidth={0.4} transform={`rotate(${a})`} opacity={0.8} />
      ))}
      <circle cx={0} cy={0} r={4} fill="#FFECB3" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={`s${a}`} cx={Math.cos((a - 90) * Math.PI / 180) * 2.8}
          cy={Math.sin((a - 90) * Math.PI / 180) * 2.8} r={0.7} fill="#FFD54F" />
      ))}
    </g>
  );
}

function GrapeFlower({ fill, stroke }: { fill: string; stroke: string }) {
  // Tiny clustered flowers
  return (
    <g>
      {[[-3, -5], [3, -5], [0, -1], [-4, 2], [4, 2]].map(([cx, cy], i) => (
        <g key={i}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={cx} cy={(cy as number) - 2} rx={1.5} ry={2.5} fill={fill}
              stroke={stroke} strokeWidth={0.3} transform={`rotate(${a}, ${cx}, ${cy})`} opacity={0.7} />
          ))}
          <circle cx={cx} cy={cy} r={1} fill="#FFF9C4" />
        </g>
      ))}
    </g>
  );
}

function KiwiFlower({ fill, stroke }: { fill: string; stroke: string }) {
  // White 5-petal star flower
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-9} rx={4} ry={8} fill={fill} stroke={stroke}
          strokeWidth={0.4} transform={`rotate(${a})`} opacity={0.9} />
      ))}
      <circle cx={0} cy={0} r={4} fill="#FFECB3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1={0} y1={0}
          x2={Math.cos((a - 90) * Math.PI / 180) * 3.5}
          y2={Math.sin((a - 90) * Math.PI / 180) * 3.5}
          stroke="#E65100" strokeWidth={0.5} opacity={0.5} />
      ))}
    </g>
  );
}

function PassionFlower({ fill, stroke }: { fill: string; stroke: string }) {
  // Corona-style passion flower
  return (
    <g>
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => (
        <line key={a} x1={0} y1={0}
          x2={Math.cos((a - 90) * Math.PI / 180) * 12}
          y2={Math.sin((a - 90) * Math.PI / 180) * 12}
          stroke={stroke} strokeWidth={0.8} opacity={0.6} />
      ))}
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={`p${a}`} cx={0} cy={-8} rx={4} ry={7} fill={fill} stroke={stroke}
          strokeWidth={0.4} transform={`rotate(${a})`} opacity={0.8} />
      ))}
      <circle cx={0} cy={0} r={3} fill="#C5E1A5" />
      <circle cx={0} cy={0} r={1.5} fill="#7CB342" />
    </g>
  );
}

function YellowFlower({ fill, stroke }: { fill: string; stroke: string }) {
  // Simple 5-petal yellow flower (bitter melon / cucumber)
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-8} rx={5} ry={8} fill={fill} stroke={stroke}
          strokeWidth={0.4} transform={`rotate(${a})`} opacity={0.85} />
      ))}
      <circle cx={0} cy={0} r={3.5} fill="#FFF9C4" />
      <circle cx={0} cy={0} r={2} fill="#FFEB3B" opacity={0.7} />
    </g>
  );
}

function PeaFlower({ fill, stroke }: { fill: string; stroke: string }) {
  // Butterfly-shaped pea/bean flower
  return (
    <g>
      {/* banner petal */}
      <path d="M 0,-12 C -8,-10 -10,-4 -6,0 C -2,3 2,3 6,0 C 10,-4 8,-10 0,-12 Z"
        fill={fill} stroke={stroke} strokeWidth={0.5} opacity={0.9} />
      {/* wing petals */}
      <path d="M -5,0 C -10,-2 -12,3 -8,6 C -5,8 -2,5 -1,2 Z"
        fill={fill} stroke={stroke} strokeWidth={0.4} opacity={0.7} />
      <path d="M 5,0 C 10,-2 12,3 8,6 C 5,8 2,5 1,2 Z"
        fill={fill} stroke={stroke} strokeWidth={0.4} opacity={0.7} />
      {/* keel */}
      <path d="M -2,3 C -1,7 1,7 2,3 Z" fill={stroke} opacity={0.3} />
    </g>
  );
}

// ── Fruit shapes per category ──────────────────────────────────────────────

function CherryFruit({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      <path d="M 0,-14 C -2,-10 -6,-8 -7,-4" fill="none" stroke="#5D4037" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 0,-14 C 2,-10 6,-8 7,-4" fill="none" stroke="#5D4037" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M -1,-14 C 2,-16 4,-15 3,-13" fill="#66BB6A" stroke="none" />
      <circle cx={-7} cy={-1} r={6} fill={fill} stroke={stroke} strokeWidth={0.7} />
      <circle cx={7} cy={-1} r={6} fill={fill} stroke={stroke} strokeWidth={0.7} />
      <ellipse cx={-9} cy={-3} rx={1.8} ry={2.2} fill="white" opacity={0.2} />
      <ellipse cx={5} cy={-3} rx={1.8} ry={2.2} fill="white" opacity={0.2} />
    </g>
  );
}

function AppleFruit({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      <line x1={0} y1={-10} x2={1} y2={-14} stroke="#5D4037" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M 1,-13 C 4,-15 6,-13 4,-11" fill="#66BB6A" stroke="none" />
      <path d="M 0,-9 C 6,-9 10,-4 9,1 C 8,6 4,10 0,10 C -4,10 -8,6 -9,1 C -10,-4 -6,-9 0,-9 Z"
        fill={fill} stroke={stroke} strokeWidth={0.8} />
      <ellipse cx={-3} cy={-4} rx={2.5} ry={3} fill="white" opacity={0.25} />
    </g>
  );
}

function GrapeBunch({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      <line x1={0} y1={-8} x2={0} y2={-14} stroke="#5D4037" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 0,-13 C 3,-15 5,-14 3,-12" fill="#66BB6A" stroke="none" />
      {/* pyramid of grapes */}
      <circle cx={0} cy={-6} r={4} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <circle cx={-5} cy={-2} r={4} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <circle cx={5} cy={-2} r={4} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <circle cx={-3} cy={3} r={4} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <circle cx={3} cy={3} r={4} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <circle cx={0} cy={7} r={4} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <ellipse cx={-2} cy={-7} rx={1} ry={1.2} fill="white" opacity={0.15} />
    </g>
  );
}

function KiwiFruit({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={8} ry={11} fill={fill} stroke={stroke} strokeWidth={0.8} />
      {/* fuzzy texture dots */}
      {[[-3, -6], [2, -4], [-1, 0], [3, 2], [-4, 3], [1, 6]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.6} fill={stroke} opacity={0.3} />
      ))}
      <ellipse cx={-2} cy={-4} rx={2} ry={2.5} fill="white" opacity={0.15} />
    </g>
  );
}

function PassionfruitFruit({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      <line x1={0} y1={-10} x2={0} y2={-13} stroke="#5D4037" strokeWidth={1} strokeLinecap="round" />
      <ellipse cx={0} cy={0} rx={9} ry={10} fill={fill} stroke={stroke} strokeWidth={0.8} />
      {/* dimple at top */}
      <ellipse cx={0} cy={-8} rx={2.5} ry={1.5} fill={stroke} opacity={0.3} />
      <ellipse cx={-3} cy={-3} rx={2} ry={2.5} fill="white" opacity={0.15} />
    </g>
  );
}

function BittermelonFruit({ fill, stroke }: { fill: string; stroke: string }) {
  // Bumpy elongated gourd
  return (
    <g>
      <line x1={0} y1={-14} x2={1} y2={-17} stroke="#5D4037" strokeWidth={1} strokeLinecap="round" />
      <path d="M 0,-14 C 6,-12 8,-6 7,0 C 6,6 4,12 0,14 C -4,12 -6,6 -7,0 C -8,-6 -6,-12 0,-14 Z"
        fill={fill} stroke={stroke} strokeWidth={0.8} />
      {/* bumpy ridges */}
      {[-10, -5, 0, 5, 10].map((cy) => (
        <path key={cy}
          d={`M ${-5 + Math.abs(cy) * 0.2},${cy} Q 0,${cy - 2} ${5 - Math.abs(cy) * 0.2},${cy}`}
          fill="none" stroke={stroke} strokeWidth={0.5} opacity={0.3} />
      ))}
    </g>
  );
}

function GreenbeanFruit({ fill, stroke }: { fill: string; stroke: string }) {
  // Long curved bean pod
  return (
    <g>
      <line x1={-1} y1={-14} x2={-2} y2={-17} stroke="#5D4037" strokeWidth={0.8} strokeLinecap="round" />
      <path d="M 0,-14 C 5,-10 6,-3 5,4 C 4,10 2,15 0,16 C -2,15 -3,10 -3,4 C -3,-3 -2,-10 0,-14 Z"
        fill={fill} stroke={stroke} strokeWidth={0.7} />
      {/* seed bumps */}
      {[-8, -3, 2, 7, 12].map((cy) => (
        <ellipse key={cy} cx={0.5} cy={cy} rx={2} ry={1.8} fill={stroke} opacity={0.15} />
      ))}
    </g>
  );
}

function CucumberFruit({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <g>
      <line x1={0} y1={-13} x2={1} y2={-16} stroke="#5D4037" strokeWidth={0.8} strokeLinecap="round" />
      <path d="M 0,-13 C 5,-11 7,-5 6,2 C 5,8 3,14 0,15 C -3,14 -5,8 -6,2 C -7,-5 -5,-11 0,-13 Z"
        fill={fill} stroke={stroke} strokeWidth={0.7} />
      {/* subtle bumps */}
      {[[-2, -7], [2, -3], [-1, 2], [2, 6], [-2, 10]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={0.8} fill="white" opacity={0.2} />
      ))}
      <ellipse cx={-2} cy={-6} rx={1.5} ry={2} fill="white" opacity={0.12} />
    </g>
  );
}

// ── Category → shape lookup ────────────────────────────────────────────────

type ShapeFn = (p: { fill: string; stroke: string }) => React.ReactNode;

const BLOSSOM_SHAPES: Record<BotanicalCategory, ShapeFn> = {
  cherry: SakuraBlossom, apple: CamelliaBlossom, grape: GrapeFlower, kiwi: KiwiFlower,
  passionfruit: PassionFlower, bittermelon: YellowFlower, greenbean: PeaFlower, cucumber: YellowFlower,
};

const FRUIT_SHAPES: Record<BotanicalCategory, ShapeFn> = {
  cherry: CherryFruit, apple: AppleFruit, grape: GrapeBunch, kiwi: KiwiFruit,
  passionfruit: PassionfruitFruit, bittermelon: BittermelonFruit, greenbean: GreenbeanFruit, cucumber: CucumberFruit,
};

// ── Decay modifiers ────────────────────────────────────────────────────────
// Dying/falling/dead wrap the base leaf with visual decay cues.

function withDecay(leaf: React.ReactNode, state: 'dying' | 'falling' | 'dead'): React.ReactNode {
  const extraRotation = state === 'falling' ? 20 : state === 'dead' ? -15 : 0;
  const opacity = state === 'dead' ? 0.75 : 1;
  return (
    <g transform={extraRotation ? `rotate(${extraRotation})` : undefined} opacity={opacity}>
      {leaf}
      {state === 'falling' && (
        <path d="M -3,-6 C -1,0 2,3 5,6" fill="none" stroke={STATE_VEIN[state]} strokeWidth={0.6} opacity={0.4} />
      )}
      {state === 'dead' && (
        <line x1={0} y1={-5} x2={-1} y2={3} stroke={STATE_VEIN[state]} strokeWidth={0.6} opacity={0.3} strokeDasharray="2 1.5" />
      )}
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const LEAF_SCALE = 1.8;

export function TrellisLeaf(props: TrellisLeafProps) {
  const {
    x, y, tangentAngle, side, state, botanicalCategory,
    ambientSway, animationDelay = 0,
    anchorId, focused = false, perfGuardActive = false,
  } = props;
  const cat = BOTANICAL_CATEGORIES[botanicalCategory % BOTANICAL_CATEGORIES.length];

  // Phase 28 D-10/D-11 — shake controls + handler (runtime wrapper around pure onLeafTap)
  const shakeControls = useAnimationControls();
  const handleTap = useCallback(() => {
    onLeafTap({ perfGuardActive, shakeControls, haptic: hapticImpactLight });
  }, [perfGuardActive, shakeControls]);

  // Phase 28 D-12 — re-mount the pulse wrapper each time `focused` flips true so
  // the animation fires anew on every repeat tap of the same Suggested Moves row.
  const [focusCounter, setFocusCounter] = useState(0);
  useEffect(() => {
    if (focused) setFocusCounter((c) => c + 1);
  }, [focused]);

  let shape: React.ReactNode;

  if (state === 'bud') {
    shape = <Bud color={STATE_COLOR.bud} vein={STATE_VEIN.bud} />;
  } else if (state === 'blossom') {
    const [fill, stroke] = BLOSSOM_COLORS[cat];
    const Fn = BLOSSOM_SHAPES[cat];
    shape = <Fn fill={fill} stroke={stroke} />;
  } else if (state === 'fruit') {
    const [fill, stroke] = FRUIT_COLORS[cat];
    const Fn = FRUIT_SHAPES[cat];
    shape = <Fn fill={fill} stroke={stroke} />;
  } else {
    // green, dying, falling, dead — use category leaf shape with state color
    const color = STATE_COLOR[state];
    const vein = STATE_VEIN[state];
    const LeafFn = LEAF_SHAPES[cat];
    const baseLeaf = <LeafFn color={color} vein={vein} />;
    shape = (state === 'green') ? baseLeaf : withDecay(baseLeaf, state);
  }

  const outwardAngle = tangentAngle + side * 90;
  const rotation = outwardAngle + 90;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Outer motion.g — ambient sway (Phase 25); preserved unchanged */}
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
        {/* Phase 28 D-10 — shake wrapper (tap handler lives here; ambient sway
             on the outer motion.g is untouched so both animations compose). */}
        <motion.g
          animate={shakeControls}
          onClick={handleTap}
          data-anchor-id={anchorId}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        >
          {/* Phase 28 D-12 — pulse wrapper (keyed on focusCounter so repeat
               focus re-triggers the animation). */}
          <motion.g
            key={`pulse-${anchorId ?? 'x'}-${focusCounter}`}
            animate={focused && !perfGuardActive
              ? {
                  scale: [1, 1.15, 1],
                  filter: [
                    'drop-shadow(0 0 0px transparent)',
                    'drop-shadow(0 0 8px var(--primary-40))',
                    'drop-shadow(0 0 0px transparent)',
                  ],
                }
              : { scale: 1, filter: 'drop-shadow(0 0 0px transparent)' }}
            transition={focused
              ? {
                  scale: { duration: 0.6, ease: 'easeInOut' },
                  filter: { duration: 2.0, ease: 'easeOut' },
                }
              : { duration: 0 }}
          >
            {shape}
          </motion.g>
        </motion.g>
      </motion.g>
    </g>
  );
}
