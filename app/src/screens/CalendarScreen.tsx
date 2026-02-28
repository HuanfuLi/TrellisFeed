import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, BookOpen, Pin, Trash2, Check, X, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Confetti } from '../components/Confetti';
import { useCalendar } from '../state/useCalendar';
import { useReview } from '../state/useReview';
import { today, formatDateLabel, addDays } from '../lib/date';
import { toast } from '../lib/toast';
import type { TimeBlock } from '../types';

const BLOCK_COLORS = ['var(--node-mint)', 'var(--node-salmon)', 'var(--node-lilac)', 'var(--node-peach)', 'var(--node-sky)'];

// Inline edit state for a block's label + time
type EditingBlock = { id: string; label: string; startTime: string; endTime: string };

export function CalendarScreen() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(today());
  const [newTodos, setNewTodos] = useState<Record<string, string>>({});
  const [editingBlock, setEditingBlock] = useState<EditingBlock | null>(null);
  const [confirmDeleteBlockId, setConfirmDeleteBlockId] = useState<string | null>(null);
  const [confirmDeleteTodoId, setConfirmDeleteTodoId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const {
    schedule, isLoading, loadDay,
    addBlock, updateBlock, deleteBlock, togglePinBlock,
    addTodo, deleteTodo, toggleTodo, postponeTodo, cancelPostpone, togglePinTodo,
  } = useCalendar();
  const { reviewCount } = useReview();

  useEffect(() => {
    loadDay(currentDate);
  }, [currentDate, loadDay]);

  // Discard any unsaved edit / pending delete when navigating dates
  useEffect(() => {
    setEditingBlock(null);
    setConfirmDeleteBlockId(null);
    setConfirmDeleteTodoId(null);
    setShowConfetti(false);
  }, [currentDate]);

  // Auto-hide confetti after animation finishes
  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, [showConfetti]);

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

  const handleAddBlock = async () => {
    const newBlock = await addBlock(currentDate);
    if (newBlock) {
      setEditingBlock({ id: newBlock.id, label: newBlock.label, startTime: newBlock.startTime, endTime: newBlock.endTime });
    }
  };

  const startEditingBlock = (block: TimeBlock) => {
    setEditingBlock({ id: block.id, label: block.label, startTime: block.startTime, endTime: block.endTime });
  };

  const saveBlockEdit = async () => {
    if (!editingBlock) return;
    await updateBlock(editingBlock.id, {
      label: editingBlock.label,
      startTime: editingBlock.startTime,
      endTime: editingBlock.endTime,
    });
    setEditingBlock(null);
  };

  const handleDeleteBlock = async (blockId: string) => {
    setConfirmDeleteBlockId(null);
    if (editingBlock?.id === blockId) setEditingBlock(null);
    await deleteBlock(blockId);
  };

  // Shared style for editing inputs on colored card backgrounds
  const editInputStyle: React.CSSProperties = {
    padding: '3px 7px',
    borderRadius: '6px',
    backgroundColor: 'var(--block-input-bg)',
    color: 'var(--block-text)',
    border: '1.5px solid var(--block-border)',
    fontSize: '0.875rem',
  };

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      <Confetti active={showConfetti} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Calendar</h1>
          <p style={{ color: 'var(--muted-foreground)' }}>{completed} of {total} tasks done</p>
        </div>
        <button
          onClick={handleAddBlock}
          title="Add new block"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-40)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-1)',
            flexShrink: 0,
          }}
        >
          <Plus size={20} />
        </button>
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
          <p style={{ fontSize: '0.875rem' }}>Tap <strong>+</strong> at the top to add a block for this day.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {schedule?.blocks.map((block, i) => {
            const isEditing = editingBlock?.id === block.id;
            const bgColor = BLOCK_COLORS[i % BLOCK_COLORS.length];

            return (
              <Card key={block.id} style={{ backgroundColor: bgColor }}>
                {/* ── Block header ───────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <>
                        {/* Label input */}
                        <input
                          value={editingBlock.label}
                          onChange={(e) => setEditingBlock((prev) => prev ? { ...prev, label: e.target.value } : null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveBlockEdit();
                            if (e.key === 'Escape') setEditingBlock(null);
                          }}
                          placeholder="Block name"
                          autoFocus
                          style={{
                            ...editInputStyle,
                            width: '100%',
                            fontWeight: 600,
                            fontSize: '1rem',
                            marginBottom: '6px',
                          }}
                        />

                        {/* Time inputs + save/cancel */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <input
                            type="time"
                            value={editingBlock.startTime}
                            onChange={(e) => setEditingBlock((prev) => prev ? { ...prev, startTime: e.target.value } : null)}
                            style={editInputStyle}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--block-text-muted)' }}>–</span>
                          <input
                            type="time"
                            value={editingBlock.endTime}
                            onChange={(e) => setEditingBlock((prev) => prev ? { ...prev, endTime: e.target.value } : null)}
                            style={editInputStyle}
                          />
                          {/* Confirm */}
                          <button
                            onClick={() => void saveBlockEdit()}
                            title="Save"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--block-icon-active-bg)',
                              color: 'var(--block-text)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            ✓
                          </button>
                          {/* Cancel */}
                          <button
                            onClick={() => setEditingBlock(null)}
                            title="Cancel"
                            style={{
                              padding: '3px 6px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              color: 'var(--block-text-subtle)',
                              fontSize: '0.8rem',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Display mode — click either row to enter edit mode */
                      <button
                        onClick={() => startEditingBlock(block)}
                        title="Edit block name and time"
                        style={{ textAlign: 'left', background: 'none', padding: 0, cursor: 'text', width: '100%' }}
                      >
                        <h4 style={{ color: 'var(--block-text)', marginBottom: '2px' }}>
                          {block.label || 'Untitled Block'}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--block-text-muted)' }}>
                          {block.startTime && block.endTime
                            ? `${block.startTime} – ${block.endTime}`
                            : 'Tap to set time'}
                          {block.pinned && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', opacity: 0.7 }}>· daily</span>
                          )}
                        </p>
                      </button>
                    )}
                  </div>

                  {/* Block action buttons: pin + delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                    {/* Pin block */}
                    <button
                      onClick={() => void togglePinBlock(block.id)}
                      title={block.pinned ? 'Unpin block' : 'Pin block — appears every day'}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: block.pinned ? 'var(--block-icon-active-bg)' : 'transparent',
                        color: block.pinned ? 'var(--block-text)' : 'var(--block-text-subtle)',
                        border: `1.5px solid ${block.pinned ? 'var(--block-border-active)' : 'var(--block-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Pin size={13} fill={block.pinned ? 'currentColor' : 'none'} />
                    </button>

                    {/* Delete block — two-step confirm */}
                    {confirmDeleteBlockId === block.id ? (
                      <>
                        <button
                          onClick={() => setConfirmDeleteBlockId(null)}
                          title="Cancel delete"
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: 'transparent',
                            color: 'var(--block-text-subtle)',
                            border: '1.5px solid var(--block-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <X size={13} />
                        </button>
                        <button
                          onClick={() => void handleDeleteBlock(block.id)}
                          title="Confirm delete"
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: 'rgba(220,38,38,0.15)',
                            color: 'rgb(220,38,38)',
                            border: '1.5px solid rgba(220,38,38,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <Check size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteBlockId(block.id)}
                        title="Delete block"
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: 'transparent',
                          color: 'var(--block-text-subtle)',
                          border: '1.5px solid var(--block-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Todo list ──────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {block.todos.map((todo) => (
                    <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Checkbox */}
                      <button
                        onClick={() => {
                          if (todo.status === 'postponed') return;
                          // Trigger celebration when this is the last pending todo
                          if (todo.status === 'pending') {
                            const pendingNow = allTodos.filter((td) => td.status === 'pending').length;
                            if (pendingNow === 1) {
                              setShowConfetti(true);
                              toast('All tasks done for today! 🎉', 'success');
                            }
                          }
                          void toggleTodo(todo.id, todo.status);
                        }}
                        disabled={todo.status === 'postponed'}
                        style={{
                          flexShrink: 0,
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          border: `2px solid ${todo.status === 'completed' ? 'var(--primary-40)' : 'var(--block-border-active)'}`,
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

                      {/* Content */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: '0.9rem',
                          color: 'var(--block-text)',
                          textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                          opacity: todo.status === 'postponed' ? 0.5 : 1,
                        }}
                      >
                        {todo.content}
                        {todo.status === 'postponed' && (
                          <span style={{ fontSize: '0.75rem', marginLeft: '6px', color: 'var(--block-text-muted)' }}>→ tomorrow</span>
                        )}
                      </span>

                      {/* Action buttons */}
                      {todo.status === 'pending' && (
                        <>
                          {/* Pin todo */}
                          <button
                            onClick={() => void togglePinTodo(todo.id)}
                            title={todo.pinned ? 'Unpin task' : 'Pin task — appears every day'}
                            style={{
                              flexShrink: 0,
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: todo.pinned ? 'var(--block-icon-active-bg)' : 'transparent',
                              color: todo.pinned ? 'var(--block-text)' : 'var(--block-text-subtle)',
                              border: `1.5px solid ${todo.pinned ? 'var(--block-border-active)' : 'var(--block-border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >
                            <Pin size={11} fill={todo.pinned ? 'currentColor' : 'none'} />
                          </button>

                          {/* Postpone — round icon button */}
                          <button
                            onClick={() => void postponeTodo(todo.id)}
                            title="Postpone to tomorrow"
                            style={{
                              flexShrink: 0,
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: 'transparent',
                              color: 'var(--block-text-subtle)',
                              border: '1.5px solid var(--block-border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >
                            <ArrowRight size={11} />
                          </button>
                        </>
                      )}

                      {/* Cancel postpone */}
                      {todo.status === 'postponed' && (
                        <button
                          onClick={() => void cancelPostpone(todo.id)}
                          title="Cancel postpone"
                          style={{
                            flexShrink: 0,
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'transparent',
                            color: 'var(--block-text-subtle)',
                            border: '1.5px solid var(--block-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <X size={11} />
                        </button>
                      )}

                      {/* Delete todo — two-step confirm */}
                      {confirmDeleteTodoId === todo.id ? (
                        <>
                          <button
                            onClick={() => setConfirmDeleteTodoId(null)}
                            title="Cancel delete"
                            style={{
                              flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%',
                              backgroundColor: 'transparent', color: 'var(--block-text-subtle)',
                              border: '1.5px solid var(--block-border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >
                            <X size={11} />
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteTodoId(null); void deleteTodo(todo.id); }}
                            title="Confirm delete"
                            style={{
                              flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%',
                              backgroundColor: 'rgba(220,38,38,0.15)', color: 'rgb(220,38,38)',
                              border: '1.5px solid rgba(220,38,38,0.35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                          >
                            <Check size={11} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteTodoId(todo.id)}
                          title="Delete task"
                          style={{
                            flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%',
                            backgroundColor: 'transparent', color: 'var(--block-text-subtle)',
                            border: '1.5px solid var(--block-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── Add Todo ───────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={newTodos[block.id] ?? ''}
                    onChange={(e) => setNewTodos((prev) => ({ ...prev, [block.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && void handleAddTodo(block.id)}
                    placeholder="Add task..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--block-input-bg)',
                      fontSize: '0.875rem',
                      color: 'var(--block-text)',
                    }}
                  />
                  <button
                    onClick={() => void handleAddTodo(block.id)}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
