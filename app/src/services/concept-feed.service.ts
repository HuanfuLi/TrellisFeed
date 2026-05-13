import { chatCompletion, chatStream } from '../providers/llm/index.ts';
import type { ChatSession, DailyPost, PostNarrativeMode, PostOriginContext, PostSnapshot, PresentationStyle, Question, WebSearchResult } from '../types';
import { today } from '../lib/date.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService, FEED_DEFAULTS } from './settings.service.ts';
import { plannerService } from './planner.service.ts';
import { youtubeService, type YouTubeSearchResult } from './youtube.service.ts';
import { webSearch } from './web-search.service.ts';
import { questionService } from './question.service.ts';
import { postQueueService } from './post-queue.service.ts';
import { postHistoryService } from './post-history.service.ts';
import { dailyReadService } from './daily-read.service.ts';
import { engagementService } from './engagement.service.ts';
import { sourceDiversityService, extractDomain } from './source-diversity.service.ts';
import { selectNewsTopSources, mapNewsSourcesToNewsMeta } from './news-source-metadata.ts';
import { assignStyles, reassignFailures, type ApiAvailability } from './style-assignment.ts';
import { computeLeafState } from './trellis-state.service.ts';
import { hasSeenVideoId, addSeenVideoId } from './concept-feed-dedup.ts';
import { STARTER_POST_IDS, filterDecayedStarters } from './starter-posts-decay.ts';
import {
  markYoutubeQuotaExhausted,
  markTavilyQuotaExhausted,
  isYoutubeRuntimeAvailable,
  isTavilyRuntimeAvailable,
} from './api-availability.ts';
// Phase 36 GAP-4 — spread helpers extracted to a leaf module so node --test can
// import them without hitting the i18n JSON-import-attribute chain. Both functions
// mutate `posts` in place; this module re-exports them too so existing callers
// (and downstream tests that import from here) keep working.
import { spreadByStyle, spreadByConcept } from './feed-spread.ts';
export { spreadByStyle, spreadByConcept };
import { createPromiseMutex } from './refill-mutex.ts';

const STORAGE_KEY = 'trellis_daily_posts';
const CONNECTION_POSTS_KEY = 'trellis_connection_posts';
const MAX_POSTS = 4;
const CONTEXT_LIMIT = 10;

/**
 * Produce a globally-unique post ID with a semantic prefix.
 *
 * Phase 33 gap fix (2026-04-20): replaces the prior deterministic ID scheme
 * `post-${date}-${type}-${conceptId}-${cycleStamp}` which had two failure modes:
 *   1. Intra-cycle collision when one concept got multiple video/short/news
 *      assignments in the same refill (two posts share same id, two React cards
 *      bound to same state → clicking one starts both iframes).
 *   2. Cross-batch collision via state drift (localStorage clear, cache trim,
 *      forgotten incrementCycle) — cycleStamp is only as monotonic as queue state.
 *
 * The semantic prefix (date, kind, conceptId) is preserved for debuggability
 * (`grep post-2026-04-20-video-concept123` still finds that concept's videos).
 * The UUID suffix guarantees uniqueness regardless of any application state.
 */
function makePostId(date: string, kind: string, conceptId: string): string {
  return `post-${date}-${kind}-${conceptId}-${crypto.randomUUID()}`;
}

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

const VALID_SOURCE_TYPES = new Set<DailyPost['sourceType']>(['recent', 'related', 'resurfaced', 'starter', 'mixed', 'connection', 'video', 'text-art', 'news', 'suggestion']);

export const STARTER_POSTS: DailyPost[] = [
  makeStarterPost(
    'starter-welcome',
    'Welcome to Trellis',
    'Your AI learning companion',
    'Ask any question and watch your knowledge grow. Trellis uses AI to create personalized learning paths.',
    '# Welcome to Trellis\n\nTrellis is your AI-powered learning companion. Here\'s how to get started:\n\n1. **Ask a question** — Tap the Ask tab and type any question. The AI will answer it and save it to your knowledge graph.\n2. **Review what you learn** — Your answers become flashcards. Review them to build lasting memory.\n3. **Explore your feed** — This feed brings you fresh content based on what you\'re learning.\n\nStart by asking your first question!',
    'Getting Started',
  ),
  makeStarterPost(
    'starter-knowledge-growth',
    'How your knowledge grows',
    'From questions to mastery',
    'Every question you ask becomes part of your knowledge graph. Review flashcards to strengthen your memory.',
    '# How Your Knowledge Grows\n\nTrellis follows a proven learning loop:\n\n1. **Ask** — Ask questions about anything you\'re curious about.\n2. **Connect** — Your questions are organized into a knowledge graph by topic.\n3. **Review** — Flashcards are generated automatically. Spaced repetition helps you remember.\n4. **Grow** — As you master topics, your trellis tree blooms and bears fruit.\n\nThe more you review, the stronger your knowledge becomes.',
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
    keywords: ['trellis', 'getting-started'],
    generatedAt: Date.now(),
    origin: 'ai',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
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
    // Phase 36-11: stale cache rejection. The served-posts cache must NOT
    // carry across midnight — yesterday's served posts have already been
    // shown to the user and should not render as "today's feed". This is the
    // symmetric counterpart to post-queue.service.ts's load() rehydration.
    // See .planning/phases/36-.../36-UAT.md round-3 sub-issue (b cause #2)
    // and (d) — second Force-New-Day was rendering the previous-state served
    // posts because of this missing date check.
    if (parsed.date !== today()) {
      // Phase 41 D-02 — wholesale wipe of per-anchor usedByAnchor Map at day boundary.
      // sourceDiversityService.reset() is idempotent (Map.clear()); calling on already-empty
      // Map is a no-op. Fires once per loadCache() invocation across stale-cache scenarios
      // until a fresh saveCache(today) writes a new entry — harmless per Pitfall 8.
      sourceDiversityService.reset();
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

// Phase 43 gap-closure 43-14 — centralize the dismiss filter at the READ
// BOUNDARY (operator-validated direction from .planning/debug/dismiss-not-
// propagating-to-same-anchor-tiles.md). The walker dismiss-skip in
// post-queue.service.ts walkDerivedList handles FUTURE refill cycles
// (anchors not yet popped to in-memory _state.posts / cached.posts), but
// for posts ALREADY popped or cached, the filter must run at every read
// site that HomeScreen consumes. Doing it once here means the four
// HomeScreen write paths (warm-start initializer, main effect, refreshFeed
// via PLANNER_UPDATED + 8s delayed timer, [location.pathname] re-sync)
// are dismiss-aware by construction — no per-consumer post-filter is
// needed. Effect A's live ANCHOR_DISMISSED filter in HomeScreen.tsx:567-574
// remains in place for the AnimatePresence fade-out animation (LP-05
// fast path); Effect B at HomeScreen.tsx:584-591 is now strictly
// redundant but kept as defense-in-depth.
//
// Filter shape: post.sourceQuestionIds[0] is the anchor.id (text/image/news/
// video paths all assign sourceQuestionIds = [a.conceptId] per the pipeline;
// see concept-feed.service.ts construction sites). A post with no
// sourceQuestionIds (e.g., legacy starter posts) passes the filter
// (cannot be matched against a dismissed-anchor id).
function applyDismissedFilter(posts: DailyPost[]): DailyPost[] {
  const dismissed = new Set(engagementService.getDismissedAnchorIds());
  if (dismissed.size === 0) return posts;
  return posts.filter((p) => {
    const anchorId = p.sourceQuestionIds?.[0];
    if (!anchorId) return true; // posts without an anchor are not dismissable
    return !dismissed.has(anchorId);
  });
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

/**
 * Walk a JSON array and return every top-level {...} object that balanced
 * successfully. Tolerant to truncation: if the tail is cut mid-object, only
 * that final object is dropped — everything before it survives.
 *
 * 2026-04-21 fix. Root cause: the 'posts' batch LLM call was asked for N
 * text-style posts (N could be 20+) but completion was capped at maxTokens
 * 4096, which a Gemma-4 reply routinely overruns around post ~25. The raw
 * response arrived truncated mid-string. The old two-tier parser in
 * parseGeneratedPosts ran `JSON.parse(arrMatch[0])` on the whole truncated
 * array — which threw — then the catch silently returned `{posts: []}`.
 * Result: every text-style post (including all 'image' and 'suggestion'
 * assignments) was dropped, while video/short/news (generated out-of-band)
 * survived. Explains the "zero image posts over 50+" symptom exactly.
 */
function extractPartialJsonArrayObjects(raw: string): Array<Record<string, unknown>> {
  let s = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');
  const start = s.indexOf('[');
  if (start === -1) return [];
  s = s.slice(start + 1);

  const results: Array<Record<string, unknown>> = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let objStart = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const objStr = s.slice(objStart, i + 1);
        try {
          results.push(JSON.parse(objStr) as Record<string, unknown>);
        } catch { /* skip malformed individual object, keep scanning */ }
        objStart = -1;
      } else if (depth < 0) {
        // Outer ']' — end of array
        break;
      }
    }
  }

  return results;
}

function parseGeneratedPosts(
  raw: string,
  questions: Question[],
  date: string,
  candidates: Array<{ source: Question; target: Question; score: number }> = [],
  maxPosts = MAX_POSTS,
): ParsedGeneration {
  // Try object format first: {"posts": [...], "connectionCards": [...]}
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]) as { posts?: unknown; connectionCards?: unknown };
      if (Array.isArray(parsed.posts)) {
        return {
          posts: extractPosts(parsed.posts as Array<Record<string, unknown>>, questions, date, maxPosts),
          connectionCards: parseConnectionCards(parsed.connectionCards, candidates),
        };
      }
    } catch {
      // fall through to array parse
    }
  }

  // Fall back to plain array format
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]) as Array<Record<string, unknown>>;
      return { posts: extractPosts(parsed, questions, date, maxPosts), connectionCards: [] };
    } catch {
      // fall through to tolerant partial-parse
    }
  }

  // Final tier: tolerant partial parse — recovers all complete objects from
  // a truncated array response. See extractPartialJsonArrayObjects for the
  // full rationale (link: 2026-04-21 fix for dropped text-style posts).
  const partial = extractPartialJsonArrayObjects(raw);
  if (partial.length > 0) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.info(`[parseGeneratedPosts] recovered ${partial.length} posts from truncated JSON`);
    }
    return { posts: extractPosts(partial, questions, date, maxPosts), connectionCards: [] };
  }

  return { posts: [], connectionCards: [] };
}

function extractPosts(parsed: Array<Record<string, unknown>>, questions: Question[], date: string, maxPosts = MAX_POSTS): DailyPost[] {
  const byId = new Map(questions.map((question) => [question.id, question]));

  return parsed
    .slice(0, maxPosts)
    .map((item) => {
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
        id: makePostId(date, 'text', sourceQuestionIds[0] ?? 'general'),
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

// Phase 38-04: invalidate cached textArtContent on locale change so welcome
// posts (and any cached text-art posts) regenerate under the new locale.
// Without this, text-art generated under one locale stays in the cache
// forever and renders mismatched against the user's UI locale.
eventBus.subscribe('LOCALE_CHANGED', () => {
  const cached = loadCache();
  if (!cached) return;
  const stripped = cached.posts.map(p => {
    if (p.presentationStyle !== 'text-art' || !p.textArtContent) return p;
    const { textArtContent: _drop, ...rest } = p;
    return rest as DailyPost;
  });
  saveCache({ ...cached, posts: stripped });
  _textArtBgRunning = false;
});

// spreadByStyle (Phase 31, rewritten 2026-04-21) and spreadByConcept (Phase 36
// GAP-4) live in ./feed-spread.ts (leaf module — see import block at top of
// file). Re-exported above for downstream callers/tests that import from this
// service.

// assignPresentationStyles removed in Phase 31 — replaced by pre-style assignment via style-assignment.ts (D-18)

/**
 * Phase 42 UAT-6 (3B, 2026-05-09): tighten text-art content to ONE sentence ≤ 80 chars.
 * Run on both LLM responses (which sometimes ignore the prompt constraint) AND on the
 * fallback path (which previously used multi-sentence `teaser.preview`).
 *
 * Strategy: trim → drop trailing whitespace → keep only the first sentence (split on
 * ./!/? boundary) → truncate to 80 chars on word boundary if still long. Returns the
 * tightened string, or null if the input is unusably empty after processing.
 */
function tightenTextArtContent(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  // Strip wrapping quotes some models emit ("Headline").
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('“') && s.endsWith('”'))) {
    s = s.slice(1, -1).trim();
  }
  // Keep only the first sentence. Split on terminator + whitespace, preserve the
  // terminator on the first segment so 'Hot take.' stays 'Hot take.' (not 'Hot take').
  const sentenceMatch = s.match(/^.*?[.!?](?:\s|$)/);
  if (sentenceMatch) {
    s = sentenceMatch[0].trim();
  }
  // Hard length cap: if still > 80 chars after sentence split, truncate at word
  // boundary and add an ellipsis. Operator screenshot showed "Why the Smell of
  // Safety Makes AI Unsafe" survives at 41 chars; longer LLM drift truncates here.
  if (s.length > 80) {
    const cut = s.slice(0, 80);
    const lastSpace = cut.lastIndexOf(' ');
    s = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
  }
  return s || null;
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

  // Batch all text-art prompts into parallel requests.
  // Phase 42 UAT-6 (3B, 2026-05-09): operator wants text-art kept SHORT — was
  // wrapping 4+ lines in half-width masonry tiles. Constraint tightened from
  // "under 12 words" to "≤ 80 characters AND exactly 1 sentence". Post-LLM
  // validation strips trailing extra sentences (some models emit follow-ups
  // despite the constraint) and falls back if length still violates.
  const results = await Promise.allSettled(
    textArtPosts.map(async (post) => {
      const prompt = `Write ONE concise headline about: "${post.title}"

Pick one style:
- Breaking news: "Gemma 4 released — will it beat QWEN 3.5? 🔥"
- Interview hook: "Interviewer: How much VRAM to train a 7B model?"
- Hot take: "Why I'm not bullish on World Models"
- Provocative question: "What if transformers are already obsolete? 🤔"
- Bold claim: "RAG is dead. Long live agentic search."
- Conversation starter: "Your brain is lying to you about rereading 🧠"

Rules:
- EXACTLY ONE sentence (≤ 80 characters)
- Emojis are OPTIONAL — use 0, 1, or 2 emojis placed naturally (middle, end, or nowhere). Never always at the start.
- Sound like a real headline, tweet, or podcast title
- Be specific to the topic

Return ONLY the single sentence, nothing else.`;

      const result = await chatCompletion(
        [{ role: 'user', content: prompt }],
        settings.llm,
        { maxTokens: 80, serviceName: 'text-art' },
      );
      return { postId: post.id, content: result };
    }),
  );

  // Build a map of post ID -> text-art content (validated to ≤ 80 chars / 1 sentence).
  const contentMap = new Map<string, string>();
  results.forEach((r) => {
    if (r.status !== 'fulfilled' || !r.value.content) return;
    const tightened = tightenTextArtContent(r.value.content);
    if (tightened) contentMap.set(r.value.postId, tightened);
  });

  // Apply text-art content to posts; use fallback for failed generations.
  // Phase 42 UAT-6 (3B): fallback drops `teaser.preview` (multi-sentence summary)
  // and uses hook OR title — both are naturally short.
  return posts.map(p => {
    if (p.presentationStyle !== 'text-art') return p;
    if (contentMap.has(p.id)) {
      return { ...p, textArtContent: contentMap.get(p.id)! };
    }
    if (!p.textArtContent) {
      const fallback = p.teaser.hook?.trim() || p.title;
      return { ...p, textArtContent: tightenTextArtContent(fallback) || fallback };
    }
    return p;
  });
}


// ─── News post helpers ──────────────────────────────────────────────────────

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
 * Build the DERIVED LIST for this generation cycle (CLAUDE.md → "Concept Feed
 * Generation Pipeline" → list 2 of 3).
 *
 * Inputs:
 *   - questions: source-of-truth questions (incl. anchors)
 *   - dailyReadService.getExploredAnchors(): concepts the user already read a post
 *     for today. Per design these are REMOVED from the derived list so the next
 *     loop doesn't re-suggest the same concept the user already explored.
 *
 * Output: weighted multi-entry list of conceptIds. Each anchor appears
 * BASE_ENTRIES_PER_CONCEPT times by default (and 2× that if "important" — overdue
 * or low-ease per SM-2). assignStyles will then sample STYLE_WEIGHTS to assign a
 * varied style to each entry, giving the user multiple post angles per concept.
 *
 * What changed (vs prior single-entry-per-concept implementation):
 *   - Multi-entry (weighted) — addresses operator complaint that swipe pops 1 post
 *     instead of the designed 4. The derived list is now large enough to keep the
 *     8-deep queue refilled across multiple swipes.
 *   - Filter out exploredAnchors — per design "If user read a post of a concept,
 *     the concept is removed from the derived list so the next loop does not
 *     generate post for that concept again." (Previously this filter was wrongly
 *     removed; vine-progress consumed exploredAnchors for rendering only.)
 *   - Pending-in-queue filter removed — multi-entry generation needs to be free
 *     to add more posts for a concept that already has some pending. Dedup at
 *     queue.enqueue level (post.id-based) prevents duplicate POSTS.
 */
const BASE_ENTRIES_PER_CONCEPT = 4;

function buildConceptBatch(questions: Question[]): string[] {
  const exploredIds = new Set(dailyReadService.getExploredAnchors());

  const anchors = questions.filter(q => q.isAnchorNode);
  const dueAnchors = anchors.filter(a => !exploredIds.has(a.id));

  const conceptIds: string[] = [];
  for (const anchor of dueAnchors) {
    const children = questions.filter(q => q.parentId === anchor.id);
    let isImportant = anchor.reviewSchedule?.easeFactor != null && anchor.reviewSchedule.easeFactor < 1.5;
    if (!isImportant) {
      try {
        const leaf = computeLeafState(anchor, children);
        isImportant = leaf === 'dying' || leaf === 'falling' || leaf === 'dead';
      } catch { /* non-critical — default to not important */ }
    }
    const count = isImportant ? BASE_ENTRIES_PER_CONCEPT * 2 : BASE_ENTRIES_PER_CONCEPT;
    for (let i = 0; i < count; i++) conceptIds.push(anchor.id);
  }
  return conceptIds;
}

// YouTube query rotation (Bug 6, 2026-04-19). The original implementation called
// `searchVideos(conceptName, 3)` every refill cycle for the same anchor — YouTube's
// relevance ranking is deterministic per query, so cycles 1+ kept getting the same top
// 3 videos. Combined with a maxResults of 3, fresh-anchor users hit the dedup wall
// after 3 cycles. Rotating the query modifier reshuffles the result set; widening
// `maxResults` to 15 gives more headroom even within a single modifier window.
const VIDEO_QUERY_MODIFIERS = [
  '',                       // bare concept
  ' explained',
  ' tutorial',
  ' how it works',
  ' deep dive',
];
const YOUTUBE_FETCH_POOL_SIZE = 15;

function buildYoutubeQuery(conceptName: string, cycleNumber: number): string {
  const modifier = VIDEO_QUERY_MODIFIERS[Math.abs(cycleNumber) % VIDEO_QUERY_MODIFIERS.length];
  return `${conceptName}${modifier}`.trim();
}

/**
 * Per-refill cache of external API results. Populated by the pre-validation pass
 * in refillQueue and consumed by generatePostBatch's video/short/news loops so
 * each YouTube/Tavily query is executed at most ONCE per refill cycle instead of
 * twice (pre-validation + actual fetch). Cuts YouTube quota burn ~50%.
 *
 * Cache key for YouTube: `${conceptId}:${style}` where style is 'video'
 * (Phase 38 / TECHDEBT-06: 'short' style was removed; only 'video' remains).
 * Cache key for Tavily: `conceptId` (news is a single style per concept).
 */
interface PreFetchCache {
  youtube: Map<string, YouTubeSearchResult[]>;  // key: `${conceptId}:${style}`
  news: Map<string, WebSearchResult[]>;         // key: conceptId
}

/**
 * Generate a batch of posts from pre-assigned style assignments.
 * Reuses the existing LLM generation prompt for text-style posts,
 * fetches from YouTube/Tavily for video/news, and generates text-art content.
 *
 * If `preFetched` is provided, the video/news loops consume cached
 * API results instead of issuing fresh calls (Phase 33 quota-burn fix
 * 2026-04-20). When absent (legacy callers / session-post path), loops
 * fall back to calling the APIs directly.
 */
async function generatePostBatch(
  questions: Question[],
  assignments: import('./style-assignment').StyleAssignment[],
  preFetched?: PreFetchCache,
): Promise<DailyPost[]> {
  const date = today();
  const byId = new Map(questions.map(q => [q.id, q]));
  const settings = settingsService.getSync();

  // Group assignments by style for batch processing
  const textStyleAssignments = assignments.filter(a =>
    a.style === 'text-art' || a.style === 'image' || a.style === 'suggestion',
  );
  const videoAssignments = assignments.filter(a => a.style === 'video');
  const newsAssignments = assignments.filter(a => a.style === 'news');

  // Cross-cycle YouTube videoId dedup is now handled by the module-scope helper
  // in concept-feed-dedup.ts (Phase 32.1-02 / UAT-31-2 fix). Phase 31-08's local
  // Set lived only for one generatePostBatch call, so duplicates leaked across
  // refillQueue cycles. The module-scope helpers persist for the session and
  // auto-clear on day boundary.

  const posts: DailyPost[] = [];

  // Generate text-style posts via LLM (text-art, image, suggestion).
  //
  // Batch-size cap (2026-04-21): the LLM emits ~200 tokens per post; default
  // maxTokens is 4096. Requesting large batches routinely overran that ceiling
  // and the response arrived truncated mid-JSON. Cap + bump + tolerant parser
  // work together — 20 posts × 200 tokens ≈ 4000, well under the 8192 ceiling,
  // and the partial-array parser at `extractPartialJsonArrayObjects` recovers
  // any residual truncation gracefully. Extra text-style assignments beyond
  // the cap roll into subsequent refill cycles.
  //
  // Priority ordering (2026-04-21 fix #2): image and suggestion are the RARE
  // minority styles (10% and 5% weight). If the LLM under-generates or the
  // slice cap trims the tail, whatever's at the end gets silently dropped by
  // the index-based style mapping at line ~960. With random assignment order,
  // a rare-style assignment at position 18 or 19 of the batch evaporates
  // whenever the LLM returns fewer posts than requested — this is exactly
  // the "9 image assignments but 0 image posts served" regression reported
  // in the 2026-04-21 DevTools log. Moving image + suggestion to the front
  // makes text-art the tail-sacrifice, which is harmless (there's always an
  // abundance of text-art).
  const TEXT_BATCH_CAP = 20;
  const rarityRank: Record<string, number> = { image: 0, suggestion: 1, 'text-art': 2 };
  const sortedTextStyle = [...textStyleAssignments].sort(
    (a, b) => (rarityRank[a.style] ?? 3) - (rarityRank[b.style] ?? 3),
  );
  const textBatch = sortedTextStyle.slice(0, TEXT_BATCH_CAP);
  if (import.meta.env?.DEV) {
    console.info(
      `[generatePostBatch] text branch entry: textBatch=${textBatch.length} ` +
      `(image=${textBatch.filter(a => a.style === 'image').length} ` +
      `suggestion=${textBatch.filter(a => a.style === 'suggestion').length} ` +
      `text-art=${textBatch.filter(a => a.style === 'text-art').length}) ` +
      `aiConsent=${settings.preferences.aiConsentGiven} llmConfigured=${settings.llm.isConfigured}`,
    );
  }
  if (textBatch.length > 0 && settings.preferences.aiConsentGiven && settings.llm.isConfigured) {
    const textQuestions = textBatch
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
              { role: 'user', content: buildGenerationPrompt(date, context, [], textBatch.length) },
            ],
            settings.llm,
            { serviceName: 'posts', maxTokens: 8192 },
          );
          const parsed = parseGeneratedPosts(raw, questions, date, [], textBatch.length);
          // Dev-mode: flag when LLM returns fewer posts than text-style assignments
          // requested — any 'image' / 'suggestion' assignment past parsed.posts.length
          // is silently dropped by the loop below. Surfaces the "10% image weight but
          // 0 image posts in 50+" regression class. (Console.info so it appears at
          // default log level — console.debug is hidden unless "Verbose" is toggled.)
          if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
            const styleCounts: Record<string, number> = {};
            for (const a of textBatch) styleCounts[a.style] = (styleCounts[a.style] ?? 0) + 1;
            console.info(
              `[generatePostBatch] text branch: requested=${textBatch.length} parsed=${parsed.posts.length} assignments=`,
              styleCounts,
            );
            if (parsed.posts.length < textBatch.length) {
              const dropped: Record<string, number> = {};
              for (let i = parsed.posts.length; i < textBatch.length; i++) {
                const s = textBatch[i].style;
                dropped[s] = (dropped[s] ?? 0) + 1;
              }
              console.warn('[generatePostBatch] LLM under-generated; dropped assignments:', dropped);
            }
          }
          // Apply pre-assigned styles to generated posts
          for (let i = 0; i < parsed.posts.length && i < textBatch.length; i++) {
            if (!parsed.posts[i]) continue;
            const assignment = textBatch[i];
            parsed.posts[i].presentationStyle = assignment.style;

            // L1 — Provenance from assignment, not LLM. Mirrors the video/short/news pattern
            // (lines 807, 843, 876) where sourceQuestionIds/Titles/keywords are derived from
            // the style assignment's conceptId. Fixes Bug 3: AI text posts had empty badges
            // when the LLM omitted or mangled sourceQuestionIds (frequent when context was
            // thin or the model — e.g. OpenAI on a fresh-install device — interpreted the
            // 'use only IDs from the context' clause conservatively). With this, badges are
            // deterministic and always reflect the anchor we actually generated for.
            const concept = byId.get(assignment.conceptId);
            if (concept) {
              const anchor = concept.parentId ? byId.get(concept.parentId) : undefined;
              const anchorTitle = anchor?.isAnchorNode ? anchor.title?.trim() : undefined;
              parsed.posts[i].sourceQuestionIds = [assignment.conceptId];
              parsed.posts[i].sourceQuestionTitles = [anchorTitle || titleFor(concept)];
              // keywords only matters for image-style posts (image prompt) and news posts
              // (news essay context); for other styles it's dead cargo, but keep concept's
              // keywords when the concept has any so the image path still works.
              if (concept.keywords?.length) {
                parsed.posts[i].keywords = concept.keywords.slice(0, 4);
              }
            }

            if (assignment.style === 'suggestion') {
              parsed.posts[i].sourceType = 'suggestion' as DailyPost['sourceType'];
              // D-24: generate novel suggestion topics via LLM
              const concept = byId.get(assignment.conceptId);
              if (concept) {
                const existingTopics = questions
                  .filter(q => q.parentId === concept.parentId || q.parentId === concept.id)
                  .map(q => q.title?.trim() || q.content?.slice(0, 50)?.trim())
                  .filter((t): t is string => !!t);

                try {
                  const topicPrompt = `Given the concept "${concept.title || concept.content?.slice(0, 80)}", the user already knows about: ${existingTopics.slice(0, 8).join(', ') || 'nothing yet'}.

Suggest exactly 4 NEW topics they might find interesting. Topics should be:
- Related but unexplored (deeper dives, applications, contrasts, prerequisites, cross-domain connections)
- Phrased as questions or short phrases (max 60 chars each)
- NOT repeating any existing topic listed above

Return ONLY a JSON array of 4 strings, nothing else. Example: ["What is X?", "How does Y compare to Z?", "Applications of X in medicine", "Prerequisites for understanding X"]`;

                  const topicRaw = await chatCompletion(
                    [
                      { role: 'system', content: 'You generate concise topic suggestions. Return only valid JSON.' },
                      { role: 'user', content: topicPrompt },
                    ],
                    settings.llm,
                    { serviceName: 'suggestions' },
                  );

                  const cleaned = topicRaw.replace(/```json\n?|\n?```/g, '').trim();
                  const topics = JSON.parse(cleaned) as string[];
                  if (Array.isArray(topics) && topics.length > 0) {
                    parsed.posts[i].suggestionMeta = { topics: topics.slice(0, 4) };
                  }
                } catch {
                  // Fallback: use different-anchor questions if LLM fails
                  const neighbors = questions
                    .filter(q => q.parentId !== concept.parentId && q.isAnchorNode)
                    .slice(0, 4);
                  const fallbackTopics = neighbors
                    .map(n => n.title?.trim() || n.content?.slice(0, 50)?.trim())
                    .filter((t): t is string => !!t);
                  if (fallbackTopics.length > 0) {
                    parsed.posts[i].suggestionMeta = { topics: fallbackTopics };
                  }
                }
              }
            }
          }
          posts.push(...parsed.posts);
        } catch (err) {
          // LLM generation failed — skip text posts for this batch. Was silently
          // swallowed prior to 2026-04-21; now log so "0 text-style posts in
          // feed" regressions surface the actual error (timeout, disconnect,
          // rate-limit, OOM, etc.) instead of a trace-free empty cycle.
          console.warn(
            '[generatePostBatch] text-style LLM call failed:',
            err instanceof Error ? err.message : String(err),
          );
        }
      } else if (import.meta.env?.DEV) {
        console.warn(
          '[generatePostBatch] text branch skipped: context empty ' +
          `(recent=${context.recent.length} resurfaced=${context.resurfaced.length})`,
        );
      }
    } else if (import.meta.env?.DEV) {
      console.warn('[generatePostBatch] text branch skipped: 0 textQuestions after byId lookup');
    }
  }

  // Post IDs are produced by `makePostId` (UUID-suffixed) — see helper definition.
  // Bug A's cycleStamp is obsolete under the new scheme; kept `cycleNumber` below
  // because the YouTube query modifier rotation (Bug 6) still uses it.

  // Generate video posts from YouTube (with cross-cycle dedup via concept-feed-dedup helper).
  // Query modifier rotates per cycleNumber and pool widened to YOUTUBE_FETCH_POOL_SIZE so
  // repeated cycles for the same anchor produce fresh result sets (Bug 6, 2026-04-19).
  const cycleNumber = postQueueService.getCycleNumber();
  for (const a of videoAssignments) {
    try {
      const concept = byId.get(a.conceptId);
      // 2026-05-12 — skip when the anchor is unresolvable. Previously fell back
      // to a.conceptId, which leaked internal IDs like
      // `anchor-1776786217111-4-v9ty0` into the YouTube search query AND the
      // user-visible sourceQuestionTitles chip. Anchors can vanish from byId
      // when pre-fetched assignments outlive a prune/delete.
      if (!concept) continue;
      const conceptName = concept.title ?? concept.content?.slice(0, 50);
      if (!conceptName) continue;
      // Phase 33 quota-burn fix (2026-04-20): prefer cached pre-fetch result so
      // the same YouTube search isn't issued twice per cycle (pre-validation + here).
      const cacheKey = `${a.conceptId}:video`;
      const cached = preFetched?.youtube.get(cacheKey);
      let data: YouTubeSearchResult[] | undefined;
      if (cached) {
        data = cached;
      } else {
        const query = buildYoutubeQuery(conceptName, cycleNumber);
        const searchResult = await youtubeService.searchVideos(query, YOUTUBE_FETCH_POOL_SIZE);
        data = searchResult.success ? searchResult.data : undefined;
      }
      if (data && data.length > 0) {
        const freshVideo = data.find(v => !hasSeenVideoId(v.videoId));
        if (freshVideo) {
          addSeenVideoId(freshVideo.videoId);
          posts.push({
            id: makePostId(date, 'video', a.conceptId),
            date,
            title: freshVideo.title || conceptName,
            teaser: { hook: freshVideo.title || conceptName, preview: freshVideo.description?.slice(0, 170) || '' },
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
            videoMeta: { videoId: freshVideo.videoId, channelTitle: freshVideo.channelTitle, thumbnailUrl: freshVideo.thumbnailUrl },
          });
        }
      }
    } catch { /* video fetch failed — already reassigned in pre-validation */ }
  }

  // (Phase 38 / TECHDEBT-06) — short posts loop deleted. The short post type was
  // removed entirely; all YouTube content is constructed by the video loop above.

  // Generate news posts from Tavily
  for (const a of newsAssignments) {
    try {
      const concept = byId.get(a.conceptId);
      // 2026-05-12 — symmetric with the video loop above: skip on unresolvable
      // concept rather than fall back to a.conceptId. The bare-ID fallback
      // shipped a "NIH-Funded ANCHOR Study" news tile chipped with the literal
      // anchor ID — Tavily soft-matched on the "anchor-" prefix, and the chip
      // rendered the raw ID verbatim.
      if (!concept) continue;
      const conceptName = concept.title ?? concept.content?.slice(0, 50);
      if (!conceptName) continue;
      // Phase 33 quota-burn fix (2026-04-20): prefer cached pre-fetch result.
      const cached = preFetched?.news.get(a.conceptId);
      let result: WebSearchResult | undefined;
      let topSources: WebSearchResult[] = [];  // Phase 41 SC-4 — stored on newsMeta.sources for multi-snippet grounding
      if (cached?.length) {
        result = cached[0];
        topSources = cached.slice(0, 3);  // pre-fetch loop stores the filtered top 2-3 results
      } else {
        // Phase 41 D-02 + Pattern 2 — getUsedDomains → exclude → filterForDiversity → recordServedDomain
        const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);
        const searchResult = await webSearch(
          conceptName + ' latest research findings',
          { maxResults: 3, excludeDomains: [...usedDomains] },
        );
        if (searchResult.success && searchResult.data?.results.length) {
          topSources = selectNewsTopSources(searchResult.data.results, usedDomains);
          result = topSources[0];
        }
      }
      if (result) {
        posts.push({
          id: makePostId(date, 'news', a.conceptId),
          date,
          title: result.title || conceptName,
          teaser: { hook: result.title || conceptName, preview: result.content?.slice(0, 170) || '' },
          // bodyMarkdown deferred to on-enter streaming via generateNewsEssay (POST-06).
          // Previously this was set to result.content (the raw Tavily snippet, ~200 chars
          // truncated mid-sentence) which made PostDetailScreen skip the LLM stream entirely
          // and render the snippet as the essay body. Operator caught this regression on
          // 2026-04-19 — bodyMarkdown MUST stay empty so the on-enter streamer takes over.
          bodyMarkdown: '',
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
            // Phase 46 CONTENT-03 — cached and direct news paths both map up
            // to three selected Tavily entries into stable indexed sources.
            sources: mapNewsSourcesToNewsMeta(topSources),
            fetchedAt: Date.now(),
          },
        });
        // Phase 41 D-02 — record AFTER commit so the per-anchor used set reflects what
        // we actually shipped to the user. extractDomain returns undefined for malformed URLs;
        // short-circuit guard avoids polluting the used set with 'undefined'.
        const domain = extractDomain(result.url);
        if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);
      }
    } catch { /* news fetch failed */ }
  }

  // Generate text-art content for text-art styled posts
  const enrichedPosts = await generateTextArtContent(posts);
  return enrichedPosts;
}

// Phase 36-12: Promise-based mutex (was boolean).
// Multiple callers can race after Force-New-Day or rapid swipes; the
// boolean version made `await refillQueue()` callers silently no-op when
// a refill was already in flight, leaving generateMorePosts to dequeue
// against an unchanged empty queue. The Promise reference lets in-flight
// callers await the same Promise, see it resolve, then dequeue from the
// now-populated queue. Single LLM body per cycle preserved.
//
// The mutex itself lives in `refill-mutex.ts` (a leaf module — zero deps
// on the i18n chain) so node --test can import + exercise the mutex
// semantics directly without crashing on en.json import attributes.
// See .planning/phases/36-.../36-UAT.md round-3 sub-issue (e).
const _refillMutex = createPromiseMutex();

/**
 * Refill the post queue using the pre-style assignment pipeline (D-21).
 * Builds concept batch, pre-assigns styles, pre-validates external APIs,
 * reassigns failures, generates posts, and enqueues results.
 */
export async function refillQueue(questions: Question[]): Promise<void> {
  // Cheap pre-check: skip the mutex entirely if a refill isn't needed.
  // (The mutex's run() also short-circuits if a body is in-flight.)
  if (!postQueueService.needsRefill()) return;

  // Mutex.run captures the in-flight Promise; concurrent callers receive
  // the SAME Promise and await this exact execution. The mutex's internal
  // try/finally clears the in-flight reference in BOTH success AND error
  // paths so a failed refill does not permanently lock subsequent callers.
  return _refillMutex.run(async () => {
    const settings = settingsService.getSync();
    // Daily generation cap — gate only applies AFTER the vine is finished.
    //
    // Phase 33 gap fix (2026-04-19): the cap was previously unconditional at this
    // point, which caused a "vine unfinished but No more posts" regression — the
    // cap counted totalGenerated (feed supply) while VineProgress counts
    // exploredAnchors (user progress). The two counters drifted apart whenever
    // the user swiped through posts without opening them, so the cap could fire
    // while buildConceptBatch still had unexplored anchors to generate for.
    //
    // Fix (Option B): bypass the cap until allExplored. Once the vine is finished,
    // the bonus-post regime takes over (see `allExplored` gate in generateMorePosts
    // below) and the cap becomes a meaningful safety rail again.
    //
    // Trellis is local-first OSS where users provide their own LLM/YouTube/Tavily
    // keys, so unbounded generation during the pre-finished window is NOT a cost
    // concern for the project. If a commercial / key-brokered mode ships later,
    // revisit this gate and reintroduce a pre-finished cap (e.g., scale with
    // `unexploredAnchors.length` so the cap shrinks as the user reads).
    //
    // Previous context: D-38 + G1 / UAT-31-13 (Phase 32.1-02) added the `max(N, 3)`
    // floor so 1-concept users didn't saturate after one batch. That floor is
    // retained below for when the gate does eventually fire.
    const anchors = questions.filter(q => q.isAnchorNode);
    const exploredIds = new Set(dailyReadService.getExploredAnchors());
    const allExplored = anchors.length > 0 && anchors.every(a => exploredIds.has(a.id));
    const maxPosts = (settings.feed?.dailyGenerationCapMultiplier ?? FEED_DEFAULTS.dailyGenerationCapMultiplier) * Math.max(anchors.length, 3);
    if (allExplored && postQueueService.getTotalGenerated() >= maxPosts) return;

    // Step 1: Build concept batch + append-only persist + cyclic walk
    // (Phase 36 GAP-1 + GAP-2). buildConceptBatch still filters explored anchors
    // (Phase 33 gap fix line ~798 — DO NOT remove that filter; it gates fresh
    // appends). The derived list is now PERSISTED in QueueState and grows
    // append-only across refill cycles within the same day; the walker resumes
    // from saved cyclePosition rather than restarting from index 0 each time.
    //
    // Removal-on-read is LAZY: walkDerivedList skips conceptIds in `exploredIds`
    // (already computed at line ~1199) AND in `dismissedIds` (Phase 39 D-07 —
    // engagementService.getDismissedAnchorIds()). Physical splice would corrupt
    // the walker's index — see RESEARCH § Pitfall 1.
    const dueConceptIds = buildConceptBatch(questions);
    postQueueService.appendToDerivedList(dueConceptIds);
    // Walk batchSize entries — large enough to refill the queue past REFILL_THRESHOLD
    // (24, bumped from 16 for masonry on 2026-05-10) up toward MAX_QUEUE_SIZE (32).
    // 24 keeps the walker batch proportional to the new threshold so a single refill
    // restores ~one swipe of headroom (8) on top of the 24-post threshold.
    const dismissedIds = new Set(engagementService.getDismissedAnchorIds());
    const conceptIds = postQueueService.walkDerivedList(24, exploredIds, dismissedIds);
    if (conceptIds.length === 0) return;

    // Step 2: Pre-check API keys — validate non-empty strings (D-20, D-21 step 1).
    // Phase 33 quota-burn fix (2026-04-20): also honor the runtime availability
    // circuit breaker. If a 403/quotaExceeded response flipped the flag earlier
    // today, keep that key "unavailable" for the rest of the day so assignStyles
    // redirects weight to text-art instead of burning more calls on a dead quota.
    const youtubeKeyPresent = typeof settings.youtube?.apiKey === 'string' && settings.youtube.apiKey.trim().length > 0;
    const tavilyKeyPresent = typeof settings.webSearch?.tavilyApiKey === 'string' && settings.webSearch.tavilyApiKey.trim().length > 0;
    // Phase 33 UAT-4 fix (2026-04-20): honor EITHER image-gen key. imageGeneration.bootstrap.ts
    // registers the Gemini provider when only geminiApiKey is set (no nanoBanana key), so
    // image generation IS possible — but assignStyles would skip the 'image' style weight
    // because this check was nanoBanana-only. Result: no image posts despite a working key.
    const nanoBananaKeyPresent = typeof settings.imageGeneration?.nanoBananaApiKey === 'string' && settings.imageGeneration.nanoBananaApiKey.trim().length > 0;
    const geminiImageKeyPresent = typeof settings.imageGeneration?.geminiApiKey === 'string' && settings.imageGeneration.geminiApiKey.trim().length > 0;
    // 2026-04-21: honor the `enabled` toggle in hasImageGenKey so assignStyles
    // and InfoFlow's per-card gate agree. Prior mismatch: assignStyles checked
    // only key presence (so it kept assigning 'image' even when the toggle was
    // off), while InfoFlow.tsx:113 short-circuited on !enabled before calling
    // generateImage — resulting in silent text-art fallback at line 159 with
    // zero observable "I assigned image but nothing rendered" signal.
    const imageGenEnabled = settings.imageGeneration?.enabled !== false;
    const availability: ApiAvailability = {
      hasYoutubeKey: youtubeKeyPresent && isYoutubeRuntimeAvailable(),
      hasTavilyKey: tavilyKeyPresent && isTavilyRuntimeAvailable(),
      hasImageGenKey: imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent),
    };

    // Step 3: Assign styles before generation (D-18)
    let assignments = assignStyles(conceptIds, availability);

    // Step 4: Pre-validate YouTube/Tavily in parallel AND cache results for reuse
    // by the generation loops (D-21 step 2, D-20 fallback + Phase 33 quota-burn fix 2026-04-20).
    //
    // Before: pre-validation called searchVideos/webSearch with maxResults=1; the
    // generation loops RE-called the same query with maxResults=15 — 2× the YouTube
    // quota burn per assignment (200 units each at 100 units/search). After my
    // cap-bypass fix (003b8e32) removed the implicit ~2-cycle cap, this doubled
    // burn exhausted the user's 10,000-unit/day YouTube quota in ~10 cycles.
    //
    // Now: pre-validation fetches at full pool size (YOUTUBE_FETCH_POOL_SIZE for
    // YouTube, maxResults:3 for Tavily so the news loop can map the filtered
    // top 2-3 results into newsMeta.sources) and stores the result in preFetched.
    // Generation loops read from the cache.
    // Halves YouTube calls per cycle; also halves Tavily calls.
    const videoAssigns = assignments.filter(a => a.style === 'video');
    const newsAssigns = assignments.filter(a => a.style === 'news');
    const failedIds = new Set<string>();
    const preFetched: PreFetchCache = {
      youtube: new Map<string, YouTubeSearchResult[]>(),
      news: new Map<string, WebSearchResult[]>(),
    };

    const getConceptName = (id: string) => {
      const q = questions.find(q => q.id === id);
      return q?.title ?? q?.content?.slice(0, 50) ?? id;
    };

    // Pre-validation must use the SAME modifier as the actual fetch so a passing
    // pre-check doesn't get falsified by the fetch's varied query.
    const validationCycle = postQueueService.getCycleNumber();
    await Promise.all([
      ...videoAssigns.map(async (a) => {
        try {
          const conceptName = getConceptName(a.conceptId);
          const query = buildYoutubeQuery(conceptName, validationCycle);
          const searchResult = await youtubeService.searchVideos(query, YOUTUBE_FETCH_POOL_SIZE);
          if (!searchResult.success || !searchResult.data?.length) {
            // Phase 33 quota-burn fix (2026-04-20): on quota-exhausted, flip the
            // circuit breaker so subsequent cycles skip YouTube entirely.
            if (searchResult.error?.code === 'API_QUOTA_EXCEEDED') {
              markYoutubeQuotaExhausted();
            }
            failedIds.add(a.conceptId);
          } else {
            preFetched.youtube.set(`${a.conceptId}:${a.style}`, searchResult.data);
          }
        } catch {
          failedIds.add(a.conceptId);
        }
      }),
      ...newsAssigns.map(async (a) => {
        try {
          const conceptName = getConceptName(a.conceptId);
          // Phase 41 D-02 + Pattern 2 — getUsedDomains → exclude → filterForDiversity → recordServedDomain
          const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);
          const results = await webSearch(
            conceptName + ' latest research findings',
            { maxResults: 3, excludeDomains: [...usedDomains] },
          );
          if (!results.success || !results.data?.results.length) {
            // Tavily doesn't distinguish a dedicated quota code today, but if the
            // error message indicates 403/auth failure, treat as quota-exhausted
            // for the rest of the day to stop burning calls on a dead key.
            const msg = results.error?.message?.toLowerCase() ?? '';
            if (msg.includes('403') || msg.includes('quota') || msg.includes('unauthorized')) {
              markTavilyQuotaExhausted();
            }
            failedIds.add(a.conceptId);
          } else {
            const topSources = selectNewsTopSources(results.data.results, usedDomains);
            const chosen = topSources[0];
            if (!chosen) {
              failedIds.add(a.conceptId);
              return;
            }
            preFetched.news.set(a.conceptId, topSources);
            // Phase 41 D-02 — record AFTER commit. extractDomain undefined-guard.
            const domain = extractDomain(chosen.url);
            if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);
          }
        } catch {
          failedIds.add(a.conceptId);
        }
      }),
    ]);

    // Step 5: Reassign failures to text-art (D-20, D-21 step 3)
    assignments = reassignFailures(assignments, failedIds);

    // Step 6: Generate posts with pre-assigned styles (D-21 step 4).
    // Pass the pre-fetched cache so YouTube/Tavily loops reuse validated results
    // instead of issuing a second call per assignment.
    const posts = await generatePostBatch(questions, assignments, preFetched);

    // Step 6b: Pre-generate images for image-styled posts so the queue buffer
    // is ACTUALLY pre-warmed (2026-04-21 architectural fix). Any post whose
    // image generation FAILS gets its presentationStyle downgraded to 'text-art'
    // BEFORE enqueue — so the queue only contains "ready" posts. InfoFlow
    // never has to retry at mount time, no late-arriving images popping in,
    // no duplicate-log racing. The queue promise is: "if it's in the queue,
    // it's renderable right now."
    const imagePosts = posts.filter((p) => p.presentationStyle === 'image');
    if (imagePosts.length > 0) {
      const { imageGenerationService } = await import('./imageGeneration.service');
      const { inferImageStyle, buildImagePrompt } = await import('./postFormatting.service');
      if (import.meta.env?.DEV) {
        console.info(`[refillQueue] pre-generating ${imagePosts.length} image(s) before enqueue`);
      }
      const results = await Promise.allSettled(
        imagePosts.map((p) => {
          const style = inferImageStyle(p);
          const prompt = buildImagePrompt(p);
          return imageGenerationService.generateImage(p.id, prompt, style);
        }),
      );
      // Downgrade any post whose image-gen failed so the queue never serves
      // a post that would immediately fall back to text-art at render time.
      // Mutation is safe here — these DailyPost objects haven't been enqueued
      // or cached yet, so we're the only owner.
      let downgraded = 0;
      for (let i = 0; i < imagePosts.length; i++) {
        const r = results[i];
        const ok = r.status === 'fulfilled' && r.value.success;
        if (!ok) {
          imagePosts[i].presentationStyle = 'text-art';
          downgraded++;
        }
      }
      if (import.meta.env?.DEV && downgraded > 0) {
        console.info(`[refillQueue] downgraded ${downgraded}/${imagePosts.length} image post(s) to text-art after pre-gen failure`);
      }
    }

    // Step 6c + 7: Interleave styles ACROSS the unserved queue tail + this
    // fresh batch (2026-04-21). Previously spreadByStyle ran on `posts` only,
    // then enqueue concatenated — so cross-batch clustering was possible: a
    // user popping 4 posts could slice entirely across one batch's tail or
    // another batch's head, landing in a single-style run. enqueueInterleaved
    // does dedup + combines queue-tail-with-new-batch + runs the mixer over
    // the full combined list before writing back, so every refill re-mixes
    // the pending queue with the new arrivals.
    for (const p of posts) { try { postHistoryService.addPost(p); } catch { /* non-critical */ } }
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      const batchStyles: Record<string, number> = {};
      for (const p of posts) {
        const k = p.presentationStyle ?? 'unknown';
        batchStyles[k] = (batchStyles[k] ?? 0) + 1;
      }
      console.info('[refillQueue] batch styles:', batchStyles, 'batch size:', posts.length);
    }
    // Phase 36 GAP-4 — run concept-axis spread BEFORE style-axis spread so
    // dominant anchors (important / overdue with 2× entries) don't cluster
    // in the served window. See spreadByConcept JSDoc + RESEARCH § Pattern 3.
    postQueueService.enqueueInterleaved(posts, (combined) => {
      spreadByConcept(combined);
      spreadByStyle(combined);
    });
    postQueueService.incrementCycle();
  });
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
      // Phase 43 gap-closure 43-14 — dismiss filter at read boundary. Applied
      // BEFORE the decay heuristic so the organic-post count used by
      // filterDecayedStarters reflects what the user actually sees.
      const visible = applyDismissedFilter(feedPosts);
      // G4 / D-12: drop starter posts once the cache contains 3+ organic posts; also
      // write the trimmed cache back so they don't reappear on the next call.
      const decayed = filterDecayedStarters(visible);
      if (decayed.length < visible.length) {
        saveCache({ ...cached, posts: cached.posts.filter((p) => !STARTER_POST_IDS.has(p.id)) });
      }
      _backgroundGenerateTextArt(decayed);
      refillQueue(questions).catch(console.error);
      return decayed;
    }

    // Fingerprint mismatch but same day: update fingerprint, return cached
    const hasPostsForToday = cached?.date === date && cached.posts.length > 0;
    if (hasPostsForToday && cached.fingerprint !== fingerprint) {
      // G4 / D-12: also strip starters from the persisted cache when decay condition met.
      const trimmedPosts = filterDecayedStarters(cached.posts) === cached.posts
        ? cached.posts
        : cached.posts.filter((p) => !STARTER_POST_IDS.has(p.id));
      saveCache({ ...cached, fingerprint, posts: trimmedPosts });
      const feedPosts = trimmedPosts.filter((p) => p.sourceType !== 'connection');
      // Phase 43 gap-closure 43-14 — dismiss filter at read boundary
      // (symmetric with cache-hit branch above; covers the case where the
      // question set changed but the cached payload for today still holds
      // dismissed-anchor posts from before the dismiss).
      const visible = applyDismissedFilter(feedPosts);
      _backgroundGenerateTextArt(visible);
      refillQueue(questions).catch(console.error);
      return visible;
    }

    // No cache for today — drain queue if it has posts (D-10).
    postQueueService.loadQueue();
    const queuedPosts = postQueueService.dequeue(postQueueService.size());

    if (queuedPosts.length > 0) {
      for (const p of queuedPosts) { try { postHistoryService.addPost(p); } catch { /* non-critical */ } }
      saveCache({ date, fingerprint, posts: queuedPosts, connectionCards: [] });
      _backgroundGenerateTextArt(queuedPosts);
      refillQueue(questions).catch(console.error);
      return queuedPosts;
    }

    // Queue and cache both empty — trigger refill in background (D-11, D-30).
    // HomeScreen warm-start initializer shows yesterday's queue or history while
    // today's queue fills via refillQueue.
    refillQueue(questions).catch(console.error);

    // D-43 + G4 (STARTER-PERSIST per Phase 32.1-04 D-11): first-ever load with no
    // questions — return starter tutorial posts AND persist them to the daily cache so
    // subsequent /home visits hit the cache-hit branch above (line 995) instead of
    // falling through here again. Without persistence, any state mutation (e.g., asking
    // a question via the Welcome CTA) takes questions.length > 0 and the empty-state
    // branch never fires again, making starters vanish on the next /home revisit
    // (operator-confirmed regression — see 32.1-01-SUMMARY.md retest evidence).
    if (questions.length === 0) {
      saveCache({ date, fingerprint: 'starter', posts: STARTER_POSTS, connectionCards: [] });
      return STARTER_POSTS;
    }
    return [];
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
      const videoRaw = localStorage.getItem('trellis_video_cache');
      if (videoRaw) {
        const videoCache = JSON.parse(videoRaw) as { posts?: DailyPost[] };
        const videoPost = videoCache.posts?.find((p: DailyPost) => p.id === id);
        if (videoPost) return videoPost;
      }
    } catch { /* ignore */ }
    // Check news cache
    try {
      const newsRaw = localStorage.getItem('trellis_news_posts');
      if (newsRaw) {
        const newsCache = JSON.parse(newsRaw) as { posts?: DailyPost[] };
        const newsPost = newsCache.posts?.find((p: DailyPost) => p.id === id);
        if (newsPost) return newsPost;
      }
    } catch { /* ignore */ }
    // 2026-05-12 — final fallback to postHistoryService, the only persistent
    // store of full post content. Without this, the daily-cache stale-rejection
    // at midnight (Phase 36-11) makes EVERY past post unreachable from
    // PostHistory + /saved + /liked click-throughs, even though their bodies
    // are still in trellis_post_history. Generated posts are costly assets
    // (LLM tokens, image gen, Tavily, YouTube quota) — they must stay openable.
    try {
      const fromHistory = postHistoryService.getPosts().find((p) => p.id === id);
      if (fromHistory) return fromHistory;
    } catch { /* ignore */ }
    // (Phase 38 / TECHDEBT-06) — trellis_short_posts cache read deleted. The short
    // post type was removed entirely; reading stale data into the live posts array
    // would type-error against the new union. Stale localStorage data is harmless
    // once the read site is gone (Bucket C cleanup deferred per CONTEXT.md).
    return null;
  },

  getCachedDailyPosts(): DailyPost[] {
    const allPosts = (loadCache()?.posts ?? []).filter((p) => p.sourceType !== 'connection');
    // Phase 43 gap-closure 43-14 — dismiss filter at read boundary. Applied
    // BEFORE filterDecayedStarters so the decay heuristic's organic-post count
    // reflects what the user actually sees (dismissed posts are not "in play"
    // for the starter-decay decision).
    const visible = applyDismissedFilter(allPosts);
    // G4 / D-12: HomeScreen warm-start initializer also drops starters when 3+ organic exist.
    const feedPosts = filterDecayedStarters(visible);
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
    let cached = loadCache();
    if (!cached) {
      cached = { date: today(), fingerprint: '', posts: [], connectionCards: [] };
    }
    const existingIds = new Set(cached.posts.map(p => p.id));
    const fresh = posts.filter(p => !existingIds.has(p.id));
    if (fresh.length === 0) return;
    cached.posts.push(...fresh);
    saveCache(cached);
  },

  /** Explicitly clear the post cache (e.g. after "Clear All Data"). */
  clearCache(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    try { sessionStorage.removeItem(CONNECTION_POSTS_KEY); } catch { /* ignore */ }
  },

  /**
   * Serve posts from the queue. Triggers background refill when needed (D-11).
   * Phase 31: drains from postQueueService instead of generating inline.
   */
  async generateMorePosts(questions: Question[], count = 8): Promise<DailyPost[]> {
    // Exclude off-topic/flagged questions
    questions = questions.filter((q) => !q.flagged);

    // D-39: bonus cap — if all concepts explored, enforce bonus post limit
    const exploredAnchors = dailyReadService.getExploredAnchors();
    const anchors = questions.filter(q => q.isAnchorNode);
    const allExplored = anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id));
    if (allExplored) {
      const settings = settingsService.getSync();
      const bonusCap = settings.feed?.bonusPostCap ?? FEED_DEFAULTS.bonusPostCap;
      if (postQueueService.getTotalServed() >= postQueueService.getTotalGenerated() + bonusCap) return [];
    }

    // Drain from queue
    let posts = postQueueService.dequeue(count);

    // If queue was empty, await refill then try again (BLOCKER 3 fix)
    if (posts.length === 0 && postQueueService.needsRefill()) {
      await refillQueue(questions);
      posts = postQueueService.dequeue(count);
    }

    // Persist to history (D-33)
    for (const p of posts) { try { postHistoryService.addPost(p); } catch { /* non-critical */ } }

    // Trigger background refill if queue is running low (D-11)
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
      let newPosts = parseGeneratedPosts(raw, allQuestions, date, [], 6).posts
        .filter(p => !existingIds.has(p.id));
      newPosts = newPosts.slice(0, 6);

      // Provenance enrichment for session posts (mirror of generatePostBatch's daily
      // path at lines 751-762). The LLM frequently omits or mangles sourceQuestionIds
      // here because the session-post prompt provides session Q&As as conversational
      // context rather than as a strict ID-list it must echo. Without this, session
      // posts ship with empty sourceQuestionTitles → no concept badges → operator-
      // reported "some text-art posts have badges, some don't" inconsistency
      // (2026-04-19, Bug 10). Attribute round-robin to the session's anchors so
      // every session post has badges matching the daily-path contract.
      const sessionAnchors: Array<{ id: string; title: string }> = [];
      for (const [, group] of conceptGroups) {
        if (group.anchor) {
          const title = group.anchor.title?.trim() || group.anchor.content.slice(0, 40).trim();
          if (title) sessionAnchors.push({ id: group.anchor.id, title });
        }
      }
      for (let i = 0; i < newPosts.length; i++) {
        const post = newPosts[i];
        if (post.sourceQuestionIds.length > 0) continue; // LLM provided valid IDs — keep them
        if (sessionAnchors.length === 0) continue; // No anchors to attribute to (all session Qs were orphan)
        const anchor = sessionAnchors[i % sessionAnchors.length];
        post.sourceQuestionIds = [anchor.id];
        post.sourceQuestionTitles = [anchor.title];
      }

      // Assign presentation styles via pre-style assignment and generate text-art
      const settings2 = settingsService.getSync();
      const availability: ApiAvailability = {
        hasYoutubeKey: !!(settings2.youtube?.apiKey),
        hasTavilyKey: !!(settings2.webSearch?.tavilyApiKey),
        // Phase 33 UAT-4 fix: either image-gen key counts (nanoBanana OR gemini).
        hasImageGenKey: settings2.imageGeneration?.enabled !== false
          && (!!(settings2.imageGeneration?.nanoBananaApiKey) || !!(settings2.imageGeneration?.geminiApiKey)),
      };
      const sessionAssignments = assignStyles(
        newPosts.map(p => p.sourceQuestionIds[0] ?? p.id),
        availability,
      );
      // Bug B (2026-04-19): assignStyles can return any of image|text-art|suggestion|news|video,
      // but generateSessionPosts only emits LLM TEXT content — there's no YouTube/Tavily fetch here,
      // so a 'video'/'news' assignment leaves the post with no videoMeta/newsMeta and the
      // render layer can't draw anything. Restrict to text-style only; daily refillQueue handles
      // video/news for the same anchor on its next cycle.
      // (Phase 38 / TECHDEBT-06): 'short' was removed from the style union — no longer in this list.
      const TEXT_ONLY_STYLES = new Set<PresentationStyle>(['text-art', 'image', 'suggestion']);
      const styled = newPosts.map((post, i) => {
        const candidate = sessionAssignments[i]?.style;
        const style: PresentationStyle = candidate && TEXT_ONLY_STYLES.has(candidate) ? candidate : 'text-art';
        return { ...post, presentationStyle: style };
      });
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
    // Phase 41 SC-7 — trailing options bag (back-compat: positional callers unaffected).
    options?: { signal?: AbortSignal },
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
      { serviceName: 'posts', signal: options?.signal },
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
  async *generateDiscoverPost(
    concept: string,
    title: string,
    // Phase 41 SC-7 — trailing options bag (back-compat: positional callers unaffected).
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<string> {
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
      { serviceName: 'posts', signal: options?.signal },
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
