import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopFABProps {
  scrollRef: React.RefObject<HTMLElement | null>;
}

export function ScrollToTopFAB({ scrollRef }: ScrollToTopFABProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setVisible(el.scrollTop > 400);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

  return (
    <button
      aria-label={t('home.feed.scrollToTop')}
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed',
        bottom: 'calc(96px + var(--safe-area-bottom))',
        right: '16px',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'var(--card)',
        boxShadow: 'var(--shadow-2)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.6)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 200ms ease, transform 200ms ease',
        zIndex: 40,
      }}
    >
      <ArrowUp size={20} style={{ color: 'var(--primary-40)' }} />
    </button>
  );
}
