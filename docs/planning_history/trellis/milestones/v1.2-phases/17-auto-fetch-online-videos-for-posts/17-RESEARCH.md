# Phase 17: Auto-fetch Online Videos for Posts - Research

**Researched:** 2026-04-01
**Domain:** YouTube API integration, video feed, transcript extraction, iframe embedding
**Confidence:** MEDIUM

## Summary

This phase adds a video post type to the existing feed by searching YouTube for educational videos aligned with the user's SM-2 due concepts, then presenting them as feed cards with thumbnails and detail pages with embedded players + AI-generated transcript summaries. The core technical challenges are: (1) YouTube Data API v3 search quota management (search.list costs 100 units per call out of 10,000 daily), (2) transcript extraction from third-party videos (official Captions API requires OAuth + video ownership, so an Innertube-based scraping approach via CapacitorHttp is needed), and (3) YouTube iframe embedding in Capacitor WebView (known Error 150/153 issues on iOS from missing Referer headers).

The project already has all the infrastructure needed: `DailyPost` type with `sourceType` union, `concept-feed.service.ts` with daily generation + pull-for-more patterns, `CapacitorHttp` for CORS-free HTTP in native, `chatCompletion` with `serviceName` tagging for summarization, and `mockSettingsService` for API key storage. The main work is a new `youtube.service.ts`, extending the type system, and modifying feed/detail screens.

**Primary recommendation:** Build a `youtube.service.ts` that wraps YouTube Data API v3 search + Innertube transcript extraction via CapacitorHttp, integrate video posts into the existing feed pipeline through `concept-feed.service.ts`, and add a video variant to `PostDetailScreen` with an iframe embed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Auto-search YouTube based on concepts due for review today, using the same SM-2 spaced repetition schedule that drives flashcard review. Reuse existing review scheduling logic.
- D-02: Use YouTube Data API v3 (free tier: 10,000 quota units/day) for search queries derived from due concepts.
- D-03: Generate 3 video posts per day on initial load. When user pulls for more, generate 4 additional video posts each time.
- D-04: Video posts mix into the existing feed alongside AI-generated posts (not a separate section).
- D-05: Embed YouTube videos via iframe (`https://www.youtube.com/embed/{videoId}`). Works in Capacitor WebView on native -- no native SDK needed.
- D-06: New post form: appears in feed like a regular post (thumbnail + title), but detail page shows embedded YouTube video player on top + AI-generated summary below.
- D-07: Add new `sourceType: 'video'` to the `PostSnapshot` type.
- D-08: Use YouTube thumbnail as the card image in the feed -- no AI image generation for video posts.
- D-09: Generate summary from video transcript via YouTube captions/transcript API.
- D-10: Use AI (existing chatCompletion) to summarize the transcript into a concise educational summary for the detail page.

### Claude's Discretion
- YouTube API key storage (likely reuse existing settings pattern in mockSettingsService)
- Transcript extraction method (YouTube captions API vs third-party)
- How to handle videos with no available transcript (fallback to title+description summary, or skip)
- Feed interleaving strategy (how video posts are ordered among AI posts)
- VideoPost detail screen layout specifics

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| YouTube Data API v3 | v3 | Video search | Official Google API, CORS-enabled for browser fetch, free 10K units/day |
| @capacitor/core (CapacitorHttp) | ^8.1.0 | CORS-free HTTP for transcript fetching | Already in project, bypasses CORS for Innertube transcript extraction |
| chatCompletion (existing) | -- | Transcript summarization | Existing LLM provider with serviceName tagging |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mockSettingsService (existing) | -- | YouTube API key storage | Store/retrieve API key from localStorage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Innertube transcript extraction | npm `youtube-transcript` | CORS blocked in browser; Innertube via CapacitorHttp works natively |
| YouTube Data API captions.list | Innertube approach | Official captions API requires OAuth + video ownership -- unusable for third-party videos |
| YouTube IFrame Player API (JS SDK) | Plain iframe | Plain iframe is simpler, sufficient for playback, avoids extra SDK bundle |

**Installation:**
No new npm packages needed. YouTube Data API v3 is called via fetch/CapacitorHttp with an API key. Transcript extraction uses CapacitorHttp to call YouTube's internal Innertube API.

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    youtube.service.ts          # YouTube search + transcript + video post generation
  types/
    index.ts                    # Extended PostSnapshot sourceType, VideoMetadata interface
  screens/
    PostDetailScreen.tsx        # Video variant with iframe + summary
  components/
    InfoFlow.tsx                # Video card variant with thumbnail + play overlay
    YouTubeEmbed.tsx            # Iframe embed component with referrerpolicy
```

### Pattern 1: YouTube Service (ServiceResult Pattern)
**What:** A new `youtube.service.ts` following the existing `ServiceResult<T>` pattern.
**When to use:** All YouTube API interactions.
**Example:**
```typescript
// youtube.service.ts
import { CapacitorHttp } from '@capacitor/core';
import { mockSettingsService } from './mock/settings.mock';
import type { ServiceResult } from '../types';

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
}

export const youtubeService = {
  async searchVideos(query: string, maxResults = 3): Promise<ServiceResult<YouTubeSearchResult[]>> {
    const settings = mockSettingsService.getSync();
    const apiKey = settings.youtube?.apiKey;
    if (!apiKey) return { success: false, error: { code: 'NO_API_KEY', message: 'YouTube API key not configured', retryable: false } };

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=27&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;
    // YouTube Data API v3 supports CORS -- use standard fetch
    const res = await fetch(url);
    // ... parse response
  },

  async fetchTranscript(videoId: string): Promise<ServiceResult<string>> {
    // Use CapacitorHttp to bypass CORS for Innertube API
    const pageRes = await CapacitorHttp.get({ url: `https://www.youtube.com/watch?v=${videoId}` });
    // Extract captionTracks from ytInitialPlayerResponse
    // Fetch the timedtext URL
    // Parse XML captions into plain text
  },
};
```

### Pattern 2: Video Post as DailyPost Extension
**What:** Video posts reuse the existing `DailyPost` type with `sourceType: 'video'` and additional optional fields for video metadata.
**When to use:** Keeps video posts compatible with existing feed infrastructure.
**Example:**
```typescript
// types/index.ts additions
export interface VideoMetadata {
  videoId: string;
  channelTitle: string;
  thumbnailUrl: string;    // YouTube thumbnail URL
  transcript?: string;     // Raw transcript text (cached)
  summary?: string;        // AI-generated summary (cached)
  duration?: string;       // Video duration string
}

// Extend PostSnapshot sourceType union
sourceType: 'recent' | 'related' | 'resurfaced' | 'starter' | 'mixed' | 'connection' | 'video';

// Extend DailyPost
export interface DailyPost extends PostSnapshot {
  generatedAt: number;
  origin: 'ai' | 'fallback';
  videoMeta?: VideoMetadata;  // Present when sourceType === 'video'
}
```

### Pattern 3: Feed Interleaving
**What:** Video posts interleaved with AI posts in the feed at regular intervals.
**When to use:** HomeScreen feed composition.
**Recommendation:** Insert video posts after every 2-3 AI posts. On initial load (3 video posts + existing AI posts), distribute evenly. On pull-for-more, generate 4 video posts mixed with AI posts.
```typescript
// In concept-feed.service.ts or a helper
function interleaveVideoPosts(aiPosts: DailyPost[], videoPosts: DailyPost[]): DailyPost[] {
  const result: DailyPost[] = [];
  let vIdx = 0;
  aiPosts.forEach((post, idx) => {
    result.push(post);
    // Insert a video post after every 2nd AI post
    if ((idx + 1) % 2 === 0 && vIdx < videoPosts.length) {
      result.push(videoPosts[vIdx++]);
    }
  });
  // Append remaining video posts
  while (vIdx < videoPosts.length) result.push(videoPosts[vIdx++]);
  return result;
}
```

### Pattern 4: YouTube Iframe Embed with Capacitor Fix
**What:** Dedicated embed component handling the known iOS WebView Referer issue.
**When to use:** PostDetailScreen video variant.
**Example:**
```typescript
// YouTubeEmbed.tsx
export function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin"
        allowFullScreen
      />
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Using official Captions API for third-party videos:** Requires OAuth + video ownership. Will fail for any video the user does not own.
- **Direct browser fetch to youtube.com for transcripts:** CORS blocked. Must use CapacitorHttp on native, which bypasses CORS entirely.
- **Generating AI images for video posts:** D-08 explicitly says use YouTube thumbnail. Skip imageGenerationService for video sourceType.
- **Separate video feed section:** D-04 requires mixing into existing feed, not a separate tab or section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube search | Custom web scraping | YouTube Data API v3 search.list | Stable, documented, CORS-enabled, quota-managed |
| Transcript extraction | Custom page parser | Innertube API pattern (extract captionTracks from ytInitialPlayerResponse) | Well-documented reverse-engineering approach, community-proven |
| Video embedding | Custom video player | YouTube iframe embed | Handles DRM, adaptive bitrate, mobile playback automatically |
| API key storage | Custom key management | Extend existing mockSettingsService/AppSettings | Consistent with project patterns |
| Feed caching | New cache system | Extend existing localStorage cache in concept-feed.service.ts | Video posts should follow same cache lifecycle as AI posts |

**Key insight:** YouTube provides excellent free infrastructure (search, embed, thumbnails). The only gap is transcript access for third-party videos, which the Innertube approach fills reliably.

## Common Pitfalls

### Pitfall 1: YouTube Search Quota Exhaustion
**What goes wrong:** search.list costs 100 units per call. With 10,000 daily units, that is only 100 searches/day. If each concept triggers a separate search, quota burns fast.
**Why it happens:** Naive implementation searches for each due concept individually.
**How to avoid:** Batch concepts into fewer, broader search queries (e.g., combine 2-3 related concepts into one query). Cache search results in localStorage keyed by date + concept fingerprint. Limit to ~10 searches/day max (1,000 units = 10% of daily quota for search, leaving 9,000 for videos.list detail fetches at 1 unit each).
**Warning signs:** 403 quotaExceeded errors from YouTube API.

### Pitfall 2: YouTube iframe Error 150/153 on iOS
**What goes wrong:** YouTube embed fails with "Video unavailable" error in iOS WebView.
**Why it happens:** WKWebView on iOS uses custom protocol (capacitor://localhost) and may not send proper Referer headers. YouTube rejects embeds without valid referrers.
**How to avoid:** Add `referrerPolicy="strict-origin"` to iframe. If still failing, set `server.hostname` in capacitor.config.ts to use `localhost` over `http://` scheme. Worst case: open video in external browser via `Browser.open()` from @capacitor/browser.
**Warning signs:** Video shows "Video unavailable" or error 150/153 only on iOS device, works fine in browser dev mode.

### Pitfall 3: Transcript Not Available
**What goes wrong:** Many YouTube videos have no captions (auto-generated or manual). Innertube extraction returns empty.
**Why it happens:** Video uploader disabled captions, or auto-captions not generated for the language.
**How to avoid:** Always check for transcript availability. Fallback strategy: use video title + description as input to chatCompletion for a shorter summary. Mark the summary as "based on description" so the user knows it is less detailed.
**Warning signs:** Empty transcript response from Innertube, or captionTracks array missing from ytInitialPlayerResponse.

### Pitfall 4: Innertube API Changes Breaking Transcript Extraction
**What goes wrong:** YouTube changes their internal API structure, breaking the regex/JSON extraction.
**Why it happens:** Innertube is undocumented and subject to change without notice.
**How to avoid:** Isolate transcript extraction in a single function with clear error handling. Wrap in try/catch with graceful fallback. Log extraction failures. Consider adding a configurable transcript API URL in settings as an escape hatch (e.g., user could point to a third-party transcript API).
**Warning signs:** Transcript extraction starts returning null for all videos after working previously.

### Pitfall 5: VALID_SOURCE_TYPES Set Not Updated
**What goes wrong:** Video posts fail the `isValidDailyPost` validation check and are silently dropped from the cache.
**Why it happens:** The `VALID_SOURCE_TYPES` Set in concept-feed.service.ts (line 44) must be updated to include `'video'`.
**How to avoid:** Add `'video'` to `VALID_SOURCE_TYPES`. Also update `CONCEPT_BADGE_META` in InfoFlow.tsx (line 22) with a video badge entry.
**Warning signs:** Video posts appear after generation but disappear after page reload (cache validation strips them).

### Pitfall 6: CapacitorHttp vs fetch Mismatch
**What goes wrong:** Transcript fetching works in browser dev mode (where CapacitorHttp falls back to fetch) but fails on device, or vice versa.
**Why it happens:** CapacitorHttp on native bypasses CORS; fetch in browser does not. YouTube.com pages do not have CORS headers.
**How to avoid:** For transcript extraction, always use CapacitorHttp. For YouTube Data API v3 (which has CORS headers), use standard fetch. In browser dev mode, transcript extraction will fail -- provide a graceful fallback (show video without summary, or use title+description summary).
**Warning signs:** Works perfectly in dev browser, transcript always null on device (or opposite).

## Code Examples

### Deriving Search Queries from SM-2 Due Concepts
```typescript
// Reuse review.mock.ts logic to get due items
import { mockReviewService } from './mock/review.mock';
import { mockQuestionService } from './mock/question.mock';

async function getDueConceptQueries(): Promise<string[]> {
  const result = await mockReviewService.getTodayReviewItems();
  if (!result.success || !result.data) return [];

  // Extract concept names from due questions
  // Prefer anchor node titles, then question titles, then keywords
  const concepts = result.data
    .map(q => q.title || q.content.slice(0, 60))
    .slice(0, 6); // Limit to avoid too many API calls

  // Group into 2-3 search queries to conserve quota
  // e.g., ["transformer attention mechanism", "gradient descent optimization"]
  return groupConceptsIntoQueries(concepts);
}
```

### YouTube Data API v3 Search Request
```typescript
// Source: https://developers.google.com/youtube/v3/docs/search/list
const params = new URLSearchParams({
  part: 'snippet',
  type: 'video',
  videoEmbeddable: 'true',
  q: query,
  maxResults: '5',
  relevanceLanguage: 'en',
  safeSearch: 'strict',
  key: apiKey,
});
const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
const data = await res.json();
// Each item: { id: { videoId }, snippet: { title, description, thumbnails, channelTitle } }
// Quota cost: 100 units per call
```

### Innertube Transcript Extraction via CapacitorHttp
```typescript
// Source: Innertube reverse-engineering pattern (community-documented)
async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    // Step 1: Fetch video page to get captions config
    const pageRes = await CapacitorHttp.get({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      headers: { 'Accept-Language': 'en' },
    });

    // Step 2: Extract captionTracks from ytInitialPlayerResponse
    const match = pageRes.data.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) return null; // No captions available

    const tracks = JSON.parse(match[1]);
    // Prefer manual English captions, then auto-generated
    const track = tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr')
      || tracks.find((t: any) => t.languageCode === 'en')
      || tracks[0];
    if (!track?.baseUrl) return null;

    // Step 3: Fetch caption XML
    const captionRes = await CapacitorHttp.get({ url: track.baseUrl });

    // Step 4: Parse XML to plain text
    const text = captionRes.data
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n+/g, ' ')
      .trim();

    return text || null;
  } catch {
    return null;
  }
}
```

### Transcript Summarization via chatCompletion
```typescript
// Uses existing chatCompletion with serviceName tagging
import { chatCompletion } from '../providers/llm/index';

async function summarizeTranscript(transcript: string, videoTitle: string, config: LLMConfig): Promise<string> {
  // Truncate transcript to avoid token limits (keep first ~4000 chars)
  const truncated = transcript.slice(0, 4000);

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: 'You are an educational content summarizer. Given a YouTube video transcript, produce a clear, concise summary (200-400 words) that captures the key educational concepts, examples, and takeaways. Use markdown formatting.',
      },
      {
        role: 'user',
        content: `Video title: "${videoTitle}"\n\nTranscript:\n${truncated}`,
      },
    ],
    config,
    { serviceName: 'video-summary' },
  );

  return result;
}
```

### Video Card in Feed (InfoFlow modification)
```typescript
// New badge entry in CONCEPT_BADGE_META
video: { label: 'Video', color: '#FF0000' },

// Video card renders thumbnail instead of AI image
if (post.sourceType === 'video' && post.videoMeta?.thumbnailUrl) {
  // Render YouTube thumbnail with play button overlay
  return (
    <div style={{ position: 'relative' }}>
      <img src={post.videoMeta.thumbnailUrl} alt={post.title} style={{ width: '100%', borderRadius: 'var(--radius-xl)', aspectRatio: '16/9', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Play button overlay */}
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 0, height: 0, borderLeft: '16px solid white', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', marginLeft: 4 }} />
        </div>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YouTube Data API v2 | YouTube Data API v3 | 2015 | v2 fully deprecated; v3 is the only option |
| Captions API for any video | Captions API requires ownership | Always (v3) | Must use Innertube/scraping for third-party transcripts |
| YouTube JS SDK embed | Plain iframe embed | 2020+ | JS SDK adds complexity with minimal benefit for simple playback |
| Unrestricted iframe embedding | Strict Referer checks | July 2025 | iOS WebView needs referrerPolicy="strict-origin" |

**Deprecated/outdated:**
- YouTube Data API v2: Fully deprecated, do not use
- `youtube-transcript` npm on client-side: CORS blocked in browser, only works in Node.js server context

## Open Questions

1. **Innertube API reliability in Capacitor native context**
   - What we know: CapacitorHttp bypasses CORS, so fetching youtube.com pages works. Community libraries like youtube-transcript-api (Python) use this pattern successfully.
   - What's unclear: Whether YouTube applies different rate limiting or bot detection to CapacitorHttp requests (no Referer/Cookie context).
   - Recommendation: Implement with graceful fallback. If transcript fetch fails, fall back to title+description summarization. Add a 1-2 second delay between transcript fetches to avoid rate limiting.

2. **iOS iframe embed stability**
   - What we know: Error 150/153 is a known issue. `referrerPolicy="strict-origin"` is the primary fix.
   - What's unclear: Whether Capacitor 8's default config handles this or requires additional capacitor.config.ts changes.
   - Recommendation: Test on iOS device early. Have `@capacitor/browser` (external browser open) as emergency fallback.

3. **Quota budget allocation**
   - What we know: 10,000 units/day. search.list = 100 units. videos.list = 1 unit.
   - What's unclear: Exact number of searches needed per day given concept grouping strategy.
   - Recommendation: Budget 2,000 units/day for video search (20 searches). Group 2-3 concepts per query. Cache aggressively by date.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner |
| Config file | none (uses `node --test`) |
| Quick run command | `node --test tests/services/youtube.test.mjs` |
| Full suite command | `node --test tests/**/*.test.mjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Due concepts drive YouTube search queries | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-02 | YouTube Data API v3 search call structure | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-03 | 3 initial + 4 pull-for-more video posts | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-04 | Video posts interleaved in feed | unit | `node --test tests/services/concept-feed.test.mjs` | Partial (existing file) |
| D-07 | sourceType 'video' added and validated | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-09 | Transcript extraction returns text | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |
| D-10 | chatCompletion called with serviceName 'video-summary' | unit | `node --test tests/services/youtube.test.mjs` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/services/youtube.test.mjs`
- **Per wave merge:** `node --test tests/**/*.test.mjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/youtube.test.mjs` -- covers D-01, D-02, D-03, D-07, D-09, D-10
- [ ] Update `tests/services/concept-feed.test.mjs` -- covers D-04 (interleaving)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| YouTube Data API v3 | Video search (D-02) | External service (API key required) | v3 | User must configure API key in Settings |
| CapacitorHttp | Transcript extraction (D-09) | Installed | ^8.1.0 | fetch (browser only, CORS limited) |
| chatCompletion | Summarization (D-10) | Installed | -- | Existing LLM provider must be configured |

**Missing dependencies with no fallback:**
- YouTube Data API key: User must obtain and configure. No way to search YouTube without it.

**Missing dependencies with fallback:**
- Transcript extraction in browser dev mode: CapacitorHttp fallback to fetch will CORS-fail on youtube.com. Fallback: show video without summary, or use title+description for summary in dev mode.

## Sources

### Primary (HIGH confidence)
- YouTube Data API v3 official docs: search.list costs 100 quota units, 10,000 daily free limit
- YouTube Data API v3 Captions docs: captions.list/download require OAuth + video ownership
- Capacitor docs: CapacitorHttp bypasses CORS on native platforms
- Project source code: concept-feed.service.ts, types/index.ts, llm/index.ts patterns

### Secondary (MEDIUM confidence)
- [YouTube iframe WebView issues](https://github.com/ionic-team/capacitor/issues/8205) - Error 150/153, referrerPolicy fix
- [Innertube transcript extraction](https://medium.com/@aqib-2/extract-youtube-transcripts-using-innertube-api-2025-javascript-guide-dc417b762f49) - JavaScript Innertube approach
- [YouTube quota breakdown](https://www.contentstats.io/blog/youtube-api-quota-tracking) - Quota costs per endpoint

### Tertiary (LOW confidence)
- Innertube API stability long-term: undocumented, may change without notice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - YouTube Data API v3 is well-documented, CapacitorHttp already in project
- Architecture: HIGH - Extends existing patterns (DailyPost, sourceType, ServiceResult, feed caching)
- Pitfalls: MEDIUM - iOS iframe issues are documented but fix reliability varies; Innertube stability is uncertain
- Transcript extraction: MEDIUM - Innertube approach is community-proven but undocumented

**Research date:** 2026-04-01
**Valid until:** 2026-04-15 (Innertube API may change; iframe issues may get Capacitor patches)
