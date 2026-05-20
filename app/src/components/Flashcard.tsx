import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hapticImpactLight } from '../lib/haptics';

interface FlashcardProps {
  front: string;
  back: string;
  onRate?: (rating: number) => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  /** Optional badge rendered inside the card's top-left corner (balances the
   *  top-right pin button). Used by ReviewScreen for the days-overdue pill. */
  badge?: ReactNode;
}

export function Flashcard({ front, back, onRate, pinned, onTogglePin, badge }: FlashcardProps) {
  const { t } = useTranslation();
  const [isFlipped, setIsFlipped] = useState(false);

  const ratingConfig = [
    { value: 1, label: '1', color: 'var(--danger)', description: t('flashcard.rating.again') },
    { value: 2, label: '2', color: '#FF8A65', description: t('flashcard.rating.hard') },
    { value: 3, label: '3', color: '#FFD54F', description: t('flashcard.rating.good') },
    { value: 4, label: '4', color: '#9CCC65', description: t('flashcard.rating.easy') },
    { value: 5, label: '5', color: '#558B2F', description: t('flashcard.rating.perfect') },
  ];

  const handleRate = (rating: number) => {
    void hapticImpactLight();
    onRate?.(rating);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    void hapticImpactLight();
    setIsFlipped(true);
  };

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    paddingTop: '16px',
    overflowY: 'auto',
  };

  return (
    <div key={front} style={{ maxWidth: '448px', margin: '0 auto', padding: '0 16px', animation: 'flashcard-next 0.3s ease' }}>
      {/* 3D flip card — Quizlet-style full-card rotation */}
      <div
        onClick={!isFlipped ? handleFlip : undefined}
        style={{
          perspective: '800px',
          marginBottom: '24px',
          minHeight: '280px',
          maxHeight: '60vh',
          cursor: !isFlipped ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: '280px',
            maxHeight: '60vh',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front face — Question */}
          <div
            style={{
              ...faceStyle,
              backgroundColor: 'var(--card)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-2)',
            }}
          >
            {badge && (
              <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 1 }}>
                {badge}
              </div>
            )}
            {onTogglePin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                title={pinned ? t('flashcard.unpinTitle') : t('flashcard.pinTitle')}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: pinned ? 'var(--primary-40)' : 'transparent',
                  color: pinned ? 'white' : 'var(--muted-foreground)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1.5px solid ${pinned ? 'var(--primary-40)' : 'var(--surface-variant)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  zIndex: 1,
                }}
              >
                <Pin size={15} fill={pinned ? 'currentColor' : 'none'} />
              </button>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4px' }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--muted-foreground)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: 'center',
              }}>
                {t('flashcard.question')}
              </p>
              <div className="md-prose" style={{ fontSize: '1.25rem', lineHeight: 1.6, textAlign: 'center' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{front}</ReactMarkdown>
              </div>
              <p style={{
                fontSize: '0.7rem',
                color: 'var(--muted-foreground)',
                textAlign: 'center',
                marginTop: '20px',
                opacity: 0.6,
              }}>
                {t('flashcard.tapToFlip')}
              </p>
            </div>
          </div>

          {/* Back face — Answer */}
          <div
            style={{
              ...faceStyle,
              backgroundColor: 'var(--card)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-2)',
              transform: 'rotateY(180deg)',
            }}
          >
            {badge && (
              <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 1 }}>
                {badge}
              </div>
            )}
            {onTogglePin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                title={pinned ? t('flashcard.unpinTitle') : t('flashcard.pinTitle')}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: pinned ? 'var(--primary-40)' : 'transparent',
                  color: pinned ? 'white' : 'var(--muted-foreground)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1.5px solid ${pinned ? 'var(--primary-40)' : 'var(--surface-variant)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  zIndex: 1,
                }}
              >
                <Pin size={15} fill={pinned ? 'currentColor' : 'none'} />
              </button>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4px' }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--muted-foreground)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: 'center',
              }}>
                {t('flashcard.answer')}
              </p>
              <div className="md-prose" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{back}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls below the card */}
      {!isFlipped ? (
        <button
          onClick={handleFlip}
          style={{
            width: '100%',
            padding: '16px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            backgroundColor: 'var(--primary-40)',
            color: 'white',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {t('flashcard.showAnswer')}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {t('flashcard.selfRatePrompt')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            {ratingConfig.map((rating) => (
              <div key={rating.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => handleRate(rating.value)}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: rating.color,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '1.125rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'transform 0.2s',
                  }}
                  onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {rating.label}
                </button>
                <span style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--muted-foreground)' }}>
                  {rating.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
