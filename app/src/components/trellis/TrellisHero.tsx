import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTrellisData } from '../../state/useTrellisData.ts';
import { TrellisCanvas } from './TrellisCanvas.tsx';
import { TrellisEmptyState } from './TrellisEmptyState.tsx';
import { TrellisBackgroundA } from './variants/TrellisBackgroundA.tsx';

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
          ambientEnabled={isPlannerActive}
          focusedAnchorId={focusedAnchorId}
        />
      )}

      {/* Empty state overlay */}
      {isEmpty && <TrellisEmptyState />}
    </div>
  );
}
