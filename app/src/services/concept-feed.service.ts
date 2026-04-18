import { chatCompletion, chatStream } from '../providers/llm/index.ts';
import type { ChatSession, DailyPost, PostNarrativeMode, PostOriginContext, PostSnapshot, PresentationStyle, Question } from '../types';
import { today } from '../lib/date.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService, FEED_DEFAULTS } from './settings.service.ts';
import { plannerService } from './planner.service.ts';
import { graphService } from './graph.service.ts';
import { youtubeService } from './youtube.service';
import { newsService } from './news.service';
import { webSearch } from './web-search.service';
import { questionService } from './question.service';
import { postQueueService } from './post-queue.service';
import { postHistoryService } from './post-history.service';
import { dailyReadService } from './daily-read.service';
import { assignStyles, reassignFailures, type ApiAvailability } from './style-assignment';
import { computeLeafState } from './trellis-state.service';

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

const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed', 'connection', 'video', 'short', 'text-art', 'news', 'suggestion']);

export const STARTER_POSTS: DailyPost[] = [
  makeStarterPost(
    'starter-welcome',
    'Welcome to EchoLearn',
    'Your AI learning companion',
    'Ask any question and watch your knowledge grow. EchoLearn uses AI to create personalized learning paths.',
    '# Welcome to EchoLearn\n\nEchoLearn is your AI-powered learning companion. Here\'s how to get started:\n\n1. **Ask a question** — Tap the Ask tab and type any question. The AI will answer it and save it to your knowledge graph.\n2. **Review what you learn** — Your answers become flashcards. Review them to build lasting memory.\n3. **Explore your feed** — This feed brings you fresh content based on what you\'re learning.\n\nStart by asking your first question!',
    'Getting Started',
  ),
  makeStarterPost(
    'starter-knowledge-growth',
    'How your knowledge grows',
    'From questions to mastery',
    'Every question you ask becomes part of your knowledge graph. Review flashcards to strengthen your memory.',
    '# How Your Knowledge Grows\n\nEchoLearn follows a proven learning loop:\n\n1. **Ask** — Ask questions about anything you\'re curious about.\n2. **Connect** — Your questions are organized into a knowledge graph by topic.\n3. **Review** — Flashcards are generated automatically. Spaced repetition helps you remember.\n4. **Grow** — As you master topics, your trellis tree blooms and bears fruit.\n\nThe more you review, the stronger your knowledge becomes.',
    'How It Works',
  ),
  makeStarterPost(
    'starter-daily-feed',
    'Explore your daily feed',
    'Fresh content, curated for you',
    'Your feed serves posts about your learning topics — articles, videos, and more. Pull up to load more.',
    '# Your Daily Feed\n\nThis feed is built around what you\'re learning:\n\n- **Articles** — AI-generated deep dives on your topics.\n- **Videos** — YouTube content matched to your knowledge graph.\n- **News** — Latest developments in your areas of interest.\n- **Suggestions** — Related topics you might want to explore.\n\nPull up at the bottom to load more posts. The vine at the top tracks your daily progress.',
    'Feed Guide',
  ),
];

function makeStarterPost(
  id: string,
  title: string,
  hook: string,
  preview: string,
  bodyMarkdown: string,
  contextLabel: string,
): DailyPost {
  return {
    id,
    date: today(),
    title,
    teaser: { hook, preview },
    bodyMarkdown,
    narrativeMode: 'starter',
    contextLabel,
    sourceType: 'starter',
    presentationStyle: 'text-art' as PresentationStyle,
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: ['echolearn', 'getting-started'],
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
    (typeof post.bodyMarkdown === 'string' || post.bodyMarkdown === undefined) &&
    Boolean(post.teaser) &&
    typeof post.teaser?.hook === 'string' &&
    typeof post.teaser?.preview === 'string' &&
    typeof post.contextLabel === 'string' &&
    typeof post.narrativeMode === 'string' &&
    typeof post.sourceType === 'string' &&
    VALID_SOURCE_TYPES.has(post.sourceType as DailyPost['sourceType']) &&
    Array.isArray(post.sourceQuestionIds) &&
    Array.isArray(post.sourceQuestionTitles) &&
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
  maxPosts = MAX_POSTS,
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
    `Create ${maxPosts} daily learning posts for ${date}.`,
    'The posts should feel like intriguing short-form educational essays, not flashcards or summaries.',
    'Each post must have a punchy teaserHook and a vivid teaserPreview.',
    'teaserHook: max 8 words. Punchy, curiosity-driven, sounds like a podcast title or tweet. Examples: "Your brain lied about rereading", "Why forgetting is a feature", "The 20-minute rule nobody follows".',
    'teaserPreview: 130-170 characters. A vivid teaser that pulls the reader in — not a dry summary. Write it like the opening line of a story or the subheadline of an article.',
    'Vary narrative style across posts using these modes: example-first, historical-story, contrast, analogy, false-intuition, mnemonic, mechanism-breakdown.',
    'At least one post should use an example, and if helpful one may use a gentle joke or mnemonic to improve recall.',
    'Every post must include: title, teaserHook, teaserPreview, narrativeMode, contextLabel, sourceType, sourceQuestionIds, keywords.',
    'Do NOT include bodyMarkdown, whyCare, takeaway, or quickAskPrompts -- these are generated on demand when the user opens the post.',
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
  maxPosts = MAX_POSTS,
): ParsedGeneration {
  // Try object format first: {"posts": [...], "connectionCards": [...]}
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]) as { posts?: unknown; connectionCards?: unknown };
      if (Array.isArray(parsed.posts)) {
        return {
          posts: extractPosts(parsed.posts as Array<Record<string, unknown>>, questions, date, indexOffset, maxPosts),
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
    return { posts: extractPosts(parsed, questions, date, indexOffset, maxPosts), connectionCards: [] };
  } catch {
    return { posts: [], connectionCards: [] };
  }
}

function extractPosts(parsed: Array<Record<string, unknown>>, questions: Question[], date: string, indexOffset = 0, maxPosts = MAX_POSTS): DailyPost[] {
  const byId = new Map(questions.map((question) => [question.id, question]));

  return parsed
    .slice(0, maxPosts)
    .map((item, index) => {
      const idIndex = index + indexOffset;
      const sourceQuestionIds = Array.isArray(item.sourceQuestionIds)
        ? item.sourceQuestionIds.filter((value): value is string => typeof value === 'string' && byId.has(value)).slice(0, 4)
        : [];
      const sourceQuestionTitles = [...new Set(sourceQuestionIds.map((id) => {
        const question = byId.get(id)!;
        if (question.parentId) {
          const anchor = byId.get(question.parentId);
          if (anchor?.isAnchorNode && anchor.title?.trim()) return anchor.title.trim();
        }
        return question.clusterLabel?.trim() || question.branchLabel?.trim() || titleFor(question);
      }))];
      const teaserHook = typeof item.teaserHook === 'string' ? truncate(item.teaserHook, 110) : '';
      const teaserPreview = typeof item.teaserPreview === 'string' ? truncate(item.teaserPreview, 220) : '';
      const bodyMarkdown = typeof item.bodyMarkdown === 'string' ? item.bodyMarkdown.trim() : '';
      const title = typeof item.title === 'string' ? truncate(item.title, 110) : teaserHook;
      if (!teaserHook || !teaserPreview || !title) return null;

      const post: DailyPost = {
        id: `post-${date}-${idIndex}-${sourceQuestionIds.join('-') || 'general'}`,
        date,
        title,
        teaser: { hook: teaserHook, preview: teaserPreview },
        bodyMarkdown,
        whyCare: typeof item.whyCare === 'string' ? truncate(item.whyCare, 220) : '',
        takeaway: typeof item.takeaway === 'string' ? truncate(item.takeaway, 180) : '',
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
  youtubeService.generateVideoPosts(5).catch(() => {}).finally(() => { _videoBgRunning = false; });
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

/**
 * Spread posts so no two adjacent items share the same presentationStyle.
 * Groups by style, then round-robin interleaves. Mutates in place.
 */
function spreadByStyle(posts: DailyPost[]): void {
  if (posts.length <= 2) return;
  const byStyle = new Map<string, DailyPost[]>();
  for (const p of posts) {
    const key = p.presentationStyle ?? 'unknown';
    const arr = byStyle.get(key) ?? [];
    arr.push(p);
    byStyle.set(key, arr);
  }
  const buckets = Array.from(byStyle.values()).sort((a, b) => b.length - a.length);
  const result: DailyPost[] = [];
  let lastStyle = '';
  while (result.length < posts.length) {
    let placed = false;
    for (const bucket of buckets) {
      if (bucket.length === 0) continue;
      const style = bucket[0].presentationStyle ?? '';
      if (style === lastStyle && buckets.some(b => b.length > 0 && (b[0].presentationStyle ?? '') !== lastStyle)) continue;
      result.push(bucket.shift()!);
      lastStyle = style;
      placed = true;
      break;
    }
    if (!placed) {
      const remaining = buckets.find(b => b.length > 0);
      if (remaining) { result.push(remaining.shift()!); lastStyle = result[result.length - 1].presentationStyle ?? ''; }
      else break;
    }
  }
  for (let i = 0; i < result.length; i++) posts[i] = result[i];
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

// assignPresentationStyles removed in Phase 31 — replaced by pre-style assignment via style-assignment.ts (D-18)

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
    if (!p.textArtContent) {
      const fallback = p.teaser.preview?.trim() || p.teaser.hook?.trim() || p.title;
      return { ...p, textArtContent: fallback };
    }
    return p;
  });
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


// ─── Queue-based generation pipeline (Phase 31, D-17/D-18/D-21/D-44) ────────

/**
 * Build the derived concept list for this generation cycle.
 * Per D-12: driven by today's due concepts from SM-2.
 * Per D-13: exclude already-explored concepts (via seen IDs in post queue).
 * Per D-14: important concepts get 2 posts per cycle, others get 1.
 */
function buildConceptBatch(questions: Question[]): string[] {
  const queuePosts = postQueueService.getQueue();
  const exploredIds = new Set(queuePosts.flatMap(p => p.sourceQuestionIds ?? []));

  const anchors = questions.filter(q => q.isAnchorNode);
  const dueAnchors = anchors.filter(a => !exploredIds.has(a.id));

  const conceptIds: string[] = [];
  for (const anchor of dueAnchors) {
    const children = questions.filter(q => q.parentId === anchor.id);
    let isImportant = anchor.reviewSchedule?.easeFactor != null && anchor.reviewSchedule.easeFactor < 1.5;
    if (!isImportant) {
      try {
        const leaf = computeLeafState(anchor, children);
        isImportant = leaf === 'dying' || leaf === 'falling' || leaf === 'fallen';
      } catch { /* non-critical — default to not important */ }
    }
    conceptIds.push(anchor.id);
    if (isImportant) conceptIds.push(anchor.id);
  }
  return conceptIds;
}

/**
 * Generate a batch of posts from pre-assigned style assignments.
 * Reuses the existing LLM generation prompt for text-style posts,
 * fetches from YouTube/Tavily for video/news, and generates text-art content.
 */
async function generatePostBatch(
  questions: Question[],
  assignments: import('./style-assignment').StyleAssignment[],
): Promise<DailyPost[]> {
  const date = today();
  const byId = new Map(questions.map(q => [q.id, q]));
  const settings = settingsService.getSync();

  // Group assignments by style for batch processing
  const textStyleAssignments = assignments.filter(a =>
    a.style === 'text-art' || a.style === 'image' || a.style === 'suggestion',
  );
  const videoAssignments = assignments.filter(a => a.style === 'video');
  const shortAssignments = assignments.filter(a => a.style === 'short');
  const newsAssignments = assignments.filter(a => a.style === 'news');

  const posts: DailyPost[] = [];
  const existingPosts = loadCache()?.posts ?? [];
  const indexOffset = existingPosts.length;

  // Generate text-style posts via LLM (text-art, image, suggestion)
  if (textStyleAssignments.length > 0 && settings.preferences.aiConsentGiven && settings.llm.isConfigured) {
    const textQuestions = textStyleAssignments
      .map(a => byId.get(a.conceptId))
      .filter((q): q is Question => Boolean(q));

    if (textQuestions.length > 0) {
      const context = buildDailyKnowledgeContext(textQuestions.slice(0, CONTEXT_LIMIT));
      if (context.recent.length > 0 || context.resurfaced.length > 0) {
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
              { role: 'user', content: buildGenerationPrompt(date, context, [], textStyleAssignments.length) },
            ],
            settings.llm,
            { serviceName: 'posts' },
          );
          const parsed = parseGeneratedPosts(raw, questions, date, [], indexOffset, textStyleAssignments.length);
          // Apply pre-assigned styles to generated posts
          for (let i = 0; i < parsed.posts.length && i < textStyleAssignments.length; i++) {
            if (!parsed.posts[i]) continue;
            const assignment = textStyleAssignments[i];
            parsed.posts[i].presentationStyle = assignment.style;
            if (assignment.style === 'suggestion') {
              parsed.posts[i].sourceType = 'suggestion' as DailyPost['sourceType'];
              // D-27: populate suggestion topics from knowledge graph neighbors
              const concept = byId.get(assignment.conceptId);
              if (concept) {
                const neighbors = questions
                  .filter(q => q.parentId === concept.parentId && q.id !== concept.id)
                  .slice(0, 5);
                const topics = neighbors
                  .map(n => n.title?.trim() || n.content?.slice(0, 50)?.trim())
                  .filter((t): t is string => !!t)
                  .slice(0, 3);
                if (topics.length > 0) {
                  parsed.posts[i].suggestionMeta = { topics };
                }
              }
            }
          }
          posts.push(...parsed.posts);
        } catch {
          // LLM generation failed — skip text posts for this batch
        }
      }
    }
  }

  // Generate video posts from YouTube
  for (const a of videoAssignments) {
    try {
      const concept = byId.get(a.conceptId);
      const conceptName = concept?.title ?? concept?.content?.slice(0, 50) ?? a.conceptId;
      const searchResult = await youtubeService.searchVideos(conceptName, 1);
      if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
        const video = searchResult.data[0];
        posts.push({
          id: `post-${date}-video-${a.conceptId}`,
          date,
          title: video.title || conceptName,
          teaser: { hook: video.title || conceptName, preview: video.description?.slice(0, 170) || '' },
          bodyMarkdown: '',
          whyCare: '',
          takeaway: '',
          quickAskPrompts: [],
          narrativeMode: 'mechanism-breakdown' as PostNarrativeMode,
          contextLabel: 'Video',
          sourceType: 'video',
          sourceQuestionIds: [a.conceptId],
          sourceQuestionTitles: [conceptName],
          keywords: concept?.keywords?.slice(0, 4) ?? [],
          generatedAt: Date.now(),
          origin: 'ai',
          presentationStyle: 'video',
          videoMeta: { videoId: video.videoId, channelTitle: video.channelTitle, thumbnailUrl: video.thumbnailUrl },
        });
      }
    } catch { /* video fetch failed — already reassigned in pre-validation */ }
  }

  // Generate short posts from YouTube (use shorts query modifier)
  for (const a of shortAssignments) {
    try {
      const concept = byId.get(a.conceptId);
      const conceptName = concept?.title ?? concept?.content?.slice(0, 50) ?? a.conceptId;
      const searchResult = await youtubeService.searchVideos(conceptName + ' #shorts', 1);
      if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
        const short = searchResult.data[0];
        posts.push({
          id: `post-${date}-short-${a.conceptId}`,
          date,
          title: short.title || conceptName,
          teaser: { hook: short.title || conceptName, preview: short.description?.slice(0, 170) || '' },
          bodyMarkdown: '',
          whyCare: '',
          takeaway: '',
          quickAskPrompts: [],
          narrativeMode: 'mechanism-breakdown' as PostNarrativeMode,
          contextLabel: 'Short',
          sourceType: 'short',
          sourceQuestionIds: [a.conceptId],
          sourceQuestionTitles: [conceptName],
          keywords: concept?.keywords?.slice(0, 4) ?? [],
          generatedAt: Date.now(),
          origin: 'ai',
          presentationStyle: 'short',
          videoMeta: { videoId: short.videoId, title: short.title, channelTitle: short.channelTitle, thumbnailUrl: short.thumbnailUrl },
        });
      }
    } catch { /* short fetch failed */ }
  }

  // Generate news posts from Tavily
  for (const a of newsAssignments) {
    try {
      const concept = byId.get(a.conceptId);
      const conceptName = concept?.title ?? concept?.content?.slice(0, 50) ?? a.conceptId;
      const searchResult = await webSearch(conceptName + ' latest research findings', { maxResults: 1 });
      if (searchResult.success && searchResult.data?.results.length) {
        const result = searchResult.data.results[0];
        posts.push({
          id: `post-${date}-news-${a.conceptId}`,
          date,
          title: result.title || conceptName,
          teaser: { hook: result.title || conceptName, preview: result.content?.slice(0, 170) || '' },
          bodyMarkdown: result.content || '',
          whyCare: '',
          takeaway: '',
          quickAskPrompts: [],
          narrativeMode: 'mechanism-breakdown' as PostNarrativeMode,
          contextLabel: 'News',
          sourceType: 'news',
          sourceQuestionIds: [a.conceptId],
          sourceQuestionTitles: [conceptName],
          keywords: concept?.keywords?.slice(0, 4) ?? [],
          generatedAt: Date.now(),
          origin: 'ai',
          presentationStyle: 'news',
          newsMeta: {
            sources: [{ index: 0, title: result.title, url: result.url }],
            fetchedAt: Date.now(),
          },
        });
      }
    } catch { /* news fetch failed */ }
  }

  // Generate text-art content for text-art styled posts
  const enrichedPosts = await generateTextArtContent(posts);
  return enrichedPosts;
}

let _queueRefillRunning = false;

/**
 * Refill the post queue using the pre-style assignment pipeline (D-21).
 * Builds concept batch, pre-assigns styles, pre-validates external APIs,
 * reassigns failures, generates posts, and enqueues results.
 */
export async function refillQueue(questions: Question[]): Promise<void> {
  if (_queueRefillRunning) return;
  if (!postQueueService.needsRefill()) return;
  _queueRefillRunning = true;

  try {
    const settings = settingsService.getSync();
    // D-38: check daily generation cap
    const dueConcepts = questions.filter(q => q.isAnchorNode);
    const feedSettings = (settings as Record<string, unknown>).feed as { dailyGenerationCapMultiplier?: number } | undefined;
    const maxPosts = (feedSettings?.dailyGenerationCapMultiplier ?? FEED_DEFAULTS.dailyGenerationCapMultiplier) * Math.max(dueConcepts.length, 1);
    const cycleNumber = postQueueService.getCycleNumber();
    const alreadyGenerated = cycleNumber * 8; // rough estimate
    if (alreadyGenerated >= maxPosts) return;

    // Step 1: Build concept batch for this cycle
    const conceptIds = buildConceptBatch(questions);
    if (conceptIds.length === 0) return;

    // Step 2: Pre-check API keys — validate non-empty strings (D-20, D-21 step 1)
    const availability: ApiAvailability = {
      hasYoutubeKey: typeof settings.youtube?.apiKey === 'string' && settings.youtube.apiKey.trim().length > 0,
      hasTavilyKey: typeof settings.webSearch?.tavilyApiKey === 'string' && settings.webSearch.tavilyApiKey.trim().length > 0,
      hasImageGenKey: typeof settings.imageGeneration?.nanoBananaApiKey === 'string' && settings.imageGeneration.nanoBananaApiKey.trim().length > 0,
    };

    // Step 3: Assign styles before generation (D-18)
    let assignments = assignStyles(conceptIds, availability);

    // Step 4: Pre-validate YouTube/Tavily in parallel (D-21 step 2, D-20 fallback)
    const videoAssigns = assignments.filter(a => a.style === 'video' || a.style === 'short');
    const newsAssigns = assignments.filter(a => a.style === 'news');
    const failedIds = new Set<string>();

    const getConceptName = (id: string) => {
      const q = questions.find(q => q.id === id);
      return q?.title ?? q?.content?.slice(0, 50) ?? id;
    };

    await Promise.all([
      ...videoAssigns.map(async (a) => {
        try {
          const conceptName = getConceptName(a.conceptId);
          const query = a.style === 'short' ? conceptName + ' #shorts' : conceptName;
          const searchResult = await youtubeService.searchVideos(query, 1);
          if (!searchResult.success || !searchResult.data?.length) {
            failedIds.add(a.conceptId);
          }
        } catch {
          failedIds.add(a.conceptId);
        }
      }),
      ...newsAssigns.map(async (a) => {
        try {
          const conceptName = getConceptName(a.conceptId);
          const results = await webSearch(conceptName + ' latest', { maxResults: 1 });
          if (!results.success || !results.data?.results.length) {
            failedIds.add(a.conceptId);
          }
        } catch {
          failedIds.add(a.conceptId);
        }
      }),
    ]);

    // Step 5: Reassign failures to text-art (D-20, D-21 step 3)
    assignments = reassignFailures(assignments, failedIds);

    // Step 6: Generate posts with pre-assigned styles (D-21 step 4)
    const posts = await generatePostBatch(questions, assignments);

    // Step 6b: Spread styles to prevent clustering (D-17 weighted round-robin)
    spreadByStyle(posts);

    // Step 7: Persist to history (D-33) and enqueue
    for (const p of posts) { try { postHistoryService.addPost(p); } catch { /* non-critical */ } }
    postQueueService.enqueue(posts);
    postQueueService.incrementCycle();
  } finally {
    _queueRefillRunning = false;
  }
}

export const conceptFeedService = {
  async getDailyPosts(questions: Question[]): Promise<DailyPost[]> {
    // Exclude off-topic/flagged questions from post generation
    questions = questions.filter((q) => !q.flagged);
    const date = today();
    const fingerprint = computeFingerprint(questions);
    const cached = loadCache();

    // Cache hit: return cached posts with background enrichment
    if (cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0) {
      const feedPosts = cached.posts.filter((p) => p.sourceType !== 'connection');
      _backgroundGenerateTextArt(feedPosts);
      // Trigger queue refill in background
      refillQueue(questions).catch(console.error);
      return feedPosts;
    }

    // Fingerprint mismatch but same day: update fingerprint, return cached
    const hasPostsForToday = cached?.date === date && cached.posts.length > 0;
    if (hasPostsForToday && cached.fingerprint !== fingerprint) {
      saveCache({ ...cached, fingerprint });
      const feedPosts = cached.posts.filter((p) => p.sourceType !== 'connection');
      _backgroundGenerateTextArt(feedPosts);
      refillQueue(questions).catch(console.error);
      return feedPosts;
    }

    // No cache: generate initial posts via LLM (legacy path for first load)
    let generated: ParsedGeneration = { posts: [], connectionCards: [] };
    try {
      generated = await generateDailyPostsWithLLM(questions, date);
    } catch {
      generated = { posts: [], connectionCards: [] };
    }

    const newPosts = generated.posts;
    const oldPosts = cached?.posts ?? [];
    const newIds = new Set(newPosts.map((p) => p.id));
    const preserved = oldPosts.filter((p) => !newIds.has(p.id));
    const allPosts = [...newPosts, ...preserved];

    saveCache({ date, fingerprint, posts: allPosts, connectionCards: generated.connectionCards });

    const feedPosts = allPosts.filter((p) => p.sourceType !== 'connection');
    const enrichedPosts = await generateTextArtContent(feedPosts);
    _persistStylesToCache(enrichedPosts);

    // Spread styles and persist to history (D-33) + seed queue
    spreadByStyle(enrichedPosts);
    for (const p of enrichedPosts) { try { postHistoryService.addPost(p); } catch { /* non-critical */ } }
    postQueueService.enqueue(enrichedPosts);

    return enrichedPosts;
  },

  /** Return cached connection card data for the current session. */
  getConnectionCards(): ConnectionCardData[] {
    return loadCache()?.connectionCards ?? [];
  },

  getPostById(id: string): DailyPost | null {
    const cached = loadCache();
    const fromCache = cached?.posts.find((post) => post.id === id) ?? null;
    if (fromCache) return fromCache;
    // Fall back to sessionStorage-based connection post store
    const connectionPost = getConnectionPostFromStore(id);
    if (connectionPost) return connectionPost;
    // Check video cache
    try {
      const videoRaw = localStorage.getItem('echolearn_video_cache');
      if (videoRaw) {
        const videoCache = JSON.parse(videoRaw) as { posts?: DailyPost[] };
        const videoPost = videoCache.posts?.find((p: DailyPost) => p.id === id);
        if (videoPost) return videoPost;
      }
    } catch { /* ignore */ }
    // Check news cache
    try {
      const newsRaw = localStorage.getItem('echolearn_news_posts');
      if (newsRaw) {
        const newsCache = JSON.parse(newsRaw) as { posts?: DailyPost[] };
        const newsPost = newsCache.posts?.find((p: DailyPost) => p.id === id);
        if (newsPost) return newsPost;
      }
    } catch { /* ignore */ }
    // Check shorts cache
    try {
      const shortsRaw = localStorage.getItem('echolearn_short_posts');
      if (shortsRaw) {
        const shortsCache = JSON.parse(shortsRaw) as { posts?: DailyPost[] };
        const shortsPost = shortsCache.posts?.find((p: DailyPost) => p.id === id);
        if (shortsPost) return shortsPost;
      }
    } catch { /* ignore */ }
    return null;
  },

  getCachedDailyPosts(): DailyPost[] {
    const feedPosts = (loadCache()?.posts ?? []).filter((p) => p.sourceType !== 'connection');
    _backgroundGenerateTextArt(feedPosts);
    return feedPosts;
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

  /** Append dynamically loaded posts to the daily cache so they survive page refresh. */
  appendToCache(posts: DailyPost[]): void {
    const cached = loadCache();
    if (!cached) return;
    const existingIds = new Set(cached.posts.map(p => p.id));
    const fresh = posts.filter(p => !existingIds.has(p.id));
    if (fresh.length === 0) return;
    cached.posts.push(...fresh);
    saveCache(cached);
  },

  /** Explicitly clear the post cache (e.g. after "Clear All Data"). */
  clearCache(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },

  /**
   * Serve posts from the queue. Triggers background refill when needed (D-11).
   * Phase 31: drains from postQueueService instead of generating inline.
   */
  async generateMorePosts(questions: Question[], count = 4): Promise<DailyPost[]> {
    // Exclude off-topic/flagged questions
    questions = questions.filter((q) => !q.flagged);

    // D-39: bonus cap — if all concepts explored, enforce bonus post limit
    const exploredAnchors = dailyReadService.getExploredAnchors();
    const anchors = questions.filter(q => q.isAnchorNode);
    const allExplored = anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id));
    if (allExplored) {
      const settings = settingsService.getSync();
      const bonusCap = settings.feed?.bonusPostCap ?? FEED_DEFAULTS.bonusPostCap;
      const bonusServed = postQueueService.getCycleNumber() * 4;
      if (bonusServed >= bonusCap) return [];
    }

    // Drain from queue
    const posts = postQueueService.dequeue(count);

    // Persist to history (D-33)
    for (const p of posts) { try { postHistoryService.addPost(p); } catch { /* non-critical */ } }

    // Trigger background refill if needed (D-11)
    if (postQueueService.needsRefill()) {
      refillQueue(questions).catch(console.error);
    }

    return posts;
  },


  /**
   * Generate posts based on a completed session's Q&As, weighted by concept.
   * Groups session questions by anchor/cluster, builds a weighted prompt
   * (primary: session Q&As, secondary: same-anchor knowledge, background: other concepts),
   * and generates 6 posts in one LLM call.
   *
   * Generated posts are pushed into infiniteScrollService's pending queue —
   * they are NOT added to the feed immediately.
   */
  async generateSessionPosts(session: ChatSession): Promise<DailyPost[]> {
    const allQuestions = questionService.getAll().filter(q => !q.flagged);
    if (allQuestions.length === 0) return [];

    // 1. Extract question IDs from session messages
    const sessionQuestionIds = new Set(
      session.messages
        .filter(m => m.questionId)
        .map(m => m.questionId!),
    );
    if (sessionQuestionIds.size === 0) return [];

    const sessionQuestions = allQuestions.filter(q => sessionQuestionIds.has(q.id));
    if (sessionQuestions.length === 0) return [];

    // 2. Group session questions by anchor parent (concept)
    const conceptGroups = new Map<string, { anchor: Question | null; questions: Question[] }>();
    for (const q of sessionQuestions) {
      const anchorId = q.parentId ?? 'ungrouped';
      if (!conceptGroups.has(anchorId)) {
        const anchor = anchorId !== 'ungrouped'
          ? allQuestions.find(a => a.id === anchorId && a.isAnchorNode)
          : null;
        conceptGroups.set(anchorId, { anchor: anchor ?? null, questions: [] });
      }
      conceptGroups.get(anchorId)!.questions.push(q);
    }

    // 3. Build weighted prompt
    const primaryLines: string[] = [];
    const secondaryLines: string[] = [];

    for (const [, group] of conceptGroups) {
      const conceptName = group.anchor?.title || group.anchor?.content.slice(0, 50) || 'General';
      primaryLines.push(`\n### Concept: ${conceptName} (just explored — high priority)`);
      for (const q of group.questions) {
        primaryLines.push(`Q: ${q.title || q.content.slice(0, 80)}`);
        primaryLines.push(`A: ${(q.summary || q.answer).slice(0, 300)}`);
      }

      // Secondary: other Q&As under the same anchor (existing knowledge)
      if (group.anchor) {
        const sameAnchorQs = allQuestions.filter(
          q => q.parentId === group.anchor!.id && !sessionQuestionIds.has(q.id) && !q.isAnchorNode,
        ).slice(0, 3);
        if (sameAnchorQs.length > 0) {
          secondaryLines.push(`\n### Related knowledge in ${conceptName}`);
          for (const q of sameAnchorQs) {
            secondaryLines.push(`- ${q.title || q.content.slice(0, 60)}: ${(q.summary || q.answer).slice(0, 120)}`);
          }
        }
      }
    }

    // Background: other concept areas (just names)
    const sessionAnchorIds = new Set([...conceptGroups.keys()].filter(k => k !== 'ungrouped'));
    const otherAnchors = allQuestions
      .filter(q => q.isAnchorNode && !sessionAnchorIds.has(q.id))
      .slice(0, 15)
      .map(a => a.title || a.content.slice(0, 40));

    const backgroundLine = otherAnchors.length > 0
      ? `\n### Other concepts the user is learning\n${otherAnchors.join(', ')}`
      : '';

    // 4. Generate posts
    const settings = settingsService.getSync();
    if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return [];

    const date = today();
    const cached = loadCache();
    const existingPosts = cached?.posts ?? [];
    const existingTitles = existingPosts.map(p => p.title);
    const avoidClause = existingTitles.length > 0
      ? `\nIMPORTANT: Do NOT repeat topics already covered. Existing post titles to avoid:\n${existingTitles.slice(0, 20).map(t => `- ${t}`).join('\n')}\nChoose different angles, examples, or connections.`
      : '';

    try {
      const raw = await chatCompletion(
        [
          {
            role: 'system',
            content: [
              'You are an editorial learning writer.',
              'Generate 6 learning posts. Focus primarily on the concepts the user just explored, but feel free to connect them to their broader knowledge.',
              'Write rich, intriguing, accurate educational posts.',
              'Do not write flashcards, tiny summaries, or listicles without a narrative spine.',
              'Return only valid JSON.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              'Generate 6 learning posts based on what the user just studied.',
              '',
              '== Just explored (priority) ==',
              ...primaryLines,
              '',
              '== Related knowledge in these areas ==',
              ...secondaryLines,
              '',
              backgroundLine,
              '',
              'Each post must have a punchy teaserHook and a vivid teaserPreview.',
              'teaserHook: max 8 words. Punchy, curiosity-driven.',
              'teaserPreview: 130-170 characters. Vivid teaser, not a dry summary.',
              'Vary narrative style: example-first, historical-story, contrast, analogy, false-intuition, mnemonic, mechanism-breakdown.',
              'Every post must include: title, teaserHook, teaserPreview, narrativeMode, contextLabel, sourceType, sourceQuestionIds, keywords.',
              'Do NOT include bodyMarkdown, whyCare, takeaway, or quickAskPrompts — these are generated on demand.',
              'sourceType must be one of: "recent", "related", "resurfaced", "mixed".',
              'Use only sourceQuestionIds from the provided context.',
              avoidClause,
            ].join('\n'),
          },
        ],
        settings.llm,
        { serviceName: 'posts' },
      );

      const existingIds = new Set(existingPosts.map(p => p.id));
      let newPosts = parseGeneratedPosts(raw, allQuestions, date, [], existingPosts.length, 6).posts
        .filter(p => !existingIds.has(p.id));
      newPosts = newPosts.slice(0, 6);

      // Assign presentation styles via pre-style assignment and generate text-art
      const settings2 = settingsService.getSync();
      const availability: ApiAvailability = {
        hasYoutubeKey: !!(settings2.youtube?.apiKey),
        hasTavilyKey: !!(settings2.webSearch?.tavilyApiKey),
        hasImageGenKey: !!(settings2.imageGeneration?.nanoBananaApiKey),
      };
      const sessionAssignments = assignStyles(
        newPosts.map(p => p.sourceQuestionIds[0] ?? p.id),
        availability,
      );
      const styled = newPosts.map((post, i) => ({
        ...post,
        presentationStyle: sessionAssignments[i]?.style ?? ('text-art' as PresentationStyle),
      }));
      const enriched = await generateTextArtContent(styled);

      // Do NOT save to daily cache — session posts go only to the pending queue
      // via infiniteScrollService.enqueuePosts(). They enter the daily cache
      // when the user swipes and loadNextBatch serves + caches them.

      return enriched;
    } catch (err) {
      console.warn('[concept-feed] Session post generation failed:', err);
      return [];
    }
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
