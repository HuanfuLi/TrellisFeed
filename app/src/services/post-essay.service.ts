import { chatStream, chatCompletion } from '../providers/llm/index.ts';
import type { DailyPost, Question } from '../types';
import { settingsService } from './settings.service.ts';
import { resolveGenerationConfig } from './generation-config.ts';

// Phase 55.1 GAP-E — re-export so the fast-model resolver is reachable from this module's
// public surface (and source-grep acceptance) while its definition stays React-free.
export { resolveGenerationConfig };

/**
 * On-enter essay generation service.
 * Dispatches by sourceType to generate bodyMarkdown (streaming) and
 * whyCare/takeaway/quickAskPrompts (non-streaming) when a user opens a post.
 */

export interface EssayOptions {
  signal?: AbortSignal;
  /** Phase 41 D-03 — 'standard' (default, 150-250w teaser) or 'deep' (350-600w expansion). */
  depth?: 'standard' | 'deep';
}

export interface EssayContent {
  bodyMarkdown: string;
  /** Phase 41 D-03 — populated when generator was called with depth: 'deep'.
   *  patchPostEssayInCache merges this field-by-field; standard cache stays intact. */
  bodyMarkdownDeep?: string;
  whyCare: string;
  takeaway: string;
  quickAskPrompts: string[];
}

/**
 * Stream the essay body for a post. Yields chunks of bodyMarkdown text.
 * After streaming completes, caller should invoke generateEssayMeta()
 * for whyCare, takeaway, quickAskPrompts.
 */
export async function* generatePostEssay(post: DailyPost, questions: Question[], options?: EssayOptions): AsyncGenerator<string> {
  if (post.sourceType === 'video') {
    yield* generateVideoEssay(post, options);
  } else if (post.sourceType === 'news') {
    yield* generateNewsEssay(post, options);
  } else if (post.presentationStyle === 'text-art') {
    yield* generateTextArtEssay(post, questions, options);
  } else {
    yield* generateStandardEssay(post, questions, options);
  }
}

/**
 * Generate whyCare, takeaway, quickAskPrompts in a single fast non-streaming call.
 * Called after bodyMarkdown streaming completes.
 */
export async function generateEssayMeta(post: DailyPost, bodyMarkdown: string, options?: EssayOptions): Promise<Omit<EssayContent, 'bodyMarkdown'>> {
  const settings = settingsService.getSync();
  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: 'You are a learning content writer. Given a post title and essay, generate metadata. Return JSON only: { "whyCare": "1 sentence why this matters to a learner", "takeaway": "1 sentence key takeaway", "quickAskPrompts": ["question 1", "question 2", "question 3"] }',
        },
        {
          // Phase 41 SC-6 — body slice cap raised 2000 → 4000 to give meta-extraction
          // a fuller signal; deep-variant essays (350-600w) need the larger window.
          role: 'user',
          content: `Title: ${post.title}\nHook: ${post.teaser.hook}\n\nEssay:\n${bodyMarkdown.slice(0, 4000)}`,
        },
      ],
      settings.llm,
      { serviceName: 'posts', signal: options?.signal },
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { whyCare?: string; takeaway?: string; quickAskPrompts?: string[] };
      return {
        whyCare: typeof parsed.whyCare === 'string' ? parsed.whyCare : post.teaser.preview,
        takeaway: typeof parsed.takeaway === 'string' ? parsed.takeaway : post.teaser.hook,
        quickAskPrompts: Array.isArray(parsed.quickAskPrompts)
          ? parsed.quickAskPrompts.filter((s): s is string => typeof s === 'string').slice(0, 3)
          : [],
      };
    }
  } catch {
    // Fall through to defaults
  }
  return {
    whyCare: post.teaser.preview || '',
    takeaway: post.teaser.hook || '',
    quickAskPrompts: [],
  };
}

async function* generateStandardEssay(post: DailyPost, questions: Question[], options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  // Phase 55.1 GAP-E — route the on-open body through the optional low-latency model
  // (thinking disabled) when configured; else fall back to the main model unchanged.
  const { config, disableThinking } = resolveGenerationConfig(settings);
  const sourceQs = questions.filter(q => post.sourceQuestionIds.includes(q.id));
  const contextBlock = sourceQs.length > 0
    ? sourceQs.map(q => `Q: ${q.title || q.content.slice(0, 80)}\nA: ${(q.summary || q.answer).slice(0, 300)}`).join('\n\n')
    : `Topic: ${post.title}`;

  // Phase 41 SC-3 — depth-aware word-count instruction. 'standard' (default) preserves
  // the existing 200-350w teaser band; 'deep' produces the 350-600w expansion variant.
  const depth = options?.depth ?? 'standard';
  const wordCountInstruction = depth === 'deep'
    ? 'Write a substantial, in-depth essay (350-600 words) in markdown.'
    : 'Write a vivid, engaging essay (200-350 words) in markdown.';

  yield* chatStream(
    [
      {
        role: 'system',
        content: `You are a world-class educational writer. ${wordCountInstruction} Use examples, analogies, and surprising insights. Do NOT include any JSON or metadata — output the essay text only.`,
      },
      {
        role: 'user',
        content: `Write an essay titled "${post.title}" with this hook: "${post.teaser.hook}"\n\nContext from the learner's knowledge:\n${contextBlock}`,
      },
    ],
    config,
    { serviceName: 'posts', signal: options?.signal, disableThinking },
  );
}

async function* generateVideoEssay(post: DailyPost, options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const { config, disableThinking } = resolveGenerationConfig(settings);
  const transcript = post.videoMeta?.transcript;
  const videoTitle = post.videoMeta?.channelTitle ? `${post.title} (${post.videoMeta.channelTitle})` : post.title;

  let userContent: string;
  if (transcript && transcript.length > 20) {
    userContent = `Video title: "${videoTitle}"\n\nTranscript:\n${transcript.slice(0, 4000)}`;
  } else {
    const desc = post.teaser.preview ? `\n\nDescription: "${post.teaser.preview}"` : '';
    userContent = `Video title: "${videoTitle}"${desc}\n\nNote: No transcript available. Summarize based on the title and description only. Mark the summary as description-based at the end.`;
  }

  // Phase 41 SC-3 — depth-aware word-count instruction. 'standard' preserves the 200-400w
  // band tuned for transcript-grounded summaries; 'deep' expands to 350-600w.
  const depth = options?.depth ?? 'standard';
  const wordCountInstruction = depth === 'deep'
    ? 'Write a substantial educational summary (350-600 words)'
    : 'Write a focused educational summary (200-400 words)';

  yield* chatStream(
    [
      {
        role: 'system',
        content: `You are an educational content summarizer. Given a YouTube video transcript, ${wordCountInstruction} that captures the key educational concepts, examples, and takeaways. Use markdown formatting. Output the summary text only — no JSON.`,
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
    config,
    { serviceName: 'video-summary', signal: options?.signal, disableThinking },
  );
}

async function* generateNewsEssay(post: DailyPost, options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  // Phase 55.1 GAP-E — fast-model routing. NOTE: this only changes WHICH model streams the
  // news body on open; the news creation branch in concept-feed.service.ts still sets
  // bodyMarkdown:'' (defer-to-streamer). Do NOT eagerly generate the body here.
  const { config, disableThinking } = resolveGenerationConfig(settings);
  const sources = post.newsMeta?.sources ?? [];
  // Phase 41 SC-4 — multi-snippet grounding via sources.slice(0, 3). Plan 41-01 widened
  // Tavily maxResults 1 → 3 and stores up to 3 indexed entries in newsMeta.sources; this
  // generator now consumes the full ≤3-source list (was effectively 1 pre-Phase-41).
  // Include the source snippet (Tavily content blob) in the prompt so the LLM has actual
  // article text to summarize, not just title + URL. Without this the essay was either
  // very short or fabricated, since the LLM had nothing to ground on.
  const sourceText = sources
    .slice(0, 3)
    .map(s => {
      const head = `[${s.index}] ${s.title} — ${s.url}`;
      return s.snippet ? `${head}\n${s.snippet}` : head;
    })
    .join('\n\n');

  // Phase 41 SC-3 — depth-aware word-count instruction. 'standard' preserves the 150-250w
  // teaser; 'deep' expands to 350-600w (richer context, more analysis room).
  const depth = options?.depth ?? 'standard';
  const wordCountInstruction = depth === 'deep'
    ? 'Create a substantial educational news summary (350-600 words)'
    : 'Create a short educational news summary (150-250 words)';

  // Phase 41 D-04 / SC-5(a) — footnote prompt instruction. The LLM emits markdown
  // footnote syntax ([^N] markers + [^N]: section); remark-gfm parses it into
  // <sup>/<section> automatically; Markdown.tsx components prop styles them.
  const systemContent = [
    'You are a learning digest writer.',
    `${wordCountInstruction} from the following web search results.`,
    'Write it as a clear, engaging markdown essay.',
    'Cite each factual claim with [^1], [^2], [^3] markers tied to the source list above.',
    'Emit a footnotes section at the end of the essay using `[^1]: <Source title>` for each cited source.',
    'Output the essay text only — no JSON.',
  ].join(' ');

  yield* chatStream(
    [
      {
        role: 'system',
        content: systemContent,
      },
      {
        role: 'user',
        content: `Headline: ${post.title}\nSources:\n${sourceText}\n\nConcept context: ${post.keywords.join(', ')}`,
      },
    ],
    config,
    { serviceName: 'news', signal: options?.signal, disableThinking },
  );
}

async function* generateTextArtEssay(post: DailyPost, questions: Question[], options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const { config, disableThinking } = resolveGenerationConfig(settings);
  const sourceQs = questions.filter(q => post.sourceQuestionIds.includes(q.id));
  const contextBlock = sourceQs.length > 0
    ? sourceQs.map(q => `Q: ${q.title || q.content.slice(0, 80)}\nA: ${(q.summary || q.answer).slice(0, 300)}`).join('\n\n')
    : `Topic: ${post.title}`;

  // Phase 41 SC-3 — depth-aware word-count instruction. 'standard' preserves the punchy
  // 80-120w social-post band; 'deep' expands to a 350-600w thread treatment.
  const depth = options?.depth ?? 'standard';
  const wordCountInstruction = depth === 'deep'
    ? 'Write an in-depth social media thread (350-600 words) about the concept. Use multiple short paragraphs and clear structural beats.'
    : 'Write a short, punchy post (80-120 words) about the concept. Think Instagram caption or Twitter thread — casual, engaging, informative. Use short paragraphs, line breaks, and 1-2 emojis placed naturally. No long stories or formal essay structure. Get to the point fast and leave the reader with one sharp insight.';

  yield* chatStream(
    [
      {
        role: 'system',
        content: `You are a social media educator. ${wordCountInstruction} Output text only — no JSON.`,
      },
      {
        role: 'user',
        content: `Write a social media post about "${post.title}" with the hook: "${post.teaser.hook}"\n\nConcept context:\n${contextBlock}`,
      },
    ],
    config,
    { serviceName: 'posts', signal: options?.signal, disableThinking },
  );
}

/**
 * Patch a post's essay content into the correct localStorage cache after generation.
 * Checks daily cache, video cache, and news cache.
 * (Phase 38 / TECHDEBT-06): the legacy shorts cache key was removed — short post type
 * was deleted entirely. Stale data in user localStorage is harmless once the read
 * site is gone (Bucket C cleanup deferred per CONTEXT.md).
 *
 * Phase 41 D-03 + RESEARCH Pitfall 9 — selective merge so partial essays don't clobber.
 * When the generator was called with depth: 'deep' it returns bodyMarkdownDeep populated
 * but bodyMarkdown empty; that empty string MUST NOT overwrite the existing standard.
 * Symmetric for the standard path. Empty whyCare / takeaway are also preserved
 * (1-sentence fields — empty means "not regenerated"); quickAskPrompts is an array
 * (empty array is meaningful, replace it).
 */
export function patchPostEssayInCache(postId: string, essay: EssayContent): void {
  // 2026-05-12 — `trellis_post_history` added as a write target so the streamed
  // body persists across the midnight stale-cache rejection (Phase 36-11). The
  // early `return` after first match was also removed: a post can live in BOTH
  // the daily cache and post-history simultaneously, and both need the patch
  // for the body to survive the daily cache rollover. Generated post bodies
  // are costly assets — LLM tokens + image gen + Tavily + YouTube quota — and
  // must remain openable from /post-history + /saved + /liked indefinitely.
  const cacheKeys = ['trellis_daily_posts', 'trellis_video_cache', 'trellis_news_posts', 'trellis_post_history'];
  for (const key of cacheKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const cached = JSON.parse(raw);
      const posts: DailyPost[] = cached?.posts ?? (Array.isArray(cached) ? cached : []);
      const idx = posts.findIndex((p: DailyPost) => p.id === postId);
      if (idx >= 0) {
        const merged: DailyPost = { ...posts[idx] };
        if (essay.bodyMarkdown && essay.bodyMarkdown.trim() !== '') merged.bodyMarkdown = essay.bodyMarkdown;
        if (essay.bodyMarkdownDeep && essay.bodyMarkdownDeep.trim() !== '') merged.bodyMarkdownDeep = essay.bodyMarkdownDeep;
        if (essay.whyCare) merged.whyCare = essay.whyCare;
        if (essay.takeaway) merged.takeaway = essay.takeaway;
        if (essay.quickAskPrompts) merged.quickAskPrompts = essay.quickAskPrompts;
        posts[idx] = merged;
        if (cached?.posts) {
          cached.posts = posts;
          localStorage.setItem(key, JSON.stringify(cached));
        } else {
          localStorage.setItem(key, JSON.stringify(posts));
        }
        // Continue scanning — patch every cache that has this post, not just the first.
      }
    } catch { /* ignore */ }
  }
}
