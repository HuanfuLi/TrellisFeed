import { useTranslation } from 'react-i18next';

interface YouTubeEmbedProps {
  videoId: string;
}

export function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: 'relative',
        paddingBottom: '56.25%',
        height: 0,
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface-variant)',
      }}
    >
      <iframe
        // Phase 36 GAP-C: enablejsapi=1 activates the YouTube IFrame Player API
        // postMessage channel — required for Detector D in PostDetailScreen to
        // observe ENDED + currentTime events. See .planning/debug/video-completion-signal-missing.md.
        src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin"
        allowFullScreen
        title={t('youTubeEmbed.playerTitle')}
      />
    </div>
  );
}
