import { useState } from 'react';
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
}

export function Flashcard({ front, back, onRate, pinned, onTogglePin }: FlashcardProps) {
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

  return (
    <div style={{ maxWidth: '448px', margin: '0 auto', padding: '0 16px' }}>
      {/* Card face */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'var(--card)',
          padding: '20px',
          paddingTop: '16px',
          marginBottom: '24px',
          minHeight: '280px',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-2)',
        }}
      >
        {/* Pin button — top-right corner */}
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
            }}
          >
            <Pin size={15} fill={pinned ? 'currentColor' : 'none'} />
          </button>
        )}

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 4px', display: 'flex', flexDirection: 'column' }}>
          {!isFlipped ? (
            <div style={{ margin: 'auto 0' }}>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted-foreground)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                }}
              >
                {t('flashcard.question')}
              </p>
              <div className="md-prose" style={{ fontSize: '1.25rem', lineHeight: 1.6, textAlign: 'center' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{front}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div key="answer" style={{ margin: 'auto 0', animation: 'flashcard-face-in 0.25s ease' }}>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted-foreground)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                }}
              >
                {t('flashcard.answer')}
              </p>
              <div className="md-prose" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{back}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isFlipped ? (
        <button
          onClick={() => setIsFlipped(true)}
          style={{
            width: '100%',
            padding: '16px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--primary-40)',
            color: 'white',
            fontWeight: 500,
            transition: 'transform 0.2s',
          }}
          onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {t('flashcard.showAnswer')}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.75rem',
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
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
                    backgroundColor: rating.color,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '1.125rem',
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
