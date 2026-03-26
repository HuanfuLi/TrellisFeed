/**
 * Unit tests for image generation pipeline.
 *
 * Tests are deliberately isolated — they don't import DOM APIs or Vite-bundled
 * modules. The services are tested through simple inline mocks.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock provider that always succeeds.
 */
function makeSuccessProvider(name = 'mock') {
  return {
    name,
    isConfigured: () => true,
    async generate(prompt, style) {
      return {
        success: true,
        data: {
          id: `img-${Math.random().toString(16).slice(2)}`,
          prompt,
          style,
          imageBase64: `data:image/svg+xml;base64,PHN2Zy8+`, // minimal SVG
          provider: 'mock',
          generatedAt: Date.now(),
        },
      };
    },
  };
}

/**
 * Build a mock provider that always fails.
 */
function makeFailProvider(name = 'fail') {
  return {
    name,
    isConfigured: () => true,
    async generate() {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Simulated failure', retryable: true },
      };
    },
  };
}

// ─── PostFormattingService tests ──────────────────────────────────────────────

// Inline the pure functions to avoid Vite import issues in node --test
function generateOverlayText(post) {
  const SOURCE_EMOJIS = {
    recent: '⚡', related: '🔗', resurfaced: '♻️',
    starter: '🌱', mixed: '🎲', connection: '🧩',
  };
  const KEYWORD_EMOJIS = [
    [/\b(ai|artificial intelligence|machine learning|neural|llm)\b/i, '🤖'],
    [/\b(brain|memory|neuroscience|cognitive|psychology)\b/i, '🧠'],
    [/\b(physics|quantum|energy)\b/i, '⚛️'],
    [/\b(book|read|literature)\b/i, '📚'],
  ];
  const searchText = [...(post.keywords ?? []), post.title ?? ''].join(' ');
  let emoji = SOURCE_EMOJIS[post.sourceType] ?? '💡';
  for (const [regex, e] of KEYWORD_EMOJIS) {
    if (regex.test(searchText)) { emoji = e; break; }
  }
  const raw = post.teaser?.hook || post.title || '';
  const title = raw.length > 50 ? raw.slice(0, 47) + '…' : raw;
  return { emoji, title };
}

function inferImageStyle(post, index) {
  const ROTATION = ['infograph', 'illustration', 'photo'];
  if (post.sourceType === 'connection') return 'illustration';
  if (post.sourceType === 'starter') return 'infograph';
  return ROTATION[index % ROTATION.length];
}

function buildImagePrompt(post) {
  const subject = post.title || post.teaser?.hook || '';
  const keywords = (post.keywords ?? []).slice(0, 3).join(', ');
  const context = post.contextLabel ? ` | context: ${post.contextLabel}` : '';
  const raw = `${subject}${context}${keywords ? ` | topics: ${keywords}` : ''}`;
  return raw.length > 120 ? raw.slice(0, 117) + '…' : raw;
}

const makePost = (overrides = {}) => ({
  id: 'post-1',
  title: 'How memory works',
  teaser: { hook: 'Why does the brain forget things?', preview: 'Memory is selective...' },
  keywords: ['memory', 'brain', 'neuroscience'],
  sourceType: 'recent',
  contextLabel: 'Learning',
  narrativeMode: 'example-first',
  ...overrides,
});

// ─── Tests: PostFormattingService ─────────────────────────────────────────────

test('generateOverlayText returns emoji and truncated title', () => {
  const post = makePost();
  const { emoji, title } = generateOverlayText(post);

  assert.equal(typeof emoji, 'string');
  assert.ok(emoji.length > 0, 'emoji should not be empty');
  assert.ok(title.length > 0, 'title should not be empty');
  assert.ok(title.length <= 50, `title too long: ${title.length}`);
});

test('generateOverlayText uses keyword-based emoji for brain/neuroscience post', () => {
  const post = makePost({ keywords: ['memory', 'brain', 'neuroscience'] });
  const { emoji } = generateOverlayText(post);
  assert.equal(emoji, '🧠');
});

test('generateOverlayText truncates long hooks', () => {
  const longHook = 'A'.repeat(60);
  const post = makePost({ teaser: { hook: longHook, preview: '' } });
  const { title } = generateOverlayText(post);
  assert.ok(title.endsWith('…'), 'should end with ellipsis');
  assert.ok(title.length <= 50, 'truncated title should be at most 50 chars');
});

test('inferImageStyle rotates styles across feed indices', () => {
  const post = makePost();
  const style0 = inferImageStyle(post, 0);
  const style1 = inferImageStyle(post, 1);
  const style2 = inferImageStyle(post, 2);
  const style3 = inferImageStyle(post, 3);

  assert.notEqual(style0, style1);
  assert.notEqual(style1, style2);
  assert.equal(style0, style3); // rotation repeats at index 3
});

test('inferImageStyle forces illustration for connection posts', () => {
  const post = makePost({ sourceType: 'connection' });
  assert.equal(inferImageStyle(post, 0), 'illustration');
  assert.equal(inferImageStyle(post, 1), 'illustration');
});

test('inferImageStyle forces infograph for starter posts', () => {
  const post = makePost({ sourceType: 'starter' });
  assert.equal(inferImageStyle(post, 0), 'infograph');
  assert.equal(inferImageStyle(post, 1), 'infograph');
});

test('buildImagePrompt keeps output under 120 chars', () => {
  const longTitle = 'A very long title that goes on and on and on and will definitely exceed the limit if not truncated properly';
  const post = makePost({ title: longTitle, keywords: ['a', 'b', 'c'] });
  const prompt = buildImagePrompt(post);
  assert.ok(prompt.length <= 120, `prompt too long: ${prompt.length} chars`);
});

// ─── Tests: Provider mock interface ───────────────────────────────────────────

test('success provider returns image data', async () => {
  const provider = makeSuccessProvider('test-provider');
  const result = await provider.generate('test prompt', 'infograph', {});
  assert.equal(result.success, true);
  assert.ok(result.data?.id);
  assert.equal(result.data?.style, 'infograph');
  assert.equal(result.data?.prompt, 'test prompt');
});

test('fail provider returns error result', async () => {
  const provider = makeFailProvider();
  const result = await provider.generate('test', 'photo', {});
  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'NETWORK_ERROR');
  assert.equal(result.error?.retryable, true);
});

// ─── Tests: ImageGenerationService fallback logic ─────────────────────────────

// Inline a minimal ImageGenerationService to test the core fallback logic
// without DOM/localStorage dependencies.
class TestImageGenerationService {
  providers = [];

  setProviders(providers) {
    this.providers = providers;
  }

  async generateImage(postId, prompt, style) {
    for (const provider of this.providers) {
      const result = await provider.generate(prompt, style, {});
      if (result.success && result.data) {
        return { success: true, data: { ...result.data, postId } };
      }
    }
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: 'All providers failed', retryable: true },
    };
  }
}

test('generateImage succeeds with first provider', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([makeSuccessProvider('primary'), makeFailProvider('fallback')]);

  const result = await svc.generateImage('post-1', 'test prompt', 'photo');
  assert.equal(result.success, true);
  assert.equal(result.data?.postId, 'post-1');
  assert.equal(result.data?.provider, 'mock');
});

test('generateImage falls back to second provider when first fails', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([makeFailProvider('primary'), makeSuccessProvider('fallback')]);

  const result = await svc.generateImage('post-2', 'test prompt', 'illustration');
  assert.equal(result.success, true);
  assert.equal(result.data?.postId, 'post-2');
});

test('generateImage fails when all providers fail', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([makeFailProvider('primary'), makeFailProvider('fallback')]);

  const result = await svc.generateImage('post-3', 'test prompt', 'infograph');
  assert.equal(result.success, false);
  assert.ok(result.error?.message);
});

test('generateImage with no providers returns error', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([]);

  const result = await svc.generateImage('post-4', 'test prompt', 'photo');
  assert.equal(result.success, false);
});
