import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { ProgressBar } from './ui/ProgressBar';
import { HEADER_HEIGHT } from './ui/Header';

interface ConceptProgressCardProps {
  explored: number;
  total: number;
  isComplete: boolean;
}

export function ConceptProgressCard({ explored, total, isComplete }: ConceptProgressCardProps) {
  const { t } = useTranslation();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const placeholder = placeholderRef.current;
    if (!placeholder) return;

    const scrollParent = placeholder.closest('[data-home-scroll]') as HTMLElement | null;
    if (!scrollParent) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = placeholder.getBoundingClientRect();
        setIsCompact(rect.top <= HEADER_HEIGHT);
        ticking = false;
      });
    };

    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', onScroll);
  }, []);

  if (total === 0) return null;

  const progressPercent = total > 0 ? Math.round((explored / total) * 100) : 0;
  const barColor = isComplete ? '#E8A838' : 'var(--primary-40)';
  const cardBg = isComplete
    ? 'color-mix(in srgb, #E8A838 8%, var(--card))'
    : 'var(--card)';

  return (
    <>
      {/* Placeholder keeps space in flow when card goes fixed */}
      <div ref={placeholderRef} style={{ minHeight: isCompact ? '100px' : 0 }} />
      <div
        style={isCompact ? {
          position: 'fixed',
          top: `calc(var(--safe-area-top) + ${HEADER_HEIGHT}px)`,
          left: 0,
          right: 0,
          zIndex: 180,
          backgroundColor: cardBg,
          borderRadius: 0,
          boxShadow: 'var(--shadow-2)',
          padding: '8px 16px',
          transition: 'all 200ms ease',
        } : {
          position: 'relative',
          zIndex: 1,
          backgroundColor: cardBg,
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-1)',
          padding: '16px',
          transition: 'all 200ms ease',
        }}
      >
        {isCompact ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '448px', margin: '0 auto' }}>
            <BookOpen size={16} color={barColor} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
              {isComplete
                ? t('home.feed.complete')
                : t('home.feed.progressCompact', { explored, total })}
            </span>
            <ProgressBar
              value={progressPercent}
              color={barColor}
              height={6}
              style={{ flex: 1, marginLeft: '4px' }}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color={barColor} />
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                {t('home.feed.title')}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted-foreground)', marginTop: '4px' }}>
              {isComplete
                ? t('home.feed.complete')
                : t('home.feed.progress', { explored, total })}
            </p>
            <ProgressBar
              value={progressPercent}
              color={barColor}
              height={8}
              style={{ marginTop: '8px' }}
            />
          </>
        )}
      </div>
    </>
  );
}
