import { useEffect, useMemo, useRef, useState } from 'react';
import type { OriginalContentAsset, Post } from '../domain/content.types';

export type OriginalContentStatus = 'article' | 'video' | 'video-unavailable';

export interface OriginalContentProps {
  post: Readonly<Post>;
  asset: Readonly<OriginalContentAsset>;
  fallbackNotice?: string;
  transcriptUnavailableNotice?: string;
  sourceLinkLabel?: string;
  onSourceClick: (postId: string) => void;
  onVideoPlay: (postId: string) => void;
  onVideoProgress: (postId: string, durationMs: number) => void;
}

const PLAYER_ERRORS = new Set([100, 101, 150, 153]);

function safeHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

function youtubeVideoId(value: string): string | null {
  const parsed = safeHttpUrl(value);
  if (!parsed) return null;
  if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
  if (parsed.hostname.endsWith('youtube.com')) {
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null;
    return parsed.searchParams.get('v');
  }
  return null;
}

export function handleVideoStateChange(state: number): 'play' | 'other' {
  return state === 1 ? 'play' : 'other';
}

export function videoProgressMarkers(currentSeconds: number, durationSeconds?: number): string[] {
  if (!Number.isFinite(currentSeconds) || currentSeconds <= 0) return [];
  if (durationSeconds && durationSeconds > 0) {
    const ratio = currentSeconds / durationSeconds;
    return [25, 50, 75].filter((marker) => ratio >= marker / 100).map((marker) => `ratio:${marker}`);
  }
  // Frozen YouTube records may intentionally omit duration. Emit bounded,
  // low-frequency elapsed-time milestones so progress remains observable.
  return [5, 15, 30, 60].filter((marker) => currentSeconds >= marker).map((marker) => `elapsed:${marker}`);
}

export function OriginalContent({
  post,
  asset,
  fallbackNotice = 'Video unavailable - showing reviewed summary',
  transcriptUnavailableNotice = 'Transcript unavailable — this app stores only the reviewed summary.',
  sourceLinkLabel = 'Open original source',
  onSourceClick,
  onVideoPlay,
  onVideoProgress,
}: OriginalContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playedRef = useRef(false);
  const progressRef = useRef(new Set<string>());
  const currentSecondsRef = useRef(0);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [playerFailed, setPlayerFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const sourceUrl = safeHttpUrl(post.sourceUrl);
  const videoId = asset.kind === 'video' ? youtubeVideoId(asset.sourceUrl) : null;
  const status: OriginalContentStatus = asset.kind === 'article'
    ? 'article'
    : online && !playerFailed && videoId ? 'video' : 'video-unavailable';
  const blocks = useMemo(() => (asset.body ?? '').split(/\n\s*\n/g).map((block) => block.trim()).filter(Boolean), [asset.body]);

  const handleSourceClick = () => onSourceClick(post.id);

  useEffect(() => {
    let disposed = false;
    let nativeListener: { remove: () => Promise<void> } | undefined;
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    // Android WebView can leave navigator.onLine=true in airplane mode and an
    // iframe DNS failure does not reliably reach React's onError handler. The
    // native Network plugin observes ConnectivityManager instead.
    void import('@capacitor/network').then(async ({ Network }) => {
      const status = await Network.getStatus();
      if (!disposed) setOnline(status.connected);
      const listener = await Network.addListener('networkStatusChange', ({ connected }) => {
        if (!disposed) setOnline(connected);
      });
      if (disposed) await listener.remove();
      else nativeListener = listener;
    }).catch(() => {
      // Browser tests and unsupported hosts retain the online/offline fallback.
    });

    return () => {
      disposed = true;
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
      void nativeListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (status !== 'video') return;
    const receivePlayerEvent = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!payload || typeof payload !== 'object') return;
      const message = payload as { event?: string; info?: number | { currentTime?: number } };
      if (message.event === 'onError' && typeof message.info === 'number' && PLAYER_ERRORS.has(message.info)) {
        setPlayerFailed(true);
        setPlaying(false);
      }
      if (message.event === 'onStateChange' && typeof message.info === 'number') {
        const state = handleVideoStateChange(message.info);
        setPlaying(state === 'play');
        if (state === 'play' && !playedRef.current) {
          playedRef.current = true;
          onVideoPlay(post.id);
        }
      }
      if (message.event === 'infoDelivery' && typeof message.info === 'object' && typeof message.info.currentTime === 'number') {
        currentSecondsRef.current = message.info.currentTime;
      }
    };
    window.addEventListener('message', receivePlayerEvent);
    return () => window.removeEventListener('message', receivePlayerEvent);
  }, [onVideoPlay, post.id, status]);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), 'https://www.youtube.com');
      for (const marker of videoProgressMarkers(currentSecondsRef.current, post.durationSeconds)) {
        if (!progressRef.current.has(marker)) {
          progressRef.current.add(marker);
          onVideoProgress(post.id, Math.round(currentSecondsRef.current * 1000));
        }
      }
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [onVideoProgress, playing, post.durationSeconds, post.id]);

  const origin = typeof window === 'undefined' || window.location.origin === 'null' ? undefined : window.location.origin;
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`
    : null;
  const registerPlayerEvents = () => {
    for (const eventName of ['onStateChange', 'onError']) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'addEventListener', args: [eventName] }),
        'https://www.youtube.com',
      );
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {status === 'article' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '16px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {blocks.map((block, index) => <p key={index} style={{ margin: 0 }}>{block}</p>)}
        </div>
      ) : status === 'video' && embedUrl ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 'var(--radius-xl)', background: '#000' }}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={post.originalTitle}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={registerPlayerEvents}
            onError={() => setPlayerFailed(true)}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p role="status" style={{ margin: 0, padding: '8px 16px', borderRadius: 'var(--radius-xl)', background: 'var(--surface-variant)', fontSize: '14px', lineHeight: 1.5 }}>{fallbackNotice}</p>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{transcriptUnavailableNotice}</p>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{asset.digest}</p>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{post.longSummary ?? post.shortSummary}</p>
        </div>
      )}

      {sourceUrl ? (
        <a href={sourceUrl.href} target="_blank" rel="noreferrer noopener" onClick={handleSourceClick} style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', color: 'var(--foreground)', textDecoration: 'underline', fontSize: '14px', lineHeight: 1.5 }}>
          {sourceLinkLabel}: {post.sourceName}
        </a>
      ) : (
        <span style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{post.sourceUrl}</span>
      )}
    </section>
  );
}
