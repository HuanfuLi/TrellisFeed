import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bookmark, Clock } from 'lucide-react';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { engagementService } from '../services/engagement.service';
import { frozenFeedService } from '../services/frozen-feed.service';
import { postHistoryService } from '../services/post-history.service';
import { eventBus } from '../lib/event-bus';
import type { Post } from '../domain/content.types';

type Tab = 'saved' | 'history';

function formatDayLabel(day: string, tt: (key: string) => string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  if (day === today) return tt('home.history.today');
  if (day === yesterday) return tt('home.history.yesterday');
  return day;
}

function PostRow({ post, onOpen }: { post: Readonly<Post>; onOpen: () => void }) {
  const [pressed, setPressed] = useState(false);
  const emoji = post.sourcePlatform === 'youtube' ? '▶' : '📄';

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: pressed ? 'var(--surface-variant)' : 'var(--card)',
        boxShadow: 'var(--shadow-1)',
        color: 'var(--foreground)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '8px',
          background: 'var(--surface-variant)',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: '20px',
        }}
      >
        {emoji}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 650,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.displayTitle}
        </div>
        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
          {post.sourceName}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const Icon = tab === 'saved' ? Bookmark : Clock;
  const title = tab === 'saved' ? t('saved.empty.savedTitle') : t('home.history.emptyTitle');
  const body = tab === 'saved' ? t('saved.empty.savedBody') : t('home.history.emptyBody');

  return (
    <div
      style={{
        minHeight: '220px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: 'var(--muted-foreground)',
        textAlign: 'center',
      }}
    >
      <Icon size={38} />
      <div style={{ fontSize: '15px', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: '13px', maxWidth: '260px', lineHeight: 1.45 }}>{body}</div>
    </div>
  );
}

export function SavedScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tt = t as (key: string) => string;
  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const unsubEngagement = eventBus.subscribe('ENGAGEMENT_CHANGED', bump);
    const unsubGraph = eventBus.subscribe('GRAPH_UPDATED', bump);
    return () => {
      unsubEngagement();
      unsubGraph();
    };
  }, []);

  const savedPosts = engagementService.getSavedPostIds()
    .map((postId) => frozenFeedService.getPostById(postId))
    .filter((post): post is Readonly<Post> => post !== null);
  const historyGroups = Array.from(postHistoryService.getEntriesByDay().entries()).map(([day, entries]) => [
    day,
    entries
      .map((entry) => frozenFeedService.getPostById(entry.postId))
      .filter((post): post is Readonly<Post> => post !== null),
  ] as const);
  const hasHistory = historyGroups.some(([, posts]) => posts.length > 0);

  const tabButton = (tab: Tab, label: string, Icon: typeof Bookmark) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      style={{
        flex: 1,
        height: '42px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: activeTab === tab ? 'var(--primary-40)' : 'var(--surface-variant)',
        color: activeTab === tab ? 'white' : 'var(--foreground)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div
      style={{
        paddingTop: `${HEADER_HEIGHT + 12}px`,
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: 'calc(24px + var(--safe-area-bottom))',
        maxWidth: '448px',
        margin: '0 auto',
      }}
    >
      <Header
        title={t('saved.title')}
        centered
        left={
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
        }
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {tabButton('saved', t('saved.tabs.saved'), Bookmark)}
        {tabButton('history', t('saved.tabs.history'), Clock)}
      </div>

      {activeTab === 'saved' ? (
        savedPosts.length === 0 ? (
          <EmptyState tab="saved" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {savedPosts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                onOpen={() => navigate(`/posts/${post.id}`)}
              />
            ))}
          </div>
        )
      ) : !hasHistory ? (
        <EmptyState tab="history" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {historyGroups.map(([day, posts]) => (
            posts.length > 0 && (
              <section key={day}>
                <h2 style={{ fontSize: '13px', color: 'var(--muted-foreground)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {formatDayLabel(day, tt)}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {posts.map((post) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      onOpen={() => navigate(`/posts/${post.id}`)}
                    />
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedScreen;
