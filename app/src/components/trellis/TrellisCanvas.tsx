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
      {/* Vines — tapered stems with staggered draw-on animation */}
      <g>
        {vines.map((v, i) => {
          const segCount = v.spec.segments?.length ?? 4;
          return (
            <g key={v.branchId}>
              {/* Soft shadow for depth */}
              <motion.path
                d={v.spec.d}
                stroke={v.color}
                strokeWidth={8}
                fill="none"
                opacity={0.08}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, delay: i * 0.2, ease: 'easeInOut' }}
              />
              {/* Tapering segments: thick at base, thin at tip */}
              {Array.from({ length: Math.min(segCount, 6) }, (_, si) => {
                const frac = si / Math.max(segCount - 1, 1);
                const sw = 5.5 - frac * 3;
                const dashLen = 100 / segCount;
                return (
                  <motion.path
                    key={si}
                    d={v.spec.d}
                    stroke={v.color}
                    strokeWidth={sw}
                    fill="none"
                    opacity={0.85}
                    strokeLinecap="round"
                    strokeDasharray={`${dashLen}% ${100 - dashLen}%`}
                    strokeDashoffset={`${-si * dashLen}%`}
                    pathLength={100}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 100 }}
                    transition={{ duration: 1.2, delay: i * 0.2, ease: 'easeInOut' }}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
      {/* Branch stems — curved, not straight lines */}
      <g>
        {nodes.map((n) => {
          const vx = n.vineAttach.x;
          const vy = n.vineAttach.y;
          const lx = n.layoutPosition.x;
          const ly = n.layoutPosition.y;
          const dx = lx - vx;
          const dy = ly - vy;
          const cpx = vx + dx * 0.5 + dy * 0.15;
          const cpy = vy + dy * 0.5 - dx * 0.1;
          return (
            <path
              key={`stem-${n.anchor.id}`}
              d={`M${vx},${vy} Q${cpx},${cpy} ${lx},${ly}`}
              stroke={vines.find((v) => v.branchId === n.branchId)?.color ?? '#6B8E5A'}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              opacity={0.55}
            />
          );
        })}
      </g>
      {/* Tendrils at branch attachment points */}
      <g>
        {nodes.filter((_, i) => i % 3 === 1).map((n) => {
          const vx = n.vineAttach.x;
          const vy = n.vineAttach.y;
          const side = n.side === 'left' ? -1 : 1;
          return (
            <path
              key={`tendril-${n.anchor.id}`}
              d={`M${vx},${vy} C${vx + side * 6},${vy - 8} ${vx + side * 12},${vy - 4} ${vx + side * 10},${vy - 14}`}
              stroke={vines.find((v) => v.branchId === n.branchId)?.color ?? '#6B8E5A'}
              strokeWidth={0.8}
              fill="none"
              opacity={0.25}
              strokeLinecap="round"
            />
          );
        })}
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
