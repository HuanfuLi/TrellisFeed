import { useState, useRef, memo } from 'react';
import { Pencil, RefreshCw, Trash2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Markdown } from './Markdown';
import { extractCitations } from '../services/web-search.service';
import type { SessionMessage, SourceCitation } from '../types';

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
  // Off-topic flag props
  questionId?: string;
  flagged?: boolean;
  onQuestionOverride?: (questionId: string, shouldSave: boolean) => void;
  /**
   * Phase 47 D-01 / D-02 — when set to 'malicious-block', short-circuits the
   * markdown body render and shows the inline rejection surface (NO override
   * button). The flagged-off-topic block (D-04 — already implemented) is
   * unchanged; this is a SEPARATE peer surface.
   */
  kind?: SessionMessage['kind'];
}

/** Replace inline [N] citation tags with styled superscript spans. */
function styleCitationTags(body: string, sources: SourceCitation[]): string {
  if (sources.length === 0) return body;
  // Build a set of valid indices so we only style real citations
  const validIndices = new Set(sources.map((s) => s.index));
  return body.replace(/\[(\d+)\]/g, (match, num) => {
    const idx = parseInt(num, 10);
    if (!validIndices.has(idx)) return match;
    // Use HTML that ReactMarkdown passes through via rehype
    return `<sup data-cite="${idx}" style="font-size:0.7em;color:var(--muted-foreground);margin:0 1px;cursor:default">[${idx}]</sup>`;
  });
}

function SourcesSection({ sources }: { sources: SourceCitation[] }) {
  const { t } = useTranslation();
  if (sources.length === 0) return null;
  return (
    <div style={{
      marginTop: '10px',
      padding: '8px 10px',
      borderRadius: '8px',
      backgroundColor: 'var(--surface-variant)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--muted-foreground)',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginBottom: '2px',
      }}>
        <Globe size={12} />
        {t('chatMessage.sources')}
      </div>
      {sources.map((s) => {
        let domain = '';
        try { domain = new URL(s.url).hostname.replace('www.', ''); } catch { /* ignore */ }
        return (
          <a
            key={s.index}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary-40)',
              textDecoration: 'none',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px',
            }}
          >
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.72rem', flexShrink: 0 }}>[{s.index}]</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
            {domain && <span style={{ color: 'var(--muted-foreground)', fontSize: '0.68rem', flexShrink: 0 }}>· {domain}</span>}
          </a>
        );
      })}
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({
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
  questionId,
  flagged,
  onQuestionOverride,
  kind,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '16px', animation: 'fade-in 0.2s ease' }}>
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
                {t('chatMessage.cancel')}
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
                {t('chatMessage.send')}
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
                  {t('chatMessage.editPrompt')}
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

  // AI response — full width, no bubble
  return (
    <div style={{ marginBottom: '16px', animation: 'fade-in 0.2s ease' }}>
      <div style={{ minWidth: 0 }}>
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onClick={showActions ? dismiss : undefined}
          style={{
            padding: '8px 4px',
            lineHeight: 1.6,
            color: 'var(--foreground)',
            userSelect: 'text',
            WebkitTouchCallout: 'default',
            cursor: 'default',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {/*
            Phase 47 D-01 / D-02 — malicious-block render branch.
            When kind === 'malicious-block', short-circuit the normal markdown body
            render and show the neutral inline rejection surface. Intentionally has
            NO override button (D-02): bracketing handles legitimate-looking-scary
            questions; the malicious classifier is narrow and override-free.
            Peer to (NOT replacement for) the flagged-off-topic block below — D-04
            preserves the off-topic UI unchanged.
          */}
          {type === 'ai' && kind === 'malicious-block' ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--muted-foreground)',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <span aria-hidden="true">⚠️</span>
              <span>{t('chatMessage.maliciousBlocked.body')}</span>
            </div>
          ) : (
            (() => {
              const { body, sources } = extractCitations(content);
              const styledBody = styleCitationTags(body, sources);
              return (
                <>
                  <Markdown>{styledBody}</Markdown>
                  <SourcesSection sources={sources} />
                </>
              );
            })()
          )}
          {type === 'ai' && flagged && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '12px',
            }}>
              {/* Off-topic badge — click to show override prompt */}
              <button
                onClick={() => setShowOverridePrompt(!showOverridePrompt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--muted-foreground)',
                  fontWeight: '500',
                  width: 'fit-content',
                }}
              >
                <span>⚠️</span>
                <span>{t('chatMessage.offTopic')}</span>
              </button>

              {/* Override confirmation — appears inline when badge clicked */}
              {showOverridePrompt && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  color: 'var(--foreground)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ fontWeight: '500' }}>{t('chatMessage.offTopicPrompt')}</div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={() => {
                        if (questionId) {
                          onQuestionOverride?.(questionId, true);
                        }
                        setShowOverridePrompt(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--primary-40)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                      }}
                    >
                      {t('chatMessage.saveAnyway')}
                    </button>
                    <button
                      onClick={() => setShowOverridePrompt(false)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--surface-variant)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                      }}
                    >
                      {t('chatMessage.discard')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {relatedKnowledge && relatedKnowledge.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                {t('chatMessage.relatedKnowledge')}
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
                    onPointerEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
                    onPointerLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--card)')}
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
              {t('chatMessage.regenerate')}
            </button>
            <button
              onClick={() => { dismiss(); onDelete?.(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '20px',
                border: '1px solid var(--danger)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--danger)',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} />
              {t('chatMessage.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
