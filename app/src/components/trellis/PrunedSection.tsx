// Pruned archive section — rendered at the bottom of the Planner screen
// (after Suggested Moves). Reads pruned anchors from questionService and
// refreshes on ANCHOR_DELETED / GRAPH_UPDATED / QUESTION_DELETED
// events emitted by trellisActionsService.

import { useEffect, useState } from 'react';
import { Scissors, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { questionService } from '../../services/question.service';
import { trellisActionsService } from '../../services/trellis-actions.service';
import { eventBus } from '../../lib/event-bus';
import { toast } from '../../lib/toast';
import type { Question } from '../../types';

export function PrunedSection() {
  const { t } = useTranslation();
  const [prunedNodes, setPrunedNodes] = useState<Question[]>(() =>
    questionService.getPrunedQuestions(),
  );
  const [showPruned, setShowPruned] = useState(false);

  useEffect(() => {
    const refresh = () => setPrunedNodes(questionService.getPrunedQuestions());
    const u1 = eventBus.subscribe('ANCHOR_DELETED', refresh);
    const u2 = eventBus.subscribe('GRAPH_UPDATED', refresh);
    const u3 = eventBus.subscribe('QUESTION_DELETED', refresh);
    return () => { u1(); u2(); u3(); };
  }, []);

  const handleUnprune = (q: Question) => {
    trellisActionsService.unpruneQuestion(q.id);
    toast(t('common.toast.restoredToTrellis'), 'success');
  };

  const handleHardDelete = async (q: Question) => {
    await trellisActionsService.hardDelete(q.id);
    toast(t('common.toast.permanentlyDeleted'), 'success');
  };

  if (prunedNodes.length === 0) return null;

  return (
    <div style={{ padding: '12px 16px 24px' }}>
      <button
        onClick={() => setShowPruned((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '10px',
          backgroundColor: 'transparent',
          border: '1px dashed var(--border)',
          color: 'var(--muted-foreground)',
          fontSize: '0.78rem',
          cursor: 'pointer',
        }}
      >
        <Scissors size={12} />
        {t('planner.trellis.pruned', { count: prunedNodes.length })}
        <span style={{ marginLeft: '2px' }}>{showPruned ? '▾' : '▸'}</span>
      </button>
      {showPruned && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {prunedNodes.map((q) => (
            <div
              key={q.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-variant)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.82rem',
                  color: 'var(--muted-foreground)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {q.title ?? q.content ?? 'anchor'}
              </span>
              <button
                onClick={() => handleUnprune(q)}
                aria-label={t('common.action.restore')}
                title={t('planner.trellis.restoreTitle')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
                {t('common.action.restore')}
              </button>
              <button
                onClick={() => { void handleHardDelete(q); }}
                aria-label={t('common.action.deleteForever')}
                title={t('planner.trellis.deleteForeverTitle')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: '#B44',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} />
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
