import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTrellisData } from '../../state/useTrellisData.ts';
import { TrellisCanvas } from './TrellisCanvas.tsx';
import { TrellisEmptyState } from './TrellisEmptyState.tsx';
import { TrellisVariantPicker } from './TrellisVariantPicker.tsx';
import { TrellisBackgroundA } from './variants/TrellisBackgroundA.tsx';
import { TrellisBackgroundC } from './variants/TrellisBackgroundC.tsx';
import type { TrellisVariant } from './types.ts';

const VARIANT_KEY = 'trellis_variant_dev';

function readInitialVariant(): TrellisVariant {
  if (typeof localStorage === 'undefined') return 'C';
  const stored = localStorage.getItem(VARIANT_KEY);
  if (stored === 'A' || stored === 'C') return stored;
  return 'C';
}

export function TrellisHero() {
  const { layout } = useTrellisData();
  const location = useLocation();
  const isPlannerActive = location.pathname === '/planner' || location.pathname.startsWith('/planner/');
  const [variant, setVariant] = useState<TrellisVariant>(readInitialVariant);

  const isEmpty = layout.nodes.length === 0;

  return (
    <div
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

      {/* SVG canvas (vines + leaves) */}
      {!isEmpty && <TrellisCanvas layout={layout} ambientEnabled={isPlannerActive} />}

      {/* Empty state overlay */}
      {isEmpty && <TrellisEmptyState />}

      {/* Dev-only variant picker */}
      <TrellisVariantPicker variant={variant} onChange={setVariant} />
    </div>
  );
}
