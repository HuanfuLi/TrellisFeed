import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, SquarePen, Trash2, Flag, X, Check, Search } from 'lucide-react';
import i18n from '../locales';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { useQuestions } from '../state/useQuestions';
import { sessionService } from '../services/session.service';
import { flashcardService } from '../services/flashcard.service';
import { conceptFeedService } from '../services/concept-feed.service';
import { infiniteScrollService } from '../services/infiniteScroll.service';
import type { ChatSession, Question, SessionMessage } from '../types';
import { formatDate } from '../lib/date';
// NOTE: AskScreen uses questionService.askStreaming() (via useQuestions) exclusively for Q&A.
// The non-streaming ask() method is available as a fallback but is not invoked from this screen.
// Session context is passed to askStreaming() for accurate follow-up filtering (see generateAiReply).
import { questionService } from '../services/question.service';
import { postContextQaService } from '../services/post-context-qa.service';
import { classifyAndAnchorIncremental } from '../services/canonical-knowledge.service';
import { chatCompletion } from '../providers/llm';
import { settingsService } from '../services/settings.service';
import { getRateLimitStatus, type RateLimitStatus } from '../services/ask-rate-limiter.service';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';

const SUGGESTED_PROMPT_KEYS = [
  'ask.suggestedPrompts.spacedRepetition',
  'ask.suggestedPrompts.feynman',
  'ask.suggestedPrompts.dailyHabit',
  'ask.suggestedPrompts.retention',
] as const;

// ── Phase 28 Plan 03 — D-15 / D-16 pure helpers ────────────────────────────
//
// Extracted at module scope so Wave 0 tests (AskScreen.recent.test.mjs) can
// contract-test them without a DOM render. Consumed by the recent-questions
// section below (D-15 empty-state + D-16 active-squish press feedback).

/** Marker returned by renderRecentQuestionsMarker — describes which branch of
 *  the recent-questions render tree the JSX should walk. */
export interface RecentQuestionsMarker {
  kind: 'empty' | 'list';
  i18nKey?: 'ask.recentQuestionsEmpty' | 'ask.recentQuestions';
  count?: number;
}

/** D-15-LOGIC: return an empty-state marker referencing the i18n key
 *  `ask.recentQuestionsEmpty` when there are no recent questions; otherwise
 *  return a list marker carrying the count. The JSX below consumes this to
 *  decide which branch to render. */
export const renderRecentQuestionsMarker = (
  questions: Array<{ id: string; content: string }>,
): RecentQuestionsMarker => {
  if (questions.length === 0) return { kind: 'empty', i18nKey: 'ask.recentQuestionsEmpty' };
  return { kind: 'list', count: questions.length };
};

/** D-16: compose the className for a recent-question row. Interactive rows
 *  receive `active-squish` for the scale-0.96 press-feedback utility defined
 *  in index.css:336-342. Non-interactive rows (hypothetical placeholders,
 *  skeletons) skip it. */
export const buildRowClassName = ({ interactive }: { interactive: boolean }): string => {
  const base = 'ask-recent-row';
  return interactive ? `${base} active-squish` : base;
};

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
  // Read latest from localStorage to avoid stale React state (processed flag
  // is set in localStorage but setSession is not called after processing)
  const latest = sessionService.getById(session.id) ?? session;
  if (
    !latest.processed &&
    latest.messages.some((m) => m.type === 'user') &&
    !processingSessionIds.has(latest.id)
  ) {
    processingSessionIds.add(latest.id);
    void flashcardService.processSession(latest).then(() => {
      const refreshed = sessionService.getById(latest.id);
      if (refreshed) {
        sessionService.save({ ...refreshed, processed: true });
      }
    }).finally(() => {
      processingSessionIds.delete(latest.id);
    });
  }
}

/**
 * Generate session-based posts in background and enqueue for swipe-to-load.
 * Tracked separately from flashcard processing — uses its own Set to avoid
 * duplicate generation without being blocked by session.processed.
 */
// Track session ID + message count to detect new messages in the same session
const postGeneratedSessionKeys = new Set<string>();
function generateSessionPostsIfNeeded(session: ChatSession): void {
  const key = `${session.id}:${session.messages.length}`;
  if (
    !session.messages.some((m) => m.type === 'user') ||
    postGeneratedSessionKeys.has(key)
  ) return;

  postGeneratedSessionKeys.add(key);

  void conceptFeedService.generateSessionPosts(session).then((posts) => {
    if (posts.length > 0) {
      infiniteScrollService.enqueuePosts(posts);
    }
  }).catch(() => { /* silent — feed still works without session posts */ });
}

function startNewSession(current: ChatSession): ChatSession {
  processSessionIfNeeded(current);
  generateSessionPostsIfNeeded(current);
  return sessionService.createNew();
}

export function AskScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { askStreaming, questions } = useQuestions();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [anchorMsgId, setAnchorMsgId] = useState<string | null>(null);

  const [session, setSession] = useState<ChatSession>(() => sessionService.getActive());
  const [streaming, setStreaming] = useState<StreamingOverlay | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyClosing, setHistoryClosing] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [confirmFlagId, setConfirmFlagId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>(() => {
    const limit = settingsService.getSync().preferences.askMonthlyLimit ?? 0;
    return getRateLimitStatus(limit);
  });

  const refreshRateLimit = useCallback(() => {
    const limit = settingsService.getSync().preferences.askMonthlyLimit ?? 0;
    setRateLimitStatus(getRateLimitStatus(limit));
  }, []);

  // Keep session ref in sync for use in callbacks without stale closure
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Process the current session on unmount (app close / full navigation away).
  // For always-mounted AskScreen, this rarely fires — the primary triggers are
  // startNewSession and handleSelectSession which explicitly call both functions.
  useEffect(() => {
    return () => {
      processSessionIfNeeded(sessionRef.current);
      generateSessionPostsIfNeeded(sessionRef.current);
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

  const closeHistory = () => {
    setHistoryClosing(true);
    setTimeout(() => { setShowHistory(false); setHistoryClosing(false); }, 200);
  };

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
          // feed into Knowledge Graph, Review, and Podcast surfaces.
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

        // Phase 47 D-01 / D-02 — askStreaming returns a sentinel
        // { kind: 'malicious-block', content } instead of a Question on the
        // malicious branch so we can stamp the discriminator onto the persisted
        // SessionMessage. ChatMessage reads `kind` to pick the neutral
        // rejection render (no override button) instead of the markdown body.
        const isMaliciousBlock = !!question && typeof question === 'object' && 'kind' in question && question.kind === 'malicious-block';
        const persistedQuestion = isMaliciousBlock ? null : (question as Question | null);

        const aiContent = persistedQuestion
          ? persistedQuestion.answer
          : lastContent || t('ask.genericError');

        const related = persistedQuestion
          ? questions.filter((q) => persistedQuestion.relatedQuestionIds.includes(q.id)).map((q) => q.summary)
          : [];

        const aiMsg: SessionMessage = {
          id: placeholderId,
          type: 'ai',
          content: aiContent,
          relatedKnowledge: isPostSession ? undefined : related,
          questionId: persistedQuestion?.id,
          kind: isMaliciousBlock ? 'malicious-block' : undefined,
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
        toast(error instanceof Error ? error.message : t('ask.streamFailed'), 'error');
      } finally {
        generatingRef.current = false;
      }
    },
    [askStreaming, questions, webSearchEnabled, t],
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
      refreshRateLimit();
    },
    [generateAiReply, refreshRateLimit],
  );

  // Auto-send a prompt passed via navigation state (e.g. from Home screen STT FAB).
  // Tracks the last processed prompt to avoid re-triggering on re-renders while
  // still firing for each NEW navigation-with-prompt (important since AskScreen
  // is always mounted and the mount-only [] pattern no longer works).
  const lastAutoPrompt = useRef<string | null>(null);
  useEffect(() => {
    if (location.pathname !== '/ask') return;
    const stateObj = location.state as { prompt?: string; autoSend?: string } | null;
    const prompt = (stateObj?.prompt ?? stateObj?.autoSend)?.trim();
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
    toast(i18n.t('ask.responseDeleted'), 'success');
  }, []);

  const handleNewChat = useCallback(() => {
    const newSession = startNewSession(sessionRef.current);
    setSession(newSession);
    setStreaming(null);
    closeHistory();
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    // Process the outgoing session before switching
    processSessionIfNeeded(sessionRef.current);
    generateSessionPostsIfNeeded(sessionRef.current);
    sessionService.setActiveId(id);
    const loaded = sessionService.getById(id);
    if (loaded) {
      setSession(loaded);
      setStreaming(null);
    }
    closeHistory();
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
    toast(i18n.t('ask.responseRemoved'), 'success');
  }, []);

  const handleQuestionOverride = useCallback((questionId: string, shouldSave: boolean) => {
    if (shouldSave) {
      // Remove the flag so the question becomes eligible for knowledge graph ingestion
      questionService.patchQuestion(questionId, { flagged: false });
      toast(i18n.t('ask.questionSaved'), 'success');

      // Phase 47 D-06 — fire classification so the un-flagged question enters
      // the mind map. patchQuestion only flips the flag; without this re-fire
      // the question is "visible to consumers" but lacks anchorId / branchLabel
      // / clusterLabel / embeddingVector so it doesn't appear in the right
      // place. See 47-RESEARCH.md §"D-06 Gap Closure" + §"Pattern 4".
      const question = questionService.getAll({ includeFlagged: true }).find(q => q.id === questionId);
      if (!question) return;

      const settings = settingsService.getSync();
      if (!settings.llm.isConfigured) {
        // RESEARCH Pitfall 4 — graceful skip on unconfigured LLM (no toast;
        // user already saw the success toast for the override itself).
        console.warn('[Trellis] override classifyAndAnchorIncremental skipped: llm not configured');
        return;
      }

      // Fire-and-forget; mirrors useQuestions.ts:373-375 pattern. NO abort
      // signal — user-initiated override is synchronous from the user's
      // perspective; LOCALE_CHANGED cancellation isn't a concern
      // (RESEARCH §"Pattern 4" line 510). commitClassificationResult inside
      // canonical-knowledge.service.ts emits GRAPH_UPDATED at the end —
      // subscribers (GraphScreen, PrunedSection, useTrellisData,
      // useQuestions) re-read from store automatically. Do NOT emit
      // eventBus.emit('GRAPH_UPDATED') here — would double-fire.
      void classifyAndAnchorIncremental(
        question,
        questionService.getAll(),
        settings.llm,
      ).catch((err: unknown) => {
        console.warn('[Trellis] override classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
      });
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
    <div style={{ height: 'calc(100dvh - var(--safe-area-top) - var(--bottom-nav-height))', display: 'flex', flexDirection: 'column', maxWidth: '448px', margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
      {/* Fixed Header */}
      <Header
        title={session.title || t('ask.title')}
        centered
        left={
          <button
            onClick={() => { if (showHistory) { closeHistory(); } else { setShowHistory(true); setHistorySearch(''); } }}
            title={t('ask.historyButtonTitle')}
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
            title={t('ask.newChatTitle')}
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
      {/* Phase 33 UAT-4 fix (2026-04-20): overscrollBehavior: 'contain' +
          WebkitOverflowScrolling: 'touch' are required on every scrollable
          region in this app. Without 'contain', the default `auto` fires
          the native elastic bounce at scroll boundaries; the bounce
          absorbs the first reversing swipe after a boundary hit, so users
          need two gestures to change scroll direction — the "swipe down
          twice to go back down" symptom. All other scroll containers in
          the app already use this pair (App.tsx:155-156, HomeScreen,
          InfoFlow). AskScreen was the lone outlier. */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '16px', touchAction: 'pan-y', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
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
              {t('ask.postThread')}
            </p>
            <p style={{ fontWeight: 700, marginBottom: '4px' }}>{session.origin.postTitle}</p>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
              {t('ask.postThreadContinuing')}
            </p>
          </div>
        )}
        {/* Welcome message + suggested prompts when session is empty */}
        {displayMessages.length === 0 && (
          <>
            <ChatMessage
              messageId="welcome"
              type="ai"
              content={t('ask.welcome')}
              relatedKnowledge={[]}
              onKnowledgeClick={() => { }}
            />
            <div style={{ padding: '4px 4px 0' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '10px', paddingLeft: '4px' }}>
                {t('ask.tryAsking')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {SUGGESTED_PROMPT_KEYS.map((promptKey) => {
                  const prompt = t(promptKey);
                  return (
                  <button
                    key={promptKey}
                    onClick={() => void handleSend(prompt)}
                    style={{
                      textAlign: 'left',
                      // Phase 28 D-28 — 11px → 12px on the 4-grid.
                      padding: '12px 16px',
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
                  );
                })}
              </div>

              {/* Phase 28 D-15 — recent-questions section: <button> rows with
                  2-line clamp, empty-state via ask.recentQuestionsEmpty, D-28
                  padding 12px 16px, D-16 active-squish press feedback via
                  buildRowClassName. renderRecentQuestionsMarker drives the
                  branch — Wave 0 tests in AskScreen.recent.test.mjs cover the
                  pure-helper contracts. */}
              {(() => {
                const marker = renderRecentQuestionsMarker(questions);
                if (marker.kind === 'empty' && marker.i18nKey) {
                  return (
                    <p style={{
                      fontSize: '0.82rem',
                      color: 'var(--muted-foreground)',
                      paddingLeft: '4px',
                      marginTop: '8px',
                    }}>
                      {t(marker.i18nKey)}
                    </p>
                  );
                }
                return (
                  <>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '10px', paddingLeft: '4px' }}>
                      {t('ask.recentQuestions')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {questions.slice(0, 3).map((q) => (
                        <button
                          key={q.id}
                          onClick={() => navigate(`/ask/${q.id}`)}
                          className={buildRowClassName({ interactive: true })}
                          style={{
                            textAlign: 'left',
                            // Phase 28 D-28 — 11px → 12px on the 4-grid (completes
                            // the deferred fix from Plan 28-01 Task 3; D-15 button
                            // refactor was the scheduled vehicle per UI-SPEC).
                            padding: '12px 16px',
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
                            gap: '8px',
                            minHeight: '44px',
                            width: '100%',
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
                          {/* D-15: bullet '• ' prefix removed (no leading icon per
                              UI-SPEC). 2-line clamp via WebkitLineClamp replaces
                              the prior single-line ellipsis. */}
                          <span style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {q.content}
                          </span>
                          <span style={{ fontSize: '1.2rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>→</span>
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
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
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{t('ask.responseRemovedConfirmPrompt')}</span>
                    <button
                      onClick={() => setConfirmFlagId(null)}
                      title={t('ask.cancelAria')}
                      aria-label={t('ask.cancelAria')}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={14} />
                    </button>
                    <button
                      onClick={() => handleFlagConfirm(message.id)}
                      title={t('ask.confirmRemoveAria')}
                      aria-label={t('ask.confirmRemoveAria')}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--danger)', background: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmFlagId(message.id)}
                    title={t('ask.flagTitle')}
                    aria-label={t('ask.flagTitle')}
                    // Phase 28 D-29 — WCAG 2.5.8 44×44 minimum touch target.
                    // Visible Flag icon stays 12px; justifyContent centers it.
                    style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', opacity: 0.45, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px', gap: '3px', fontSize: '0.7rem' }}
                  >
                    <Flag size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {rateLimitStatus.nearLimit && (
        <div style={{
          padding: '8px 16px',
          margin: '0 16px 8px',
          borderRadius: 'var(--radius-xl)',
          fontSize: '0.8rem',
          lineHeight: 1.4,
          background: rateLimitStatus.canAsk ? 'var(--warning-surface, #fff3cd)' : 'var(--error-surface, #f8d7da)',
          color: rateLimitStatus.canAsk ? 'var(--warning-text, #856404)' : 'var(--error-text, #721c24)',
          border: `1px solid ${rateLimitStatus.canAsk ? 'var(--warning-border, #ffeeba)' : 'var(--error-border, #f5c6cb)'}`,
        }}>
          {rateLimitStatus.canAsk
            ? t('ask.rateLimitApproaching', { count: rateLimitStatus.count, limit: settingsService.getSync().preferences.askMonthlyLimit ?? 0, resetDate: rateLimitStatus.resetDate })
            : t('ask.rateLimitReached', { resetDate: rateLimitStatus.resetDate })}
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        placeholder={t('ask.inputPlaceholder')}
        disabled={!!streaming || editingMessageId !== null || !rateLimitStatus.canAsk}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={() => setWebSearchEnabled(prev => !prev)}
      />

      {/* History drawer — slides in from left */}
      {showHistory && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeHistory}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 40,
              animation: historyClosing ? 'fade-out 0.2s ease forwards' : 'fade-in 0.2s ease',
            }}
          />
          {/* Drawer */}
          <div
            style={{
              position: 'absolute',
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
              animation: historyClosing ? 'slide-out-left 0.2s ease forwards' : 'slide-in-left 0.25s ease',
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('ask.historyTitle')}</h2>
              <button
                onClick={closeHistory}
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
                aria-label={t('ask.closeHistoryAria')}
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
                  placeholder={t('ask.searchChatsPlaceholder')}
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
                {t('ask.newChatButton')}
              </button>
            </div>

            {/* Session list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {historySessions.length === 0 ? (
                <p style={{ padding: '16px', color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center' }}>
                  {t('ask.noHistory')}
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
                          {s.title || t('ask.newConversation')}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                          {formatDate(s.updatedAt)} · {s.messages.length === 1 ? t('ask.messageCountOne', { count: s.messages.length }) : t('ask.messageCountOther', { count: s.messages.length })}
                          {s.origin?.type === 'post' ? t('ask.postThreadSuffix') : ''}
                        </p>
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        title={t('ask.deleteConversationTitle')}
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
