import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, MessageSquare, RefreshCw, Sparkles } from 'lucide-react';
import i18n from '../locales';
import { DetailMenu } from '../components/DetailMenu';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import type { ChatSession, DailyPost, GeneratedImage, Question, SessionMessage } from '../types';
import { useQuestions } from '../state/useQuestions';
import { conceptFeedService } from '../services/concept-feed.service';
import { imageGenerationService } from '../services/imageGeneration.service';
import { sessionService } from '../services/session.service';
import { postQaService } from '../services/post-qa.service';
import { studyContextService } from '../services/study-context.service';
import { frozenFeedService } from '../services/frozen-feed.service';
import { dailyReadService, getAnchorIdForPost } from '../services/daily-read.service';
import { questionService } from '../services/question.service';
import { Markdown } from '../components/Markdown';
import { ChatMessage } from '../components/ChatMessage';
import { PostCarousel } from '../components/PostCarousel';
import { toast } from '../lib/toast';
import { inferImageStyle, buildImagePrompt } from '../services/postFormatting.service';
import { normalizePlainText } from '../lib/text-normalization';
import { generatePostEssay, generateEssayMeta, patchPostEssayInCache, type EssayContent } from '../services/post-essay.service';
import { eventBus } from '../lib/event-bus';
import { postHistoryService } from '../services/post-history.service';
import { interactionLog } from '../services/interaction-log.service';

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

export function PostDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { t } = useTranslation();
  const { questions } = useQuestions();

  const locationState = location.state as { post?: DailyPost; connectionMeta?: ConnectionMeta; discoverMeta?: DiscoverMeta } | null;
  const passedPost = locationState?.post ?? null;

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

  // On-enter essay generation state (for posts with empty bodyMarkdown)
  const [streamingBody, setStreamingBody] = useState('');
  const [isStreamingOnEnter, setIsStreamingOnEnter] = useState(false);
  const [onEnterError, setOnEnterError] = useState<string | null>(null);
  const [onEnterMeta, setOnEnterMeta] = useState<Omit<EssayContent, 'bodyMarkdown'> | null>(null);

  // Phase 43 DD-01..DD-05 — Deep-dive streaming state.
  // Separate state slot from on-enter so the standard bodyMarkdown is NEVER
  // overwritten by a deep stream. Dedicated AbortController (deepAbortControllerRef)
  // so cancel-on-Restore-Standard doesn't kill the on-enter cleanup.
  const [streamingDeep, setStreamingDeep] = useState('');
  const [isStreamingDeep, setIsStreamingDeep] = useState(false);
  // deepError reserved for future error-toast surfacing (set in handleStartDeepDive
  // catch block; not yet rendered — UI parity with onEnterError comes in a follow-up).
  const [, setDeepError] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<'standard' | 'deep'>('standard');
  const deepAbortControllerRef = useRef<AbortController | null>(null);

  // Q&A streaming state
  const [qaStreaming, setQaStreaming] = useState('');
  const [input, setInput] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Use a ref for questions so session creation always has the latest value
  // without re-triggering the post-loading effect.
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  // --- Reading detectors (Phase 30, D-04/D-05/D-06) ---
  const [resolvedAnchorId, setResolvedAnchorId] = useState<string | null>(null);
  const [resolvedAnchorName, setResolvedAnchorName] = useState<string | null>(null);
  const hasEmittedRef = useRef(false);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve anchor IDs + display name for the current post.
  // 2026-05-19: name resolution moved INTO this effect (was a useMemo
  // that didn't subscribe to question-store loading). On device, the
  // store is sometimes empty at first render and the useMemo silently
  // returned null. useEffect runs after commit and re-runs on post
  // changes — the lookup now sees a populated store.
  //
  // resolvedAnchorId remains the daily-read owner. The visible chip is static
  // because the graph detail route is removed in the QuestionTrace shell.
  useEffect(() => {
    if (!post) {
      setResolvedAnchorId(null);
      setResolvedAnchorName(null);
      return;
    }
    const allQ = questionService.getAll({ includeFlagged: true });
    const byId = new Map(allQ.map(q => [q.id, q]));
    const ownerId = getAnchorIdForPost(post, byId);
    setResolvedAnchorId(ownerId);

    const owner = ownerId ? byId.get(ownerId) : undefined;
    const anchor = owner?.isAnchorNode ? owner : undefined;
    const name = anchor?.title?.trim()
      || anchor?.content?.slice(0, 40)?.trim()
      || post.sourceQuestionTitles?.[0]?.trim()
      || null;
    setResolvedAnchorName(name);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset emit guard when post changes
  useEffect(() => {
    hasEmittedRef.current = false;
  }, [post?.id]);

  // Idempotent emit helper
  const emitExplored = useCallback((anchorId: string) => {
    if (hasEmittedRef.current) return;
    if (dailyReadService.isExplored(anchorId)) { hasEmittedRef.current = true; return; }
    hasEmittedRef.current = true;
    dailyReadService.markExplored(anchorId);
    eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
  }, []);

  // Detector A: Scroll 70% sentinel (IntersectionObserver)
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel || !resolvedAnchorId) return;
    if (dailyReadService.isExplored(resolvedAnchorId)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        emitExplored(resolvedAnchorId);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [resolvedAnchorId, emitExplored]);

  // Detector B: 30s dwell timer
  useEffect(() => {
    if (!resolvedAnchorId) return;
    if (dailyReadService.isExplored(resolvedAnchorId)) return;
    dwellTimerRef.current = setTimeout(() => {
      emitExplored(resolvedAnchorId);
    }, 30_000);
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [resolvedAnchorId, emitExplored]);

  // Record viewed post in history (idempotent — deduplicates by id)
  useEffect(() => {
    if (!post) return;
    try { postHistoryService.addPost(post); } catch { /* non-critical */ }
    const openedAt = Date.now();
    void interactionLog.record('post_open', { postId: post.id })
      .catch(() => { /* observer only */ });
    return () => {
      void interactionLog.record('post_close', {
        postId: post.id,
        durationMs: Math.max(0, Date.now() - openedAt),
      }).catch(() => { /* observer only */ });
    };
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;

    setOnEnterError(null);
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
      // Create a skeleton post for the connection so the UI can render immediately
      const skeleton: DailyPost = {
        id,
        date: new Date().toISOString().split('T')[0],
        title: `${connectionMeta.conceptNounA} & ${connectionMeta.conceptNounB}`,
        teaser: { hook: i18n.t('posts.detail.connectionGenerating'), preview: '' },
        bodyMarkdown: '',
        whyCare: '',
        takeaway: '',
        quickAskPrompts: [],
        narrativeMode: 'contrast',
        contextLabel: i18n.t('posts.detail.connectionLabel'),
        sourceType: 'connection',
        sourceQuestionIds: [connectionMeta.questionA.id, connectionMeta.questionB.id],
        sourceQuestionTitles: [connectionMeta.questionA.title || i18n.t('posts.detail.connectionFallbackA'), connectionMeta.questionB.title || i18n.t('posts.detail.connectionFallbackB')],
        keywords: [],
        generatedAt: Date.now(),
        origin: 'ai',
      };
      setPost(skeleton);
      setLoadingPost(false);
      // Session will be created after the real post is saved in the next effect
      return;
    }

    if (discoverMeta && id) {
      // Create a skeleton post for the discovery so the UI can render immediately
      const skeleton: DailyPost = {
        id,
        date: new Date().toISOString().split('T')[0],
        title: discoverMeta.title,
        teaser: { hook: i18n.t('posts.detail.discoverHookPreview', { concept: discoverMeta.concept }), preview: '' },
        bodyMarkdown: '',
        whyCare: '',
        takeaway: '',
        quickAskPrompts: [],
        narrativeMode: 'mechanism-breakdown',
        contextLabel: i18n.t('posts.detail.discoverContextLabel'),
        sourceType: 'mixed',
        sourceQuestionIds: [],
        sourceQuestionTitles: [],
        keywords: [discoverMeta.concept],
        generatedAt: Date.now(),
        origin: 'ai',
      };
      setPost(skeleton);
      setLoadingPost(false);
      return;
    }

    setPost(null);
    setLoadingPost(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- passedPost, connectionMeta, discoverMeta are stable per navigation

  // On-enter essay generation: stream bodyMarkdown when post has empty body
  // D-06 + D-16: ONE AbortController for streamingBody + post-stream generateEssayMeta.
  // Matches useQuestions.ts:120-123 house pattern verbatim.
  useEffect(() => {
    if (!post) return;
    // Skip if post already has content (starter posts, cached essays)
    if (post.bodyMarkdown && post.bodyMarkdown.trim() !== '') return;

    const abortController = new AbortController();
    const unsubLocale = eventBus.subscribe('LOCALE_CHANGED', () => {
      abortController.abort(new DOMException('Locale changed', 'AbortError'));
    });

    setIsStreamingOnEnter(true);
    setOnEnterError(null);
    setStreamingBody('');
    setOnEnterMeta(null);

    void (async () => {
      let accumulated = '';
      try {
        const connectionMeta = connectionMetaRef.current;
        const discoverMeta = discoverMetaRef.current;

        // 1. Stream the body content from the appropriate generator
        // D-15 scope (extended Phase 41 SC-7): all 3 branches now thread the AbortSignal
        // AND have a pre-call abort guard. Walker termination + LOCALE_CHANGED mid-stream
        // cancel + unmount cleanup all funnel through the same single AbortController.
        if (post.sourceType === 'connection' && connectionMeta) {
          if (abortController.signal.aborted) return; // Phase 41 SC-7 — pre-call guard
          for await (const chunk of conceptFeedService.generateConnectionPost(
            connectionMeta.questionA,
            connectionMeta.questionB,
            connectionMeta.conceptNounA,
            connectionMeta.conceptNounB,
            { signal: abortController.signal }, // Phase 41 SC-7 — generator-API signal
          )) {
            if (abortController.signal.aborted) return;
            accumulated += chunk;
            setStreamingBody(accumulated);
          }
        } else if (discoverMeta && post.id.includes('-post-')) {
          if (abortController.signal.aborted) return; // Phase 41 SC-7 — pre-call guard
          for await (const chunk of conceptFeedService.generateDiscoverPost(
            discoverMeta.concept,
            discoverMeta.title,
            { signal: abortController.signal }, // Phase 41 SC-7
          )) {
            if (abortController.signal.aborted) return;
            accumulated += chunk;
            setStreamingBody(accumulated);
          }
        } else {
          if (abortController.signal.aborted) return; // Phase 41 SC-7 — pre-call guard
          for await (const chunk of generatePostEssay(post, questionsRef.current, { signal: abortController.signal })) {
            if (abortController.signal.aborted) return; // D-08
            accumulated += chunk;
            setStreamingBody(accumulated);
          }
        }

        if (abortController.signal.aborted) return; // D-08 — discard, no persist

        // 2. Generate meta (whyCare, takeaway, quickAskPrompts) after body completes
        // D-16: Same AbortController for post-stream meta call
        const meta = await generateEssayMeta(post, accumulated, { signal: abortController.signal });
        if (abortController.signal.aborted) return; // D-08

        const essay: EssayContent = { bodyMarkdown: accumulated, ...meta };

        // 3. Save the finalized post to the appropriate store/cache
        // D-08: patchPostEssayInCache ONLY reached when not aborted
        let savedPost: DailyPost | null = null;
        if (post.sourceType === 'connection' && connectionMeta) {
          savedPost = conceptFeedService.saveConnectionPost(
            connectionMeta.questionA,
            connectionMeta.questionB,
            connectionMeta.conceptNounA,
            connectionMeta.conceptNounB,
            accumulated,
          );
          conceptFeedService.setConnectionPostId(connectionMeta.questionA.id, connectionMeta.questionB.id, savedPost.id);
        } else if (discoverMeta && post.id.includes('-post-')) {
          savedPost = conceptFeedService.saveDiscoverPost(discoverMeta.concept, discoverMeta.title, accumulated, post.id);
        } else {
          patchPostEssayInCache(post.id, essay);
          savedPost = { ...post, ...essay };
        }

        if (abortController.signal.aborted) return;

        // 4. Update state with finalized post and create session if needed
        setPost(savedPost);
        setOnEnterMeta(meta);
        setStreamingBody('');
        if (savedPost && !session) {
          setSession(sessionService.getOrCreatePostSession(savedPost, questionsRef.current));
        }
      } catch (err) {
        if (abortController.signal.aborted) return; // clean cancel — no error toast
        setOnEnterError(err instanceof Error ? err.message : i18n.t('posts.detail.generationFailedFallback'));
      } finally {
        setIsStreamingOnEnter(false);
        unsubLocale(); // D-06 cleanup — idempotent; safe even if unmount cleanup already ran
      }
    })();

    return () => {
      abortController.abort(); // unmount trigger (D-06)
      // Phase 43 DD-05 — also cancel any in-flight deep stream on unmount or
      // postId change. Without this the deep stream could keep accumulating
      // chunks after the user has navigated away, eventually patching the cache
      // for a post the user is no longer viewing.
      deepAbortControllerRef.current?.abort();
    };
  }, [post?.id, post?.bodyMarkdown]); // eslint-disable-line react-hooks/exhaustive-deps



  // Fetch cached images for the carousel whenever the post changes.
  // If no images are cached (post has none or generation hasn't run), shows essay alone.
  useEffect(() => {
    if (!post?.id) {
      setCarouselImages([]);
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

  // Scroll once when user submits a question (new message appears), not during streaming
  const initialMsgCount = useRef<number | null>(null);
  useEffect(() => {
    const count = session?.messages.length ?? 0;
    if (initialMsgCount.current === null) {
      initialMsgCount.current = count;
      return;
    }
    if (count > initialMsgCount.current) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      initialMsgCount.current = count;
    }
  }, [session?.messages]);

  const quickAskPrompts = useMemo(() => {
    const fromPost = post?.quickAskPrompts ?? [];
    return fromPost.length > 0 ? fromPost : (onEnterMeta?.quickAskPrompts ?? []);
  }, [post, onEnterMeta]);
  const normalizedContextLabel = post ? normalizePlainText(post.contextLabel) : '';
  const normalizedTitle = post ? normalizePlainText(post.title) : '';

  const handlePostContentClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!post) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a[href]');
    const href = link?.getAttribute('href') ?? '';
    if (!/^https?:\/\//i.test(href)) return;
    void interactionLog.record('source_click', { postId: post.id })
      .catch(() => { /* observer only; the link still opens */ });
  };

  const handleAsk = async (content: string, questionSource: 'typed' | 'suggested_question') => {
    if (!content.trim() || !post || !session) return;
    setInput('');
    setQaStreaming('');

    try {
      const identity = studyContextService.getRequired();
      const suggestedQuestionId = questionSource === 'suggested_question'
        ? frozenFeedService.getSuggestedQuestions(post.id).find((suggestion) => suggestion.text === content)?.id
        : undefined;
      let visibleAnswer = '';
      const result = await postQaService.askPostQuestion({
        userId: identity.userId,
        studyCondition: identity.condition,
        topicId: identity.topicId,
        postId: post.id,
        text: content,
        source: questionSource,
        suggestedQuestionId,
        onDelta: (delta) => {
          visibleAnswer += delta;
          setQaStreaming(visibleAnswer);
        },
      });
      if (!result.success) throw new Error(result.error.message);

      // Detector C: only a successfully completed follow-up marks exploration.
      if (resolvedAnchorId) emitExplored(resolvedAnchorId);
      const userMsg: SessionMessage = { id: result.data.question.id, type: 'user', content: result.data.question.text };

      const aiMsg: SessionMessage = {
        id: result.data.answer.id,
        type: 'ai',
        content: result.data.answer.answerText,
      };
      const updated: ChatSession = { ...session, messages: [...session.messages, userMsg, aiMsg] };
      setSession(updated);
      sessionService.save(updated);
      sessionService.setActiveId(updated.id);
      setQaStreaming('');
      try {
        await interactionLog.recordQuestionSubmit({
          postId: post.id,
          questionId: userMsg.id,
          questionText: userMsg.content,
          questionSource,
        });
        await interactionLog.recordAnswerViewed({
          questionId: userMsg.id,
          answerText: aiMsg.content,
        });
      } catch {
        // The participant still receives the completed answer if logging fails.
      }
    } catch (error) {
      setQaStreaming('');
      toast(error instanceof Error ? error.message : t('posts.qa.askFailed'), 'error');
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
        toast(result.error?.message ?? t('posts.image.generationFailed'), 'error');
      }
    } catch {
      toast(t('posts.image.generationFailed'), 'error');
    } finally {
      setIsRetryingImage(false);
    }
  };

  // Phase 43 DD-03 — Kick off the deep-dive stream against a NEW dedicated
  // AbortController. RESEARCH Pitfall 3: reusing the on-enter controller would
  // immediately bail because it was aborted on unmount/postId change.
  // DD-05: this introduces a 4th pre-call guard (`if (ctrl.signal.aborted) return`),
  // a 5th signal-arg pass (`{ depth: 'deep', signal: ctrl.signal }`), and a
  // cache-write guard (`if (ctrl.signal.aborted) return` before patchPostEssayInCache).
  const handleStartDeepDive = useCallback(async () => {
    if (!post) return;
    const ctrl = new AbortController();
    deepAbortControllerRef.current = ctrl;
    setIsStreamingDeep(true);
    setActiveVariant('deep');
    setStreamingDeep('');
    setDeepError(null);

    let accumulated = '';
    try {
      // DD-05 pre-call guard (4th in this file) — bail if Restore Standard or
      // unmount fired between handler invocation and the for-await opener.
      if (ctrl.signal.aborted) return;
      for await (const chunk of generatePostEssay(post, questionsRef.current, { depth: 'deep', signal: ctrl.signal })) {
        if (ctrl.signal.aborted) return;
        accumulated += chunk;
        setStreamingDeep(accumulated);
      }
      // DD-05 cache-write guard — bodyMarkdownDeep is NEVER persisted from a
      // partial / aborted stream.
      if (ctrl.signal.aborted) return;
      patchPostEssayInCache(post.id, { bodyMarkdownDeep: accumulated } as EssayContent);
      // Refresh local post state so renderDeepDiveControls flips from the
      // DeepDiveButton to the Standard | Deep segmented control on the next render.
      setPost((prev) => prev ? { ...prev, bodyMarkdownDeep: accumulated } : prev);
    } catch (err) {
      if (ctrl.signal.aborted) return; // clean cancel
      setDeepError(err instanceof Error ? err.message : String(err));
    } finally {
      // Only flip the streaming flag off if THIS controller is still the
      // current one (guards against rapid re-clicks superseding the in-flight call).
      if (deepAbortControllerRef.current === ctrl) {
        setIsStreamingDeep(false);
      }
    }
  }, [post]);

  // Phase 43 DD-03 — Restore Standard: abort the deep stream + revert UI to
  // the standard variant. Standard bodyMarkdown is untouched because the deep
  // stream accumulated into a separate state slot (streamingDeep).
  const handleRestoreStandard = useCallback(() => {
    deepAbortControllerRef.current?.abort();
    setIsStreamingDeep(false);
    setActiveVariant('standard');
    setStreamingDeep('');
  }, []);

  // Phase 43 DD-01..DD-04 — Deep-dive controls slot. Renders one of three
  // surfaces based on current state:
  //   1. isStreamingDeep        → Restore Standard link (DD-03)
  //   2. post.bodyMarkdownDeep  → Standard | Deep segmented toggle (DD-04)
  //   3. otherwise              → DeepDiveButton CTA (DD-02)
  const renderDeepDiveControls = () => {
    if (!post) return null;
    if (isStreamingDeep) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', marginBottom: '8px' }}>
          <button
            type="button"
            onClick={handleRestoreStandard}
            style={{
              padding: '6px 12px',
              minHeight: '44px',
              background: 'none',
              border: 'none',
              color: 'var(--primary-40)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {t('posts.detail.deepDive.restoreStandard')}
          </button>
        </div>
      );
    }
    const deepCached = typeof post.bodyMarkdownDeep === 'string' && post.bodyMarkdownDeep.length > 0;
    if (deepCached) {
      // DD-04 — Standard | Deep segmented control. Pure client-side toggle;
      // no re-stream on tap. UI-SPEC §9: active = var(--primary-40) bg + #FFFFFF text.
      return (
        <div
          role="tablist"
          style={{
            display: 'inline-flex',
            width: '100%',
            padding: '4px',
            gap: '4px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: 'var(--radius-pill, 9999px)',
            border: '1px solid var(--border)',
            marginTop: '20px',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        >
          {(['standard', 'deep'] as const).map((variant) => {
            const isActive = activeVariant === variant;
            return (
              <button
                key={variant}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveVariant(variant)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 9999,
                  minHeight: '44px',
                  backgroundColor: isActive ? 'var(--primary-40)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--muted-foreground)',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'background-color 150ms ease, color 150ms ease',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {variant === 'standard'
                  ? t('posts.detail.deepDive.toggleStandard')
                  : t('posts.detail.deepDive.toggleDeep')}
              </button>
            );
          })}
        </div>
      );
    }
    // DD-02 default — DeepDiveButton CTA (full-width subtle button).
    return (
      <button
        type="button"
        onClick={handleStartDeepDive}
        style={{
          width: '100%',
          padding: '14px 16px',
          minHeight: '48px',
          marginTop: '20px',
          marginBottom: '16px',
          backgroundColor: 'var(--surface-variant)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--primary-40)',
          fontSize: '15px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <Sparkles size={16} color="var(--primary-40)" />
        {t('posts.detail.deepDive.cta')}
      </button>
    );
  };

  if (loadingPost) {
    return (
      <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Header
          title={t('posts.detail.headerTitle')}
          centered
          left={
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={20} />
            </button>
          }
        />
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        {t('posts.detail.loading')}
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto' }}>
        <Header
          title={t('posts.detail.headerTitle')}
          centered
          left={
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={20} />
            </button>
          }
        />
        <h2 style={{ marginTop: '24px', marginBottom: '8px' }}>{t('posts.detail.notFoundHeading')}</h2>
        <p style={{ color: 'var(--muted-foreground)' }}>{t('posts.detail.notFoundBody')}</p>
      </div>
    );
  }

  const messages = session?.messages ?? [];
  const isConnectionPost = post.sourceType === 'connection';
  const meta = connectionMetaRef.current;

  return (
    <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto' }}>
      <Header
        title={t('posts.detail.headerTitle')}
        centered
        left={
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </button>
        }
        right={
          <DetailMenu
            deleteLabel={t('posts.detail.deleteLabel')}
            onDelete={() => {
              conceptFeedService.deletePost(post!.id);
              toast(t('posts.detail.deletedToast'), 'success');
              navigate(-1);
            }}
          />
        }
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      {/* Concept pills — shown for connection posts. */}
      {isConnectionPost && meta && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[meta.conceptNounA, meta.conceptNounB].map((noun, i) => {
            return (
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
            );
          })}
        </div>
      )}

      {/* Text-art header — shows textArtContent in notebook style like card face */}
      {post.presentationStyle === 'text-art' && post.textArtContent && (() => {
        const LIGHT = [
          { bg: '#FFFDE7', dot: '#C5CAE9', text: '#1A1A1A', font: 'Georgia, "Times New Roman", serif' },
          { bg: '#E8F5E9', dot: '#A5D6A7', text: '#1B5E20', font: '"Courier New", Courier, monospace' },
          { bg: '#F3E5F5', dot: '#CE93D8', text: '#4A148C', font: 'Palatino, "Palatino Linotype", serif' },
          { bg: '#E3F2FD', dot: '#90CAF9', text: '#0D47A1', font: 'system-ui, -apple-system, sans-serif' },
          { bg: '#FFF3E0', dot: '#FFCC80', text: '#BF360C', font: '"Trebuchet MS", "Gill Sans", sans-serif' },
          { bg: '#FCE4EC', dot: '#F48FB1', text: '#880E4F', font: 'Garamond, "Hoefler Text", serif' },
          { bg: '#E0F7FA', dot: '#80DEEA', text: '#006064', font: 'Verdana, Geneva, sans-serif' },
          { bg: '#FFF8E1', dot: '#FFE082', text: '#E65100', font: '"Bookman Old Style", Bookman, serif' },
        ];
        const DARK = [
          { bg: '#1C1A14', dot: '#2A2840', text: '#FFF9C4', font: 'Georgia, "Times New Roman", serif' },
          { bg: '#1A2E1C', dot: '#2E5A30', text: '#A5D6A7', font: '"Courier New", Courier, monospace' },
          { bg: '#2A1A30', dot: '#4A2060', text: '#CE93D8', font: 'Palatino, "Palatino Linotype", serif' },
          { bg: '#1A2030', dot: '#1E3A5A', text: '#90CAF9', font: 'system-ui, -apple-system, sans-serif' },
          { bg: '#2A1E14', dot: '#4A3018', text: '#FFCC80', font: '"Trebuchet MS", "Gill Sans", sans-serif' },
          { bg: '#2A1420', dot: '#4A1830', text: '#F48FB1', font: 'Garamond, "Hoefler Text", serif' },
          { bg: '#142A2C', dot: '#1A3A3E', text: '#80DEEA', font: 'Verdana, Geneva, sans-serif' },
          { bg: '#2A2414', dot: '#3A3018', text: '#FFE082', font: '"Bookman Old Style", Bookman, serif' },
        ];
            const themes = document.documentElement.classList.contains('dark') ? DARK : LIGHT;
            let h = 0;
            for (const ch of post.id) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
            const theme = themes[((h % themes.length) + themes.length) % themes.length];
            const content = post.textArtContent.split('\n').filter(Boolean).join(' ');
            const fontSize = content.length > 100 ? '1.25rem' : content.length > 60 ? '1.5rem' : '2rem';
            return (
              <div style={{
                width: '100%',
                aspectRatio: '1/1',
                maxHeight: '360px',
                overflow: 'hidden',
                backgroundColor: theme.bg,
                backgroundImage: `radial-gradient(circle, ${theme.dot} 0.8px, transparent 0.8px)`,
                backgroundSize: '20px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Phase 28 D-28 — 32px 28px → 32px 24px to hit 4-grid outlier fix.
                padding: '32px 24px',
                boxSizing: 'border-box',
                marginBottom: '8px',
                borderRadius: 'var(--radius-xl)',
              }}>
                <p style={{
                  fontSize,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: theme.text,
                  margin: 0,
                  textAlign: 'center',
                  fontFamily: theme.font,
                  textWrap: 'balance',
                  wordBreak: 'break-word',
                }}>{content}</p>
              </div>
            );
      })()}
      {/* Carousel — reserve 350px while loading to prevent layout shift */}
      {carouselImages.length > 0 ? (
        <PostCarousel
          images={carouselImages}
          isLoading={isLoadingCarousel}
          onIndexChange={(index) => { /* Future: analytics or preload */ void index; }}
        />
      ) : !isLoadingCarousel && post && (post.presentationStyle === 'image' || post.presentationStyle === 'image-less') && (
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
          {t('posts.image.generate')}
        </button>
      )}

      <article
        onClickCapture={handlePostContentClick}
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
        {/* Concept metadata. Graph detail navigation is removed in the research shell. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {resolvedAnchorName && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: '100px',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}>
              {resolvedAnchorName}
            </span>
          )}
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
            {normalizedContextLabel}{post.narrativeMode ? ` · ${post.narrativeMode}` : ''}
          </span>
        </div>
        <h1 style={{ fontSize: '1.55rem', lineHeight: 1.12, marginBottom: '12px', textWrap: 'balance' }}>{normalizedTitle}</h1>
        {(post.whyCare || onEnterMeta?.whyCare) && (
          <p style={{ fontSize: '0.98rem', lineHeight: 1.62, color: 'var(--foreground)', marginBottom: '16px' }}>{post.whyCare || onEnterMeta?.whyCare}</p>
        )}
        {/* Phase 43 DD-01 (placement updated 2026-05-11 per UAT Test 7 / 43-12):
            deep-dive controls slot positioned ABOVE the essay body so users see
            the depth-control affordance BEFORE reading. Renders DeepDiveButton OR
            Restore Standard link OR Standard|Deep segmented control based on state.
            Gated by !isStreamingOnEnter && (post.bodyMarkdown || streamingBody) so
            it never shows during the initial essay-stream warm-up. */}
        {!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}
        {/* Essay body — shell always rendered, content streams in */}
        <div style={{ minHeight: '200px', marginBottom: '20px' }}>
          {onEnterError ? (
            <div style={{ padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--danger)', backgroundColor: 'var(--danger-light)', marginBottom: '16px' }}>
              <p style={{ color: 'var(--danger-dark)', fontWeight: 600, marginBottom: '8px' }}>{t('posts.detail.generationFailedHeading')}</p>
              <p style={{ color: 'var(--danger-dark)', fontSize: '0.875rem', marginBottom: '16px' }}>{onEnterError}</p>
              <button
                onClick={() => {
                  setOnEnterError(null);
                  // Re-trigger by resetting post bodyMarkdown
                  setPost(prev => prev ? { ...prev, bodyMarkdown: '' } : prev);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius)', backgroundColor: 'var(--danger)', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> {t('posts.detail.retryButton')}
              </button>
            </div>
          ) : isStreamingOnEnter ? (
            <>
              {streamingBody ? (
                <div>
                  <Markdown>{streamingBody}</Markdown>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 0' }}>
                  <div style={{ height: '14px', width: '90%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: '14px', width: '75%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
                  <div style={{ height: '14px', width: '85%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.4s' }} />
                </div>
              )}
            </>
          ) : isStreamingDeep ? (
            // Phase 43 DD-03 — deep stream replaces the body slot in-place.
            // streamingDeep accumulates separately so post.bodyMarkdown stays intact.
            <div>
              {streamingDeep ? <Markdown>{streamingDeep}</Markdown> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 0' }}>
                  <div style={{ height: '14px', width: '90%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: '14px', width: '75%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
                  <div style={{ height: '14px', width: '85%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: '0.4s' }} />
                </div>
              )}
            </div>
          ) : activeVariant === 'deep' && post.bodyMarkdownDeep ? (
            // Phase 43 DD-04 — cached-deep render branch (segmented toggle active).
            <div>
              <Markdown>{post.bodyMarkdownDeep}</Markdown>
            </div>
          ) : post.bodyMarkdown ? (
            <div>
              <Markdown>{post.bodyMarkdown}</Markdown>
            </div>
          ) : null}
        </div>
        {/* Scroll 70% sentinel — placed between essay body and takeaway (D-04) */}
        <div ref={scrollSentinelRef} style={{ height: '1px' }} />
        {(post.takeaway || onEnterMeta?.takeaway) && (
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
              {t('posts.detail.takeawayHeading')}
            </p>
            <p style={{ lineHeight: 1.65 }}>{post.takeaway || onEnterMeta?.takeaway}</p>
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
            <h2 style={{ fontSize: '1rem' }}>{t('posts.qa.heading')}</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {quickAskPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void handleAsk(prompt, 'suggested_question')}
                disabled={Boolean(qaStreaming)}
                style={{
                  padding: '7px 11px',
                  borderRadius: '12px',
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
                ? t('posts.qa.emptyConnection')
                : t('posts.qa.emptyGeneric')}
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
              void handleAsk(input, 'typed');
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              placeholder={isConnectionPost ? t('posts.qa.placeholderConnection') : t('posts.qa.placeholderGeneric')}
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
              {t('posts.qa.submit')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
