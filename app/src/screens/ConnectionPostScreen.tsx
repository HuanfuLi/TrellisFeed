import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import type { ChatSession, DailyPost, Question, SessionMessage } from '../types';
import { conceptFeedService } from '../services/concept-feed.service';
import { questionService } from '../services/question.service';
import { sessionService } from '../services/session.service';
import { postContextQaService } from '../services/post-context-qa.service';
import { Markdown } from '../components/Markdown';
import { ChatMessage } from '../components/ChatMessage';
import { toast } from '../lib/toast';
import { useQuestions } from '../state/useQuestions';

interface LocationState {
  questionA: Question;
  questionB: Question;
  conceptNounA: string;
  conceptNounB: string;
}

let msgIdCounter = 0;
function newMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgIdCounter}`;
}

export function ConnectionPostScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { idA, idB } = useParams<{ idA: string; idB: string }>();
  const state = (location.state as LocationState | null);
  const { questions } = useQuestions();

  const [post, setPost] = useState<DailyPost | null>(null);
  const [streaming, setStreaming] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Q&A section state
  const [session, setSession] = useState<ChatSession | null>(null);
  const [qaStreaming, setQaStreaming] = useState('');
  const [input, setInput] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const conceptNounA = state?.conceptNounA ?? 'Concept A';
  const conceptNounB = state?.conceptNounB ?? 'Concept B';

  useEffect(() => {
    if (!idA || !idB) return;

    // Check cache first
    const postId = `conn-${idA}-${idB}`;
    const cached = conceptFeedService.getPostById(postId);
    if (cached) {
      setPost(cached);
      setSession(sessionService.getOrCreatePostSession(cached, questionsRef.current));
      return;
    }

    // Resolve questions
    const allQuestions = questionService.getAll();
    const qA = state?.questionA ?? allQuestions.find((q) => q.id === idA) ?? null;
    const qB = state?.questionB ?? allQuestions.find((q) => q.id === idB) ?? null;
    if (!qA || !qB) {
      setError('Could not find the concepts for this connection.');
      return;
    }

    abortRef.current = false;
    setIsGenerating(true);
    setError(null);

    void (async () => {
      let accumulated = '';
      try {
        for await (const chunk of conceptFeedService.generateConnectionPost(qA, qB, conceptNounA, conceptNounB)) {
          if (abortRef.current) return;
          accumulated += chunk;
          setStreaming(accumulated);
        }
        if (abortRef.current) return;
        const saved = conceptFeedService.saveConnectionPost(qA, qB, conceptNounA, conceptNounB, accumulated);
        conceptFeedService.setConnectionPostId(idA, idB, saved.id);
        setPost(saved);
        setSession(sessionService.getOrCreatePostSession(saved, questionsRef.current));
        setStreaming('');
      } catch (err) {
        if (!abortRef.current) {
          setError(err instanceof Error ? err.message : 'Generation failed. Check your AI settings.');
        }
      } finally {
        if (!abortRef.current) setIsGenerating(false);
      }
    })();

    return () => { abortRef.current = true; };
  }, [idA, idB]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll when Q&A messages arrive
  const initialMsgCount = useRef<number | null>(null);
  useEffect(() => {
    const count = session?.messages.length ?? 0;
    if (initialMsgCount.current === null) {
      initialMsgCount.current = count;
      return;
    }
    if (count > initialMsgCount.current || qaStreaming) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, qaStreaming]);

  const handleRetry = () => {
    setError(null);
    setStreaming('');
    setPost(null);
    navigate(0);
  };

  const handleAsk = async (content: string) => {
    if (!content.trim() || !post || !session) return;

    const userMsg: SessionMessage = { id: newMsgId('u'), type: 'user', content: content.trim() };
    const nextSession: ChatSession = { ...session, messages: [...session.messages, userMsg] };
    setSession(nextSession);
    sessionService.save(nextSession);
    sessionService.setActiveId(nextSession.id);
    setInput('');
    setQaStreaming('');

    try {
      let accumulated = '';
      for await (const token of postContextQaService.askStreaming(nextSession.origin!.context, userMsg.content)) {
        accumulated += token;
        setQaStreaming(accumulated);
      }

      const aiMsg: SessionMessage = {
        id: newMsgId('ai'),
        type: 'ai',
        content: accumulated || 'Something went wrong. Please try again.',
      };
      const updated: ChatSession = { ...nextSession, messages: [...nextSession.messages, aiMsg] };
      setSession(updated);
      sessionService.save(updated);
      setQaStreaming('');
    } catch (err) {
      setQaStreaming('');
      toast(err instanceof Error ? err.message : 'Failed to ask about this post.', 'error');
    }
  };

  const bodyText = post?.bodyMarkdown ?? streaming;
  const quickAskPrompts = post?.quickAskPrompts ?? [];
  const qaMessages = session?.messages ?? [];

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'var(--surface)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: 'calc(12px + var(--safe-area-top)) 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', display: 'flex', padding: '4px' }}
        >
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '1px' }}>
            Connection
          </p>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conceptNounA} &amp; {conceptNounB}
          </p>
        </div>
        {isGenerating && (
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--muted-foreground)', flexShrink: 0 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '24px 16px 96px', maxWidth: '640px', margin: '0 auto' }}>
        {/* Concept pill row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[conceptNounA, conceptNounB].map((noun, i) => (
            <span
              key={i}
              style={{
                padding: '6px 16px',
                borderRadius: '100px',
                backgroundColor: i === 0 ? 'var(--node-mint)' : 'var(--node-sky)',
                color: 'var(--foreground)',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              {noun}
            </span>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            padding: '20px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid #E53935',
            backgroundColor: '#FFEBEE',
            marginBottom: '16px',
          }}>
            <p style={{ color: '#B71C1C', fontWeight: 600, marginBottom: '8px' }}>Generation failed</p>
            <p style={{ color: '#C62828', fontSize: '0.875rem', marginBottom: '16px' }}>{error}</p>
            <button
              onClick={handleRetry}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                backgroundColor: '#E53935',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Streaming / rendered body */}
        {bodyText ? (
          <div style={{
            backgroundColor: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            padding: '24px 20px',
            boxShadow: 'var(--shadow-1)',
            marginBottom: '20px',
          }}>
            <Markdown>{bodyText}</Markdown>
            {isGenerating && (
              <span style={{ display: 'inline-block', width: '2px', height: '1em', backgroundColor: 'var(--primary-40)', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom', marginLeft: '2px' }} />
            )}
          </div>
        ) : isGenerating ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {[80, 60, 72, 50].map((w, i) => (
              <div key={i} style={{ height: '16px', borderRadius: '8px', backgroundColor: 'var(--surface-variant)', width: `${w}%`, animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : null}

        {/* Q&A section — only shown once the post is fully generated */}
        {post && (
          <section
            style={{
              borderRadius: '20px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
              boxShadow: 'var(--shadow-1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--surface-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <MessageSquare size={17} color="var(--primary-40)" />
                <h2 style={{ fontSize: '1rem' }}>Ask this post</h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickAskPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void handleAsk(prompt)}
                    disabled={Boolean(qaStreaming)}
                    style={{
                      padding: '7px 11px',
                      borderRadius: '999px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface-variant)',
                      color: 'var(--foreground)',
                      cursor: qaStreaming ? 'not-allowed' : 'pointer',
                      opacity: qaStreaming ? 0.6 : 1,
                      fontSize: '0.85rem',
                      lineHeight: 1.35,
                      textAlign: 'left',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {qaMessages.length === 0 && !qaStreaming && (
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.86rem', lineHeight: 1.55 }}>
                  Ask a follow-up about this comparison, or challenge a claim in the essay.
                </p>
              )}

              {qaMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  messageId={message.id}
                  type={message.type}
                  content={message.content}
                  relatedKnowledge={message.relatedKnowledge}
                />
              ))}

              {qaStreaming && (
                <ChatMessage
                  messageId="streaming"
                  type="ai"
                  content={qaStreaming}
                />
              )}

              <div ref={threadEndRef} />
            </div>

            <div style={{ padding: '0 14px 14px' }}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAsk(input);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={2}
                  placeholder="Ask a follow-up about this connection..."
                  disabled={Boolean(qaStreaming)}
                  style={{
                    flex: 1,
                    resize: 'vertical',
                    minHeight: '84px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--border)',
                    backgroundColor: 'var(--surface-variant)',
                    color: 'var(--foreground)',
                    padding: '12px 13px',
                    fontSize: '0.95rem',
                    lineHeight: 1.45,
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || Boolean(qaStreaming)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: 'var(--primary-40)',
                    color: 'white',
                    cursor: !input.trim() || qaStreaming ? 'not-allowed' : 'pointer',
                    opacity: !input.trim() || qaStreaming ? 0.5 : 1,
                  }}
                >
                  Ask
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
