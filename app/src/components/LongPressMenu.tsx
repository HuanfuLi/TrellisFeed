import { useTranslation } from 'react-i18next';
import { Heart, Bookmark, EyeOff, FolderMinus } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { engagementService } from '../services/engagement.service';
import { collectionService } from '../services/collection.service';
import { toast } from '../lib/toast';

interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
  /**
   * Phase 50 D-04: when provided, the Save row OPENS the collection picker
   * sheet (via the host) instead of toggling engagement directly. Host wires
   * this in plan 50-09 (HomeScreen / PostDetailScreen) and 50-08
   * (CollectionDrillInScreen).
   *
   * Graceful degradation: when absent, the legacy direct-toggle path is
   * preserved so existing call sites (and any surface not yet wired to the
   * picker) keep working unchanged.
   */
  onOpenCollectionPicker?: (postId: string) => void;
  /**
   * Phase 50 drill-in context: when provided, an extra "Remove from
   * collection" row renders between Save and Not Interested. The row calls
   * collectionService.removePost(collectionId, postId) with an Undo toast.
   * When absent (feed context), the row is hidden — preserving the
   * byte-stable 3-row visual contract on HomeScreen.
   */
  collectionContext?: { collectionId: string; collectionName: string };
}

/**
 * Phase 43 LP-01..LP-04: Bottom-sheet contextual menu for feed-tile engagement
 * actions (Like / Save / Not interested).
 *
 * Phase 50 Plan 50-07: API extension — two NEW optional props
 * (`onOpenCollectionPicker` + `collectionContext`) per UI-SPEC §Surface 9 and
 * D-04. Save row visual stays byte-stable; only the on-tap behavior branches
 * on `onOpenCollectionPicker` presence. The Remove-from-collection row is
 * conditional on `collectionContext`.
 *
 * State is read SYNCHRONOUSLY at render time via engagementService.isSaved /
 * isLiked — the menu is opened fresh each time the user long-presses a tile,
 * so a subscription is unnecessary. HomeScreen (43-06 host) owns the
 * { open, postId, anchorId } state and bumps it on each long-press.
 *
 * Anti-wire invariant (CONTEXT canonical_refs + RESEARCH Pitfall 8):
 *   - This component MUST NEVER emit any explored-anchor / vine-progress signal.
 *   - All emits go THROUGH the engagement service (ANCHOR_DISMISSED /
 *     ENGAGEMENT_CHANGED per Phase 39 D-05) or through collectionService
 *     (COLLECTIONS_CHANGED — emitted by addPost / removePost on real
 *     mutations only; no direct bus-emit calls in this component).
 *   - Source-reading tests in tests/components/LongPressMenu.test.mjs enforce
 *     zero occurrences of the explored-anchor event name OR any direct
 *     event-bus emit OR any direct dailyRead service call.
 *
 * Sheet-flash prevention (RESEARCH Pitfall 4):
 *   - The picker-opener Save row MUST call onOpenCollectionPicker(postId)
 *     BEFORE onClose(). React 19 batches both state updates in one render
 *     cycle so CollectionPickerSheet mounts as LongPressMenu unmounts — no
 *     blank frame. Source-reading test (LP-50-07) asserts the ordering.
 *
 * Visual contract (UI-SPEC §1 + §Surface 9):
 *   - 3 stacked button rows on feed tiles, top-to-bottom:
 *       Like → Save → Not interested
 *   - 4 rows in drill-in context (collectionContext provided):
 *       Like → Save → Remove from collection → Not interested
 *   - Row min-height 56px (exceeds 44px WCAG floor)
 *   - Icons Heart / Bookmark / FolderMinus / EyeOff at size 22
 *   - Active state flips label + icon fill ("Save" ↔ "Unsave", filled vs outline)
 *   - Inline styles + CSS variables only (NO Tailwind per project convention)
 *
 * Toast variants (LP-03 / UI-SPEC §3):
 *   - savePost / likePost  → 'success'
 *   - removeSavedPost / unlikePost / dismissAnchor / collection removal → 'info'
 *   - collection removal toast carries an Undo action that calls
 *     collectionService.addPost (which itself re-emits COLLECTIONS_CHANGED —
 *     no duplicate emit from this component, see anti-wire invariant).
 */
export function LongPressMenu({
  open,
  onClose,
  postId,
  anchorId,
  onOpenCollectionPicker,
  collectionContext,
}: LongPressMenuProps) {
  const { t } = useTranslation();

  // Defensive: if the host opens the menu without a post/anchor context we
  // render a closed sheet shell so the BottomSheet portal still mounts cleanly.
  if (!postId || !anchorId) {
    return (
      <BottomSheet open={false} onClose={onClose} compact>
        <></>
      </BottomSheet>
    );
  }

  const isSaved = engagementService.isSaved(postId);
  const isLiked = engagementService.isLiked(postId);

  const handleSave = () => {
    if (onOpenCollectionPicker && postId) {
      // Phase 50 D-04: open picker instead of direct toggle. Set picker state
      // FIRST, then close LongPressMenu (Pitfall 4 — React 19 batches both
      // updates in one render cycle, no blank frame between sheets).
      onOpenCollectionPicker(postId);
      onClose();
    } else {
      // Graceful degradation: direct-toggle path preserved for any surface
      // not yet wired to the picker (HomeScreen today; cleaned up in 50-09).
      if (isSaved) {
        engagementService.removeSavedPost(postId);
        toast(t('engagement.toast.unsaved'), 'info');
      } else {
        engagementService.savePost(postId);
        toast(t('engagement.toast.saved'), 'success');
      }
      onClose();
    }
  };

  const handleLike = () => {
    if (isLiked) {
      engagementService.unlikePost(postId);
      toast(t('engagement.toast.unliked'), 'info');
    } else {
      engagementService.likePost(postId);
      toast(t('engagement.toast.liked'), 'success');
    }
    onClose();
  };

  const handleDismiss = () => {
    engagementService.dismissAnchor(anchorId);
    toast(t('engagement.toast.dismissed'), 'info');
    onClose();
  };

  const handleRemoveFromCollection = () => {
    if (!postId || !collectionContext) return;
    collectionService.removePost(collectionContext.collectionId, postId);
    toast(
      t('library.collections.toast.removed', { collection: collectionContext.collectionName }),
      'info',
      {
        action: {
          label: t('common.undo'),
          onAction: () => {
            // collectionService.addPost re-emits COLLECTIONS_CHANGED on its own.
            // Do NOT emit here — anti-wire invariant + one-signal-per-event.
            collectionService.addPost(collectionContext.collectionId, postId);
          },
        },
      },
    );
    onClose();
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '56px',
    padding: '0 16px',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--foreground)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return (
    <BottomSheet open={open} onClose={onClose} compact>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Row 1: Like / Unlike — LP-04 state flip */}
        <button type="button" style={rowStyle} onClick={handleLike}>
          <Heart
            size={22}
            fill={isLiked ? 'currentColor' : 'none'}
            color={isLiked ? 'var(--node-salmon)' : 'var(--foreground)'}
          />
          <span>{isLiked ? t('engagement.menu.unlike') : t('engagement.menu.like')}</span>
        </button>

        {/* Row 2: Save / Unsave — LP-04 state flip + Phase 50 D-04 branched behavior.
            Visual: bookmark outline, color shifts to var(--primary-40) when saved.
            Phase 50 UAT G9: dropped the `fill='currentColor'` branch — operator
            flagged the filled-dark-green bookmark as visually inconsistent with
            user-created folder rows that stay outlined regardless of state. */}
        <button type="button" style={rowStyle} onClick={handleSave}>
          <Bookmark
            size={22}
            color={isSaved ? 'var(--primary-40)' : 'var(--foreground)'}
          />
          <span>{isSaved ? t('engagement.menu.unsave') : t('engagement.menu.save')}</span>
        </button>

        {/* Row 3 (drill-in context only): Remove from collection. Phase 50
            UI-SPEC §Surface 9 — renders only when collectionContext is provided.
            Non-destructive (post stays in Saved/History; only this collection's
            membership clears) → no confirmation; Undo toast covers accidents. */}
        {collectionContext && (
          <button type="button" style={rowStyle} onClick={handleRemoveFromCollection}>
            <FolderMinus size={22} color="var(--foreground)" fill="none" />
            <span>{t('library.collections.removeFromCollection')}</span>
          </button>
        )}

        {/* Row 4 (or 3 on feed tiles): Not interested — single state, muted
            (conservational not punitive per UI-SPEC §Color rules — never
            var(--danger)). */}
        <button
          type="button"
          style={{ ...rowStyle, color: 'var(--muted-foreground)' }}
          onClick={handleDismiss}
        >
          <EyeOff size={22} color="var(--muted-foreground)" fill="none" />
          <span>{t('engagement.menu.dismiss')}</span>
        </button>
      </div>
    </BottomSheet>
  );
}
