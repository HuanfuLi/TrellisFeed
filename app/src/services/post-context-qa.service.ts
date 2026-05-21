import { chatStream } from '../providers/llm';
import type { PostOriginContext } from '../types';
import { settingsService } from './settings.service';
import { resolveGenerationConfig } from './generation-config';

function buildContextPrompt(context: PostOriginContext, userQuestion: string): string {
  const sourceBlock = context.sourceQuestions.length > 0
    ? context.sourceQuestions
      .map((question) => [
        `id: ${question.id}`,
        `title: ${question.title}`,
        `question: ${question.content}`,
        `summary: ${question.summary}`,
      ].join('\n'))
      .join('\n\n')
    : 'No source questions were attached to this post.';

  return [
    'You are continuing from a learning post, not starting from scratch.',
    'The user has already read the post and now wants a contextual follow-up.',
    '',
    'Post shown to user:',
    `- Title: ${context.post.title}`,
    `- Hook: ${context.post.teaser.hook}`,
    `- Why it matters: ${context.post.whyCare}`,
    `- Narrative mode: ${context.post.narrativeMode}`,
    `- Body: ${context.post.bodyMarkdown}`,
    `- Takeaway: ${context.post.takeaway}`,
    '',
    'Source knowledge used for the post:',
    sourceBlock,
    '',
    `User follow-up: ${userQuestion}`,
    '',
    'Answer in a way that:',
    '- continues naturally from the post',
    '- deepens or clarifies instead of repeating the whole essay',
    '- uses examples when they help',
    '- stays grounded in the supplied context',
  ].join('\n');
}

export const postContextQaService = {
  async *askStreaming(context: PostOriginContext, userQuestion: string): AsyncGenerator<string> {
    const settings = settingsService.getSync();
    if (!settings.preferences.aiConsentGiven) {
      throw new Error('AI features are disabled. Enable AI Data Transmission in Settings to ask about posts.');
    }
    // Phase 55.1 GAP-E — post-context Q&A is an on-open one-shot generator, so route it
    // through the optional low-latency model (thinking disabled) when configured. Gate
    // readiness on whichever config will actually be used (the resolver falls back to the
    // main llm when the fast model is unset/disabled/unconfigured).
    const { config, disableThinking } = resolveGenerationConfig(settings);
    if (!config.isConfigured) {
      throw new Error('Add your API key in Settings to ask AI follow-up questions.');
    }

    yield* chatStream(
      [
        {
          role: 'system',
          content: 'You are a contextual learning companion. Continue from the post the user just read.',
        },
        {
          role: 'user',
          content: buildContextPrompt(context, userQuestion),
        },
      ],
      config,
      { serviceName: 'ask', disableThinking },
    );
  },
};
