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

const COMPACT_HEIGHT = 38;

export function ConceptProgressCard({ explored, total, isComplete }: ConceptProgressCardProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const card = cardRef.current;
    if (!wrapper || !card) return;

    if (!isCompact && card.offsetHeight > 0) {
      setExpandedHeight(card.offsetHeight);
    }

    const scrollParent = wrapper.closest('[data-home-scroll]') as HTMLElement | null;
    if (!scrollParent) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = wrapper.getBoundingClientRect();
        setIsCompact(rect.top <= HEADER_HEIGHT);
        ticking = false;
      });
    };

    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', onScroll);
  }, [isCompact]);

  if (total === 0) return null;

  const progressPercent = total > 0 ? Math.round((explored / total) * 100) : 0;
  const barColor = isComplete ? '#E8A838' : 'var(--primary-40)';
  const cardBg = isComplete
    ? 'color-mix(in srgb, #E8A838 8%, var(--card))'
    : 'var(--card)';

  return (
    <div
      ref={wrapperRef}
      style={{
        marginTop: '16px',
        marginBottom: '16px',
        minHeight: isCompact && expandedHeight > 0 ? `${expandedHeight}px` : undefined,
      }}
    >
      <div
        ref={cardRef}
        style={{
          position: isCompact ? 'fixed' : 'relative',
          top: isCompact ? `calc(var(--safe-area-top) + ${HEADER_HEIGHT}px)` : undefined,
          left: isCompact ? 0 : undefined,
          right: isCompact ? 0 : undefined,
          zIndex: isCompact ? 180 : 1,
          backgroundColor: cardBg,
          borderRadius: isCompact ? 0 : 'var(--radius)',
          boxShadow: isCompact ? 'var(--shadow-2)' : 'var(--shadow-1)',
          padding: isCompact ? '10px 16px' : '16px',
          transition: 'padding 400ms ease, border-radius 400ms ease, box-shadow 400ms ease',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: isCompact ? '448px' : undefined,
          margin: isCompact ? '0 auto' : undefined,
        }}>
          <BookOpen
            size={isCompact ? 16 : 20}
            color={barColor}
            style={{ transition: 'width 400ms ease, height 400ms ease', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {!isCompact && (
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', display: 'block' }}>
                {t('home.feed.title')}
              </span>
            )}
            <span style={{
              fontSize: '0.875rem',
              fontWeight: isCompact ? 600 : 400,
              color: isCompact ? 'var(--foreground)' : 'var(--muted-foreground)',
              display: 'block',
              marginTop: isCompact ? 0 : '2px',
              whiteSpace: isCompact ? 'nowrap' : undefined,
            }}>
              {isComplete
                ? t('home.feed.complete')
                : isCompact
                  ? t('home.feed.progressCompact', { explored, total })
                  : t('home.feed.progress', { explored, total })}
            </span>
          </div>
          {isCompact && (
            <ProgressBar
              value={progressPercent}
              color={barColor}
              height={6}
              style={{ flex: 1, minWidth: '80px' }}
            />
          )}
        </div>
        {!isCompact && (
          <ProgressBar
            value={progressPercent}
            color={barColor}
            height={8}
            style={{ marginTop: '8px' }}
          />
        )}
      </div>
    </div>
  );
}
