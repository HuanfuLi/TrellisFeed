import { chatStream, chatCompletion } from '../providers/llm/index.ts';
import type { DailyPost, Question } from '../types';
import { settingsService } from './settings.service.ts';

/**
 * On-enter essay generation service.
 * Dispatches by sourceType to generate bodyMarkdown (streaming) and
 * whyCare/takeaway/quickAskPrompts (non-streaming) when a user opens a post.
 */

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
export async function* generatePostEssay(post: DailyPost, questions: Question[]): AsyncGenerator<string> {
  if (post.sourceType === 'video') {
    yield* generateVideoEssay(post);
  } else if (post.sourceType === 'news') {
    yield* generateNewsEssay(post);
  } else if (post.presentationStyle === 'text-art') {
    yield* generateTextArtEssay(post, questions);
  } else {
    yield* generateStandardEssay(post, questions);
  }
}

/**
 * Generate whyCare, takeaway, quickAskPrompts in a single fast non-streaming call.
 * Called after bodyMarkdown streaming completes.
 */
export async function generateEssayMeta(post: DailyPost, bodyMarkdown: string): Promise<Omit<EssayContent, 'bodyMarkdown'>> {
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
      { serviceName: 'posts' },
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

async function* generateStandardEssay(post: DailyPost, questions: Question[]): AsyncGenerator<string> {
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
    { serviceName: 'posts' },
  );
}

async function* generateVideoEssay(post: DailyPost): AsyncGenerator<string> {
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
    { serviceName: 'video-summary' },
  );
}

async function* generateNewsEssay(post: DailyPost): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const sources = post.newsMeta?.sources ?? [];
  const sourceText = sources.map(s => `[${s.index}] ${s.title}: ${s.url}`).join('\n');

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
    { serviceName: 'news' },
  );
}

async function* generateTextArtEssay(post: DailyPost, questions: Question[]): AsyncGenerator<string> {
  const settings = settingsService.getSync();
  const sourceQs = questions.filter(q => post.sourceQuestionIds.includes(q.id));
  const contextBlock = sourceQs.length > 0
    ? sourceQs.map(q => `Q: ${q.title || q.content.slice(0, 80)}\nA: ${(q.summary || q.answer).slice(0, 300)}`).join('\n\n')
    : `Topic: ${post.title}`;

  yield* chatStream(
    [
      {
        role: 'system',
        content: 'You are a vivid, creative educational writer. Write a story-focused or conversation-focused essay (200-350 words) in markdown. Make it more vivid and narrative than a typical explainer — use storytelling, dialogue, or imaginative scenarios to make the concept memorable. Output the essay text only.',
      },
      {
        role: 'user',
        content: `Write a vivid essay about "${post.title}" with the teaser: "${post.teaser.hook}"\n\nLearner context:\n${contextBlock}`,
      },
    ],
    settings.llm,
    { serviceName: 'posts' },
  );
}

/**
 * Patch a post's essay content into the correct localStorage cache after generation.
 * Handles AI posts (echolearn_daily_posts), video (echolearn_video_cache),
 * news (echolearn_news_posts), shorts (echolearn_short_posts).
 */
export function patchPostEssayInCache(postId: string, essay: EssayContent): void {
  // Patch main post cache
  try {
    const raw = localStorage.getItem('echolearn_daily_posts');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.posts)) {
        const idx = cached.posts.findIndex((p: DailyPost) => p.id === postId);
        if (idx >= 0) {
          cached.posts[idx] = { ...cached.posts[idx], ...essay };
          localStorage.setItem('echolearn_daily_posts', JSON.stringify(cached));
          return;
        }
      }
    }
  } catch { /* ignore */ }

  // Patch video cache
  try {
    const raw = localStorage.getItem('echolearn_video_cache');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.posts)) {
        const idx = cached.posts.findIndex((p: DailyPost) => p.id === postId);
        if (idx >= 0) {
          cached.posts[idx] = { ...cached.posts[idx], ...essay };
          localStorage.setItem('echolearn_video_cache', JSON.stringify(cached));
          return;
        }
      }
    }
  } catch { /* ignore */ }

  // Patch news cache
  try {
    const raw = localStorage.getItem('echolearn_news_posts');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.posts)) {
        const idx = cached.posts.findIndex((p: DailyPost) => p.id === postId);
        if (idx >= 0) {
          cached.posts[idx] = { ...cached.posts[idx], ...essay };
          localStorage.setItem('echolearn_news_posts', JSON.stringify(cached));
          return;
        }
      }
    }
  } catch { /* ignore */ }

  // Patch shorts cache
  try {
    const raw = localStorage.getItem('echolearn_short_posts');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.posts)) {
        const idx = cached.posts.findIndex((p: DailyPost) => p.id === postId);
        if (idx >= 0) {
          cached.posts[idx] = { ...cached.posts[idx], ...essay };
          localStorage.setItem('echolearn_short_posts', JSON.stringify(cached));
          return;
        }
      }
    }
  } catch { /* ignore */ }
}
