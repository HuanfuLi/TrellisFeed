/**
 * NanoBananaProvider
 *
 * Primary image generation provider using Nano Banana API.
 *
 * Requires API key in Settings. If key not configured or API fails,
 * returns a structured error rather than a fallback — callers decide
 * whether to try Gemini or show an error state.
 *
 * Endpoint: https://api.nanobanana.ai/v1/generate
 * Auth: Bearer token in Authorization header.
 * Rate limiting: 429 responses handled gracefully (retryable error).
 */

import type { ServiceResult, GeneratedImage, ImageStyle } from '../types';
import type { IImageProvider, ImageProviderOptions } from './imageProvider.interface';

// ─── Provider ─────────────────────────────────────────────────────────────────

export class NanoBananaProvider implements IImageProvider {
  readonly name = 'NanoBanana';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string = '', baseUrl = 'https://api.nanobanana.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async generate(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: {
          code: 'API_KEY_NOT_CONFIGURED',
          message: 'Nano Banana API key not configured. Add it in Settings → Image Generation.',
          retryable: false,
        },
      };
    }

    // Attempt real API call with retry logic.
    return this._callWithRetry(prompt, style, options);
  }

  // ─── Real API call (placeholder implementation) ────────────────────────────

  private async _callWithRetry(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    let attempt = 0;
    let backoffMs = 1000;

    while (attempt < options.maxRetries) {
      attempt++;
      try {
        const result = await this._callApi(prompt, style, options.timeoutMs);
        if (result.success) return result;

        // Rate limited — wait with backoff.
        if (result.error?.code === 'API_RATE_LIMITED') {
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 8000);
          continue;
        }

        // Non-retryable error.
        if (!result.error?.retryable) return result;

        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 8000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt >= options.maxRetries) {
          return {
            success: false,
            error: { code: 'NETWORK_ERROR', message: msg, retryable: true },
          };
        }
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 8000);
      }
    }

    return {
      success: false,
      error: {
        code: 'RETRIES_EXHAUSTED',
        message: 'Failed to generate image after multiple retries. Check API status.',
        retryable: true,
      },
    };
  }

  private async _callApi(
    prompt: string,
    style: ImageStyle,
    timeoutMs: number,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          style,
          width: 640,
          height: 400,
          output_format: 'url',
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
          error: { code: 'API_KEY_INVALID', message: 'Invalid API key', retryable: false },
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: `HTTP ${response.status}`, retryable: true },
        };
      }

      const data = (await response.json()) as { image_url?: string; image_base64?: string };
      return {
        success: true,
        data: {
          id: crypto.randomUUID(),
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
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: isTimeout ? 'Request timed out' : (err instanceof Error ? err.message : String(err)),
          retryable: true,
        },
      };
    }
  }

}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default export instance (used in service bootstrap).
export const nanoBananaProvider = new NanoBananaProvider();
