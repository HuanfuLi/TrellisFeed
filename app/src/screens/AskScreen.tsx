import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, SquarePen, Trash2 } from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { useQuestions } from '../state/useQuestions';
import { sessionService } from '../services/session.service';
import { flashcardService } from '../services/flashcard.service';
import type { ChatSession, SessionMessage } from '../types';
import { formatDate } from '../lib/date';

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

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: SessionMessage = { id: `u-${Date.now()}`, type: 'user', content };
      const placeholderId = `ai-${Date.now() + 1}`;

      // Add user message + start streaming overlay
      setSession((prev) => {
        const updated: ChatSession = {
          ...prev,
          title: prev.title || content.slice(0, 60),
          messages: [...prev.messages, userMsg],
        };
        sessionService.save(updated);
        return updated;
      });
      setStreaming({ placeholderId, content: '' });

      const question = await askStreaming(content, (accumulated) => {
        setStreaming({ placeholderId, content: accumulated });
      });

      // Commit AI reply to session
      const aiContent = question
        ? question.answer
        : streaming?.content || 'Something went wrong. Please try again.';

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
          messages: [...prev.messages, aiMsg],
        };
        sessionService.save(updated);
        return updated;
      });
      setStreaming(null);
    },
    [askStreaming, questions, streaming],
  );

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
        {/* Welcome message when session is empty */}
        {displayMessages.length === 0 && (
          <ChatMessage
            type="ai"
            content="Hi! I'm your AI learning companion. Ask me anything to build your knowledge base."
            relatedKnowledge={[]}
            onKnowledgeClick={() => {}}
          />
        )}
        {displayMessages.map((message) => (
          <div key={message.id}>
            <ChatMessage
              type={message.type}
              content={message.content + (message.isStreaming && message.content ? '|' : '')}
              relatedKnowledge={message.relatedKnowledge}
              onKnowledgeClick={(k) => {
                const q = questions.find((q) => q.summary === k);
                if (q) navigate(`/ask/${q.id}`);
              }}
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
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} placeholder="Ask anything..." />

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
