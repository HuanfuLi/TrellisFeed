import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { DailyPost, FlashCard, Question, ServiceResult, VideoMetadata } from '../types';
import { today } from '../lib/date.ts';
import { settingsService } from './settings.service.ts';
import { chatCompletion } from '../providers/llm/index.ts';
import { flashcardService } from './flashcard.service.ts';
import { questionService } from './question.service.ts';
import { buildYoutubeSearchUrl } from './youtube-locale-url.ts';

// ─── Local Types ──────────────────────────────────────────────────────────────

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
}

interface VideoCacheEntry {
  date: string;
  posts: DailyPost[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_CACHE_KEY = 'trellis_video_cache';

// Quota cost: 100 units per search call (YouTube Data API v3).
// Keep this in mind when calling searchVideos in batch.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readVideoCache(): VideoCacheEntry | null {
  try {
    const raw = localStorage.getItem(VIDEO_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VideoCacheEntry;
  } catch {
    return null;
  }
}

function writeVideoCache(posts: DailyPost[]): void {
  try {
    const entry: VideoCacheEntry = { date: today(), posts };
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage may be full; silently ignore
  }
}


function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Race a promise against a timeout. Returns fallback on timeout (no rejection). */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function titleForQuestion(question: Question): string {
  return question.title ?? question.content.slice(0, 60);
}

function deriveDueConcepts(): Array<{ id: string; title: string }> {
  const allQuestions = questionService.getAll({ includeFlagged: true });
  const byId = new Map(allQuestions.map((question) => [question.id, question]));
  const concepts: Array<{ id: string; title: string }> = [];
  const seenIds = new Set<string>();

  // Align with the actual review queue first: due flashcards map back to real knowledge nodes.
  const dueCards = flashcardService.getDue();
  for (const card of dueCards) {
    const questionId = card.nodeId ?? inferQuestionIdFromFlashcard(card);
    if (!questionId || seenIds.has(questionId)) continue;
    const question = byId.get(questionId);
    if (!question || question.flagged || question.isAnchorNode || question.isClusterNode) continue;
    concepts.push({ id: question.id, title: titleForQuestion(question) });
    seenIds.add(question.id);
  }

  // Also include real due questions not currently represented in the due-card queue.
  const dueQuestions = allQuestions.filter((question) =>
    !question.flagged &&
    !question.isAnchorNode &&
    !question.isClusterNode &&
    question.reviewSchedule?.nextReviewDate <= today(),
  );
  for (const question of dueQuestions) {
    if (seenIds.has(question.id)) continue;
    concepts.push({ id: question.id, title: titleForQuestion(question) });
    seenIds.add(question.id);
  }

  return concepts;
}

function inferQuestionIdFromFlashcard(card: FlashCard): string | null {
  if (card.nodeId) return card.nodeId;
  if (card.id.startsWith('node-')) return card.id.slice('node-'.length);
  return null;
}

// (Phase 38 / TECHDEBT-06) — the portrait-probe helper was deleted; YouTube content is
// uniformly 'video'. Image-probe-based portrait detection was unreliable (thumbnail aspect
// ratio uncorrelated with video orientation) AND the original videos.list?part=
// contentDetails alternative was rejected as too quota-expensive. Removing the
// classifier eliminates the "landscape video listed as short" bug class
// structurally — there is no classifier to be wrong. See 38-CONTEXT.md D-02.

// ─── Service ──────────────────────────────────────────────────────────────────

export const youtubeService = {
  /**
   * Search YouTube Data API v3 for videos matching the given query.
   * Requires a YouTube API key configured in Settings > YouTube.
   *
   * Quota cost: 100 units per call.
   */
  async searchVideos(query: string, maxResults = 5): Promise<ServiceResult<YouTubeSearchResult[]>> {
    const apiKey = settingsService.getSync().youtube?.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'YouTube API key not configured in Settings',
          retryable: false,
        },
      };
    }

    // D-14: URL now includes locale-aware hl / regionCode / relevanceLanguage
    // params via the shared buildYoutubeSearchUrl helper.
    const url = buildYoutubeSearchUrl({ query, maxResults, apiKey });

    try {
      const response = await withTimeout(fetch(url), 10_000, null as unknown as Response);
      if (!response) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: 'YouTube API request timed out', retryable: true },
        };
      }

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 403 && errText.includes('quotaExceeded')) {
          return {
            success: false,
            error: {
              code: 'API_QUOTA_EXCEEDED',
              message: 'YouTube API daily quota exceeded. Try again tomorrow.',
              retryable: false,
            },
          };
        }
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: `YouTube API error ${response.status}: ${errText.slice(0, 200)}`,
            retryable: response.status >= 500,
          },
        };
      }

      const data = await response.json() as {
        items: Array<{
          id: { videoId: string };
          snippet: {
            title: string;
            description: string;
            channelTitle: string;
            thumbnails: { high?: { url: string }; default?: { url: string } };
          };
        }>;
      };

      // Defense-in-depth: even with &type=video in the URL, the YouTube API has been
      // observed (rarely) to return items with non-video id shapes (channelId/playlistId)
      // when the type filter is bypassed by upstream caching. Items without a truthy
      // videoId would propagate as posts with `videoMeta.videoId: undefined`, rendering
      // as empty 320px-tall cards (Bug C, 2026-04-19).
      const results: YouTubeSearchResult[] = (data.items ?? [])
        .filter((item): item is typeof item & { id: { videoId: string } } =>
          typeof item.id?.videoId === 'string' && item.id.videoId.length > 0,
        )
        .map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl:
            item.snippet.thumbnails.high?.url ??
            item.snippet.thumbnails.default?.url ??
            '',
          channelTitle: item.snippet.channelTitle,
        }));

      return { success: true, data: results };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: e instanceof Error ? e.message : 'Network error fetching YouTube results',
          retryable: true,
        },
      };
    }
  },

  /**
   * Fetch transcript text for a YouTube video via Innertube/CapacitorHttp.
   * Returns null if transcripts are unavailable or extraction fails.
   */
  async fetchTranscript(videoId: string): Promise<string | null> {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let html: string | null = null;

      if (Capacitor.isNativePlatform()) {
        const res = await withTimeout(
          CapacitorHttp.get({ url: videoUrl, headers: { 'Accept-Language': 'en' } }),
          15_000,
          null,
        );
        html = res && typeof res.data === 'string' ? res.data : null;
      } else {
        // In browser, CORS will block this; catch and return null
        try {
          const res = await withTimeout(
            fetch(videoUrl, { headers: { 'Accept-Language': 'en' } }),
            10_000,
            null as unknown as Response,
          );
          html = res ? await res.text() : null;
        } catch {
          return null;
        }
      }

      if (!html) return null;

      // Extract captionTracks array from the page source
      const captionMatch = /"captionTracks":\s*(\[.*?\])/.exec(html);
      if (!captionMatch) return null;

      let captionTracks: Array<{
        baseUrl: string;
        name: { simpleText: string };
        languageCode: string;
        kind?: string;
      }>;
      try {
        captionTracks = JSON.parse(captionMatch[1]) as typeof captionTracks;
      } catch {
        return null;
      }

      if (!captionTracks.length) return null;

      // Prefer manual English track, then auto-generated, then first available
      const englishTracks = captionTracks.filter((t) =>
        t.languageCode?.startsWith('en'),
      );
      const manualTrack = englishTracks.find((t) => t.kind !== 'asr');
      const autoTrack = englishTracks.find((t) => t.kind === 'asr');
      const selectedTrack = manualTrack ?? autoTrack ?? captionTracks[0];

      if (!selectedTrack?.baseUrl) return null;

      // Fetch caption XML
      let captionXml: string | null = null;
      if (Capacitor.isNativePlatform()) {
        const captionRes = await withTimeout(
          CapacitorHttp.get({ url: selectedTrack.baseUrl, headers: { 'Accept-Language': 'en' } }),
          10_000,
          null,
        );
        captionXml = captionRes && typeof captionRes.data === 'string' ? captionRes.data : null;
      } else {
        try {
          const captionRes = await fetch(selectedTrack.baseUrl);
          captionXml = await captionRes.text();
        } catch {
          return null;
        }
      }

      if (!captionXml) return null;

      // Parse XML: strip tags, decode entities, collapse whitespace
      const text = captionXml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return decodeHtmlEntities(text) || null;
    } catch {
      return null;
    }
  },

  /**
   * Summarize a video transcript using the configured LLM.
   * Falls back to a title-only summary if transcript is empty.
   *
   * Token tracking: serviceName 'video-summary'
   */
  async summarizeTranscript(
    transcript: string | null,
    videoTitle: string,
    videoDescription?: string,
  ): Promise<ServiceResult<string>> {
    const llmConfig = settingsService.getSync().llm;

    if (!llmConfig.isConfigured) {
      return {
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'LLM not configured. Please add an API key in Settings.',
          retryable: false,
        },
      };
    }

    try {
      const systemPrompt =
        'You are an educational content summarizer. Given a YouTube video transcript, produce a clear, concise summary (200-400 words) that captures the key educational concepts, examples, and takeaways. Use markdown formatting.';

      let userMessage: string;
      if (transcript && transcript.length > 20) {
        const truncated = transcript.slice(0, 4000);
        userMessage = `Video title: "${videoTitle}"\n\nTranscript:\n${truncated}`;
      } else {
        // Fallback: summarize from title + description only (no transcript available)
        const descriptionText = videoDescription
          ? `\n\nVideo description: "${videoDescription.slice(0, 500)}"`
          : '';
        userMessage =
          `Video title: "${videoTitle}"${descriptionText}\n\n` +
          `Note: No transcript was available for this video. Please write an educational summary based on the title and description only. ` +
          `Mark the summary as description-based at the end.`;
      }

      const summary = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        llmConfig,
        { serviceName: 'video-summary' },
      );

      return { success: true, data: summary };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 'LLM_ERROR',
          message: e instanceof Error ? e.message : 'Failed to summarize transcript',
          retryable: true,
        },
      };
    }
  },

  /**
   * Generate video-based DailyPost objects from YouTube videos related to
   * today's SM-2 due review concepts. Results are cached in localStorage.
   *
   * @param count Number of video posts to generate (default 3)
   */
  async generateVideoPosts(count = 3): Promise<DailyPost[]> {
    // Check cache first — return today's cached posts if available
    const cached = youtubeService.getCachedVideoPosts();
    if (cached.length > 0) {
      return cached;
    }

    const posts = await youtubeService._fetchNewVideoPosts(count, new Set<string>());
    writeVideoCache(posts);
    return posts;
  },

  /**
   * Generate additional video posts, skipping already-cached videoIds.
   * Appends new posts to the existing cache.
   *
   * @param count Number of additional video posts to fetch (default 4)
   */
  async generateMoreVideoPosts(count = 4): Promise<DailyPost[]> {
    const existing = youtubeService.getCachedVideoPosts();
    const seenIds = new Set(
      existing
        .filter((p) => p.videoMeta?.videoId)
        .map((p) => p.videoMeta!.videoId),
    );

    const newPosts = await youtubeService._fetchNewVideoPosts(count, seenIds);
    writeVideoCache([...existing, ...newPosts]);
    return newPosts;
  },

  /**
   * Read cached video posts for today from localStorage.
   * Returns empty array if cache is stale, missing, or corrupted.
   * This is the ONLY method consumers should use to read the video cache.
   */
  getCachedVideoPosts(): DailyPost[] {
    const entry = readVideoCache();
    if (!entry || entry.date !== today()) return [];
    return entry.posts ?? [];
  },

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /**
   * Core video discovery pipeline: get due concepts → search → fetch transcript
   * → summarize → build DailyPost. Skips videoIds in seenIds set.
   */
  async _fetchNewVideoPosts(count: number, seenIds: Set<string>): Promise<DailyPost[]> {
    // 1. Get real due learning concepts from the persisted review/question graph.
    // Prefer due flashcards (matches Review screen), then fill with due questions.
    const concepts = deriveDueConcepts();

    if (concepts.length === 0) {
      return [];
    }

    // 2. Build search queries by grouping concepts (2-3 per query) to conserve quota
    const numQueries = Math.ceil(count / 2);
    const queries: { query: string; sourceIds: string[]; sourceTitles: string[] }[] = [];

    for (let i = 0; i < numQueries && i * 2 < concepts.length; i++) {
      const group = concepts.slice(i * 2, i * 2 + 3);
      queries.push({
        query: group.map((c) => c.title).join(' '),
        sourceIds: group.map((c) => c.id),
        sourceTitles: group.map((c) => c.title),
      });
    }

    // 3. Search YouTube for each query
    const resultsPerQuery = Math.ceil(count / numQueries);
    const searchResults: Array<{ result: YouTubeSearchResult; sourceIds: string[]; sourceTitles: string[] }> = [];

    for (const queryGroup of queries) {
      const searchResult = await youtubeService.searchVideos(queryGroup.query, resultsPerQuery);
      if (searchResult.success && searchResult.data) {
        for (const video of searchResult.data) {
          if (!seenIds.has(video.videoId)) {
            searchResults.push({
              result: video,
              sourceIds: queryGroup.sourceIds,
              sourceTitles: queryGroup.sourceTitles,
            });
            seenIds.add(video.videoId);
          }
        }
      }
    }

    // Deduplicate and limit to count
    const toProcess = searchResults.slice(0, count);

    // 4. Build DailyPost for each video
    const posts: DailyPost[] = [];

    for (const { result, sourceIds, sourceTitles } of toProcess) {
      // Add small delay between transcript fetches to avoid rate limiting
      if (posts.length > 0) {
        await sleep(1500);
      }

      const transcript = await youtubeService.fetchTranscript(result.videoId);

      const bodyMarkdown = ''; // Deferred to on-enter streaming (POST-05)

      // Phase 38 (TECHDEBT-06): all YouTube content is sourceType / presentationStyle
      // 'video' — short post type was removed entirely. See 38-CONTEXT.md D-02.

      const videoMeta: VideoMetadata = {
        videoId: result.videoId,
        channelTitle: result.channelTitle,
        thumbnailUrl: result.thumbnailUrl,
        transcript: transcript ?? undefined,
        summary: undefined,
      };

      const keywords = sourceTitles.length > 0
        ? sourceTitles.slice(0, 8)
        : result.title
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
            .filter(Boolean)
            .slice(0, 8);

      const post: DailyPost = {
        id: `video-${result.videoId}`,
        date: today(),
        title: result.title,
        teaser: {
          hook: result.title,
          preview: result.description.slice(0, 120),
        },
        bodyMarkdown,
        whyCare: '',
        takeaway: '',
        quickAskPrompts: [],
        narrativeMode: 'mechanism-breakdown',
        contextLabel: 'Video from YouTube',
        sourceType: 'video',
        sourceQuestionIds: sourceIds,
        sourceQuestionTitles: sourceTitles,
        keywords,
        generatedAt: Date.now(),
        origin: 'ai',
        presentationStyle: 'video',
        videoMeta,
      };

      posts.push(post);
    }

    return posts;
  },
};
