/**
 * News Service — Daily background web-sourced news generation.
 *
 * Generates 2-3 news posts daily from Tavily search results (topic: 'news')
 * combined with LLM summarization. Posts are cached in localStorage.
 * Fire-and-forget pattern matches youtube.service.ts.
 *
 * serviceName: 'news'
 */

import { webSearch } from './web-search.service';
import { chatCompletion } from '../providers/llm/index';
import { settingsService } from './settings.service';
import { questionService } from './question.service';
import { today } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import type { DailyPost, SourceCitation } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const NEWS_CACHE_KEY = 'echolearn_news_posts';
const MAX_NEWS_PER_DAY = 3;

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CachedNewsPosts {
  date: string;
  posts: DailyPost[];
}

function loadNewsCache(): CachedNewsPosts | null {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedNewsPosts;
  } catch {
    return null;
  }
}

function saveNewsCache(cache: CachedNewsPosts): void {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be full; silently ignore
  }
}

function getCachedNewsPosts(): DailyPost[] {
  const cache = loadNewsCache();
  if (!cache || cache.date !== today()) return [];
  return cache.posts;
}

// ─── Domain extraction ───────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

// ─── Generation ──────────────────────────────────────────────────────────────

async function generateNewsPosts(count?: number): Promise<DailyPost[]> {
  const targetCount = count ?? MAX_NEWS_PER_DAY;

  try {
    const settings = settingsService.getSync();
    if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return [];

    // 1. Get learning concepts from user's questions
    const allQuestions = questionService.getAll();
    const nonFlagged = allQuestions.filter((q) => !q.flagged && !q.isAnchorNode && !q.isClusterNode);
    if (nonFlagged.length === 0) return [];

    // 2. Extract top learning concepts: take the 10 most recent, deduplicate
    const recentQuestions = nonFlagged
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    const seenConcepts = new Set<string>();
    const concepts: string[] = [];
    for (const q of recentQuestions) {
      const term = (q.title || q.content.slice(0, 50)).trim().toLowerCase();
      if (!seenConcepts.has(term)) {
        seenConcepts.add(term);
        concepts.push(q.title || q.content.slice(0, 50));
      }
      if (concepts.length >= 3) break;
    }

    if (concepts.length === 0) return [];

    // 3. Search for news on each concept
    interface SearchHit {
      title: string;
      url: string;
      content: string;
      score: number;
      concept: string;
    }

    const allHits: SearchHit[] = [];
    const seenUrls = new Set<string>();

    for (const concept of concepts) {
      const result = await webSearch(concept + ' latest news developments', {
        topic: 'news',
        maxResults: 3,
      });
      if (result.success && result.data) {
        for (const r of result.data.results) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            allHits.push({ ...r, concept });
          }
        }
      }
    }

    if (allHits.length === 0) return [];

    // Sort by score descending, take top results
    allHits.sort((a, b) => b.score - a.score);
    const topHits = allHits.slice(0, targetCount);

    // 4. Generate news posts via LLM
    const posts: DailyPost[] = [];

    for (let index = 0; index < topHits.length; index++) {
      const hit = topHits[index];

      try {
        const raw = await chatCompletion(
          [
            {
              role: 'system',
              content:
                'You are a learning digest writer. Create a short educational news summary (150-250 words) from the following web search result. Write a catchy headline, a brief preview sentence, and the full summary. Format as JSON: { "headline": "...", "preview": "...", "summary": "...", "whyCare": "...", "takeaway": "..." }. Keep it relevant to the learner\'s concepts.',
            },
            {
              role: 'user',
              content: `Title: ${hit.title}\nContent: ${hit.content}\nURL: ${hit.url}`,
            },
          ],
          settings.llm,
          { serviceName: 'news' },
        );

        // Parse LLM JSON response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]) as {
          headline?: string;
          preview?: string;
          summary?: string;
          whyCare?: string;
          takeaway?: string;
        };

        if (!parsed.headline || !parsed.summary) continue;

        const sources: SourceCitation[] = [
          { index: 1, title: hit.title, url: hit.url },
        ];

        const post: DailyPost = {
          id: `news-${Date.now()}-${index}`,
          sourceType: 'news',
          presentationStyle: 'news',
          title: parsed.headline,
          teaser: {
            hook: parsed.headline,
            preview: parsed.preview || parsed.summary.slice(0, 150),
          },
          bodyMarkdown: parsed.summary,
          whyCare: parsed.whyCare || '',
          takeaway: parsed.takeaway || '',
          newsMeta: { sources, fetchedAt: Date.now() },
          sourceQuestionIds: [],
          sourceQuestionTitles: [],
          keywords: [hit.concept],
          narrativeMode: 'mechanism-breakdown',
          contextLabel: extractDomain(hit.url),
          quickAskPrompts: [],
          generatedAt: Date.now(),
          origin: 'ai',
          date: today(),
        };

        posts.push(post);
      } catch {
        // Skip individual post generation failures
        continue;
      }
    }

    // 5. Cache and emit
    if (posts.length > 0) {
      saveNewsCache({ date: today(), posts });
      eventBus.emit({ type: 'NEWS_POSTS_READY', payload: { posts } });
    }

    return posts;
  } catch (err) {
    console.warn('[news.service] Failed to generate news posts:', err);
    return [];
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const newsService = {
  getCachedNewsPosts,
  generateNewsPosts,
};
