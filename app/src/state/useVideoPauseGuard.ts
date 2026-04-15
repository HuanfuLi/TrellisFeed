import { useEffect, useRef } from 'react';

/**
 * Pure decision function: given intersection ratio and document hidden state,
 * determine whether to pause, play, or do nothing.
 *
 * Exported for unit testing — pure function with no DOM/React dependencies.
 */
export function shouldPauseVideo(
  intersectionRatio: number,
  documentHidden: boolean,
): 'pause' | 'play' | 'noop' {
  if (documentHidden) return 'pause';
  if (intersectionRatio === 0) return 'pause';
  return 'play';
}

/**
 * Combined IntersectionObserver + document.visibilitychange guard for <video> elements.
 * Pauses video when EITHER the element is fully off-screen OR the tab is backgrounded.
 * Resumes when BOTH: element is intersecting AND document is visible.
 *
 * Rationale (CONTEXT D-26, RESEARCH Pattern 5, RESEARCH Pitfall 5):
 * - First-level screens may remain in display:none / hidden states without unmounting.
 * - IntersectionObserver alone does not fire for display:none changes.
 * - visibilitychange alone does not cover scroll-off-screen cases.
 * - Together they cover both.
 * - `video.play()` can throw DOMException (iOS autoplay gate); wrap in .catch.
 */
export function useVideoPauseGuard(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): void {
  const isIntersectingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (document.visibilityState === 'hidden') return;
      if (!isIntersectingRef.current) return;
      video.play().catch(() => { /* autoplay blocked or race; ignore */ });
    };

    const tryPause = () => {
      try { video.pause(); } catch { /* ignore */ }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isIntersectingRef.current = entry.intersectionRatio > 0;
        if (entry.intersectionRatio === 0) tryPause();
        else tryPlay();
      },
      { threshold: 0 },
    );
    observer.observe(video);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') tryPause();
      else tryPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Also attempt play on canplay event (Pitfall 5 — play() before readyState 2 races)
    const onCanPlay = () => tryPlay();
    video.addEventListener('canplay', onCanPlay);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [videoRef, enabled]);
}
