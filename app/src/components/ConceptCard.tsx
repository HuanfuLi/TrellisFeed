import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/Card';
import { Markdown } from './Markdown';
import type { Question } from '../types';

interface ConceptCardProps {
  question: Question;
  onClick: () => void;
  /** Secondary line below the title, e.g. "3 Q&As" */
  subtitle?: string;
  /** Optional badge shown top-right, e.g. { label: 'Weak', color: '#ef4444' } */
  badge?: { label: string; color: string };
}

export function ConceptCard({ question, onClick, subtitle, badge }: ConceptCardProps) {
  const { t } = useTranslation();
  const summarySource = question.nodeSummary || question.summary || '';
  const summaryPreview = (() => {
    const first =
      summarySource
        .split(/\n(?=\[)/)[0]
        ?.replace(/^\[.*?\]\s*/, '')
        .split(/\n\n/)[0]
        ?.trim() || '';
    return first.length > 120 ? first.slice(0, 117) + '...' : first;
  })();

  return (
    <Card
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onPointerEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.01)';
        e.currentTarget.style.boxShadow = 'var(--shadow-2)';
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--foreground)', flex: 1, minWidth: 0 }}>
          {question.title || question.content}
        </p>
        {badge && (
          <span
            style={{
              flexShrink: 0,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: badge.color,
              backgroundColor: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
              padding: '2px 8px',
              borderRadius: '100px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {badge.label}
          </span>
        )}
      </div>
      {subtitle && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
          {subtitle}
        </p>
      )}
      {summaryPreview && (
        <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
          <Markdown>{summaryPreview}</Markdown>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.72rem',
            color: 'var(--primary-40)',
            fontWeight: 600,
          }}
        >
          <span>{t('conceptCard.viewDetails')}</span>
          <ChevronRight size={12} />
        </div>
      </div>
    </Card>
  );
}
