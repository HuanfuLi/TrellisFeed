import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { postHistoryService } from '../services/post-history.service';
import type { DailyPost } from '../types';
import { today } from '../lib/date';

function HistoryPostCard({ post, index }: { post: DailyPost; index: number }) {
  const navigate = useNavigate();
  const [pressed, setPressed] = useState(false);

  const thumb = post.videoMeta?.thumbnailUrl ?? post.newsMeta?.imageUrl ?? null;
  const emoji = post.presentationStyle === 'text-art' ? '\u270E' : '\uD83D\uDCC4';

  return (
    <button
      onClick={() => navigate(`/posts/${post.id}`)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: pressed ? 'var(--surface-variant)' : 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-1)',
        padding: '12px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background 150ms ease, transform 150ms ease',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        opacity: 0,
        animation: `history-card-in 300ms ease ${index * 40}ms forwards`,
      }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{
            width: '52px', height: '52px',
            borderRadius: '8px', objectFit: 'cover', flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: '52px', height: '52px', borderRadius: '8px',
          background: 'var(--surface-variant)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px',
        }}>
          {emoji}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px', fontWeight: 500,
          color: 'var(--foreground)',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.4,
        }}>
          {post.title}
        </div>
        {post.contextLabel && (
          <div style={{
            fontSize: '12px', color: 'var(--muted-foreground)',
            marginTop: '3px',
          }}>
            {post.contextLabel}
          </div>
        )}
      </div>
    </button>
  );
}

export default function PostHistoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Map<string, DailyPost[]>>(new Map());
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setGroups(postHistoryService.getPostsByDay());
    } catch {
      setError(true);
    }
  }, []);

  const reload = () => {
    setError(false);
    try {
      setGroups(postHistoryService.getPostsByDay());
    } catch {
      setError(true);
    }
  };

  const formatDayHeading = (dateStr: string): string => {
    const todayStr = today();
    if (dateStr === todayStr) return t('home.history.today');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateStr === yStr) return t('home.history.yesterday');
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  let cardIndex = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Header backTo="/home" title={t('home.history.title')} />

      <style>{`
        @keyframes history-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px',
        paddingTop: `${HEADER_HEIGHT + 16}px`,
        paddingBottom: 'var(--bottom-nav-safe)',
        maxWidth: '448px',
        margin: '0 auto',
        width: '100%',
      }}>
        {error ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '8px',
          }}>
            <AlertCircle size={32} style={{ color: 'var(--muted-foreground)' }} />
            <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>
              {t('home.history.errorTitle')}
            </span>
            <button
              onClick={reload}
              style={{
                fontSize: '14px', fontWeight: 600,
                color: 'var(--primary-40)',
                background: 'var(--surface-variant)',
                border: 'none', cursor: 'pointer',
                marginTop: '8px',
                padding: '10px 24px',
                borderRadius: 'var(--radius)',
              }}
            >
              {t('home.history.errorRetry')}
            </button>
          </div>
        ) : groups.size === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '4px',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted-foreground)' }}>
              {t('home.history.emptyTitle')}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
              {t('home.history.emptyBody')}
            </span>
          </div>
        ) : (
          Array.from(groups.entries()).map(([day, posts]) => (
            <div key={day} style={{ marginBottom: '24px' }}>
              <div style={{
                position: 'sticky', top: 0,
                fontSize: '13px', fontWeight: 600,
                color: 'var(--muted-foreground)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: 'var(--background)',
                padding: '8px 0',
                zIndex: 1,
              }}>
                {formatDayHeading(day)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posts.map(post => (
                  <HistoryPostCard key={post.id} post={post} index={cardIndex++} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
