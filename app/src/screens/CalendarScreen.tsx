import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, BookOpen } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useCalendar } from '../state/useCalendar';
import { useReview } from '../state/useReview';
import { today, formatDateLabel, addDays } from '../lib/date';

const BLOCK_COLORS = ['var(--node-mint)', 'var(--node-salmon)', 'var(--node-lilac)', 'var(--node-peach)', 'var(--node-sky)'];

export function CalendarScreen() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(today());
  const [newTodos, setNewTodos] = useState<Record<string, string>>({});
  const { schedule, isLoading, loadDay, addTodo, toggleTodo, postponeTodo, cancelPostpone } = useCalendar();
  const { reviewCount } = useReview();

  useEffect(() => {
    loadDay(currentDate);
  }, [currentDate, loadDay]);

  const allTodos = schedule?.blocks.flatMap((b) => b.todos) ?? [];
  const completed = allTodos.filter((td) => td.status === 'completed').length;
  const total = allTodos.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleAddTodo = async (blockId: string) => {
    const content = newTodos[blockId]?.trim();
    if (!content) return;
    await addTodo(blockId, content);
    setNewTodos((prev) => ({ ...prev, [blockId]: '' }));
  };

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ marginBottom: '4px' }}>Calendar</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>{completed} of {total} tasks done</p>
      </div>

      {/* Date Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => setCurrentDate(addDays(currentDate, -1))}
          style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '1.0625rem' }}>{formatDateLabel(currentDate)}</p>
          {currentDate !== today() && (
            <button
              onClick={() => setCurrentDate(today())}
              style={{ fontSize: '0.75rem', color: 'var(--primary-40)', background: 'none' }}
            >
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => setCurrentDate(addDays(currentDate, 1))}
          style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <ProgressBar value={progress} />
        </div>
      )}

      {/* Review Banner */}
      {reviewCount > 0 && (
        <button
          onClick={() => navigate('/review')}
          style={{
            width: '100%',
            textAlign: 'left',
            marginBottom: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, var(--primary-90), var(--secondary-container))',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--primary-80)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={20} color="var(--primary-40)" />
            <span style={{ fontWeight: 500, color: 'var(--primary-30)' }}>Review due</span>
          </div>
          <Badge color="green">{reviewCount} cards</Badge>
        </button>
      )}

      {/* Time Blocks */}
      {isLoading ? (
        <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '32px 0' }}>Loading...</p>
      ) : schedule?.blocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted-foreground)' }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No blocks scheduled</p>
          <p style={{ fontSize: '0.875rem' }}>Your schedule is clear for this day.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {schedule?.blocks.map((block, i) => (
            <Card key={block.id} style={{ backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length] }}>
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ color: '#2D2D2D', marginBottom: '2px' }}>{block.label}</h4>
                <p style={{ fontSize: '0.75rem', color: 'rgba(45,45,45,0.7)' }}>
                  {block.startTime} – {block.endTime}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {block.todos.map((todo) => (
                  <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Checkbox — disabled for postponed todos */}
                    <button
                      onClick={() => todo.status !== 'postponed' && toggleTodo(todo.id, todo.status)}
                      disabled={todo.status === 'postponed'}
                      style={{
                        flexShrink: 0,
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: `2px solid ${todo.status === 'completed' ? 'var(--primary-40)' : 'rgba(45,45,45,0.4)'}`,
                        backgroundColor: todo.status === 'completed' ? 'var(--primary-40)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 700,
                        opacity: todo.status === 'postponed' ? 0.35 : 1,
                        cursor: todo.status === 'postponed' ? 'default' : 'pointer',
                      }}
                    >
                      {todo.status === 'completed' ? '✓' : ''}
                    </button>

                    <span
                      style={{
                        flex: 1,
                        fontSize: '0.9rem',
                        color: '#2D2D2D',
                        textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                        opacity: todo.status === 'postponed' ? 0.5 : 1,
                      }}
                    >
                      {todo.content}
                      {todo.status === 'postponed' && (
                        <span style={{ fontSize: '0.75rem', marginLeft: '6px', color: 'rgba(45,45,45,0.6)' }}>→ tomorrow</span>
                      )}
                    </span>

                    {/* Action buttons */}
                    {todo.status === 'pending' && (
                      <button
                        onClick={() => postponeTodo(todo.id)}
                        style={{
                          flexShrink: 0,
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(255,255,255,0.5)',
                          color: '#2D2D2D',
                        }}
                        title="Postpone to tomorrow"
                      >
                        →
                      </button>
                    )}
                    {todo.status === 'postponed' && (
                      <button
                        onClick={() => cancelPostpone(todo.id)}
                        style={{
                          flexShrink: 0,
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(255,255,255,0.5)',
                          color: '#2D2D2D',
                        }}
                        title="Cancel postpone"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Todo */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newTodos[block.id] ?? ''}
                  onChange={(e) => setNewTodos((prev) => ({ ...prev, [block.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTodo(block.id)}
                  placeholder="Add task..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    fontSize: '0.875rem',
                    color: '#2D2D2D',
                  }}
                />
                <button
                  onClick={() => handleAddTodo(block.id)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-40)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
