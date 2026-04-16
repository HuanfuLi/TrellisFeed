import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calendar, Tag, Play } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Markdown } from '../components/Markdown';
import { DetailMenu } from '../components/DetailMenu';
import { useQuestions } from '../state/useQuestions';
import { questionService } from '../services/question.service';
import { formatDate } from '../lib/date';
import { toast } from '../lib/toast';
import { parseMoveNavigationState } from '../lib/moveNavigator';

export function QuestionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { getById, questions, isLoading } = useQuestions();

  // Extract move navigation context (when navigated from a suggested move)
  const moveState = parseMoveNavigationState(location.state);
  // Verify linkedResource matches URL param for consistency
  if (moveState?.linkedResource?.type === 'question' && moveState.linkedResource.id !== id) {
    console.warn(
      '[QuestionDetailScreen] Move linkedResource ID does not match URL param:',
      moveState.linkedResource.id, '!=', id
    );
  }

  const question = id ? getById(id) : undefined;

  if (!question) {
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
            <Skeleton height="1rem" width="40%" />
            <Skeleton height="6rem" />
            <Skeleton height="8rem" />
          </div>
        ) : (
          <p style={{ color: 'var(--muted-foreground)' }}>{t('questionDetail.notFound')}</p>
        )}
      </div>
    );
  }

  const related = questions.filter((q) => question.relatedQuestionIds.includes(q.id));

  return (
    <div style={{ paddingTop: '24px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>
      {/* Move breadcrumb — shown when navigated from a suggested move */}
      {moveState && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginBottom: '12px',
        }}>
          {t('questionDetail.moveBreadcrumb', { title: moveState.move.title })}
        </div>
      )}
      {/* Back + Menu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <DetailMenu
          deleteLabel={t('questionDetail.deleteLabel')}
          onDelete={async () => {
            await questionService.delete(question.id);
            toast(t('questionDetail.deleted'), 'success');
            navigate(-1);
          }}
        />
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Calendar size={14} /> {formatDate(question.createdAt)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Tag size={14} /> {t('questionDetail.reviewsCount', { count: question.reviewSchedule.reviewCount })}
        </span>
      </div>

      {/* Keywords */}
      {question.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {question.keywords.map((kw) => (
            <Badge key={kw} color="green">{kw}</Badge>
          ))}
        </div>
      )}

      {/* Question card */}
      <Card style={{ marginBottom: '12px' }}>
        <h4 style={{ marginBottom: '10px', color: 'var(--muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('questionDetail.questionHeading')}
        </h4>
        <p style={{ lineHeight: 1.6 }}>{question.content}</p>
      </Card>

      {/* Answer card */}
      <Card style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', color: 'var(--muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('questionDetail.answerHeading')}
        </h4>
        <Markdown>{question.answer}</Markdown>
      </Card>

      {/* Review Schedule */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px' }}>{t('questionDetail.scheduleHeading')}</h4>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '4px' }}>
                {t('questionDetail.nextReview', { date: question.reviewSchedule.nextReviewDate })}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                {t('questionDetail.timesReviewed', { count: question.reviewSchedule.reviewCount })}
              </p>
            </div>
            <button
              onClick={() => navigate('/review')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--primary-40)',
                color: 'white',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Play size={14} fill="currentColor" /> {t('questionDetail.reviewNow')}
            </button>
          </div>
        </Card>
      </div>

      {/* Related Questions */}
      {related.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '12px' }}>{t('questionDetail.relatedHeading')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {related.map((q) => (
              <Card
                key={q.id}
                onClick={() => navigate(`/ask/${q.id}`)}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
                onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>{q.title ?? q.content}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{q.summary}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
