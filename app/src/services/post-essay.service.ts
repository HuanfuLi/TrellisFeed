import { chatStream, chatCompletion } from '../providers/llm/index.ts';
import type { DailyPost, Question } from '../types';
import { settingsService } from './settings.service.ts';

/**
 * On-enter essay generation service.
 * Dispatches by sourceType to generate bodyMarkdown (streaming) and
 * whyCare/takeaway/quickAskPrompts (non-streaming) when a user opens a post.
 */

export interface EssayOptions {
  signal?: AbortSignal;
}

export interface EssayContent {
  bodyMarkdown: string;
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
          role: 'user',
          content: `Title: ${post.title}\nHook: ${post.teaser.hook}\n\nEssay:\n${bodyMarkdown.slice(0, 2000)}`,
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
  const sourceQs = questions.filter(q => post.sourceQuestionIds.includes(q.id));
  const contextBlock = sourceQs.length > 0
    ? sourceQs.map(q => `Q: ${q.title || q.content.slice(0, 80)}\nA: ${(q.summary || q.answer).slice(0, 300)}`).join('\n\n')
    : `Topic: ${post.title}`;

  yield* chatStream(
    [
      {
        role: 'system',
        content: 'You are a world-class educational writer. Write a vivid, engaging essay (200-350 words) in markdown. Use examples, analogies, and surprising insights. Do NOT include any JSON or metadata — output the essay text only.',
      },
      {
        role: 'user',
        content: `Write an essay titled "${post.title}" with this hook: "${post.teaser.hook}"\n\nContext from the learner's knowledge:\n${contextBlock}`,
      },
    ],
    settings.llm,
    { serviceName: 'posts', signal: options?.signal },
  );
}

async function* generateVideoEssay(post: DailyPost, options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const transcript = post.videoMeta?.transcript;
  const videoTitle = post.videoMeta?.channelTitle ? `${post.title} (${post.videoMeta.channelTitle})` : post.title;

  let userContent: string;
  if (transcript && transcript.length > 20) {
    userContent = `Video title: "${videoTitle}"\n\nTranscript:\n${transcript.slice(0, 4000)}`;
  } else {
    const desc = post.teaser.preview ? `\n\nDescription: "${post.teaser.preview}"` : '';
    userContent = `Video title: "${videoTitle}"${desc}\n\nNote: No transcript available. Summarize based on the title and description only. Mark the summary as description-based at the end.`;
  }

  yield* chatStream(
    [
      {
        role: 'system',
        content: 'You are an educational content summarizer. Given a YouTube video transcript, produce a clear, concise summary (200-400 words) that captures the key educational concepts, examples, and takeaways. Use markdown formatting. Output the summary text only — no JSON.',
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
    settings.llm,
    { serviceName: 'video-summary', signal: options?.signal },
  );
}

async function* generateNewsEssay(post: DailyPost, options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const sources = post.newsMeta?.sources ?? [];
  // Include the source snippet (Tavily content blob) in the prompt so the LLM has actual
  // article text to summarize, not just title + URL. Without this the essay was either
  // very short or fabricated, since the LLM had nothing to ground on.
  const sourceText = sources
    .map(s => {
      const head = `[${s.index}] ${s.title} — ${s.url}`;
      return s.snippet ? `${head}\n${s.snippet}` : head;
    })
    .join('\n\n');

  yield* chatStream(
    [
      {
        role: 'system',
        content: 'You are a learning digest writer. Create a short educational news summary (150-250 words) from the following web search results. Write it as a clear, engaging markdown essay. Output the essay text only — no JSON.',
      },
      {
        role: 'user',
        content: `Headline: ${post.title}\nSources:\n${sourceText}\n\nConcept context: ${post.keywords.join(', ')}`,
      },
    ],
    settings.llm,
    { serviceName: 'news', signal: options?.signal },
  );
}

async function* generateTextArtEssay(post: DailyPost, questions: Question[], options?: EssayOptions): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const sourceQs = questions.filter(q => post.sourceQuestionIds.includes(q.id));
  const contextBlock = sourceQs.length > 0
    ? sourceQs.map(q => `Q: ${q.title || q.content.slice(0, 80)}\nA: ${(q.summary || q.answer).slice(0, 300)}`).join('\n\n')
    : `Topic: ${post.title}`;

  yield* chatStream(
    [
      {
        role: 'system',
        content: 'You are a social media educator. Write a short, punchy post (80-120 words) about the concept. Think Instagram caption or Twitter thread — casual, engaging, informative. Use short paragraphs, line breaks, and 1-2 emojis placed naturally. No long stories or formal essay structure. Get to the point fast and leave the reader with one sharp insight. Output text only — no JSON.',
      },
      {
        role: 'user',
        content: `Write a social media post about "${post.title}" with the hook: "${post.teaser.hook}"\n\nConcept context:\n${contextBlock}`,
      },
    ],
    settings.llm,
    { serviceName: 'posts', signal: options?.signal },
  );
}

/**
 * Patch a post's essay content into the correct localStorage cache after generation.
 * Checks daily cache, video cache, news cache, and shorts cache.
 */
export function patchPostEssayInCache(postId: string, essay: EssayContent): void {
  const cacheKeys = ['echolearn_daily_posts', 'echolearn_video_cache', 'echolearn_news_posts', 'echolearn_short_posts'];
  for (const key of cacheKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const cached = JSON.parse(raw);
      const posts: DailyPost[] = cached?.posts ?? (Array.isArray(cached) ? cached : []);
      const idx = posts.findIndex((p: DailyPost) => p.id === postId);
      if (idx >= 0) {
        posts[idx] = { ...posts[idx], ...essay };
        if (cached?.posts) {
          cached.posts = posts;
          localStorage.setItem(key, JSON.stringify(cached));
        } else {
          localStorage.setItem(key, JSON.stringify(posts));
        }
        return;
      }
    } catch { /* ignore */ }
  }
}
