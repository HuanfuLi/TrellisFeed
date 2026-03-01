import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BookOpen, CheckSquare, Headphones, Mic } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useQuestions } from '../state/useQuestions';
import { useReview } from '../state/useReview';
import { usePodcast } from '../state/usePodcast';
import { mockCalendarService } from '../services/mock/calendar.mock';
import { eventBus } from '../lib/event-bus';
import { today, getGreeting, formatDateLabel } from '../lib/date';

export function HomeScreen() {
  const navigate = useNavigate();
  const { getByDate, getRecent } = useQuestions();
  const { reviewCount } = useReview();
  const { getPodcastForDate } = usePodcast();

  const t = today();
  const todayQuestions = getByDate(t);
  const recentQuestions = getRecent(3);
  const todayPodcast = getPodcastForDate(t);

  const [pendingTodos, setPendingTodos] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      const result = await mockCalendarService.getDaySchedule(today());
      if (result.success && result.data) {
        setPendingTodos(
          result.data.blocks.flatMap((b) => b.todos).filter((td) => td.status === 'pending').length,
        );
      }
    };
    void refresh();
    const unsub1 = eventBus.subscribe('TODO_STATUS_CHANGED', () => void refresh());
    const unsub2 = eventBus.subscribe('TODO_CREATED', () => void refresh());
    return () => { unsub1(); unsub2(); };
  }, []);

  return (
    <>
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '4px' }}>{getGreeting()}</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>{formatDateLabel(t)}</p>
      </div>

      {/* Bento Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Today's Summary — full width */}
        <div
          style={{
            gridColumn: '1 / -1',
            padding: '24px',
            background: 'var(--summary-bg)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <Brain size={32} color="var(--summary-text)" />
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '2.5rem', fontWeight: 600, color: 'var(--summary-text)', lineHeight: 1 }}>{todayQuestions.length}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--summary-text-muted)' }}>questions today</p>
            </div>
          </div>
          <h3 style={{ color: 'var(--summary-text)', marginBottom: '12px' }}>Today's Summary</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--summary-stat-bg)', borderRadius: '16px', backdropFilter: 'blur(8px)' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--summary-text)' }}>{reviewCount}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--summary-text-muted)' }}>Due for review</p>
            </div>
            <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--summary-stat-bg)', borderRadius: '16px', backdropFilter: 'blur(8px)' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--summary-text)' }}>{pendingTodos}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--summary-text-muted)' }}>Tasks pending</p>
            </div>
          </div>
        </div>

        {/* Review Card */}
        <button
          onClick={() => navigate('/review')}
          style={{ textAlign: 'left', background: 'none', padding: 0 }}
        >
          <Card
            style={{
              backgroundColor: 'var(--bento-review-bg)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              height: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <BookOpen size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
            <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>Review</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{reviewCount}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>due</p>
            </div>
          </Card>
        </button>

        {/* Tasks Card */}
        <button
          onClick={() => navigate('/calendar')}
          style={{ textAlign: 'left', background: 'none', padding: 0 }}
        >
          <Card
            style={{
              backgroundColor: 'var(--bento-tasks-bg)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              height: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <CheckSquare size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
            <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>Tasks</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{pendingTodos}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>pending</p>
            </div>
          </Card>
        </button>

        {/* Podcast Card — full width */}
        <button
          onClick={() => navigate('/podcast')}
          style={{ gridColumn: '1 / -1', textAlign: 'left', background: 'none', padding: 0 }}
        >
          <Card
            style={{
              backgroundColor: 'var(--bento-podcast-bg)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Headphones size={28} color="var(--bento-card-text)" style={{ marginBottom: '8px' }} />
                <h4 style={{ color: 'var(--bento-card-text)', marginBottom: '4px' }}>Today's Podcast</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>
                  {todayPodcast
                    ? todayPodcast.status === 'ready'
                      ? `Ready · ${Math.round((todayPodcast.duration ?? 0) / 60)} min`
                      : todayPodcast.status === 'generating'
                        ? `Generating... ${todayPodcast.progress ?? 0}%`
                        : 'Generation failed'
                    : 'Not yet generated'}
                </p>
              </div>
              <Badge color={todayPodcast?.status === 'ready' ? 'green' : 'gray'}>
                {todayPodcast?.status ?? 'pending'}
              </Badge>
            </div>
          </Card>
        </button>

        {/* Recent Questions — full width */}
        {recentQuestions.length > 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Card style={{ backgroundColor: 'var(--surface-variant)' }}>
              <h4 style={{ marginBottom: '12px' }}>Recent Questions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentQuestions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => navigate(`/ask/${q.id}`)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--card)',
                      fontSize: '0.875rem',
                      color: 'var(--foreground)',
                      transition: 'background-color 0.2s',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card)')}
                  >
                    {q.title ?? q.content}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '16px', backgroundColor: 'var(--surface-variant)', borderRadius: 'var(--radius-xl)' }}>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>Ask your first question to start building your knowledge!</p>
          </div>
        )}

      </div>
    </div>

      {/* Floating Ask FAB — fixed above bottom nav */}
      <button
        onClick={() => navigate('/ask')}
        style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          padding: '16px',
          backgroundColor: 'var(--primary-40)',
          color: 'white',
          borderRadius: '50%',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          transition: 'transform 0.2s, background-color 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.backgroundColor = 'var(--primary-30)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'var(--primary-40)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
        }}
      >
        <Mic size={24} />
      </button>
    </>
  );
}
