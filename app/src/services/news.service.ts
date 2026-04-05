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
import { settingsService } from './settings.service';
import { questionService } from './question.service';
import { today } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import type { DailyPost } from '../types';

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

    // 1. Extract clean concept names from anchor nodes in the knowledge graph.
    //    Anchor nodes have LLM-derived academic concept names (e.g., "Gradient Descent",
    //    "Reinforcement Learning") — much better search terms than raw user questions.
    const allQuestions = questionService.getAll();
    const anchors = allQuestions
      .filter((q) => q.isAnchorNode === true && !q.flagged)
      .sort((a, b) => b.createdAt - a.createdAt);

    const seenConcepts = new Set<string>();
    const concepts: string[] = [];

    // Primary: use anchor node titles (clean concept nouns)
    for (const a of anchors) {
      const term = (a.title || a.content.slice(0, 50)).trim().toLowerCase();
      if (!seenConcepts.has(term)) {
        seenConcepts.add(term);
        concepts.push(a.title || a.content.slice(0, 50));
      }
      if (concepts.length >= 3) break;
    }

    // Fallback: if no anchor nodes yet, use keywords from recent questions
    if (concepts.length === 0) {
      const nonFlagged = allQuestions.filter((q) => !q.flagged && !q.isAnchorNode && !q.isClusterNode);
      for (const q of nonFlagged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)) {
        for (const kw of q.keywords ?? []) {
          const term = kw.trim().toLowerCase();
          if (term.length >= 3 && !seenConcepts.has(term)) {
            seenConcepts.add(term);
            concepts.push(kw.trim());
          }
          if (concepts.length >= 3) break;
        }
        if (concepts.length >= 3) break;
      }
    }

    if (concepts.length === 0) return [];

    // 3. Search for news on each concept (with images)
    interface SearchHit {
      title: string;
      url: string;
      content: string;
      score: number;
      concept: string;
      imageUrl?: string;
    }

    const allHits: SearchHit[] = [];
    const seenUrls = new Set<string>();

    for (const concept of concepts) {
      const result = await webSearch(concept + ' latest research breakthroughs', {
        maxResults: 3,
        includeImages: true,
      });
      if (result.success && result.data) {
        // Tavily returns images as a flat array of URLs for the entire search
        const images = result.data.images ?? [];
        for (let i = 0; i < result.data.results.length; i++) {
          const r = result.data.results[i];
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            allHits.push({ ...r, concept, imageUrl: images[i] });
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

      const post: DailyPost = {
        id: `news-${Date.now()}-${index}`,
        sourceType: 'news',
        presentationStyle: 'news',
        title: hit.title.slice(0, 110),
        teaser: {
          hook: hit.title.slice(0, 110),
          preview: hit.content.slice(0, 150),
        },
        bodyMarkdown: '',  // Deferred to on-enter streaming (POST-06)
        whyCare: '',
        takeaway: '',
        newsMeta: { sources: [{ index: 1, title: hit.title, url: hit.url }], fetchedAt: Date.now(), imageUrl: hit.imageUrl },
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
