import { chatStream, chatCompletion } from '../providers/llm/index.ts';
import type { DailyPost, Question } from '../types';
import { settingsService } from './settings.service.ts';
import { resolveGenerationConfig } from './generation-config.ts';
import { conceptFeedService } from './concept-feed.service.ts';
import { postHistoryService } from './post-history.service.ts';

// Phase 55.1 GAP-E — re-export so the fast-model resolver is reachable from this module's
// public surface (and source-grep acceptance) while its definition stays React-free.
export { resolveGenerationConfig };

/**
 * On-enter essay generation service.
 * Generates bodyMarkdown (streaming) and whyCare/takeaway/quickAskPrompts
 * (non-streaming) when a user opens a post.
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
  if (post.presentationStyle === 'text-art') {
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
 * Patch a post's generated essay content into the durable stores.
 *
 * Both stores are patched, never just the first match: a post can live in the
 * daily cache AND post-history simultaneously, and post-history is what keeps
 * the body openable from saved and liked views after the daily cache
 * is rejected at midnight (Phase 36-11). Generated bodies are costly assets —
 * LLM tokens and image generation.
 *
 * This used to read-modify-write four localStorage keys directly. The IndexedDB
 * migration retired all four (and the boot sweep deletes them), which silently
 * turned this function into a no-op and made every post body regenerate on open.
 * Route through the owning services so the write reaches IndexedDB.
 *
 * Phase 41 D-03 + RESEARCH Pitfall 9 — selective merge so partial essays don't clobber.
 * When the generator was called with depth: 'deep' it returns bodyMarkdownDeep populated
 * but bodyMarkdown empty; that empty string MUST NOT overwrite the existing standard.
 * Symmetric for the standard path. Empty whyCare / takeaway are also preserved
 * (1-sentence fields — empty means "not regenerated"); quickAskPrompts is an array
 * (empty array is meaningful, replace it).
 */
export function patchPostEssayInCache(postId: string, essay: EssayContent): void {
  const patch: Partial<DailyPost> = {};
  if (essay.bodyMarkdown && essay.bodyMarkdown.trim() !== '') patch.bodyMarkdown = essay.bodyMarkdown;
  if (essay.bodyMarkdownDeep && essay.bodyMarkdownDeep.trim() !== '') patch.bodyMarkdownDeep = essay.bodyMarkdownDeep;
  if (essay.whyCare) patch.whyCare = essay.whyCare;
  if (essay.takeaway) patch.takeaway = essay.takeaway;
  if (essay.quickAskPrompts) patch.quickAskPrompts = essay.quickAskPrompts;
  if (Object.keys(patch).length === 0) return;

  try { conceptFeedService.patchPost(postId, patch); } catch { /* ignore */ }
  try { postHistoryService.patchPost(postId, patch); } catch { /* ignore */ }
}
