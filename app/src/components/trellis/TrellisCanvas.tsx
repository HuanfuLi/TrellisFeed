import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { TrellisLayout } from '../../services/trellis-state.service.ts';
import { TRELLIS_VIEWBOX_W, TRELLIS_VIEWBOX_H } from '../../services/trellis-layout.service.ts';
import { TrellisLeaf } from './TrellisLeaf.tsx';
import { leafAnimationMask, TAP_ANIMATION_THRESHOLD } from '../../services/trellis-perf-mask.ts';

export interface TrellisCanvasProps {
  layout: TrellisLayout;
  ambientEnabled: boolean;
  focusedAnchorId?: string | null;
}

// ── Phase 25 D-55 + Phase 28 D-13 — perf thresholds ────────────────────────
// Two thresholds, two animation classes:
//   AMBIENT_SWAY_THRESHOLD = 20 — continuous (repeats forever), ambient only.
//   TAP_ANIMATION_THRESHOLD = 30 — event-driven (one-shot), tolerates more leaves.
// TAP_ANIMATION_THRESHOLD lives in trellis-perf-mask.ts alongside the predicate.
const AMBIENT_SWAY_THRESHOLD = 20;

/**
 * Phase 28 D-12 — pure predicate for pulse-on-focus matching.
 * Exported so node --test can assert without rendering.
 */
export const isLeafFocused = (
  focusedAnchorId: string | null | undefined,
  leafAnchorId: string | null | undefined,
): boolean => {
  if (!focusedAnchorId || !leafAnchorId) return false;
  return focusedAnchorId === leafAnchorId;
};

export function TrellisCanvas({ layout, ambientEnabled, focusedAnchorId }: TrellisCanvasProps) {
  const { t } = useTranslation();
  const { vines, nodes } = layout;
  const leafCount = nodes.length;
  const swayEnabled = leafCount <= AMBIENT_SWAY_THRESHOLD;
  const leafSwayMask = useMemo(() => {
    if (swayEnabled) return (_: number) => true;
    return (i: number) => i % 3 === 0;
  }, [swayEnabled]);
  const effectiveSway = ambientEnabled ? leafSwayMask : (_: number) => false;

  // Phase 28 D-13 — tap-animation perf guard. Count-only gate (IntersectionObserver
  // can layer in later per RESEARCH Pattern 6 without changing the call site).
  // inView=true is the conservative default — below the threshold everything
  // animates; above it, we'd need real visibility info to suppress. Until IO
  // lands, leaves above the threshold still animate (graceful degradation).
  const perfGuardThresholdExceeded = leafCount > TAP_ANIMATION_THRESHOLD;

  return (
    <svg
      viewBox={`0 0 ${TRELLIS_VIEWBOX_W} ${TRELLIS_VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', display: 'block' }}
      role="img"
      aria-label={t('planner.trellis.ariaLabel')}
    >
      {/* Vines — staggered draw-on animation */}
      <g>
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
      {/* Short branch stems from vine to leaf */}
      <g>
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
      {/* Leaves / blossoms / fruits */}
      <g>
        {nodes.map((n, i) => {
          // D-13: when the canvas is large, gate the one-shot animations.
          // leafAnimationMask returns true when allowed; perfGuardActive is the
          // complement. Without IO layered, inView=true is the conservative default.
          const inView = true;
          const perfGuardActive =
            perfGuardThresholdExceeded && !leafAnimationMask({ totalCount: leafCount, inView });
          return (
            <TrellisLeaf
              key={n.anchor.id}
              anchorId={n.anchor.id}
              x={n.layoutPosition.x}
              y={n.layoutPosition.y}
              tangentAngle={n.tangentAngle}
              side={n.side}
              state={n.leafState}
              botanicalCategory={n.botanicalCategory}
              ambientSway={effectiveSway(i)}
              animationDelay={0.8 + i * 0.05}
              focused={isLeafFocused(focusedAnchorId, n.anchor.id)}
              perfGuardActive={perfGuardActive}
            />
          );
        })}
      </g>
    </svg>
  );
}
