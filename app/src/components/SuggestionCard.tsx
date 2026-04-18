import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronRight } from 'lucide-react';

function TopicButton({ topic, onTap }: { topic: string; onTap: (t: string) => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      aria-label={topic}
      onClick={() => onTap(topic)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: '100%',
        minHeight: '48px',
        background: pressed ? 'var(--surface)' : 'var(--surface-variant)',
        borderRadius: 'var(--radius)',
        border: `1px solid ${pressed ? 'var(--primary-40)' : 'transparent'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        textAlign: 'left',
        transition: 'background 150ms ease, border-color 150ms ease, transform 150ms ease',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
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
  );
}

interface SuggestionCardProps {
  topics: string[];
}

export function SuggestionCard({ topics }: SuggestionCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleTopicTap = (topic: string) => {
    navigate('/ask', { state: { autoSend: topic } });
  };

  if (!topics.length) return null;
  const displayTopics = topics.slice(0, 3);

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
        {displayTopics.map(topic => (
          <TopicButton key={topic} topic={topic} onTap={handleTopicTap} />
        ))}
      </div>
    </div>
  );
}
