import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { eventBus } from '../../lib/event-bus.ts';
import { graphCommandService } from '../../services/graph-command.service.ts';
import { graphEditJournal } from '../../services/graph-edit-journal.service.ts';
import { toast } from '../../lib/toast.ts';

/**
 * UndoButton — Phase 49-04
 *
 * Persistent corner Undo affordance (D-13). 36px circular button positioned at
 * `bottom: 12px; right: 56px` — immediately LEFT of the existing expand/collapse
 * button (which is at `right: 12px`). Visual treatment mirrors the expand/collapse
 * button exactly (R17 / 49-PATTERNS §"UndoButton.tsx") so the two read as a
 * coherent pair.
 *
 * Behavior:
 *   - Subscribes to GRAPH_UPDATED on mount; recomputes `isEnabled` from
 *     `graphEditJournal.list().length > 0` after every emit.
 *   - Initial state hydrates from the journal in the useState lazy initializer
 *     so there is no first-paint "disabled then enabled" flicker.
 *   - Tap when enabled → awaits `graphCommandService.undo()`. Success toasts
 *     `result.data.summary` (B-5 — the operator-facing phrase like
 *     "Undid: rename 'SRS' → 'Spaced Repetition'"). Failure toasts the error
 *     message.
 *   - Tap when journal empty → "Nothing to undo" toast (R11 / D-13 Option B).
 *   - Disabled (visually + functionally) while `reorganizing === true` (D-16).
 *
 * B-5 invariant: NEVER use the verb-literal cmd field in user-facing toast.
 * That field is the verb literal ('rename' | 'move' | ...) intended for log
 * telemetry only. The operator-facing text is `summary`.
 */

export interface UndoButtonProps {
  reorganizing: boolean;
}

export function UndoButton({ reorganizing }: UndoButtonProps) {
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState<boolean>(() => graphEditJournal.list().length > 0);

  useEffect(() => {
    const unsub = eventBus.subscribe('GRAPH_UPDATED', () => {
      setIsEnabled(graphEditJournal.list().length > 0);
    });
    return () => unsub();
  }, []);

  const active = isEnabled && !reorganizing;

  const handleUndo = async () => {
    if (reorganizing) return;
    if (!isEnabled) {
      toast(t('graph.correction.toast.nothingToUndo'), 'info');
      return;
    }
    const result = await graphCommandService.undo();
    if (result.success) {
      // B-5: `summary` is the operator-facing text. `undoneCmd` is the verb
      // literal used for log telemetry only — never use it in user-facing toast.
      toast(
        t('graph.correction.toast.undone', { summary: result.data?.summary ?? '' }),
        'success',
      );
    } else {
      toast(result.error?.message ?? t('graph.correction.toast.nothingToUndo'), 'error');
    }
  };

  return (
    <button
      onClick={handleUndo}
      aria-label={t('graph.correction.actions.undo')}
      disabled={!active}
      style={{
        position: 'absolute',
        bottom: '12px',
        right: '56px',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        color: 'var(--foreground)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: active ? 'pointer' : 'not-allowed',
        boxShadow: 'var(--shadow-1)',
        opacity: active ? 1 : 0.4,
        zIndex: 10,
      }}
    >
      <Undo2 size={18} />
    </button>
  );
}
