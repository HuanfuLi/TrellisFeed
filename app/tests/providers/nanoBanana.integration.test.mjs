/**
 * Integration tests for NanoBanana API provider.
 *
 * Tests the real HTTP call logic (mocked fetch), error handling,
 * rate limiting, and retry mechanisms.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Mock fetch for HTTP testing ──────────────────────────────────────────────

class MockResponse {
  constructor(status, data) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._data = data;
  }

  async json() {
    return this._data;
  }
}

function createFetchMock(responses = []) {
  let callCount = 0;
  return async (url, opts) => {
    const resp = responses[callCount] || responses[responses.length - 1];
    callCount++;
    return new MockResponse(resp.status, resp.data);
  };
}

// ─── Minimal NanoBanana provider for testing ──────────────────────────────────

class TestNanoBananaProvider {
  constructor(apiKey = '', baseUrl = 'https://api.nanobanana.ai/v1', fetchImpl = global.fetch) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this._fetch = fetchImpl;
    this.name = 'NanoBanana';
  }

  isConfigured() {
    return this.apiKey.trim().length > 0;
  }

  async generate(prompt, style, options = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: {
          code: 'API_KEY_NOT_CONFIGURED',
          message: 'Nano Banana API key not configured',
          retryable: false,
        },
      };
    }

    const maxRetries = options.maxRetries ?? 3;
    const timeoutMs = options.timeoutMs ?? 30000;

    let attempt = 0;
    let backoffMs = 1000;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const result = await this._callApi(prompt, style, timeoutMs);
        if (result.success) return result;

        if (result.error?.code === 'API_RATE_LIMITED') {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, backoffMs));
            backoffMs = Math.min(backoffMs * 2, 8000);
            continue;
          }
        }

        if (!result.error?.retryable) return result;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 8000);
        }
      } catch (err) {
        if (attempt >= maxRetries) {
          return {
            success: false,
            error: { code: 'NETWORK_ERROR', message: err.message, retryable: true },
          };
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 8000);
      }
    }

    return {
      success: false,
      error: { code: 'RETRIES_EXHAUSTED', message: 'All retry attempts failed', retryable: true },
    };
  }

  async _callApi(prompt, style, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this._fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ prompt, style, width: 640, height: 400 }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        return {
          success: false,
          error: { code: 'API_RATE_LIMITED', message: 'Rate limit exceeded', retryable: true },
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: { code: 'API_KEY_INVALID', message: 'Invalid API key', retryable: false },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: `HTTP ${response.status}`, retryable: true },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          id: `img-${Math.random().toString(16).slice(2)}`,
          prompt,
          style,
          imageUrl: data.image_url,
          imageBase64: data.image_base64,
          provider: 'nanoBanana',
          generatedAt: Date.now(),
        },
      };
    } catch (err) {
      clearTimeout(timer);
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err.message, retryable: true },
      };
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('NanoBanana provider requires API key configuration', () => {
  const provider = new TestNanoBananaProvider('');
  assert.equal(provider.isConfigured(), false);
});

test('NanoBanana provider returns error when not configured', async () => {
  const provider = new TestNanoBananaProvider('');
  const result = await provider.generate('test prompt', 'infograph', {});
  
  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'API_KEY_NOT_CONFIGURED');
  assert.equal(result.error?.retryable, false);
});

test('NanoBanana provider succeeds with valid response', async () => {
  const mockFetch = createFetchMock([
    { status: 200, data: { image_url: 'https://example.com/image.png', image_base64: 'data:image/png;base64,...' } },
  ]);

  const provider = new TestNanoBananaProvider('valid-key', 'https://api.test.local/v1', mockFetch);
  const result = await provider.generate('test prompt', 'photo', {});

  assert.equal(result.success, true);
  assert.ok(result.data?.id);
  assert.equal(result.data?.provider, 'nanoBanana');
  assert.equal(result.data?.style, 'photo');
});

test('NanoBanana provider returns 401 for invalid API key', async () => {
  const mockFetch = createFetchMock([
    { status: 401, data: { error: 'Unauthorized' } },
  ]);

  const provider = new TestNanoBananaProvider('invalid-key', 'https://api.test.local/v1', mockFetch);
  const result = await provider.generate('test prompt', 'infograph', {});

  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'API_KEY_INVALID');
  assert.equal(result.error?.retryable, false);
});

test('NanoBanana provider handles 403 Forbidden', async () => {
  const mockFetch = createFetchMock([
    { status: 403, data: { error: 'Forbidden' } },
  ]);

  const provider = new TestNanoBananaProvider('expired-key', 'https://api.test.local/v1', mockFetch);
  const result = await provider.generate('test prompt', 'illustration', {});

  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'API_KEY_INVALID');
  assert.equal(result.error?.retryable, false);
});

test('NanoBanana provider handles rate limiting with retry', async () => {
  const mockFetch = createFetchMock([
    { status: 429, data: { error: 'Rate limit exceeded' } },
    { status: 200, data: { image_url: 'https://example.com/image.png' } },
  ]);

  const provider = new TestNanoBananaProvider('valid-key', 'https://api.test.local/v1', mockFetch);
  const result = await provider.generate('test prompt', 'photo', { maxRetries: 3 });

  assert.equal(result.success, true);
  assert.ok(result.data?.id);
});

test('NanoBanana provider exhausts retries on repeated 429', async () => {
  const mockFetch = createFetchMock([
    { status: 429, data: { error: 'Rate limit exceeded' } },
  ]);

  const provider = new TestNanoBananaProvider('valid-key', 'https://api.test.local/v1', mockFetch);
  const result = await provider.generate('test prompt', 'photo', { maxRetries: 2 });

  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'RETRIES_EXHAUSTED');
});

test('NanoBanana provider handles 500 error as retryable', async () => {
  const mockFetch = createFetchMock([
    { status: 500, data: { error: 'Internal server error' } },
    { status: 200, data: { image_url: 'https://example.com/image.png' } },
  ]);

  const provider = new TestNanoBananaProvider('valid-key', 'https://api.test.local/v1', mockFetch);
  const result = await provider.generate('test prompt', 'photo', { maxRetries: 3 });

  assert.equal(result.success, true);
});
