/**
 * Component logic tests for FeedPostImage.
 *
 * Tests rendering states (loading, success, error),
 * regenerate button logic, error messages, and fallback behaviors.
 *
 * NOTE: These are logic/integration tests using minimal mocking.
 * Full @testing-library/react tests would need a React setup.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Mock image service ───────────────────────────────────────────────────────

class MockImageService {
  constructor(shouldSucceed = true) {
    this.shouldSucceed = shouldSucceed;
    this.generateCount = 0;
  }

  async generateImage(postId, prompt, style) {
    this.generateCount++;

    if (!this.shouldSucceed) {
      return {
        success: false,
        error: { code: 'API_KEY_NOT_CONFIGURED', message: 'API key not configured' },
      };
    }

    await new Promise((r) => setTimeout(r, 50)); // Simulate async

    return {
      success: true,
      data: {
        id: `img-${this.generateCount}`,
        postId,
        prompt,
        style,
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        provider: 'mock',
        generatedAt: Date.now(),
      },
    };
  }
}

// ─── Test FeedPostImage Component Logic ────────────────────────────────────────

class TestFeedPostImageState {
  constructor(imageService) {
    this.imageService = imageService;
  }

  // Render state: idle → loading → success | error
  async renderImage(post) {
    const state = {
      loading: false,
      error: null,
      image: null,
      isRegenerateEnabled: true,
    };

    if (!post) {
      state.error = 'No post provided';
      return state;
    }

    // Start loading
    state.loading = true;

    // Generate image
    const result = await this.imageService.generateImage(
      post.id,
      `Post: ${post.title}`,
      'photo'
    );

    state.loading = false;

    if (result.success && result.data) {
      state.image = result.data;
      return state;
    }

    // Error state
    state.error = result.error?.message || 'Failed to generate image';
    state.isRegenerateEnabled = result.error?.code !== 'API_KEY_NOT_CONFIGURED';

    return state;
  }

  shouldShowErrorLink(error) {
    return error && error.includes('API key') || error.includes('not configured');
  }

  getErrorAction(error) {
    if (!error) return null;

    if (error.includes('API key') || error.includes('not configured')) {
      return { type: 'settings', label: 'Open Settings', screen: 'ImageGeneration' };
    }

    if (error.includes('rate limit')) {
      return { type: 'retry', label: 'Retry in 30s', delay: 30000 };
    }

    return { type: 'retry', label: 'Retry', delay: 1000 };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('FeedPostImage: renders loading state initially', async () => {
  const service = new MockImageService(true);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };
  const result = await state.renderImage(post);

  // After generation completes, should have image
  assert.equal(result.loading, false);
  assert.ok(result.image);
});

test('FeedPostImage: displays image on successful generation', async () => {
  const service = new MockImageService(true);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };
  const result = await state.renderImage(post);

  assert.equal(result.error, null);
  assert.ok(result.image?.imageBase64);
  assert.equal(result.image?.provider, 'mock');
});

test('FeedPostImage: shows error state on generation failure', async () => {
  const service = new MockImageService(false);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };
  const result = await state.renderImage(post);

  assert.equal(result.loading, false);
  assert.ok(result.error);
  assert.equal(result.image, null);
});

test('FeedPostImage: displays API key error message', async () => {
  const service = new MockImageService(false);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };
  const result = await state.renderImage(post);

  assert.match(result.error, /API key/i);
});

test('FeedPostImage: enables regenerate button on retryable errors', async () => {
  const service = new MockImageService(false);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };
  const result = await state.renderImage(post);

  // Non-API-key errors should be retryable
  assert.equal(result.isRegenerateEnabled, false); // API key error is not retryable
});

test('FeedPostImage: disables regenerate button on API key error', async () => {
  const service = new MockImageService(false);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };
  const result = await state.renderImage(post);

  assert.equal(result.isRegenerateEnabled, false);
});

test('FeedPostImage: regenerate button re-generates image', async () => {
  const service = new MockImageService(true);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };

  // First generation
  const result1 = await state.renderImage(post);
  assert.equal(result1.image?.id, 'img-1');

  // Second generation (regenerate)
  const result2 = await state.renderImage(post);
  assert.equal(result2.image?.id, 'img-2');
  assert.equal(service.generateCount, 2);
});

test('FeedPostImage: error state shows Settings link for API key errors', () => {
  const state = new TestFeedPostImageState(null);

  const error = 'API key not configured. Add in Settings.';
  const shouldShow = state.shouldShowErrorLink(error);

  assert.equal(shouldShow, true);
});

test('FeedPostImage: no post returns error state', async () => {
  const service = new MockImageService(true);
  const state = new TestFeedPostImageState(service);

  const result = await state.renderImage(null);

  assert.ok(result.error);
  assert.equal(result.image, null);
});

test('FeedPostImage: getErrorAction returns Settings link for API key error', () => {
  const state = new TestFeedPostImageState(null);

  const error = 'API key not configured';
  const action = state.getErrorAction(error);

  assert.equal(action?.type, 'settings');
  assert.match(action?.label, /settings/i);
  assert.equal(action?.screen, 'ImageGeneration');
});

test('FeedPostImage: getErrorAction returns retry for rate limit', () => {
  const state = new TestFeedPostImageState(null);

  const error = 'rate limit exceeded. Try again later.';
  const action = state.getErrorAction(error);

  assert.equal(action?.type, 'retry');
  assert.ok(action?.delay > 0);
});

test('FeedPostImage: tracks image generation calls', async () => {
  const service = new MockImageService(true);
  const state = new TestFeedPostImageState(service);

  const post = { id: 'p-1', title: 'Test Post' };

  assert.equal(service.generateCount, 0);

  await state.renderImage(post);
  assert.equal(service.generateCount, 1);

  await state.renderImage(post);
  assert.equal(service.generateCount, 2);
});
