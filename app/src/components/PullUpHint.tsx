/**
 * PullUpHint
 *
 * Pull-to-load affordance at the bottom of the feed. Fixed 80px height — the
 * elastic rubber-band lives on the parent feed container's transform, not here.
 * This component just renders state (icon + text + threshold colour).
 */

import { ArrowUp, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const PULL_THRESHOLD = 100;

interface PullUpHintProps {
  isLoading?: boolean;
  /** Raw overscroll distance in px — used only for threshold colour/arrow flip. */
  pullDistance?: number;
}

export function PullUpHint({ isLoading = false, pullDistance = 0 }: PullUpHintProps) {
  const { t } = useTranslation();
  const isPastThreshold = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      style={{
        height: '80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.875rem',
        color: isPastThreshold && !isLoading ? 'var(--primary-40)' : 'var(--muted-foreground)',
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
