import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { DailyPost, ServiceResult, VideoMetadata } from '../types';
import { today } from '../lib/date';
import { mockSettingsService } from './mock/settings.mock';
import { mockReviewService } from './mock/review.mock';
import { chatCompletion } from '../providers/llm/index';

// ─── Local Types ──────────────────────────────────────────────────────────────

interface YouTubeSearchResult {
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

const VIDEO_CACHE_KEY = 'echolearn_video_cache';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

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

// ─── Service ──────────────────────────────────────────────────────────────────

export const youtubeService = {
  /**
   * Search YouTube Data API v3 for videos matching the given query.
   * Requires a YouTube API key configured in Settings > YouTube.
   *
   * Quota cost: 100 units per call.
   */
  async searchVideos(query: string, maxResults = 5): Promise<ServiceResult<YouTubeSearchResult[]>> {
    const apiKey = mockSettingsService.getSync().youtube?.apiKey;
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

    const url =
      `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&videoEmbeddable=true` +
      `&q=${encodeURIComponent(query)}&maxResults=${maxResults}` +
      `&relevanceLanguage=en&safeSearch=strict&key=${apiKey}`;

    try {
      const response = await fetch(url);

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

      const results: YouTubeSearchResult[] = (data.items ?? []).map((item) => ({
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
        const res = await CapacitorHttp.get({
          url: videoUrl,
          headers: { 'Accept-Language': 'en' },
        });
        html = typeof res.data === 'string' ? res.data : null;
      } else {
        // In browser, CORS will block this; catch and return null
        try {
          const res = await fetch(videoUrl, {
            headers: { 'Accept-Language': 'en' },
          });
          html = await res.text();
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
        const captionRes = await CapacitorHttp.get({
          url: selectedTrack.baseUrl,
          headers: { 'Accept-Language': 'en' },
        });
        captionXml = typeof captionRes.data === 'string' ? captionRes.data : null;
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
    const llmConfig = mockSettingsService.getSync().llm;

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
    // 1. Get due review concepts
    const reviewResult = await mockReviewService.getTodayReviewItems();
    const reviewItems = reviewResult.data ?? [];

    // Filter out anchor and cluster nodes, prefer title over content
    const concepts = reviewItems
      .filter((q) => !q.isAnchorNode && !q.isClusterNode)
      .map((q) => ({
        id: q.id,
        title: q.title ?? q.content.slice(0, 60),
      }));

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

      const summaryResult = await youtubeService.summarizeTranscript(
        transcript,
        result.title,
        result.description,
      );
      const bodyMarkdown = summaryResult.success && summaryResult.data
        ? summaryResult.data
        : 'Summary unavailable — please watch the video for details.';

      const videoMeta: VideoMetadata = {
        videoId: result.videoId,
        channelTitle: result.channelTitle,
        thumbnailUrl: result.thumbnailUrl,
        transcript: transcript ?? undefined,
        summary: summaryResult.data,
      };

      const keywords = result.title
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
          hook: result.channelTitle,
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
        videoMeta,
      };

      posts.push(post);
    }

    return posts;
  },
};
