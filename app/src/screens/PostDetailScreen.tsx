import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, Loader2, MessageSquareOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChatInput } from '../components/ChatInput';
import { ChatMessage } from '../components/ChatMessage';
import { OriginalContent } from '../components/OriginalContent';
import { SuggestedQuestionList } from '../components/SuggestedQuestionList';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import type { Concept, OriginalContentAsset, Post, SuggestedQuestion } from '../domain/content.types';
import type { SessionMessage } from '../types';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { dailyReadService } from '../services/daily-read.service';
import { engagementService } from '../services/engagement.service';
import { frozenFeedService } from '../services/frozen-feed.service';
import { interactionLog } from '../services/interaction-log.service';
import { postHistoryService } from '../services/post-history.service';
import { postQaRepository, postQaService } from '../services/post-qa.service';
import { studyContextService } from '../services/study-context.service';

interface FrozenPostDetail {
  post: Readonly<Post>;
  concepts: readonly Readonly<Concept>[];
  asset: Readonly<OriginalContentAsset>;
  suggestions: readonly Readonly<SuggestedQuestion>[];
}

export function PostDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const [detail, setDetail] = useState<FrozenPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [qaStreaming, setQaStreaming] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const hasEmittedRef = useRef(false);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    hasEmittedRef.current = false;
    if (!id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    try {
      const post = frozenFeedService.getPostById(id);
      const asset = frozenFeedService.getOriginalContent(id);
      if (!post || !asset) throw new Error('Frozen post unavailable');
      const next: FrozenPostDetail = {
        post,
        asset,
        concepts: frozenFeedService.getConcepts(id),
        suggestions: frozenFeedService.getSuggestedQuestions(id),
      };
      setDetail(next);
      setIsSaved(engagementService.isSaved(post.id));
      try {
        const identity = studyContextService.getRequired();
        void postQaRepository.loadSamePostThread(identity.userId, post.id).then((turns) => {
          setMessages(turns.flatMap((turn) => [
            { id: turn.question.id, type: 'user' as const, content: turn.question.text },
            { id: turn.answer.id, type: 'ai' as const, content: turn.answer.answerText },
          ]));
        });
      } catch {
        setMessages([]);
      }
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const post = detail?.post ?? null;
  const primaryConceptId = post?.conceptIds[0] ?? null;

  const emitExplored = useCallback((anchorId: string) => {
    if (hasEmittedRef.current) return;
    if (dailyReadService.isExplored(anchorId)) {
      hasEmittedRef.current = true;
      return;
    }
    hasEmittedRef.current = true;
    dailyReadService.markExplored(anchorId);
    eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
  }, []);

  // Detector A: the sentinel sits after the canonical original content (~70%).
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel || !primaryConceptId || dailyReadService.isExplored(primaryConceptId)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      emitExplored(primaryConceptId);
      observer.disconnect();
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [emitExplored, primaryConceptId]);

  // Detector B: 30-second dwell on the same frozen post.
  useEffect(() => {
    if (!primaryConceptId || dailyReadService.isExplored(primaryConceptId)) return;
    dwellTimerRef.current = setTimeout(() => emitExplored(primaryConceptId), 30_000);
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [emitExplored, primaryConceptId]);

  useEffect(() => {
    if (!post) return;
    void postHistoryService.recordPostViewed(post.id).catch(() => { /* observational */ });
    const openedAt = Date.now();
    void interactionLog.record('post_open', { postId: post.id }).catch(() => { /* observational */ });
    return () => {
      void interactionLog.record('post_close', { postId: post.id, durationMs: Math.max(0, Date.now() - openedAt) }).catch(() => { /* observational */ });
    };
  }, [post]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, qaStreaming]);

  const handleAsk = useCallback(async (
    text: string,
    source: 'typed' | 'suggested_question' = 'typed',
    suggestedQuestionId?: string,
  ) => {
    if (!post || !text.trim() || qaStreaming) return;
    setQaStreaming('');
    try {
      const identity = studyContextService.getRequired();
      let streamed = '';
      const result = await postQaService.askPostQuestion({
        userId: identity.userId,
        studyCondition: identity.condition,
        topicId: post.topicId,
        postId: post.id,
        text,
        source,
        suggestedQuestionId,
        onDelta: (delta) => {
          streamed += delta;
          setQaStreaming(streamed);
        },
      });
      if (!result.success) throw new Error(result.error.message);

      setMessages((current) => [...current,
        { id: result.data.question.id, type: 'user', content: result.data.question.text },
        { id: result.data.answer.id, type: 'ai', content: result.data.answer.answerText },
      ]);
      setQaStreaming('');
      try {
        await interactionLog.recordQuestionSubmit({ question: result.data.question, answer: result.data.answer });
        await interactionLog.recordAnswerViewed({ postId: post.id, questionId: result.data.question.id });
      } catch { /* research transport never withholds an answer */ }

      // Detector C: only a successfully completed post follow-up marks exploration.
      if (primaryConceptId) emitExplored(primaryConceptId);
    } catch (error) {
      setQaStreaming('');
      toast(error instanceof Error ? error.message : t('posts.qa.askFailed'), 'error');
    }
  }, [emitExplored, post, primaryConceptId, qaStreaming, t]);

  const backButton = (
    <button type="button" aria-label={t('common.back')} onClick={() => navigate(-1)} style={{ minWidth: '44px', minHeight: '44px', display: 'grid', placeItems: 'center', padding: 0, border: 0, background: 'transparent', color: 'var(--foreground)', cursor: 'pointer' }}>
      <ArrowLeft aria-hidden="true" size={20} />
    </button>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', paddingTop: `${HEADER_HEIGHT}px`, display: 'grid', placeItems: 'center' }}>
        <Header title={t('posts.detail.headerTitle')} centered left={backButton} />
        <Loader2 aria-hidden="true" size={24} />
      </div>
    );
  }

  if (!detail || !post) {
    return (
      <div style={{ minHeight: '100dvh', padding: `${HEADER_HEIGHT + 24}px 16px 24px` }}>
        <Header title={t('posts.detail.headerTitle')} centered left={backButton} />
        <h1 style={{ fontSize: '20px', lineHeight: 1.2 }}>{t('posts.detail.notFoundHeading')}</h1>
        <p>{t('posts.detail.notFoundBody')}</p>
      </div>
    );
  }

  const toggleSaved = () => {
    if (isSaved) engagementService.removeSavedPost(post.id);
    else engagementService.savePost(post.id);
    setIsSaved(!isSaved);
  };

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: `${HEADER_HEIGHT}px`, background: 'var(--surface)' }}>
      <Header title={t('posts.detail.headerTitle')} centered left={backButton} />
      <main style={{ maxWidth: '448px', margin: '0 auto', padding: '24px 16px calc(48px + var(--safe-area-bottom))', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{post.sourceName} · {post.sourcePlatform}</div>
          <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1.2, fontWeight: 600 }}>{post.hook}</h1>
          {post.displayTitle !== post.hook && <p style={{ margin: 0, fontSize: '20px', lineHeight: 1.2, fontWeight: 600 }}>{post.displayTitle}</p>}
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5 }}>{post.shortSummary}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {detail.concepts.map((concept) => <span key={concept.id} style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--secondary)', fontSize: '14px', lineHeight: 1.5 }}>{concept.label}</span>)}
          </div>
        </header>

        <OriginalContent
          post={post}
          asset={detail.asset}
          fallbackNotice={t('posts.detail.videoUnavailable')}
          transcriptUnavailableNotice={t('posts.detail.transcriptUnavailable')}
          sourceLinkLabel={t('posts.detail.originalSource')}
          onSourceClick={(postId) => { void interactionLog.record('source_click', { postId }).catch(() => { /* observational */ }); }}
          onVideoPlay={(postId) => { void interactionLog.record('video_play', { postId }).catch(() => { /* observational */ }); }}
          onVideoProgress={(postId, durationMs) => { void interactionLog.record('video_progress', { postId, durationMs }).catch(() => { /* observational */ }); }}
        />

        <div ref={scrollSentinelRef} style={{ height: '1px' }} />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          <button type="button" onClick={toggleSaved} style={{ minHeight: '44px', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', background: 'var(--secondary)', color: 'var(--foreground)', cursor: 'pointer' }}><Bookmark aria-hidden="true" size={16} /> {isSaved ? t('engagement.menu.unsave') : t('engagement.menu.save')}</button>
          <button type="button" onClick={() => { engagementService.dismissPost(post.id); navigate(-1); }} style={{ minHeight: '44px', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', background: 'var(--secondary)', color: 'var(--foreground)', cursor: 'pointer' }}><MessageSquareOff aria-hidden="true" size={16} /> {t('engagement.menu.dismiss')}</button>
          <button type="button" onClick={() => { if (primaryConceptId) emitExplored(primaryConceptId); }} style={{ minHeight: '44px', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', background: 'var(--secondary)', color: 'var(--foreground)', cursor: 'pointer' }}><Check aria-hidden="true" size={16} /> {t('posts.detail.seenEnough')}</button>
        </section>

        <section style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--secondary)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', lineHeight: 1.2, fontWeight: 600 }}>{t('posts.qa.heading')}</h2>
            <SuggestedQuestionList
              suggestions={detail.suggestions}
              heading={t('posts.detail.suggestedQuestions')}
              disabled={Boolean(qaStreaming)}
              onSelect={(suggestion) => {
                void interactionLog.record('question_suggestion_click', { postId: post.id, questionId: suggestion.id }).catch(() => { /* observational */ });
                void handleAsk(suggestion.text, 'suggested_question', suggestion.id);
              }}
            />
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((message) => <ChatMessage key={message.id} messageId={message.id} type={message.type} content={message.content} relatedKnowledge={message.relatedKnowledge} />)}
            {qaStreaming && <ChatMessage messageId="streaming" type="ai" content={qaStreaming} />}
            <div ref={threadEndRef} />
          </div>
          <ChatInput onSend={(text) => { void handleAsk(text); }} placeholder={t('posts.qa.placeholderGeneric')} disabled={Boolean(qaStreaming)} />
        </section>
      </main>
    </div>
  );
}
