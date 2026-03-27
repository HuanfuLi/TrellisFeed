/**
 * GeminiProvider
 *
 * Fallback image generation provider using Google Gemini Imagen API.
 *
 * Requires API key in Settings. If key not configured or API fails,
 * returns a structured error — callers decide how to handle it.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
 * Auth: API key as query param (?key=...)
 */

import type { ServiceResult, GeneratedImage, ImageStyle } from '../types';
import type { IImageProvider, ImageProviderOptions } from './imageProvider.interface';

export class GeminiProvider implements IImageProvider {
  readonly name = 'Gemini';
  private apiKey: string;

  private readonly modelEndpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
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
          message: 'Gemini API key not configured. Add it in Settings → Image Generation.',
          retryable: false,
        },
      };
    }
    return this._callWithRetry(prompt, style, options);
  }

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
        if (result.error?.code === 'API_RATE_LIMITED') {
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 8000);
          continue;
        }
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
        message: 'Gemini image generation failed after multiple retries.',
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

    const styleHint =
      style === 'infograph'
        ? 'infographic style, clean data visualization, bold typography'
        : style === 'illustration'
          ? 'digital illustration, vibrant colors, artistic'
          : 'photorealistic, cinematic lighting, high quality';
    const fullPrompt = `${prompt}. Visual style: ${styleHint}`;

    try {
      const response = await fetch(`${this.modelEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: fullPrompt }],
          parameters: { sampleCount: 1 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        return {
          success: false,
          error: { code: 'API_RATE_LIMITED', message: 'Gemini rate limit exceeded', retryable: true },
        };
      }
      if (response.status === 400 || response.status === 403) {
        return {
          success: false,
          error: { code: 'API_KEY_INVALID', message: 'Invalid Gemini API key', retryable: false },
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: `HTTP ${response.status}`, retryable: true },
        };
      }

      const data = (await response.json()) as {
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };
      const prediction = data.predictions?.[0];
      if (!prediction?.bytesBase64Encoded) {
        return {
          success: false,
          error: { code: 'UNKNOWN_ERROR', message: 'No image data in response', retryable: false },
        };
      }

      const mime = prediction.mimeType ?? 'image/png';
      return {
        success: true,
        data: {
          id: crypto.randomUUID(),
          prompt,
          style,
          imageBase64: `data:${mime};base64,${prediction.bytesBase64Encoded}`,
          provider: 'gemini',
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const geminiProvider = new GeminiProvider();
