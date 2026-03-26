/**
 * FeedPostImage
 *
 * Displays a large AI-generated image for a feed post with:
 * - Emoji + title text overlay (semi-transparent scrim behind text)
 * - Loading skeleton while the image is being generated
 * - Error state with retry button
 * - Mobile-first safe-area aware layout
 *
 * Usage:
 *   <FeedPostImage
 *     imageData={generatedImage}        // null = loading, undefined = error
 *     overlayEmoji="🧠"
 *     overlayTitle="Why memory fades after sleep"
 *     isLoading={true}
 *     error="Image generation failed."
 *     onRetry={() => void handleRetry()}
 *   />
 */

import type { GeneratedImage } from '../types';

interface FeedPostImageProps {
  /** The generated image data. null while loading; undefined/absent if error. */
  imageData?: GeneratedImage | null;
  /** Loading state — shows skeleton animation. */
  isLoading?: boolean;
  /** Error message — shows error state with optional retry. */
  error?: string | null;
  /** Callback for retry button in error state. */
  onRetry?: () => void;
  /** Emoji rendered on top of the image. */
  overlayEmoji?: string;
  /** Title text rendered on top of the image (≤50 chars). */
  overlayTitle?: string;
  /** Minimum image height in px. Defaults to 220. */
  minHeight?: number;
  /** Additional CSS class names. */
  className?: string;
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function ImageSkeleton({ minHeight }: { minHeight: number }) {
  return (
    <div
      aria-label="Loading image"
      style={{
        width: '100%',
        minHeight,
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface-variant)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shimmer sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, white 15%, transparent) 50%, transparent 100%)',
          animation: 'shimmer 1.4s infinite',
        }}
      />
      {/* Inner label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '1.8rem', opacity: 0.3 }}>🖼</span>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', opacity: 0.7 }}>
          Generating image…
        </p>
      </div>
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────

function ImageError({
  message,
  onRetry,
  minHeight,
}: {
  message: string;
  onRetry?: () => void;
  minHeight: number;
}) {
  return (
    <div
      role="alert"
      style={{
        width: '100%',
        minHeight,
        borderRadius: 'var(--radius-xl)',
        border: '1.5px dashed var(--border)',
        backgroundColor: 'var(--surface-variant)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: '1.8rem' }}>🖼</span>
      <p
        style={{
          fontSize: '0.82rem',
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          style={{
            marginTop: '4px',
            padding: '8px 20px',
            borderRadius: 'var(--radius)',
            border: '1.5px solid var(--primary-40)',
            backgroundColor: 'transparent',
            color: 'var(--primary-40)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FeedPostImage({
  imageData,
  isLoading = false,
  error = null,
  onRetry,
  overlayEmoji = '',
  overlayTitle = '',
  minHeight = 220,
  className,
}: FeedPostImageProps) {
  // Loading state
  if (isLoading && !imageData) {
    return <ImageSkeleton minHeight={minHeight} />;
  }

  // Error state (no image, not loading)
  if (error && !imageData) {
    return <ImageError message={error} onRetry={onRetry} minHeight={minHeight} />;
  }

  // No data at all — show neutral placeholder
  if (!imageData) {
    return <ImageSkeleton minHeight={minHeight} />;
  }

  const imageSrc = imageData.imageBase64 ?? imageData.imageUrl ?? '';

  return (
    <div
      className={className}
      style={{
        width: '100%',
        minHeight,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'var(--surface-variant)',
      }}
    >
      {/* Background image */}
      <img
        src={imageSrc}
        alt={overlayTitle || 'Post image'}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          minHeight,
          objectFit: 'cover',
          display: 'block',
          position: 'absolute',
          inset: 0,
        }}
        onError={(e) => {
          // If image fails to load, hide it gracefully
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {/* Bottom gradient scrim for text legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
        }}
      />

      {/* Overlay text */}
      {(overlayEmoji || overlayTitle) && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 16px 18px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
          }}
        >
          {overlayEmoji && (
            <span
              style={{
                fontSize: '1.8rem',
                lineHeight: 1,
                flexShrink: 0,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            >
              {overlayEmoji}
            </span>
          )}
          {overlayTitle && (
            <p
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.3,
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {overlayTitle}
            </p>
          )}
        </div>
      )}

      {/* Spacer to enforce minHeight when image is absolute-positioned */}
      <div style={{ minHeight }} />
    </div>
  );
}
