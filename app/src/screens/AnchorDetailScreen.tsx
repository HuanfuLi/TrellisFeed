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
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { toast } from '../lib/toast';

export function AnchorDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getById, questions, isLoading } = useQuestions();

  const anchor = id ? getById(id) : undefined;

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

  // Get all Q&As attached to this anchor
  const qaChildren = questions.filter((q) => q.parentId === anchor.id && !q.isAnchorNode);

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
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 96px`, maxWidth: '448px', margin: '0 auto' }}>
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
            backgroundColor: anchorCardCount > 0 ? 'var(--primary-40)' : 'var(--surface-variant)',
            color: anchorCardCount > 0 ? 'white' : 'var(--muted-foreground)',
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
          {t('graph.anchor.flashcardsButton')}
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
          {t('graph.anchor.learnAsPostButton')}
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
    </div>
  );
}
