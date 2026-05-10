import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

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
        minHeight: '36px',
        background: pressed ? 'var(--surface)' : 'var(--surface-variant)',
        borderRadius: '6px',
        border: `1px solid ${pressed ? 'var(--primary-40)' : 'transparent'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px',
        textAlign: 'left',
        transition: 'background 150ms ease, border-color 150ms ease, transform 150ms ease',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
      }}
    >
      <span style={{
        fontSize: '11px',
        fontWeight: 400,
        lineHeight: 1.3,
        color: 'var(--foreground)',
        flex: 1,
      }}>
        {topic}
      </span>
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
  const displayTopics = topics.slice(0, 4);

  return (
    <div
      style={{
        // Match regular concept-post card styling so suggestion cards don't stand out
        // with a weaker shadow / flat background (operator-reported 2026-04-19).
        // Mirror of InfoFlow.tsx ConceptCard button styles (background + border + shadow).
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--primary-80) 20%, var(--surface-container-high)), var(--surface-container-high))',
        border: '1.5px solid color-mix(in srgb, var(--primary-40) 22%, var(--border))',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-2)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginBottom: '6px',
      }}>
        <Sparkles size={11} style={{ color: 'var(--primary-40)' }} />
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--muted-foreground)',
        }}>
          {t('home.feed.suggestionTitle')}
        </span>
      </div>

      {/* Topic buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {displayTopics.map(topic => (
          <TopicButton key={topic} topic={topic} onTap={handleTopicTap} />
        ))}
      </div>
    </div>
  );
}
