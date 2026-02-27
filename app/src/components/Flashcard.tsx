import { useState } from 'react';
import { Pin } from 'lucide-react';

interface FlashcardProps {
  front: string;
  back: string;
  onRate?: (rating: number) => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}

const ratingConfig = [
  { value: 1, label: '1', color: '#E53935', description: 'Again' },
  { value: 2, label: '2', color: '#FF8A65', description: 'Hard' },
  { value: 3, label: '3', color: '#FFD54F', description: 'Good' },
  { value: 4, label: '4', color: '#9CCC65', description: 'Easy' },
  { value: 5, label: '5', color: '#558B2F', description: 'Perfect' },
];

export function Flashcard({ front, back, onRate, pinned, onTogglePin }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleRate = (rating: number) => {
    onRate?.(rating);
    setIsFlipped(false);
  };

  return (
    <div style={{ maxWidth: '448px', margin: '0 auto', padding: '0 16px' }}>
      {/* Card face */}
      <div
        style={{
          position: 'relative',
          backgroundColor: 'white',
          padding: '32px',
          marginBottom: '24px',
          minHeight: '280px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-2)',
        }}
      >
        {/* Pin button — top-right corner */}
        {onTogglePin && (
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            title={pinned ? 'Unpin card' : 'Pin card (review every day)'}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
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

        <div style={{ textAlign: 'center', width: '100%' }}>
          {!isFlipped ? (
            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted-foreground)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Question
              </p>
              <h2 style={{ fontSize: '1.5rem', lineHeight: 1.5 }}>{front}</h2>
            </div>
          ) : (
            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted-foreground)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Answer
              </p>
              <p style={{ fontSize: '1.25rem', lineHeight: 1.6 }}>{back}</p>
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
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Show Answer
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
            How well did you know this?
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
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
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
