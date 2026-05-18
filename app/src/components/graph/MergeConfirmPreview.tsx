import { useTranslation } from 'react-i18next';
import type { Question } from '../../types/index.ts';

/**
 * MergeConfirmPreview — side-by-side loser/survivor preview rendered as the
 * `children` slot of a <ConfirmDialog> (Phase 49-03 D-07).
 *
 * Layout: two equal-width cards in a flex row.
 *   - LEFT = LOSER (the long-pressed / dragged-from node) — grayed
 *     (`var(--surface-variant)` bg, opacity 0.6), badge in `var(--danger)`
 *     reading "will be removed".
 *   - RIGHT = SURVIVOR (the drop target) — highlighted (`var(--surface)` bg),
 *     badge in `var(--primary-40)` reading "will keep".
 *
 * B-3 fix: BOTH `loserQaCount` AND `survivorQaCount` arrive as required props.
 * GraphScreen derives them once from the question-service snapshot BEFORE
 * opening the modal so the preview displays accurate counts without the
 * component re-querying on every render.
 *
 * The body line below the cards interpolates `{{n}}` (the reparented count,
 * which equals loserQaCount at the modal-open snapshot), `{{survivorTitle}}`,
 * and `{{loserTitle}}` into a single human-readable explanation per D-07.
 */
export interface MergeConfirmPreviewProps {
  loser: Question;
  survivor: Question;
  /** B-3 — derived by GraphScreen before modal opens; equals the reparentedCount
   *  the service will report on commit. */
  loserQaCount: number;
  /** B-3 — derived by GraphScreen before modal opens. */
  survivorQaCount: number;
  loserClusterTitle: string;
  survivorClusterTitle: string;
}

export function MergeConfirmPreview({
  loser,
  survivor,
  loserQaCount,
  survivorQaCount,
  loserClusterTitle,
  survivorClusterTitle,
}: MergeConfirmPreviewProps) {
  const { t } = useTranslation();

  const cardBase = {
    flex: 1,
    padding: '16px',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  };

  const badgeBase = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'white',
    alignSelf: 'flex-start' as const,
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* LEFT — LOSER (grayed, "will be removed") */}
        <div style={{ ...cardBase, backgroundColor: 'var(--surface-variant)', opacity: 0.6 }}>
          <span style={{ ...badgeBase, backgroundColor: 'var(--danger)' }}>
            {t('graph.correction.merge.willBeRemoved')}
          </span>
          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loser.title ?? loser.content}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            {t('graph.anchor.qaCount', { count: loserQaCount })}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{loserClusterTitle}</p>
        </div>
        {/* RIGHT — SURVIVOR (highlighted, "will keep") */}
        <div style={{ ...cardBase, backgroundColor: 'var(--surface)' }}>
          <span style={{ ...badgeBase, backgroundColor: 'var(--primary-40)' }}>
            {t('graph.correction.merge.willKeep')}
          </span>
          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{survivor.title ?? survivor.content}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
            {t('graph.anchor.qaCount', { count: survivorQaCount })}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{survivorClusterTitle}</p>
        </div>
      </div>
      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--muted-foreground)',
          marginTop: '12px',
          lineHeight: 1.5,
        }}
      >
        {t('graph.correction.merge.body', {
          n: loserQaCount,
          survivorTitle: survivor.title ?? survivor.content,
          loserTitle: loser.title ?? loser.content,
        })}
      </p>
      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginTop: '8px',
          fontStyle: 'italic',
        }}
      >
        {t('graph.correction.merge.footer')}
      </p>
    </div>
  );
}
