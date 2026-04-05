import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { BlindboxItem, DailyPost, GeneratedImage, Question } from '../types';
import { FeedPostImage } from './FeedPostImage';
import { imageGenerationService } from '../services/imageGeneration.service';
import { inferImageStyle, buildImagePrompt } from '../services/postFormatting.service';
import { normalizePlainText } from '../lib/text-normalization';
import { settingsService } from '../services/settings.service';

// ── Text-art theme pool (random selection per render) ──────────────────────────

const TEXT_ART_THEMES = [
  { bg: '#FFFDE7', dot: '#C5CAE9', text: '#1A1A1A', font: 'Georgia, "Times New Roman", serif' },
  { bg: '#E8F5E9', dot: '#A5D6A7', text: '#1B5E20', font: '"Courier New", Courier, monospace' },
  { bg: '#F3E5F5', dot: '#CE93D8', text: '#4A148C', font: 'Palatino, "Palatino Linotype", serif' },
  { bg: '#E3F2FD', dot: '#90CAF9', text: '#0D47A1', font: 'system-ui, -apple-system, sans-serif' },
  { bg: '#FFF3E0', dot: '#FFCC80', text: '#BF360C', font: '"Trebuchet MS", "Gill Sans", sans-serif' },
  { bg: '#FCE4EC', dot: '#F48FB1', text: '#880E4F', font: 'Garamond, "Hoefler Text", serif' },
  { bg: '#E0F7FA', dot: '#80DEEA', text: '#006064', font: 'Verdana, Geneva, sans-serif' },
  { bg: '#FFF8E1', dot: '#FFE082', text: '#E65100', font: '"Bookman Old Style", Bookman, serif' },
];

function pickTextArtTheme(postId: string) {
  let h = 0;
  for (const ch of postId) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  const idx = ((h % TEXT_ART_THEMES.length) + TEXT_ART_THEMES.length) % TEXT_ART_THEMES.length;
  return TEXT_ART_THEMES[idx];
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

function ConceptCard({ post, feedIndex: _feedIndex = 0, isActive, onOpen }: ConceptCardProps) {
  // ── Image generation state ──────────────────────────────────────────────────
  // Video/short posts skip AI image generation entirely (D-08: use YouTube thumbnail).
  const isVideoPost = post.sourceType === 'video';
  const isShortPost = post.sourceType === 'short';
  const isNewsPost = post.sourceType === 'news';
  const presentationStyle = post.presentationStyle;

  // Short video inline playback state (D-02)
  const [shortPlaying, setShortPlaying] = useState(false);

  // Non-image presentation styles and video/short posts skip image generation entirely
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [imageResolved, setImageResolved] = useState(
    () => isVideoPost || isShortPost || isNewsPost
      || presentationStyle === 'text-art'
      || presentationStyle === 'image-less'
      || presentationStyle === 'short'
      || presentationStyle === 'video'
      || presentationStyle === 'news'
      || imageGenerationService.hasCachedImage(post.id, inferImageStyle(post)),
  );

  useEffect(() => {
    // Skip AI image generation for non-image presentation styles
    if (isVideoPost || isShortPost || isNewsPost) return;
    if (presentationStyle && presentationStyle !== 'image') {
      setImageResolved(true);
      return;
    }

    // Also respect the image generation settings toggle (per D-11)
    const imageEnabled = settingsService.getSync().imageGeneration.enabled;
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
  }, [post.id, isVideoPost, isShortPost, isNewsPost, presentationStyle]);

  // Don't render the card until the image request has resolved (success or failure)
  if (!imageResolved) return null;

  // ── End image state ─────────────────────────────────────────────────────────

  const normalizedTitle = normalizePlainText(post.title);
  const normalizedHook = normalizePlainText(post.teaser.hook);
  const normalizedPreview = normalizePlainText(post.teaser.preview);

  return (
    <div
      className="flow-card-inner"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: isShortPost ? '0' : '16px 12px',
        boxSizing: 'border-box',
        background: isShortPost
          ? 'var(--card)'
          : 'radial-gradient(circle at top right, color-mix(in srgb, var(--primary-80) 55%, transparent), transparent 40%), var(--card)',
      }}
    >
      {/* News card (D-09) — newspaper style */}
      {isNewsPost && (
        <div
          onClick={() => onOpen(post.id, post)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 20px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: '#faf8f4',
            border: '1px solid #e8e2d8',
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
            backgroundImage: 'radial-gradient(circle, #d4c9b8 0.5px, transparent 0.5px)',
            backgroundSize: '20px 20px',
            opacity: 0.15,
            pointerEvents: 'none',
          }} />

          {/* Source attribution — uppercase, small */}
          {post.newsMeta?.sources?.[0] && (
            <span style={{
              fontSize: '0.7rem',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              position: 'relative',
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
            color: '#1a1a1a',
            marginBottom: '10px',
            position: 'relative',
          }}>
            {normalizedTitle}
          </h3>

          {/* Preview text */}
          <p style={{
            fontSize: '0.9rem',
            lineHeight: 1.5,
            color: '#444',
            position: 'relative',
            flex: 1,
          }}>
            {normalizedPreview}
          </p>

          {/* Bottom rule line — newspaper divider */}
          <div style={{
            borderTop: '1px solid #d4c9b8',
            marginTop: '16px',
            paddingTop: '8px',
            position: 'relative',
          }}>
            {/* Bottom tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6B4C35',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                backgroundColor: 'rgba(107,76,53,0.08)',
                padding: '3px 8px',
                borderRadius: '100px',
              }}>
                NEWS
              </span>
              {post.sourceQuestionTitles?.slice(0, 1).map((title) => (
                <span
                  key={title}
                  style={{
                    fontSize: '0.65rem',
                    color: '#999',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '3px 8px',
                    borderRadius: '100px',
                    border: '1px solid #e8e2d8',
                  }}
                >
                  {title}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isNewsPost && <button
        onClick={isShortPost ? undefined : () => onOpen(post.id, post)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: (image || isVideoPost || presentationStyle === 'text-art') ? 'space-between' : 'flex-start',
          gap: '20px',
          padding: isShortPost ? '0' : (image || isVideoPost || presentationStyle === 'text-art') ? '0 0 20px' : '20px 0',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-80) 20%, var(--surface-container-high)), var(--surface-container-high))',
          border: '1.5px solid color-mix(in srgb, var(--primary-40) 22%, var(--border))',
          cursor: isShortPost ? 'default' : 'pointer',
          transition: 'transform 0.18s ease, background 0.25s ease',
          textAlign: 'left',
          animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Video card: show YouTube thumbnail with play overlay (D-08) */}
        {isVideoPost && post.videoMeta?.thumbnailUrl && (
          <div
            style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}
          >
            <img
              src={post.videoMeta.thumbnailUrl}
              alt={normalizedTitle}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
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

        {/* Short video card (D-01, D-02, D-03) — portrait, fills card width */}
        {isShortPost && post.videoMeta?.videoId && (
          <div
            onClick={(e) => {
              if (!shortPlaying) {
                e.stopPropagation();
                setShortPlaying(true);
              }
            }}
            style={{
              cursor: shortPlaying ? 'default' : 'pointer',
              width: '100%',
            }}
          >
            {shortPlaying ? (
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9/16',
                overflow: 'hidden',
              }}>
                <iframe
                  src={`https://www.youtube.com/embed/${post.videoMeta.videoId}?playsinline=1&autoplay=1&rel=0`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={normalizedTitle || 'Short video'}
                />
              </div>
            ) : (
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9/16',
                overflow: 'hidden',
              }}>
                <img
                  src={post.videoMeta.thumbnailUrl}
                  alt={normalizedTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
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
                  Short
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
        {presentationStyle === 'text-art' && (() => {
          const theme = pickTextArtTheme(post.id);
          const content = post.textArtContent?.split('\n').filter(Boolean).join(' ') || normalizedPreview;
          return (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1/1',
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
                  fontSize: '2rem',
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
        {!isVideoPost && !isShortPost && image && presentationStyle !== 'text-art' && (
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
                by {post.videoMeta.channelTitle}
              </p>
            )}
            {/* Preview: show when no image is present */}
            {!image && !isVideoPost && presentationStyle !== 'text-art' && (
              <p style={{ fontSize: '0.9rem', color: 'var(--foreground)', lineHeight: 1.6, opacity: 0.88 }}>
                {normalizedPreview}
              </p>
            )}
            {/* Bottom tags: source concepts + narrative mode */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {post.sourceQuestionTitles?.slice(0, 2).map((title) => (
                <span
                  key={title}
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
              {post.narrativeMode && post.narrativeMode !== 'starter' && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--muted-foreground)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    padding: '3px 8px',
                    borderRadius: '100px',
                    fontStyle: 'italic',
                  }}
                >
                  {post.narrativeMode.replace(/-/g, ' ')}
                </span>
              )}
            </div>
          </div>
        )}
      </button>}
    </div>
  );
}

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

function ConnectionCard({ conceptNounA, conceptNounB, bridgeInsight, cosineSimilarity: _cosineSimilarity, showScore: _showScore, questionA, questionB, onOpenConnection }: ConnectionCardProps) {
  const colors = pickConnectionColors(questionA.id, questionB.id);

  return (
    <button
      onClick={() => onOpenConnection(questionA.id, questionB.id)}
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        background: 'none',
        border: 'none',
        textAlign: 'left',
      }}
    >
      {/* Bridge insight — primary hook */}
      <p
        style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--foreground)',
          marginBottom: '20px',
        }}
      >
        {bridgeInsight}
      </p>

      {/* Concept noun blocks */}
      <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
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
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Concept
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
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
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Concept
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
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

interface ImmersiveInfoFlowProps {
  items: InfoFlowItem[];
  onOpenConnection: (idA: string, idB: string) => void;
  onClose: () => void;
  onOpenPost: (postId: string, post: DailyPost) => void;
}

export function ImmersiveInfoFlow({ items, onOpenConnection, onClose, onOpenPost }: ImmersiveInfoFlowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<Element>('[data-flow-card]'));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = cards.indexOf(entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          backgroundColor: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          animation: 'slide-up 0.35s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)' }}>
          <X size={24} />
        </button>
        <span style={{ fontSize: '2.5rem' }}>✨</span>
        <p style={{ fontWeight: 700, fontSize: '1.2rem' }}>Nothing to explore yet</p>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center', padding: '0 32px' }}>
          Ask a few questions and Home will turn them into hook-driven concept posts.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'var(--surface)',
        animation: 'slide-up 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(12px + var(--safe-area-top)) 16px 12px',
          background: 'linear-gradient(to bottom, var(--surface) 60%, transparent)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', pointerEvents: 'none' }}>
          {items.map((_, index) => (
            <div
              key={index}
              style={{
                height: '3px',
                width: index < activeIndex ? '16px' : index === activeIndex ? '24px' : '8px',
                borderRadius: '100px',
                backgroundColor: index <= activeIndex ? 'var(--primary-40)' : 'var(--border)',
                transition: 'width 0.3s, background-color 0.3s',
                opacity: Math.max(0.3, 1 - Math.abs(index - activeIndex) * 0.15),
              }}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--foreground)',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            data-flow-card=""
            style={{
              height: '100svh',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              display: 'flex',
              flexDirection: 'column',
              padding: '64px 16px 24px',
              boxSizing: 'border-box',
              maxWidth: '480px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div
              style={{
                flex: 1,
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--surface)',
                border: item.kind === 'milestone' ? 'none' : '1px solid var(--border)',
                boxShadow: index === activeIndex ? 'var(--shadow-3)' : 'var(--shadow-1)',
                overflow: 'hidden',
                transition: 'box-shadow 0.3s',
                position: 'relative',
              }}
            >
              {item.kind === 'concept' ? (
                <ConceptCard post={item.post} feedIndex={index} isActive={index === activeIndex} onOpen={onOpenPost} />
              ) : item.kind === 'connection' ? (
                <ConnectionCard
                  questionA={item.questionA}
                  questionB={item.questionB}
                  conceptNounA={item.conceptNounA}
                  conceptNounB={item.conceptNounB}
                  bridgeInsight={item.bridgeInsight}
                  cosineSimilarity={item.cosineSimilarity}
                  showScore={false}
                  onOpenConnection={onOpenConnection}
                />
              ) : (
                <MilestoneCard item={item.item} isActive={index === activeIndex} />
              )}
            </div>

            {index === items.length - 1 && (
              <div style={{ textAlign: 'center', padding: '16px 0 0', color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>
                You've reached the end of today's curiosity flow
              </div>
            )}
          </div>
        ))}
      </div>
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

// Track post IDs that have already been rendered in this session so we only
// animate genuinely new posts, not posts that were already visible before
// the user navigated away and came back.
const _seenPostIds = new Set<string>();

export function InlineInfoFlow({ items, onOpenConnection, showConnectionScores = false, onOpenPost, onLoadMore, isLoadingMore }: InlineInfoFlowProps) {
  // On first render, mark all current items as "already seen" so they
  // don't animate. Only items added AFTER mount will animate.
  const [newPostIds] = useState<Set<string>>(() => {
    const incoming = new Set<string>();
    for (const item of items) {
      const id = item.kind === 'concept' ? item.post.id : item.kind === 'connection' ? `conn-${item.questionA.id}-${item.questionB.id}` : item.kind === 'milestone' ? item.item.id : '';
      if (id && !_seenPostIds.has(id)) {
        incoming.add(id);
      }
      if (id) _seenPostIds.add(id);
    }
    return incoming;
  });

  // Mark any items that arrive after mount as new (for animation on load-more)
  useEffect(() => {
    for (const item of items) {
      const id = item.kind === 'concept' ? item.post.id : item.kind === 'connection' ? `conn-${item.questionA.id}-${item.questionB.id}` : item.kind === 'milestone' ? item.item.id : '';
      if (id) _seenPostIds.add(id);
    }
  }, [items]);

  const conceptCount = items.filter((item) => item.kind === 'concept').length;
  const connectionCount = items.filter((item) => item.kind === 'connection').length;

  return (
    <div>
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(145deg, #FFB36B 0%, #F26D52 55%, #D94B6A 100%)',
          borderRadius: 'var(--radius-xl)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-2)',
        }}
      >
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'white', opacity: 0.8, textTransform: 'uppercase', marginBottom: '2px' }}>
            Curiosity Feed
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>
            {items.length > 0 ? `${items.length} posts waiting` : 'Ask to start your feed'}
          </p>
        </div>
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'white', opacity: 0.92 }}>
            {conceptCount > 0 && <span>{conceptCount} concepts</span>}
            {connectionCount > 0 && <span>{connectionCount} links</span>}
          </div>
        )}
      </div>

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
          <p style={{ fontWeight: 700, marginBottom: '4px' }}>Nothing to explore yet</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Ask a few questions and this space will turn them into hook-first concept posts.
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
              style={{
                borderRadius: 'var(--radius-xl)',
                backgroundColor: item.kind === 'milestone' ? 'transparent' : 'var(--card)',
                border:
                  item.kind === 'concept'
                    ? '1.5px solid color-mix(in srgb, var(--primary-40) 30%, var(--border))'
                    : item.kind === 'milestone'
                      ? 'none'
                      : '1.5px solid var(--border)',
                boxShadow: item.kind === 'milestone' ? 'var(--shadow-3)' : 'var(--shadow-2)',
                overflow: 'hidden',
                minHeight: item.kind === 'concept'
                  ? (item.post.presentationStyle === 'image-less' || item.post.presentationStyle === 'image' || !item.post.presentationStyle ? 'auto' : '320px')
                  : item.kind === 'milestone' ? '200px' : '280px',
              }}
            >
              {item.kind === 'concept' ? (
                <ConceptCard
                  post={item.post}
                  feedIndex={index}
                  isActive={shouldAnimate}
                  onOpen={onOpenPost}
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
                  Generating...
                </>
              ) : (
                'More'
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
              Curiosity Feed
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
              {items.length > 0 ? `${items.length} posts ready` : 'Start with one question'}
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
              Open
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
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>concepts</span>
            </div>
            {connectionCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--node-sky)', display: 'inline-block' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 600 }}>{connectionCount}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>connections</span>
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
