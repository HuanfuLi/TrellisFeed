import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Markdown } from '../components/Markdown';
import { useQuestions } from '../state/useQuestions';
import { flashcardService } from '../services/flashcard.service';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';

export function ClusterDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, questions } = useQuestions();

  const cluster = id ? getById(id) : undefined;

  // Guard: must be a cluster node
  if (!cluster || !cluster.isClusterNode) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', border: 'none', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <p style={{ color: 'var(--muted-foreground)' }}>Cluster not found.</p>
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
    navigate(`/posts/${postId}`, {
      state: {
        discoverMeta: {
          concept: cluster.title || cluster.content,
          title: `Understanding ${cluster.title || cluster.content}: A Complete Guide`,
        },
      },
    });
  };

  return (
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 96px`, maxWidth: '448px', margin: '0 auto' }}>
      <Header title="Knowledge Cluster" />

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          color: 'var(--primary-40)',
          background: 'none',
          border: 'none',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: 0,
        }}
      >
        <ArrowLeft size={20} /> Back
      </button>

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
        <span>{cluster.rootLabel || 'Knowledge'}</span>
        <ChevronRight size={12} />
        <span>{cluster.branchLabel || 'General'}</span>
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
        <span>{childAnchors.length} concepts</span>
        <span>{allQaChildren.length} Q&As</span>
        <span>{clusterCardCount} flashcards</span>
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
          Review Flashcards
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
          Learn as Post
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
            Knowledge Summary
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
            Concept Anchors
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {childAnchors.map((anchor) => {
              const anchorQaCount = questions.filter(
                (q) => q.parentId === anchor.id && !q.isAnchorNode && !q.isClusterNode,
              ).length;
              const summaryPreview = (() => {
                const first =
                  (anchor.nodeSummary || '')
                    .split(/\n(?=\[)/)[0]
                    ?.replace(/^\[.*?\]\s*/, '')
                    .split(/\n\n/)[0]
                    ?.trim() || '';
                return first.length > 120 ? first.slice(0, 117) + '...' : first;
              })();
              return (
                <Card
                  key={anchor.id}
                  onClick={() => navigate(`/anchor/${anchor.id}`)}
                  style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onPointerEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.01)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-2)';
                  }}
                  onPointerLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--foreground)' }}>
                    {anchor.title || anchor.content}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                    {anchorQaCount} Q&As
                  </p>
                  {summaryPreview && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                      <Markdown>{summaryPreview}</Markdown>
                    </div>
                  )}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '6px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        color: 'var(--primary-40)',
                        fontWeight: 600,
                      }}
                    >
                      <span>View details</span>
                      <ChevronRight size={12} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
