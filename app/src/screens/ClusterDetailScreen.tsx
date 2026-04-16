import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ConceptCard } from '../components/ConceptCard';
import { Markdown } from '../components/Markdown';
import { DetailMenu } from '../components/DetailMenu';
import { useQuestions } from '../state/useQuestions';
import { questionService } from '../services/question.service';
import { flashcardService } from '../services/flashcard.service';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { toast } from '../lib/toast';

export function ClusterDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getById, questions, isLoading } = useQuestions();

  const cluster = id ? getById(id) : undefined;

  // Guard: must be a cluster node
  if (!cluster || !cluster.isClusterNode) {
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
          <p style={{ color: 'var(--muted-foreground)' }}>{t('graph.cluster.notFound')}</p>
        )}
      </div>
    );
  }

  // Child anchors: by clusterNodeId, with fallback by branchLabel + clusterLabel for legacy anchors
  const childAnchors = questions.filter(
    (q) =>
      q.isAnchorNode === true &&
      !q.isClusterNode &&
      (q.clusterNodeId === cluster.id ||
        (!q.clusterNodeId && q.branchLabel === cluster.branchLabel && q.clusterLabel === cluster.clusterLabel)),
  );

  // All Q&As under those anchors
  const allQaChildren = questions.filter(
    (q) =>
      !q.isAnchorNode &&
      !q.isClusterNode &&
      childAnchors.some((a) => a.id === q.parentId),
  );
  const allQaIds = allQaChildren.map((q) => q.id);

  // Flashcard count
  const allCards = flashcardService.getAll();
  const clusterCardCount = allCards.filter((c) => allQaIds.includes(c.nodeId ?? '')).length;

  // Parse combined nodeSummary from child anchors, grouped by anchor name
  const groupedSummaries = childAnchors
    .filter((a) => (a.nodeSummary || '').trim().length > 0)
    .map((a) => ({
      anchorName: a.title || a.content,
      entries: (a.nodeSummary || '')
        .split(/\n(?=\[)/)
        .map((block) => block.replace(/^\[.*?\]\s*/, '').split(/\n\n/)[0].trim())
        .filter((text) => text.length > 0),
    }))
    .filter((g) => g.entries.length > 0);

  const handleReviewCards = () => {
    navigate('/review', {
      state: {
        clusterReview: {
          clusterId: cluster.id,
          qaIds: allQaIds,
          title: cluster.title || cluster.content,
        },
      },
    });
  };

  const handleGeneratePost = () => {
    const postId = `cluster-post-${cluster.id}`;
    const concept = cluster.title || cluster.content;
    navigate(`/posts/${postId}`, {
      state: {
        discoverMeta: {
          concept,
          title: t('graph.cluster.learnAsPostTitle', { concept }),
        },
      },
    });
  };

  return (
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 96px`, maxWidth: '448px', margin: '0 auto' }}>
      <Header
        title={t('graph.cluster.title')}
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
            deleteLabel={t('graph.cluster.deleteLabel')}
            onDelete={async () => {
              for (const qa of allQaChildren) {
                await questionService.delete(qa.id);
              }
              for (const anchor of childAnchors) {
                await questionService.delete(anchor.id);
              }
              await questionService.delete(cluster.id);
              toast(t('graph.cluster.deleted'), 'success');
              navigate(-1);
            }}
          />
        }
      />

      {/* Breadcrumb: Root > Branch (cluster IS current level) */}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
        }}
      >
        <span>{cluster.rootLabel || t('graph.cluster.rootFallback')}</span>
        <ChevronRight size={12} />
        <span>{cluster.branchLabel || t('graph.cluster.branchFallback')}</span>
      </div>

      {/* Cluster title */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' }}>
        {cluster.title || cluster.content}
      </h1>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          fontSize: '0.8rem',
          color: 'var(--muted-foreground)',
          marginBottom: '20px',
        }}
      >
        <span>{t('graph.cluster.conceptCount', { count: childAnchors.length })}</span>
        <span>{t('graph.cluster.qaCount', { count: allQaChildren.length })}</span>
        <span>{t('graph.cluster.flashcardCount', { count: clusterCardCount })}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button
          onClick={handleReviewCards}
          disabled={clusterCardCount === 0}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: clusterCardCount > 0 ? 'var(--primary-40)' : 'var(--surface-variant)',
            color: clusterCardCount > 0 ? 'white' : 'var(--muted-foreground)',
            fontWeight: 600,
            fontSize: '0.85rem',
            border: 'none',
            cursor: clusterCardCount > 0 ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={16} />
          {t('graph.cluster.flashcardsButton')}
        </button>
        <button
          onClick={handleGeneratePost}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--surface-variant)',
            color: 'var(--foreground)',
            fontWeight: 600,
            fontSize: '0.85rem',
            border: '1.5px solid var(--border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <FileText size={16} />
          {t('graph.cluster.learnAsPostButton')}
        </button>
      </div>

      {/* Knowledge Summary — grouped by anchor */}
      {groupedSummaries.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4
            style={{
              marginBottom: '12px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--muted-foreground)',
            }}
          >
            {t('graph.cluster.summaryHeading')}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groupedSummaries.map((group, gi) => (
              <Card key={gi}>
                <p
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--primary-40)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  {group.anchorName}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {group.entries.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        color: 'var(--foreground)',
                        paddingBottom: i < group.entries.length - 1 ? '10px' : 0,
                        borderBottom: i < group.entries.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <Markdown>{entry}</Markdown>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Child anchors */}
      {childAnchors.length > 0 && (
        <div>
          <h4
            style={{
              marginBottom: '12px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--muted-foreground)',
            }}
          >
            {t('graph.cluster.anchorsHeading')}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {childAnchors.map((anchor) => {
              const anchorQaCount = questions.filter(
                (q) => q.parentId === anchor.id && !q.isAnchorNode && !q.isClusterNode,
              ).length;
              return (
                <ConceptCard
                  key={anchor.id}
                  question={anchor}
                  onClick={() => navigate(`/anchor/${anchor.id}`)}
                  subtitle={t('graph.anchor.qaCount', { count: anchorQaCount })}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
