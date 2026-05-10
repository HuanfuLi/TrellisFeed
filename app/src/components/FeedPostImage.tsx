/**
 * FeedPostImage
 *
 * Displays a large AI-generated image for a feed post.
 * Returns null when no image data is available — the parent renders
 * a text-only card in that case.
 */

import { useTranslation } from 'react-i18next';
import type { GeneratedImage } from '../types';

interface FeedPostImageProps {
  /** The generated image data. Renders nothing when absent/null. */
  imageData?: GeneratedImage | null;
  /**
   * Aspect ratio as a percentage string for the padding-bottom trick
   * (e.g. '100%' = 1:1 square, '56.25%' = 16:9).
   * When provided, height = width × (value/100). Defaults to fixed minHeight.
   */
  aspectPadding?: string;
  /** Minimum image height in px. Used when aspectPadding is not set. Defaults to 220. */
  minHeight?: number;
  /** Additional CSS class names. */
  className?: string;
}

// ─── Shared wrapper: padding-bottom trick gives reliable height in all WebKit ──

function AspectBox({
  aspectPadding,
  minHeight,
  children,
  style,
  className,
}: {
  aspectPadding?: string;
  minHeight: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (aspectPadding) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: 0,
          paddingBottom: aspectPadding,
          position: 'relative',
          overflow: 'hidden',
          // Phase 42 UAT-11 round 2 (2026-05-10): no own borderRadius. The parent
          // ConceptCard's overflow: hidden + 8px borderRadius clips this for us
          // — same pattern as the video thumbnail wrapper. A self-applied radius
          // (was `var(--radius-xl)` ~16px) double-rounded inside the card's
          // tighter 8px and left visible card-background gradient between the
          // two curves. Operator: "we should not add this corner crop for images
          // in post faces, just let the post face container crop it like the way
          // thumbnail in video post is cropped."
          backgroundColor: 'var(--surface-variant)',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={className}
      style={{
        width: '100%',
        minHeight,
        position: 'relative',
        overflow: 'hidden',
        // Phase 42 UAT-11 (2026-05-10): no own borderRadius. The parent
        // ConceptCard's overflow: hidden + 8px borderRadius clips this for us;
        // a self-applied radius (was `var(--radius-xl)` ~16px) double-rounded
        // inside the card's tighter 8px and showed empty card-background
        // gradient between the two curves.
        backgroundColor: 'var(--surface-variant)',
        ...style,
      }}
    >
      {children}
      <div style={{ minHeight }} />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FeedPostImage({
  imageData,
  aspectPadding,
  minHeight = 220,
  className,
}: FeedPostImageProps) {
  const { t } = useTranslation();
  // No image available — render nothing. Posts display text-only.
  if (!imageData) {
    return null;
  }

  const imageSrc = imageData.imageBase64 ?? imageData.imageUrl ?? '';

  return (
    <AspectBox minHeight={minHeight} aspectPadding={aspectPadding} className={className}>
      <img
        src={imageSrc}
        alt={t('feedPostImage.alt')}
        loading="lazy"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </AspectBox>
  );
}
