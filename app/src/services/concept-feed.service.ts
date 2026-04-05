import { chatCompletion, chatStream } from '../providers/llm/index.ts';
import type { DailyPost, PostNarrativeMode, PostOriginContext, PostSnapshot, PresentationStyle, Question } from '../types';
import { today } from '../lib/date.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { plannerService } from './planner.service.ts';
import { graphService } from './graph.service.ts';
import { youtubeService } from './youtube.service';
import { newsService } from './news.service';
import { webSearch } from './web-search.service';

const STORAGE_KEY = 'echolearn_daily_posts';
const CONNECTION_POSTS_KEY = 'echolearn_connection_posts';
const MAX_POSTS = 4;
const CONTEXT_LIMIT = 10;

interface PlannerSignals {
  activeThreads: string[];
  confusionAreas: string[];
  curiosityTopics: string[];
}

interface DailyKnowledgeContext {
  recent: Question[];
  resurfaced: Question[];
  related: Array<{ source: Question; target: Question }>;
  plannerSignals: PlannerSignals;
}

export interface ConnectionCardData {
  sourceId: string;
  targetId: string;
  conceptNounA: string;
  conceptNounB: string;
  bridgeInsight: string;
  score: number;
  connectionPostId?: string;
}

interface CachedDailyPosts {
  date: string;
  fingerprint: string;
  posts: DailyPost[];
  connectionCards?: ConnectionCardData[];
}

const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed', 'connection', 'video', 'short', 'text-art', 'news']);

export const STARTER_POSTS: DailyPost[] = [
  makeStarterPost(
    'starter-memory-speed',
    'Why do you forget things that fast?',
    'Your brain treats first exposure as a draft, not a commitment.',
    'A first encounter creates a weak memory trace. If nothing asks you to retrieve it, compare it, or use it again, the brain assumes the detail was temporary and lets it fade.\n\nThat is why an article you liked yesterday can feel strangely distant today, while an old lyric survives for years. The lyric kept returning with emotion, repetition, and context. The article probably did not.\n\nLearning starts to feel easier when you stop reading for familiarity and start revisiting for evidence. The brain keeps what looks reusable.',
    'If you want something to stay, you have to signal that it matters more than once.',
    'Memory improves when retrieval, repetition, and relevance appear together.',
    ['Why does retrieval matter more than rereading?', 'Does sleep help memory lock in?', 'What makes one memory feel important?'],
  ),
  makeStarterPost(
    'starter-rereading-trap',
    'Why does rereading feel productive but fail later?',
    'Recognition is comfortable, but comfort is not proof of recall.',
    'Rereading creates a smooth sensation: you see the same words, they feel familiar, and your brain quietly says, "yes, I know this." That feeling is real, but it mostly measures recognition, not retrieval.\n\nRetrieval is harsher. It asks whether you can rebuild the idea without the page in front of you. That effort feels less fluent, which is exactly why it teaches you more.\n\nThe trap is emotional as much as cognitive: rereading feels like progress because it removes friction. But in learning, a little friction is often the sign that the memory is actually getting stronger.',
    'If learning feels too smooth, you may be recognizing, not remembering.',
    'The uncomfortable version of practice is often the one that lasts.',
    ['Can struggle actually improve memory?', 'What is the difference between recognition and recall?', 'How do I test myself without overdoing it?'],
  ),
  makeStarterPost(
    'starter-connections',
    'Why do connected ideas last longer than isolated facts?',
    'A fact survives better when it has more than one road back into it.',
    'An isolated fact has to be retrieved through a single narrow path. If that path is weak, the memory disappears under pressure. A connected idea behaves differently. It can be reached through an example, a contrast, a story, a prior question, or even a joke you attached to it.\n\nThat is why understanding often feels more durable than memorization. Understanding automatically creates structure around the idea. It gives the brain multiple handles instead of one.\n\nWhen learning begins to compound, it is usually because you stopped collecting fragments and started building routes between them.',
    'Connections do not just enrich knowledge; they stabilize it.',
    'The more paths you build into an idea, the easier it is to recover later.',
    ['How do I build better connections between topics?', 'Why does understanding feel faster after a while?', 'Can examples act like memory hooks?'],
  ),
];

function makeStarterPost(
  id: string,
  hook: string,
  preview: string,
  bodyMarkdown: string,
  whyCare: string,
  takeaway: string,
  quickAskPrompts: string[],
): DailyPost {
  return {
    id,
    date: today(),
    title: hook,
    teaser: { hook, preview },
    bodyMarkdown,
    whyCare,
    takeaway,
    quickAskPrompts,
    narrativeMode: 'starter',
    contextLabel: 'Starter post',
    sourceType: 'starter',
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: ['learning', 'memory'],
    generatedAt: Date.now(),
    origin: 'ai',
  };
}

function isValidDailyPost(value: unknown): value is DailyPost {
  if (!value || typeof value !== 'object') return false;
  const post = value as Partial<DailyPost>;
  return (
    typeof post.id === 'string' &&
    typeof post.date === 'string' &&
    typeof post.title === 'string' &&
    typeof post.bodyMarkdown === 'string' &&
    typeof post.whyCare === 'string' &&
    typeof post.takeaway === 'string' &&
    Boolean(post.teaser) &&
    typeof post.teaser?.hook === 'string' &&
    typeof post.teaser?.preview === 'string' &&
    typeof post.contextLabel === 'string' &&
    typeof post.narrativeMode === 'string' &&
    typeof post.sourceType === 'string' &&
    VALID_SOURCE_TYPES.has(post.sourceType as DailyPost['sourceType']) &&
    Array.isArray(post.sourceQuestionIds) &&
    Array.isArray(post.sourceQuestionTitles) &&
    Array.isArray(post.quickAskPrompts) &&
    Array.isArray(post.keywords) &&
    typeof post.generatedAt === 'number' &&
    post.origin === 'ai'
  );
}

function loadCache(): CachedDailyPosts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDailyPosts>;
    if (
      typeof parsed?.date !== 'string' ||
      typeof parsed?.fingerprint !== 'string' ||
      !Array.isArray(parsed?.posts)
    ) {
      return null;
    }

    const posts = parsed.posts.filter(isValidDailyPost);
    if (posts.length === 0) return null;

    return {
      date: parsed.date,
      fingerprint: parsed.fingerprint,
      posts,
      connectionCards: Array.isArray(parsed.connectionCards)
        ? (parsed.connectionCards as ConnectionCardData[])
        : undefined,
    };
  } catch {
    return null;
  }
}

function saveCache(cache: CachedDailyPosts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore cache persistence failures
  }
}

// ─── Persistent connection post store ────────────────────────────────────────
// Connection posts are stored in sessionStorage (separate 5MB quota from
// localStorage) so they survive daily cache invalidation and don't compete
// with the main store for localStorage quota.

function loadConnectionPosts(): Record<string, DailyPost> {
  try {
    const raw = sessionStorage.getItem(CONNECTION_POSTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DailyPost>;
  } catch {
    return {};
  }
}

function saveConnectionPostToStore(post: DailyPost): void {
  try {
    const store = loadConnectionPosts();
    store[post.id] = post;
    sessionStorage.setItem(CONNECTION_POSTS_KEY, JSON.stringify(store));
  } catch {
    // ignore storage failures
  }
}

function getConnectionPostFromStore(id: string): DailyPost | null {
  return loadConnectionPosts()[id] ?? null;
}

function truncate(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max - 1).trimEnd() + '…';
}

function firstSentence(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const dot = normalized.indexOf('.');
  if (dot > 0 && dot + 1 <= max) return normalized.slice(0, dot + 1);
  return truncate(normalized, max);
}

function titleFor(question: Question): string {
  return question.title?.trim() || truncate(question.content, 72);
}

function computeFingerprint(questions: Question[]): string {
  // Only question IDs determine cache validity — planner signals influence
  // generation content but should not invalidate cached posts on restart.
  return questions
    .slice(0, CONTEXT_LIMIT)
    .map((question) => `${question.id}:${question.createdAt}`)
    .join('|');
}

export function buildDailyKnowledgeContext(questions: Question[]): DailyKnowledgeContext {
  const recent = questions.slice(0, 4);
  const resurfaced = questions
    .slice(4)
    .filter((question) => question.relatedQuestionIds.length > 0 || question.keywords.length > 0)
    .slice(0, 4);

  const byId = new Map(questions.map((question) => [question.id, question]));
  const related: Array<{ source: Question; target: Question }> = [];
  const seenPairs = new Set<string>();

  for (const source of questions.slice(0, 8)) {
    for (const targetId of source.relatedQuestionIds.slice(0, 2)) {
      const target = byId.get(targetId);
      if (!target) continue;
      const key = source.id < target.id ? `${source.id}:${target.id}` : `${target.id}:${source.id}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      related.push({ source, target });
      if (related.length >= 4) break;
    }
    if (related.length >= 4) break;
  }

  // Gather planner signals for feed ranking
  const recentSignals = plannerService.getRecentSignals();
  const plannerSignals: PlannerSignals = {
    activeThreads: recentSignals.curiosity.slice(0, 6),
    confusionAreas: recentSignals.confusion.slice(0, 4),
    curiosityTopics: recentSignals.curiosity.slice(0, 4),
  };

  return { recent, resurfaced, related, plannerSignals };
}


function buildGenerationPrompt(
  date: string,
  context: DailyKnowledgeContext,
  connectionCandidates: Array<{ source: Question; target: Question; score: number }> = [],
): string {
  const serializeQuestion = (question: Question) => [
    `id: ${question.id}`,
    `title: ${titleFor(question)}`,
    `question: ${truncate(question.content, 160)}`,
    `summary: ${truncate(question.summary || question.answer, 220)}`,
    `keywords: ${question.keywords.join(', ') || 'none'}`,
  ].join('\n');

  const relatedLines = context.related.map(({ source, target }) =>
    [
      `sourceId: ${source.id}`,
      `sourceTitle: ${titleFor(source)}`,
      `targetId: ${target.id}`,
      `targetTitle: ${titleFor(target)}`,
      `sharedKeywords: ${source.keywords.filter((keyword) => target.keywords.includes(keyword)).join(', ') || 'none'}`,
    ].join('\n'),
  );

  const candidateLines = connectionCandidates.map(({ source, target, score }) =>
    [
      `sourceId: ${source.id}`,
      `sourceTitle: ${titleFor(source)}`,
      `sourceSummary: ${truncate(source.summary || source.answer, 160)}`,
      `targetId: ${target.id}`,
      `targetTitle: ${titleFor(target)}`,
      `targetSummary: ${truncate(target.summary || target.answer, 160)}`,
      `semanticScore: ${score.toFixed(3)}`,
    ].join('\n'),
  );

  const hasConnectionCandidates = candidateLines.length > 0;

  return [
    `Create ${Math.min(MAX_POSTS, Math.max(2, context.recent.length + context.related.length))} daily learning posts for ${date}.`,
    'The posts should feel like intriguing short-form educational essays, not flashcards or summaries.',
    'Each post must be substantial: bodyMarkdown 180-340 words.',
    'teaserHook: max 8 words. Punchy, curiosity-driven, sounds like a podcast title or tweet. Examples: "Your brain lied about rereading", "Why forgetting is a feature", "The 20-minute rule nobody follows".',
    'teaserPreview: 130-170 characters. A vivid teaser that pulls the reader in — not a dry summary. Write it like the opening line of a story or the subheadline of an article.',
    'Vary narrative style across posts using these modes: example-first, historical-story, contrast, analogy, false-intuition, mnemonic, mechanism-breakdown.',
    'At least one post should use an example, and if helpful one may use a gentle joke or mnemonic to improve recall.',
    'Every post must include: title, teaserHook, teaserPreview, bodyMarkdown, takeaway, quickAskPrompts (3 strings), narrativeMode, contextLabel, sourceType, sourceQuestionIds, keywords.',
    'sourceType must be exactly one of: "recent", "related", "resurfaced", "mixed". Use "recent" for posts from recent questions, "related" for posts bridging two questions, "resurfaced" for older questions brought back, "mixed" for posts drawing from multiple questions.',
    'Use only sourceQuestionIds that appear in the provided context.',
    'Ground the essay in the supplied knowledge. Do not invent unrelated facts. Keep the writing vivid and readable.',
    hasConnectionCandidates
      ? 'Return ONLY valid JSON object: {"posts": [...], "connectionCards": [...]}.'
      : 'Return ONLY valid JSON array (posts only, no connectionCards needed).',
    '',
    'Recent questions:',
    ...context.recent.map(serializeQuestion),
    '',
    'Resurfaced knowledge:',
    ...context.resurfaced.map(serializeQuestion),
    '',
    'Related bridges:',
    ...relatedLines,
    '',
    ...(context.plannerSignals.activeThreads.length > 0 || context.plannerSignals.confusionAreas.length > 0 || context.plannerSignals.curiosityTopics.length > 0
      ? [
          'Active learning signals (boost relevance for these topics):',
          ...(context.plannerSignals.activeThreads.length > 0 ? [`Active threads: ${context.plannerSignals.activeThreads.join(', ')}`] : []),
          ...(context.plannerSignals.confusionAreas.length > 0 ? [`Unresolved areas: ${context.plannerSignals.confusionAreas.join(', ')}`] : []),
          ...(context.plannerSignals.curiosityTopics.length > 0 ? [`Curiosity topics: ${context.plannerSignals.curiosityTopics.join(', ')}`] : []),
        ]
      : []),
    ...(hasConnectionCandidates
      ? [
          '',
          'Connection candidates (semantic pairs to evaluate for connection cards):',
          'For each pair, produce a connectionCard object with:',
          '  sourceId, targetId (from above)',
          '  conceptNounA: 2-4 word noun phrase naming source concept (e.g. "Spaced Repetition", NOT a question)',
          '  conceptNounB: 2-4 word noun phrase naming target concept',
          '  bridgeInsight: one compelling hook sentence (≤20 words) articulating the connection, OR null if no meaningful link exists',
          'Only include pairs where you can write a genuine, interesting bridgeInsight.',
          ...candidateLines,
        ]
      : []),
  ].join('\n');
}

function parseConnectionCards(
  raw: unknown,
  candidates: Array<{ source: Question; target: Question; score: number }>,
): ConnectionCardData[] {
  if (!Array.isArray(raw)) return [];
  const scoreMap = new Map(candidates.map((c) => {
    const key = c.source.id < c.target.id ? `${c.source.id}:${c.target.id}` : `${c.target.id}:${c.source.id}`;
    return [key, c.score];
  }));

  return (raw as Array<Record<string, unknown>>)
    .filter((item) =>
      typeof item.sourceId === 'string' &&
      typeof item.targetId === 'string' &&
      typeof item.conceptNounA === 'string' &&
      typeof item.conceptNounB === 'string' &&
      typeof item.bridgeInsight === 'string' &&
      item.bridgeInsight.length > 0,
    )
    .map((item) => {
      const sId = item.sourceId as string;
      const tId = item.targetId as string;
      const key = sId < tId ? `${sId}:${tId}` : `${tId}:${sId}`;
      return {
        sourceId: sId,
        targetId: tId,
        conceptNounA: item.conceptNounA as string,
        conceptNounB: item.conceptNounB as string,
        bridgeInsight: item.bridgeInsight as string,
        score: scoreMap.get(key) ?? 0,
      };
    });
}

interface ParsedGeneration {
  posts: DailyPost[];
  connectionCards: ConnectionCardData[];
}

function parseGeneratedPosts(
  raw: string,
  questions: Question[],
  date: string,
  candidates: Array<{ source: Question; target: Question; score: number }> = [],
  indexOffset = 0,
): ParsedGeneration {
  // Try object format first: {"posts": [...], "connectionCards": [...]}
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]) as { posts?: unknown; connectionCards?: unknown };
      if (Array.isArray(parsed.posts)) {
        return {
          posts: extractPosts(parsed.posts as Array<Record<string, unknown>>, questions, date, indexOffset),
          connectionCards: parseConnectionCards(parsed.connectionCards, candidates),
        };
      }
    } catch {
      // fall through to array parse
    }
  }

  // Fall back to plain array format
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrMatch) return { posts: [], connectionCards: [] };
  try {
    const parsed = JSON.parse(arrMatch[0]) as Array<Record<string, unknown>>;
    return { posts: extractPosts(parsed, questions, date, indexOffset), connectionCards: [] };
  } catch {
    return { posts: [], connectionCards: [] };
  }
}

function extractPosts(parsed: Array<Record<string, unknown>>, questions: Question[], date: string, indexOffset = 0): DailyPost[] {
  const byId = new Map(questions.map((question) => [question.id, question]));

  return parsed
    .slice(0, MAX_POSTS)
    .map((item, index) => {
      const idIndex = index + indexOffset;
      const sourceQuestionIds = Array.isArray(item.sourceQuestionIds)
        ? item.sourceQuestionIds.filter((value): value is string => typeof value === 'string' && byId.has(value)).slice(0, 4)
        : [];
      const sourceQuestionTitles = sourceQuestionIds.map((id) => titleFor(byId.get(id)!));
      const teaserHook = typeof item.teaserHook === 'string' ? truncate(item.teaserHook, 110) : '';
      const teaserPreview = typeof item.teaserPreview === 'string' ? truncate(item.teaserPreview, 220) : '';
      const bodyMarkdown = typeof item.bodyMarkdown === 'string' ? item.bodyMarkdown.trim() : '';
      const title = typeof item.title === 'string' ? truncate(item.title, 110) : teaserHook;
      if (!teaserHook || !teaserPreview || !bodyMarkdown || !title) return null;

      const post: DailyPost = {
        id: `post-${date}-${idIndex}-${sourceQuestionIds.join('-') || 'general'}`,
        date,
        title,
        teaser: { hook: teaserHook, preview: teaserPreview },
        bodyMarkdown,
        whyCare: typeof item.whyCare === 'string' ? truncate(item.whyCare, 220) : teaserPreview,
        takeaway: typeof item.takeaway === 'string' ? truncate(item.takeaway, 180) : teaserPreview,
        quickAskPrompts: Array.isArray(item.quickAskPrompts)
          ? item.quickAskPrompts.filter((value): value is string => typeof value === 'string').slice(0, 3)
          : [],
        narrativeMode: (typeof item.narrativeMode === 'string' ? item.narrativeMode : 'mechanism-breakdown') as PostNarrativeMode,
        contextLabel: typeof item.contextLabel === 'string' ? truncate(item.contextLabel, 90) : 'Daily post',
        sourceType: (VALID_SOURCE_TYPES.has(item.sourceType as DailyPost['sourceType']) ? item.sourceType : 'mixed') as DailyPost['sourceType'],
        sourceQuestionIds,
        sourceQuestionTitles,
        keywords: Array.isArray(item.keywords)
          ? item.keywords.filter((value): value is string => typeof value === 'string').slice(0, 6)
          : [],
        generatedAt: Date.now(),
        origin: 'ai',
      };
      return post;
    })
    .filter((post): post is DailyPost => post !== null);
}

async function generateDailyPostsWithLLM(questions: Question[], date: string): Promise<ParsedGeneration> {
  const settings = settingsService.getSync();
  if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return { posts: [], connectionCards: [] };

  const context = buildDailyKnowledgeContext(questions.slice(0, CONTEXT_LIMIT));
  if (context.recent.length === 0 && context.resurfaced.length === 0 && context.related.length === 0) return { posts: [], connectionCards: [] };

  const candidates = graphService.getSemanticCandidates(settings.embeddingDebug.similarityThreshold);

  // Enrich with web context (NEWS-01) — best-effort, non-blocking per concept
  let webContext = '';
  try {
    const primaryConcept = context.recent[0]?.title || context.recent[0]?.content?.slice(0, 50);
    if (primaryConcept) {
      const searchResult = await webSearch(primaryConcept + ' latest research findings', { maxResults: 3 });
      if (searchResult.success && searchResult.data?.results.length) {
        webContext = '\n\nRecent web context (use to enrich posts with current information):\n' +
          searchResult.data.results
            .map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`)
            .join('\n');
      }
    }
  } catch { /* web enrichment is best-effort */ }

  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are an editorial learning writer.',
          'Write rich, intriguing, accurate educational posts from the supplied user knowledge.',
          'Do not write flashcards, tiny summaries, or listicles without a narrative spine.',
          'Return only valid JSON.',
        ].join('\n'),
      },
      { role: 'user', content: buildGenerationPrompt(date, context, candidates) + webContext },
    ],
    settings.llm,
    { serviceName: 'posts' },
  );

  return parseGeneratedPosts(raw, questions, date, candidates);
}

// ─── Video post helpers ──────────────────────────────────────────────────────

/**
 * Fire-and-forget video generation so the feed is never blocked on YouTube API
 * or LLM transcript summarization. Results are written to the youtube cache;
 * they will appear on the next feed access (pull-to-refresh or navigation).
 */
let _videoBgRunning = false;
function _backgroundGenerateVideos(): void {
  if (_videoBgRunning) return;
  if (youtubeService.getCachedVideoPosts().length > 0) return; // already cached for today
  _videoBgRunning = true;
  youtubeService.generateVideoPosts(3).catch(() => {}).finally(() => { _videoBgRunning = false; });
}

/** Background text-art content generation for cache-hit paths. */
let _textArtBgRunning = false;
function _backgroundGenerateTextArt(posts: DailyPost[]): void {
  if (_textArtBgRunning) return;
  const needsContent = posts.some(p => p.presentationStyle === 'text-art' && !p.textArtContent);
  if (!needsContent) return;
  _textArtBgRunning = true;
  generateTextArtContent(posts).then(enriched => {
    _persistStylesToCache(enriched);
  }).catch(() => {}).finally(() => { _textArtBgRunning = false; });
}

/** Persist presentationStyle and textArtContent from styled posts back into the cache. */
function _persistStylesToCache(styledPosts: DailyPost[]): void {
  const cachedNow = loadCache();
  if (!cachedNow) return;
  const styleMap = new Map(styledPosts.map(p => [p.id, { presentationStyle: p.presentationStyle, textArtContent: p.textArtContent }]));
  cachedNow.posts = cachedNow.posts.map(p => {
    const info = styleMap.get(p.id);
    if (!info) return p;
    return { ...p, presentationStyle: info.presentationStyle, textArtContent: info.textArtContent ?? p.textArtContent };
  });
  saveCache(cachedNow);
}

/** Fisher-Yates shuffle — returns a new shuffled copy. */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Assign a presentationStyle to every post and interleave video posts among AI posts.
 * Non-video weights: image 40%, text-art 33%, image-less 27% (when image gen enabled).
 * When image generation is off, image weight redistributes to text-art (55%) and image-less (45%).
 */
export function assignPresentationStyles(
  aiPosts: DailyPost[],
  videoPosts: DailyPost[],
): DailyPost[] {
  const imageEnabled = settingsService.getSync().imageGeneration.enabled;

  // Video posts keep their sourceType-based presentation
  const styledVideos = videoPosts.map(p => ({
    ...p,
    presentationStyle: (p.sourceType === 'short' ? 'short' : 'video') as PresentationStyle,
  }));

  const nonVideoCount = aiPosts.length;
  if (nonVideoCount === 0) return styledVideos;

  // Weights for AI posts only (video/short already separated).
  // Spec: ~30% image, ~25% text-art, ~20% image-less of AI posts (remaining ~25% is video/short via interleave).
  // When image generation is off, redistribute image slots to text-art and image-less.
  const effectiveWeights = imageEnabled
    ? { image: 0.40, 'text-art': 0.33, 'image-less': 0.27 }
    : { image: 0, 'text-art': 0.55, 'image-less': 0.45 };

  const imageCount = Math.round(nonVideoCount * effectiveWeights.image);
  const textArtCount = Math.round(nonVideoCount * effectiveWeights['text-art']);
  const imageLessCount = nonVideoCount - imageCount - textArtCount;

  const styles: PresentationStyle[] = [
    ...Array(imageCount).fill('image' as PresentationStyle),
    ...Array(textArtCount).fill('text-art' as PresentationStyle),
    ...Array(imageLessCount).fill('image-less' as PresentationStyle),
  ];
  const shuffled = shuffleArray(styles);

  const styledAi = aiPosts.map((post, i) => ({
    ...post,
    presentationStyle: shuffled[i] ?? ('image-less' as PresentationStyle),
  }));

  // Interleave: place video posts at regular intervals among AI posts
  if (styledVideos.length === 0) return styledAi;
  const result: DailyPost[] = [];
  const interval = Math.max(2, Math.floor(styledAi.length / (styledVideos.length + 1)));
  let vIdx = 0;
  for (let i = 0; i < styledAi.length; i++) {
    result.push(styledAi[i]);
    if ((i + 1) % interval === 0 && vIdx < styledVideos.length) {
      result.push(styledVideos[vIdx++]);
    }
  }
  while (vIdx < styledVideos.length) result.push(styledVideos[vIdx++]);
  return result;
}

/**
 * Generate text-art content for posts assigned the 'text-art' presentationStyle.
 * Runs at feed-build time (not per-card) to avoid scroll lag.
 */
async function generateTextArtContent(posts: DailyPost[]): Promise<DailyPost[]> {
  const textArtPosts = posts.filter(p => p.presentationStyle === 'text-art' && !p.textArtContent);
  if (textArtPosts.length === 0) return posts;

  const settings = settingsService.getSync();
  if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return posts;

  // Batch all text-art prompts into parallel requests
  const results = await Promise.allSettled(
    textArtPosts.map(async (post) => {
      const prompt = `Write ONE punchy headline about: "${post.title}"

Pick one style:
- Breaking news: "Gemma 4 released — will it beat QWEN 3.5? 🔥"
- Interview hook: "Interviewer: How much VRAM to train a 7B model?"
- Hot take: "Why I'm not bullish on World Models"
- Provocative question: "What if transformers are already obsolete? 🤔"
- Bold claim: "RAG is dead. Long live agentic search."
- Conversation starter: "Your brain is lying to you about rereading 🧠"

Rules:
- ONE line only, under 12 words
- Emojis are OPTIONAL — use 0, 1, or 2 emojis placed naturally (middle, end, or nowhere). Never always at the start.
- Sound like a real headline, tweet, or podcast title
- Be specific to the topic

Return ONLY the single line, nothing else.`;

      const result = await chatCompletion(
        [{ role: 'user', content: prompt }],
        settings.llm,
        { maxTokens: 256, serviceName: 'text-art' },
      );
      return { postId: post.id, content: result };
    }),
  );

  // Build a map of post ID -> text-art content
  const contentMap = new Map<string, string>();
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value.content) {
      contentMap.set(r.value.postId, r.value.content);
    }
  });

  // Apply text-art content to posts; use fallback for failed generations
  return posts.map(p => {
    if (p.presentationStyle !== 'text-art') return p;
    if (contentMap.has(p.id)) {
      return { ...p, textArtContent: contentMap.get(p.id)! };
    }
    // Fallback: if LLM generation failed but post needs text-art, use preview as content
    if (!p.textArtContent && p.teaser.preview) {
      return { ...p, textArtContent: `💡 ${p.teaser.hook}\n\n📝 ${p.teaser.preview}` };
    }
    return p;
  });
}

let _shortsBgRunning = false;
function _backgroundGenerateShorts(questions: Question[]): void {
  if (_shortsBgRunning) return;
  if (youtubeService.getCachedShortPosts().length > 0) return; // already cached for today
  _shortsBgRunning = true;
  youtubeService.generateShortPosts(questions, 2).catch(() => {}).finally(() => { _shortsBgRunning = false; });
}

// ─── News post helpers ──────────────────────────────────────────────────────

const MAX_NEWS_PER_DAY = 3;

/**
 * Fire-and-forget news generation so the feed is never blocked on Tavily API
 * or LLM summarization. Results are written to the news cache;
 * they will appear on the next feed access (pull-to-refresh or navigation).
 */
let _newsBgRunning = false;
function _backgroundGenerateNews(): void {
  if (_newsBgRunning) return;
  if (newsService.getCachedNewsPosts().length > 0) return; // already generated today
  _newsBgRunning = true;
  newsService.generateNewsPosts(MAX_NEWS_PER_DAY)
    .catch(() => {})
    .finally(() => { _newsBgRunning = false; });
}

/**
 * Interleave news posts into the feed. Inserts a news post after every 3rd
 * feed post. Remaining news posts are appended at the end.
 */
function interleaveNewsPosts(feedPosts: DailyPost[], news: DailyPost[]): DailyPost[] {
  if (news.length === 0) return feedPosts;
  const result: DailyPost[] = [];
  let nIdx = 0;
  for (let i = 0; i < feedPosts.length; i++) {
    result.push(feedPosts[i]);
    if ((i + 1) % 3 === 0 && nIdx < news.length) {
      result.push(news[nIdx++]);
    }
  }
  while (nIdx < news.length) result.push(news[nIdx++]);
  return result;
}

/**
 * Interleave video posts into AI posts. Inserts a video after every 2nd AI post.
 * Remaining video posts are appended at the end.
 * Per D-04: video posts mix into the existing feed, not a separate section.
 * @deprecated Use assignPresentationStyles instead.
 */
function interleaveVideoPosts(aiPosts: DailyPost[], videoPosts: DailyPost[]): DailyPost[] {
  if (videoPosts.length === 0) return aiPosts;
  const result: DailyPost[] = [];
  let vIdx = 0;
  for (let i = 0; i < aiPosts.length; i++) {
    result.push(aiPosts[i]);
    // Insert a video post after every 2nd AI post
    if ((i + 1) % 2 === 0 && vIdx < videoPosts.length) {
      result.push(videoPosts[vIdx++]);
    }
  }
  // Append remaining video posts at the end
  while (vIdx < videoPosts.length) result.push(videoPosts[vIdx++]);
  return result;
}

function toPostSnapshot(post: DailyPost): PostSnapshot {
  const { generatedAt, origin, ...snapshot } = post;
  return snapshot;
}

export function buildPostOriginContext(post: DailyPost, questions: Question[]): PostOriginContext {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return {
    post: toPostSnapshot(post),
    sourceQuestions: post.sourceQuestionIds
      .map((id) => byId.get(id))
      .filter((question): question is Question => Boolean(question))
      .map((question) => ({
        id: question.id,
        title: titleFor(question),
        content: question.content,
        summary: question.summary || firstSentence(question.answer, 220),
      })),
  };
}

export const conceptFeedService = {
  async getDailyPosts(questions: Question[]): Promise<DailyPost[]> {
    // Exclude off-topic/flagged questions from post generation
    questions = questions.filter((q) => !q.flagged);
    const date = today();
    const fingerprint = computeFingerprint(questions);
    const cached = loadCache();
    if (cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0) {
      // Return feed posts immediately with any already-cached video/short posts.
      // Kick off video + short generation in the background so they appear on next refresh.
      const aiPosts = cached.posts.filter((p) => p.sourceType !== 'connection');
      const videoPosts = youtubeService.getCachedVideoPosts();
      const shortPosts = youtubeService.getCachedShortPosts();
      const allVideos = [...videoPosts, ...shortPosts];
      _backgroundGenerateVideos();
      _backgroundGenerateShorts(questions);
      _backgroundGenerateNews();
      // If cached posts already have presentationStyle assigned, use them directly;
      // otherwise assign styles and persist back to cache.
      const allStyled = aiPosts.length > 0 && aiPosts.every(p => p.presentationStyle);
      const styledResult = allStyled
        ? [...aiPosts, ...allVideos.map(p => ({ ...p, presentationStyle: (p.sourceType === 'short' ? 'short' : 'video') as PresentationStyle }))]
        : assignPresentationStyles(aiPosts, allVideos);
      if (!allStyled && aiPosts.length > 0) _persistStylesToCache(styledResult);
      // Generate text-art content in background for any text-art posts missing it
      _backgroundGenerateTextArt(styledResult);
      // Interleave news posts (NEWS-02, NEWS-03)
      const newsPosts = newsService.getCachedNewsPosts();
      return interleaveNewsPosts(styledResult, newsPosts);
    }

    // If the cache has posts for today but just the fingerprint changed (e.g. new
    // question added), re-stamp the fingerprint and keep existing posts — only
    // regenerate when there are truly no posts for today.
    const hasPostsForToday = cached?.date === date && cached.posts.length > 0;

    if (hasPostsForToday && cached.fingerprint !== fingerprint) {
      saveCache({ ...cached, fingerprint });
      const aiPosts = cached.posts.filter((p) => p.sourceType !== 'connection');
      const videoPosts = youtubeService.getCachedVideoPosts();
      const shortPosts = youtubeService.getCachedShortPosts();
      const allVideos = [...videoPosts, ...shortPosts];
      _backgroundGenerateVideos();
      _backgroundGenerateShorts(questions);
      _backgroundGenerateNews();
      const allStyled2 = aiPosts.length > 0 && aiPosts.every(p => p.presentationStyle);
      const styledResult2 = allStyled2
        ? [...aiPosts, ...allVideos.map(p => ({ ...p, presentationStyle: (p.sourceType === 'short' ? 'short' : 'video') as PresentationStyle }))]
        : assignPresentationStyles(aiPosts, allVideos);
      if (!allStyled2 && aiPosts.length > 0) _persistStylesToCache(styledResult2);
      _backgroundGenerateTextArt(styledResult2);
      // Interleave news posts (NEWS-02, NEWS-03)
      const newsPosts2 = newsService.getCachedNewsPosts();
      return interleaveNewsPosts(styledResult2, newsPosts2);
    }

    let generated: ParsedGeneration = { posts: [], connectionCards: [] };
    try {
      generated = await generateDailyPostsWithLLM(questions, date);
    } catch {
      generated = { posts: [], connectionCards: [] };
    }

    const newPosts = generated.posts;

    // Preserve old posts so they remain accessible via getPostById and don't
    // vanish on date rollover or failed LLM regeneration. Old posts whose IDs
    // collide with newly generated posts are replaced; the rest are kept.
    const oldPosts = cached?.posts ?? [];
    const newIds = new Set(newPosts.map((p) => p.id));
    const preserved = oldPosts.filter((p) => !newIds.has(p.id));
    const allPosts = [...newPosts, ...preserved];

    // Cache only AI posts (video posts have their own cache in youtube.service.ts)
    saveCache({ date, fingerprint, posts: allPosts, connectionCards: generated.connectionCards });

    // Return AI posts immediately; generate video posts in background (D-04)
    const videoPosts = youtubeService.getCachedVideoPosts();
    const shortPosts = youtubeService.getCachedShortPosts();
    _backgroundGenerateVideos();
    _backgroundGenerateShorts(questions);
    _backgroundGenerateNews();
    // Only style new posts — preserved old posts keep their existing presentationStyle
    const feedPosts = allPosts.filter((p) => p.sourceType !== 'connection');
    const unstyledPosts = feedPosts.filter(p => !p.presentationStyle);
    const alreadyStyled = feedPosts.filter(p => p.presentationStyle);
    const allVideos = [...videoPosts, ...shortPosts];
    const newlyStyled = unstyledPosts.length > 0
      ? assignPresentationStyles(unstyledPosts, allVideos)
      : [...alreadyStyled, ...allVideos.map(p => ({ ...p, presentationStyle: (p.sourceType === 'short' ? 'short' : 'video') as PresentationStyle }))];
    const styledPosts = unstyledPosts.length > 0 ? [...alreadyStyled, ...newlyStyled] : newlyStyled;
    const enrichedPosts = await generateTextArtContent(styledPosts);

    // Persist presentationStyle and textArtContent back to cache
    _persistStylesToCache(enrichedPosts);

    // Interleave news posts (NEWS-02, NEWS-03)
    const newsPosts3 = newsService.getCachedNewsPosts();
    return interleaveNewsPosts(enrichedPosts, newsPosts3);
  },

  /** Return cached connection card data for the current session. */
  getConnectionCards(): ConnectionCardData[] {
    return loadCache()?.connectionCards ?? [];
  },

  /**
   * Look up a post by ID from the cache only. Never triggers regeneration —
   * this prevents the PostDetailScreen from accidentally invalidating the
   * cache when the `questions` array changes after mount.
   */
  getPostById(id: string): DailyPost | null {
    const cached = loadCache();
    const fromCache = cached?.posts.find((post) => post.id === id) ?? null;
    if (fromCache) return fromCache;
    // Fall back to sessionStorage-based connection post store
    return getConnectionPostFromStore(id);
  },

  getCachedDailyPosts(): DailyPost[] {
    const aiPosts = (loadCache()?.posts ?? []).filter((p) => p.sourceType !== 'connection');
    const videoPosts = youtubeService.getCachedVideoPosts();
    const shortPosts = youtubeService.getCachedShortPosts();
    const allVideos = [...videoPosts, ...shortPosts];
    // Only reassign styles if none of the AI posts have presentationStyle yet.
    // This prevents reshuffling the feed on every call.
    const allStyled = aiPosts.length > 0 && aiPosts.every(p => p.presentationStyle);
    const result = allStyled
      ? [...aiPosts, ...allVideos.map(p => ({ ...p, presentationStyle: (p.sourceType === 'short' ? 'short' : 'video') as PresentationStyle }))]
      : assignPresentationStyles(aiPosts, allVideos);
    if (!allStyled && aiPosts.length > 0) _persistStylesToCache(result);
    _backgroundGenerateTextArt(result);
    return result;
  },

  /** Delete a single post by ID from both the daily cache and the connection store. */
  deletePost(id: string): boolean {
    let deleted = false;
    const cached = loadCache();
    if (cached) {
      const before = cached.posts.length;
      cached.posts = cached.posts.filter((p) => p.id !== id);
      if (cached.posts.length < before) {
        saveCache(cached);
        deleted = true;
      }
    }
    // Also try the connection post sessionStorage store (Record<string, DailyPost>)
    try {
      const store = loadConnectionPosts();
      if (store[id]) {
        delete store[id];
        sessionStorage.setItem(CONNECTION_POSTS_KEY, JSON.stringify(store));
        deleted = true;
      }
    } catch { /* ignore */ }
    if (deleted) {
      eventBus.emit({ type: 'POST_DELETED', payload: { id } });
    }
    return deleted;
  },

  /** Explicitly clear the post cache (e.g. after "Clear All Data"). */
  clearCache(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },

  /**
   * Generate additional posts that differ from the ones already cached.
   * Appends to the existing cache so old post IDs remain valid.
   */
  async generateMorePosts(questions: Question[], count = 4): Promise<DailyPost[]> {
    // Exclude off-topic/flagged questions from post generation
    questions = questions.filter((q) => !q.flagged);
    const date = today();
    const cached = loadCache();
    const existingPosts = cached?.posts ?? [];
    const existingIds = new Set(existingPosts.map((p) => p.id));
    const existingTitles = existingPosts.map((p) => p.title);

    let newPosts: DailyPost[] = [];

    const settings = settingsService.getSync();
    if (settings.preferences.aiConsentGiven && settings.llm.isConfigured && questions.length > 0) {
      const context = buildDailyKnowledgeContext(questions.slice(0, CONTEXT_LIMIT));
      if (context.recent.length > 0 || context.resurfaced.length > 0 || context.related.length > 0) {
        const avoidClause = existingTitles.length > 0
          ? `\nIMPORTANT: Do NOT repeat topics already covered. Existing post titles to avoid:\n${existingTitles.map((t) => `- ${t}`).join('\n')}\nChoose different angles, examples, or connections.`
          : '';

        try {
          const raw = await chatCompletion(
            [
              {
                role: 'system',
                content: [
                  'You are an editorial learning writer.',
                  'Write rich, intriguing, accurate educational posts from the supplied user knowledge.',
                  'Do not write flashcards, tiny summaries, or listicles without a narrative spine.',
                  'Return only valid JSON.',
                ].join('\n'),
              },
              { role: 'user', content: buildGenerationPrompt(date, context) + avoidClause },
            ],
            settings.llm,
            { serviceName: 'posts' },
          );
          // Use existingPosts.length as index offset so "more" post IDs never
          // collide with initial post IDs even when the LLM reuses the same
          // source question IDs.
          newPosts = parseGeneratedPosts(raw, questions, date, [], existingPosts.length).posts
            .filter((p) => !existingIds.has(p.id));
        } catch {
          newPosts = [];
        }
      }
    }

    newPosts = newPosts.slice(0, count);

    // Append to cache so existing post IDs remain valid (AI posts only)
    if (newPosts.length > 0) {
      const allPosts = [...existingPosts, ...newPosts];
      const fingerprint = computeFingerprint(questions);
      saveCache({ date, fingerprint, posts: allPosts, connectionCards: cached?.connectionCards });
    }

    // Generate more video posts and interleave (D-03: 4 on pull-for-more)
    // Await here is acceptable — user explicitly triggered "load more" so brief delay is expected
    let moreVideos: DailyPost[] = [];
    try {
      moreVideos = await youtubeService.generateMoreVideoPosts(4); // D-03: 4 on pull-for-more
    } catch {
      // YouTube integration is optional
    }
    const styledMore = assignPresentationStyles(newPosts, moreVideos);
    const enrichedMore = await generateTextArtContent(styledMore);

    // Persist presentationStyle and textArtContent back to cache for new posts
    _persistStylesToCache(enrichedMore);

    return enrichedMore;
  },

  /**
   * Stream a comparison essay for two concepts. Yields markdown chunks as they arrive.
   * Caller is responsible for assembling and caching the final post.
   */
  async *generateConnectionPost(
    questionA: Question,
    questionB: Question,
    conceptNounA: string,
    conceptNounB: string,
  ): AsyncGenerator<string> {
    const settings = settingsService.getSync();
    if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return;

    const system = [
      'You are a learning-focused educational writer.',
      'Write a focused comparison essay about two concepts the user has been studying.',
      'The essay should illuminate similarities, differences, and a practical takeaway.',
      'Use clear headers (##) and keep total length 220–380 words.',
      'Write in a vivid, readable style — not a list or flashcard.',
    ].join('\n');

    const prompt = [
      `Write a comparison essay about these two concepts: "${conceptNounA}" and "${conceptNounB}".`,
      '',
      `Concept A — ${conceptNounA}:`,
      `${truncate(questionA.summary || questionA.answer, 280)}`,
      '',
      `Concept B — ${conceptNounB}:`,
      `${truncate(questionB.summary || questionB.answer, 280)}`,
      '',
      'Structure the essay with:',
      '## What They Share',
      '## Where They Differ',
      '## The Takeaway',
    ].join('\n');

    yield* chatStream(
      [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      settings.llm,
      { serviceName: 'posts' },
    );
  },

  /** Save a completed connection essay as a DailyPost with sourceType: 'connection'. */
  saveConnectionPost(questionA: Question, questionB: Question, conceptNounA: string, conceptNounB: string, bodyMarkdown: string): DailyPost {
    const date = today();
    const postId = `conn-${questionA.id}-${questionB.id}`;
    const post: DailyPost = {
      id: postId,
      date,
      title: `${conceptNounA} vs ${conceptNounB}`,
      teaser: {
        hook: `${conceptNounA} and ${conceptNounB}: what connects them and where they diverge`,
        preview: `A comparison of two concepts you have been exploring — their shared logic and key differences.`,
      },
      bodyMarkdown,
      whyCare: 'Seeing how two concepts relate and differ deepens understanding of both.',
      takeaway: `${conceptNounA} and ${conceptNounB} are most useful understood together, not in isolation.`,
      quickAskPrompts: [
        `Give me an example where ${conceptNounA} and ${conceptNounB} work together`,
        `What should I learn after understanding both of these?`,
        `Which of these two concepts is more important in practice?`,
      ],
      narrativeMode: 'contrast',
      contextLabel: 'Connection essay',
      sourceType: 'connection',
      sourceQuestionIds: [questionA.id, questionB.id],
      sourceQuestionTitles: [titleFor(questionA), titleFor(questionB)],
      keywords: Array.from(new Set([...questionA.keywords, ...questionB.keywords])).slice(0, 6),
      generatedAt: Date.now(),
      origin: 'ai',
    };

    // Persist to independent connection post store (survives cache invalidation)
    saveConnectionPostToStore(post);

    // Also append to daily cache for backward compatibility
    const cached = loadCache();
    const existing = cached?.posts ?? [];
    const withoutOld = existing.filter((p) => p.id !== postId);
    saveCache({
      date: cached?.date ?? date,
      fingerprint: cached?.fingerprint ?? '',
      posts: [...withoutOld, post],
      connectionCards: cached?.connectionCards,
    });

    return post;
  },

  /** Patch a connectionPostId onto a cached connection card after essay generation. */
  setConnectionPostId(sourceId: string, targetId: string, postId: string): void {
    const cached = loadCache();
    if (!cached?.connectionCards) return;
    const key = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    const k = key(sourceId, targetId);
    const updated = cached.connectionCards.map((c) =>
      key(c.sourceId, c.targetId) === k ? { ...c, connectionPostId: postId } : c,
    );
    saveCache({ ...cached, connectionCards: updated });
  },

  buildPostOriginContext,

  /**
   * Find the cached post with the most overlap with the given concept IDs.
   * @param conceptIds   - Question IDs to match against post sourceQuestionIds.
   * @param connectionOnly - If true, only search connection posts (sourceType: 'connection').
   */
  findClosestPost(conceptIds: string[], connectionOnly = false): DailyPost | null {
    const cached = loadCache();
    if (!cached) return null;
    const posts = connectionOnly
      ? cached.posts.filter((p) => p.sourceType === 'connection')
      : cached.posts.filter((p) => p.sourceType !== 'connection');
    if (posts.length === 0) return null;

    const idSet = new Set(conceptIds);
    let best: DailyPost | null = null;
    let bestScore = 0;
    for (const post of posts) {
      const overlap = post.sourceQuestionIds.filter((id) => idSet.has(id)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        best = post;
      }
    }
    return best;
  },

  /**
   * Stream an exploratory essay for a discover chunk. Yields markdown chunks as they arrive.
   */
  async *generateDiscoverPost(concept: string, title: string): AsyncGenerator<string> {
    const settings = settingsService.getSync();
    if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return;

    const system = [
      'You are a learning-focused educational writer.',
      'Write an educational essay introducing a concept to a curious learner.',
      'Use clear headers (##) and keep total length 220–380 words.',
      'Write in a vivid, readable style — not a list or flashcard.',
    ].join('\n');

    const prompt = [
      `Write an educational essay with the title: "${title}"`,
      `The essay introduces the concept: "${concept}"`,
      '',
      'Structure the essay with:',
      '## The Core Idea',
      '## Why It Matters',
      '## A Useful Way To Remember It',
    ].join('\n');

    yield* chatStream(
      [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      settings.llm,
      { serviceName: 'posts' },
    );
  },

  /** Save a completed discover essay as a DailyPost with the given stable ID. */
  saveDiscoverPost(concept: string, title: string, bodyMarkdown: string, postId: string): DailyPost {
    const date = today();
    const post: DailyPost = {
      id: postId,
      date,
      title,
      teaser: { hook: title, preview: `An exploration of ${concept}.` },
      bodyMarkdown,
      whyCare: `Exploring ${concept} builds new connections in your learning path.`,
      takeaway: `${concept} is worth understanding deeply — it connects to much of what you already know.`,
      quickAskPrompts: [
        `Can you give a concrete example of ${concept}?`,
        `How does ${concept} relate to what I already know?`,
        `What should I learn after understanding ${concept}?`,
      ],
      narrativeMode: 'mechanism-breakdown',
      contextLabel: 'Discover',
      sourceType: 'mixed',
      sourceQuestionIds: [],
      sourceQuestionTitles: [],
      keywords: [concept.toLowerCase()],
      generatedAt: Date.now(),
      origin: 'ai',
    };

    const cached = loadCache();
    const existing = cached?.posts ?? [];
    const withoutOld = existing.filter((p) => p.id !== postId);
    saveCache({
      date: cached?.date ?? date,
      fingerprint: cached?.fingerprint ?? '',
      posts: [...withoutOld, post],
      connectionCards: cached?.connectionCards,
    });

    return post;
  },
};
