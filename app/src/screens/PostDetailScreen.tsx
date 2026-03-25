import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import type { ChatSession, DailyPost, Question, SessionMessage } from '../types';
import { useQuestions } from '../state/useQuestions';
import { conceptFeedService } from '../services/concept-feed.service';
import { sessionService } from '../services/session.service';
import { postContextQaService } from '../services/post-context-qa.service';
import { Markdown } from '../components/Markdown';
import { ChatMessage } from '../components/ChatMessage';
import { toast } from '../lib/toast';

interface ConnectionMeta {
  questionA: Question;
  questionB: Question;
  conceptNounA: string;
  conceptNounB: string;
}

let msgIdCounter = 0;
function newMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgIdCounter}`;
}

export function PostDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { questions } = useQuestions();

  const locationState = location.state as { post?: DailyPost; connectionMeta?: ConnectionMeta } | null;
  const passedPost = locationState?.post ?? null;
  // connectionMeta is stable per navigation — read once via ref so the generation
  // effect does not re-fire when the parent re-renders.
  const connectionMetaRef = useRef<ConnectionMeta | null>(locationState?.connectionMeta ?? null);

  const [post, setPost] = useState<DailyPost | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);

  // Essay generation state (connection posts only)
  const [essayStreaming, setEssayStreaming] = useState('');
  const [isGeneratingEssay, setIsGeneratingEssay] = useState(false);
  const [essayError, setEssayError] = useState<string | null>(null);
  const generateAbortRef = useRef(false);

  // Q&A streaming state
  const [qaStreaming, setQaStreaming] = useState('');
  const [input, setInput] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Use a ref for questions so session creation always has the latest value
  // without re-triggering the post-loading effect.
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  useEffect(() => {
    if (!id) return;

    // Abort any in-progress connection essay generation from a prior navigation.
    generateAbortRef.current = true;
    generateAbortRef.current = false;
    setEssayError(null);
    setEssayStreaming('');
    setLoadingPost(true);

    const loaded = conceptFeedService.getPostById(id) ?? passedPost;
    if (loaded) {
      setPost(loaded);
      setLoadingPost(false);
      setSession(sessionService.getOrCreatePostSession(loaded, questionsRef.current));
      return;
    }

    // Post not in cache — if connection metadata was passed, generate the essay here
    // so the user lands in PostDetailScreen with full Q&A capability.
    const meta = connectionMetaRef.current;
    if (meta) {
      setLoadingPost(false);
      setIsGeneratingEssay(true);

      void (async () => {
        let accumulated = '';
        try {
          for await (const chunk of conceptFeedService.generateConnectionPost(
            meta.questionA,
            meta.questionB,
            meta.conceptNounA,
            meta.conceptNounB,
          )) {
            if (generateAbortRef.current) return;
            accumulated += chunk;
            setEssayStreaming(accumulated);
          }
          if (generateAbortRef.current) return;
          const saved = conceptFeedService.saveConnectionPost(
            meta.questionA,
            meta.questionB,
            meta.conceptNounA,
            meta.conceptNounB,
            accumulated,
          );
          conceptFeedService.setConnectionPostId(meta.questionA.id, meta.questionB.id, saved.id);
          setPost(saved);
          setSession(sessionService.getOrCreatePostSession(saved, questionsRef.current));
          setEssayStreaming('');
        } catch (err) {
          if (!generateAbortRef.current) {
            setEssayError(err instanceof Error ? err.message : 'Generation failed. Check your AI settings.');
          }
        } finally {
          if (!generateAbortRef.current) setIsGeneratingEssay(false);
        }
      })();

      return () => { generateAbortRef.current = true; };
    }

    setPost(null);
    setLoadingPost(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- passedPost and connectionMeta are stable per navigation

  // Track initial Q&A message count so we only auto-scroll on NEW messages, not on mount
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

  const quickAskPrompts = useMemo(() => post?.quickAskPrompts ?? [], [post]);

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
    } catch (error) {
      setQaStreaming('');
      toast(error instanceof Error ? error.message : 'Failed to ask about this post.', 'error');
    }
  };

  if (loadingPost) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading post...
      </div>
    );
  }

  // Connection essay is being generated — show streaming content before the Q&A section is ready.
  if (isGeneratingEssay || essayError) {
    const meta = connectionMetaRef.current;
    return (
      <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
        <button onClick={() => navigate('/home')} style={{ background: 'none', padding: '4px 2px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.95rem' }}>
          <ArrowLeft size={18} />
          Back to Home
        </button>

        {/* Concept pills */}
        {meta && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[meta.conceptNounA, meta.conceptNounB].map((noun, i) => (
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
        )}

        {essayError ? (
          <div style={{ padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid #E53935', backgroundColor: '#FFEBEE', marginBottom: '16px' }}>
            <p style={{ color: '#B71C1C', fontWeight: 600, marginBottom: '8px' }}>Generation failed</p>
            <p style={{ color: '#C62828', fontSize: '0.875rem', marginBottom: '16px' }}>{essayError}</p>
            <button
              onClick={() => { setEssayError(null); navigate(0); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius)', backgroundColor: '#E53935', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: '24px 20px', boxShadow: 'var(--shadow-1)' }}>
            {essayStreaming ? (
              <>
                <Markdown>{essayStreaming}</Markdown>
                <span style={{ display: 'inline-block', width: '2px', height: '1em', backgroundColor: 'var(--primary-40)', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom', marginLeft: '2px' }} />
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[80, 60, 72, 50].map((w, i) => (
                  <div key={i} style={{ height: '16px', borderRadius: '8px', backgroundColor: 'var(--surface-variant)', width: `${w}%`, animation: 'skeleton-pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button onClick={() => navigate('/home')} style={{ background: 'none', padding: 0, color: 'var(--primary-40)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={18} />
          Back to Home
        </button>
        <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>Post not found</h2>
        <p style={{ color: 'var(--muted-foreground)' }}>This post is no longer available in the current daily feed.</p>
      </div>
    );
  }

  const messages = session?.messages ?? [];
  const isConnectionPost = post.sourceType === 'connection';
  const meta = connectionMetaRef.current;

  return (
    <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
      <button onClick={() => navigate('/home')} style={{ background: 'none', padding: '4px 2px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.95rem' }}>
        <ArrowLeft size={18} />
        Back to Home
      </button>

      {/* Concept pills — shown for connection posts */}
      {isConnectionPost && meta && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[meta.conceptNounA, meta.conceptNounB].map((noun, i) => (
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
      )}

      <article
        style={{
          borderRadius: '22px',
          padding: '20px 16px',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-90) 70%, white), var(--card))',
          boxShadow: 'var(--shadow-2)',
          border: '1px solid color-mix(in srgb, var(--primary-40) 18%, var(--border))',
          marginBottom: '14px',
          userSelect: 'text',
          WebkitTouchCallout: 'default',
        }}
      >
        <p style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
          {post.contextLabel} · {post.narrativeMode}
        </p>
        <h1 style={{ fontSize: '1.55rem', lineHeight: 1.12, marginBottom: '12px', textWrap: 'balance' }}>{post.title}</h1>
        <p style={{ fontSize: '0.98rem', lineHeight: 1.62, color: 'var(--foreground)', marginBottom: '16px' }}>{post.whyCare}</p>
        <Markdown>{post.bodyMarkdown}</Markdown>
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '16px',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
            Takeaway
          </p>
          <p style={{ lineHeight: 1.65 }}>{post.takeaway}</p>
        </div>
      </article>

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
          {messages.length === 0 && !qaStreaming && (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.86rem', lineHeight: 1.55 }}>
              {isConnectionPost
                ? 'Ask a follow-up about this comparison, challenge a claim, or connect it to something else you have been learning.'
                : 'Ask for an example, challenge the claim, or connect this post to something else you have been learning.'}
            </p>
          )}

          {messages.map((message) => (
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
              placeholder={isConnectionPost ? 'Ask a follow-up about this connection...' : 'Ask a follow-up about this post...'}
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
    </div>
  );
}
