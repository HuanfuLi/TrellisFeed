/**
 * PullUpHint
 *
 * Pull-to-load affordance at the bottom of the feed.
 *
 * States:
 *  - Idle (pullDistance = 0, not loading): shows "Pull up to load more" at 80px height
 *  - Pulling (pullDistance > 0): elastically stretches with the finger
 *      - below threshold: arrow points up, "Pull up to load more"
 *      - at/past threshold: arrow flips down, "Release to load" in primary colour
 *  - Loading: spinner + "Loading more posts..."
 *
 * Snap-back is handled via CSS transition on height when pullDistance returns to 0.
 */

import { ArrowUp, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const PULL_THRESHOLD = 100;

interface PullUpHintProps {
  isLoading?: boolean;
  /** Raw overscroll distance in px driven by touch handlers in the parent. */
  pullDistance?: number;
}

export function PullUpHint({ isLoading = false, pullDistance = 0 }: PullUpHintProps) {
  const { t } = useTranslation();
  const isPastThreshold = pullDistance >= PULL_THRESHOLD;

  // Elastic rubber-band: 40% ratio, capped at 60px expansion so it never feels infinite
  const elasticPx = pullDistance > 0 ? Math.min(pullDistance * 0.4, 60) : 0;
  const totalHeight = 80 + elasticPx;

  return (
    <div
      style={{
        height: `${totalHeight}px`,
        // Smooth snap-back only when finger has lifted (pullDistance === 0)
        transition: pullDistance === 0 ? 'height 0.3s ease' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.875rem',
        color: isPastThreshold && !isLoading ? 'var(--primary-40)' : 'var(--muted-foreground)',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      aria-live="polite"
      aria-label={isLoading ? t('pullUpHint.loadingAria') : t('pullUpHint.pullToLoadAria')}
    >
      {isLoading ? (
        <>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <span>{t('pullUpHint.loading')}</span>
        </>
      ) : (
        <>
          <ArrowUp
            size={18}
            style={{
              flexShrink: 0,
              transform: `rotate(${isPastThreshold ? 180 : 0}deg) scale(${isPastThreshold ? 1.2 : 1})`,
              transition: 'transform 0.2s ease',
            }}
          />
          <span>{isPastThreshold ? t('pullUpHint.releaseToLoad') : t('pullUpHint.pullToLoad')}</span>
        </>
      )}
    </div>
  );
}
