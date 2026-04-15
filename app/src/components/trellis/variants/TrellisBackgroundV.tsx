import { useRef, useState } from 'react';
import { useVideoPauseGuard } from '../../../state/useVideoPauseGuard';

// Asset URLs resolved at build time via `new URL(..., import.meta.url)`.
// If the actual files are absent, <video> `onError` flips to poster-only mode.
const VIDEO_MP4_URL = new URL('../../../assets/planner-trellis/trellis-loop.mp4', import.meta.url).href;
const VIDEO_WEBM_URL = new URL('../../../assets/planner-trellis/trellis-loop.webm', import.meta.url).href;
const POSTER_URL = new URL('../../../assets/planner-trellis/trellis-bg-default.png', import.meta.url).href;

export function TrellisBackgroundV() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  // Only activate guard when video is actually rendered
  useVideoPauseGuard(videoRef, !videoFailed);

  if (videoFailed) {
    // Fallback: poster image with gradient fallback (same visual as Variant A)
    return (
      <img
        src={POSTER_URL}
        alt=""
        aria-hidden="true"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          background: 'linear-gradient(180deg, var(--node-peach) 0%, var(--surface) 60%, var(--surface-variant) 100%)',
        }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      loop
      preload="metadata"
      poster={POSTER_URL}
      aria-hidden="true"
      onError={() => setVideoFailed(true)}
      style={{
        position: 'absolute', inset: 0, zIndex: 0,
        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
      }}
    >
      <source src={VIDEO_WEBM_URL} type="video/webm" />
      <source src={VIDEO_MP4_URL} type="video/mp4" />
    </video>
  );
}
