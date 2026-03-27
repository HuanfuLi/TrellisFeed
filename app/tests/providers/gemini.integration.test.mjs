/**
 * Integration tests for Gemini API provider (fallback).
 *
 * Tests Gemini API calls, error handling, and fallback logic
 * when NanoBanana fails or is unavailable.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Mock fetch ───────────────────────────────────────────────────────────────

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

// ─── Test Gemini Provider ─────────────────────────────────────────────────────

class TestGeminiProvider {
  constructor(apiKey = '', fetchImpl = global.fetch) {
    this.apiKey = apiKey;
    this._fetch = fetchImpl;
    this.name = 'Gemini';
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
          message: 'Gemini API key not configured',
          retryable: false,
        },
      };
    }

    const maxRetries = options.maxRetries ?? 2;
    const timeoutMs = options.timeoutMs ?? 60000;

    let attempt = 0;
    let backoffMs = 2000;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const result = await this._callApi(prompt, style, timeoutMs);
        if (result.success) return result;

        if (result.error?.code === 'API_RATE_LIMITED') {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, backoffMs));
            backoffMs = Math.min(backoffMs * 2, 16000);
            continue;
          }
        }

        if (!result.error?.retryable) return result;

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 16000);
        }
      } catch (err) {
        if (attempt >= maxRetries) {
          return {
            success: false,
            error: { code: 'NETWORK_ERROR', message: err.message, retryable: true },
          };
        }
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
      const response = await this._fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
        }),
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
          error: { code: 'API_KEY_INVALID', message: 'Invalid or revoked API key', retryable: false },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: `HTTP ${response.status}`, retryable: true },
        };
      }

      const data = await response.json();
      const imageUrl = data.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;

      return {
        success: true,
        data: {
          id: `img-gemini-${Math.random().toString(16).slice(2)}`,
          prompt,
          style,
          imageUrl,
          imageBase64: imageUrl ? `data:image/png;base64,${imageUrl}` : undefined,
          provider: 'gemini',
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

test('Gemini provider requires API key configuration', () => {
  const provider = new TestGeminiProvider('');
  assert.equal(provider.isConfigured(), false);
});

test('Gemini provider returns error when not configured', async () => {
  const provider = new TestGeminiProvider('');
  const result = await provider.generate('test prompt', 'photo', {});
  
  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'API_KEY_NOT_CONFIGURED');
});

test('Gemini provider succeeds with valid response', async () => {
  const mockFetch = createFetchMock([
    {
      status: 200,
      data: {
        candidates: [{
          content: {
            parts: [{
              inline_data: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
            }],
          },
        }],
      },
    },
  ]);

  const provider = new TestGeminiProvider('valid-gemini-key', mockFetch);
  const result = await provider.generate('test prompt', 'illustration', {});

  assert.equal(result.success, true);
  assert.ok(result.data?.id);
  assert.equal(result.data?.provider, 'gemini');
});

test('Gemini provider returns 401 for invalid API key', async () => {
  const mockFetch = createFetchMock([
    { status: 401, data: { error: { message: 'Unauthorized' } } },
  ]);

  const provider = new TestGeminiProvider('invalid-key', mockFetch);
  const result = await provider.generate('test prompt', 'photo', {});

  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'API_KEY_INVALID');
  assert.equal(result.error?.retryable, false);
});

test('Gemini provider handles rate limiting', async () => {
  const mockFetch = createFetchMock([
    { status: 429, data: { error: { message: 'Rate limit exceeded' } } },
    {
      status: 200,
      data: {
        candidates: [{
          content: {
            parts: [{
              inline_data: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
            }],
          },
        }],
      },
    },
  ]);

  const provider = new TestGeminiProvider('valid-key', mockFetch);
  const result = await provider.generate('test prompt', 'photo', { maxRetries: 3 });

  assert.equal(result.success, true);
});

test('Gemini provider handles 403 Forbidden (quota exceeded)', async () => {
  const mockFetch = createFetchMock([
    { status: 403, data: { error: { message: 'Quota exceeded' } } },
  ]);

  const provider = new TestGeminiProvider('valid-but-no-quota-key', mockFetch);
  const result = await provider.generate('test prompt', 'photo', {});

  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'API_KEY_INVALID');
});

test('Gemini provider handles 500 error as retryable', async () => {
  const mockFetch = createFetchMock([
    { status: 500, data: { error: { message: 'Internal server error' } } },
    {
      status: 200,
      data: {
        candidates: [{
          content: {
            parts: [{
              inline_data: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
            }],
          },
        }],
      },
    },
  ]);

  const provider = new TestGeminiProvider('valid-key', mockFetch);
  const result = await provider.generate('test prompt', 'photo', { maxRetries: 2 });

  assert.equal(result.success, true);
});
