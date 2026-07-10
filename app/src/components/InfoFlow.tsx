import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlindboxItem, DailyPost, GeneratedImage, Question } from '../types';
import { FeedPostImage } from './FeedPostImage';
import { imageGenerationService } from '../services/imageGeneration.service';
import { inferImageStyle, buildImagePrompt } from '../services/postFormatting.service';
import { normalizePlainText } from '../lib/text-normalization';
import { settingsService } from '../services/settings.service';
import { SuggestionCard } from './SuggestionCard';

// Defensive chip-title filter (2026-05-12). The concept-tag chip renders
// post.sourceQuestionTitles[0]; upstream paths in concept-feed.service.ts have
// occasionally leaked internal anchor/post IDs into this field when byId
// lookups failed and the fallback collapsed to a.conceptId. Strip any value
// that looks like an internal ID so the chip never shows raw `anchor-...` or
// `post-...` strings — better an empty chip than a leaked ID.
function isLikelyInternalId(title: string | undefined): boolean {
  if (!title) return true;
  return /^(anchor|post|concept|question)-/i.test(title.trim());
}

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

function ConceptCard({ post, feedIndex: _feedIndex = 0, isActive: _isActive, onOpen }: ConceptCardProps) {
  // ── Image generation state ──────────────────────────────────────────────────
  const isSuggestion = post.sourceType === 'suggestion' && !!post.suggestionMeta?.topics;
  const presentationStyle = post.presentationStyle;

  // Non-image presentation styles skip image generation entirely.
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [imageResolved, setImageResolved] = useState(
    () => isSuggestion
      || presentationStyle === 'text-art'
      || presentationStyle === 'image-less'
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
    if (isSuggestion) return;
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
  }, [post.id, isSuggestion, presentationStyle]);

  // Suggestion post — D-23/D-26: only topic buttons are interactive, card tap is no-op
  if (isSuggestion) {
    return <SuggestionCard topics={post.suggestionMeta!.topics} />;
  }

  // Don't render the card until the image request has resolved (success or failure)
  if (!imageResolved) return null;

  // ── End image state ─────────────────────────────────────────────────────────

  const normalizedHook = normalizePlainText(post.teaser.hook);
  const normalizedPreview = normalizePlainText(post.teaser.preview);

  // Defense-in-depth: never expose a text-only card. If NO visual block would render
  // (because metadata is missing, the style is unrecognized, or the image gen failed),
  // fall back to text-art. This catches:
  //   - Failed image gen (no Nano Banana key, network/sandbox failure)             → 'image'
  //   - Suggestion posts with no topics (LLM failed + no neighbor anchors)         → empty card
  //   - Legacy 'image-less' or undefined presentationStyle from older caches       → empty card
  // The previous fallback only caught the first case (`presentationStyle === 'image'`),
  // which is why post-32.1 deploys still showed text-only cards on device.
  const wouldRenderVisual =
    !!image ||
    presentationStyle === 'text-art';
  const effectivePresentationStyle: typeof presentationStyle = !wouldRenderVisual ? 'text-art' : presentationStyle;
  if (!wouldRenderVisual && import.meta.env.DEV) {
    // Surface the regression in dev logs so future refactors notice immediately.
    console.warn('[InfoFlow] Forced text-art fallback for post', post.id, {
      sourceType: post.sourceType,
      presentationStyle,
      hasImage: !!image,
    });
  }

  // Regular concept posts
  // Rendered as <div role="button"> rather than <button> so inner interactive
  // elements can safely be actual <button>s without tripping the
  // "<button> cannot be a descendant of <button>" DOM-nesting invariant.
  // Preserves click + keyboard (Enter/Space) affordances.
  const interactive = !isSuggestion;
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
        justifyContent: (image || effectivePresentationStyle === 'text-art') ? 'space-between' : 'flex-start',
        gap: '12px',
        padding: (image || effectivePresentationStyle === 'text-art') ? '0 0 12px' : '12px 0',
        borderRadius: '8px',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-80) 20%, var(--surface-container-high)), var(--surface-container-high))',
        border: '1.5px solid color-mix(in srgb, var(--primary-40) 22%, var(--border))',
        boxShadow: 'var(--shadow-2)',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, background 0.25s ease',
        textAlign: 'left',
        overflow: 'hidden',
      }}
    >

        {/* Text-art notebook card (D-12, D-13, D-14) — square area like image posts */}
        {effectivePresentationStyle === 'text-art' && (() => {
          const theme = pickTextArtTheme(post.id);
          const content = post.textArtContent?.split('\n').filter(Boolean).join(' ') || normalizedPreview;
          // Half-width masonry sizing (Phase 42 UAT-6 round 2) — was 0.95/1.15/1.5rem.
          // The ≤60 char branch was still too big in half-width columns ("Why the Dragon
          // Can't Touch the Goat" wrapped to 4 lines). Companion 3B prompt change keeps
          // text-art content ≤ 80 chars / 1 sentence so the >100 branch should rarely fire.
          const fontSize = content.length > 100 ? '0.85rem' : content.length > 60 ? '1rem' : '1.25rem';
          return (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1/1',
                maxHeight: '200px',
                overflow: 'hidden',
                backgroundColor: theme.bg,
                backgroundImage: `radial-gradient(circle, ${theme.dot} 0.8px, transparent 0.8px)`,
                backgroundSize: '14px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 10px',
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

        {/* AI-generated image header — only rendered for image presentation style. */}
        {image && effectivePresentationStyle !== 'text-art' && (
          <FeedPostImage
            imageData={image}
            aspectPadding="100%"
          />
        )}

        {/* Hook, preview, and tags — rendered for all non-suggestion posts. */}
        <div style={{ padding: '0 10px' }}>
          <p
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              lineHeight: 1.25,
              color: 'var(--foreground)',
              marginBottom: '6px',
            }}
          >
            {normalizedHook}
          </p>
          {/* Preview: show when no image is present */}
          {!image && effectivePresentationStyle !== 'text-art' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.5, opacity: 0.88 }}>
              {normalizedPreview}
            </p>
          )}
          {/* Bottom tags: source concepts. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {post.sourceQuestionTitles?.slice(0, 2).map((title, originalIdx) => ({ title, originalIdx })).filter(({ title }) => !isLikelyInternalId(title)).map(({ title, originalIdx }) => {
              return (
                <span
                  key={originalIdx}
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--muted-foreground)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    padding: '6px 10px',
                    borderRadius: '100px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontFamily: 'inherit',
                  }}
                >
                  {title}
                </span>
              );
            })}
          </div>
        </div>
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
  prev: ConceptCardProps,
  next: ConceptCardProps,
): boolean {
  return (
    prev.post.id === next.post.id &&
    prev.isActive === next.isActive &&
    prev.onOpen === next.onOpen &&
    prev.feedIndex === next.feedIndex
  );
}

export const MemoizedConceptCard = React.memo(ConceptCard, conceptCardPropsEqual);

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

export function ConnectionCard({ conceptNounA, conceptNounB, bridgeInsight, questionA, questionB, onOpenConnection }: ConnectionCardProps) {
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

export function MilestoneCard({ item, isActive }: { item: BlindboxItem; isActive: boolean }) {
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
