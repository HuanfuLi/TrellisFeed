import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTrellisData } from '../../state/useTrellisData.ts';
import { TrellisCanvas } from './TrellisCanvas.tsx';
import { TrellisEmptyState } from './TrellisEmptyState.tsx';
import { TrellisBackgroundA } from './variants/TrellisBackgroundA.tsx';
import { shouldAnimateTrellis } from '../../services/trellis-animation-gate.ts';

export interface TrellisHeroProps {
  /**
   * Phase 28 D-12 — anchor id currently pulsing (from Suggested Moves row
   * pointerdown). Forwarded to TrellisCanvas → TrellisLeaf.
   */
  focusedAnchorId?: string | null;
}

export function TrellisHero({ focusedAnchorId }: TrellisHeroProps = {}) {
  const { t } = useTranslation();
  const { layout } = useTrellisData();
  const location = useLocation();
  const isPlannerActive = location.pathname === '/planner' || location.pathname.startsWith('/planner/');
  const hasBeenActiveRef = useRef(false);
  const [firstVisitComplete, setFirstVisitComplete] = useState(false);

  // The Planner slot stays mounted for the life of the app. Allow a small,
  // normal trellis to animate on its first visit, then freeze the render mode
  // after the user leaves. Without this lifecycle latch, every route change
  // flips intrinsic SVG ↔ Framer Motion component types, replacing the entire
  // tree and replaying all entrance animations on the next Planner visit.
  useEffect(() => {
    if (isPlannerActive) {
      hasBeenActiveRef.current = true;
      return;
    }
    if (hasBeenActiveRef.current && !firstVisitComplete) {
      setFirstVisitComplete(true);
    }
  }, [firstVisitComplete, isPlannerActive]);

  const isDevLayout = layout.nodes.some((node) => node.anchor.id.startsWith('dev-'));

  // Phase 55.1 GAP-B (BUGFIX-05) — render-layer animation gate. When the Planner
  // is NOT the active route, the always-mounted PlannerScreen's trellis leaves
  // must do ZERO per-frame framer-motion work so they stop starving the
  // compositor during Home↔Planner↔Ask swipes and Home feed scroll. The route
  // check is the dominant lever. Dev/large layouts stay plain SVG even while
  // active; small normal layouts animate only until their first visit ends.
  const animationsEnabled = shouldAnimateTrellis({
    isPlannerActive,
    devMode: isDevLayout,
    nodeCount: layout.nodes.length,
    firstVisitComplete,
  });

  const isEmpty = layout.nodes.length === 0;

  return (
    <div
      aria-label={t('planner.trellis.ariaLabel')}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        marginBottom: 24,
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface)',
        isolation: 'isolate',
      }}
    >
      <TrellisBackgroundA />

      {/* SVG canvas (vines + leaves) */}
      {!isEmpty && (
        <TrellisCanvas
          layout={layout}
          ambientEnabled={animationsEnabled}
          animationsEnabled={animationsEnabled}
          focusedAnchorId={focusedAnchorId}
        />
      )}

      {/* Empty state overlay */}
      {isEmpty && <TrellisEmptyState />}
    </div>
  );
}
