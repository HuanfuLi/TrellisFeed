import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, SquarePen, Trash2, Flag, X, Check, Search } from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { useQuestions } from '../state/useQuestions';
import { sessionService } from '../services/session.service';
import { flashcardService } from '../services/flashcard.service';
import { conceptFeedService } from '../services/concept-feed.service';
import { infiniteScrollService } from '../services/infiniteScroll.service';
import type { ChatSession, SessionMessage } from '../types';
import { formatDate } from '../lib/date';
// NOTE: AskScreen uses questionService.askStreaming() (via useQuestions) exclusively for Q&A.
// The non-streaming ask() method is available as a fallback but is not invoked from this screen.
// Session context is passed to askStreaming() for accurate follow-up filtering (see generateAiReply).
import { questionService } from '../services/question.service';
import { postContextQaService } from '../services/post-context-qa.service';
import { chatCompletion } from '../providers/llm';
import { settingsService } from '../services/settings.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';

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

// Bug #6: Module-level counter ensures unique IDs even when two calls happen in the same ms
let msgIdCounter = 0;
function newMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgIdCounter}`;
}

/** Ask the LLM for a short conversation title based on the first Q&A exchange. */
async function generateSessionTitle(userMessage: string, aiReply: string): Promise<string> {
  try {
    const settings = settingsService.getSync();
    if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) {
      return '';
    }
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: 'Generate a short (3-6 word) conversation title from the user question and AI reply below. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.',
        },
        { role: 'user', content: `Question: ${userMessage}\n\nReply: ${aiReply.slice(0, 400)}` },
      ],
      settings.llm,
      { serviceName: 'title' },
    );
    const title = raw.trim().replace(/^["']|["']$/g, '').slice(0, 60);
    return title || '';
  } catch {
    return '';
  }
}

// Bug #2: Guard against concurrent processSession calls for the same session
const processingSessionIds = new Set<string>();

/** Fire-and-forget flashcard extraction for a session that is becoming inactive. */
function processSessionIfNeeded(session: ChatSession): void {
  if (
    !session.processed &&
    session.messages.some((m) => m.type === 'user') &&
    !processingSessionIds.has(session.id)
  ) {
    processingSessionIds.add(session.id);
    void flashcardService.processSession(session).then(() => {
      const refreshed = sessionService.getById(session.id);
      if (refreshed) {
        sessionService.save({ ...refreshed, processed: true });
      }
    }).finally(() => {
      processingSessionIds.delete(session.id);
    });

    // Generate session-based posts in background and enqueue for swipe-to-load.
    // Only generate if the pending queue is low (< 4 posts).
    if (infiniteScrollService.getPendingCount() < 4) {
      void conceptFeedService.generateSessionPosts(session).then((posts) => {
        if (posts.length > 0) {
          infiniteScrollService.enqueuePosts(posts);
        }
      }).catch(() => { /* silent — feed still works without session posts */ });
    }
  }
}

function startNewSession(current: ChatSession): ChatSession {
  processSessionIfNeeded(current);
  return sessionService.createNew();
}

export function AskScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { askStreaming, questions } = useQuestions();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [anchorMsgId, setAnchorMsgId] = useState<string | null>(null);

  const [session, setSession] = useState<ChatSession>(() => sessionService.getActive());
  const [streaming, setStreaming] = useState<StreamingOverlay | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [confirmFlagId, setConfirmFlagId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Keep session ref in sync for use in callbacks without stale closure
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Process the current session for flashcard extraction when the screen unmounts
  // (e.g. user navigates away via BottomNavigation or closes the app)
  useEffect(() => {
    return () => {
      processSessionIfNeeded(sessionRef.current);
    };
  }, []);

  // Guard against concurrent generateAiReply calls (race condition)
  const generatingRef = useRef(false);
  // Abort in-flight AI streams on unmount to prevent stale state updates
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Scroll so the top of the user's question bubble sits near the top of the viewport.
  // Fires only when anchorMsgId changes (i.e. on each new send), never during streaming.
  useEffect(() => {
    if (!anchorMsgId || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const el = container.querySelector<HTMLElement>(`[data-msg-id="${anchorMsgId}"]`);
    if (!el) return;
    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const PADDING_TOP = 12;
    const target = container.scrollTop + (elTop - containerTop) - PADDING_TOP;
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [anchorMsgId]);

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
  // Persists directly to sessionService (not inside setSession updater) so the AI
  // response is saved even if the component unmounts during streaming.
  const generateAiReply = useCallback(
    async (userContent: string, placeholderId: string, currentMessages?: SessionMessage[]) => {
      // Prevent concurrent AI calls — drop if one is already in flight
      if (generatingRef.current) return;
      generatingRef.current = true;

      // Abort any previous in-flight stream; create a fresh controller
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setStreaming({ placeholderId, content: '' });

        const current = sessionRef.current;
        const isPostSession = current.origin?.type === 'post';
        const postOrigin = isPostSession ? current.origin : null;
        let lastContent = '';
        let question = null;

        if (postOrigin) {
          for await (const token of postContextQaService.askStreaming(postOrigin.context, userContent)) {
            if (controller.signal.aborted) return;
            lastContent += token;
            setStreaming({ placeholderId, content: lastContent });
          }
          // Promote post-context Q&A into the knowledge graph so insights
          // feed into Mind Map, Review, and Podcast surfaces.
          if (lastContent) {
            question = questionService.buildAndSave(userContent, lastContent);
          }
        } else {
          // Extract the immediate prior Q&A pair for follow-up context (avoids false-positive flagging)
          const msgs = currentMessages ?? current.messages;
          const lastAiIdx = msgs.map((m, i) => ({ m, i })).filter(({ m }) => m.type === 'ai').pop()?.i ?? -1;
          const sessionContext = lastAiIdx > 0 && msgs[lastAiIdx - 1]?.type === 'user'
            ? { priorQuestion: msgs[lastAiIdx - 1].content, priorAnswer: msgs[lastAiIdx].content }
            : undefined;

          // Use passed messages (avoids stale sessionRef timing issue).
          // Exclude the last message (just-appended user message) to avoid duplication.
          const priorMessages = (currentMessages ?? sessionRef.current.messages).slice(0, -1);
          question = await askStreaming(userContent, (accumulated) => {
            lastContent = accumulated;
            if (!controller.signal.aborted) {
              setStreaming({ placeholderId, content: accumulated });
            }
          }, sessionContext, priorMessages, webSearchEnabled);
        }

        if (controller.signal.aborted) return;

        const aiContent = question
          ? question.answer
          : lastContent || 'Something went wrong. Please try again.';

        const related = question
          ? questions.filter((q) => question.relatedQuestionIds.includes(q.id)).map((q) => q.summary)
          : [];

        const aiMsg: SessionMessage = {
          id: placeholderId,
          type: 'ai',
          content: aiContent,
          relatedKnowledge: isPostSession ? undefined : related,
          questionId: question?.id,
        };

        // Re-read sessionRef here (after all awaits) so we have the latest version,
        // which now includes the user message that handleSend persisted before calling us.
        // Reading sessionRef.current at the top of this function (before the first await)
        // captured a stale snapshot that predated the React state flush.
        const latest = sessionRef.current;
        // Persist to localStorage first — survives component unmount
        const updated: ChatSession = { ...latest, messages: [...latest.messages, aiMsg] };
        sessionService.save(updated);

        // Update React state — skip if aborted (component likely unmounted)
        if (!controller.signal.aborted) {
          setSession(updated);
          setStreaming(null);
        }

        // Generate an LLM title after the first exchange (fire-and-forget)
        if (!updated.title && !updated.origin) {
          void generateSessionTitle(userContent, aiContent).then((title) => {
            if (!title) return;
            const refreshed = sessionService.getById(updated.id);
            if (refreshed && !refreshed.title) {
              const titled = { ...refreshed, title };
              sessionService.save(titled);
              // Update state only if still on this session
              if (sessionRef.current.id === titled.id) {
                setSession(titled);
              }
            }
          });
        }
      } catch (error) {
        setStreaming(null);
        toast(error instanceof Error ? error.message : 'Failed to continue this conversation.', 'error');
      } finally {
        generatingRef.current = false;
      }
    },
    [askStreaming, questions, webSearchEnabled],
  );

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: SessionMessage = { id: newMsgId('u'), type: 'user', content };
      const placeholderId = newMsgId('ai');

      // Persist user message immediately so it survives navigation away
      const current = sessionRef.current;
      const updated: ChatSession = {
        ...current,
        messages: [...current.messages, userMsg],
      };
      sessionService.save(updated);
      setSession(updated);
      // Anchor view to the top of this user bubble — only fires once, never during streaming
      setAnchorMsgId(userMsg.id);

      await generateAiReply(content, placeholderId, updated.messages);
    },
    [generateAiReply],
  );

  // Auto-send a prompt passed via navigation state (e.g. from Home screen STT FAB).
  // Tracks the last processed prompt to avoid re-triggering on re-renders while
  // still firing for each NEW navigation-with-prompt (important since AskScreen
  // is always mounted and the mount-only [] pattern no longer works).
  const lastAutoPrompt = useRef<string | null>(null);
  useEffect(() => {
    if (location.pathname !== '/ask') return;
    const prompt = (location.state as { prompt?: string } | null)?.prompt?.trim();
    if (!prompt || prompt === lastAutoPrompt.current) return;
    lastAutoPrompt.current = prompt;
    // Clear nav state so back-navigation doesn't re-trigger
    window.history.replaceState({}, '');
    // Always open a fresh session so the derived title is written to a clean slate
    const fresh = startNewSession(sessionRef.current);
    setSession(fresh);
    void handleSend(prompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    const newContent = editingContent.trim();
    const placeholderId = newMsgId('ai');

    // Truncate messages at the edited user message (inclusive) and replace it
    const current = sessionRef.current;
    const idx = current.messages.findIndex((m) => m.id === editingMessageId);
    if (idx === -1) return;
    const truncated = current.messages.slice(0, idx);
    const editedMsg: SessionMessage = { id: newMsgId('u'), type: 'user', content: newContent };
    const updated: ChatSession = { ...current, messages: [...truncated, editedMsg] };
    sessionService.save(updated);
    setSession(updated);
    setAnchorMsgId(editedMsg.id);

    setEditingMessageId(null);
    setEditingContent('');

    await generateAiReply(newContent, placeholderId, updated.messages);
  }, [editingMessageId, editingContent, generateAiReply]);

  const handleRegenerateResponse = useCallback(async (aiMessageId: string) => {
    // Find the preceding user message content, remove the AI message, regenerate
    const current = sessionRef.current;
    const aiIdx = current.messages.findIndex((m) => m.id === aiMessageId);
    if (aiIdx === -1) return;
    const userMsg = aiIdx > 0 ? current.messages[aiIdx - 1] : null;
    if (!userMsg || userMsg.type !== 'user') return;

    const userContent = userMsg.content;
    const placeholderId = newMsgId('ai');

    const updated: ChatSession = {
      ...current,
      messages: current.messages.filter((m) => m.id !== aiMessageId),
    };
    sessionService.save(updated);
    setSession(updated);

    await generateAiReply(userContent, placeholderId, updated.messages);
  }, [generateAiReply]);

  const handleDeleteResponse = useCallback((aiMessageId: string) => {
    const current = sessionRef.current;
    const updated: ChatSession = {
      ...current,
      messages: current.messages.filter((m) => m.id !== aiMessageId),
    };
    sessionService.save(updated);
    setSession(updated);
    toast('Response deleted.', 'success');
  }, []);

  const handleNewChat = useCallback(() => {
    const newSession = startNewSession(sessionRef.current);
    setSession(newSession);
    setStreaming(null);
    setShowHistory(false);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    // Process the outgoing session before switching
    processSessionIfNeeded(sessionRef.current);
    sessionService.setActiveId(id);
    const loaded = sessionService.getById(id);
    if (loaded) {
      setSession(loaded);
      setStreaming(null);
    }
    setShowHistory(false);
  }, []);

  const handleFlagConfirm = useCallback((messageId: string) => {
    const current = sessionRef.current;
    const aiMsg = current.messages.find((m) => m.id === messageId);
    const questionId = aiMsg?.questionId;

    const msgs = current.messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    const toRemove = new Set([messageId]);
    if (idx > 0 && msgs[idx - 1].type === 'user') {
      toRemove.add(msgs[idx - 1].id);
    }
    const updated: ChatSession = {
      ...current,
      messages: msgs.filter((m) => !toRemove.has(m.id)),
    };
    sessionService.save(updated);
    setSession(updated);

    if (questionId) {
      void questionService.delete(questionId);
    }
    setConfirmFlagId(null);
    toast('Response removed from your data.', 'success');
  }, []);

  const handleQuestionOverride = useCallback((questionId: string, shouldSave: boolean) => {
    if (shouldSave) {
      // Remove the flag so the question becomes eligible for knowledge graph ingestion
      questionService.patchQuestion(questionId, { flagged: false });
      toast('Question saved to knowledge base', 'success');
    }
    // If not saving, keep as-is (flagged=true) — question won't ingest to knowledge graph
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
    <div style={{ height: 'calc(100dvh - var(--safe-area-top) - 80px - var(--safe-area-bottom))', display: 'flex', flexDirection: 'column', maxWidth: '448px', margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
      {/* Fixed Header */}
      <Header
        title={session.title || 'Ask'}
        centered
        left={
          <button
            onClick={() => { setShowHistory(true); setHistorySearch(''); }}
            title="History"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              color: 'var(--foreground)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Menu size={22} />
          </button>
        }
        right={
          <button
            onClick={handleNewChat}
            title="New Chat"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              color: 'var(--primary-40)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <SquarePen size={20} />
          </button>
        }
      />
      {/* Spacer for fixed header */}
      <div style={{ height: `${HEADER_HEIGHT}px`, flexShrink: 0 }} />

      {/* Messages */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 'calc(140px + var(--safe-area-bottom))' }}>
        {session.origin?.type === 'post' && (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px 14px',
              borderRadius: '18px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-variant)',
            }}
          >
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
              Post thread
            </p>
            <p style={{ fontWeight: 700, marginBottom: '4px' }}>{session.origin.postTitle}</p>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
              Continuing from a post-origin Q&A thread.
            </p>
          </div>
        )}
        {/* Welcome message + suggested prompts when session is empty */}
        {displayMessages.length === 0 && (
          <>
            <ChatMessage
              messageId="welcome"
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
                    onPointerEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-40)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-90)';
                    }}
                    onPointerLeave={(e) => {
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
                        onPointerEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary-40)';
                          e.currentTarget.style.backgroundColor = 'var(--surface-container-high)';
                        }}
                        onPointerLeave={(e) => {
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
          <div key={message.id} data-msg-id={message.id}>
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
              questionId={message.questionId}
              flagged={message.type === 'ai' ? questions.find((q) => q.id === message.questionId)?.flagged : undefined}
              onQuestionOverride={handleQuestionOverride}
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
                      aria-label="Cancel"
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                    <button
                      onClick={() => handleFlagConfirm(message.id)}
                      title="Confirm remove"
                      aria-label="Confirm remove"
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--danger)', background: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmFlagId(message.id)}
                    title="Flag this response"
                    aria-label="Flag this response"
                    style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', opacity: 0.45, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}
                  >
                    <Flag size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <ChatInput
        onSend={handleSend}
        placeholder="Ask anything..."
        disabled={!!streaming || editingMessageId !== null}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={() => setWebSearchEnabled(prev => !prev)}
      />

      {/* History drawer — slides in from left */}
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
              animation: 'fade-in 0.2s ease',
            }}
          />
          {/* Drawer */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '80%',
              maxWidth: '320px',
              height: '100%',
              backgroundColor: 'var(--surface)',
              boxShadow: 'var(--shadow-3)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slide-in-left 0.25s ease',
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                padding: 'calc(var(--safe-area-top) + 16px) 16px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>History</h2>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                }}
                aria-label="Close history"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search bar */}
            <div style={{ padding: '0 16px 8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-variant)',
                  border: '1px solid var(--border)',
                }}
              >
                <Search size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'none',
                    outline: 'none',
                    fontSize: '0.875rem',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* New Chat button */}
            <div style={{ padding: '4px 16px 8px' }}>
              <button
                onClick={handleNewChat}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary-40)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <SquarePen size={16} />
                New Chat
              </button>
            </div>

            {/* Session list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {historySessions.length === 0 ? (
                <p style={{ padding: '16px', color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center' }}>
                  No chat history yet.
                </p>
              ) : (
                historySessions
                  .filter((s) => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase();
                    return (
                      (s.title?.toLowerCase().includes(q)) ||
                      s.messages.some((m) => m.content.toLowerCase().includes(q))
                    );
                  })
                  .map((s) => (
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
                          {s.origin?.type === 'post' ? ' · post thread' : ''}
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
