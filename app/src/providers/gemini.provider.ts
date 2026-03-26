/**
 * GeminiProvider
 *
 * Fallback image generation provider using Google Gemini API.
 *
 * Gemini's imagen endpoint (Imagen 3) supports image generation via
 * the REST API. We use fetch() rather than installing a new SDK to
 * keep the bundle lean.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
 * Auth: API key as query param (?key=...)
 *
 * When no API key is configured the provider returns deterministic
 * mock SVG images, mirroring the NanoBanana mock behaviour.
 */

import type { ServiceResult, GeneratedImage, ImageStyle } from '../types';
import type { IImageProvider, ImageProviderOptions } from './imageProvider.interface';

// ─── Mock image palette ───────────────────────────────────────────────────────

const MOCK_GRADIENTS: Record<ImageStyle, string[]> = {
  infograph: [
    'linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #42a5f5 100%)',
    'linear-gradient(135deg, #006064 0%, #00838f 50%, #4dd0e1 100%)',
  ],
  illustration: [
    'linear-gradient(135deg, #6a1b9a 0%, #9c27b0 50%, #e1bee7 100%)',
    'linear-gradient(135deg, #f57f17 0%, #fbc02d 50%, #fff176 100%)',
  ],
  photo: [
    'linear-gradient(135deg, #37474f 0%, #607d8b 50%, #cfd8dc 100%)',
    'linear-gradient(135deg, #1b5e20 0%, #388e3c 50%, #a5d6a7 100%)',
  ],
};

function deterministicIndex(seed: string, length: number): number {
  let h = 0;
  for (const ch of seed) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return ((h % length) + length) % length;
}

function buildMockSvg(prompt: string, style: ImageStyle): string {
  const gradients = MOCK_GRADIENTS[style];
  const idx = deterministicIndex(prompt, gradients.length);
  void gradients[idx]; // referenced for future real implementation
  const icon = style === 'infograph' ? '📈' : style === 'illustration' ? '✨' : '🌅';
  const label = prompt.slice(0, 40) + (prompt.length > 40 ? '…' : '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1b2a"/>
      <stop offset="50%" style="stop-color:#1b2a4a"/>
      <stop offset="100%" style="stop-color:#243b6e"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <text x="320" y="170" text-anchor="middle" font-size="72" font-family="system-ui">${icon}</text>
  <text x="320" y="230" text-anchor="middle" font-size="16" fill="rgba(255,255,255,0.8)" font-family="system-ui">${label}</text>
  <text x="320" y="260" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.5)" font-family="system-ui">Gemini · ${style}</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GeminiProvider implements IImageProvider {
  readonly name = 'Gemini';
  private apiKey: string;

  // Imagen 3 model endpoint
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
      return this._mockResult(prompt, style);
    }
    return this._callWithRetry(prompt, style, options);
  }

  // ─── Real API call ─────────────────────────────────────────────────────────

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

    console.warn('[GeminiProvider] All retries failed, returning mock result');
    return this._mockResult(prompt, style);
  }

  private async _callApi(
    prompt: string,
    style: ImageStyle,
    timeoutMs: number,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Build a style-aware prompt.
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

  // ─── Mock ──────────────────────────────────────────────────────────────────

  private _mockResult(prompt: string, style: ImageStyle): ServiceResult<Omit<GeneratedImage, 'postId'>> {
    return {
      success: true,
      data: {
        id: crypto.randomUUID(),
        prompt,
        style,
        imageBase64: buildMockSvg(prompt, style),
        provider: 'mock',
        generatedAt: Date.now(),
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const geminiProvider = new GeminiProvider();
