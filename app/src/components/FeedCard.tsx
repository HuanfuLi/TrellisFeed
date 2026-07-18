import { Clock, FileText, Newspaper, PlayCircle } from 'lucide-react';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Post, Recommendation } from '../domain/content.types';
import { interactionLog } from '../services/interaction-log.service';

export interface FeedCardProps {
  post: Readonly<Post>;
  recommendation: Readonly<Recommendation>;
  conceptLabels: readonly string[];
  onOpen: (postId: string) => void;
}

type ReasonViewRecorder = (
  eventType: 'recommendation_reason_view',
  fields: { postId: string; recommendationId: string },
) => Promise<unknown>;

export function recordRecommendationReasonView(
  recommendation: Pick<Recommendation, 'id' | 'postId'>,
  record: ReasonViewRecorder = interactionLog.record,
): Promise<unknown> {
  return record('recommendation_reason_view', {
    postId: recommendation.postId,
    recommendationId: recommendation.id,
  });
}

function SourceIcon({ platform }: { platform: Post['sourcePlatform'] }) {
  if (platform === 'youtube') return <PlayCircle aria-hidden="true" size={18} />;
  if (platform === 'news') return <Newspaper aria-hidden="true" size={18} />;
  return <FileText aria-hidden="true" size={18} />;
}

export function FeedCard({ post, recommendation, conceptLabels, onOpen }: FeedCardProps) {
  const { t } = useTranslation();
  const [reasonExpanded, setReasonExpanded] = useState(false);
  const activate = () => onOpen(post.id);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };
  const duration = post.sourcePlatform === 'youtube' && post.durationSeconds
    ? `${Math.max(1, Math.ceil(post.durationSeconds / 60))} min`
    : post.readingTimeMinutes
      ? `${post.readingTimeMinutes} min`
      : null;
  const handleReasonToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!reasonExpanded) {
      void recordRecommendationReasonView(recommendation).catch(() => { /* observational */ });
    }
    setReasonExpanded((expanded) => !expanded);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={post.displayTitle}
      onClick={activate}
      onKeyDown={handleKeyDown}
      style={{
        minHeight: '44px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        background: 'var(--secondary)',
        boxShadow: 'var(--shadow-1)',
        color: 'var(--foreground)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-foreground)', fontSize: '14px', lineHeight: 1.5 }}>
        <SourceIcon platform={post.sourcePlatform} />
        <span>{post.sourceName}</span>
        <span aria-hidden="true">·</span>
        <span>{post.sourcePlatform}</span>
      </div>

      <div>
        <h2 style={{ margin: 0, fontSize: '20px', lineHeight: 1.2, fontWeight: 600 }}>{post.displayTitle}</h2>
        {post.hook !== post.displayTitle && (
          <p style={{ margin: '8px 0 0', fontSize: '16px', lineHeight: 1.5, fontWeight: 600 }}>{post.hook}</p>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
        {post.shortSummary}
      </p>

      {conceptLabels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {conceptLabels.map((label) => (
            <span key={label} style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px', lineHeight: 1.5 }}>
              {label}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-expanded={reasonExpanded}
        onClick={handleReasonToggle}
        onKeyDown={(event) => event.stopPropagation()}
        style={{
          minHeight: '44px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          background: 'var(--surface-variant)',
          color: 'var(--foreground)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--muted-foreground)', fontSize: '14px', lineHeight: 1.5, fontWeight: 600 }}>
          {t('feed.reason.toggleLabel')}
        </span>
        <span
          style={reasonExpanded ? {
            fontSize: '14px',
            lineHeight: 1.5,
          } : {
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          {recommendation.reasonText}
        </span>
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', color: 'var(--muted-foreground)', fontSize: '14px', lineHeight: 1.5 }}>
        {duration && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock aria-hidden="true" size={16} />{duration}</span>}
        <span>Difficulty {post.difficulty}</span>
        {post.viewpoint && <span>Viewpoint: {post.viewpoint}</span>}
      </div>
    </div>
  );
}
