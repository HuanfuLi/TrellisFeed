/**
 * imageGeneration.bootstrap
 *
 * Wires the NanoBanana and Gemini providers into the ImageGenerationService
 * and syncs API keys from user settings.
 *
 * Provider order is determined by `imageGeneration.primaryProvider`:
 *   - 'nanoBanana' — NanoBanana first, Gemini fallback (only if Gemini key present)
 *   - 'gemini'     — Gemini first, NanoBanana fallback (only if NanoBanana key present)
 *   - 'auto'       — pick whichever key(s) are present; NanoBanana preferred if both set
 *
 * If only one key is present, only that provider is registered (no unconfigured
 * provider silently failing before the configured one).
 *
 * Call `bootstrapImageGeneration()` once at app start (or after settings change).
 */

import { imageGenerationService } from './imageGeneration.service';
import { NanoBananaProvider } from '../providers/nanoBanana.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { settingsService } from './settings.service';

export function bootstrapImageGeneration(): void {
  const settings = settingsService.getSync();
  const imageSettings = settings.imageGeneration;

  const nanoBananaKey = imageSettings?.nanoBananaApiKey ?? '';
  const geminiKey = imageSettings?.geminiApiKey ?? '';
  const geminiModel = imageSettings?.geminiModel || 'gemini-3.1-flash-image-preview';
  const primaryProvider = imageSettings?.primaryProvider ?? 'auto';

  const nanoBanana = new NanoBananaProvider(nanoBananaKey);
  const gemini = new GeminiProvider(geminiKey, geminiModel);

  const hasNanoBanana = nanoBanana.isConfigured();
  const hasGemini = gemini.isConfigured();

  let providers: (NanoBananaProvider | GeminiProvider)[];

  if (primaryProvider === 'gemini') {
    // User explicitly wants Gemini first.
    if (hasGemini && hasNanoBanana) {
      providers = [gemini, nanoBanana];
    } else if (hasGemini) {
      providers = [gemini];
    } else if (hasNanoBanana) {
      // Gemini selected but no key — fall back to NanoBanana.
      providers = [nanoBanana];
    } else {
      // Neither configured — use both (mock fallback handles it gracefully).
      providers = [gemini, nanoBanana];
    }
  } else if (primaryProvider === 'nanoBanana') {
    // User explicitly wants NanoBanana first.
    if (hasNanoBanana && hasGemini) {
      providers = [nanoBanana, gemini];
    } else if (hasNanoBanana) {
      providers = [nanoBanana];
    } else if (hasGemini) {
      // NanoBanana selected but no key — fall back to Gemini.
      providers = [gemini];
    } else {
      providers = [nanoBanana, gemini];
    }
  } else {
    // 'auto': include configured providers first; fall back to mock if neither.
    if (hasNanoBanana && hasGemini) {
      providers = [nanoBanana, gemini];
    } else if (hasGemini) {
      providers = [gemini];
    } else if (hasNanoBanana) {
      providers = [nanoBanana];
    } else {
      // No keys — use NanoBanana (mock fallback) so we always have a provider.
      providers = [nanoBanana, gemini];
    }
  }

  imageGenerationService.setProviders(providers);

  imageGenerationService.configure({
    nanoBananaApiKey: nanoBananaKey,
    geminiApiKey: geminiKey,
  });
}
