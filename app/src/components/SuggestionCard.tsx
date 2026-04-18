import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronRight } from 'lucide-react';

interface SuggestionCardProps {
  topics: string[];
}

export function SuggestionCard({ topics }: SuggestionCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleTopicTap = (topic: string) => {
    navigate('/ask', { state: { autoSend: topic } });
  };

  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-1)',
        padding: '16px',
        minHeight: '280px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <Sparkles size={16} style={{ color: 'var(--primary-40)' }} />
        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--foreground)',
        }}>
          {t('home.feed.suggestionTitle')}
        </span>
      </div>

      {/* Topic buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
      }}>
        {topics.map((topic, i) => (
          <button
            key={i}
            aria-label={topic}
            onClick={() => handleTopicTap(topic)}
            style={{
              width: '100%',
              minHeight: '48px',
              background: 'var(--surface-variant)',
              borderRadius: 'var(--radius)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              textAlign: 'left',
            }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: 400,
              color: 'var(--foreground)',
              flex: 1,
            }}>
              {topic}
            </span>
            <ChevronRight size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
