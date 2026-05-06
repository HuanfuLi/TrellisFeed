import React, { useState, useEffect, useRef, useContext } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { SwipeTabContext } from '../lib/swipe-tab-context';
import type { BlindboxItem, DailyPost, GeneratedImage, Question } from '../types';
import { FeedPostImage } from './FeedPostImage';
import { imageGenerationService } from '../services/imageGeneration.service';
import { inferImageStyle, buildImagePrompt } from '../services/postFormatting.service';
import { normalizePlainText } from '../lib/text-normalization';
import { settingsService } from '../services/settings.service';
import { dailyReadService, getAnchorIdForPost } from '../services/daily-read.service';
import { questionService } from '../services/question.service';
import { eventBus } from '../lib/event-bus';
import { SuggestionCard } from './SuggestionCard';

// ── Text-art theme pool (random selection per render) ──────────────────────────

const TEXT_ART_THEMES_LIGHT = [
  { bg: '#FFFDE7', dot: '#C5CAE9', text: '#1A1A1A', font: 'Georgia, "Times New Roman", serif' },
  { bg: '#E8F5E9', dot: '#A5D6A7', text: '#1B5E20', font: '"Courier New", Courier, monospace' },
  { bg: '#F3E5F5', dot: '#CE93D8', text: '#4A148C', font: 'Palatino, "Palatino Linotype", serif' },
  { bg: '#E3F2FD', dot: '#90CAF9', text: '#0D47A1', font: 'system-ui, -apple-system, sans-serif' },
  { bg: '#FFF3E0', dot: '#FFCC80', text: '#BF360C', font: '"Trebuchet MS", "Gill Sans", sans-serif' },
  { bg: '#FCE4EC', dot: '#F48FB1', text: '#880E4F', font: 'Garamond, "Hoefler Text", serif' },
  { bg: '#E0F7FA', dot: '#80DEEA', text: '#006064', font: 'Verdana, Geneva, sans-serif' },
  { bg: '#FFF8E1', dot: '#FFE082', text: '#E65100', font: '"Bookman Old Style", Bookman, serif' },
];
const TEXT_ART_THEMES_DARK = [
  { bg: '#1C1A14', dot: '#2A2840', text: '#FFF9C4', font: 'Georgia, "Times New Roman", serif' },
  { bg: '#1A2E1C', dot: '#2E5A30', text: '#A5D6A7', font: '"Courier New", Courier, monospace' },
  { bg: '#2A1A30', dot: '#4A2060', text: '#CE93D8', font: 'Palatino, "Palatino Linotype", serif' },
  { bg: '#1A2030', dot: '#1E3A5A', text: '#90CAF9', font: 'system-ui, -apple-system, sans-serif' },
  { bg: '#2A1E14', dot: '#4A3018', text: '#FFCC80', font: '"Trebuchet MS", "Gill Sans", sans-serif' },
  { bg: '#2A1420', dot: '#4A1830', text: '#F48FB1', font: 'Garamond, "Hoefler Text", serif' },
  { bg: '#142A2C', dot: '#1A3A3E', text: '#80DEEA', font: 'Verdana, Geneva, sans-serif' },
  { bg: '#2A2414', dot: '#3A3018', text: '#FFE082', font: '"Bookman Old Style", Bookman, serif' },
];
function getTextArtThemes() {
  return document.documentElement.classList.contains('dark') ? TEXT_ART_THEMES_DARK : TEXT_ART_THEMES_LIGHT;
}

function pickTextArtTheme(postId: string) {
  const themes = getTextArtThemes();
  let h = 0;
  for (const ch of postId) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  const idx = ((h % themes.length) + themes.length) % themes.length;
  return themes[idx];
}

export type InfoFlowItem =
  | { kind: 'concept'; post: DailyPost }
  | {
      kind: 'connection';
      questionA: Question;
      questionB: Question;
      conceptNounA: string;
      conceptNounB: string;
      bridgeInsight: string;
      cosineSimilarity: number;
      connectionPostId?: string;
    }
  | { kind: 'milestone'; item: BlindboxItem };

interface ConceptCardProps {
  post: DailyPost;
  /** 0-based feed index — used to rotate image styles across the feed. */
  feedIndex?: number;
  isActive: boolean;
  onOpen: (postId: string, post: DailyPost) => void;
}

function ConceptCard({ post, feedIndex: _feedIndex = 0, isActive, onOpen, videoPlaying, setVideoPlaying }: ConceptCardProps & { videoPlaying: string | null; setVideoPlaying: (id: string | null) => void }) {
  const { t } = useTranslation();

  // ── Image generation state ──────────────────────────────────────────────────
  // Video/short posts skip AI image generation entirely (D-08: use YouTube thumbnail).
  const isSuggestion = post.sourceType === 'suggestion' && !!post.suggestionMeta?.topics;
  const isVideoPost = post.sourceType === 'video';
  const isShortPost = post.sourceType === 'short';
  const isNewsPost = post.sourceType === 'news';
  const presentationStyle = post.presentationStyle;

  // Short video playback now uses parent videoPlaying/setVideoPlaying (unified state, D-02/D-28/D-29)

  // Non-image presentation styles and video/short posts skip image generation entirely
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [imageResolved, setImageResolved] = useState(
    () => isSuggestion || isVideoPost || isShortPost || isNewsPost
      || presentationStyle === 'text-art'
      || presentationStyle === 'image-less'
      || presentationStyle === 'short'
      || presentationStyle === 'video'
      || presentationStyle === 'news'
      || imageGenerationService.hasCachedImage(post.id, inferImageStyle(post)),
  );

  // D-22a (Phase 33 Plan 06): hoist settings read out of per-card useEffect hot path.
  // Was: settings.imageGeneration.enabled was re-read inside the per-card image-effect
  // every time the effect's deps changed. Now: snapshot once on mount; if a settings
  // update needs to invalidate, the snapshot stays stable for this card's lifetime
  // (acceptable — image generation is a one-shot per-mount decision; users toggling
  // the setting only affects future card mounts).
  const [imageEnabled] = useState(() => settingsService.getSync().imageGeneration.enabled);

  useEffect(() => {
    // Skip AI image generation for non-image presentation styles
    if (isSuggestion || isVideoPost || isShortPost || isNewsPost) return;
    if (presentationStyle && presentationStyle !== 'image') {
      setImageResolved(true);
      return;
    }

    // Also respect the image generation settings toggle (per D-11)
    // D-22a (Phase 33 Plan 06): imageEnabled now a useState snapshot from above
    if (!imageEnabled) {
      setImageResolved(true);
      return;
    }

    let cancelled = false;

    const style = inferImageStyle(post);
    const prompt = buildImagePrompt(post);

    void imageGenerationService.generateImage(post.id, prompt, style).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setImage(result.data);
      }
      setImageResolved(true);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, isSuggestion, isVideoPost, isShortPost, isNewsPost, presentationStyle]);

  // Suggestion post — D-23/D-26: only topic buttons are interactive, card tap is no-op
  if (isSuggestion) {
    return <SuggestionCard topics={post.suggestionMeta!.topics} />;
  }

  // Don't render the card until the image request has resolved (success or failure)
  if (!imageResolved) return null;

  // ── End image state ─────────────────────────────────────────────────────────

  const normalizedTitle = normalizePlainText(post.title);
  const normalizedHook = normalizePlainText(post.teaser.hook);
  const normalizedPreview = normalizePlainText(post.teaser.preview);

  // Defense-in-depth: never expose a text-only card. If NO visual block would render
  // (because metadata is missing, the style is unrecognized, or the image gen failed),
  // fall back to text-art. This catches:
  //   - Failed image gen (no Nano Banana key, network/sandbox failure)             → 'image'
  //   - Session posts assigned 'short'/'video'/'news' with no metadata (Bug B)     → empty card
  //   - YouTube non-video items propagated as posts with undefined videoId (Bug C) → empty card
  //   - Suggestion posts with no topics (LLM failed + no neighbor anchors)         → empty card
  //   - Legacy 'image-less' or undefined presentationStyle from older caches       → empty card
  // The previous fallback only caught the first case (`presentationStyle === 'image'`),
  // which is why post-32.1 deploys still showed text-only cards on device.
  const wouldRenderVisual =
    (isVideoPost && !!post.videoMeta?.videoId) ||
    (isShortPost && !!post.videoMeta?.videoId) ||
    isNewsPost ||
    !!image ||
    presentationStyle === 'text-art';
  const effectivePresentationStyle: typeof presentationStyle = !wouldRenderVisual ? 'text-art' : presentationStyle;
  if (!wouldRenderVisual && import.meta.env.DEV) {
    // Surface the regression in dev logs so future refactors notice immediately.
    console.warn('[InfoFlow] Forced text-art fallback for post', post.id, {
      sourceType: post.sourceType,
      presentationStyle,
      hasVideoMeta: !!post.videoMeta?.videoId,
      hasImage: !!image,
    });
  }

  // News card (D-09) — newspaper style
  if (isNewsPost) {
    return (
      <div
        onClick={() => onOpen(post.id, post)}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '0 0 16px 0',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--news-card-bg)',
          border: '1px solid var(--news-card-border)',
          boxShadow: 'var(--shadow-2)',
          cursor: 'pointer',
          fontFamily: "Georgia, 'Times New Roman', 'Noto Serif', serif",
          position: 'relative',
          overflow: 'hidden',
          animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
        }}
      >
        {/* Subtle dot grid background pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--news-card-dot) 0.5px, transparent 0.5px)',
          backgroundSize: '20px 20px',
          opacity: 0.15,
          pointerEvents: 'none',
        }} />

        <div style={{ padding: '24px 20px 0', position: 'relative' }}>
          {/* Source attribution — uppercase, small */}
          {post.newsMeta?.sources?.[0] && (
            <span style={{
              display: 'block',
              fontSize: '0.7rem',
              color: 'var(--news-card-source)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              {(() => {
                try { return new URL(post.newsMeta.sources[0].url).hostname.replace('www.', ''); }
                catch { return 'Web'; }
              })()}
            </span>
          )}

          {/* Headline */}
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'var(--news-card-headline)',
            marginBottom: '12px',
          }}>
            {normalizedTitle}
          </h3>

          {/* Preview text */}
          <p style={{
            fontSize: '0.9rem',
            lineHeight: 1.55,
            color: 'var(--news-card-body)',
            marginBottom: '20px',
          }}>
            {normalizedPreview}
          </p>
        </div>

        {/* Bottom rule line — newspaper divider */}
        <div style={{
          borderTop: '1px solid var(--news-card-divider)',
          padding: '12px 20px 0',
          position: 'relative',
        }}>
          {/* Bottom tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--news-card-tag-text)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              backgroundColor: 'var(--news-card-tag-bg)',
              padding: '3px 8px',
              borderRadius: '100px',
            }}>
              {t('infoFlow.newsTag')}
            </span>
            {post.sourceQuestionTitles?.slice(0, 1).map((title, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--news-card-muted)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  padding: '3px 8px',
                  borderRadius: '100px',
                  border: '1px solid var(--news-card-tag-border)',
                }}
              >
                {title}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Regular concept posts
  // Rendered as <div role="button"> rather than <button> so inner interactive
  // elements (video stop button, etc.) can safely be actual <button>s without
  // tripping the "<button> cannot be a descendant of <button>" DOM-nesting
  // invariant. Preserves click + keyboard (Enter/Space) affordances.
  const interactive = !isShortPost;
  const handleActivate = () => { if (interactive) onOpen(post.id, post); };
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleActivate : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      } : undefined}
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: (image || isVideoPost || effectivePresentationStyle === 'text-art') ? 'space-between' : 'flex-start',
        gap: '20px',
        padding: isShortPost ? '0' : (image || isVideoPost || effectivePresentationStyle === 'text-art') ? '0 0 20px' : '20px 0',
        borderRadius: 'var(--radius-xl)',
        background: isShortPost
          ? 'var(--card)'
          : 'linear-gradient(180deg, color-mix(in srgb, var(--primary-80) 20%, var(--surface-container-high)), var(--surface-container-high))',
        border: '1.5px solid color-mix(in srgb, var(--primary-40) 22%, var(--border))',
        boxShadow: 'var(--shadow-2)',
        cursor: isShortPost ? 'default' : 'pointer',
        transition: 'transform 0.18s ease, background 0.25s ease',
        textAlign: 'left',
        animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
        overflow: 'hidden',
      }}
    >

        {/* Video card: inline landscape playback (D-28) — tapping play does NOT trigger essay generation */}
        {isVideoPost && post.videoMeta?.videoId && (
          <div
            style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden' }}
          >
            {videoPlaying === post.id ? (
              <>
                <iframe
                  // Phase 36 GAP-C: enablejsapi=1 added for symmetry with YouTubeEmbed.
                  // Inline-feed video posts route to PostDetailScreen via onOpen for the
                  // Detector D postMessage path; this iframe is the inline preview.
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'auto' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={normalizedTitle || t('infoFlow.postImageAlt')}
                />
                {/* Transparent overlay — pointer-events:none lets YouTube controls receive taps (G2 / UAT-31-4 fix).
                    Swipe-stop is wired separately via SwipeTabContext at line ~936; D-07 accepts that
                    tap-on-playing may not stop playback — close button below is the explicit stop affordance. */}
                <div
                  style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'transparent' }}
                  aria-hidden="true"
                />
                {/* Close button — visible affordance to stop */}
                <button
                  onClick={(e) => { e.stopPropagation(); setVideoPlaying(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 3,
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                  aria-label="Stop video"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoPlaying(post.id);
                }}
                style={{ cursor: 'pointer', position: 'relative', width: '100%', height: '100%' }}
              >
                {post.videoMeta.thumbnailUrl && <img
                  src={post.videoMeta.thumbnailUrl}
                  alt={normalizedTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.15)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: '16px solid white',
                        borderTop: '10px solid transparent',
                        borderBottom: '10px solid transparent',
                        marginLeft: 4,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Short video card (D-01, D-02, D-03) — portrait, fills card width */}
        {isShortPost && post.videoMeta?.videoId && (
          <div
            onClick={(e) => {
              if (videoPlaying !== post.id) {
                e.stopPropagation();
                setVideoPlaying(post.id);
                // Phase 36 GAP-C: tap-to-play on a short post is a strong implicit
                // completion signal (5-15s clips). Shorts have interactive=false at
                // ConceptCard line 295 — they never navigate to PostDetailScreen, so
                // Detectors A/B/C/D never run. Emit CONCEPT_EXPLORED here instead.
                // Idempotent via the markExplored call below (no-op if already set).
                // See .planning/debug/video-completion-signal-missing.md.
                try {
                  const allQ = questionService.getAll({ includeFlagged: true });
                  const byId = new Map(allQ.map(q => [q.id, q]));
                  const anchorId = getAnchorIdForPost(post, byId);
                  if (anchorId && !dailyReadService.isExplored(anchorId)) {
                    dailyReadService.markExplored(anchorId);
                    eventBus.emit({ type: 'CONCEPT_EXPLORED', payload: { anchorId } });
                  }
                } catch (err) {
                  // Defensive: never let signal-emit errors break tap-to-play.
                  console.warn('[InfoFlow] short tap-to-play emit failed:', err);
                }
              }
            }}
            style={{
              cursor: videoPlaying === post.id ? 'default' : 'pointer',
              width: '100%',
            }}
          >
            {videoPlaying === post.id ? (
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9/16',
                overflow: 'hidden',
              }}>
                <iframe
                  // Phase 36 GAP-C: enablejsapi=1 added for symmetry. Shorts emit
                  // CONCEPT_EXPLORED on tap-to-play (see setVideoPlaying handler) — the
                  // postMessage path is not used here, but keep the param for any future
                  // postMessage-based detection on shorts.
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?playsinline=1&autoplay=1&rel=0&enablejsapi=1`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'auto' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={normalizedTitle || t('infoFlow.postImageAlt')}
                />
                {/* Transparent overlay — pointer-events:none lets YouTube controls receive taps (G2 / UAT-31-4 fix).
                    Swipe-stop is wired separately via SwipeTabContext at line ~936; D-07 accepts that
                    tap-on-playing may not stop playback — close button below is the explicit stop affordance. */}
                <div
                  style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'transparent' }}
                  aria-hidden="true"
                />
                {/* Close button — visible affordance to stop */}
                <button
                  onClick={(e) => { e.stopPropagation(); setVideoPlaying(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 3,
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                  aria-label="Stop video"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9/16',
                overflow: 'hidden',
              }}>
                {post.videoMeta.thumbnailUrl && <img
                  src={post.videoMeta.thumbnailUrl}
                  alt={normalizedTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />}
                <span style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#fff',
                  background: 'rgba(255,0,0,0.85)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}>
                  {t('infoFlow.shortTag')}
                </span>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 0,
                      height: 0,
                      borderLeft: '20px solid white',
                      borderTop: '12px solid transparent',
                      borderBottom: '12px solid transparent',
                      marginLeft: 5,
                    }} />
                  </div>
                </div>
                {/* No heading overlay — short video card is thumbnail-only */}
              </div>
            )}
          </div>
        )}

        {/* Text-art notebook card (D-12, D-13, D-14) — square area like image posts */}
        {effectivePresentationStyle === 'text-art' && (() => {
          const theme = pickTextArtTheme(post.id);
          const content = post.textArtContent?.split('\n').filter(Boolean).join(' ') || normalizedPreview;
          const fontSize = content.length > 100 ? '1.25rem' : content.length > 60 ? '1.5rem' : '2rem';
          return (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1/1',
                maxHeight: '320px',
                overflow: 'hidden',
                backgroundColor: theme.bg,
                backgroundImage: `radial-gradient(circle, ${theme.dot} 0.8px, transparent 0.8px)`,
                backgroundSize: '20px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 28px',
                boxSizing: 'border-box',
              }}
            >
              <p
                style={{
                  fontSize,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: theme.text,
                  margin: 0,
                  textAlign: 'center',
                  fontFamily: theme.font,
                  textWrap: 'balance',
                }}
              >
                {content}
              </p>
            </div>
          );
        })()}

        {/* AI-generated image header — only rendered for image presentation style */}
        {!isVideoPost && !isShortPost && image && effectivePresentationStyle !== 'text-art' && (
          <FeedPostImage
            imageData={image}
            aspectPadding="100%"
          />
        )}

        {/* Hook, channel attribution, preview, and tags — NOT rendered for short */}
        {!isShortPost && (
          <div style={{ padding: '0 20px' }}>
            <p
              style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                lineHeight: 1.25,
                color: 'var(--foreground)',
                marginBottom: '10px',
              }}
            >
              {normalizedHook}
            </p>
            {isVideoPost && post.videoMeta?.channelTitle && (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                {t('infoFlow.byChannel', { channel: post.videoMeta.channelTitle })}
              </p>
            )}
            {/* Preview: show when no image is present */}
            {!image && !isVideoPost && effectivePresentationStyle !== 'text-art' && (
              <p style={{ fontSize: '0.9rem', color: 'var(--foreground)', lineHeight: 1.6, opacity: 0.88 }}>
                {normalizedPreview}
              </p>
            )}
            {/* Bottom tags: source concepts + narrative mode */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {post.sourceQuestionTitles?.slice(0, 2).map((title, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--muted-foreground)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    padding: '3px 8px',
                    borderRadius: '100px',
                  }}
                >
                  {title}
                </span>
              ))}
            </div>
            </div>
            )}
            </div>

  );
}

// D-23 (Phase 33 Plan 06): React.memo wrapper around ConceptCard.
// Custom equality: parent re-renders 8 cards on every event-bus emission;
// without memo, all 8 re-render. With memo, only cards whose props actually
// changed re-render. Internal state (image, imageResolved) is not in the
// comparator because React.memo only sees props — internal state changes
// always trigger re-render via useState's normal behavior.
//
// GUARDRAIL (Phase 32.1 Wave 4 D-W4-03): this wrapper sits OUTSIDE the
// wouldRenderVisual fallback at the top of ConceptCard. The fallback runs on
// every render that DOES occur — memo only changes WHETHER a render occurs,
// not what happens inside one.
function conceptCardPropsEqual(
  prev: ConceptCardProps & { videoPlaying: string | null; setVideoPlaying: (id: string | null) => void },
  next: ConceptCardProps & { videoPlaying: string | null; setVideoPlaying: (id: string | null) => void },
): boolean {
  return (
    prev.post.id === next.post.id &&
    prev.isActive === next.isActive &&
    prev.videoPlaying === next.videoPlaying &&
    prev.onOpen === next.onOpen &&
    prev.setVideoPlaying === next.setVideoPlaying &&
    prev.feedIndex === next.feedIndex
  );
}

const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual);

// Color palette for connection cards — vivid, high-contrast pairs.
// Each entry: [bg, glowRgba]. No two adjacent colors in the pool are similar.
const CONNECTION_COLORS = [
  { bg: '#D84315', glow: 'rgba(216,67,21,0.45)' },   // deep orange
  { bg: '#0277BD', glow: 'rgba(2,119,189,0.45)' },    // ocean blue
  { bg: '#6A1B9A', glow: 'rgba(106,27,154,0.45)' },   // purple
  { bg: '#00695C', glow: 'rgba(0,105,92,0.45)' },     // teal
  { bg: '#AD1457', glow: 'rgba(173,20,87,0.45)' },    // magenta
  { bg: '#283593', glow: 'rgba(40,53,147,0.45)' },    // indigo
  { bg: '#E65100', glow: 'rgba(230,81,0,0.45)' },     // vivid orange
  { bg: '#1565C0', glow: 'rgba(21,101,192,0.45)' },   // bright blue
];

/** Pick two distinct colors deterministically from a pair of IDs. */
function pickConnectionColors(idA: string, idB: string) {
  // Simple hash from string → number
  let h = 0;
  for (const ch of idA + idB) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  const i = ((h % CONNECTION_COLORS.length) + CONNECTION_COLORS.length) % CONNECTION_COLORS.length;
  let j = (i + 1 + (Math.abs(h >> 8) % (CONNECTION_COLORS.length - 1))) % CONNECTION_COLORS.length;
  if (j === i) j = (i + 1) % CONNECTION_COLORS.length; // safety
  return { a: CONNECTION_COLORS[i], b: CONNECTION_COLORS[j] };
}

interface ConnectionCardProps {
  conceptNounA: string;
  conceptNounB: string;
  bridgeInsight: string;
  cosineSimilarity: number;
  showScore: boolean;
  questionA: Question;
  questionB: Question;
  onOpenConnection: (idA: string, idB: string) => void;
}

function ConnectionCard({ conceptNounA, conceptNounB, bridgeInsight, questionA, questionB, onOpenConnection }: ConnectionCardProps) {
  const { t } = useTranslation();
  const colors = pickConnectionColors(questionA.id, questionB.id);

  return (
    <button
      onClick={() => onOpenConnection(questionA.id, questionB.id)}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: 'var(--card)',
        borderRadius: 'var(--radius-xl)',
        border: '1.5px solid var(--border)',
        boxShadow: 'var(--shadow-2)',
        textAlign: 'left',
        overflow: 'hidden',
      }}
    >
      {/* Bridge insight — primary hook */}
      <p
        style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--foreground)',
          margin: 0,
        }}
      >
        {bridgeInsight}
      </p>

      {/* Concept noun blocks */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div
          style={{
            flex: 1,
            padding: '16px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: colors.a.bg,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('infoFlow.concept')}
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25, margin: 0 }}>
            {conceptNounA}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            padding: '16px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: colors.b.bg,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('infoFlow.concept')}
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25, margin: 0 }}>
            {conceptNounB}
          </p>
        </div>
      </div>
    </button>
  );
}

const MILESTONE_BG: Record<BlindboxItem['type'], string> = {
  milestone: 'linear-gradient(135deg, #FFD54F 0%, #FF8F00 100%)',
  trivia: 'linear-gradient(135deg, #4FC3F7 0%, #0277BD 100%)',
};

const MILESTONE_TEXT: Record<BlindboxItem['type'], string> = {
  milestone: '#1A1A1A',
  trivia: '#ffffff',
};

function MilestoneCard({ item, isActive }: { item: BlindboxItem; isActive: boolean }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '16px',
        padding: '32px 28px',
        boxSizing: 'border-box',
        background: MILESTONE_BG[item.type],
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-3)',
        overflow: 'hidden',
        animation: isActive ? 'milestone-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}
    >
      <span style={{ fontSize: '4.5rem', lineHeight: 1 }}>{item.emoji}</span>
      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: MILESTONE_TEXT[item.type], lineHeight: 1.3 }}>
        {item.headline}
      </p>
      <p style={{ fontSize: '0.95rem', color: MILESTONE_TEXT[item.type], opacity: 0.88, lineHeight: 1.7, maxWidth: '280px' }}>
        {item.body}
      </p>
    </div>
  );
}

interface InlineInfoFlowProps {
  items: InfoFlowItem[];
  onOpenConnection: (idA: string, idB: string) => void;
  showConnectionScores?: boolean;
  onOpenPost: (postId: string, post: DailyPost) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export function InlineInfoFlow({ items, onOpenConnection, showConnectionScores = false, onOpenPost, onLoadMore, isLoadingMore }: InlineInfoFlowProps) {
  const { t } = useTranslation();
  const [videoPlaying, setVideoPlaying] = useState<string | null>(null);
  const seenPostIdsRef = useRef(new Set<string>());

  // D-29: Stop all videos when tab loses visibility (swipe-away or browser tab switch)
  const swipeCtx = useContext(SwipeTabContext);
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) setVideoPlaying(null);
    };
    document.addEventListener('visibilitychange', onVisChange);

    // Also stop videos when user swipes away from Home tab (index 0)
    let unsub: (() => void) | undefined;
    if (swipeCtx) {
      unsub = swipeCtx.swipeProgress.on('change', (v) => {
        if (Math.round(v) !== 0) setVideoPlaying(null);
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      unsub?.();
    };
  }, [swipeCtx]);

  // Phase 33 gap fix (Bug 1, 2026-04-20): Stop video when the user navigates
  // intra-app away from /home (e.g., into PostDetailScreen which mounts as an
  // Outlet overlay above the swipe strip). The swipeProgress handler above
  // only fires on horizontal tab-to-tab navigation; the Outlet overlay keeps
  // Home "active" under the overlay, so this second subscription is required
  // to prevent two iframes (feed + detail) from playing simultaneously.
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/home') setVideoPlaying(null);
  }, [location.pathname]);

  // Phase 33 gap fix (Bug 2, 2026-04-20): Stop video when the currently-playing
  // card is scrolled out of viewport. IntersectionObserver only activates while
  // a video is playing, so zero perf overhead in the common case. Fullscreen
  // guard avoids stopping when YouTube's own fullscreen takes over the viewport.
  useEffect(() => {
    if (!videoPlaying) return;
    const card = document.querySelector<HTMLElement>(`[data-feed-id="${videoPlaying}"]`);
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) return;
        if (document.fullscreenElement) return;
        setVideoPlaying(null);
      },
      { threshold: 0.3 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [videoPlaying]);
  // On first render, mark all current items as "already seen" so they
  // don't animate. Only items added AFTER mount will animate.
  const [newPostIds] = useState<Set<string>>(() => {
    const seen = seenPostIdsRef.current;
    const incoming = new Set<string>();
    for (const item of items) {
      const id = item.kind === 'concept' ? item.post.id : item.kind === 'connection' ? `conn-${item.questionA.id}-${item.questionB.id}` : item.kind === 'milestone' ? item.item.id : '';
      if (id && !seen.has(id)) {
        incoming.add(id);
      }
      if (id) seen.add(id);
    }
    return incoming;
  });

  // Mark any items that arrive after mount as new (for animation on load-more)
  useEffect(() => {
    const seen = seenPostIdsRef.current;
    for (const item of items) {
      const id = item.kind === 'concept' ? item.post.id : item.kind === 'connection' ? `conn-${item.questionA.id}-${item.questionB.id}` : item.kind === 'milestone' ? item.item.id : '';
      if (id) seen.add(id);
    }
  }, [items]);

  return (
    <div>
      {items.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface-variant)',
          }}
        >
          <p style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✨</p>
          <p style={{ fontWeight: 700, marginBottom: '4px' }}>{t('infoFlow.emptyTitle')}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {t('infoFlow.emptyBodyInline')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item, index) => {
            const itemId = item.kind === 'concept' ? item.post.id : item.kind === 'connection' ? `conn-${item.questionA.id}-${item.questionB.id}` : item.kind === 'milestone' ? item.item.id : '';
            const shouldAnimate = newPostIds.has(itemId);
            return (
            <div
              key={index}
              data-feed-id={itemId}
              data-concept-id={item.kind === 'concept' ? (item.post.sourceQuestionIds?.[0] ?? '') : undefined}
              style={{
                position: 'relative',
                // Allow-list: only media-driven styles need a fixed minHeight (iframe aspect ratio).
                // Text-flavored styles size to content. New presentationStyles default to 'auto'
                // — opt-in here if they need a fixed frame. Prior deny-list silently broke text-art.
                minHeight: item.kind === 'concept'
                  ? (item.post.presentationStyle === 'video' || item.post.presentationStyle === 'short' ? '320px' : 'auto')
                  : item.kind === 'milestone' ? '200px' : 'auto',
                animation: shouldAnimate ? `card-slide-in 0.3s ease ${Math.min(index, 5) * 0.05}s both` : undefined,
              }}
            >
              {item.kind === 'concept' ? (
                <MemoizedConceptCard
                  post={item.post}
                  feedIndex={index}
                  isActive={shouldAnimate}
                  onOpen={onOpenPost}
                  videoPlaying={videoPlaying}
                  setVideoPlaying={setVideoPlaying}
                />
              ) : item.kind === 'connection' ? (
                <ConnectionCard
                  questionA={item.questionA}
                  questionB={item.questionB}
                  conceptNounA={item.conceptNounA}
                  conceptNounB={item.conceptNounB}
                  bridgeInsight={item.bridgeInsight}
                  cosineSimilarity={item.cosineSimilarity}
                  showScore={showConnectionScores}
                  onOpenConnection={onOpenConnection}
                />
              ) : (
                <MilestoneCard item={item.item} isActive={shouldAnimate} />
              )}
            </div>
            );
          })}

          {/* Load More button at the bottom of the feed */}
          {onLoadMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="active-squish"
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--border)',
                backgroundColor: 'var(--surface-variant)',
                color: isLoadingMore ? 'var(--muted-foreground)' : 'var(--primary-40)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isLoadingMore ? 0.7 : 1,
              }}
            >
              {isLoadingMore ? (
                <>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--muted-foreground)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  {t('infoFlow.generating')}
                </>
              ) : (
                t('infoFlow.more')
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface InfoFlowPreviewProps {
  items: InfoFlowItem[];
  onOpen: () => void;
}

export function InfoFlowPreview({ items, onOpen }: InfoFlowPreviewProps) {
  const { t } = useTranslation();
  const conceptCount = items.filter((item) => item.kind === 'concept').length;
  const connectionCount = items.filter((item) => item.kind === 'connection').length;

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'none',
        padding: 0,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onPointerEnter={(event) => {
          event.currentTarget.style.transform = 'scale(1.01)';
          event.currentTarget.style.boxShadow = 'var(--shadow-2)';
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
          event.currentTarget.style.boxShadow = 'var(--shadow-1)';
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(145deg, #FFB36B 0%, #F26D52 55%, #D94B6A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'white', opacity: 0.8, textTransform: 'uppercase', marginBottom: '2px' }}>
              {t('infoFlow.curiosityFeed')}
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
              {items.length > 0 ? t('infoFlow.postsReady', { count: items.length }) : t('infoFlow.startWithOneQuestion')}
            </p>
          </div>
          {items.length > 0 && (
            <div
              style={{
                padding: '8px 20px',
                borderRadius: '100px',
                backgroundColor: 'white',
                color: '#D94B6A',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              {t('infoFlow.open')}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--surface-variant)',
              display: 'flex',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F26D52', animation: 'glow-pulse 2s ease-in-out infinite', display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 600 }}>{conceptCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{t('infoFlow.conceptsLabel')}</span>
            </div>
            {connectionCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--node-sky)', display: 'inline-block' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 600 }}>{connectionCount}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{t('infoFlow.connectionsLabel')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
