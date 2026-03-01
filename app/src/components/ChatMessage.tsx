import { useState, useRef } from 'react';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Markdown } from './Markdown';

export type MessageType = 'user' | 'ai';

interface ChatMessageProps {
  messageId: string;
  type: MessageType;
  content: string;
  relatedKnowledge?: string[];
  onKnowledgeClick?: (knowledge: string) => void;
  // Edit mode (user bubble)
  isEditing?: boolean;
  editContent?: string;
  onEditChange?: (val: string) => void;
  onEditSubmit?: () => void;
  onEditCancel?: () => void;
  // Action callbacks
  onEdit?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

export function ChatMessage({
  type,
  content,
  relatedKnowledge,
  onKnowledgeClick,
  isEditing,
  editContent,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onEdit,
  onRegenerate,
  onDelete,
}: ChatMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const startLongPress = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowActions(true);
    }, 480);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => startLongPress();
  const handlePointerUp = () => cancelLongPress();
  const handlePointerLeave = () => cancelLongPress();
  const handlePointerMove = () => cancelLongPress();

  const dismiss = () => setShowActions(false);

  if (type === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '16px' }}>
        {isEditing ? (
          <div style={{ maxWidth: '85%', width: '100%' }}>
            <textarea
              value={editContent}
              onChange={(e) => onEditChange?.(e.target.value)}
              autoFocus
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '16px',
                border: '1.5px solid var(--primary-40)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onEditSubmit?.();
                }
                if (e.key === 'Escape') onEditCancel?.();
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={onEditCancel}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--border)',
                  background: 'none',
                  color: 'var(--muted-foreground)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={onEditSubmit}
                disabled={!editContent?.trim()}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: 'var(--primary-40)',
                  color: 'white',
                  fontSize: '0.8rem',
                  cursor: editContent?.trim() ? 'pointer' : 'not-allowed',
                  opacity: editContent?.trim() ? 1 : 0.5,
                }}
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            {showActions && (
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginBottom: '6px',
                  animation: 'fade-in 0.15s ease',
                }}
              >
                <button
                  onClick={() => { dismiss(); onEdit?.(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface-variant)',
                    color: 'var(--foreground)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  <Pencil size={12} />
                  Edit Prompt
                </button>
              </div>
            )}
            <div
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerMove={handlePointerMove}
              onClick={showActions ? dismiss : undefined}
              style={{
                maxWidth: '80%',
                padding: '12px 20px',
                color: 'white',
                backgroundColor: 'var(--primary-40)',
                borderRadius: '24px 24px 4px 24px',
                lineHeight: 1.6,
                userSelect: 'none',
                cursor: 'default',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
              }}
            >
              {content}
            </div>
          </>
        )}
      </div>
    );
  }

  // AI bubble
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
      <div style={{ maxWidth: '85%', minWidth: 0 }}>
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onClick={showActions ? dismiss : undefined}
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: '24px',
            lineHeight: 1.6,
            color: 'var(--foreground)',
            userSelect: 'none',
            cursor: 'default',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          <Markdown>{content}</Markdown>
          {relatedKnowledge && relatedKnowledge.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                🔗 Related Knowledge:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {relatedKnowledge.map((knowledge, index) => (
                  <button
                    key={index}
                    onClick={() => onKnowledgeClick?.(knowledge)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--card)',
                      color: 'var(--foreground)',
                      fontSize: '0.875rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card)')}
                  >
                    <span style={{ fontWeight: 500 }}>⤴ {knowledge}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI action chips */}
        {showActions && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginTop: '6px',
              animation: 'fade-in 0.15s ease',
            }}
          >
            <button
              onClick={() => { dismiss(); onRegenerate?.(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '20px',
                border: '1px solid var(--primary-40)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--primary-40)',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
            <button
              onClick={() => { dismiss(); onDelete?.(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '20px',
                border: '1px solid #E53935',
                backgroundColor: 'var(--surface-variant)',
                color: '#E53935',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
