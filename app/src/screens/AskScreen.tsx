import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, SquarePen, Trash2, Flag, X, Check } from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { useQuestions } from '../state/useQuestions';
import { sessionService } from '../services/session.service';
import { flashcardService } from '../services/flashcard.service';
import type { ChatSession, SessionMessage } from '../types';
import { formatDate } from '../lib/date';
import { questionService } from '../services/question.service';
import { toast } from '../lib/toast';

const SUGGESTED_PROMPTS = [
  'What is spaced repetition and why does it work?',
  'Explain the Feynman technique in simple terms',
  'How do I build a consistent daily learning habit?',
  "What's the most effective way to retain information long-term?",
];

// Transient streaming overlay — not persisted
interface StreamingOverlay {
  placeholderId: string;
  content: string;
}

function startNewSession(current: ChatSession): ChatSession {
  // Fire-and-forget flashcard processing if session has user messages and hasn't been processed
  if (!current.processed && current.messages.some((m) => m.type === 'user')) {
    void flashcardService.processSession(current).then(() => {
      const refreshed = sessionService.getById(current.id);
      if (refreshed) {
        sessionService.save({ ...refreshed, processed: true });
      }
    });
  }
  return sessionService.createNew();
}

export function AskScreen() {
  const navigate = useNavigate();
  const { askStreaming, questions } = useQuestions();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<ChatSession>(() => sessionService.getActive());
  const [streaming, setStreaming] = useState<StreamingOverlay | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [confirmFlagId, setConfirmFlagId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Keep session ref in sync for use in callbacks without stale closure
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, streaming]);

  // Refresh the sessions list whenever the history panel opens
  useEffect(() => {
    if (showHistory) {
      setHistorySessions(sessionService.getAll());
    }
  }, [showHistory]);

  // Build the display list: persisted messages + streaming overlay
  const displayMessages = streaming
    ? [
      ...session.messages.map((m) => ({ ...m, isStreaming: false })),
      { id: streaming.placeholderId, type: 'ai' as const, content: streaming.content, isStreaming: true },
    ]
    : session.messages.map((m) => ({ ...m, isStreaming: false }));

  // Core AI reply generator — used by handleSend, handleEditSubmit, handleRegenerateResponse
  const generateAiReply = useCallback(
    async (userContent: string, placeholderId: string) => {
      setStreaming({ placeholderId, content: '' });

      const question = await askStreaming(userContent, (accumulated) => {
        setStreaming({ placeholderId, content: accumulated });
      });

      const aiContent = question
        ? question.answer
        : 'Something went wrong. Please try again.';

      const related = question
        ? questions.filter((q) => question.relatedQuestionIds.includes(q.id)).map((q) => q.summary)
        : [];

      const aiMsg: SessionMessage = {
        id: placeholderId,
        type: 'ai',
        content: aiContent,
        relatedKnowledge: related,
        questionId: question?.id,
      };

      setSession((prev) => {
        const updated: ChatSession = {
          ...prev,
          // Use AI-derived title on first exchange; keep existing title otherwise
          title: prev.title || question?.title || userContent.slice(0, 60),
          messages: [...prev.messages, aiMsg],
        };
        sessionService.save(updated);
        return updated;
      });
      setStreaming(null);
    },
    [askStreaming, questions],
  );

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: SessionMessage = { id: `u-${Date.now()}`, type: 'user', content };
      const placeholderId = `ai-${Date.now() + 1}`;

      setSession((prev) => {
        const updated: ChatSession = {
          ...prev,
          messages: [...prev.messages, userMsg],
        };
        sessionService.save(updated);
        return updated;
      });

      await generateAiReply(content, placeholderId);
    },
    [generateAiReply],
  );

  const handleEditSubmit = useCallback(async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    const newContent = editingContent.trim();
    const placeholderId = `ai-${Date.now()}`;

    // Truncate messages at the edited user message (inclusive) and replace it
    setSession((prev) => {
      const idx = prev.messages.findIndex((m) => m.id === editingMessageId);
      if (idx === -1) return prev;
      const truncated = prev.messages.slice(0, idx);
      const editedMsg: SessionMessage = { id: `u-${Date.now()}`, type: 'user', content: newContent };
      const updated: ChatSession = { ...prev, messages: [...truncated, editedMsg] };
      sessionService.save(updated);
      return updated;
    });

    setEditingMessageId(null);
    setEditingContent('');

    await generateAiReply(newContent, placeholderId);
  }, [editingMessageId, editingContent, generateAiReply]);

  const handleRegenerateResponse = useCallback(async (aiMessageId: string) => {
    // Find the preceding user message content, remove the AI message, regenerate
    const msgs = sessionRef.current.messages;
    const aiIdx = msgs.findIndex((m) => m.id === aiMessageId);
    if (aiIdx === -1) return;
    const userMsg = aiIdx > 0 ? msgs[aiIdx - 1] : null;
    if (!userMsg || userMsg.type !== 'user') return;

    const userContent = userMsg.content;
    const placeholderId = `ai-${Date.now()}`;

    setSession((prev) => {
      const updated: ChatSession = {
        ...prev,
        messages: prev.messages.filter((m) => m.id !== aiMessageId),
      };
      sessionService.save(updated);
      return updated;
    });

    await generateAiReply(userContent, placeholderId);
  }, [generateAiReply]);

  const handleDeleteResponse = useCallback((aiMessageId: string) => {
    setSession((prev) => {
      const updated: ChatSession = {
        ...prev,
        messages: prev.messages.filter((m) => m.id !== aiMessageId),
      };
      sessionService.save(updated);
      return updated;
    });
    toast('Response deleted.', 'success');
  }, []);

  const handleNewChat = useCallback(() => {
    const newSession = startNewSession(sessionRef.current);
    setSession(newSession);
    setStreaming(null);
    setShowHistory(false);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    sessionService.setActiveId(id);
    const loaded = sessionService.getById(id);
    if (loaded) {
      setSession(loaded);
      setStreaming(null);
    }
    setShowHistory(false);
  }, []);

  const handleFlagConfirm = useCallback((messageId: string) => {
    setSession((prev) => {
      const msgs = prev.messages;
      const idx = msgs.findIndex((m) => m.id === messageId);
      const aiMsg = msgs[idx];
      const toRemove = new Set([messageId]);
      if (idx > 0 && msgs[idx - 1].type === 'user') {
        toRemove.add(msgs[idx - 1].id);
      }
      if (aiMsg?.questionId) {
        void questionService.delete(aiMsg.questionId);
      }
      const updated: ChatSession = {
        ...prev,
        messages: msgs.filter((m) => !toRemove.has(m.id)),
      };
      sessionService.save(updated);
      return updated;
    });
    setConfirmFlagId(null);
    toast('Response removed from your data.', 'success');
  }, []);

  const handleDeleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sessionService.delete(id);
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    // If we deleted the active session, open a fresh one
    if (id === sessionRef.current.id) {
      const newSession = sessionService.createNew();
      setSession(newSession);
      setStreaming(null);
    }
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '448px', margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '24px 16px 16px', backgroundColor: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: '2px' }}>Ask</h1>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Your AI learning companion</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button
              onClick={() => setShowHistory(true)}
              title="History"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--muted-foreground)',
                fontSize: '0.8rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <History size={15} />
              History
            </button>
            <button
              onClick={handleNewChat}
              title="New Chat"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--primary-40)',
                color: '#fff',
                fontSize: '0.8rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <SquarePen size={15} />
              New Chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '140px' }}>
        {/* Welcome message + suggested prompts when session is empty */}
        {displayMessages.length === 0 && (
          <>
            <ChatMessage
              type="ai"
              content="Hi! I'm your AI learning companion. Ask me anything to build your knowledge base."
              relatedKnowledge={[]}
              onKnowledgeClick={() => { }}
            />
            <div style={{ padding: '4px 4px 0' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '10px', paddingLeft: '4px' }}>
                Try asking:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void handleSend(prompt)}
                    style={{
                      textAlign: 'left',
                      padding: '11px 16px',
                      borderRadius: '18px',
                      border: '1.5px solid var(--border)',
                      backgroundColor: 'var(--card)',
                      color: 'var(--foreground)',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-40)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-90)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = 'var(--card)';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {questions.length > 0 && (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '10px', paddingLeft: '4px' }}>
                    Recent Questions:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {questions.slice(0, 3).map((q) => (
                      <button
                        key={q.id}
                        onClick={() => navigate(`/ask/${q.id}`)}
                        style={{
                          textAlign: 'left',
                          padding: '11px 16px',
                          borderRadius: '18px',
                          border: '1.5px solid var(--border)',
                          backgroundColor: 'var(--card)',
                          color: 'var(--foreground)',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          lineHeight: 1.4,
                          transition: 'border-color 0.15s, background-color 0.15s',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary-40)';
                          e.currentTarget.style.backgroundColor = 'var(--surface-container-high)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.backgroundColor = 'var(--card)';
                        }}
                      >
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>• {q.content}</span>
                        <span style={{ fontSize: '1.2rem', color: 'var(--muted-foreground)' }}>→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
        {displayMessages.map((message) => (
          <div key={message.id}>
            <ChatMessage
              messageId={message.id}
              type={message.type}
              content={message.content + (message.isStreaming && message.content ? '|' : '')}
              relatedKnowledge={message.relatedKnowledge}
              onKnowledgeClick={(k) => {
                const q = questions.find((q) => q.summary === k);
                if (q) navigate(`/ask/${q.id}`);
              }}
              isEditing={editingMessageId === message.id}
              editContent={editingMessageId === message.id ? editingContent : undefined}
              onEditChange={setEditingContent}
              onEditSubmit={() => void handleEditSubmit()}
              onEditCancel={() => { setEditingMessageId(null); setEditingContent(''); }}
              onEdit={!message.isStreaming ? () => { setEditingMessageId(message.id); setEditingContent(message.content); } : undefined}
              onRegenerate={!message.isStreaming ? () => void handleRegenerateResponse(message.id) : undefined}
              onDelete={!message.isStreaming ? () => handleDeleteResponse(message.id) : undefined}
            />
            {message.isStreaming && !message.content && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <div
                  style={{
                    padding: '16px 20px',
                    backgroundColor: 'var(--surface-variant)',
                    borderRadius: '24px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-40)',
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                  <style>{`@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }`}</style>
                </div>
              </div>
            )}
            {/* Flag/report button — only on settled AI messages */}
            {message.type === 'ai' && !message.isStreaming && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: '8px', marginTop: '-8px', marginBottom: '12px' }}>
                {confirmFlagId === message.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Remove this response?</span>
                    <button
                      onClick={() => setConfirmFlagId(null)}
                      title="Cancel"
                      style={{ padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={12} />
                    </button>
                    <button
                      onClick={() => handleFlagConfirm(message.id)}
                      title="Confirm remove"
                      style={{ padding: '3px 7px', borderRadius: '6px', border: '1px solid #E53935', background: 'none', cursor: 'pointer', color: '#E53935', display: 'flex', alignItems: 'center' }}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmFlagId(message.id)}
                    title="Flag this response"
                    style={{ padding: '3px 7px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', opacity: 0.45, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}
                  >
                    <Flag size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        placeholder="Ask anything..."
        disabled={!!streaming || editingMessageId !== null}
      />

      {/* History panel */}
      {showHistory && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowHistory(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 40,
            }}
          />
          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '80%',
              maxWidth: '360px',
              height: '100%',
              backgroundColor: 'var(--surface)',
              boxShadow: 'var(--shadow-3)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '24px 16px 16px',
                borderBottom: '1px solid var(--surface-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '1.1rem' }}>Chat History</h2>
              <button
                onClick={handleNewChat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--primary-40)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <SquarePen size={14} />
                New Chat
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {historySessions.length === 0 ? (
                <p style={{ padding: '16px', color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center' }}>
                  No chat history yet.
                </p>
              ) : (
                historySessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--surface-variant)',
                      backgroundColor: s.id === session.id ? 'var(--surface-variant)' : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => handleSelectSession(s.id)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      <p
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.title || 'New conversation'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        {formatDate(s.updatedAt)} · {s.messages.length} message{s.messages.length !== 1 ? 's' : ''}
                      </p>
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Delete conversation"
                      style={{
                        flexShrink: 0,
                        padding: '12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--muted-foreground)',
                        opacity: 0.6,
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
