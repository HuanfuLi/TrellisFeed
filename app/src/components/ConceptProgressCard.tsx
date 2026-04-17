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
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const scrollParent = card.closest('[data-home-scroll]') as HTMLElement | null;
    if (!scrollParent) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const headerBottom = HEADER_HEIGHT;
        setIsCompact(rect.top <= headerBottom + 2);
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
    <div
      ref={cardRef}
      style={{
        position: 'sticky',
        top: `${HEADER_HEIGHT}px`,
        zIndex: 100,
        backgroundColor: cardBg,
        borderRadius: isCompact ? 0 : 'var(--radius)',
        boxShadow: isCompact ? 'var(--shadow-2)' : 'var(--shadow-1)',
        padding: isCompact ? '8px 16px' : '16px',
        marginLeft: isCompact ? '-16px' : 0,
        marginRight: isCompact ? '-16px' : 0,
        transition: 'all 200ms ease',
      }}
    >
      {isCompact ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
  );
}
