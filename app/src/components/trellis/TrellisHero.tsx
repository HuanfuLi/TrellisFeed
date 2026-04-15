import { useLocation } from 'react-router-dom';
import { useTrellisData } from '../../state/useTrellisData.ts';
import { TrellisCanvas } from './TrellisCanvas.tsx';
import { TrellisEmptyState } from './TrellisEmptyState.tsx';
import { TrellisBackgroundA } from './variants/TrellisBackgroundA.tsx';

export function TrellisHero() {
  const { layout } = useTrellisData();
  const location = useLocation();
  const isPlannerActive = location.pathname === '/planner' || location.pathname.startsWith('/planner/');

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
      <TrellisBackgroundA />

      {/* SVG canvas (vines + leaves) */}
      {!isEmpty && <TrellisCanvas layout={layout} ambientEnabled={isPlannerActive} />}

      {/* Empty state overlay */}
      {isEmpty && <TrellisEmptyState />}
    </div>
  );
}
