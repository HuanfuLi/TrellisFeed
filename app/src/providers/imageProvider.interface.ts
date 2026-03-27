/**
 * IImageProvider
 *
 * Common interface that all image generation providers must implement.
 * This allows the ImageGenerationService to treat NanoBanana, Gemini,
 * and any future provider uniformly.
 */

import type { ServiceResult, GeneratedImage, ImageStyle } from '../types';

export interface ImageProviderOptions {
  /** Maximum time to wait for a response (ms). */
  timeoutMs: number;
  /** Number of retry attempts before giving up. */
  maxRetries: number;
}

export interface IImageProvider {
  /** Human-readable provider name (used in logs). */
  readonly name: string;

  /**
   * Generate an image from a text prompt.
   *
   * @param prompt   Natural-language description of the desired image.
   * @param style    Visual style hint ('infograph' | 'illustration' | 'photo').
   * @param options  Timeout and retry configuration.
   * @returns        ServiceResult containing the generated image or an error.
   */
  generate(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>>;

  /** Whether the provider has a valid API key configured. */
  isConfigured(): boolean;
}
