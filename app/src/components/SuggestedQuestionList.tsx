import type { SuggestedQuestion } from '../domain/content.types';

export interface SuggestedQuestionListProps {
  suggestions: readonly Readonly<SuggestedQuestion>[];
  heading: string;
  disabled?: boolean;
  onSelect: (suggestion: Readonly<SuggestedQuestion>) => void;
}

export function SuggestedQuestionList({ suggestions, heading, disabled = false, onSelect }: SuggestedQuestionListProps) {
  if (suggestions.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, fontWeight: 600 }}>{heading}</h3>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          disabled={disabled}
          data-question-type={suggestion.type}
          data-target-concept-ids={suggestion.targetConceptIds.join(',')}
          data-target-claim-ids={(suggestion.targetClaimIds ?? []).join(',')}
          data-generic={suggestion.generic ? 'true' : 'false'}
          onClick={() => onSelect(suggestion)}
          style={{
            minHeight: '44px', width: '100%', padding: '8px 16px',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--foreground)',
            fontSize: '16px', lineHeight: 1.5, textAlign: 'left',
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
          }}
        >
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}
