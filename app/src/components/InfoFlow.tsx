import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { BlindboxItem, DailyPost, Question } from '../types';

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

const CONCEPT_BADGE_META: Record<DailyPost['sourceType'], { label: string; color: string }> = {
  recent: { label: 'Fresh', color: '#D84315' },
  related: { label: 'Connected', color: '#0277BD' },
  resurfaced: { label: 'Rediscovered', color: '#6A1B9A' },
  starter: { label: 'Starter', color: '#2E7D32' },
  mixed: { label: 'Mixed', color: '#AD1457' },
  connection: { label: 'Connection', color: '#00695C' },
};

const FALLBACK_BADGE = { label: 'Daily', color: '#558B2F' };

interface ConceptCardProps {
  post: DailyPost;
  isActive: boolean;
  onOpen: (postId: string, post: DailyPost) => void;
}

function ConceptCard({ post, isActive, onOpen }: ConceptCardProps) {
  const badge = CONCEPT_BADGE_META[post.sourceType] ?? FALLBACK_BADGE;

  return (
    <div
      className="flow-card-inner"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        boxSizing: 'border-box',
        background:
          'radial-gradient(circle at top right, color-mix(in srgb, var(--primary-80) 55%, transparent), transparent 40%), var(--card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: badge.color,
            background: `${badge.color}18`,
            padding: '5px 12px',
            borderRadius: '100px',
          }}
        >
          {badge.label}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{post.contextLabel}</span>
      </div>

      <button
        onClick={() => onOpen(post.id, post)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '24px',
          padding: '28px 20px 24px',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-80) 20%, var(--surface-container-high)), var(--surface-container-high))',
          border: '1.5px solid color-mix(in srgb, var(--primary-40) 22%, var(--border))',
          cursor: 'pointer',
          transition: 'transform 0.18s ease, background 0.25s ease',
          textAlign: 'left',
          animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              lineHeight: 1.2,
              color: 'var(--foreground)',
              marginBottom: '14px',
              textWrap: 'balance',
            }}
          >
            {post.teaser.hook}
          </p>
          <p style={{ fontSize: '0.98rem', color: 'var(--foreground)', lineHeight: 1.68, opacity: 0.92 }}>
            {post.teaser.preview}
          </p>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: '18px',
            backgroundColor: 'color-mix(in srgb, var(--surface) 65%, white)',
            border: '1px solid color-mix(in srgb, var(--primary-40) 18%, var(--border))',
          }}
        >
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: badge.color, textTransform: 'uppercase', marginBottom: '6px' }}>
            Why open this
          </p>
          <p style={{ fontSize: '0.92rem', color: 'var(--foreground)', lineHeight: 1.65 }}>
            {post.whyCare}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {post.keywords.slice(0, 3).map((keyword) => (
              <span
                key={keyword}
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--muted-foreground)',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  padding: '4px 10px',
                  borderRadius: '100px',
                }}
              >
                {keyword}
              </span>
            ))}
          </div>
          <span style={{ fontSize: '0.78rem', color: badge.color, fontWeight: 700 }}>Open article</span>
        </div>
      </button>
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

function ConnectionCard({ conceptNounA, conceptNounB, bridgeInsight, cosineSimilarity, showScore, questionA, questionB, onOpenConnection }: ConnectionCardProps) {
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
      {/* Header row */}
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: colors.a.bg,
            padding: '4px 12px',
            borderRadius: '100px',
          }}
        >
          Connect
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showScore && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
              {cosineSimilarity.toFixed(2)}
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--primary-40)', fontWeight: 600 }}>Read essay →</span>
        </div>
      </div>

      {/* Bridge insight — primary hook */}
      <p
        style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--foreground)',
          marginBottom: '20px',
          textWrap: 'balance',
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
                <ConceptCard post={item.post} isActive={index === activeIndex} onOpen={onOpenPost} />
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

export function InlineInfoFlow({ items, onOpenConnection, showConnectionScores = false, onOpenPost, onLoadMore, isLoadingMore }: InlineInfoFlowProps) {
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
          {items.map((item, index) => (
            <div
              key={index}
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
                minHeight: item.kind === 'concept' ? '320px' : item.kind === 'milestone' ? '200px' : '280px',
              }}
            >
              {item.kind === 'concept' ? (
                <ConceptCard post={item.post} isActive={true} onOpen={onOpenPost} />
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
                <MilestoneCard item={item.item} isActive={true} />
              )}
            </div>
          ))}

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
