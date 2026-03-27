/**
 * PostFormattingService
 *
 * Derives display metadata from a DailyPost for use in preview images:
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

function emojiFromKeywords(keywords: string[], title: string, sourceType: DailyPost['sourceType']): string[] {
  const searchText = [...keywords, title].join(' ');
  const emojis: string[] = [];
  
  // Collect up to 2 matching emojis from keywords
  for (const [regex, emoji] of KEYWORD_EMOJIS) {
    if (regex.test(searchText) && !emojis.includes(emoji)) {
      emojis.push(emoji);
      if (emojis.length >= 2) break;
    }
  }
  
  // If no keyword matches, use source type emoji
  if (emojis.length === 0) {
    emojis.push(SOURCE_EMOJIS[sourceType] ?? '💡');
  }
  
  return emojis;
}

function trimSentence(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 1).trimEnd() + '…';
}

function pickHeadline(post: DailyPost): string {
  const raw = post.teaser.hook || post.title;
  return trimSentence(raw, 58);
}

function pickHookCaption(post: DailyPost): string {
  const raw = post.teaser.preview || post.takeaway || post.whyCare || post.bodyMarkdown;
  return trimSentence(raw.replace(/[#*_`>-]/g, ' '), 96);
}

function buildTableRows(post: DailyPost): Array<[string, string]> {
  const topic = trimSentence(post.sourceQuestionTitles[0] || post.title, 28);
  const angleSource = post.quickAskPrompts[0] || post.takeaway || post.whyCare;
  const angle = trimSentence(angleSource.replace(/\?+$/, ''), 34);
  const keywords = trimSentence(post.keywords.slice(0, 3).join(' • '), 30);
  return [
    ['Topic', topic],
    ['Angle', angle],
    ['Signals', keywords || 'Concept preview'],
  ];
}

// ─── Style rotation ────────────────────────────────────────────────────────────

const STYLE_ROTATION: ImageStyle[] = ['infograph', 'illustration', 'photo'];

// ─── Service ──────────────────────────────────────────────────────────────────

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
 * Build a structured prompt for a hook-first preview image.
 * The generated image should explain the post at a glance without repeating
 * the exact feed title under the card.
 */
export function buildImagePrompt(post: DailyPost): string {
  const emojis = emojiFromKeywords(post.keywords, post.title, post.sourceType);
  const emojiStr = emojis.join(' ');
  const headline = pickHeadline(post);
  const caption = pickHookCaption(post);
  const chips = post.keywords.slice(0, 3).map((keyword) => trimSentence(keyword, 16));
  const tableRows = buildTableRows(post);
  const sourceHints = post.sourceQuestionTitles.slice(0, 2).map((title) => trimSentence(title, 40)).join(' | ');

  return [
    'Create a mobile discovery-feed cover image for an educational post.',
    'Show meaningful on-image content so the viewer immediately understands the concept before opening the post.',
    'Integrate emojis naturally into the headline text, not as a separate badge.',
    'Use bold editorial layout with clear visual hierarchy and ample whitespace.',
    'Keep on-image text short, legible, and visually integrated into the composition.',
    `EMOJI: ${emojiStr}`,
    `HEADLINE: ${headline}`,
    `CAPTION: ${caption}`,
    `CHIPS: ${chips.join(' | ')}`,
    ...tableRows.map(([label, value], index) => `ROW_${index + 1}: ${label} | ${value}`),
    `SOURCE_HINTS: ${sourceHints}`,
    `CONTEXT: ${trimSentence(post.contextLabel, 32)}`,
    `STYLE_INTENT: ${post.narrativeMode.replace(/-/g, ' ')}`,
  ].join('\n');
}
