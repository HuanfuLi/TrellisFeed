import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BookOpen, CheckSquare, Headphones } from 'lucide-react';
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
            background: 'linear-gradient(135deg, var(--primary-80), var(--primary-40))',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <Brain size={32} color="white" />
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '2.5rem', fontWeight: 600, color: 'white', lineHeight: 1 }}>{todayQuestions.length}</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>questions today</p>
            </div>
          </div>
          <h3 style={{ color: 'white', marginBottom: '12px' }}>Today's Summary</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '16px', backdropFilter: 'blur(8px)' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>{reviewCount}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Due for review</p>
            </div>
            <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '16px', backdropFilter: 'blur(8px)' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>{pendingTodos}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Tasks pending</p>
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
              backgroundColor: 'var(--node-salmon)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              height: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <BookOpen size={28} color="#2D2D2D" style={{ marginBottom: '12px' }} />
            <h4 style={{ marginBottom: '8px', color: '#2D2D2D' }}>Review</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <p style={{ fontSize: '1.875rem', fontWeight: 600, color: '#2D2D2D' }}>{reviewCount}</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(45,45,45,0.8)' }}>due</p>
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
              backgroundColor: 'var(--node-mint)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              height: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <CheckSquare size={28} color="#2D2D2D" style={{ marginBottom: '12px' }} />
            <h4 style={{ marginBottom: '8px', color: '#2D2D2D' }}>Tasks</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <p style={{ fontSize: '1.875rem', fontWeight: 600, color: '#2D2D2D' }}>{pendingTodos}</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(45,45,45,0.8)' }}>pending</p>
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
              backgroundColor: 'var(--node-lilac)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Headphones size={28} color="#2D2D2D" style={{ marginBottom: '8px' }} />
                <h4 style={{ color: '#2D2D2D', marginBottom: '4px' }}>Today's Podcast</h4>
                <p style={{ fontSize: '0.875rem', color: 'rgba(45,45,45,0.8)' }}>
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
        {recentQuestions.length > 0 && (
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
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card)')}
                  >
                    {q.content}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
