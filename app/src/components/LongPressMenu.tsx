import { useTranslation } from 'react-i18next';
import { Heart, Bookmark, EyeOff } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { engagementService } from '../services/engagement.service';
import { toast } from '../lib/toast';

interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
}

export function LongPressMenu({
  open,
  onClose,
  postId,
  anchorId,
}: LongPressMenuProps) {
  const { t } = useTranslation();

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
    if (isSaved) {
      engagementService.removeSavedPost(postId);
      toast(t('engagement.toast.unsaved'), 'info');
    } else {
      engagementService.savePost(postId);
      toast(t('engagement.toast.saved'), 'success');
    }
    onClose();
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
        <button type="button" style={rowStyle} onClick={handleLike}>
          <Heart
            size={22}
            fill={isLiked ? 'currentColor' : 'none'}
            color={isLiked ? 'var(--node-salmon)' : 'var(--foreground)'}
          />
          <span>{isLiked ? t('engagement.menu.unlike') : t('engagement.menu.like')}</span>
        </button>

        <button type="button" style={rowStyle} onClick={handleSave}>
          <Bookmark
            size={22}
            color={isSaved ? 'var(--primary-40)' : 'var(--foreground)'}
          />
          <span>{isSaved ? t('engagement.menu.unsave') : t('engagement.menu.save')}</span>
        </button>

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
