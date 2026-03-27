/**
 * ImageGenerationService
 *
 * Orchestrates AI image generation with multi-provider fallback,
 * localStorage caching, and LRU eviction.
 *
 * Provider priority: NanoBanana (primary) → Gemini (fallback) → Mock (dev/offline)
 *
 * Cache key format: `img-cache-{postId}-{style}`
 * Metadata key:     `img-cache-meta`
 */

import type {
  ServiceResult,
  GeneratedImage,
  ImageCacheMetadata,
  CacheStats,
  ImageStyle,
  ImageGenerationConfig,
} from '../types';
import type { IImageProvider } from '../providers/imageProvider.interface';

// ─── Cache constants ─────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'img-cache-';
const CACHE_META_KEY = 'img-cache-meta';
const DEFAULT_MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Service ──────────────────────────────────────────────────────────────────

class ImageGenerationService {
  private providers: IImageProvider[] = [];
  private config: ImageGenerationConfig = {
    maxCacheSizeBytes: DEFAULT_MAX_CACHE_BYTES,
    cacheTtlMs: DEFAULT_CACHE_TTL_MS,
    requestTimeoutMs: 15_000,
    maxRetries: 3,
  };

  /**
   * Register image providers in priority order.
   * The first provider is tried first; subsequent ones are fallbacks.
   */
  setProviders(providers: IImageProvider[]): void {
    this.providers = providers;
  }

  /**
   * Update runtime configuration (API keys, cache limits, etc.).
   */
  configure(config: Partial<ImageGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate an image for the given post + style combo.
   * Checks the cache first; falls back through providers on miss.
   * Logs generation time for performance monitoring.
   */
  async generateImage(
    postId: string,
    prompt: string,
    style: ImageStyle,
  ): Promise<ServiceResult<GeneratedImage>> {
    // 1. Cache hit?
    const cached = await this.retrieveCachedImage(postId, style);
    if (cached) {
      return { success: true, data: cached };
    }

    // 2. Try each provider in order.
    let lastError = 'No providers configured';
    const t0 = Date.now();

    for (const provider of this.providers) {
      try {
        const providerStart = Date.now();
        const result = await provider.generate(prompt, style, {
          timeoutMs: this.config.requestTimeoutMs,
          maxRetries: this.config.maxRetries,
        });
        const elapsed = Date.now() - providerStart;

        if (result.success && result.data) {
          const image: GeneratedImage = {
            ...result.data,
            postId,
          };
          // Cache the successful result.
          await this.cacheImage(postId, [image]);
          console.debug(
            `[ImageGenerationService] ${provider.name} generated image in ${elapsed}ms (total: ${Date.now() - t0}ms)`,
          );
          return { success: true, data: image };
        }
        lastError = result.error?.message ?? 'Provider returned no data';
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[ImageGenerationService] Provider ${provider.name} failed:`, lastError);
      }
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: `All image providers failed. Last error: ${lastError}`,
        retryable: true,
      },
    };
  }

  /**
   * Persist a set of generated images to the localStorage cache.
   * Runs LRU eviction if the cache exceeds the configured size limit.
   */
  async cacheImage(postId: string, images: GeneratedImage[]): Promise<void> {
    const meta = this._loadMeta();
    const now = Date.now();

    for (const image of images) {
      const cacheKey = this._cacheKey(postId, image.style);
      const payload = JSON.stringify(image);
      const sizeBytes = new Blob([payload]).size;

      try {
        localStorage.setItem(cacheKey, payload);
      } catch {
        // Storage full — evict and retry.
        this._evictLRU(sizeBytes, meta);
        try {
          localStorage.setItem(cacheKey, payload);
        } catch {
          console.warn('[ImageGenerationService] Cache write failed after eviction');
          continue;
        }
      }

      meta[cacheKey] = {
        postId,
        style: image.style,
        provider: image.provider,
        generatedAt: image.generatedAt,
        cachedAt: now,
        expiresAt: now + this.config.cacheTtlMs,
        sizeBytes,
      };
    }

    this._saveMeta(meta);
    this._evictExpiredAndOverLimit(meta);

    // Warn at 80% capacity so the UI can surface a notification if needed.
    const stats = this.getCacheStats();
    const usageRatio = stats.totalSizeBytes / this.config.maxCacheSizeBytes;
    if (usageRatio >= 0.8) {
      console.warn(
        `[ImageGenerationService] Cache at ${Math.round(usageRatio * 100)}% capacity ` +
        `(${(stats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB / ` +
        `${(this.config.maxCacheSizeBytes / (1024 * 1024)).toFixed(0)} MB)`,
      );
    }
  }

  /**
   * Retrieve a cached image by postId + style.
   * Returns null on cache miss or if the entry has expired.
   */
  async retrieveCachedImage(postId: string, style: ImageStyle): Promise<GeneratedImage | null> {
    const cacheKey = this._cacheKey(postId, style);
    const meta = this._loadMeta();
    const entry = meta[cacheKey];

    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      // Expired — remove it.
      this._removeCacheEntry(cacheKey, meta);
      return null;
    }

    const raw = localStorage.getItem(cacheKey);
    if (!raw) {
      // Data missing despite valid metadata — clean up metadata.
      delete meta[cacheKey];
      this._saveMeta(meta);
      return null;
    }

    try {
      return JSON.parse(raw) as GeneratedImage;
    } catch {
      this._removeCacheEntry(cacheKey, meta);
      return null;
    }
  }

  /**
   * Delete all cached images and reset metadata.
   */
  async clearImageCache(): Promise<void> {
    const meta = this._loadMeta();
    for (const key of Object.keys(meta)) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(CACHE_META_KEY);
  }

  /**
   * Return stats about the current image cache.
   */
  getCacheStats(): CacheStats {
    const meta = this._loadMeta();
    const entries = Object.values(meta);

    if (entries.length === 0) {
      return { totalSizeBytes: 0, itemCount: 0, oldestItemAt: null, newestItemAt: null };
    }

    const totalSizeBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const cachedAts = entries.map((e) => e.cachedAt);

    return {
      totalSizeBytes,
      itemCount: entries.length,
      oldestItemAt: Math.min(...cachedAts),
      newestItemAt: Math.max(...cachedAts),
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _cacheKey(postId: string, style: ImageStyle): string {
    return `${CACHE_KEY_PREFIX}${postId}-${style}`;
  }

  private _loadMeta(): Record<string, ImageCacheMetadata> {
    try {
      const raw = localStorage.getItem(CACHE_META_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, ImageCacheMetadata>;
    } catch {
      return {};
    }
  }

  private _saveMeta(meta: Record<string, ImageCacheMetadata>): void {
    try {
      localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
    } catch {
      // ignore
    }
  }

  private _removeCacheEntry(cacheKey: string, meta: Record<string, ImageCacheMetadata>): void {
    localStorage.removeItem(cacheKey);
    delete meta[cacheKey];
    this._saveMeta(meta);
  }

  /**
   * Evict least-recently-cached entries until `neededBytes` of space is freed.
   */
  private _evictLRU(neededBytes: number, meta: Record<string, ImageCacheMetadata>): void {
    const sorted = Object.entries(meta).sort(([, a], [, b]) => a.cachedAt - b.cachedAt);
    let freed = 0;
    for (const [key, entry] of sorted) {
      if (freed >= neededBytes) break;
      freed += entry.sizeBytes;
      localStorage.removeItem(key);
      delete meta[key];
    }
    this._saveMeta(meta);
  }

  /**
   * Remove expired entries and enforce the total size limit via LRU.
   */
  private _evictExpiredAndOverLimit(meta: Record<string, ImageCacheMetadata>): void {
    const now = Date.now();

    // Remove expired.
    for (const [key, entry] of Object.entries(meta)) {
      if (now > entry.expiresAt) {
        localStorage.removeItem(key);
        delete meta[key];
      }
    }

    // Enforce size limit.
    let totalBytes = Object.values(meta).reduce((sum, e) => sum + e.sizeBytes, 0);
    if (totalBytes > this.config.maxCacheSizeBytes) {
      const sorted = Object.entries(meta).sort(([, a], [, b]) => a.cachedAt - b.cachedAt);
      for (const [key, entry] of sorted) {
        if (totalBytes <= this.config.maxCacheSizeBytes) break;
        totalBytes -= entry.sizeBytes;
        localStorage.removeItem(key);
        delete meta[key];
      }
    }

    this._saveMeta(meta);
  }
}

export const imageGenerationService = new ImageGenerationService();
