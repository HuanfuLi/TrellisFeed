import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Markdown } from '../components/Markdown';
import { DetailMenu } from '../components/DetailMenu';
import { useQuestions } from '../state/useQuestions';
import { questionService } from '../services/question.service';
import { flashcardService } from '../services/flashcard.service';
import { postHistoryService } from '../services/post-history.service';
import { engagementService } from '../services/engagement.service';
import { collectionService } from '../services/collection.service';
import { podcastService } from '../services/podcast.service';
import { computeLeafState } from '../services/trellis-state.service';
import { LeafStateBadge } from '../components/concept/LeafStateBadge';
import { eventBus } from '../lib/event-bus';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { toast } from '../lib/toast';
import type { ReviewSchedule } from '../types';

export function AnchorDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // We only need `isLoading` from useQuestions for the initial-load skeleton.
  // Anchor lookup and qaChildren both go through questionService.getAll()
  // below so we bypass the hook's getRecent(50) cap — older anchors (past
  // the most-recent 50 questions) were silently invisible to `getById`
  // and rendered the not-found shell (UAT Bug 2 — same root cause family
  // as WR-04, which only fixed the secondary qaChildren undercount).
  const { isLoading } = useQuestions();

  // ── Phase 51-01: force re-render on data changes ─────────────────────────
  // Hooks must run on every render — declared BEFORE any conditional return
  // so mounting → not-found → resolved doesn't trip the Rules of Hooks
  // (anchor flips undefined → defined on the same component instance as
  // questionService data lands). Capacitor mobile = no refresh (CLAUDE.md
  // "no-refresh-assumption"); we listen to every event that can mutate
  // the data the recovery surfaces below read.
  //
  // `tick` is exposed (not discarded as a `_`) so the anchor lookup, the
  // WR-01 fcMap memo, and any future per-tick memoization can depend on
  // it — values re-read on each event-bus event.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((tick) => tick + 1);
    const unsubs = [
      eventBus.subscribe('GRAPH_UPDATED', bump),
      eventBus.subscribe('REVIEW_COMPLETED', bump),
      eventBus.subscribe('ENGAGEMENT_CHANGED', bump),
      eventBus.subscribe('COLLECTIONS_CHANGED', bump),
      eventBus.subscribe('FLASHCARDS_CREATED', bump),
      eventBus.subscribe('PODCAST_GENERATION_COMPLETED', bump),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // UAT Bug 2 fix: anchor lookup bypasses the recent-50 cap by reading
  // questionService.getAll directly (same accessor WR-04 already chose for
  // qaChildren and InfoFlow.tsx:39 already chose for the badge leaf-state).
  // Without this, every entry point Phase 51 added (feed-tile badges,
  // PostDetail contextLabel/pills, Appears-in footer link-outs) silently
  // 404'd for any anchor older than the most-recent 50 questions.
  const anchor = useMemo(() => {
    void tick;
    if (!id) return undefined;
    return questionService.getAll({ includeFlagged: true }).find((q) => q.id === id);
  }, [id, tick]);

  // WR-01 (Phase 51 code review): build the FlashCard review lookup the
  // same way useTrellisData does and pass it to computeLeafState. Without
  // fcMap, AnchorDetailScreen's leaf-state would diverge from PlannerScreen's
  // vine — a user who just reviewed a dying-anchor's flashcards to confident
  // would see the anchor flip green in the planner but stay amber here,
  // contradicting their action. The Question-level reviewSchedule is
  // intentionally stale (see trellis-state.service.ts:39-43); FlashCard
  // data is the authoritative review-state source.
  //
  // Memoized on `tick` so we don't rebuild on every render. tick bumps on
  // FLASHCARDS_CREATED + REVIEW_COMPLETED (and other relevant events), so
  // fcMap stays fresh under the no-refresh-assumption.
  const fcMap = useMemo(() => {
    const map = new Map<string, ReviewSchedule>();
    try {
      const allCards = flashcardService.getAll();
      for (const card of allCards) {
        if (!card.nodeId) continue;
        const existing = map.get(card.nodeId);
        // Keep the card with the most reviews (best signal). Mirrors the
        // same selection logic in trellis-state.service.ts buildTrellisLayout.
        if (!existing || card.reviewSchedule.reviewCount > existing.reviewCount) {
          map.set(card.nodeId, card.reviewSchedule);
        }
      }
    } catch {
      /* flashcard service unavailable — fall back to Question-level data */
    }
    return map;
  }, [tick]);

  // WR-04 fix (Phase 51 code review): build qaChildren from the FULL
  // question store (questionService.getAll({ includeFlagged: true }))
  // instead of from useQuestions()'s `questions`, which is capped at
  // questionService.getRecent(50) and silently undercounts Q&A children
  // of an anchor that predates the most recent 50 questions. That
  // undercount cascades into qaChildIdSet → savedCount /
  // inCollectionsCount / podcastCount, making the "Appears in" footer
  // either hide (sum=0) or show smaller numbers than reality. Mirrors
  // InfoFlow.getBadgeLeafSignal's same-reason switch from useQuestions to
  // questionService.getAll (see InfoFlow.tsx:39).
  //
  // Declared BEFORE the not-found early-return so the hook order is
  // stable across the undefined → defined anchor lifecycle (Rules of
  // Hooks). Returns [] when anchor is undefined; that's harmless because
  // the early-return below renders the not-found shell which never reads
  // qaChildren.
  const qaChildren = useMemo(() => {
    void tick;
    if (!anchor) return [];
    const allQ = questionService.getAll({ includeFlagged: true });
    return allQ.filter((q) => q.parentId === anchor.id && !q.isAnchorNode);
  }, [tick, anchor]);

  if (!anchor || !anchor.isAnchorNode) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <Skeleton height="1.5rem" width="60%" />
            <Skeleton height="1rem" width="30%" />
            <Skeleton height="6rem" />
          </div>
        ) : (
          <p style={{ color: 'var(--muted-foreground)' }}>{t('graph.anchor.notFound')}</p>
        )}
      </div>
    );
  }

  // qaChildren is built above (BEFORE the early-return) so the hook order
  // is stable. See WR-04 comment block at the useMemo site.

  // Get flashcard count for this anchor's Q&As
  const allCards = flashcardService.getAll();
  const anchorCardCount = allCards.filter((c) =>
    qaChildren.some((qa) => c.nodeId === qa.id)
  ).length;

  // Parse nodeSummary: split by [qa-id] markers, take first paragraph of each
  const summaryEntries = (anchor.nodeSummary || '')
    .split(/\n(?=\[)/)
    .map((block) => block.replace(/^\[.*?\]\s*/, '').split(/\n\n/)[0].trim())
    .filter((text) => text.length > 0);

  // ── Phase 51-01: leaf state + recovery surfaces ────────────────────────
  // WR-01 fix (Phase 51 code review): pass fcMap so this screen agrees
  // with PlannerScreen's vine. Question-level reviewSchedule is stale by
  // design — FlashCard data is authoritative. Without fcMap, the badge
  // and Flashcards CTA contradict the user's just-completed review action
  // (see 51-REVIEW.md WR-01).
  const leafState = computeLeafState(anchor, qaChildren, undefined, fcMap);

  // Appears-in counts — recomputed on every render. All localStorage-backed
  // sync reads, ~<1ms for typical anchor sizes (≤5 Q&As, ≤500 posts).
  // The setTick effect above keeps this consistent on data mutations.
  //
  // UAT (verify-work, 2026-05-19): DailyPost.sourceQuestionIds has a
  // mixed shape — concept-feed.service.ts produces video/news/concept
  // posts with `sourceQuestionIds: [anchorId]` (lines 1152, 1217), while
  // session-derived posts use Q&A child IDs. CLAUDE.md documents the
  // Q&A-IDs claim but the codebase doesn't enforce it. To match either
  // shape, intersect against `qaChildIdSet ∪ {anchor.id}` — posts
  // pointing at the anchor directly OR at any of its Q&A children
  // both count toward the Appears-in footer.
  const qaChildIdSet = new Set(qaChildren.map((q) => q.id));
  const anchorId = anchor.id;
  const conceptPosts = postHistoryService.getPosts().filter((p) =>
    p.sourceQuestionIds.some((id) => qaChildIdSet.has(id) || id === anchorId),
  );
  const conceptPostIdSet = new Set(conceptPosts.map((p) => p.id));
  const savedCount = engagementService
    .getSavedPosts()
    .filter((p) => conceptPostIdSet.has(p.id)).length;
  const inCollectionsCount = conceptPosts.filter(
    (p) => collectionService.getPostCollections(p.id).length > 0,
  ).length;
  const podcastCount = podcastService
    .getAll()
    .filter((p) => p.status === 'ready' && p.questionIds.some((id) => qaChildIdSet.has(id)))
    .length;

  // Flashcards button morph — recovery states get a louder color + label.
  // Healthy states keep the existing visuals. The button stays clickable in
  // every state (re-plant lives on PlannerScreen; this is just "review the
  // existing flashcards now").
  const recoveryActive =
    leafState === 'dying' || leafState === 'falling' || leafState === 'dead';
  const flashcardsBg = (() => {
    if (anchorCardCount === 0) return 'var(--surface-variant)';
    if (leafState === 'dying') return '#f59e0b';
    if (leafState === 'falling') return '#ef4444';
    if (leafState === 'dead') return 'var(--muted-foreground)';
    return 'var(--primary-40)';
  })();
  const flashcardsLabel =
    recoveryActive && anchorCardCount > 0
      ? t('graph.anchor.reviewNow')
      : t('graph.anchor.flashcardsButton');
  const flashcardsTextColor =
    anchorCardCount > 0 ? 'white' : 'var(--muted-foreground)';

  // Phase 51 UAT-followup: Learn-as-Post is the operator-designated recovery
  // path for dead anchors (or for any recovery state where no flashcards
  // exist to review). When the Flashcards button is the right recovery
  // affordance (recoveryActive && anchorCardCount > 0), Learn-as-Post stays
  // neutral. Otherwise — dead OR recovery-without-cards — Learn-as-Post
  // takes over as the primary recovery CTA with matching state-keyed color
  // and a "Rebuild as Post" label so it's visually obvious that's the
  // intended action.
  const learnAsPostRecoveryActive =
    leafState === 'dead' || (recoveryActive && anchorCardCount === 0);
  const learnAsPostBg = (() => {
    if (!learnAsPostRecoveryActive) return 'var(--surface-variant)';
    if (leafState === 'dying') return '#f59e0b';
    if (leafState === 'falling') return '#ef4444';
    if (leafState === 'dead') return 'var(--muted-foreground)';
    return 'var(--surface-variant)';
  })();
  const learnAsPostLabel = learnAsPostRecoveryActive
    ? t('graph.anchor.rebuildAsPost')
    : t('graph.anchor.learnAsPostButton');
  const learnAsPostTextColor = learnAsPostRecoveryActive
    ? 'white'
    : 'var(--foreground)';
  const learnAsPostBorder = learnAsPostRecoveryActive
    ? 'none'
    : '1.5px solid var(--border)';

  const conceptTitle = anchor.title || anchor.content;
  const linkBtnStyle = {
    background: 'none' as const,
    border: 'none' as const,
    padding: 0,
    color: 'var(--primary-40)',
    fontWeight: 600,
    cursor: 'pointer' as const,
    fontSize: 'inherit' as const,
  };

  const handleReviewCards = () => {
    // Navigate to review with anchor context — ReviewScreen filters by nodeId
    navigate('/review', {
      state: {
        anchorReview: {
          anchorId: anchor.id,
          qaIds: qaChildren.map((q) => q.id),
          title: anchor.title || anchor.content,
        },
      },
    });
  };

  const handleGeneratePost = () => {
    // Navigate to post detail with discover meta for this anchor concept
    const postId = `anchor-post-${anchor.id}`;
    const concept = anchor.title || anchor.content;
    navigate(`/posts/${postId}`, {
      state: {
        discoverMeta: {
          concept,
          title: t('graph.anchor.learnAsPostTitle', { concept }),
        },
      },
    });
  };

  return (
    <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto' }}>
      <Header
        title={t('graph.anchor.title')}
        centered
        left={
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
        }
        right={
          <DetailMenu
            deleteLabel={t('graph.anchor.deleteLabel')}
            onDelete={async () => {
              for (const qa of qaChildren) {
                await questionService.delete(qa.id);
              }
              await questionService.delete(anchor.id);
              toast(t('graph.anchor.deleted'), 'success');
              navigate(-1);
            }}
          />
        }
      />

      {/* Hierarchy breadcrumb */}
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--muted-foreground)',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
      }}>
        <span>{anchor.rootLabel || t('graph.anchor.rootFallback')}</span>
        <ChevronRight size={12} />
        <span>{anchor.branchLabel || t('graph.anchor.branchFallback')}</span>
        <ChevronRight size={12} />
        {anchor.clusterNodeId ? (
          <button
            onClick={() => navigate(`/cluster/${anchor.clusterNodeId}`)}
            style={{
              color: 'var(--primary-40)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {anchor.clusterLabel || t('graph.anchor.clusterFallback')}
          </button>
        ) : (
          <span>{anchor.clusterLabel || t('graph.anchor.clusterFallback')}</span>
        )}
      </div>

      {/* Anchor title */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' }}>
        {anchor.title || anchor.content}
      </h1>

      {/* Phase 51-01: leaf-state badge sits between title and stats.
          Renders nothing when leafState is null. */}
      {leafState && (
        <div style={{ marginBottom: '12px' }}>
          <LeafStateBadge leafState={leafState} />
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '16px',
        fontSize: '0.8rem',
        color: 'var(--muted-foreground)',
        marginBottom: '20px',
      }}>
        <span>{t('graph.anchor.qaCount', { count: anchor.qaCount || qaChildren.length })}</span>
        <span>{t('graph.anchor.flashcardCount', { count: anchorCardCount })}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button
          onClick={handleReviewCards}
          disabled={anchorCardCount === 0}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: flashcardsBg,
            color: flashcardsTextColor,
            fontWeight: 600,
            fontSize: '0.85rem',
            border: 'none',
            cursor: anchorCardCount > 0 ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={16} />
          {flashcardsLabel}
        </button>
        <button
          onClick={handleGeneratePost}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: learnAsPostBg,
            color: learnAsPostTextColor,
            fontWeight: 600,
            fontSize: '0.85rem',
            border: learnAsPostBorder,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <FileText size={16} />
          {learnAsPostLabel}
        </button>
      </div>

      {/* Summary entries from nodeSummary */}
      {summaryEntries.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{
            marginBottom: '12px',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
          }}>
            {t('graph.anchor.summaryHeading')}
          </h4>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {summaryEntries.map((entry, i) => (
                <div key={i} style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: 'var(--foreground)',
                  paddingBottom: i < summaryEntries.length - 1 ? '10px' : 0,
                  borderBottom: i < summaryEntries.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <Markdown>{entry}</Markdown>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Attached Q&As */}
      {qaChildren.length > 0 && (
        <div>
          <h4 style={{
            marginBottom: '12px',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
          }}>
            {t('graph.anchor.qaHeading')}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {qaChildren.map((qa) => (
              <Card
                key={qa.id}
                onClick={() => navigate(`/ask/${qa.id}`)}
                style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onPointerEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
                onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--foreground)' }}>
                  {qa.title || qa.content}
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                  <Markdown>{(() => { const first = (qa.summary || qa.answer).split(/\n\n/)[0].trim(); return first.length > 120 ? first.slice(0, 117) + '...' : first; })()}</Markdown>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--primary-40)', fontWeight: 600 }}>
                    <span>{t('graph.anchor.viewDetails')}</span>
                    <ChevronRight size={12} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Phase 51-01: "Appears in" footer — bounded recovery surface that
          link-outs to SavedScreen and PodcastScreen with pre-applied concept
          filter. Only renders when at least one count > 0 so a fresh anchor
          (no posts yet) doesn't show empty rows. */}
      {savedCount + inCollectionsCount + podcastCount > 0 && (
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
            marginBottom: '8px',
          }}>
            {t('graph.anchor.appearsIn')}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem' }}>
            {savedCount > 0 && (
              <button
                onClick={() => navigate('/saved', { state: { conceptFilterTitle: conceptTitle } })}
                style={linkBtnStyle}
              >
                {t('graph.anchor.appearsInSaved', { count: savedCount })}
              </button>
            )}
            {inCollectionsCount > 0 && (
              <button
                onClick={() => navigate('/saved', { state: { conceptFilterTitle: conceptTitle, openTab: 'collections' } })}
                style={linkBtnStyle}
              >
                {t('graph.anchor.appearsInCollections', { count: inCollectionsCount })}
              </button>
            )}
            {podcastCount > 0 && (
              <button
                onClick={() => navigate('/podcast', {
                  state: {
                    conceptFilterQaIds: Array.from(qaChildIdSet),
                    conceptTitle,
                  },
                })}
                style={linkBtnStyle}
              >
                {t('graph.anchor.appearsInPodcasts', { count: podcastCount })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
