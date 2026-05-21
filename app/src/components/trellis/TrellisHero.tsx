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

  // Phase 55.1 GAP-B (BUGFIX-05) — render-layer animation gate. When the Planner
  // is NOT the active route, the always-mounted PlannerScreen's trellis leaves
  // must do ZERO per-frame framer-motion work so they stop starving the
  // compositor during Home↔Planner↔Ask swipes and Home feed scroll. The route
  // check is the dominant lever; nodeCount is forwarded for call-site composition
  // with the existing leafAnimationMask. Re-reads on every render so the gate
  // tracks navigation (PlannerScreen is an always-mounted SwipeTabContainer slot).
  const animationsEnabled = shouldAnimateTrellis({
    isPlannerActive,
    nodeCount: layout.nodes.length,
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
