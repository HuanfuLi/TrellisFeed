/**
 * PostFormattingService
 *
 * Derives display metadata from a DailyPost for use in image overlays:
 * - generateOverlayText(post) → { emoji, title }
 * - inferImageStyle(post, index) → ImageStyle
 * - buildImagePrompt(post) → prompt string for image generation
 */

import type { DailyPost, ImageStyle } from '../types';

// ─── Category emoji mapping ────────────────────────────────────────────────────

/** Source-type → default emoji */
const SOURCE_EMOJIS: Record<DailyPost['sourceType'], string> = {
  recent: '⚡',
  related: '🔗',
  resurfaced: '♻️',
  starter: '🌱',
  mixed: '🎲',
  connection: '🧩',
};

/** Keyword → emoji mappings (checked in order; first match wins). */
const KEYWORD_EMOJIS: Array<[RegExp, string]> = [
  [/\b(ai|artificial intelligence|machine learning|neural|llm)\b/i, '🤖'],
  [/\b(brain|memory|neuroscience|cognitive|psychology)\b/i, '🧠'],
  [/\b(physics|quantum|energy|force|motion|wave)\b/i, '⚛️'],
  [/\b(math|calculus|algebra|geometry|probability|statistics)\b/i, '📐'],
  [/\b(biology|evolution|dna|gene|cell|organism)\b/i, '🧬'],
  [/\b(history|ancient|war|empire|civilization|era)\b/i, '🏛️'],
  [/\b(economics|money|market|trade|finance|invest)\b/i, '💰'],
  [/\b(philosophy|ethics|logic|truth|knowledge|mind)\b/i, '💭'],
  [/\b(programming|code|software|algorithm|computer)\b/i, '💻'],
  [/\b(language|linguistics|grammar|word|meaning)\b/i, '📝'],
  [/\b(art|music|creative|design|aesthetic)\b/i, '🎨'],
  [/\b(space|astronomy|planet|star|universe|cosmos)\b/i, '🌌'],
  [/\b(health|medicine|body|disease|treatment)\b/i, '🩺'],
  [/\b(nature|environment|ecology|climate|earth)\b/i, '🌍'],
  [/\b(book|read|literature|story|narrative)\b/i, '📚'],
];

function emojiFromKeywords(keywords: string[], title: string, sourceType: DailyPost['sourceType']): string {
  const searchText = [...keywords, title].join(' ');
  for (const [regex, emoji] of KEYWORD_EMOJIS) {
    if (regex.test(searchText)) return emoji;
  }
  return SOURCE_EMOJIS[sourceType] ?? '💡';
}

// ─── Style rotation ────────────────────────────────────────────────────────────

const STYLE_ROTATION: ImageStyle[] = ['infograph', 'illustration', 'photo'];

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Derive the emoji + short title to render as an overlay on a post image.
 */
export function generateOverlayText(post: DailyPost): { emoji: string; title: string } {
  const emoji = emojiFromKeywords(post.keywords, post.title, post.sourceType);

  // Prefer teaser hook (short, punchy) over full title.
  const raw = post.teaser.hook || post.title;
  const title = raw.length > 50 ? raw.slice(0, 47) + '…' : raw;

  return { emoji, title };
}

/**
 * Infer the best image style for a post.
 * Rotates deterministically based on feed index to ensure visual variety.
 *
 * @param post    The post to style.
 * @param index   0-based position in the feed.
 */
export function inferImageStyle(post: DailyPost, index: number): ImageStyle {
  // Use index for rotation to guarantee variety across the feed.
  const base = STYLE_ROTATION[index % STYLE_ROTATION.length];

  // Override: connection posts and long-form content suit 'illustration'.
  if (post.sourceType === 'connection') return 'illustration';

  // Override: starter / seed posts suit 'infograph' (clean, structural).
  if (post.sourceType === 'starter') return 'infograph';

  return base;
}

/**
 * Build an optimised image generation prompt from a post.
 * Kept short (< 120 chars) to minimise latency.
 */
export function buildImagePrompt(post: DailyPost): string {
  const subject = post.title || post.teaser.hook;
  const keywords = post.keywords.slice(0, 3).join(', ');
  const context = post.contextLabel ? ` | context: ${post.contextLabel}` : '';
  const raw = `${subject}${context}${keywords ? ` | topics: ${keywords}` : ''}`;
  return raw.length > 120 ? raw.slice(0, 117) + '…' : raw;
}
