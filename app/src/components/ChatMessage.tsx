import { Markdown } from './Markdown';

export type MessageType = 'user' | 'ai';

interface ChatMessageProps {
  type: MessageType;
  content: string;
  relatedKnowledge?: string[];
  onKnowledgeClick?: (knowledge: string) => void;
}

export function ChatMessage({ type, content, relatedKnowledge, onKnowledgeClick }: ChatMessageProps) {
  if (type === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div
          style={{
            maxWidth: '80%',
            padding: '12px 20px',
            color: 'white',
            backgroundColor: 'var(--primary-40)',
            borderRadius: '24px 24px 4px 24px',
            lineHeight: 1.6,
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
      <div style={{ maxWidth: '85%' }}>
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: '24px',
            lineHeight: 1.6,
            color: 'var(--foreground)',
          }}
        >
          <Markdown>{content}</Markdown>
          {relatedKnowledge && relatedKnowledge.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {relatedKnowledge.map((knowledge, index) => (
                <button
                  key={index}
                  onClick={() => onKnowledgeClick?.(knowledge)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'white',
                    backgroundColor: index % 2 === 0 ? 'var(--accent-coral)' : 'var(--accent-lavender)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {knowledge}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
