import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { DetailMenu } from '../components/DetailMenu';
import type { ChatSession, DailyPost, GeneratedImage, Question, SessionMessage } from '../types';
import { useQuestions } from '../state/useQuestions';
import { conceptFeedService } from '../services/concept-feed.service';
import { imageGenerationService } from '../services/imageGeneration.service';
import { sessionService } from '../services/session.service';
import { postContextQaService } from '../services/post-context-qa.service';
import { Markdown } from '../components/Markdown';
import { ChatMessage } from '../components/ChatMessage';
import { PostCarousel } from '../components/PostCarousel';
import { YouTubeEmbed } from '../components/YouTubeEmbed';
import { toast } from '../lib/toast';
import { parseMoveNavigationState } from '../lib/moveNavigator';
import { inferImageStyle, buildImagePrompt } from '../services/postFormatting.service';
import { normalizePlainText } from '../lib/text-normalization';

interface ConnectionMeta {
  questionA: Question;
  questionB: Question;
  conceptNounA: string;
  conceptNounB: string;
}

interface DiscoverMeta {
  /** Concept name / topic for the essay. */
  concept: string;
  /** LLM-generated essay title (from chunk.goal). */
  title: string;
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

  const locationState = location.state as { post?: DailyPost; connectionMeta?: ConnectionMeta; discoverMeta?: DiscoverMeta } | null;
  const passedPost = locationState?.post ?? null;

  // Extract move navigation context (when navigated from a suggested move)
  const moveState = parseMoveNavigationState(location.state);
  // Verify linkedResource matches URL param for consistency
  if (moveState?.linkedResource?.type === 'post' && moveState.linkedResource.id !== id) {
    console.warn(
      '[PostDetailScreen] Move linkedResource ID does not match URL param:',
      moveState.linkedResource.id, '!=', id
    );
  }
  // connectionMeta and discoverMeta are stable per navigation — read once via ref so the
  // generation effect does not re-fire when the parent re-renders.
  const connectionMetaRef = useRef<ConnectionMeta | null>(locationState?.connectionMeta ?? null);
  const discoverMetaRef = useRef<DiscoverMeta | null>(locationState?.discoverMeta ?? null);

  const [post, setPost] = useState<DailyPost | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);

  // Carousel images state
  const [carouselImages, setCarouselImages] = useState<GeneratedImage[]>([]);
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(false);
  const [isRetryingImage, setIsRetryingImage] = useState(false);

  // Essay generation state (connection posts only)
  const [, setEssayStreaming] = useState('');
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

    // Reset abort flag for this effect run. The cleanup function from the
    // *previous* effect run already set this to true, which stopped any
    // in-flight generation. We now clear it so the new generation can proceed.
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

    // Post not in cache — check for generation metadata
    const connectionMeta = connectionMetaRef.current;
    const discoverMeta = discoverMetaRef.current;

    if (connectionMeta) {
      // Connection essay: stream from two source questions
      setLoadingPost(false);
      setIsGeneratingEssay(true);

      void (async () => {
        let accumulated = '';
        try {
          for await (const chunk of conceptFeedService.generateConnectionPost(
            connectionMeta.questionA,
            connectionMeta.questionB,
            connectionMeta.conceptNounA,
            connectionMeta.conceptNounB,
          )) {
            if (generateAbortRef.current) return;
            accumulated += chunk;
            setEssayStreaming(accumulated);
          }
          if (generateAbortRef.current) return;
          const saved = conceptFeedService.saveConnectionPost(
            connectionMeta.questionA,
            connectionMeta.questionB,
            connectionMeta.conceptNounA,
            connectionMeta.conceptNounB,
            accumulated,
          );
          conceptFeedService.setConnectionPostId(connectionMeta.questionA.id, connectionMeta.questionB.id, saved.id);
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

    if (discoverMeta && id) {
      // Discover essay: stream an exploratory post for a curiosity topic
      setLoadingPost(false);
      setIsGeneratingEssay(true);

      void (async () => {
        let accumulated = '';
        try {
          for await (const chunk of conceptFeedService.generateDiscoverPost(
            discoverMeta.concept,
            discoverMeta.title,
          )) {
            if (generateAbortRef.current) return;
            accumulated += chunk;
            setEssayStreaming(accumulated);
          }
          if (generateAbortRef.current) return;
          // Use the URL id as stable post ID so revisits find it in cache
          const saved = conceptFeedService.saveDiscoverPost(discoverMeta.concept, discoverMeta.title, accumulated, id);
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
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- passedPost, connectionMeta, discoverMeta are stable per navigation

  // Fetch cached images for the carousel whenever the post changes.
  // If no images are cached (post has none or generation hasn't run), shows essay alone.
  // Video posts use the YouTube embed instead — skip image fetch entirely.
  useEffect(() => {
    if (!post?.id) {
      setCarouselImages([]);
      return;
    }

    if (post.sourceType === 'video') {
      setCarouselImages([]);
      setIsLoadingCarousel(false);
      return;
    }

    let cancelled = false;
    setIsLoadingCarousel(true);

    (async () => {
      try {
        // Fetch all available image styles for this post from the cache
        const styles = ['illustration', 'infograph', 'photo'] as const;
        const results = await Promise.allSettled(
          styles.map((style) => imageGenerationService.retrieveCachedImage(post.id, style)),
        );
        if (cancelled) return;
        const images: GeneratedImage[] = results
          .filter((r): r is PromiseFulfilledResult<GeneratedImage | null> => r.status === 'fulfilled')
          .map((r) => r.value)
          .filter((img): img is GeneratedImage => img !== null);
        setCarouselImages(images);
      } catch (err) {
        if (!cancelled) {
          console.error('[PostDetail] Carousel fetch failed:', err);
          setCarouselImages([]); // Graceful: show essay without carousel
        }
      } finally {
        if (!cancelled) setIsLoadingCarousel(false);
      }
    })();

    return () => { cancelled = true; };
  }, [post?.id]); // Re-fetch if different post (also resets carousel via PostCarousel's useEffect)

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
  const normalizedContextLabel = post ? normalizePlainText(post.contextLabel) : '';
  const normalizedTitle = post ? normalizePlainText(post.title) : '';

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

  const handleRetryImage = async () => {
    if (!post) return;
    setIsRetryingImage(true);
    try {
      const style = inferImageStyle(post);
      const prompt = buildImagePrompt(post);
      const result = await imageGenerationService.generateImage(post.id, prompt, style);
      if (result.success && result.data) {
        setCarouselImages([result.data]);
      } else {
        toast(result.error?.message ?? 'Image generation failed', 'error');
      }
    } catch {
      toast('Image generation failed', 'error');
    } finally {
      setIsRetryingImage(false);
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

  // Essay is being generated — show streaming content before the Q&A section is ready.
  if (isGeneratingEssay || essayError) {
    const connMeta = connectionMetaRef.current;
    const discMeta = discoverMetaRef.current;
    return (
      <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
          <ArrowLeft size={20} />
        </button>

        {/* Connection concept pills */}
        {connMeta && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[connMeta.conceptNounA, connMeta.conceptNounB].map((noun, i) => (
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

        {/* Discover title pill */}
        {discMeta && (
          <div style={{ marginBottom: '20px' }}>
            <span style={{
              padding: '6px 16px', borderRadius: '100px',
              backgroundColor: 'var(--node-peach)',
              color: 'var(--foreground)', fontWeight: 700, fontSize: '0.875rem',
            }}>
              {discMeta.title}
            </span>
          </div>
        )}

        {essayError ? (
          <div style={{ padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--danger)', backgroundColor: 'var(--danger-light)', marginBottom: '16px' }}>
            <p style={{ color: 'var(--danger-dark)', fontWeight: 600, marginBottom: '8px' }}>Generation failed</p>
            <p style={{ color: 'var(--danger-dark)', fontSize: '0.875rem', marginBottom: '16px' }}>{essayError}</p>
            <button
              onClick={() => { setEssayError(null); navigate(0); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius)', backgroundColor: 'var(--danger)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '60px 20px' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-40)' }} />
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.95rem' }}>Generating Post...</p>
          </div>
        )}
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>Post not found</h2>
        <p style={{ color: 'var(--muted-foreground)' }}>This post is no longer available in the current daily feed.</p>
      </div>
    );
  }

  const messages = session?.messages ?? [];
  const isConnectionPost = post.sourceType === 'connection';
  const isNews = post.sourceType === 'news';
  const meta = connectionMetaRef.current;

  return (
    <div style={{ padding: '16px 16px 104px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Move breadcrumb — shown when navigated from a suggested move */}
      {moveState && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>
          Suggested move: {moveState.move.title}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <DetailMenu
          deleteLabel="this post"
          onDelete={() => {
            conceptFeedService.deletePost(post!.id);
            toast('Post deleted', 'success');
            navigate(-1);
          }}
        />
      </div>

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

      {/* News source attribution */}
      {isNews && post.newsMeta?.sources && post.newsMeta.sources.length > 0 && (
        <div style={{
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Sources
          </span>
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {post.newsMeta.sources.map((s) => (
              <a
                key={s.index}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.82rem', color: 'var(--primary-40)', textDecoration: 'none' }}
              >
                [{s.index}] {s.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Video post: show embedded YouTube player instead of image carousel */}
      {post.sourceType === 'video' && post.videoMeta?.videoId ? (
        <div style={{ marginBottom: 16 }}>
          <YouTubeEmbed videoId={post.videoMeta.videoId} />
          {post.videoMeta.channelTitle && (
            <p style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: 'var(--muted-foreground)',
            }}>
              {post.videoMeta.channelTitle}
            </p>
          )}
        </div>
      ) : post.sourceType !== 'video' && (
        <>
          {/* Carousel — reserve 350px while loading to prevent layout shift */}
          {carouselImages.length > 0 ? (
            <PostCarousel
              images={carouselImages}
              isLoading={isLoadingCarousel}
              onIndexChange={(index) => { /* Future: analytics or preload */ void index; }}
            />
          ) : !isLoadingCarousel && post && (
            <button
              onClick={() => void handleRetryImage()}
              disabled={isRetryingImage}
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '14px',
                borderRadius: 'var(--radius-xl)',
                border: '1.5px dashed var(--border)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--primary-40)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={14} />
              Generate image
            </button>
          )}
        </>
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
          {normalizedContextLabel} · {post.narrativeMode}
        </p>
        <h1 style={{ fontSize: '1.55rem', lineHeight: 1.12, marginBottom: '12px', textWrap: 'balance' }}>{normalizedTitle}</h1>
        {post.sourceType !== 'video' && post.whyCare && (
          <p style={{ fontSize: '0.98rem', lineHeight: 1.62, color: 'var(--foreground)', marginBottom: '16px' }}>{post.whyCare}</p>
        )}
        {post.sourceType === 'video' && (
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            margin: '16px 0 8px',
          }}>
            AI Summary
          </h3>
        )}
        <div style={isNews ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>
          <Markdown>{post.bodyMarkdown}</Markdown>
        </div>
        {post.sourceType !== 'video' && post.takeaway && (
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
        )}
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
