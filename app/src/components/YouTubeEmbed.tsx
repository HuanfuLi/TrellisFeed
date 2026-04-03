interface YouTubeEmbedProps {
  videoId: string;
}

export function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
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
        src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`}
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
        title="YouTube video player"
      />
    </div>
  );
}
