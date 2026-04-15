import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTrellisData } from '../../state/useTrellisData.ts';
import { TrellisCanvas } from './TrellisCanvas.tsx';
import { TrellisTooltip } from './TrellisTooltip.tsx';
import { TrellisEmptyState } from './TrellisEmptyState.tsx';
import { TrellisVariantPicker } from './TrellisVariantPicker.tsx';
import { TrellisBackgroundA } from './variants/TrellisBackgroundA.tsx';
import { TrellisBackgroundC } from './variants/TrellisBackgroundC.tsx';
import type { TrellisVariant } from './types.ts';

const VARIANT_KEY = 'trellis_variant_dev';

function readInitialVariant(): TrellisVariant {
  if (typeof localStorage === 'undefined') return 'C';
  const stored = localStorage.getItem(VARIANT_KEY);
  if (stored === 'A' || stored === 'C' || stored === 'V') return stored;
  return 'C'; // default until A/V are delivered in 25-03/25-04
}

export function TrellisHero() {
  const { layout } = useTrellisData();
  const [variant, setVariant] = useState<TrellisVariant>(readInitialVariant);
  const [tooltipState, setTooltipState] = useState<null | { anchorId: string; x: number; y: number }>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const handleLeafTap = useCallback((anchorId: string, clientX: number, clientY: number) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    setTooltipState({
      anchorId,
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  const handleClose = useCallback(() => setTooltipState(null), []);

  // Close tooltip on outside pointer down
  useEffect(() => {
    if (!tooltipState) return;
    const onDown = (e: PointerEvent) => {
      if (!heroRef.current) return;
      const target = e.target as Node;
      // If pointerdown is outside hero, close
      if (!heroRef.current.contains(target)) setTooltipState(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [tooltipState]);

  // Resolve tooltip node from current layout
  const tooltipNode = useMemo(() => {
    if (!tooltipState) return null;
    return layout.nodes.find((n) => n.anchor.id === tooltipState.anchorId) ?? null;
  }, [tooltipState, layout.nodes]);

  const isEmpty = layout.nodes.length === 0;
  const heroWidth = heroRef.current?.clientWidth ?? 0;
  const heroHeight = heroRef.current?.clientHeight ?? 0;

  const daysInBlossom = tooltipNode?.blossomSinceDate
    ? Math.max(0, Math.floor((Date.now() - new Date(tooltipNode.blossomSinceDate).getTime()) / 86400000))
    : 0;
  const reviewedCount = tooltipNode?.qaChildren.filter((q) => (q.reviewSchedule?.reviewCount ?? 0) > 0).length ?? 0;
  const overdueCount = tooltipNode
    ? tooltipNode.qaChildren.filter((q) => {
        const nrd = q.reviewSchedule?.nextReviewDate;
        if (!nrd) return false;
        const [y, m, d] = nrd.split('-').map(Number);
        return new Date(y, (m ?? 1) - 1, d ?? 1).getTime() < Date.now();
      }).length
    : 0;

  return (
    <div
      ref={heroRef}
      aria-label="Knowledge garden — your review health visualization"
      style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(200px, 50vw, 250px)',
        marginBottom: 24,
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface)',
        isolation: 'isolate',
      }}
    >
      {/* Background layer per variant */}
      {variant === 'A' && <TrellisBackgroundA />}
      {variant === 'C' && <TrellisBackgroundC />}
      {/* Variant V plugs in via 25-04 */}

      {/* SVG canvas (vines + leaves) */}
      {!isEmpty && <TrellisCanvas layout={layout} onLeafTap={handleLeafTap} heroRef={heroRef} />}

      {/* Empty state overlay */}
      {isEmpty && <TrellisEmptyState />}

      {/* Tooltip */}
      {tooltipState && tooltipNode && (
        <TrellisTooltip
          anchorId={tooltipNode.anchor.id}
          anchorName={tooltipNode.anchor.title ?? tooltipNode.anchor.content ?? 'Anchor'}
          state={tooltipNode.leafState}
          qaCount={tooltipNode.qaChildren.length}
          reviewedCount={reviewedCount}
          overdueCount={overdueCount}
          daysInBlossom={daysInBlossom}
          x={tooltipState.x}
          y={tooltipState.y}
          heroWidth={heroWidth}
          heroHeight={heroHeight}
          onClose={handleClose}
        />
      )}

      {/* Dev-only variant picker */}
      <TrellisVariantPicker variant={variant} onChange={setVariant} />
    </div>
  );
}
